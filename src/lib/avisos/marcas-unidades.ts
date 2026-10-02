// Marcas que el pase de unidades de obra nueva deja en `scraped_properties.seen_pass_id` (02-oct-2026).
// Viven aparte para que la evaluación de avisos las lea sin importar el scraper (y su proxy).
//
// El pase de usados (backfill-toctoc) usa la misma columna, pero solo en su universo (condicion usado
// o null): no se pisan.

/** Vista por la ficha nueva en una corrida: `unidades@<instante ISO>`. */
export const PREFIJO_VISTA_UNIDADES = "unidades@";

/** Nunca listada por la ficha nueva aunque su proyecto sí se leyó: `fuera@<instante ISO>`. Queda en la
 *  base para la referencia de la zona, pero sale de la guía, del correo y de avisos_evaluados. */
export const PREFIJO_FUERA_DE_LA_FICHA = "fuera@";

export function esFueraDeLaFicha(seenPassId: string | null | undefined): boolean {
  return (seenPassId ?? "").startsWith(PREFIJO_FUERA_DE_LA_FICHA);
}
