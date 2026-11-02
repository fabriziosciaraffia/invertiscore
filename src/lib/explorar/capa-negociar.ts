// ─────────────────────────────────────────────────────────────────────────────
// LA CAPA «SI NEGOCIAS EL PRECIO» DE EXPLORAR (02-nov-2026, goal «Filtros v2 y negociar», mockup
// docs/puerta-b-mockups/8-filtros-v2-negociar.html, estado C). Las reglas puras; el servidor está en portal-servidor.ts y la noche
// en avisos/negociar.ts.
//   · QUÉ SON: los que al precio publicado dan AJUSTAR y llegan a COMPRAR si se consigue un descuento, hasta el tope elegido (5 %
//     o 10 %). Los Buscar otro nunca entran (la noche no les guarda descuento).
//   · APARTE, SIEMPRE: su propia capa, su pin en el color del chip Ajustar con el número en blanco (nunca el rojo), su propia cuenta
//     («1.654 más si negocias hasta 5 %»), que NUNCA se suma a «convienen»; en la lista van después de los ✓ Comprar.
//   · SOLO LO QUE CALCULA LA NOCHE: arriendo tradicional, pie 20 % o 30 %, 30 años y la tasa del motor. Con otra tasa, otro pie,
//     otro plazo o renta corta, la capa no se muestra y Filtros lo dice.
//   · SIN CUENTA la capa existe y sus cifras van borrosas como el resto: el precio negociado y el flujo no viajan, y el descuento
//     viaja solo como el tope que alcanza (5 o 10, lo que la persona elige igual). La tarjeta y la lista los dibujan borrosos; el
//     mapa, puntos sin número.
// ─────────────────────────────────────────────────────────────────────────────
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { pasaFiltros, pinDeFila, TOPES_NEGOCIAR, type FiltrosPortal, type PinMapa, type TopeNegociar } from "./portal";
import { TOPE_NEGOCIAR_PCT } from "@/lib/avisos/negociar-tope";
import { NEGOCIADO_COPY } from "@/lib/precio-publicado";

// Los topes de Filtros (5 % y 10 %) viven en portal.ts (son parte de los filtros de la URL); acá se reexportan. El mayor es el
// que calcula la noche: si se separan, la capa ofrecería un tope sin datos (lo cuida EXPLORAR-NEGOCIAR).
export { TOPES_NEGOCIAR, type TopeNegociar };
export const TOPE_NEGOCIAR_POR_DEFECTO: TopeNegociar = 5;
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

/** Los pies que calcula la noche (a 30 años, con la tasa del motor). */
export const PIES_NEGOCIAR = [PIE_POR_DEFECTO, 30] as const;

/** ¿Esta combinación tiene capa? Solo la de la noche: arriendo tradicional, pie 20 % o 30 %, 30 años, la tasa del motor. */
export function capaNegociarDisponible(f: Pick<FiltrosPortal, "modalidad" | "pie" | "plazo" | "tasa">): boolean {
  return f.modalidad === "ltr" && f.tasa == null && f.plazo === PLAZO_POR_DEFECTO && (PIES_NEGOCIAR as readonly number[]).includes(f.pie);
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
  chip: "Si negocias el precio",
  chipOn: (tope: number) => `Si negocias · ${tope} %`,
  tituloGrupo: "Si negocias el precio",
  /** La ayuda del grupo, en tres partes: los chips de veredicto van entre medio (ChipVeredicto). */
  ayuda: { antes: "Suma los deptos que al precio publicado dan", medio: "pero llegan a", despues: "si consigues un descuento. Se muestran aparte, con el pin en el color de Ajustar." },
  tope: (t: number) => `Hasta ${t} % de dcto.`,
  /** Con otra tasa, otro pie u otro plazo, o en renta corta: la capa no existe y Filtros lo dice. */
  sinCapa: "Franco calcula los que convienen si negocias con pie 20 % o 30 %, 30 años, la tasa del mes y arriendo tradicional. Con lo que elegiste, no se muestran.",
  /** La cuenta aparte, bajo la de los que convienen: «1.654 más si negocias hasta 5 %». */
  mas: (n: number, tope: number) => `${miles(n)} más si negocias hasta ${tope} %`,
  // Los dos veredictos y el botón: los mismos del pop-up (precio-publicado.ts, sin dependencias: el pop-up vive también en /deptos).
  ...NEGOCIADO_COPY,
  /** El pin con zoom: el descuento que hay que conseguir. */
  pin: (d: number) => `−${pct1(d)} %`,
  /** Sin cuenta, lo que se dibuja borroso en lugar del precio negociado y del descuento: un relleno fijo, nunca el valor. */
  borroso: { precio: "UF 0.000", descuento: "(−0,0 %)" },
} as const;

/** EL BOTÓN DE FILTROS (02-nov-2026, mockup 8): las dos cuentas, separadas —«Ver 201 + 48 si negocias»—; sin capa, el de siempre. */
export function botonVerConNegociados(n: number | null, m: number | null, botonVer: (n: number | null) => string): string {
  if (n == null || !m) return botonVer(n);
  return `Ver ${miles(n)} + ${miles(m)} si negocias`;
}

/** La medición: prender el chip (con el tope) y apagarlo. */
export const EVENTO_NEGOCIAR = "explorar_negociar";
export function propsNegociar(tope: TopeNegociar | null, donde: "chip" | "filtros", n: number | null): Record<string, unknown> {
  return { prendido: tope != null, tope, donde, n };
}
