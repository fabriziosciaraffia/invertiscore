// ─────────────────────────────────────────────────────────────────────────────
// LOS PAGOS SIN ACREDITAR (04-nov-2026, auditoría de promesas parte 1): un pago único que Flow confirmó (`status = paid`)
// y que no tiene su lote en el ledger. No hace falta una tabla: es exactamente eso, y lo leen el panel del admin
// (/admin/operacion) y el reconciliador diario (cron/reconciliar-pagos), que lo vuelve a acreditar.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCTOS_CON_CREDITO, type PagoParaAcreditar } from "@/lib/pagos/acreditar-pago";

export type PagoSinAcreditar = PagoParaAcreditar & { created_at: string };

/** Los pagos únicos confirmados de los últimos `dias` días que no tienen lote. */
export async function pagosSinAcreditar(sb: SupabaseClient, dias: number, ahora: Date = new Date()): Promise<PagoSinAcreditar[]> {
  const desde = new Date(ahora.getTime() - dias * 864e5).toISOString();
  const { data: pagos, error } = await sb
    .from("payments")
    .select("id, user_id, product, amount, commerce_order, quantity, analysis_id, payment_data, created_at")
    .eq("status", "paid")
    .in("product", [...PRODUCTOS_CON_CREDITO])
    .not("user_id", "is", null)
    .gte("created_at", desde)
    .order("id")
    .range(0, 999);
  if (error) throw new Error(`pagos: ${error.message}`);
  const filas = (pagos ?? []) as PagoSinAcreditar[];
  const conLote = new Set<string>();
  // De a 100 ids: la lista va en la URL.
  for (let i = 0; i < filas.length; i += 100) {
    const ids = filas.slice(i, i + 100).map((p) => p.id);
    const { data: lotes, error: e2 } = await sb.from("credit_grants").select("payment_id").in("payment_id", ids);
    if (e2) throw new Error(`lotes: ${e2.message}`);
    for (const l of lotes ?? []) conLote.add(l.payment_id as string);
  }
  return filas.filter((p) => !conLote.has(p.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
