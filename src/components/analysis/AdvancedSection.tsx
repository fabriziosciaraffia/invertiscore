"use client";

import { useState } from "react";
import SliderSimulacion from "@/components/analysis/SliderSimulacion";
import { Indicators } from "./Indicators";
import { PatrimonioChart } from "./PatrimonioChart";
import { SaleRefiBlock } from "./SaleRefiBlock";
import type { YearProjection, AnalysisMetrics, AnalisisInput } from "@/lib/types";

/**
 * Advanced Section unificada (Patrón 7.A/B). Estado colapsado: CTA promocional
 * con preguntas-anzuelo. Estado expandido: una mega-card con 4 sub-secciones
 * separadas por dividers solid (07 Escenarios · 08 Indicadores ·
 * 09 Patrimonio · 10 Venta o Refinanciamiento).
 *
 * Move verbatim desde results-client.tsx LTR (Ronda 4a.2, ex-Capa3Unificado).
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
  const [open, setOpen] = useState(false);

  const sectionHeader = (num: string, label: string, title: string) => (
    <div style={{ marginBottom: 14 }}>
      <span
        className="font-mono uppercase block mb-1.5"
        style={{
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--franco-text-tertiary)",
        }}
      >
        {num} · {label}
      </span>
      <h3
        className="font-heading font-bold m-0"
        style={{ fontSize: 20, lineHeight: 1.25, color: "var(--franco-text)" }}
      >
        {title}
      </h3>
    </div>
  );

  if (!open) {
    // CTA promocional colapsado
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left group transition-colors"
        style={{
          background: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--franco-text) 12%, transparent)",
          borderLeft: "3px solid var(--franco-text)",
          borderRadius: "0 10px 10px 0",
          padding: "22px 24px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 12%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--franco-text) 8%, transparent)")}
      >
        <div
          className="flex items-center gap-2 mb-3"
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "1.5px",
              color: "var(--franco-text)",
              fontWeight: 600,
            }}
          >
            Simulación
          </span>
        </div>

        <div className="mb-2" style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 19, lineHeight: 1.35, color: "var(--franco-text)" }}>
          ¿Qué pasaría si la plusvalía fuera 6%?
        </div>
        <div className="mb-4" style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 19, lineHeight: 1.35, color: "var(--franco-text)" }}>
          ¿Y si vendes en 15 años?
        </div>

        <p
          className="font-body m-0 mb-4"
          style={{
            fontSize: 13,
            color: "color-mix(in srgb, var(--franco-text) 65%, transparent)",
            lineHeight: 1.5,
          }}
        >
          Explora distintos escenarios sin afectar tu análisis principal.
        </p>

        <div className="flex justify-end">
          <span
            className="font-mono uppercase inline-flex items-center gap-1"
            style={{
              fontSize: 11,
              letterSpacing: "1.5px",
              color: "var(--franco-text-secondary)",
              fontWeight: 500,
            }}
          >
            Explorar escenarios
            <span aria-hidden>→</span>
          </span>
        </div>
      </button>
    );
  }

  // Contenido expandido — UNA mega-card con header + 4 sub-secciones separadas
  // por dividers solid (skill Patrón 7.B).
  return (
    <div
      style={{
        background: "var(--franco-card)",
        border: "0.5px solid var(--franco-border)",
        borderRadius: "12px",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Section header único arriba */}
      <div
        className="flex items-start justify-between gap-3"
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "0.5px solid var(--franco-border)",
        }}
      >
        <div>
          <span
            className="font-mono uppercase block mb-1"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              color: "var(--franco-text)",
              fontWeight: 600,
            }}
          >
            Simulación interactiva
          </span>
          <p
            className="font-body m-0"
            style={{
              fontSize: 13,
              color: "var(--franco-text-secondary)",
            }}
          >
            Explora distintos escenarios sin afectar el análisis principal
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar simulación"
          className="shrink-0 rounded-md transition-colors"
          style={{
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--franco-text-secondary)",
            background: "transparent",
            border: "0.5px solid var(--franco-border)",
            cursor: "pointer",
          }}
        >
          ↑
        </button>
      </div>

      {/* Sub-sección 07 · ESCENARIOS */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("07", "Escenarios", "Ajusta plazo y plusvalía")}
        <SliderSimulacion variant="integrated" />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 08 · INDICADORES */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("08", "Indicadores", "Rendimiento y métricas")}
        <Indicators projections={projections} metrics={metrics} inputData={inputData} />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 09 · PATRIMONIO */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("09", "Patrimonio", "Cómo crece tu capital")}
        <PatrimonioChart
          projections={projections}
          metrics={metrics}
          inputData={inputData}
          currency={currency}
          valorUF={valorUF}
        />
      </div>
      <div style={{ borderTop: "0.5px solid var(--franco-border)" }} />

      {/* Sub-sección 10 · VENTA O REFINANCIAMIENTO */}
      <div style={{ padding: "1.25rem" }}>
        {sectionHeader("10", "Venta o refinanciamiento", "Cómo materializas la inversión")}
        <SaleRefiBlock
          projections={projections}
          metrics={metrics}
          inputData={inputData}
          currency={currency}
          valorUF={valorUF}
        />
      </div>
    </div>
  );
}
