import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Goal F — espejo del ai-status LTR para la prosa STR (dictamen de "generación
// muerta"). El cliente ya no genera al abrir: pollea acá y rescata SOLO cuando
// este endpoint lo declara. Dos señales:
//   1. FAST-FAIL: pipeline_timing.generaciones registra un intento STR con
//      resultado "error" y ninguno "ok" → murió con causa, rescate inmediato.
//   2. TIMEOUT DURO: sin prosa tras UMBRAL_MUERTA_MS desde el submit. Con
//      maxDuration=300s en /api/analisis/short-term (Goal F), la invocación que
//      corre el waitUntil NO puede seguir viva a los 6 min. Si sube ese
//      maxDuration, este umbral sube con él.
// BONUS estructural: filas locked/legacy SIN generación background (submit
// viejo o sin pipeline_timing → created_at) quedan "muertas" al primer poll →
// el rescate hace de on-demand con semántica de retry, sin código especial.
const UMBRAL_MUERTA_MS = 6 * 60 * 1000;

interface GeneracionEntry {
  tipo?: string;
  resultado?: string;
}

function generacionMuerta(pipelineTiming: unknown, createdAt: string | null): boolean {
  const pt = (pipelineTiming ?? {}) as {
    submit?: { recibido_at?: string };
    generaciones?: GeneracionEntry[];
  };
  const gens = Array.isArray(pt.generaciones) ? pt.generaciones.filter((g) => g?.tipo === "str") : [];
  // Fast-fail solo si murió con causa y NUNCA hubo éxito (un "ok" sin prosa es
  // un write perdido rarísimo — lo decide el timeout duro, no esto).
  const huboOk = gens.some((g) => g.resultado === "ok");
  if (!huboOk && gens.some((g) => g.resultado === "error")) return true;

  const inicioRaw = pt.submit?.recibido_at ?? createdAt;
  if (!inicioRaw) return false;
  const inicio = Date.parse(inicioRaw);
  if (!Number.isFinite(inicio)) return false;
  return Date.now() - inicio > UMBRAL_MUERTA_MS;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("analisis")
      .select("ai_analysis, pipeline_timing, created_at")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ai_analysis: null, ready: false, puedeRescate: false });
    }

    // Ready = hay prosa con shape de objeto. La FRESCURA de versión la decide el
    // server component de la página (pasa aiStale al cliente y ese camino no
    // pollea — regenera directo), igual que en LTR.
    const ready = !!data.ai_analysis && typeof data.ai_analysis === "object";
    return NextResponse.json({
      ai_analysis: ready ? data.ai_analysis : null,
      ready,
      puedeRescate: ready ? false : generacionMuerta(data.pipeline_timing, data.created_at as string | null),
    });
  } catch {
    return NextResponse.json({ ai_analysis: null, ready: false, puedeRescate: false });
  }
}
