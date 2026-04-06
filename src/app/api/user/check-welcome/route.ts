import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ sent: false });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: credits } = await supabaseAdmin
      .from("user_credits")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!credits) {
      // Usuario nuevo — crear registro y enviar email
      await supabaseAdmin.from("user_credits").insert({
        user_id: user.id,
        credits: 0,
        subscription_status: "none",
      });

      const name = user.user_metadata?.full_name || user.user_metadata?.name || "";
      await sendWelcomeEmail(user.email, name);
      // Welcome email sent

      return NextResponse.json({ sent: true, isNew: true });
    }

    return NextResponse.json({ sent: false, isNew: false });
  } catch (error) {
    console.error("Check welcome error:", error);
    return NextResponse.json({ sent: false });
  }
}
