import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { cuentaPortal } from "@/lib/explorar/portal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/cuenta (29-oct-2026, la puerta E): lo que Explorar sabe de la cuenta (portal-servidor.ts › cuentaPortal),
// para la pantalla que se abrió SIN CUENTA y acaba de terminar el alta en la hoja de registro: con esto sabe el saldo (el
// regalo), los guardados y los informes, sin recargar la página ni perder el pin. Solo con sesión; no se guarda en caché.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json(await cuentaPortal(createServiceClient(), user), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/cuenta", operacion: "cuenta", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
