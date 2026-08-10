import { NextResponse } from "next/server";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { createClient } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { recurringProductByAmount, recurringProductByPlan, addOneMonth } from "@/lib/credits-grant";
import { sendPaymentFailedEmail } from "@/lib/email";
import { processSubscriptionCharge, parseSubscriptionId } from "@/lib/subscriptions/process-charge";
import { sendSubscribeIfFirstCharge } from "@/lib/subscriptions/subscribe-event";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";
const RUTA = "POST /api/subscriptions/payment-callback";

/**
 * Intentos de `payment/getStatus`. El POST de Flow al urlCallback trae SOLO el
 * token: sin esta respuesta no sabemos de quién es el cargo, cuánto se cobró ni
 * qué otorgar. Es el único punto del flujo donde perder la llamada cuesta un
 * grant, así que acá sí pagamos el costo de reintentar (opt-in de flowPost).
 */
const GET_STATUS_INTENTOS = 3;

/**
 * Razones de processSubscriptionCharge que un reintento PUEDE arreglar: fallas de
 * DB y mapeos que dependen de una fila que quizá todavía no existe (carrera del
 * alta con el primer cobro). Ante una de estas devolvemos 5xx.
 *
 * Las demás razones son decisiones firmes —`status_not_paid`, `pre_cutoff`,
 * `commerce_order_not_subscription`, `amount_invalid`, `no_flow_order`— y ahí un
 * reintento repetiría el mismo resultado: 200.
 */
const RAZONES_REINTENTABLES = new Set([
  "payments_insert_error",
  "no_payment_id",
  "user_unresolved",
]);

