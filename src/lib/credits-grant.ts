/**
 * Ledger de créditos (Phase 2.39) — otorgamiento y consumo FIFO sobre la tabla
 * credit_grants. Server-only: credit_grants tiene RLS sin policy de INSERT, así
 * que SIEMPRE usa el cliente service-role (mismo patrón inline del resto del
 * proyecto; no existe un helper service-role compartido).
 *
 * Modelo:
 *  - single / planes con capacidad finita → un grant por ciclo (expira en 1 año).
 *  - unlimited → NO hay grant; se marca user_credits.is_unlimited=true.
 *  - consumo: FIFO por expires_at sobre lotes vivos; is_unlimited = free pass.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FLOW_PRODUCTS, type FlowProduct, type FlowProductKey } from "@/lib/flow-products";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Suma 1 mes calendario con clamp de fin de mes: si el día se desborda (31 ene
 * + 1 mes caería en mar), retrocede al último día del mes destino (28/29 feb).
 * Evita el rollover silencioso de Date.setMonth. Compartido por register-callback
 * (mes 1 → fecha del mes 2) y el cron de renovación mensual (meses 2-12).
 */
export function addOneMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  if (r.getDate() < day) r.setDate(0);
  return r;
}

export type GrantOpts = {
  /** payments.id que originó el grant (FK). null para grants no transaccionales. */
  paymentId?: string | null;
  /** true = grant sin caducidad (expires_at NULL). default: expira en 1 año. */
  noExpire?: boolean;
};

/**
 * Inserta un lote de créditos en el ledger. Devuelve true si insertó.
 * No toca user_credits (eso lo hace applyPlanCredits para suscripciones).
 */
