import type { AnalisisInput, AnalysisMetrics } from "@/lib/types";
import { getMantencionRate } from "@/lib/analysis";
import { estimarContribuciones } from "@/lib/contribuciones";

/**
 * Enriquece `metrics` legacy con fallbacks que aplican la misma lógica de
 * defaults usada por `calcMetrics` al generar análisis nuevos.
 *
 * Análisis creados antes de Sesión B1 (commit 8cb3d6a, 2026-05-05) tienen
 * `results.metrics` persistido sin los campos `gastos`, `contribuciones`
 * ni `provisionMantencionAjustada`. Cualquier consumidor cliente que recompute
 * proyecciones sobre esos metrics sin enriquecer dispara NaN cascade en
 * Card 08 (KPIs sim) y Card 09 (chart Patrimonio).
 *
 * Mantener este helper como fuente única de fallbacks legacy. Cuando se
 * agreguen futuros campos a `AnalysisMetrics` que dependan de defaults
 * derivados, ampliar este helper en vez de dispersar fallbacks ad-hoc.
 *
 * @see audit/sesionB-bug-nan/diagnostico.md
 */
export function enrichMetricsLegacy(
  metrics: AnalysisMetrics,
  input: AnalisisInput,
): AnalysisMetrics {
  const precioCLP = metrics.precioCLP;
  const esNuevoOReciente = (input.enConstruccion ?? false) || (input.antiguedad ?? 0) <= 2;

  return {
    ...metrics,
    gastos:
      metrics.gastos
      ?? (input.gastos > 0 ? input.gastos : Math.round((input.superficie ?? 0) * 1200)),
    contribuciones:
      metrics.contribuciones
      ?? (input.contribuciones > 0
        ? input.contribuciones
        : estimarContribuciones(precioCLP, esNuevoOReciente)),
    provisionMantencionAjustada:
      metrics.provisionMantencionAjustada
      ?? (input.provisionMantencion > 0
        ? input.provisionMantencion
        : Math.round((precioCLP * getMantencionRate(input.antiguedad ?? 0)) / 12)),
  };
}
