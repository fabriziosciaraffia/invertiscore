// ─────────────────────────────────────────────────────────────────────────────
// LA CAPA «SI NEGOCIAS EL PRECIO» DE EXPLORAR (02-nov-2026, goal «Filtros v2 y negociar», mockup
// docs/puerta-b-mockups/8-filtros-v2-negociar.html, estado C). Las reglas puras; el servidor está en portal-servidor.ts y la noche
// en avisos/negociar.ts.
//   · QUÉ SON: los que al precio publicado dan AJUSTAR y llegan a COMPRAR si se consigue un descuento, hasta el tope elegido (5 %
//     o 10 %). Los Buscar otro nunca entran (la noche no les guarda descuento).
//   · APARTE, SIEMPRE: su propia capa, su pin en el color del chip Ajustar (colores-pin.ts; nunca el rojo), su propia línea en la
//     barra («3.238 [− Ajustar] requieren negociar el precio»), que NUNCA se suma a «convienen»; en la lista van después de los
//     ✓ Comprar.
//   · DE ENTRADA (03-nov-2026, la pasada real de Fabrizio): se ven con los ✓ Comprar, con el descuento máximo de 10 %, con y sin
//     cuenta, y llegan en el mismo pedido del mapa (portal-servidor.ts › respuestaDeLaNoche). El chip de la barra es el filtro
//     «Ver solo ✓ Comprar», apagado por defecto: prendido, la capa no se ve. En Filtros, «Descuento máximo para − Ajustar», 5 % o
//     10 %. Hasta el 03-nov la capa estaba apagada de entrada y el chip «Si negocias el precio» la prendía con 5 %.
//   · SOLO LO QUE CALCULA LA NOCHE: arriendo tradicional, pie 20 % o 30 %, 30 años y la tasa del motor. Con otra tasa, otro pie,
//     otro plazo o renta corta, la capa no se muestra y Filtros lo dice.
//   · SIN CUENTA la capa existe y sus cifras van borrosas como el resto: el precio negociado y el flujo no viajan, y el descuento
//     viaja solo como el tope que alcanza (5 o 10, lo que la persona elige igual). La tarjeta y la lista los dibujan borrosos; el
//     mapa, puntos sin número.
// ─────────────────────────────────────────────────────────────────────────────
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { pasaFiltros, pinDeFila, TOPE_NEGOCIAR_DE_ENTRADA, TOPES_NEGOCIAR, type FiltrosPortal, type PinMapa, type TopeNegociar } from "./portal";
import { TOPE_NEGOCIAR_PCT } from "@/lib/avisos/negociar-tope";
import { NEGOCIADO_COPY } from "@/lib/precio-publicado";

// Los topes de Filtros (5 % y 10 %) viven en portal.ts (son parte de los filtros de la URL); acá se reexportan. El mayor es el
// que calcula la noche: si se separan, la capa ofrecería un tope sin datos (lo cuida EXPLORAR-NEGOCIAR).
export { TOPES_NEGOCIAR, type TopeNegociar };
/** El de entrada (03-nov-2026): 10 %, el de la vista global (portal.ts). Hasta el 03-nov era 5 %. */
export const TOPE_NEGOCIAR_POR_DEFECTO: TopeNegociar = TOPE_NEGOCIAR_DE_ENTRADA;
export const TOPE_DE_LA_NOCHE = TOPE_NEGOCIAR_PCT;
export const esTopeNegociar = (x: unknown): x is TopeNegociar => (TOPES_NEGOCIAR as readonly number[]).includes(Number(x));

/** EL PISO DE «ANALIZAR A UF 2.950» (la ruta de analizar): en UF enteras, bajo el precio publicado y nunca más abajo que el
 *  publicado menos el tope elegido. */
export function precioNegociadoValido(negociadoUF: number, publicadoUF: number, tope: number): boolean {
  const publicado = Math.round(publicadoUF);
  return Number.isInteger(negociadoUF) && negociadoUF > 0 && esTopeNegociar(tope) && negociadoUF < publicado && negociadoUF >= Math.floor(publicado * (1 - tope / 100));
}

/** Lo que la noche guardó para un aviso: el descuento (%), el precio negociado (UF) y el puntaje y el flujo a ese precio. Sin
 *  cuenta, `p` es null y `d` es el tope que alcanza (sinCifrasNegociados). */
