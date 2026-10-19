/**
 * El precio del suelto y el formato de pesos. (La lista de funciones del checkout se fue el 19-oct-2026 con la pantalla de
 * compra nueva: lo que incluye cada producto lo dice lib/compra/compra.ts en una línea.) Las cuatro cards de planes, la
 * calculadora de ahorro y PRICING_PLANS se retiraron el 19-oct-2026 con la oferta nueva: la página de planes lee de
 * lib/planes.ts, y los montos que se cobran viven en flow-products.ts.
 */

/** Precio del análisis individual (referencia base para el ahorro). */
export const SINGLE_PRICE = 9990;

/** "$1.234.567" */
export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
