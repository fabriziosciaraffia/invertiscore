// ─────────────────────────────────────────────────────────────────────────────
// LA VISTA DE LA CALLE DE LA TARJETA (28-oct-2026, goal «Explorar como portal», decisión de Fabrizio). La imagen sale de
// Street View POR COORDENADAS, nunca por dirección: primero la consulta de metadata —gratis— y la foto se usa solo si
//   · existe un panorama de EXTERIOR (`source=outdoor`),
//   · es de GOOGLE (el copyright lo dice; los panoramas que sube cualquiera —corredoras, hoteles— no entran),
//   · fue tomado A MENOS DE 40 METROS del punto del aviso,
// y con la cámara ORIENTADA HACIA EL PUNTO (el rumbo del panorama al aviso). Lleva la etiqueta «Vista de la calle», nunca
// «el edificio»: es la cuadra, no se sabe si es la fachada. Si no hay foto que cumpla, la tarjeta lleva un mapa estático
// chico con el pin en la cuadra. Medido antes de construirla (28-oct-2026, 400 de los 4.774 Comprar de Gran Santiago):
// 86,8 % con foto válida; distancia mediana 13,9 m. Cada respuesta de metadata se guarda (`calle_avisos`) y vuelve a
// consultarse a los 30 días (lo que Google deja guardar coordenadas); cada imagen, en la caché del CDN.
// UN RECHAZO DE GOOGLE NO ES «SIN FOTO»: con la API apagada o la llave sin permiso (REQUEST_DENIED, OVER_QUERY_LIMIT…) la
// decisión es null y no se guarda, así el día que la API se active las fotos aparecen solas. Puro: lo prueba el tier
// EXPLORAR-PORTAL.
// ─────────────────────────────────────────────────────────────────────────────

/** El punto del aviso y el del panorama. */
export interface Punto { lat: number; lng: number }

/** A cuántos metros del aviso puede estar el panorama. */
export const CALLE_MAX_M = 40;
/** Cuánto vale una respuesta guardada (Google deja guardar coordenadas hasta 30 días). */
export const VIDA_CALLE_MS = 30 * 864e5;
/** El tamaño de la imagen: la tarjeta la muestra a 96 px y la lista a 76, en pantallas de doble densidad. */
export const LADO_IMAGEN = 200;

export const CALLE_COPY = { etiqueta: "Vista de la calle", mapa: "Ubicación en el mapa" } as const;

/** Lo que responde la metadata de Street View (la parte que se usa). */
export interface MetadataCalle {
  status: string;
  pano_id?: string;
  location?: { lat: number; lng: number };
  copyright?: string;
  date?: string;
}

export type DecisionCalle =
  | { estado: "foto"; panoId: string; pano: Punto; distanciaM: number; rumbo: number; fecha: string | null; copyright: string }
  | { estado: "mapa"; motivo: "sin-panorama" | "lejos" | "no-google" };

const RAD = Math.PI / 180;

/** Los metros entre dos puntos (haversine). */
export function metrosEntre(a: Punto, b: Punto): number {
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** El rumbo desde un punto hacia otro, en grados (0 = norte, 90 = este). */
export function rumboHacia(desde: Punto, hacia: Punto): number {
  const y = Math.sin((hacia.lng - desde.lng) * RAD) * Math.cos(hacia.lat * RAD);
  const x = Math.cos(desde.lat * RAD) * Math.sin(hacia.lat * RAD) - Math.sin(desde.lat * RAD) * Math.cos(hacia.lat * RAD) * Math.cos((hacia.lng - desde.lng) * RAD);
  return Math.round(((Math.atan2(y, x) / RAD + 360) % 360) * 10) / 10;
}

/** Lo que dice la metadata, para ESTE punto: foto (con el rumbo hacia el aviso), mapa (con el motivo), o null si Google
 *  rechazó la consulta (no se guarda). */
export function decidirCalle(m: MetadataCalle | null | undefined, punto: Punto): DecisionCalle | null {
  if (!m || typeof m.status !== "string") return null;
  if (m.status === "ZERO_RESULTS" || m.status === "NOT_FOUND") return { estado: "mapa", motivo: "sin-panorama" };
  if (m.status !== "OK") return null;
  const lat = Number(m.location?.lat), lng = Number(m.location?.lng);
  if (!m.pano_id || !Number.isFinite(lat) || !Number.isFinite(lng)) return { estado: "mapa", motivo: "sin-panorama" };
  const pano = { lat, lng };
  const distanciaM = Math.round(metrosEntre(pano, punto) * 10) / 10;
  if (!(distanciaM < CALLE_MAX_M)) return { estado: "mapa", motivo: "lejos" };
  if (!/google/i.test(m.copyright ?? "")) return { estado: "mapa", motivo: "no-google" };
  return { estado: "foto", panoId: m.pano_id, pano, distanciaM, rumbo: rumboHacia(pano, punto), fecha: m.date ?? null, copyright: m.copyright ?? "" };
}

/** ¿Lo guardado sigue valiendo para este punto? Vence a los 30 días o si el aviso se movió de lugar. */
export function calleVigente(g: { lat: number; lng: number; consultado_at: string } | null | undefined, punto: Punto, ahora: Date = new Date()): boolean {
  if (!g) return false;
  const at = Date.parse(g.consultado_at);
  if (!Number.isFinite(at) || ahora.getTime() - at > VIDA_CALLE_MS) return false;
  return metrosEntre({ lat: Number(g.lat), lng: Number(g.lng) }, punto) < 1;
}

const coord = (p: Punto) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** La consulta de metadata: por coordenadas, a 40 m, solo exterior. */
export function urlMetadataCalle(punto: Punto, key: string): string {
  return `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coord(punto)}&radius=${CALLE_MAX_M}&source=outdoor&key=${encodeURIComponent(key)}`;
}

/** La foto: ESE panorama (por su id), con la cámara hacia el aviso. */
export function urlFotoCalle(d: { panoId: string; rumbo: number }, key: string, lado: number = LADO_IMAGEN): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${lado}x${lado}&pano=${encodeURIComponent(d.panoId)}&heading=${d.rumbo}&pitch=8&fov=80&return_error_code=true&key=${encodeURIComponent(key)}`;
}

/** El mapa chico: la cuadra, con el pin del aviso, en el estilo claro de Franco (`estilo`: los parámetros de map-styles). */
export function urlMapaChico(punto: Punto, key: string, estilo: readonly string[] = [], lado: number = LADO_IMAGEN / 2): string {
  const partes = [`center=${coord(punto)}`, "zoom=17", `size=${lado}x${lado}`, "scale=2", "maptype=roadmap", ...estilo, `markers=color:0xC8323C%7Csize:mid%7C${coord(punto)}`, `key=${encodeURIComponent(key)}`];
  return `https://maps.googleapis.com/maps/api/staticmap?${partes.join("&")}`;
}

/** La dirección de la imagen de un aviso en Franco (la ruta la sirve desde la caché del CDN). En oscuro, `?tema=oscuro`: el mapa
 *  chico en el estilo oscuro, con su propia entrada en la caché (la foto de la calle es la misma). */
export const rutaImagenCalle = (avisoId: string, oscuro = false): string => `/api/explorar/calle/${encodeURIComponent(avisoId)}${oscuro ? "?tema=oscuro" : ""}`;
