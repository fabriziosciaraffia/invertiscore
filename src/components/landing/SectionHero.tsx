"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Sección 01 · Hero — fondo Ink 200 (#E8E6E1).
 * Secuencia animada al cargar: eyebrow+H1 (t=0) → subhead (t=0.6s)
 * → CTA (t=1.2s) → card ejemplo desde la derecha (t=1.8s).
 * prefers-reduced-motion: render directo, sin secuencia.
 * Card tiene parallax 0.85 al scroll (más lenta que el viewport).
 */
const EASE = [0.215, 0.61, 0.355, 1] as const;

export default function SectionHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Parallax card: se mueve a 0.85x scroll → translateY -60px máximo
  const yCard = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const initial = reduce ? false : "hidden";
  const animate = reduce ? undefined : "show";

  return (
    <section ref={ref} className="relative flex min-h-screen items-center">
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-10 px-6 py-14 md:grid-cols-[1.05fr_1fr] md:gap-14 md:py-[72px]">
        {/* Columna izquierda — copy con secuencia */}
        <div className="flex flex-col">
          <motion.span
            className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]"
            initial={initial}
            animate={animate}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5, ease: EASE, delay: 0 }}
          >
            34.000+ deptos · arriendo largo y airbnb · 24 comunas
          </motion.span>

          <motion.h1
            className="mt-7 font-heading text-[44px] font-bold leading-[1.05] tracking-[-0.01em] text-[var(--landing-text)] md:text-[64px]"
            initial={initial}
            animate={animate}
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          >
            ¿Y si el depto no se paga solo?
          </motion.h1>

          <motion.p
            className="mt-6 max-w-[480px] font-body text-[17px] leading-[1.55] text-[var(--landing-text-secondary)] md:text-[18px]"
            initial={initial}
            animate={animate}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.6 }}
          >
            Antes de invertir, ve si dan los números para no terminar poniendo
            plata de tu bolsillo cada mes.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-col items-start gap-3"
            initial={initial}
            animate={animate}
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6, ease: EASE, delay: 1.2 }}
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-6 py-[14px] font-mono text-[13px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_2px_0_rgba(0,0,0,0.08)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
            >
              Analizar mi departamento
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>

            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Precio · comuna · arriendo&nbsp;&nbsp;·&nbsp;&nbsp;veredicto en 30s&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta&nbsp;&nbsp;·&nbsp;&nbsp;1 análisis gratis
            </p>
          </motion.div>
        </div>

        {/* Columna derecha — card ejemplo entra desde la derecha + parallax */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 40 }}
          animate={reduce ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 1.8 }}
          style={{ y: reduce ? 0 : yCard }}
        >
          <ExampleCard />
        </motion.div>
      </div>
    </section>
  );
}

function ExampleCard() {
  const score = 61;

  return (
    <div className="relative">
      <div className="rounded-2xl border border-[rgba(15,15,15,0.10)] p-6 shadow-[0_24px_48px_-16px_rgba(15,15,15,0.18),_0_1px_0_rgba(15,15,15,0.04)] md:p-8">
        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-dashed border-[rgba(15,15,15,0.12)] pb-4">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            Análisis · Ejemplo
          </span>
          <span className="font-heading text-[14px] font-bold leading-tight text-[var(--landing-text)]">
            Depto 2D2B Providencia
          </span>
        </div>

        {/* Score block */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
              Franco Score
            </p>
            <p className="mt-2 font-heading text-[56px] font-bold leading-none tracking-[-0.02em] text-[var(--landing-text)]">
              {score}
              <span className="font-heading text-[24px] font-bold text-[var(--landing-text-muted)]">/100</span>
            </p>
          </div>

          <span className="inline-flex items-center rounded-md border border-[#C8323C]/45 bg-[rgba(200,50,60,0.04)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C8323C]">
            Ajustar supuestos
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-5">
          <div className="relative h-1 w-full rounded-full bg-[rgba(15,15,15,0.08)]">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${score}%`,
                background: "linear-gradient(90deg, #C8323C 0%, #5F5E5A 60%, #B4B2A9 100%)",
              }}
            />
            <div
              className="absolute -top-[3px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-[#0F0F0F] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
              style={{ left: `${score}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2.5 flex justify-between font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--landing-text-muted)]">
            <span>Buscar otra</span>
            <span>Ajustar</span>
            <span>Comprar</span>
          </div>
        </div>

        {/* Operación recomendada */}
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-[rgba(15,15,15,0.04)] px-4 py-3">
          <span className="inline-flex items-center rounded-sm px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--landing-text)]">
            Airbnb
          </span>
          <span className="font-mono text-[12px] font-medium text-[var(--landing-text)]">
            +$148K/mes <span className="text-[var(--landing-text-muted)]">vs arriendo tradicional</span>
          </span>
        </div>

        {/* Caja Franco */}
        <div className="mt-5 border-l-[3px] border-[#C8323C] bg-[rgba(200,50,60,0.04)] py-4 pl-5 pr-4 rounded-r-md">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8323C]">
            Siendo franco
          </p>
          <p className="mt-2 font-body text-[14px] italic leading-[1.55] text-[var(--landing-text-secondary)]">
            &ldquo;Buena ubicación, precio incómodo. Negocia hasta UF 4.900 y opera
            en Airbnb. Así el flujo se sostiene.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
