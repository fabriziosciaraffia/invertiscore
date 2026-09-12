/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · RENTABILIDAD SOBRE LO PUESTO EN EL SCORE — catch-test (12-sep-2026). 0 tokens.
// ============================================================================
// Decisión de producto (Fabrizio, 12-sep-2026): el score mira el retorno sobre lo que pone
// el comprador, no solo el activo. Cash-on-cash y TIR entran como dimensiones ponderadas
// —esquema A, curva calibrada al parque— y las puertas del flujo quedan como estaban.
//
// Fija SEIS cosas, medidas en FASE 0 sobre 1.204 LTR y 249 STR:
//
//   1. LOS PESOS. LTR: rentabilidad 20 · flujo 20 · cash-on-cash 20 · TIR 10 · plusvalía 17 ·
//      eficiencia 13 (= 100). STR: cap rate 15 · sostenibilidad 20 · ventaja 20 · factibilidad
//      20 · cash-on-cash 15 · TIR 10 (= 100). Una sola fuente (`score-retorno.ts`) para las
//      dos modalidades y para el PDF, que hasta hoy hardcodeaba 30/25/25/20.
//
//   2. LAS CURVAS, CALIBRADAS AL PARQUE. La mediana de cada veredicto cae donde caen hoy sus
//      otras dimensiones: CoC −5 % → 58, 0 → 74, +6 → 90; TIR 7 % → 58, 12 % → 82. Con la curva
//      «absoluta» (CoC 0 → 45) el score se desinflaba 7-11 puntos y solo bajaba veredictos.
//      Las bandas 70/45 se sostienen con esta curva (medido: cortes equivalentes 67-69 / 42).
//
//   3. PIE CERO. Sin capital propio el cash-on-cash del motor es `no_aplica`; la dimensión
//      usa el RENDIMIENTO NETO SOBRE EL PRECIO (LTR `rentabilidadNeta`, STR `capRate`), sin
//      neutro. La TIR sí queda `no_aplica` y su peso se reparte entre las demás: un neutro
//      de 45 castigaba lo que no se puede medir (3 COMPRAR LTR y 1 STR caían por eso).
//
//   4. EL DESGLOSE LLEVA LAS SEIS. `results.desglose` (LTR) y `francoScore.desglose` (STR)
//      traen `cashOnCash` y `tir`; la fórmula del score y la del desglose son UNA (hasta hoy
//      estaban escritas dos veces, `analysis.ts:2364` «mirrors calcScoreFromMetrics»).
//
//   5. LAS PUERTAS NO SE TOCAN. G1/G2/G3 de LTR y los ocho brazos STR conservan sus umbrales:
//      un depto que no se paga solo no es COMPRAR aunque rinda.
//
//   6. LA PÁGINA LTR PINTA EL SCORE RECOMPUTADO, no la columna persistida: con el score
//      nuevo, la columna vieja mostraría 70 junto a un veredicto calculado a 68.
//
// Corre dentro del QUICK (tier "score-retorno") y standalone:
//   node --env-file=.env.local --import tsx scripts/eval/golden/score-retorno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PESOS_SCORE_LTR, PESOS_SCORE_STR, puntajeCashOnCash, puntajeTir, combinarConReparto } from "../../../src/lib/score-retorno";
import { runAnalysis } from "../../../src/lib/analysis";
import { metricaValorONull } from "../../../src/lib/types";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const cerca = (a: number, b: number, tol = 0.51) => Math.abs(a - b) <= tol;

// ── 1 · los pesos ───────────────────────────────────────────────────────────
{
  const suma = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  if (suma(PESOS_SCORE_LTR) !== 100) F(`1 · los pesos LTR suman ${suma(PESOS_SCORE_LTR)}, no 100`);
  if (suma(PESOS_SCORE_STR) !== 100) F(`1 · los pesos STR suman ${suma(PESOS_SCORE_STR)}, no 100`);
  const esperadoLtr = { rentabilidad: 20, flujoCaja: 20, cashOnCash: 20, tir: 10, plusvalia: 17, eficiencia: 13 };
  for (const [k, v] of Object.entries(esperadoLtr)) if ((PESOS_SCORE_LTR as any)[k] !== v) F(`1 · peso LTR «${k}» = ${(PESOS_SCORE_LTR as any)[k]}, esperado ${v} (esquema A)`);
  const esperadoStr = { rentabilidad: 15, sostenibilidad: 20, ventaja: 20, factibilidad: 20, cashOnCash: 15, tir: 10 };
  for (const [k, v] of Object.entries(esperadoStr)) if ((PESOS_SCORE_STR as any)[k] !== v) F(`1 · peso STR «${k}» = ${(PESOS_SCORE_STR as any)[k]}, esperado ${v} (esquema A)`);
}

