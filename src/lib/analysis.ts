import type {
  AnalisisInput,
  AnalysisMetrics,
  MonthlyCashflow,
  YearProjection,
  ExitScenario,
  RefinanceScenario,
  SensitivityRow,
  Desglose,
  FullAnalysisResult,
} from "./types";

// Dynamic UF value — set via setUFValue() before calling runAnalysis()
let UF_CLP = 38800;

export function setUFValue(value: number) {
  UF_CLP = value;
}

export function getUFCLP(): number {
  return UF_CLP;
}
export function getMantencionRate(antiguedad: number): number {
  if (antiguedad <= 2) return 0.003;
  if (antiguedad <= 5) return 0.005;
  if (antiguedad <= 10) return 0.008;
  if (antiguedad <= 15) return 0.01;
  if (antiguedad <= 20) return 0.013;
  return 0.015;
}

const PLUSVALIA_ANUAL = 0.04;
const ARRIENDO_INFLACION = 0.035;
const GGCC_INFLACION = 0.03;
const INFLACION_UF = 0.03; // UF tracks inflation ~3%/yr — dividendo in CLP grows at this rate
const COMISION_VENTA = 0.02;
const GASTOS_CIERRE_PCT = 0.02; // ~2% of purchase price (notaría, CBR, timbres, tasación)

// =========================================
// Helpers
// =========================================

