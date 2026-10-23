/**
 * CompleteRegistration (15-oct-2026, medición para la campaña; rehecho el 22-oct-2026, decisión de Fabrizio).
 *
 * Hasta el 22-oct-2026 salía solo cuando la persona contestaba «¿Cuándo piensas comprar?», y como casi nadie la contesta,
 * NO SALÍA NUNCA (desde el 16-oct: 7 cuentas reales, 1 con el evento). Ahora:
 *   · CompleteRegistration sale AL CREAR LA CUENTA, por cualquier puerta —/deptos y la página del invitado (el alta), el
 *     informe anónimo reclamado, Google y el enlace del correo (el callback)—, con la puerta y, si ya lo contestó, el
 *     «cuándo» como propiedad. Una vez por cuenta (`reg-<id>`). Las rutas que guardan el «cuándo» también lo intentan:
 *     si la cuenta nació sin él, sale ahí (idempotente).
 *   · Cuando contesta el «cuándo» después, un evento propio: IntencionCompra (`ic-<id>-<respuesta>`), con la respuesta y
 *     la puerta, para que la campaña se pueda optimizar hacia quienes compran pronto.
 * Servidor y pixel deduplicados: los dos salen por `emitirEventoMeta` y el pixel repite el espejo con el mismo id.
 *
 * Solo para cuentas creadas en los últimos 30 días: quien se registró antes no es un registro de la campaña.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENTOS_META, idIntencion, idRegistro } from "@/lib/meta/ids";
import { emitirEventoMeta, type ContextoMeta, type EmisionMeta } from "@/lib/meta/servidor";

export const VENTANA_REGISTRO_MS = 30 * 24 * 60 * 60 * 1000;

/** ¿La cuenta es de un alta reciente? */
export function esAltaReciente(createdAt: string | null | undefined, ahoraMs: number): boolean {
  if (!createdAt) return false;
  const edad = ahoraMs - new Date(createdAt).getTime();
  return edad >= 0 && edad <= VENTANA_REGISTRO_MS;
}

/** Lo que lleva el registro: la puerta y el «cuándo», solo si existen. SIN «cuándo» SALE IGUAL. */
export function datosRegistro(p: { puerta: string | null | undefined; cuando: string | null | undefined }): Record<string, string> {
  return { status: "completo", ...(p.puerta ? { puerta: p.puerta } : {}), ...(p.cuando ? { cuando: p.cuando } : {}) };
}

/** Lo que lleva la intención: la respuesta y la puerta, si existe. */
export function datosIntencion(p: { puerta: string | null | undefined; cuando: string }): Record<string, string> {
  return { cuando: p.cuando, ...(p.puerta ? { puerta: p.puerta } : {}) };
}

type UsuarioRegistro = { id: string; email?: string | null; created_at?: string | null };

/** La puerta por la que entró (atribución) y el «cuándo» que contestó (perfil de búsqueda), si existen. Nunca lanza. */
export async function puertaYCuando(admin: SupabaseClient, userId: string): Promise<{ puerta: string | null; cuando: string | null }> {
  try {
    const [{ data: atr }, { data: perfil }] = await Promise.all([
      admin.from("user_attribution").select("puerta").eq("user_id", userId).maybeSingle(),
      admin.from("perfil_busqueda").select("horizonte_compra").eq("user_id", userId).maybeSingle(),
    ]);
    return { puerta: (atr?.puerta as string | null) ?? null, cuando: (perfil?.horizonte_compra as string | null) ?? null };
  } catch {
    return { puerta: null, cuando: null };
  }
}

/**
 * CompleteRegistration al crear la cuenta (o la primera vez que el servidor la ve con sesión por una ruta que la conoce).
 * `eventTime` (segundos unix) solo para el relleno de las cuentas que nacieron sin el evento: Meta acepta hasta 7 días.
 */
export async function emitirRegistroAlCrear(
  admin: SupabaseClient,
  user: UsuarioRegistro,
  contexto: ContextoMeta | null,
  /** `puerta`: la que el alta ya sabe (la atribución se escribe aparte y puede no estar todavía). */
  opts: { eventTime?: number; origen?: string; puerta?: string | null } = {},
): Promise<EmisionMeta | null> {
  if (!esAltaReciente(user.created_at, Date.now())) return null;
  const leido = await puertaYCuando(admin, user.id);
  const puerta = opts.puerta ?? leido.puerta;
  return emitirEventoMeta(admin, {
    evento: EVENTOS_META.registro,
    eventId: idRegistro(user.id),
    userId: user.id,
    email: user.email ?? null,
    datos: datosRegistro({ puerta, cuando: leido.cuando }),
    contexto,
    origen: opts.origen ?? "alta",
    ...(opts.eventTime ? { eventTime: opts.eventTime } : {}),
  });
}

/** IntencionCompra: contestó (o cambió) «¿Cuándo piensas comprar?», con sesión. */
export async function emitirIntencionCompra(admin: SupabaseClient, user: UsuarioRegistro, cuando: string, contexto: ContextoMeta | null): Promise<EmisionMeta | null> {
  if (!esAltaReciente(user.created_at, Date.now())) return null;
  const { puerta } = await puertaYCuando(admin, user.id);
  return emitirEventoMeta(admin, {
    evento: EVENTOS_META.intencion,
    eventId: idIntencion(user.id, cuando),
    userId: user.id,
    email: user.email ?? null,
    datos: datosIntencion({ puerta, cuando }),
    contexto,
    origen: "cuando",
  });
}
