"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { id: 1, label: "Geocoding lat/lng" },
  { id: 2, label: "Comparables radio 500m" },
  { id: 3, label: "Calculando TIR y flujos" },
  { id: 4, label: "Proyección plusvalía 10A" },
  { id: 5, label: "Veredicto Franco Score" },
];

interface LoadingFrancoProps {
  isDataReady?: boolean;
}

export function LoadingFranco({ isDataReady = false }: LoadingFrancoProps) {
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep((s) => Math.max(s, 2)), 600);
    const t2 = setTimeout(() => setActiveStep((s) => Math.max(s, 3)), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!isDataReady) return;
    const t3 = setTimeout(() => setActiveStep((s) => Math.max(s, 4)), 300);
    const t4 = setTimeout(() => setActiveStep((s) => Math.max(s, 5)), 600);
    const t5 = setTimeout(() => setActiveStep((s) => Math.max(s, 6)), 900);
    return () => {
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isDataReady]);

  return (
    <div
      className="min-h-[480px] flex items-center justify-center p-12"
      style={{ background: "var(--franco-bg)" }}
    >
      <div className="text-center" style={{ maxWidth: 460 }}>
        <div
          style={{
            fontFamily: "var(--font-heading), Georgia, serif",
            fontSize: 24,
            color: "var(--franco-text)",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontStyle: "italic",
              color:
                "color-mix(in srgb, var(--franco-text) 45%, transparent)",
            }}
          >
            re
          </span>
          <span style={{ fontWeight: 600 }}>franco</span>
        </div>

        <div
          className="text-left mx-auto"
          style={{
            maxWidth: 300,
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
          }}
        >
          {STEPS.map((step, i) => {
            const stepNumber = i + 1;
            const isDone = stepNumber < activeStep;
            const isActive = stepNumber === activeStep;
            const isPending = stepNumber > activeStep;

            return (
              <div
                key={step.id}
                className="flex gap-2.5 items-center py-1.5"
                style={{ opacity: isPending ? 0.3 : 1 }}
              >
                <span
                  style={{
                    color: isDone
                      ? "#5DCAA5"
                      : isActive
                      ? "#C8323C"
                      : "color-mix(in srgb, var(--franco-text) 30%, transparent)",
                    fontSize: isDone || isActive ? 14 : 12,
                    width: 14,
                    display: "inline-block",
                    textAlign: "center",
                  }}
                >
                  {isDone || isActive ? "●" : "○"}
                </span>
                <span
                  style={{
                    color: isActive
                      ? "var(--franco-text)"
                      : "color-mix(in srgb, var(--franco-text) 70%, transparent)",
                    flex: 1,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    color: isDone
                      ? "color-mix(in srgb, var(--franco-text) 35%, transparent)"
                      : "#C8323C",
                    fontSize: 10,
                    minWidth: 20,
                    textAlign: "right",
                  }}
                >
                  {isDone ? "OK" : isActive ? <AnimatedDots /> : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AnimatedDots() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setCount((c) => (c % 3) + 1);
    }, 400);
    return () => clearInterval(t);
  }, []);

  return <span>{".".repeat(count)}</span>;
}
