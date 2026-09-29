// ============================================================================
// GOLDEN · PLUSVALIA-NOMINAL (29-sep-2026) — catch-test
// ============================================================================
//   Las proyecciones de los dos motores están en pesos de cada año: el dividendo crece con la UF.
//   El valor del depto y el saldo del crédito tienen que ir en la MISMA moneda:
//   1 · VALOR: con plusvalía real 0 el depto sigue a la inflación (1,03^t), igual que el dividendo;
//       con la plusvalía estándar crece (1,03 × 1,03)^t. Antes crecía 1,03^t con 3% «real»:
//       ~0% real contra un dividendo inflado.
//   2 · SALDO: la deuda es en UF. Con tasa 0 el saldo en UF baja lineal; en pesos del año es eso
//       por 1,03^t. Antes quedaba en pesos del día 0.
//   3 · LTR y STR con la misma regla, y ningún `Math.pow(1 + plusvalia…, año)` suelto.
//   4 · LA TIR ES REAL, EN UF (29-sep-2026): cada flujo pasa a pesos de hoy antes de la TIR, así
//       que (1 + TIR real) = (1 + TIR de los flujos nominales) / 1,03. Es la que ve el informe y la
//       que puntúa.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/plusvalia-nominal-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcMetrics, calcProjections, runAnalysis } from "../../../src/lib/analysis";
import { calcIRR } from "../../../src/lib/finance/irr";
import { metricaValorONull } from "../../../src/lib/types";
import { calcShortTerm, type AirbnbData, type ShortTermInputs } from "../../../src/lib/engines/short-term-engine";
import { INFLACION_PROYECCION_ANUAL, PLUSVALIA_PROYECCION_ANUAL, factorInflacion, factorValorNominal } from "../../../src/lib/plusvalia-proyeccion";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const cerca = (a: number, b: number, tol = 0.002) => Math.abs(a / b - 1) <= tol;

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

