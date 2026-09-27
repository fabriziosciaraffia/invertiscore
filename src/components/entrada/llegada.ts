// ─────────────────────────────────────────────────────────────────────────────
// La llegada al wizard desde afuera — lógica pura, sin React
//
// UNA PUERTA, DOS ACCESOS (26-sep-2026). El hero de la landing y la primera pantalla del wizard son
// el mismo componente. Desde la landing se llega con la dirección ya elegida
// (`?direccion&lat&lng&comuna[&precision]`) o con un camino sin dirección (`?modo=ubicacion|mapa`),
// y el wizard decide dónde arrancar:
//   · con cobertura       → el mapa, que es siempre la segunda pantalla (27-sep-2026): con número el
//                           pin parte en la dirección; sin número, en la calle;
//   · fuera de cobertura  → la portada, con el aviso y la lista de espera.
// ─────────────────────────────────────────────────────────────────────────────

import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";
import { CAJA_COBERTURA, dentroDeCaja } from "@/lib/comuna-bounds";
import { precisionDeTexto, type PrecisionUbicacion } from "@/lib/geocoding-precision";

export interface DireccionLlegada {
  direccion: string;
  comuna: string;
  ciudad: string;
  cubierta: boolean;
  lat: number;
  lng: number;
  precision: PrecisionUbicacion;
}

export type ModoLlegada = "ubicacion" | "mapa";
export type DestinoLlegada = "mapa" | "portada";

/** Lee la dirección que trae la URL. Null si falta algo o las coordenadas no son de Santiago. */
export function leerDireccionLlegada(p: {
  direccion?: string | null;
  lat?: string | null;
  lng?: string | null;
  comuna?: string | null;
  precision?: string | null;
}): DireccionLlegada | null {
  const direccion = (p.direccion ?? "").trim();
  const comunaRaw = (p.comuna ?? "").trim();
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!direccion || !comunaRaw || !p.lat || !p.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Unas coordenadas fuera de la cobertura no se confirman por enlace: la dirección entra, pero
  // como fuera de zona (la portada lo dice), nunca con un punto inventado.
  const match = COMUNAS.find((c) => c.comuna.toLowerCase() === comunaRaw.toLowerCase());
  const comuna = match?.comuna ?? comunaRaw;
  const precision: PrecisionUbicacion =
    p.precision === "numero" || p.precision === "calle" ? p.precision : precisionDeTexto(direccion);
  return {
    direccion,
    comuna,
    ciudad: match?.ciudad ?? "Santiago",
    cubierta: isComunaDisponible(comuna) && dentroDeCaja(CAJA_COBERTURA, lat, lng),
    lat,
    lng,
    precision,
  };
}

export function leerModoLlegada(modo: string | null | undefined): ModoLlegada | null {
  return modo === "ubicacion" || modo === "mapa" ? modo : null;
}

/** Dónde arranca el wizard con esa dirección. */
export function destinoDeLlegada(d: Pick<DireccionLlegada, "cubierta">): DestinoLlegada {
  return d.cubierta ? "mapa" : "portada";
}

/** «Av. Irarrázaval 2100, Ñuñoa, Región Metropolitana, Chile» → «Av. Irarrázaval 2100, Ñuñoa». */
export function direccionCorta(direccion: string | null | undefined): string {
  return (direccion ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(", ");
}

/** ¿El borrador que se ofrece es de OTRA dirección que la que llega? */
export function borradorEsDeOtraDireccion(borrador: string | null | undefined, llega: string): boolean {
  const norm = (s: string) => direccionCorta(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return !!borrador && norm(borrador) !== norm(llega);
}
