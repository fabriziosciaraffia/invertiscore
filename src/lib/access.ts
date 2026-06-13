import { createClient } from "@supabase/supabase-js";
import { consumeCredit as consumeLedgerCredit, getAvailableCredits } from "@/lib/credits-grant";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * ¿La fila de user_credits da acceso por suscripción? true si:
 *  - 'active', o
 *  - 'past_due' con la gracia AÚN vigente (now < grace_ends_at), o
 *  - 'cancelled' con el ciclo pagado AÚN vigente (now < subscription_ends_at):
 *    el usuario canceló pero conserva acceso hasta fin del período que ya pagó.
 * past_due/cancelled vencidos (o sin la fecha respectiva) NO dan acceso. No
 * contempla is_unlimited — ese free pass se evalúa aparte en cada caller.
 */
export function hasSubscriptionAccess(row: {
  subscription_status?: string | null;
  grace_ends_at?: string | null;
  subscription_ends_at?: string | null;
}): boolean {
  if (row.subscription_status === "active") return true;
  if (
    row.subscription_status === "past_due" &&
    row.grace_ends_at &&
    new Date(row.grace_ends_at) > new Date()
  ) {
    return true;
  }
  if (
    row.subscription_status === "cancelled" &&
    row.subscription_ends_at &&
    new Date(row.subscription_ends_at) > new Date()
  ) {
    return true;
  }
  return false;
}

export type ChargeResult =
  | { ok: true; mode: "welcome" | "paid" | "subscription" }
  | { ok: false; reason: "no_credits" | "no_user"; message: string };

/**
 * Cobra 1 crédito al user para crear un análisis. Lógica:
 *   1. Si !userId → no_user
 *   2. Si subscription_status === 'active' → mode 'subscription' (sin descontar)
 *   3. Si !welcome_credit_used → mode 'welcome' (UPDATE condicional para
 *      evitar race entre 2 requests simultáneos)
 *   4. Si credits > 0 → mode 'paid' (UPDATE con gt(0) para no caer negativo)
 *   5. Else → no_credits
 *
 * El admin bypass NO se hace aquí. El endpoint debe filtrar admin con
 * isAdminUser(user.email) antes de invocar esta función.
 *
 * El endpoint también es responsable de marcar is_premium=true en el
 * análisis recién creado tras un ok=true. Esta función NO toca la tabla
 * analisis.
 *
 * analysisId queda en la firma para futuras necesidades (idempotencia,
 * audit log) — actualmente no se usa.
 */
export async function chargeAnalysisCredit(
  userId: string | null,
  analysisId: string | null,
): Promise<ChargeResult> {
  // analysisId queda en la firma para futura idempotencia/audit log; el linter
  // no acepta prefijo _ con la config del proyecto.
  void analysisId;
  if (!userId) {
    return {
      ok: false,
      reason: "no_user",
      message: "Debes iniciar sesión para crear un análisis",
    };
  }

  const supabase = createAdminClient();

  // Asegurar row (insert idempotente). Para usuarios nuevos que llegaron al
  // endpoint sin pasar por check-welcome/complete-onboarding aún.
  await supabase
    .from("user_credits")
    .upsert(
      {
        user_id: userId,
        credits: 0,
        subscription_status: "none",
        welcome_credit_used: false,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  const { data: row } = await supabase
    .from("user_credits")
    .select("credits, subscription_status, welcome_credit_used, is_unlimited, grace_ends_at, subscription_ends_at")
    .eq("user_id", userId)
    .single();

  if (!row) {
    // Defensivo: el upsert+select debería traer row siempre.
    return {
      ok: false,
      reason: "no_credits",
      message: "Necesitas un crédito para crear un análisis",
    };
  }

  // Subscriber con acceso (active o past_due en gracia) o plan ilimitado → free
  // pass. NO descuenta credits ni toca welcome.
  if (hasSubscriptionAccess(row) || row.is_unlimited) {
    return { ok: true, mode: "subscription" };
  }

  // Welcome credit (primer análisis del registrado): UPDATE condicional.
  // La cláusula .eq('welcome_credit_used', false) garantiza que solo una
  // request gane la carrera si dos llegan simultáneas. También marcamos
  // onboarding_completed=true (UX fix #1b): si el user usa el welcome via
  // análisis está onboardeado de facto — no debería volver a OnboardingClient.
  if (!row.welcome_credit_used) {
    const { data: claimed } = await supabase
      .from("user_credits")
      .update({
        welcome_credit_used: true,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("welcome_credit_used", false)
      .select()
      .maybeSingle();
    if (claimed) {
      return { ok: true, mode: "welcome" };
    }
    // Race perdida: otra request consumió el welcome. Caer a paid.
  }

  // Crédito comprado — primero el ledger (credit_grants), FIFO por expiración.
  if (await consumeLedgerCredit(userId)) {
    return { ok: true, mode: "paid" };
  }

  // Legacy: contador user_credits.credits (compras pro/pack3 previas a la migración).
  if (row.credits > 0) {
    const { data: paid } = await supabase
      .from("user_credits")
      .update({ credits: row.credits - 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .gt("credits", 0)
      .select()
      .maybeSingle();
    if (paid) {
      return { ok: true, mode: "paid" };
    }
    // Race perdida: otra request consumió el último crédito.
  }

  return {
    ok: false,
    reason: "no_credits",
    message: "Necesitas un crédito para crear un análisis",
  };
}

export async function getUserAccessLevel(
  userId: string | null
): Promise<"guest" | "free" | "premium" | "subscriber"> {
  if (!userId) return "guest";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_credits")
    .select("credits, subscription_status, grace_ends_at, subscription_ends_at")
    .eq("user_id", userId)
    .single();

  if (!data) return "free";
  if (hasSubscriptionAccess(data)) return "subscriber";
  // Saldo real = ledger vivo + legacy. Antes leía solo data.credits (contador
  // legacy = 0 en el modelo ledger) y devolvía "free" a quien sí tenía saldo en
  // credit_grants. getAvailableCredits incluye el contador legacy, así que cubre
  // ambos modelos.
  if ((await getAvailableCredits(userId, supabase)) > 0) return "premium";
  return "free";
}

export async function consumeCredit(
  userId: string,
  analysisId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Check if analysis is already premium
  const { data: analysis } = await supabase
    .from("analisis")
    .select("is_premium")
    .eq("id", analysisId)
    .single();

  if (analysis?.is_premium) return true;

  // Check subscription
  const { data: credits } = await supabase
    .from("user_credits")
    .select("credits, subscription_status, is_unlimited, grace_ends_at, subscription_ends_at")
    .eq("user_id", userId)
    .single();

  if (!credits) return false;

  // Subscribers con acceso (active o past_due en gracia) / ilimitado no consumen.
  if (hasSubscriptionAccess(credits) || credits.is_unlimited) {
    await supabase.from("analisis").update({ is_premium: true }).eq("id", analysisId);
    return true;
  }

  // Ledger primero (credit_grants), FIFO por expiración.
  if (await consumeLedgerCredit(userId)) {
    await supabase.from("analisis").update({ is_premium: true }).eq("id", analysisId);
    return true;
  }

  // Legacy: contador user_credits.credits.
  if (credits.credits > 0) {
    const { error: creditError } = await supabase
      .from("user_credits")
      .update({
        credits: credits.credits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (creditError) return false;

    await supabase.from("analisis").update({ is_premium: true }).eq("id", analysisId);
    return true;
  }

  return false;
}
