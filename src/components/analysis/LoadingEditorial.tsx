"use client";

import { useEffect, useState } from "react";
import FrancoLogo from "@/components/franco-logo";

const STEPS = [
  "Comparando propiedades cercanas",
  "Calculando dividendo, contribuciones y vacancia",
  "Proyectando flujo y plusvalía a 10 años",
  "Generando análisis de zona y POIs",
  "Redactando veredicto final",
];

// Timing por step (ms desde mount). Index 0 está activo en t=0.
const STEP_TRIGGERS_MS = [6000, 15000, 30000, 45000];

interface LoadingEditorialProps {
  isDataReady?: boolean;
}

export function LoadingEditorial({ isDataReady = false }: LoadingEditorialProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timers = STEP_TRIGGERS_MS.map((t, i) =>
      setTimeout(() => setActiveIdx((s) => Math.max(s, i + 1)), t),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Si los datos están listos, saltar al último step.
  useEffect(() => {
    if (isDataReady) setActiveIdx(STEPS.length - 1);
  }, [isDataReady]);

  return (
    // Overlay fixed full-page: cubre cualquier contenido detrás (results-client
    // inner usage durante carga de aiAnalysis tenía secciones visibles abajo).
    // bg opaco — no semi-transparente — para no exponer el layout subyacente.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: "var(--franco-bg)" }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: "var(--franco-card)",
          border: "0.5px solid var(--franco-border)",
          borderRadius: 12,
          padding: "32px 28px",
        }}
      >
        {/* Wordmark canónico (FrancoLogo): 're' italic ghost + 'franco' bold
            + '.ai' Sans semibold Signal Red @ 0.35em. Reusamos el componente
            para garantizar exact match con header en producción. */}
        <div className="flex justify-center mb-3">
          <FrancoLogo size="lg" />
        </div>

        {/* Tagline italic */}
        <p
          className="text-center m-0 mb-7"
          style={{
            fontFamily: "var(--font-heading), Georgia, serif",
            fontStyle: "italic",
            fontSize: 17,
            lineHeight: 1.4,
            color: "color-mix(in srgb, var(--franco-text) 70%, transparent)",
          }}
        >
          Estamos siendo francos con tu inversión.
        </p>

        {/* Lista de estados */}
        <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
          {STEPS.map((label, i) => {
            const isActive = i === activeIdx;
            const isDone = i < activeIdx;
            const dotBg = isActive
              ? "var(--signal-red)"
              : isDone
                ? "var(--franco-text)"
                : "color-mix(in srgb, var(--franco-text) 20%, transparent)";
            const textOpacity = isActive ? 1 : isDone ? 0.85 : 0.35;
            const textWeight = isActive ? 500 : 400;

            return (
              <li
                key={i}
                className="flex items-center gap-3"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 12,
                  color: "var(--franco-text)",
                  opacity: textOpacity,
                  fontWeight: textWeight,
                }}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isActive ? "loading-pulse-dot" : ""}`}
                  style={{ background: dotBg }}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </li>
            );
          })}
        </ul>

        {/* Footer disclaimer */}
        <div className="mt-7 pt-4" style={{ borderTop: "0.5px dashed var(--franco-border)" }}>
          <p
            className="text-center m-0 font-mono uppercase"
            style={{
              fontSize: 9,
              letterSpacing: "0.06em",
              color: "var(--franco-text-tertiary)",
            }}
          >
            Esto puede tomar hasta 60 segundos · No cierres la página
          </p>
        </div>

        <style jsx>{`
          .loading-pulse-dot {
            animation: loadingPulse 1.4s ease-in-out infinite;
          }
          @keyframes loadingPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}
