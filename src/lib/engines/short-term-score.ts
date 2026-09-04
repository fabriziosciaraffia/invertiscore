import { ShortTermResult } from './short-term-engine';
import { metricaValorONull } from '../types';
import { CLINICAS, ZONAS_NEGOCIOS, ZONAS_TURISTICAS, ACCESO_SKI, distanciaMinima } from '../data/str-attractors';
import { findNearestStation } from '../metro-stations';

// ============================================================
// TIPOS
// ============================================================

/**
 * Brazos de los gates STR, evaluados de forma INDEPENDIENTE.
 *
 * Espejo de `Gate1Brazos` en LTR (analysis.ts). Antes los gates vivían como una cadena
 * if/else-if y solo sobrevivía el primer motivo que matcheaba; acá cada brazo se evalúa
 * por su cuenta y el veredicto sale del OR, de modo que las superficies pueden decir
 * "no cierra por tres razones" en vez de nombrar una y callar dos.
 *
 * Convención de nombres: prefijo `g1_` fuerza BUSCAR OTRA · `g2_` capa COMPRAR a AJUSTA.
 */
export interface GatesBrazosSTR {
  /** El edificio no permite Airbnb: la operación es inviable, no cara. */
  g1_regulacion: boolean;
  /** Cash-on-Cash < −30%: pérdida estructural sobre el capital propio. */
  g1_cocSevero: boolean;
  /** Break-even > 130% del nivel de la zona: depende de occ/ADR fuera de alcance. */
  g1_beInviable: boolean;
  /** Flujo < −$250.000 Y sin ventaja clara sobre el arriendo largo. */
  g1_flujoSevero: boolean;
  /** CAP rate < 2%: el NOI no justifica montar la operación. */
  g1_capRateMinimo: boolean;
  /** El arriendo largo rinde más neto que el corto. */
  g2_ltrGana: boolean;
  /** Cash-on-Cash < −10%: esfuerzo mensual significativo. */
  g2_cocFuerte: boolean;
  /** Flujo negativo y el horizonte a 10 años no lo compensa. */
  g2_flujoSinHorizonte: boolean;
  /** Break-even > 110% del nivel de la zona: margen operativo apretado. */
  g2_beApretado: boolean;
}

export type BrazoSTR = keyof GatesBrazosSTR;

/** Precedencia de GATE 1 — el orden ES el de la cadena if/else-if original. */
export const G1_BRAZOS = [
  'g1_regulacion', 'g1_cocSevero', 'g1_beInviable', 'g1_flujoSevero', 'g1_capRateMinimo',
] as const satisfies readonly BrazoSTR[];

/** Precedencia de GATE 2 — idem. */
export const G2_BRAZOS = [
  'g2_ltrGana', 'g2_cocFuerte', 'g2_flujoSinHorizonte', 'g2_beApretado',
] as const satisfies readonly BrazoSTR[];

/**
 * Glosa técnica por brazo — texto IDÉNTICO al que la cadena original ponía en
 * `overrideApplied`, para no mover el contrato de los scripts de auditoría que lo leen.
 * NO es copy de producto: las superficies usan `no-cierra-copy.ts`.
 */
export const GLOSA_BRAZO: Record<BrazoSTR, string> = {
  g1_regulacion: 'Edificio no permite Airbnb — operación inviable',
  g1_cocSevero: 'Cash-on-Cash <-30% — pérdida estructural insostenible',
  g1_beInviable: 'Break-even >130% del mercado — depende de occ/ADR fuera de alcance',
  g1_flujoSevero: 'Flujo muy negativo sin ventaja clara sobre LTR',
  g1_capRateMinimo: 'CAP Rate bajo 2% — NOI mínimo, no justifica operación STR',
  g2_ltrGana: 'LTR genera más que STR — máximo AJUSTA SUPUESTOS',
  g2_cocFuerte: 'Cash-on-Cash <-10% — esfuerzo mensual significativo',
  g2_flujoSinHorizonte: 'Flujo mensual negativo sin retorno de horizonte que lo compense (TIR <10% y multiplicador de equity insuficiente)',
  g2_beApretado: 'Break-even >110% del mercado — margen operativo apretado',
};

/**
 * Evalúa los 9 brazos por separado. PURA — no decide veredicto, solo mide condiciones.
 *
 * Pie cero: con CoC 'no_aplica' (`coc === null`) los dos brazos de CoC quedan en false —
 * se OMITEN, ni true ni false conceptualmente, y manda el brazo de flujo. Es la misma
 * decisión que ya tomaba la cadena original al saltarse el `else if` por el guard
 * `coc !== null`.
 */
