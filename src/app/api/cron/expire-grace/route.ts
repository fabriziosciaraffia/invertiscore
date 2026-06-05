import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron · Expiración de accesos de suscripción vencidos. Dos barridos:
 *
 * 1. past_due con gracia vencida. payment-callback marca 'past_due' + grace_ends_at
 *    = now + 7 días (acceso durante la gracia, ver access.hasSubscriptionAccess).
 *    Si la gracia vence sin cargo exitoso, pasa a 'cancelled' y APAGA is_unlimited.
 *
 * 2. cancelled con el ciclo pagado vencido que AÚN tiene is_unlimited=true.
 *    cancel-subscription deja 'cancelled' + subscription_ends_at = fin de ciclo
 *    (acceso hasta esa fecha). Para planes finitos el corte es pasivo por fecha en
 *    hasSubscriptionAccess; pero is_unlimited se evalúa independiente de la fecha,
 *    así que sin este barrido un ilimitado cancelado mantendría free pass para
 *    siempre. Solo apaga el flag (el status ya es cancelled).
 *
 * Idempotente: tras el update las filas ya no matchean su filtro.
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

  // Dos queries separadas (no un OR): cada caso tiene filtro distinto Y update
  // distinto (past_due → cancela; cancelled → solo apaga el flag). Separarlas
  // es más legible y evita ramificar el payload por fila dentro de un loop mixto.

  // ── 1 · past_due con gracia vencida ──
  const { data: pastDueRows, error: pdError } = await supabase
    .from("user_credits")
    .select("user_id")
    .eq("subscription_status", "past_due")
    .not("grace_ends_at", "is", null)
    .lte("grace_ends_at", nowIso);

  if (pdError) {
    console.error("[cron/expire-grace] past_due query error:", pdError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // ── 2 · cancelled con ciclo vencido que aún tiene free pass (is_unlimited) ──
  const { data: cancelledRows, error: cError } = await supabase
    .from("user_credits")
    .select("user_id")
    .eq("subscription_status", "cancelled")
    .eq("is_unlimited", true)
    .not("subscription_ends_at", "is", null)
    .lte("subscription_ends_at", nowIso);

  if (cError) {
    console.error("[cron/expire-grace] cancelled query error:", cError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let processed = 0;
  let cancelled = 0;
  let unlimitedRevoked = 0;

  // past_due vencido → cancelled + apaga is_unlimited + limpia grace.
  for (const row of pastDueRows ?? []) {
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
        console.error("[cron/expire-grace] past_due update falló para user:", row.user_id, updErr);
        continue;
      }
      cancelled++;
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/expire-grace] error procesando past_due user:",
        row?.user_id,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // cancelled vencido con free pass → apaga is_unlimited (status ya es cancelled)
  // + limpia next_monthly_grant_at. El acceso normal ya cayó por fecha.
  for (const row of cancelledRows ?? []) {
    try {
      processed++;
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          is_unlimited: false,
          next_monthly_grant_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);

      if (updErr) {
        console.error("[cron/expire-grace] cancelled update falló para user:", row.user_id, updErr);
        continue;
      }
      unlimitedRevoked++;
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/expire-grace] error procesando cancelled user:",
        row?.user_id,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.error(
    `[cron/expire-grace] processed=${processed} cancelled=${cancelled} unlimitedRevoked=${unlimitedRevoked}`
  );
  return NextResponse.json({ processed, cancelled, unlimitedRevoked });
}
