// ============================================================================
// GOLDEN SET STR — accept (congela la PRE-FOTO clase (a) · F0.5)
// ============================================================================
// Recomputa cada seed GS-STR (GE-*) con el motor ACTUAL y congela sus números
// (tirPct, multiplicadorCapital, equityCLP, valorVenta, capitalInvertido,
// patrimonioCLP/multiplicador de la card) en str-baseline.json.
//
// F0.5 (rama motor-supuestos): se corre UNA vez sobre cc3dc9e — ANTES de tocar el
// motor — para dejar la pre-foto que hace verificable el flip de semántica (F2).
// Re-baseline posterior: SOLO tras un cambio LEGÍTIMO del motor y con OK de Fabrizio
// (el runner imprime el drift viejo→nuevo primero). NO toca Supabase.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/str-accept.ts
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "fs";
import { join } from "path";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed, strFactsFromSeed, type StrBaseline } from "./str-recompute";

const frozen = loadFrozen();
const seeds: Record<string, StrBaseline> = {};

for (const s of STR_GE_SEEDS) {
  const r = recomputeStrSeed(s, frozen);
  if (!r) { console.log(`  ⚠️  ${s.key} sin fixture frozen — omitido`); continue; }
  seeds[s.key] = strFactsFromSeed(r);
}

const payload = {
  note: "POST-FOTO clase (a) STR — homologación LTR (rama comparabilidad-motores). patrimonioNeto y " +
    "equityCLP ya NO incluyen flujo acumulado (= valor − deuda [− comisión]); multiplicadorCapital = " +
    "equity(sin flujo) / totalAportado(inicial + Σ aportes<0), espejo exacto de analysis.ts:727 (mata el " +
    "doble-conteo). Inflación de flujos homologada a LTR (revenue 3,5% · costos 3% · dividendo 3%). Vs la " +
    "pre-foto F2, veredicto/N preservados (gate re-derivado a 2,65); drift en tirPct (inflación) + " +
    "equityCLP/patrimonioCLP/multiplicador (re-semántica). Re-baseline con OK de Fabrizio (⛔#A).",
  seeds,
};
const path = join(__dirname, "str-baseline.json");
writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`str-baseline.json escrito (${Object.keys(seeds).length} seeds) → ${path}`);
for (const [k, b] of Object.entries(seeds)) {
  console.log(`  ${k}: ${b.veredicto} score=${b.score} tir=${b.tirPct} multCap=${b.multiplicadorCapital} patrMult=${b.patrimonioMult} equity=${b.equityCLP} capital=${b.capitalInvertido}`);
}
