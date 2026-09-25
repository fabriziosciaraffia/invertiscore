// ─────────────────────────────────────────────────────────────────────────
// Instrumentación de timing por fase del pipeline de generación (Goal A).
//
// SOLO medición: nada de este módulo puede alterar el comportamiento del
// pipeline. Toda persistencia es fail-soft (try/catch, nunca lanza) y va por
// la RPC `registrar_pipeline_timing` (migración 20260808_pipeline_timing.sql),
// que hace el merge DENTRO del UPDATE (lock de fila de Postgres). Eso importa:
// la generación background y la del fallback de 60s pueden correr A LA VEZ
// sobre la misma fila, y un read-modify-write en TS (patrón camposUpdateUsage)
// perdería una de las dos entradas — que es justamente el fenómeno a medir.
//
// Si la RPC aún no existe (código deployado antes de la migración), las
// escrituras fallan en silencio y el pipeline no se entera.
// ─────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

/** Quién disparó la generación IA. Goal C: "fallback-60s" (el cliente abandonaba
 *  el polling a los 60s y regeneraba en paralelo con la background viva) murió;
 *  lo reemplaza "rescate", que corre SOLO cuando ai-status declara la generación
 *  background muerta (error registrado o >6 min sin prosa). */
export type GeneracionTrigger =
  | "background"    // waitUntil del POST /api/analisis
  | "rescate"       // regeneración tras dictamen server de generación muerta
  | "manual"        // botón "Reintentar" del usuario
  | "stale-regen"   // prosa persistida con promptVersion vieja (lazy-on-open)
  | "post-pago"     // payments/confirm (camino locked)
  | "on-open"       // generación on-demand al abrir la página (STR/AMBAS/insights)
  | "precalentado"  // cron que refresca prosa stale tras un bump de PROMPT_VERSION
  | "backfill-script"; // lote manual desde scripts/ (regenerate-ai-analysis, regen-prosa-hallazgo)

export type GeneracionTipo = "ltr" | "str" | "ambas" | "zone-insight" | "guest-insight";

export interface LlamadaTiming {
  /** principal · micro-check-zona · catch-root-a · catch-voz · plan-c ·
   *  quality-try-N · budget-retry · planc-budget */
  rol: string;
  modelo: string;
  ms: number;
  input_tokens?: number;
  output_tokens?: number;
  /** Retry quirúrgico (goal retry por campo, 05-sep-2026): qué guard lo pidió y sobre
   *  qué campos. Ausente en la llamada principal y en las llamadas viejas. */
  guard?: string;
  campos?: string[];
}

/** Bloque `submit` de pipeline_timing: fases del request de creación. */
export interface SubmitTiming {
  recibido_at: string;
  ruta: "analisis" | "short-term" | "locked-ltr" | "locked-str" | "locked-both";
  auth_ms?: number;
  uf_ms?: number;
  cobro_ms?: number;
  mediana_ms?: number;
  airroi_ms?: number;
  airroi_cache?: "hit" | "miss";
  motor_ms?: number;
  insert_ms?: number;
  total_ms?: number;
}

/** Guard del titular (goal #8 · 07-sep-2026): qué pasó cuando `validarTitular`
 *  rechazó el titular de la generación principal. Ausente cuando validó a la
 *  primera. Antes solo se logueaba el conteo; el texto descartado no quedaba en
 *  ningún lado y el A9 del golden fallaba sin que se pudiera leer por qué. */
export interface TitularTiming {
  /** Titular que vino en el JSON principal, tal cual. */
  original: string;
  /** Motivo de `validarTitular` sobre el original. */
  motivo: string;
  palabras: number;
  /** Texto del retry dirigido del titular, o null si la API falló. */
  reescrito: string | null;
  /** Motivo de `validarTitular` sobre el reescrito; null si validó o no hubo. */
  reescrito_motivo: string | null;
  /** Con qué quedó la portada: reescrito (≤15 válido o 16-20 largo) · escalón
   *  (el original en 16-20, normalizado) · motor (titular determinista de
   *  titular-final.ts). Nunca null: la portada siempre lleva titular. */
  fallback: "reescrito" | "escalon" | "motor";
  /** Titular que quedó en la portada. */
  final: string;
}

/** Una entrada del array `generaciones` de pipeline_timing. */
export interface GeneracionTiming {
  tipo: GeneracionTipo;
  trigger: GeneracionTrigger;
  inicio_at: string;
  fin_at: string;
  total_ms: number;
  resultado: "ok" | "error";
  prompt_version?: number;
  /** Trabajo previo al primer messages.create (SELECT fila, mediana, recompute). */
  prep_ms?: number;
  llamadas: LlamadaTiming[];
  titular?: TitularTiming;
}

/**
 * Fecha de la prosa que el usuario está leyendo: `fin_at` de la última
 * generación EXITOSA del tipo pedido.
 *
 * El pie del informe dice "Análisis generado por IA · <fecha>" y hasta el
 * 17-ago-2026 mostraba `created_at` — la fecha en que se creó la FILA, no en que
 * se generó la prosa. Con la invalidación lazy-on-open (bump de PROMPT_VERSION)
 * las dos fechas divergen: medido sobre el parque, 31 de 168 filas
 * instrumentadas tienen la prosa generada más de 24 h después de crearse, y el
 * pie mentía en todas.
 *
 * Devuelve null cuando no hay dato (filas anteriores a la instrumentación de
 * `pipeline_timing`, o sin generación exitosa registrada): el caller cae a
 * `created_at`, que para esas filas es la mejor aproximación disponible — se
 * generaban al crearse.
 */
export function fechaProsaVigente(
  pipelineTiming: unknown,
  tipo: GeneracionTipo,
): string | null {
  const gens = (pipelineTiming as { generaciones?: unknown } | null)?.generaciones;
  if (!Array.isArray(gens)) return null;
  let ultima: string | null = null;
  for (const g of gens as GeneracionTiming[]) {
    if (g?.tipo !== tipo || g?.resultado !== "ok" || typeof g?.fin_at !== "string") continue;
    // El array se apendea en orden, pero no se asume: gana el fin_at mayor.
    if (ultima === null || g.fin_at > ultima) ultima = g.fin_at;
  }
  return ultima;
}

// La RPC puede no existir todavía (ventana deploy→migración) o fallar por RLS
// en un contexto imprevisto: cualquiera de los dos casos se loguea y se sigue.
async function llamarRpc(
  db: SupabaseClient,
  analysisId: string,
  params: { p_submit?: SubmitTiming; p_generacion?: GeneracionTiming },
): Promise<void> {
  try {
    const { error } = await db.rpc("registrar_pipeline_timing", {
      p_analysis_id: analysisId,
      ...params,
    });
    if (error) console.warn(`[PIPELINE-TIMING] rpc falló (${analysisId}): ${error.message}`);
  } catch (e) {
    console.warn(`[PIPELINE-TIMING] rpc excepción (${analysisId}): ${(e as Error)?.message ?? e}`);
  }
}

export async function persistSubmitTiming(
  db: SupabaseClient,
  analysisId: string,
  submit: SubmitTiming,
): Promise<void> {
  await llamarRpc(db, analysisId, { p_submit: submit });
}

export async function persistGeneracionTiming(
  db: SupabaseClient,
  analysisId: string,
  gen: GeneracionTiming,
): Promise<void> {
  await llamarRpc(db, analysisId, { p_generacion: gen });
}
