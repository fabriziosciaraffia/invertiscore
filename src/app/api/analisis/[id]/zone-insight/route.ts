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
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { buildZoneInsightForRow, PROMPT_VERSION_ZONA, type ZoneInsightResponse } from "@/lib/zone-insight-core";
import { nuevoRegistroLlamadas, persistGeneracionTiming } from "@/lib/pipeline-timing";

// Goal C: techo explícito — POIs + stats + 1 llamada corta (1200 tokens).
export const maxDuration = 60;

// Rate-limit del CACHE-MISS (F2-1 decisión 3): la única rama que dispara una
// llamada Claude. Endpoint sin auth (la vista guest/anónima también muestra
// zona), así que un drive-by podía quemar tokens a voluntad — con el cap
// anónimo el tráfico sin sesión sube y esto lo acota. Mismo patrón in-memory
// best-effort de /api/analisis/dry-run, keyed por user.id ?? IP. El cache-hit
// (lo normal) no paga nada.
const RL_MAX = 10;
const RL_WINDOW_MS = 60_000;
const rlHits = new Map<string, number[]>();

function generacionRateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (rlHits.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(key, arr);
  return arr.length > RL_MAX;
}

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

    // Cache hit — unless forced o la version del prompt quedo atras.
    // Espejo de la invalidacion lazy-on-open de ai_analysis: un cache con
    // `promptVersion` menor que la vigente (o sin el campo, = pre-versionado) se
    // trata como MISS y se regenera al abrir. Sin esto, un arreglo de doctrina de
    // zona no llegaba nunca al parque: medido, 21 de 102 informes BUSCAR OTRA
    // seguian con lenguaje celebratorio pese a que la REGLA 9 ya estaba escrita.
    const cacheVersion = (row.zone_insight as { promptVersion?: number } | null)?.promptVersion;
    const cacheVigente = cacheVersion === PROMPT_VERSION_ZONA;
    if (!force && cacheVigente && row.zone_insight && typeof row.zone_insight === "object") {
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

    // Rate-limit SOLO acá (post cache-miss): la generación cuesta tokens.
    const { data: { user: rlUser } } = await supabase.auth.getUser();
    const rlKey = rlUser?.id ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ?? "sin-ip";
    if (generacionRateLimited(rlKey)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
        { status: 429 },
      );
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
    // Fila anónima (cap F2-2): el write va por service-role — el client del
    // request no tiene sesión y el cache no se persistía, o sea CADA apertura
    // del anónimo-dueño regeneraba (tokens al viento, y el rate-limit de arriba
    // castigaba a quien mira su propia zona).
    const writeClient = row.user_id === null ? createAnonPipelineClient() : supabase;
    try {
      await writeClient.from("analisis").update({ zone_insight: response }).eq("id", params.id);
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
