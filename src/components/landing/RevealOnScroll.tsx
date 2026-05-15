"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * F.11 · Reveal at viewport entry — simple opacity + translateY fade.
 * Reemplaza la mayoría de las animaciones scroll-driven complejas que
 * teníamos antes (sticky scroll, motion values manuales, etc.).
 *
 * Uso típico:
 *   <RevealOnScroll><h2>Algo importante</h2></RevealOnScroll>
 *   <RevealOnScroll delay={0.1}><p>Texto después</p></RevealOnScroll>
 *
 * - once: true → no se repite al scroll hacia atrás
 * - margin -10% → arranca un poco antes de entrar al viewport
 * - prefers-reduced-motion → render directo sin animación
 */
interface Props {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
}

export function RevealOnScroll({
  children,
  delay = 0,
  duration = 0.6,
  y = 24,
  className,
}: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{
        duration: reduce ? 0 : duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
