// =========================================
// Motor de Cálculo — Renta Corta (STR)
// =========================================
// P&L completo, comparativa STR vs LTR, escenarios por percentil,
// estacionalidad, ramp-up y veredicto.

// =========================================
// Types
// =========================================

export interface AirbnbData {
  estimated_adr: number;
  estimated_occupancy: number;
  estimated_annual_revenue: number;
  percentiles: {
    revenue: { p25: number; p50: number; p75: number; p90: number; avg: number };
    occupancy: { p25: number; p50: number; p75: number; p90: number; avg: number };
    average_daily_rate: { p25: number; p50: number; p75: number; p90: number; avg: number };
  };
  monthly_revenue: number[];
  currency: string;
}

// 'mixto' se mantiene en el union para no romper análisis legacy persistidos
// con ese valor. El form ya no lo expone; nuevos análisis solo serán
// 'residencial_puro' o 'dedicado'. Migración 2026-05-10 confirmó 0 rows.
export type TipoEdificioSTR = 'residencial_puro' | 'mixto' | 'dedicado';
export type HabilitacionSTR = 'basico' | 'estandar' | 'premium';

export interface ShortTermInputs {
  // Propiedad
  precioCompra: number;
  superficie: number;
  dormitorios: number;
  banos: number;

  // Financiamiento
  piePercent: number;       // decimal: 0.20 = 20%
  tasaCredito: number;      // decimal: 0.045 = 4.5%
  plazoCredito: number;     // años

  // AirROI
  airbnbData: AirbnbData;

  // Gestión
  modoGestion: 'auto' | 'administrador';
  comisionAdministrador: number; // decimal: 0.20 = 20%

  // Calibración v1 (mayo 2026) — 3 ejes operacionales. Opcionales para
  // backward-compat con análisis existentes; defaults dan baseline residencial.
  tipoEdificio?: TipoEdificioSTR;
  habilitacion?: HabilitacionSTR;
  // adminPro: si el usuario contrata administrador profesional (Andes-style).
  // Distinto de modoGestion='administrador' que captura "alguien gestiona"
  // (puede ser un familiar). adminPro implica empresa formal con 15-25% fee.
  adminPro?: boolean;

  // Overrides manuales (2026-05-10). Cuando != null, el motor usa el valor
  // manual en lugar del derivado de los ejes operacionales. Los ejes siguen
  // poblando ejesAplicados como referencia para la UI pedagógica.
  // - adrOverride: CLP/noche.
  // - occOverride: decimal 0-1.
  adrOverride?: number | null;
  occOverride?: number | null;

  // Costos operativos mensuales CLP
  costoElectricidad: number;
  costoAgua: number;
  costoWifi: number;
  costoInsumos: number;
  gastosComunes: number;
  mantencion: number;
  contribuciones: number; // CLP trimestrales

  // Amoblamiento
  costoAmoblamiento: number;

  // Comparativa LTR
  arriendoLargoMensual: number;

  // UF
  valorUF: number;
}

export interface EscenarioSTR {
  label: string;
  revenueAnual: number;
  ingresoBrutoMensual: number;
  comisionMensual: number;
  costosOperativos: number;
  noiMensual: number;
  flujoCajaMensual: number;
  capRate: number;
  cashOnCash: number;
  rentabilidadBruta: number;
  adrReferencia: number;
  ocupacionReferencia: number;
}

export interface FlujoEstacionalMes {
  mes: string;
  ingresoBruto: number;
  ingresoNeto: number;
  flujo: number;
  factor: number;
}

export interface SensibilidadRow {
  label: string;
  revenueAnual: number;
  noiMensual: number;
  sobreRenta: number;
  sobreRentaPct: number;
}

export type STRVerdict = 'VIABLE' | 'AJUSTA ESTRATEGIA' | 'NO RECOMENDADO';

// Proyección año-a-año para Patrón 7 (Advanced Section). Ronda 4b.
export interface YearProjectionSTR {
  year: number;
  valorDepto: number;
  saldoCredito: number;
  flujoOperacionalAnual: number;     // NOI*12 - dividendo*12 (con ramp-up año 1)
  flujoAcumulado: number;
  aporteMensualPromedio: number;     // si flujo<0, lo que aporta el dueño /12
  patrimonioNeto: number;            // valorDepto - saldoCredito + flujoAcumulado
}

