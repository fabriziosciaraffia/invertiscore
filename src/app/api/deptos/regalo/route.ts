import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { regaloAltaVivo } from "@/lib/regalo-alta-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deptos/regalo (25-oct-2026, el alta rápida de /deptos; lib/deptos/alta-orden.ts): el regalo de alta de la
// cuenta con sesión. El alta responde antes de que el regalo termine (`regalo: "pendiente"`) y «Estás dentro» pregunta acá
// hasta que esté decidido: `{ vence }` si lo tiene, y `decidido` cuando ya no hay nada que esperar (otorgado o topado).
// Solo lee.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const admin = createServiceClient();
  try {
    const [vence, { data: decision }] = await Promise.all([
      regaloAltaVivo(admin, user.id),
      admin.from("regalos_alta").select("motivo").eq("user_id", user.id).maybeSingle(),
    ]);
    // Decidido: hay un lote vivo, o la decisión ya está escrita y no fue otorgar (topado). Un «otorgado» sin lote todavía
    // es que el lote se está cargando: se sigue preguntando.
    const decidido = !!vence || (!!decision && decision.motivo !== "otorgado");
    return NextResponse.json({ vence, decidido }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/deptos/regalo", operacion: "regalo", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
