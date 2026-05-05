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
  NegociacionScenario,
} from "./types";
import { estimarContribuciones } from "./contribuciones";
import { findNearestStation } from "./metro-stations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "./plusvalia-historica";
import {
  TASA_MERCADO_FALLBACK,
  calcTasaConSubsidio,
  calificaSubsidio as calificaSubsidioHelper,
  aplicaSubsidio,
} from "./constants/subsidio";
import { classifyFinancingHealth } from "./financing-health";
import type { EngineSignal } from "./types";

// El valor de la UF se pasa explícitamente como parámetro a cada función que
// lo necesita. Antes existía un módulo-level `UF_CLP` mutable vía `setUFValue`,
// pero ese patrón causaba un bug: el cliente nunca propagaba la UF al motor,
// produciendo divergencia entre snapshots persistidos (UF server) y
// recálculos en runtime (UF default 38800). Ver
// audit/sesionA-residual-2/diagnostico.md.

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

export function calcDividendo(creditoCLP: number, tasaAnual: number, plazoAnos: number): number {
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
  // Base rent + parking + storage income
  return input.arriendo + (input.arriendoEstacionamiento || 0) + (input.arriendoBodega || 0);
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
  // Turnover costs (painting, deep clean, minor repairs) ≈ half month's rent every 2 years
  const recambio = Math.round((datos.arriendo * 0.5) / 24);
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

/**
 * Calcula el precio máximo de compra (CLP) para lograr un flujo mensual objetivo.
 * Despeja precio de: flujo = arriendo - dividendo(precio) - todos_los_gastos.
 * Mantención se omite (depende del precio, efecto pequeño vs dividendo).
 */
function calcPrecioParaFlujo(
  flujoObjetivo: number, arriendo: number, ggcc: number, contribucionesAnual: number,
  vacanciaPct: number, gestionPct: number, piePct: number, tasaAnual: number, plazoAnios: number
): number {
  const r = tasaAnual / 100 / 12;
  const n = plazoAnios * 12;
  if (r === 0 || n === 0) return 0;
  const factorAmort = r / (1 - Math.pow(1 + r, -n));
  const financiamiento = (100 - piePct) / 100;
  if (financiamiento <= 0) return 0;

  // Mirror calcFlujoDesglose exactly (except dividendo which depends on price)
  const vacMeses = vacanciaPct / 100 * 12;
  const ggccVac = Math.round(ggcc * vacMeses / 12);
  const contribMes = Math.round(contribucionesAnual / 4 / 3);
  const vacProrrata = Math.round(arriendo * vacMeses / 12);
  const admin = gestionPct > 0 ? Math.round(arriendo * gestionPct / 100 * (12 - vacMeses) / 12) : 0;
  const recamb = Math.round(arriendo * 0.5 / 24);
  const corr = Math.round(arriendo * 0.5 / 24);

  const disponibleParaDividendo = arriendo - ggccVac - contribMes - vacProrrata - corr - recamb - admin - flujoObjetivo;
  if (disponibleParaDividendo <= 0) return 0;

  // dividendo = precioCLP * financiamiento * factorAmort
  // precioCLP = disponibleParaDividendo / (financiamiento * factorAmort)
  return disponibleParaDividendo / (financiamiento * factorAmort);
}

function calcMetrics(input: AnalisisInput, ufClp: number): AnalysisMetrics {
  // Add optional parking price to total
  let precioTotal = input.precio;
  if (input.estacionamiento === "opcional" && input.precioEstacionamiento > 0) {
    precioTotal += input.precioEstacionamiento;
  }

  const precioCLP = precioTotal * ufClp;

  // Defaults para campos en 0 — calculados en variables locales SIN mutar
  // input. Ver Sesión B1 + audit/sesionA-diagnostico/diagnostico.md
  // (hallazgo colateral #5). Antes calcMetrics mutaba input.contribuciones,
  // input.gastos y input.provisionMantencion; hoy esos valores se exponen
  // en el output (metrics.*) para que clientes y server los lean ahí.
  const provisionMantencionAjustada = input.provisionMantencion
    || Math.round((precioCLP * getMantencionRate(input.antiguedad)) / 12);
  const contribucionesValor = input.contribuciones
    || estimarContribuciones(precioCLP, input.enConstruccion || input.antiguedad <= 2);
  const gastosValor = input.gastos || Math.round(input.superficie * 1200);

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
    ggcc: gastosValor,
    contribuciones: contribucionesValor,
    mantencion: provisionMantencionAjustada,
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

  // Cash-on-Cash y payback: capital invertido = pie + gastos de cierre.
  // Las cuotas de pie durante construcción NO se suman aparte porque YA forman
  // parte del pie (caso típico depto blanco/verde Chile: el pie se paga en
  // cuotas durante la obra). Sumarlas inflaba ~2x el capital invertido y
  // distorsionaba cashOnCash y mesesPaybackPie. Modelo A — Item 9 auditoría.
  const gastosCompra = Math.round(precioCLP * GASTOS_CIERRE_PCT);
  const capitalInvertido = pieCLP + gastosCompra;
  const cashOnCash = capitalInvertido > 0 ? ((flujoNetoMensual * 12) / capitalInvertido) * 100 : 0;
  const mesesPaybackPie = flujoNetoMensual > 0 ? Math.round(capitalInvertido / flujoNetoMensual) : 999;

  // Plusvalía inmediata — Franco (datos reales, para cálculos) y Usuario (referencial)
  const vmFrancoUF = input.valorMercadoFranco || input.precio;
  const vmUsuarioUF = input.valorMercadoUsuario || input.precio;
  const vmFrancoCLP = vmFrancoUF * ufClp;
  const vmUsuarioCLP = vmUsuarioUF * ufClp;
  const plusvaliaFranco = vmFrancoCLP - precioCLP;
  const plusvaliaFrancoPct = vmFrancoCLP > 0 ? ((vmFrancoCLP - precioCLP) / vmFrancoCLP) * 100 : 0;
  const plusvaliaUsuario = vmUsuarioCLP - precioCLP;
  const plusvaliaUsuarioPct = vmUsuarioCLP > 0 ? ((vmUsuarioCLP - precioCLP) / vmUsuarioCLP) * 100 : 0;

  // Precios de equilibrio
  const precioFlujoNeutroCLP = calcPrecioParaFlujo(0, ingresoMensual, gastosValor, contribucionesValor * 4, input.vacanciaMeses / 12 * 100, input.usaAdministrador ? (input.comisionAdministrador ?? 7) : 0, input.piePct, input.tasaInteres, input.plazoCredito);
  const precioFlujoPositivoCLP = calcPrecioParaFlujo(50000, ingresoMensual, gastosValor, contribucionesValor * 4, input.vacanciaMeses / 12 * 100, input.usaAdministrador ? (input.comisionAdministrador ?? 7) : 0, input.piePct, input.tasaInteres, input.plazoCredito);
  const descuentoParaNeutro = precioCLP > 0 && precioFlujoNeutroCLP > 0 ? ((precioCLP - precioFlujoNeutroCLP) / precioCLP) * 100 : 0;

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
    provisionMantencionAjustada,
    contribuciones: contribucionesValor,
    gastos: gastosValor,
    valorMercadoFrancoUF: Math.round(vmFrancoUF * 10) / 10,
    valorMercadoUsuarioUF: Math.round(vmUsuarioUF * 10) / 10,
    plusvaliaInmediataFranco: Math.round(plusvaliaFranco),
    plusvaliaInmediataFrancoPct: Math.round(plusvaliaFrancoPct * 10) / 10,
    plusvaliaInmediataUsuario: Math.round(plusvaliaUsuario),
    plusvaliaInmediataUsuarioPct: Math.round(plusvaliaUsuarioPct * 10) / 10,
    precioFlujoNeutroCLP: Math.round(precioFlujoNeutroCLP),
    precioFlujoNeutroUF: Math.round(precioFlujoNeutroCLP / ufClp * 100) / 100,
    precioFlujoPositivoCLP: Math.round(precioFlujoPositivoCLP),
    precioFlujoPositivoUF: Math.round(precioFlujoPositivoCLP / ufClp * 100) / 100,
    descuentoParaNeutro: Math.round(descuentoParaNeutro * 10) / 10,
    subsidioTasa: (() => {
      const califica = calificaSubsidioHelper(input.tipo, input.precio);
      const tasaConSubsidio = calcTasaConSubsidio(TASA_MERCADO_FALLBACK);
      return { califica, tasaConSubsidio, aplicado: califica && aplicaSubsidio(input.tasaInteres, tasaConSubsidio) };
    })(),
  };
}

