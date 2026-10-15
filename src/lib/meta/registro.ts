/**
 * CompleteRegistration (15-oct-2026, medición para la campaña): la persona VALIDÓ EL CÓDIGO —tiene sesión— y CONTESTÓ
 * «¿Cuándo piensas comprar?». La respuesta va como dato (`cuando`: ya, meses, mirando), para que la campaña se pueda
 * optimizar hacia quienes compran pronto. Sale una vez por cuenta (`reg-<id>`, la marca de meta_eventos), en
 * cualquiera de los lugares donde se contesta: «Estás dentro» del informe, el dashboard, la página semanal.
 *
 * Solo para cuentas creadas en los últimos 30 días: quien se registró antes y contesta hoy no es un registro de la
 * campaña. Hasta el 15-oct salía en /auth/callback (Google y el enlace antes de 10 min), y las altas por código —el
 * camino principal desde el 01-oct— no lo mandaban nunca.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENTOS_META, idRegistro } from "@/lib/meta/ids";
import { emitirEventoMeta, type ContextoMeta, type EmisionMeta } from "@/lib/meta/servidor";

export const VENTANA_REGISTRO_MS = 30 * 24 * 60 * 60 * 1000;

/** ¿La cuenta es de un alta reciente? */
export function esAltaReciente(createdAt: string | null | undefined, ahoraMs: number): boolean {
  if (!createdAt) return false;
  const edad = ahoraMs - new Date(createdAt).getTime();
  return edad >= 0 && edad <= VENTANA_REGISTRO_MS;
}

export async function emitirRegistroCompletado(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; created_at?: string | null },
  cuando: string,
  contexto: ContextoMeta,
): Promise<EmisionMeta | null> {
  if (!esAltaReciente(user.created_at, Date.now())) return null;
  return emitirEventoMeta(admin, {
    evento: EVENTOS_META.registro,
    eventId: idRegistro(user.id),
    userId: user.id,
    email: user.email ?? null,
    datos: { cuando, status: "completo" },
    contexto,
    origen: "cuando",
  });
}