function calcDividendo(creditoCLP: number, tasaAnual: number, plazoAnos: number): number {
  if (creditoCLP <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(creditoCLP / n);
  return Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function saldoCredito(creditoInicial: number, tasaAnual: number, plazoAnos: number, mesActual: number): number {
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return creditoInicial * (1 - mesActual / n);
  const dividendo = (creditoInicial * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  return creditoInicial * Math.pow(1 + tasaMensual, mesActual) -
    dividendo * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual);
}

function calcTIR(flujos: number[], guess: number = 0.1): number {
  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < flujos.length; i++) {
      npv += flujos[i] / Math.pow(1 + rate, i);
      dnpv -= (i * flujos[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(npv) < 1) break;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
    if (rate < -0.99) rate = -0.5;
    if (rate > 10) rate = 1;
  }
  return rate;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// =========================================
// Ingreso mensual
// =========================================

function calcIngresoMensual(input: AnalisisInput): number {
  // Use the rent exactly as the user entered it — no silent adjustments.
  // Floor (piso) is still used in the score calculation (plusvalía dimension).
  return input.arriendo;
}

// =========================================
// Flujo Neto Centralizado
// =========================================

export interface FlujoDesglose {
  arriendo: number;
  dividendo: number;
  ggccVacancia: number;
  contribucionesMes: number;
  mantencion: number;
  vacanciaProrrata: number;
  corretajeProrrata: number;
  recambio: number;
  administracion: number;
  totalEgresos: number;
  flujoNeto: number;
}

/**
 * Función centralizada para calcular el flujo neto mensual estabilizado.
 * TODOS los componentes de la app deben usar esta función para evitar discrepancias.
 */
export function calcFlujoDesglose(datos: {
  arriendo: number;
  dividendo: number;
  ggcc: number;
  contribuciones: number;
  mantencion: number;
  vacanciaMeses: number;
  usaAdministrador?: boolean;
  comisionAdministrador?: number;
}): FlujoDesglose {
  const arriendo = datos.arriendo;
  const dividendo = datos.dividendo;
  const ggccVacancia = Math.round((datos.ggcc * datos.vacanciaMeses) / 12);
  const contribucionesMes = Math.round(datos.contribuciones / 3);
  const mantencion = datos.mantencion;
  const vacanciaProrrata = Math.round((datos.arriendo * datos.vacanciaMeses) / 12);
  const corretajeProrrata = Math.round((datos.arriendo * 0.5) / 24);
  const recambio = Math.round(250000 / 24);
  // Administración: % del arriendo, prorrateado por meses con arrendatario
  const administracion = datos.usaAdministrador
    ? Math.round((datos.arriendo * (datos.comisionAdministrador ?? 7) / 100) * (12 - datos.vacanciaMeses) / 12)
    : 0;

  const totalEgresos = dividendo + ggccVacancia + contribucionesMes + mantencion + vacanciaProrrata + corretajeProrrata + recambio + administracion;
  const flujoNeto = arriendo - totalEgresos;

  return { arriendo, dividendo, ggccVacancia, contribucionesMes, mantencion, vacanciaProrrata, corretajeProrrata, recambio, administracion, totalEgresos, flujoNeto };
}

// =========================================
// Core Metrics
// =========================================

function calcMesesHastaEntrega(input: AnalisisInput): number {
  if (input.estadoVenta === "inmediata" || !input.fechaEntrega) return 0;
  const [anio, mes] = input.fechaEntrega.split("-").map(Number);
  if (!anio || !mes) return 0;
  const now = new Date();
  const entrega = new Date(anio, mes - 1);
  return Math.max(0, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
}

function calcMetrics(input: AnalisisInput): AnalysisMetrics {
  // Add optional parking price to total
  let precioTotal = input.precio;
  if (input.estacionamiento === "opcional" && input.precioEstacionamiento > 0) {
    precioTotal += input.precioEstacionamiento;
  }

  const precioCLP = precioTotal * UF_CLP;

  // Auto-calculate defaults for fields left at 0
  if (!input.provisionMantencion) input.provisionMantencion = Math.round((precioCLP * getMantencionRate(input.antiguedad)) / 12);
  if (!input.contribuciones) input.contribuciones = Math.round((precioCLP * 0.0065 * 0.011) / 4 * 100) > 0 ? Math.round(precioCLP * 0.65 * 0.011 / 4) : 0;
  if (!input.gastos) input.gastos = Math.round(input.superficie * 1200);

  const piePct = input.piePct / 100;
  const pieCLP = precioCLP * piePct;
  const creditoCLP = precioCLP * (1 - piePct);
  const dividendo = calcDividendo(creditoCLP, input.tasaInteres, input.plazoCredito);
  const precioM2 = input.superficie > 0 ? precioTotal / input.superficie : 0;

  const ingresoMensual = calcIngresoMensual(input);

  // Usar función centralizada para flujo neto
  const flujo = calcFlujoDesglose({
    arriendo: ingresoMensual,
    dividendo,
    ggcc: input.gastos,
    contribuciones: input.contribuciones,
    mantencion: input.provisionMantencion,
    vacanciaMeses: input.vacanciaMeses,
    usaAdministrador: input.usaAdministrador,
    comisionAdministrador: input.comisionAdministrador,
  });

  const egresosMensuales = flujo.totalEgresos;
  const flujoNetoMensual = flujo.flujoNeto;

  // Rentabilidad Bruta: arriendo anual / precio (sin descontar nada)
  const rentaAnual = ingresoMensual * 12;
  const rentabilidadBruta = precioCLP > 0 ? (rentaAnual / precioCLP) * 100 : 0;

  // Rentabilidad Operativa (CAP Rate): solo gastos operativos directos (NO incluye administración)
  const gastosOperativosAnuales = (flujo.ggccVacancia + flujo.contribucionesMes + flujo.mantencion) * 12;
  const noi = rentaAnual - gastosOperativosAnuales;
  const capRate = precioCLP > 0 ? (noi / precioCLP) * 100 : 0;

  // Rentabilidad Neta: TODOS los gastos (operativos + vacancia + corretaje + recambio + administración)
  const todosGastosAnuales = (flujo.ggccVacancia + flujo.contribucionesMes + flujo.mantencion + flujo.vacanciaProrrata + flujo.corretajeProrrata + flujo.recambio + flujo.administracion) * 12;
  const rentabilidadNeta = precioCLP > 0 ? ((rentaAnual - todosGastosAnuales) / precioCLP) * 100 : 0;

  // Cash-on-Cash: pie + closing costs + pre-delivery installments
  const mesesPreEntrega = calcMesesHastaEntrega(input);
  const cuotasPieTotal = mesesPreEntrega > 0 ? (input.cuotasPie > 0 ? input.cuotasPie : mesesPreEntrega) * (input.montoCuota > 0 ? input.montoCuota : (pieCLP / (input.cuotasPie || mesesPreEntrega))) : 0;
  const gastosCompra = Math.round(precioCLP * GASTOS_CIERRE_PCT);
  const capitalInvertido = pieCLP + cuotasPieTotal + gastosCompra;
  const cashOnCash = capitalInvertido > 0 ? ((flujoNetoMensual * 12) / capitalInvertido) * 100 : 0;
  const mesesPaybackPie = flujoNetoMensual > 0 ? Math.round(capitalInvertido / flujoNetoMensual) : 999;

  return {
    rentabilidadBruta: Math.round(rentabilidadBruta * 100) / 100,
    rentabilidadNeta: Math.round(rentabilidadNeta * 100) / 100,
    capRate: Math.round(capRate * 100) / 100,
    cashOnCash: Math.round(cashOnCash * 100) / 100,
    precioM2: Math.round(precioM2 * 10) / 10,
    mesesPaybackPie: mesesPaybackPie,
    dividendo,
    flujoNetoMensual,
    noi,
    pieCLP,
    precioCLP,
    ingresoMensual,
    egresosMensuales,
  };
}

// =========================================
// Cashflow Year 1 (month by month)
// =========================================

function calcCashflowYear1(input: AnalisisInput, metrics: AnalysisMetrics): MonthlyCashflow[] {
  const mantencion = input.provisionMantencion;

  // Determine months until delivery (en blanco/verde)
  const mesesPreEntrega = calcMesesHastaEntrega(input);

  const meses: MonthlyCashflow[] = [];

  // T0: siempre presente, sin pie (el pie es inversión de capital, no flujo operativo)
  meses.push({
    mes: 0, ingreso: 0, dividendo: 0, gastos: 0,
    contribuciones: 0, mantencion: 0, vacancia: 0, corretaje: 0, administracion: 0,
    egresoTotal: 0, flujoNeto: 0, acumulado: 0,
  });

  let acumulado = 0;

  // Usar calcFlujoDesglose para todos los meses — vacancia, GGCC, corretaje y recambio prorrateados
  const flujo = calcFlujoDesglose({
    arriendo: metrics.ingresoMensual,
    dividendo: metrics.dividendo,
    ggcc: input.gastos,
    contribuciones: input.contribuciones,
    mantencion,
    vacanciaMeses: input.vacanciaMeses,
    usaAdministrador: input.usaAdministrador,
    comisionAdministrador: input.comisionAdministrador,
  });

  if (input.estadoVenta !== "inmediata" && mesesPreEntrega > 0) {
    const mesesOperativos = Math.max(0, 12 - mesesPreEntrega);
    for (let i = 1; i <= mesesOperativos; i++) {
      acumulado += flujo.flujoNeto;
      meses.push({
        mes: mesesPreEntrega + i,
        ingreso: flujo.arriendo,
        dividendo: flujo.dividendo,
        gastos: flujo.ggccVacancia,
        contribuciones: flujo.contribucionesMes,
        mantencion: flujo.mantencion,
        vacancia: flujo.vacanciaProrrata,
        corretaje: flujo.corretajeProrrata + flujo.recambio,
        administracion: flujo.administracion,
        egresoTotal: flujo.totalEgresos,
        flujoNeto: flujo.flujoNeto,
        acumulado,
      });
    }
  } else {
    for (let i = 1; i <= 12; i++) {
      acumulado += flujo.flujoNeto;
      meses.push({
        mes: i,
        ingreso: flujo.arriendo,
        dividendo: flujo.dividendo,
        gastos: flujo.ggccVacancia,
        contribuciones: flujo.contribucionesMes,
        mantencion: flujo.mantencion,
        vacancia: flujo.vacanciaProrrata,
        corretaje: flujo.corretajeProrrata + flujo.recambio,
        administracion: flujo.administracion,
        egresoTotal: flujo.totalEgresos,
        flujoNeto: flujo.flujoNeto,
        acumulado,
      });
    }
  }

  return meses;
}

// =========================================
// Multi-year Projections
// =========================================

function calcProjections(input: AnalisisInput, metrics: AnalysisMetrics, maxYears: number = 20): YearProjection[] {
  const precioCLP = input.precio * UF_CLP;
  const creditoCLP = precioCLP * (1 - input.piePct / 100);

  const mesesPreEntrega = calcMesesHastaEntrega(input);

  let arriendoActual = metrics.ingresoMensual;
  let gastosActual = input.gastos;
  let contribucionesActual = input.contribuciones;
  // Plusvalía starts from purchase date (even during construction)
  let valorPropiedad = precioCLP;
  // Flujo operativo: no incluye inversión inicial (pie) ni cuotas pre-entrega
  let flujoAcumulado = 0;

  const projections: YearProjection[] = [];

  for (let anio = 1; anio <= maxYears; anio++) {
    const mesInicio = (anio - 1) * 12 + 1;
    const mesFin = anio * 12;

    // Mantención crece por antigüedad + inflación de costos
    const antiguedadActual = input.antiguedad + anio;
    const mantencionBase = Math.round((precioCLP * getMantencionRate(antiguedadActual)) / 12);
    const mantencionAnual = Math.round(mantencionBase * Math.pow(1 + GGCC_INFLACION, anio - 1));

    // Dividendo in UF is constant, but in CLP it grows with UF (≈ inflation)
    const dividendoAnio = Math.round(metrics.dividendo * Math.pow(1 + INFLACION_UF, anio - 1));

    // Usar función centralizada para costos recurrentes del mes
    const flujoMes = calcFlujoDesglose({
      arriendo: arriendoActual,
      dividendo: dividendoAnio,
      ggcc: gastosActual,
      contribuciones: contribucionesActual,
      mantencion: mantencionAnual,
      vacanciaMeses: input.vacanciaMeses,
      usaAdministrador: input.usaAdministrador,
      comisionAdministrador: input.comisionAdministrador,
    });

    let flujoAnual = 0;
    for (let m = mesInicio; m <= mesFin; m++) {
      if (m <= mesesPreEntrega) {
        // Pre-delivery: sin flujo operativo
      } else {
        flujoAnual += flujoMes.flujoNeto;
      }
    }

    flujoAcumulado += flujoAnual;
    // Plusvalía always from purchase date
    valorPropiedad *= (1 + PLUSVALIA_ANUAL);
    // Mortgage only counts from delivery
    const mesesCredito = Math.max(0, mesFin - mesesPreEntrega);
    const saldo = mesesCredito > 0
      ? Math.max(0, saldoCredito(creditoCLP, input.tasaInteres, input.plazoCredito, mesesCredito))
      : creditoCLP;
    const patrimonioNeto = valorPropiedad - saldo;

    projections.push({
      anio,
      arriendoMensual: Math.round(arriendoActual),
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(flujoAcumulado),
      valorPropiedad: Math.round(valorPropiedad),
      saldoCredito: Math.round(saldo),
      patrimonioNeto: Math.round(patrimonioNeto),
    });

    // Apply inflation for next year (only for post-delivery periods)
    if (mesFin > mesesPreEntrega) {
      arriendoActual *= (1 + ARRIENDO_INFLACION);
      gastosActual *= (1 + GGCC_INFLACION);
      contribucionesActual *= (1 + GGCC_INFLACION);
    }
  }

  return projections;
}

// =========================================
// Exit Scenario
// =========================================

function calcExitScenario(input: AnalisisInput, metrics: AnalysisMetrics, projections: YearProjection[], anios: number = 10): ExitScenario {
  const proy = projections[anios - 1];
  if (!proy) {
    return { anios, valorVenta: 0, saldoCredito: 0, comisionVenta: 0, gananciaNeta: 0, flujoAcumulado: 0, retornoTotal: 0, multiplicadorCapital: 0, tir: 0 };
  }

  const valorVenta = proy.valorPropiedad;
  const comisionVenta = Math.round(valorVenta * COMISION_VENTA);
  const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
  const retornoTotal = proy.flujoAcumulado + gananciaNeta;

  // Inversión real = pie + gastos de cierre (notaría, CBR, timbres, tasación)
  const gastosCompra = Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);
  const inversionTotal = metrics.pieCLP + gastosCompra;
  const multiplicadorCapital = inversionTotal > 0 ? Math.round((retornoTotal / inversionTotal) * 100) / 100 : 0;

  // TIR: initial investment includes closing costs
  const flujos: number[] = [-inversionTotal];
  for (let i = 0; i < anios; i++) {
    let flujo = projections[i].flujoAnual;
    if (i === anios - 1) {
      flujo += valorVenta - proy.saldoCredito - comisionVenta;
    }
    flujos.push(flujo);
  }
  const tir = Math.round(calcTIR(flujos, 0.1) * 10000) / 100;

  return {
    anios,
    valorVenta: Math.round(valorVenta),
    saldoCredito: Math.round(proy.saldoCredito),
    comisionVenta,
    gananciaNeta: Math.round(gananciaNeta),
    flujoAcumulado: proy.flujoAcumulado,
    retornoTotal: Math.round(retornoTotal),
    multiplicadorCapital,
    tir,
  };
}

// =========================================
// Refinance Scenario
// =========================================

function calcRefinanceScenario(input: AnalisisInput, metrics: AnalysisMetrics, projections: YearProjection[], anios: number = 5): RefinanceScenario {
  const proy = projections[Math.min(anios - 1, projections.length - 1)];
  const nuevoAvaluo = proy.valorPropiedad;
  const nuevoCredito = Math.round(nuevoAvaluo * 0.80);
  const capitalLiberado = nuevoCredito - proy.saldoCredito;
  const nuevoDividendo = calcDividendo(nuevoCredito, input.tasaInteres, input.plazoCredito);
  const refi = calcFlujoDesglose({
    arriendo: proy.arriendoMensual,
    dividendo: nuevoDividendo,
    ggcc: input.gastos,
    contribuciones: input.contribuciones,
    mantencion: input.provisionMantencion,
    vacanciaMeses: input.vacanciaMeses,
    usaAdministrador: input.usaAdministrador,
    comisionAdministrador: input.comisionAdministrador,
  });
  const nuevoFlujoNeto = refi.flujoNeto;

  return {
    nuevoAvaluo: Math.round(nuevoAvaluo),
    nuevoCredito,
    capitalLiberado: Math.round(capitalLiberado),
    nuevoDividendo,
    nuevoFlujoNeto: Math.round(nuevoFlujoNeto),
  };
}

// =========================================
// Sensitivity Analysis
// =========================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calcSensitivity(input: AnalisisInput, baseScore: number, _baseMetrics: AnalysisMetrics): SensitivityRow[] {
  const rows: SensitivityRow[] = [];

  const variations: { variable: string; field: keyof AnalisisInput; delta: number; label: string }[] = [
    { variable: "Tasa interés", field: "tasaInteres", delta: 1, label: "+1%" },
    { variable: "Tasa interés", field: "tasaInteres", delta: -1, label: "-1%" },
    { variable: "Arriendo", field: "arriendo", delta: 0.10, label: "+10%" },
    { variable: "Arriendo", field: "arriendo", delta: -0.10, label: "-10%" },
    { variable: "Vacancia", field: "vacanciaMeses", delta: 1, label: "+1 mes" },
    { variable: "Vacancia", field: "vacanciaMeses", delta: 2, label: "+2 meses" },
  ];

  for (const v of variations) {
    const modified = { ...input };
    if (v.field === "tasaInteres") {
      (modified as Record<string, unknown>)[v.field] = (input[v.field] as number) + v.delta;
    } else if (v.field === "arriendo") {
      (modified as Record<string, unknown>)[v.field] = Math.round((input[v.field] as number) * (1 + v.delta));
    } else if (v.field === "vacanciaMeses") {
      (modified as Record<string, unknown>)[v.field] = (input[v.field] as number) + v.delta;
    }

    const newMetrics = calcMetrics(modified);
    const newScore = calcScoreFromMetrics(modified, newMetrics);

    rows.push({
      variable: v.variable,
      variacion: v.label,
      nuevoScore: newScore,
      nuevoFlujo: newMetrics.flujoNetoMensual,
      delta: newScore - baseScore,
    });
  }

  return rows;
}

// =========================================
// Break-even & Max Purchase
// =========================================

function calcBreakEvenTasa(input: AnalisisInput, currentMetrics: AnalysisMetrics): number {
  // If flow is already negative, search downward to find where flow = 0
  // If flow is positive, search upward
  if (currentMetrics.flujoNetoMensual <= 0) {
    // Already negative: search downward from current rate
    for (let tasa = input.tasaInteres; tasa >= 0; tasa -= 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified);
      if (m.flujoNetoMensual >= 0) return Math.round(tasa * 100) / 100;
    }
    return -1; // Flow is negative even at 0% rate
  } else {
    // Positive: search upward for where flow becomes negative
    for (let tasa = input.tasaInteres; tasa <= 15; tasa += 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified);
      if (m.flujoNetoMensual <= 0) return Math.round(tasa * 100) / 100;
    }
    return 15;
  }
}

