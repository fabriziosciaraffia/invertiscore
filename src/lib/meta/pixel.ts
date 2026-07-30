/**
 * Wrapper client-side del Meta Pixel (browser). No-op seguro si el Pixel no está
 * cargado (sin NEXT_PUBLIC_META_PIXEL_ID, o antes de que fbevents.js inicialice).
 *
 * `eventId` = clave de dedup compartida con la Conversions API server-side: Meta
 * colapsa el evento del browser y el del server cuando comparten event_name +
 * event_id. Ver src/lib/meta/capi.ts y src/components/analytics/MetaPixel.tsx.
 */

type Fbq = (
  command: string,
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void;

/** Dispara un evento estándar del Pixel. No hace nada si fbq no existe. */
export function metaTrack(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  fbq("track", eventName, params, eventId ? { eventID: eventId } : undefined);
}

/**
 * Dispara un evento CUSTOM (nombre propio, fuera del catálogo estándar de Meta).
 * El comando es `trackCustom`, NO `track`: con `track` Meta descarta el evento
 * por no reconocer el nombre. Mismas garantías que metaTrack — no-op si fbq no
 * existe.
 *
 * Sin `eventId`: los customs de Franco son browser-only (no hay contraparte
 * server-side que deduplicar). Si algún día un custom se envía también por CAPI,
 * agregar el parámetro acá igual que en metaTrack.
 */
export function metaTrackCustom(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  fbq("trackCustom", eventName, params);
}
