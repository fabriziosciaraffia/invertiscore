// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA CON TODOS LOS DEPTOS (25-nov-2026, láminas 5, 6, 7 y 8 del canvas «La asesoría en el mapa»; decisiones de Fabrizio del
// 25-nov). La parte pura, sin servidor ni navegador (la prueba el tier EXPLORAR-TODOS):
//   · TRES CLASES: Comprar (azul), Ajustar (ciruela) y No conviene (rojo). Un Ajustar que necesita más de 10 % de descuento se
//     muestra como No conviene a este precio: todo Ajustar que se ve trae su «Conviene desde UF X» (decisión 2).
//   · EL CONTADOR: «4.513 de 19.056 convienen». «Convienen» es el número de los Comprar —el MISMO de la landing y de /deptos,
//     contado por `cuantosConvienen` sobre el mismo universo— y el total, los tres juntos (decisión 3).
//   · LOS TRAMOS: cada barra del panel (arriendo estimado, cap rate, te sobran o pones al mes) tiene 24 tramos con cortes fijos.
//     La base calcula el tramo de cada fila (migración 20261126_explorar_mapa_todos_tramos, función explorar_mapa_todos) con los
//     MISMOS cortes de abajo: el tier exige que coincidan. Los No conviene viajan sin cifras, solo con sus tramos, y solo a quien
//     tiene cuenta: así el filtro y el contador cuentan bien y la cifra queda dentro del depto (decisión de Fabrizio del 25-nov).
//   · LA CIFRA DEL PIN: por defecto el precio con su unidad; al mover una barra, Comprar y Ajustar pasan a esa cifra, con su unidad;
//     No conviene siempre muestra el precio (decisión 6).
// ─────────────────────────────────────────────────────────────────────────────
import { PIE_POR_DEFECTO, PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";
import { TOPE_NEGOCIAR_PCT } from "@/lib/avisos/negociar-tope";

/** Las tres clases del mapa, en el orden de la base (campo 8 de explorar_mapa_todos). */
export type ClaseMapa = "comprar" | "ajustar" | "no";
export const CLASES_MAPA: readonly ClaseMapa[] = ["comprar", "ajustar", "no"];
export const claseDeCodigo = (v: unknown): ClaseMapa => (Number(v) === 0 ? "comprar" : Number(v) === 1 ? "ajustar" : "no");
/** El veredicto del motor de cada clase (No conviene es BUSCAR OTRA o un Ajustar que no llega con 10 %). */
export const VEREDICTO_DE_CLASE: Record<ClaseMapa, string> = { comprar: "COMPRAR", ajustar: "AJUSTA SUPUESTOS", no: "BUSCAR OTRA" };
export function claseDeVeredicto(veredicto: string | null | undefined, conDescuento: boolean): ClaseMapa {
  if (veredicto === "COMPRAR") return "comprar";
  if (veredicto === "AJUSTA SUPUESTOS" && conDescuento) return "ajustar";
  return "no";
}

// ── LOS TRAMOS ───────────────────────────────────────────────────────────────
/** Los 23 cortes de cada barra (24 tramos, de 0 a 23). LOS MISMOS de la función explorar_mapa_todos: el tier lo exige. */
export const CORTES_TRAMOS = {
  arriendo: [250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 700000, 800000, 900000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000, 2500000, 3000000, 3500000, 4000000, 5000000, 6000000],
  cap: [2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 7, 7.25, 7.5, 7.75, 8],
  flujo: [-1500000, -1000000, -750000, -500000, -400000, -300000, -250000, -200000, -150000, -100000, -75000, -50000, -25000, 0, 25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 1000000],
} as const;
export type BarraTramos = keyof typeof CORTES_TRAMOS;
export const N_TRAMOS = 24;

/** El tramo de un valor: cuántos cortes son menores o iguales (lo mismo que width_bucket de Postgres). null sin valor. */
export function tramoDe(valor: number | null | undefined, cortes: readonly number[]): number | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  let i = 0;
  while (i < cortes.length && valor >= cortes[i]) i++;
  return i;
}
/** El cap rate del tramo: arriendo × 12 / (precio × UF), en puntos, redondeado a dos decimales como la base. Es el MISMO que
 *  muestra la tarjeta (explorar.ts › capRatePct): el filtro y la tarjeta dicen lo mismo. */
