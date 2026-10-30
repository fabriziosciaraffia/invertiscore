// ─────────────────────────────────────────────────────────────────────────────
// SIN OFERTA, DICHO ARRIBA DE LA SELECCIÓN Y EN EL CORREO VACÍO (26-oct-2026, decisión de Fabrizio). El reporte del 26-oct
// contó 49 de 172 cuentas con perfil sin un solo depto que conviniera con sus números en sus comunas: el dashboard les
// mostraba la selección (vecinas, negociables o nada) sin decir por qué. Ahora lo dice, con las salidas concretas y un botón
// por salida para ajustar el perfil en un toque (semanal.ts › AjustePerfil). Las mismas salidas, en el mismo orden, van en
// el correo vacío (semanal-servidor.ts › verdadDelVacio): una sola cuenta para las dos superficies.
//
// LAS TRES SALIDAS (27-oct-2026): el chip de precio de abajo («Hasta UF 3.000»), el pie 30 % y la comuna vecina que más da.
// Van de mayor a menor cantidad, y solo la primera lleva el «sí»: «Hasta UF 3.000, 810 sí. Con pie 30 %, 7. En Providencia,
// 4.». La del precio se ofrece solo si el chip de abajo tiene más de 10 (`MINIMO_SALIDA_PRECIO`): con menos, bajar el precio
// cambia la búsqueda por casi nada.
//
// La cuenta es la de /deptos (`deptos_conteo`: la evaluación de anoche con el plazo por defecto, ventana de 7 días, sus comunas, sus
// dormitorios y el rango del semanal), con SU pie: pie 30 % o más cuenta los Comprar a pie 30 %; menos, a pie 20 %. La
// comuna y el chip de abajo se cuentan con esa misma vara.
// Puro: lo prueba el tier PERFIL-OFERTA.
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { RANGOS_UF, type ConteoComuna, type RangoUf } from "@/lib/deptos/respuesta";
import { queCambioAjuste, SEMANAL_VACIO, type AjustePerfil } from "@/lib/guia/semanal";
import { rangoDelPrecio } from "@/lib/perfil-busqueda";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
/** Hasta cuántas comunas guarda el perfil (validarCambiosPerfil). */
const MAX_COMUNAS_PERFIL = 8;
/** La salida del precio se ofrece solo si el chip de abajo tiene MÁS de esto con su vara. */
export const MINIMO_SALIDA_PRECIO = 10;

export const SIN_OFERTA = {
  titulo: "Con tu búsqueda no hay deptos que convengan esta semana.",
  /** Sin salidas: cuántos había, y que ninguno da ni con pie 30 % ni en las vecinas. */
  revisados: (n: number, conPie30: boolean) => (n === 0
    ? "Anoche no había ninguno publicado como los que buscas."
    : `Anoche había ${miles(n)} ${n === 1 ? "publicado como los que buscas, y no conviene" : "publicados como los que buscas, y ninguno conviene"} con tu pie${conPie30 ? "" : ", ni con pie 30 %"} ni en comunas vecinas.`),
  botonPie: SEMANAL_VACIO.ajustarPie,
  botonComuna: SEMANAL_VACIO.ajustarComuna,
  botonRango: SEMANAL_VACIO.ajustarRango,
  cambiar: "Cambiar mi búsqueda",
  listo: SEMANAL_VACIO.ajusteListo,
  guardando: "Guardando…",
  error: "No pudimos guardarlo. Intenta de nuevo.",
} as const;

/** Lo que dice cada salida antes de la cifra: «Hasta UF 3.000», «Entre UF 3.000 y 4.000», «Con pie 30 %», «En Santiago». */
const etiquetaRango = (r: RangoUf) => r.frase.charAt(0).toUpperCase() + r.frase.slice(1);

export interface SalidaSinOferta {
  ajuste: AjustePerfil;
  /** «Hasta UF 3.000», «Con pie 30 %», «En Providencia». */
  etiqueta: string;
  n: number;
  /** La frase en su lugar de la línea: la primera con «sí» («Hasta UF 3.000, 810 sí.»), las demás sin él («Con pie 30 %, 7.»). */
  texto: string;
  boton: string;
}

export interface AvisoSinOferta {
  /** Cuántos había publicados como los que busca, en sus comunas. */
  revisados: number;
  /** Las salidas, de mayor a menor cantidad. Vacío: no hay con qué ajustar en un toque. */
  salidas: SalidaSinOferta[];
  /** Sus comunas tal como el perfil las guarda (las del Gran Santiago): el ajuste de comuna las conserva y suma la vecina. */
  comunas: string[];
  /** Su pie ya es 30 % o más: no se le ofrece pie 30 % ni se le dice «ni con pie 30 %». */
  conPie30: boolean;
}

/** El chip de precio inmediatamente inferior a un rango: el que contiene su piso (el borde va al de abajo: con piso UF 3.000,
 *  «hasta UF 3.000»). Sin piso no hay chip de abajo. */