/** Subconjunto de payment/getStatus que consume este handler. */
type FlowPaymentStatus = {
  commerceOrder?: string;
  flowOrder?: number | string;
  status?: number | string;
  amount?: number | string;
  payer?: string;
  requestDate?: string;
  optional?: string;
};

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Respuesta de error que PIDE reintento.
 *
 * Antes este handler devolvía 200 en todos los caminos ("para que Flow no
 * reintente"). Eso convirtió una caída puntual de getStatus (9-ago-2026) en un
 * grant perdido para siempre: el pago quedó registrado, la suscripción activa y
 * el usuario sin créditos, sin segunda oportunidad.
 *
 * NO ESTÁ CONFIRMADO que Flow reintente ante un 5xx. Se implementa igual porque
 * el costo de equivocarse es nulo (volvemos al comportamiento actual) y el
 * upside es recuperar el cargo en minutos. El backstop real y verificado sigue
 * siendo el cron reconcile-subscriptions, que reprocesa la ventana HOY+AYER por
 * el mismo helper idempotente.
 *
 * Reprocesar es seguro: fila (commerce_order UNIQUE), grant (payment_id UNIQUE) y
 * boleta (payment_id) deduplican solos.
 */
function pedirReintento(mensaje: string) {
  return NextResponse.json({ status: "error", detalle: mensaje }, { status: 503 });
}

export async function POST(request: Request) {
  // Fuera del try para que el catch externo pueda mandarlos a Sentry: sin el
  // token y el commerceOrder no hay forma de saber QUÉ cargo se perdió — el
  // incidente del 9-ago llegó a Sentry sin un solo identificador utilizable.
  let token: string | null = null;
  let flowData: FlowPaymentStatus | null = null;

  // Contexto de Sentry armado en un solo lugar. El token va en `extra` y no en
  // `tags`: es único por transacción y un tag de cardinalidad alta vuelve
  // inservible el buscador (mismo criterio que observabilidad.ts con los ids).
  const contextoFlow = () => ({
    token,
    commerceOrder: flowData?.commerceOrder ?? null,
    flowOrder: flowData?.flowOrder ?? null,
    amount: flowData?.amount ?? null,
    flowStatus: flowData?.status ?? null,
  });

  try {
    const formData = await request.formData();
    token = (formData.get("token") as string) ?? null;

    if (!token) {
      // Sin token no hay nada que consultar y un reintento traería lo mismo → 200.
      console.error("[payment-callback] callback sin token");
      captureApiWarning(new Error("Callback de Flow sin token"), {
        ruta: RUTA,
        operacion: "cobro-recurrente",
        tags: { respuesta_a_flow: "200-descartado" },
      });
      return NextResponse.json({ status: "error" }, { status: 200 });
    }

    // getStatus aislado: su fallo es la causa raíz del incidente y merece su
    // propio diagnóstico + un 5xx explícito, en vez de caer al catch genérico.
    try {
      flowData = await flowPost(
        "payment/getStatus",
        { token },
        { intentos: GET_STATUS_INTENTOS }
      );
    } catch (e) {
      console.error("[payment-callback] getStatus falló tras reintentos:", e);
      captureApiError(e, {
        ruta: RUTA,
        operacion: "flow-get-status",
        tags: { respuesta_a_flow: "503-reintento" },
        extra: { token, intentos: GET_STATUS_INTENTOS },
      });
      return pedirReintento("getStatus no disponible");
    }
    if (!flowData) return pedirReintento("getStatus sin respuesta");

    const supabase = createAdminClient();

    // Resolver el dueño de la suscripción. PRIMARIO (fix): parsear sus_<subId> del
    // commerceOrder de Flow → user_credits.subscription_id. Los cargos recurrentes
    // NO traen nuestro optional.userId ni un commerceOrder que matchee payments, así
    // que sin esto userId quedaba null y el cargo se descartaba en silencio.
    // Fallbacks legacy: optional.userId y commerceOrder en payments.
    let userId: string | null = null;

    // parseSubscriptionId (compartido con process-charge y subscribe-event): un solo
    // parser del `sus_<subId>`, del que salen tanto este mapeo como el event_id de Meta.
    const subId = parseSubscriptionId(flowData.commerceOrder);
    if (subId) {
      const { data } = await supabase
        .from("user_credits")
        .select("user_id")
        .eq("subscription_id", subId)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }

    if (!userId) {
      try {
        const optional = JSON.parse(flowData.optional || "{}");
        userId = optional.userId ?? null;
      } catch { /* ignore */ }
    }

    if (!userId && flowData.commerceOrder) {
      const { data } = await supabase
        .from("payments")
        .select("user_id")
        .eq("commerce_order", flowData.commerceOrder)
        .maybeSingle();
      userId = data?.user_id || null;
    }

    // Enum Flow: 1=pendiente, 2=pagada, 3=rechazada, 4=anulada.
    // Flow devuelve `status` como STRING → comparar con Number() (no === directo).
    const flowStatus = Number(flowData.status);

    // Cargo PAGADO cuyo dueño no resolvimos: antes se caía por el `&& userId` de
    // abajo y terminaba en un 200 silencioso — plata cobrada sin grant y sin
    // rastro. Puede ser una carrera con el alta (subscription_id todavía no
    // persistido), así que pedimos reintento.
    if (flowStatus === 2 && !userId) {
      console.error(
        "[payment-callback] cargo pagado sin dueño resoluble; commerceOrder:",
        flowData.commerceOrder
      );
      captureApiError(new Error("Cargo pagado sin user resoluble"), {
        ruta: RUTA,
        operacion: "resolver-dueno",
        commerceOrder: flowData.commerceOrder ?? null,
        tags: { respuesta_a_flow: "503-reintento" },
        extra: contextoFlow(),
      });
      return pedirReintento("dueño de la suscripción no resuelto");
    }

    if (flowStatus === 2 && userId) {
      // Cargo recurrente OK → mantener suscripción activa. Si venía de past_due
      // (recuperación dentro de la gracia), limpiar grace_ends_at. Idempotente.
      await supabase
        .from("user_credits")
        .update({
          subscription_status: "active",
          grace_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Fila franco-sub-pay-<flowOrder> + grant (idempotente por payment_id, gateado
      // por el cutoff de C) + boleta DTE 39: todo en el helper compartido (el mismo
      // que usará el cron reconciler). chargeDate ← requestDate es CRÍTICO: sin él el
      // fail-safe del cutoff suspende el grant. El helper NUNCA lanza y deduplica solo
      // (commerce_order UNIQUE + grant por payment_id + boleta por payment_id), así
      // que un reenvío del mismo cobro es no-op seguro.
      const result = await processSubscriptionCharge({
        flowOrder: Number(flowData.flowOrder),
        commerceOrder: flowData.commerceOrder ?? "",
        amount: Number(flowData.amount),
        status: flowStatus,
        payer: flowData.payer,
        chargeDate: flowData.requestDate,
        flowData,
      });
      console.error(
        "[payment-callback] processSubscriptionCharge →",
        JSON.stringify(result)
      );

      // El cargo no quedó aplicado por una causa que otro intento puede resolver
      // (falla de DB, mapeo en carrera) → 5xx en vez del 200 que sepultaba el
      // problema. Las razones firmes (pre_cutoff, status_not_paid, etc.) siguen
      // de largo y salen 200.
      if (!result.ok && RAZONES_REINTENTABLES.has(String(result.reason))) {
        captureApiError(
          new Error(`Cargo no aplicado: ${String(result.reason)}`),
          {
            ruta: RUTA,
            operacion: "aplicar-cargo",
            commerceOrder: flowData.commerceOrder ?? null,
            userId,
            tags: {
              respuesta_a_flow: "503-reintento",
              motivo: String(result.reason ?? "sin-motivo").slice(0, 32),
            },
            extra: contextoFlow(),
          }
        );
        return pedirReintento(`cargo no aplicado: ${String(result.reason)}`);
      }

      // Meta CAPI: Subscribe SOLO en el primer cobro de esta suscripción. El gate
      // (conteo de filas franco-sub-pay-* del user excluyendo la actual) y toda su
      // doctrina viven en sendSubscribeIfFirstCharge — COMPARTIDO con el cron
      // reconciler, que recorre el mismo camino cuando este webhook falla o llega
      // tarde. Antes esto era inline acá y el reconciler no enviaba nada: la
      // conversión se perdía en silencio.
      //
      // Va DESPUÉS de processSubscriptionCharge: el conteo asume que la fila del
      // cargo actual ya existe. El helper nunca lanza; el try/catch es defensa en
      // profundidad para que una falla de Meta jamás rompa el 200 que Flow espera.
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
          captureApiWarning(e, {
            ruta: RUTA,
            operacion: "meta-capi-subscribe",
            extra: contextoFlow(),
          });
        }
      }

      // Re-armar el lote mensual de planes ANUALES finitos SOLO ante un cargo FRESCO
      // (result.granted = se insertó un lote nuevo en este llamado). En un reenvío del
      // webhook (granted=false) NO re-armamos, para no empujar next_monthly_grant_at
      // repetidamente. El cron monthly-grants otorga los meses 2-12 desde esta fecha.
      // (Antes esto vivía tras el INSERT-first; ahora el helper hace el INSERT y la
      // idempotencia del grant, y result.granted refleja "cargo fresco".)
      if (result.granted) {
        const { data: uc } = await supabase
          .from("user_credits")
          .select("active_plan, billing_period")
          .eq("user_id", userId)
          .maybeSingle();
        const match =
          recurringProductByPlan(uc?.active_plan, uc?.billing_period) ??
          recurringProductByAmount(Number(flowData.amount));
        if (
          match &&
          match.product.billing === "annual" &&
          match.product.isUnlimited !== true
        ) {
          const now = new Date();
          await supabase
            .from("user_credits")
            .update({
              next_monthly_grant_at: addOneMonth(now).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);
        }
      }
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
        captureApiWarning(e, {
          ruta: RUTA,
          operacion: "email-past-due",
          extra: contextoFlow(),
        });
      }
    }
    // status 1 = pendiente → no cambia subscription_status

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Subscription payment callback error:", err);
    // 503, no 200. Una excepción acá deja el cargo a medio aplicar (típicamente:
    // suscripción reactivada, grant sin otorgar) y el 200 lo volvía definitivo.
    // El contexto de Flow va completo: sin el token y el commerceOrder, este
    // mismo evento en Sentry no permitió ni identificar el cargo perdido.
    captureApiError(err, {
      ruta: RUTA,
      operacion: "cobro-recurrente",
      commerceOrder: flowData?.commerceOrder ?? null,
      tags: { respuesta_a_flow: "503-reintento" },
      extra: contextoFlow(),
    });
    return pedirReintento("error procesando el cobro");
  }
}
