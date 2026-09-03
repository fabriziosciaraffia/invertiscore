import type { AnalisisInput, AnalysisMetrics } from "@/lib/types";
import { calcMantencionMensual, resolverModeloCostos } from "@/lib/modelo-costos";
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
        // Misma fuente única que calcMetrics. Estas filas son pre-B1 (2026-05),
        // así que sin methodologyVersion caen a legacy, que es lo que las generó.
        // La UF se reconstruye del snapshot (precioCLP / precio UF); solo la usa v3.
        : calcMantencionMensual({
            modelo: resolverModeloCostos(input.methodologyVersion),
            antiguedad: input.antiguedad ?? 0,
            superficieUtilM2: input.superficie ?? 0,
            precioCLP,
            arriendoCLP: input.arriendo ?? 0,
            ufClp: input.precio > 0 ? precioCLP / input.precio : 0,
          })),
  };
}
