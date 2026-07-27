// ─────────────────────────────────────────────────────────────────────────
// Serie del Chart de Patrimonio (Patrón 7.B.3) — builder PURO, fuente única.
//
// Extraído verbatim del useMemo de src/components/analysis/PatrimonioChart.tsx
// (Ronda 4a.2) para que la vista web (Recharts) y la vista documento (SVG
// estático server-side) consuman EXACTAMENTE la misma serie — cero recálculo
// divergente. La lógica no cambió; sólo dejó de vivir dentro del useMemo.
//
// Semántica (ver comentarios originales del chart):
//  - aporteAcum: inversión inicial (pie + 2% cierre + corretaje) + cuotas pie
//    prorrateadas + |min(0, flujoAcumulado)|. NO es capitalInvertido del motor.
//  - valorDepto: p.valorPropiedad; null pre-entrega (activo aún no recibido).
//  - patrimonioNeto: valor − deuda post-entrega; = aporteAcum pre-entrega.
// ─────────────────────────────────────────────────────────────────────────

import type { YearProjection, AnalysisMetrics, AnalisisInput } from "./types";

export interface PatrimonioRow {
  anio: number;
  aporteAcum: number;
  valorDepto: number | null;
  patrimonioNeto: number;
  flujoAcumulado: number;
  deudaPendiente: number;
  isPreEntrega: boolean;
}

export function buildPatrimonioSeries(
  projections: YearProjection[],
  metrics: AnalysisMetrics,
  inputData: AnalisisInput,
  valorUF: number,
  plazoAnios: number,
): PatrimonioRow[] {
  const pieCLP = metrics.pieCLP ?? 0;
  const precioCLP = metrics.precioCLP ?? 0;
  const creditoInicial = Math.max(precioCLP - pieCLP, 0);
  const gastosCierre = Math.round(precioCLP * 0.02);

  const vmFrancoUF = metrics.valorMercadoFrancoUF ?? 0;
  const vmFrancoCLP = vmFrancoUF > 0 ? vmFrancoUF * valorUF : precioCLP;

  const totalCuotas = inputData.cuotasPie > 0 ? inputData.cuotasPie : 0;
  const montoCuota = inputData.montoCuota > 0 ? inputData.montoCuota : 0;
  const enCuotasPie = totalCuotas > 0 && montoCuota > 0;

  const inversionInicial = pieCLP + gastosCierre + (metrics.corretajeInicialCLP ?? 0);

  const rows: PatrimonioRow[] = [];

  const isEntregaFutura = inputData.estadoVenta === "futura";
  const deudaA0 = isEntregaFutura ? 0 : creditoInicial;

  const mesesPreEntregaCalc = (() => {
    if (!inputData.fechaEntrega || inputData.estadoVenta === "inmediata") return 0;
    const [a, me] = inputData.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const ent = new Date(a, (me || 1) - 1);
    const meses = Math.round((ent.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0, meses);
  })();
  const aniosEntregaInternal = Math.ceil(mesesPreEntregaCalc / 12);

  const a0PreEntrega = 0 < aniosEntregaInternal;
  rows.push({
    anio: 0,
    aporteAcum: inversionInicial,
    valorDepto: a0PreEntrega ? null : vmFrancoCLP,
    patrimonioNeto: a0PreEntrega ? inversionInicial : vmFrancoCLP - deudaA0,
    flujoAcumulado: 0,
    deudaPendiente: deudaA0,
    isPreEntrega: a0PreEntrega,
  });

  for (let i = 1; i <= plazoAnios; i++) {
    const p = projections[i - 1];
    if (!p) break;
    const cuotasPagadasHastaI = enCuotasPie
      ? Math.min(totalCuotas, i * 12) * montoCuota
      : 0;
    const aporteAcum =
      inversionInicial + cuotasPagadasHastaI + Math.abs(Math.min(0, p.flujoAcumulado));
    const isPreEntrega = i < aniosEntregaInternal;
    rows.push({
      anio: i,
      aporteAcum,
      valorDepto: isPreEntrega ? null : p.valorPropiedad,
      patrimonioNeto: isPreEntrega ? aporteAcum : p.valorPropiedad - p.saldoCredito,
      flujoAcumulado: p.flujoAcumulado,
      deudaPendiente: p.saldoCredito,
      isPreEntrega,
    });
  }
  return rows;
}
