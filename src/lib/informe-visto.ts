"use client";

// ─────────────────────────────────────────────────────────────────────────
// Evento `informe_visto` (Goal B) — un solo camino para las 3 superficies
// (LTR, STR, AMBAS): captura en PostHog + persiste `informe_visible_at` vía
// RPC `marcar_informe_visible` (migración 20260809_informe_visto.sql).
//
// TODO acá es fail-soft: el tracking jamás bloquea ni rompe el render. La RPC
// es NULL-only en el SQL (solo el primer view escribe) y SECURITY INVOKER
// (RLS: solo el owner escribe; shared/guest tocan 0 filas o fallan en
// silencio). El EVENTO sí dispara en cada visita — los funnels dedupean.
// ─────────────────────────────────────────────────────────────────────────

import type { PostHog } from "posthog-js";
import { createClient } from "@/lib/supabase/client";

/** Estado de la prosa IA AL MOMENTO en que el veredicto queda visible.
 *  Goal C: el veredicto LTR se ve al montar (el overlay murió), así que los
 *  valores de "por qué vía llegó la prosa" (background/fallback/manual) dejaron
 *  de ser observables en este evento — quedaron solo los estados de mount. */
export type InformeAiEstado =
  | "cacheada"      // prosa persistida servida por el server component
  | "generando"     // veredicto visible con la prosa aún en vuelo
  | "stale-regen";  // LTR: prosa vieja invalidada, regen lazy-on-open en vuelo

const SUBMIT_TS_KEY = "franco_submit_ts";
// Un stamp más viejo que esto no es "la espera del submit" (pestaña olvidada).
const MAX_ESPERA_MS = 30 * 60 * 1000;

/** El wizard estampa el instante del click en "Analizar" (antes del POST). */
export function estamparSubmit(): void {
  try {
    sessionStorage.setItem(SUBMIT_TS_KEY, String(Date.now()));
  } catch {
    /* sessionStorage puede fallar en modo privado — la espera queda sin medir */
  }
}

/** Lee y CONSUME el stamp del submit. null si no hay (re-visita) o si venció. */
export function leerEsperaMs(): number | null {
  try {
    const raw = sessionStorage.getItem(SUBMIT_TS_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SUBMIT_TS_KEY);
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return null;
    const delta = Date.now() - ts;
    return delta >= 0 && delta <= MAX_ESPERA_MS ? delta : null;
  } catch {
    return null;
  }
}

export function registrarInformeVisto(args: {
  posthog: PostHog | null | undefined;
  /** LTR/STR: [analysisId]. AMBAS: [ltrId, strId] — se marcan las dos filas. */
  ids: string[];
  modalidad: "ltr" | "str" | "ambas";
  aiEstado: InformeAiEstado;
  esperaMs: number | null;
  esOwner?: boolean;
}): void {
  if (args.ids.length === 0) return; // demo sin analysisId: nada que registrar

  try {
    args.posthog?.capture("informe_visto", {
      analysis_id: args.ids[0],
      ...(args.modalidad === "ambas" && args.ids.length > 1
        ? { ltr_id: args.ids[0], str_id: args.ids[1] }
        : {}),
      modalidad: args.modalidad,
      ai_estado: args.aiEstado,
      espera_ms: args.esperaMs,
      ...(args.esOwner !== undefined ? { es_owner: args.esOwner } : {}),
    });
  } catch {
    /* PostHog sin inicializar — no es un problema */
  }

  // Persistencia fire-and-forget: no se awaitea desde el render.
  void (async () => {
    try {
      const supabase = createClient();
      await Promise.all(
        args.ids.map((id) => supabase.rpc("marcar_informe_visible", { p_analysis_id: id })),
      );
    } catch {
      /* RPC ausente (migración sin aplicar) o sin sesión — el render no se entera */
    }
  })();
}
