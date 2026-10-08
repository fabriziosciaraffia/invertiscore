/**
 * Subsidio a la Tasa Hipotecaria — Ley 21.748, ampliada por la Ley 21.836
 *
 * Aplica a viviendas NUEVAS EN PRIMERA VENTA hasta 6.000 UF, con promesa de
 * compraventa desde 2025. Rebaja la tasa hipotecaria respecto del mercado.
 *
 * LEY 21.836 (Diario Oficial, 17-ago-2026; el Congreso la despachó el 11-ago):
 *   tope 4.000 → 6.000 UF (también el de la garantía FOGAES) · cupos 50.000 →
 *   80.000 · vigencia para solicitar hasta el 31-may-2028. La rebaja de tasa no
 *   cambió. Es la ley que cita el copy (`LEY_SUBSIDIO`): la 21.748 es la
 *   original, con el tope y la vigencia viejos.
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
 *    0,6 y el copy lo dice como REFERENCIA («la rebaja exacta la fija tu banco;
 *    usamos 0,6 puntos como referencia», 08-oct-2026), nunca como la cifra
 *    exacta ni como «la mínima»: con una ley que dice «hasta», llamarla mínima
 *    afirmaba lo que la ley no dice.
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

/** La rebaja que se modela, en puntos porcentuales: una referencia. Ver la nota 2 de arriba. */
export const REBAJA_SUBSIDIO = 0.6;
export const TECHO_UF_SUBSIDIO = 6000;
/** Fallback cuando no hay valor de mercado disponible (engine standalone). */
export const TASA_MERCADO_FALLBACK = 4.1;

// ── EL COPY DE LA LEY (08-oct-2026) ─────────────────────────────────────────
// Una sola redacción para el wizard y el informe. Las cifras salen de las constantes de arriba: si
// el techo o la rebaja cambian, el texto cambia con ellos. La vigencia y la ley se escriben a mano
// porque no las usa ningún cálculo; si una ley nueva las mueve, se cambian acá y en ningún otro lado.
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** La ley vigente que se cita. */
export const LEY_SUBSIDIO = "Ley 21.836";
/** Hasta cuándo se puede solicitar (31-may-2028), dicho como lo dice el copy. */
export const VIGENCIA_SUBSIDIO = "mayo de 2028";
/** A quién le aplica y hasta cuándo: lo que dice todo texto del wizard que nombra el subsidio. */
export const CONDICION_SUBSIDIO = `vivienda nueva en primera venta hasta UF ${miles(TECHO_UF_SUBSIDIO)}, hasta ${VIGENCIA_SUBSIDIO}`;
/** La rebaja como referencia y no como promesa (nota 2). */
export const REBAJA_REFERENCIA = `La rebaja exacta la fija tu banco; usamos ${String(REBAJA_SUBSIDIO).replace(".", ",")} puntos como referencia.`;
/** La línea del informe junto a la tasa, cuando el análisis se hizo con la del subsidio. */
export const LINEA_INFORME_SUBSIDIO = `Tasa con subsidio estatal: vivienda nueva hasta UF ${miles(TECHO_UF_SUBSIDIO)}, rige hasta ${VIGENCIA_SUBSIDIO}. Tú ves si calificas.`;

/**
 * La línea del informe para este análisis, o null. Se dice solo si el motor reconoce la tasa como
 * la del subsidio (`subsidioTasa.aplicado`, que ya exige que el depto califique): la misma
 * compuerta que rotula «con subsidio» la tasa en el resumen del wizard.
 */
export function lineaInformeSubsidio(st: { califica?: boolean; aplicado?: boolean } | null | undefined): string | null {
  return st?.califica === true && st.aplicado === true ? LINEA_INFORME_SUBSIDIO : null;
}

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
