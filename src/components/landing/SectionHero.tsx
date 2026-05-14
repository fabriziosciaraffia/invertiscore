"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroMobileCard from "./HeroMobileCard";

/**
 * Sección 01 · Hero — secuencia animada con migración de layout:
 * t=0     eyebrow fade-in
 * t=0.2   H1 mask reveal
 * t=0.9   subhead fade-in
 * t=1.4   CTA + microcopy fade-in
 * t=2.0   Card mobile entra (centrada abajo)
 * t=2.6+  Card internals escalonados (0..6 en internalStep)
 * t=6.5   Migración layout: single-col centered → 2-cols (copy izq, card der)
 * t=7.3   Estado final estable
 *
 * Skip on scroll: si scrollY > 50 antes de t=7.3, salta a estado final.
 * prefers-reduced-motion: inicia directamente en estado final sin animación.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Phase = "intro" | "card" | "internals" | "migrate" | "final";

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "final" : "intro");
  const [internalStep, setInternalStep] = useState(reduce ? 6 : -1);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("card"), 2000));
    timers.push(setTimeout(() => setPhase("internals"), 2600));
    const stepTimings = [2600, 2900, 3300, 3500, 4700, 5000, 5600];
    stepTimings.forEach((t, i) => {
      timers.push(setTimeout(() => setInternalStep(i), t));
    });
    timers.push(setTimeout(() => setPhase("migrate"), 6500));
    timers.push(setTimeout(() => setPhase("final"), 7300));

    const onScroll = () => {
      if (window.scrollY > 50) {
        timers.forEach((t) => clearTimeout(t));
        setSkipped(true);
        setPhase("final");
        setInternalStep(6);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduce]);

  const isMigrated = phase === "migrate" || phase === "final";
  const cardVisible =
    phase === "card" || phase === "internals" || isMigrated;
  const skipToFinal = !!reduce || skipped;

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div
        className={`mx-auto w-full px-6 py-20 transition-[max-width] duration-700 ease-out ${
          isMigrated ? "max-w-[1200px]" : "max-w-[760px]"
        }`}
      >
        <div
          className={
            isMigrated
              ? "grid grid-cols-1 items-center gap-12 md:grid-cols-[1fr_380px]"
              : "flex flex-col items-center gap-10 text-center"
          }
          style={{ transition: "all 800ms cubic-bezier(0.215, 0.61, 0.355, 1)" }}
        >
          {/* Columna copy */}
          <div className={isMigrated ? "text-left" : "text-center"}>
            <HeroCopy reduce={!!reduce} skipToFinal={skipToFinal} />
          </div>

          {/* Card mobile */}
          <div className="flex justify-center">
            <motion.div
              initial={
                reduce
                  ? false
                  : { opacity: 0, scale: 0.85, y: 40, rotate: -3 }
              }
              animate={
                skipToFinal
                  ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                  : !cardVisible
                    ? { opacity: 0, scale: 0.85, y: 40, rotate: -3 }
                    : isMigrated
                      ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                      : { opacity: 1, scale: 1, y: 0, rotate: -3 }
              }
              transition={{ duration: 0.7, ease: EASE }}
              style={{ originX: 0.5, originY: 0.5 }}
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

      <h1 className="mt-6 font-heading font-bold leading-[1.05] tracking-[-0.015em] text-[var(--landing-text)]">
        <span className="block overflow-hidden" style={{ lineHeight: 1.05 }}>
          <motion.span
            className="block text-[40px] md:text-[48px] lg:text-[56px]"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.7, ease: EASE, delay: delay(0.2) }}
          >
            ¿Y si el depto no se paga solo?
          </motion.span>
        </span>
      </h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: delay(0.9) }}
        className="mt-6 max-w-[520px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 17, lineHeight: 1.55 }}
      >
        Antes de invertir, ve si dan los números para no terminar poniendo
        plata de tu bolsillo cada mes.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: delay(1.4) }}
        className="mt-9 flex flex-col items-center gap-3 md:items-start"
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
