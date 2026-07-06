/**
 * Normaliza una dirección para DISPLAY (no toca datos persistidos).
 *
 * El wizard guarda el `formatted_address` crudo de Google Places, que en Chile
 * llega como "Av. Providencia 1234, 7500571 Providencia, Santiago, Región
 * Metropolitana, Chile" — con código postal, provincia, región y país. Para el
 * usuario solo importa calle + número (y opcionalmente la comuna).
 *
 * Estrategia: el segmento antes de la PRIMERA coma es siempre la calle+número en
 * los formatos que conviven (crudo Google, ya-limpio, sin comuna). La comuna
 * viene de la columna `comuna` (autoritativa), no de parsear el string.
 *
 * Idempotente: aplicar dos veces da el mismo resultado. No daña strings ya
 * limpios ("Av. Apoquindo 5300, Las Condes" → igual) ni los que no tienen
 * comuna ("Pedro de Valdivia 1234" → se le agrega la comuna de la columna).
 *
 * @param direccion  string crudo o limpio (puede ser null/undefined/vacío).
 * @param comuna     opcional. Si se pasa, el resultado es "calle, comuna". Si se
 *                   omite, devuelve solo la calle (útil cuando la superficie ya
 *                   muestra la comuna por separado, ej. HeroLTR: "calle · comuna").
 * @returns "calle número, comuna" | "calle número" | comuna | "".
 */
export function formatDireccionDisplay(
  direccion: string | null | undefined,
  comuna?: string | null,
): string {
  const c = comuna?.trim();
  if (!direccion || !direccion.trim()) return c ?? "";
  // Calle + número = primer segmento antes de la primera coma.
  const calle = direccion.split(",")[0].trim();
  if (!calle) return c ?? "";
  if (!c) return calle;
  // Idempotencia: si la calle ya termina en la comuna, no la dupliques.
  if (calle.toLowerCase().endsWith(c.toLowerCase())) return calle;
  return `${calle}, ${c}`;
}
