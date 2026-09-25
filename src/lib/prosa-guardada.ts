import type { AIAnalysisV2 } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// LA PROSA GUARDADA DE LAS FILAS VIEJAS (25-sep-2026)
//
// La IA salió del informe y ya no se genera. La columna `ai_analysis` se deja de leer, pero no se
// borra, y de ella sobrevive UNA lectura: `hallazgoSobreprecio`, un hallazgo numérico del motor
// que las filas viejas guardaron adentro de la prosa (las nuevas lo traen en `results`). Este
// discriminador decide si la prosa guardada tiene esa forma. Vivía en `AIInsightSection.tsx`,
// retirado con la parte 2 del retiro de la IA.
//
// Discriminador: `conviene.cajaAccionable_clp`, el campo que traen todas las formas de prosa LTR
// que se persistieron (medido el 09-sep-2026: las 669 filas LTR con prosa lo tienen). Es una
// PRESENCIA, no una ausencia: se mira el campo que tiene que estar.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasAiV2(ai: any): ai is AIAnalysisV2 {
  return !!ai
    && typeof ai === "object"
    && !!ai.conviene
    && typeof ai.conviene.cajaAccionable_clp === "string";
}