function calcValorMaximoCompra(input: AnalisisInput, metrics: AnalysisMetrics): number {
  // NOI / target CAP rate = max property value in CLP, then convert to UF
  const targetCapRate = 0.05; // 5% target
  const noi = metrics.noi;
  if (noi <= 0) return 0;
  const maxCLP = noi / targetCapRate;
  return Math.round(maxCLP / UF_CLP);
}

// =========================================
// Franco Score Calculation
// =========================================

const COMUNAS_PREMIUM = [
  "providencia", "las condes", "vitacura", "lo barnechea", "ñuñoa",
  "la reina", "santiago centro", "viña del mar", "con con",
];

// Granular plusvalía base scores by comuna
const PLUSVALIA_COMUNA: Record<string, number> = {
  "vitacura": 95, "lo barnechea": 95,
  "las condes": 90, "providencia": 90,
  "ñuñoa": 82, "la reina": 82,
  "san miguel": 70, "macul": 70, "la florida": 70,
  "santiago centro": 60,
  "estación central": 55, "estacion central": 55, "independencia": 55, "recoleta": 55,
  "quinta normal": 45, "pedro aguirre cerda": 45, "san joaquín": 45, "san joaquin": 45,
};

// Eficiencia de compra: mide si compras bien respecto al mercado
import { SEED_MARKET_DATA } from "./market-seed";

