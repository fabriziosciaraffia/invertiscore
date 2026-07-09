// ============================================================================
// GOLDEN SET — accept (re-baseline)
// ============================================================================
// Recomputa cada seed con el motor ACTUAL y congela los esperados clase (a) en
// baseline.json. Uso normal: SOLO tras que un cambio LEGÍTIMO del motor mueva un
// esperado y Fabrizio lo apruebe (el runner imprime el diff viejo→nuevo primero).
// Bootstrap: genera la línea base inicial. NO toca Supabase.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/accept.ts
// ============================================================================

import { writeFileSync } from "fs";
import { join } from "path";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF } from "./seeds";
import { extractFacts } from "./extract";
import { factsToBaseline, type Baseline } from "./invariants";

const baseline: Record<string, Baseline> = {};

for (const s of GOLDEN_SEEDS) {
  const res = runAnalysis(s.input, GOLDEN_UF, s.mediana);
  baseline[s.key] = factsToBaseline(extractFacts(res, s.input.precio));
}
for (const s of BORDE_SEEDS) {
  const res = runAnalysis(s.input, GOLDEN_UF, s.mediana);
  baseline[s.key] = factsToBaseline(extractFacts(res, s.input.precio));
}

const payload = { uf: GOLDEN_UF, note: "Esperados clase (a) congelados. Re-baseline solo con OK de Fabrizio.", seeds: baseline };
const path = join(__dirname, "baseline.json");
writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`baseline.json escrito (${Object.keys(baseline).length} seeds) → ${path}`);
for (const [k, b] of Object.entries(baseline)) {
  console.log(`  ${k}: ${b.veredicto} score=${b.score} N=${b.N} corona=${b.corona}`);
}
