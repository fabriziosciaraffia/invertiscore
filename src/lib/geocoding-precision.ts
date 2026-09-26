// ─────────────────────────────────────────────────────────────────────────────
// Precisión de una dirección geocodificada — qué se puede confirmar y qué no
//
// La regla (26-sep-2026): NADA se confirma sin una calle real. Hasta acá el respaldo
// `/api/geocode` tomaba `results[0]` de Google sin mirar qué era, y «asdf» en Ñuñoa devolvía
// el centroide de la comuna, que el wizard aceptaba como dirección confirmada. Es el mismo modo
// de falla del geocoder que escribió centroides de comuna en 946 filas de `scraped_properties`
// (migración `20260902_limpiar_coords_envenenadas`).
//
// Tres respuestas:
//   · "numero" — calle y número: el punto es el edificio (o casi).
//   · "calle"  — una calle sin número (o una intersección): el punto es UN punto de la calle,
//                y en una avenida larga eso puede estar a kilómetros del depto. Se confirma,
//                pero el wizard lo dice y deja mover el pin.
//   · null     — no es una calle: una comuna, una región, un código postal. No se confirma.
//
// Módulo puro: lo usan el servidor (geocoding.ts) y el cliente (Places en la portada y en el
// editor del resumen), así la regla es la misma en los tres caminos.
// ─────────────────────────────────────────────────────────────────────────────

import { cajaParaComuna, dentroDeCaja } from "./comuna-bounds";

export type PrecisionUbicacion = "numero" | "calle";

/** Lo que el wizard guarda: la precisión de la dirección, o "pin" si el usuario movió el pin. */
export type UbicacionPrecision = PrecisionUbicacion | "pin";

export interface ComponenteDireccion {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

const TIPOS_DE_CALLE = ["street_address", "premise", "subpremise", "route", "intersection"];

/**
 * Precisión según los componentes de la dirección (Places y Geocoding usan el mismo formato).
 * Sin un componente `route` no hay calle, y sin calle no hay nada que confirmar.
 */
export function precisionDeComponentes(comps: ComponenteDireccion[] | undefined | null): PrecisionUbicacion | null {
  const tiene = (t: string) => !!comps?.some((c) => c.types?.includes(t));
  if (!tiene("route")) return null;
  return tiene("street_number") ? "numero" : "calle";
}

/**
 * Precisión de un resultado del Geocoding API de Google. Un resultado de ÁREA (comuna, región,
 * barrio, código postal) nunca es una calle aunque traiga componentes de sobra: se descarta por
 * su tipo antes de mirar los componentes.
 */
export function precisionDeResultadoGoogle(r: { types?: string[]; address_components?: ComponenteDireccion[] } | null | undefined): PrecisionUbicacion | null {
  if (!r) return null;
  const tipos = r.types ?? [];
  if (!tipos.some((t) => TIPOS_DE_CALLE.includes(t))) return null;
  const p = precisionDeComponentes(r.address_components);
  // Una intersección no trae número pero sí calles: es un punto de calle, no del edificio.
  if (!p && tipos.includes("intersection")) return "calle";
  return p;
}

/** Precisión de un resultado de Nominatim (con `addressdetails=1`). */
export function precisionDeResultadoNominatim(r: { address?: Record<string, string> } | null | undefined): PrecisionUbicacion | null {
  const ad = r?.address;
  if (!ad) return null;
  const calle = ad.road || ad.pedestrian || ad.footway || ad.residential;
  if (!calle) return null;
  return ad.house_number ? "numero" : "calle";
}

/**
 * ¿Se acepta mover el pin a este punto? Solo dentro de la caja de la comuna de la dirección:
 * el pin corrige DÓNDE en la calle, no la comuna. Si el depto está en otra comuna, lo que hay
 * que cambiar es la dirección.
 */
export function pinDentroDeComuna(comuna: string | null | undefined, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return dentroDeCaja(cajaParaComuna(comuna), lat, lng);
}
