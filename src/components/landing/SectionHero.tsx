"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroMobileCard from "./HeroMobileCard";

/**
 * Sección 01 · Hero (F.11 Phase 2.4 · reset estilo Linear).
 *
 * Layout fijo desde t=0: grid 2 cols (1fr / 380px) en desktop, 1 col
 * en mobile con mockup debajo. Sin phase machine, sin migración.
 *
 * Timing lineal:
 *   t=0     eyebrow
 *   t=0.2   H1 línea 1 mask reveal
 *   t=0.5   H1 línea 2 mask reveal (Signal Red)
 *   t=0.9   subhead
 *   t=1.4   CTA + microcopy
 *   t=1.8   mockup entry (x:80→0 desktop / y:40→0 mobile, opacity 0→1)
 *   t=2.7+  mockup internals stagger (0..6)
 *   t≈5.4   fin
 *
 * Skip on scroll: si scrollY > 50, salta a estado final.
 * prefers-reduced-motion: layout final desde t=0.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [internalStep, setInternalStep] = useState(reduce ? 6 : -1);
  const [skipped, setSkipped] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const stepTimings = [2700, 2900, 3200, 3400, 4600, 4900, 5400];
    const timers = stepTimings.map((t, i) =>
      setTimeout(() => setInternalStep((cur) => Math.max(cur, i)), t),
    );

    const onScroll = () => {
      if (window.scrollY > 50) {
        timers.forEach((t) => clearTimeout(t));
        setSkipped(true);
        setInternalStep(6);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduce]);

  const skipToFinal = !!reduce || skipped;

  const mockupInitial = reduce
    ? false
    : isDesktop
      ? { opacity: 0, x: 80, y: 0 }
      : { opacity: 0, x: 0, y: 40 };

  return (
    <section
      className="relative flex items-start overflow-hidden md:items-center"
      style={{ minHeight: "100vh", background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-28 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1fr_380px] md:gap-16">
          {/* Columna copy */}
          <div className="text-left">
            <HeroCopy reduce={!!reduce} skipToFinal={skipToFinal} />
          </div>

          {/* Mockup */}
          <div className="flex justify-center md:justify-end">
            <motion.div
              initial={mockupInitial}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{
                duration: 0.85,
                ease: EASE,
                delay: skipToFinal ? 0 : 1.8,
              }}
            >
              <HeroMobileCard
                internalStep={skipToFinal ? 6 : internalStep}
                skipToFinal={skipToFinal}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCopy({
  reduce,
  skipToFinal,
}: {
  reduce: boolean;
  skipToFinal: boolean;
}) {
  const delay = (sec: number) => (reduce || skipToFinal ? 0 : sec);

  return (
    <>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: delay(0) }}
        className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
        style={{ fontSize: 10, letterSpacing: "0.18em" }}
      >
        34.000+ deptos · arriendo largo y airbnb · 24 comunas
      </motion.p>

      <h1
        className="mt-7 font-heading font-bold leading-[1.02] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{ fontSize: "clamp(48px, 8.5vw, 88px)" }}
      >
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.7, ease: EASE, delay: delay(0.2) }}
          >
            ¿Y si el depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block text-[#C8323C]"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.75, ease: EASE, delay: delay(0.5) }}
          >
            no se paga solo?
          </motion.span>
        </span>
      </h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: delay(0.9) }}
        className="mt-7 max-w-[540px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 18, lineHeight: 1.55 }}
      >
        Antes de invertir, ve si dan los números para no terminar poniendo
        plata de tu bolsillo cada mes.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: delay(1.4) }}
        className="mt-9 flex flex-col items-start gap-3"
      >
        <Link
          href="/register"
          className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
        >
          Analizar mi departamento
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
        <p
          className="font-mono font-medium uppercase text-[var(--landing-text-muted)]"
          style={{ fontSize: 10, letterSpacing: "0.16em" }}
        >
          Precio · comuna · arriendo&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en
          30s&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1
          análisis gratis
        </p>
      </motion.div>
    </>
  );
}
