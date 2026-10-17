// ─────────────────────────────────────────────────────────────────────────────
// LA SELECCIÓN EN EL DASHBOARD (14-oct-2026, decisión de Fabrizio), la parte pura. El dashboard muestra «Tu selección
// de esta semana» con sus dos bloques resumidos —cuántos deptos y de qué veredicto; el de renta corta, estimado por
// zona— y el enlace a la página semanal, que con sesión abre SIN token (semanal-servidor.ts › seleccionDeEstaSemana).
// Y en el archivo, un informe que salió de un aviso dice de dónde salió en vez de «SIN DIRECCIÓN»: «Desde tu selección
// semanal» o, desde el 14-oct-2026 también, «Desde tu guía» (la del pack) — origenDeInforme. Lo fija el tier
// SEMANAL-AJUSTES.
// ─────────────────────────────────────────────────────────────────────────────
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import type { Veredicto } from "@/lib/types";
import { SEMANAL_STR } from "./semanal-str";

export const SELECCION_CASA = {
  titulo: "Tu selección de esta semana",
  boton: "Ver tu selección",
  /** Sin token: la página la resuelve con la sesión. */
  href: "/semanal",
  zona: "estimados por zona",
  ninguno: "Esta semana, ninguno",
  /** El archivo del dashboard, en lugar de «SIN DIRECCIÓN». */
  archivo: "Desde tu selección semanal",
  archivoGuia: "Desde tu guía",
} as const;

export interface ResumenBloque {
  modalidad: "ltr" | "str";
  titulo: string;
  texto: string;
  /** Para el bloque de arriba del dashboard (17-oct-2026): cuántos deptos y cuántos de cada veredicto, con la tríada. */
  deptos: number;
  conteos: Array<{ v: Veredicto; n: number }>;
}

const ORDEN: Veredicto[] = ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"];

function conteos(items: Array<{ veredicto?: string | null }>): Array<{ v: Veredicto; n: number }> {
  return ORDEN.map((v) => ({ v, n: items.filter((i) => i.veredicto === v).length })).filter((c) => c.n > 0);
}

function textoBloque(items: Array<{ veredicto?: string | null }>, zona: boolean): string {
  if (items.length === 0) return SELECCION_CASA.ninguno;
  const partes = [`${items.length} ${items.length === 1 ? "depto" : "deptos"}`];
  for (const v of ORDEN) {
    const n = items.filter((i) => i.veredicto === v).length;
    if (n > 0) partes.push(`${n} ${etiquetaVeredicto(v, "frase")}`);
  }
  if (zona) partes.push(SELECCION_CASA.zona);
  return partes.join(" · ");
}

/** Los bloques que la persona tiene, resumidos: el de renta larga si lo tiene, el de renta corta si lo tiene. */
export function resumenSeleccion(sel: {
  conLargo: boolean;
  items: Array<{ veredicto?: string | null }>;
  corto: { items: Array<{ veredicto?: string | null }> } | null;
}): ResumenBloque[] {
  const out: ResumenBloque[] = [];
  if (sel.conLargo) out.push({ modalidad: "ltr", titulo: SEMANAL_STR.bloqueLargo, texto: textoBloque(sel.items, false), deptos: sel.items.length, conteos: conteos(sel.items) });
  if (sel.corto) out.push({ modalidad: "str", titulo: SEMANAL_STR.bloqueCorto, texto: textoBloque(sel.corto.items, true), deptos: sel.corto.items.length, conteos: conteos(sel.corto.items) });
  return out;
}

/** De sus filas recientes, la de esta semana: la de semana más reciente que tenga algún depto en alguno de sus dos
 *  bloques (una semana vacía no tapa a la anterior). null: ninguna. */
export function deEstaSemana<F extends { semana: string; items?: unknown[] | null; items_str?: unknown[] | null }>(filas: F[]): F | null {
  return [...filas].sort((a, b) => b.semana.localeCompare(a.semana)).find((s) => (s.items ?? []).length > 0 || (s.items_str ?? []).length > 0) ?? null;
}

export type OrigenInforme = "semanal" | "guia";

/**
 * ¿De dónde salió este informe? Un informe hecho desde un aviso (`origenAviso`) salió de la selección semanal (o de un
 * aviso inmediato, la misma página) o de la guía del pack: no hay otra puerta que arme `origenAviso`. Lo dice
 * `origenAviso.desde` desde el 14-oct-2026; en los anteriores, «semanal» si su aviso está en alguna de sus selecciones
 * y, si no, «guia». null: no salió de un aviso (el wizard).
 */
export function origenDeInforme(origen: unknown, avisosDeSusSelecciones: ReadonlySet<string>): OrigenInforme | null {
  const o = (origen ?? null) as { avisoId?: unknown; desde?: unknown } | null;
  if (!o || typeof o.avisoId !== "string") return null;
  if (o.desde === "semanal" || o.desde === "guia") return o.desde;
  return avisosDeSusSelecciones.has(o.avisoId) ? "semanal" : "guia";
}

/** ¿Salió de la selección semanal? */
export function esDesdeSemanal(origen: unknown, avisosDeSusSelecciones: ReadonlySet<string>): boolean {
  return origenDeInforme(origen, avisosDeSusSelecciones) === "semanal";
}

/** Lo que dice el archivo en lugar de «SIN DIRECCIÓN». */
export function textoOrigenArchivo(o: OrigenInforme): string {
  return o === "semanal" ? SELECCION_CASA.archivo : SELECCION_CASA.archivoGuia;
}
