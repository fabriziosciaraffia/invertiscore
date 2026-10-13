// ─────────────────────────────────────────────────────────────────────────────
// QUÉ AVISO ES UN ESTUDIO (13-oct-2026). Quien busca estudio guarda 0 dormitorios en su perfil
// (`dormitoriosDe("Studio") = 0`), y en los avisos ningún estudio tenía 0: la fuente sí manda 0, pero el
// scraper lo descartaba (`dormitorios > 0 ? … : undefined` y `|| null`) y quedaba NULL —798 avisos de venta
// activos, mediana 28 m², ninguno evaluado—; y los que el corredor publica como 1D porque el portal no deja poner 0
// quedaban como 1D. Diez personas no recibían nada.
//
// Un aviso es estudio si:
//   · la fuente dice 0 dormitorios (desde el 13-oct-2026 se guarda el 0), o
//   · viene como 1 dormitorio y el título lo dice: «Studio», «Home Studio», «Estudio», «Monoambiente» o
//     «1 ambiente». No cuenta «1D más estudio» / «+ estudio» / «con estudio»: ese es un depto con pieza de estudio.
// La superficie sola no alcanza (hay 1D de 30 m²). El mismo criterio vive en SQL (`public.es_estudio`, migración
// 20261013_estudios); el tier ESTUDIOS exige que los dos digan lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

/** Las palabras del título que dicen estudio (sin tildes ni mayúsculas que importen). */
export const PATRON_ESTUDIO = /(^|[^a-z0-9áéíóúñ])(home ?studio|studio|estudio|monoambiente|mono ?ambiente|1 ?ambiente)(?![a-z0-9áéíóúñ])/i;
/** «1D más estudio», «+ estudio», «y estudio», «con estudio»: una pieza de estudio, no un estudio. */
export const PATRON_PIEZA_ESTUDIO = /(m[aá]s|\+|(^|[^a-z0-9áéíóúñ])y|con)\s*estudio/i;

export function esEstudio(dormitorios: number | null | undefined, titulo: string | null | undefined): boolean {
  if (dormitorios === 0) return true;
  if (dormitorios !== 1 || !titulo) return false;
  return PATRON_ESTUDIO.test(titulo) && !PATRON_PIEZA_ESTUDIO.test(titulo);
}
