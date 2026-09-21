/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · LA PROVISIÓN DE MANTENCIÓN ES UNA — catch-test (21-sep-2026). 0 tokens, sin base.
// ============================================================================
// El mes de la tabla del capítulo II (`metrics.provisionMantencionAjustada`) y el año 1 del
// loop de proyecciones (TIR, gráfico a diez años) salían de DOS cálculos: metrics respetaba
// la provisión declarada y usaba la antigüedad real; el loop la ignoraba y usaba otra
// antigüedad (legacy +1; v3 reset por CapEx que metrics no aplicaba). Medido: 328 de 1.213
// filas con dos mantenciones distintas (p50 $16.813/mes). Ahora hay UNA función,
// `provisionMantencionAnio`, y este tier fija que los tres consumidores la usen y que con
// t = 0 dé lo mismo que el mes.
//
// Fija CUATRO cosas, todas por COMPORTAMIENTO sobre `runAnalysis` con fixtures sintéticos
// (las filas vivas no garantizan ejercitar las tres ramas):
//   1. PROVISIÓN DECLARADA: metrics la respeta, el loop TAMBIÉN (año 1 = declarada; año 2 =
//      declarada × (1 + inflación de costos)).
//   2. LEGACY SIN +1: con antigüedad en el borde de banda (2 → 3 cruza de 0,3% a 0,5%), el
//      año 1 del loop cobra la misma mantención que el mes de metrics.
//   3. V3 CON CAPEX: metrics aplica el reset (antigüedad efectiva 0) igual que el loop, y
//      los dos coinciden. PISO: el fixture tiene que tener CapEx > 0 de verdad.
//   4. CABLEADO: ni `analysis.ts`, ni el simulador del cliente, ni `enrich-metrics-legacy`
//      llaman a `calcMantencionMensual` por su cuenta.
//
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · el loop con `t = anio - aniosEntrega` (el +1 de legacy) → cae 2.
//   · metrics con `tieneCapex: false` → cae 3.
//   · `provisionMantencionAnio` ignorando `declarada` → cae 1.
//
// Corre dentro del QUICK y standalone:
//   node --import tsx scripts/eval/golden/mantencion-una-sola-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis, calcFlujoDesglose } from "../../../src/lib/analysis";
import { provisionMantencionAnio, calcMantencionMensual, getMantencionRateLegacy } from "../../../src/lib/modelo-costos";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import type { AnalisisInput } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");

/** La mantención del año 1 del loop, despejada de `gastosOperativosAnual` con los mismos
 *  enteros que usa el motor (ggcc en vacancia + contribuciones del mes). */
function mantencionAnio1(r: any, input: AnalisisInput): number | null {
  const p = (r.projections ?? []).find((x: any) => (x.mesesOperativos ?? 12) > 0);
  if (!p || p.gastosOperativosAnual == null || !(p.mesesOperativos > 0)) return null;
  const d = calcFlujoDesglose({ arriendo: r.metrics.ingresoMensual, dividendo: r.metrics.dividendo, ggcc: r.metrics.gastos, contribuciones: r.metrics.contribuciones, mantencion: 0, vacanciaMeses: input.vacanciaMeses });
  return Math.round(p.gastosOperativosAnual / p.mesesOperativos) - d.ggccVacancia - d.contribucionesMes;
}

