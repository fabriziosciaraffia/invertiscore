"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Anclar al ÁREA VISIBLE REAL, no a la ventana (28-sep-2026). En Chrome y Safari de iOS la barra
// del navegador se esconde al hacer scroll y `position: fixed; bottom: 0` salta con ella: el
// elemento se mide contra la ventana, que no cambia, y el área visible sí. Misma mecánica que la
// hoja de los capítulos con el teclado (Modal, vocabulario.tsx): se lee `visualViewport` y se fija
// `top` en píxeles en cada resize/scroll del área visible.
//
// SIEMPRE Y ANTES DE PINTAR (29-sep-2026): el ancla se fija al montar, con useLayoutEffect, y no
// cuando el elemento se muestra. Fijarla al abrir (useEffect, después de pintar) cambiaba la
// geometría del velo y de la barra EN MEDIO de su transición: en iOS, donde el área visible y la
// ventana difieren por la barra del navegador, el borde saltaba y el ticket parecía aparecer de golpe.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useLayoutEffect, type RefObject } from "react";

/** useLayoutEffect en el cliente (antes de pintar), useEffect en el servidor (sin advertencia). */
const useAntesDePintar = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** El elemento queda pegado al borde inferior del área visible (barra, pestaña). */
export function useAnclaAbajo(ref: RefObject<HTMLElement | null>, activo = true): void {
  useAntesDePintar(() => {
    const el = ref.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv || !activo) return;
    const colocar = () => {
      el.style.top = `${Math.round(vv.offsetTop + vv.height - el.offsetHeight)}px`;
      el.style.bottom = "auto";
    };
    colocar();
    vv.addEventListener("resize", colocar);
    vv.addEventListener("scroll", colocar);
    window.addEventListener("resize", colocar);
    return () => {
      vv.removeEventListener("resize", colocar);
      vv.removeEventListener("scroll", colocar);
      window.removeEventListener("resize", colocar);
      el.style.top = "";
      el.style.bottom = "";
    };
  }, [ref, activo]);
}

/** El elemento ocupa exactamente el área visible (el velo del ticket). */
export function useAnclaAreaVisible(ref: RefObject<HTMLElement | null>, activo = true): void {
  useAntesDePintar(() => {
    const el = ref.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv || !activo) return;
    const colocar = () => {
      el.style.top = `${Math.round(vv.offsetTop)}px`;
      el.style.height = `${Math.round(vv.height)}px`;
      el.style.bottom = "auto";
    };
    colocar();
    vv.addEventListener("resize", colocar);
    vv.addEventListener("scroll", colocar);
    return () => {
      vv.removeEventListener("resize", colocar);
      vv.removeEventListener("scroll", colocar);
      el.style.top = "";
      el.style.height = "";
      el.style.bottom = "";
    };
  }, [ref, activo]);
}
