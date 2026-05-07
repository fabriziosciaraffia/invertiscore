"use client";

import { useMemo } from "react";
import {
  calculateKPIs,
  tonoTIR,
  tonoCapRate,
  tonoCashOnCash,
  tonoPayback,
  tonoMultiplo,
} from "@/lib/analysis/kpi-calculations";
import KPICard from "@/components/analysis/KPICard";
import { useSimulation } from "@/contexts/SimulationContext";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";

/**
 * Sub-sección 08 · INDICADORES (Patrón 7.B.2). Renderea 5 KPIs:
 * TIR, CAP Rate, Cash-on-Cash, Payback (con venta), Múltiplo.
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.2). Lee plazo y
 * plusvalía del SimulationContext — el componente padre debe envolverse en
 * <SimulationProvider>.
 */
export function Indicators({
  projections,
  metrics,
  inputData,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData?: AnalisisInput;
}) {
  const { plazoAnios, plusvaliaAnual } = useSimulation();
  const kpis = useMemo(
    () => calculateKPIs({ projections, metrics, plazoAnios, plusvaliaAnual }),
    [projections, metrics, plazoAnios, plusvaliaAnual]
  );
  const plazoLabel = `${plazoAnios} ${plazoAnios === 1 ? "AÑO" : "AÑOS"}`;
  const paybackValue = kpis.paybackAnios ? `Año ${kpis.paybackAnios}` : ">30";

  // Modelo B3: la plusvalía solo se acumula desde la entrega. Para depto en
  // construcción, el tooltip de TIR explica el supuesto.
  const entregaFutura = inputData?.estadoVenta === "futura";
  const tirTooltipBase =
    "Tasa Interna de Retorno: rentabilidad anual proyectada de toda la inversión incluyendo flujo, plusvalía y venta al cierre del horizonte.";
  const tirTooltip = entregaFutura
    ? `${tirTooltipBase} En depto en construcción, la plusvalía cuenta solo desde la entrega.`
    : tirTooltipBase;

  // P1 Fase 24 — guard NaN/Infinity en KPIs derivados de cálculos iterativos.
  // calcTIR puede no converger en escenarios extremos; resto puede dar NaN
  // por divisiones inesperadas.
  const fmtPct = (v: number) =>
    Number.isFinite(v) ? `${v.toFixed(1)}%` : "—";
  const fmtMultiplo = (v: number) =>
    Number.isFinite(v) ? `${v.toFixed(2)}x` : "—";
  const subSafe = (v: number, normal: string) =>
    Number.isFinite(v) ? normal : "No converge";

  return (
    <div className="flex flex-col gap-2.5">
      {/* 2 hero KPIs arriba */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <KPICard
          label={`TIR @ ${plazoLabel}`}
          value={fmtPct(kpis.tir)}
          sub={subSafe(kpis.tir, "Retorno total anualizado")}
          tone={tonoTIR(kpis.tir)}
          size="hero"
          tooltip={tirTooltip}
        />
        <KPICard
          label="CAP Rate"
          value={fmtPct(kpis.capRate)}
          sub={subSafe(kpis.capRate, "Rendimiento bruto sobre precio")}
          tone={tonoCapRate(kpis.capRate)}
          size="hero"
          tooltip="Rendimiento bruto anual del arriendo sobre el precio del depto, sin considerar financiamiento ni costos."
        />
      </div>

      {/* 3 secundarios abajo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <KPICard
          label={`Cash-on-Cash @ ${plazoLabel}`}
          value={fmtPct(kpis.cashOnCash)}
          sub={subSafe(kpis.cashOnCash, "Flujo / inversión")}
          tone={tonoCashOnCash(kpis.cashOnCash)}
          size="small"
          tooltip="Flujo neto anual sobre lo que aportaste de tu bolsillo (pie + cierre + flujos negativos acumulados)."
        />
        <KPICard
          label="Payback (con venta)"
          value={paybackValue}
          sub="Año en que recuperas toda la inversión"
          tone={tonoPayback(kpis.paybackAnios)}
          size="small"
          tooltip="Año desde la compra en que el patrimonio neto acumulado iguala lo que aportaste, contando la venta del depto."
        />
        <KPICard
          label={`Múltiplo @ ${plazoLabel}`}
          value={fmtMultiplo(kpis.multiplo)}
          sub={subSafe(kpis.multiplo, "Retorno total / inversión")}
          tone={tonoMultiplo(kpis.multiplo)}
          size="small"
          tooltip="Cuánto recibes al final por cada peso aportado. Múltiplo 2x = recibes el doble de lo que pusiste."
        />
      </div>
    </div>
  );
}
