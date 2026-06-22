import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { flowPost, flowGet } from "@/lib/flow";
import { recurringProductByPlan, applyPlanCredits, addOneMonth } from "@/lib/credits-grant";
import { resolvePlanId } from "@/lib/flow-products";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";

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
    //
    // RUTA B · flip del pending: subscriptions/create dejó una fila PENDING
    // keyed por user+plan (franco-sub-pending-<userId>-<planKey>). Si existe, la
    // FLIPEAMOS a 'paid' (UPDATE) en vez de insertar una segunda fila — así el
    // cron de abandono no la ve como carrito vivo y no hay fila pending huérfana.
    // Al flipear le ponemos el commerce_order final (franco-sub-<subId>) +
    // payment_data. Fallback a INSERT si no había pending (activación nunca se
    // rompe: flujos viejos / pending perdido).
    const paidOrder = `franco-sub-${subData.subscriptionId}`;
    const { data: pendingRow } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", userCredit.user_id)
      .eq("product", match.key)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let paymentRow: { id: string } | null = null;
    if (pendingRow) {
      const { data: flipped } = await supabase
        .from("payments")
        .update({
          commerce_order: paidOrder,
          amount: match.product.amount,
          status: "paid",
          payment_data: subData,
        })
        .eq("id", pendingRow.id)
        .select("id")
        .single();
      paymentRow = flipped ?? null;
    } else {
      // UPSERT do-nothing (no INSERT plano): si un retry de Flow llega tras un
      // flip/insert previo (y el guard 'active' no cortó por fallo a mitad de la
      // primera corrida), `franco-sub-<subId>` ya existe → el INSERT plano
      // chocaría con el UNIQUE de commerce_order. ignoreDuplicates evita romper.
      const { data: inserted, error: insertErr } = await supabase
        .from("payments")
        .upsert(
          {
            user_id: userCredit.user_id,
            commerce_order: paidOrder,
            product: match.key,
            amount: match.product.amount,
            status: "paid",
            payment_data: subData,
          },
          { onConflict: "commerce_order", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();

      // Duplicado (sin error y sin fila) = este cobro YA se procesó en una
      // corrida previa. NO-OP TOTAL: salimos antes de applyPlanCredits, que NO es
      // idempotente (grantCredits hace INSERT plano sin dedup → un 2º llamado
      // doblaría el grant). Repone la guardia que antes daba el choque del INSERT.
      // La suscripción ya quedó activa en la corrida original → success redirect.
      if (!inserted && !insertErr) {
        console.error(
          "[register-callback] cobro ya procesado (commerce_order duplicado), no-op:",
          paidOrder,
        );
        return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
      }
      paymentRow = inserted ?? null;
    }

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

    // Comprobante de alta de la suscripción. Solo en el alta — las renovaciones
    // (payment-callback) NO mandan correo para no spamear: el usuario ya tiene
    // el comprobante de Flow y este de bienvenida al plan. product/amount reales
    // del plan elegido (match.key). Un fallo de Resend no debe romper el callback.
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userCredit.user_id);
      const flowUser = userData?.user;
      if (flowUser?.email) {
        await sendPaymentConfirmationEmail(
          flowUser.email,
          resolveDisplayName(flowUser.user_metadata, flowUser.email),
          match.key,
          match.product.amount,
        );
      }
    } catch (e) {
      console.error("[register-callback] email confirmación alta error:", e);
    }

    // TODO(facturación): aquí sería el punto natural para emitir la boleta del
    // alta (tenemos paymentRow.id + email), PERO la emisión NO está cableada a
    // propósito. Razones:
    //  - Esta fila de payments es el ALTA (franco-sub-<subId>) y trae
    //    flow_order = null → señal de que el alta puede NO ser un cobro real,
    //    sino el registro de la suscripción / tokenización de la tarjeta.
    //  - payment-callback (el webhook del cobro recurrente real) NUNCA se ha
    //    ejercitado en prod, así que no está confirmado si el primer cargo
    //    materializa una segunda fila (franco-sub-pay-<flowOrder>).
    //  - Emitir en el alta podría facturar dinero que aún no fue cobrado.
    // Se resuelve tras entender el modelo de cobro de Flow y observar un cobro
    // real con túnel. Decisión probable: emitir solo en payment-callback.
    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=success", SITE_URL));
  } catch (err) {
    console.error("Register callback error:", err);
    return NextResponse.redirect(new URL("/payments/return?type=subscription&status=error", SITE_URL));
  }
}
