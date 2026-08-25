// ============================================================================
// GOLDEN SET STR — tier FULL · generación fresca AUTO (BLOQUEANTE, cuesta tokens)
// ============================================================================
// Refuerzo 1 de FASE 2 (rediseño Dictamen): hasta ahora la única generación STR
// del golden eran las 2 llamadas NO-bloqueantes del tier modo-gestión (ambas
// sobre GE-1). Un cambio de prompt STR podía romper la estructura de la prosa
// sin que el runner lo viera. Este tier es el espejo de generate.ts (LTR):
// genera prosa fresca sobre GE-1 (COMPRAR) y GE-2 (AJUSTA) K veces y aplica
// checks AUTO duros que SÍ aportan a totalHard.
//
// Checks duros v1 (verdes sobre el prompt vigente; los del titular/cifraClave
// se suman en el commit del recontrato):
//   AS1  respuestaDirecta con sustancia (≥15 palabras)
//   AS2  cajaAccionable de conviene con sustancia (≥8 palabras — espejo A5 LTR)
//   AS3  tokens `**` balanceados en TODA la prosa (invariante de marcas: los
//        sanitizers recortan por oración y un par que cruce el punto queda impar)
//   gen.null  la generación devolvió algo (sin umbral de mayoría: un null es
//        un problema real siempre)
//
// Umbral de MAYORÍA para las reglas de prosa (AS*), igual que generate.ts: con
// K=2 falla solo si fallan las dos corridas — una variación aislada del modelo
// se declara pero no bloquea; una regresión de código es sistemática y se caza.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from "@anthropic-ai/sdk";
import { generateStrProse } from "../../../src/lib/ai-generation-str";
import { marcasBalanceadas, validarTitular } from "../../../src/lib/prosa-marcas";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";
import type { Check } from "./invariants";
import type { SeedReport } from "./recompute";

const WORDS = (s: string) => (s.trim().match(/\S+/g) || []).length;

// GE-1 (COMPRAR · ventaja clara) + GE-2 (AJUSTA · flujo<0 sin horizonte): los dos
// veredictos dominantes del parque, sin síntesis (filas frozen reales). GE-3
// (BUSCAR por gate de regulación) queda fuera del v1: su prosa está dominada por
// el gate y agregaría tokens sin cubrir estructura nueva.
export const STR_GEN_SEEDS = ["GE-1", "GE-2"] as const;

function collectStrings(node: any, out: { path: string; s: string }[], path = ""): void {
  if (typeof node === "string") { out.push({ path, s: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, out, `${path}[${i}]`)); return; }
  if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) collectStrings(v, out, path ? `${path}.${k}` : k);
}

export async function runStrGenerateTier(K: number): Promise<SeedReport[]> {
  const anthropic = new Anthropic();
  const frozen = loadFrozen();
  const reports: SeedReport[] = [];

  for (const key of STR_GEN_SEEDS) {
    const seed = STR_GE_SEEDS.find((s) => s.key === key);
    const checks: Check[] = [];
    if (!seed || !frozen[key]) {
      checks.push({ rule: "gen.seed", pass: false, detail: `sin seed/fixture frozen para ${key}` });
      reports.push({ key: `${key}-gen`, checks, hardFail: 1, rebaseline: 0 });
      continue;
    }

    let genOk = 0;
    const failCounts: Record<string, number> = {};
    const bump = (rule: string) => { failCounts[rule] = (failCounts[rule] ?? 0) + 1; };

    for (let run = 0; run < K; run++) {
      const t0 = Date.now();
      process.stderr.write(`      · ${key}-gen run ${run + 1}/${K}…`);
      try {
        const r = recomputeStrSeed(seed, frozen);
        if (!r) throw new Error("recompute devolvió null");
        const rForProse = { ...r.rec, francoScore: r.score, hallazgos: r.hz };
        const gen = await generateStrProse({
          anthropic,
          inp: frozen[key].input_data,
          r: rForProse as any,
          comuna: (frozen[key].input_data.comuna as string) || "",
        });
        process.stderr.write(` ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
        const ai: any = gen.ai;
        if (!ai) { bump("gen.null"); continue; }
        genOk++;

        // AS1 — el lead del hero existe y tiene sustancia.
        if (WORDS(ai.conviene?.respuestaDirecta ?? "") < 15) bump("AS1.respuestaDirecta");
        // AS2 — posición/acción de cierre del hero presente (espejo A5 LTR).
        if (WORDS(ai.conviene?.cajaAccionable ?? "") < 8) bump("AS2.§9-cajaAccionable");
        // AS3 — invariante de marcas sobre TODOS los strings de la prosa final
        // (post-sanitizers: generateStrProse ya aplicó stripCardEcho y guards).
        const strings: { path: string; s: string }[] = [];
        collectStrings(ai, strings);
        const desbalance = strings.find((x) => !marcasBalanceadas(x.s));
        if (desbalance) bump("AS3.marcas-balanceadas");
        // AS4 — titular §7.ter presente y bien formado (espejo A9 LTR).
        if (!validarTitular(ai.titular).ok) bump("AS4.titular");
      } catch {
        process.stderr.write(` ERROR\n`);
        bump("gen.null");
      }
    }

    checks.push({ rule: `gen.runs(K=${K})`, pass: genOk === K, detail: `${genOk}/${K} generaciones OK` });
    const HARD = ["AS1.respuestaDirecta", "AS2.§9-cajaAccionable", "AS3.marcas-balanceadas", "AS4.titular", "gen.null"];
    const esReglaDeProsa = (r: string) => r.startsWith("AS");
    const umbralMayoria = Math.floor(K / 2);
    for (const r of HARD) {
      const c = failCounts[r] ?? 0;
      const limite = esReglaDeProsa(r) ? umbralMayoria : 0;
      if (c > limite) checks.push({ rule: r, pass: false, detail: `falló ${c}/${K} runs` });
      else if (c > 0) console.log(`      · ${key}-gen ${r}: falló ${c}/${K} runs — bajo el umbral de mayoría, no bloquea`);
    }
    if (checks.filter((c) => !c.pass).length === 0) checks.push({ rule: "AUTO-STR", pass: true, detail: `checks AUTO STR verdes (K=${K})` });

    const hardFail = checks.filter((c) => !c.pass && !c.rebaseline).length;
    reports.push({ key: `${key}-gen`, checks, hardFail, rebaseline: 0 });
  }
  return reports;
}

// Ejecución directa (standalone): `--k=N` opcional, default 1. El runner lo
// importa vía runStrGenerateTier() dentro de --full.
if (process.argv[1] && /str-generate\.ts$/.test(process.argv[1])) {
  const kArg = process.argv.find((a) => a.startsWith("--k="));
  const K = kArg ? Math.max(1, parseInt(kArg.split("=")[1], 10) || 1) : 1;
  runStrGenerateTier(K).then((reports) => {
    let hard = 0;
    for (const r of reports) {
      console.log(`\n  ${r.hardFail > 0 ? "✗ FAIL" : "✓ PASS"}  ${r.key}`);
      for (const c of r.checks) console.log(`      ${c.pass ? "✓" : "✗"} ${c.rule}${c.detail ? ` — ${c.detail}` : ""}`);
      hard += r.hardFail;
    }
    process.exit(hard === 0 ? 0 : 1);
  }).catch((e) => { console.error("FATAL", e); process.exit(1); });
}
