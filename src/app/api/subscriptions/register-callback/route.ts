import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost, flowGet } from "@/lib/flow";
import { recurringProductByPlan } from "@/lib/credits-grant";

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

    // Check card registration status
    const registerStatus = await flowGet("customer/getRegisterStatus", { token });

    if (registerStatus.status !== 1) {
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    const customerId = registerStatus.customerId;
    const supabase = createAdminClient();

    // Buscar al user + el plan persistido por subscriptions/create (fuente de
    // verdad, ya no el hardcode "FrancoMensual" del flujo viejo $19.990).
    const { data: userCredit } = await supabase
      .from("user_credits")
      .select("user_id, active_plan, billing_period")
      .eq("flow_customer_id", customerId)
      .single();

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

    // Create subscription con el planId real del producto elegido
    const subData = await flowPost("subscription/create", {
      planId: match.product.planId,
      customerId,
    });

    if (!subData.subscriptionId) {
      console.error("Subscription create error:", subData);
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    await supabase
      .from("user_credits")
      .update({
        subscription_status: "active",
        subscription_id: subData.subscriptionId,
        subscription_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userCredit.user_id);

    // Record as payment (monto y producto reales del plan elegido)
    await supabase.from("payments").insert({
      user_id: userCredit.user_id,
      commerce_order: `franco-sub-${subData.subscriptionId}`,
      product: match.key,
      amount: match.product.amount,
      status: "paid",
      payment_data: subData,
    });

    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
  } catch (err) {
    console.error("Register callback error:", err);
    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
  }
}
