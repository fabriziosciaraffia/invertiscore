import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COOKIE_INVITACION_USADA } from "@/lib/referido-servidor";
import { conEspejo } from "@/lib/meta/servidor";
import { ejecutarAlta } from "@/lib/deptos/alta-servidor";
import { marcarAlta } from "@/lib/deptos/entrada-servidor";
import { cronometro } from "@/lib/cronometro";
import { leerPendiente } from "@/lib/deptos/servidor";

/** El correo del token de la sesión, sin ir a Auth (se confirma después contra la cuenta verificada). */
function correoDelToken(token: string | undefined): string | null {
  try {
    const cuerpo = token?.split(".")[1];
    if (!cuerpo) return null;
    const j = JSON.parse(Buffer.from(cuerpo.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { email?: unknown };
    return typeof j.email === "string" ? j.email : null;
  } catch {
    return null;
  }
}

/** El primer pedido de esta instancia de la función (arranque en frío): va en la cabecera Server-Timing. */
let pedidosDeLaInstancia = 0;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/alta (16-oct-2026, la puerta B): después de entrar, con sesión. Lo que hace está en
// lib/deptos/alta-servidor.ts (ejecutarAlta), que comparte con la entrada por código (POST /api/deptos/entrar). Este
// camino es el de quien vuelve por el enlace del correo o por Google (`?entro=1` / `?entro=google`); desde el
// 22-oct-2026 deja marcada su entrada con el alta (deptos_entradas), así una entrada verificada que no llega acá cuenta
// como `alta_perdida` (lib/deptos/entrada-servidor.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/deptos/alta";

export async function POST(request: Request) {
  const crono = cronometro();
  const frio = pedidosDeLaInstancia++ === 0;
  const supabase = createClient();
  const admin = createServiceClient();
  // EL ALTA RÁPIDA (25-oct-2026): lo elegido se pide junto con verificar la sesión; si el correo no es el de la cuenta, no se usa.
  const { data: { session } } = await supabase.auth.getSession();
  const correoSesion = correoDelToken(session?.access_token);
  const pendientePrevia = correoSesion ? leerPendiente(admin, correoSesion).catch(() => null) : null;
  const { data: { user } } = await crono.medir("usuario", supabase.auth.getUser());
  if (!user?.email) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { p?: unknown };
  try {
    const mismaCuenta = !!pendientePrevia && (correoSesion ?? "").toLowerCase() === user.email.toLowerCase();
    const r = await ejecutarAlta(admin, user, request, { clave: b.p, ruta: RUTA, crono, despues: waitUntil, ...(mismaCuenta && pendientePrevia ? { pendiente: pendientePrevia } : {}) });
    // La marca de la entrada, después de responder (25-oct-2026, el alta rápida).
    if (typeof r.cuerpo.estado === "string") waitUntil(marcarAlta(admin, { correo: user.email, userId: user.id, alta: r.cuerpo }).catch(() => undefined));
    // El espejo del CompleteRegistration (22-oct-2026): el pixel lo repite con el mismo id.
    const res = conEspejo(NextResponse.json(r.cuerpo, r.status ? { status: r.status } : undefined), r.espejos, request);
    res.headers.set("Server-Timing", `${frio ? 'frio;desc="1", ' : ""}${crono.serverTiming()}`);
    if (r.invitacionUsada) res.cookies.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
    return res;
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "alta", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
