"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/* Hook · detecta si el tema actual es light leyendo data-franco-theme. */
function useLandingIsLight(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const root = document.querySelector("[data-franco-root]");
    if (!root) return;
    const update = () =>
      setIsLight(root.getAttribute("data-franco-theme") === "light");
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-franco-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

type Tone = "default" | "invertido";

type Props = {
  /** Numeral a mostrar como fondo, ej "02", "10". */
  number: string;
  /** Lado por el que sobresale (cropeado por overflow-hidden de la section). */
  side: "left" | "right";
  /**
   * Tono — "invertido" para bg Signal Red (s06, s10), "default" theme-aware
   * (claro/oscuro según data-franco-theme).
   */
  tone?: Tone;
  /**
   * CSS top relativo al ancestro position:relative (la <section>).
   * Default "clamp(110px, 17vh, 220px)" para secciones con header al top
   * (vh-padded). Para CTAs centrados usar "calc(50% - 50px)" o similar.
   */
  top?: string;
  /** translateY en % string. Default "-50%" (centra el numeral sobre `top`). */
  translateY?: string;
};

/**
 * Numeral fantasma de fondo · replicado del s10 SectionFinalCTA original.
 *
 * Patrón seguro (no loop, no AnimatePresence, no mount conditional):
 * - always-mounted motion.span
 * - parallax via useScroll observado sobre el propio span
 * - reduce-motion → estático (y:0)
 *
 * Uso típico:
 *   <section className="relative overflow-hidden">
 *     <SectionGhostNumber number="02" side="right" />
 *     ...
 *   </section>
 *
 * La <section> contenedora DEBE tener `relative overflow-hidden` para que
 * el numeral se ancle correctamente y sus partes que sobresalen queden
 * cropeadas (efecto decorativo intencional).
 */
export default function SectionGhostNumber({
  number,
  side,
  tone = "default",
  top = "clamp(110px, 17vh, 220px)",
  translateY = "-50%",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const isLight = useLandingIsLight();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yGhost = useTransform(scrollYProgress, [0, 1], [40, -40]);

  /* Color por tone + theme · derivado de Ink + Signal Red, dentro de los
   * usos no-acento del sistema (textura sutil de fondo, sin competir con
   * contenido). */
  const color =
    tone === "invertido"
      ? "rgba(255,255,255,0.08)"
      : isLight
        ? "rgba(15,15,15,0.045)"
        : "rgba(250,250,248,0.05)";

  /* Side offset · sobresale 3vw del lado indicado para que el overflow-hidden
   * de la section lo recorte (efecto decorativo de "rebalsado"). */
  const sideStyle =
    side === "right" ? { right: "-3vw" } : { left: "-3vw" };

  return (
    <motion.span
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute select-none font-heading font-bold leading-none tracking-[-0.05em]"
      style={{
        color,
        fontSize: "clamp(140px, 24vw, 400px)",
        top,
        translateY,
        ...sideStyle,
        y: reduce ? 0 : yGhost,
      }}
    >
      {number}
    </motion.span>
  );
}