// =========================================
// Cashflow Year 1 (month by month)
// =========================================

function calcCashflowYear1(input: AnalisisInput, metrics: AnalysisMetrics): MonthlyCashflow[] {
  const mantencion = metrics.provisionMantencionAjustada;

  // Determine months until delivery (entrega futura)
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
    ggcc: metrics.gastos,
    contribuciones: metrics.contribuciones,
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

/**
 * Proyecta ingresos, egresos, flujo y valor de la propiedad año a año.
 *
 * Esta es la fuente única de verdad para los time-series del análisis. Se llama
 * desde el motor (runAnalysis, tirForPrice) y desde la simulación cliente con
 * sliders de plazo y plusvalía. La firma con objeto permite que la simulación
 * pase su propio horizonte y plusvalía sin redeclarar la lógica.
 *
 * Ver audit/sesionA-diagnostico/diagnostico.md para el contexto del fork
 * `dynamicProjections` que esta API reemplaza.
 */
export function calcProjections(args: {
  input: AnalisisInput;
  metrics: AnalysisMetrics;
  ufClp: number;            // valor de la UF en CLP usado para precioCLP/valor mercado
  plazoVenta?: number;      // años a proyectar (default 20, motor histórico)
  plusvaliaAnual?: number;  // decimal: 0.04 = 4%/año (default PLUSVALIA_ANUAL)
}): YearProjection[] {
  const { input, metrics, ufClp } = args;
  const plazoVenta = args.plazoVenta ?? 20;
  const plusvaliaAnual = args.plusvaliaAnual ?? PLUSVALIA_ANUAL;

  const precioCLP = input.precio * ufClp;
  const creditoCLP = precioCLP * (1 - input.piePct / 100);

  const mesesPreEntrega = calcMesesHastaEntrega(input);

  let arriendoActual = metrics.ingresoMensual;
  let gastosActual = metrics.gastos;
  let contribucionesActual = metrics.contribuciones;
  // Plusvalía starts from Franco's market value (real data, captures "la pasada")
  const vmFrancoCLP = (input.valorMercadoFranco || input.precio) * ufClp;
  let valorPropiedad = vmFrancoCLP;
  // Flujo operativo: no incluye inversión inicial (pie) ni cuotas pre-entrega
  let flujoAcumulado = 0;

  const projections: YearProjection[] = [];

  for (let anio = 1; anio <= plazoVenta; anio++) {
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
    valorPropiedad *= (1 + plusvaliaAnual);
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

export function calcExitScenario(input: AnalisisInput, metrics: AnalysisMetrics, projections: YearProjection[], anios: number = 10): ExitScenario {
  const proy = projections[anios - 1];
  if (!proy) {
    return {
      anios,
      valorVenta: 0, saldoCredito: 0, comisionVenta: 0,
      gananciaNeta: 0, flujoAcumulado: 0, retornoTotal: 0,
      multiplicadorCapital: 0, tir: 0,
      inversionInicial: 0, flujoMensualAcumuladoNegativo: 0,
      totalAportado: 0, gananciaSobreTotal: 0, porcentajeGananciaSobreTotal: 0,
    };
  }

  const valorVenta = proy.valorPropiedad;
  const comisionVenta = Math.round(valorVenta * COMISION_VENTA);
  const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
  const retornoTotal = proy.flujoAcumulado + gananciaNeta;

  // Inversión inicial = pie + gastos de cierre (notaría, CBR, timbres, tasación)
  const gastosCompra = Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);
  const inversionInicial = metrics.pieCLP + gastosCompra;

  // "Plata que realmente pusiste" = inicial + aportes mensuales acumulados
  // Solo años con flujo anual negativo cuentan como aporte del bolsillo.
  const flujoMensualAcumuladoNegativo = projections
    .slice(0, anios)
    .filter((p) => p.flujoAnual < 0)
    .reduce((sum, p) => sum + Math.abs(p.flujoAnual), 0);
  const totalAportado = inversionInicial + flujoMensualAcumuladoNegativo;

  // Ganancia sobre lo que realmente pusiste (no sobre pie + cierre solamente)
  const gananciaSobreTotal = gananciaNeta - totalAportado;
  const porcentajeGananciaSobreTotal = totalAportado > 0
    ? Math.round((gananciaSobreTotal / totalAportado) * 10000) / 100
    : 0;

  const multiplicadorCapital = totalAportado > 0
    ? Math.round((retornoTotal / totalAportado) * 100) / 100
    : 0;

  // TIR: T0 = -inversionInicial. No se modifica aquí: los aportes mensuales
  // ya están contenidos en los flujos anuales negativos (T1..Tn). Inflar T0
  // con flujoMensualAcumuladoNegativo provocaría doble conteo.
  const flujos: number[] = [-inversionInicial];
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
    inversionInicial: Math.round(inversionInicial),
    flujoMensualAcumuladoNegativo: Math.round(flujoMensualAcumuladoNegativo),
    totalAportado: Math.round(totalAportado),
    gananciaSobreTotal: Math.round(gananciaSobreTotal),
    porcentajeGananciaSobreTotal,
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
    ggcc: metrics.gastos,
    contribuciones: metrics.contribuciones,
    mantencion: metrics.provisionMantencionAjustada,
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
function calcSensitivity(input: AnalisisInput, baseScore: number, _baseMetrics: AnalysisMetrics, ufClp: number): SensitivityRow[] {
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

    const newMetrics = calcMetrics(modified, ufClp);
    const newScore = calcScoreFromMetrics(modified, newMetrics, ufClp);

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

function calcBreakEvenTasa(input: AnalisisInput, currentMetrics: AnalysisMetrics, ufClp: number): number {
  // If flow is already negative, search downward to find where flow = 0
  // If flow is positive, search upward
  if (currentMetrics.flujoNetoMensual <= 0) {
    // Already negative: search downward from current rate
    for (let tasa = input.tasaInteres; tasa >= 0; tasa -= 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified, ufClp);
      if (m.flujoNetoMensual >= 0) return Math.round(tasa * 100) / 100;
    }
    return -1; // Flow is negative even at 0% rate
  } else {
    // Positive: search upward for where flow becomes negative
    for (let tasa = input.tasaInteres; tasa <= 15; tasa += 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified, ufClp);
      if (m.flujoNetoMensual <= 0) return Math.round(tasa * 100) / 100;
    }
    return 15;
  }
}

function calcValorMaximoCompra(input: AnalisisInput, metrics: AnalysisMetrics, ufClp: number): number {
  // NOI / target CAP rate = max property value in CLP, then convert to UF
  const targetCapRate = 0.05; // 5% target
  const noi = metrics.noi;
  if (noi <= 0) return 0;
  const maxCLP = noi / targetCapRate;
  return Math.round(maxCLP / ufClp);
}

// =========================================
// Franco Score Calculation
// =========================================

const COMUNAS_PREMIUM = [
  "providencia", "las condes", "vitacura", "lo barnechea", "ñuñoa",
  "la reina", "santiago centro", "viña del mar", "con con",
];

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + clamp(t, 0, 1) * (outMax - outMin);
}

// ── Plusvalía: metro + histórica + antigüedad ──

function calcPlusvaliaScore(
  lat: number | null | undefined, lng: number | null | undefined,
  comuna: string,
  antiguedad: number
): number {
  // Sub-componente 1: Metro actual (35%)
  let metroActualScore = 50;
  if (lat && lng) {
    const nearest = findNearestStation(lat, lng, "active");
    if (nearest) {
      const d = nearest.distance;
      if (d < 500) metroActualScore = lerp(d, 0, 500, 100, 90);
      else if (d < 1000) metroActualScore = lerp(d, 500, 1000, 89, 70);
      else if (d < 1500) metroActualScore = lerp(d, 1000, 1500, 69, 50);
      else if (d < 2500) metroActualScore = lerp(d, 1500, 2500, 49, 30);
      else metroActualScore = lerp(d, 2500, 5000, 29, 15);
      metroActualScore = clamp(metroActualScore, 15, 100);
    }
  }

  // Sub-componente 2: Metro futuro (15%) — bonus
  let metroFuturoScore = 0;
  if (lat && lng) {
    const nearestFuture = findNearestStation(lat, lng, "future");
    if (nearestFuture && nearestFuture.distance < 1000) {
      metroFuturoScore = lerp(nearestFuture.distance, 0, 1000, 100, 60);
    } else if (nearestFuture && nearestFuture.distance < 2000) {
      metroFuturoScore = lerp(nearestFuture.distance, 1000, 2000, 59, 20);
    }
  }

  // Sub-componente 3: Plusvalía histórica comuna (30%)
  const comunaNorm = comuna.trim();
  const historica = PLUSVALIA_HISTORICA[comunaNorm] || null;
  const anualizada = historica ? historica.anualizada : PLUSVALIA_DEFAULT.anualizada;
  let historicaScore: number;
  if (anualizada >= 5) historicaScore = lerp(anualizada, 5, 7, 90, 100);
  else if (anualizada >= 4) historicaScore = lerp(anualizada, 4, 5, 75, 89);
  else if (anualizada >= 3) historicaScore = lerp(anualizada, 3, 4, 55, 74);
  else if (anualizada >= 2) historicaScore = lerp(anualizada, 2, 3, 35, 54);
  else if (anualizada >= 1) historicaScore = lerp(anualizada, 1, 2, 20, 34);
  else historicaScore = lerp(anualizada, -2, 1, 0, 19);
  historicaScore = clamp(historicaScore, 0, 100);

  // Sub-componente 4: Antigüedad (20%)
  let antiguedadScore: number;
  if (antiguedad <= 3) antiguedadScore = lerp(antiguedad, 0, 3, 100, 80);
  else if (antiguedad <= 8) antiguedadScore = lerp(antiguedad, 3, 8, 79, 65);
  else if (antiguedad <= 15) antiguedadScore = lerp(antiguedad, 8, 15, 64, 45);
  else if (antiguedad <= 25) antiguedadScore = lerp(antiguedad, 15, 25, 44, 25);
  else antiguedadScore = lerp(antiguedad, 25, 50, 24, 10);
  antiguedadScore = clamp(antiguedadScore, 10, 100);

  return Math.round(
    metroActualScore * 0.35 +
    metroFuturoScore * 0.15 +
    historicaScore * 0.30 +
    antiguedadScore * 0.20
  );
}

// ── Eficiencia: datos del radio real ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcEficienciaScore(precioM2: number, yieldBruto: number, zonaRadio: any | null): number {
  if (!zonaRadio || !zonaRadio.precioM2VentaUF || zonaRadio.precioM2VentaUF <= 0) {
    return 50; // sin datos = neutro
  }

  // A) Precio/m² vs radio (50%)
  const precioM2Radio = zonaRadio.precioM2VentaUF;
  const ratioPrecio = precioM2 / precioM2Radio;
  let preciScore: number;
  if (ratioPrecio < 0.85) preciScore = lerp(ratioPrecio, 0.70, 0.85, 100, 90);
  else if (ratioPrecio < 0.95) preciScore = lerp(ratioPrecio, 0.85, 0.95, 89, 70);
  else if (ratioPrecio < 1.05) preciScore = lerp(ratioPrecio, 0.95, 1.05, 69, 50);
  else if (ratioPrecio < 1.15) preciScore = lerp(ratioPrecio, 1.05, 1.15, 49, 30);
  else preciScore = lerp(ratioPrecio, 1.15, 1.40, 29, 10);
  preciScore = clamp(preciScore, 10, 100);

  // B) Yield vs radio (50%)
  const yieldRadio = zonaRadio.yieldPromedio || 0;
  if (yieldRadio <= 0) return Math.round(preciScore * 0.5 + 50 * 0.5);

  const ratioYield = yieldBruto / yieldRadio;
  let yieldScore: number;
  if (ratioYield > 1.20) yieldScore = lerp(ratioYield, 1.20, 1.50, 90, 100);
  else if (ratioYield > 1.05) yieldScore = lerp(ratioYield, 1.05, 1.20, 70, 89);
  else if (ratioYield > 0.95) yieldScore = lerp(ratioYield, 0.95, 1.05, 50, 69);
  else if (ratioYield > 0.80) yieldScore = lerp(ratioYield, 0.80, 0.95, 30, 49);
  else yieldScore = lerp(ratioYield, 0.50, 0.80, 10, 29);
  yieldScore = clamp(yieldScore, 10, 100);

  return Math.round(preciScore * 0.5 + yieldScore * 0.5);
}

