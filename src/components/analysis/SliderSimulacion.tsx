"use client";

import { useSimulation } from "@/contexts/SimulationContext";
import { InfoTooltip } from "@/components/ui/tooltip";

export default function SliderSimulacion({
  variant = "card",
  legacy = false,
}: {
  variant?: "card" | "integrated";
  /** P2 Fase 24 — Análisis legacy sin recompute reactivo (projections estáticas). */
  legacy?: boolean;
}) {
  const { plazoAnios, plusvaliaAnual, setPlazoAnios, setPlusvaliaAnual } = useSimulation();

  const sliderStyles = {
    accentColor: "var(--franco-text)",
  } as React.CSSProperties;

  const wrapperStyle: React.CSSProperties =
    variant === "integrated"
      ? { padding: 0, margin: 0 }
      : {
          background: "color-mix(in srgb, var(--franco-text) 2%, transparent)",
          border: "0.5px solid color-mix(in srgb, var(--franco-text) 12%, transparent)",
          borderRadius: 10,
          padding: "18px 20px",
          margin: "20px 0 24px",
        };

  return (
    <div style={wrapperStyle}>
      {variant === "card" && (
        <span
          className="font-mono uppercase block mb-4"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--franco-text)",
            fontWeight: 600,
          }}
        >
          Simulación
        </span>
      )}

      {/* P1 Fase 24 — Disclaimer prominente sobre los sliders.
          Antes era footer mono 10px gris (fácil de ignorar). Ahora dot pattern
          al inicio para que el user entienda el scope ANTES de mover sliders. */}
      <p className="font-mono text-[11px] mt-0 mb-4 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
        ● Estos ajustes simulan escenarios. Los números del veredicto, costo mensual y largo plazo (arriba) NO cambian — quedan fijos en tu análisis original.
      </p>

      {/* P2 Fase 24 — Disclaimer adicional para análisis legacy. */}
      {legacy && (
        <p className="font-mono text-[11px] mb-4 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
          ● Análisis legacy: el slider de plusvalía no afecta los cálculos. Genera un nuevo análisis para simular escenarios.
        </p>
      )}

      {/* Plazo */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="inline-flex items-center gap-1 font-body" style={{ fontSize: 14, color: "var(--franco-text)" }}>
            <span>Plazo de análisis</span>
            <InfoTooltip content="Horizonte temporal de la proyección. Afecta TIR, payback, múltiplo, patrimonio y la simulación de venta/refinanciamiento." />
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 14, color: "var(--franco-text)" }}
          >
            {plazoAnios} {plazoAnios === 1 ? "año" : "años"}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={plazoAnios}
          onChange={(e) => setPlazoAnios(Number(e.target.value))}
          className="w-full h-1 cursor-pointer"
          style={sliderStyles}
          aria-label="Plazo de análisis en años"
        />
        <div
          className="flex justify-between mt-1 font-mono"
          style={{
            fontSize: 10,
            color: "color-mix(in srgb, var(--franco-text) 50%, transparent)",
          }}
        >
          <span>1 año</span>
          <span>30 años</span>
        </div>
      </div>

      {/* Plusvalía */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span
            className="inline-flex items-center gap-1 font-body"
            style={{
              fontSize: 14,
              color: legacy ? "color-mix(in srgb, var(--franco-text) 50%, transparent)" : "var(--franco-text)",
            }}
          >
            <span>Plusvalía anual</span>
            <InfoTooltip content="Apreciación anual del valor del depto. Default = histórico real de la comuna. Slider permite simular escenarios optimistas o conservadores." />
          </span>
          <span
            className="font-mono font-bold"
            style={{
              fontSize: 14,
              color: legacy ? "color-mix(in srgb, var(--franco-text) 50%, transparent)" : "var(--franco-text)",
            }}
          >
            {plusvaliaAnual.toFixed(1)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={0.1}
          value={plusvaliaAnual}
          onChange={(e) => setPlusvaliaAnual(Number(e.target.value))}
          disabled={legacy}
          className="w-full h-1 cursor-pointer disabled:cursor-not-allowed"
          style={{ ...sliderStyles, opacity: legacy ? 0.5 : 1 }}
          aria-label="Plusvalía anual"
        />
        <div
          className="flex justify-between mt-1 font-mono"
          style={{
            fontSize: 10,
            color: "color-mix(in srgb, var(--franco-text) 50%, transparent)",
          }}
        >
          <span>0%</span>
          <span>15%</span>
        </div>
        {/* P2 Fase 24 — Disclaimer plusvalía irreal sobre 8%. */}
        {plusvaliaAnual > 8 && !legacy && (
          <p className="font-mono text-[11px] mt-2 m-0 leading-[1.5] text-[var(--franco-text-secondary)]">
            ● Plusvalía sobre 8% anual no es realista en proyecciones de largo plazo. Promedio histórico Chile: 3-5%.
          </p>
        )}
      </div>
    </div>
  );
}
