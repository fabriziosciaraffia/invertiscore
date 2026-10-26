// ─────────────────────────────────────────────────────────────────────────────
// SIN OFERTA, DICHO ARRIBA DE LA SELECCIÓN (26-oct-2026, decisión de Fabrizio). El reporte del 26-oct contó 49 de 172
// cuentas con perfil sin un solo depto que conviniera con sus números en sus comunas: el dashboard les mostraba la
// selección (vecinas, negociables o nada) sin decir por qué. Ahora lo dice, con la misma salida concreta que el correo
// vacío (semanal-servidor.ts › verdadDelVacio): «Con tu búsqueda no hay deptos que convengan esta semana. Con pie 30 %,
// 14 sí. En Santiago, 810.», y un botón por salida para ajustar el perfil en un toque (el mismo ajuste del correo:
// semanal.ts › AjustePerfil).
//
// La cuenta es la de /deptos (`deptos_conteo`: la evaluación de anoche a 25 años, ventana de 7 días, sus comunas, sus
// dormitorios y el rango del semanal), con SU pie: pie 30 % o más cuenta los Comprar a pie 30 %; menos, a pie 20 %, como
// /deptos y el correo. La comuna que se ofrece es la vecina que más da con esa misma vara.
// Puro: lo prueba el tier PERFIL-OFERTA.
// ─────────────────────────────────────────────────────────────────────────────
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import type { ConteoComuna } from "@/lib/deptos/respuesta";
import { SEMANAL_VACIO, type AjustePerfil } from "@/lib/guia/semanal";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
/** Hasta cuántas comunas guarda el perfil (validarCambiosPerfil). */
const MAX_COMUNAS_PERFIL = 8;

export const SIN_OFERTA = {
  titulo: "Con tu búsqueda no hay deptos que convengan esta semana.",
  conPie: (pie: number, n: number) => `Con pie ${pie} %, ${miles(n)} sí.`,
  enComuna: (comuna: string, n: number) => `En ${comuna}, ${miles(n)}.`,
  /** Sin salida: cuántos había, y que ninguno da ni con pie 30 % ni en las vecinas. */
  revisados: (n: number, conPie30: boolean) => (n === 0
    ? "Anoche no había ninguno publicado como los que buscas."
    : `Anoche había ${miles(n)} ${n === 1 ? "publicado como los que buscas, y no conviene" : "publicados como los que buscas, y ninguno conviene"} con tu pie${conPie30 ? "" : ", ni con pie 30 %"} ni en comunas vecinas.`),
  botonPie: SEMANAL_VACIO.ajustarPie,
  botonComuna: SEMANAL_VACIO.ajustarComuna,
  cambiar: "Cambiar mi búsqueda",
  listo: SEMANAL_VACIO.ajusteListo,
  guardando: "Guardando…",
  error: "No pudimos guardarlo. Intenta de nuevo.",
} as const;

export interface SalidaSinOferta {
  ajuste: AjustePerfil;
  texto: string;
  boton: string;
  n: number;
}

export interface AvisoSinOferta {
  /** Cuántos había publicados como los que busca, en sus comunas. */
  revisados: number;
  /** Las salidas, en orden: el pie 30 % y la comuna vecina que más da. Vacío: no hay con qué ajustar en un toque. */
  salidas: SalidaSinOferta[];
  /** Sus comunas tal como el perfil las guarda (las del Gran Santiago): el ajuste de comuna las conserva y suma la vecina. */
  comunas: string[];
  /** Su pie ya es 30 % o más: no se le ofrece pie 30 % ni se le dice «ni con pie 30 %». */
  conPie30: boolean;
}

/**
 * ¿Le falta oferta? null si con sus números conviene alguno en sus comunas (no hay nada que decir). Si no, cuántos había
 * y las salidas: pie 30 % (solo si su pie es menor y con 30 % sí convienen) y la vecina que más da (si da alguno).
 */
export function avisoSinOferta(p: { piePct: number | null; comunas: string[] }, propias: ConteoComuna[], vecinas: ConteoComuna[]): AvisoSinOferta | null {
  const comunas = Array.from(new Set(p.comunas)).filter((c) => COMUNAS_OK.has(c));
  const conPie30 = p.piePct != null && p.piePct >= 30;
  const suyos = (c: ConteoComuna) => (conPie30 ? c.comprar30 : c.comprar20);
  const enSus = propias.filter((c) => comunas.includes(c.comuna));
  if (enSus.reduce((s, c) => s + suyos(c), 0) > 0) return null;
  const salidas: SalidaSinOferta[] = [];
  const n30 = enSus.reduce((s, c) => s + c.comprar30, 0);
  // Con pie 30 % o más, n30 ES su vara y ya dio cero: el pie 30 nunca se le ofrece (no hace falta preguntarlo aparte).
  if (n30 > 0) salidas.push({ ajuste: { tipo: "pie", pie: 30 }, texto: SIN_OFERTA.conPie(30, n30), boton: SIN_OFERTA.botonPie(30), n: n30 });
  const vecina = vecinas
    .filter((c) => !comunas.includes(c.comuna) && COMUNAS_OK.has(c.comuna) && suyos(c) > 0)
    .sort((a, b) => suyos(b) - suyos(a) || a.comuna.localeCompare(b.comuna))[0];
  if (vecina && comunas.length < MAX_COMUNAS_PERFIL) salidas.push({ ajuste: { tipo: "comuna", comuna: vecina.comuna }, texto: SIN_OFERTA.enComuna(vecina.comuna, suyos(vecina)), boton: SIN_OFERTA.botonComuna(vecina.comuna), n: suyos(vecina) });
  return { revisados: enSus.reduce((s, c) => s + c.total, 0), salidas, comunas, conPie30 };
}

/** Lo que manda el botón al PUT de /api/perfil-busqueda: el pie a 30 %, o sus comunas con la vecina sumada (el mismo
 *  ajuste que el correo vacío: semanal.ts › perfilConAjuste, en los nombres del PUT). */
export function cambiosDeAjuste(a: AjustePerfil, comunas: string[]): Record<string, unknown> {
  if (a.tipo === "pie") return { piePct: a.pie };
  return { comunas: Array.from(new Set([...comunas, a.comuna])).slice(0, MAX_COMUNAS_PERFIL) };
}

/** «tu pie quedó en 30 %» / «Santiago quedó en tu búsqueda»: lo que dice «Listo: …» después del toque. */
export function queCambio(a: AjustePerfil): string {
  return a.tipo === "pie" ? `tu pie quedó en ${a.pie} %` : `${a.comuna} quedó en tu búsqueda`;
}

/** El parámetro `origen` del PUT con que el servidor sabe que el ajuste vino de este aviso (evento `casa_ajuste`). */
export const ORIGEN_SIN_OFERTA = "casa-sin-oferta";
