// ─────────────────────────────────────────────────────────────────────────────
// LOS RESULTADOS QUE MUESTRA EL INFORME LTR, EN UN SOLO LUGAR (05-nov-2026, auditoría de promesas parte 3: «la vista previa
// del informe usa el mismo puntaje que el informe»). El informe no muestra los resultados guardados: los recalcula al abrir
// con la UF congelada al crear, la mediana del snapshot (o resuelta viva si la fila es de antes del snapshot) y la fecha de
// creación, y conserva el veredicto guardado (results-helpers.ts › conVeredictoGuardado). La imagen para compartir y la
// metadata leían la columna `score` —la del motor del día en que se creó— y podían decir otro puntaje que la portada.
// Ahora el informe (informe-ltr.tsx), la imagen (api/og) y la metadata (analisis/[id]/page.tsx) salen de acá.
// ─────────────────────────────────────────────────────────────────────────────
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnalisisInput, FullAnalysisResult } from "@/lib/types";
import { resolveUfForAnalysis } from "@/lib/uf";
import { enrichMetricsLegacy } from "@/lib/analysis/enrich-metrics-legacy";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { prefetchMedianaComunaVenta, prefetchCapRefComuna, type MedianaComunaSnapshot } from "@/lib/api-helpers/analisis-pipeline";
import type { CapRefComunaSnapshot } from "@/lib/capref-comuna";
import { conVeredictoGuardado } from "@/lib/results-helpers";
import { medianaDesdeSnapshot } from "@/lib/analysis/mediana-snapshot";

/** Lo que hace falta de la fila de `analisis`. */
export interface FilaInforme {
  id: string;
  created_at: string;
  results: unknown;
  input_data: unknown;
  mediana_comuna_snapshot?: unknown;
  capref_comuna_snapshot?: unknown;
}

export interface ResultadosDelInforme {
  results: FullAnalysisResult | null;
  /** La UF congelada con que se recalculó. */
  ufFrozen: number;
  medianaSnapshot: MedianaComunaSnapshot | null | undefined;
}

/** Los resultados del informe, como los dibuja la portada. `ufValue`: la UF viva (solo de respaldo para filas sin precio). */
export async function resultadosDelInforme(supabase: SupabaseClient, fila: FilaInforme, ufValue: number): Promise<ResultadosDelInforme> {
  const rawResults = (fila.results as FullAnalysisResult | null) || null;
  const inputDataRaw = fila.input_data as AnalisisInput | undefined;
  const ufFrozen = resolveUfForAnalysis(rawResults, inputDataRaw, ufValue, fila.id);
  const medianaSnapshot = fila.mediana_comuna_snapshot as MedianaComunaSnapshot | null | undefined;
  const capRefSnapshot = fila.capref_comuna_snapshot as CapRefComunaSnapshot | null | undefined;
  const medianaComuna = inputDataRaw
    ? (medianaSnapshot != null
        ? medianaDesdeSnapshot(medianaSnapshot, { capRefComuna: capRefSnapshot ?? (await prefetchCapRefComuna(supabase, inputDataRaw, ufFrozen)) })
        : await prefetchMedianaComunaVenta(supabase, inputDataRaw, ufFrozen))
    : undefined;
  const asOfFrozen = new Date(fila.created_at);
  const results: FullAnalysisResult | null = inputDataRaw
    ? conVeredictoGuardado(recomputeResultsForLegacy(inputDataRaw, ufFrozen, medianaComuna, asOfFrozen), rawResults)
    : (rawResults && rawResults.metrics
      ? { ...rawResults, metrics: enrichMetricsLegacy(rawResults.metrics, {} as AnalisisInput) }
      : rawResults);
  return { results, ufFrozen, medianaSnapshot };
}

/** El puntaje que dice la portada del informe (redondeado como la columna). null si no hay. */
export async function puntajeDelInforme(supabase: SupabaseClient, fila: FilaInforme, ufValue: number): Promise<number | null> {
  return puntajeDe((await resultadosDelInforme(supabase, fila, ufValue)).results);
}

export function puntajeDe(results: FullAnalysisResult | null | undefined): number | null {
  const s = results?.score;
  return typeof s === "number" && Number.isFinite(s) ? Math.round(s) : null;
}

export const COLUMNAS_INFORME = "id, created_at, results, input_data, mediana_comuna_snapshot, capref_comuna_snapshot";

/**
 * Por id, UNA VEZ POR PEDIDO (`cache` de React): la metadata y la página del informe piden lo mismo y el recálculo cuesta
 * ~136 ms (medido el 05-nov-2026 sobre 20 informes). null si la fila no existe.
 * `cache` solo existe en el React del servidor de Next: fuera de él (los scripts y el golden, con el React estable) el módulo
 * tiene que cargar igual, y entonces cada llamada recalcula.
 */
const unaVezPorPedido: <F extends (...a: never[]) => unknown>(f: F) => F = typeof cache === "function" ? cache : (f) => f;
export const resultadosPorId = unaVezPorPedido(async (id: string, ufValue: number): Promise<ResultadosDelInforme | null> => {
  const sb = createServiceClient();
  const { data } = await sb.from("analisis").select(COLUMNAS_INFORME).eq("id", id).maybeSingle();
  if (!data) return null;
  return resultadosDelInforme(sb, data as unknown as FilaInforme, ufValue);
});
