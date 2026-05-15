"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { RevealOnScroll } from "./RevealOnScroll";

/**
 * Sección 02 · Problema (F.11 reset estilo Linear).
 *
 * Layout natural, sin sticky scroll. 4 bloques fade-in al entrar viewport:
 *   1. Header (eyebrow + H2 con "cambió" en rojo + subhead, mask reveal por línea)
 *   2. 3 stat cards en grid 3 cols con stagger
 *   3. Resultado 92,1% centrado con glow signal sutil
 *   4. Cierre alineado izquierda con "analizar" en rojo
 *
 * Mobile: layout responsive natural, grid colapsa a 1 col en < md.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Stat = {
  id: "01" | "02" | "03";
  big: string;
  kicker: string;
  kickerSub?: string;
  description: string;
  signalRed?: boolean;
};

const STATS: ReadonlyArray<Stat> = [
  {
    id: "01",
    big: "4,5%",
    kicker: "Tasas más altas.",
    description:
      "Hace 5 años: 2,0%. El dividendo mensual del mismo depto es 40% más alto hoy.",
  },
  {
    id: "02",
    big: "5,0%",
    kicker: "Cap rate bajo.",
    kickerSub: "Mediana de la muestra · n=12.944",
    description:
      "Antes el arriendo pagaba el dividendo y sobraba. Hoy apenas lo iguala — y eso antes de descontar gastos.",
  },
  {
    id: "03",
    big: "31,7%",
    kicker: "Un tercio desaparece.",
    description:
      "Contribuciones, gastos comunes, vacancia, comisiones. Salen de tu flujo antes de llegar a tu bolsillo.",
    signalRed: true,
  },
];

export default function SectionProblem() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-6xl px-5 py-[12vh] md:px-8 md:py-[16vh]">
        <ProblemHeader />

        {/* Grid stats */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:mt-24 md:grid-cols-3">
          {STATS.map((s, i) => (
            <RevealOnScroll key={s.id} delay={i * 0.1}>
              <StatCard data={s} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Resultado */}
        <RevealOnScroll>
          <ResultBlock />
        </RevealOnScroll>

        {/* Cierre */}
        <div className="mt-16 md:mt-24">
          <RevealOnScroll>
            <p
              className="font-heading font-bold leading-[1.1] tracking-[-0.02em] text-[var(--landing-text)]"
              style={{ fontSize: "clamp(32px, 5.4vw, 56px)" }}
            >
              Antes, comprar era seguro.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={0.2}>
            <p
              className="font-heading font-bold leading-[1.1] tracking-[-0.02em] text-[var(--landing-text)]"
              style={{ fontSize: "clamp(32px, 5.4vw, 56px)" }}
            >
              Hoy, hay que <span className="text-[#C8323C]">analizar.</span>
            </p>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ============================ Header ============================ */

function ProblemHeader() {
  const reduce = useReducedMotion();
  // Mismo patrón que SectionHeader pero con "cambió" en rojo inline.
  const lineDelay = (i: number) => (reduce ? 0 : 0.15 + i * 0.1);
  const subheadDelay = reduce ? 0 : 0.15 + 2 * 0.1 + 0.4;

  const eyebrowV: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  };
  const lineV = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: { duration: 0.7, ease: EASE, delay: lineDelay(i) },
    },
  });
  const subheadV: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE, delay: subheadDelay },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
    >
      <motion.p
        variants={eyebrowV}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 20 }}
      >
        02 · El problema
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.05] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ marginBottom: 24, maxWidth: 980 }}
      >
        <span className="block overflow-hidden" style={{ lineHeight: 1.05 }}>
          <motion.span
            className="block"
            style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
            variants={lineV(0)}
          >
            La matemática del depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.05 }}>
          <motion.span
            className="block"
            style={{ fontSize: "clamp(40px, 6.4vw, 72px)" }}
            variants={lineV(1)}
          >
            de inversión <span className="text-[#C8323C]">cambió.</span>
          </motion.span>
        </span>
      </h2>

      <motion.p
        variants={subheadV}
        className="font-body text-[15px] leading-[1.6] text-[var(--landing-text-secondary)] md:text-[17px]"
        style={{ maxWidth: 560 }}
      >
        Antes los números calzaban. Hoy no.
      </motion.p>
    </motion.div>
  );
}

/* ============================ Stat Card ============================ */

function StatCard({ data }: { data: Stat }) {
  return (
    <div className="franco-card h-full">
      <p
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 11, letterSpacing: "0.18em" }}
      >
        {data.id}
      </p>
      <p
        className="font-heading font-bold leading-[0.9] tracking-[-0.04em]"
        style={{
          fontSize: "clamp(52px, 5.6vw, 64px)",
          marginTop: 16,
          color: data.signalRed ? "#C8323C" : "var(--landing-text)",
        }}
      >
        {data.big}
      </p>
      <p
        className="font-body font-semibold text-[var(--landing-text)]"
        style={{
          fontSize: 18,
          lineHeight: 1.3,
          marginTop: 24,
          marginBottom: data.kickerSub ? 4 : 16,
        }}
      >
        {data.kicker}
      </p>
      {data.kickerSub && (
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            marginBottom: 16,
          }}
        >
          {data.kickerSub}
        </p>
      )}
      <p
        className="font-body text-[var(--landing-text-muted)]"
        style={{ fontSize: 14, lineHeight: 1.5 }}
      >
        {data.description}
      </p>
    </div>
  );
}

/* ============================ Resultado 92,1% ============================ */

function ResultBlock() {
  return (
    <div className="franco-glow-signal mt-16 md:mt-24">
      <div className="mx-auto max-w-4xl text-center">
        <p
          className="font-mono font-semibold uppercase text-[#C8323C]"
          style={{ fontSize: 11, letterSpacing: "0.10em" }}
        >
          Resultado
        </p>
        <p
          className="font-heading font-bold leading-[0.9] tracking-[-0.045em] text-[#C8323C]"
          style={{
            fontSize: "clamp(96px, 12vw, 160px)",
            marginTop: 16,
          }}
        >
          92,1%
        </p>
        <p
          className="font-heading font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--landing-text)]"
          style={{
            fontSize: "clamp(22px, 2.6vw, 32px)",
            marginTop: 24,
            maxWidth: 640,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          de los deptos de inversión pierden plata cada mes.
        </p>
        <p
          className="font-body text-[var(--landing-text)]"
          style={{
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.45,
            marginTop: 16,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <span style={{ fontWeight: 700 }}>$240.000</span> al mes.{" "}
          <span style={{ fontWeight: 700 }}>$71 millones</span> acumulados en 25
          años.
        </p>
        <p
          className="font-mono text-[var(--landing-text-muted)]"
          style={{
            fontSize: 10,
            letterSpacing: "0.06em",
            lineHeight: 1.6,
            marginTop: 16,
            maxWidth: 640,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          n=12.944 · 24 comunas Gran Santiago · pie 20% · crédito 25 años ·
          tasa 4,5% UF · gastos 31,7%
        </p>
      </div>
    </div>
  );
}
