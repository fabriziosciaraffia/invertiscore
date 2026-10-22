// ─────────────────────────────────────────────────────────────────────────────
// EL TICKET DE LA CUENTA NUEVA, leído en el servidor (21-oct-2026; reglas en lib/guia/compra-desde-depto.ts). Lo que el
// navegador no puede saber: si la cuenta ya pagó el pack y si un informe es el primero de la cuenta. Lo usan el informe
// (leerOfertaPack), el pop-up sin saldo de la selección (el precio del pack) y payments/create (la vigencia del pack).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { ticketDeCuenta } from "@/lib/guia/compra-desde-depto";
import { PRODUCTO_PACK } from "./oferta-pack";

const RUTA = "lib/lo-que-sigue/ticket-cuenta-servidor";

/** ¿La cuenta ya pagó un pack de $14.990? El ticket es uno por cuenta. */
export async function packPagadoPorCuenta(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { count, error } = await admin.from("payments").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("product", PRODUCTO_PACK).eq("status", "paid");
  reportarFalloQuery(error, { ruta: RUTA, operacion: "pack-pagado", userId });
  return (count ?? 0) > 0;
}

/** ¿El pack va al precio del ticket para esta cuenta? Menos de 24 horas y sin el pack pagado. */
export async function ticketDeCuentaDisponible(admin: SupabaseClient, user: { id: string; created_at?: string | null }): Promise<boolean> {
  if (!ticketDeCuenta(user.created_at)) return false;
  return !(await packPagadoPorCuenta(admin, user.id));
}

/** ¿Es el primer informe de la cuenta? Ninguno anterior, sin contar las filas bloqueadas (pendientes de pago) ni la otra
 *  mitad de su par de renta larga y corta. */
export async function esPrimerInforme(admin: SupabaseClient, p: { userId: string; informeId: string; creadoAt: string; ambasGroupId?: string | null }): Promise<boolean> {
  let q = admin.from("analisis").select("id", { count: "exact", head: true })
    .eq("user_id", p.userId).neq("id", p.informeId).lt("created_at", p.creadoAt).not("pending_payment", "is", true);
  // NULL en un filtro de exclusión (CLAUDE.md): «todo lo que no sea este par, incluidos los sin par».
  if (p.ambasGroupId) q = q.or(`ambas_group_id.is.null,ambas_group_id.neq.${p.ambasGroupId}`);
  const { count, error } = await q;
  reportarFalloQuery(error, { ruta: RUTA, operacion: "primer-informe", userId: p.userId });
  return !error && (count ?? 0) === 0;
}
