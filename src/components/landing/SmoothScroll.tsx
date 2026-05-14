"use client";

import { useEffect } from "react";

/**
 * Lenis smooth scroll para landing. Solo desktop (>=768px) y respetando
 * prefers-reduced-motion.
 *
 * Compatibilidad con CSS scroll-snap: Lenis intercepta wheel y deja
 * que el snap CSS aterrice los targets. Por eso configuramos duration
 * corta (0.9s) y easing ease-out para que la interpolación termine antes
 * de que el snap engage — el resultado es scroll fluido + snap final
 * suave en cada anchor.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (!motionOK || !desktop) return;

    let lenis: import("lenis").default | null = null;
    let rafId = 0;
    let cancelled = false;

    (async () => {
      const Lenis = (await import("lenis")).default;
      if (cancelled) return;
      lenis = new Lenis({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });
      // Expose for programmatic scroll (debug + future use)
      (window as unknown as { __lenis?: typeof lenis }).__lenis = lenis;

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, []);

  return null;
}
