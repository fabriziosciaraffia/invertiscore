// ─────────────────────────────────────────────────────────────────────────────
// TIER SOBREPRECIO-VENTA (22-sep-2026) · el sobreprecio de hoy se descuenta PLANO en la
// venta al año de salida (variante B, decisión de Fabrizio tras medir A, B y C en el parque).
//
// Reglas:
//   1 · `sobreprecioDeHoy` (puro): null sin mediana confiable, null en o bajo la mediana,
//       clp = precio − precio ÷ (1 + desv), muestraChica = n < 30.
//   2 · motor LTR (`calcExitScenario`, fixture puro): con sobreprecio adverso el equity baja
//       exactamente en sobreprecio + su efecto en la comisión; precioVentaEsperado = valor −
//       sobreprecio; comisión sobre lo que el mercado paga; la TIR baja; bajo la mediana no
//       cambia nada; sin mediana confiable tampoco.
//   3 · motor STR (`calcShortTerm`, fixture puro): mismo espejo; `parteAlVender` del año de
//       venta ≡ `exit.equityCLP`; sin mediana en los inputs no hay descuento.
//   4 · la mediana llega al motor STR por los cuatro caminos (pipeline, ctx del recompute,
//       metadata de la página, simulación); `veredictoStrRecomputado` la recibe y la pasa.
//   5 · los dos capítulos imprimen la línea «Menos el sobreprecio de hoy» desde el dato, la
//       comisión dice «del precio de venta», y la fuente nombra la muestra chica; la curva STR
//       usa `parteAlVender` con la etiqueta final = equity.
//
// Verificado EN ROJO por mutación (scratchpad mutar9.py).
// Corre solo: node --import tsx scripts/eval/golden/sobreprecio-venta-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcExitScenario } from "../../../src/lib/analysis";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { metricaValorONull } from "../../../src/lib/types";
import { sobreprecioDeHoy, SOBREPRECIO_VENTA_MUESTRA_CHICA_N } from "../../../src/lib/sobreprecio-venta";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import seeds from "./str-seeds-frozen.json";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\/\/[^\n]*/g, "");

