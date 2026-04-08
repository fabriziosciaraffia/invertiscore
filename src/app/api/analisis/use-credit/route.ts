import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { randomUUID } from "crypto";

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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId } = await request.json();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify ownership
    const { data: analysis } = await admin
      .from("analisis")
      .select("id, user_id, is_premium")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const isAdmin = user.email === process.env.ADMIN_EMAIL;
    if (analysis.user_id && analysis.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Already premium — nothing to consume
    if (analysis.is_premium) {
      return NextResponse.json({ success: true, alreadyPremium: true });
    }

    // Consume credit (also marks analysis as premium). Returns false if no credits.
    const consumed = await consumeCredit(user.id, analysisId);
    if (!consumed) {
      return NextResponse.json(
        { error: "Sin créditos disponibles" },
        { status: 402 }
      );
    }

    // Record the credit usage as a $0 payment for accounting
    await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: `credit-${randomUUID()}`,
      product: "pro",
      amount: 0,
      status: "paid",
      analysis_id: analysisId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Use credit error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Error al usar crédito" }, { status: 500 });
  }
}
