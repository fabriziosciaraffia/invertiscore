// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA DE LA SELECCIÓN EN EL DASHBOARD (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html): una imagen
// quieta —Google Static Maps con el estilo de Franco, sin marcadores, cacheable porque la URL solo depende del encuadre—
// y encima, dibujados por el servidor en un SVG, los pines de la selección en rojo y numerados y los demás que convienen
// con la búsqueda en gris. La parte pura: el encuadre que hace entrar a la selección, la proyección de cada depto a la
// imagen (Web Mercator, la misma del mapa de Explorar) y la URL. La prueba el tier PUERTA-B-DASHBOARD.
// ─────────────────────────────────────────────────────────────────────────────
import { proyectar } from "@/lib/explorar/explorar";
import { francoMapStaticStyleParams } from "@/lib/map-styles";

export interface PuntoMapa { lat: number; lng: number }
export interface Encuadre { lat: number; lng: number; zoom: number }

/** La imagen: 350×200 puntos (a escala 2 para la pantalla del teléfono), entre los zooms 11 y 15, con margen. */
export const MAPA_CASA = { ancho: 350, alto: 200, escala: 2 as const, zoomMin: 11, zoomMax: 15, margen: 22 } as const;
/** El centro de Santiago, cuando no hay nada que encuadrar. */
export const CENTRO_SANTIAGO: Encuadre = { lat: -33.4378, lng: -70.6205, zoom: 12 };

const esPunto = (p: PuntoMapa) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** El encuadre que hace entrar a todos los puntos con margen: el zoom más cercano que los contiene. */
export function encuadrar(puntos: PuntoMapa[], o: typeof MAPA_CASA = MAPA_CASA): Encuadre {
  const ps = puntos.filter(esPunto);
  if (ps.length === 0) return CENTRO_SANTIAGO;
  const lats = ps.map((p) => p.lat), lngs = ps.map((p) => p.lng);
  const centro = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  for (let zoom = o.zoomMax; zoom > o.zoomMin; zoom--) {
    const c = proyectar(centro.lat, centro.lng, zoom);
    const cabe = ps.every((p) => {
      const q = proyectar(p.lat, p.lng, zoom);
      return Math.abs(q.x - c.x) <= o.ancho / 2 - o.margen && Math.abs(q.y - c.y) <= o.alto / 2 - o.margen;
    });
    if (cabe) return { ...centro, zoom };
  }
  return { ...centro, zoom: o.zoomMin };
}

/** Dónde cae un depto en la imagen (en puntos, desde la esquina de arriba a la izquierda); null si queda fuera. */
export function enImagen(p: PuntoMapa, e: Encuadre, o: typeof MAPA_CASA = MAPA_CASA): { x: number; y: number } | null {
  if (!esPunto(p)) return null;
  const c = proyectar(e.lat, e.lng, e.zoom), q = proyectar(p.lat, p.lng, e.zoom);
  const x = o.ancho / 2 + (q.x - c.x), y = o.alto / 2 + (q.y - c.y);
  return x >= 0 && x <= o.ancho && y >= 0 && y <= o.alto ? { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : null;
}

/** La imagen de fondo: el estilo claro de Franco, sin marcadores (los dibuja el SVG de encima). null sin la llave. */
export function urlMapaCasa(e: Encuadre, apiKey: string | undefined, o: typeof MAPA_CASA = MAPA_CASA): string | null {
  if (!apiKey) return null;
  const partes = [
    `center=${e.lat.toFixed(5)},${e.lng.toFixed(5)}`,
    `zoom=${e.zoom}`,
    `size=${o.ancho}x${o.alto}`,
    `scale=${o.escala}`,
    "maptype=roadmap",
    ...francoMapStaticStyleParams("light"),
    `key=${apiKey}`,
  ];
  return `https://maps.googleapis.com/maps/api/staticmap?${partes.join("&")}`;
}

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** Dónde están los grises, por las comunas de su perfil: «en Providencia», «en Providencia y Ñuñoa», «en tus 3 comunas». */
export function enSusComunas(comunas: readonly string[]): string {
  if (comunas.length === 0) return "en tu búsqueda";
  if (comunas.length === 1) return `en ${comunas[0]}`;
  if (comunas.length === 2) return `en ${comunas[0]} y ${comunas[1]}`;
  return `en tus ${comunas.length} comunas`;
}

/**
 * «5 en tu selección · 11 más en Providencia» (24-oct-2026, recorrido de Fabrizio): los grises son los que convienen con
 * los filtros de su perfil, y la píldora dice dónde. Sin otros: «5 en tu selección».
 */
export function pildoraMapa(enSeleccion: number, otros: number, comunas: readonly string[]): string {
  const base = `${enSeleccion} en tu selección`;
  return otros > 0 ? `${base} · ${miles(otros)} más ${enSusComunas(comunas)}` : base;
}

/**
 * «Explorar los 4.770 de Santiago» (24-oct-2026): el total que conviene en todo Santiago, el mismo que dice /deptos
 * (lib/deptos/portada.ts › noche.convienen) y, desde el 30-oct-2026, el mismo del mapa, la landing y la bienvenida de
 * /explorar (explorar/portal-cache.ts › convienenHoy: un solo número en todo el sitio). Al tocarlo, /explorar abre la vista global —todo Gran Santiago con esos mismos
 * supuestos— (28-oct-2026, Explorar como portal; hasta entonces abría con los filtros del perfil). Sin el total, «Explorar
 * en el mapa».
 */
export function botonExplorar(totalNoche: number | null | undefined): string {
  return totalNoche != null && totalNoche > 0 ? `Explorar los ${miles(totalNoche)} de Santiago` : "Explorar en el mapa";
}