export function evalGatesSTR(p: {
  regulacionEdificio: string;
  /** Cash-on-Cash en DECIMAL (−0,10 = −10%). null ⇒ no aplica (pie cero). */
  coc: number | null;
  beRatio: number;
  flujoCajaMensual: number;
  sobreRentaPct: number;
  capRate: number;
  horizonteCierraFavorable: boolean;
}): GatesBrazosSTR {
  return {
    g1_regulacion: p.regulacionEdificio === 'no',
    g1_cocSevero: p.coc !== null && p.coc < -0.30,
    g1_beInviable: p.beRatio > 1.30,
    g1_flujoSevero: p.flujoCajaMensual < -250000 && p.sobreRentaPct < 0.10,
    g1_capRateMinimo: p.capRate < 0.02,
    g2_ltrGana: p.sobreRentaPct < 0,
    g2_cocFuerte: p.coc !== null && p.coc < -0.10,
    g2_flujoSinHorizonte: p.flujoCajaMensual < 0 && !p.horizonteCierraFavorable,
    g2_beApretado: p.beRatio > 1.10,
  };
}

export interface FrancoScoreSTR {
  score: number;
  veredicto: 'COMPRAR' | 'AJUSTA SUPUESTOS' | 'BUSCAR OTRA';
  /**
   * Glosa técnica del brazo de mayor precedencia entre los que decidieron. Se conserva
   * por contrato con los scripts de auditoría. Las superficies NO deben usarlo: dice UN
   * motivo cuando puede haber varios — usá `gates.motivos`.
   */
  overrideApplied: string | null;
  /** Brazos evaluados independientes + todos los motivos que sostienen el veredicto. */
  gates: {
    brazos: GatesBrazosSTR;
    gate1: boolean;
    gate2: boolean;
    /** Brazos activos que DECIDIERON el veredicto, en orden de precedencia. */
    motivos: BrazoSTR[];
  };
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

  ingresoP50: number;
  ingresoMensualScore: number[];

