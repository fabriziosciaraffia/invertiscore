import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { applyPlanCredits, recurringProductByAmount } from "@/lib/credits-grant";

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

    // Find user by subscription
    let userId: string | null = null;
    try {
      const optional = JSON.parse(flowData.optional || "{}");
      userId = optional.userId;
    } catch { /* ignore */ }

    if (!userId && flowData.commerceOrder) {
      const { data } = await supabase
        .from("payments")
        .select("user_id")
        .eq("commerce_order", flowData.commerceOrder)
        .single();
      userId = data?.user_id || null;
    }

    // Enum Flow: 1=pendiente, 2=pagada, 3=rechazada, 4=anulada.
    // (Alineado con payments/confirm, que usa 2=pagado como referencia.)
    if (flowData.status === 2 && userId) {
      // Cargo recurrente OK → mantener suscripción activa
      await supabase
        .from("user_credits")
        .update({ subscription_status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      // Identificar el plan suscrito. payment/getStatus NO devuelve planId; el
      // único campo que identifica unívocamente el plan recurrente es `amount`
      // (los 6 montos de FLOW_PRODUCTS son distintos). Mapeo = amount → producto.
      const match = recurringProductByAmount(flowData.amount);
      const productKey = match?.key ?? "subscription";

      // Record payment (capturamos id para el FK del grant).
      const { data: paymentRow } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          commerce_order: `franco-sub-pay-${flowData.flowOrder || Date.now()}`,
          product: productKey,
          amount: flowData.amount || 19990,
          status: "paid",
          flow_order: flowData.flowOrder,
          flow_status: flowData.status,
          payment_data: flowData,
        })
        .select("id")
        .single();

      // Otorgar créditos del ciclo según el plan (o is_unlimited). Si no se pudo
      // identificar el plan por monto, NO otorgamos (evita grants erróneos) — la
      // suscripción queda activa pero el caso queda logueado para revisión.
      if (match) {
        await applyPlanCredits(userId, match.product, { paymentId: paymentRow?.id ?? null });
      } else {
        console.error(
          "[subscriptions/payment-callback] amount sin plan en FLOW_PRODUCTS:",
          flowData.amount
        );
      }
    } else if ((flowData.status === 3 || flowData.status === 4) && userId) {
      // Cargo rechazado (3) o anulado (4) → suscripción en mora
      await supabase
        .from("user_credits")
        .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    // status 1 = pendiente → no cambia subscription_status

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Subscription payment callback error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
