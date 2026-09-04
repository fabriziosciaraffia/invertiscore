/**
 * Sanity test — Viabilidad STR por zona (Commit 4 · 2026-05-12; V2 Goal 4 · 2026-09-04).
 *
 * Valida directamente:
 *   • calcZonaSTR sobre el universo V2 generado (extremos → tiers alta/baja, alias,
 *     comuna sin datos suficientes → comunaNoListada).
 *   • calcRecomendacionModalidad vs combinaciones tier × sobre-renta.
 *
 * Ejecutar:  node --import tsx scripts/sanity-zona-str.ts
 */

import {
  calcZonaSTR,
  calcRecomendacionModalidad,
  STR_UNIVERSO_V2,
  datosComunaSTR,
} from "../src/lib/engines/str-universo-santiago";

type Case = {
  nombre: string;
  comuna: string;
  adrZona: number;
  occZona: number;
  tierEsperado: "alta" | "media" | "baja";
};

// V2 (Goal 4): los casos se arman desde el universo generado, no desde valores a mano. La
// comuna con la mediana de ocupación más alta debe caer en tier alta; la más baja, en baja;
// una comuna sin datos suficientes (Quilicura, n < 3) debe salir `comunaNoListada`.
const ordenadas = Object.entries(STR_UNIVERSO_V2).sort((a, b) => (b[1].ocupacion.valor * b[1].adr.valor) - (a[1].ocupacion.valor * a[1].adr.valor));
const [topC, topD] = ordenadas[0];
const [lowC, lowD] = ordenadas[ordenadas.length - 1];
const casos: Case[] = [
  { nombre: `${topC} (ingreso mediano más alto de V2)`, comuna: topC, adrZona: topD.adr.valor, occZona: topD.ocupacion.valor, tierEsperado: "alta" },
  { nombre: `${lowC} (ingreso mediano más bajo de V2)`, comuna: lowC, adrZona: lowD.adr.valor, occZona: lowD.ocupacion.valor, tierEsperado: "baja" },
];
if (datosComunaSTR("Quilicura") !== null) { console.log("FAIL · Quilicura debía estar sin datos suficientes"); process.exit(1); }
if (calcZonaSTR("Quilicura", 40000, 0.4).comunaNoListada !== true) { console.log("FAIL · comunaNoListada para Quilicura"); process.exit(1); }
if (datosComunaSTR("Santiago Centro")?.ocupacion.valor !== STR_UNIVERSO_V2["Santiago"].ocupacion.valor) { console.log("FAIL · alias Santiago Centro"); process.exit(1); }

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