function calcScoreFromMetrics(input: AnalisisInput, metrics: AnalysisMetrics, ufClp: number): number {
  // Rentabilidad (30%): based on rentabilidad bruta calibrated for Chilean market
  let rentabilidad: number;
  const yb = metrics.rentabilidadBruta;
  if (yb >= 6) rentabilidad = lerp(yb, 6, 8, 90, 100);
  else if (yb >= 5) rentabilidad = lerp(yb, 5, 6, 70, 89);
  else if (yb >= 4) rentabilidad = lerp(yb, 4, 5, 45, 65);
  else if (yb >= 3) rentabilidad = lerp(yb, 3, 4, 25, 44);
  else rentabilidad = lerp(yb, 0, 3, 0, 24);
  if (metrics.rentabilidadNeta >= 4) rentabilidad = Math.min(100, rentabilidad + 5);
  else if (metrics.rentabilidadNeta < 2) rentabilidad = Math.max(0, rentabilidad - 5);
  rentabilidad = clamp(rentabilidad, 0, 100);

  // Flujo de caja (25%): ratio relativo al arriendo
  let flujoCaja: number;
  const arriendoTotal = metrics.ingresoMensual;
  if (arriendoTotal <= 0) {
    flujoCaja = 0;
  } else {
    const ratio = metrics.flujoNetoMensual / arriendoTotal;
    if (ratio >= 0) flujoCaja = lerp(ratio, 0, 0.3, 80, 100);
    else if (ratio >= -0.3) flujoCaja = lerp(ratio, -0.3, 0, 50, 79);
    else if (ratio >= -0.6) flujoCaja = lerp(ratio, -0.6, -0.3, 25, 49);
    else if (ratio >= -1.0) flujoCaja = lerp(ratio, -1.0, -0.6, 10, 24);
    else flujoCaja = lerp(ratio, -2.0, -1.0, 0, 9);
  }
  flujoCaja = clamp(flujoCaja, 0, 100);

  // Plusvalía (25%): metro + histórica + antigüedad
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputAnyScore = input as any;
  const lat = inputAnyScore.zonaRadio?.lat || inputAnyScore.lat || null;
  const lng = inputAnyScore.zonaRadio?.lng || inputAnyScore.lng || null;
  const plusvalia = calcPlusvaliaScore(lat, lng, input.comuna, input.antiguedad);

  // Eficiencia (20%): datos del radio real
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonaRadio = (input as any)?.zonaRadio;
  const zonaRadioForEficiencia = zonaRadio ? {
    precioM2VentaUF: zonaRadio.precioM2VentaCLP ? zonaRadio.precioM2VentaCLP / ufClp : 0,
    yieldPromedio: zonaRadio.yieldPromedio || 0,
  } : null;
  const eficiencia = calcEficienciaScore(metrics.precioM2, metrics.rentabilidadBruta, zonaRadioForEficiencia);

  let score = Math.round(
    rentabilidad * 0.30 +
    flujoCaja * 0.25 +
    plusvalia * 0.25 +
    eficiencia * 0.20
  );

  // Penalize entrega futura for months without return
  const mesesEspera = calcMesesHastaEntrega(input);
  if (mesesEspera > 0) {
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
  else if (metrics.flujoNetoMensual === 0)
    pros.push("Flujo exactamente neutro — el arriendo cubre todos los costos.");
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
      pros.push(`Comprando con entrega futura, acumulas ${mesesEspera} meses de plusvalía (4%/año) antes de la entrega. El valor estimado al recibir sería ${Math.round(input.precio * Math.pow(1.04, mesesEspera / 12))} UF.`);
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
    contras.push(`La rentabilidad operativa (CAP rate ${metrics.capRate.toFixed(1)}%) está bajo el promedio. Podrías ajustar el precio de compra o buscar una propiedad más rentable en la zona.`);
  if (metrics.flujoNetoMensual < 0)
    contras.push(`Cada mes tendrás que poner ${fmtP(metrics.flujoNetoMensual)} de tu bolsillo para cubrir los costos. Asegúrate de tener ese flujo disponible de forma estable.`);
  if (input.antiguedad > 15)
    contras.push(`Con ${input.antiguedad} años de antigüedad, es probable que pronto aparezcan gastos de mantención mayores (fachada, ascensores, impermeabilización). Pregunta por el fondo de reserva del edificio.`);
  if (metrics.ingresoMensual > 0 && metrics.gastos > metrics.ingresoMensual * 0.25)
    contras.push("Los gastos comunes son altos (>25% del arriendo). Aunque los paga el arrendatario, GGCC altos dificultan arrendar y aumentan tu costo durante vacancia.");
  if (metrics.cashOnCash < 0) {
    if (metrics.flujoNetoMensual >= 0) {
      contras.push("Cash-on-cash negativo por alta inversión inicial, pero el flujo mensual es positivo.");
    } else {
      contras.push(`Tu pie está rentando negativo (${metrics.cashOnCash.toFixed(1)}% anual). El arriendo no alcanza a cubrir los costos. La inversión depende 100% de la plusvalía futura.`);
    }
  }
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

// TIR para un precio alternativo (UF). Recomputa métricas/proyecciones/exit.
export function tirForPrice(input: AnalisisInput, precioUF: number, ufClp: number): number {
  const clone: AnalisisInput = { ...input, precio: precioUF };
  const m = calcMetrics(clone, ufClp);
  const projs = calcProjections({ input: clone, metrics: m, plazoVenta: 20, ufClp });
  const ex = calcExitScenario(clone, m, projs, 10);
  return ex.tir;
}

// Fase 3.7 v10 — umbral del aporte mensual considerado "viable" en la matemática
// del usuario. Si el flujo neto mensual es positivo, o el aporte (negativo) no
// supera el 20% del arriendo, se considera viable. Sobre 20% el aporte es
// significativo y justifica negociar para mejorar la matemática propia, aunque
// el precio ya esté bajo mercado.
const UMBRAL_FLUJO_VIABLE_PCT_ARRIENDO = 0.20;

// Busca el precio que lleva el flujo neto mensual al UMBRAL_FLUJO_VIABLE.
// Retorna null si no encuentra precio razonable dentro del rango.
function calcPrecioFlujoViable(
  input: AnalisisInput,
  metrics: { flujoNetoMensual: number },
  ufClp: number,
): number | null {
  const arriendo = input.arriendo || 0;
  const target = -arriendo * UMBRAL_FLUJO_VIABLE_PCT_ARRIENDO;
  if (metrics.flujoNetoMensual >= target) return input.precio;
  // Bisección: bajar precio hasta que flujoNetoMensual >= target.
  let lo = input.precio * 0.5;
  let hi = input.precio;
  let mejor: number | null = null;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const cloneM = calcMetrics({ ...input, precio: mid }, ufClp);
    if (cloneM.flujoNetoMensual >= target) {
      mejor = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return mejor !== null ? Math.round(mejor * 10) / 10 : null;
}

function calcNegociacionScenario(
  input: AnalisisInput,
  tirActual: number,
  metrics: { flujoNetoMensual: number },
  ufClp: number,
): NegociacionScenario {
  const vmFrancoUF = input.valorMercadoFranco || input.precio;
  const arriendo = input.arriendo || 0;
  const flujoViable = metrics.flujoNetoMensual >= -arriendo * UMBRAL_FLUJO_VIABLE_PCT_ARRIENDO;
  const bajoMercado = input.precio < vmFrancoUF * 0.98;  // 2% holgura para evitar "borderline alineado"

  // Fase 3.7 v10 — 3 modos
  let precioSugeridoUF: number;
  let modo: "cerrar_actual" | "optimizar_flujo" | "alinear_mercado";
  let razon: string;
  if (bajoMercado && flujoViable) {
    // Modo 1 — cerrar al precio actual: ya estás bajo mercado y la matemática cierra.
    precioSugeridoUF = Math.round(input.precio * 10) / 10;
    modo = "cerrar_actual";
    razon = "Ya estás bajo mercado y la matemática cierra. No hay caso para pedir descuento.";
  } else if (bajoMercado && !flujoViable) {
    // Modo 2 — optimizar flujo: el precio es bueno vs mercado pero el aporte es alto.
    const precioFlujoViable = calcPrecioFlujoViable(input, metrics, ufClp);
    if (precioFlujoViable !== null && precioFlujoViable < input.precio) {
      precioSugeridoUF = Math.round(precioFlujoViable * 10) / 10;
      modo = "optimizar_flujo";
      razon = "Bajas el precio para que tu aporte mensual sea sostenible, no porque el mercado lo valga menos.";
    } else {
      // No se encuentra precio que vuelva el flujo viable — caer a alinear_mercado.
      const baseSugerido = Math.min(input.precio, vmFrancoUF);
      precioSugeridoUF = Math.round(baseSugerido * 0.97 * 10) / 10;
      modo = "alinear_mercado";
      razon = "El precio sugerido alinea con comparables y mejora marginalmente tu matemática.";
    }
  } else {
    // Modo 3 — alinear mercado: el precio está sobre o cerca del valor real.
    const baseSugerido = Math.min(input.precio, vmFrancoUF);
    precioSugeridoUF = Math.round(baseSugerido * 0.97 * 10) / 10;
    modo = "alinear_mercado";
    razon = "Pagas sobre el valor real de la zona. Este precio te alinea con comparables y mejora la matemática.";
  }

  const tirAlSugerido = tirForPrice(input, precioSugeridoUF, ufClp);
  const tirAlVmFranco = tirForPrice(input, vmFrancoUF, ufClp);

  // Precio límite: buscar por bisección el precio donde TIR cae a 6%.
  let precioLimiteUF: number | null = null;
  let tirAlLimite: number | null = null;
  if (tirActual > 6) {
    let lo = input.precio;
    // P2 (Fase 20): rango ampliado a vmFranco × 1.5 (era × 1.3) para que
    // Límite ≥ vmFranco en deals con ventaja extrema (>30% bajo mercado).
    let hi = Math.max(input.precio * 1.5, vmFrancoUF * 1.5);
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const tir = tirForPrice(input, mid, ufClp);
      if (tir > 6) lo = mid;
      else hi = mid;
      if (Math.abs(tir - 6) < 0.1) {
        precioLimiteUF = Math.round(mid * 10) / 10;
        tirAlLimite = 6.0;
        break;
      }
    }
    if (precioLimiteUF === null && hi > lo) {
      precioLimiteUF = Math.round(((lo + hi) / 2) * 10) / 10;
      tirAlLimite = 6.0;
    }
  }

  return {
    precioSugeridoUF,
    precioSugeridoCLP: Math.round(precioSugeridoUF * ufClp),
    tirAlSugerido,
    precioLimiteUF,
    precioLimiteCLP: precioLimiteUF ? Math.round(precioLimiteUF * ufClp) : null,
    tirAlLimite,
    tirAlVmFranco,
    modo,
    razon,
  };
}

export function runAnalysis(input: AnalisisInput, ufClp: number): FullAnalysisResult {
  const metrics = calcMetrics(input, ufClp);
  const cashflowYear1 = calcCashflowYear1(input, metrics);
  const projections = calcProjections({ input, metrics, plazoVenta: 20, ufClp });
  const exitScenario = calcExitScenario(input, metrics, projections, 10);
  const negociacion = calcNegociacionScenario(input, exitScenario.tir, metrics, ufClp);
  const refinanceScenario = calcRefinanceScenario(input, metrics, projections, 5);
  const score = calcScoreFromMetrics(input, metrics, ufClp);
  const sensitivity = calcSensitivity(input, score, metrics, ufClp);
  const breakEvenTasa = calcBreakEvenTasa(input, metrics, ufClp);
  const valorMaximoCompra = calcValorMaximoCompra(input, metrics, ufClp);
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

  // Flujo de caja: ratio relativo al arriendo
  const arriendoTotalR = metrics.ingresoMensual;
  let flujoCajaScore: number;
  if (arriendoTotalR <= 0) {
    flujoCajaScore = 0;
  } else {
    const ratioR = metrics.flujoNetoMensual / arriendoTotalR;
    if (ratioR >= 0) flujoCajaScore = lerp(ratioR, 0, 0.3, 80, 100);
    else if (ratioR >= -0.3) flujoCajaScore = lerp(ratioR, -0.3, 0, 50, 79);
    else if (ratioR >= -0.6) flujoCajaScore = lerp(ratioR, -0.6, -0.3, 25, 49);
    else if (ratioR >= -1.0) flujoCajaScore = lerp(ratioR, -1.0, -0.6, 10, 24);
    else flujoCajaScore = lerp(ratioR, -2.0, -1.0, 0, 9);
  }

  // Plusvalía: metro + histórica + antigüedad
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputAnyR = input as any;
  const latR = inputAnyR.zonaRadio?.lat || inputAnyR.lat || null;
  const lngR = inputAnyR.zonaRadio?.lng || inputAnyR.lng || null;
  const plusvaliaScore = calcPlusvaliaScore(latR, lngR, input.comuna, input.antiguedad);

  // Eficiencia: datos del radio real
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonaRadioR = (input as any)?.zonaRadio;
  const zonaRadioForEfR = zonaRadioR ? {
    precioM2VentaUF: zonaRadioR.precioM2VentaCLP ? zonaRadioR.precioM2VentaCLP / ufClp : 0,
    yieldPromedio: zonaRadioR.yieldPromedio || 0,
  } : null;
  const eficienciaScore = calcEficienciaScore(metrics.precioM2, metrics.rentabilidadBruta, zonaRadioForEfR);

  const desglose: Desglose = {
    rentabilidad: clamp(rentabilidadScore, 0, 100),
    flujoCaja: clamp(flujoCajaScore, 0, 100),
    plusvalia: clamp(plusvaliaScore, 0, 100),
    eficiencia: clamp(eficienciaScore, 0, 100),
  };

  const fmtR = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
  const coberturaPct = metrics.egresosMensuales > 0 ? Math.round((metrics.ingresoMensual / metrics.egresosMensuales) * 100) : 0;

  // engineSignal: base por score + overrides por señales fuertes.
  // Antes era `veredicto`. Ver analysis-voice-franco/SKILL.md §1.7 para el rename.
  let engineSignal: EngineSignal = score >= 70 ? "COMPRAR" : score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA";

  // NOTE: These overrides can make the badge contradict the score bar visually.
  // This is intentional: structural signals (extreme flujo, zero break-even) override the composite score.

  const dividendoMensual = metrics.dividendo || 1; // evitar división por 0
  const flujoNegativoRatio = Math.abs(metrics.flujoNetoMensual) / dividendoMensual;
  if (
    metrics.cashOnCash < -30 ||
    breakEvenTasa === -1 ||
    ((metrics.plusvaliaInmediataFrancoPct ?? 0) < -8 && metrics.flujoNetoMensual < 0 && flujoNegativoRatio > 0.3) ||
    (metrics.flujoNetoMensual < 0 && flujoNegativoRatio > 0.5)
  ) {
    engineSignal = "BUSCAR OTRA";
  }

  if (
    metrics.flujoNetoMensual >= 0 &&
    metrics.rentabilidadNeta >= 4 &&
    (metrics.plusvaliaInmediataFrancoPct ?? 0) >= 0
  ) {
    engineSignal = "COMPRAR";
  }

  let resumenEjecutivo: string;
  if (metrics.flujoNetoMensual === 0) {
    resumenEjecutivo = `Esta propiedad se paga sola — break-even exacto, sin ganancia ni pérdida. ` +
      `Renta un ${metrics.rentabilidadBruta.toFixed(1)}% bruto anual. ` +
      `${score >= 65 ? "Es una buena oportunidad de inversión." : "Revisa los detalles del informe para evaluar si conviene."}`;
  } else if (metrics.flujoNetoMensual > 0) {
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
    `${metrics.capRate >= 4 ? "La rentabilidad es atractiva para el mercado chileno." : metrics.capRate >= 3 ? "La rentabilidad es aceptable." : "La rentabilidad está bajo el promedio — vale la pena ajustar el precio o buscar otras opciones."} ` +
    `${input.enConstruccion || input.antiguedad <= 2 ? "Al ser nueva, los costos de mantención serán bajos por años." : input.antiguedad <= 8 ? "La baja antigüedad reduce riesgos de mantención inesperada." : input.antiguedad > 20 ? "Ojo: la antigüedad puede traer gastos de mantención importantes pronto." : "La antigüedad es moderada."} ` +
    `Antes de decidir, verifica los gastos comunes reales y el estado de la administración del edificio.`;

  const financingHealth = classifyFinancingHealth({
    pie_pct: input.piePct,
    tasa_pct: input.tasaInteres,
    precio_uf: input.precio,
    plazo_anios: input.plazoCredito,
  }, ufClp);

  return {
    score: clamp(score, 0, 100),
    clasificacion,
    clasificacionColor,
    engineSignal,
    // En esta fase francoVerdict === engineSignal. Diverge en Fase 3 cuando el
    // refactor de prompts incorpora perfil de usuario (skill §1.7).
    francoVerdict: engineSignal,
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
    negociacion,
    financingHealth,
    resumen,
    pros,
    contras,
  };
}