export function runSobreprecioVentaTier(): { hard: number } {
  fallas.length = 0;

  // 1 · puro
  if (SOBREPRECIO_VENTA_MUESTRA_CHICA_N !== 30) F(`1 · la muestra chica debía cortar en 30 (es ${SOBREPRECIO_VENTA_MUESTRA_CHICA_N})`);
  const s15 = sobreprecioDeHoy({ precioCLP: 115_000_000, desviacionPct: 15, confiable: true, n: 25 });
  if (!s15 || s15.clp !== 15_000_000 || !s15.muestraChica || s15.n !== 25 || s15.desviacionPct !== 15) F(`1 · 15% sobre 115 MM debía dar 15 MM con muestra chica (${JSON.stringify(s15)})`);
  const s15g = sobreprecioDeHoy({ precioCLP: 115_000_000, desviacionPct: 15, confiable: true, n: 30 });
  if (!s15g || s15g.muestraChica) F("1 · con n = 30 la muestra no es chica");
  if (sobreprecioDeHoy({ precioCLP: 100_000_000, desviacionPct: -8, confiable: true, n: 100 }) !== null) F("1 · bajo la mediana debía dar null");
  if (sobreprecioDeHoy({ precioCLP: 100_000_000, desviacionPct: 0, confiable: true, n: 100 }) !== null) F("1 · en la mediana debía dar null");
  if (sobreprecioDeHoy({ precioCLP: 100_000_000, desviacionPct: 15, confiable: false, n: 0 }) !== null) F("1 · sin mediana confiable debía dar null");

  // 2 · motor LTR, fixture puro (metrics mínimas que lee calcExitScenario)
  const input: any = { razonSinPie: undefined };
  const proy = (anio: number) => ({ anio, valorPropiedad: Math.round(100_000_000 * Math.pow(1.03, anio)), saldoCredito: 60_000_000 - anio * 2_000_000, arriendoMensual: 600_000, flujoAnual: 1_200_000, flujoAcumulado: 1_200_000 * anio, patrimonioNeto: 0 });
  const projections: any = Array.from({ length: 20 }, (_, i) => proy(i + 1));
  const metricsBase: any = { pieCLP: 20_000_000, precioCLP: 100_000_000, capexPuestaAPuntoCLP: 0, corretajeInicialCLP: 0 };
  const sin = calcExitScenario(input, { ...metricsBase, precioVsComuna: { confiable: false, desviacionPct: null, n: 0 } }, projections, 10);
  const bajo = calcExitScenario(input, { ...metricsBase, precioVsComuna: { confiable: true, desviacionPct: -10, n: 80 } }, projections, 10);
  const con = calcExitScenario(input, { ...metricsBase, precioVsComuna: { confiable: true, desviacionPct: 25, n: 12 } }, projections, 10);
  if (sin.sobreprecioVenta !== null || sin.precioVentaEsperado !== sin.valorVenta) F("2 · sin mediana confiable el exit descuenta algo");
  if (bajo.sobreprecioVenta !== null || bajo.equityCLP !== sin.equityCLP) F("2 · bajo la mediana el exit cambia");
  const esperado = Math.round(100_000_000 - 100_000_000 / 1.25);
  if (!con.sobreprecioVenta || con.sobreprecioVenta.clp !== esperado || !con.sobreprecioVenta.muestraChica) F(`2 · el sobreprecio no es el de hoy, plano (${JSON.stringify(con.sobreprecioVenta)} vs ${esperado})`);
  if (con.precioVentaEsperado !== con.valorVenta - esperado) F("2 · precioVentaEsperado ≠ valor proyectado − sobreprecio");
  if (con.comisionVenta !== Math.round(con.precioVentaEsperado * 0.02)) F("2 · la comisión no va sobre lo que el mercado paga");
  if (con.equityCLP !== con.precioVentaEsperado - con.saldoCredito - con.comisionVenta) F("2 · el equity no es precio esperado − deuda − comisión");
  if (con.valorVenta !== sin.valorVenta) F("2 · el valor PROYECTADO cambió: el descuento tiene que ser una línea aparte, no una re-proyección");
  const tSin = metricaValorONull(sin.tir), tCon = metricaValorONull(con.tir);
  if (tSin == null || tCon == null || !(tCon < tSin)) F(`2 · la TIR no hereda el descuento (${tSin} → ${tCon})`);

  // 3 · motor STR, seed congelada GE-1 reconstruida por el MISMO ctx que usa el recompute
  const seed: any = (seeds as any)["GE-1"];
  const ctxStr = seed ? buildStrRecomputeCtx(seed.input_data, { airbnbRaw: seed.airbnbRaw }, seed.uf) : null;
  const inputsStr: any = ctxStr?.inputs;
  if (!inputsStr || typeof inputsStr.precioCompra !== "number") F("3 · la seed GE-1 no reconstruye los inputs del motor");
  else {
    const asOf = new Date("2026-09-01T00:00:00.000Z");
    const rSin = calcShortTerm({ ...inputsStr, medianaComunaUfM2: null, medianaN: 0 }, asOf);
    const sujeto = inputsStr.precioCompra / inputsStr.valorUF / inputsStr.superficie;
    const rCon = calcShortTerm({ ...inputsStr, medianaComunaUfM2: sujeto / 1.2, medianaN: 50 }, asOf);
    const rBajo = calcShortTerm({ ...inputsStr, medianaComunaUfM2: sujeto * 1.2, medianaN: 50 }, asOf);
    const eSin = rSin.exitScenario!, eCon = rCon.exitScenario!, eBajo = rBajo.exitScenario!;
    if (eSin.sobreprecioVenta !== null || eSin.precioVentaEsperado !== eSin.valorVenta) F("3 · STR sin mediana descuenta algo");
    if (eBajo.sobreprecioVenta !== null || eBajo.equityCLP !== eSin.equityCLP) F("3 · STR bajo la mediana cambia");
    if (!eCon.sobreprecioVenta || eCon.sobreprecioVenta.desviacionPct !== 20) F(`3 · STR: la desviación no es la del hallazgo (${JSON.stringify(eCon.sobreprecioVenta)})`);
    if (eCon.valorVenta !== eSin.valorVenta) F("3 · STR: el valor proyectado cambió");
    if (eCon.sobreprecioVenta && (eCon.precioVentaEsperado !== eCon.valorVenta - eCon.sobreprecioVenta.clp || eCon.gastosCierre !== Math.round(eCon.precioVentaEsperado * 0.02) || eCon.equityCLP !== eCon.precioVentaEsperado - eCon.saldoCreditoAlVender - eCon.gastosCierre)) F("3 · STR: cierre y equity no van sobre lo que el mercado paga");
    const pAnio = rCon.projections![eCon.yearVenta - 1];
    if (pAnio.parteAlVender !== eCon.equityCLP) F(`3 · parteAlVender del año de venta (${pAnio.parteAlVender}) ≠ exit.equityCLP (${eCon.equityCLP})`);
    const pSin = rSin.projections![eSin.yearVenta - 1];
    if (pSin.parteAlVender !== eSin.equityCLP) F("3 · sin sobreprecio, parteAlVender del año de venta ≠ equity");
    const tS = metricaValorONull(eSin.tirAnual), tC = metricaValorONull(eCon.tirAnual);
    if (tS == null || tC == null || !(tC < tS)) F(`3 · STR: la TIR no hereda el descuento (${tS} → ${tC})`);
  }

  // 4 · la mediana llega al motor STR por los cuatro caminos
  const pipe = leer("src/lib/api-helpers/analisis-pipeline.ts");
  if (!/medianaComunaUfM2: medianaComuna\?\.mediana \?\? null,/.test(pipe) || !/medianaN: medianaComuna\?\.n \?\? 0,/.test(pipe)) F("4 · el pipeline no pasa la mediana al motor STR");
  const rec = leer("src/lib/analysis/recompute-short-term-for-legacy.ts");
  if (!/medianaComunaUfM2: mediana\?\.mediana \?\? null,/.test(rec) || !/buildStrRecomputeCtx\(inputData, persistedResults, ufClp, mediana\)/.test(rec) || !/veredictoStrRecomputado\(inputData, persistedResults, ufClp, asOf, mediana\)/.test(rec)) F("4 · el recompute no pasa la mediana al ctx o a veredictoStrRecomputado");
  const pg = leer("src/app/analisis/renta-corta/[id]/page.tsx");
  if (!/mediana_comuna_snapshot"\)/.test(pg) || !/new Date\(data\.created_at \?\? new Date\(\)\.toISOString\(\)\),\s*\(\(\) => \{ const snap = data\.mediana_comuna_snapshot/.test(pg)) F("4 · la metadata STR no pasa la mediana del snapshot");
  if (!/simularStrDesdePersistido\(raw, results as unknown as \{ airbnbRaw\?: unknown \}, uf, new Date\(data\.created_at\), medianaStr\)/.test(pg)) F("4 · la simulación de la página no recibe la mediana");
  const sim = leer("src/lib/analysis/simular-str.ts");
  if (!/buildStrRecomputeCtx\(inputData, persistedResults, ufClp, mediana\)/.test(sim)) F("4 · simularStrDesdePersistido no pasa la mediana al ctx");
  const prosa = leer("src/lib/str-prosa-persist.ts");
  if (!/simularStrDesdePersistido\(input, results as unknown as \{ airbnbRaw\?: unknown \}, ufFrozen, asOfFrozen, medianaStr\)/.test(prosa)) F("4 · la prosa persistida simula sin la mediana");

  // 5 · los capítulos
  for (const [mod, p] of [["LTR", "src/components/analysis/CapitulosInversion.tsx"], ["STR", "src/components/analysis/str/CapitulosInversionStr.tsx"]] as const) {
    const s = leer(p);
    if (!/\{exit\.sobreprecioVenta && \(\s*<FilaDato k="Menos el sobreprecio de hoy"[^\n]*exit\.sobreprecioVenta\.clp/.test(s)) F(`5 · ${mod} no imprime la línea del sobreprecio desde el dato`);
    if (!/pagaste \$\{exit\.sobreprecioVenta\.desviacionPct\}% sobre la mediana de la comuna/.test(s)) F(`5 · ${mod}: la línea no dice cuánto pagaste sobre la mediana`);
    if (!/sub="2% del precio de venta"/.test(s) || /sub="2% del valor de venta"/.test(s)) F(`5 · ${mod}: la comisión sigue diciendo «del valor de venta»`);
    if (!/muestraChica \? ", muestra chica: la corrección es más dudosa" : ""/.test(s) || !/avisos comparables de la comuna/.test(s)) F(`5 · ${mod}: la fuente no nombra la muestra ni la muestra chica`);
  }
  const st = leer("src/components/analysis/str/CapitulosInversionStr.tsx");
  // Desde el mockup aprobado (22-sep) el gráfico STR es PatrimonioBarras y la serie lee parteAlVender.
  if (!/parte: results\.projections\?\.\[r\.anio - 1\]\?\.parteAlVender/.test(st) || !/<PatrimonioBarras filas=\{filasBarras\}/.test(st)) F("5 · el gráfico STR no dibuja parteAlVender en PatrimonioBarras");
  if (/CurvaPatrimonio|etiquetaFinal=/.test(st)) F("5 · el capítulo STR sigue con la curva vieja");
  const eng = leer("src/lib/engines/short-term-engine.ts");
  if (!/const precioEsperadoAnio = p\.valorDepto - \(sobreprecioVenta\?\.clp \?\? 0\);\s*p\.parteAlVender = Math\.round\(precioEsperadoAnio - p\.saldoCredito - Math\.round\(precioEsperadoAnio \* GASTOS_CIERRE_VENTA\)\);/.test(eng)) F("5 · el motor STR no emite parteAlVender neto de gastos de venta y sobreprecio, sobre lo que paga el mercado");

  const hard = fallas.length;
  if (hard === 0) console.log("   sobreprecio-venta ✓ (variante B: el sobreprecio de hoy plano en la venta, comisión y equity sobre lo que paga el mercado, la TIR lo hereda, STR espejo con la mediana por los cuatro caminos, un solo patrimonio en la curva, línea visible y muestra chica en la fuente)");
  else { console.log(`   sobreprecio-venta ✗ ${hard} falla(s)`); for (const f of fallas) console.log(`     - ${f}`); }
  return { hard };
}

if (require.main === module) process.exit(runSobreprecioVentaTier().hard ? 1 : 0);