export interface Negociacion {
  d: number;
  p: number | null;
  s: number | null;
  f: number | null;
}

/** Un depto de la capa: el pin de siempre, con el veredicto al precio publicado (Ajustar) y su negociación. */
export type PinNegociado = PinMapa & { neg: Negociacion };
export const esNegociado = (p: PinMapa): p is PinNegociado => !!(p as Partial<PinNegociado>).neg;
/** ¿Viajaron sus cifras? Sin cuenta, no: el precio negociado y el descuento se dibujan borrosos. */
export const conCifrasNegociado = (p: PinNegociado): p is PinNegociado & { neg: { p: number } } => p.neg.p != null;

/** Un círculo del mapa: su centro en píxeles del mundo a ese zoom (explorar.ts › proyectar) y su radio en píxeles. */
export interface Circulo {
  x: number;
  y: number;
  r: number;
}
/** Cuánto del radio de un grupo de la capa queda FUERA del círculo rojo que lo pisa: 0,8 deja el número entero a la vista. */
export const SATELITE_FUERA = 0.8;
const tapa = (c: Circulo, rojo: Circulo) => Math.hypot(c.x - rojo.x, c.y - rojo.y) < rojo.r + c.r * SATELITE_FUERA;
/** EL SATÉLITE (02-nov-2026, QA en el preview): lejos, los grupos de la capa caen casi donde caen los rojos —se agrupan por las
 *  mismas celdas— y, dibujados debajo, en el teléfono se tapaban enteros. El que queda tapado por un círculo rojo se corre hasta
 *  pegarse a su borde, con el número a la vista: hacia afuera del rojo (abajo a la derecha si caen en el mismo punto) o, si ahí
 *  lo tapa otro rojo, girando de a 45°. Se corre el ícono, no el punto: devuelve el corrimiento en píxeles ({ 0, 0 } si nada lo
 *  tapa). */
export function satelite(c: Circulo, rojos: readonly Circulo[]): { dx: number; dy: number } {
  const hondura = (r: Circulo) => Math.hypot(c.x - r.x, c.y - r.y) - r.r;
  const peor = rojos.filter((r) => tapa(c, r)).sort((a, b) => hondura(a) - hondura(b))[0];
  if (!peor) return { dx: 0, dy: 0 };
  const d = Math.hypot(c.x - peor.x, c.y - peor.y);
  const base = d > 2 ? Math.atan2(c.y - peor.y, c.x - peor.x) : Math.PI / 4;
  const lejos = peor.r + c.r * SATELITE_FUERA;
  const en = (giro: number) => ({ x: peor.x + Math.cos(base + giro) * lejos, y: peor.y + Math.sin(base + giro) * lejos, r: c.r });
  const libre = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => en((k * Math.PI) / 4)).find((s) => !rojos.some((r) => r !== peor && tapa(s, r))) ?? en(0);
  return { dx: libre.x - c.x, dy: libre.y - c.y };
}

/** Los pies que calcula la noche (a 30 años, con la tasa del motor). */
export const PIES_NEGOCIAR = [PIE_POR_DEFECTO, 30] as const;

/** ¿Esta combinación tiene capa? Solo la de la noche: arriendo tradicional, pie 20 % o 30 %, 30 años, la tasa del motor. */
export function capaNegociarDisponible(f: Pick<FiltrosPortal, "modalidad" | "pie" | "plazo" | "tasa">): boolean {
  return f.modalidad === "ltr" && f.tasa == null && f.plazo === PLAZO_POR_DEFECTO && (PIES_NEGOCIAR as readonly number[]).includes(f.pie);
}

/** ¿Se ve la capa? Con estos supuestos existe y «Ver solo ✓ Comprar» está apagado (03-nov-2026: de entrada, sí). */
export const capaVisible = (f: Pick<FiltrosPortal, "modalidad" | "pie" | "plazo" | "tasa" | "soloComprar">): boolean => !f.soloComprar && capaNegociarDisponible(f);