export function runPlusvaliaNominalTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PLUSVALIA-NOMINAL (valor y saldo en pesos de cada año, como el dividendo · 0 tokens) ───");

  if (INFLACION_PROYECCION_ANUAL !== 0.03) F(`0 · la inflación de la proyección es ${INFLACION_PROYECCION_ANUAL}, no 3%`);
  if (!cerca(factorValorNominal(10), Math.pow(1.03 * 1.03, 10), 1e-9)) F("0 · factorValorNominal no compone la plusvalía real con la inflación");
  if (!cerca(factorInflacion(10), Math.pow(1.03, 10), 1e-9)) F("0 · factorInflacion no es 1,03^t");

  // ── 1 y 2 · LTR ──────────────────────────────────────────────────────────
  const seed: any = (GOLDEN_SEEDS as any[]).find((s) => s.input.estadoVenta !== "futura" && !s.input.fechaEntrega && s.input.piePct > 0 && s.input.piePct < 100);
  if (!seed) F("0 · no hay seed LTR inmediata con pie para medir");
  else {
    const inp = { ...seed.input };
    const metrics = calcMetrics(inp, GOLDEN_UF, undefined, GOLDEN_ASOF);
    const precioCLP = inp.precio * GOLDEN_UF;
    const sinPlusv = calcProjections({ input: inp, metrics, ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20, plusvaliaAnual: 0 });
    for (const t of [1, 5, 10]) {
      const p = sinPlusv[t - 1];
      if (!cerca(p.valorPropiedad / precioCLP, Math.pow(1.03, t))) F(`1 · LTR: con plusvalía real 0 el valor del año ${t} no sigue a la inflación (${(p.valorPropiedad / precioCLP).toFixed(4)} vs ${Math.pow(1.03, t).toFixed(4)})`);
    }
    // el dividendo del mismo motor crece 3%: la misma moneda
    if (!cerca(sinPlusv[5].dividendoAnual / sinPlusv[4].dividendoAnual, 1 + INFLACION_PROYECCION_ANUAL, 0.001)) F("1 · LTR: el dividendo no crece con la misma inflación que el valor");
    const std = calcProjections({ input: inp, metrics, ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20 });
    if (!cerca(std[9].valorPropiedad / precioCLP, Math.pow((1 + PLUSVALIA_PROYECCION_ANUAL) * 1.03, 10))) F("1 · LTR: el valor a 10 años no es la plusvalía real compuesta con la inflación");
    // saldo: con tasa 0 la deuda en UF baja lineal; en pesos del año, por 1,03^t
    const inp0 = { ...inp, tasaInteres: 0 };
    const m0 = calcMetrics(inp0, GOLDEN_UF, undefined, GOLDEN_ASOF);
    const p0 = calcProjections({ input: inp0, metrics: m0, ufClp: GOLDEN_UF, asOf: GOLDEN_ASOF, plazoVenta: 20 });
    const credito = precioCLP * (1 - inp.piePct / 100);
    const n = inp.plazoCredito * 12;
    for (const t of [1, 5, 10]) {
      const esperado = credito * (1 - (12 * t) / n) * Math.pow(1.03, t);
      if (!cerca(p0[t - 1].saldoCredito, esperado, 0.001)) F(`2 · LTR: el saldo del año ${t} no está en pesos del año (${p0[t - 1].saldoCredito} vs ${Math.round(esperado)})`);
    }
    // el informe completo usa la misma proyección
    const r: any = runAnalysis(inp, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
    if (!cerca(r.projections[9].valorPropiedad / precioCLP, Math.pow(1.03 * 1.03, 10))) F("1 · LTR: runAnalysis no proyecta el valor con la regla nueva");
  }

  // ── 1 y 2 · STR ──────────────────────────────────────────────────────────
  const s = calcShortTerm(strBase(), new Date("2026-01-01T00:00:00Z"));
  const ps = s.projections ?? [];
  if (ps.length < 10) F("1 · STR: sin proyección a 10 años");
  else {
    if (!cerca(ps[9].valorDepto / 160_000_000, Math.pow(1.03 * 1.03, 10))) F(`1 · STR: el valor a 10 años no es la plusvalía real compuesta con la inflación (${(ps[9].valorDepto / 160_000_000).toFixed(4)})`);
    const s0 = calcShortTerm(strBase({ tasaCredito: 0 }), new Date("2026-01-01T00:00:00Z"));
    const credito = 160_000_000 * 0.8;
    for (const t of [1, 5, 10]) {
      const esperado = credito * (1 - (12 * t) / (25 * 12)) * Math.pow(1.03, t);
      const real = (s0.projections ?? [])[t - 1]?.saldoCredito ?? NaN;
      if (!cerca(real, esperado, 0.001)) F(`2 · STR: el saldo del año ${t} no está en pesos del año (${real} vs ${Math.round(esperado)})`);
    }
  }

  // ── 4 · La TIR real ──────────────────────────────────────────────────────
  const tirNominal = (flujos0: number, anuales: number[], extra: number) => {
    const v = [-flujos0, ...anuales.map((f, i) => (i === anuales.length - 1 ? f + extra : f))];
    const r: any = calcIRR(v);
    return r?.ok ? r.rate * 100 : null;
  };
  if (seed) {
    const r: any = runAnalysis({ ...seed.input }, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
    const ex = r.exitScenario;
    const nom = tirNominal(ex.inversionInicial, r.projections.slice(0, 10).map((p: any) => p.flujoAnual), ex.equityCLP);
    const real = metricaValorONull(ex.tir);
    if (nom == null || real == null) F("4 · LTR: la seed no tiene TIR para medir");
    else if (Math.abs((1 + real / 100) - (1 + nom / 100) / (1 + INFLACION_PROYECCION_ANUAL)) > 0.0006) F(`4 · LTR: la TIR del informe no es real (${real.toFixed(2)}% contra nominal ${nom.toFixed(2)}%: real esperada ${(((1 + nom / 100) / 1.03 - 1) * 100).toFixed(2)}%)`);
    if (real != null && r.desglose && typeof r.desglose.tir !== "number" && typeof r.desglose.tir !== "object") F("4 · LTR: el puntaje no expone la dimensión TIR");
  }
  {
    const s: any = calcShortTerm(strBase(), new Date("2026-01-01T00:00:00Z"));
    const ex = s.exitScenario;
    const nom = tirNominal(ex.inversionInicial, (s.projections ?? []).slice(0, ex.yearVenta).map((p: any) => p.flujoOperacionalAnual), ex.equityCLP);
    const real = metricaValorONull(ex.tirAnual);
    if (nom == null || real == null) F("4 · STR: sin TIR para medir");
    else if (Math.abs((1 + real / 100) - (1 + nom / 100) / (1 + INFLACION_PROYECCION_ANUAL)) > 0.0006) F(`4 · STR: la TIR no es real (${real.toFixed(2)}% contra nominal ${nom.toFixed(2)}%)`);
  }

  // ── 3 · Una sola regla ───────────────────────────────────────────────────
  const ltr = sinComentarios(leer("src/lib/analysis.ts"));
  const str = sinComentarios(leer("src/lib/engines/short-term-engine.ts"));
  if (/Math\.pow\(1 \+ plusvaliaAnual/.test(ltr) || /Math\.pow\(1 \+ plusvaliaAnual/.test(str)) F("3 · queda un `Math.pow(1 + plusvaliaAnual, año)` suelto: plusvalía real sobre pesos nominales");
  if (!/const INFLACION_UF = INFLACION_PROYECCION_ANUAL;/.test(ltr)) F("3 · LTR: la inflación del dividendo no es la misma constante que la del valor");

  if (fallas.length) {
    console.log(`  ✗ PLUSVALIA-NOMINAL · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — valor y saldo en pesos de cada año en LTR y STR, y la TIR real (en UF): la plusvalía real se compone con la inflación del dividendo, la deuda en UF se convierte con la UF del año y cada flujo vuelve a pesos de hoy antes de la TIR");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (29-sep-2026) ─────────────────────────────────────────────────────────
// 8/8 en rojo, restauradas byte a byte: M1 LTR vuelve a 1,03^año sobre pesos nominales · M2 LTR
// saldo en pesos del día 0 · M3 STR vuelve a 1,03^año · M4 STR saldo en pesos del día 0 · M5
// factorValorNominal sin inflación · M6 inflación del valor distinta a la del dividendo · M7 el
// dividendo con otra constante · M8 el saldo inflado un año de más.
// TIR real (29-sep, segunda pasada), 3/3 en rojo: M9 LTR vuelve a la TIR nominal · M10 STR vuelve
// a la TIR nominal · M11 LTR deflacta un año corto.

if (require.main === module) {
  const { hard } = runPlusvaliaNominalTier();
  process.exit(hard ? 1 : 0);
}