  // Remediación metro 2026-06: `distanciaMetro` deprecado. La distancia a metro
  // se deriva de lat/lng dentro de calcAtractores (findNearestStation, filtro
  // "active"), fuente única igual que clínica/negocios/ski. El wizard nunca
  // enviaba este campo → caía siempre al default 2000m, infravalorando metro.
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
  ingresoMensualScore: number[]
): DimensionScore {
  const puntajeFlujo = interpolate(flujoCajaMensual, ESCALA_FLUJO);

  const puntajeBreakeven = interpolate(breakEvenPctDelMercado, ESCALA_BREAKEVEN);

  const minMonth = ingresoMensualScore.length > 0 ? Math.min(...ingresoMensualScore) : 0;
  const maxMonth = ingresoMensualScore.length > 0 ? Math.max(...ingresoMensualScore) : 0;
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

// Distancia "metro lejano" usada cuando no hay estación derivable (sin coords o
// sin estaciones activas en el dataset). >4000m → cae al tramo final (score 10).
const METRO_FALLBACK_DIST = 5000;

function calcAtractores(lat: number, lng: number): { score: number; detail: string } {
  // Remediación metro 2026-06: la distancia a metro se deriva de lat/lng (fuente
  // única, igual que clínica/negocios/ski) vía findNearestStation con filtro
  // "active" (excluye estaciones futuras L7/L8/L9). Antes venía del param
  // `distanciaMetro` que el wizard nunca enviaba → default 2000m sistemático.
  const distanciaMetro = findNearestStation(lat, lng, "active")?.distance ?? METRO_FALLBACK_DIST;
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
  const ingresoRatio = benchmark > 0 ? inputs.ingresoP50 / benchmark : 0;
  const puntajeIngreso = interpolate(ingresoRatio, ESCALA_REVENUE_RELATIVO);

  const puntajeTipologia = calcTipologia(inputs.dormitorios, inputs.superficie);

  const puntajeRegulacion = calcRegulacion(inputs.regulacionEdificio);

  const atractores = calcAtractores(inputs.lat, inputs.lng);

  const score = Math.round(
    puntajeIngreso * 0.30 +
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
    inputs.ingresoMensualScore
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
  // decimal (-0.10 = -10%). Pie cero: null = 'no_aplica' ⇒ los brazos CoC de los
  // gates se OMITEN (ni true ni false) y manda el brazo de flujo (opción a).
  // metricaValorONull tolera también el number crudo de results legacy.
  const coc = metricaValorONull(base.cashOnCash);
  const beRatio = inputs.results.breakEvenPctDelMercado; // 1.00 = break-even al precio del mercado

  // Gate flujo-negativo (2026-06): si el escenario base deja flujo mensual
  // negativo, COMPRAR solo se sostiene si el horizonte cierra favorablemente
  // (equity + plusvalía compensan el aporte mensual). Doctrina: "flujo negativo
  // != mala inversión; mala es cuando flujo neg + plusvalía + equity no cierran".
  // tir en PORCENTAJE nominal a 10 años (9.16 = 9,16%); multCap ratio crudo.
  // Umbral RE-DERIVADO en la rama comparabilidad-motores. `multiplicadorCapital` pasó a la
  // semántica EXACTA de LTR — equity(SIN flujo) / totalAportado(inicial + Σ aportes<0),
  // matando el doble-conteo latente. Bajo la nueva aritmética el multiplicador baja; el
  // corte se re-deriva para PRESERVAR los veredictos del corpus (sweep read-only, N=46:
  // rango cero-flips [2,52 · 4,0]; el brazo-mult está inactivo hoy — todo horizonte
  // favorable viene por TIR≥10 — así que 2,65 preserva 46/46 con headroom sobre el máximo
  // observado 2,514). Ver of-ambas-rama0-design §Deliverable 4.
  const HORIZONTE_TIR_MINIMO = 10;        // TIR nominal % a 10 años.
  const HORIZONTE_MULT_MINIMO = 2.65;     // equity(sin flujo)/totalAportado (re-derivado).
  const exit = inputs.results.exitScenario;
  // RAMA B · pie cero (decisión cerrada, opción 1): sin capital propio el
  // horizonte NO SE PUEDE MEDIR — TIR y multiplicador son ambos 'no_aplica' ⇒
  // null ⇒ el brazo entero queda false y GATE 2 degrada el COMPRAR que tenga
  // flujo negativo. Es deliberado: sin pie no hay retorno sobre capital que
  // compense poner plata todos los meses, y el corto no tiene el contrapeso
  // patrimonial que el largo sí tiene vía dividendo. Un COMPRAR no puede
  // descansar en una TIR que sube porque el capital baja.
  // Con pie > 0 (y con legacy number crudo) la lectura es byte-idéntica a la
  // previa: metricaValorONull devuelve exactamente el mismo número.
  const tir = metricaValorONull(exit?.tirAnual);
  const multCap = metricaValorONull(exit?.multiplicadorCapital);
  const horizonteCierraFavorable =
    exit != null &&
    tir !== null && Number.isFinite(tir) && tir !== 0 &&
    ((tir >= HORIZONTE_TIR_MINIMO) || (multCap !== null && multCap >= HORIZONTE_MULT_MINIMO));

  // Brazos evaluados de forma INDEPENDIENTE (espejo de evalGate1Brazos en LTR).
  // Antes esto era una cadena if/else-if: el primer brazo que matcheaba cortaba la
  // evaluación, así que `overrideApplied` guardaba UNO de varios motivos activos y
  // el resto quedaba invisible. Medido sobre 96 análisis: 44 tenían el brazo de
  // break-even inviable prendido pero solo 42 lo mostraban como causa, y 33 de los
  // 51 BUSCAR OTRA tenían DOS O MÁS brazos de Gate 1 a la vez.
  // El veredicto NO cambia: se computa con el mismo OR y la misma precedencia.
  const brazos = evalGatesSTR({
    regulacionEdificio: inputs.regulacionEdificio,
    coc,
    beRatio,
    flujoCajaMensual: base.flujoCajaMensual,
    sobreRentaPct,
    capRate: base.capRate,
    horizonteCierraFavorable,
  });

  const gate1 = G1_BRAZOS.some((k) => brazos[k]);
  if (gate1) veredicto = 'BUSCAR OTRA';

  // GATE 2 — máximo AJUSTA SUPUESTOS (degrade COMPRAR; nunca toca BUSCAR).
  const gate2 = veredicto === 'COMPRAR' && G2_BRAZOS.some((k) => brazos[k]);
  if (gate2) veredicto = 'AJUSTA SUPUESTOS';

  // `overrideApplied` conserva su contrato histórico: UNA glosa, la del brazo de
  // mayor precedencia entre los que efectivamente decidieron. Se mantiene porque hay
  // scripts de auditoría que lo leen; las superficies deben usar `gates.motivos`,
  // que trae TODOS los activos.
  const decisivos = gate1 ? G1_BRAZOS : gate2 ? G2_BRAZOS : [];
  const activosDecisivos = decisivos.filter((k) => brazos[k]);
  overrideApplied = activosDecisivos.length > 0 ? GLOSA_BRAZO[activosDecisivos[0]] : null;

  return {
    score,
    veredicto,
    overrideApplied,
    gates: {
      brazos,
      gate1,
      gate2,
      // Todos los motivos que sostienen el veredicto, en orden de precedencia. Vacío
      // cuando el veredicto salió de la banda del score y ningún gate disparó.
      motivos: activosDecisivos,
    },
    desglose: { rentabilidad, sostenibilidad, ventaja, factibilidad },
  };
}
