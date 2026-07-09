// ============================================================================
// GOLDEN SET — tier FULL · generación fresca AUTO (cuesta tokens)
// ============================================================================
// REGLA ESPEJO: valida la GENERACIÓN, no solo el recompute. Corre
// generateAiAnalysis(uuid, {persist:false}) K veces por caso GS (los BE son solo
// motor), captura los guards vía console.warn y aplica los checks automáticos
// A1-A8 del checklist (patrón/regex/conteo). Lo semántico va en semantic.ts.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF } from "./seeds";
import { gatherHallazgos, aperturaSource } from "./extract";
import type { Check } from "./invariants";
import type { SeedReport } from "./recompute";

// Espejo del monitor de ai-generation.ts:1452 (A4).
const ENGINE_ISM_RE = /flujo[^.]{0,30}(cruza|revier|invier|da vuelta|vuelve positivo|vuelve neutro)|flujo neutro|(el|del)\s+motor|proyecci[óo]n\s+del\s+motor|se\s+(equilibr|estabiliz|neutraliz|nivela)|conver[gj]|inflexi[óo]n|punto de quiebre/i;

const WORDS = (s: string) => (s.trim().match(/\S+/g) || []).length;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function collectStrings(node: any, out: { path: string; s: string }[], path = ""): void {
  if (typeof node === "string") { out.push({ path, s: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, out, `${path}[${i}]`)); return; }
  if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) collectStrings(v, out, path ? `${path}.${k}` : k);
}

async function captureWarns<T>(fn: () => Promise<T>): Promise<{ result: T; warns: string[] }> {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...args: any[]) => { warns.push(args.map(String).join(" ")); };
  try { const result = await fn(); return { result, warns }; }
  finally { console.warn = orig; }
}

export async function runGenerateTier(sb: SupabaseClient, K: number): Promise<SeedReport[]> {
  const reports: SeedReport[] = [];

  for (const seed of GOLDEN_SEEDS) {
    const checks: Check[] = [];
    // Fuente de la apertura para A1: #1 por decisividad pura entre los 6 builders
    // (NO la corona adverso-first de la pirámide — divergen cuando un favorable
    // tiene la mayor decisividad, ej. GS-2 cap_rate). Espejo de ai-generation.ts.
    const recomputed = runAnalysis(seed.input, GOLDEN_UF, seed.mediana);
    const apSrc = aperturaSource(gatherHallazgos(recomputed));
    const coronaFrase = apSrc ? norm(apSrc.fraseCanonica) : "";
    const vmFrancoUF = seed.input.valorMercadoFranco || seed.input.precio;
    const vmSolido = Math.abs(vmFrancoUF - seed.input.precio) * GOLDEN_UF > 1_000_000;
    const maxTotal = 85; // presupuesto Plan C (apertura + continuación)

    let genOk = 0;
    const failCounts: Record<string, number> = {};
    const bump = (rule: string) => { failCounts[rule] = (failCounts[rule] ?? 0) + 1; };

    for (let run = 0; run < K; run++) {
      const { result: ai, warns } = await captureWarns(() => generateAiAnalysis(seed.uuid, sb, { persist: false }));
      if (!ai) { bump("gen.null"); continue; }
      genOk++;
      const strings = ((): { path: string; s: string }[] => { const o: { path: string; s: string }[] = []; collectStrings(ai, o); return o; })();
      const rd = norm(ai.conviene?.respuestaDirecta_clp ?? "");

      // A1 (HARD) — apertura == fraseCanonica del #1 por decisividad (una moneda).
      if (coronaFrase && !rd.startsWith(coronaFrase.slice(0, Math.min(40, coronaFrase.length)))) bump("A1.apertura");

      // A2 (HARD) — fabricación de cifra de zona: el flag interno _catchRootAFlag se
      // setea SOLO si la fabricación sobrevivió los reintentos (robusto, no parsea logs).
      if ((ai as any)._catchRootAFlag === true) bump("A2.catch-root-a");

      // A5 (HARD) — §9 en conviene.cajaAccionable presente y con sustancia.
      if (WORDS(ai.conviene?.cajaAccionable_clp ?? "") < 8) bump("A5.§9-cajaAccionable");

      // A6 (HARD) — presupuesto Plan C: apertura + continuación ≤ 85 (+15% tolerancia del guard).
      if (WORDS(rd) > maxTotal * 1.15) bump("A6.presupuesto");

      // A7·D2 (HARD) — break-even sin negar VM cuando VM es sólido.
      if (vmSolido) {
        const neg = norm(ai.negociacion?.contenido_clp ?? "");
        if (/no hay (comparables|un valor de mercado|suficientes|valor de mercado)/i.test(neg)) bump("A7.D2-niega-VM");
      }

      // A8·D1 (HARD) — largoPlazo compara con instrumentos (depósito/fondo).
      const lp = norm(ai.largoPlazo?.contenido_clp ?? "");
      if (lp && !/(dep[óo]sito a plazo|fondo mutuo)/i.test(lp)) bump("A8.D1-instrumentos");

      // SOFT (reporta TASA, NO bloquea) — detectores de FRASEO estocásticos. El producto
      // mismo trata engine-ism como detección no-bloqueante; hard-gatear sobre variación
      // rara del LLM (engine-ism ~1/6 runs) volvería flaky al golden. Una REGRESIÓN de
      // código dispara la tasa (ej. 5/6) y se ve. [ZONA-DRIFT] se confunde con el
      // arriendo-en-UF; los strippers PLANC auto-corrigen. "mediana de la zona" para el
      // ARRIENDO es legítimo (la mediana COMUNAL determinística la cubre el recompute).
      if (strings.some((x) => ENGINE_ISM_RE.test(x.s))) bump("~engine-ism");
      if (warns.some((w) => w.includes("[ZONA-DRIFT]"))) bump("~zona-drift");
      if (warns.some((w) => /\[PLANC-(DUAL|REPEAT)-STRIPPED\]/.test(w))) bump("~planc-stripped");
    }

    // Consolidar. Regla dura falla si falló en ≥1 run; soft (~) reporta sin bloquear.
    checks.push({ rule: `gen.runs(K=${K})`, pass: genOk === K, detail: `${genOk}/${K} generaciones OK` });
    const HARD = ["A1.apertura", "A2.catch-root-a", "A5.§9-cajaAccionable", "A6.presupuesto", "A7.D2-niega-VM", "A8.D1-instrumentos", "gen.null"];
    const SOFT = ["~engine-ism", "~zona-drift", "~planc-stripped"];
    for (const r of HARD) {
      const c = failCounts[r] ?? 0;
      if (c > 0) checks.push({ rule: r, pass: false, detail: `falló ${c}/${K} runs` });
    }
    for (const r of SOFT) {
      const c = failCounts[r] ?? 0;
      if (c > 0) checks.push({ rule: r, pass: false, rebaseline: true, detail: `${c}/${K} runs (soft — guard ruidoso, no bloquea)` });
    }
    if (checks.filter((c) => !c.pass).length === 0) checks.push({ rule: "AUTO", pass: true, detail: `todos los checks AUTO verdes (K=${K})` });

    const hardFail = checks.filter((c) => !c.pass && !c.rebaseline).length;
    const soft = checks.filter((c) => !c.pass && c.rebaseline).length;
    reports.push({ key: seed.key, checks, hardFail, rebaseline: soft });
  }
  return reports;
}
