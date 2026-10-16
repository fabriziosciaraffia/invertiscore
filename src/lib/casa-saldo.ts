// ─────────────────────────────────────────────────────────────────────────────
// El saldo de la casa (02-oct-2026): lo primero del dashboard es cuántos análisis le quedan. Cuatro
// estados, decididos acá (puro) y leídos de la base en `leerSaldo`:
//   · plan     — el plan Ilimitado: analizar no descuenta. SOLO el Ilimitado (14-oct-2026, decisión de Fabrizio):
//                el plan 10 y el plan 50 descuentan de sus lotes (access.ts › chargeAnalysisCredit), así que se ven
//                como cualquiera, «con N» o «sin». Hasta acá toda suscripción vigente era «plan», y la pantalla le
//                decía a un plan 10 «no descuenta de tu saldo» mientras el cobro le descontaba;
//   · regalo   — lo único que tiene es un análisis de regalo: el de registrarse (regalo-alta.ts, 16-oct-2026), el de
//                reactivación del semanal o el viejo de los 14 días;
//   · con      — le quedan N (y si todos son sin caducidad, «No vencen.»);
//   · sin      — no le quedan: el análisis suelto, o un plan. Nunca el pack (ese vive en el ticket).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSubscriptionAccess } from "@/lib/access";
import { FUENTES_REGALO } from "@/lib/regalo-alta";

export interface DatosSaldo {
  disponibles: number;
  /** El plan Ilimitado: analizar no descuenta. */
  plan: boolean;
  /** Cualquier suscripción vigente (o el Ilimitado): para el regalo del semanal, que no le corresponde a quien ya paga un plan. */
  suscripcion: boolean;
  regaloRestante: number;
  /** Cuándo vence el regalo (el lote más próximo), si queda. */
  regaloVence: string | null;
  todoSinCaducidad: boolean;
  /** El próximo que se gasta es un regalo (el FIFO del cobro: el lote que vence primero, los sin caducidad al final). */
  proximoRegalo?: boolean;
}

export type EstadoSaldo =
  | { tipo: "plan" }
  | { tipo: "regalo"; vence: string | null }
  | { tipo: "con"; n: number; noVencen: boolean; proximoRegalo?: boolean }
  | { tipo: "sin" };

export function estadoSaldo(d: DatosSaldo): EstadoSaldo {
  if (d.plan) return { tipo: "plan" };
  if (d.disponibles <= 0) return { tipo: "sin" };
  if (d.regaloRestante > 0 && d.disponibles === d.regaloRestante) return { tipo: "regalo", vence: d.regaloVence };
  return { tipo: "con", n: d.disponibles, noVencen: d.todoSinCaducidad, proximoRegalo: d.proximoRegalo };
}

/** Lo de `user_credits` que decide el saldo. */
type FilaCreditos = { credits?: number | null; is_unlimited?: boolean | null; subscription_status?: string | null; grace_ends_at?: string | null; subscription_ends_at?: string | null };

/** Puro: el saldo desde los lotes vivos y la fila de créditos. «plan» SOLO con el Ilimitado (ver la cabecera). */
export function datosSaldoDe(vivos: Array<{ remaining: number; expires_at: string | null; source: string | null }>, uc: FilaCreditos | null): DatosSaldo {
  const ledger = vivos.reduce((a, g) => a + (g.remaining ?? 0), 0);
  const legacy = Math.max(0, Number(uc?.credits) || 0);
  const ilimitado = uc?.is_unlimited === true;
  const regalos = vivos.filter((g) => g.source != null && FUENTES_REGALO.has(g.source));
  // El orden del cobro (credits-grant.ts › consumeCredit): por vencimiento, los que no vencen al final.
  const primero = [...vivos].sort((a, b) => (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"))[0];
  return {
    disponibles: ledger + legacy,
    plan: ilimitado,
    suscripcion: ilimitado || (!!uc && hasSubscriptionAccess(uc as never)),
    regaloRestante: regalos.reduce((a, g) => a + g.remaining, 0),
    regaloVence: regalos.filter((g) => g.expires_at).map((g) => g.expires_at as string).sort()[0] ?? null,
    todoSinCaducidad: vivos.length > 0 ? vivos.every((g) => g.expires_at == null) : legacy > 0,
    proximoRegalo: !!primero?.source && FUENTES_REGALO.has(primero.source),
  };
}

export async function leerSaldo(admin: SupabaseClient, userId: string): Promise<DatosSaldo> {
  const ahora = new Date().toISOString();
  const [{ data: grants }, { data: uc }] = await Promise.all([
    admin.from("credit_grants").select("remaining, expires_at, source").eq("user_id", userId).gt("remaining", 0).or(`expires_at.is.null,expires_at.gt.${ahora}`),
    admin.from("user_credits").select("credits, is_unlimited, subscription_status, grace_ends_at, subscription_ends_at").eq("user_id", userId).maybeSingle(),
  ]);
  return datosSaldoDe((grants ?? []) as Array<{ remaining: number; expires_at: string | null; source: string | null }>, (uc ?? null) as FilaCreditos | null);
}
