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

export interface ShortTermResult {
  veredicto: 'VIABLE' | 'AJUSTA ESTRATEGIA' | 'NO RECOMENDADO';

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
const RAMP_UP_FACTORS = [0.70, 0.80, 0.90, 1.00];

/** Costos mensuales por tipología: [electricidad, agua, wifi, insumos, mantencion] */
export const COSTOS_DEFAULT: Record<string, [number, number, number, number, number]> = {
  '0': [30000, 6000, 22000, 18000, 8000],
  '1': [35000, 8000, 22000, 20000, 11000],
  '2': [55000, 12000, 22000, 22000, 20000],
  '3': [72000, 20000, 22000, 27000, 25000],
};

export const AMOBLAMIENTO_DEFAULT: Record<string, number> = {
  '0': 3000000,
  '1': 3500000,
  '2': 5000000,
  '3': 7000000,
};

/**
 * Retorna costos operativos por defecto para una tipología.
 * El formulario puede llamar esto para pre-llenar los campos.
 */
export function getCostosDefault(dormitorios: number) {
  const key = String(Math.min(dormitorios, 3));
  const [electricidad, agua, wifi, insumos, mantencion] = COSTOS_DEFAULT[key] ?? COSTOS_DEFAULT['1'];
  return {
    costoElectricidad: electricidad,
    costoAgua: agua,
    costoWifi: wifi,
    costoInsumos: insumos,
    mantencion,
    costoAmoblamiento: AMOBLAMIENTO_DEFAULT[key] ?? AMOBLAMIENTO_DEFAULT['1'],
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
  const p = airbnbData.percentiles;

  const conservador = buildEscenario('Conservador', p.revenue.p25, p.average_daily_rate.p25, p.occupancy.p25);
  const base = buildEscenario('Base', p.revenue.p50, p.average_daily_rate.p50, p.occupancy.p50);
  const agresivo = buildEscenario('Agresivo', p.revenue.p75, p.average_daily_rate.p75, p.occupancy.p75);

  // --- 3. Break-even ---
  const breakEvenRevenueMensual = (1 - comisionRate) > 0
    ? (costosOperativosTotales + dividendoMensual) / (1 - comisionRate)
    : Infinity;
  const breakEvenRevenueAnual = Math.round(breakEvenRevenueMensual * 12);
  const breakEvenPctDelMercado = p.revenue.p50 > 0
    ? breakEvenRevenueAnual / p.revenue.p50
    : Infinity;

  // --- 4. Comparativa STR vs LTR ---
  const ltr_ingresoBruto = input.arriendoLargoMensual;
  const ltr_comisionAdmin = Math.round(ltr_ingresoBruto * COMISION_LTR);
  const ltr_ingresoNeto = ltr_ingresoBruto - ltr_comisionAdmin;
  const ltr_noiMensual = ltr_ingresoNeto - input.gastosComunes - input.mantencion - contribucionesMensuales;
  const ltr_flujoCaja = ltr_noiMensual - dividendoMensual;

  // STR auto y admin para la comparativa (siempre calcular ambos, escenario base)
  const str_auto = calcEscenario('Auto', p.revenue.p50, p.average_daily_rate.p50, p.occupancy.p50, COMISION_AIRBNB, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido);
  const str_admin = calcEscenario('Administrador', p.revenue.p50, p.average_daily_rate.p50, p.occupancy.p50, comisionAdministrador, costosOperativosTotales, dividendoMensual, precioCompra, capitalInvertido);

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
  const ingresoBrutoMensualBase = base.ingresoBrutoMensual;
  const perdidaRampUp = Math.round(
    ingresoBrutoMensualBase * (1 - RAMP_UP_FACTORS[0]) +
    ingresoBrutoMensualBase * (1 - RAMP_UP_FACTORS[1]) +
    ingresoBrutoMensualBase * (1 - RAMP_UP_FACTORS[2]),
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
  let veredicto: ShortTermResult['veredicto'];
  if (sobreRentaPct >= 0.10) {
    veredicto = 'VIABLE';
  } else if (sobreRentaPct >= 0 && base.noiMensual > 0) {
    veredicto = 'AJUSTA ESTRATEGIA';
  } else {
    veredicto = 'NO RECOMENDADO';
  }

  return {
    veredicto,
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
  };
}