// Escenario "si vendes en año N". Ronda 4b.
export interface ExitScenarioSTR {
  yearVenta: number;
  valorVenta: number;
  saldoCreditoAlVender: number;
  gastosCierre: number;              // 2% del precio venta
  flujoAcumuladoAlVender: number;
  gananciaNeta: number;              // valorVenta - saldo - cierre + flujoAcum - capitalInicial
  multiplicadorCapital: number;      // gananciaNeta / capitalInicial
  tirAnual: number;                  // TIR % del cashflow año 0 → año N
}

export type BandaOcupacionSTR =
  | 'edificio_dedicado_admin_pro'
  | 'edificio_dedicado_auto'
  | 'admin_pro_residencial'
  | 'auto_gestion_residencial';

// Calibración v1 — registro de ejes aplicados al cálculo, para mostrar al
// usuario cómo se llegó al número.
export interface EjesAplicadosSTR {
  tipoEdificio: TipoEdificioSTR;
  habilitacion: HabilitacionSTR;
  adminPro: boolean;
  factorEdificio: number;        // ej. 1.10
  factorHabilitacion: number;    // ej. 1.10
  factorADRTotal: number;        // factorEdificio × factorHabilitacion
  banda: BandaOcupacionSTR;
  ocupacionTarget: number;       // ej. 0.74
  adrBaselineP50: number;        // ADR p50 de AirROI antes del ajuste
  adrAjustado: number;           // adrBaselineP50 × factorADRTotal
  ocupacionBaselineP50: number;  // occ p50 de AirROI sin ajuste

  // Overrides manuales (2026-05-10). Cuando flag=true, el ADR/Occ usado
  // efectivamente por el motor difiere de adrAjustado / ocupacionTarget;
  // estos campos guardan el valor que prevaleció + de dónde vino.
  adrOverride: number | null;       // null si no hubo override
  occOverride: number | null;       // null si no hubo override
  adrFinal: number;                 // ADR efectivamente usado por el motor
  ocupacionFinal: number;           // Occupancy efectivamente usada
}

export interface ShortTermResult {
  veredicto: STRVerdict;

  // Calibración v1 — qué ejes se aplicaron. Opcional para compat retroactiva.
  ejesAplicados?: EjesAplicadosSTR;

  // Financiamiento
  pie: number;
  montoCredito: number;
  dividendoMensual: number;
  capitalInvertido: number;

  // Escenarios
  escenarios: {
    conservador: EscenarioSTR;
    base: EscenarioSTR;
    agresivo: EscenarioSTR;
  };

  // Comparativa STR vs LTR
  comparativa: {
    ltr: {
      ingresoBruto: number;
      noiMensual: number;
      flujoCaja: number;
    };
    str_auto: EscenarioSTR;
    str_admin: EscenarioSTR;
    sobreRenta: number;
    sobreRentaPct: number;
    paybackMeses: number;
  };

  // Estacionalidad (12 meses, escenario base)
  flujoEstacional: FlujoEstacionalMes[];

  // Ramp-up
  perdidaRampUp: number;

  // Break-even
  breakEvenRevenueAnual: number;
  breakEvenPctDelMercado: number;

  // Sensibilidad
  sensibilidad: SensibilidadRow[];

  // Ronda 4b — Paridad estructural con LTR para Patrón 7 (Advanced Section).
  // Opcionales para no romper análisis STR persistidos pre-4b.
  projections?: YearProjectionSTR[];
  exitScenario?: ExitScenarioSTR;
  // Señal del motor (matemática pura). Espejo de `veredicto` desde 4b.
  // En 4d la IA podrá producir `francoVerdict` distinto considerando perfil.
  engineSignal?: STRVerdict;
  francoVerdict?: STRVerdict;
}

// =========================================
// Constantes
// =========================================

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

const GASTOS_CIERRE_PCT = 0.02;
const COMISION_AIRBNB = 0.03;
const COMISION_LTR = 0.05;
// Ramp-up consolidado: ver `STR_RAMP_UP` exportado más abajo. Esta variable
// queda como alias interno para no tocar callsites legacy.
// Curva 6 meses: ocupación llega al 100% del target estabilizado en el mes 6.

// =========================================
// Calibración v1 — Mayo 2026
// =========================================
// Fuentes:
//  - Proforma Andes STR Alameda 107 Providencia (sept 2025)
//  - Experimento AirROI 149 listings Lastarria/Providencia/LasCondes
//    (mayo 2026, ver docs/str-benchmarks-from-airroi-2026-05.md)
//  - Airbtics público: Andes STR vs market Santiago

