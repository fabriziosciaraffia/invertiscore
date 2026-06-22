import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCheckoutRecoveryEmail } from "@/lib/email";
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";

/**
 * Cron · Recuperación de carrito abandonado (ruta A · single · + ruta B · planes).
 *
 * payments/create (single) y subscriptions/create (planes, ruta B) insertan una
 * fila status='pending' al iniciar el checkout. Si el usuario abandona, Flow
 * nunca finaliza y la fila queda en 'pending'. Este cron busca esas filas con
 * created_at > 6h, sin email de recuperación previo, manda el email (copy
 * ramificado single vs plan) y marca recovery_email_sent_at para no reenviar.
 *
 * Cubre todas las keys del catálogo (single + 6 planes). Exclusiones: quienes ya
 * compraron un 'single' pagado, y quienes tienen subscription_status='active'
 * (red de seguridad ruta B: al activar, register-callback flipea su pending a paid).
 *
 * Idempotente: recovery_email_sent_at IS NULL en el filtro + se setea al enviar.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Umbral de abandono: una 'pending' más vieja que esto se considera abandonada
// (no "está pagando ahora"). 6 horas.
const ABANDON_THRESHOLD_MS = 6 * 60 * 60 * 1000;

// Productos recuperables: el single (ruta A) + los planes de suscripción
// (ruta B, pending dejado por subscriptions/create). Todas las keys del catálogo.
const RECOVERABLE_PRODUCTS = Object.keys(FLOW_PRODUCTS) as FlowProductKey[];

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/abandoned-checkout] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoffIso = new Date(Date.now() - ABANDON_THRESHOLD_MS).toISOString();

  // Candidatos: compras únicas iniciadas y no pagadas, viejas, sin email previo.
  const { data: candidates, error } = await supabase
    .from("payments")
    .select("id, user_id, product, created_at")
    .eq("status", "pending")
    .in("product", RECOVERABLE_PRODUCTS)
    .lte("created_at", cutoffIso)
    .is("recovery_email_sent_at", null);

  if (error) {
    console.error("[cron/abandoned-checkout] query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Excluir usuarios que YA compraron un 'single' (en otra orden ya pagada): no
  // se les recupera. commerce_order es único, así que un pago del MISMO intento
  // ya no matchea status='pending'; esto cubre el caso de un 2º intento pagado.
  const userIds = Array.from(new Set((candidates ?? []).map((c) => c.user_id)));
  let paidUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: paidRows, error: paidErr } = await supabase
      .from("payments")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "paid")
      .eq("product", "single");
    if (paidErr) {
      console.error("[cron/abandoned-checkout] paid lookup error:", paidErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    paidUserIds = new Set((paidRows ?? []).map((r) => r.user_id));
  }

  // Red de seguridad (ruta B): excluir users con suscripción activa. Al activar,
  // register-callback flipea el pending a 'paid' (ya no sería candidato), pero si
  // por timing/fallo quedó un pending vivo no queremos nagear a quien ya suscribió.
  let activeSubUserIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: activeRows, error: activeErr } = await supabase
      .from("user_credits")
      .select("user_id")
      .in("user_id", userIds)
      .eq("subscription_status", "active");
    if (activeErr) {
      console.error("[cron/abandoned-checkout] active-sub lookup error:", activeErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    activeSubUserIds = new Set((activeRows ?? []).map((r) => r.user_id));
  }

  const toRecover = (candidates ?? []).filter(
    (c) => !paidUserIds.has(c.user_id) && !activeSubUserIds.has(c.user_id),
  );

  let processed = 0;
  let sent = 0;

  for (const row of toRecover) {
    try {
      processed++;

      const { data: userData } = await supabase.auth.admin.getUserById(row.user_id);
      const u = userData?.user;
      if (!u?.email) {
        console.error(
          "[cron/abandoned-checkout] sin email para user:",
          row.user_id
        );
        continue;
      }

      const name =
        u.user_metadata?.nombre || u.user_metadata?.full_name || null;
      const productKey = row.product as FlowProductKey;
      const productLabel =
        FLOW_PRODUCTS[productKey]?.subject ?? "tu análisis";
      // Tipo de checkout abandonado: 'single' (análisis suelto) vs plan
      // (suscripción) → ramifica el copy del email. Derivado del kind del catálogo.
      const productKind = FLOW_PRODUCTS[productKey]?.kind === "recurring" ? "plan" : "single";

      // Marcamos recovery_email_sent_at SOLO si Resend confirmó el envío. Si
      // falló (o Resend no está configurado), dejamos la fila sin marcar para
      // reintentar en la próxima corrida (no se pierde la recuperación).
      const ok = await sendCheckoutRecoveryEmail(u.email, name, productLabel, productKind);
      if (!ok) {
        console.error(
          "[cron/abandoned-checkout] envío falló, se reintentará; payment:",
          row.id
        );
        continue;
      }

      const { error: updErr } = await supabase
        .from("payments")
        .update({ recovery_email_sent_at: new Date().toISOString() })
        .eq("id", row.id);

      if (updErr) {
        console.error(
          "[cron/abandoned-checkout] update recovery_email_sent_at falló para payment:",
          row.id,
          updErr
        );
        continue;
      }
      sent++;
    } catch (e) {
      // Un error en una fila no aborta el resto.
      console.error(
        "[cron/abandoned-checkout] error procesando payment:",
        row?.id,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.error(`[cron/abandoned-checkout] processed=${processed} sent=${sent}`);
  return NextResponse.json({ processed, sent });
}
