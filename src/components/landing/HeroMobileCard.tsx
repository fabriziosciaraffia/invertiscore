"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Card del Hero en formato iPhone frame con dynamic island.
 *
 * Recibe `internalStep` que orquesta la entrada escalonada del contenido
 * interno:
 *   0 → frame visible, header app (refranco.ai + ↗)
 *   1 → caso (eyebrow + título + metadata)
 *   2 → "FRANCO SCORE" label
 *   3 → counter 0→61 + score bar 0→61% en paralelo
 *   4 → badge "Ajusta"
 *   5 → 3 KPI cards stagger 150ms
 *   6 → caja Franco (label rojo + cita italic, sin avatar)
 *
 * `skipToFinal` fuerza render del estado completo de inmediato
 * (cuando el usuario hace scroll o prefers-reduced-motion).
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const SCORE = 61;

export default function HeroMobileCard({
  internalStep,
  skipToFinal = false,
}: {
  internalStep: number;
  skipToFinal?: boolean;
}) {
  const reduce = useReducedMotion();
  const showAll = skipToFinal || !!reduce;

  const step = (n: number) => showAll || internalStep >= n;

  return (
    <div className="relative" style={{ width: 340, maxWidth: "100%" }}>
      {/* Frame exterior estilo iPhone */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "#0F0F0F",
          borderRadius: 40,
          padding: 8,
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.45), 0 12px 24px -12px rgba(0,0,0,0.35)",
        }}
      >
        {/* Bezel interior con bg de tema */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "var(--landing-card-bg)",
            borderRadius: 32,
            minHeight: 690,
          }}
        >
          {/* Dynamic island */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: 10,
              width: 110,
              height: 28,
              background: "#0F0F0F",
              borderRadius: 14,
              zIndex: 10,
            }}
            aria-hidden="true"
          />

          {/* Status bar */}
          <div
            className="flex items-center justify-between px-6 pt-3"
            style={{ height: 44 }}
          >
            <span
              className="font-mono font-semibold text-[var(--landing-text)]"
              style={{ fontSize: 13 }}
            >
              9:41
            </span>
            <span
              className="flex items-center gap-1 text-[var(--landing-text)]"
              aria-hidden="true"
            >
              {/* Signal bars */}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
                <rect x="0" y="6" width="2" height="4" rx="0.5" />
                <rect x="3.5" y="4" width="2" height="6" rx="0.5" />
                <rect x="7" y="2" width="2" height="8" rx="0.5" />
                <rect x="10.5" y="0" width="2" height="10" rx="0.5" />
              </svg>
              {/* Battery */}
              <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
                <rect
                  x="0.5"
                  y="0.5"
                  width="18"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeOpacity="0.55"
                />
                <rect x="2" y="2" width="14" height="7" rx="1" fill="currentColor" />
                <rect
                  x="20"
                  y="3.5"
                  width="1.5"
                  height="4"
                  rx="0.75"
                  fill="currentColor"
                  fillOpacity="0.55"
                />
              </svg>
            </span>
          </div>

          {/* App content */}
          <div className="px-5 pb-6 pt-2">
            {/* a) Header app: wordmark + ↗ */}
            <motion.div
              initial={false}
              animate={
                step(0)
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 0 }
              }
              transition={{ duration: 0.4, ease: EASE }}
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: "var(--landing-divider)" }}
            >
              <span className="inline-flex items-baseline">
                <span
                  className="font-heading italic font-light"
                  style={{
                    fontSize: 14,
                    color: "var(--landing-wm-re)",
                    marginRight: "-0.08em",
                  }}
                >
                  re
                </span>
                <span
                  className="font-heading font-bold"
                  style={{ fontSize: 14, color: "var(--landing-wm-franco)" }}
                >
                  franco
                </span>
                <span
                  className="font-body font-semibold text-[#C8323C]"
                  style={{ fontSize: 8, marginLeft: 1, letterSpacing: "0.1em" }}
                >
                  .ai
                </span>
              </span>
              <span
                className="font-mono text-[var(--landing-text-muted)]"
                style={{ fontSize: 12 }}
                aria-hidden="true"
              >
                ↗
              </span>
            </motion.div>

            {/* b) Caso (eyebrow + título + metadata) */}
            <motion.div
              initial={false}
              animate={
                step(1)
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
              }
              transition={{ duration: 0.4, ease: EASE }}
              className="mt-4"
            >
              <p
                className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                style={{ fontSize: 9, letterSpacing: "0.14em" }}
              >
                Análisis · Ejemplo
              </p>
              <p
                className="mt-1 font-heading font-bold leading-tight text-[var(--landing-text)]"
                style={{ fontSize: 16 }}
              >
                Depto 2D2B Providencia
              </p>
              <p
                className="mt-0.5 font-mono text-[var(--landing-text-secondary)]"
                style={{ fontSize: 11 }}
              >
                UF 5.500 · 60 m²
              </p>
            </motion.div>

            {/* c) Franco Score label + (d) counter + score bar */}
            <div className="mt-5">
              <motion.p
                initial={false}
                animate={step(2) ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                style={{ fontSize: 9, letterSpacing: "0.16em" }}
              >
                Franco Score
              </motion.p>

              <div className="mt-2 flex items-baseline justify-between">
                <ScoreNumber active={step(3)} skipToFinal={showAll} />

                {/* Badge "Ajusta" */}
                <motion.span
                  initial={false}
                  animate={
                    step(4)
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.9 }
                  }
                  transition={{ duration: 0.3, ease: EASE }}
                  className="inline-flex items-center rounded-md border font-mono font-semibold uppercase"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    padding: "4px 8px",
                    borderColor: "rgba(200,50,60,0.45)",
                    background: "rgba(200,50,60,0.06)",
                    color: "#C8323C",
                  }}
                >
                  Ajusta
                </motion.span>
              </div>

              {/* Score bar */}
              <ScoreBar active={step(3)} skipToFinal={showAll} />
              <div
                className="mt-2 flex justify-between font-mono uppercase text-[var(--landing-text-muted)]"
                style={{ fontSize: 8, letterSpacing: "0.12em" }}
              >
                <span>Buscar otra</span>
                <span>Ajustar</span>
                <span>Comprar</span>
              </div>
            </div>

            {/* f) 3 KPI cards stack */}
            <div className="mt-4 grid grid-cols-1 gap-2">
              {KPIS.map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={false}
                  animate={
                    step(5)
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 12 }
                  }
                  transition={{
                    duration: 0.4,
                    ease: EASE,
                    delay: showAll ? 0 : 0.15 * i,
                  }}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                  style={{
                    background: "var(--landing-card-bg-soft)",
                    borderColor: "var(--landing-card-border)",
                  }}
                >
                  <span
                    className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
                    style={{ fontSize: 8, letterSpacing: "0.12em" }}
                  >
                    {kpi.label}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      fontSize: 12,
                      color: kpi.red ? "#C8323C" : "var(--landing-text)",
                    }}
                  >
                    {kpi.value}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* g) Caja Franco SIN avatar */}
            <motion.div
              initial={false}
              animate={
                step(6) ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
              }
              transition={{ duration: 0.5, ease: EASE }}
              className="mt-4 rounded-r-md py-3 pl-3 pr-3"
              style={{
                borderLeft: "3px solid #C8323C",
                background: "rgba(200,50,60,0.06)",
              }}
            >
              <p
                className="font-mono font-semibold uppercase text-[#C8323C]"
                style={{ fontSize: 9, letterSpacing: "0.14em" }}
              >
                Siendo franco
              </p>
              <p
                className="mt-1 font-body italic leading-snug text-[var(--landing-text-secondary)]"
                style={{ fontSize: 11 }}
              >
                &ldquo;Buena ubicación, precio incómodo. Negocia hasta UF
                4.900 y opera en Airbnb.&rdquo;
              </p>
            </motion.div>
          </div>

          {/* Home indicator */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: 6,
              width: 60,
              height: 4,
              background: "var(--landing-text)",
              opacity: 0.5,
              borderRadius: 2,
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

const KPIS = [
  { label: "Aporte mes", value: "−$290K", red: true },
  { label: "Sugerido", value: "UF 4.900" },
  { label: "Δ Airbnb", value: "+$148K" },
];

function ScoreNumber({
  active,
  skipToFinal,
}: {
  active: boolean;
  skipToFinal: boolean;
}) {
  const count = useMotionValue(skipToFinal ? SCORE : 0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(skipToFinal ? SCORE : 0);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [rounded]);

  useEffect(() => {
    if (skipToFinal) {
      count.set(SCORE);
      setDisplay(SCORE);
      return;
    }
    if (!active) return;
    const controls = animate(count, SCORE, {
      duration: 1.2,
      ease: EASE,
    });
    return () => controls.stop();
  }, [active, skipToFinal, count]);

  return (
    <span
      className="font-heading font-bold leading-none tracking-tight text-[var(--landing-text)]"
      style={{ fontSize: 72 }}
    >
      {display}
      <span
        className="font-heading"
        style={{ fontSize: 24, color: "var(--landing-text-muted)" }}
      >
        /100
      </span>
    </span>
  );
}

function ScoreBar({
  active,
  skipToFinal,
}: {
  active: boolean;
  skipToFinal: boolean;
}) {
  const pct = useMotionValue(skipToFinal ? SCORE : 0);
  const width = useTransform(pct, (v) => `${v}%`);
  const left = useTransform(pct, (v) => `${v}%`);

  useEffect(() => {
    if (skipToFinal) {
      pct.set(SCORE);
      return;
    }
    if (!active) return;
    const controls = animate(pct, SCORE, { duration: 1.2, ease: EASE });
    return () => controls.stop();
  }, [active, skipToFinal, pct]);

  return (
    <div
      className="relative mt-3 h-1 w-full overflow-visible rounded-full"
      style={{ background: "var(--landing-divider)" }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width,
          background:
            "linear-gradient(90deg, #C8323C 0%, #888780 60%, #B4B2A9 100%)",
        }}
      />
      <motion.div
        className="absolute h-[10px] w-[10px] rounded-full border-2"
        style={{
          left,
          top: -3,
          background: "var(--landing-bg)",
          borderColor: "var(--landing-text)",
          transform: "translateX(-50%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
