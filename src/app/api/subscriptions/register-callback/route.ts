import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost, flowGet } from "@/lib/flow";
import { recurringProductByPlan, applyPlanCredits, addOneMonth } from "@/lib/credits-grant";
import { resolvePlanId } from "@/lib/flow-products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

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
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    // Check card registration status. Flow devuelve `status` como STRING ("1"),
    // así que comparamos con Number() para no romper por tipo.
    const registerStatus = await flowGet("customer/getRegisterStatus", { token });

    if (Number(registerStatus.status) !== 1) {
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    const customerId = registerStatus.customerId;
    const supabase = createAdminClient();

    // Buscar al user + el plan persistido por subscriptions/create (fuente de
    // verdad, ya no el hardcode "FrancoMensual" del flujo viejo $19.990).
    const { data: userCredit } = await supabase
      .from("user_credits")
      .select("user_id, active_plan, billing_period, subscription_status")
      .eq("flow_customer_id", customerId)
      .single();

    // Idempotencia: si la suscripción YA está activa (Flow reintentó el callback,
    // o el user recargó /register-callback), no recrear la suscripción en Flow ni
    // re-otorgar el grant. Evita doble subscription/create y doble credit_grant.
    if (userCredit?.subscription_status === "active") {
      console.error(
        "[register-callback] suscripción ya activa, idempotente (sin doble grant):",
        customerId
      );
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
    }

    const match = recurringProductByPlan(
      userCredit?.active_plan,
      userCredit?.billing_period
    );

    if (!userCredit || !match?.product.planId) {
      console.error(
        "[register-callback] sin plan persistido o planId nulo para customer:",
        customerId
      );
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    // Create subscription con el planId real del producto elegido, resuelto
    // por entorno (base + FLOW_PLAN_SUFFIX). urlCallback derivado de SITE_URL.
    const subData = await flowPost("subscription/create", {
      planId: resolvePlanId(match.product.planId),
      customerId,
      urlCallback: `${SITE_URL}/api/subscriptions/payment-callback`,
    });

    if (!subData.subscriptionId) {
      console.error("Subscription create error:", subData);
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    // Record as payment (monto y producto reales del plan elegido). Capturamos
    // el id para el FK del grant.
    const { data: paymentRow } = await supabase
      .from("payments")
      .insert({
        user_id: userCredit.user_id,
        commerce_order: `franco-sub-${subData.subscriptionId}`,
        product: match.key,
        amount: match.product.amount,
        status: "paid",
        payment_data: subData,
      })
      .select("id")
      .single();

    // Otorgar el grant del ciclo (amount=capacity, expira en 1 año) o, para
    // unlimited, setear is_unlimited sin grant. applyPlanCredits también setea
    // active_plan/billing_period/subscription_ends_at, pero NO toca
    // subscription_status ni subscription_id (esos van en el UPDATE de abajo).
    await applyPlanCredits(userCredit.user_id, match.product, match.key, {
      paymentId: paymentRow?.id ?? null,
    });

    // Activar la suscripción (campos que applyPlanCredits no maneja).
    // next_monthly_grant_at: solo para ANUAL finito (no unlimited). El mes 1 lo
    // otorgó applyPlanCredits; esto marca cuándo toca el mes 2 = subscription_start
    // + 1 mes. Mensual recobra por cargo recurrente real (payment-callback) y
    // unlimited es free pass → en ambos queda null (el cron los ignora).
    const now = new Date();
    const isAnnualFinite =
      match.product.billing === "annual" && match.product.isUnlimited !== true;
    const nextMonthlyGrantAt = isAnnualFinite ? addOneMonth(now).toISOString() : null;

    await supabase
      .from("user_credits")
      .update({
        subscription_status: "active",
        subscription_id: subData.subscriptionId,
        subscription_start: now.toISOString(),
        next_monthly_grant_at: nextMonthlyGrantAt,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userCredit.user_id);

    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
  } catch (err) {
    console.error("Register callback error:", err);
    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
  }
}
