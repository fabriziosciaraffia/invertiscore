// ─────────────────────────────────────────────────────────────────────────
// Generación + persistencia de la prosa STR — núcleo COMPARTIDO (Goal F).
//
// Un solo camino de generación para los dos disparadores:
//   · background: waitUntil del submit STR (patrón LTR, Goal C) — trigger
//     "background".
//   · on-demand: POST /api/analisis/short-term/ai (rescate con dictamen server,
//     regen de stale, botón manual) — el route pasa su trigger.
//
// Espejo del rol de generateAiAnalysis en LTR: recompute-antes-de-promptear
// (UF y fecha congeladas a la creación), generateStrProse (guards incluidos),
// UPDATE de ai_analysis + contadores de usage, y registro fail-soft en
// pipeline_timing. NO hace authz ni cobra crédito — eso es del caller.
// Devuelve la prosa persistida o null (falla: NO persiste → la versión no se
// sella → el rescate/reapertura reintenta).
// ─────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { Hallazgo } from "@/lib/types";
import { generateStrProse, PROMPT_VERSION_STR } from "@/lib/ai-generation-str";
import { simularStrDesdePersistido } from "@/lib/analysis/simular-str";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import { camposUpdateUsage } from "@/lib/ai-usage";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { persistGeneracionTiming, type GeneracionTrigger } from "@/lib/pipeline-timing";

export async function generarYPersistirProsaStr(args: {
  analysisId: string;
  /** Fila completa de `analisis` (select("*")): trae input_data, results,
   *  created_at y los contadores ai_* para la suma de usage. */
  analysis: Record<string, unknown>;
  supabase: SupabaseClient;
  anthropic: Anthropic;
  trigger: GeneracionTrigger;
}): Promise<Record<string, unknown> | null> {
  const { analysisId, analysis, supabase, anthropic, trigger } = args;

  const input = analysis.input_data as Record<string, unknown> | null;
  const results = analysis.results as
    | (ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] })
    | null;
  if (!input || !results) return null;

  const comuna = (analysis.comuna as string) ?? (input.comuna as string) ?? "";

  // Timing (Goal A): el prep (mediana + recompute) se mide desde acá; las
  // llamadas LLM vienen de generateStrProse. Fail-soft siempre.
  const tGen = Date.now();
  try {
    // FIX recompute-antes-de-promptear (espejo del render STR + ambas-generate). La fila
    // persiste `results` de fórmula posiblemente vieja (pre-homologación); si prompteáramos
    // desde ahí, la prosa citaría números stale mientras las cards (recompute-on-load)
    // muestran los actuales. Recomputamos con el motor de hoy desde input + airbnbRaw
    // congelado ANTES de promptear. UF y fecha CONGELADAS a la creación → idempotente.
    // Legacy irreconstruible (sin airbnbRaw) → `?? results` (fallback seguro al persistido).
    // Prompt-only: NO se persiste `results` acá (eso lo hace regen-corpus con gate aparte).
    const precioCompraUF = Number(input.precioCompraUF) || 0;
    const precioCompraCLP = Number(input.precioCompra) || 0;
    const ufFrozen = precioCompraUF > 0 ? precioCompraCLP / precioCompraUF : 38800;
    const asOfFrozen = new Date((analysis.created_at as string) ?? new Date().toISOString());
    const medianaStr = await prefetchMedianaComunaVenta(
      supabase,
      {
        comuna: (input.comuna as string) ?? comuna,
        superficie: Number(input.superficieUtil) || 0,
        dormitorios: Number(input.dormitorios) || 0,
        esNuevo: input.tipoPropiedad === "nuevo",
        antiguedad: typeof input.antiguedad === "number" ? input.antiguedad : undefined,
      },
      ufFrozen,
    );
    const rGen = (recomputeShortTermForLegacy(input, results, ufFrozen, asOfFrozen, medianaStr) ?? results) as
      ShortTermResult & { francoScore?: FrancoScoreSTR; hallazgos?: Hallazgo[] };

    // Simulaciones del CONGELADO (fronteras y matrices) para el prompt y [HERO-CLAIM].
    // Un fallo acá no frena la prosa: sin simulación el bloque no entra.
    let simulacion = null;
    try { simulacion = simularStrDesdePersistido(input, results as unknown as { airbnbRaw?: unknown }, ufFrozen, asOfFrozen); } catch { simulacion = null; }
    const gen = await generateStrProse({
      anthropic,
      inp: input,
      r: rGen,
      comuna,
      simulacion,
      logger: (m) => console.warn(`[STR AI v3] ${analysisId}: ${m}`),
    });
    const ai = gen.ai as unknown as Record<string, unknown>;
    const { data: guardado, error: updateError } = await supabase
      .from("analisis")
      .update({
        ai_analysis: ai,
        // Consumo de tokens de la generación, SUMADO a lo que ya tenía la fila
        // (regenerar no borra el costo previo). `analysis` viene de un
        // select("*"), así que ya trae los contadores actuales — cero queries nuevas.
        ...camposUpdateUsage(gen.usage, analysis, CLAUDE_MODEL),
      })
      .eq("id", analysisId)
      .select("id");
    if (updateError || !guardado?.length) {
      // T2.1: un UPDATE bloqueado por RLS no da error, da CERO filas. Antes esto devolvía
      // la prosa con 200 y el usuario leía un texto que no existe en la base (Sta. Rosa:
      // v15 en pantalla, v9 persistida, una generación pagada por visita). Es un fallo.
      captureApiError(updateError ?? new Error("prosa STR generada y no persistida: el UPDATE devolvió 0 filas (RLS)"), {
        ruta: `generarYPersistirProsaStr (${trigger})`,
        operacion: "persistir-prosa-str",
        analysisId,
        tags: { promptVersion: String(PROMPT_VERSION_STR), userIdNull: String(analysis.user_id == null) },
      });
      await persistGeneracionTiming(supabase, analysisId, {
        tipo: "str",
        trigger,
        inicio_at: new Date(tGen).toISOString(),
        fin_at: new Date().toISOString(),
        total_ms: Date.now() - tGen,
        resultado: "error",
        prompt_version: PROMPT_VERSION_STR,
        llamadas: gen.llamadas,
      });
      return null;
    }
    await persistGeneracionTiming(supabase, analysisId, {
      tipo: "str",
      trigger,
      inicio_at: new Date(tGen).toISOString(),
      fin_at: new Date().toISOString(),
      total_ms: Date.now() - tGen,
      resultado: "ok",
      prompt_version: PROMPT_VERSION_STR,
      llamadas: gen.llamadas,
    });
    return ai;
  } catch (genError) {
    console.error("[STR AI v3] generación falló:", genError);
    captureApiWarning(genError, {
      ruta: `generarYPersistirProsaStr (${trigger})`,
      operacion: "generar-prosa-str",
      analysisId,
    });
    await persistGeneracionTiming(supabase, analysisId, {
      tipo: "str",
      trigger,
      inicio_at: new Date(tGen).toISOString(),
      fin_at: new Date().toISOString(),
      total_ms: Date.now() - tGen,
      resultado: "error",
      prompt_version: PROMPT_VERSION_STR,
      llamadas: [],
    });
    return null;
  }
}