// ── 2 · las curvas calibradas ───────────────────────────────────────────────
{
  const anclasCoc: [number, number][] = [[-14, 30], [-5, 58], [0, 74], [6, 90], [12, 100]];
  for (const [x, y] of anclasCoc) if (!cerca(puntajeCashOnCash(x), y, 0.01)) F(`2 · puntajeCashOnCash(${x}) = ${puntajeCashOnCash(x)}, esperado ${y}`);
  const anclasTir: [number, number][] = [[3, 35], [7, 58], [12, 82], [20, 100]];
  for (const [x, y] of anclasTir) if (!cerca(puntajeTir(x), y, 0.01)) F(`2 · puntajeTir(${x}) = ${puntajeTir(x)}, esperado ${y}`);
  if (puntajeCashOnCash(-40) !== 5 || puntajeCashOnCash(30) !== 100) F("2 · la curva de CoC no satura en los extremos (5 abajo, 100 arriba)");
  if (puntajeTir(-10) !== 0 || puntajeTir(40) !== 100) F("2 · la curva de TIR no satura en los extremos (0 abajo, 100 arriba)");
  for (let x = -25; x < 12; x += 0.5) if (puntajeCashOnCash(x + 0.5) < puntajeCashOnCash(x)) F(`2 · la curva de CoC no es monótona en ${x}`);
  if (cerca(puntajeCashOnCash(0), 45, 0.01)) F("2 · la curva de CoC volvió al neutro 45 en 0: esa era la curva absoluta, descartada en FASE 0");
}

// ── 3 · el reparto cuando una dimensión no aplica ──────────────────────────
{
  const a = combinarConReparto([{ peso: 20, puntaje: 100 }, { peso: 10, puntaje: null }, { peso: 70, puntaje: 50 }]);
  const esperado = Math.round((20 * 100 + 70 * 50) / 90);
  if (a !== esperado) F(`3 · combinarConReparto no reparte el peso de la dimensión que no aplica: ${a} vs ${esperado}`);
  const b = combinarConReparto([{ peso: 50, puntaje: 80 }, { peso: 50, puntaje: 40 }]);
  if (b !== 60) F(`3 · combinarConReparto con todas las dimensiones no es la media ponderada: ${b}`);
  if (combinarConReparto([{ peso: 10, puntaje: null }]) !== 0) F("3 · sin ninguna dimensión aplicable el score tiene que ser 0, no NaN");
}

