// ─────────────────────────────────────────────────────────────────────────────
// VER LOS DETALLES SIN GASTAR CRÉDITOS (Invierte con Franco, etapa 2, 18-nov-2026; decisión de Fabrizio). Quien firmó la orden
// y está dentro del interruptor ve todos los detalles de cualquier depto USADO en venta del mapa sin gastar un crédito: el
// análisis se crea con charge_mode = 'invierte' (CHECK de analisis, migración 20261119_invierte_v2_etapa2). Un análisis nuevo
// de un depto propio (el wizard) sigue gastando. Mientras el modo sea lista, esos detalles no mandan eventos a Meta.
// Medido: cada detalle abierto así es una fila de analisis con ese modo y un evento inv2_detalle_abierto desde el servidor;
// el admin dice cuántos abrió cada persona firmada (el riesgo de firmar solo para ver gratis).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { accesoInvierteV2 } from "./acceso-servidor";
import { deptoDelFlujo, ultimaOrdenDe } from "./servidor";

export const MODO_INVIERTE = "invierte" as const;
export const EVENTO_DETALLE_ABIERTO = "inv2_detalle_abierto";

export async function verGratisInvierte(admin: SupabaseClient, user: User, avisoId: string): Promise<boolean> {
  if (!(await accesoInvierteV2(user))) return false;
  const [orden, depto] = await Promise.all([ultimaOrdenDe(admin, user.id), deptoDelFlujo(admin, avisoId)]);
  return !!orden && !!depto;
}
