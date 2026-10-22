import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COOKIE_INVITACION_USADA } from "@/lib/referido-servidor";
import { ejecutarAlta } from "@/lib/deptos/alta-servidor";
import { marcarAlta } from "@/lib/deptos/entrada-servidor";

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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  const b = (await request.json().catch(() => ({}))) as { p?: unknown };
  try {
    const r = await ejecutarAlta(admin, user, request, { clave: b.p, ruta: RUTA });
    if (typeof r.cuerpo.estado === "string") await marcarAlta(admin, { correo: user.email, userId: user.id, alta: r.cuerpo });
    const res = NextResponse.json(r.cuerpo, r.status ? { status: r.status } : undefined);
    if (r.invitacionUsada) res.cookies.set(COOKIE_INVITACION_USADA.name, COOKIE_INVITACION_USADA.value, COOKIE_INVITACION_USADA.options);
    return res;
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "alta", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