/** LAS DOS CLASES DEL MAPA (03-nov-2026): los − Ajustar que se ven con unos filtros —los de la capa que pasan los filtros y el
 *  descuento máximo, sin los que ya son ✓ Comprar—, o ninguno si la capa no se ve. Lo usan el mapa, la barra, la lista, Filtros y
 *  la bienvenida: un solo lugar decide si se ven. */
export function negociadosVisibles(pines: readonly PinNegociado[] | null | undefined, f: FiltrosPortal, comprar: ReadonlySet<string> = new Set(), ahora: Date = new Date()): PinNegociado[] {
  return pines && capaVisible(f) ? filtrarNegociados(pines, f, f.negociar, comprar, ahora) : [];
}

/** Cómo viaja la capa: las comunas una vez y cada depto como un arreglo corto (como el universo de la noche). */
export interface NegociadosCompactos {
  comunas: string[];
  /** [id, comuna (índice), lat, lng, m2, dormitorios, baños, precio publicado, puntaje, flujo, arriendo, condición (0, 1 usado,
   *  2 nuevo), alta, descuento, precio negociado, puntaje negociado, flujo negociado] */
  filas: Array<[string, number, number, number, number, number, number | null, number, number | null, number | null, number | null, 0 | 1 | 2, number | null, number, number | null, number | null, number | null]>;
}

/** Una fila de explorar_negociar (17 campos) como pin de la capa. */
export function negociadoDeFila(r: unknown[]): PinNegociado {
  const n = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const base = pinDeFila({ id: String(r[0]), comuna: String(r[1]), lat: r[2], lng: r[3], m2: r[4], dormitorios: r[5], banos: r[6], precio: r[7], score: r[8], flujo: r[9], arriendo: r[10], condicion: r[11], alta: r[12] });
  const p = n(r[14]);
  return { ...base, veredicto: "AJUSTA SUPUESTOS", neg: { d: Number(r[13]), p: p == null ? null : Math.round(p), s: n(r[15]), f: n(r[16]) } };
}

export function compactarNegociados(pines: readonly PinNegociado[]): NegociadosCompactos {
  const comunas: string[] = [];
  const idx = new Map<string, number>();
  const filas: NegociadosCompactos["filas"] = pines.map((p) => {
    let i = idx.get(p.comuna);
    if (i == null) { i = comunas.length; comunas.push(p.comuna); idx.set(p.comuna, i); }
    return [p.avisoId, i, p.lat, p.lng, p.m2, p.dormitorios, p.banos, p.precioUF, p.score, p.flujo, p.arriendo, p.condicion === "usado" ? 1 : p.condicion === "nuevo" ? 2 : 0, p.alta, p.neg.d, p.neg.p, p.neg.s, p.neg.f];
  });
  return { comunas, filas };
}

export function descompactarNegociados(u: NegociadosCompactos | null | undefined): PinNegociado[] {
  if (!u || !Array.isArray(u.filas)) return [];
  return u.filas.map((f) => negociadoDeFila([f[0], u.comunas[f[1]] ?? "", f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11] === 1 ? "usado" : f[11] === 2 ? "nuevo" : null, f[12], f[13], f[14], f[15], f[16]]));
}

/** El menor tope que alcanza un descuento (4,2 → 5; 7,5 → 10). */
export const topeQueAlcanza = (d: number): TopeNegociar => TOPES_NEGOCIAR.find((t) => d <= t) ?? TOPE_NEGOCIAR_PCT as TopeNegociar;

/** Sin cuenta, como el universo abierto: el flujo (al publicado y al negociado), el arriendo y el precio negociado no viajan, y el
 *  descuento viaja como el tope que alcanza (para filtrar por 5 % o 10 %). El puntaje, como el del resto, sí. */
export function sinCifrasNegociados(u: NegociadosCompactos): NegociadosCompactos {
  return { comunas: u.comunas, filas: u.filas.map((f) => [f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], null, null, f[11], f[12], topeQueAlcanza(f[13]), null, f[15], null]) };
}

/** Los de la capa que pasan los filtros y el tope. «Solo con flujo positivo» mira el flujo AL PRECIO NEGOCIADO (es al que
 *  conviene). Los que también están en «convienen» (no debería pasar: la noche los da Ajustar) se dejan fuera. */
