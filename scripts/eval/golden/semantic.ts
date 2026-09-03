// ============================================================================
// GOLDEN SET — tier FULL · checklist SEMÁNTICO (juez Opus)
// ============================================================================
// Lo que ningún regex caza. Genera prosa fresca (persist:false) y la pasa por el
// juez versionado (scripts/eval/judge.ts, rúbrica analysis-voice-franco). Los
// flags son REPORTE para Fabrizio, NO bloquean (el juez tiene falsos positivos).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { buildTruthBundle, captureGeneratorPrompt, runJudgeV2 } from "../judge";
import { GOLDEN_SEEDS } from "./seeds";

export interface SemanticReport {
  key: string;
  flags: Array<{ categoria: string; detalle: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/** `from`: juzga las salidas dumpeadas por runGenerateTier (`<from>/<key>-run0.json`) en
 *  vez de generar de nuevo — el juez y los checks miran LA MISMA prosa. */
export async function runSemanticTier(sb: SupabaseClient, opts: { from?: string } = {}): Promise<SemanticReport[]> {
  const reports: SemanticReport[] = [];

  for (const seed of GOLDEN_SEEDS) {
    const archivo = opts.from ? join(opts.from, `${seed.key}-run0.json`) : null;
    const ai = archivo && existsSync(archivo)
      ? (JSON.parse(readFileSync(archivo, "utf-8")) as { result: any }).result
      : await generateAiAnalysis(seed.uuid, sb, { persist: false });
    if (!ai) { reports.push({ key: seed.key, flags: [{ categoria: "gen", detalle: "generación devolvió null" }] }); continue; }

    // REGLA ESPEJO: capturamos el bloque-caso REAL que el generador le pasó al modelo
    // (incluye datoDP/datoFM y todo lo que el modelo vio) y juzgamos contra eso (V2).
    const cap = await captureGeneratorPrompt(seed.uuid, sb);
    const truthBundle = buildTruthBundle(seed.input.comuna, seed.input.lat ?? null, seed.input.lng ?? null, seed.mediana);
    const fixtureMeta = { id: seed.key, modalidad: "LTR", tier: "experto", ejes: seed.ejes, nota: seed.nota };

    let judge;
    try {
      judge = await runJudgeV2({ fixtureMeta, aiAnalysis: ai, caseBlock: cap?.user ?? "", truthBundle });
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
