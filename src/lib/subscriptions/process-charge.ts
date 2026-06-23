/**
 * Helper compartido para procesar un CARGO de suscripción confirmado por Flow.
 * Lo usan tanto el webhook (subscriptions/payment-callback) como el cron
 * reconciler — una sola fuente de verdad para: mapeo → fila → grant → boleta.
 *
 * Modelo "el grant sigue al cobro" (Opción C): el alta (register-callback) ya NO
 * otorga; el grant del período lo da ESTE helper cuando el cobro se confirma.
 *
 * Idempotencia en tres capas, todas keyed por el flowOrder del cargo:
 *  1) Fila: commerce_order = `franco-sub-pay-<flowOrder>` es UNIQUE en payments →
 *     un reenvío del mismo cargo choca (23505) y recuperamos la fila existente.
 *  2) Grant: se otorga SOLO si no existe ya un lote credit_grants ligado a este
 *     payment_id. Retry-safe sin period_key — bajo C un cargo = un período, y el
 *     único otorgante es el cobro (el alta no compite). Ver nota del huérfano.
 *  3) Boleta: emitirBoletaDTE deduplica por payment_id (índice parcial + check).
 *
 * NUNCA otorga dos veces el mismo período: distintos flowOrders = distintos cargos
 * = distintos períodos. (Caveat operativo: la fila huérfana ya reconciliada de la
 * canary — franco-sub-pay-172969809 — tiene su grant del ALTA pre-C y la fila SIN
 * grant; el reconciler debe escanear solo fechas recientes para no re-otorgarla.)
 */
import { createClient } from "@supabase/supabase-js";
import {
  grantCredits,
  recurringProductByPlan,
  recurringProductByAmount,
  refreshSubscriptionEndsAt,
} from "@/lib/credits-grant";
import { emitirBoletaDTE, type PaymentForDTE } from "@/lib/openfactura/client";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// commerceOrder de un cargo de suscripción: "sus_<subId>_<invoiceId>_<ts>".
// Capturamos el prefijo `sus_<subId>` para mapear contra user_credits.subscription_id.
const SUB_ID_RE = /^(sus_[a-zA-Z0-9]+)_/;

// Cutoff del modelo "grant sigue al cobro" (Opción C). Cargos ANTERIORES a esta
// fecha son PRE-C: su grant del mes 1 ya lo dio el alta (register-callback viejo),
// así que NO se re-otorga acá (evita doble grant de la canary y de cualquier sub
// pre-C). Solo gatea el GRANT — fila y boleta se aseguran igual (idempotentes), lo
// que permite backfillear boletas faltantes sin tocar créditos. Se setea al
// desplegar C (ISO; ej. el día del deploy).
const GRANT_CUTOFF = process.env.SUBSCRIPTION_GRANT_CUTOFF ?? null;

// Log de arranque (cada cold-start): confirma CÓMO parseó el cutoff sin esperar un
// cobro — la env var es Sensitive y no se ve en el panel. Guardado contra Invalid
// Date: new Date(...).toISOString() LANZA si el valor no parsea, y no queremos romper
// el import del módulo justo en el caso de typo que este log busca exponer.
console.log(
  "[process-charge] GRANT_CUTOFF →",
  GRANT_CUTOFF
    ? Number.isNaN(new Date(GRANT_CUTOFF).getTime())
      ? `INVALID(${GRANT_CUTOFF})`
      : new Date(GRANT_CUTOFF).toISOString()
    : "UNSET"
);

/**
 * Decide si se PUEDE otorgar grant para un cargo, según el cutoff de C.
 *
 * FAIL-SAFE: el cutoff es OBLIGATORIO para otorgar. Si `SUBSCRIPTION_GRANT_CUTOFF`
 * no está seteada → NO se otorga (reason 'cutoff_unset'). Un olvido de env var causa
 * "grants suspendidos" (visible en logs, corregible, sin daño tributario) en vez de
 * "doble grant" (silencioso, daño al ledger). Lo mismo si falta/no parsea la fecha
 * del cargo (en uso real el webhook pasa requestDate y el reconciler getPayments →
 * nunca falta; si falta, es un bug y preferimos suspender, no arriesgar doble grant).
 *
 * Con cutoff + fecha válidos: se otorga solo si el cargo es POSTERIOR al cutoff
 * (post-C); los pre-C ya recibieron su grant del alta.
 */
