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

import { createClient } from "@supabase/supabase-js";
import { FLOW_PRODUCTS, type FlowProduct, type FlowProductKey } from "@/lib/flow-products";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Aplica un producto recurrente al usuario tras un cargo OK:
 *  - unlimited → NO inserta grant; setea is_unlimited=true.
 *  - finito    → grantCredits(capacity).
 * En ambos casos setea active_plan / billing_period / subscription_ends_at.
 */
export async function applyPlanCredits(
  userId: string,
  product: FlowProduct,
  opts: GrantOpts = {}
): Promise<boolean> {
  if (!userId) return false;

  const supabase = createAdminClient();
  const now = new Date();
  const cycleMs = product.billing === "annual" ? ONE_YEAR_MS : ONE_MONTH_MS;
  const subscriptionEndsAt = new Date(now.getTime() + cycleMs).toISOString();

  let ok = true;

  if (!product.isUnlimited) {
    // Plan con capacidad finita → grant del ciclo (expira en 1 año).
    ok = await grantCredits(userId, product.plan ?? "plan", product.capacity ?? 0, opts);
  }

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
    console.error("[applyPlanCredits] user_credits update error:", error);
    return false;
  }
  return ok;
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
