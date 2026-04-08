import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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

export async function POST() {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert: mark onboarding as completed (creates row if missing)
    const { data: existing } = await admin
      .from("user_credits")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await admin
        .from("user_credits")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);
    } else {
      await admin.from("user_credits").insert({
        user_id: user.id,
        credits: 0,
        subscription_status: "none",
        onboarding_completed: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Complete onboarding error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
