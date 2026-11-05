import { NextResponse } from "next/server";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { createClient } from "@supabase/supabase-js";
import { flowGet } from "@/lib/flow";
import { recurringProductByPlan, setPlanFields, addOneMonth } from "@/lib/credits-grant";
import { resolvePlanId } from "@/lib/flow-products";
import { sendTarjetaRegistradaEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { seVende } from "@/lib/planes";
import { abrirPlanUnico } from "@/lib/subscriptions/flow-vivas";
import { puertaFlow } from "@/lib/subscriptions/flow-puerta";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

// ─────────────────────────────────────────────────────────────────────────────
// LA VUELTA DE REGISTRAR LA TARJETA (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio).
//   · Antes de abrir la suscripción se cierran en Flow todas las vivas de la persona (flow-vivas.ts › abrirPlanUnico): nunca
//     quedan dos. Si alguna no se puede cerrar, no se abre la nueva.
//   · Registrar la tarjeta no es pagar: el correo y la pantalla dicen «Tarjeta registrada. Tu plan se activa con el primer
//     cobro, en las próximas horas.» «Pago confirmado» sale con el primer cobro (process-charge.ts).
//   · La vuelta dice solo lo comprobado (lib/subscriptions/suscripcion.ts › estadoRetornoSuscripcion): «No se hizo ningún
//     cargo» cuando no se abrió nada; si se pidió el alta y Flow no la confirmó, «Si Flow lo cobra, te avisamos por correo».
// Lo fija el tier SUSCRIPCION.
// ─────────────────────────────────────────────────────────────────────────────

/** Los estados de la vuelta. */
type Vuelta = "registrada" | "error" | "no-abierto" | "sin-plan" | "sin-confirmar";

function volver(status: Vuelta, extra?: Record<string, string>) {
  const url = new URL("/payments/return", SITE_URL);
  url.searchParams.set("type", "subscription");
  url.searchParams.set("status", status);
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  // Hasta dónde se llegó: decide qué se puede afirmar si algo revienta.
  let fase: "antes-del-alta" | "alta-pedida" | "alta-guardada" = "antes-del-alta";
  try {
    const formData = await request.formData();
    const token = formData.get("token") as string;

    // Sin token no se registró nada ni se abrió nada.
    if (!token) return volver("error");

    // Check card registration status. Flow devuelve `status` como STRING ("1"),
    // así que comparamos con Number() para no romper por tipo.
    const registerStatus = await flowGet("customer/getRegisterStatus", { token });

    // Comprobado por Flow: la tarjeta no quedó registrada.
    if (Number(registerStatus.status) !== 1) return volver("error");

    const customerId = registerStatus.customerId;
    const supabase = createAdminClient();

    // Buscar al user + el plan persistido por subscriptions/create.
    const { data: userCredit } = await supabase
      .from("user_credits")
      .select("user_id, active_plan, billing_period, subscription_status, subscription_id")
      .eq("flow_customer_id", customerId)
      .single();

    // Idempotencia: si la suscripción YA está activa (Flow reintentó el callback,
    // o el user recargó /register-callback), no recrear la suscripción en Flow.
    if (userCredit?.subscription_status === "active") {
      console.error("[register-callback] suscripción ya activa, idempotente:", customerId);
      return volver("registrada");
    }

    const match = recurringProductByPlan(
      userCredit?.active_plan,
      userCredit?.billing_period
    );

    if (!userCredit || !match?.product.planId) {
      console.error("[register-callback] sin plan persistido o planId nulo para customer:", customerId);
      return volver("sin-plan");
    }

    // LA OFERTA DEL 19-OCT-2026 (lib/planes.ts): quien empezó a suscribirse a un plan que ya no se vende (antes del corte)
    // y termina de registrar la tarjeta después, no lo activa: la tarjeta queda registrada, sin suscripción ni cobro.
    if (!seVende(match.key)) {
      console.error("[register-callback] plan que ya no se vende, sin suscripción:", match.key, customerId);
      return volver("sin-plan");
    }

    // UNA SOLA VIVA: cierra en Flow lo vivo de este cliente (la del plan en la gracia, la cancelada al fin del período, una
    // huérfana) y recién entonces abre la nueva, con el planId del entorno (base + FLOW_PLAN_SUFFIX).
    fase = "alta-pedida";
    const alta = await abrirPlanUnico(puertaFlow, {
      customerId,
      subscriptionId: (userCredit.subscription_id as string | null) ?? null,
      planId: resolvePlanId(match.product.planId),
      urlCallback: `${SITE_URL}/api/subscriptions/payment-callback`,
    });
    if (alta.cierre.canceladas.length > 0) {
      console.error("[register-callback] cerradas en Flow antes del alta:", alta.cierre.canceladas.join(", "), "· customer:", customerId);
    }
    if (!alta.ok) {
      captureApiError(new Error(`Alta de suscripción no hecha: ${alta.motivo}`), {
        ruta: "POST /api/subscriptions/register-callback",
        operacion: "alta-suscripcion",
        userId: userCredit.user_id,
        tags: { motivo: alta.motivo },
        extra: { customerId, vivas: alta.cierre.vivas, fallidas: alta.cierre.fallidas, lecturaFallida: alta.cierre.lecturaFallida, error: alta.error ?? null },
      });
      return volver(alta.motivo === "sin-confirmar" ? "sin-confirmar" : "no-abierto");
    }
    const subData = alta.suscripcion;

    // Lo primero que se guarda es el id: sin él, un cobro de esta suscripción no tendría dueño. El alta deja el período en
    // null: hasta el primer cobro el plan está «esperando el primer cobro» (suscripcion.ts › esperaPrimerCobro), y ese
    // cobro lo llena con la fecha de Flow.
    // next_monthly_grant_at: solo para ANUAL finito (no unlimited): marca cuándo toca el mes 2.
    const now = new Date();
    const isAnnualFinite = match.product.billing === "annual" && match.product.isUnlimited !== true;
    await supabase
      .from("user_credits")
      .update({
        subscription_status: "active",
        subscription_id: subData.subscriptionId,
        subscription_start: now.toISOString(),
        subscription_ends_at: null,
        grace_ends_at: null,
        next_monthly_grant_at: isAnnualFinite ? addOneMonth(now).toISOString() : null,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userCredit.user_id);
    fase = "alta-guardada";

    // MODELO C — "el grant sigue al cobro": el alta SOLO activa (campos de plan), NO otorga. Período en null (ver arriba).
    await setPlanFields(userCredit.user_id, match.product, { finDePeriodo: null });

    // RUTA B · flip del pending: subscriptions/create dejó una fila PENDING keyed por user+plan
    // (franco-sub-pending-<userId>-<planKey>). Si existe, la FLIPEAMOS a 'paid' con el commerce_order final
    // (franco-sub-<subId>); si no (cambio de tarjeta, flujos viejos), UPSERT do-nothing.
    //
    // POR QUÉ ACÁ NO SE CONSULTA `payment/getStatus`: el token es el del registro de la TARJETA y el cobro todavía no
    // ocurrió. El fee del primer cobro queda medido en la fila `franco-sub-pay-<flowOrder>` de processSubscriptionCharge.
    // Esta fila es el ALTA, no el cobro — `esAltaSuscripcion` la deja fuera de los totales. `payment_data` se FUSIONA.
    const paidOrder = `franco-sub-${subData.subscriptionId}`;
    const { data: pendingRow } = await supabase
      .from("payments")
      .select("id, payment_data")
      .eq("user_id", userCredit.user_id)
      .eq("product", match.key)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevPaymentData =
      pendingRow?.payment_data && typeof pendingRow.payment_data === "object" && !Array.isArray(pendingRow.payment_data)
        ? (pendingRow.payment_data as Record<string, unknown>)
        : {};
    const paymentDataAlta = { ...prevPaymentData, ...subData };
    if (pendingRow) {
      await supabase
        .from("payments")
        .update({ commerce_order: paidOrder, amount: match.product.amount, status: "paid", payment_data: paymentDataAlta })
        .eq("id", pendingRow.id);
    } else {
      await supabase
        .from("payments")
        .upsert(
          { user_id: userCredit.user_id, commerce_order: paidOrder, product: match.key, amount: match.product.amount, status: "paid", payment_data: paymentDataAlta },
          { onConflict: "commerce_order", ignoreDuplicates: true },
        );
    }

    // «Tarjeta registrada» (05-nov-2026): el correo del alta ya no es «Pago confirmado» —todavía no se cobró nada—. Una vez
    // por suscripción (la llave es su id). Un fallo de Resend no rompe la vuelta.
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userCredit.user_id);
      const flowUser = userData?.user;
      if (flowUser?.email) {
        await sendTarjetaRegistradaEmail(flowUser.email, nombreReal(flowUser.user_metadata) ?? "", match.key, {
          userId: userCredit.user_id,
          idempotencyKey: `tarjeta-registrada-${subData.subscriptionId}`,
        });
      }
    } catch (e) {
      console.error("[register-callback] correo tarjeta registrada error:", e);
      captureApiWarning(e, { ruta: "POST /api/subscriptions/register-callback", operacion: "email-tarjeta-registrada" });
    }

    // FACTURACIÓN — el alta NO emite boleta (decisión tomada): no es un cobro. La boleta va con la fila del cobro
    // (`franco-sub-pay-<flowOrder>`, paso 6 de processSubscriptionCharge). NO borrar esa fila: sostiene también el gate de
    // primer cobro del Subscribe de Meta (subscribe-event.ts).

    // Meta Pixel (browser): sub=<subscriptionId> + val al return para que dispare Subscribe con event_id sub-<subscriptionId>
    // → dedup con el Subscribe server-side del primer cobro. Solo en esta activación real (los redirects idempotentes de
    // arriba no llevan sub). `val` es el PRECIO DE CATÁLOGO (acá no existe cargo todavía); si algún día hay prorrateo,
    // cupón o descuento, sacar `val` y dejar al server como única fuente.
    return volver("registrada", { sub: subData.subscriptionId, val: String(match.product.amount) });
  } catch (err) {
    console.error("Register callback error:", err);
    captureApiError(err, {
      ruta: "POST /api/subscriptions/register-callback",
      operacion: "alta-suscripcion",
      tags: { fase },
    });
    // Lo que se puede afirmar depende de hasta dónde se llegó: guardada, el plan está; pedida, puede haberse abierto; antes,
    // no se abrió nada.
    return volver(fase === "alta-guardada" ? "registrada" : fase === "alta-pedida" ? "sin-confirmar" : "sin-plan");
  }
}
