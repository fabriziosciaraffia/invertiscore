import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiError } from "@/lib/observabilidad";
import { respuestaCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";

const RUTA = "GET /api/cron/expire-grace";

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
 * ILIMITADO MANUAL (user_credits.unlimited_source = 'manual', toggle de /admin):
 * NINGUNO de los dos barridos lo apaga. Sin esto, encender el toggle sobre un
 * ex-suscriptor —el caso más típico para dar cortesía— se revertía solo a la
 * mañana siguiente y sin más rastro que un contador en los logs. El barrido 1
 * igual cierra el ciclo de la suscripción (cancelled + limpia gracia): lo único
 * que respeta es el flag.
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
  // Latido ANTES del trabajo: registra "corrió", no "terminó bien". Ver la
  // doctrina completa en cron-heartbeat.ts.
  await latirCron(supabase, "expire-grace");

  const nowIso = new Date().toISOString();

  // Dos queries separadas (no un OR): cada caso tiene filtro distinto Y update
  // distinto (past_due → cancela; cancelled → solo apaga el flag). Separarlas
  // es más legible y evita ramificar el payload por fila dentro de un loop mixto.

  // ── 1 · past_due con gracia vencida ──
  // Trae unlimited_source para decidir por fila si toca el flag: el ilimitado
  // MANUAL (toggle de /admin) no se apaga acá — ver el comentario del loop.
  const { data: pastDueRows, error: pdError } = await supabase
    .from("user_credits")
    .select("user_id, unlimited_source")
    .eq("subscription_status", "past_due")
    .not("grace_ends_at", "is", null)
    .lte("grace_ends_at", nowIso);

  if (pdError) {
    console.error("[cron/expire-grace] past_due query error:", pdError);
    captureApiError(pdError, { ruta: RUTA, operacion: "query-past-due" });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // ── 2 · cancelled con ciclo vencido que aún tiene free pass (is_unlimited) ──
  // Este barrido existe SOLO para apagar el flag, así que el ilimitado manual se
  // excluye de raíz.
  //
  // El filtro va como .or(is null, neq manual) y NO como .neq("manual") a secas:
  // en SQL `unlimited_source <> 'manual'` es NULL —no true— cuando la columna es
  // NULL, así que un .neq pelado también se comería las filas sin procedencia.
  const { data: cancelledRows, error: cError } = await supabase
    .from("user_credits")
    .select("user_id")
    .eq("subscription_status", "cancelled")
    .eq("is_unlimited", true)
    .or("unlimited_source.is.null,unlimited_source.neq.manual")
    .not("subscription_ends_at", "is", null)
    .lte("subscription_ends_at", nowIso);

  if (cError) {
    console.error("[cron/expire-grace] cancelled query error:", cError);
    captureApiError(cError, { ruta: RUTA, operacion: "query-cancelled" });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let processed = 0;
  let cancelled = 0;
  let unlimitedRevoked = 0;
  // Una fila que no se actualiza deja plata sobre la mesa en las dos
  // direcciones: un past_due con gracia vencida sigue con acceso gratis, y un
  // ilimitado cancelado conserva el free pass. Antes solo iba a console.error.
  let fallidos = 0;

  // past_due vencido → cancelled + apaga is_unlimited + limpia grace.
  //
  // El ilimitado MANUAL se respeta, pero la fila NO se saltea entera: este
  // barrido hace DOS cosas independientes —cerrar el ciclo de vida de la
  // suscripción (cancelled + limpiar gracia) y apagar el free pass— y solo la
  // segunda es una decisión de admin. Excluir la fila completa dejaría la
  // suscripción colgada en past_due para siempre. Por eso el payload se arma por
  // fila en vez de filtrar en la query.
  for (const row of pastDueRows ?? []) {
    try {
      processed++;
      const esManual = row.unlimited_source === "manual";
      const { error: updErr } = await supabase
        .from("user_credits")
        .update({
          subscription_status: "cancelled",
          grace_ends_at: null,
          // Solo si el ilimitado NO lo puso un admin a mano.
          ...(esManual ? {} : { is_unlimited: false, unlimited_source: null }),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);

      if (updErr) {
        console.error("[cron/expire-grace] past_due update falló para user:", row.user_id, updErr);
        fallidos++;
        captureApiError(updErr, {
          ruta: RUTA,
          operacion: "cerrar-past-due",
          userId: row.user_id,
          tags: { consecuencia: "acceso-vencido-sigue-activo", ilimitado_manual: String(esManual) },
        });
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
      fallidos++;
      captureApiError(e, { ruta: RUTA, operacion: "procesar-past-due", userId: row?.user_id });
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
          unlimited_source: null,
          next_monthly_grant_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);

      if (updErr) {
        console.error("[cron/expire-grace] cancelled update falló para user:", row.user_id, updErr);
        fallidos++;
        captureApiError(updErr, {
          ruta: RUTA,
          operacion: "revocar-ilimitado",
          userId: row.user_id,
          tags: { consecuencia: "free-pass-sobrevive-cancelacion" },
        });
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
      fallidos++;
      captureApiError(e, { ruta: RUTA, operacion: "procesar-cancelled", userId: row?.user_id });
    }
  }

  console.error(
    `[cron/expire-grace] processed=${processed} cancelled=${cancelled} unlimitedRevoked=${unlimitedRevoked} fallidos=${fallidos}`
  );
  return respuestaCron(
    { procesados: processed, exitosos: processed - fallidos, fallidos },
    { cancelled, unlimitedRevoked },
  );
}