// Comisiones (re-exportadas para uso fuera del motor, ej. UI pedagógica)
export const STR_COMISION_ADMIN_PRO = 0.20;     // Andes STR full-service estándar
export const STR_COMISION_AUTO_GESTION = 0.03;  // overhead operacional Airbnb auto
export const LTR_COMISION_ESTANDAR = 0.05;      // industria

// Curva 6 meses post-listing — ocupación alcanza el 100% del target
// estabilizado recién en el mes 6. Antes era 4 meses [0.70, 0.80, 0.90, 1.00];
// se extendió tras observar que operadores reales (Andes proforma) reportan
// ramp-up más largo en mercados saturados como Santiago centro.
export const STR_RAMP_UP = [0.50, 0.60, 0.70, 0.80, 0.90, 1.00] as const;

// Costos directos mensuales por tipología (CLP). Andes proforma.
// Estos valores son MÁS DETALLADOS que COSTOS_DEFAULT (que usa string '0'..'3').
// Coexisten: COSTOS_DEFAULT sigue siendo el path por defecto del form,
// STR_COSTOS_DIRECTOS_MENSUAL queda disponible para uso pedagógico/debug.
export const STR_COSTOS_DIRECTOS_MENSUAL: Record<string, number> = {
  '1D1B_chico': 85000,
  '1D1B_grande': 94000,
  '2D1B': 111000,
  '2D2B': 118000,
  '2D3B': 127000,
  '3D2B': 141000,
  '3D3B': 148000,
};

export const STR_MANTENCION_MENSUAL: Record<string, number> = {
  '1D1B_chico': 11000,
  '1D1B_grande': 17000,
  '2D1B': 20000,
  '2D2B': 21000,
  '2D3B': 24000,
  '3D2B': 25000,
  '3D3B': 28000,
};

// Ocupación target por banda operacional. La gestión profesional drives
// OCUPACIÓN, no ADR (ver experimento AirROI: ADR similar entre pro/no-pro,
// ocupación significativamente mayor en operadores pro como Andes).
export const STR_OCUPACION_TARGET: Record<BandaOcupacionSTR, number> = {
  edificio_dedicado_admin_pro: 0.74,    // Andes-style (Alameda 107 proforma)
  edificio_dedicado_auto: 0.65,         // dedicado pero sin admin pro (raro)
  admin_pro_residencial: 0.65,          // admin pro en edificio residencial
  auto_gestion_residencial: 0.55,       // baseline: hosts independientes
};

// ADR factors. Ejes 1 (edificio) y 3 (habilitación). Eje 2 (gestión) NO afecta ADR.
export const STR_ADR_FACTOR = {
  edificio: {
    residencial_puro: 1.00,
    mixto: 1.05,
    dedicado: 1.10,    // conservador; experimento mostró direcciones contradictorias
  },
  habilitacion: {
    basico: 1.00,
    estandar: 1.05,
    premium: 1.10,     // placeholder defendible — sin data dura aún
  },
} as const;

// Ronda 4b — paridad estructural con LTR.
const PLUSVALIA_ANUAL_DEFAULT = 0.03;   // 3% nominal anual.
const HORIZONTE_DEFAULT = 10;           // años proyectados.
const GASTOS_CIERRE_VENTA = 0.02;       // 2% comisión + costos al vender.

/** Costos mensuales por tipología: [electricidad, agua, wifi, insumos, mantencion] */
export const COSTOS_DEFAULT: Record<string, [number, number, number, number, number]> = {
  '0': [30000, 6000, 22000, 18000, 8000],
  '1': [35000, 8000, 22000, 20000, 11000],
  '2': [55000, 12000, 22000, 22000, 20000],
  '3': [72000, 20000, 22000, 27000, 25000],
};

// Amoblamiento base por dormitorios (CLP). Iter 2026-05-10: re-calibración
// según Andes proforma + Habilitación STR Santiago. Valores BASE — se
// multiplican por factor de habilitación (ver getCostoAmoblamientoEscalado).
export const AMOBLAMIENTO_DEFAULT: Record<string, number> = {
  '0': 2500000,   // studio = 1D para amoblamiento
  '1': 2500000,
  '2': 3500000,
  '3': 5000000,
};

// Factor de habilitación sobre el costo base de amoblamiento.
//   básico:   funcional, fotos amateur → ×1.0
//   estándar: decente + fotos pro     → ×1.3
//   premium:  curado + amenidades     → ×2.1
export const AMOBLAMIENTO_FACTOR_HABILITACION: Record<HabilitacionSTR, number> = {
  basico: 1.0,
  estandar: 1.3,
  premium: 2.1,
};