export function runMantencionUnaSolaTier(): { hard: number } {
  fallas.length = 0;
  // GS-1 · Ñuñoa usado. Las seeds son v3 (`ltr()` pone methodologyVersion); el fixture legacy
  // la borra a propósito.
  const base = GOLDEN_SEEDS[0].input as AnalisisInput;

  // 1 · provisión declarada: la respetan los dos
  if (provisionMantencionAnio({ declarada: 30000, modelo: "legacy", antiguedadReal: 10, t: 0, tieneCapex: false, superficieUtilM2: 50, precioCLP: 100_000_000, arriendoCLP: 500000, ufClp: 38800 }) !== 30000) F("1 · la función no respeta la provisión declarada");
  if (provisionMantencionAnio({ declarada: 30000, modelo: "legacy", antiguedadReal: 10, t: 1, tieneCapex: false, superficieUtilM2: 50, precioCLP: 100_000_000, arriendoCLP: 500000, ufClp: 38800, factorInflacion: 1.03 }) !== 30900) F("1 · la declarada no se reajusta con el factor del año");
  const rDecl = runAnalysis({ ...base, provisionMantencion: 45000 }, GOLDEN_UF, GOLDEN_SEEDS[0].mediana, GOLDEN_ASOF);
  if (rDecl.metrics.provisionMantencionAjustada !== 45000) F(`1 · metrics no respeta la declarada (dio ${rDecl.metrics.provisionMantencionAjustada})`);
  const m1Decl = mantencionAnio1(rDecl, { ...base, provisionMantencion: 45000 });
  if (m1Decl !== 45000) F(`1 · el año 1 del loop ignora la provisión declarada (dio ${m1Decl}, esperaba 45.000)`);
  const p2 = (rDecl.projections ?? [])[1];
  const d2 = calcFlujoDesglose({ arriendo: 0, dividendo: 0, ggcc: rDecl.metrics.gastos * 1.03, contribuciones: rDecl.metrics.contribuciones * 1.03, mantencion: 0, vacanciaMeses: base.vacanciaMeses });
  if (p2 && Math.round(p2.gastosOperativosAnual! / 12) - d2.ggccVacancia - d2.contribucionesMes !== Math.round(45000 * 1.03)) F("1 · el año 2 no reajusta la declarada con la inflación de costos");

  // 2 · legacy sin el +1: borde de banda
  if (getMantencionRateLegacy(2) === getMantencionRateLegacy(3)) F("2 · PISO · el fixture ya no está en un borde de banda legacy (2 → 3)");
  const inLeg = { ...base, methodologyVersion: undefined, antiguedad: 2, provisionMantencion: 0 } as AnalisisInput;
  const rLeg = runAnalysis(inLeg, GOLDEN_UF, GOLDEN_SEEDS[0].mediana, GOLDEN_ASOF);
  const m1Leg = mantencionAnio1(rLeg, inLeg);
  if (m1Leg == null) F("2 · el loop no emitió el desglose anual");
  else if (m1Leg !== rLeg.metrics.provisionMantencionAjustada) F(`2 · legacy: el año 1 del loop (${m1Leg}) ≠ el mes de metrics (${rLeg.metrics.provisionMantencionAjustada}) — volvió el +1`);
  const esperadoLeg = calcMantencionMensual({ modelo: "legacy", antiguedad: 2, superficieUtilM2: inLeg.superficie, precioCLP: rLeg.metrics.precioCLP, arriendoCLP: inLeg.arriendo, ufClp: GOLDEN_UF });
  if (rLeg.metrics.provisionMantencionAjustada !== esperadoLeg) F("2 · legacy: metrics no usa la antigüedad real con t = 0");

  // 3 · v3 con CapEx: reset en los dos lados
  const inV3 = { ...base, methodologyVersion: "v3", antiguedad: 15, esNuevo: false, provisionMantencion: 0, costoPuestaAPuntoCLP: undefined } as AnalisisInput;
  const rV3 = runAnalysis(inV3, GOLDEN_UF, GOLDEN_SEEDS[0].mediana, GOLDEN_ASOF);
  if (!((rV3.metrics.capexPuestaAPuntoCLP ?? 0) > 0)) F("3 · PISO · el fixture v3 no tiene CapEx: la rama del reset no se ejercitó");
  const esperadoReset = calcMantencionMensual({ modelo: "v3", antiguedad: 0, superficieUtilM2: inV3.superficie, precioCLP: rV3.metrics.precioCLP, arriendoCLP: inV3.arriendo, ufClp: GOLDEN_UF });
  const sinReset = calcMantencionMensual({ modelo: "v3", antiguedad: 15, superficieUtilM2: inV3.superficie, precioCLP: rV3.metrics.precioCLP, arriendoCLP: inV3.arriendo, ufClp: GOLDEN_UF });
  if (esperadoReset === sinReset) F("3 · PISO · con y sin reset dan lo mismo (el techo del arriendo aplana el fixture): subir el arriendo del fixture");
  if (rV3.metrics.provisionMantencionAjustada !== esperadoReset) F(`3 · v3 con CapEx: metrics no aplica el reset (dio ${rV3.metrics.provisionMantencionAjustada}, reset ${esperadoReset}, sin reset ${sinReset})`);
  const m1V3 = mantencionAnio1(rV3, inV3);
  if (m1V3 !== rV3.metrics.provisionMantencionAjustada) F(`3 · v3 con CapEx: el año 1 del loop (${m1V3}) ≠ el mes de metrics (${rV3.metrics.provisionMantencionAjustada})`);

  // 4 · cableado: nadie llama a la fórmula por su cuenta
  for (const [f, s] of [["src/lib/analysis.ts", leer("src/lib/analysis.ts")], ["src/app/analisis/[id]/results-client.tsx", leer("src/app/analisis/[id]/results-client.tsx")], ["src/lib/analysis/enrich-metrics-legacy.ts", leer("src/lib/analysis/enrich-metrics-legacy.ts")]] as const) {
    if (/calcMantencionMensual\(/.test(s)) F(`4 · ${f} llama a calcMantencionMensual por su cuenta`);
    if (!/provisionMantencionAnio\(\{/.test(s)) F(`4 · ${f} no usa provisionMantencionAnio`);
  }
  if (/anio - aniosEntrega\)/.test(leer("src/lib/analysis.ts"))) F("4 · el loop volvió a la convención legacy «año 1 ⇒ antigüedad + 1»");

  if (fallas.length) {
    console.log(`   mantencion-una-sola ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   mantencion-una-sola ✓ (declarada respetada por los dos, legacy sin +1, v3 con reset en metrics y loop, cableado)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMantencionUnaSolaTier();
  process.exit(hard ? 1 : 0);
}
