// ============================================================================
// GOLDEN · PESOS-DE-HOY (29-sep-2026) — catch-test
// ============================================================================
//   Regla de Fabrizio: todo monto futuro del informe va en pesos de hoy —equivalente a UF— y todo
//   porcentaje de rentabilidad, tasa o crecimiento en términos reales («UF + %»). El botón CLP/UF
//   muestra lo mismo en las dos unidades, sin inflación de por medio.
//
//   La forma de cumplirla en todas las piezas a la vez: la PROYECCIÓN de los dos motores va entera
//   en pesos de hoy. Con todos los años en la misma moneda, ninguna cifra resta o compara montos de
//   años distintos sin llevarlos a pesos de hoy (la amortización, «Firme · X%», la plusvalía neta,
//   el multiplicador, el patrimonio y el resultado a 10 años, el aviso de refinanciamiento, el
//   depósito del capítulo V, los montos «UF» del año 10).
//   1 · VALOR: crece solo con la plusvalía real (3%); con plusvalía 0 queda plano.
//   2 · SALDO: la deuda en UF, en pesos de hoy (con tasa 0 baja lineal).
//   3 · FLUJOS: la cuota fija en UF (plana), el arriendo +0,49% real, los gastos planos.
//   4 · TIR: la de esos flujos, sin nada más: es real. La amortización a 10 años es positiva.
//   5 · LTR y STR con la misma regla; ningún término crece a una tasa nominal; los rótulos dicen
//       «real» y «pesos de hoy»; el hallazgo de plusvalía no compara contra la inflación.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/pesos-de-hoy-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcMetrics, calcProjections, runAnalysis } from "../../../src/lib/analysis";
import { calcShortTerm, type AirbnbData, type ShortTermInputs } from "../../../src/lib/engines/short-term-engine";
import { calcIRR } from "../../../src/lib/finance/irr";
import { metricaValorONull } from "../../../src/lib/types";
import { INFLACION_PROYECCION_ANUAL, PLUSVALIA_PROYECCION_ANUAL, crecimientoReal } from "../../../src/lib/plusvalia-proyeccion";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const cerca = (a: number, b: number, tol = 0.002) => Math.abs(a / b - 1) <= tol;
const ARR_REAL = 1.035 / 1.03 - 1;

const airbnb: AirbnbData = {
  estimated_adr: 55_000,
  estimated_occupancy: 0.7,
  estimated_annual_revenue: 14_000_000,
  percentiles: {
    revenue: { p25: 10_000_000, p50: 14_000_000, p75: 17_000_000, p90: 20_000_000, avg: 14_500_000 },
    occupancy: { p25: 0.55, p50: 0.7, p75: 0.8, p90: 0.88, avg: 0.7 },
    average_daily_rate: { p25: 45_000, p50: 55_000, p75: 66_000, p90: 78_000, avg: 57_000 },
  },
  monthly_revenue: Array(12).fill(1 / 12),
  currency: "CLP",
} as AirbnbData;
const strBase = (over: Partial<ShortTermInputs> = {}): ShortTermInputs =>
  ({
    precioCompra: 160_000_000, superficie: 55, dormitorios: 2, banos: 2, piePercent: 0.2, tasaCredito: 0.045, plazoCredito: 25,
    airbnbData: airbnb, modoGestion: "auto", comisionAdministrador: 0.2, costoElectricidad: 45_000, costoAgua: 12_000, costoWifi: 18_000,
    costoInsumos: 10_000, gastosComunes: 95_000, mantencion: 22_000, contribuciones: 180_000, costoAmoblamiento: 5_000_000,
    arriendoLargoMensual: 620_000, valorUF: 39_000, tipoEdificio: "residencial_puro", habilitacion: "estandar", adminPro: false,
    ...over,
  }) as ShortTermInputs;

const irr = (v: number[]) => { const r: any = calcIRR(v); return r?.ok ? r.rate * 100 : null; };

