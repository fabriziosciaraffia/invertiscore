"use client";

import { useSimulation } from "@/contexts/SimulationContext";
import { Info } from "lucide-react";

export default function SliderSimulacion({ variant = "card" }: { variant?: "card" | "integrated" }) {
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

      {/* Plazo */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="font-body" style={{ fontSize: 14, color: "var(--franco-text)" }}>
            Plazo de análisis
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
          <span className="font-body" style={{ fontSize: 14, color: "var(--franco-text)" }}>
            Plusvalía anual
          </span>
          <span
            className="font-mono font-bold"
            style={{ fontSize: 14, color: "var(--franco-text)" }}
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
          className="w-full h-1 cursor-pointer"
          style={sliderStyles}
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
      </div>

      {/* Disclaimer */}
      <div
        className="flex items-center gap-1.5 mt-4 pt-3"
        style={{
          borderTop: "0.5px dashed color-mix(in srgb, var(--franco-text) 15%, transparent)",
          fontFamily: "var(--font-mono, 'JetBrains Mono'), monospace",
          fontSize: 10,
          letterSpacing: 1,
          color: "color-mix(in srgb, var(--franco-text) 55%, transparent)",
        }}
      >
        <Info size={12} />
        <span>Los números de arriba no cambian con estos ajustes</span>
        <span
          className="ml-auto cursor-help"
          style={{ color: "color-mix(in srgb, var(--franco-text) 70%, transparent)" }}
          title="Los indicadores de arriba (veredicto, aporte mensual, TIR 10 años, etc.) se calculan con los datos originales del análisis y no se modifican al mover los controles. Para cambiar esos valores, debes crear un nuevo análisis."
        >
          ⓘ
        </span>
      </div>
    </div>
  );
}
