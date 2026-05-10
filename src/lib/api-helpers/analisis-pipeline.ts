// Helpers compartidos entre /api/analisis (LTR) y /api/analisis/short-term
// (STR). Extraídos para reducir duplicación: ~80 líneas idénticas viven en
// ambos endpoints.
//
// Patrón:
//   1. createSupabaseServer()      — server-side Supabase client con cookies.
//   2. createPaymentsAdminClient() — admin client para validar/claim payments.
//   3. requireAuthenticatedUser()  — auth gate, returns 401 NextResponse if no user.
//   4. ensureCreditCharged()       — handle prepaid charge OR cobro normal,
//                                    con admin bypass.
//   5. markPremiumAndClaimPrepaid()— post-insert: mark is_premium=true +
//                                    claim del prepaid charge si aplica.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";

// ─── Clients ───────────────────────────────────────────

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignored in route handler
          }
        },
      },
    },
  );
}

export function createPaymentsAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Auth gate ─────────────────────────────────────────

export interface AuthOk {
  ok: true;
  user: User;
}
export interface AuthErr {
  ok: false;
  response: NextResponse;
}

/**
 * Resuelve el user autenticado del request o devuelve 401.
 * El caller hace `if (!auth.ok) return auth.response;` y luego usa `auth.user`.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<AuthOk | AuthErr> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}

// ─── Credit charge ─────────────────────────────────────

export interface ChargeOk {
  ok: true;
  /** True cuando llegamos PRIMERO al claim del prepaid charge (flujo AMBAS).
   * Caller debe llamar markPremiumAndClaimPrepaid con prepaidNeedClaim=true. */
  prepaidNeedClaim: boolean;
}
export interface ChargeErr {
  ok: false;
  response: NextResponse;
}

/**
 * Maneja el cobro de crédito unificado:
 *   - Si viene `prepaidChargeId`: valida contra payments. Permite consume si
 *     intent='both'. Marca prepaidNeedClaim=true si somos los primeros.
 *   - Si NO viene prepaidChargeId y NO es admin: cobra crédito vía
 *     `chargeAnalysisCredit`.
 *   - Si NO viene y ES admin: bypass, no cobra.
 */
export async function ensureCreditCharged(opts: {
  user: User;
  prepaidChargeId?: string | null;
}): Promise<ChargeOk | ChargeErr> {
  const { user, prepaidChargeId } = opts;
  const isAdmin = isAdminUser(user.email);

  if (prepaidChargeId) {
    const paymentsAdmin = createPaymentsAdminClient();
    const { data: charge } = await paymentsAdmin
      .from("payments")
      .select("payment_data, consumed_at")
      .eq("commerce_order", prepaidChargeId)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle();

    if (!charge) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge inválido o no encontrado" },
          { status: 403 },
        ),
      };
    }

    if (charge.consumed_at === null) {
      return { ok: true, prepaidNeedClaim: true };
    }

    // Ya consumido: solo permitido si intent='both' (segundo análisis del flujo AMBAS).
    const intent = (charge.payment_data as { intent?: string } | null)?.intent;
    if (intent !== "both") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Charge ya consumido" },
          { status: 403 },
        ),
      };
    }
    return { ok: true, prepaidNeedClaim: false };
  }

  if (!isAdmin) {
    const charge = await chargeAnalysisCredit(user.id, null);
    if (!charge.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: charge.message }, { status: 403 }),
      };
    }
  }
  return { ok: true, prepaidNeedClaim: false };
}

// ─── Post-insert: premium + claim ──────────────────────

/**
 * Marca el análisis como premium y, si el caller llegó primero al claim del
 * prepaid charge (prepaidNeedClaim=true), lo claim-ea de forma idempotente.
 * El UPDATE con `.is('consumed_at', null)` garantiza que el segundo POST del
 * flujo AMBAS no sobrescribe el claim del primero.
 */
export async function markPremiumAndClaimPrepaid(opts: {
  dbClient: SupabaseClient;
  analysisId: string;
  prepaidChargeId?: string | null;
  prepaidNeedClaim: boolean;
}): Promise<void> {
  const { dbClient, analysisId, prepaidChargeId, prepaidNeedClaim } = opts;

  await dbClient.from("analisis").update({ is_premium: true }).eq("id", analysisId);

  if (prepaidChargeId && prepaidNeedClaim) {
    const paymentsAdmin = createPaymentsAdminClient();
    await paymentsAdmin
      .from("payments")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_analysis_id: analysisId,
      })
      .eq("commerce_order", prepaidChargeId)
      .is("consumed_at", null);
  }
}
