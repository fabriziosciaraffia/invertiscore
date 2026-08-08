// ─────────────────────────────────────────────────────────────────────────
// Orden de la pirámide STR — módulo PURO, server-safe. Se extrajo de
// PiramideHallazgosSTR.tsx ("use client") para que también lo consuma la vista
// documento STR (server component); antes, importarlo desde el componente
// cliente devolvía un client-reference stub y reventaba server-side.
// Fuente única del orden: el componente cliente lo re-exporta desde acá, y la
// secuencia de drawers + el índice del hero se derivan del mismo array.
//
// STR hereda el ORDEN ÚNICO (esquema C-umbral, orden-hallazgos.ts) — mismo sort
// que LTR, numeración continua 01-12.
// ─────────────────────────────────────────────────────────────────────────

import type { Hallazgo } from "@/lib/types";
import { dedupHallazgos, ordenarHallazgosUnico } from "@/lib/orden-hallazgos";

// Orden EXACTO que renderiza la pirámide STR (orden único). Un solo orden de
// verdad: el componente, el índice del hero y la navegación prev/next de los
// drawers lo consumen tal cual.
export function ordenarHallazgosPiramideSTR(hallazgos: Hallazgo[] | null | undefined): Hallazgo[] {
  const limpios = Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : [];
  // `distancia_veredicto` NO va en la pirámide, igual que en LTR: no es un hallazgo SOBRE
  // el departamento sino un mapa de la distancia al umbral de decisión. Su lugar es el hero
  // y su drawer propio. Sin este filtro se colaría a las cards y correría la numeración
  // 01-12 de todos los demás.
  return ordenarHallazgosUnico(
    dedupHallazgos(limpios).filter((h) => h.id !== "distancia_veredicto"),
  );
}
