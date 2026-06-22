import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { recurringProductByAmount, recurringProductByPlan, addOneMonth } from "@/lib/credits-grant";
import { sendPaymentFailedEmail } from "@/lib/email";
import { processSubscriptionCharge } from "@/lib/subscriptions/process-charge";

// commerceOrder de un cargo de suscripción: "sus_<subId>_<invoiceId>_<ts>".
// Capturamos el prefijo sus_<subId> para mapear contra user_credits.subscription_id.
const SUB_ID_RE = /^(sus_[a-zA-Z0-9]+)_/;

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get("token") as string;

    if (!token) {
      return NextResponse.json({ status: "error" }, { status: 200 });
    }

    const flowData = await flowPost("payment/getStatus", { token });
    const supabase = createAdminClient();

    // Resolver el dueño de la suscripción. PRIMARIO (fix): parsear sus_<subId> del
    // commerceOrder de Flow → user_credits.subscription_id. Los cargos recurrentes
    // NO traen nuestro optional.userId ni un commerceOrder que matchee payments, así
    // que sin esto userId quedaba null y el cargo se descartaba en silencio.
    // Fallbacks legacy: optional.userId y commerceOrder en payments.
    let userId: string | null = null;

    const subMatch = SUB_ID_RE.exec(flowData.commerceOrder || "");
    if (subMatch) {
      const { data } = await supabase
        .from("user_credits")
        .select("user_id")
        .eq("subscription_id", subMatch[1])
        .maybeSingle();
      userId = data?.user_id ?? null;
    }

    if (!userId) {
      try {
        const optional = JSON.parse(flowData.optional || "{}");
        userId = optional.userId ?? null;
      } catch { /* ignore */ }
    }

    if (!userId && flowData.commerceOrder) {
      const { data } = await supabase
        .from("payments")
        .select("user_id")
        .eq("commerce_order", flowData.commerceOrder)
        .maybeSingle();
      userId = data?.user_id || null;
    }

    // Enum Flow: 1=pendiente, 2=pagada, 3=rechazada, 4=anulada.
    // Flow devuelve `status` como STRING → comparar con Number() (no === directo).
    const flowStatus = Number(flowData.status);
    if (flowStatus === 2 && userId) {
      // Cargo recurrente OK → mantener suscripción activa. Si venía de past_due
      // (recuperación dentro de la gracia), limpiar grace_ends_at. Idempotente.
      await supabase
        .from("user_credits")
        .update({
          subscription_status: "active",
          grace_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Fila franco-sub-pay-<flowOrder> + grant (idempotente por payment_id, gateado
      // por el cutoff de C) + boleta DTE 39: todo en el helper compartido (el mismo
      // que usará el cron reconciler). chargeDate ← requestDate es CRÍTICO: sin él el
      // fail-safe del cutoff suspende el grant. El helper NUNCA lanza y deduplica solo
      // (commerce_order UNIQUE + grant por payment_id + boleta por payment_id), así
      // que un reenvío del mismo cobro es no-op seguro.
      const result = await processSubscriptionCharge({
        flowOrder: Number(flowData.flowOrder),
        commerceOrder: flowData.commerceOrder,
        amount: Number(flowData.amount),
        status: flowStatus,
        payer: flowData.payer,
        chargeDate: flowData.requestDate,
        flowData,
      });
      console.error(
        "[payment-callback] processSubscriptionCharge →",
        JSON.stringify(result)
      );

      // Re-armar el lote mensual de planes ANUALES finitos SOLO ante un cargo FRESCO
      // (result.granted = se insertó un lote nuevo en este llamado). En un reenvío del
      // webhook (granted=false) NO re-armamos, para no empujar next_monthly_grant_at
      // repetidamente. El cron monthly-grants otorga los meses 2-12 desde esta fecha.
      // (Antes esto vivía tras el INSERT-first; ahora el helper hace el INSERT y la
      // idempotencia del grant, y result.granted refleja "cargo fresco".)
      if (result.granted) {
        const { data: uc } = await supabase
          .from("user_credits")
          .select("active_plan, billing_period")
          .eq("user_id", userId)
          .maybeSingle();
        const match =
          recurringProductByPlan(uc?.active_plan, uc?.billing_period) ??
          recurringProductByAmount(Number(flowData.amount));
        if (
          match &&
          match.product.billing === "annual" &&
          match.product.isUnlimited !== true
        ) {
          const now = new Date();
          await supabase
            .from("user_credits")
            .update({
              next_monthly_grant_at: addOneMonth(now).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);
        }
      }
    } else if ((flowStatus === 3 || flowStatus === 4) && userId) {
      // Cargo rechazado (3) o anulado (4) → suscripción en mora con 7 días de
      // gracia (mantiene acceso hasta grace_ends_at; el cron expire-grace corta
      // al vencer). Avisamos por email.
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await supabase
        .from("user_credits")
        .update({
          subscription_status: "past_due",
          grace_ends_at: graceEndsAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Email de aviso. Un fallo de Resend NO debe romper el callback.
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const flowUser = userData?.user;
        if (flowUser?.email) {
          const nombre =
            flowUser.user_metadata?.nombre ||
            flowUser.user_metadata?.full_name ||
            null;
          await sendPaymentFailedEmail(flowUser.email, nombre, graceEndsAt);
        }
      } catch (e) {
        console.error("[subscriptions/payment-callback] aviso past_due email error:", e);
      }
    }
    // status 1 = pendiente → no cambia subscription_status

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Subscription payment callback error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
