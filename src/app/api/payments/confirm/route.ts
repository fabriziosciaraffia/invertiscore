import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
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

      // Admin alert: successful payment
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email || "desconocido";
        const amount = flowData.amount || 0;
        const productLabel = product === "pro" ? "Análisis Pro" : product === "pack3" ? "Pack x3" : product === "subscription" ? "Suscripción Mensual" : product;
        const amountFormatted = "$" + Math.round(amount).toLocaleString("es-CL");
        const now = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const analysisLink = analysisId ? `<div style="padding:8px 0;"><span style="color:#71717A;font-size:13px;">Análisis</span><a href="https://refranco.ai/analisis/${analysisId}" style="color:#C8323C;font-size:14px;float:right;text-decoration:none;">Ver análisis →</a></div>` : "";

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Franco <hola@refranco.ai>",
          to: "hola@refranco.ai",
          subject: `💰 Nuevo pago: ${productLabel} — ${amountFormatted}`,
          html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#151515;border-radius:16px;border:1px solid #222;padding:40px 32px;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#B4B2A9;margin:0 0 24px 0;">
        Nuevo pago confirmado
      </h1>
      <div style="background:#1A1A1A;border-radius:12px;padding:20px 24px;margin:0 0 16px 0;">
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Producto</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-weight:600;">${productLabel}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Monto</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${amountFormatted}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Email</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${userEmail}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Fecha</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${now}</span>
        </div>
        <div style="padding:8px 0;${analysisLink ? "border-bottom:1px solid #2A2A2A;" : ""}">
          <span style="color:#71717A;font-size:13px;">Order ID</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${flowData.commerceOrder}</span>
        </div>
        ${analysisLink}
      </div>
    </div>
  </div>
</body>
</html>`,
        });
      } catch (emailError) {
        console.error("Failed to send admin payment alert:", emailError);
      }
    }

    // Handle rejected/failed payments — admin alert
    if (flowData.status === 3 || flowData.status === 4) {
      try {
        const { data: payment } = await supabase
          .from("payments")
          .select("user_id, product, analysis_id")
          .eq("commerce_order", flowData.commerceOrder)
          .single();

        const statusLabel = flowData.status === 3 ? "Rechazado" : "Anulado";
        const product = payment?.product || "desconocido";
        const productLabel = product === "pro" ? "Análisis Pro" : product === "pack3" ? "Pack x3" : product === "subscription" ? "Suscripción Mensual" : product;
        const amount = flowData.amount || 0;
        const amountFormatted = "$" + Math.round(amount).toLocaleString("es-CL");
        const now = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

        let userEmail = "desconocido";
        if (payment?.user_id) {
          const { data: userData } = await supabase.auth.admin.getUserById(payment.user_id);
          userEmail = userData?.user?.email || "desconocido";
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Franco <hola@refranco.ai>",
          to: "hola@refranco.ai",
          subject: `⚠️ Pago fallido: ${productLabel} — ${amountFormatted}`,
          html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#151515;border-radius:16px;border:1px solid #222;padding:40px 32px;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#C8323C;margin:0 0 24px 0;">
        Pago fallido
      </h1>
      <div style="background:#1A1A1A;border-radius:12px;padding:20px 24px;margin:0 0 16px 0;">
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Estado</span>
          <span style="color:#C8323C;font-size:14px;float:right;font-weight:600;">${statusLabel}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Producto</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${productLabel}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Monto</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${amountFormatted}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Email</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${userEmail}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #2A2A2A;">
          <span style="color:#71717A;font-size:13px;">Fecha</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;">${now}</span>
        </div>
        <div style="padding:8px 0;">
          <span style="color:#71717A;font-size:13px;">Order ID</span>
          <span style="color:#FAFAF8;font-size:14px;float:right;font-family:'Courier New',monospace;">${flowData.commerceOrder}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
        });
      } catch (emailError) {
        console.error("Failed to send admin payment failure alert:", emailError);
      }
    }

    // Flow expects 200
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Payment confirm error:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
