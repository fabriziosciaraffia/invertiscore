import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COOKIE_INVITACION_USADA } from "@/lib/referido-servidor";
import { codigoValido, limpiarCodigo } from "@/lib/lo-que-sigue/codigo";
import { ejecutarAlta } from "@/lib/deptos/alta-servidor";
import { entrarConCodigo } from "@/lib/deptos/entrada";
import { hashCodigo, marcarAlta, marcarRepuesta, registrarEntrada, ultimaEntrada } from "@/lib/deptos/entrada-servidor";
import { normalizarCorreo } from "@/lib/deptos/servidor";

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
  const b = (await request.json().catch(() => ({}))) as { correo?: unknown; codigo?: unknown };
  const correo = typeof b.correo === "string" ? normalizarCorreo(b.correo) : "";
  const codigo = typeof b.codigo === "string" ? limpiarCodigo(b.codigo) : "";
  if (!CORREO_OK.test(correo) || !codigoValido(codigo)) return NextResponse.json({ error: "codigo" }, { status: 400 });
  const supabase = createClient();
  const admin = createServiceClient();
  let invitacionUsada = false;
  try {
    const r = await entrarConCodigo(correo, codigo, {
      sesionActual: async () => (await supabase.auth.getUser()).data.user ?? null,
      verificar: async (c, t) => {
        const { data, error } = await supabase.auth.verifyOtp({ email: c, token: t, type: "email" });
        return error ? null : data.user ?? null;
      },
      hash: (c, t) => hashCodigo(c, t),
      ultimaEntrada: (c) => ultimaEntrada(admin, c),
      registrar: (p) => registrarEntrada(admin, { ...p, metodo: "codigo" }),
      // Sin código: un enlace mágico generado y verificado acá (no sale ningún correo); la sesión queda en la cookie.
      reponerSesion: async (c) => {
        const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: c });
        if (error || !link.properties?.email_otp) return null;
        const { data, error: e2 } = await supabase.auth.verifyOtp({ email: c, token: link.properties.email_otp, type: "email" });
        return e2 ? null : data.user ?? null;
      },
      marcarRepuesta: (id) => marcarRepuesta(admin, id),
      alta: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { cuerpo: { error: "sin-sesion" }, status: 401 };
        const a = await ejecutarAlta(admin, user, request, { ruta: RUTA });
        invitacionUsada = a.invitacionUsada;
        return { cuerpo: a.cuerpo, status: a.status };
      },
      marcarAlta: (p) => marcarAlta(admin, p),
    });
    if (r.tipo === "codigo") return NextResponse.json({ error: "codigo" }, { status: 400 });
    const res = NextResponse.json({ ...r.cuerpo, via: r.via }, r.status ? { status: r.status } : undefined);
    if (invitacionUsada) res.cookies.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
    return res;
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "entrar" });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
