/**
 * LOS DOS DEMOS PÚBLICOS (25-sep-2026). Uno por modalidad, con deptos distintos, y los dos son
 * filas REALES que el motor recalcula en cada visita por el mismo camino que cualquier informe
 * (`InformeLtr` / `InformeStr`). Hasta hoy `/demo` era un resultado escrito a mano en el código
 * (sin hallazgos: su titular caía a la rama «sin card» y envejecía con cada cambio del informe) y
 * el demo del dashboard era otra fila, 6db7a9ac, que deja de serlo.
 *
 * Dónde se leen:
 *  · `/demo` (renta larga, la pestaña activa al entrar) y `/demo/renta-corta`.
 *  · Las páginas del informe les dan acceso completo a cualquiera (`esDemo`), también por su URL
 *    `/analisis/...`.
 *  · Los botones de borrar (informe LTR y dashboard) no se dibujan para ellas.
 *
 * Renta larga: 1D en Ñuñoa, creado desde la cuenta de Fabrizio a partir de un aviso real.
 * Renta corta: Cerro Colorado 6160, Las Condes.
 */
export const DEMO_LTR_ID = "86bff34a-6856-4d2c-b747-0b18da224eb7";
export const DEMO_STR_ID = "642b58ed-f24c-4bf2-87dc-ee741e5d32ad";
export const DEMO_IDS: readonly string[] = [DEMO_LTR_ID, DEMO_STR_ID];

/** ¿Es una de las filas del demo público? */
export function esDemo(id: string | null | undefined): boolean {
  return !!id && DEMO_IDS.includes(id);
}