export async function grantCredits(
  userId: string,
  source: string,
  amount: number,
  opts: GrantOpts = {}
): Promise<boolean> {
  if (!userId || amount <= 0) return false;

  const supabase = createAdminClient();
  const now = new Date();
  const expiresAt = opts.noExpire
    ? null
    : new Date(now.getTime() + ONE_YEAR_MS).toISOString();

  const { error } = await supabase.from("credit_grants").insert({
    user_id: userId,
    amount,
    remaining: amount,
    source,
    payment_id: opts.paymentId ?? null,
    granted_at: now.toISOString(),
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[grantCredits] insert error:", error);
    return false;
  }
  return true;
}

/**
 * Setea SOLO los campos de PLAN en user_credits (la "activación"), sin otorgar
 * grant: active_plan, billing_period, is_unlimited, subscription_ends_at.
 *
 * Separado de applyPlanCredits para el modelo "el grant sigue al cobro" (Opción C):
 * el alta (register-callback) activa la suscripción con esto, y el grant del ciclo
 * lo otorga el cobro confirmado (payment-callback / cron reconciler) vía
 * processSubscriptionCharge. Así el alta no puede duplicar el grant del mes 1.
 *
 * Devuelve true si el UPDATE no falló. (No necesita `key`: los campos salen todos
 * de `product`; el `key` solo se usa como source del grant, que acá no ocurre.)
 */
export async function setPlanFields(
  userId: string,
  product: FlowProduct
): Promise<boolean> {
  if (!userId) return false;

  const supabase = createAdminClient();
  const now = new Date();
  const cycleMs = product.billing === "annual" ? ONE_YEAR_MS : ONE_MONTH_MS;
  const subscriptionEndsAt = new Date(now.getTime() + cycleMs).toISOString();

  const { error } = await supabase
    .from("user_credits")
    .update({
      active_plan: product.plan ?? null,
      billing_period: product.billing ?? null,
      is_unlimited: product.isUnlimited === true,
      subscription_ends_at: subscriptionEndsAt,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[setPlanFields] user_credits update error:", error);
    return false;
  }
  return true;
}

/**
 * Aplica un producto recurrente al usuario tras un cargo OK:
 *  - unlimited → NO inserta grant; setea is_unlimited=true.
 *  - finito    → grantCredits(capacity).
 * En ambos casos setea los campos de plan (vía setPlanFields).
 *
 * `key` es la product key completa del catálogo (plan10_mensual, plan10_annual,
 * …). Se usa como `source` del grant para auditoría (distingue mensual de anual
 * en el ledger). product.plan es solo la base ("plan10"), insuficiente.
 *
 * @deprecated (modelo C) SIN callers: register-callback ahora usa setPlanFields y
 * payment-callback usa processSubscriptionCharge. El grant de una suscripción lo
 * otorga el COBRO confirmado (processSubscriptionCharge, idempotente por payment_id),
 * NO el alta. NO re-introducir esta llamada en register-callback: el alta volvería a
 * otorgar el mes 1 y, sumado al grant del cobro, causaría DOBLE GRANT del mes 1. Se
 * conserva a propósito (no se borra) por si un flujo futuro la necesita con esa salvedad.
 */
export async function applyPlanCredits(
  userId: string,
  product: FlowProduct,
  key: FlowProductKey,
  opts: GrantOpts = {}
): Promise<boolean> {
  if (!userId) return false;

  let ok = true;
  if (!product.isUnlimited) {
    // Plan con capacidad finita → grant del ciclo (expira en 1 año).
    // source = key completa del catálogo (mensual/anual), no la base product.plan.
    ok = await grantCredits(userId, key, product.capacity ?? 0, opts);
  }

  const fieldsOk = await setPlanFields(userId, product);
  return ok && fieldsOk;
}

/**
 * Consume 1 crédito FIFO del ledger. Devuelve true si consumió (o si el user es
 * is_unlimited → free pass sin tocar nada). false si no hay lote vivo.
 * No marca is_premium en analisis — eso es responsabilidad del caller.
 */
export async function consumeCredit(userId: string): Promise<boolean> {
  if (!userId) return false;

  const supabase = createAdminClient();

  // Free pass: ilimitado no consume.
  const { data: uc } = await supabase
    .from("user_credits")
    .select("is_unlimited")
    .eq("user_id", userId)
    .maybeSingle();
  if (uc?.is_unlimited) return true;

  // FIFO: el lote vivo más próximo a expirar (NULL = no expira, va al final).
  const nowIso = new Date().toISOString();
  const { data: grant } = await supabase
    .from("credit_grants")
    .select("id, remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!grant) return false;

  // UPDATE condicional (gt remaining 0) para no caer negativo ante carreras.
  const nextRemaining = grant.remaining - 1;
  const { data: updated } = await supabase
    .from("credit_grants")
    .update({
      remaining: nextRemaining,
      consumed: nextRemaining === 0,
    })
    .eq("id", grant.id)
    .gt("remaining", 0)
    .select()
    .maybeSingle();

  return !!updated;
}

/**
 * Saldo disponible para MOSTRAR al usuario (solo-lectura, NO consume):
 *   SUM(remaining) de lotes VIVOS del ledger + contador legacy user_credits.credits.
 *
 * El criterio de "lote vivo" es idéntico al de consumeCredit arriba (líneas 151-159):
 *   remaining > 0  AND  (expires_at IS NULL OR expires_at > now())
 * Así lo mostrado coincide exactamente con lo que el gating realmente puede cobrar.
 * (consumeCredit toma de a uno por FIFO; aquí sumamos todos los lotes vivos.)
 *
 * Recibe el client por parámetro: la página ya tiene uno (anon server client en
 * cuenta/perfil — la policy credit_grants_select_own permite leer los propios lotes;
 * service-role en admin). No crea un admin client extra ni arriesga filtrarlo al
 * bundle de cliente. Supabase JS no expone SUM sin RPC, así que sumamos en JS (el
 * volumen de lotes por usuario es chico). Ante error de query loguea y suma lo que
 * pudo (degradación suave: nunca rompe la página).
 */
export async function getAvailableCredits(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  if (!userId) return 0;

  const nowIso = new Date().toISOString();

  // Ledger: lotes vivos (mismo filtro que consumeCredit).
  const { data: grants, error: grantsErr } = await supabase
    .from("credit_grants")
    .select("remaining")
    .eq("user_id", userId)
    .gt("remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (grantsErr) {
    console.error("[getAvailableCredits] credit_grants query error:", grantsErr);
  }

  const ledger = (grants ?? []).reduce(
    (sum, g) => sum + ((g.remaining as number) ?? 0),
    0
  );

  // Legacy: contador user_credits.credits (compras pro/pack3 pre-migración).
  const { data: uc, error: ucErr } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (ucErr) {
    console.error("[getAvailableCredits] user_credits query error:", ucErr);
  }

  return ledger + (uc?.credits ?? 0);
}

/**
 * Variante BATCH de getAvailableCredits para listados (admin) — evita el N+1 de
 * llamar getAvailableCredits por usuario. UNA sola query al ledger para todos los
 * userIds. Devuelve Map<userId, saldoLedger> (solo la parte del ledger); el caller
 * suma su propio legacy user_credits.credits, que en admin ya viene en mano.
 * Mismo criterio de lote vivo que consumeCredit/getAvailableCredits.
 */
export async function getLedgerBalances(
  userIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (userIds.length === 0) return balances;

  const nowIso = new Date().toISOString();
  const { data: grants, error } = await supabase
    .from("credit_grants")
    .select("user_id, remaining")
    .in("user_id", userIds)
    .gt("remaining", 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (error) {
    console.error("[getLedgerBalances] credit_grants query error:", error);
    return balances;
  }

  for (const g of grants ?? []) {
    const uid = g.user_id as string;
    balances.set(uid, (balances.get(uid) ?? 0) + ((g.remaining as number) ?? 0));
  }
  return balances;
}

/** Reverse-lookup: mapea el monto cobrado por Flow a un producto recurrente. */
export function recurringProductByAmount(
  amount: number
): { key: FlowProductKey; product: FlowProduct } | null {
  for (const [key, product] of Object.entries(FLOW_PRODUCTS) as [
    FlowProductKey,
    FlowProduct
  ][]) {
    if (product.kind === "recurring" && product.amount === amount) {
      return { key, product };
    }
  }
  return null;
}

/**
 * Resuelve el producto recurrente desde el plan persistido en user_credits
 * (active_plan = 'plan10'|'plan50'|'unlimited' + billing_period = 'monthly'|'annual').
 * Fuente de verdad preferida sobre el monto: se setea al iniciar la suscripción.
 */
export function recurringProductByPlan(
  activePlan: string | null | undefined,
  billing: string | null | undefined
): { key: FlowProductKey; product: FlowProduct } | null {
  if (!activePlan || !billing) return null;
  for (const [key, product] of Object.entries(FLOW_PRODUCTS) as [
    FlowProductKey,
    FlowProduct
  ][]) {
    if (
      product.kind === "recurring" &&
      product.plan === activePlan &&
      product.billing === billing
    ) {
      return { key, product };
    }
  }
  return null;
}
