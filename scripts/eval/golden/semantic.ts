// ============================================================================
// GOLDEN SET — tier FULL · checklist SEMÁNTICO (juez Opus)
// ============================================================================
// Lo que ningún regex caza. Genera prosa fresca (persist:false) y la pasa por el
// juez versionado (scripts/eval/judge.ts, rúbrica analysis-voice-franco). Los
// flags son REPORTE para Fabrizio, NO bloquean (el juez tiene falsos positivos).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { runAnalysis } from "../../../src/lib/analysis";
import { buildEngineBundle, buildTruthBundle, runJudge } from "../judge";
import { GOLDEN_SEEDS, GOLDEN_UF } from "./seeds";

export interface SemanticReport {
  key: string;
  flags: Array<{ categoria: string; detalle: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function runSemanticTier(sb: SupabaseClient): Promise<SemanticReport[]> {
  const reports: SemanticReport[] = [];

  for (const seed of GOLDEN_SEEDS) {
    const ai = await generateAiAnalysis(seed.uuid, sb, { persist: false });
    if (!ai) { reports.push({ key: seed.key, flags: [{ categoria: "gen", detalle: "generación devolvió null" }] }); continue; }

    const results = runAnalysis(seed.input, GOLDEN_UF, seed.mediana);
    const engineBundle = buildEngineBundle(seed.input, results);
    const truthBundle = buildTruthBundle(seed.input.comuna, seed.input.lat ?? null, seed.input.lng ?? null, seed.mediana);
    const fixtureMeta = { id: seed.key, modalidad: "LTR", tier: "experto", ejes: seed.ejes, nota: seed.nota };

    let judge;
    try {
      judge = await runJudge({ fixtureMeta, aiAnalysis: ai, engineBundle, truthBundle });
    } catch (e) {
      reports.push({ key: seed.key, flags: [{ categoria: "juez-error", detalle: String((e as Error)?.message ?? e) }] });
      continue;
    }
    reports.push({
      key: seed.key,
      flags: (judge.hallazgos ?? []).map((h) => ({ categoria: h.categoria, detalle: `${h.campo}: ${h.porQue} — "${(h.cita ?? "").slice(0, 90)}"` })),
      usage: judge._usage,
    });
  }
  return reports;
}
