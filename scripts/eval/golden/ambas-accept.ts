// ============================================================================
// GOLDEN SET COMPARATIVO (AMBAS) — accept (congela el baseline del veredicto)
// ============================================================================
// Recomputa cada seed con el motor ACTUAL y congela el veredicto comparativo
// (recomendacion + banda + fragil + porAbsoluto + flip + drivers) en ambas-baseline.json.
// Se corre UNA vez al nacer el golden (Fase A) y luego SOLO tras un cambio LEGÍTIMO del
// veredicto con OK de Fabrizio (el runner imprime el drift/fail primero). NO toca Supabase.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/ambas-accept.ts
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "fs";
import { join } from "path";
import { AMBAS_SEEDS, loadFrozenAmbas } from "./ambas-seeds";
import { recomputeAmbasSeed, ambasFactsFromSeed, type AmbasBaseline } from "./ambas-recompute";

const frozen = loadFrozenAmbas();
const seeds: Record<string, AmbasBaseline> = {};

for (const s of AMBAS_SEEDS) {
  const rec = recomputeAmbasSeed(s.key, frozen);
  if (!rec) { console.log(`  ⚠️  ${s.key} sin fixture frozen — omitido`); continue; }
  seeds[s.key] = ambasFactsFromSeed(rec, frozen[s.key]?.input_data);
}

const payload = {
  note: "Baseline GOLDEN COMPARATIVO (AMBAS · D1+D2). Congela veredicto+banda+señales de 7 pares reales, " +
    "uno por banda: STR_FRAGIL(be 90-110), conflictiva(>110, caso Moneda), N/D degenerado (break-even NO lo " +
    "toca), LTR_PREFERIDO, INDIFERENTE(5-15). recomendacion/banda/fragil/porAbsoluto/flip son DUROS; " +
    "break-even% y sobre-renta% son drift. Re-baseline SOLO con cambio legítimo del veredicto + OK de Fabrizio.",
  seeds,
};
const path = join(__dirname, "ambas-baseline.json");
writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`ambas-baseline.json escrito (${Object.keys(seeds).length} seeds) → ${path}`);
for (const [k, b] of Object.entries(seeds)) {
  console.log(`  ${k}: ${b.banda} reco=${b.recomendacion} fragil=${b.fragil} flip=${b.flipCambia} · pirámide=[${b.findingsOrden}]`);
}
