import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { flowGet } from "@/lib/flow";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";
import { grantCredits } from "@/lib/credits-grant";
import { consumeCredit } from "@/lib/access";
import { generateAiAnalysis } from "@/lib/ai-generation";
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";
import { emitirBoletaDTE } from "@/lib/openfactura/client";

// Label legible para los correos internos (admin). Usa el subject del catálogo
// real (single / plan10 / plan50 / unlimited) y cae a los nombres legacy o al
// product crudo si llega una key desconocida.
function adminProductLabel(product: string): string {
  return (
    FLOW_PRODUCTS[product as FlowProductKey]?.subject ??
    (product === "pro"
      ? "Análisis"
      : product === "pack3"
        ? "Pack x3"
        : product === "subscription"
          ? "Suscripción Mensual"
          : product)
  );
}

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

    // Flow devuelve `status` como STRING → comparar con Number() (no === directo).
    // statusMap arriba sí tolera string (keys de objeto se coercen); flow_status
    // se persiste crudo más abajo.
    const flowStatus = Number(flowData.status);

    // AMBAS pre-pago: el companion_str_id lo guardó payments/create en
    // payment_data. El UPDATE de abajo pisa payment_data con la respuesta de
    // Flow, así que lo capturamos ANTES y lo re-inyectamos — si no, se pierde y
    // el STR companion nunca se desbloquea + el return rutea al LTR pelado.
    const { data: prePayment } = await supabase
      .from("payments")
      .select("payment_data")
      .eq("commerce_order", flowData.commerceOrder)
      .maybeSingle();
    const companionStrId =
      (prePayment?.payment_data as { companion_str_id?: string } | null)?.companion_str_id;

    // Update payment record. Preservamos companion_str_id dentro del payload de
    // Flow para que las lecturas downstream (este handler + payments/status) lo vean.
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        flow_status: flowData.status,
        flow_order: flowData.flowOrder,
        payment_data: companionStrId ? { ...flowData, companion_str_id: companionStrId } : flowData,
        updated_at: new Date().toISOString(),
      })
      .eq("commerce_order", flowData.commerceOrder);

    if (updateError) {
      console.error("Payment update error:", updateError);
    }

    // If paid (Flow status 2), process credits
    if (flowStatus === 2) {
      const { data: payment, error: selectError } = await supabase
        .from("payments")
        .select("id, user_id, product, amount, commerce_order, flow_order, quantity, analysis_id, payment_data")
        .eq("commerce_order", flowData.commerceOrder)
        .single();

      if (selectError || !payment) {
        console.error("Payment select error:", selectError);
        return NextResponse.json({ status: "ok" });
      }

      const { id: paymentId, user_id: userId, product, analysis_id: analysisId } = payment;

      // Flujo AMBAS pre-pago: companionStrId se capturó arriba (antes del UPDATE
      // que pisa payment_data con la respuesta de Flow). El LTR va en analysis_id.
      // UN solo crédito cubre ambas filas (paridad con el Ambas pagado).

      if (userId && product === "single") {
        // Modelo nuevo: N créditos al ledger en UN grant (amount=quantity,
        // remaining=quantity); expira en 1 año (regla heredada de grantCredits).
        // quantity = 1 por default (compra de 1 crédito o filas legacy).
        const creditQty = payment.quantity ?? 1;
        // noExpire: el análisis comprado NO caduca (coherente con el copy "análisis
        // sin caducidad"). El ledger ya cuenta y consume NULL bien (lo deja último).
        await grantCredits(userId, "single", creditQty, { paymentId, noExpire: true });

        // Si la compra vino atada a un análisis, desbloquearlo en el acto
        // (mismo comportamiento que tenía 'pro'). Reusa la lógica ledger-aware
        // de access.consumeCredit: consume el crédito recién otorgado y marca
        // is_premium=true sobre ese análisis. consumeCredit es idempotente
        // (corta si ya está is_premium), así que un reenvío de webhook no
        // doble-consume el crédito.
        if (analysisId) {
          await consumeCredit(userId, analysisId);

          // Flujo LTR bloqueado pre-pago: la fila se creó con pending_payment=
          // true y SIN IA (ver /api/analisis/locked). Aquí la desbloqueamos y
          // disparamos la narrativa diferida.
          //
          // El flip CONDICIONAL (.eq pending_payment, true) es la guarda de
          // idempotencia: si Flow reenvía el webhook, la 2ª pasada ve
          // pending_payment=false → `unlocked` es null → NO regeneramos IA (no
          // gastamos Anthropic dos veces). Las filas del flujo viejo nacen con
          // pending_payment=false (default), incluido STR y los single sobre
          // análisis ya creados → caen fuera del gate y quedan intactas.
          const { data: unlocked } = await supabase
            .from("analisis")
            .update({ pending_payment: false })
            .eq("id", analysisId)
            .eq("pending_payment", true)
            .select("tipo_analisis")
            .maybeSingle();

          // LTR (single Y Ambas): generateAiAnalysis asume el shape del motor
          // long-term (results.metrics/desglose). Se genera también en el flujo
          // Ambas pre-pago para paridad con el Ambas PAGADO, donde /api/analisis
          // genera la IA LTR inline al crear (route.ts) — así la vista LTR pelada
          // (/analisis/<ltrId>) queda robusta. El STR companion NO se toca acá:
          // usa su endpoint on-demand y la comparativa corre su propia narrativa.
          //
          // await (no IIFE fire-and-forget): en serverless un promise sin await
          // puede morir cuando se envía el response. try/catch para no romper el
          // 200 que Flow espera. Si falla o Flow corta por latencia, la vista
          // recupera la IA on-demand vía polling /ai-status — no es critical path.
          if (unlocked && unlocked.tipo_analisis === "long-term") {
            try {
              await generateAiAnalysis(analysisId, supabase);
            } catch (e) {
              console.error("[payments/confirm] generateAiAnalysis diferida falló:", e);
            }
          }

          // AMBAS pre-pago: la 2ª fila (STR companion) se premia DIRECTO, sin
          // consumir otro crédito (el único cobro ya cubrió ambas). El flip
          // combinado is_premium + pending_payment va guardado por
          // .eq("pending_payment", true) → idempotente ante reenvío de webhook.
          // NO se genera IA STR acá (la comparativa la corre on-demand).
          if (companionStrId) {
            await supabase
              .from("analisis")
              .update({ is_premium: true, pending_payment: false })
              .eq("id", companionStrId)
              .eq("pending_payment", true);
          }
        }
      } else if (userId && product === "unlock") {
        // Fase D — desbloqueo ADITIVO de los hijos de un par AMBAS. NO consume
        // crédito ni toca is_premium (el crédito ya compró el comparativo
        // íntegro; esto abre el informe íntegro de los DOS hijos). Deriva el
        // grupo del hijo abierto (analysis_id) y flipea ambas_unlocked_at sobre
        // AMBAS filas. El .is(...,null) es la guarda de idempotencia: un reenvío
        // de webhook ve la marca ya puesta → no re-flipea.
        if (analysisId) {
          const { data: child } = await supabase
            .from("analisis")
            .select("ambas_group_id")
            .eq("id", analysisId)
            .maybeSingle();
          const groupId = (child as { ambas_group_id?: string } | null)?.ambas_group_id;
          if (groupId) {
            const { error: unlockError } = await supabase
              .from("analisis")
              .update({ ambas_unlocked_at: new Date().toISOString() })
              .eq("ambas_group_id", groupId)
              .is("ambas_unlocked_at", null);
            if (unlockError) {
              console.error("[payments/confirm] unlock AMBAS falló:", unlockError);
            }
          } else {
            console.error("[payments/confirm] unlock sin ambas_group_id, analysis:", analysisId);
          }
        }
      } else if (userId && product) {
        // Legacy pro/pack3 → contador user_credits.credits.
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
              resolveDisplayName(userData.user.user_metadata, userData.user.email),
              product,
              amount,
              analysisId || undefined
            );
          }
        } catch (e) {
          console.error("Payment email error:", e);
        }
      }

      // Emisión de boleta electrónica (DTE 39) — solo pagos `single` (NO legacy
      // pro/pack3). El helper respeta el kill-switch OPENFACTURA_ENABLED (no-op
      // si no está "true") y nunca lanza; aun así envolvemos en try/catch como
      // cinturón de seguridad: una falla de boleta JAMÁS debe romper el 200 que
      // Flow espera ni afectar créditos/emails ya procesados arriba.
      if (userId && product === "single" && process.env.OPENFACTURA_ENABLED === "true") {
        try {
          const { data: dteUser } = await supabase.auth.admin.getUserById(userId);
          const userEmail = dteUser?.user?.email;
          // Comuna del análisis atado → concepto "Análisis en {comuna}" en el
          // correo. Sin analysisId (compra de crédito), queda undefined y el
          // concepto cae en "N análisis". Solo afecta el copy, no la glosa del DTE.
          let comuna: string | undefined;
          if (analysisId) {
            const { data: analisisRow } = await supabase
              .from("analisis")
              .select("comuna")
              .eq("id", analysisId)
              .single();
            comuna = (analisisRow?.comuna as string | undefined) || undefined;
          }
          if (userEmail) {
            const result = await emitirBoletaDTE({
              payment: {
                id: paymentId,
                user_id: userId,
                product,
                amount: payment.amount,
                commerce_order: payment.commerce_order,
                flow_order: payment.flow_order,
                quantity: payment.quantity ?? 1,
              },
              userEmail,
              comuna,
            });
            if (!result.ok && !result.skipped) {
              console.error("[payments/confirm] emisión boleta falló:", result.error);
            }
          } else {
            console.error("[payments/confirm] sin email para emitir boleta, user:", userId);
          }
        } catch (e) {
          console.error("[payments/confirm] emisión boleta excepción:", e);
        }
      }

      // Fase D — boleta DTE 39 del desbloqueo (product 'unlock'). Bloque separado
      // del de 'single' (que queda byte-idéntico) para que el diff sea aditivo y
      // el path de cobros existentes no se toque. Glosa/concepto 'unlock' viven
      // en openfactura/client. Mismo kill-switch + cinturón try/catch: una falla
      // de boleta jamás rompe el 200 que Flow espera.
      if (userId && product === "unlock" && process.env.OPENFACTURA_ENABLED === "true") {
        try {
          const { data: dteUser } = await supabase.auth.admin.getUserById(userId);
          const userEmail = dteUser?.user?.email;
          // Comuna del hijo atado (analysis_id) → concepto "Informe completo en
          // {comuna}" en el correo. Solo afecta el copy, no la glosa del DTE.
          let comuna: string | undefined;
          if (analysisId) {
            const { data: analisisRow } = await supabase
              .from("analisis")
              .select("comuna")
              .eq("id", analysisId)
              .single();
            comuna = (analisisRow?.comuna as string | undefined) || undefined;
          }
          if (userEmail) {
            const result = await emitirBoletaDTE({
              payment: {
                id: paymentId,
                user_id: userId,
                product,
                amount: payment.amount,
                commerce_order: payment.commerce_order,
                flow_order: payment.flow_order,
                quantity: payment.quantity ?? 1,
              },
              userEmail,
              comuna,
            });
            if (!result.ok && !result.skipped) {
              console.error("[payments/confirm] emisión boleta unlock falló:", result.error);
            }
          } else {
            console.error("[payments/confirm] sin email para emitir boleta unlock, user:", userId);
          }
        } catch (e) {
          console.error("[payments/confirm] emisión boleta unlock excepción:", e);
        }
      }

      // Admin alert: successful payment
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email || "desconocido";
        const amount = flowData.amount || 0;
        const productLabel = adminProductLabel(product);
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
    if (flowStatus === 3 || flowStatus === 4) {
      try {
        const { data: payment } = await supabase
          .from("payments")
          .select("user_id, product, analysis_id")
          .eq("commerce_order", flowData.commerceOrder)
          .single();

        const statusLabel = flowStatus === 3 ? "Rechazado" : "Anulado";
        const product = payment?.product || "desconocido";
        const productLabel = adminProductLabel(product);
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