export function filtrarNegociados(pines: readonly PinNegociado[], f: FiltrosPortal, tope: TopeNegociar, comprar: ReadonlySet<string> = new Set(), ahora: Date = new Date()): PinNegociado[] {
  return pines.filter((p) => p.neg.d <= tope && !comprar.has(p.avisoId) && pasaFiltros({ ...p, flujo: p.neg.f }, f, ahora));
}

/** El orden de la capa en la lista y en la tarjeta: el menor descuento primero (el más fácil de conseguir), luego el puntaje. */
export const ordenarNegociados = (pines: readonly PinNegociado[]): PinNegociado[] =>
  [...pines].sort((a, b) => a.neg.d - b.neg.d || (b.neg.s ?? -1) - (a.neg.s ?? -1) || a.avisoId.localeCompare(b.avisoId));

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Los textos de la capa. «Al precio publicado» siempre se dice: «conviene» quiere decir a ese precio. */
export const NEGOCIAR_COPY = {
  /** EL CHIP DE LA BARRA (03-nov-2026): «Ver solo [✓ Comprar]», con el chip de la casa adentro y su interruptor. */
  soloComprar: "Ver solo",
  /** El grupo de Filtros: «Descuento máximo para [− Ajustar]», con el chip de la casa. */
  tituloGrupo: "Descuento máximo para",
  /** La ayuda del grupo, en tres partes: los chips de veredicto van entre medio (ChipVeredicto). */
  ayuda: { antes: "Los deptos que al precio publicado dan", medio: "pero llegan a", despues: "si consigues un descuento de hasta:" },
  tope: (t: number) => `${t} %`,
  /** Con otra tasa, otro pie u otro plazo, o en renta corta: la capa no existe y Filtros lo dice. */
  sinCapa: "Franco calcula los que convienen si negocias con pie 20 % o 30 %, 30 años, la tasa del mes y arriendo tradicional. Con lo que elegiste, no se muestran.",
  /** La bienvenida sin cuenta (03-nov-2026), bajo los que convienen: «y 3.238 más si negocias el precio». Nunca sumado a ellos. */
  bienvenida: (n: number) => `y ${miles(n)} más si negocias el precio`,
  /** El título de los − Ajustar en la lista, después de los ✓ Comprar. */
  tituloLista: (tope: number) => `Requieren negociar el precio · hasta ${tope} % de dcto.`,
  // Los dos veredictos y el botón: los mismos del pop-up (precio-publicado.ts, sin dependencias: el pop-up vive también en /deptos).
  ...NEGOCIADO_COPY,
  /** El pin con zoom (03-nov-2026): el descuento que hay que conseguir, «−4,2 % dcto.». */
  pin: (d: number) => `−${pct1(d)} % dcto.`,
  /** Sin cuenta, lo que se dibuja borroso en lugar del precio negociado y del descuento: un relleno fijo, nunca el valor. */
  borroso: { precio: "UF 0.000", descuento: "(−0,0 %)" },
} as const;

// (03-nov-2026) Se retiró `botonVerConNegociados` («Ver 201 + 48 si negocias»): el botón de Filtros es portal.ts › botonVer, con
// los dos chips de la casa. Y `chip`/`chipOn`/`mas`: el chip de la barra es «Ver solo ✓ Comprar» y la cuenta aparte es una línea
// del desglose (portal.ts › desgloseBarra).

/** La medición del descuento máximo, en Filtros: lo cambió (5 o 10). */
export const EVENTO_NEGOCIAR = "explorar_negociar";
export function propsNegociar(tope: TopeNegociar, donde: "filtros", n: number | null): Record<string, unknown> {
  return { tope, donde, n };
}

/** «explorar_solo_comprar» (03-nov-2026): prendió «Ver solo ✓ Comprar», con el descuento máximo que tenía, cuántos ✓ Comprar
 *  quedan y cuántos − Ajustar se dejan de ver. Al apagarlo no se mide. */
export const EVENTO_SOLO_COMPRAR = "explorar_solo_comprar";
export function propsSoloComprar(tope: TopeNegociar, nComprar: number | null, nAjustar: number | null, sinCuenta: boolean): Record<string, unknown> {
  return { tope, n_comprar: nComprar, n_ajustar: nAjustar, sin_cuenta: sinCuenta };
}
