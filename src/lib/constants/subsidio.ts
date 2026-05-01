/**
 * Subsidio a la Tasa Hipotecaria — Ley 21.748
 *
 * Vigente hasta mayo 2027. Aplica a viviendas nuevas ≤ 4.000 UF, primera
 * vivienda, promesa de compraventa desde 2025. Rebaja la tasa hipotecaria
 * en ~0,6 puntos porcentuales respecto al mercado.
 *
 * Fuente: https://www.minvu.gob.cl/nuevo-subsidio-al-credito-hipotecario/
 *
 * Constantes centralizadas para evitar duplicación entre engine, prompt IA
 * y form. Si MINVU actualiza la rebaja o el techo UF, modificar acá.
 */

export const REBAJA_SUBSIDIO = 0.6;
export const TECHO_UF_SUBSIDIO = 4000;
/** Fallback cuando no hay valor de mercado disponible (engine standalone). */
export const TASA_MERCADO_FALLBACK = 4.1;

export function calcTasaConSubsidio(tasaMercado: number): number {
  return Math.round((tasaMercado - REBAJA_SUBSIDIO) * 10) / 10;
}

export function calificaSubsidio(tipo: string, precioUF: number): boolean {
  return (tipo === "Nuevo" || tipo === "nuevo") && precioUF > 0 && precioUF <= TECHO_UF_SUBSIDIO;
}

/**
 * El usuario "ya está usando" la tasa subsidiada si su tasa ingresada está
 * dentro de un margen de tolerancia (~0,2 pp) respecto a la tasa con subsidio
 * calculada. Margen para tolerar leves redondeos del usuario.
 */
export function aplicaSubsidio(tasaIngresada: number, tasaConSubsidio: number): boolean {
  return tasaIngresada <= tasaConSubsidio + 0.2;
}
