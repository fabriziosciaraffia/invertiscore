// ─────────────────────────────────────────────────────────────────────────────
// LOS ÍCONOS DE LOS PINES DEL MAPA DE EXPLORAR (03-nov-2026, la pasada real de Fabrizio): el SVG de cada marcador de Google Maps
// (mapa-explorar.tsx), puro —sin Google ni navegador—, para que el tier EXPLORAR-PASADA lea los colores que de verdad se dibujan.
// Todo marcador sale de `iconoPin`, con el color de su clase y su tema (colores-pin.ts):
//   · «punto»: un depto lejos, sin texto; el ya analizado lleva el ✓ dibujado.
//   · «grupo»: lejos, el número de deptos, del color de su clase.
//   · «etiqueta»: con zoom, la píldora con su texto («+$142 mil», «✓ Analizado», «Nuevo hoy», «−4,2 % dcto.»).
//   · el ELEGIDO: el mismo color, más grande y con el anillo blanco más grueso.
// ─────────────────────────────────────────────────────────────────────────────
import { ANILLO_ELEGIDO_PX, ANILLO_PIN, ANILLO_PIN_PX, colorPin, ESCALA_ELEGIDO, type ClasePin, type TemaPin } from "./colores-pin";

export interface IconoPin { url: string; w: number; h: number; svg: string }
export type FormaPin = { forma: "punto" } | { forma: "grupo"; n: number } | { forma: "etiqueta"; texto: string };

const svgDe = (w: number, h: number, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** El ✓ dibujado (no depende de que la letra traiga el carácter), centrado en (cx, cy), del alto `l`. */
const check = (cx: number, cy: number, l: number, color: string) =>
  `<path d="M${cx - l * 0.42} ${cy + l * 0.02}l${l * 0.3} ${l * 0.3} ${l * 0.55}-${l * 0.6}" fill="none" stroke="${color}" stroke-width="${Math.max(1.6, l * 0.2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const LETRA = `font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600"`;

function interior(clase: ClasePin, tema: TemaPin, f: FormaPin, elegido: boolean): { w: number; h: number; inner: string } {
  const { fondo, texto } = colorPin(clase, tema);
  if (f.forma === "grupo") {
    const w = f.n < 10 ? 34 : f.n < 100 ? 40 : f.n < 1000 ? 48 : 56;
    return { w, h: w, inner: `<circle cx="${w / 2}" cy="${w / 2}" r="${w / 2 - 1.5}" fill="${fondo}" stroke="${ANILLO_PIN}" stroke-width="${ANILLO_PIN_PX}"/><text x="50%" y="50%" dy=".36em" text-anchor="middle" ${LETRA} font-size="12" fill="${texto}">${f.n.toLocaleString("es-CL")}</text>` };
  }
  if (f.forma === "etiqueta") {
    const alto = elegido ? Math.round(26 * ESCALA_ELEGIDO) : 26;
    const letra = elegido ? 14 : 12;
    const anillo = elegido ? ANILLO_ELEGIDO_PX : 1;
    const w = Math.round(18 + f.texto.length * (letra * 0.575)), m = anillo + 1;
    return { w: w + 2 * m, h: alto + 2 * m, inner: `<rect x="${m}" y="${m}" width="${w}" height="${alto}" rx="${alto / 2}" fill="${fondo}" stroke="${ANILLO_PIN}" stroke-width="${anillo}"/><text x="${(w + 2 * m) / 2}" y="${(alto + 2 * m) / 2}" dy=".36em" text-anchor="middle" ${LETRA} font-size="${letra}" fill="${texto}">${esc(f.texto)}</text>` };
  }
  const marca = clase === "analizado";
  const r = elegido ? Math.round(9 * ESCALA_ELEGIDO) : marca ? 9 : 7;
  const anillo = elegido ? ANILLO_ELEGIDO_PX : ANILLO_PIN_PX;
  const w = 2 * (r + anillo), c = w / 2;
  return { w, h: w, inner: `<circle cx="${c}" cy="${c}" r="${r}" fill="${fondo}" stroke="${ANILLO_PIN}" stroke-width="${anillo}"/>${marca ? check(c, c, r * 1.05, texto) : ""}` };
}

/** El ícono de un marcador: su clase, su tema, su forma y si es el elegido. */
export function iconoPin(clase: ClasePin, tema: TemaPin, f: FormaPin, elegido = false): IconoPin {
  const { w, h, inner } = interior(clase, tema, f, elegido);
  const svg = svgDe(w, h, inner);
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, w, h, svg };
}
