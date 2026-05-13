import { ShortTermResult } from './short-term-engine';
import { CLINICAS, ZONAS_NEGOCIOS, ZONAS_TURISTICAS, ACCESO_SKI, distanciaMinima } from '../data/str-attractors';

// ============================================================
// TIPOS
// ============================================================

export interface FrancoScoreSTR {
  score: number;
  veredicto: 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA';
  overrideApplied: string | null;
  desglose: {
    rentabilidad: DimensionScore;
    sostenibilidad: DimensionScore;
    ventaja: DimensionScore;
    factibilidad: DimensionScore;
  };
}

export interface DimensionScore {
  score: number;
  label: string;
  detail: string;
  peso: number;
}

// ============================================================
// INPUTS
// ============================================================

export interface ScoreSTRInputs {
  results: ShortTermResult;

  precioCompra: number;
  dormitorios: number;
  superficie: number;
  regulacionEdificio: string;

  lat: number;
  lng: number;

  revenueP50: number;
  monthlyRevenue: number[];

  distanciaMetro: number;
}

// ============================================================
// INTERPOLACIÓN LINEAR
// ============================================================

function interpolate(value: number, scale: [number, number][]): number {
  const sorted = [...scale].sort((a, b) => b[0] - a[0]);

  if (value >= sorted[0][0]) return sorted[0][1];
  if (value <= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];

  for (let i = 0; i < sorted.length - 1; i++) {
    const [v1, p1] = sorted[i];
    const [v2, p2] = sorted[i + 1];
    if (value <= v1 && value >= v2) {
      const ratio = (value - v2) / (v1 - v2);
      return p2 + ratio * (p1 - p2);
    }
  }
  return 50;
}

// ============================================================
// DIMENSIÓN 1: RENTABILIDAD (25%)
// ============================================================

const ESCALA_CAP_RATE: [number, number][] = [
  [0.07, 100],
  [0.06, 85],
  [0.05, 70],
  [0.04, 50],
  [0.03, 30],
  [0.02, 15],
  [0.01, 0],
];

function calcRentabilidad(capRate: number): DimensionScore {
  const score = Math.round(interpolate(capRate, ESCALA_CAP_RATE));
  let detail = "";
  if (capRate >= 0.06) detail = `CAP Rate ${(capRate * 100).toFixed(1)}% — excelente para el mercado chileno`;
  else if (capRate >= 0.05) detail = `CAP Rate ${(capRate * 100).toFixed(1)}% — sobre el promedio`;
  else if (capRate >= 0.04) detail = `CAP Rate ${(capRate * 100).toFixed(1)}% — promedio del mercado`;
  else if (capRate >= 0.03) detail = `CAP Rate ${(capRate * 100).toFixed(1)}% — bajo, apenas viable`;
  else detail = `CAP Rate ${(capRate * 100).toFixed(1)}% — muy bajo`;

  return { score, label: "Rentabilidad", detail, peso: 25 };
}

// ============================================================
// DIMENSIÓN 2: SOSTENIBILIDAD (25%)
// ============================================================

const ESCALA_FLUJO: [number, number][] = [
  [200000, 100],
  [100000, 90],
  [0, 70],
  [-30000, 55],
  [-80000, 40],
  [-150000, 25],
  [-250000, 10],
  [-350000, 0],
];

const ESCALA_BREAKEVEN: [number, number][] = [
  [0.40, 100],
  [0.55, 85],
  [0.70, 70],
  [0.85, 50],
  [1.00, 35],
  [1.10, 15],
  [1.20, 0],
];

const ESCALA_ESTABILIDAD: [number, number][] = [
  [0.85, 100],
  [0.75, 80],
  [0.65, 60],
  [0.55, 45],
  [0.45, 30],
  [0.30, 10],
];

