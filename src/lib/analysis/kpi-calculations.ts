import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";
import { metricaODefault } from "@/lib/types";
import { calcExitScenario } from "@/lib/analysis";

const GASTOS_CIERRE_PCT = 0.02;

export interface KPIInputs {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  plazoAnios: number;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  plusvaliaAnual: number; // reactividad se logra vía projections ya recomputadas con esta plusvalía
  input?: AnalisisInput; // opcional: el motor no lo usa hoy
}

export interface KPIResults {
  // Pie cero (fase 3b): null = "no aplica" (sin capital propio). Aplica a las 4
  // métricas sobre capital — INCLUIDOS el CoC y el payback que este módulo
  // calcula por su cuenta sobre inversionInicial (con pie 0 esa base son solo
  // los gastos de cierre y daba un CoC −200% falso; hallazgo del mockup 98e2319).
  tir: number | null;
  capRate: number;
  cashOnCash: number | null;
  paybackAnios: number | null;
  multiplo: number | null;
  valorVenta: number;
  saldoCredito: number;
  inversionInicial: number;
  /** true ⇔ pieCLP === 0: el render muestra el tratamiento D1 en las 4. */
  sinCapitalPropio: boolean;
  /**
   * Pre-entrega: el horizonte del slider no alcanza la escritura, así que no
   * hay venta que modelar y el payback NO se emite. `paybackAnios` viene null,
   * pero la superficie NO puede mostrar ">30" — es un estado distinto, con su
   * propio sublabel D1. Espeja el guard de SaleRefiBlock ("No puedes vender ni
   * refinanciar antes de la entrega") sobre la misma AdvancedSection.
   */
  paybackPreEntrega: boolean;
  /**
   * Años de la serie anteriores a la escritura (0 ⇒ entrega inmediata). Fuente
   * ÚNICA del "esto es un depto en construcción" para las superficies de este
   * strip — el caveat del tooltip de TIR lo lee de acá en vez de mirar
   * `estadoVenta`, que dejaba fuera "blanco" y "verde".
   */
  aniosPreEntrega: number;
}

export type Tone = "good" | "warn" | "bad" | "neutral";

/**
 * Cantidad de años iniciales de la serie que caen antes de la escritura, leída
 * del PREFIJO de años con deuda 0. `calcProjections` deja `saldoCredito = 0`
 * mientras `mesFin < mesesPreEntrega` (el banco no cursa hasta escriturar), así
 * que ese prefijo ES la pre-entrega, medida sobre la misma serie que alimenta el
 * payback. Entrega inmediata ⇒ el año 1 ya trae deuda ⇒ 0.
 *
 * Por qué la serie y no `metrics.preEntrega.aniosEspera`, que es lo que usa
 * patrimonio-series: ese campo se empezó a persistir el 2026-06-29 y falta en 31
 * de los 47 análisis pre-entrega del parque, así que como predicado único dejaría
 * el bug vivo en dos tercios de los casos. Donde ambas fuentes existen marcan la
 * MISMA frontera: el prefijo mide `aniosEspera − 1`, y el primer año que evalúa
 * el payback es `aniosEspera` en las dos (verificado en las 16 filas que traen el
 * campo). Y NUNCA `estadoVenta === "futura"`: deja fuera "blanco" y "verde", que
 * son 15 de los 47.
 *
 * El guard de crédito descarta el falso positivo de una compra sin deuda (pie
 * 100%), donde la serie entera tendría saldo 0 sin haber pre-entrega alguna.
 * Barrido: 0 falsos positivos sobre los 658 análisis de entrega inmediata.
 */
function contarAniosPreEntrega(projections: YearProjection[], metrics: AnalysisMetrics): number {
  if (!(metrics.precioCLP > (metrics.pieCLP ?? 0))) return 0;
  let n = 0;
  for (const p of projections) {
    if (p.saldoCredito > 0) break;
    n++;
  }
  return n >= projections.length ? 0 : n;
}

