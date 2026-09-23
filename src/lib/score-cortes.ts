// Los cortes del Franco Score (23-sep-2026). Hasta hoy eran dos literales, 70 y 45, en
// `evalVeredicto` (analysis.ts) y en `calcFrancoScoreSTR` (short-term-score.ts): unificados
// LTR+STR desde el 13-may-2026, pero sin nada que los atara. Suben a constante porque el ⓘ del
// Franco Score los cita («desde 70 el veredicto es Comprar…») y la glosa tiene que leer el
// número del motor, no repetirlo. Las señales graves (gates) pueden bajar el veredicto por
// debajo de lo que dice la nota; eso no vive acá.

/** Desde esta nota el veredicto base es COMPRAR. */
export const SCORE_CORTE_COMPRAR = 70;
/** Desde esta nota (y bajo SCORE_CORTE_COMPRAR) el veredicto base es AJUSTA SUPUESTOS; bajo ella, BUSCAR OTRA. */
export const SCORE_CORTE_AJUSTA = 45;