// ── 4 · LTR: el desglose lleva las seis y el score sale de ellas ───────────
{
  const conPie = GOLDEN_SEEDS.find((s) => s.key === "GS-1")!;
  const r: any = runAnalysis(conPie.input, GOLDEN_UF, conPie.mediana, GOLDEN_ASOF);
  const d = r.desglose; const coc = metricaValorONull(r.metrics.cashOnCash); const tir = metricaValorONull(r.exitScenario.tir);
  if (typeof d.cashOnCash !== "number" || typeof d.tir !== "number") F("4 · el desglose LTR de GS-1 no trae `cashOnCash` y `tir` numéricos");
  else {
    if (!cerca(d.cashOnCash, puntajeCashOnCash(coc!), 0.01)) F(`4 · desglose.cashOnCash (${d.cashOnCash}) no es la curva del CoC del motor (${coc} → ${puntajeCashOnCash(coc!)})`);
    if (!cerca(d.tir, puntajeTir(tir!), 0.01)) F(`4 · desglose.tir (${d.tir}) no es la curva de la TIR del motor (${tir} → ${puntajeTir(tir!)})`);
    const w = PESOS_SCORE_LTR;
    const esperado = Math.round((w.rentabilidad * d.rentabilidad + w.flujoCaja * d.flujoCaja + w.cashOnCash * d.cashOnCash + w.tir * d.tir + w.plusvalia * d.plusvalia + w.eficiencia * d.eficiencia) / 100);
    if (r.score !== esperado) F(`4 · el score de GS-1 (${r.score}) no es la media ponderada de su desglose (${esperado}): la fórmula del score y la del desglose divergen`);
  }
  // pie cero: CoC = rendimiento neto sobre el precio, TIR no aplica y reparte
  const sinPie = GOLDEN_SEEDS.find((s) => s.key === "GS-PC1")!;
  const r0: any = runAnalysis(sinPie.input, GOLDEN_UF, sinPie.mediana, GOLDEN_ASOF);
  const d0 = r0.desglose;
  if (r0.metrics.cashOnCash?.tipo !== "no_aplica") F("4 · GS-PC1 dejó de ser pie cero en el motor (cashOnCash no es no_aplica): el caso de prueba ya no prueba nada");
  else {
    const esperadoCoc = puntajeCashOnCash(r0.metrics.rentabilidadNeta);
    if (!cerca(d0.cashOnCash, esperadoCoc, 0.01)) F(`4 · pie cero LTR: desglose.cashOnCash (${d0.cashOnCash}) no es la curva del rendimiento neto sobre el precio (${r0.metrics.rentabilidadNeta} → ${esperadoCoc})`);
    if (d0.tir !== null) F(`4 · pie cero LTR: desglose.tir tiene que ser null (no aplica), vino ${d0.tir}`);
    const w = PESOS_SCORE_LTR;
    const esperado = combinarConReparto([
      { peso: w.rentabilidad, puntaje: d0.rentabilidad }, { peso: w.flujoCaja, puntaje: d0.flujoCaja }, { peso: w.cashOnCash, puntaje: d0.cashOnCash },
      { peso: w.tir, puntaje: null }, { peso: w.plusvalia, puntaje: d0.plusvalia }, { peso: w.eficiencia, puntaje: d0.eficiencia },
    ]);
    if (r0.score !== esperado) F(`4 · pie cero LTR: el score (${r0.score}) no reparte el peso de la TIR (${esperado})`);
  }
}

// ── 5 · STR: lo mismo, con `peso` y `aplica` en cada dimensión ─────────────
{
  const frozen = loadFrozen();
  const conPie = recomputeStrSeed(STR_GE_SEEDS.find((s) => s.key === "GE-1")!, frozen);
  if (!conPie) F("5 · GE-1 sin fixture");
  else {
    const fs: any = conPie.score; const d = fs.desglose;
    if (!d.cashOnCash || !d.tir) F("5 · el desglose STR de GE-1 no trae las dimensiones `cashOnCash` y `tir`");
    else {
      const w = PESOS_SCORE_STR;
      const pesos = { rentabilidad: d.rentabilidad.peso, sostenibilidad: d.sostenibilidad.peso, ventaja: d.ventaja.peso, factibilidad: d.factibilidad.peso, cashOnCash: d.cashOnCash.peso, tir: d.tir.peso };
      for (const [k, v] of Object.entries(w)) if ((pesos as any)[k] !== v) F(`5 · la dimensión STR «${k}» declara peso ${(pesos as any)[k]}, el esquema dice ${v}: el PDF STR lee ese campo`);
      const coc = metricaValorONull(conPie.rec.escenarios.base.cashOnCash)! * 100; const tir = conPie.rec.metrics.tirPct;
      if (!cerca(d.cashOnCash.score, puntajeCashOnCash(coc), 0.51)) F(`5 · STR desglose.cashOnCash.score (${d.cashOnCash.score}) no es la curva del CoC (${coc.toFixed(2)} → ${puntajeCashOnCash(coc)})`);
      if (!cerca(d.tir.score, puntajeTir(tir), 0.51)) F(`5 · STR desglose.tir.score (${d.tir.score}) no es la curva de la TIR (${tir} → ${puntajeTir(tir)})`);
      const esperado = combinarConReparto(Object.keys(w).map((k) => ({ peso: (w as any)[k], puntaje: d[k].aplica === false ? null : d[k].score })));
      if (fs.score !== esperado) F(`5 · el score STR de GE-1 (${fs.score}) no es la media ponderada de sus seis dimensiones (${esperado})`);
    }
  }
  const sinPie = recomputeStrSeed(STR_GE_SEEDS.find((s) => s.key === "GE-PC")!, frozen);
  if (!sinPie) F("5 · GE-PC sin fixture");
  else {
    const fs: any = sinPie.score; const d = fs.desglose; const base = sinPie.rec.escenarios.base;
    if (base.cashOnCash?.tipo !== "no_aplica") F("5 · GE-PC dejó de ser pie cero en el motor STR");
    else if (d.cashOnCash && d.tir) {
      if (!cerca(d.cashOnCash.score, puntajeCashOnCash(base.capRate * 100), 0.51)) F(`5 · pie cero STR: cashOnCash.score (${d.cashOnCash.score}) no es la curva del cap rate (${(base.capRate * 100).toFixed(2)} → ${puntajeCashOnCash(base.capRate * 100)})`);
      if (d.cashOnCash.aplica === false) F("5 · pie cero STR: la dimensión CoC tiene que aplicar (rendimiento neto sobre el precio), no repartirse");
      if (d.tir.aplica !== false) F("5 · pie cero STR: la dimensión TIR tiene que declararse `aplica: false` y repartir su peso");
    }
  }
}

