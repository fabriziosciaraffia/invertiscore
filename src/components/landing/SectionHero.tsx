"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroMobileCard from "./HeroMobileCard";

/**
 * Sección 01 · Hero (F.11 Phase 2.6).
 *
 * Layout fijo desde t=0: grid 2 cols (1fr / 380px) en desktop, 1 col
 * en mobile con mockup debajo.
 *
 * Timing inicial (desbloquea el loop del mockup tras la entrada):
 *   t=0     eyebrow
 *   t=0.2   H1 línea 1
 *   t=0.5   H1 línea 2 (Signal Red)
 *   t=0.9   subhead
 *   t=1.4   CTA + microcopy
 *   t=1.8   mockup entry (x:80→0 desktop / y:40→0 mobile)
 *   t=2.7   loopArmed → HeroMobileCard arranca el ciclo solo
 *
 * Pausa reversible cuando el hero deja el viewport: IntersectionObserver
 * sobre la sección entera. Cuando el hero está visible (>= 20% intersect)
 * Y el loop ya armó (post-2700ms), el mockup corre el ciclo; cuando sale
 * de viewport, pausa. Al volver, reinicia desde form-empty (Opción B,
 * sin continuidad pero sin estado complejo).
 * prefers-reduced-motion → final estático directo, sin loop.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [loopArmed, setLoopArmed] = useState(!!reduce);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const loopArmedRef = useRef(!!reduce);

  useEffect(() => {
    loopArmedRef.current = loopArmed;
  }, [loopArmed]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduce) return;

    const armTimer = setTimeout(() => setLoopArmed(true), 2700);

    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      return () => clearTimeout(armTimer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!loopArmedRef.current) return;
        const visible =
          entry.isIntersecting && entry.intersectionRatio >= 0.2;
        setIsHeroVisible(visible);
      },
      { threshold: [0, 0.2, 0.5] },
    );
    observer.observe(section);

    return () => {
      clearTimeout(armTimer);
      observer.disconnect();
    };
  }, [reduce]);

  const mockupInitial = reduce
    ? false
    : isDesktop
      ? { opacity: 0, x: 80, y: 0 }
      : { opacity: 0, x: 0, y: 40 };

  return (
    <section
      ref={sectionRef}
      className="relative flex items-start overflow-hidden md:items-center"
      style={{ minHeight: "100vh", background: "var(--franco-bg-base)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-28 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1fr_380px] md:gap-16">
          {/* Columna copy */}
          <div className="text-left">
            <HeroCopy reduce={!!reduce} />
          </div>

          {/* Mockup */}
          <div className="flex justify-center md:justify-end">
            <motion.div
              initial={mockupInitial}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{
                duration: 0.85,
                ease: EASE,
                delay: reduce ? 0 : 1.8,
              }}
            >
              <HeroMobileCard
                loopArmed={loopArmed}
                heroVisible={isHeroVisible}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCopy({ reduce }: { reduce: boolean }) {
  const delay = (sec: number) => (reduce ? 0 : sec);

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
