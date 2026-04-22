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

  const inversionInicial =
    metrics.pieCLP + Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);

  // Cap Rate sale del motor y no depende del slider.
  const capRate = metrics.capRate ?? 0;

  // Cash-on-Cash: flujo anual promedio / inversion inicial × 100.
  const flujoAcumuladoPlazo = usable.reduce((s, p) => s + p.flujoAnual, 0);
  const flujoAnualPromedio =
    effectivePlazo > 0 ? flujoAcumuladoPlazo / effectivePlazo : 0;
  const cashOnCash =
    inversionInicial > 0 ? (flujoAnualPromedio / inversionInicial) * 100 : 0;

  // Payback: año en que el acumulado (-inversión inicial + flujo) cruza 0.
  // No depende de la plusvalía (no incluye venta).
  let paybackAnios: number | null = null;
  let acum = -inversionInicial;
  for (let i = 0; i < projections.length; i++) {
    acum += projections[i].flujoAnual;
    if (acum >= 0) {
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
  if (p <= 10) return "good";
  if (p <= 20) return "warn";
  return "bad";
}

export function tonoMultiplo(m: number): Tone {
  if (m >= 2) return "good";
  if (m >= 1.3) return "warn";
  return "bad";
}
