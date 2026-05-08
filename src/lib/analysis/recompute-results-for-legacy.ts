import type { AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";

/**
 * Recomputa `FullAnalysisResult` desde `input + ufClp` usando el motor actual.
 * Garantiza coherencia entre snapshots persistidos (motor pre-evolución) y
 * runtime fresh (motor actual). Patrón Opción A: siempre recomputar al cargar
 * — idempotente para análisis nuevos (motor genera lo mismo) y restaura
 * análisis legacy a la verdad actual.
 *
 * Antecedentes:
 * - Sesión A residual 2: clon `dynamicProjections` vs motor (UF_CLP).
 * - Sesión B1: `enrichMetricsLegacy` (campos faltantes en metrics).
 * - Sesión B-bug-snapshot: discrepancias TIR Card 04 vs Card 08, precio
 *   sugerido header vs drawer (motor pre-B3 H3 + Fase 3.6 v9 vs runtime).
 *
 * Esta función absorbe TODA la categoría "snapshot vs runtime fresh".
 * Cualquier evolución futura del motor (modelo plusvalía, comisión venta,
 * estructura negociación) se cubre genéricamente sin nuevos helpers.
 *
 * Notas operativas:
 * - El AI (`ai_analysis`) vive en columna SEPARADA de la tabla `analisis`,
 *   no dentro de `results`. Por eso este helper NO necesita preservar
 *   narrativas: el caller (`page.tsx`) ya pasa `ai_analysis` aparte a
 *   `PremiumResults`.
 * - Es idempotente: si ya existe un snapshot del motor actual, el output
 *   es bit-a-bit idéntico (mismo input + mismo motor → mismo output).
 *
 * @see audit/sesionB-bug-snapshot/diagnostico.md
 */
export function recomputeResultsForLegacy(
  input: AnalisisInput,
  ufClp: number,
): FullAnalysisResult {
  return runAnalysis(input, ufClp);
}
