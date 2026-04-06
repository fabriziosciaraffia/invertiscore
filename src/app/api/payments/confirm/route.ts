import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowGet } from "@/lib/flow";
import { sendPaymentConfirmationEmail } from "@/lib/email";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    // Flow sends token as form-urlencoded
    const formData = await request.formData();
    const token = formData.get("token") as string;

    if (!token) {
      console.error("Payment confirm: token missing");
      return NextResponse.json({ error: "Token missing" }, { status: 400 });
    }

    // Get payment status from Flow (GET endpoint)
    const flowData = await flowGet("payment/getStatus", { token });
    // Flow status logged without sensitive data


    const supabase = createAdminClient();

    // Map Flow status to our status
    // Flow API: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
    const statusMap: Record<number, string> = {
      1: "pending",
      2: "paid",
      3: "rejected",
      4: "cancelled",
    };
    const newStatus = statusMap[flowData.status] || "pending";

    // Update payment record
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        flow_status: flowData.status,
        flow_order: flowData.flowOrder,
        payment_data: flowData,
        updated_at: new Date().toISOString(),
      })
      .eq("commerce_order", flowData.commerceOrder);

    if (updateError) {
      console.error("Payment update error:", updateError);
    }

    // If paid (Flow status 2), process credits
    if (flowData.status === 2) {
      const { data: payment, error: selectError } = await supabase
        .from("payments")
        .select("user_id, product, analysis_id")
        .eq("commerce_order", flowData.commerceOrder)
        .single();

      if (selectError || !payment) {
        console.error("Payment select error:", selectError);
        return NextResponse.json({ status: "ok" });
      }

      const { user_id: userId, product, analysis_id: analysisId } = payment;

      if (userId && product) {
        const creditsToAdd = product === "pack3" ? 3 : 1;

        // Upsert user_credits
        const { data: existing } = await supabase
          .from("user_credits")
          .select("credits")
          .eq("user_id", userId)
          .single();

        const currentCredits = existing?.credits ?? 0;
        let newCredits = currentCredits + creditsToAdd;

        // If pro and has analysisId, consume one credit for this analysis
        if (product === "pro" && analysisId) {
          newCredits = newCredits - 1;

          const { error: premiumError } = await supabase
            .from("analisis")
            .update({ is_premium: true })
            .eq("id", analysisId);

          if (premiumError) {
            console.error("Premium update error:", premiumError);
          }
        }

        // Upsert credits in a single operation
        if (existing) {
          const { error: creditError } = await supabase
            .from("user_credits")
            .update({
              credits: newCredits,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (creditError) {
            console.error("Credit update error:", creditError);
          }
        } else {
          const { error: creditError } = await supabase
            .from("user_credits")
            .insert({
              user_id: userId,
              credits: newCredits,
            });

          if (creditError) {
            console.error("Credit insert error:", creditError);
          }
        }
      }

      // Send payment confirmation email
      if (userId) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (userData?.user?.email) {
            const amount = flowData.amount || 0;
            await sendPaymentConfirmationEmail(
              userData.user.email,
              userData.user.user_metadata?.nombre || userData.user.user_metadata?.full_name || '',
              product,
              amount,
              analysisId || undefined
            );
          }
        } catch (e) {
          console.error("Payment email error:", e);
        }
      }
    }

    // Flow expects 200
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Payment confirm error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
