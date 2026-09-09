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
import { conTimeout, esTimeout, TIMEOUT_GENERADOR_MS } from "./timeout";
import { GOLDEN_SEEDS } from "./seeds";

export interface SemanticReport {
  key: string;
  flags: Array<{ categoria: string; detalle: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/** `from`: juzga las salidas dumpeadas por runGenerateTier (`<from>/<key>-run0.json`) en
 *  vez de generar de nuevo — el juez y los checks miran LA MISMA prosa. */
export async function runSemanticTier(sb: SupabaseClient, opts: { from?: string; seeds?: Set<string> | null } = {}): Promise<SemanticReport[]> {
  const reports: SemanticReport[] = [];

  // `seeds` (v21.1): el tier NO honraba el filtro y era un bug de COSTO, no una
  // preferencia — con una seed acotada seguía pagando una pasada de juez Opus por
  // cada una de las diez.
  const seedsARecorrer = opts.seeds ? GOLDEN_SEEDS.filter((s) => opts.seeds!.has(s.key)) : GOLDEN_SEEDS;

  for (const seed of seedsARecorrer) {
    // Timeout por llamada (06-sep-2026): generación, captura del prompt y juez tienen techo;
    // el seed cae como FALLA-TIMEOUT y la tanda sigue. Antes una llamada colgada paraba todo.
    const archivo = opts.from ? join(opts.from, `${seed.key}-run0.json`) : null;
    let ai: any;
    let cap: Awaited<ReturnType<typeof captureGeneratorPrompt>>;
    try {
      ai = archivo && existsSync(archivo)
        ? (JSON.parse(readFileSync(archivo, "utf-8")) as { result: any }).result
        : await conTimeout(generateAiAnalysis(seed.uuid, sb, { persist: false }), TIMEOUT_GENERADOR_MS, `${seed.key} generación (semántico)`);
      if (!ai) { reports.push({ key: seed.key, flags: [{ categoria: "gen", detalle: "generación devolvió null" }] }); continue; }

      // REGLA ESPEJO: capturamos el bloque-caso REAL que el generador le pasó al modelo
      // (incluye datoDP/datoFM y todo lo que el modelo vio) y juzgamos contra eso (V2).
      cap = await conTimeout(captureGeneratorPrompt(seed.uuid, sb), TIMEOUT_GENERADOR_MS, `${seed.key} captura del prompt`);
    } catch (e) {
      if (!esTimeout(e)) throw e;
      reports.push({ key: seed.key, flags: [{ categoria: "FALLA-TIMEOUT", detalle: (e as Error).message }] });
      continue;
    }
    const truthBundle = buildTruthBundle(seed.input.comuna, seed.input.lat ?? null, seed.input.lng ?? null, seed.mediana);
    const fixtureMeta = { id: seed.key, modalidad: "LTR", tier: "experto", ejes: seed.ejes, nota: seed.nota };

    let judge;
    try {
      judge = await conTimeout(runJudgeV2({ fixtureMeta, aiAnalysis: ai, caseBlock: cap?.user ?? "", truthBundle }), TIMEOUT_GENERADOR_MS, `${seed.key} juez`);
    } catch (e) {
      reports.push({ key: seed.key, flags: [{ categoria: esTimeout(e) ? "FALLA-TIMEOUT" : "juez-error", detalle: String((e as Error)?.message ?? e) }] });
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
