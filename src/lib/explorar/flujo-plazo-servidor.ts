// ─────────────────────────────────────────────────────────────────────────────
// EL FLUJO DE LA TARJETA AL PLAZO DEL PERFIL (tercera vuelta de la asesoría, decisión de Fabrizio del 27-nov-2026). La tarjeta del mapa
// decía «Te sobran $90.917» a 30 años y el perfil, para el mismo depto, «Te deja $11.664» a los 15 años de la persona. Con perfil, la
// tarjeta usa SU plazo y lo dice; sin perfil, queda a 30 años y también lo dice. El plazo sale SIEMPRE de inv_perfiles de la cuenta
// (nunca del navegador), y el flujo de cada plazo de avisos_evaluados (la misma sonda de la noche que usa la asesoría).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

export const COLUMNA_FLUJO_PLAZO: Record<number, string> = { 30: "flujo_20", 25: "flujo_20_25", 20: "flujo_20_20", 15: "flujo_20_15" };
/** Hasta cuántos avisos por pedido (la tarjeta pide los de su carrusel). */
export const MAX_FLUJOS_POR_PEDIDO = 40;

/** El plazo del perfil de la cuenta (null sin perfil o sin plazo guardado). */
export async function plazoDelPerfil(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { data } = await admin.from("inv_perfiles").select("plazo_anios").eq("user_id", userId).maybeSingle();
  const p = data?.plazo_anios == null ? null : Number(data.plazo_anios);
  return p != null && COLUMNA_FLUJO_PLAZO[p] ? p : null;
}

/** Los flujos de estos avisos a ese plazo. */
export async function flujosAPlazo(admin: SupabaseClient, ids: string[], plazo: number): Promise<Record<string, number | null>> {
  const col = COLUMNA_FLUJO_PLAZO[plazo];
  if (!col || !ids.length) return {};
  const { data, error } = await admin.from("avisos_evaluados").select(`aviso_id, ${col}`).in("aviso_id", ids.slice(0, MAX_FLUJOS_POR_PEDIDO));
  if (error) throw new Error(`flujos a ${plazo} años: ${error.message}`);
  return Object.fromEntries(((data ?? []) as unknown as Array<Record<string, unknown>>).map((x) => [String(x.aviso_id), x[col] == null ? null : Math.round(Number(x[col]))]));
}
