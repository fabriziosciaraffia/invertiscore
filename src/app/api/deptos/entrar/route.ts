import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COOKIE_INVITACION_USADA } from "@/lib/referido-servidor";
import { conEspejo } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { ejecutarAlta } from "@/lib/deptos/alta-servidor";
import { entrarConCodigo } from "@/lib/deptos/entrada";
import { hashCodigo, marcarAlta, marcarRepuesta, registrarEntrada, ultimaEntrada } from "@/lib/deptos/entrada-servidor";
import { leerPendiente, normalizarCorreo } from "@/lib/deptos/servidor";
import { cronometro } from "@/lib/cronometro";

/** El primer pedido de esta instancia de la función (arranque en frío): va en la cabecera Server-Timing. */
let pedidosDeLaInstancia = 0;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/entrar { correo, codigo } (22-oct-2026, «Entrar» no puede quedar girando; reglas en
// lib/deptos/entrada.ts): el código de /deptos se verifica ACÁ, con la sesión en la cookie de la respuesta, y en el mismo
// pedido corre el alta (ejecutarAlta, la misma de POST /api/deptos/alta). Antes el navegador verificaba contra Supabase y
// recién después pedía el alta: si la respuesta del verify no volvía, el alta no se pedía nunca. Si este pedido se pierde,
// la pantalla lo repite con el MISMO código: el servidor reconoce que ese código ya entró (deptos_entradas), repone la
// sesión una vez y devuelve el alta que ya hizo. Responde lo mismo que el alta, o `{ error: "codigo" }` (400).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/deptos/entrar";
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const crono = cronometro();
  const frio = pedidosDeLaInstancia++ === 0;
  const b = (await request.json().catch(() => ({}))) as { correo?: unknown; codigo?: unknown };
  const correo = typeof b.correo === "string" ? normalizarCorreo(b.correo) : "";
  const codigo = typeof b.codigo === "string" ? limpiarCodigo(b.codigo) : "";
  if (!CORREO_OK.test(correo) || !codigoValido(codigo)) return NextResponse.json({ error: "codigo" }, { status: 400 });
  const supabase = createClient();
  const admin = createServiceClient();
  let invitacionUsada = false;
  // El espejo del CompleteRegistration de la cuenta nueva (22-oct-2026): el pixel lo repite con el mismo id.
  let espejos: EventoEspejo[] = [];
  // EL ALTA RÁPIDA (25-oct-2026, lib/deptos/alta-orden.ts): lo elegido en /deptos se pide YA, junto con verificar el código
  // (los dos solo necesitan el correo), y el alta usa la cuenta que devuelve la verificación (no la pide otra vez).
  const pendientePrevia = leerPendiente(admin, correo).catch(() => null);
  let cuenta: User | null = null;
  try {
    const r = await entrarConCodigo(correo, codigo, {
      sesionActual: () => crono.medir("sesion", async () => { const u = (await supabase.auth.getUser()).data.user ?? null; if (u) cuenta = u; return u; }),
      verificar: (c, t) => crono.medir("verificar", async () => {
        const { data, error } = await supabase.auth.verifyOtp({ email: c, token: t, type: "email" });
        if (!error && data.user) cuenta = data.user;
        return error ? null : data.user ?? null;
      }),
      hash: (c, t) => hashCodigo(c, t),
      ultimaEntrada: (c) => crono.medir("ultima-entrada", ultimaEntrada(admin, c)),
      registrar: (p) => crono.medir("registrar-entrada", registrarEntrada(admin, { ...p, metodo: "codigo" })),
      // Sin código: un enlace mágico generado y verificado acá (no sale ningún correo); la sesión queda en la cookie.
      reponerSesion: async (c) => {
        const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: c });
        if (error || !link.properties?.email_otp) return null;
        const { data, error: e2 } = await supabase.auth.verifyOtp({ email: c, token: link.properties.email_otp, type: "email" });
        if (!e2 && data.user) cuenta = data.user;
        return e2 ? null : data.user ?? null;
      },
      marcarRepuesta: (id) => marcarRepuesta(admin, id),
      alta: async () => {
        const user = cuenta ?? (await crono.medir("usuario", supabase.auth.getUser())).data.user;
        if (!user) return { cuerpo: { error: "sin-sesion" }, status: 401 };
        const a = await ejecutarAlta(admin, user, request, { ruta: RUTA, crono, pendiente: pendientePrevia, despues: waitUntil });
        invitacionUsada = a.invitacionUsada;
        espejos = a.espejos;
        return { cuerpo: a.cuerpo, status: a.status };
      },
      marcarAlta: (p) => marcarAlta(admin, p),
      despues: waitUntil,
    });
    if (r.tipo === "codigo") return NextResponse.json({ error: "codigo" }, { status: 400 });
    const res = conEspejo(NextResponse.json({ ...r.cuerpo, via: r.via }, r.status ? { status: r.status } : undefined), espejos, request);
    res.headers.set("Server-Timing", `${frio ? 'frio;desc="1", ' : ""}${crono.serverTiming()}`);
    if (invitacionUsada) res.cookies.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
    return res;
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "entrar" });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