function calcSostenibilidad(
  flujoCajaMensual: number,
  breakEvenPctDelMercado: number,
  monthlyRevenue: number[]
): DimensionScore {
  const puntajeFlujo = interpolate(flujoCajaMensual, ESCALA_FLUJO);

  const puntajeBreakeven = interpolate(breakEvenPctDelMercado, ESCALA_BREAKEVEN);

  const minMonth = monthlyRevenue.length > 0 ? Math.min(...monthlyRevenue) : 0;
  const maxMonth = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue) : 0;
  const estabilidadRatio = maxMonth > 0 ? minMonth / maxMonth : 0;
  const puntajeEstabilidad = interpolate(estabilidadRatio, ESCALA_ESTABILIDAD);

  const score = Math.round(puntajeFlujo * 0.40 + puntajeBreakeven * 0.30 + puntajeEstabilidad * 0.30);

  let detail = "";
  if (flujoCajaMensual >= 0) detail = `Flujo positivo $${Math.round(flujoCajaMensual).toLocaleString('es-CL')}/mes`;
  else detail = `Flujo -$${Math.abs(Math.round(flujoCajaMensual)).toLocaleString('es-CL')}/mes. Break-even al ${Math.round(breakEvenPctDelMercado * 100)}% del mercado`;

  return { score, label: "Sostenibilidad", detail, peso: 25 };
}

// ============================================================
// DIMENSIÓN 3: VENTAJA vs LTR (25%)
// ============================================================

const ESCALA_SOBRENTA: [number, number][] = [
  [0.60, 100],
  [0.40, 85],
  [0.25, 70],
  [0.15, 55],
  [0.05, 40],
  [0.00, 30],
  [-0.10, 15],
  [-0.25, 0],
];

function calcVentaja(sobreRentaPct: number): DimensionScore {
  const score = Math.round(interpolate(sobreRentaPct, ESCALA_SOBRENTA));

  let detail = "";
  if (sobreRentaPct >= 0.20) detail = `STR genera +${Math.round(sobreRentaPct * 100)}% más que arriendo largo`;
  else if (sobreRentaPct >= 0.05) detail = `STR genera +${Math.round(sobreRentaPct * 100)}% más — ventaja moderada`;
  else if (sobreRentaPct >= 0) detail = `STR y LTR generan similar — el esfuerzo extra no se justifica`;
  else detail = `LTR gana por ${Math.abs(Math.round(sobreRentaPct * 100))}% — STR no conviene`;

  return { score, label: "Ventaja vs LTR", detail, peso: 25 };
}

// ============================================================
// DIMENSIÓN 4: FACTIBILIDAD (25%)
// ============================================================

const REVENUE_BENCHMARKS: Record<number, number> = {
  0: 6500000,
  1: 8200000,
  2: 11500000,
  3: 15000000,
};

const ESCALA_REVENUE_RELATIVO: [number, number][] = [
  [1.8, 100],
  [1.4, 85],
  [1.0, 65],
  [0.75, 45],
  [0.50, 25],
  [0.30, 5],
];

function calcTipologia(dormitorios: number, superficie: number): number {
  if (dormitorios === 1 && superficie <= 50) return 100;
  if (dormitorios === 0 && superficie <= 35) return 95;
  if (dormitorios === 1 && superficie <= 70) return 85;
  if (dormitorios === 2 && superficie <= 65) return 80;
  if (dormitorios === 0 && superficie > 40) return 75;
  if (dormitorios === 2 && superficie <= 90) return 65;
  if (dormitorios === 3 && superficie <= 90) return 45;
  if (dormitorios === 3 && superficie > 90) return 30;
  if (dormitorios >= 4) return 15;
  return 60;
}

function calcRegulacion(regulacion: string): number {
  if (regulacion === 'si') return 100;
  if (regulacion === 'no_seguro' || regulacion === 'no_estoy_seguro') return 45;
  if (regulacion === 'no') return 5;
  return 45;
}

