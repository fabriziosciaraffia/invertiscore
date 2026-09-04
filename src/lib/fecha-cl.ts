/**
 * Formateo de fechas para lo que se renderiza en cliente y en servidor a la vez.
 *
 * Sin `timeZone`, `toLocaleDateString` usa la zona del proceso: en Vercel es UTC y en el
 * navegador del usuario es Chile, así que un `created_at` de madrugada (00:00–04:00 de Chile
 * = 03:00–07:00 UTC, o al revés según el horario de verano) se pinta con DOS días distintos
 * y React lo reporta como error de hidratación (#418 / #423 / #425). Detectado el 04-sep-2026:
 * 57 de 246 filas STR caían en esa ventana y Sentry no lo capturaba. Previo a T0.
 */
export const TZ_CHILE = "America/Santiago";

/** "14 ago 2026" (o "14 de agosto de 2026" con `month: "long"`), siempre en hora de Chile.
 *  Vacío si no hay fecha o no parsea. */
export function fechaCortaCL(
  iso: string | Date | null | undefined,
  opts: { month?: "short" | "long" } = {},
): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: opts.month ?? "short",
    year: "numeric",
    timeZone: TZ_CHILE,
  });
}
