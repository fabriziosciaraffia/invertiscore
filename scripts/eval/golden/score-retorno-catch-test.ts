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
//      eficiencia 13 (= 100). STR: cap rate 18,75 · sostenibilidad 25 · factibilidad 25 ·
//      cash-on-cash 18,75 · TIR 12,5 (= 100; sin ventaja vs LTR desde el 22-sep-2026). Una sola fuente (`score-retorno.ts`) para las
//      dos modalidades y para el PDF, que hasta hoy hardcodeaba 30/25/25/20.
//
//   2. LAS CURVAS, CALIBRADAS AL PARQUE. La mediana de cada veredicto cae donde caen hoy sus
//      otras dimensiones: CoC −5 % → 58, 0 → 74, +6 → 90; TIR 7 % → 58, 12 % → 82. Con la curva
//      «absoluta» (CoC 0 → 45) el score se desinflaba 7-11 puntos y solo bajaba veredictos.
//      Las bandas 70/45 se sostienen con esta curva (medido: cortes equivalentes 67-69 / 42).
//
//   3. PIE CERO. Sin capital propio el cash-on-cash del motor es `no_aplica`; la dimensión
//      toma el PUNTAJE DEL FLUJO (LTR `desglose.flujoCaja`, STR la escala del flujo de la
//      sostenibilidad). La TIR sí queda `no_aplica` y su peso se reparte entre las demás.
//      ⚠ ACTA (25-sep-2026): hasta hoy la dimensión usaba el rendimiento neto sobre el precio
//      —el depto como comprado al contado— y eso dejaba COMPRAR con −$371 mil al mes
//      (a31c27b9). Decisión de Fabrizio: con pie cero manda el flujo, también en el puntaje.
//      El chequeo de «rendimiento neto» se reemplaza por el de flujo; la regla vive además en
//      el tier PIE-CERO (`pie-cero-catch-test.ts`), que la verifica por mutación.
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
import { SCORE_CORTE_COMPRAR, SCORE_CORTE_AJUSTA } from "../../../src/lib/score-cortes";
import { runAnalysis } from "../../../src/lib/analysis";
import { metricaValorONull } from "../../../src/lib/types";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";
import { calcCashOnCashDim } from "../../../src/lib/engines/short-term-score";

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
  // 22-sep-2026: sin «ventaja vs LTR» (vestigio de AMBAS); su 20 se repartió a prorrata.
  const esperadoStr = { rentabilidad: 18.75, sostenibilidad: 25, factibilidad: 25, cashOnCash: 18.75, tir: 12.5 };
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
  // pie cero: CoC = puntaje del flujo (manda el flujo), TIR no aplica y reparte
  const sinPie = GOLDEN_SEEDS.find((s) => s.key === "GS-PC1")!;
  const r0: any = runAnalysis(sinPie.input, GOLDEN_UF, sinPie.mediana, GOLDEN_ASOF);
  const d0 = r0.desglose;
  if (r0.metrics.cashOnCash?.tipo !== "no_aplica") F("4 · GS-PC1 dejó de ser pie cero en el motor (cashOnCash no es no_aplica): el caso de prueba ya no prueba nada");
  else {
    if (!cerca(d0.cashOnCash, d0.flujoCaja, 0.01)) F(`4 · pie cero LTR: desglose.cashOnCash (${d0.cashOnCash}) no es el puntaje del flujo (${d0.flujoCaja}): con pie cero manda el flujo`);
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
      const pesos = { rentabilidad: d.rentabilidad.peso, sostenibilidad: d.sostenibilidad.peso, factibilidad: d.factibilidad.peso, cashOnCash: d.cashOnCash.peso, tir: d.tir.peso };
      for (const [k, v] of Object.entries(w)) if ((pesos as any)[k] !== v) F(`5 · la dimensión STR «${k}» declara peso ${(pesos as any)[k]}, el esquema dice ${v}: el PDF STR lee ese campo`);
      const coc = metricaValorONull(conPie.rec.escenarios.base.cashOnCash)! * 100; const tir = conPie.rec.metrics.tirPct;
      if (!cerca(d.cashOnCash.score, puntajeCashOnCash(coc), 0.51)) F(`5 · STR desglose.cashOnCash.score (${d.cashOnCash.score}) no es la curva del CoC (${coc.toFixed(2)} → ${puntajeCashOnCash(coc)})`);
      if (!cerca(d.tir.score, puntajeTir(tir), 0.51)) F(`5 · STR desglose.tir.score (${d.tir.score}) no es la curva de la TIR (${tir} → ${puntajeTir(tir)})`);
      const esperado = combinarConReparto(Object.keys(w).map((k) => ({ peso: (w as any)[k], puntaje: d[k].aplica === false ? null : d[k].score })));
      if (fs.score !== esperado) F(`5 · el score STR de GE-1 (${fs.score}) no es la media ponderada de sus cinco dimensiones (${esperado})`);
    }
  }
  const sinPie = recomputeStrSeed(STR_GE_SEEDS.find((s) => s.key === "GE-PC")!, frozen);
  if (!sinPie) F("5 · GE-PC sin fixture");
  else {
    const fs: any = sinPie.score; const d = fs.desglose; const base = sinPie.rec.escenarios.base;
    if (base.cashOnCash?.tipo !== "no_aplica") F("5 · GE-PC dejó de ser pie cero en el motor STR");
    else if (d.cashOnCash && d.tir) {
      const esperadoFlujo = calcCashOnCashDim(null, base.flujoCajaMensual).score;
      if (d.cashOnCash.score !== esperadoFlujo) F(`5 · pie cero STR: cashOnCash.score (${d.cashOnCash.score}) no es el puntaje del flujo (${Math.round(base.flujoCajaMensual)} → ${esperadoFlujo})`);
      if (d.cashOnCash.aplica === false) F("5 · pie cero STR: la dimensión CoC tiene que aplicar (el puntaje del flujo), no repartirse");
      if (d.tir.aplica !== false) F("5 · pie cero STR: la dimensión TIR tiene que declararse `aplica: false` y repartir su peso");
    }
  }
}

