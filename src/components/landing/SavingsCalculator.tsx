"use client";

import { useState } from "react";
import { calcOptions, fmtCLP } from "@/lib/pricing";

/**
 * Calculadora de ahorro (/pricing · F.11 Phase 2.38). Slider de volumen
 * (1-100 análisis/mes) → tabla comparativa del costo EFECTIVO a ese volumen
 * por plan (incluye overage a precio individual), con la recomendación
 * resaltada. Usa @/lib/pricing como fuente.
 *
 * Theming: vive en /pricing. Header/slider/subtexto (sobre el bg de página)
 * usan tokens --franco-* (theme-aware). La card de la tabla replica las cards
 * de planes (blanca hardcodeada, theme-independent) para consistencia visual.
 *
 * SAFE: slider nativo (overlay invisible sobre track custom) + useState; tabla
 * siempre montada (map sobre 4 opciones); valores por state, sin mount/unmount
 * ni framer-motion. Transiciones por CSS.
 */

const RED = "#C8323C";
const CARD_TEXT = "#0F0F0F";
const CARD_MUTED = "rgba(15,15,15,0.55)";
const CARD_DIVIDER = "rgba(15,15,15,0.10)";
const MIN = 1;
const MAX = 100;
const TICKS = [1, 10, 50, 100];

export default function SavingsCalculator() {
  const [n, setN] = useState(15);
  const options = calcOptions(n);
  const rec = options.find((o) => o.recommended);
  const pct = ((n - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="mx-auto max-w-[680px]">
      {/* Header */}
      <h3
        className="mx-auto max-w-[540px] text-center font-heading font-bold text-[var(--franco-text)]"
        style={{ fontSize: "clamp(22px, 2.5vw, 28px)", lineHeight: 1.15 }}
      >
        ¿Cuántos análisis haces al mes?
      </h3>

      {/* Valor actual */}
      <p
        className="mt-6 text-center font-mono font-bold"
        style={{ fontSize: 14, color: "var(--franco-text)" }}
      >
        {n} análisis / mes
      </p>

      {/* Slider · track custom (bg + fill Signal Red) + input nativo invisible */}
      <div className="relative mt-3" style={{ height: 16 }}>
        <div
          aria-hidden="true"
          style={{ position: "absolute", top: 6, left: 0, right: 0, height: 4, borderRadius: 2, background: "var(--franco-border)" }}
        />
        <div
          aria-hidden="true"
          style={{ position: "absolute", top: 6, left: 0, width: `${pct}%`, height: 4, borderRadius: 2, background: RED, transition: "width 80ms linear" }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: `${pct}%`,
            transform: "translateX(-50%)",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: RED,
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            transition: "left 80ms linear",
          }}
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-label="Análisis por mes"
          className="absolute inset-0 m-0 w-full cursor-pointer opacity-0"
          style={{ height: 16 }}
        />
      </div>

      {/* Tickmarks */}
      <div className="relative mt-2" style={{ height: 14 }}>
        {TICKS.map((t) => (
          <span
            key={t}
            className="absolute font-mono uppercase text-[var(--franco-text-muted)]"
            style={{
              left: `${((t - MIN) / (MAX - MIN)) * 100}%`,
              transform: t === MIN ? "none" : t === MAX ? "translateX(-100%)" : "translateX(-50%)",
              fontSize: 10,
              letterSpacing: "0.08em",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Tabla comparativa · card blanca (igual que cards de planes) */}
      <div
        className="mt-7 overflow-hidden rounded-2xl"
        style={{ background: "#FFFFFF", border: "0.5px solid rgba(15,15,15,0.10)" }}
      >
        {options.map((o, i) => {
          const perAnalysis = Math.round(o.cost / n);
          return (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 px-6 py-3.5"
              style={{
                borderTop: i === 0 ? "none" : `0.5px solid ${CARD_DIVIDER}`,
                borderLeft: o.recommended ? `3px solid ${RED}` : "3px solid transparent",
                background: o.recommended ? "color-mix(in srgb, #C8323C 8%, #FFFFFF)" : "transparent",
                transition: "background 200ms ease, border-color 200ms ease",
              }}
            >
              <span className="flex items-center gap-2.5">
                <span className="font-body font-semibold" style={{ fontSize: 14, color: CARD_TEXT }}>
                  {o.label}
                </span>
                {o.recommended && (
                  <span
                    className="font-mono font-bold uppercase"
                    style={{ fontSize: 9, letterSpacing: "0.14em", color: RED }}
                  >
                    Recomendado
                  </span>
                )}
              </span>
              <span className="flex items-baseline gap-2 whitespace-nowrap text-right">
                <span className="font-mono font-bold" style={{ fontSize: 15, color: o.recommended ? RED : CARD_TEXT }}>
                  {fmtCLP(o.cost)}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color: CARD_MUTED }}>
                  /mes ({fmtCLP(perAnalysis)}/u)
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Subtexto · recomendación + ahorro */}
      {rec && (
        <p className="mt-4 text-center font-body" style={{ fontSize: 13, color: "var(--franco-text-secondary)" }}>
          Para {n} análisis/mes te conviene{" "}
          <span className="font-semibold text-[var(--franco-text)]">{rec.label}</span>
          {rec.savings > 0 && (
            <>
              {" "}· Ahorras{" "}
              <span className="font-semibold" style={{ color: RED }}>{fmtCLP(rec.savings)}</span>{" "}
              vs comprarlos sueltos
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}