export function runPesosDeHoyTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PESOS-DE-HOY (toda la proyección en pesos de hoy; la TIR, real · 0 tokens) ───");

  if (INFLACION_PROYECCION_ANUAL !== 0.03) F(`0 · la inflación de la proyección es ${INFLACION_PROYECCION_ANUAL}, no 3%`);
  if (Math.abs(crecimientoReal(0.03)) > 1e-12 || !cerca(crecimientoReal(0.035), ARR_REAL, 1e-9)) F("0 · crecimientoReal no descuenta la inflación");

  // ── LTR ──────────────────────────────────────────────────────────────────
  const seed: any = (GOLDEN_SEEDS as any[]).find((s) => s.input.estadoVenta !== "futura" && !s.input.fechaEntrega && s.input.piePct > 0 && s.input.piePct < 100);
  if (!seed) F("0 · no hay seed LTR inmediata con pie para medir");
  else {
    const inp = { ...seed.input };
    const metrics = calcMetrics(inp, GOLDEN_UF);
    const precioCLP = inp.precio * GOLDEN_UF;
    const p0 = calcProjections({ input: inp, metrics, ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20, plusvaliaAnual: 0 });
    if (!cerca(p0[9].valorPropiedad, precioCLP, 1e-6)) F(`1 · LTR: con plusvalía 0 el valor del año 10 no es el precio en pesos de hoy (${(p0[9].valorPropiedad / precioCLP).toFixed(4)})`);
    const std = calcProjections({ input: inp, metrics, ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20 });
    if (!cerca(std[9].valorPropiedad / precioCLP, Math.pow(1 + PLUSVALIA_PROYECCION_ANUAL, 10))) F("1 · LTR: el valor a 10 años no crece con la plusvalía real");
    const inpT0 = { ...inp, tasaInteres: 0 };
    const pT0 = calcProjections({ input: inpT0, metrics: calcMetrics(inpT0, GOLDEN_UF), ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20 });
    const credito = precioCLP * (1 - inp.piePct / 100), n = inp.plazoCredito * 12;
    for (const t of [1, 5, 10]) if (!cerca(pT0[t - 1].saldoCredito, credito * (1 - (12 * t) / n), 0.001)) F(`2 · LTR: el saldo del año ${t} no está en pesos de hoy`);
    if (!cerca(std[5].dividendoAnual ?? NaN, std[4].dividendoAnual ?? NaN, 1e-6)) F("3 · LTR: la cuota no es fija en UF (crece en pesos)");
    if (!cerca(std[5].arriendoMensual / std[4].arriendoMensual, 1 + ARR_REAL, 0.0005)) F(`3 · LTR: el arriendo no crece 0,49% real (${(std[5].arriendoMensual / std[4].arriendoMensual - 1).toFixed(4)})`);
    const r: any = runAnalysis(inp, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
    const ex = r.exitScenario;
    const vec = [-ex.inversionInicial, ...r.projections.slice(0, 10).map((p: any, i: number) => p.flujoAnual + (i === 9 ? ex.equityCLP : 0))];
    const tir = metricaValorONull(ex.tir), tirV = irr(vec);
    if (tir == null || tirV == null || Math.abs(tir - tirV) > 0.02) F(`4 · LTR: la TIR del informe no es la de los flujos en pesos de hoy (${tir} vs ${tirV?.toFixed(2)})`);
    if (!(credito - ex.saldoCredito > 0)) F("4 · LTR: la amortización a 10 años no es positiva: se restan pesos de años distintos");
    if (!cerca(ex.saldoCredito, r.projections[9].saldoCredito, 1e-9)) F("4 · LTR: el saldo del exit no es el de la proyección");
  }

  // ── STR ──────────────────────────────────────────────────────────────────
  const s: any = calcShortTerm(strBase(), new Date("2026-01-01T00:00:00Z"));
  const ps = s.projections ?? [];
  if (ps.length < 10) F("1 · STR: sin proyección a 10 años");
  else {
    if (!cerca(ps[9].valorDepto / 160_000_000, Math.pow(1 + PLUSVALIA_PROYECCION_ANUAL, 10))) F(`1 · STR: el valor a 10 años no crece con la plusvalía real (${(ps[9].valorDepto / 160_000_000).toFixed(4)})`);
    const s0: any = calcShortTerm(strBase({ tasaCredito: 0 }), new Date("2026-01-01T00:00:00Z"));
    for (const t of [1, 5, 10]) {
      const esperado = 128_000_000 * (1 - (12 * t) / 300);
      if (!cerca(s0.projections[t - 1].saldoCredito, esperado, 0.001)) F(`2 · STR: el saldo del año ${t} no está en pesos de hoy`);
    }
    const ex = s.exitScenario;
    const vec = [-ex.inversionInicial, ...ps.slice(0, ex.yearVenta).map((p: any, i: number) => p.flujoOperacionalAnual + (i === ex.yearVenta - 1 ? ex.equityCLP : 0))];
    const tir = metricaValorONull(ex.tirAnual), tirV = irr(vec);
    if (tir == null || tirV == null || Math.abs(tir - tirV) > 0.02) F(`4 · STR: la TIR no es la de los flujos en pesos de hoy (${tir} vs ${tirV?.toFixed(2)})`);
  }

  // ── 5 · Una sola regla y los rótulos ─────────────────────────────────────
  const ltr = sinComentarios(leer("src/lib/analysis.ts"));
  const str = sinComentarios(leer("src/lib/engines/short-term-engine.ts"));
  if (/Math\.pow\(1 \+ (ARRIENDO_INFLACION|GGCC_INFLACION|INFLACION_UF)\b/.test(ltr) || /\*= \(1 \+ (ARRIENDO_INFLACION|GGCC_INFLACION)\)/.test(ltr)) F("5 · LTR: un término de la proyección crece a una tasa nominal");
  if (/Math\.pow\(1 \+ (REVENUE_INFLACION|COSTOS_INFLACION|DIVIDENDO_INFLACION)\b/.test(str)) F("5 · STR: un término de la proyección crece a una tasa nominal");
  if (/factorInflacion\(|factorValorNominal\(/.test(ltr + str)) F("5 · vuelve la conversión a pesos de cada año");
  const cap = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  const capStr = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  if (!/% real al año desde la compra/.test(cap) || !/% real al año desde la compra/.test(capStr)) F("5 · el valor de venta no dice que el 3% es real");
  const planilla = sinComentarios(leer("src/lib/planilla-calculo.ts"));
  if (/reajustado 3,5%/.test(planilla) || (planilla.match(/En pesos de hoy/g) ?? []).length < 2) F("5 · la planilla describe la proyección en pesos nominales");
  const hallazgo = sinComentarios(leer("src/lib/plusvalia-hallazgo.ts"));
  if (/inflaci[oó]n/i.test(hallazgo)) F("5 · el hallazgo de plusvalía compara la serie histórica (ya real) contra la inflación");

  if (fallas.length) {
    console.log(`  ✗ PESOS-DE-HOY · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — valor, saldo y flujos en pesos de hoy en LTR y STR: la cuota fija en UF, el arriendo +0,49% real, el valor con la plusvalía real, la TIR real y los rótulos en términos reales");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (29-sep-2026) ─────────────────────────────────────────────────────────
// 13/13 en rojo, restauradas byte a byte: M1 LTR el valor vuelve a pesos del año · M2 LTR el saldo
// en pesos del año · M3 LTR la cuota vuelve a crecer con la UF · M4 LTR el arriendo crece 3,5%
// nominal · M5 LTR la TIR deflacta flujos que ya son reales · M6 STR el valor en pesos del año · M7
// STR el saldo en pesos del año · M8 STR la cuota crece con la UF · M9 STR la TIR deflacta flujos
// reales · M10 el valor de venta vuelve a «3% al año» · M11 la planilla vuelve a pesos nominales ·
// M12 el hallazgo vuelve a «no le ganó a la inflación» · M13 crecimientoReal no descuenta la inflación.

if (require.main === module) {
  const { hard } = runPesosDeHoyTier();
  process.exit(hard ? 1 : 0);
}
