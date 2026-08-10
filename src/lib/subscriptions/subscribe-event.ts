/**
 * Subscribe de Meta (CAPI) para el PRIMER cobro de una suscripción.
 *
 * Vive acá, y no inline en el webhook, porque tiene DOS consumidores reales que no
 * pueden divergir:
 *   1. subscriptions/payment-callback  — el webhook de Flow (camino real-time).
 *   2. cron/reconcile-subscriptions    — la red de seguridad del webhook.
 * Antes solo lo hacía (1). Cuando el webhook fallaba o llegaba tarde, (2) recuperaba
 * el cargo — fila + grant + boleta — pero la conversión NUNCA salía; y como la fila
 * `franco-sub-pay-*` quedaba escrita, un webhook posterior contaba 1 previa y tampoco
 * disparaba. La conversión se perdía en silencio. Un solo gate compartido cierra eso.
 *
 * Fuera de acá queda la ruta del dinero: esto NO vive dentro de
 * processSubscriptionCharge a propósito — ese helper tiene un contrato de tres capas
 * (fila → grant → boleta) y acoplarle marketing lo ensucia.
 *
 * IDEMPOTENCIA — dos capas, deliberadamente en ese orden:
 *  a) El conteo de primer cobro (abajo) evita el envío en las renovaciones.
 *  b) El `event_id` compartido (`sub-<subId>`, el mismo que dispara el browser en
 *     /payments/return) hace que Meta colapse cualquier envío redundante.
 * NO hay un tercer gate por "fila recién insertada". Se evaluó y se descartó: si el
 * webhook escribe la fila y muere ANTES de enviar (timeout a mitad del handler), ese
 * gate haría que el reconciler tampoco enviara — la misma fuga silenciosa, más chica.
 * El costo de no tenerlo está acotado: el reconciler escanea HOY+AYER y corre diario,
 * así que un primer cobro lo ven a lo sumo 2 corridas → ≤2 envíos extra, todos con el
 * mismo event_id. Un envío redundante es visible y barato; una conversión perdida, no.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMetaCapiEvent } from "@/lib/meta/capi";
import { parseSubscriptionId } from "@/lib/subscriptions/process-charge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export type SubscribeEventResult = {
  /** true solo si se despachó el evento a Meta en este llamado. */
  sent: boolean;
  /** Por qué no se envió (o 'exception' si algo tiró). Ausente cuando sent=true. */
  reason?:
    | "not_a_subscription_order"
    | "not_first_charge"
    | "exception";
};

/**
 * Envía Subscribe SOLO si este cargo es el primero de la suscripción. NUNCA lanza
 * (mismo contrato que sendMetaCapiEvent): devuelve el resultado para que el caller
 * cuente, pero un fallo de Meta jamás rompe el cobro, el cron ni el 200 a Flow.
 *
 * DEBE llamarse DESPUÉS de processSubscriptionCharge: el conteo asume que la fila
 * del cargo actual (`franco-sub-pay-<flowOrder>`) ya existe y la excluye explícitamente.
 */
export async function sendSubscribeIfFirstCharge(opts: {
  /** Client service-role (necesita leer payments y auth.admin). */
  supabase: SupabaseClient;
  /** Dueño de la suscripción, ya resuelto por el caller. */
  userId: string;
  /** commerceOrder de Flow ("sus_<subId>_<invoiceId>_<ts>") — de acá sale el event_id. */
  commerceOrder: string;
  /** Monto realmente cobrado por Flow en ESTE cargo. */
  amount: number;
  /** flowOrder del cargo actual — identifica la fila a excluir del conteo. */
  flowOrder: number;
  /** Email del pagador según Flow; fallback si auth no devuelve el del usuario. */
  payerEmail?: string | null;
  /** Default: NEXT_PUBLIC_SITE_URL. */
  eventSourceUrl?: string | null;
}): Promise<SubscribeEventResult> {
  const { supabase, userId, commerceOrder, amount, flowOrder, payerEmail } = opts;

  try {
    // El subId sale del parser compartido (process-charge): el event_id tiene que
    // coincidir carácter a carácter con el `sub-${subscriptionId}` del browser.
    const subId = parseSubscriptionId(commerceOrder);
    if (!subId) return { sent: false, reason: "not_a_subscription_order" };

    // ¿Primer cobro? Se cuenta contra las filas de cargo (franco-sub-pay-*) de ESTE
    // user, EXCLUYENDO la del cargo actual → 0 previas = primer cobro.
    //
    // SEMÁNTICA DELIBERADA (no es bug — no lo "arregles"): el conteo es por user_id,
    // no por subscription_id. Un usuario que canceló y se resuscribe tiene filas de
    // cargo viejas → su NUEVA suscripción NO dispara Subscribe. Es intencional: un
    // resuscriptor NO es una adquisición nueva para las campañas de Meta (ya fue
    // conversión una vez). Si algún día se quiere contar resuscripciones como
    // conversión, cambiar el .eq(user_id) por un filtro por subscription_id — pero es
    // una decisión de producto, no un fix.
    //
    // El `.neq` NO cae en el trap de NULL de CLAUDE.md: el `.like` de la línea previa
    // ya descarta las filas con commerce_order NULL (LIKE sobre NULL da NULL), así que
    // acá no hay filas sin valor que el `.neq` pueda comerse. Sin ese `.like`, sí lo
    // habría — no reordenar los filtros.
    const currentChargeOrder = `franco-sub-pay-${flowOrder}`;
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("commerce_order", "franco-sub-pay-%")
      .neq("commerce_order", currentChargeOrder);

    if ((count ?? 0) !== 0) return { sent: false, reason: "not_first_charge" };

    // Email autoritativo el de auth; el payer de Flow queda de fallback.
    const { data: capiUser } = await supabase.auth.admin.getUserById(userId);

    // `value` = monto REAL cobrado por Flow. El browser manda el precio de catálogo
    // (no puede saber otra cosa: dispara en el alta, cuando todavía no hubo cargo) y
    // suele ganar la carrera, así que Meta normalmente registra ese. Ver la nota
    // completa en payments/return y register-callback.
    await sendMetaCapiEvent({
      eventName: "Subscribe",
      eventId: `sub-${subId}`,
      email: capiUser?.user?.email ?? payerEmail ?? null,
      value: amount,
      currency: "CLP",
      eventSourceUrl: opts.eventSourceUrl ?? SITE_URL,
    });

    return { sent: true };
  } catch (e) {
    console.error(
      "[sendSubscribeIfFirstCharge] excepción (no rompe el cobro):",
      e instanceof Error ? e.message : String(e)
    );
    return { sent: false, reason: "exception" };
  }
}