function grantGate(
  chargeDate: string | null | undefined
): { allow: boolean; reason?: string } {
  if (!GRANT_CUTOFF) return { allow: false, reason: "cutoff_unset" };
  if (!chargeDate) return { allow: false, reason: "charge_date_missing" };
  const t = new Date(chargeDate).getTime();
  const c = new Date(GRANT_CUTOFF).getTime();
  if (Number.isNaN(t) || Number.isNaN(c)) return { allow: false, reason: "date_unparseable" };
  if (t < c) return { allow: false, reason: "pre_cutoff" };
  return { allow: true };
}

export type ProcessChargeInput = {
  /** Nro de orden de Flow del cargo (clave de dedupe de las 3 capas). */
  flowOrder: number;
  /** commerceOrder de Flow ("sus_<subId>_<invoiceId>_<ts>"). */
  commerceOrder: string;
  /** Monto cobrado (IVA incluido). */
  amount: number;
  /** Estado Flow del cargo (se procesa solo 2 = pagada). */
  status: number;
  /** Email del pagador (fallback para el correo de la boleta). */
  payer?: string | null;
  /** Fecha del cargo en Flow (requestDate). Decide el cutoff pre-C del grant. */
  chargeDate?: string | null;
  /** Payload crudo de Flow → se guarda en payments.payment_data. */
  flowData?: unknown;
};

export type ProcessChargeResult = {
  ok: boolean;
  /** true si este llamado insertó un nuevo lote de créditos. */
  granted: boolean;
  /** true si la boleta quedó emitida (folio asignado) en este llamado o ya estaba. */
  emitted: boolean;
  reason?: string;
};

/**
 * Procesa un cargo de suscripción pagado: asegura fila + grant (idempotente por
 * payment_id) + boleta. No lanza por errores esperables: devuelve { ok:false, reason }.
 */