export function chipDeAbajo(rango: { ufMin: number } | null): RangoUf | null {
  if (!rango || !(rango.ufMin > 0)) return null;
  return rangoDelPrecio(rango.ufMin);
}

/** El orden fijo cuando dos salidas tienen la misma cantidad: precio, pie, comuna. */
const ORDEN_TIPO: Record<AjustePerfil["tipo"], number> = { rango: 0, pie: 1, comuna: 2 };

/**
 * ¿Le falta oferta? null si con sus números conviene alguno en sus comunas (no hay nada que decir). Si no, cuántos había y
 * las salidas: el chip de abajo (si tiene más de 10), el pie 30 % (si con 30 % sí convienen; con pie 30 % o más ya es su
 * vara y dio cero) y la vecina que más da. `abajo`: el conteo del chip de abajo en sus comunas, o null si no hay chip.
 */
export function avisoSinOferta(
  p: { piePct: number | null; comunas: string[] },
  propias: ConteoComuna[],
  vecinas: ConteoComuna[],
  abajo: { rango: RangoUf; filas: ConteoComuna[] } | null = null,
): AvisoSinOferta | null {
  const comunas = Array.from(new Set(p.comunas)).filter((c) => COMUNAS_OK.has(c));
  const conPie30 = p.piePct != null && p.piePct >= 30;
  const suyos = (c: ConteoComuna) => (conPie30 ? c.comprar30 : c.comprar20);
  const enSus = propias.filter((c) => comunas.includes(c.comuna));
  if (enSus.reduce((s, c) => s + suyos(c), 0) > 0) return null;
  const candidatas: Array<Omit<SalidaSinOferta, "texto">> = [];
  if (abajo) {
    const n = abajo.filas.filter((c) => comunas.includes(c.comuna)).reduce((s, c) => s + suyos(c), 0);
    if (n > MINIMO_SALIDA_PRECIO) candidatas.push({ ajuste: { tipo: "rango", rango: abajo.rango.id }, etiqueta: etiquetaRango(abajo.rango), n, boton: SIN_OFERTA.botonRango(abajo.rango) });
  }
  // Con pie 30 % o más, n30 ES su vara y ya dio cero: el pie 30 nunca se le ofrece (no hace falta preguntarlo aparte).
  const n30 = enSus.reduce((s, c) => s + c.comprar30, 0);
  if (n30 > 0) candidatas.push({ ajuste: { tipo: "pie", pie: 30 }, etiqueta: "Con pie 30 %", n: n30, boton: SIN_OFERTA.botonPie(30) });
  const vecina = vecinas
    .filter((c) => !comunas.includes(c.comuna) && COMUNAS_OK.has(c.comuna) && suyos(c) > 0)
    .sort((a, b) => suyos(b) - suyos(a) || a.comuna.localeCompare(b.comuna))[0];
  if (vecina && comunas.length < MAX_COMUNAS_PERFIL) candidatas.push({ ajuste: { tipo: "comuna", comuna: vecina.comuna }, etiqueta: `En ${vecina.comuna}`, n: suyos(vecina), boton: SIN_OFERTA.botonComuna(vecina.comuna) });
  const salidas = candidatas
    .sort((a, b) => b.n - a.n || ORDEN_TIPO[a.ajuste.tipo] - ORDEN_TIPO[b.ajuste.tipo])
    .map((s, i) => ({ ...s, texto: `${s.etiqueta}, ${miles(s.n)}${i === 0 ? " sí" : ""}.` }));
  return { revisados: enSus.reduce((s, c) => s + c.total, 0), salidas, comunas, conPie30 };
}

/** La línea de las salidas: «Hasta UF 3.000, 810 sí. Con pie 30 %, 7. En Providencia, 4.». */
export function lineaDeSalidas(salidas: SalidaSinOferta[]): string {
  return salidas.map((s) => s.texto).join(" ");
}

/** Lo que manda el botón al PUT de /api/perfil-busqueda: el mismo cambio que el correo vacío (semanal.ts › perfilConAjuste),
 *  en los nombres del PUT. */
export function cambiosDeAjuste(a: AjustePerfil, comunas: string[]): Record<string, unknown> {
  if (a.tipo === "pie") return { piePct: a.pie };
  if (a.tipo === "rango") {
    const r = rangoPorId(a.rango);
    return r ? { precioMinUf: r.min, precioMaxUf: r.max } : {};
  }
  return { comunas: Array.from(new Set([...comunas, a.comuna])).slice(0, MAX_COMUNAS_PERFIL) };
}

const rangoPorId = (id: string): RangoUf | null => RANGOS_UF.find((r) => r.id === id) ?? null;

/** «tu pie quedó en 30 %» / «Santiago quedó en tu búsqueda» / «tu precio quedó hasta UF 3.000»: lo que dice «Listo: …». */
export const queCambio = queCambioAjuste;

/** El parámetro `origen` del PUT con que el servidor sabe que el ajuste vino de este aviso (evento `casa_ajuste`). */
export const ORIGEN_SIN_OFERTA = "casa-sin-oferta";
