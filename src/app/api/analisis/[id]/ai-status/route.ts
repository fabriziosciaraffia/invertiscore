import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasNewAiStructure } from "@/lib/ai-generation";

// Goal C — dictamen de "generación muerta". El cliente ya no decide rescatar
// por timeout propio (eso duplicaba la generación completa con la background
// aún viva); rescata SOLO cuando este endpoint lo declara. Dos señales:
//   1. FAST-FAIL: pipeline_timing.generaciones registra un intento LTR con
//      resultado "error" y ninguno "ok" → murió con causa, rescate inmediato.
//   2. TIMEOUT DURO: sin prosa tras UMBRAL_MUERTA_MS desde el submit. Con
//      maxDuration=300s en /api/analisis (mismo goal), la invocación que corre
//      el waitUntil NO puede seguir viva a los 6 min — la ausencia de prosa es
//      prueba de muerte, no de lentitud. Si algún día sube ese maxDuration,
//      este umbral sube con él.
// Filas pre-Goal-A sin pipeline_timing caen al created_at (≈ recibido_at).
const UMBRAL_MUERTA_MS = 6 * 60 * 1000;

interface GeneracionEntry {
  tipo?: string;
  resultado?: string;
}

function generacionMuerta(
  pipelineTiming: unknown,
  createdAt: string | null,
): boolean {
  const pt = (pipelineTiming ?? {}) as {
    submit?: { recibido_at?: string };
    generaciones?: GeneracionEntry[];
  };

  const gens = Array.isArray(pt.generaciones) ? pt.generaciones.filter((g) => g?.tipo === "ltr") : [];
  // Fast-fail solo si murió con causa y NUNCA hubo éxito. (Un "ok" sin prosa es
  // un write perdido rarísimo — lo decide el timeout duro de abajo, no esto.)
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

    const ready = hasNewAiStructure(data.ai_analysis);
    return NextResponse.json({
      ai_analysis: ready ? data.ai_analysis : null,
      ready,
      puedeRescate: ready ? false : generacionMuerta(data.pipeline_timing, data.created_at as string | null),
    });
  } catch {
    return NextResponse.json({ ai_analysis: null, ready: false, puedeRescate: false });
  }
}