function calcEficienciaScore(input: AnalisisInput, metrics: AnalysisMetrics): number {
  const tipo = input.dormitorios <= 1 ? "1D" : input.dormitorios === 2 ? "2D" : "3D";
  const seed = SEED_MARKET_DATA.find((d) => d.comuna === input.comuna && d.tipo === tipo);
  if (!seed) return 50; // Sin datos → neutro

  // a) Precio/m² vs promedio zona (50%)
  const precioM2Zona = seed.precio_m2_venta_promedio * UF_CLP; // convertir UF/m² a CLP/m²
  const precioM2Prop = metrics.precioM2 * UF_CLP;
  const ratioPrecio = precioM2Zona > 0 ? precioM2Prop / precioM2Zona : 1;
  let scorePrecio: number;
  if (ratioPrecio < 0.85) scorePrecio = lerp(ratioPrecio, 0.70, 0.85, 100, 90);
  else if (ratioPrecio < 0.95) scorePrecio = lerp(ratioPrecio, 0.85, 0.95, 89, 70);
  else if (ratioPrecio < 1.05) scorePrecio = lerp(ratioPrecio, 0.95, 1.05, 69, 50);
  else if (ratioPrecio < 1.15) scorePrecio = lerp(ratioPrecio, 1.05, 1.15, 49, 30);
  else scorePrecio = lerp(ratioPrecio, 1.15, 1.40, 29, 10);

  // b) Rentabilidad bruta vs promedio zona (50%)
  const supPromedio = tipo === "1D" ? 35 : tipo === "2D" ? 50 : 70;
  const yieldZona = (precioM2Zona > 0 && supPromedio > 0)
    ? (seed.arriendo_promedio * 12) / (precioM2Zona * supPromedio) * 100
    : 4.0;
  const ratioYield = yieldZona > 0 ? metrics.rentabilidadBruta / yieldZona : 1;
  let scoreYield: number;
  if (ratioYield > 1.20) scoreYield = lerp(ratioYield, 1.20, 1.50, 90, 100);
  else if (ratioYield > 1.05) scoreYield = lerp(ratioYield, 1.05, 1.20, 70, 89);
  else if (ratioYield > 0.95) scoreYield = lerp(ratioYield, 0.95, 1.05, 50, 69);
  else if (ratioYield > 0.80) scoreYield = lerp(ratioYield, 0.80, 0.95, 30, 49);
  else scoreYield = lerp(ratioYield, 0.50, 0.80, 10, 29);

  return clamp(Math.round(scorePrecio * 0.5 + scoreYield * 0.5), 0, 100);
}