/**
 * Costo de amoblamiento escalado por dormitorios + habilitación.
 * 1D=$2.5M, 2D=$3.5M, 3D+=$5M × factor habilitación.
 */
export function getCostoAmoblamientoEscalado(
  dormitorios: number,
  habilitacion: HabilitacionSTR = 'basico',
): number {
  const key = String(Math.min(dormitorios, 3));
  const base = AMOBLAMIENTO_DEFAULT[key] ?? AMOBLAMIENTO_DEFAULT['1'];
  const factor = AMOBLAMIENTO_FACTOR_HABILITACION[habilitacion] ?? 1.0;
  return Math.round(base * factor);
}

/**
 * Retorna costos operativos por defecto para una tipología.
 * El formulario puede llamar esto para pre-llenar los campos.
 *
 * Nota iter 2026-05-10: costoAmoblamiento ahora también acepta habilitación
 * para escalarlo. Backward-compat: si no se pasa, se usa basico (×1.0).
 */
export function getCostosDefault(dormitorios: number, habilitacion: HabilitacionSTR = 'basico') {
  const key = String(Math.min(dormitorios, 3));
  const [electricidad, agua, wifi, insumos, mantencion] = COSTOS_DEFAULT[key] ?? COSTOS_DEFAULT['1'];
  return {
    costoElectricidad: electricidad,
    costoAgua: agua,
    costoWifi: wifi,
    costoInsumos: insumos,
    mantencion,
    costoAmoblamiento: getCostoAmoblamientoEscalado(dormitorios, habilitacion),
  };
}

// =========================================
// Calibración v1 — aplicación de ejes
// =========================================

/**
 * Determina banda de ocupación según los 3 ejes del input.
 * Ver STR_OCUPACION_TARGET para los valores asociados a cada banda.
 */
export function determinarBandaOcupacion(input: {
  tipoEdificio?: TipoEdificioSTR;
  adminPro?: boolean;
}): BandaOcupacionSTR {
  const dedicado = input.tipoEdificio === 'dedicado';
  const adminPro = input.adminPro === true;

  if (dedicado && adminPro) return 'edificio_dedicado_admin_pro';
  if (dedicado && !adminPro) return 'edificio_dedicado_auto';
  if (!dedicado && adminPro) return 'admin_pro_residencial';
  return 'auto_gestion_residencial';
}

/**
 * Aplica los 3 ejes operacionales al baseline de AirROI:
 *   - Eje 1 (edificio) y eje 3 (habilitación) → ADR factor.
 *   - Eje 2 (admin pro) + eje 1 → banda de ocupación target.
 *
 * Si se pasan overrides manuales, prevalecen sobre los valores derivados.
 * Los ejes siguen calculándose como referencia (UI pedagógica).
 */
export function aplicarEjesSTR(
  airbnbData: AirbnbData,
  input: {
    tipoEdificio?: TipoEdificioSTR;
    habilitacion?: HabilitacionSTR;
    adminPro?: boolean;
    adrOverride?: number | null;
    occOverride?: number | null;
  },
): EjesAplicadosSTR {
  const tipoEdificio = input.tipoEdificio ?? 'residencial_puro';
  const habilitacion = input.habilitacion ?? 'basico';
  const adminPro = input.adminPro === true;

  const factorEdificio = STR_ADR_FACTOR.edificio[tipoEdificio];
  const factorHabilitacion = STR_ADR_FACTOR.habilitacion[habilitacion];
  const factorADRTotal = factorEdificio * factorHabilitacion;

  const banda = determinarBandaOcupacion({ tipoEdificio, adminPro });
  const ocupacionTarget = STR_OCUPACION_TARGET[banda];

  const adrBaselineP50 = airbnbData.percentiles.average_daily_rate.p50;
  const adrAjustado = Math.round(adrBaselineP50 * factorADRTotal);

  // Resolver overrides. null/undefined → usar derivado; número válido → override.
  const adrOverrideValido = typeof input.adrOverride === 'number'
    && Number.isFinite(input.adrOverride)
    && input.adrOverride > 0;
  const occOverrideValido = typeof input.occOverride === 'number'
    && Number.isFinite(input.occOverride)
    && input.occOverride > 0
    && input.occOverride <= 1;

  const adrFinal = adrOverrideValido ? Math.round(input.adrOverride as number) : adrAjustado;
  const ocupacionFinal = occOverrideValido ? (input.occOverride as number) : ocupacionTarget;

  return {
    tipoEdificio,
    habilitacion,
    adminPro,
    factorEdificio,
    factorHabilitacion,
    factorADRTotal,
    banda,
    ocupacionTarget,
    adrBaselineP50,
    adrAjustado,
    ocupacionBaselineP50: airbnbData.percentiles.occupancy.p50,
    adrOverride: adrOverrideValido ? Math.round(input.adrOverride as number) : null,
    occOverride: occOverrideValido ? (input.occOverride as number) : null,
    adrFinal,
    ocupacionFinal,
  };
}

