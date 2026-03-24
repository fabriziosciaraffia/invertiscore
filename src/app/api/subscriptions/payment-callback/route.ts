import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";

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

    if (flowData.status === 1 && userId) {
      // Payment successful — keep subscription active
      await supabase
        .from("user_credits")
        .update({ subscription_status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      // Record payment
      await supabase.from("payments").insert({
        user_id: userId,
        commerce_order: `franco-sub-pay-${flowData.flowOrder || Date.now()}`,
        product: "subscription",
        amount: flowData.amount || 19990,
        status: "paid",
        flow_order: flowData.flowOrder,
        flow_status: flowData.status,
        payment_data: flowData,
      });
    } else if (flowData.status === 2 && userId) {
      // Payment rejected
      await supabase
        .from("user_credits")
        .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Subscription payment callback error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
