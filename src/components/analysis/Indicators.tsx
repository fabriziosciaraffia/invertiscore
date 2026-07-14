"use client";

import { useMemo } from "react";
import {
  calculateKPIs,
  tonoTIR,
  tonoCashOnCash,
  tonoPayback,
  tonoMultiplo,
  type Tone,
} from "@/lib/analysis/kpi-calculations";
import { InfoTooltip } from "@/components/ui/tooltip";
import { useSimulation } from "@/contexts/SimulationContext";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";

/**
 * Strip de indicadores simulados (rediseño extras · D3/D4). Resumen técnico
 * SUBORDINADO que va DEBAJO de las dos columnas protagonistas (patrimonio +
 * venta/refi). Muestra los 4 KPIs que reaccionan a los sliders — TIR,
 * Cash-on-Cash, Payback, Múltiplo — en un strip horizontal recesivo.
 *
 * El Cap Rate queda en una fila FIJA aparte (D4): no varía con los sliders y
 * ya vive como hallazgo en la pirámide, así que no compite con los que sí
 * simulan. Numeración 08 eliminada (D5).
 *
 * Lee plazo y plusvalía del SimulationContext — el componente padre debe
 * envolverse en <SimulationProvider>.
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
  const fmtPct = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}%` : "—");
  const fmtMultiplo = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)}x` : "—");

  // Los 4 que reaccionan a los sliders. tono === "bad" → Signal Red (uso #2
  // valores críticos): Cash-on-Cash negativo, TIR/Múltiplo bajo umbral.
  const cells: Array<{ label: string; value: string; tone: Tone; tooltip: string }> = [
    {
      label: `TIR @ ${plazoLabel}`,
      value: fmtPct(kpis.tir),
      tone: tonoTIR(kpis.tir),
      tooltip: tirTooltip,
    },
    {
      label: `Cash-on-Cash @ ${plazoLabel}`,
      value: fmtPct(kpis.cashOnCash),
      tone: tonoCashOnCash(kpis.cashOnCash),
      tooltip:
        "Flujo anual promedio sobre tu inversión inicial del día uno (pie + gastos de cierre + corretaje).",
    },
    {
      label: "Payback (con venta)",
      value: paybackValue,
      tone: tonoPayback(kpis.paybackAnios),
      tooltip:
        "Año desde la compra en que el patrimonio neto acumulado iguala lo que aportaste, contando la venta del depto.",
    },
    {
      label: `Múltiplo @ ${plazoLabel}`,
      value: fmtMultiplo(kpis.multiplo),
      tone: tonoMultiplo(kpis.multiplo),
      tooltip:
        "Cuánto recibes al final por cada peso aportado. Múltiplo 2x = recibes el doble de lo que pusiste.",
    },
  ];

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 3%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      {/* Rótulo del strip: dot "vivo" + leyenda de que reaccionan a los sliders */}
      <div className="flex items-center gap-2 mb-3.5">
        <span
          aria-hidden
          className="inline-block rounded-full shrink-0"
          style={{
            width: 6,
            height: 6,
            background: "var(--franco-text)",
            boxShadow: "0 0 0 3px color-mix(in srgb, var(--franco-text) 12%, transparent)",
          }}
        />
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--franco-text-tertiary)" }}
        >
          Escenario simulado · reaccionan a los sliders
        </span>
      </div>

      {/* Los 4 que simulan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col min-w-0">
            <span
              className="inline-flex items-center gap-1 font-mono uppercase"
              style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--franco-text-tertiary)" }}
            >
              <span>{c.label}</span>
              <InfoTooltip content={c.tooltip} />
            </span>
            <span
              className="font-mono font-bold whitespace-nowrap"
              style={{
                fontSize: 24,
                lineHeight: 1,
                marginTop: 7,
                color: c.tone === "bad" ? "var(--signal-red)" : "var(--franco-text)",
              }}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>

      {/* Cap Rate: fila FIJA (D4) — no varía con los sliders */}
      <div
        className="flex items-center flex-wrap gap-x-3 gap-y-1.5"
        style={{ marginTop: 16, paddingTop: 14, borderTop: "0.5px dashed var(--franco-border)" }}
      >
        <span
          className="inline-flex items-center gap-1 font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.05em", color: "var(--franco-text-tertiary)" }}
        >
          <span>Cap Rate</span>
          <InfoTooltip content="Rendimiento bruto anual del arriendo sobre el precio del depto, sin considerar financiamiento ni costos." />
        </span>
        <span className="font-mono font-bold" style={{ fontSize: 18, color: "var(--franco-text)" }}>
          {fmtPct(kpis.capRate)}
        </span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9,
            letterSpacing: "0.08em",
            color: "var(--franco-text-muted)",
            border: "0.5px solid var(--franco-border-hover)",
            borderRadius: 4,
            padding: "2px 7px",
          }}
        >
          Fijo
        </span>
        <span
          className="font-body"
          style={{ fontSize: 11, color: "var(--franco-text-muted)", marginLeft: "auto" }}
        >
          No cambia con los sliders — ya vive como hallazgo del análisis.
        </span>
      </div>
    </div>
  );
}
