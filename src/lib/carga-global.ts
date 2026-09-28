// ─────────────────────────────────────────────────────────────────────────────
// LO QUE TARDA SE VE CARGANDO (regla de affordance, 28-sep-2026).
//
// Un solo estado para todo el sitio: «hay una navegación o una carga en curso». Lo enciende
// quien toca (EnlaceCarga, al hacer clic en un enlace interno) y lo apaga la barra (BarraCarga)
// cuando la ruta cambió, o un tope por si la navegación nunca llega. Sin React acá: se puede
// probar en Node y lo consume `useCargaGlobal` con useSyncExternalStore.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";

let activa = false;
let version = 0;
const oyentes = new Set<() => void>();

function avisar(): void {
  version += 1;
  oyentes.forEach((cb) => cb());
}

/** Algo que puede tardar arrancó. Idempotente. */
export function iniciarCarga(): void {
  if (activa) return;
  activa = true;
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
