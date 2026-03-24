import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost, flowGet } from "@/lib/flow";

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

    // Create subscription
    const subData = await flowPost("subscription/create", {
      planId: "FrancoMensual",
      customerId,
    });

    if (!subData.subscriptionId) {
      console.error("Subscription create error:", subData);
      return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
    }

    // Find user by customerId
    const { data: userCredit } = await supabase
      .from("user_credits")
      .select("user_id")
      .eq("flow_customer_id", customerId)
      .single();

    if (userCredit) {
      await supabase
        .from("user_credits")
        .update({
          subscription_status: "active",
          subscription_id: subData.subscriptionId,
          subscription_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userCredit.user_id);

      // Record as payment
      await supabase.from("payments").insert({
        user_id: userCredit.user_id,
        commerce_order: `franco-sub-${subData.subscriptionId}`,
        product: "subscription",
        amount: 19990,
        status: "paid",
        payment_data: subData,
      });
    }

    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
  } catch (err) {
    console.error("Register callback error:", err);
    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
  }
}
