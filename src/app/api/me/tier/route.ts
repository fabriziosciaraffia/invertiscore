import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessLevel } from "@/lib/access";
import { getAvailableCredits } from "@/lib/credits-grant";
import { isAdminUser } from "@/lib/admin";

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
      });
    }

    // welcomeAvailable se deriva de welcome_credit_used (UX fix #2a):
    // tier="free" no distingue welcome-disponible vs welcome-usado. El wizard
    // necesita esa señal para mostrar el paywall correcto en Paso 3.
    // SALDO real = ledger (credit_grants) + legacy, vía getAvailableCredits (mismo
    // fix que /cuenta, /perfil y /analisis/[id]). welcome_credit_used sigue saliendo
    // del contador. El shape de la respuesta NO cambia: `credits` es number.
    const [tier, credits, welcomeRow] = await Promise.all([
      getUserAccessLevel(user.id),
      getAvailableCredits(user.id, supabase),
      supabase
        .from("user_credits")
        .select("welcome_credit_used")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      tier,
      isAdmin: isAdminUser(user.email),
      credits,
      welcomeAvailable: !(welcomeRow.data?.welcome_credit_used ?? false),
      email: user.email ?? null,
    });
  } catch {
    return NextResponse.json({
      tier: "guest" as const,
      isAdmin: false,
      credits: 0,
      welcomeAvailable: false,
      email: null,
    });
  }
}