function calcAtractores(lat: number, lng: number, distanciaMetro: number): { score: number; detail: string } {
  const metroScore = distanciaMetro <= 400 ? 100 :
    distanciaMetro <= 700 ? 85 + (700 - distanciaMetro) / 300 * 15 :
    distanciaMetro <= 1000 ? 70 + (1000 - distanciaMetro) / 300 * 15 :
    distanciaMetro <= 1500 ? 50 + (1500 - distanciaMetro) / 500 * 20 :
    distanciaMetro <= 2500 ? 30 + (2500 - distanciaMetro) / 1000 * 20 :
    distanciaMetro <= 4000 ? 10 + (4000 - distanciaMetro) / 1500 * 20 :
    10;

  const clinica = distanciaMinima(lat, lng, CLINICAS);
  const clinicaScore = clinica.distancia <= 1000 ? 100 :
    clinica.distancia <= 2000 ? 75 + (2000 - clinica.distancia) / 1000 * 25 :
    clinica.distancia <= 3000 ? 50 + (3000 - clinica.distancia) / 1000 * 25 :
    clinica.distancia <= 5000 ? 25 + (5000 - clinica.distancia) / 2000 * 25 :
    clinica.distancia <= 8000 ? (8000 - clinica.distancia) / 3000 * 25 :
    0;

  const allNegociosTurismo = [...ZONAS_NEGOCIOS, ...ZONAS_TURISTICAS];
  const nt = distanciaMinima(lat, lng, allNegociosTurismo);
  const ntScore = nt.distancia <= 1000 ? 100 :
    nt.distancia <= 2000 ? 80 + (2000 - nt.distancia) / 1000 * 20 :
    nt.distancia <= 3000 ? 60 + (3000 - nt.distancia) / 1000 * 20 :
    nt.distancia <= 5000 ? 35 + (5000 - nt.distancia) / 2000 * 25 :
    nt.distancia <= 8000 ? 10 + (8000 - nt.distancia) / 3000 * 25 :
    10;

  const ski = distanciaMinima(lat, lng, ACCESO_SKI);
  const skiRaw = ski.distancia <= 10000 ? 100 :
    ski.distancia <= 15000 ? 80 + (15000 - ski.distancia) / 5000 * 20 :
    ski.distancia <= 25000 ? 55 + (25000 - ski.distancia) / 10000 * 25 :
    ski.distancia <= 35000 ? 30 + (35000 - ski.distancia) / 10000 * 25 :
    ski.distancia <= 50000 ? 5 + (50000 - ski.distancia) / 15000 * 25 :
    5;
  const skiScore = Math.max(skiRaw, 30);

  const score = Math.round(
    metroScore * 0.35 +
    clinicaScore * 0.25 +
    ntScore * 0.25 +
    skiScore * 0.15
  );

  const highScores = [metroScore, clinicaScore, ntScore, skiScore].filter(s => s >= 60).length;
  const bonus = highScores >= 3 ? 5 : 0;

  const finalScore = Math.min(100, score + bonus);

  const detail = `Metro: ${Math.round(distanciaMetro)}m · Clínica: ${clinica.nombre} (${Math.round(clinica.distancia)}m) · ${nt.nombre} (${Math.round(nt.distancia)}m)`;

  return { score: finalScore, detail };
}

