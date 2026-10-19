/**
 * El precio del suelto, las funciones del análisis (checkout) y el formato de pesos. Las cuatro cards de planes, la
 * calculadora de ahorro y PRICING_PLANS se retiraron el 19-oct-2026 con la oferta nueva: la página de planes lee de
 * lib/planes.ts, y los montos que se cobran viven en flow-products.ts.
 */

/** Precio del análisis individual (referencia base para el ahorro). */
export const SINGLE_PRICE = 9990;

export const BASE_FEATURES = [
  "Veredicto de inversión: claro y sin rodeos",
  "Arriendo largo, Airbnb o ambos en cada análisis",
  "Veredicto, recomendación y números completos, con los datos de tu zona",
  "Comparables reales de venta, arriendo y Airbnb por zona",
  "Comparativa entre análisis",
  "24 comunas del Gran Santiago",
];

/** "$1.234.567" */
export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
