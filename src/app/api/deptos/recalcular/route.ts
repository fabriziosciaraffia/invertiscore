import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { combinacionElegida } from "@/lib/guia/aviso-analizar";
import { recalcularAviso } from "@/lib/guia/recalcular-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/deptos/recalcular (23-oct-2026, mockup D2 del pop-up): el veredicto, el puntaje y el flujo de un depto de la
// selección de quien entró, con el pie y el plazo que eligió en «Cambiar» (lib/guia/recalcular-servidor.ts). Solo con
// sesión y solo sobre un depto de una selección propia (el token), como «Analizar este». No escribe nada.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
const RUTA = "POST /api/deptos/recalcular";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { semanal?: unknown; avisoId?: unknown; origenId?: unknown; piePct?: unknown; plazoAnios?: unknown };
  const combo = combinacionElegida(b);
  const origenId = typeof b.origenId === "string" && UUID.test(b.origenId) ? b.origenId : null;
  if (typeof b.semanal !== "string" || typeof b.avisoId !== "string" || !UUID.test(b.avisoId) || !combo) return NextResponse.json({ error: "datos" }, { status: 400 });
  try {
    const r = await recalcularAviso(createServiceClient(), { userId: user.id, token: b.semanal, origenId, avisoId: b.avisoId, combo });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "recalcular", userId: user.id, extra: { avisoId: b.avisoId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