// ── 6 · las puertas no se tocan y la página pinta el score recomputado ─────
{
  const A = leer("src/lib/analysis.ts");
  if (!/cocSevero: coc !== null && coc < -30/.test(A)) F("6 · G1 cocSevero dejó de ser CoC < −30");
  if (!/\(cocGate2 < -10 \|\| \(flujoMuyNegativoRatio < -0\.05 && cocGate2 < 0\)\)/.test(A)) F("6 · G2 LTR cambió sus umbrales (CoC < −10 / flujo < −5 % con CoC < 0)");
  if (!/metrics\.flujoNetoMensual >= 0 &&\s*metrics\.rentabilidadNeta >= 4/.test(A)) F("6 · G3 LTR cambió (flujo ≥ 0 y neta ≥ 4)");
  if (!/score >= 70 \? "COMPRAR" : score >= 45 \? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"/.test(A)) F("6 · las bandas LTR dejaron de ser 70/45");
  const S = leer("src/lib/engines/short-term-score.ts");
  for (const brazo of ["g1_cocSevero: p.coc !== null && p.coc < -0.30", "g1_beInviable: p.beRatio > 1.30", "g1_flujoSevero: p.flujoCajaMensual < -250000 && p.sobreRentaPct < 0.10", "g1_capRateMinimo: p.capRate < 0.02", "g2_ltrGana: p.sobreRentaPct < 0", "g2_cocFuerte: p.coc !== null && p.coc < -0.10", "g2_flujoSinHorizonte: p.flujoCajaMensual < 0 && !p.horizonteCierraFavorable", "g2_beApretado: p.beRatio > 1.10"]) {
    if (!S.includes(brazo)) F(`6 · el brazo STR «${brazo.split(":")[0]}» cambió su umbral`);
  }
  if (!/const HORIZONTE_TIR_MINIMO = 10;/.test(S) || !/const HORIZONTE_MULT_MINIMO = 2\.65;/.test(S)) F("6 · el horizonte STR (TIR 10 / multiplicador 2,65) cambió");
  const P = leer("src/app/analisis/[id]/page.tsx");
  if (/score=\{analisis\.score\}/.test(P)) F("6 · la página LTR sigue pasando la columna `analisis.score` persistida: con el score nuevo mostraría el número viejo junto a un veredicto recomputado");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runScoreRetornoTier(): { hard: number } {
  console.log("\n─── TIER SCORE-RETORNO (esquema A · curva calibrada · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — pesos A en las dos modalidades, curvas calibradas, pie cero con rendimiento neto sobre el precio y TIR repartida, desglose de seis, puertas intactas, la página pinta el score recomputado");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runScoreRetornoTier();
  process.exit(hard ? 1 : 0);
}
