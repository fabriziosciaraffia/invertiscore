// ─────────────────────────────────────────────────────────────────────────────
// LAS CAPAS DE REFERENCIA DEL MAPA (26-nov-2026, entrega 2 › B y C, lámina 5c del canvas de la asesoría): de lejos, los límites de las
// comunas con su nombre; de cerca, las líneas de Metro con su color y las estaciones con su marcador y su nombre. TENUES: son
// referencia, no información. Van DEBAJO de los pines, no se pueden tocar (el toque solo mira los pines) y se piden DESPUÉS de los
// primeros pines (no atrasan la primera carga). Cada capa aparece y desaparece en sus zooms (ZOOMS_REFERENCIA); en el teléfono manda
// la limpieza: los nombres de comuna se van antes y el Metro aparece más cerca.
// FUENTES: © OpenStreetMap (ODbL), el mismo crédito que ya está en el mapa. Límites admin_level=8 y color de cada ruta de Metro vía
// Overpass (26-nov-2026); vías de Metro del extracto BBBike (22-nov-2026). Simplificados fuera del repo: llegan solo los archivos.
// EL METRO, v2 (26-nov-2026, revisión del preview de Fabrizio): UN trazo por línea —el eje, no las dos vías de cada sentido—, con el color
// original de Metro y sin transparencia; las estaciones vienen en el mismo archivo, CADA UNA SOBRE SU LÍNEA, y cada combinación es UN
// punto al que llegan todas sus líneas (donde se cruzan; si una termina ahí, sobre la que sigue). Las estaciones salen de
// metro-stations.ts (las activas), juntando las repetidas por línea y dejando fuera las que no están sobre ninguna vía.
// Puro salvo `cargarReferencias` (red y el logo, solo en el navegador).
// ─────────────────────────────────────────────────────────────────────────────
import type { Dibujo } from "./capa-canvas";
import { LOGO_METRO } from "./marcador-estacion";

/** Los zooms de cada capa, [desde, hasta] incluidos, en el PC y en el teléfono (FASE 0 de la entrega 2, aprobada). Los pines: grupos
 *  hasta 12, puntos de 13 a 15, etiquetas desde 16 (capa-canvas.ts). */
export const ZOOMS_REFERENCIA = {
  limites: { pc: [9, 13], telefono: [9, 13] },
  nombresComuna: { pc: [10, 12], telefono: [10, 11] },
  lineasMetro: { pc: [13, 22], telefono: [14, 22] },
  // 26-nov-2026 (revisión del preview): el logo, desde el mismo zoom que las líneas; el nombre con sus líneas, un zoom después.
  estaciones: { pc: [13, 22], telefono: [14, 22] },
  nombresEstacion: { pc: [14, 22], telefono: [15, 22] },
} as const;
export type CapaReferencia = keyof typeof ZOOMS_REFERENCIA;

/** ¿Se ve esta capa a este zoom? */
export function capaSeVe(capa: CapaReferencia, zoom: number, telefono: boolean): boolean {
  const [desde, hasta] = ZOOMS_REFERENCIA[capa][telefono ? "telefono" : "pc"];
  return zoom >= desde && zoom <= hasta;
}

/** Lo tenue de cada capa, por tema (el canvas las pinta así; lo fija el tier). */
export const ESTILO_REFERENCIAS = {
  limite: { claro: "rgba(15, 15, 15, 0.30)", oscuro: "rgba(255, 255, 255, 0.22)", ancho: 1 },
  nombreComuna: { claro: "rgba(15, 15, 15, 0.50)", oscuro: "rgba(255, 255, 255, 0.55)", halo: { claro: "rgba(255, 255, 255, 0.85)", oscuro: "rgba(20, 20, 20, 0.85)" }, fuente: "600 11px Inter, system-ui, sans-serif" },
  // Sólidas: el color original de Metro, sin transparencia, en un trazo que se reconoce a la primera (siguen debajo de los pines).
  lineaMetro: { ancho: 3 },
  nombreEstacion: { claro: "rgba(30, 30, 30, 0.85)", oscuro: "rgba(235, 235, 235, 0.85)", halo: { claro: "rgba(255, 255, 255, 0.9)", oscuro: "rgba(20, 20, 20, 0.9)" }, fuente: "500 11px Inter, system-ui, sans-serif" },
} as const;

/** Las líneas que siguen al nombre de una estación: un círculo por línea con su número («4A» en la 4A), en blanco sobre el color de la
 *  línea; en el amarillo de la L2, en negro para que se lea. Ejemplo: Los Leones (1)(6). */
