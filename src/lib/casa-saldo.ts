// ─────────────────────────────────────────────────────────────────────────────
// El saldo de la casa (02-oct-2026): lo primero del dashboard es cuántos análisis le quedan. Cuatro
// estados, decididos acá (puro) y leídos de la base en `leerSaldo`:
//   · plan     — suscripción vigente o ilimitado: analizar no descuenta;
//   · regalo   — lo único que tiene es el análisis que le regaló Franco (correo semanal, día 14);
//   · con      — le quedan N (y si todos son sin caducidad, «No vencen.»);
//   · sin      — no le quedan: el análisis suelto, o un plan. Nunca el pack (ese vive en el ticket).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSubscriptionAccess } from "@/lib/access";
import { FUENTE_REGALO_SEMANAL } from "@/lib/credits-grant";

export interface DatosSaldo {
  disponibles: number;
  plan: boolean;
  regaloRestante: number;
  /** Cuándo vence el regalo (el lote más próximo), si queda. */
  regaloVence: string | null;
  todoSinCaducidad: boolean;
}

export type EstadoSaldo =
  | { tipo: "plan" }
  | { tipo: "regalo"; vence: string | null }
  | { tipo: "con"; n: number; noVencen: boolean }
  | { tipo: "sin" };

export function estadoSaldo(d: DatosSaldo): EstadoSaldo {
  if (d.plan) return { tipo: "plan" };
  if (d.disponibles <= 0) return { tipo: "sin" };
  if (d.regaloRestante > 0 && d.disponibles === d.regaloRestante) return { tipo: "regalo", vence: d.regaloVence };
  return { tipo: "con", n: d.disponibles, noVencen: d.todoSinCaducidad };
}

export async function leerSaldo(admin: SupabaseClient, userId: string): Promise<DatosSaldo> {
  const ahora = new Date().toISOString();
  const [{ data: grants }, { data: uc }] = await Promise.all([
    admin.from("credit_grants").select("remaining, expires_at, source").eq("user_id", userId).gt("remaining", 0).or(`expires_at.is.null,expires_at.gt.${ahora}`),
    admin.from("user_credits").select("credits, is_unlimited, subscription_status, grace_ends_at, subscription_ends_at").eq("user_id", userId).maybeSingle(),
  ]);
  const vivos = (grants ?? []) as Array<{ remaining: number; expires_at: string | null; source: string | null }>;
  const ledger = vivos.reduce((a, g) => a + (g.remaining ?? 0), 0);
  const legacy = Math.max(0, Number((uc as { credits?: number } | null)?.credits) || 0);
  return {
    disponibles: ledger + legacy,
    plan: !!uc && ((uc as { is_unlimited?: boolean }).is_unlimited === true || hasSubscriptionAccess(uc as never)),
    regaloRestante: vivos.filter((g) => g.source === FUENTE_REGALO_SEMANAL).reduce((a, g) => a + g.remaining, 0),
    regaloVence: vivos.filter((g) => g.source === FUENTE_REGALO_SEMANAL && g.expires_at).map((g) => g.expires_at as string).sort()[0] ?? null,
    todoSinCaducidad: vivos.length > 0 ? vivos.every((g) => g.expires_at == null) : legacy > 0,
  };
}
