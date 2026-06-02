import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  grantCredits,
  recurringProductByPlan,
  addOneMonth,
} from "@/lib/credits-grant";

/**
 * Cron 2.8 — Renovación MENSUAL de planes ANUALES.
 *
 * Los planes anuales cobran el año up-front pero otorgan capacity MENSUAL
 * (plan10=10/mes, plan50=50/mes, acumulable). register-callback otorga el mes 1
 * y setea user_credits.next_monthly_grant_at = subscription_start + 1 mes. Este
 * cron otorga los meses 2-12: por cada sub anual activa cuyo next_monthly_grant_at
 * ya venció, inserta el lote del/los mes(es) debidos y avanza la fecha +1 mes
 * (loop catch-up si el cron se saltó corridas), hasta subscription_ends_at.
 *
 * Idempotente: next_monthly_grant_at se avanza al otorgar, así que una 2da
 * corrida el mismo día ve next > now y no re-otorga.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Tope defensivo de lotes por fila en una sola corrida (un año = 12 meses; el
// inicial lo da register-callback). Evita un loop runaway ante datos corruptos.
const MAX_CATCHUP_MONTHS = 13;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/monthly-grants] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Subs anuales finitas activas con un lote mensual vencido.
  const { data: rows, error } = await supabase
    .from("user_credits")
    .select("user_id, active_plan, subscription_ends_at, next_monthly_grant_at")
    .eq("billing_period", "annual")
    .eq("subscription_status", "active")
    .eq("is_unlimited", false)
    .in("active_plan", ["plan10", "plan50"])
    .not("next_monthly_grant_at", "is", null)
    .lte("next_monthly_grant_at", nowIso);

  if (error) {
    console.error("[cron/monthly-grants] query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let processed = 0;
  let granted = 0;

  for (const row of rows ?? []) {
    try {
      processed++;

      // Resolver capacity + key del catálogo desde active_plan + 'annual'.
      const match = recurringProductByPlan(row.active_plan, "annual");
      const capacity = match?.product.capacity;
      if (!match || capacity == null) {
        console.error(
          "[cron/monthly-grants] sin producto/capacity para active_plan:",
          row.active_plan,
          "user:",
          row.user_id
        );
        continue;
      }
      const { key } = match;

      if (!row.subscription_ends_at) {
        console.error(
          "[cron/monthly-grants] subscription_ends_at nulo, se omite user:",
          row.user_id
        );
        continue;
      }
      const ends = new Date(row.subscription_ends_at);

      // Loop catch-up: otorga cada mes vencido aún dentro del ciclo anual.
      let next = new Date(row.next_monthly_grant_at as string);
      let iterations = 0;
      while (
        next.getTime() <= now.getTime() &&
        next.getTime() < ends.getTime() &&
        iterations < MAX_CATCHUP_MONTHS
      ) {
        const ok = await grantCredits(row.user_id, key, capacity, {});
        if (!ok) {
          console.error(
            "[cron/monthly-grants] grantCredits falló, corta el catch-up para user:",
            row.user_id
          );
          break;
        }
        granted++;
        next = addOneMonth(next);
        iterations++;
      }

      // Si ya alcanzó/superó el fin del ciclo anual, deja de otorgar (null) hasta
      // que la renovación (payment-callback) re-arme la fecha. Si no, persiste la
      // próxima fecha debida.
      const newNext = next.getTime() >= ends.getTime() ? null : next.toISOString();

      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          next_monthly_grant_at: newNext,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);

      if (updErr) {
        console.error(
          "[cron/monthly-grants] update next_monthly_grant_at falló para user:",
          row.user_id,
          updErr
        );
      }
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/monthly-grants] error procesando user:",
        row?.user_id,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.error(`[cron/monthly-grants] processed=${processed} granted=${granted}`);
  return NextResponse.json({ processed, granted });
}
