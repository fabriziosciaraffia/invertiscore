import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron · Expiración del período de gracia de suscripciones en past_due.
 *
 * Cuando un cargo recurrente falla, payment-callback marca subscription_status
 * 'past_due' + grace_ends_at = now + 7 días (el usuario mantiene acceso durante
 * la gracia, ver access.hasSubscriptionAccess). Si la gracia vence sin un cargo
 * exitoso, este cron corta el acceso: pasa a 'cancelled' y APAGA is_unlimited
 * (clave: si no se apaga, un ilimitado vencido seguiría con free pass).
 *
 * Idempotente: tras 'cancelled' la fila ya no matchea el filtro past_due.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/expire-grace] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Subs en mora cuya gracia ya venció.
  const { data: rows, error } = await supabase
    .from("user_credits")
    .select("user_id")
    .eq("subscription_status", "past_due")
    .not("grace_ends_at", "is", null)
    .lte("grace_ends_at", nowIso);

  if (error) {
    console.error("[cron/expire-grace] query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let processed = 0;
  let cancelled = 0;

  for (const row of rows ?? []) {
    try {
      processed++;
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          subscription_status: "cancelled",
          is_unlimited: false,
          grace_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);

      if (updErr) {
        console.error(
          "[cron/expire-grace] update falló para user:",
          row.user_id,
          updErr
        );
        continue;
      }
      cancelled++;
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/expire-grace] error procesando user:",
        row?.user_id,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.error(`[cron/expire-grace] processed=${processed} cancelled=${cancelled}`);
  return NextResponse.json({ processed, cancelled });
}
