"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Header estándar de sección (hairline + eyebrow Signal Red + H2 con
 * mask reveal por línea + subhead opcional).
 *
 * F.11 Phase 2.5 · agrega hairline 1×24 sobre el eyebrow + props para
 * adaptarse a CTAs invertidos (bg Signal Red).
 *
 * Animación al entrar al viewport:
 * - Hairline + Eyebrow: opacity + translateY 12, 400ms, delay 0.
 * - H2: cada línea (split por \n) entra desde abajo dentro de un wrapper
 *   overflow-hidden. translateY 105% → 0, 700ms, stagger 100ms entre líneas.
 *   Delay inicial 150ms.
 * - Subhead: opacity + translateY 16, 500ms, delay = lines × 100 + 400ms.
 *
 * prefers-reduced-motion: skip animaciones, render directo.
 */

const EASE = [0.215, 0.61, 0.355, 1] as const;

type Tone = "default" | "invertido";

export default function SectionHeader({
  eyebrow,
  title,
  subhead,
  align = "left",
  className,
  hideHairline = false,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  subhead?: string;
  align?: "left" | "center";
  className?: string;
  hideHairline?: boolean;
  tone?: Tone;
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

  const isInv = tone === "invertido";
  const eyebrowColor = isInv ? "#FFD9DC" : "#C8323C";
  const titleColor = isInv ? "#FFFFFF" : "var(--landing-text)";
  const subheadColor = isInv ? "#FFD9DC" : "var(--landing-text-secondary)";

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      className={`${align === "center" ? "text-center" : ""} ${className ?? ""}`}
    >
      {!hideHairline && (
        <motion.div
          variants={eyebrowVariants}
          aria-hidden="true"
          style={{
            width: 24,
            height: 1,
            background: "rgba(200, 50, 60, 0.6)",
            marginBottom: 16,
            marginLeft: align === "center" ? "auto" : 0,
            marginRight: align === "center" ? "auto" : 0,
          }}
        />
      )}

      <motion.p
        variants={eyebrowVariants}
        className="font-mono font-medium uppercase"
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          marginBottom: 20,
          color: eyebrowColor,
        }}
      >
        {eyebrow}
      </motion.p>

      <h2
        className="font-heading font-bold leading-[1.1] tracking-[-0.015em]"
        style={{ marginBottom: 24, color: titleColor }}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className="block overflow-hidden"
            style={{ lineHeight: 1.1 }}
          >
            <motion.span
              className="block"
              style={{ fontSize: "clamp(36px, 5.5vw, 56px)" }}
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
          className="font-body text-[15px] leading-[1.6] md:text-[17px]"
          style={{ marginBottom: 56, maxWidth: 680, color: subheadColor }}
        >
          {subhead}
        </motion.p>
      )}
    </motion.div>
  );
}
