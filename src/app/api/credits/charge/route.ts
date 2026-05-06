import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { chargeAnalysisCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";

/**
 * POST /api/credits/charge — Pre-cobro centralizado para flujo AMBAS.
 *
 * Backlog #3 cont.: el wizard cobra UNA vez antes de disparar los 2 POSTs
 * (LTR + STR) en paralelo. Ambos endpoints LTR/STR aceptan un `prepaidChargeId`
 * en el body que valida contra la fila `payments` creada acá. El primer POST
 * que llega marca el row como consumido (`consumed_at`,
 * `consumed_by_analysis_id`). El segundo POST detecta que el row ya está
 * consumido pero `payment_data.intent === 'both'` y procede sin re-cobrar.
 *
 * Para flujo single (LTR sólo o STR sólo), este endpoint NO se usa — los
 * endpoints cobran ellos mismos vía `chargeAnalysisCredit`.
 *
 * Auth: 401 si no hay user (solo registrados).
 * Admin: bypass del cobro real, igual emite chargeId y mode='subscription'
 * para que el wizard funcione uniformemente.
 */
function createSupabaseServer() {
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
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored
          }
        },
      },
    }
  );
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Intent = "ltr" | "str" | "both";
const VALID_INTENTS: readonly Intent[] = ["ltr", "str", "both"] as const;

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para crear un análisis" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const intent = body?.intent as Intent | undefined;
    if (!intent || !VALID_INTENTS.includes(intent)) {
      return NextResponse.json(
        { error: "intent inválido (debe ser ltr, str o both)" },
        { status: 400 },
      );
    }

    const isAdmin = isAdminUser(user.email);
    let mode: "welcome" | "paid" | "subscription";

    if (isAdmin) {
      // Admin no consume. Reportamos 'subscription' por simetría semántica.
      mode = "subscription";
    } else {
      const charge = await chargeAnalysisCredit(user.id, null);
      if (!charge.ok) {
        return NextResponse.json({ error: charge.message }, { status: 403 });
      }
      mode = charge.mode;
    }

    const chargeId = `charge-${randomUUID()}`;
    const admin = createAdminClient();
    const { error } = await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: chargeId,
      product: "analysis_charge",
      amount: 0,
      status: "paid",
      payment_data: { intent, mode },
    });

    if (error) {
      console.error("[credits/charge] payments insert error:", error);
      // El crédito ya fue descontado pero no pudimos persistir el chargeId.
      // El admin debe reembolsar manualmente. No reintentamos automáticamente
      // para no duplicar el cobro.
      return NextResponse.json(
        { error: "No se pudo registrar el cobro. Contacta a soporte." },
        { status: 500 },
      );
    }

    return NextResponse.json({ chargeId, mode });
  } catch (err) {
    console.error("[credits/charge] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
