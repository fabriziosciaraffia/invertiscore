import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessLevel } from "@/lib/access";
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
    const [tier, creditsInfo] = await Promise.all([
      getUserAccessLevel(user.id),
      supabase
        .from("user_credits")
        .select("credits, welcome_credit_used")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => ({
          credits: r.data?.credits ?? 0,
          welcomeAvailable: !(r.data?.welcome_credit_used ?? false),
        })),
    ]);

    return NextResponse.json({
      tier,
      isAdmin: isAdminUser(user.email),
      credits: creditsInfo.credits,
      welcomeAvailable: creditsInfo.welcomeAvailable,
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
