"use client";

import SliderSimulacion from "@/components/analysis/SliderSimulacion";
import { Indicators } from "./Indicators";
import { PatrimonioChart } from "./PatrimonioChart";
import { SaleRefiBlock } from "./SaleRefiBlock";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";

/**
 * Simulación (rediseño extras · familia recesiva).
 *
 * D2 — SIN colapso: siempre visible. Murió el CTA-anzuelo + las preguntas +
 * "Explorar escenarios".
 * D1 — Superficie recesiva: panel hundido bajo los hallazgos sólidos de la
 * pirámide. Sin border-left de acento, sin kicker mono; la seña es la omisión.
 * D3 — Orden interno: sliders (controlan todo) → dos columnas protagonistas
 * (izq patrimonio · der venta/refinanciamiento) → strip de indicadores
 * subordinado abajo.
 * D5 — Numeración 07-10 eliminada. El disclaimer de honestidad se conserva
 * (vive en SliderSimulacion + el sub-header "Tu veredicto no cambia").
 *
 * Lee plazo/plusvalía del SimulationContext via los sub-componentes.
 */
export function AdvancedSection({
  projections,
  metrics,
  inputData,
  currency,
  valorUF,
}: {
  projections: YearProjection[];
  metrics: AnalysisMetrics;
  inputData: AnalisisInput;
  currency: "CLP" | "UF";
  valorUF: number;
}) {
  // Sub-header de columna: label mono (SIN número) + título serif.
  const subhead = (label: string, title: string) => (
    <div style={{ marginBottom: 14 }}>
      <span
        className="font-mono uppercase block mb-1"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "var(--franco-text-tertiary)" }}
      >
        {label}
      </span>
      <h3
        className="font-heading font-bold m-0"
        style={{ fontSize: 18, lineHeight: 1.25, color: "var(--franco-text)" }}
      >
        {title}
      </h3>
    </div>
  );

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--franco-text) 2.5%, transparent)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: 16,
        padding: "22px 24px 26px",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--franco-text) 3%, transparent)",
      }}
    >
      {/* Header — título serif + sub, SIN kicker mono (seña recesiva = omisión) */}
      <div style={{ paddingBottom: 18, borderBottom: "0.5px solid var(--franco-border)" }}>
        <h2
          className="font-heading font-bold m-0"
          style={{ fontSize: 22, lineHeight: 1.2, color: "var(--franco-text)" }}
        >
          Simula plazo y plusvalía
        </h2>
        <p
          className="font-body m-0"
          style={{ fontSize: 13, marginTop: 5, color: "var(--franco-text-secondary)" }}
        >
          Mueve los supuestos y mira cómo responden el patrimonio y las estrategias de salida. Tu
          veredicto no cambia.
        </p>
      </div>

      {/* Sliders — controlan ambas columnas y el strip */}
      <div style={{ marginTop: 20 }}>
        <SliderSimulacion variant="integrated" />
      </div>

      {/* Dos columnas protagonistas (D3): izq patrimonio · der venta/refi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{ marginTop: 22 }}>
        <div className="min-w-0">
          {subhead("Patrimonio", "Cómo crece tu capital")}
          <PatrimonioChart
            projections={projections}
            metrics={metrics}
            inputData={inputData}
            currency={currency}
            valorUF={valorUF}
          />
        </div>
        <div className="min-w-0">
          {subhead("Venta o refinanciamiento", "Cómo materializas la inversión")}
          <SaleRefiBlock
            projections={projections}
            metrics={metrics}
            inputData={inputData}
            currency={currency}
            valorUF={valorUF}
          />
        </div>
      </div>

      {/* Strip de indicadores — resumen técnico subordinado, abajo (D3/D4) */}
      <div style={{ marginTop: 22 }}>
        <Indicators projections={projections} metrics={metrics} inputData={inputData} />
      </div>
    </div>
  );
}
