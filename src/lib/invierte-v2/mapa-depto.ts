// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA CHICO DE LA PÁGINA DEL DEPTO (rediseño del 23-nov-2026, láminas 4.2; LEEME: «un mapa chico y estático con el punto; Ver mapa
// lo abre en ventana; no debe gastar el cupo de lecturas del mapa de producción»).
//   · Una imagen de Google Static Maps con el estilo claro de Franco y el pin en el color de su clase (el azul de ✓ Comprar o la ciruela
//     de − Ajustar, como en Explorar; nunca rojo). El punto ya está guardado: la ubicación confirmada por Franco (inv_ubicaciones) o la
//     coordenada del listado (scraped_properties). NINGUNA FICHA: no lee la publicación ni toca el cupo de 30 por hora del mapa, ni
//     el carril de Invierte. Es la misma llave pública que ya usa el mapa chico de las tarjetas de Explorar.
//   · «Ver mapa» abre una ventana con la misma imagen más grande y un zoom menos (la cuadra y sus alrededores). Sin JavaScript de mapas.
// Puro: lo usan la página del depto (servidor) y el tier.
// ─────────────────────────────────────────────────────────────────────────────
import { francoMapStaticStyleParams } from "@/lib/map-styles";
import { colorPin, colorStaticMaps } from "@/lib/explorar/colores-pin";

export interface PuntoDepto { lat: number; lng: number }
/** Las dos imágenes: la chica de la página (celular y PC) y la grande de la ventana. Static Maps acepta hasta 640 por lado. */
export const MAPA_DEPTO = { chico: { ancho: 260, alto: 190, zoom: 16 }, grande: { ancho: 640, alto: 440, zoom: 15 } } as const;

const coord = (p: PuntoDepto) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
export const puntoValido = (p: PuntoDepto | null | undefined): p is PuntoDepto =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function urlMapaDepto(p: PuntoDepto, key: string, medida: { ancho: number; alto: number; zoom: number }, ajustar = false): string {
  const pin = colorStaticMaps(colorPin(ajustar ? "ajustar" : "comprar", "claro").fondo);
  const partes = [`center=${coord(p)}`, `zoom=${medida.zoom}`, `size=${medida.ancho}x${medida.alto}`, "scale=2", "maptype=roadmap", ...francoMapStaticStyleParams("light"), `markers=color:${pin}%7Csize:mid%7C${coord(p)}`, `key=${encodeURIComponent(key)}`];
  return `https://maps.googleapis.com/maps/api/staticmap?${partes.join("&")}`;
}
