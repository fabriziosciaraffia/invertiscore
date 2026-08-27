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
  | "precalentado"; // cron que refresca prosa stale tras un bump de PROMPT_VERSION

export type GeneracionTipo = "ltr" | "str" | "ambas" | "zone-insight" | "guest-insight";

export interface LlamadaTiming {
  /** principal · micro-check-zona · catch-root-a · catch-voz · plan-c ·
   *  quality-try-N · budget-retry · planc-budget */
  rol: string;
  modelo: string;
  ms: number;
  input_tokens?: number;
  output_tokens?: number;
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

interface ConUsage {
  usage?: { input_tokens?: number | null; output_tokens?: number | null };
}

/** Colector de llamadas LLM de UNA generación. Se pasa por las capas que hacen
 *  messages.create y el caller persiste el total al final. */
export interface RegistroLlamadas {
  llamadas: LlamadaTiming[];
  /** Cronometra una llamada que devuelve `usage` (messages.create). Si la
   *  llamada lanza, la entrada queda registrada igual (sin tokens) y el error
   *  se propaga intacto — los catch existentes del pipeline no cambian. */
  medir<T extends ConUsage>(rol: string, modelo: string, fn: () => Promise<T>): Promise<T>;
  /** Ídem para llamadas cuyo retorno no expone usage (micro-check haiku, cuyo
   *  costo se decide no sumar — ver la nota de tarifas en ai-generation.ts). */
  medirSinTokens<T>(rol: string, modelo: string, fn: () => Promise<T>): Promise<T>;
}

export function nuevoRegistroLlamadas(): RegistroLlamadas {
  const llamadas: LlamadaTiming[] = [];
  return {
    llamadas,
    async medir(rol, modelo, fn) {
      const t = Date.now();
      try {
        const res = await fn();
        llamadas.push({
          rol,
          modelo,
          ms: Date.now() - t,
          ...(typeof res.usage?.input_tokens === "number" ? { input_tokens: res.usage.input_tokens } : {}),
          ...(typeof res.usage?.output_tokens === "number" ? { output_tokens: res.usage.output_tokens } : {}),
        });
        return res;
      } catch (e) {
        llamadas.push({ rol, modelo, ms: Date.now() - t });
        throw e;
      }
    },
    async medirSinTokens(rol, modelo, fn) {
      const t = Date.now();
      try {
        return await fn();
      } finally {
        llamadas.push({ rol, modelo, ms: Date.now() - t });
      }
    },
  };
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