// ── 6 · las puertas no se tocan y la página pinta el score recomputado ─────
{
  // ⛔ LOS UMBRALES VAN ANCLADOS POR LA DERECHA (17-sep-2026). Sin ancla, un umbral es
  // PREFIJO de cualquier otro que empiece igual —"0.02" ⊂ "0.025", "-30" ⊂ "-30.5",
  // "1.30" ⊂ "1.305"— así que recalibrar una puerta dejaba el tier VERDE. Y además
  // admitía AGREGAR condiciones: `coc < -30 && score < 60,` seguía conteniendo el literal.
  // La coma final (o el `&&`) cierra las dos direcciones: fija el umbral Y el fin de la
  // expresión. Verificado por mutación en los cinco brazos con decimal y en los tres gates.
  const A = leer("src/lib/analysis.ts");
  if (!/cocSevero: coc !== null && coc < -30,/.test(A)) F("6 · G1 cocSevero dejó de ser CoC < −30");
  // ACTA (25-sep-2026): con pie cero el G2 ya no se salta —aplica su brazo de flujo solo—; los
  // umbrales son los mismos y el ancla fija las dos ramas y que el gate las use.
  if (
    !/cocGate2 === null\s*\?\s*flujoMuyNegativoRatio < -0\.05\s*:\s*cocGate2 < -10 \|\| \(flujoMuyNegativoRatio < -0\.05 && cocGate2 < 0\);/.test(A) ||
    !/veredicto === "COMPRAR" &&\s*gate2Brazos\s*\)/.test(A)
  ) F("6 · G2 LTR cambió sus umbrales (CoC < −10 / flujo < −5 % con CoC < 0; sin pie, flujo < −5 %)");
  if (!/metrics\.flujoNetoMensual >= 0 &&\s*metrics\.rentabilidadNeta >= 4(?![\d.])/.test(A)) F("6 · G3 LTR cambió (flujo ≥ 0 y neta ≥ 4)");
  // ACTA 23-sep-2026: los cortes suben a constante (`score-cortes.ts`) porque el ⓘ del Franco
  // Score los cita. Se fija el VALOR de la constante y que las dos bandas la LEAN: un literal
  // que vuelva a `evalVeredicto` o a `calcFrancoScoreSTR` la deja sin lector y cae acá.
  if (SCORE_CORTE_COMPRAR !== 70 || SCORE_CORTE_AJUSTA !== 45) F("6 · las bandas dejaron de ser 70/45 (score-cortes.ts)");
  if (!/score >= SCORE_CORTE_COMPRAR \? "COMPRAR" : score >= SCORE_CORTE_AJUSTA \? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"/.test(A)) F("6 · las bandas LTR no leen SCORE_CORTE_COMPRAR / SCORE_CORTE_AJUSTA");
  const S = leer("src/lib/engines/short-term-score.ts");
  if (!/if \(score >= SCORE_CORTE_COMPRAR\) veredicto = 'COMPRAR';\s*else if \(score >= SCORE_CORTE_AJUSTA\) veredicto = 'AJUSTA SUPUESTOS';/.test(S)) F("6 · las bandas STR no leen SCORE_CORTE_COMPRAR / SCORE_CORTE_AJUSTA");
  for (const brazo of ["g1_cocSevero: p.coc !== null && p.coc < -0.30", "g1_beInviable: p.beRatio > 1.30", "g1_capRateMinimo: p.capRate < 0.02", "g2_cocFuerte: p.coc !== null && p.coc < -0.10", "g2_flujoSinHorizonte: p.flujoCajaMensual < 0 && !p.horizonteCierraFavorable", "g2_beApretado: p.beRatio > 1.10"]) {
    // Con la coma: `p.capRate < 0.02,` no está en `p.capRate < 0.025,` ni en `p.capRate < 0.02 && x,`.
    if (!S.includes(`${brazo},`)) F(`6 · el brazo STR «${brazo.split(":")[0]}» cambió su umbral`);
  }
  if (!/const HORIZONTE_TIR_MINIMO = 10;/.test(S) || !/const HORIZONTE_MULT_MINIMO = 2\.65;/.test(S)) F("6 · el horizonte STR (TIR 10 / multiplicador 2,65) cambió");
  // Y ACÁ SE AFIRMA, NO SOLO SE PROHÍBE. El predicado era `if (/score=\{analisis\.score\}/)`,
  // puramente negativo: invertir el `??` a `analisis.score ?? results?.score` lo evadía y la
  // página volvía a pintar la columna persistida. También lo evadían `score={s}` con una
  // const intermedia, o `score={analisis.score ?? 0}`. Ahora se exige la forma que manda —el
  // recomputado primero— y se cuentan los DOS sitios, porque arreglar uno y no el otro
  // dejaba media página mintiendo.
  const P = leer("src/app/analisis/[id]/page.tsx");
  const recomputado = (P.match(/score=\{results\?\.score \?\? analisis\.score\}/g) ?? []).length;
  if (recomputado < 2) F(`6 · la página LTR pasa el score recomputado en ${recomputado} de los 2 sitios: el recompute tiene que ir primero en el \`??\``);
  if (/score=\{analisis\.score\}/.test(P)) F("6 · la página LTR sigue pasando la columna `analisis.score` persistida: con el score nuevo mostraría el número viejo junto a un veredicto recomputado");
}

