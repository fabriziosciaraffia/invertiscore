/**
 * Sanity test — Commit 4 (Viabilidad STR honesta por zona · 2026-05-12).
 *
 * Valida directamente:
 *   • calcZonaSTR vs universo Santiago hardcoded (3 tiers esperados).
 *   • calcRecomendacionModalidad vs combinaciones tier × sobre-renta.
 *
 * Casos canónicos solicitados en el spec del commit:
 *   • Lastarria   → comuna "Santiago" (tier alta/media esperado).
 *   • Providencia → tier alta esperado.
 *   • Quilicura   → tier baja esperado.
 *
 * Ejecutar:  tsx scripts/sanity-zona-str.ts
 */

import {
  calcZonaSTR,
  calcRecomendacionModalidad,
  STR_UNIVERSO_ADR,
  STR_UNIVERSO_OCC,
} from "../src/lib/engines/str-universo-santiago";

type Case = {
  nombre: string;
  comuna: string;
  // Para Lastarria simulamos que AirROI devuelve los percentiles de la comuna
  // Santiago centro (no hay barrio Lastarria como entrada de universo).
  adrZona: number;
  occZona: number;
  tierEsperado: "alta" | "media" | "baja";
};

const casos: Case[] = [
  {
    nombre: "Lastarria (Santiago Centro)",
    comuna: "Santiago",
    adrZona: STR_UNIVERSO_ADR["Santiago"],
    occZona: STR_UNIVERSO_OCC["Santiago"],
    tierEsperado: "alta",
  },
  {
    nombre: "Providencia centro",
    comuna: "Providencia",
    adrZona: STR_UNIVERSO_ADR["Providencia"],
    occZona: STR_UNIVERSO_OCC["Providencia"],
    tierEsperado: "alta",
  },
  {
    nombre: "Quilicura residencial",
    comuna: "Quilicura",
    adrZona: STR_UNIVERSO_ADR["Quilicura"],
    occZona: STR_UNIVERSO_OCC["Quilicura"],
    tierEsperado: "baja",
  },
];

console.log("════════════════════════════════════════════════════════");
console.log(" SANITY · ZonaSTR + recomendacionModalidad (Commit 4)   ");
console.log("════════════════════════════════════════════════════════");

let fallos = 0;

for (const c of casos) {
  const z = calcZonaSTR(c.comuna, c.adrZona, c.occZona);
  const okTier = z.tierZona === c.tierEsperado;
  if (!okTier) fallos++;

  console.log(`\n▶ ${c.nombre} (comuna="${c.comuna}")`);
  console.log(`  ADR p${z.percentilADR} · OCC p${z.percentilOcupacion} · REV p${z.percentilRevenue}`);
  console.log(`  Score zona: ${z.score}/100 · Tier: ${z.tierZona}`);
  console.log(`  Esperado: ${c.tierEsperado} · ${okTier ? "OK" : "FAIL"}`);
  console.log(`  comunaNoListada=${z.comunaNoListada}`);

  // Matriz de reco para esta zona, variando sobre-renta STR vs LTR.
  console.log(`  · Reco modalidad por sobre-renta:`);
  for (const sr of [-0.10, 0.02, 0.08, 0.20]) {
    const reco = calcRecomendacionModalidad(sr, z.tierZona);
    console.log(`     sobreRenta=${(sr * 100).toFixed(0).padStart(4)}% → ${reco}`);
  }
}

// Crosscheck reglas — combinaciones explícitas.
console.log("\n════════════════════════════════════════════════════════");
console.log(" CROSSCHECK reglas calcRecomendacionModalidad           ");
console.log("════════════════════════════════════════════════════════");
const checks: Array<{ sr: number; tier: "alta" | "media" | "baja"; esperado: string }> = [
  { sr: 0.30, tier: "alta",  esperado: "STR_VENTAJA_CLARA" },
  { sr: 0.10, tier: "alta",  esperado: "INDIFERENTE" },
  { sr: 0.02, tier: "alta",  esperado: "LTR_PREFERIDO" },
  { sr: 0.30, tier: "baja",  esperado: "LTR_PREFERIDO" },   // baja overrides
  { sr: 0.10, tier: "media", esperado: "INDIFERENTE" },
  { sr: 0.20, tier: "media", esperado: "STR_VENTAJA_CLARA" },
];
for (const ck of checks) {
  const got = calcRecomendacionModalidad(ck.sr, ck.tier);
  const ok = got === ck.esperado;
  if (!ok) fallos++;
  console.log(`  sr=${(ck.sr * 100).toFixed(0).padStart(4)}% tier=${ck.tier.padEnd(5)} → ${got.padEnd(18)} (esperado ${ck.esperado}) ${ok ? "OK" : "FAIL"}`);
}

console.log("\n────────────────────────────────────────────────────────");
console.log(`Fallos totales: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