function calcFactibilidad(inputs: ScoreSTRInputs): DimensionScore {
  const benchmark = REVENUE_BENCHMARKS[inputs.dormitorios] || REVENUE_BENCHMARKS[1];
  const revenueRatio = benchmark > 0 ? inputs.revenueP50 / benchmark : 0;
  const puntajeRevenue = interpolate(revenueRatio, ESCALA_REVENUE_RELATIVO);

  const puntajeTipologia = calcTipologia(inputs.dormitorios, inputs.superficie);

  const puntajeRegulacion = calcRegulacion(inputs.regulacionEdificio);

  const atractores = calcAtractores(inputs.lat, inputs.lng, inputs.distanciaMetro);

  const score = Math.round(
    puntajeRevenue * 0.30 +
    puntajeTipologia * 0.20 +
    puntajeRegulacion * 0.25 +
    atractores.score * 0.25
  );

  let detail = "";
  if (score >= 70) detail = `Buena zona y tipología para Airbnb. ${atractores.detail}`;
  else if (score >= 45) detail = `Zona aceptable. ${atractores.detail}`;
  else detail = `Zona con fundamentos débiles para STR. ${atractores.detail}`;

  return { score, label: "Factibilidad", detail, peso: 25 };
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export function calcFrancoScoreSTR(inputs: ScoreSTRInputs): FrancoScoreSTR {
  const base = inputs.results.escenarios.base;

  const rentabilidad = calcRentabilidad(base.capRate);
  const sostenibilidad = calcSostenibilidad(
    base.flujoCajaMensual,
    inputs.results.breakEvenPctDelMercado,
    inputs.monthlyRevenue
  );
  const ventaja = calcVentaja(inputs.results.comparativa.sobreRentaPct);
  const factibilidad = calcFactibilidad(inputs);

  let score = Math.round(
    rentabilidad.score * 0.25 +
    sostenibilidad.score * 0.25 +
    ventaja.score * 0.25 +
    factibilidad.score * 0.25
  );
  score = Math.max(0, Math.min(100, score));

  // Commit E.1 · 2026-05-13: thresholds unificados LTR+STR a 70 / 45 / 0
  // (skill analysis-voice-franco §1.7 · audit-commit-e-metodologia §2.4).
  // Antes: 65 / 40. Bandas coherentes con slider visual de 3 segmentos.
  let veredicto: 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA';
  if (score >= 70) veredicto = 'COMPRAR';
  else if (score >= 45) veredicto = 'AJUSTA SUPUESTOS';
  else veredicto = 'BUSCAR OTRA';

  // Gates explícitos (audit §2.4). Orden: BUSCAR (severos) → max AJUSTA
  // (degrade COMPRAR) → resto se respeta del score base.
  let overrideApplied: string | null = null;
  const sobreRentaPct = inputs.results.comparativa.sobreRentaPct;
  const coc = base.cashOnCash; // decimal (-0.10 = -10%)
  const beRatio = inputs.results.breakEvenPctDelMercado; // 1.00 = break-even al precio del mercado

  // GATE 1 — fuerza BUSCAR OTRA (señales estructurales severas).
  if (inputs.regulacionEdificio === 'no') {
    veredicto = 'BUSCAR OTRA';
    overrideApplied = 'Edificio no permite Airbnb — operación inviable';
  } else if (coc < -0.30) {
    veredicto = 'BUSCAR OTRA';
    overrideApplied = 'Cash-on-Cash <-30% — pérdida estructural insostenible';
  } else if (beRatio > 1.30) {
    veredicto = 'BUSCAR OTRA';
    overrideApplied = 'Break-even >130% del mercado — depende de occ/ADR fuera de alcance';
  } else if (base.flujoCajaMensual < -250000 && sobreRentaPct < 0.10) {
    veredicto = 'BUSCAR OTRA';
    overrideApplied = 'Flujo muy negativo sin ventaja clara sobre LTR';
  } else if (base.capRate < 0.02) {
    veredicto = 'BUSCAR OTRA';
    overrideApplied = 'CAP Rate bajo 2% — NOI mínimo, no justifica operación STR';
  }

  // GATE 2 — máximo AJUSTA SUPUESTOS (degrade COMPRAR; nunca toca BUSCAR).
  if (veredicto === 'COMPRAR') {
    if (sobreRentaPct < 0) {
      veredicto = 'AJUSTA SUPUESTOS';
      overrideApplied = 'LTR genera más que STR — máximo AJUSTA SUPUESTOS';
    } else if (coc < -0.10) {
      veredicto = 'AJUSTA SUPUESTOS';
      overrideApplied = 'Cash-on-Cash <-10% — esfuerzo mensual significativo';
    } else if (beRatio > 1.10) {
      veredicto = 'AJUSTA SUPUESTOS';
      overrideApplied = 'Break-even >110% del mercado — margen operativo apretado';
    }
  }

  return {
    score,
    veredicto,
    overrideApplied,
    desglose: { rentabilidad, sostenibilidad, ventaja, factibilidad },
  };
}