// Comunas with oversupply risk
const COMUNAS_OVERSUPPLY = [
  "santiago centro", "estación central", "estacion central", "independencia",
];

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + clamp(t, 0, 1) * (outMax - outMin);
}

function lookupComuna(comuna: string, table: Record<string, number>, defaultVal: number): number {
  const c = comuna.toLowerCase().trim();
  if (table[c] !== undefined) return table[c];
  // Partial match for compound names
  for (const key of Object.keys(table)) {
    if (c.includes(key) || key.includes(c)) return table[key];
  }
  return defaultVal;
}

function calcScoreFromMetrics(input: AnalisisInput, metrics: AnalysisMetrics): number {
  // Rentabilidad (30%): based on rentabilidad bruta calibrated for Chilean market
  // >6% = 90-100, 5-6% = 70-89, 4-5% = 45-65, 3-4% = 25-44, <3% = 0-24
  let rentabilidad: number;
  const yb = metrics.rentabilidadBruta;
  if (yb >= 6) rentabilidad = lerp(yb, 6, 8, 90, 100);
  else if (yb >= 5) rentabilidad = lerp(yb, 5, 6, 70, 89);
  else if (yb >= 4) rentabilidad = lerp(yb, 4, 5, 45, 65);
  else if (yb >= 3) rentabilidad = lerp(yb, 3, 4, 25, 44);
  else rentabilidad = lerp(yb, 0, 3, 0, 24);
  // Rentabilidad neta bonus/penalty
  if (metrics.rentabilidadNeta >= 4) rentabilidad = Math.min(100, rentabilidad + 5);
  else if (metrics.rentabilidadNeta < 2) rentabilidad = Math.max(0, rentabilidad - 5);
  rentabilidad = clamp(rentabilidad, 0, 100);

  // Flujo de caja (25%): calibrated for Chilean market with 80% financing at ~4.72%
  // Positive = 80-100, -0 to -200K = 50-79, -200K to -400K = 25-49, -400K to -600K = 10-24, <-600K = 0-9
  let flujoCaja: number;
  const flujo = metrics.flujoNetoMensual;
  if (flujo >= 0) flujoCaja = lerp(flujo, 0, 200000, 80, 100);
  else if (flujo >= -200000) flujoCaja = lerp(flujo, -200000, 0, 50, 79);
  else if (flujo >= -400000) flujoCaja = lerp(flujo, -400000, -200000, 25, 49);
  else if (flujo >= -600000) flujoCaja = lerp(flujo, -600000, -400000, 10, 24);
  else flujoCaja = lerp(flujo, -1000000, -600000, 0, 9);
  flujoCaja = clamp(flujoCaja, 0, 100);

  // Plusvalía (20%): granular by comuna
  const plusvaliaComuna = lookupComuna(input.comuna, PLUSVALIA_COMUNA, 50);
  const precioM2 = metrics.precioM2;
  // High price/m² in premium zones = overpaying premium → lower score
  // In normal zones, wider swing allowed
  const precioAdj = plusvaliaComuna >= 80
    ? lerp(precioM2, 30, 120, 5, -15)
    : lerp(precioM2, 30, 100, 12, -12);
  let plusvalia = plusvaliaComuna + precioAdj;
  if (input.enConstruccion || input.antiguedad <= 2) plusvalia += 10;
  else if (input.antiguedad >= 3 && input.antiguedad <= 8) plusvalia += 5;
  else if (input.antiguedad > 20) plusvalia -= 15;
  if (input.piso >= 10) plusvalia += 5;
  else if (input.piso <= 2 && input.piso > 0) plusvalia -= 3;
  plusvalia = clamp(plusvalia, 0, 100);

  // Riesgo (15%): granular with more factors
  const isOversupply = COMUNAS_OVERSUPPLY.some((c) => input.comuna.toLowerCase().includes(c));
  let riesgo = 50;
  if (input.tipo.toLowerCase().includes("departamento")) riesgo += 10;
  if (input.antiguedad < 10 || input.enConstruccion) riesgo += 10;
  else if (input.antiguedad > 25) riesgo -= 15;
  if (metrics.capRate > 3) riesgo += 8;
  if (isOversupply) riesgo -= 5;
  const ratioGastosIngreso = metrics.ingresoMensual > 0 ? metrics.egresosMensuales / metrics.ingresoMensual : 2;
  if (ratioGastosIngreso > 1) riesgo -= 8;
  else if (ratioGastosIngreso > 0.8) riesgo -= 5;
  if (input.vacanciaMeses > 1) riesgo -= 3;
  riesgo = clamp(riesgo, 10, 95);

  // Eficiencia de compra (10%): precio y yield vs mercado
  const eficiencia = calcEficienciaScore(input, metrics);

  let score = Math.round(
    rentabilidad * 0.30 +
    flujoCaja * 0.25 +
    plusvalia * 0.20 +
    riesgo * 0.15 +
    eficiencia * 0.10
  );

  // Penalize verde/blanco for months without return
  const mesesEspera = calcMesesHastaEntrega(input);
  if (mesesEspera > 0) {
    // -1 point per 6 months of waiting, max -5
    const penalty = Math.min(5, Math.round(mesesEspera / 6));
    score -= penalty;
  }

  return clamp(score, 0, 100);
}

