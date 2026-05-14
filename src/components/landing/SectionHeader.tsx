"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Header estándar de sección (eyebrow Signal Red + H2 con mask reveal
 * por línea + subhead opcional). Tipografía y spacing unificados.
 *
 * Animación al entrar al viewport (once: true en el wrapper padre):
 * - Eyebrow: opacity + translateY 12, 400ms, delay 0.
 * - H2: cada línea (split por \n) entra desde abajo dentro de un wrapper
 *   overflow-hidden. translateY 105% → 0, 700ms, stagger 100ms entre líneas.
 *   Delay inicial 150ms.
 * - Subhead: opacity + translateY 16, 500ms, delay = lines × 100 + 400ms.
 *
 * Variantes se propagan desde el padre con whileInView: motion children
 * con `variants` (sin whileInView propio) heredan el state automáticamente.
 *
 * prefers-reduced-motion: skip animaciones, render directo.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

export default function SectionHeader({
  eyebrow,
  title,
  subhead,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: string;
  subhead?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const lines = title.split("\n");
  const subheadDelay = reduce ? 0 : 0.15 + lines.length * 0.1 + 0.4;

  const eyebrowVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: EASE, delay: 0 },
    },
  };

  const subheadVariants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE, delay: subheadDelay },
    },
  };

  const lineVariants = (i: number): Variants => ({
    hidden: { y: reduce ? "0%" : "105%" },
    show: {
      y: "0%",
      transition: {
        duration: 0.7,
        ease: EASE,
        delay: reduce ? 0 : 0.15 + i * 0.1,
      },
    },
  });

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      className={`${align === "center" ? "text-center" : ""} ${className ?? ""}`}
    >
      <motion.p
        variants={eyebrowVariants}
        className="font-mono font-medium uppercase text-[#C8323C]"
        style={{ fontSize: 11, letterSpacing: "0.06em", marginBottom: 20 }}
      >
        {eyebrow}
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.15] tracking-[-0.015em] text-[var(--landing-text)]"
        style={{ marginBottom: 24 }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.15 }}
          >
            <motion.span
              className="block text-[28px] md:text-[32px] lg:text-[38px]"
              variants={lineVariants(i)}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </h2>

      {subhead && (
        <motion.p
          variants={subheadVariants}
          className="font-body text-[15px] leading-[1.6] text-[var(--landing-text-secondary)] md:text-[17px]"
          style={{ marginBottom: 56, maxWidth: 680 }}
        >
          {subhead}
        </motion.p>
      )}
    </motion.div>
  );
}
