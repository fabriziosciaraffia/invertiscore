// ============================================================================
// GET /api/analisis/[id]/zone-insight — wrapper HTTP del zone insight
// ============================================================================
// El núcleo de generación (POIs + stats + prosa IA) vive en
// src/lib/zone-insight-core.ts (paquete B: extraído para que la regen
// administrativa por lote pueda invocarlo sin HTTP). Acá queda solo lo que es
// del request: client con cookies del usuario, cache-hit con backfills, cache
// write best-effort y traducción de errores a HTTP.

import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createClient } from "@/lib/supabase/server";
import { buildZoneInsightForRow, type ZoneInsightResponse } from "@/lib/zone-insight-core";
import { nuevoRegistroLlamadas, persistGeneracionTiming } from "@/lib/pipeline-timing";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("regenerate") === "true";

    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // Cache hit — unless forced.
    if (!force && row.zone_insight && typeof row.zone_insight === "object") {
      const cached = row.zone_insight as ZoneInsightResponse & {
        insight: { preview_clp?: string; preview_uf?: string; accion?: string };
      };
      // Backfill preview fields if cache was generated before they existed.
      if (cached.insight && !cached.insight.preview_clp) {
        const n = cached.insight.narrative_clp || "";
        cached.insight.preview_clp = n ? n.slice(0, 140).trim() + (n.length > 140 ? "…" : "") : "";
        cached.insight.preview_uf = cached.insight.preview_clp;
      }
      // Fase 5 — backfill accion para caches v1 (campo agregado en v2).
      if (cached.insight && typeof cached.insight.accion !== "string") {
        cached.insight.accion = "";
      }
      return NextResponse.json(cached);
    }

    // Núcleo extraído (paquete B): POIs + stats + prosa IA, sin HTTP ni persistencia.
    // Timing (Goal A): esta generación hoy no registra usage en ai_*_tokens; el
    // registro de pipeline_timing es su única visibilidad de ms + tokens.
    const tGen = Date.now();
    const reg = nuevoRegistroLlamadas();
    const built = await buildZoneInsightForRow(row, supabase, reg);
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: built.status });
    }
    const response = built.response;

    // Cache ─────────────────────────────────────────
    // Best-effort: if the column doesn't exist yet, swallow the error so the user
    // still gets the response.
    try {
      await supabase.from("analisis").update({ zone_insight: response }).eq("id", params.id);
    } catch (e) {
      console.warn("zone-insight: cache write failed (column missing?)", e);
    }

    await persistGeneracionTiming(supabase, params.id, {
      tipo: "zone-insight",
      trigger: "on-open",
      inicio_at: new Date(tGen).toISOString(),
      fin_at: new Date().toISOString(),
      total_ms: Date.now() - tGen,
      resultado: "ok",
      llamadas: reg.llamadas,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("zone-insight error:", error);
    captureApiError(error, { ruta: "GET /api/analisis/[id]/zone-insight", operacion: "generar-zone-insight" });
    return NextResponse.json({ error: "Error generando insight" }, { status: 500 });
  }
}
