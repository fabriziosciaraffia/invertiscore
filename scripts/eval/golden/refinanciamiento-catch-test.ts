// ─────────────────────────────────────────────────────────────────────────────
// TIER REFINANCIAMIENTO (22-sep-2026) · el capítulo «Tu resultado a N años» lee el
// refinanciamiento DEL MOTOR, y avisa cuando la cuota nueva salta.
//
// Decisión de Fabrizio: `refinanceScenario` se emitía en el 100% de las filas LTR y no lo
// leía nadie; los capítulos V (LTR) y VI (STR) calculaban el suyo con otros supuestos (70%
// del valor, sin el flujo resultante). Ahora los dos motores lo emiten AL AÑO DE SALIDA con
// `REFI_LTV`, la razón cuota nueva ÷ cuota actual viaja en el dato, y los capítulos lo leen.
//
// Reglas:
//   1 · constantes: REFI_LTV 0,80 · REFI_AVISO_CUOTA_RATIO 1,5; `ratioCuotaRefi` null sin cuota
//       actual; `avisaCuotaRefi` estricto en el umbral.
//   2 · motor LTR (`calcRefinanceScenario`, fixture puro): crédito nuevo = valor × REFI_LTV,
//       liberado = nuevo − saldo, año = el pedido, ratio = cuota nueva ÷ cuota actual; y
//       `runAnalysis` lo llama con `exitScenario.anios`, no con 5.
//   3 · motor STR: `buildRefinanceScenario` existe, usa REFI_LTV y `ratioCuotaRefi`, y viaja
//       en el resultado (`refinanceScenario`).
//   4 · los dos capítulos leen `results.refinanceScenario`, no calculan un `ltv` local ni una
//       cuota con `calcDividendo`, imprimen cuota nueva, flujo nuevo y liberado del dato, y
//       el aviso pasa por `avisaCuotaRefi` + `fraseAvisoCuotaRefi`.
//
// Verificado EN ROJO por mutación (scratchpad mutar8.py, siete mutaciones, cada una cae por su
// regla): LTV a 0,7; el motor LTR de vuelta a 5 años; el capítulo LTR con `const ltv = 0.7`; STR
// sin `refinanceScenario` en el resultado; el aviso con `>=`; el ratio LTR como literal; y el
// capítulo STR sin la fila del flujo nuevo (el aviso solo no la satisface).
//
// Corre solo: node --import tsx scripts/eval/golden/refinanciamiento-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcRefinanceScenario, calcDividendo } from "../../../src/lib/analysis";
import { REFI_LTV, REFI_AVISO_CUOTA_RATIO, ratioCuotaRefi, avisaCuotaRefi, fraseAvisoCuotaRefi } from "../../../src/lib/refinanciamiento";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\/\/[^\n]*/g, "");

