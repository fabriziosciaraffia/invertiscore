import type { AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { runAnalysis } from "@/lib/analysis";
import type { MedianaComunaInyectada } from "@/lib/comuna-stats";

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
 * Mediana comunal (sobreprecio-sync): el caller (page.tsx) la prefetchea y la
 * inyecta para que el motor pueda sembrar el hallazgo de sobreprecio sync. Sin
 * ella, precioVsComuna queda con desviación null y el hallazgo no se emite —
 * comportamiento idéntico al previo.
 *
 * @see audit/sesionB-bug-snapshot/diagnostico.md
 */
export function recomputeResultsForLegacy(
  input: AnalisisInput,
  ufClp: number,
  medianaComuna?: MedianaComunaInyectada,
  // Fecha de análisis CONGELADA (espejo de ufClp). El render la re-deriva de
  // created_at para que la proyección/score/prosa de deptos en verde no deriven
  // entre recomputes. Ausente ⇒ new Date() (compat). Ver of-datedrift-design.md.
  asOf?: Date,
): FullAnalysisResult {
  // Una sola fecha para el análisis y para la matriz: si `asOf` falta, runAnalysis
  // usaría new Date() por su cuenta y la matriz otra.
  const fecha = asOf ?? new Date();
  const base = runAnalysis(input, ufClp, medianaComuna, fecha);
  // ⚠ ACTA (13-sep-2026) · ACÁ SE ARMABA LA MATRIZ PIE × PLAZO y ya no. La simulaba
  // `simularPieYPlazo`, 16 celdas con recompute completo cada una, y su único consumidor
  // era `MatrizPiePlazoLtr`, que solo montaba el pop-up viejo. Con el pop-up nuevo la
  // matriz sale de la grilla del mix —que ya se calcula para elegir la combinación— así
  // que esas 16 celdas quedaron sin nadie que las leyera.
  //
  // Lo que la matriz aportaba y NO se pierde: su celda «hoy» reproducía el veredicto del
  // informe, y eso era un invariante del golden. Se mudó a la grilla del mix, sobre
  // `veredictoSinDescuento` de la celda `esActual` (simulacion-catch-test, parte 1).
  return base;
}