export function capParaTramo(arriendo: number | null, precioUF: number, uf: number | null): number | null {
  if (arriendo == null || !(arriendo > 0) || !uf || !(uf > 0) || !(precioUF > 0)) return null;
  return Math.round((arriendo * 12) / (precioUF * uf) * 100 * 100) / 100;
}
/** Los tres tramos de un depto con cifras (lo calculado en el servidor, que no pasa por la base). */
export function tramosDe(p: { arriendo: number | null; flujo: number | null; precioUF: number }, uf: number | null): Tramos {
  return [tramoDe(p.arriendo, CORTES_TRAMOS.arriendo), tramoDe(capParaTramo(p.arriendo, p.precioUF, uf), CORTES_TRAMOS.cap), tramoDe(p.flujo, CORTES_TRAMOS.flujo)];
}
/** [arriendo, cap rate, flujo]: null si no se sabe. */
export type Tramos = [number | null, number | null, number | null];
export const INDICE_TRAMO: Record<BarraTramos, 0 | 1 | 2> = { arriendo: 0, cap: 1, flujo: 2 };

/** Los extremos de un tramo, para las cajas «Mínimo» y «Máximo» del panel: el primero no tiene piso y el último no tiene techo. */
export function extremosDeTramo(barra: BarraTramos, t: number): { desde: number | null; hasta: number | null } {
  const c = CORTES_TRAMOS[barra];
  return { desde: t <= 0 ? null : c[t - 1], hasta: t >= c.length ? null : c[t] };
}

// ── LAS BARRAS DEL PANEL ─────────────────────────────────────────────────────
/** Las cinco barras de la lámina 6, en su orden. Precio y UF por m² son públicos (viajan siempre); las otras tres van por tramo. */
export type BarraPanel = "precio" | "arriendo" | "cap" | "flujo" | "ufm2";
export const BARRAS_PANEL: readonly BarraPanel[] = ["precio", "arriendo", "cap", "flujo", "ufm2"];
/** Sin cuenta, el panel muestra solo precio y dormitorios; las demás barras piden crear la cuenta (decisión 8). */
export const BARRAS_SIN_CUENTA: readonly BarraPanel[] = ["precio"];
export const BARRA_COPY: Record<BarraPanel, string> = {
  precio: "Precio",
  arriendo: "Arriendo estimado",
  // «Cap rate BRUTO» (26-nov-2026, ajuste de Fabrizio): la tarjeta y el panel muestran el bruto (arriendo × 12 / precio) y la página
  // del informe el neto; con el nombre completo nadie ve dos cifras distintas y piensa que hay un error.
  cap: "Cap rate bruto",
  flujo: "Te sobran o pones al mes",
  ufm2: "UF por m²",
};
/** Los cortes de las barras públicas (24 tramos también): precio en UF y UF por m². */
export const CORTES_PUBLICOS = {
  precio: [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 10000, 12000, 15000, 20000],
  ufm2: [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 170, 200, 250],
} as const;
export const cortesDeBarra = (b: BarraPanel): readonly number[] => (b === "precio" || b === "ufm2" ? CORTES_PUBLICOS[b] : CORTES_TRAMOS[b]);

/** Un rango elegido en una barra: del tramo `a` al `b`, los dos incluidos. Sin rango, la barra entera. */
export type RangoTramos = [number, number];
export const rangoCompleto = (r: RangoTramos | null | undefined): boolean => !r || (r[0] <= 0 && r[1] >= N_TRAMOS - 1);
export function validarRango(v: unknown): RangoTramos | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = Math.round(Number(v[0])), b = Math.round(Number(v[1]));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const lo = Math.max(0, Math.min(a, b)), hi = Math.min(N_TRAMOS - 1, Math.max(a, b));
  return rangoCompleto([lo, hi]) ? null : [lo, hi];
}