export function runRefinanciamientoTier(): { hard: number } {
  fallas.length = 0;

  // 1 · constantes y helpers
  if (REFI_LTV !== 0.8) F(`1 · REFI_LTV debía ser 0,8 (es ${REFI_LTV})`);
  if (REFI_AVISO_CUOTA_RATIO !== 1.5) F(`1 · REFI_AVISO_CUOTA_RATIO debía ser 1,5 (es ${REFI_AVISO_CUOTA_RATIO})`);
  if (ratioCuotaRefi(600_000, 0) !== null || ratioCuotaRefi(600_000, 400_000) !== 1.5) F("1 · ratioCuotaRefi: null sin cuota actual, 1,5 con 600/400");
  if (avisaCuotaRefi(1.5) || !avisaCuotaRefi(1.51) || avisaCuotaRefi(null)) F("1 · avisaCuotaRefi no es estricto sobre 1,5 (o avisa con null)");
  const frase = fraseAvisoCuotaRefi({ veces: "1,8", cuotaNueva: "$900.000", cuotaActual: "$500.000", flujoNuevo: "−$120.000 al mes", flujoNuevoNegativo: true });
  if (!/1,8 veces la actual/.test(frase) || !/sale de tu bolsillo/.test(frase)) F("1 · la frase del aviso no dice las veces ni que la liquidez sale del bolsillo");

  // 2 · motor LTR, fixture puro
  const input: any = { tasaInteres: 4, plazoCredito: 20, vacanciaMeses: 1, usaAdministrador: false, comisionAdministrador: 0 };
  const metrics: any = { gastos: 60_000, contribuciones: 30_000, provisionMantencionAjustada: 20_000, dividendo: 500_000 };
  const proy = (anio: number) => ({ anio, valorPropiedad: 100_000_000 + anio * 3_000_000, saldoCredito: 60_000_000 - anio * 2_000_000, arriendoMensual: 650_000, flujoAnual: 0, flujoAcumulado: 0, patrimonioNeto: 0 });
  const projections: any = Array.from({ length: 20 }, (_, i) => proy(i + 1));
  const r = calcRefinanceScenario(input, metrics, projections, 10);
  const esperadoCredito = Math.round(projections[9].valorPropiedad * REFI_LTV);
  if (r.anios !== 10 || r.ltv !== REFI_LTV) F(`2 · el escenario no declara año y LTV (${r.anios} / ${r.ltv})`);
  if (r.nuevoCredito !== esperadoCredito) F(`2 · crédito nuevo ${r.nuevoCredito} ≠ valor del año 10 × REFI_LTV (${esperadoCredito})`);
  if (r.capitalLiberado !== esperadoCredito - projections[9].saldoCredito) F("2 · liberado ≠ crédito nuevo − saldo del año 10");
  if (r.nuevoDividendo !== calcDividendo(esperadoCredito, 4, 20)) F("2 · la cuota nueva no sale de calcDividendo con tasa y plazo del input");
  if (r.dividendoActual !== 500_000 || r.ratioCuota == null || Math.abs(r.ratioCuota - r.nuevoDividendo / 500_000) > 1e-9) F("2 · ratioCuota ≠ cuota nueva ÷ cuota actual");
  const r5 = calcRefinanceScenario(input, metrics, projections, 5);
  if (r5.anios !== 5 || r5.nuevoAvaluo !== projections[4].valorPropiedad) F("2 · el año pedido no gobierna el escenario");
  const an = leer("src/lib/analysis.ts");
  if (!/calcRefinanceScenario\(input, metrics, projections, exitScenario\.anios\)/.test(an)) F("2 · runAnalysis no llama al refinanciamiento con el año de la salida");
  if (/nuevoAvaluo \* 0\.8/.test(an)) F("2 · el motor LTR usa un LTV literal en vez de REFI_LTV");
  if (!/ratioCuota: ratioCuotaRefi\(nuevoDividendo, metrics\.dividendo\),/.test(an)) F("2 · el ratio del motor LTR no pasa por ratioCuotaRefi");

  // 3 · motor STR
  const st = leer("src/lib/engines/short-term-engine.ts");
  const fn = st.match(/function buildRefinanceScenario\([^]*?\n}/);
  if (!fn) F("3 · el motor STR no tiene buildRefinanceScenario");
  else {
    if (!/nuevoAvaluo \* REFI_LTV/.test(fn[0]) || !/ratioCuotaRefi\(nuevoDividendo, dividendoActual\)/.test(fn[0])) F("3 · buildRefinanceScenario no usa REFI_LTV o no calcula el ratio con ratioCuotaRefi");
    if (!/nuevoFlujoNeto: Math\.round\(flujoCajaMensual - \(nuevoDividendo - dividendoActual\)\)/.test(fn[0])) F("3 · el flujo nuevo STR no es el flujo base con la cuota nueva");
  }
  if (!/const refinanceScenario = buildRefinanceScenario\(input, projections, exitScenario\.yearVenta, dividendoMensual, base\.flujoCajaMensual\);/.test(st)) F("3 · STR no arma el refinanciamiento al año de la salida");
  if (!/\n    exitScenario,\r?\n    refinanceScenario,/.test(st)) F("3 · refinanceScenario no viaja en el resultado STR");
  if (!/refinanceScenario\?: RefinanceScenario;/.test(st)) F("3 · ShortTermResult no declara refinanceScenario");

  // 4 · los capítulos leen el del motor
  for (const [mod, p] of [["LTR", "src/components/analysis/CapitulosInversion.tsx"], ["STR", "src/components/analysis/str/CapitulosInversionStr.tsx"]] as const) {
    const s = leer(p);
    if (!/const refi = results\.refinanceScenario \?\? null;/.test(s)) F(`4 · ${mod} no lee results.refinanceScenario`);
    if (/const ltv = 0\.7|calcDividendo\(nuevoCredito/.test(s)) F(`4 · ${mod} sigue calculando su propio refinanciamiento`);
    for (const campo of ["refi.nuevoCredito", "refi.nuevoDividendo", "refi.capitalLiberado", "refi.ltv", "refi.anios"]) if (!s.includes(campo)) F(`4 · ${mod} no imprime ${campo}`);
    if (!/<FilaDato k="Tu mes con la cuota nueva"[^\n]*refi\.nuevoFlujoNeto/.test(s)) F(`4 · ${mod} no imprime el flujo con la cuota nueva como fila`);
    if (!/avisaCuotaRefi\(refi\.ratioCuota\) && veces && \(/.test(s) || !/fraseAvisoCuotaRefi\(\{ veces, cuotaNueva: money\(refi\.nuevoDividendo\), cuotaActual: money\(refi\.dividendoActual\)/.test(s)) F(`4 · ${mod}: el aviso no pasa por avisaCuotaRefi + fraseAvisoCuotaRefi con las cuotas del dato`);
    if (!/\{refi && plazo > 0 && refi\.capitalLiberado > 0 && \(/.test(s)) F(`4 · ${mod}: el bloque no se gatea por liberado > 0`);
  }

  const hard = fallas.length;
  if (hard === 0) console.log("   refinanciamiento ✓ (el del motor al año de salida en LTR y STR, REFI_LTV, ratio en el dato, capítulos sin cálculo propio y con aviso sobre 1,5×)");
  else { console.log(`   refinanciamiento ✗ ${hard} falla(s)`); for (const f of fallas) console.log(`     - ${f}`); }
  return { hard };
}

if (require.main === module) process.exit(runRefinanciamientoTier().hard ? 1 : 0);