export const LINEA_EN_NOMBRE = { radio: 7, separacion: 2, aireTexto: 4, fuente: "700 9px Inter, system-ui, sans-serif", fuenteLarga: "700 8px Inter, system-ui, sans-serif", textoClaro: "#FFFFFF", textoOscuro: "#0F0F0F", oscuroEn: ["L2"] as readonly string[] } as const;
/** El número que va en el círculo de una línea: «L1» → «1», «L4A» → «4A». */
export const numeroDeLinea = (ref: string): string => ref.replace(/^L/, "");
/** El color del número sobre el círculo de una línea. */
export const textoSobreLinea = (ref: string): string => (LINEA_EN_NOMBRE.oscuroEn.includes(ref) ? LINEA_EN_NOMBRE.textoOscuro : LINEA_EN_NOMBRE.textoClaro);
/** Lo que ocupan los círculos de las líneas, con el aire que los separa del nombre. */
export const anchoLineasDeNombre = (n: number): number => (n > 0 ? LINEA_EN_NOMBRE.aireTexto + n * 2 * LINEA_EN_NOMBRE.radio + (n - 1) * LINEA_EN_NOMBRE.separacion : 0);

/** Los archivos (public/explorar): la versión va en el nombre. */
export const ARCHIVO_COMUNAS = "/explorar/capa-comunas.v1.json";
export const ARCHIVO_METRO = "/explorar/capa-metro.v2.json";

export interface DatosComunas { fuente: string; comunas: Array<{ n: string; e: [number, number]; a: number[][] }> }
/** v2: un eje por línea (lat, lng, lat, lng…) y las estaciones con sus líneas y su punto, ya sobre las líneas. */
export interface DatosMetro { fuente: string; lineas: Record<string, { color: string; eje: number[] }>; estaciones: Array<{ n: string; l: string[]; p: [number, number] }> }
export interface Referencias { comunas: DatosComunas | null; metro: DatosMetro | null; logo: HTMLImageElement | null }

type Pt = [number, number];
export interface LineaDeEstacion { ref: string; color: string }
export interface DibujoReferencias {
  limites: Pt[][];
  lineas: Array<{ color: string; eje: Pt[] }>;
  estaciones: Array<{ x: number; y: number; nombre: string; lineas: LineaDeEstacion[] }>;
  nombres: Array<{ texto: string; x: number; y: number; tipo: "comuna" | "estacion"; lineas?: LineaDeEstacion[] }>;
  anchoLinea: number;
}