// ── LA CIFRA DEL PIN ─────────────────────────────────────────────────────────
/** Lo que dice el pin: el precio por defecto o la barra que se movió por última vez. */
export type CifraPin = BarraPanel;
const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
/** «$420 mil», «$1,2 MM»: montos cortos para el pin. */
export function montoCorto(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${s}$${(Math.round(a / 100_000) / 10).toLocaleString("es-CL")} MM`;
  if (a >= 1000) return `${s}$${miles(a / 1000)} mil`;
  return `${s}$${miles(a)}`;
}
/** El texto de un pin con zoom. No conviene siempre dice el precio; Comprar y Ajustar, la cifra elegida (si no la tienen, el
 *  precio). Sin cuenta, el precio (es lo único que viaja). */
export function textoCifraPin(p: { precioUF: number; m2: number; arriendo: number | null; flujo: number | null }, clase: ClaseMapa, cifra: CifraPin, uf: number | null, sinCifras = false): string {
  const precio = `UF ${miles(p.precioUF)}`;
  if (clase === "no" || sinCifras || cifra === "precio") return precio;
  if (cifra === "ufm2") return p.m2 > 0 ? `${miles(p.precioUF / p.m2)} UF/m²` : precio;
  if (cifra === "arriendo") return p.arriendo != null ? montoCorto(p.arriendo) : precio;
  if (cifra === "flujo") return p.flujo != null ? `${p.flujo >= 0 ? "+" : ""}${montoCorto(p.flujo)}` : precio;
  const cap = capParaTramo(p.arriendo, p.precioUF, uf);
  return cap != null ? `${cap.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : precio;
}

// ── EL CONTADOR ──────────────────────────────────────────────────────────────
export interface ConteoClases { comprar: number; ajustar: number; no: number }
export const totalConteo = (c: ConteoClases) => c.comprar + c.ajustar + c.no;
/** «4.513» (grande y en azul) y «de 19.056 deptos convienen» (lámina 5d, 26-nov-2026). El número de convienen es el de los Comprar: el
 *  mismo de todo el sitio. */
export function textoContador(c: ConteoClases): { numero: string; resto: string } {
  return { numero: miles(c.comprar), resto: `de ${miles(totalConteo(c))} deptos convienen` };
}
/** La proporción de cada veredicto, en % (la barra fina del contador); los tres suman 100 (0 sin deptos). */
export function proporcionClases(c: ConteoClases): Record<ClaseMapa, number> {
  const t = totalConteo(c);
  if (!t) return { comprar: 0, ajustar: 0, no: 0 };
  const comprar = Math.round((c.comprar / t) * 1000) / 10, ajustar = Math.round((c.ajustar / t) * 1000) / 10;
  return { comprar, ajustar, no: Math.max(0, Math.round((100 - comprar - ajustar) * 10) / 10) };
}
/** «¿CÓMO SE CALCULA?» (26-nov-2026, lámina 5d, texto de Claude y Fabrizio). Pie, plazo y el tope del descuento salen de las mismas
 *  constantes que usa el mapa (deptos/estandar.ts, avisos/negociar-tope.ts) y la tasa, de la del motor (config.tasa_hipotecaria): nunca
 *  escritos a mano. `sinCuenta`: «Con tu cuenta gratis cambias eso en Filtros.»; con cuenta, «Cambias eso en Filtros.». */
export function textoComoSeCalcula(tasa: number | null, sinCuenta: boolean) {
  const t = tasa != null && tasa > 0 ? `tasa de ${tasa.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} % (el promedio del Banco Central)` : "la tasa promedio del Banco Central";
  return {
    titulo: "¿Cómo se calcula?",
    intro: `Cada noche Franco revisa los deptos usados en venta en Gran Santiago y calcula si convienen como inversión, con pie de ${PIE_POR_DEFECTO} %, crédito a ${PLAZO_POR_DEFECTO} años y ${t}. ${sinCuenta ? "Con tu cuenta gratis cambias eso en Filtros." : "Cambias eso en Filtros."}`,
    clases: [
      { clase: "comprar" as const, nombre: "Comprar", texto: "conviene al precio publicado." },
      { clase: "ajustar" as const, nombre: "Ajustar", texto: `conviene negociando hasta ${TOPE_NEGOCIAR_PCT} % menos. La tarjeta dice desde qué precio.` },
      { clase: "no" as const, nombre: "No conviene", texto: `ni al precio publicado ni con ${TOPE_NEGOCIAR_PCT} % menos.` },
    ],
    capRate: { nombre: "Cap rate bruto", texto: "el arriendo de un año dividido por el precio. En los detalles del depto ves también el neto, que descuenta gastos." },
    rentaCorta: { nombre: "Renta corta", texto: "se estima por zona, no por depto." },
    metodologia: { antes: "Cómo decide Franco: ", enlace: "la metodología", href: "/metodologia" },
    boton: "Entendido",
  };
}

export const CONTADOR_COPY = {
  /** Lo que hace cada casilla, al pasar el mouse: «Ocultar Comprar en el mapa» o «Mostrar…». */
  accion: (c: ClaseMapa, apagado: boolean) => `${apagado ? "Mostrar" : "Ocultar"} ${CHIP_CLASE_COPY[c]} en el mapa`,
  region: "Cuántos convienen",
  grupo: "Qué veredictos se ven en el mapa",
  plegar: "Plegar",
  desplegar: "Desplegar",
} as const;
export const CHIP_CLASE_COPY: Record<ClaseMapa, string> = { comprar: "Comprar", ajustar: "Ajustar", no: "No conviene" };
/** La casilla de una clase en la tarjeta del contador: «Comprar · 4.513» (lámina 5d). */
export const textoChipClase = (clase: ClaseMapa, n: number) => `${CHIP_CLASE_COPY[clase]} · ${cifraChipClase(n)}`;
/** La cifra sola de la casilla («11.509»): en el teléfono va debajo del nombre (26-nov-2026). */
export const cifraChipClase = (n: number) => miles(n);

// ── LA TARJETA DEL DEPTO (lámina 7) ─────────────────────────────────────────
export const TARJETA_COPY = {
  publicado: "Publicado",
  arriendo: "Arriendo est.",
  arriendoLargo: "Arriendo estimado",
  /** El bruto (arriendo × 12 / precio), con su nombre: el informe muestra el neto (26-nov-2026). */
  capRate: "Cap rate bruto",
  teSobran: "Te sobran al mes",
  pones: "Pones al mes",
  noConviene: "No conviene a este precio",
  /** «Conviene desde UF 2.810 · 3,2 % menos». */
  convieneDesde: (uf: number, pct: number) => `Conviene desde UF ${miles(uf)} · ${pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })} % menos`,
  verDepto: "Ver este depto",
  /** Sin cuenta, el botón de la tarjeta de la lámina 7. */
  verGratis: "Ver gratis con tu cuenta",
} as const;

// ── LA BARRA DE ARRIBA (lámina 5, opción B) ─────────────────────────────────
/** Usados o Proyectos. PROYECTOS QUEDA ESCONDIDO hasta que haya nuevos evaluados: hoy no hay precio por unidad (decisión 4). */
export const PROYECTOS_VISIBLE = false;
export const SELECTOR_COPY = { usados: "Usados", proyectos: "Proyectos", grupo: "Qué deptos" } as const;

// ── EL PANEL: HISTOGRAMAS Y RANGOS ──────────────────────────────────────────
/** El tramo de un depto en una barra: precio y UF por m² se calculan (son públicos); arriendo, cap rate y flujo, el que trajo. */
export function tramoDeBarra(p: { precioUF: number; m2: number; tramos?: Tramos }, barra: BarraPanel): number | null {
  if (barra === "precio") return tramoDe(p.precioUF, CORTES_PUBLICOS.precio);
  if (barra === "ufm2") return tramoDe(p.m2 > 0 ? p.precioUF / p.m2 : null, CORTES_PUBLICOS.ufm2);
  return p.tramos?.[INDICE_TRAMO[barra]] ?? null;
}
/** La distribución dibujada de una barra: cuántos deptos caen en cada uno de sus 24 tramos. */
export function histograma(pines: ReadonlyArray<{ precioUF: number; m2: number; tramos?: Tramos }>, barra: BarraPanel): number[] {
  const n = new Array<number>(N_TRAMOS).fill(0);
  for (const p of pines) { const t = tramoDeBarra(p, barra); if (t != null) n[t]++; }
  return n;
}
/** El precio «desde» y «hasta» de un rango de tramos de precio (sin piso en el primero, sin techo en el último). */
export function precioDeRango(r: RangoTramos | null): { ufMin: number | null; ufMax: number | null } {
  if (!r) return { ufMin: null, ufMax: null };
  const c = CORTES_PUBLICOS.precio;
  return { ufMin: r[0] > 0 ? c[r[0] - 1] : null, ufMax: r[1] < N_TRAMOS - 1 ? c[r[1]] : null };
}
/** El rango de tramos que cubre un precio «desde» y «hasta» (los de la URL, que pueden no caer en un corte). */
export function rangoDePrecio(ufMin: number | null, ufMax: number | null): RangoTramos {
  const c = CORTES_PUBLICOS.precio as readonly number[];
  const a = ufMin == null ? 0 : tramoDe(ufMin, c) ?? 0;
  const b = ufMax == null ? N_TRAMOS - 1 : Math.max(a, (tramoDe(ufMax, c) ?? N_TRAMOS - 1) - (c.includes(ufMax) ? 1 : 0));
  return [a, b];
}
/** Lo que dicen las cajas «Mínimo» y «Máximo» de una barra («UF 1.800», «$300.000», «5,0 %», «Te sobran $0», «30»). */
export function textoExtremo(barra: BarraPanel, valor: number | null, lado: "min" | "max"): string {
  if (valor == null) return lado === "min" ? "Sin mínimo" : "Sin máximo";
  if (barra === "precio") return `UF ${miles(valor)}`;
  if (barra === "ufm2") return miles(valor);
  if (barra === "cap") return `${valor.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`;
  if (barra === "flujo") return valor >= 0 ? `Te sobran $${miles(valor)}` : `Pones $${miles(-valor)}`;
  return `$${miles(valor)}`;
}
/** Los valores de las cajas de un rango: el piso del primer tramo y el techo del último. */
export function extremosDeRango(barra: BarraPanel, r: RangoTramos): { min: number | null; max: number | null } {
  const c = cortesDeBarra(barra);
  return { min: r[0] > 0 ? c[r[0] - 1] : null, max: r[1] < N_TRAMOS - 1 ? c[r[1]] : null };
}
export const PANEL_COPY = {
  tipoArriendo: "Tipo de arriendo",
  rentaLarga: "Renta larga",
  rentaCorta: "Renta corta",
  /** La marca de la renta corta (decisión 9). */
  cortaPorZona: "La renta corta se estima por zona, no por depto.",
  supuestos: (pie: number, plazo: number, tasa: string) => ({ antes: "Con pie de ", pie: `${pie} %`, medio: ", crédito a ", plazo: `${plazo} años`, fin: " y tasa de ", tasa }),
  cambiar: "Cambiar",
  listo: "Listo",
  dormitorios: "Dormitorios",
  minimo: "Mínimo",
  maximo: "Máximo",
  /** Sin cuenta, UNA línea para las cuatro barras de cifras (26-nov-2026; antes una por barra), que abre el registro. */
  conCuenta: "Con tu cuenta gratis filtras también por arriendo, cap rate, lo que te sobra y UF por m²",
  ver: (n: number) => (n === 1 ? "Ver 1 depto" : `Ver ${miles(n)} deptos`),
  contando: "Ver deptos",
  ninguno: "Ninguno con estos filtros",
} as const;