// ── 7 · los dos PDF leen los pesos del motor y pintan las seis dimensiones ─
// Bloque 0 del plan (12-sep-2026): `DocumentoLTR.tsx` hardcodeaba «peso 30%/25%/25%/20%» en
// el JSX; con seis dimensiones eso mentiría. Los dos documentos leen `score-retorno.ts`
// (LTR) o el `peso` que viaja en cada `DimensionScore` (STR), y pintan también el retorno
// sobre lo puesto y la TIR. Y el documento LTR pasa el score recomputado, no la columna.
{
  // ⛔ LA PROHIBICIÓN SOLA NO ALCANZABA (17-sep-2026). `/peso \d+%/` prohíbe UNA grafía y
  // nunca afirma que el JSX lea el módulo: la evaden `peso {20}%`, `peso&nbsp;20%`,
  // `peso 20 %` y `Peso 20%` (el regex es case-sensitive). Y `/PESOS_SCORE_LTR/` sobre el
  // archivo entero es PRESENCIA: lo satisface la línea de import, o un comentario.
  // Peor, la mutación que de verdad importa las evade a las dos: `const W = {
  // ...PESOS_SCORE_LTR, cashOnCash: 25 }` deja el PDF pintando pesos que no son los del
  // score, con el import intacto y sin ningún número en el JSX. Por eso acá va la grafía
  // exacta de la asignación: es lo único que ata el W del JSX al módulo.
  const L = leer("src/app/analisis/[id]/documento/DocumentoLTR.tsx");
  if (/[Pp]eso(&nbsp;|\s)*\d+(&nbsp;|\s)*%/.test(L)) F("7 · DocumentoLTR.tsx sigue con un peso hardcodeado en el JSX («peso NN%»): los pesos viven en score-retorno.ts");
  if (!/const W = PESOS_SCORE_LTR;/.test(L)) F("7 · DocumentoLTR.tsx no toma los pesos TAL CUAL de PESOS_SCORE_LTR: con un spread que sobreescriba una clave, el PDF pinta pesos que no son los del score");
  if (!/peso \{W\./.test(L)) F("7 · DocumentoLTR.tsx no interpola los pesos del módulo en el JSX («peso {W.…}%»)");
  for (const k of ["cashOnCash", "tir"]) if (!L.includes(`d.${k}`)) F(`7 · DocumentoLTR.tsx no pinta la dimensión «${k}» del desglose`);
  const S2 = leer("src/app/analisis/renta-corta/[id]/documento/DocumentoSTR.tsx");
  for (const k of ["cashOnCash", "tir"]) if (!S2.includes(`d.${k}`)) F(`7 · DocumentoSTR.tsx no pinta la dimensión «${k}» del desglose`);
  if (/[Pp]eso(&nbsp;|\s)*\d+(&nbsp;|\s)*%/.test(S2)) F("7 · DocumentoSTR.tsx tiene un peso hardcodeado");
  // En STR el peso viaja en cada `DimensionScore`, así que la afirmación es que el JSX lo lea de ahí.
  if (!/peso \{d\.\w+\.peso\}/.test(S2)) F("7 · DocumentoSTR.tsx no interpola el `peso` que viaja en cada dimensión del motor");
  const PL = leer("src/app/analisis/[id]/documento/page.tsx");
  if (!/score=\{results\?\.score \?\? analisis\.score\}/.test(PL)) F("7 · el documento LTR no pasa el score recomputado primero en el `??`");
  if (/score=\{analisis\.score\}/.test(PL)) F("7 · el documento LTR sigue pasando la columna `analisis.score` persistida en vez del score recomputado");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runScoreRetornoTier(): { hard: number } {
  console.log("\n─── TIER SCORE-RETORNO (esquema A · curva calibrada · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — pesos A en las dos modalidades, curvas calibradas, pie cero con el puntaje del flujo y TIR repartida, desglose de seis, puertas intactas, la página y el PDF pintan el score recomputado y los PDF leen los pesos del motor");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runScoreRetornoTier();
  process.exit(hard ? 1 : 0);
}
