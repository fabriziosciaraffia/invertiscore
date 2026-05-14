"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";

/**
 * Sección 09 · CTA final — fondo Ink 900 + numeral fantasma "09"
 * Source Serif 480px Signal Red opacity 0.06 a la derecha con parallax 0.85.
 */
export default function SectionFinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Parallax leve: el numeral se mueve más lento que el scroll (40px max).
  const yGhost = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center overflow-hidden "
    >
      {/* Numeral fantasma con parallax */}
      <motion.span
        className="pointer-events-none absolute select-none font-heading font-bold leading-none tracking-[-0.05em]"
        style={{
          color: "rgba(200,50,60,0.06)",
          fontSize: "clamp(220px, 32vw, 480px)",
          right: "-3vw",
          top: "50%",
          translateY: "-50%",
          y: reduce ? 0 : yGhost,
        }}
        aria-hidden="true"
      >
        09
      </motion.span>

      <Reveal as="div" className="relative mx-auto w-full max-w-[820px] px-6 py-16 text-center md:py-[88px]">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--landing-text-muted)]">
          09 · Tu turno
        </span>
        <h2 className="mt-6 font-heading text-[44px] font-bold leading-[1.05] tracking-[-0.015em] text-[var(--landing-text)] md:text-[64px]">
          ¿Y si el depto
          <br />
          no se paga solo?
        </h2>
        <p className="mx-auto mt-6 max-w-[560px] font-body text-[16px] leading-[1.55] text-[var(--landing-text-secondary)] md:text-[17px]">
          30 segundos y decides con fundamentos. Antes de firmar 25 años.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-md bg-[#C8323C] px-7 py-4 font-mono text-[14px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_4px_24px_rgba(200,50,60,0.35)] transition-[transform,filter] duration-150 hover:scale-[1.02] hover:brightness-95"
          >
            Analizar mi departamento
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--landing-text-muted)]">
            1 análisis gratis&nbsp;&nbsp;·&nbsp;&nbsp;sin tarjeta
          </p>
        </div>
      </Reveal>
    </section>
  );
}
