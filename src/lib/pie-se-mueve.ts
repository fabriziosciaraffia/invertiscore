// ─────────────────────────────────────────────────────────────────────────────
// ¿LA GRILLA MUEVE EL PIE? — una sola regla (25-sep-2026)
//
// Decisión de Fabrizio. Hasta hoy había tres reglas para lo mismo: la grilla hacia Comprar
// (hallazgo de distancia, LTR y STR) congelaba el pie solo con bono pie; la grilla de Comprar
// LTR lo congelaba con CUALQUIER razón declarada de pie cero; y la de Comprar STR además exigía
// pie > 0. Así, un pie 0% «otra fuente» se movía en el pop-up de un Ajustar y quedaba fijo en el
// de un Comprar.
//
// La regla: con pie 0% y razón declarada «bono pie», el pie queda fijo —la plata no es del
// comprador, la pone la inmobiliaria como promoción—. En cualquier otro caso se mueve: otra
// fuente, prefiero no decir, o análisis viejos sin razón. Y en el techo de la grilla no hay a
// dónde subir.
//
// La leen la grilla hacia Comprar (LTR y STR), la grilla de Comprar (LTR y STR) y el rescate por
// pie y plazo. El tier MATRIZ-EXTREMOS fija que ninguna escriba su propia condición.
// ─────────────────────────────────────────────────────────────────────────────

import type { RazonSinCapital } from "./types";

/** El pie máximo que explora cualquier grilla, en % del precio. */
export const PIE_TOPE_GRILLA_PCT = 30;

/** ¿El pie queda fijo porque lo pone la inmobiliaria? Solo con pie 0% y bono pie declarado. */
export function esPieDeBono(piePct: number, razonSinPie: RazonSinCapital | null | undefined): boolean {
  return piePct === 0 && razonSinPie === "bono_pie";
}

/** ¿La grilla puede mover el pie? No con bono pie, y no en el techo. */
export function pieSeMueveEnLaGrilla(piePct: number, razonSinPie: RazonSinCapital | null | undefined): boolean {
  return Number.isFinite(piePct) && piePct < PIE_TOPE_GRILLA_PCT && !esPieDeBono(piePct, razonSinPie);
}
