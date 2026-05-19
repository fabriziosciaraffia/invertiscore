"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HeroAnimatedDesktop from "./HeroAnimatedDesktop";
import HeroStaticMobile from "./HeroStaticMobile";

/**
 * Sección 01 · Hero (F.11 Phase 2.7 Etapa 4).
 *
 * Branch responsivo limpio:
 *   · Mobile (max 767px) → HeroStaticMobile · 2 cards estáticas sin framer-motion.
 *   · Desktop (≥768px)   → HeroAnimatedDesktop · 2 cards con loop animado completo.
 *
 * Motivación del split: el NotFoundError iOS WebKit (Phase 2.6 series) era
 * causado por el reconciler React + framer-motion ejecutándose en mobile. La
 * solución Phase 2.6h (forzar reduce-motion en mobile) bypaseaba el bug pero
 * mobile quedaba sin Hero diferenciado. Etapa 4 separa los paths: mobile no
 * monta NINGÚN motion del Hero, desktop conserva el loop completo de Etapa 3.
 *
 * Timing inicial desktop (Etapa 8 · sin eyebrow ni microcopy):
 *   t=0     H1 línea 1
 *   t=0.3   H1 línea 2 (Signal Red)
 *   t=0.7   subhead
 *   t=1.1   CTA
 *   t=1.8   Card 2 entra
 *   t=2.0   Card 1 entra
 *   t=2.7   loopArmed → arranca cycle
 *
 * Pausa reversible desktop: IntersectionObserver sobre la sección. Cuando el
 * hero está visible (≥20% intersect) Y loop ya armó, el mockup corre el cycle.
 *
 * prefers-reduced-motion (desktop) → final estático directo sin loop.
 * Mobile siempre static.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SectionHero() {
  const reduce = useReducedMotion();
  const [loopArmed, setLoopArmed] = useState(!!reduce);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const loopArmedRef = useRef(!!reduce);

  useEffect(() => {
    loopArmedRef.current = loopArmed;
  }, [loopArmed]);

  // Detección mobile via matchMedia + listener · post-mount para evitar
  // hydration mismatch (server-side asume desktop).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // armTimer + IO solo en desktop · skip si reduce-motion o mobile.
  useEffect(() => {
    if (reduce || isMobile) return;

    const armTimer = setTimeout(() => setLoopArmed(true), 2700);

    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      return () => clearTimeout(armTimer);
    }

    try {
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
    } catch {
      setIsHeroVisible(true);
      return () => clearTimeout(armTimer);
    }
  }, [reduce, isMobile]);

  return (
    <section
      ref={sectionRef}
      className="relative flex items-start overflow-x-hidden md:items-center"
      style={{ minHeight: "100vh", background: "var(--franco-bg-base)" }}
    >
      {isMobile ? (
        /* === Mobile · stack vertical estático · px-3 (12px) da el ancho
             que necesita el H1 12vw para caber en 2 líneas. pt-16 = ~64px. === */
        <div className="mx-auto w-full max-w-6xl px-2 pt-16 pb-12">
          <HeroCopy reduce mobile />
          <HeroStaticMobile />
        </div>
      ) : (
        /* === Desktop · grid con cards absolute al viewport derecho === */
        <>
          <div className="mx-auto w-full max-w-6xl px-6 pt-28 pb-12 md:py-20 md:px-0 md:pr-[500px]">
            <HeroCopy reduce={!!reduce} mobile={false} />
          </div>
          <div className="hidden md:flex absolute right-0 top-0 bottom-0 items-center pointer-events-none">
            <div className="pointer-events-auto">
              <HeroAnimatedDesktop
                loopArmed={loopArmed}
                heroVisible={isHeroVisible}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function HeroCopy({ reduce, mobile }: { reduce: boolean; mobile: boolean }) {
  const delay = (sec: number) => (reduce ? 0 : sec);

  return (
    <>
      <h1
        className="font-heading font-bold leading-[1.02] tracking-[-0.02em] text-[var(--landing-text)]"
        style={{
          fontSize: mobile
            ? "clamp(42px, 12vw, 58px)"
            : "clamp(48px, 8.5vw, 88px)",
        }}
      >
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.7, ease: EASE, delay: delay(0) }}
          >
            ¿Y si el depto
          </motion.span>
        </span>
        <span className="block overflow-hidden" style={{ lineHeight: 1.02 }}>
          <motion.span
            className="block text-[#C8323C]"
            initial={reduce ? false : { y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.75, ease: EASE, delay: delay(0.3) }}
          >
            no se paga solo?
          </motion.span>
        </span>
      </h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: delay(0.7) }}
        className={`${mobile ? "mt-5" : "mt-8"} max-w-[540px] font-body text-[var(--landing-text-secondary)]`}
        style={{ fontSize: mobile ? 14 : 18, lineHeight: 1.5 }}
      >
        Antes de invertir, ve si dan los números para no terminar poniendo
        plata de tu bolsillo cada mes.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: delay(1.1) }}
        className={`${mobile ? "mt-6" : "mt-10"} flex items-start`}
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
      </motion.div>
    </>
  );
}
