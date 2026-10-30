import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { sondaDeCandidato } from "@/lib/avisos/estandar-deptos";
import { esPiePopup, esPlazoPopup } from "@/lib/explorar/explorar";
import { tasaElegidaDe } from "@/lib/deptos/estandar";
import { candidatoExplorar } from "@/lib/explorar/servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/recalcular { avisoId, piePct, plazoAnios, tasaPct? } (23-oct-2026; la tasa, 30-oct-2026): el «Cambiar» del pop-up de «Analizar
// este». Devuelve lo que la sonda del motor dice del aviso con ese pie y ese plazo —veredicto, puntaje, flujo y cuota—,
// con la evaluación guardada de la noche y la tasa de mercado (estandar-deptos.ts › sondaDeCandidato). No cobra, no
// escribe, no consulta nada en vivo. Solo con sesión.
// ─────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { avisoId?: unknown; piePct?: unknown; plazoAnios?: unknown; tasaPct?: unknown };
  if (typeof b.avisoId !== "string" || !UUID.test(b.avisoId) || !esPiePopup(b.piePct) || !esPlazoPopup(b.plazoAnios)) return NextResponse.json({ error: "datos" }, { status: 400 });
  // La tasa elegida (null o ausente = la de hoy); una que no es de la lista no se acepta.
  const tasa = tasaElegidaDe(b.tasaPct);
  if (b.tasaPct != null && tasa == null) return NextResponse.json({ error: "tasa" }, { status: 400 });
  const admin = createServiceClient();
  try {
    const [c, cfg] = await Promise.all([candidatoExplorar(admin, b.avisoId), leerConfigGuia(admin)]);
    if (!c) return NextResponse.json({ error: "aviso" }, { status: 404 });
    const s = sondaDeCandidato(c, { piePct: Number(b.piePct), plazoAnios: Number(b.plazoAnios), tasa }, cfg);
    if (!s || !s.veredicto) return NextResponse.json({ error: "sin-evaluacion" }, { status: 422 });
    return NextResponse.json({ veredicto: s.veredicto, score: s.score, flujo: s.flujo, cuota: s.cuota }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/explorar/recalcular", operacion: "sonda", userId: user.id, extra: { avisoId: b.avisoId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