function getClasificacion(score: number): { clasificacion: string; color: string } {
  if (score >= 80) return { clasificacion: "Excelente", color: "positive" };
  if (score >= 65) return { clasificacion: "Buena", color: "blue" };
  if (score >= 50) return { clasificacion: "Regular", color: "yellow" };
  if (score >= 30) return { clasificacion: "Débil", color: "orange" };
  return { clasificacion: "Evitar", color: "red" };
}

// =========================================
// Pros & Contras
// =========================================

function generatePros(input: AnalisisInput, metrics: AnalysisMetrics): string[] {
  const pros: string[] = [];
  const fmtP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

  if (metrics.capRate >= 4)
    pros.push(`La rentabilidad operativa (CAP rate ${metrics.capRate.toFixed(1)}%) supera el promedio del mercado. Buena relación entre lo que produce y lo que cuesta.`);
  if (metrics.rentabilidadBruta >= 5)
    pros.push(`El arriendo representa un ${metrics.rentabilidadBruta.toFixed(1)}% anual del precio, sobre el promedio chileno (~4%). Buen precio de compra para la renta que genera.`);
  if (metrics.flujoNetoMensual > 0)
    pros.push(`Después de pagar dividendo, gastos y todos los costos, te sobran ${fmtP(metrics.flujoNetoMensual)} al mes. La propiedad se paga sola.`);
  if (metrics.cashOnCash > 5)
    pros.push(`Tu pie renta un ${metrics.cashOnCash.toFixed(1)}% anual (cash-on-cash), mejor que la mayoría de las alternativas de renta fija.`);
  if (input.enConstruccion || input.antiguedad <= 2) {
    pros.push("Al ser nueva o casi nueva, los costos de mantención serán bajos por varios años. Menos sorpresas.");
  } else if (input.antiguedad >= 3 && input.antiguedad <= 8) {
    pros.push("Con pocos años de uso, la mantención debiera ser baja. Los gastos grandes (ascensores, fachada) aún están lejos.");
  }
  if (COMUNAS_PREMIUM.some((c) => input.comuna.toLowerCase().includes(c)))
    pros.push("Zona con alta demanda de arriendo. Menos riesgo de vacancia y mejor potencial de plusvalía.");
  if (metrics.precioM2 < 50)
    pros.push(`A ${metrics.precioM2.toFixed(1)} UF/m², el precio por metro cuadrado está bajo el promedio. Hay margen para que suba de valor.`);
  const inputAny = input as unknown as Record<string, unknown>;
  const nBodegas = inputAny.cantidadBodegas as number | undefined;
  const nEstacs = inputAny.cantidadEstacionamientos as number | undefined;
  if (nBodegas && nBodegas > 0) {
    pros.push(`Incluye ${nBodegas} bodega${nBodegas > 1 ? "s" : ""}, lo que permite cobrar más arriendo y hace la propiedad más atractiva para familias.`);
  } else if (input.bodega) {
    pros.push("Incluye bodega, lo que permite cobrar más arriendo y hace la propiedad más atractiva para familias.");
  }
  if (nEstacs && nEstacs > 0) {
    pros.push(`Incluye ${nEstacs} estacionamiento${nEstacs > 1 ? "s" : ""}, un plus que facilita arrendar y permite cobrar un adicional mensual.`);
  } else if (input.estacionamiento === "si") {
    pros.push("Incluye estacionamiento, un plus que facilita arrendar y permite cobrar un adicional mensual.");
  }
  if (input.estadoVenta !== "inmediata") {
    const mesesEspera = calcMesesHastaEntrega(input);
    if (mesesEspera > 0) {
      pros.push(`Comprando en ${input.estadoVenta === "blanco" ? "blanco" : "verde"}, acumulas ${mesesEspera} meses de plusvalía (4%/año) antes de la entrega. El valor estimado al recibir sería ${Math.round(input.precio * Math.pow(1.04, mesesEspera / 12))} UF.`);
    }
  }
  if (pros.length === 0)
    pros.push("Propiedad con características estándar. No tiene ventajas sobresalientes, pero tampoco riesgos mayores.");
  return pros;
}

