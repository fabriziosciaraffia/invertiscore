"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Ancho real (px) de un contenedor, con ResizeObserver. `null` hasta la primera medición (en
 * SSR y en el primer render): los consumidores dibujan con un ancho de referencia y se
 * corrigen al montar. Lo usan PatrimonioBarras (el SVG se dibuja al ancho medido, sin estirar
 * el texto de los ejes) y BarraApiladaB (el rótulo entra al tramo solo si caben los píxeles).
 */
export function useAncho<T extends HTMLElement>(): [React.RefObject<T>, number | null] {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.getBoundingClientRect().width || null);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}
