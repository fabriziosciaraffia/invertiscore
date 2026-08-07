import type { YearProjection, AnalysisMetrics, AnalisisInput, MetricaTIRSimulador } from "@/lib/types";
import { metricaODefault, metricaNoAplica, metricaNoAplicaHorizonte } from "@/lib/types";
import { calcExitScenario } from "@/lib/analysis";
// Predicado compartido con la comparativa (src/lib/pre-entrega-serie.ts): vivía
// acá y se movió para que las dos superficies no puedan divergir.
import { contarAniosPreEntrega } from "@/lib/pre-entrega-serie";

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
  //
  // La TIR NO se aplana a `number | null`: lleva su razón hasta el render.
  // Tiene TRES ausencias distintas (pie 0, horizonte antes de la escritura, VPN
  // sin raíz) y el aplanado las volvía indistinguibles, así que la superficie no
  // podía hacer más que un "—" pelado. Las otras tres métricas siguen en
  // `number | null` a propósito: solo tienen DOS ausencias y las dos ya se leen
  // de `sinCapitalPropio` / `horizonteAntesDeEntrega`. El 'no_calculable' es
  // exclusivo de la TIR — es el único KPI que sale de un solver.
  tir: MetricaTIRSimulador;
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
   * El horizonte del slider termina ANTES de la escritura. Las 4 métricas de
   * arriba salen null y la superficie muestra el tratamiento D1 con sublabel
   * propio — nunca ">30" ni "0,0%", que serían datos donde no hay dato.
   *
   * Aplica a las 4 porque las 4 dependen de algo que todavía no ocurre: la TIR
   * y el múltiplo liquidan por `equityCLP = valorVenta − saldoCredito − comisión`
   * con `saldoCredito = 0` (la venta que no puedes hacer), el payback busca el
   * año en que esa misma caja cubre lo aportado, y el Cash-on-Cash promedia
   * flujo operativo que aún no empieza. Cap Rate NO entra: sale del motor, no
   * depende del horizonte y ya se rotula "Fijo".
   *
   * Espeja el guard de SaleRefiBlock ("No puedes vender ni refinanciar antes de
   * la entrega") sobre la misma AdvancedSection.
   */
  horizonteAntesDeEntrega: boolean;
  /**
   * Años de la serie anteriores a la escritura (0 ⇒ entrega inmediata). Fuente
   * ÚNICA del "esto es un depto en construcción" para las superficies de este
   * strip — el caveat del tooltip de TIR lo lee de acá en vez de mirar
   * `estadoVenta`, que dejaba fuera "blanco" y "verde".
   */
  aniosPreEntrega: number;
}

export type Tone = "good" | "warn" | "bad" | "neutral";

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
  // modelar ni arriendo que medir. Hermano del `horizonBeforeDelivery` de
  // SaleRefiBlock, medido sobre la serie en vez de sobre la fecha (ver
  // contarAniosPreEntrega). Gatea las 4 métricas — ver KPIResults.
  const horizonteAntesDeEntrega = aniosPreEntrega > 0 && plazoAnios <= aniosPreEntrega;

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

  // Las 4 se apagan por las MISMAS dos razones (sin capital propio · horizonte
  // antes de la escritura). Un solo predicado para que no puedan divergir: que
  // una celda emita mientras sus tres vecinas dicen "No aplica" fue justamente
  // lo que dejó viva la TIR de 345% al lado del payback ya arreglado.
  const noAplica = sinCapitalPropio || horizonteAntesDeEntrega;

  return {
    // TRES razones de ausencia, cada una con su nombre. El orden importa y es
    // el del mockup 98e2319: pie 0 manda sobre horizonte (no hay dos sublabels
    // que apilar), y si ninguna aplica pasa el estado del motor TAL CUAL —
    // 'valor' o 'no_calculable'. Nada se aplana acá: aplanar era el bug.
    tir: sinCapitalPropio
      ? metricaNoAplica(input?.razonSinPie ?? "sin_pie")
      : horizonteAntesDeEntrega
        ? metricaNoAplicaHorizonte(aniosPreEntrega)
        : exit.tir,
    capRate,
    cashOnCash: noAplica ? null : cashOnCash,
    paybackAnios: noAplica ? null : paybackAnios,
    multiplo: noAplica ? null : metricaODefault(exit.multiplicadorCapital, 0),
    sinCapitalPropio,
    // Sin capital propio manda: la celda ya muestra el D1 de pie cero y no hay
    // dos sublabels que apilar. Con pie > 0 el estado pre-entrega es el suyo.
    horizonteAntesDeEntrega: !sinCapitalPropio && horizonteAntesDeEntrega,
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
