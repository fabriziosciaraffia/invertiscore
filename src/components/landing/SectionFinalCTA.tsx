"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import SectionHeader from "./SectionHeader";

/**
 * Sección 09 · CTA final — numeral fantasma "09" Signal Red translúcido
 * a la derecha con parallax 0.85x.
 */
export default function SectionFinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yGhost = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center overflow-hidden"
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
        10
      </motion.span>

      <div className="relative mx-auto w-full max-w-[820px] px-6 py-16 md:py-[88px]">
        <SectionHeader
          eyebrow="10 · Tu turno"
          title={"¿Y si el depto\nno se paga solo?"}
          subhead="30 segundos y decides con fundamentos. Antes de firmar 25 años."
          align="center"
        />

        <div className="flex flex-col items-center gap-4">
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
      </div>
    </section>
  );
}
