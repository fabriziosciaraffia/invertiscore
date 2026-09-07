"use client";

// Scroll suave (Lenis) SOLO en la landing y solo en desktop (>=1024): import
// dinámico para no cargarlo en mobile ni en el resto del app; apagado con
// prefers-reduced-motion. Lenis mueve el scroll nativo (sin transform), así que
// los IntersectionObserver de la sección 2 y del mapa siguen funcionando.
// FASE 1.5: reemplaza al scroll-snap.

import { useEffect } from "react";

export function SuaveScroll() {
  useEffect(() => {
    if (window.innerWidth < 1024) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let cancelado = false;
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelado) return;
      lenis = new Lenis({ lerp: 0.1 });
      const loop = (t: number) => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelado = true;
      if (raf) cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);
  return null;
}
