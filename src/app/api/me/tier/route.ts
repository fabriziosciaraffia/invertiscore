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
        email: null,
      });
    }

    const [tier, creditsRow] = await Promise.all([
      getUserAccessLevel(user.id),
      supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", user.id)
        .maybeSingle()
        .then((r) => r.data?.credits ?? 0),
    ]);

    return NextResponse.json({
      tier,
      isAdmin: isAdminUser(user.email),
      credits: creditsRow,
      email: user.email ?? null,
    });
  } catch {
    return NextResponse.json({
      tier: "guest" as const,
      isAdmin: false,
      credits: 0,
      email: null,
    });
  }
}
