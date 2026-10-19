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
import { esPuerta, fusionarPuerta, type Puerta } from "@/lib/atribucion-puerta";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import type { AtribucionInput } from "@/lib/attribution-claves";

// Las claves y el tipo viven en attribution-claves.ts, sin imports de servidor (19-oct-2026): el cliente los importa de
// ahí y no arrastra posthog-servidor (crypto) al navegador. Acá se reexportan para el servidor.
export { UTM_STORAGE_KEY, ATTRIBUTION_SYNCED_KEY, UTM_KEYS, type UtmKey, type AtribucionInput } from "@/lib/attribution-claves";

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
    puerta: esPuerta(r.puerta) ? r.puerta : null,
    puerta_detalle: esPuerta(r.puerta) ? limpiar(r.puerta_detalle)?.slice(0, 60) ?? null : null,
  };
}

/** ¿Hay al menos un dato que valga la pena escribir? */
export function tieneAlgo(a: AtribucionInput): boolean {
  return Object.values(a).some((v) => v != null && v !== "");
}

/** Pagado u orgánico según los UTM (las campañas de Meta llegan con `utm_medium=paid` y la fuente ig/fb/an/th). */
export function canalDeUtm(a: { utm_source?: string | null; utm_medium?: string | null }): "pagado" | "organico" {
  return a.utm_medium === "paid" || ["ig", "fb", "an", "th", "facebook", "instagram"].includes((a.utm_source ?? "").toLowerCase()) ? "pagado" : "organico";
}

async function puertaGuardada(sb: SupabaseClient, userId: string): Promise<Puerta | null> {
  try {
    const { data } = await sb.from("user_attribution").select("puerta").eq("user_id", userId).maybeSingle();
    const p = (data as { puerta?: unknown } | null)?.puerta;
    return esPuerta(p) ? p : null;
  } catch {
    return null;
  }
}

/**
 * La puerta quedó fijada (15-oct-2026): PostHog la sabe como propiedad de la persona (`puerta`, `campana`, `canal`)
 * para cortar las cohortes, y la PRIMERA vez queda el evento `cuenta_atribuida` —la semana de registro del panel
 * «Activación por semana»—, con uuid determinista: una cuenta, un evento.
 */
async function avisarPuerta(sb: SupabaseClient, userId: string, antes: Puerta | null): Promise<void> {
  try {
    const { data } = await sb.from("user_attribution").select("puerta, puerta_detalle, utm_source, utm_medium, utm_campaign").eq("user_id", userId).maybeSingle();
    const f = data as { puerta: Puerta | null; puerta_detalle: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } | null;
    if (!f?.puerta) return;
    const props = { puerta: f.puerta, campana: f.utm_campaign ?? "(sin campaña)", canal: canalDeUtm(f) };
    await capturarServidor({
      event: antes ? "$set" : "cuenta_atribuida",
      distinctId: userId,
      ...(antes ? {} : { uuid: uuidDeterminista(`cuenta_atribuida-${userId}`) }),
      properties: { ...props, puerta_detalle: f.puerta_detalle, utm_source: f.utm_source, utm_medium: f.utm_medium, $set: props },
    });
  } catch (e) {
    console.error("[guardarAtribucion] aviso a PostHog:", e);
  }
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
    // La puerta de antes, para saber si esta escritura la fija (y avisar a PostHog una vez).
    const antes = datos.puerta ? await puertaGuardada(sb, userId) : null;
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
      p_puerta: datos.puerta ?? null,
      p_puerta_detalle: datos.puerta_detalle ?? null,
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
    if (datos.puerta && fusionarPuerta(antes, datos.puerta) !== antes) await avisarPuerta(sb, userId, antes);
    return true;
  } catch (e) {
    console.error("[guardarAtribucion] excepción:", e);
    return false;
  }
}

/**
 * LA PUERTA C DEL REFERIDO (16-oct-2026, referido.ts): la cuenta nueva que entró con una invitación queda con la puerta
 * C y el código (`invitacion:CÓDIGO`), aunque otra puerta haya llegado antes —el reclamo del banner (A) o /deptos (B)
 * corren en el mismo registro—. Es la única escritura que pisa una puerta: la RPC `fijar_puerta_referido` no mira lo que
 * había. PostHog se entera igual que con las otras (`cuenta_atribuida` la primera vez, `$set` si ya había una), y el
 * panel lee la última. Nunca lanza.
 */
export async function fijarPuertaReferido(sb: SupabaseClient, userId: string, detalle: string): Promise<boolean> {
  try {
    const antes = await puertaGuardada(sb, userId);
    const { error } = await sb.rpc("fijar_puerta_referido", { p_user_id: userId, p_detalle: detalle.slice(0, 60) });
    if (error) {
      console.error("[fijarPuertaReferido] rpc error:", error);
      return false;
    }
    await avisarPuerta(sb, userId, antes);
    return true;
  } catch (e) {
    console.error("[fijarPuertaReferido] excepción:", e);
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
