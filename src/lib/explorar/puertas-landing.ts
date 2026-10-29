// ─────────────────────────────────────────────────────────────────────────────
// LA LANDING CON EL MAPA COMO HERO (29-oct-2026, opción 3 de docs/puerta-b-mockups/7-landing-puertas.html): los textos del hero,
// el enlace a /explorar con la llegada y el mapa de Gran Santiago con los grupos por comuna. Reemplaza al hero compacto y a la
// tarjeta del mapa de la puerta E (estado A de 6-puerta-e.html). SIN DEPENDENCIAS a propósito: lo usa el servidor de la
// landing y nada de esto debe arrastrar código al primer pintado. Lo demás de la puerta E vive en abierto.ts, que reexporta
// esto.
// ─────────────────────────────────────────────────────────────────────────────
import type { PinMapa } from "./portal";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** El hero lleva a /explorar con `?desde=landing` (el botón y el mapa): así se separan, en el panel por puerta, las visitas
 *  que llegan desde la landing de las que llegan directo. */
export const DESDE_LANDING = "landing";
export const HREF_DESDE_LANDING = `/explorar?desde=${DESDE_LANDING}`;

/** Lo revisado anoche, hacia abajo a miles: «+21.000» con 21.247 revisados. Nunca promete más de lo medido. */
export const pisoDeMiles = (n: number) => Math.floor(n / 1000) * 1000;

/** Los textos del hero, en el orden del mockup. Los números salen de la noche: `revisados` del resumen de la noche
 *  (`deptos_resumen_noche`) y `convienen` del universo que muestra Explorar sin cuenta (el mismo número que la bienvenida y
 *  el mapa). Sin el número, la frase sale sin cifra: nunca una cifra escrita a mano. */
export const HERO_MAPA = {
  ojo: (revisados: number | null) =>
    revisados && revisados >= 1000
      ? `Cada noche Franco analiza los +${miles(pisoDeMiles(revisados))} deptos en venta de Santiago.`
      : "Cada noche Franco analiza los deptos en venta de Santiago.",
  titulo: (convienen: number | null) =>
    convienen && convienen > 0 ? `Invierte en uno de los ${miles(convienen)} deptos que convienen hoy.` : "Invierte en uno de los deptos que convienen hoy.",
  boton: "Verlos en el mapa →",
  separador: "¿Tienes uno en la mira?",
  ejemplo: { antes: "Franco te dice si conviene.", enlace: "Ver un ejemplo" },
  /** Lo que lee un lector de pantalla en el mapa, que también lleva a /explorar. */
  mapa: "Ver en el mapa los deptos que convienen hoy",
  /** El camino sin dirección que ubica el depto en un mapa, dicho distinto para no confundirlo con el mapa de Explorar. */
  ubicarEnMapa: "Ubícalo tú en el mapa",
} as const;

// ── EL MAPA DEL HERO ─────────────────────────────────────────────────────────
/** Un grupo del mapa: una comuna, en coordenadas del dibujo. */
export interface GrupoLanding { comuna: string; n: number; x: number; y: number; r: number }
/** El dibujo: un SVG cuadrado (no una foto: en la primera pantalla una imagen pasaría a ser el LCP de la landing) que el hero
 *  muestra a escala 1, centrado y recortado por su caja. Cubre 0,30° de latitud por 0,36° de longitud, ~33 km por lado, con
 *  el centro en el centro de los deptos que convienen: el teléfono, que ve solo el centro, ve donde están. */
export const MAPA_LANDING = { lado: 800, margen: 24, latSpan: 0.3, lngSpan: 0.36 } as const;
/** Un grupo lleva su número cuando el círculo da para escribirlo. */
export const RADIO_CON_NUMERO = 22;
/** Los grupos del mapa: las comunas con más deptos que convienen (hasta `max`), en su centro, con un radio que crece con la
 *  cantidad. SIN PISARSE (QA del 29-oct-2026: Santiago, Providencia y Ñuñoa quedaban uno encima del otro y una cifra se
 *  tapaba): de mayor a menor, una comuna entra solo si su círculo no toca uno ya puesto. */
export function gruposDeLanding(pines: ReadonlyArray<Pick<PinMapa, "comuna" | "lat" | "lng">>, max = 12): GrupoLanding[] {
  const porComuna = new Map<string, { n: number; lat: number; lng: number }>();
  let sLat = 0, sLng = 0, total = 0;
  for (const p of pines) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const g = porComuna.get(p.comuna) ?? { n: 0, lat: 0, lng: 0 };
    g.n++; g.lat += p.lat; g.lng += p.lng;
    porComuna.set(p.comuna, g);
    sLat += p.lat; sLng += p.lng; total++;
  }
  if (!total) return [];
  const todas = Array.from(porComuna.entries()).map(([comuna, g]) => ({ comuna, n: g.n, lat: g.lat / g.n, lng: g.lng / g.n })).sort((a, b) => b.n - a.n);
  const mayor = todas[0]?.n ?? 1;
  const { lado, margen, latSpan, lngSpan } = MAPA_LANDING;
  const cLat = sLat / total, cLng = sLng / total;
  const dentro = (v: number) => Math.min(Math.max(v, margen), lado - margen);
  const puestos: GrupoLanding[] = [];
  for (const g of todas) {
    if (puestos.length >= max) break;
    const r = Math.round(14 + 26 * Math.sqrt(g.n / mayor));
    const x = Math.round(dentro(lado / 2 + ((g.lng - cLng) / lngSpan) * lado));
    const y = Math.round(dentro(lado / 2 - ((g.lat - cLat) / latSpan) * lado));
    if (puestos.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 4)) continue;
    puestos.push({ comuna: g.comuna, n: g.n, x, y, r });
  }
  return puestos;
}
