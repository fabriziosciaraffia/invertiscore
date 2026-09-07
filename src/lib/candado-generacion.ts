// ─────────────────────────────────────────────────────────────────────────────
// CANDADO DE REGENERACIÓN DE PROSA (goal #3 · 07-sep-2026)
//
// Una generación de prosa por fila a la vez, ENTRE instancias. Hasta este goal el
// candado eran tres `Map` en memoria (rutas LTR, STR y AMBAS): colapsaban
// aperturas concurrentes dentro de una instancia serverless y nada más — el
// waitUntil del submit, el webhook de Flow y el cron precalentar-prosa no
// pasaban por ningún candado, y dos instancias no se veían. Medido en
// pipeline_timing: 20 pares del mismo tipo con inicio a <120 s, 4 con doble prosa
// pagada (background+fallback, background+manual, precalentado+precalentado).
//
// Ahora el candado vive en la base: `analisis.generating_since` +
// `analisis.generating_kind` (migración 20260907_candado_generacion.sql). La toma
// es UN UPDATE atómico, sin transacción larga:
//
//   UPDATE analisis SET generating_since = $ahora, generating_kind = $kind
//   WHERE id = $id AND (generating_since IS NULL OR generating_since < $ahora - 10 min)
//   RETURNING id
//
// Cero filas ⇒ otro proceso lo tiene. TTL 10 min: un proceso muerto a mitad
// (maxDuration 300 s) libera solo. La liberación exige la marca exacta que se
// escribió: un proceso que sobrevivió al TTL no suelta el candado de quien lo tomó
// después.
//
// ENFORCEMENT: este es el único módulo que escribe `generating_since` /
// `generating_kind` — el catch-test scripts/eval/golden/candado-catch-test.ts
// grepea src/ y falla si aparece fuera de acá. Va con service-role: la política
// UPDATE de `analisis` es auth.uid() = user_id y el candado lo toman también el
// waitUntil anónimo, el cron y el webhook de Flow, que no tienen sesión (mismo
// patrón que T2.1 y createAnonPipelineClient). Server-only.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CandadoKind = "ltr" | "str" | "ambas";

/** Minutos tras los cuales un candado se considera de un proceso muerto. */
export const CANDADO_TTL_MIN = 10;

/** Token del candado tomado. `since` es la marca exacta escrita: `soltarCandado`
 *  la exige para no soltar el candado de OTRO proceso. `sinCandado` = el UPDATE
 *  falló (p. ej. columna aún sin migrar) y se generó sin candado, como antes. */
export interface CandadoToken {
  id: string;
  kind: CandadoKind;
  since: string;
  sinCandado?: boolean;
}

/** Superficie mínima de PostgREST que usa el helper; el catch-test la stubea. */
export type CandadoDb = Pick<SupabaseClient, "from">;

let serviceDb: SupabaseClient | null = null;
function candadoDb(): CandadoDb {
  if (!serviceDb) {
    serviceDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceDb;
}

/**
 * Intenta tomar el candado de una fila. Devuelve el token si lo tomó; null si otro
 * proceso lo tiene y su marca aún no venció. Nunca lanza: si el UPDATE falla, avisa
 * y devuelve un token `sinCandado` (fail-open: generar sin candado es lo de antes;
 * un informe mudo por un candado roto sería peor).
 */
export async function tomarCandado(
  analysisId: string,
  kind: CandadoKind,
  db: CandadoDb = candadoDb(),
  ahora: Date = new Date(),
): Promise<CandadoToken | null> {
  const since = ahora.toISOString();
  const vence = new Date(ahora.getTime() - CANDADO_TTL_MIN * 60_000).toISOString();
  try {
    const { data, error } = await db
      .from("analisis")
      .update({ generating_since: since, generating_kind: kind })
      .eq("id", analysisId)
      .or(`generating_since.is.null,generating_since.lt.${vence}`)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return { id: analysisId, kind, since };
  } catch (e) {
    console.warn(`[CANDADO] ${analysisId}: no se pudo tomar (${(e as Error)?.message ?? e}) — se genera sin candado`);
    return { id: analysisId, kind, since, sinCandado: true };
  }
}

/** Suelta el candado SOLO si la marca sigue siendo la nuestra. Nunca lanza. */
export async function soltarCandado(token: CandadoToken, db: CandadoDb = candadoDb()): Promise<void> {
  if (token.sinCandado) return;
  try {
    const { error } = await db
      .from("analisis")
      .update({ generating_since: null, generating_kind: null })
      .eq("id", token.id)
      .eq("generating_since", token.since);
    if (error) throw error;
  } catch (e) {
    console.warn(`[CANDADO] ${token.id}: no se pudo soltar (${(e as Error)?.message ?? e}) — vence solo a los ${CANDADO_TTL_MIN} min`);
  }
}

export type ResultadoConCandado<T> = { tomado: false } | { tomado: true; resultado: T };

/**
 * Toma el candado, corre `fn` y lo suelta en `finally` (también si `fn` lanza).
 * `{ tomado: false }` cuando otro proceso lo tiene: la ruta responde 409
 * `{ generando: true }`, el waitUntil/cron saltan la fila.
 */
export async function conCandado<T>(
  analysisId: string,
  kind: CandadoKind,
  fn: () => Promise<T>,
  db: CandadoDb = candadoDb(),
): Promise<ResultadoConCandado<T>> {
  const token = await tomarCandado(analysisId, kind, db);
  if (!token) return { tomado: false };
  try {
    return { tomado: true, resultado: await fn() };
  } finally {
    await soltarCandado(token, db);
  }
}

/** Respuesta estándar de las rutas cuando el candado está tomado. */
export const RESPUESTA_GENERANDO = { generando: true } as const;
export const STATUS_GENERANDO = 409;
