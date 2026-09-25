// ─────────────────────────────────────────────────────────────────────────────
// LAS BANDAS DE DIFICULTAD DEL DESCUENTO — fuente única del informe (24-sep-2026)
//
// Criterio de Franco, DECLARADO (Fabrizio, 24-sep-2026): hasta 5% es una negociación
// factible, de 5 a 10% es alcanzable con argumentos, sobre 10% es difícil. Reemplazan los
// cortes 5 / 12 que eran doctrinales («lenguaje») y los que /comunas tenía copiados.
//
// SON UNA APRECIACIÓN PARA COMUNICAR, NO UN DATO DEL MERCADO. Sin cierres reales (CBR / SII
// F2890) no sabemos cuánto se negocia de verdad, y por eso estas bandas NO mueven el
// veredicto: etiquetan la card, el pop-up, el capítulo «A qué precio cerrar» y /comunas, y
// ordenan qué combinación recomienda Franco (la banda más fácil disponible primero; ver
// `mix-palancas.ts`). El ⓘ de la banda lo dice.
//
// Vive en su propio módulo porque la lee el MOTOR (`mix-palancas.ts`, que no puede importar
// `distancia-veredicto-hallazgo.ts` sin cerrar un ciclo) y el render. Una sola definición: si
// el mix eligiera con un corte y la card rotulara con otro, la recomendación diría «factible»
// sobre una celda que el mix clasificó difícil.
//
// ⚠ EL PROMPT DE LA IA NO LA LEE. `bandaEsfuerzoDescuento` (5 / 12, con su `lectura` para el
// modelo) sigue alimentando los prompts LTR y STR tal cual, por decisión de Fabrizio del
// 24-sep: la IA sale del informe y su prompt no se toca. Son dos funciones a propósito y con
// dueño distinto; el día que el prompt se retire, `bandaEsfuerzoDescuento` se va con él.
// ─────────────────────────────────────────────────────────────────────────────

/** Hasta acá (incluido) el descuento es una negociación factible. */
export const BANDA_TOPE_FACTIBLE_PCT = 5;
/** Hasta acá (incluido) es alcanzable con argumentos; más arriba, difícil. */
export const BANDA_TOPE_ARGUMENTOS_PCT = 10;

export type BandaDescuento = "factible" | "con_argumentos" | "dificil";

/** La banda de un descuento en % POSITIVO. Cero no tiene banda: no se pide nada. */
export function bandaDeDescuento(descuentoPctAbs: number): BandaDescuento {
  if (descuentoPctAbs <= BANDA_TOPE_FACTIBLE_PCT) return "factible";
  if (descuentoPctAbs <= BANDA_TOPE_ARGUMENTOS_PCT) return "con_argumentos";
  return "dificil";
}

/**
 * LA DIFICULTAD COMO ORDEN, para elegir: 0 = sin descuento (ya llega), 1 factible,
 * 2 con argumentos, 3 difícil. La recomendación de Franco toma la más baja disponible.
 */
export function nivelDeDescuento(descuentoPct: number): 0 | 1 | 2 | 3 {
  const d = Math.abs(descuentoPct);
  if (d === 0) return 0;
  const b = bandaDeDescuento(d);
  return b === "factible" ? 1 : b === "con_argumentos" ? 2 : 3;
}

/** La etiqueta larga (card, capítulo). */
export const ETIQUETA_BANDA: Record<BandaDescuento, string> = {
  factible: "negociación factible",
  con_argumentos: "alcanzable con argumentos",
  dificil: "difícil",
};

/**
 * EL VOCABULARIO DEL POP-UP (mockup final del 25-sep-2026, tras la prueba de Fabrizio en el
 * teléfono). Tres superficies, tres largos, las mismas bandas:
 *  · la CELDA, donde cabe poco: «fácil de negociar», «con argumentos», «difícil de negociar»;
 *  · la FRASE de la celda tocada: «se negocia con argumentos» en vez de «con argumentos», que
 *    suelto dentro de un paréntesis no se entiende;
 *  · la LEYENDA de la escala, con el rango en %.
 * La card y el capítulo siguen con `ETIQUETA_BANDA`.
 */
export const ETIQUETA_BANDA_CELDA: Record<BandaDescuento, string> = {
  factible: "fácil de negociar",
  con_argumentos: "con argumentos",
  dificil: "difícil de negociar",
};
export const ETIQUETA_BANDA_FRASE: Record<BandaDescuento, string> = {
  factible: "fácil de negociar",
  con_argumentos: "se negocia con argumentos",
  dificil: "difícil de negociar",
};
export const ETIQUETA_BANDA_LEYENDA: Record<BandaDescuento, string> = {
  factible: `fácil de negociar (hasta ${BANDA_TOPE_FACTIBLE_PCT}%)`,
  con_argumentos: `con argumentos (${BANDA_TOPE_FACTIBLE_PCT} a ${BANDA_TOPE_ARGUMENTOS_PCT}%)`,
  dificil: `difícil de negociar (más de ${BANDA_TOPE_ARGUMENTOS_PCT}%)`,
};