// =========================================
// Helpers
// =========================================

/**
 * Dividendo mensual (cuota fija francesa).
 * Misma fórmula que analysis.ts — duplicada aquí para no modificar ese archivo.
 * tasaAnual en decimal (0.045 = 4.5%).
 */
function calcDividendo(creditoCLP: number, tasaAnualDecimal: number, plazoAnos: number): number {
  if (creditoCLP <= 0) return 0;
  const tasaMensual = tasaAnualDecimal / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(creditoCLP / n);
  return Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function calcEscenario(
  label: string,
  revenueAnual: number,
  adrReferencia: number,
  ocupacionReferencia: number,
  comisionRate: number,
  costosOperativosTotales: number,
  dividendoMensual: number,
  precioCompra: number,
  capitalInvertido: number,
): EscenarioSTR {
  const ingresoBrutoMensual = Math.round(revenueAnual / 12);
  const comisionMensual = Math.round(ingresoBrutoMensual * comisionRate);
  const ingresoNetoComision = ingresoBrutoMensual - comisionMensual;
  const noiMensual = ingresoNetoComision - costosOperativosTotales;
  const flujoCajaMensual = noiMensual - dividendoMensual;

  const noiAnual = noiMensual * 12;
  const capRate = precioCompra > 0 ? noiAnual / precioCompra : 0;
  const cashOnCash = capitalInvertido > 0 ? (flujoCajaMensual * 12) / capitalInvertido : 0;
  const rentabilidadBruta = precioCompra > 0 ? (ingresoBrutoMensual * 12) / precioCompra : 0;

  return {
    label,
    revenueAnual,
    ingresoBrutoMensual,
    comisionMensual,
    costosOperativos: costosOperativosTotales,
    noiMensual,
    flujoCajaMensual,
    capRate,
    cashOnCash,
    rentabilidadBruta,
    adrReferencia,
    ocupacionReferencia,
  };
}

/**
 * Saldo de crédito al mes M (cuota fija francesa).
 * tasaAnualDecimal en decimal (0.045 = 4.5%) — convención STR.
 */
function saldoCreditoSTR(creditoInicial: number, tasaAnualDecimal: number, plazoAnos: number, mesActual: number): number {
  if (creditoInicial <= 0) return 0;
  const tasaMensual = tasaAnualDecimal / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return creditoInicial * (1 - mesActual / n);
  const dividendo = (creditoInicial * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  return creditoInicial * Math.pow(1 + tasaMensual, mesActual) -
    dividendo * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual);
}

/**
 * TIR de un flujo de caja (Newton-Raphson). Misma implementación que LTR.
 */
function calcTIRSTR(flujos: number[], guess: number = 0.1): number {
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

/**
 * Proyecciones año-a-año para Patrón 7 (Advanced Section). Ronda 4b.
 *
 * Año 1 aplica perdidaRampUp (5 primeros meses operan al 50/60/70/80/90%).
 * Año 2+ flujo a NOI base sin ramp-up.
 * Plusvalía: compoundéa desde año 1 (a diferencia del LTR pre-entrega).
 */
function buildProjections(
  input: ShortTermInputs,
  capitalInvertido: number,
  dividendoMensual: number,
  noiMensualBase: number,
  perdidaRampUp: number,
  horizonte: number = HORIZONTE_DEFAULT,
  plusvaliaAnual: number = PLUSVALIA_ANUAL_DEFAULT,
): YearProjectionSTR[] {
  void capitalInvertido;
  const precioCompra = input.precioCompra;
  const pie = Math.round(precioCompra * input.piePercent);
  const montoCredito = precioCompra - pie;
  const dividendoAnual = dividendoMensual * 12;
  const noiAnualBase = noiMensualBase * 12;

  const projections: YearProjectionSTR[] = [];
  let flujoAcumulado = 0;

  for (let year = 1; year <= horizonte; year++) {
    const valorDepto = precioCompra * Math.pow(1 + plusvaliaAnual, year);

    const mesActual = Math.min(year * 12, input.plazoCredito * 12);
    const saldo = Math.max(0, saldoCreditoSTR(montoCredito, input.tasaCredito, input.plazoCredito, mesActual));

    // Ramp-up solo año 1: 3 meses parciales restan ingreso bruto
    // (ya están en perdidaRampUp). Comisión sobre lo perdido también
    // se ahorra, pero el efecto neto es conservador → restar el bruto.
    const flujoOperacionalAnual = year === 1
      ? noiAnualBase - dividendoAnual - perdidaRampUp
      : noiAnualBase - dividendoAnual;

    flujoAcumulado += flujoOperacionalAnual;

    const aporteMensualPromedio = flujoOperacionalAnual < 0
      ? Math.round(Math.abs(flujoOperacionalAnual) / 12)
      : 0;

    const patrimonioNeto = valorDepto - saldo + flujoAcumulado;

    projections.push({
      year,
      valorDepto: Math.round(valorDepto),
      saldoCredito: Math.round(saldo),
      flujoOperacionalAnual: Math.round(flujoOperacionalAnual),
      flujoAcumulado: Math.round(flujoAcumulado),
      aporteMensualPromedio,
      patrimonioNeto: Math.round(patrimonioNeto),
    });
  }

  return projections;
}

/**
 * Escenario de salida en año N. Ronda 4b.
 * Replica la firma de `calcExitScenario` del LTR adaptada a STR.
 */
function buildExitScenario(
  projections: YearProjectionSTR[],
  capitalInicial: number,
  yearVenta: number = HORIZONTE_DEFAULT,
): ExitScenarioSTR {
  const idx = Math.min(yearVenta - 1, projections.length - 1);
  const proy = projections[idx];
  if (!proy) {
    return {
      yearVenta, valorVenta: 0, saldoCreditoAlVender: 0, gastosCierre: 0,
      flujoAcumuladoAlVender: 0, gananciaNeta: 0, multiplicadorCapital: 0, tirAnual: 0,
    };
  }

  const valorVenta = proy.valorDepto;
  const saldoCreditoAlVender = proy.saldoCredito;
  const gastosCierre = Math.round(valorVenta * GASTOS_CIERRE_VENTA);
  const flujoAcumuladoAlVender = proy.flujoAcumulado;
  const gananciaNeta = valorVenta - saldoCreditoAlVender - gastosCierre + flujoAcumuladoAlVender - capitalInicial;
  const multiplicadorCapital = capitalInicial > 0
    ? Math.round((gananciaNeta / capitalInicial) * 100) / 100
    : 0;

  // TIR: T0 = -capitalInicial; T1..T_{n-1} = flujoOperacional anual;
  // T_n = flujoOperacional + (valorVenta - saldo - cierre).
  const flujos: number[] = [-capitalInicial];
  for (let i = 0; i < yearVenta && i < projections.length; i++) {
    let flujo = projections[i].flujoOperacionalAnual;
    if (i === yearVenta - 1) {
      flujo += valorVenta - saldoCreditoAlVender - gastosCierre;
    }
    flujos.push(flujo);
  }
  const tirAnual = Math.round(calcTIRSTR(flujos, 0.1) * 10000) / 100;

  return {
    yearVenta,
    valorVenta: Math.round(valorVenta),
    saldoCreditoAlVender: Math.round(saldoCreditoAlVender),
    gastosCierre,
    flujoAcumuladoAlVender: Math.round(flujoAcumuladoAlVender),
    gananciaNeta: Math.round(gananciaNeta),
    multiplicadorCapital,
    tirAnual,
  };
}

// =========================================
// Motor principal
// =========================================

export function calcShortTerm(input: ShortTermInputs): ShortTermResult {
  const { precioCompra, airbnbData, modoGestion, comisionAdministrador } = input;

  // --- 1. Cálculos base ---
  const pie = Math.round(precioCompra * input.piePercent);
  const montoCredito = precioCompra - pie;
  const dividendoMensual = calcDividendo(montoCredito, input.tasaCredito, input.plazoCredito);
  const gastosCierre = Math.round(precioCompra * GASTOS_CIERRE_PCT);
  const capitalInvertido = pie + input.costoAmoblamiento + gastosCierre;

  // Comisión según modo de gestión
  const comisionRate = modoGestion === 'auto' ? COMISION_AIRBNB : comisionAdministrador;

  // Costos operativos fijos mensuales (contribuciones trimestrales → mensualizadas)
  const contribucionesMensuales = Math.round((input.contribuciones || 0) / 3);
  const costosDirectos = input.costoElectricidad + input.costoAgua + input.costoWifi + input.costoInsumos;
  const costosOperativosTotales = costosDirectos + input.gastosComunes + input.mantencion + contribucionesMensuales;

  // Helper parcial
  const buildEscenario = (label: string, revenueAnual: number, adr: number, ocu: number) =>
    calcEscenario(label, revenueAnual, adr, ocu, comisionRate, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido);

  // --- 2. Escenarios ---
  // Calibración v1: el escenario `base` se construye con los 3 ejes
  // operacionales (tipo de edificio, habilitación, admin pro). Ramps el ADR
  // p50 de AirROI por factores de edificio y habilitación, y reemplaza la
  // occupancy p50 por la ocupación target de la banda operacional.
  // Conservador y agresivo conservan la dispersión relativa observada en
  // AirROI (p25/p50, p75/p50) para mantener el ancho del intervalo.
  const p = airbnbData.percentiles;
  const ejes = aplicarEjesSTR(airbnbData, {
    tipoEdificio: input.tipoEdificio,
    habilitacion: input.habilitacion,
    adminPro: input.adminPro,
    adrOverride: input.adrOverride,
    occOverride: input.occOverride,
  });

  // adrFinal / ocupacionFinal prevalecen sobre el derivado de ejes cuando
  // hay override manual. Cuando no, son iguales a adrAjustado / ocupacionTarget.
  const adrBase = ejes.adrFinal;
  const occBase = ejes.ocupacionFinal;
  const revenueBase = Math.round(adrBase * occBase * 365);

  // Shifts relativos de AirROI (fallback a 0.85/1.15 si los percentiles vienen colapsados)
  const adrShiftP25 = p.average_daily_rate.p50 > 0 ? p.average_daily_rate.p25 / p.average_daily_rate.p50 : 0.85;
  const adrShiftP75 = p.average_daily_rate.p50 > 0 ? p.average_daily_rate.p75 / p.average_daily_rate.p50 : 1.15;
  const occShiftP25 = p.occupancy.p50 > 0 ? p.occupancy.p25 / p.occupancy.p50 : 0.85;
  const occShiftP75 = p.occupancy.p50 > 0 ? p.occupancy.p75 / p.occupancy.p50 : 1.15;

  const adrConservador = Math.round(adrBase * adrShiftP25);
  const adrAgresivo = Math.round(adrBase * adrShiftP75);
  const occConservador = Math.max(0.05, Math.min(0.95, occBase * occShiftP25));
  const occAgresivo = Math.max(0.05, Math.min(0.95, occBase * occShiftP75));
  const revenueConservador = Math.round(adrConservador * occConservador * 365);
  const revenueAgresivo = Math.round(adrAgresivo * occAgresivo * 365);

  const conservador = buildEscenario('Conservador', revenueConservador, adrConservador, occConservador);
  const base = buildEscenario('Base', revenueBase, adrBase, occBase);
  const agresivo = buildEscenario('Agresivo', revenueAgresivo, adrAgresivo, occAgresivo);

  // --- 3. Break-even ---
  const breakEvenRevenueMensual = (1 - comisionRate) > 0
    ? (costosOperativosTotales + dividendoMensual) / (1 - comisionRate)
    : Infinity;
  const breakEvenRevenueAnual = Math.round(breakEvenRevenueMensual * 12);
  // El break-even se compara contra el revenue del escenario base CALIBRADO
  // (no contra el p50 raw de AirROI), para mantener consistencia con el resto
  // de los KPIs que el usuario ve.
  const breakEvenPctDelMercado = revenueBase > 0
    ? breakEvenRevenueAnual / revenueBase
    : Infinity;

  // --- 4. Comparativa STR vs LTR ---
  const ltr_ingresoBruto = input.arriendoLargoMensual;
  const ltr_comisionAdmin = Math.round(ltr_ingresoBruto * COMISION_LTR);
  const ltr_ingresoNeto = ltr_ingresoBruto - ltr_comisionAdmin;
  const ltr_noiMensual = ltr_ingresoNeto - input.gastosComunes - input.mantencion - contribucionesMensuales;
  const ltr_flujoCaja = ltr_noiMensual - dividendoMensual;

  // STR auto y admin para la comparativa: ambos sobre el revenueBase calibrado
  // (mismo ADR ajustado y misma ocupación target). Lo único que cambia entre
  // los dos es la comisión que se paga.
  const str_auto = calcEscenario('Auto', revenueBase, adrBase, occBase, COMISION_AIRBNB, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido);
  const str_admin = calcEscenario('Administrador', revenueBase, adrBase, occBase, comisionAdministrador, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido);

  // Sobre-renta del modo actualmente seleccionado (escenario base)
  const sobreRenta = base.noiMensual - ltr_noiMensual;
  const sobreRentaPct = ltr_noiMensual !== 0 ? sobreRenta / ltr_noiMensual : 0;

  // Payback amoblamiento
  let paybackMeses: number;
  if (input.costoAmoblamiento <= 0) {
    paybackMeses = 0;
  } else if (sobreRenta <= 0) {
    paybackMeses = -1;
  } else {
    paybackMeses = Math.round(input.costoAmoblamiento / sobreRenta);
  }

  // --- 5. Estacionalidad (escenario base) ---
  const flujoEstacional: FlujoEstacionalMes[] = airbnbData.monthly_revenue.map((factor, i) => {
    const ingresoBruto = Math.round(base.revenueAnual * factor);
    const comision = Math.round(ingresoBruto * comisionRate);
    const ingresoNeto = ingresoBruto - comision - costosOperativosTotales;
    const flujo = ingresoNeto - dividendoMensual;
    return {
      mes: MESES[i] ?? `Mes ${i + 1}`,
      ingresoBruto,
      ingresoNeto,
      flujo,
      factor,
    };
  });

  // --- 6. Ramp-up ---
  // Suma la pérdida mensual por cada mes parcial (todos los factores salvo
  // el último, que es 1.00 → mes ya estabilizado). Curva actual: 6 meses.
  const ingresoBrutoMensualBase = base.ingresoBrutoMensual;
  const mesesParciales = STR_RAMP_UP.slice(0, -1);
  const perdidaRampUp = Math.round(
    mesesParciales.reduce((acum, factor) => acum + ingresoBrutoMensualBase * (1 - factor), 0),
  );

  // --- Sensibilidad ---
  const sensibilidadKeys: Array<{ label: string; revenue: number }> = [
    { label: 'P25', revenue: p.revenue.p25 },
    { label: 'P50', revenue: p.revenue.p50 },
    { label: 'P75', revenue: p.revenue.p75 },
    { label: 'P90', revenue: p.revenue.p90 },
    { label: 'Promedio', revenue: p.revenue.avg },
  ];

  const sensibilidad: SensibilidadRow[] = sensibilidadKeys.map(({ label, revenue }) => {
    const mensual = Math.round(revenue / 12);
    const comision = Math.round(mensual * comisionRate);
    const noi = mensual - comision - costosOperativosTotales;
    const sr = noi - ltr_noiMensual;
    return {
      label,
      revenueAnual: revenue,
      noiMensual: noi,
      sobreRenta: sr,
      sobreRentaPct: ltr_noiMensual !== 0 ? sr / ltr_noiMensual : 0,
    };
  });

  // --- 7. Veredicto ---
  let veredicto: STRVerdict;
  if (sobreRentaPct >= 0.10) {
    veredicto = 'VIABLE';
  } else if (sobreRentaPct >= 0 && base.noiMensual > 0) {
    veredicto = 'AJUSTA ESTRATEGIA';
  } else {
    veredicto = 'NO RECOMENDADO';
  }

  // --- 8. Projections + Exit (Ronda 4b) ---
  const projections = buildProjections(
    input,
    capitalInvertido,
    dividendoMensual,
    base.noiMensual,
    perdidaRampUp,
  );
  const exitScenario = buildExitScenario(projections, capitalInvertido);

  return {
    veredicto,
    ejesAplicados: ejes,
    pie,
    montoCredito,
    dividendoMensual,
    capitalInvertido,
    escenarios: { conservador, base, agresivo },
    comparativa: {
      ltr: { ingresoBruto: ltr_ingresoBruto, noiMensual: ltr_noiMensual, flujoCaja: ltr_flujoCaja },
      str_auto,
      str_admin,
      sobreRenta,
      sobreRentaPct,
      paybackMeses,
    },
    flujoEstacional,
    perdidaRampUp,
    breakEvenRevenueAnual,
    breakEvenPctDelMercado,
    sensibilidad,
    projections,
    exitScenario,
    engineSignal: veredicto,
    francoVerdict: veredicto,
  };
}