export function calculateKPIs(inp: KPIInputs): KPIResults {
  const { projections, metrics, plazoAnios, input } = inp;

  // Fuente única de verdad: el motor de exitScenario. Reactividad viene de
  // pasar `projections` ya recomputadas con la plusvalía del slider.
  const usable = projections.slice(0, Math.min(plazoAnios, projections.length));
  const effectivePlazo = usable.length;

  // input no se usa dentro de calcExitScenario hoy, pero el signature lo pide.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placeholderInput: AnalisisInput = (input ?? {}) as any;
  const exit = calcExitScenario(placeholderInput, metrics, projections, effectivePlazo);

  // inversionInicial = pieCLP + 2% gastos cierre + corretaje inicial (usados,
  // análisis nuevos). Las cuotas de pie durante construcción NO se suman aparte:
  // ya están contenidas en pieCLP. Coherente con motor (calcMetrics +
  // calcExitScenario). Modelo A — Item 9 auditoría.
  const inversionInicial =
    metrics.pieCLP + Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT) +
    (metrics.corretajeInicialCLP ?? 0);

  // Cap Rate sale del motor y no depende del slider.
  const capRate = metrics.capRate ?? 0;

  // Cash-on-Cash: flujo anual promedio / inversion inicial × 100.
  const flujoAcumuladoPlazo = usable.reduce((s, p) => s + p.flujoAnual, 0);
  const flujoAnualPromedio =
    effectivePlazo > 0 ? flujoAcumuladoPlazo / effectivePlazo : 0;
  const cashOnCash =
    inversionInicial > 0 ? (flujoAnualPromedio / inversionInicial) * 100 : 0;

  // Años pre-entrega = el PREFIJO inicial de la serie con deuda 0. Es el criterio
  // del propio motor leído sobre la serie que este módulo ya recibe:
  // calcProjections deja `saldoCredito = 0` mientras `mesFin < mesesPreEntrega`.
  const aniosPreEntrega = contarAniosPreEntrega(projections, metrics);
  // El horizonte elegido no incluye ningún año post-escritura: no hay salida que
  // modelar. Hermano del `horizonBeforeDelivery` de SaleRefiBlock, medido sobre
  // la serie en vez de sobre la fecha (ver contarAniosPreEntrega).
  const paybackPreEntrega = aniosPreEntrega > 0 && plazoAnios <= aniosPreEntrega;

  // Payback (con venta): año en que el acumulado del flujo operativo +
  // (valorVenta − deuda − comisión 2%) de ese año cubre la inversión inicial.
  // Depende de la plusvalía: al vender más caro, recuperas antes.
  //
  // Los años pre-entrega NO son candidatos. Ahí `saldoCredito` vale 0 porque el
  // banco no cursa hasta la escritura (correcto para el flujo), pero el saldo
  // del precio sigue siendo deuda con la inmobiliaria: tomar esa caja como
  // "vendo y recupero" modelaba vender un depto que no recibiste y regalarte el
  // 80% que todavía debes. Con ~22% de inversión inicial contra el 98% del
  // valor, la condición se cumplía en el año 1 por construcción.
  //
  // El acumulado de flujo SÍ sigue corriendo por esos años (el año que cruza la
  // escritura trae flujo parcial) y el año que se reporta se sigue contando
  // DESDE LA COMPRA, no desde la entrega: así el payback de dos análisis
  // distintos se puede comparar sobre el mismo eje.
  let paybackAnios: number | null = null;
  let flujoAcumIter = 0;
  for (let i = 0; i < projections.length; i++) {
    const p = projections[i];
    flujoAcumIter += p.flujoAnual;
    if (p.anio <= aniosPreEntrega) continue;
    const cajaSiVendiera = p.valorPropiedad - p.saldoCredito - Math.round(p.valorPropiedad * 0.02);
    const totalRecuperado = flujoAcumIter + cajaSiVendiera;
    if (totalRecuperado >= inversionInicial) {
      paybackAnios = i + 1;
      break;
    }
  }

  // Pie cero (fase 3b): sin capital propio las 4 métricas sobre capital son
  // null (no aplica) — el simulador nunca muestra un CoC/payback calculado
  // sobre gastos de cierre. Cap Rate y los montos absolutos no cambian.
  const sinCapitalPropio = metrics.pieCLP === 0;

  return {
    tir: sinCapitalPropio ? null : metricaODefault(exit.tir, 0),
    capRate,
    cashOnCash: sinCapitalPropio ? null : cashOnCash,
    paybackAnios: sinCapitalPropio || paybackPreEntrega ? null : paybackAnios,
    multiplo: sinCapitalPropio ? null : metricaODefault(exit.multiplicadorCapital, 0),
    sinCapitalPropio,
    // Sin capital propio manda: la celda ya muestra el D1 de pie cero y no hay
    // dos sublabels que apilar. Con pie > 0 el estado pre-entrega es el suyo.
    paybackPreEntrega: !sinCapitalPropio && paybackPreEntrega,
    aniosPreEntrega,
    valorVenta: exit.valorVenta,
    saldoCredito: exit.saldoCredito,
    inversionInicial,
  };
}

// ─── Tonos semánticos por KPI ──────────────────────
export function tonoTIR(tir: number): Tone {
  if (tir >= 8) return "good";
  if (tir >= 4) return "warn";
  return "bad";
}

export function tonoCapRate(cr: number): Tone {
  if (cr >= 5) return "good";
  if (cr >= 3) return "warn";
  return "bad";
}

export function tonoCashOnCash(coc: number): Tone {
  if (coc >= 0) return "good";
  if (coc >= -5) return "warn";
  return "bad";
}

export function tonoPayback(p: number | null): Tone {
  if (p === null) return "bad";
  if (p <= 5) return "good";
  if (p <= 10) return "warn";
  return "bad";
}

// Múltiplo: ajustado para análisis típico de 10 años. 2x sin contexto temporal
// es aspiracional; 1.5x al año 10 ≈ 4.1% TIR (decente). Umbral bad < 1x = pérdida
// nominal real (no recuperaste lo que pusiste).
export function tonoMultiplo(m: number): Tone {
  if (m >= 1.5) return "good";
  if (m >= 1.0) return "warn";
  return "bad";
}
