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

let activa = false;
let rutaOrigen = "";
let version = 0;
const oyentes = new Set<() => void>();

function avisar(): void {
  version += 1;
  oyentes.forEach((cb) => cb());
}

/** Algo que puede tardar arrancó desde `ruta`. Idempotente: la primera ruta manda. */
export function iniciarCarga(ruta: string): void {
  if (activa) return;
  activa = true;
  rutaOrigen = ruta;
  avisar();
}

/** Terminó (la ruta cambió, o se rindió el tope). Idempotente. */
export function terminarCarga(): void {
  if (!activa) return;
  activa = false;
  avisar();
}

export function hayCarga(): boolean {
  return activa;
}

/** Desde qué ruta arrancó la carga en curso ("" si no hay). */
export function rutaCarga(): string {
  return activa ? rutaOrigen : "";
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
