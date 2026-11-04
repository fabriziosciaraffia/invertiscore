// ─────────────────────────────────────────────────────────────────────────────
// VOLVER AL MAPA DESDE EL INFORME (04-nov-2026, la pasada de Fabrizio). El informe que se abrió desde Explorar lleva arriba «← Volver
// al mapa», que abre /explorar con los mismos filtros, centrado en ese pin y con su tarjeta ya en «Ya lo analizaste · Ver informe»; y
// el «atrás» del navegador hace lo mismo. Antes «atrás» volvía a /explorar sin el pin ni la tarjeta (y un segundo «atrás», al
// dashboard), medido en producción el 04-nov-2026.
// CÓMO: al abrir el informe, Explorar deja SU entrada del historial con el pin (`a=`) y anota en la pestaña (sessionStorage) qué
// informe salió de qué pin y desde qué mapa. El informe lee esa nota para dibujar el enlace; Explorar, al volver, la lee para marcar
// el pin como analizado aunque la página venga del caché del navegador. Desde el dashboard o la selección no hay nota: «atrás»
// vuelve adonde estaba y el informe no ofrece el mapa. LA NOTA SE GASTA al mostrarse (QA del preview, 04-nov-2026: el mismo informe
// abierto después desde el dashboard seguía ofreciendo el mapa); los analizados de la pestaña quedan aparte. Puro: sin React ni Next.
// ─────────────────────────────────────────────────────────────────────────────
import { PARAMS_DE_UNA_VEZ } from "./enlace-compartido";

export const CLAVE_VOLVER_MAPA = "franco_volver_mapa";
/** Los analizados desde el mapa en esta pestaña (aviso → informe): no se gastan con la nota. */
export const CLAVE_ANALIZADOS_MAPA = "franco_analizados_mapa";
export const VOLVER_AL_MAPA = "Volver al mapa";
/** Lo que no vuelve en el enlace: lo de una vez (el enlace compartido) y «analizar=1», que analizaría de nuevo al llegar. */
const NO_VUELVEN: readonly string[] = ["analizar", ...PARAMS_DE_UNA_VEZ];
/** Las notas de la pestaña: las últimas, para no crecer sin fin. */
const MAX_NOTAS = 20;
const UUID = /^[0-9a-f-]{36}$/i;

type Almacen = Pick<Storage, "getItem" | "setItem">;
/** Qué informe salió de qué pin y adónde se vuelve: /explorar con los filtros de ese momento y el pin abierto. */
export interface NotaVolver { informeId: string; avisoId: string; href: string }

/** El mapa al que se vuelve: la misma ruta y los mismos filtros, con el pin abierto (`a`) y sin lo que no vuelve. */
export function hrefDelMapa(pathname: string, search: string, avisoId: string): string {
  const sp = new URLSearchParams(search);
  for (const k of NO_VUELVEN) sp.delete(k);
  sp.set("a", avisoId);
  return `${pathname}?${sp.toString()}`;
}

const valida = (x: unknown): x is NotaVolver => {
  const n = x as Partial<NotaVolver> | null;
  return !!n && typeof n.informeId === "string" && UUID.test(n.informeId) && typeof n.avisoId === "string" && n.avisoId.length > 0 && typeof n.href === "string" && n.href.startsWith("/explorar");
};
function leer(almacen: Almacen | null): NotaVolver[] {
  try {
    const x = JSON.parse(almacen?.getItem(CLAVE_VOLVER_MAPA) ?? "[]") as unknown;
    return Array.isArray(x) ? x.filter(valida) : [];
  } catch {
    return [];
  }
}

function leerAnalizados(almacen: Almacen | null): Array<[string, string]> {
  try {
    const x = JSON.parse(almacen?.getItem(CLAVE_ANALIZADOS_MAPA) ?? "[]") as unknown;
    return Array.isArray(x) ? x.filter((p): p is [string, string] => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string" && UUID.test(p[1])) : [];
  } catch {
    return [];
  }
}

/** Al abrir el informe desde Explorar: la nota de este informe (reemplaza la anterior del mismo informe) y el pin como analizado. */
export function anotarVolver(almacen: Almacen | null, nota: NotaVolver): void {
  if (!valida(nota)) return;
  try {
    const xs = leer(almacen).filter((x) => x.informeId !== nota.informeId);
    xs.push(nota);
    almacen?.setItem(CLAVE_VOLVER_MAPA, JSON.stringify(xs.slice(-MAX_NOTAS)));
    const an = leerAnalizados(almacen).filter(([a]) => a !== nota.avisoId);
    an.push([nota.avisoId, nota.informeId]);
    almacen?.setItem(CLAVE_ANALIZADOS_MAPA, JSON.stringify(an.slice(-MAX_NOTAS)));
  } catch { /* sin almacenamiento, sin «Volver al mapa» */ }
}

/** En el informe: adónde vuelve, si se abrió desde Explorar en esta pestaña. LA GASTA: abierto después desde otro lado, no vuelve. */
export function tomarNotaDelInforme(almacen: Almacen | null, informeId: string): NotaVolver | null {
  const xs = leer(almacen);
  const nota = xs.find((x) => x.informeId === informeId) ?? null;
  if (nota) {
    try { almacen?.setItem(CLAVE_VOLVER_MAPA, JSON.stringify(xs.filter((x) => x.informeId !== informeId))); } catch { /* queda */ }
  }
  return nota;
}

/** En Explorar, al volver: los pines analizados en esta pestaña (aviso → informe), aunque la página venga del caché. */
export function analizadosDeLaPestana(almacen: Almacen | null): Record<string, string> {
  return Object.fromEntries(leerAnalizados(almacen));
}