/** Dónde prueba el nombre de una comuna, en píxeles desde la mediana de sus avisos: primero ahí, después alrededor (hasta 44 px). */
export const DESPLAZAMIENTOS_NOMBRE: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, -26], [0, 26], [-48, 0], [48, 0], [-34, -22], [34, -22], [-34, 22], [34, 22], [0, -44], [0, 44]];
/** ¿El punto está dentro del anillo (en píxeles)? */
function dentroDe(x: number, y: number, anillo: ReadonlyArray<readonly [number, number]>): boolean {
  let c = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

interface Caja { x0: number; y0: number; x1: number; y1: number }
const choca = (a: Caja, b: Caja) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** La caja que ocupa un dibujo de los pines (los nombres de referencia les ceden el lugar). */
function cajaDe(d: Dibujo): Caja {
  if (d.tipo === "etiqueta") return { x0: d.x - d.w / 2 - 2, y0: d.y - d.h / 2 - 2, x1: d.x + d.w / 2 + 2, y1: d.y + d.h / 2 + 2 };
  const r = (d.tipo === "grupo" ? d.r : d.r ?? 6) + 2;
  return { x0: d.x - r, y0: d.y - r, x1: d.x + r, y1: d.y + r };
}

/** Lo que se dibuja de las capas de referencia a este zoom: en píxeles del contenedor, solo lo que se ve, y los nombres que no
 *  chocan con los pines ni entre sí. */
export function componerReferencias(r: Pick<Referencias, "comunas" | "metro">, o: {
  zoom: number; telefono: boolean; vista: { w: number; h: number }; ocupados: readonly Dibujo[];
  aPixel: (lat: number, lng: number) => { x: number; y: number }; ancho: (texto: string, tipo: "comuna" | "estacion") => number;
}): DibujoReferencias {
  const out: DibujoReferencias = { limites: [], lineas: [], estaciones: [], nombres: [], anchoLinea: ESTILO_REFERENCIAS.lineaMetro.ancho };
  const dentro = (x: number, y: number, m = 40) => x > -m && y > -m && x < o.vista.w + m && y < o.vista.h + m;
  const proyectar = (plano: number[]): Pt[] => { const pts: Pt[] = []; for (let i = 0; i + 1 < plano.length; i += 2) { const p = o.aPixel(plano[i], plano[i + 1]); pts.push([p.x, p.y]); } return pts; };
  const ocupadas: Caja[] = o.ocupados.map(cajaDe);
  const ponerNombre = (texto: string, tipo: "comuna" | "estacion", x: number, y: number, alineado: "centro" | "derecha" | "izquierda", lineas?: LineaDeEstacion[]) => {
    // El ancho incluye los círculos de las líneas que siguen al nombre de la estación (también ceden ante los pines).
    const w = o.ancho(texto, tipo) + anchoLineasDeNombre(lineas?.length ?? 0), h = lineas?.length ? 2 * LINEA_EN_NOMBRE.radio + 1 : 13;
    const x0 = alineado === "centro" ? x - w / 2 : alineado === "derecha" ? x : x - w;
    const caja = { x0: x0 - 2, y0: y - h / 2 - 1, x1: x0 + w + 2, y1: y + h / 2 + 1 };
    if (!dentro(caja.x0, caja.y0, 0) || !dentro(caja.x1, caja.y1, 0) || ocupadas.some((c) => choca(c, caja))) return false;
    ocupadas.push(caja);
    out.nombres.push(lineas ? { texto, x: x0, y, tipo, lineas } : { texto, x: x0, y, tipo });
    return true;
  };
  // Los marcadores de estación ocupan su lugar antes que los nombres (un nombre no tapa un logo).
  if (r.metro && capaSeVe("lineasMetro", o.zoom, o.telefono)) {
    for (const [, l] of Object.entries(r.metro.lineas)) out.lineas.push({ color: l.color, eje: proyectar(l.eje) });
  }
  if (r.metro && capaSeVe("estaciones", o.zoom, o.telefono)) {
    const colorDe = (ref: string) => r.metro?.lineas[ref]?.color ?? "#6B6B72";
    for (const s of r.metro.estaciones) {
      const p = o.aPixel(s.p[0], s.p[1]);
      if (!dentro(p.x, p.y, 12)) continue;
      out.estaciones.push({ x: p.x, y: p.y, nombre: s.n, lineas: s.l.map((ref) => ({ ref, color: colorDe(ref) })) });
      ocupadas.push({ x0: p.x - 10, y0: p.y - 8, x1: p.x + 10, y1: p.y + 8 });
    }
    if (capaSeVe("nombresEstacion", o.zoom, o.telefono)) for (const s of out.estaciones) { if (!ponerNombre(s.nombre, "estacion", s.x + 12, s.y, "derecha", s.lineas)) ponerNombre(s.nombre, "estacion", s.x - 12, s.y, "izquierda", s.lineas); }
  }
  const verLimites = capaSeVe("limites", o.zoom, o.telefono), verNombres = capaSeVe("nombresComuna", o.zoom, o.telefono);
  if (r.comunas && (verLimites || verNombres)) {
    for (const c of r.comunas.comunas) {
      const anillos = c.a.map(proyectar);
      if (verLimites) out.limites.push(...anillos);
      if (!verNombres) continue;
      // EL NOMBRE BUSCA SU LUGAR (26-nov-2026, revisión visual: en la mediana de los avisos siempre había un grupo y ningún nombre
      // salía). Prueba la mediana y, si está ocupada, posiciones cerca; toma la primera libre que siga DENTRO de su comuna.
      const p = o.aPixel(c.e[0], c.e[1]);
      const texto = c.n.toLocaleUpperCase("es-CL");
      for (const [dx, dy] of DESPLAZAMIENTOS_NOMBRE) {
        const x = p.x + dx, y = p.y + dy;
        if (!anillos.some((a) => dentroDe(x, y, a))) continue;
        if (ponerNombre(texto, "comuna", x, y, "centro")) break;
      }
    }
  }
  return out;
}

let cargando: Promise<Referencias> | null = null;
/** Trae las dos capas y el logo, UNA vez por visita (lo llama el mapa después de dibujar los primeros pines). Lo que falle queda null. */
export function cargarReferencias(): Promise<Referencias> {
  if (cargando) return cargando;
  const json = <T,>(url: string) => fetch(url, { cache: "force-cache" }).then((x) => (x.ok ? (x.json() as Promise<T>) : null)).catch(() => null);
  const logo = (): Promise<HTMLImageElement | null> => new Promise((listo) => { const img = new Image(); img.onload = () => listo(img); img.onerror = () => listo(null); img.src = LOGO_METRO.src; });
  cargando = Promise.all([json<DatosComunas>(ARCHIVO_COMUNAS), json<DatosMetro>(ARCHIVO_METRO), logo()]).then(([comunas, metro, img]) => ({ comunas, metro, logo: img }));
  return cargando;
}
