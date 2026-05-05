import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";
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
  tir: number;
  capRate: number;
  cashOnCash: number;
  paybackAnios: number | null;
  multiplo: number;
  valorVenta: number;
  saldoCredito: number;
  inversionInicial: number;
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

  // inversionInicial = pieCLP + 2% gastos cierre + cuotasPieTotal (cuando aplica
  // entrega futura con pie en cuotas). Coherente con motor.cashOnCash que ya
  // las cuenta como capital invertido. Si entrega inmediata, cuotasPieTotal=0.
  const inversionInicial =
    metrics.pieCLP +
    Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT) +
    (metrics.cuotasPieTotal ?? 0);

  // Cap Rate sale del motor y no depende del slider.
  const capRate = metrics.capRate ?? 0;

  // Cash-on-Cash: flujo anual promedio / inversion inicial × 100.
  const flujoAcumuladoPlazo = usable.reduce((s, p) => s + p.flujoAnual, 0);
  const flujoAnualPromedio =
    effectivePlazo > 0 ? flujoAcumuladoPlazo / effectivePlazo : 0;
  const cashOnCash =
    inversionInicial > 0 ? (flujoAnualPromedio / inversionInicial) * 100 : 0;

  // Payback (con venta): año en que el acumulado del flujo operativo +
  // (valorVenta − deuda − comisión 2%) de ese año cubre la inversión inicial.
  // Depende de la plusvalía: al vender más caro, recuperas antes.
  let paybackAnios: number | null = null;
  let flujoAcumIter = 0;
  for (let i = 0; i < projections.length; i++) {
    const p = projections[i];
    flujoAcumIter += p.flujoAnual;
    const cajaSiVendiera = p.valorPropiedad - p.saldoCredito - Math.round(p.valorPropiedad * 0.02);
    const totalRecuperado = flujoAcumIter + cajaSiVendiera;
    if (totalRecuperado >= inversionInicial) {
      paybackAnios = i + 1;
      break;
    }
  }

  return {
    tir: exit.tir,
    capRate,
    cashOnCash,
    paybackAnios,
    multiplo: exit.multiplicadorCapital,
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
