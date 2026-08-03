/**
 * Atribución de origen del usuario (de qué campaña vino).
 *
 * Modelo FIRST-TOUCH: la primera atribución gana. Quien lo garantiza es la RPC
 * `upsert_user_attribution` (ver docs/sql/user-attribution.sql), que solo
 * rellena columnas en NULL — no la aplicación. Así da lo mismo el orden en que
 * lleguen los dos escritores, y reintentar nunca pisa nada.
 *
 * Los dos escritores, porque ninguno tiene el dato completo:
 *   1. /auth/callback (server) — tiene las cookies _fbp/_fbc del pixel, pero NO
 *      los UTM: viven en localStorage y no viajan en el request.
 *   2. POST /api/attribution (cliente ya logueado) — tiene los UTM, el referrer
 *      y el landing path, pero llega unos ms después.
 *
 * Si la tabla todavía no existe en la base, todo esto es no-op silencioso: se
 * loguea y se sigue. Nunca puede romper un login.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Clave de localStorage que ya usa useUTMCapture. NO cambiar sin migrar. */
export const UTM_STORAGE_KEY = "franco_utm";

/** Marca de "ya sincronicé la atribución de este usuario" (evita POST por visita). */
export const ATTRIBUTION_SYNCED_KEY = "franco_attr_sync";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface AtribucionInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface AtribucionRow extends AtribucionInput {
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

/** Tope de largo por campo. Un UTM legítimo no pasa de un par de decenas de chars;
 *  el resto es basura o intento de meter cosas raras en la base. */
const MAX_LARGO = 500;

function limpiar(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, MAX_LARGO);
}

/** Normaliza y acota lo que venga de afuera (localStorage o body de request). */
export function sanearAtribucion(raw: Record<string, unknown> | null | undefined): AtribucionInput {
  const r = raw ?? {};
  return {
    utm_source: limpiar(r.utm_source),
    utm_medium: limpiar(r.utm_medium),
    utm_campaign: limpiar(r.utm_campaign),
    utm_content: limpiar(r.utm_content),
    utm_term: limpiar(r.utm_term),
    referrer: limpiar(r.referrer),
    landing_path: limpiar(r.landing_path),
    fbp: limpiar(r.fbp),
    fbc: limpiar(r.fbc),
  };
}

/** ¿Hay al menos un dato que valga la pena escribir? */
export function tieneAlgo(a: AtribucionInput): boolean {
  return Object.values(a).some((v) => v != null && v !== "");
}

/**
 * Escribe (o completa) la atribución del usuario. Idempotente y first-touch: la
 * RPC solo rellena lo que está en NULL.
 *
 * NUNCA lanza. Un fallo acá jamás puede tumbar un login ni un registro: si la
 * tabla no existe o la RPC falla, se loguea y la vida sigue — perder una
 * atribución es molesto, perder el alta de un usuario es grave.
 *
 * @param sb client con service_role (la RPC tiene grant solo a ese rol).
 */
export async function guardarAtribucion(
  sb: SupabaseClient,
  userId: string,
  datos: AtribucionInput
): Promise<boolean> {
  if (!userId || !tieneAlgo(datos)) return false;

  try {
    const { error } = await sb.rpc("upsert_user_attribution", {
      p_user_id: userId,
      p_utm_source: datos.utm_source ?? null,
      p_utm_medium: datos.utm_medium ?? null,
      p_utm_campaign: datos.utm_campaign ?? null,
      p_utm_content: datos.utm_content ?? null,
      p_utm_term: datos.utm_term ?? null,
      p_referrer: datos.referrer ?? null,
      p_landing_path: datos.landing_path ?? null,
      p_fbp: datos.fbp ?? null,
      p_fbc: datos.fbc ?? null,
    });

    if (error) {
      // Estado esperado mientras el SQL de docs/sql/user-attribution.sql no se
      // corrió → log informativo, no error. Los códigos de PostgREST (PGRST202
      // función no encontrada, PGRST205 tabla no encontrada) son los que llegan
      // en la práctica; los de Postgres van igual por si la request no pasa por
      // el schema cache. Verificado contra la base: hoy devuelve PGRST202.
      if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code)) {
        console.log("[guardarAtribucion] user_attribution todavía no existe en la base, skip");
      } else {
        console.error("[guardarAtribucion] rpc error:", error);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("[guardarAtribucion] excepción:", e);
    return false;
  }
}

/**
 * Lee la atribución de un usuario. Devuelve null si no hay fila o si la tabla no
 * existe todavía — el panel muestra "sin datos" en vez de romperse.
 */
export async function leerAtribucion(
  sb: SupabaseClient,
  userId: string
): Promise<AtribucionRow | null> {
  const { data, error } = await sb
    .from("user_attribution")
    .select("user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path, fbp, fbc, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Misma lógica que guardarAtribucion: tabla ausente = estado esperado, no error.
    if (!["PGRST205", "42P01"].includes(error.code)) {
      console.error("[leerAtribucion] query error:", error);
    }
    return null;
  }
  return (data as AtribucionRow | null) ?? null;
}

/**
 * Etiqueta legible de la fuente. El tráfico sin UTM se muestra como "Directo",
 * no se inventa un utm_source: la ausencia también es información.
 */
export function fmtFuente(a: AtribucionInput | null | undefined): string {
  if (!a) return "Sin datos";
  if (a.utm_source) {
    return a.utm_medium ? `${a.utm_source} · ${a.utm_medium}` : a.utm_source;
  }
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, "");
    } catch {
      return a.referrer;
    }
  }
  return "Directo";
}
