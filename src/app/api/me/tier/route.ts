import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessLevel } from "@/lib/access";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";
import { anonCapDisponible } from "@/lib/api-helpers/anon-cap";
import { FUENTES_REGALO } from "@/lib/regalo-alta";

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        tier: "guest" as const,
        isAdmin: false,
        credits: 0,
        welcomeAvailable: false,
        email: null,
        activePlan: null,
        isUnlimited: false,
        nextCharge: null,
        // Cap anónimo (F2-2): esta ruta es la única superficie client-facing
        // que puede ver la cookie httpOnly. Señal de UX para el CTA del wizard;
        // el enforcement real vive en las rutas de creación.
        anonCapAvailable: anonCapDisponible(),
      });
    }

    // welcomeAvailable se deriva de welcome_credit_used (UX fix #2a):
    // tier="free" no distingue welcome-disponible vs welcome-usado. El wizard
    // necesita esa señal para mostrar el paywall correcto en Paso 3.
    // SALDO real = ledger (credit_grants) + legacy, vía getAvailableCredits (mismo
    // fix que /cuenta, /perfil y /analisis/[id]). welcome_credit_used sigue saliendo
    // del contador. El shape de la respuesta NO cambia: `credits` es number.
    const ahora = new Date().toISOString();
    const [tier, credits, welcomeRow, proximo] = await Promise.all([
      getUserAccessLevel(user.id),
      getAvailableCredits(user.id, supabase),
      supabase
        .from("user_credits")
        .select("welcome_credit_used, active_plan, is_unlimited, subscription_ends_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      // El lote que se gasta primero (el orden del cobro, credits-grant.ts › consumeCredit): si es un regalo, el aviso
      // antes de gastar lo dice (16-oct-2026).
      supabase
        .from("credit_grants")
        .select("source")
        .eq("user_id", user.id)
        .gt("remaining", 0)
        .or(`expires_at.is.null,expires_at.gt.${ahora}`)
        .order("expires_at", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      tier,
      isAdmin: isAdminUser(user.email),
      credits,
      welcomeAvailable: !(welcomeRow.data?.welcome_credit_used ?? false),
      proximoRegalo: !!proximo.data?.source && FUENTES_REGALO.has(proximo.data.source as string),
      email: user.email ?? null,
      // Estado del plan (lectura, NO gating). El front lo usa para distinguir un
      // suscriptor FINITO (plan10/plan50 → muestra saldo real, bloquea en 0) de un
      // ILIMITADO (is_unlimited → "Análisis ilimitados"). nextCharge = fin del ciclo
      // vigente (cuándo se renueva el saldo). Aditivo: consumidores previos ignoran
      // estos campos.
      activePlan: welcomeRow.data?.active_plan ?? null,
      isUnlimited: welcomeRow.data?.is_unlimited ?? false,
      nextCharge: welcomeRow.data?.subscription_ends_at ?? null,
    });
  } catch {
    return NextResponse.json({
      tier: "guest" as const,
      isAdmin: false,
      credits: 0,
      welcomeAvailable: false,
      email: null,
      activePlan: null,
      isUnlimited: false,
      nextCharge: null,
    });
  }
}
