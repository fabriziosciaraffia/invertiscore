/**
 * Subsidio a la Tasa Hipotecaria — Ley 21.748 y su ampliación
 *
 * Aplica a viviendas NUEVAS EN PRIMERA VENTA hasta 6.000 UF, con promesa de
 * compraventa desde 2025. Rebaja la tasa hipotecaria respecto del mercado.
 *
 * AMPLIACIÓN DESPACHADA POR EL CONGRESO EL 11-AGO-2026 (ya incorporada acá):
 *   tope 4.000 → 6.000 UF · cupos 50.000 → 80.000 · vigencia para solicitar
 *   hasta el 31-may-2028. La rebaja de tasa no cambió.
 *
 * DOS PRECISIONES QUE EL COPY VIEJO TENÍA MAL
 * ───────────────────────────────────────────
 * 1. NO se exige "primera vivienda". La ley pide vivienda nueva EN PRIMERA
 *    VENTA — condición del inmueble, no del comprador. Solo 6.000 de los cupos
 *    están reservados para primera vivienda de hasta UF 3.000. Franco lo
 *    afirmaba en cuatro superficies y podía estar descalificando gente que sí
 *    califica.
 * 2. La rebaja NO es 0,6 exacto. La ley fija "hasta 60 pb" y MINVU publica que
 *    la rebaja efectiva va de 0,61% a 1,16% según la institución. Acá se modela
 *    0,6 a propósito: es el PISO, así que subestima el beneficio en vez de
 *    inflarlo. El copy debe decirlo como piso ("desde ~0,6 puntos"), nunca como
 *    la cifra exacta.
 *
 * EL PIE DEL 10% NO SE MODELA, Y ES DELIBERADO. Circula como parte del
 * programa, pero NO es requisito de la ley: es el efecto que habilita la
 * garantía FOGAES (cubre hasta el 60% del valor) y que cada banco aplica a su
 * criterio. Franco puede mencionarlo como escenario dependiente del banco;
 * jamás como regla ni como input del motor.
 *
 * Fuente: https://www.minvu.gob.cl/nuevo-subsidio-al-credito-hipotecario/
 *
 * Constantes centralizadas para evitar duplicación entre engine, prompt IA
 * y form. Si MINVU actualiza la rebaja o el techo UF, modificar acá.
 */

/** Piso de la rebaja, en puntos porcentuales. Ver la nota 2 de arriba. */
export const REBAJA_SUBSIDIO = 0.6;
export const TECHO_UF_SUBSIDIO = 6000;
/** Fallback cuando no hay valor de mercado disponible (engine standalone). */
export const TASA_MERCADO_FALLBACK = 4.1;

export function calcTasaConSubsidio(tasaMercado: number): number {
  return Math.round((tasaMercado - REBAJA_SUBSIDIO) * 10) / 10;
}

/**
 * ¿Califica al subsidio? Vivienda nueva en primera venta y precio dentro del
 * techo. El techo es INCLUSIVO: 6.000 UF exactas califican.
 *
 * `tipo` es "nuevo"/"Nuevo" — el llamador ya resolvió qué significa "nuevo" en
 * su contexto. En LTR la fuente de verdad es `input.esNuevo` (ver analysis.ts);
 * en STR es `input.tipoPropiedad`, que el payload STR sí trae.
 */
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
