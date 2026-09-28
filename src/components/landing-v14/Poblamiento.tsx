"use client";

// ─────────────────────────────────────────────────────────────────────────────
// El poblamiento del mapa y el contador de «Por qué creerle», atados (27-sep-2026).
//
// Decisión de Fabrizio: el mapa se va poblando en racimos y el contador sube JUNTO con él,
// hasta terminar en la cifra de la fuente única («+40.000», `COMPARABLES_CIFRA`). Después se
// queda quieto. El mapa publica cuánto lleva (0 a 1) y el contador lo escribe; los dos viven
// en columnas distintas de la sección, así que se hablan por este contexto.
//
// El contador escribe directo en el DOM (no en el estado de React): el mapa publica en cada
// cuadro y re-renderizar la sección a 60 cuadros por segundo no tiene sentido.
//
// SIN JS, o con prefers-reduced-motion, se lee la cifra final: es la que viene en el HTML. Con
// JS, el contador parte en 0 recién cuando el mapa empieza a poblarse; si el mapa no tiene
// datos, salta a la cifra final.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

export interface ProgresoMapa {
  /** 0 = nada, 1 = el mapa lleno. */
  set: (p: number) => void;
  escuchar: (fn: (p: number) => void) => () => void;
}

const Ctx = createContext<ProgresoMapa | null>(null);

export function useProgresoMapa(): ProgresoMapa | null {
  return useContext(Ctx);
}

export function PoblamientoMapa({ children }: { children: ReactNode }) {
  const valor = useMemo<ProgresoMapa>(() => {
    const oyentes = new Set<(p: number) => void>();
    let ultimo = -1;
    return {
      set: (p) => {
        if (p === ultimo) return;
        ultimo = p;
        oyentes.forEach((fn) => fn(p));
      },
      escuchar: (fn) => {
        oyentes.add(fn);
        if (ultimo >= 0) fn(ultimo);
        return () => oyentes.delete(fn);
      },
    };
  }, []);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Miles con punto, como la fuente única: 18420 → «18.420». */
const conPuntos = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * La cifra grande: sube con el mapa y termina en la de la fuente única. `final` es la forma
 * con signo («+40.000») y `piso` el número (40.000); los dos vienen de src/lib/stats.ts.
 */
export function ContadorComparables({ final, piso }: { final: string; piso: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const progreso = useProgresoMapa();

  useEffect(() => {
    const el = ref.current;
    if (!el || !progreso) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // con JS el contador arranca en cero: lo que subirá con el mapa
    el.textContent = "0";
    return progreso.escuchar((p) => {
      // los decimales del contador van de a diez: los últimos dígitos no bailan
      el.textContent = p >= 1 ? final : conPuntos(Math.floor((piso * p) / 10) * 10);
    });
  }, [progreso, final, piso]);

  return (
    <span ref={ref} className="lv-big-n">
      {final}
    </span>
  );
}
