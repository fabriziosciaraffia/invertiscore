// ─────────────────────────────────────────────────────────────────────────
// Orden de la pirámide STR (Filosofía 1: adversos primero, por decisividad) —
// módulo PURO, server-safe. Se extrajo de PiramideHallazgosSTR.tsx ("use client")
// para que también lo consuma la vista documento STR (server component); antes,
// importarlo desde el componente cliente devolvía un client-reference stub y
// reventaba server-side. Fuente única del orden: el componente cliente lo
// re-exporta desde acá, y la secuencia de drawers se deriva del mismo array.
// ─────────────────────────────────────────────────────────────────────────

import type { Hallazgo } from "@/lib/types";
import { cmpDecisividad, esAdverso } from "@/components/analysis/PiramideHallazgos";

/** Dedup por id: el hallazgo CON titular gana; entre iguales, mayor decisividad. */
function dedup(hallazgos: Hallazgo[]): Hallazgo[] {
  const byId = new Map<string, Hallazgo>();
  for (const h of hallazgos) {
    const prev = byId.get(h.id);
    const hT = !!h.titular;
    const pT = prev ? !!prev.titular : false;
    const gana = !prev || (hT && !pT) || (hT === pT && h.decisividad > prev.decisividad);
    if (gana) byId.set(h.id, h);
  }
  return Array.from(byId.values());
}

// Orden EXACTO que renderiza la pirámide STR (Filosofía 1). Un solo orden de
// verdad: el componente y la navegación prev/next de los drawers lo consumen tal cual.
export function ordenarHallazgosPiramideSTR(hallazgos: Hallazgo[] | null | undefined): Hallazgo[] {
  const gathered = dedup(Array.isArray(hallazgos) ? hallazgos.filter(Boolean) : []);
  const adversos = gathered.filter(esAdverso).sort(cmpDecisividad);
  const favorables = gathered.filter((h) => !esAdverso(h)).sort(cmpDecisividad);
  return [...adversos, ...favorables];
}
