import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { applyPlanCredits, recurringProductByAmount, recurringProductByPlan, addOneMonth } from "@/lib/credits-grant";
import { sendPaymentFailedEmail } from "@/lib/email";

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
    // Flow devuelve `status` como STRING → comparar con Number() (no === directo).
    const flowStatus = Number(flowData.status);
    if (flowStatus === 2 && userId) {
      // Cargo recurrente OK → mantener suscripción activa. Si venía de past_due
      // (recuperación dentro de la gracia), limpiar grace_ends_at.
      await supabase
        .from("user_credits")
        .update({
          subscription_status: "active",
          grace_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Identificar el plan suscrito. Preferimos el plan persistido en
      // user_credits (active_plan/billing_period, seteado en subscriptions/create)
      // que es fuente de verdad exacta. Fallback al mapeo por monto solo si no
      // hubiera plan persistido (payment/getStatus NO devuelve planId; los 6
      // montos de FLOW_PRODUCTS son únicos, así que el monto sirve de respaldo).
      const { data: uc } = await supabase
        .from("user_credits")
        .select("active_plan, billing_period")
        .eq("user_id", userId)
        .maybeSingle();

      const match =
        recurringProductByPlan(uc?.active_plan, uc?.billing_period) ??
        recurringProductByAmount(flowData.amount);
      const productKey = match?.key ?? "subscription";

      // Clave de dedupe del cobro = flowOrder de Flow (único e idéntico ante un
      // reenvío del MISMO cobro; distinto en el cobro del año siguiente). Sin él
      // no podemos deduplicar, así que NO inventamos id (el `|| Date.now()` viejo
      // rompía la idempotencia): logueamos y salimos. Status 2 sin flowOrder no es
      // un caso reintenable útil → 200 para que Flow no insista.
      const flowOrder = flowData.flowOrder;
      if (!flowOrder) {
        console.error(
          "[payment-callback] flowOrder ausente; cobro no procesado (sin dedupe):",
          flowData.commerceOrder
        );
        return NextResponse.json({ status: "ok" });
      }

      // Guarda de idempotencia INSERT-first: commerce_order es UNIQUE. Un reenvío
      // del mismo cobro choca contra el constraint (Postgres 23505) → ya procesado,
      // salir SIN otorgar ni re-armar. El INSERT es atómico, así que no hay ventana
      // TOCTOU entre "chequear" y "otorgar".
      const { data: paymentRow, error: insertErr } = await supabase
        .from("payments")
        .insert({
          user_id: userId,
          commerce_order: `franco-sub-pay-${flowOrder}`,
          product: productKey,
          amount: flowData.amount || 19990,
          status: "paid",
          flow_order: flowOrder,
          flow_status: flowData.status,
          payment_data: flowData,
        })
        .select("id")
        .single();

      if (insertErr) {
        // PostgrestError.code === '23505' = unique_violation → cobro ya registrado.
        if (insertErr.code === "23505") {
          console.error(`[payment-callback] duplicate webhook, flowOrder=${flowOrder} ignored`);
          return NextResponse.json({ status: "ok" });
        }
        // Cualquier otro error de INSERT es real (no un duplicado): NO otorgamos y
        // respondemos error para que Flow reintente. Distinguir esto del 23505
        // evita (a) regalar un grant tratando un dup como éxito y (b) descartar un
        // cobro válido por un fallo transitorio tratándolo como dup.
        console.error("[payment-callback] payments insert error:", insertErr);
        return NextResponse.json({ status: "error" }, { status: 200 });
      }

      // Otorgar créditos del ciclo según el plan (o is_unlimited). Si no se pudo
      // identificar el plan por monto, NO otorgamos (evita grants erróneos) — la
      // suscripción queda activa pero el caso queda logueado para revisión.
      if (match) {
        await applyPlanCredits(userId, match.product, match.key, { paymentId: paymentRow?.id ?? null });

        // Re-armar el lote mensual de planes ANUALES finitos. El cron monthly-grants
        // dejó next_monthly_grant_at=null al cerrar el ciclo anterior; sin esto la
        // renovación solo daría el mes 1 (el grant de applyPlanCredits) y perdería
        // los meses 2-12. Mensual recobra por su propio webhook recurrente y
        // unlimited es free pass → en ambos no se toca. Patrón de register-callback.
        const isAnnualFinite =
          match.product.billing === "annual" && match.product.isUnlimited !== true;
        if (isAnnualFinite) {
          const now = new Date();
          await supabase
            .from("user_credits")
            .update({
              next_monthly_grant_at: addOneMonth(now).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);
        }
      } else {
        console.error(
          "[subscriptions/payment-callback] amount sin plan en FLOW_PRODUCTS:",
          flowData.amount
        );
      }

      // TODO(facturación): este es el punto con la idempotencia más fuerte
      // (INSERT-first + commerce_order UNIQUE + flowOrder) y el candidato natural
      // para emitir la boleta de cada cobro recurrente. NO está cableado todavía:
      //  - Este webhook NUNCA se ha ejercitado en prod (0 filas franco-sub-pay-*
      //    en la DB), así que no hay un cobro real observado que validar.
      //  - No está confirmado el modelo de cobro de Flow: si el PRIMER cargo de
      //    la suscripción dispara este callback además del alta (register-callback),
      //    emitir en ambos lados duplicaría la boleta del primer ciclo.
      // Se cablea tras observar un cobro real con túnel y confirmar que cada
      // cargo recurrente mapea a exactamente una fila paid aquí (sin solape con
      // el alta). Falta además resolver el email (este camino no lo carga hoy).
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
