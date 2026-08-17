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
 * ¿`fbq` está OPERATIVO, o es todavía el stub que solo encola?
 *
 * El snippet de Meta define `window.fbq` como un stub que hace
 * `queue.push(arguments)`; `callMethod` recién aparece cuando fbevents.js
 * terminó de cargar y tomó el control. Un `typeof fbq === "function"` no
 * distingue los dos estados.
 *
 * Quien necesite la garantía fuerte —un disparo único, sin segunda
 * oportunidad— tiene que consultar esto antes de llamar.
 *
 * Nació investigando por qué AnonAnalysisCreated no llegaba a Meta. Esa causa
 * resultó ser otra —el nombre estaba bloqueado en el Administrador de eventos,
 * ver MetaPixel.tsx— pero el guard se conserva: el modo de fallo que cubre es
 * real y no tenía red.
 */
export function metaPixelOperativo(): boolean {
  if (typeof window === "undefined") return false;
  const fbq = (window as unknown as { fbq?: Fbq & { callMethod?: unknown } }).fbq;
  return typeof fbq === "function" && typeof fbq.callMethod === "function";
}

/**
 * Dispara un evento CUSTOM (nombre propio, fuera del catálogo estándar de Meta).
 * El comando es `trackCustom`, NO `track`: con `track` Meta descarta el evento
 * por no reconocer el nombre. Mismas garantías que metaTrack — no-op si fbq no
 * existe.
 *
 * Devuelve si el evento se ENTREGÓ a fbq. Ojo con el contrato: `true` significa
 * "se lo pasamos a fbq", NO "Meta lo recibió" — si fbq es todavía el stub, el
 * evento queda encolado y puede perderse. Donde la pérdida sea definitiva,
 * combinar con `metaPixelOperativo()`. El booleano no miente sobre lo que sabe:
 * sabe que llamó, no sabe que llegó.
 *
 * Sin `eventId`: los customs de Franco son browser-only (no hay contraparte
 * server-side que deduplicar). Si algún día un custom se envía también por CAPI,
 * agregar el parámetro acá igual que en metaTrack.
 */
export function metaTrackCustom(
  eventName: string,
  params?: Record<string, unknown>
): boolean {
  if (typeof window === "undefined") return false;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return false;
  fbq("trackCustom", eventName, params);
  return true;
}
