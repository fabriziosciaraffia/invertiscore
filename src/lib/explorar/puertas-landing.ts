// ─────────────────────────────────────────────────────────────────────────────
// LA LANDING CON DOS PUERTAS (29-oct-2026, estado A de docs/puerta-b-mockups/6-puerta-e.html): los textos de la segunda puerta,
// el enlace a /explorar con la llegada y el mapa chico de Gran Santiago con los grupos. SIN DEPENDENCIAS a propósito: el hero
// de la landing es un cliente y todo lo que importe baja antes del primer pintado (LCP en el teléfono). Lo demás de la
// puerta E vive en abierto.ts, que reexporta esto.
// ─────────────────────────────────────────────────────────────────────────────
import type { PinMapa } from "./portal";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

/** La tarjeta de la landing lleva a /explorar con `?desde=landing`: así se separan, en el panel por puerta, las visitas que
 *  llegan desde la landing de las que llegan directo. */
export const DESDE_LANDING = "landing";
export const HREF_DESDE_LANDING = `/explorar?desde=${DESDE_LANDING}`;

export const LANDING_PUERTAS = {
  rotuloInforme: "¿Tienes un depto en la mira?",
  ojo: "¿Buscas dónde invertir?",
  numero: (n: number) => ({ cifra: miles(n), resto: " deptos en venta convienen hoy." }),
  texto: "Míralos en el mapa, sin registrarte.",
  boton: "Ver en el mapa →",
  ejemplo: "Ver un análisis de ejemplo",
} as const;

// ── EL MAPA CHICO DE LA LANDING (estado A) ───────────────────────────────────
/** Un grupo del mapa chico de la landing: una comuna, en coordenadas del dibujo. */
export interface GrupoLanding { comuna: string; n: number; x: number; y: number; r: number }
/** El dibujo (un SVG, no una foto: en la primera pantalla una foto pasaría a ser el LCP de la landing) y la caja de Gran
 *  Santiago que cubre. */
export const MAPA_LANDING = { ancho: 318, alto: 140, margen: 18 } as const;
export const CAJA_LANDING = { sur: -33.64, norte: -33.34, oeste: -70.79, este: -70.47 } as const;
/** Los grupos del mapa chico: las comunas con más deptos que convienen (hasta `max`), en su centro, con un radio que
 *  crece con la cantidad. */
export function gruposDeLanding(pines: ReadonlyArray<Pick<PinMapa, "comuna" | "lat" | "lng">>, max = 6): GrupoLanding[] {
  const porComuna = new Map<string, { n: number; lat: number; lng: number }>();
  for (const p of pines) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const g = porComuna.get(p.comuna) ?? { n: 0, lat: 0, lng: 0 };
    g.n++; g.lat += p.lat; g.lng += p.lng;
    porComuna.set(p.comuna, g);
  }
  const top = Array.from(porComuna.entries()).map(([comuna, g]) => ({ comuna, n: g.n, lat: g.lat / g.n, lng: g.lng / g.n })).sort((a, b) => b.n - a.n).slice(0, max);
  const mayor = top[0]?.n ?? 1;
  const { ancho, alto, margen } = MAPA_LANDING;
  const c = CAJA_LANDING;
  const dentro = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  return top.map((g) => ({
    comuna: g.comuna,
    n: g.n,
    x: Math.round(dentro(margen + ((g.lng - c.oeste) / (c.este - c.oeste)) * (ancho - 2 * margen), margen, ancho - margen)),
    y: Math.round(dentro(margen + ((c.norte - g.lat) / (c.norte - c.sur)) * (alto - 2 * margen), margen, alto - margen)),
    r: Math.round(11 + 7 * Math.sqrt(g.n / mayor)),
  }));
}
