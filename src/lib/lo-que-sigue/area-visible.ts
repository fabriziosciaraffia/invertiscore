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
//
// UNA VEZ POR CUADRO Y SIN MEDIR EN CADA EVENTO (09-oct-2026): el área visible avisa muchas veces por cuadro
// mientras se baja en iOS. Los avisos piden un cuadro y se coloca una vez en él; el alto de la pestaña se
// lee cuando cambia (ResizeObserver), no en cada aviso —leerlo ahí forzaba un layout por evento—.
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
    let alto = el.offsetHeight;
    let cuadro = 0;
    const colocar = () => {
      cuadro = 0;
      el.style.top = `${Math.round(vv.offsetTop + vv.height - alto)}px`;
      el.style.bottom = "auto";
    };
    const enCuadro = () => {
      if (!cuadro) cuadro = window.requestAnimationFrame(colocar);
    };
    colocar();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { alto = el.offsetHeight; enCuadro(); }) : null;
    ro?.observe(el);
    vv.addEventListener("resize", enCuadro);
    vv.addEventListener("scroll", enCuadro);
    window.addEventListener("resize", enCuadro);
    return () => {
      if (cuadro) window.cancelAnimationFrame(cuadro);
      ro?.disconnect();
      vv.removeEventListener("resize", enCuadro);
      vv.removeEventListener("scroll", enCuadro);
      window.removeEventListener("resize", enCuadro);
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
    let cuadro = 0;
    const colocar = () => {
      cuadro = 0;
      el.style.top = `${Math.round(vv.offsetTop)}px`;
      el.style.height = `${Math.round(vv.height)}px`;
      el.style.bottom = "auto";
    };
    const enCuadro = () => {
      if (!cuadro) cuadro = window.requestAnimationFrame(colocar);
    };
    colocar();
    vv.addEventListener("resize", enCuadro);
    vv.addEventListener("scroll", enCuadro);
    return () => {
      if (cuadro) window.cancelAnimationFrame(cuadro);
      vv.removeEventListener("resize", enCuadro);
      vv.removeEventListener("scroll", enCuadro);
      el.style.top = "";
      el.style.height = "";
      el.style.bottom = "";
    };
  }, [ref, activo]);
}
