"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroMobileCard from "./HeroMobileCard";

/**
 * Sección 01 · Hero — secuencia animada con migración de layout.
 *
 * Phase machine:
 * t=0     eyebrow fade-in
 * t=0.2   H1 línea 1 mask reveal ("¿Y si el depto")
 * t=1.1   H1 línea 2 mask reveal Signal Red ("no se paga solo?") + scale 1.05→1
 * t=1.8   subhead fade-in
 * t=2.3   CTA + microcopy fade-in
 * t=2.9   Card mobile entra (centrada abajo, tilt -8°)
 * t=3.5+  Card internals escalonados (0..6 en internalStep)
 * t=7.5   Migración layout: single-col centered → 2-cols (copy izq, card der)
 *         Duration 1000ms cubic-bezier(0.22, 1, 0.36, 1), card → tilt 0°
 * t=8.5   Estado final estable
 *
 * Skip on scroll: si scrollY > 50 antes de t=8.5, salta a estado final.
 * prefers-reduced-motion: inicia directamente en estado final.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;
const EASE_MIGRATE = [0.22, 1, 0.36, 1] as const;

type Phase = "intro" | "card" | "internals" | "migrate" | "final";

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "final" : "intro");
  const [internalStep, setInternalStep] = useState(reduce ? 6 : -1);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("card"), 2900));
    timers.push(setTimeout(() => setPhase("internals"), 3500));
    const stepTimings = [3500, 3800, 4200, 4400, 5600, 5900, 6500];
    stepTimings.forEach((t, i) => {
      timers.push(setTimeout(() => setInternalStep(i), t));
    });
    timers.push(setTimeout(() => setPhase("migrate"), 7500));
    timers.push(setTimeout(() => setPhase("final"), 8500));

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
  const cardIntense = !isMigrated && !skipToFinal;

  return (
    <section
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: "100vh", height: "100vh" }}
    >
      <div
        className="mx-auto w-full px-6 py-20"
        style={{
          maxWidth: isMigrated ? 1200 : 900,
          transition:
            "max-width 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className={
            isMigrated
              ? "grid grid-cols-1 items-center gap-14 md:grid-cols-[1fr_400px]"
              : "flex flex-col items-center gap-12 text-center"
          }
          style={{
            transition:
              "all 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
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
                  : { opacity: 0, scale: 0.92, y: "100vh", rotate: -8 }
              }
              animate={
                skipToFinal
                  ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                  : !cardVisible
                    ? { opacity: 0, scale: 0.92, y: "100vh", rotate: -8 }
                    : isMigrated
                      ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                      : { opacity: 1, scale: 1, y: 0, rotate: -8 }
              }
              transition={{
                duration: isMigrated ? 1.0 : 0.95,
                ease: EASE_MIGRATE,
              }}
              style={{ originX: 0.5, originY: 0.5 }}
            >
              <HeroMobileCard
                internalStep={skipToFinal ? 6 : internalStep}
                skipToFinal={skipToFinal}
                intense={cardIntense}
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
            transition={{ duration: 0.75, ease: EASE, delay: delay(0.2) }}
          >
            ¿Y si el depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block text-[#C8323C]"
            initial={reduce ? false : { y: "105%", scale: 1.05 }}
            animate={{ y: "0%", scale: 1 }}
            transition={{
              duration: 0.85,
              ease: EASE,
              delay: delay(1.1),
            }}
          >
            no se paga solo?
          </motion.span>
        </span>
      </h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: delay(1.8) }}
        className="mt-7 max-w-[540px] font-body text-[var(--landing-text-secondary)]"
        style={{ fontSize: 18, lineHeight: 1.55 }}
      >
        Antes de invertir, ve si dan los números para no terminar poniendo
        plata de tu bolsillo cada mes.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: delay(2.3) }}
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
