// ─────────────────────────────────────────────────────────────────────────────
// LO QUE TARDA SE VE CARGANDO (regla de affordance, 28-sep-2026).
//
// Un solo estado para todo el sitio: «hay una navegación o una carga en curso». Lo enciende
// quien toca (EnlaceCarga, al hacer clic en un enlace interno, diciendo desde qué ruta) y lo apaga
// la barra (BarraCarga) cuando ve una ruta distinta de esa, o un tope por si la navegación nunca
// llega. Guardar la ruta de origen importa: el header se remonta entre la landing y la app, y una
// barra recién montada en la ruta nueva no vio ningún cambio; comparando con el origen sí sabe
// que la carga ya llegó. Sin React acá: se prueba en Node y lo consume `useCargaGlobal`.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";

let pendientes = 0;
let generacion = 0;
let rutaOrigen = "";
let version = 0;
const oyentes = new Set<() => void>();

function avisar(): void {
  version += 1;
  oyentes.forEach((cb) => cb());
}

/**
 * Algo que puede tardar arrancó desde `ruta`. Devuelve el `soltar` de ESTA carga: lo llama quien
 * espera sin cambiar de ruta (generar el análisis, iniciar el pago, aplicar una corrección) cuando
 * le llega la respuesta. Varias cargas a la vez se cuentan; la barra se apaga con la última. Un
 * `soltar` repetido, o posterior a `terminarCarga`, no hace nada. La primera ruta manda.
 */
export function iniciarCarga(ruta: string): () => void {
  if (pendientes === 0) rutaOrigen = ruta;
  pendientes += 1;
  if (pendientes === 1) avisar();
  const gen = generacion;
  let usado = false;
  return () => {
    if (usado || gen !== generacion || pendientes === 0) return;
    usado = true;
    pendientes -= 1;
    if (pendientes === 0) {
      rutaOrigen = "";
      avisar();
    }
  };
}

/** Terminó todo (la ruta cambió, o se rindió el tope). Idempotente; invalida los `soltar` vivos. */
export function terminarCarga(): void {
  if (pendientes === 0) return;
  pendientes = 0;
  rutaOrigen = "";
  generacion += 1;
  avisar();
}

export function hayCarga(): boolean {
  return pendientes > 0;
}

/** Desde qué ruta arrancó la carga en curso ("" si no hay). */
export function rutaCarga(): string {
  return pendientes > 0 ? rutaOrigen : "";
}

/**
 * La clave con que se compara una ruta: pathname + query normalizada, sin hash. Los chips del
 * dashboard navegan a la MISMA ruta con otra query (y un #archivo): eso también tarda, así que la
 * query cuenta y el hash no.
 */
export function claveDeRuta(pathname: string, search: string): string {
  const q = new URLSearchParams(search).toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** La clave del destino de un href interno («/dashboard?q=x#archivo» → «/dashboard?q=x»). */
export function claveDeHref(href: string): string {
  const sinHash = href.split("#")[0];
  const i = sinHash.indexOf("?");
  return i < 0 ? claveDeRuta(sinHash, "") : claveDeRuta(sinHash.slice(0, i), sinHash.slice(i));
}

/** La clave de la ruta que muestra el navegador ahora (solo en el cliente, dentro de un handler). */
export function claveActual(): string {
  if (typeof window === "undefined") return "";
  return claveDeRuta(window.location.pathname, window.location.search);
}

export function suscribirCarga(cb: () => void): () => void {
  oyentes.add(cb);
  return () => { oyentes.delete(cb); };
}

/** Cuántas veces cambió (para los tests). */
export function versionCarga(): number {
  return version;
}

const enServidor = () => false;

export function useCargaGlobal(): boolean {
  return useSyncExternalStore(suscribirCarga, hayCarga, enServidor);
}
