"use client";

import { useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/**
 * Sección 03 · Qué es Franco — secuencial scroll-driven (mismo patrón que s02).
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header sticky en contenedor de 60vh:                    │
 *   │   Eyebrow "03 · QUÉ ES FRANCO" · Signal Red             │
 *   │   H2 56-72px "No es una calculadora. / Es un asesor."   │
 *   │   Subhead muted                                          │
 *   │                                                          │
 *   │ Bullet 01 INTERPRETA ─── ~40vh                          │
 *   │ Bullet 02 IDENTIFICA ─── ~40vh                          │
 *   │ Bullet 03 PROPONE ────── ~40vh                          │
 *   │ Bullet 04 VIGILA ─────── ~40vh                          │
 *   │                                                          │
 *   │ Caja Franco grande con cita italic (cierre) ─── ~60vh   │
 *   └─────────────────────────────────────────────────────────┘
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Bullet = { index: string; verb: string; rest: string };

const BULLETS: ReadonlyArray<Bullet> = [
  {
    index: "01",
    verb: "INTERPRETA",
    rest: "tu caso con todos los gastos reales — no sólo el dividendo.",
  },
  {
    index: "02",
    verb: "IDENTIFICA",
    rest: "el problema concreto: precio, estructura del financiamiento o modalidad.",
  },
  {
    index: "03",
    verb: "PROPONE",
    rest: "alternativas: negociar, reestructurar, cambiar a Airbnb o buscar otra.",
  },
  {
    index: "04",
    verb: "VIGILA",
    rest: "los riesgos a largo plazo: vacancia, mantención mayor, cambios de tasa.",
  },
];

export default function SectionWhatFrancoIs() {
  return (
    <section id="que-es-franco" className="relative">
      <div className="mx-auto w-full max-w-[1280px] px-6">
        {/* Sticky parent 60vh — header se queda visible durante el inicio
            de la sección y luego se libera. */}
        <div className="relative" style={{ height: "60vh" }}>
          <div className="sticky top-24 pt-[12vh]">
            <FrancoIsHeader />
          </div>
        </div>

        {/* Bullets secuenciales — cada uno aparece al entrar al viewport */}
        <div className="space-y-[18vh] pt-[4vh] pb-[10vh]">
          {BULLETS.map((b) => (
            <BulletRow key={b.index} bullet={b} />
          ))}
        </div>

        {/* Caja Franco grande al cierre */}
        <FrancoQuoteClose />
      </div>
    </section>
  );
}

/* ============================ Sticky header ============================ */

function FrancoIsHeader() {
  const reduce = useReducedMotion();
  const lines = ["No es una calculadora.", "Es un asesor con IA."];

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
        03 · Qué es Franco
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

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
        className="mt-6 max-w-[680px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 17, lineHeight: 1.55 }}
      >
        Franco interpreta tu caso, identifica el problema real y propone
        alternativas concretas. No te entrega solo números — te dice qué
        hacer con ellos.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Bullet (sequential) ============================ */

function BulletRow({ bullet }: { bullet: Bullet }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px -25% 0px" });
  const reduce = useReducedMotion();

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 items-baseline gap-6 md:grid-cols-[100px_1fr] md:gap-10"
      style={{ minHeight: "32vh" }}
    >
      <motion.p
        initial={reduce ? false : { opacity: 0, x: -16 }}
        animate={
          inView || reduce ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }
        }
        transition={{ duration: 0.7, ease: EASE }}
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 13, letterSpacing: "0.18em" }}
      >
        {bullet.index}
      </motion.p>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={
          inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }
        }
        transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        className="font-heading leading-[1.18] tracking-[-0.01em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(28px, 3.6vw, 44px)" }}
      >
        <span className="font-mono font-semibold uppercase text-[#C8323C]">
          {bullet.verb}
        </span>{" "}
        <span className="font-body font-normal text-[var(--landing-text-secondary)]">
          {bullet.rest}
        </span>
      </motion.p>
    </div>
  );
}

/* ============================ Caja Franco (cierre) ============================ */

function FrancoQuoteClose() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={inView || reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.9, ease: EASE }}
      className="relative mx-auto py-[10vh]"
      style={{ maxWidth: 980 }}
    >
      <div
        className="relative rounded-2xl px-8 py-12 md:px-12 md:py-16"
        style={{
          background: "var(--landing-card-bg-soft)",
          border: "0.5px solid var(--landing-card-border)",
          borderLeft: "4px solid #C8323C",
          boxShadow:
            "0 24px 48px rgba(0,0,0,0.14), 0 8px 16px rgba(0,0,0,0.06)",
        }}
      >
        <p
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{ fontSize: 12, letterSpacing: "0.16em" }}
        >
          Siendo franco
        </p>
        <p
          className="mt-6 font-body italic leading-[1.35] text-[var(--landing-text)]"
          style={{ fontSize: "clamp(24px, 3.4vw, 40px)" }}
        >
          &ldquo;Excelente ubicación al precio equivocado. Negocia hasta UF
          4.900 y opera en Airbnb. Así el flujo se sostiene.&rdquo;
        </p>
      </div>
    </motion.div>
  );
}