export async function processSubscriptionCharge(
  input: ProcessChargeInput
): Promise<ProcessChargeResult> {
  const { flowOrder, commerceOrder, amount, status, payer, chargeDate, flowData } = input;
  const fail = (reason: string): ProcessChargeResult => ({
    ok: false,
    granted: false,
    emitted: false,
    reason,
  });

  // 1. Guards. status_not_paid / amount_invalid son benignos (webhook pendiente,
  // etc.) → no loguean para no hacer ruido. no_flow_order SÍ es anomalía (un cargo
  // pagado siempre trae flowOrder) → log.
  if (Number(status) !== 2) return fail("status_not_paid");
  if (!Number.isFinite(amount) || amount <= 0) return fail("amount_invalid");
  if (!flowOrder) {
    console.error(
      "[processSubscriptionCharge] cargo pagado SIN flowOrder; commerceOrder:",
      commerceOrder
    );
    return fail("no_flow_order");
  }

  const supabase = createAdminClient();

  // 2. Mapeo → user_id: parsear sus_<subId> del commerceOrder y resolver contra
  // user_credits.subscription_id (fuente de verdad del dueño de la suscripción).
  // Los cargos de suscripción SIEMPRE traen el prefijo sus_, así que el parse cubre
  // el 100% de los casos reales; el `payer` queda para el correo de la boleta.
  // Un cargo sin sus_ o sin sub mapeable es una ANOMALÍA → siempre se loguea
  // (nunca falla en silencio).
  const m = SUB_ID_RE.exec(commerceOrder || "");
  if (!m) {
    console.error(
      "[processSubscriptionCharge] commerceOrder sin patrón sus_ (anomalía):",
      commerceOrder,
      "flowOrder:",
      flowOrder
    );
    return fail("commerce_order_not_subscription");
  }

  const { data: uc } = await supabase
    .from("user_credits")
    .select("user_id, active_plan, billing_period")
    .eq("subscription_id", m[1])
    .maybeSingle();

  const userId = uc?.user_id ?? null;
  if (!userId) {
    console.error(
      "[processSubscriptionCharge] sub sin user_credits mapeable:",
      m[1],
      "flowOrder:",
      flowOrder
    );
    return fail("user_unresolved");
  }

  // 3. Resolver producto/key: plan persistido (preferido) → fallback por monto.
  const match =
    recurringProductByPlan(uc?.active_plan, uc?.billing_period) ??
    recurringProductByAmount(amount);
  const productKey = match?.key ?? "subscription";

  const commerceOrderRow = `franco-sub-pay-${flowOrder}`;

  // 4. Ensure fila (insert-first; commerce_order UNIQUE deduplica).
  let paymentId: string | null = null;
  const { data: inserted, error: insertErr } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      commerce_order: commerceOrderRow,
      product: productKey,
      amount,
      status: "paid",
      flow_order: flowOrder,
      flow_status: status,
      payment_data: flowData ?? null,
    })
    .select("id")
    .single();

  if (insertErr) {
    // 23505 = unique_violation → la fila ya existe (reenvío / ya procesado).
    if (insertErr.code === "23505") {
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("commerce_order", commerceOrderRow)
        .maybeSingle();
      paymentId = existing?.id ?? null;
    } else {
      console.error("[processSubscriptionCharge] payments insert error:", insertErr);
      return fail("payments_insert_error");
    }
  } else {
    paymentId = inserted?.id ?? null;
  }
  if (!paymentId) return fail("no_payment_id");

  // freshFila = true solo si ESTE llamado insertó la fila (no un 23505/reproceso).
  // El camino de error de DB no-23505 ya retornó arriba (fail), así que acá freshFila
  // distingue limpio (a) inserción nueva de (b) fila ya existente.
  const freshFila = !insertErr;

  // gate del cutoff: calculado UNA vez (lo usan el refresh de ends_at y el grant).
  const gate = grantGate(chargeDate);

  // 4.5 Refresh del fin de período pagado = now + ciclo. Sigue al COBRO, NO al grant:
  // se hace aunque el grant quede suspendido (cutoff_unset) — el período igual avanza.
  // Solo en la PRIMERA vez que se procesa el cargo (freshFila) → un único write por
  // cargo, sin drift por reprocesos del cron. Excluye cargos genuinamente pre-C
  // (pre_cutoff: no extender períodos viejos; protege la canary). Sin producto resuelto
  // no sabemos el ciclo → se omite.
  if (freshFila && match && gate.reason !== "pre_cutoff") {
    await refreshSubscriptionEndsAt(userId, match.product);
  }

  // 5. Ensure grant. Cuatro guardas, en orden:
  //  (a) grantGate (cutoff): FAIL-SAFE. Sin SUBSCRIPTION_GRANT_CUTOFF → NO se otorga
  //      (suspendido por seguridad). Con cutoff: solo cargos post-C (los pre-C ya
  //      recibieron su grant del alta → protege canary y subs pre-C).
  //  (b) Solo planes finitos: unlimited cubre el acceso con is_unlimited (sin lote).
  //  (c) Producto resuelto: sin él no inventamos capacity.
  //  (d) Idempotencia por payment_id (retry-safe sin period_key): solo otorga si no
  //      hay ya un lote ligado a ESTE payment_id.
  // Fila + boleta se aseguran SIEMPRE (idempotentes), corra o no el grant.
  let granted = false;
  if (!gate.allow) {
    console.error(
      gate.reason === "cutoff_unset"
        ? `[processSubscriptionCharge] SUBSCRIPTION_GRANT_CUTOFF no configurado: grant SUSPENDIDO por seguridad (fila+boleta igual). flowOrder: ${flowOrder}`
        : `[processSubscriptionCharge] grant no otorgado (${gate.reason}); fila+boleta igual. flowOrder: ${flowOrder} cutoff: ${GRANT_CUTOFF}`
    );
  } else if (!match) {
    console.error(
      "[processSubscriptionCharge] producto no resuelto (sin grant) para monto:",
      amount,
      "commerceOrder:",
      commerceOrder
    );
  } else if (!match.product.isUnlimited) {
    const { data: existingGrant } = await supabase
      .from("credit_grants")
      .select("id")
      .eq("payment_id", paymentId)
      .limit(1)
      .maybeSingle();

    if (!existingGrant) {
      granted = await grantCredits(
        userId,
        match.key,
        match.product.capacity ?? 0,
        { paymentId }
      );
    }
  }

  // 6. Ensure boleta (idempotente por payment_id). Email: el de auth (autoritativo,
  // mismo criterio que payment-callback) con fallback al payer de Flow.
  let emitted = false;
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email ?? payer ?? null;
  if (userEmail) {
    const payment: PaymentForDTE = {
      id: paymentId,
      user_id: userId,
      product: productKey,
      amount,
      commerce_order: commerceOrderRow,
      flow_order: flowOrder,
      quantity: 1,
    };
    const result = await emitirBoletaDTE({ payment, userEmail });
    // skipped (kill-switch) no es error: emitted queda false sin reason de fallo.
    emitted = result.ok;
    if (!result.ok && !result.skipped) {
      console.error("[processSubscriptionCharge] emisión boleta falló:", result.error);
    }
  } else {
    console.error("[processSubscriptionCharge] sin email para boleta, user:", userId);
  }

  return { ok: true, granted, emitted };
}
