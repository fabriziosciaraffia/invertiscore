import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { createClient } from "@supabase/supabase-js";
import { flowGet } from "@/lib/flow";
import { recurringProductByAmount, recurringProductByPlan, addOneMonth } from "@/lib/credits-grant";
import { sendPaymentFailedEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { processSubscriptionCharge, parseSubscriptionId } from "@/lib/subscriptions/process-charge";
import { sendSubscribeIfFirstCharge } from "@/lib/subscriptions/subscribe-event";
import { esperaPrimerCobro } from "@/lib/subscriptions/suscripcion";
import { procesarAvisoDeCobro, responderAviso, TOPE_CONCILIAR_MS, type EstadoPagoFlow, type PiezasAviso } from "@/lib/subscriptions/aviso-cobro";

// ─────────────────────────────────────────────────────────────────────────────
// EL AVISO DE COBRO DE FLOW (urlCallback de los planes). Reescrito el 05-nov-2026 (decisión de Fabrizio: «que el cobro se
// registre al momento»).
//
// LA CAUSA: desde agosto esta ruta consultaba `payment/getStatus` por POST y el servicio es GET (apiFlow.yaml). Flow
// responde a ese POST 400 {"code":105,"message":"No services available"} —medido en el sandbox: el mismo token por GET da
// 1700 «Transaction not found», o sea, se procesa—. Por eso fallaron TODOS los avisos (9-ago, 9, 22 y 23 de octubre, a
// ~4 s del cobro, con la URL correcta), la ruta respondía 503, Flow no vuelve a llamar y el cobro quedaba para el cron
// reconcile-subscriptions de la hora siguiente. La hipótesis de que el 105 era «transitorio» (flow.ts) era falsa.
//
// AHORA (lib/subscriptions/aviso-cobro.ts):
//   · la consulta va por GET (getStatus; si falla, getStatusExtended);
//   · la ruta responde 200 SIEMPRE que recibe el aviso y lo procesa en segundo plano (waitUntil), con esperas crecientes
//     por si Flow tarda en tener el pago; si en la ventana no lo entrega, corre la conciliación del día; el cron de cada
//     hora sigue de respaldo;
//   · el token de sonda responde 200 sin trabajo: el tier AVISO-COBRO llama a producción con él y exige 200.
// ─────────────────────────────────────────────────────────────────────────────

/** Tiempo para el trabajo en segundo plano (ver ESPERAS_AVISO_MS). Debe coincidir con DURACION_RUTA_AVISO_S. */
export const maxDuration = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
const RUTA = "POST /api/subscriptions/payment-callback";

/**
 * Razones de processSubscriptionCharge que otro intento PUEDE arreglar: fallas de DB y mapeos que dependen de una fila que
 * quizá todavía no existe (carrera del alta con el primer cobro). Las demás —`status_not_paid`, `pre_cutoff`,
 * `commerce_order_not_subscription`, `amount_invalid`, `no_flow_order`— son firmes: otro intento daría lo mismo.
 */
const RAZONES_REINTENTABLES = new Set([
  "payments_insert_error",
  "no_payment_id",
  "user_unresolved",
  // El ledger no pudo acreditar (04-nov-2026): otro intento puede.
  "grant_error",
]);

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** El estado del pago en Flow, por GET (el servicio no existe por POST). Si getStatus falla, getStatusExtended. */
async function consultarPago(token: string): Promise<EstadoPagoFlow> {
  try {
    return (await flowGet("payment/getStatus", { token })) as EstadoPagoFlow;
  } catch (e) {
    try {
      return (await flowGet("payment/getStatusExtended", { token })) as EstadoPagoFlow;
    } catch {
      throw e;
    }
  }
}

/**
 * Aplica un cobro con su estado ya leído de Flow. `listo: false` = otro intento puede arreglarlo (dueño todavía sin
 * resolver, falla de base, pago aún pendiente). Lo idempotente (fila, lote, boleta) deduplica solo: reintentar es seguro.
 */
async function aplicarCobro(token: string, flowData: EstadoPagoFlow): Promise<{ listo: boolean; motivo?: string }> {
  const contextoFlow = () => ({
    token,
    commerceOrder: flowData.commerceOrder ?? null,
    flowOrder: flowData.flowOrder ?? null,
    amount: flowData.amount ?? null,
    flowStatus: flowData.status ?? null,
  });
  const supabase = createAdminClient();

  // Resolver el dueño de la suscripción. PRIMARIO: parsear sus_<subId> del commerceOrder de Flow →
  // user_credits.subscription_id. Fallbacks legacy: optional.userId y commerceOrder en payments.
  let userId: string | null = null;
  const subId = parseSubscriptionId(flowData.commerceOrder);
  if (subId) {
    const { data } = await supabase.from("user_credits").select("user_id").eq("subscription_id", subId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    try {
      const optional = JSON.parse(flowData.optional || "{}");
      userId = optional.userId ?? null;
    } catch { /* ignore */ }
  }
  if (!userId && flowData.commerceOrder) {
    const { data } = await supabase.from("payments").select("user_id").eq("commerce_order", flowData.commerceOrder).maybeSingle();
    userId = data?.user_id || null;
  }

  // Enum Flow: 1=pendiente, 2=pagada, 3=rechazada, 4=anulada. Flow devuelve `status` como STRING → Number().
  const flowStatus = Number(flowData.status);

  // Pagado y sin dueño: puede ser una carrera con el alta (subscription_id todavía no guardado). Otro intento.
  if (flowStatus === 2 && !userId) {
    console.error("[payment-callback] cargo pagado sin dueño resoluble; commerceOrder:", flowData.commerceOrder);
    return { listo: false, motivo: "dueño de la suscripción no resuelto" };
  }

  // Pendiente: Flow todavía no lo cierra. Otro intento dentro de la ventana; si no, la conciliación.
  if (flowStatus === 1) return { listo: false, motivo: "pago pendiente en Flow" };

  if (flowStatus === 2 && userId) {
    // Cargo recurrente OK → suscripción activa. Si venía de past_due (recuperación en la gracia), limpia grace_ends_at.
    await supabase
      .from("user_credits")
      .update({ subscription_status: "active", grace_ends_at: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Fila franco-sub-pay-<flowOrder> + lote (idempotente por payment_id, gateado por el cutoff de C) + boleta DTE 39: el
    // helper compartido con el cron. chargeDate ← requestDate es CRÍTICO: sin él el cutoff suspende el lote.
    const result = await processSubscriptionCharge({
      flowOrder: Number(flowData.flowOrder),
      commerceOrder: flowData.commerceOrder ?? "",
      amount: Number(flowData.amount),
      status: flowStatus,
      payer: flowData.payer,
      chargeDate: flowData.requestDate,
      flowData,
    });
    console.error("[payment-callback] processSubscriptionCharge →", JSON.stringify(result));
    if (!result.ok && RAZONES_REINTENTABLES.has(String(result.reason))) {
      captureApiWarning(new Error(`Cargo no aplicado: ${String(result.reason)}`), {
        ruta: RUTA,
        operacion: "aplicar-cargo",
        commerceOrder: flowData.commerceOrder ?? null,
        userId,
        tags: { motivo: String(result.reason ?? "sin-motivo").slice(0, 32) },
        extra: contextoFlow(),
      });
      return { listo: false, motivo: `cargo no aplicado: ${String(result.reason)}` };
    }

    // Meta CAPI: Subscribe SOLO en el primer cobro de esta suscripción (gate compartido con el cron). Después del helper:
    // el conteo asume que la fila del cargo actual ya existe. Una falla de Meta no toca el cobro.
    if (subId) {
      try {
        await sendSubscribeIfFirstCharge({
          supabase,
          userId,
          commerceOrder: flowData.commerceOrder ?? "",
          amount: Number(flowData.amount),
          flowOrder: Number(flowData.flowOrder),
          payerEmail: flowData.payer,
          eventSourceUrl: SITE_URL,
        });
      } catch (e) {
        console.error("[payment-callback] Meta CAPI Subscribe excepción:", e);
        captureApiWarning(e, { ruta: RUTA, operacion: "meta-capi-subscribe", extra: contextoFlow() });
      }
    }

    // Re-armar el lote mensual de planes ANUALES finitos SOLO ante un cargo FRESCO (result.granted).
    if (result.granted) {
      const { data: uc } = await supabase.from("user_credits").select("active_plan, billing_period").eq("user_id", userId).maybeSingle();
      const match = recurringProductByPlan(uc?.active_plan, uc?.billing_period) ?? recurringProductByAmount(Number(flowData.amount));
      if (match && match.product.billing === "annual" && match.product.isUnlimited !== true) {
        const now = new Date();
        await supabase
          .from("user_credits")
          .update({ next_monthly_grant_at: addOneMonth(now).toISOString(), updated_at: now.toISOString() })
          .eq("user_id", userId);
      }
    }
    return { listo: true };
  }

  if ((flowStatus === 3 || flowStatus === 4) && userId) {
    // Cargo rechazado (3) o anulado (4) → mora con 7 días de gracia (acceso hasta grace_ends_at; expire-grace corta al
    // vencer, también en Flow). ¿Era el PRIMER cobro? (05-nov-2026): entonces el correo dice que el plan no se activó. Se
    // lee ANTES de marcar past_due.
    const { data: antes } = await supabase
      .from("user_credits")
      .select("subscription_status, subscription_ends_at")
      .eq("user_id", userId)
      .maybeSingle();
    const primerCobro = esperaPrimerCobro(antes);
    const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await supabase
      .from("user_credits")
      .update({ subscription_status: "past_due", grace_ends_at: graceEndsAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Email de aviso. Un fallo de Resend no rompe el aviso.
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const flowUser = userData?.user;
      if (flowUser?.email) {
        const nombre = nombreReal(flowUser.user_metadata);
        await sendPaymentFailedEmail(flowUser.email, nombre, graceEndsAt, { userId, primerCobro });
      }
    } catch (e) {
      console.error("[subscriptions/payment-callback] aviso past_due email error:", e);
      captureApiWarning(e, { ruta: RUTA, operacion: "email-past-due", extra: contextoFlow() });
    }
  }
  return { listo: true };
}

/** Las piezas reales del aviso: Flow por GET, la base, el reloj y la conciliación del día (el cron, con su tope). */
function piezasReales(token: string): PiezasAviso {
  return {
    consultar: consultarPago,
    aplicar: (estado) => aplicarCobro(token, estado),
    reconciliar: async () => {
      const secreto = process.env.CRON_SECRET;
      if (!secreto) throw new Error("CRON_SECRET no configurado");
      const r = await fetch(`${SITE_URL}/api/cron/reconcile-subscriptions`, {
        headers: { Authorization: `Bearer ${secreto}` },
        signal: AbortSignal.timeout(TOPE_CONCILIAR_MS),
      });
      if (!r.ok) throw new Error(`conciliación respondió ${r.status}`);
    },
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    avisar: (evento, datos) => {
      if (evento === "aplicado") {
        console.error("[payment-callback] cobro aplicado", JSON.stringify(datos));
        return;
      }
      console.error(`[payment-callback] ${evento}`, JSON.stringify(datos));
      const error = new Error(evento === "sin-estado" ? "Aviso de cobro sin estado de Flow en la ventana: va la conciliación" : "La conciliación tras el aviso falló");
      if (evento === "sin-estado") captureApiWarning(error, { ruta: RUTA, operacion: "aviso-sin-estado", extra: { token, ...datos } });
      else captureApiError(error, { ruta: RUTA, operacion: "aviso-conciliar", extra: { token, ...datos } });
    },
  };
}

export async function POST(request: Request) {
  const respuesta = await responderAviso(request, (token) => waitUntil(procesarAvisoDeCobro(token, piezasReales(token))));
  return NextResponse.json(respuesta.body, { status: respuesta.status });
}
