// ─────────────────────────────────────────────────────────────────────────
// deriveRecomendacionFallback — recomendación de modalidad para la vista
// comparativa. Módulo PURO server-safe.
//
// Se extrajo de comparativa-client.tsx y shared-client.tsx (ambos "use client",
// con copias verbatim-idénticas y sin exportar) para que también lo consuma la
// vista documento comparativa (server component). Fuente única: los dos clientes
// y el documento importan de acá.
//
// Delega en `deriveRecomendacionModalidad` del motor (la fuente de verdad que
// comparte con el endpoint comparativa/ai server-side); esta capa solo arma el
// input desde un ShortTermResult y define el default sin datos.
// ─────────────────────────────────────────────────────────────────────────

import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import type { RecomendacionModalidadAmbas } from "@/lib/types";
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";

export function deriveRecomendacionFallback(
  strResults: ShortTermResult | null,
): RecomendacionModalidadAmbas {
  if (!strResults) return "INDIFERENTE";
  return deriveRecomendacionModalidad({
    recomendacionModalidad: strResults.recomendacionModalidad,
    zonaSTR: strResults.zonaSTR,
    sobreRentaPct: strResults.comparativa?.sobreRentaPct ?? 0,
    // P3 (Rama 0b): contexto para clasificar por absoluto cuando el ratio degenera.
    ltrNoiMensual: strResults.comparativa?.ltr?.noiMensual,
    sobreRenta: strResults.comparativa?.sobreRenta,
    strNoiMensual: strResults.comparativa?.str_auto?.noiMensual,
  });
}
