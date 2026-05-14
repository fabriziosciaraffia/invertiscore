"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/**
 * Sección 02 · Problema — anti-PowerPoint.
 *
 * Estructura narrativa scroll-driven:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Header sticky (top-24) durante ~30vh                   │
 *   │    Eyebrow "02 · El problema"                           │
 *   │    H2 56-72px mask reveal stagger 150ms                 │
 *   │                                                          │
 *   │  Stat 1 — 4.5% ──────── ~50vh                           │
 *   │  Stat 2 — 5.0% ──────── ~50vh                           │
 *   │  Stat 3 — 31.7% Signal Red ── ~50vh                     │
 *   │                                                          │
 *   │  92.1% gigante con counter 0→92.1 ── ~70vh              │
 *   │                                                          │
 *   │  Cierre: "Antes, comprar era seguro.                    │
 *   │           Hoy, hay que analizar."   ── ~60vh            │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Cada stat aparece con fade-in al entrar al viewport (in-view margin).
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

export default function SectionProblem() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        {/* Sticky parent: header se queda fijo durante ~60vh de scroll y
            luego se libera. Las stats viven fuera de este contenedor para
            evitar overlap. */}
        <div className="relative" style={{ height: "60vh" }}>
          <div className="sticky top-24 pt-[12vh]">
            <ProblemHeader />
          </div>
        </div>
        <div className="space-y-[22vh] pt-[6vh] pb-[8vh]">
          <NarrativeStat
            index="01"
            big="4.5%"
            bigColor="var(--landing-text)"
            kicker="Tasas más altas."
            context="Hace 5 años: 2.0%."
            body="El dividendo de un mismo depto hoy es 40% más alto que en 2020."
          />
          <NarrativeStat
            index="02"
            big="5.0%"
            bigColor="var(--landing-text)"
            kicker="Cap rate mediano."
            context="n=12.944 · Gran Santiago."
            body="El arriendo bruto rinde menos que el dividendo. Antes de descontar gastos."
          />
          <NarrativeStat
            index="03"
            big="31.7%"
            bigColor="#C8323C"
            kicker="Casi un tercio del arriendo desaparece."
            context="GGCC · contribuciones · vacancia · comisión."
            body="Antes de llegar a tu bolsillo. Y nadie lo suma en la cotización."
          />
        </div>

        <ResultCounter />
        <ClosingStatement />
      </div>
    </section>
  );
}

/* ============================ Header sticky ============================ */

function ProblemHeader() {
  const reduce = useReducedMotion();
  const lines = ["La matemática del depto", "de inversión cambió."];

  const lineVariant = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.75,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.15,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -20% 0px" }}
      className=""
      style={{ pointerEvents: "none" }}
    >
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: EASE }}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 24 }}
      >
        02 · El problema
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ maxWidth: 980 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.05 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
              variants={lineVariant(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>
    </motion.div>
  );
}

/* ============================ Narrative stat ============================ */

function NarrativeStat({
  index,
  big,
  bigColor,
  kicker,
  context,
  body,
}: {
  index: string;
  big: string;
  bigColor: string;
  kicker: string;
  context: string;
  body: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px -25% 0px" });
  const reduce = useReducedMotion();

  return (
    <div
      ref={ref}
      className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_1fr] md:gap-14"
      style={{ minHeight: "45vh" }}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -16 }}
        animate={
          inView || reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }
        }
        transition={{ duration: 0.7, ease: EASE }}
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.18em" }}
        >
          {index}
        </p>
        <p
          className="mt-3 font-heading font-bold leading-[0.9] tracking-[-0.03em]"
          style={{
            color: bigColor,
            fontSize: "clamp(96px, 14vw, 168px)",
          }}
        >
          {big}
        </p>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={
          inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
        }
        transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
        className="max-w-[520px]"
      >
        <p
          className="font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(20px, 2.4vw, 28px)" }}
        >
          {kicker}
        </p>
        <p
          className="mt-2 font-mono font-medium text-[var(--landing-text-muted)]"
          style={{ fontSize: 12, letterSpacing: "0.04em" }}
        >
          {context}
        </p>
        <p
          className="mt-4 font-body leading-[1.55] text-[var(--landing-text-secondary)]"
          style={{ fontSize: 16 }}
        >
          {body}
        </p>
      </motion.div>
    </div>
  );
}

/* ============================ 92.1% counter ============================ */

function ResultCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();

  const count = useMotionValue(reduce ? 92.1 : 0);
  const display = useTransform(count, (v) => v.toFixed(1));
  const [shown, setShown] = useState(reduce ? "92.1" : "0.0");

  useEffect(() => {
    const unsub = display.on("change", (v) => setShown(v));
    return () => unsub();
  }, [display]);

  useEffect(() => {
    if (reduce) return;
    if (!inView) return;
    const controls = animate(count, 92.1, { duration: 1.6, ease: EASE });
    return () => controls.stop();
  }, [inView, reduce, count]);

  return (
    <div
      ref={ref}
      className="relative grid grid-cols-1 items-center gap-8 py-[14vh] md:grid-cols-[auto_1fr] md:gap-12"
    >
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="font-heading font-bold leading-[0.85] tracking-[-0.04em] text-[#C8323C]"
        style={{ fontSize: "clamp(120px, 18vw, 220px)" }}
      >
        {shown.replace(".", ",")}%
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
        className="max-w-[460px]"
      >
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 11, letterSpacing: "0.18em" }}
        >
          Resultado
        </p>
        <p
          className="mt-3 font-heading font-bold leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(24px, 3vw, 34px)" }}
        >
          de los deptos de inversión pierden plata cada mes.
        </p>
        <p
          className="mt-4 font-body leading-[1.55] text-[var(--landing-text-secondary)]"
          style={{ fontSize: 16 }}
        >
          Más de la mitad pone $200.000 o más cada mes, durante 25 años.
        </p>
        <p
          className="mt-6 font-body text-[var(--landing-text-muted)]"
          style={{ fontSize: 11, lineHeight: 1.55 }}
        >
          n=12.944 · 24 comunas Gran Santiago · pie 20% · crédito 25
          años · tasa 4,5% UF · gastos 31,7%.
        </p>
      </motion.div>
    </div>
  );
}

/* ============================ Closing statement ============================ */

function ClosingStatement() {
  const reduce = useReducedMotion();
  const lines: Array<{ text: string; emphasis?: boolean }> = [
    { text: "Antes, comprar era seguro." },
    { text: "Hoy, hay que analizar.", emphasis: true },
  ];

  const lineVariant = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.85,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.2,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      className="py-[16vh]"
    >
      <h3
        className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ maxWidth: 960 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.05 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
              variants={lineVariant(i)}
            >
              {line.emphasis ? (
                <>
                  Hoy, hay que{" "}
                  <span className="text-[#C8323C]">analizar.</span>
                </>
              ) : (
                line.text
              )}
            </motion.span>
          </span>
        ))}
      </h3>
    </motion.div>
  );
}