function generateContras(input: AnalisisInput, metrics: AnalysisMetrics): string[] {
  const contras: string[] = [];
  const fmtP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");

  if (metrics.capRate < 3.5)
    contras.push(`La rentabilidad operativa (CAP rate ${metrics.capRate.toFixed(1)}%) está bajo el promedio. Podrías negociar el precio de compra o buscar una propiedad más rentable en la zona.`);
  if (metrics.flujoNetoMensual < 0)
    contras.push(`Cada mes tendrás que poner ${fmtP(metrics.flujoNetoMensual)} de tu bolsillo para cubrir los costos. Asegúrate de tener ese flujo disponible de forma estable.`);
  if (input.antiguedad > 15)
    contras.push(`Con ${input.antiguedad} años de antigüedad, es probable que pronto aparezcan gastos de mantención mayores (fachada, ascensores, impermeabilización). Pregunta por el fondo de reserva del edificio.`);
  if (input.gastos > metrics.ingresoMensual * 0.25)
    contras.push("Los gastos comunes son altos (>25% del arriendo). Aunque los paga el arrendatario, GGCC altos dificultan arrendar y aumentan tu costo durante vacancia.");
  if (metrics.cashOnCash < 0)
    contras.push(`Tu pie está rentando negativo (${metrics.cashOnCash.toFixed(1)}% anual). El arriendo no alcanza a cubrir los costos. La inversión depende 100% de la plusvalía futura.`);
  if (input.vacanciaMeses >= 2)
    contras.push(`Con ${input.vacanciaMeses} meses de vacancia estimada al año, pierdes ingreso significativo. Considera si la ubicación justifica esa vacancia.`);
  if (metrics.precioM2 > 80)
    contras.push(`El precio por m² (${metrics.precioM2.toFixed(1)} UF) es elevado para la zona. El margen de plusvalía es menor. Compara con propiedades similares antes de decidir.`);
  if (input.estadoVenta !== "inmediata") {
    const mesesEspera = calcMesesHastaEntrega(input);
    if (mesesEspera > 12) {
      contras.push(`Tendrás ${mesesEspera} meses pagando cuotas del pie sin generar arriendo. Asegúrate de tener liquidez para cubrir esas cuotas.`);
    } else if (mesesEspera > 0) {
      contras.push(`Durante ${mesesEspera} meses pagarás cuotas del pie sin recibir arriendo. Factor a considerar en tu flujo personal.`);
    }
  }
  if (contras.length === 0)
    contras.push("Sin riesgos mayores identificados. Verifica los gastos comunes reales y el estado del edificio antes de tomar la decisión.");
  return contras;
}

// =========================================
// Main Analysis Function
// =========================================

export { calcMetrics, calcScoreFromMetrics };

