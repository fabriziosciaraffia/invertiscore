"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wrapper de animación de entrada al viewport para la landing.
 * - Opacity 0→1 + translateY 24→0 sobre 600ms con ease-out-quart.
 * - once: true, animación no se repite al scrollear hacia atrás.
 * - prefers-reduced-motion: render sin animación.
 * - stagger opcional para grupos de hijos (cards, KPIs).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  as = "div",
  className,
  style,
  stagger = 0,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "p" | "span" | "h2" | "h3";
  className?: string;
  style?: React.CSSProperties;
  stagger?: number;
}) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.215, 0.61, 0.355, 1], // ease-out-quart
        delay,
        ...(stagger > 0 ? { staggerChildren: stagger, delayChildren: delay } : {}),
      },
    },
  };

  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={variants}
      className={className}
      style={style}
    >
      {children}
    </Component>
  );
}

/**
 * Item hijo dentro de un Reveal con stagger>0. Aplica las mismas
 * transformaciones pero hereda el timing del padre.
 */
export function RevealItem({
  children,
  y = 16,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "li" | "p" | "span";
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.215, 0.61, 0.355, 1] } },
  };
  const Component = motion[as] as typeof motion.div;
  return (
    <Component variants={variants} className={className} style={style}>
      {children}
    </Component>
  );
}