export function runAnalysis(input: AnalisisInput): FullAnalysisResult {
  const metrics = calcMetrics(input);
  const cashflowYear1 = calcCashflowYear1(input, metrics);
  const projections = calcProjections(input, metrics, 20);
  const exitScenario = calcExitScenario(input, metrics, projections, 10);
  const refinanceScenario = calcRefinanceScenario(input, metrics, projections, 5);
  const score = calcScoreFromMetrics(input, metrics);
  const sensitivity = calcSensitivity(input, score, metrics);
  const breakEvenTasa = calcBreakEvenTasa(input, metrics);
  const valorMaximoCompra = calcValorMaximoCompra(input, metrics);
  const { clasificacion, color: clasificacionColor } = getClasificacion(score);
  const pros = generatePros(input, metrics);
  const contras = generateContras(input, metrics);

  // Score breakdown by dimension (mirrors calcScoreFromMetrics)

  const yb = metrics.rentabilidadBruta;
  let rentabilidadScore: number;
  if (yb >= 6) rentabilidadScore = lerp(yb, 6, 8, 90, 100);
  else if (yb >= 5) rentabilidadScore = lerp(yb, 5, 6, 70, 89);
  else if (yb >= 4) rentabilidadScore = lerp(yb, 4, 5, 45, 65);
  else if (yb >= 3) rentabilidadScore = lerp(yb, 3, 4, 25, 44);
  else rentabilidadScore = lerp(yb, 0, 3, 0, 24);
  if (metrics.rentabilidadNeta >= 4) rentabilidadScore = Math.min(100, rentabilidadScore + 5);
  else if (metrics.rentabilidadNeta < 2) rentabilidadScore = Math.max(0, rentabilidadScore - 5);

  const flujoVal = metrics.flujoNetoMensual;
  let flujoCajaScore: number;
  if (flujoVal >= 0) flujoCajaScore = lerp(flujoVal, 0, 200000, 80, 100);
  else if (flujoVal >= -200000) flujoCajaScore = lerp(flujoVal, -200000, 0, 50, 79);
  else if (flujoVal >= -400000) flujoCajaScore = lerp(flujoVal, -400000, -200000, 25, 49);
  else if (flujoVal >= -600000) flujoCajaScore = lerp(flujoVal, -600000, -400000, 10, 24);
  else flujoCajaScore = lerp(flujoVal, -1000000, -600000, 0, 9);

  let plusvaliaScore = lookupComuna(input.comuna, PLUSVALIA_COMUNA, 50);
  const plusvaliaBaseR = lookupComuna(input.comuna, PLUSVALIA_COMUNA, 50);
  plusvaliaScore += plusvaliaBaseR >= 80 ? lerp(metrics.precioM2, 30, 120, 8, -8) : lerp(metrics.precioM2, 30, 100, 12, -12);
  if (input.enConstruccion || input.antiguedad <= 2) plusvaliaScore += 10;
  else if (input.antiguedad >= 3 && input.antiguedad <= 8) plusvaliaScore += 5;
  else if (input.antiguedad > 20) plusvaliaScore -= 15;
  if (input.piso >= 10) plusvaliaScore += 5;
  else if (input.piso <= 2 && input.piso > 0) plusvaliaScore -= 3;

  const isOversupplyR = COMUNAS_OVERSUPPLY.some((c) => input.comuna.toLowerCase().includes(c));
  let riesgoScore = 50;
  if (input.tipo.toLowerCase().includes("departamento")) riesgoScore += 10;
  if (input.antiguedad < 10 || input.enConstruccion) riesgoScore += 10;
  else if (input.antiguedad > 25) riesgoScore -= 15;
  if (metrics.capRate > 3) riesgoScore += 8;
  if (isOversupplyR) riesgoScore -= 5;
  const ratioGastosIngresoR = metrics.ingresoMensual > 0 ? metrics.egresosMensuales / metrics.ingresoMensual : 2;
  if (ratioGastosIngresoR > 1) riesgoScore -= 8;
  else if (ratioGastosIngresoR > 0.8) riesgoScore -= 5;

  const eficienciaScore = calcEficienciaScore(input, metrics);

  const desglose: Desglose = {
    rentabilidad: clamp(rentabilidadScore, 0, 100),
    flujoCaja: clamp(flujoCajaScore, 0, 100),
    plusvalia: clamp(plusvaliaScore, 0, 100),
    riesgo: clamp(riesgoScore, 10, 95),
    eficiencia: clamp(eficienciaScore, 0, 100),
  };

  const fmtR = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
  const coberturaPct = metrics.egresosMensuales > 0 ? Math.round((metrics.ingresoMensual / metrics.egresosMensuales) * 100) : 0;

  let resumenEjecutivo: string;
  if (metrics.flujoNetoMensual >= 0) {
    resumenEjecutivo = `Esta propiedad se paga sola y te deja ${fmtR(metrics.flujoNetoMensual)} al mes de ganancia. ` +
      `Renta un ${metrics.rentabilidadBruta.toFixed(1)}% bruto anual. ` +
      `${score >= 65 ? "Es una buena oportunidad de inversión." : "Revisa los detalles del informe para evaluar si conviene."}`;
  } else {
    resumenEjecutivo = `Necesitas poner ${fmtR(metrics.flujoNetoMensual)} de tu bolsillo cada mes. ` +
      `El arriendo cubre el ${coberturaPct}% de los costos. ` +
      `${Math.abs(metrics.flujoNetoMensual) < 100000 ? "El aporte es moderado y la plusvalía podría compensarlo." : "Evalúa si puedes mantener ese aporte mensual y si la plusvalía lo justifica."}`;
  }

  const resumen = `El arriendo genera ${fmtR(metrics.ingresoMensual)} al mes y los costos totales (dividendo + gastos + mantención) suman ${fmtR(metrics.egresosMensuales)}. ` +
    `${metrics.flujoNetoMensual >= 0 ? `Te quedan ${fmtR(metrics.flujoNetoMensual)} de ganancia mensual.` : `Falta cubrir ${fmtR(metrics.flujoNetoMensual)} al mes de tu bolsillo.`} ` +
    `La rentabilidad bruta es de ${metrics.rentabilidadBruta.toFixed(1)}% y la rentabilidad operativa (CAP rate) es ${metrics.capRate.toFixed(1)}%. ` +
    `${metrics.capRate >= 4 ? "La rentabilidad es atractiva para el mercado chileno." : metrics.capRate >= 3 ? "La rentabilidad es aceptable." : "La rentabilidad está bajo el promedio — vale la pena negociar el precio o buscar otras opciones."} ` +
    `${input.enConstruccion || input.antiguedad <= 2 ? "Al ser nueva, los costos de mantención serán bajos por años." : input.antiguedad <= 8 ? "La baja antigüedad reduce riesgos de mantención inesperada." : input.antiguedad > 20 ? "Ojo: la antigüedad puede traer gastos de mantención importantes pronto." : "La antigüedad es moderada."} ` +
    `Antes de decidir, verifica los gastos comunes reales y el estado de la administración del edificio.`;

  return {
    score: clamp(score, 0, 100),
    clasificacion,
    clasificacionColor,
    resumenEjecutivo,
    desglose,
    metrics,
    cashflowYear1,
    projections,
    exitScenario,
    refinanceScenario,
    sensitivity,
    breakEvenTasa,
    valorMaximoCompra,
    resumen,
    pros,
    contras,
  };
}
