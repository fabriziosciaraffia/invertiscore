import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { randomUUID } from "crypto";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

const PRODUCTS: Record<string, { amount: number; subject: string }> = {
  pro: { amount: 4990, subject: "Franco Pro — Análisis Premium" },
  pack3: { amount: 9990, subject: "Franco Pack 3× — 3 Análisis Premium" },
};

function createAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { product, analysisId } = body as { product: string; analysisId?: string };

  if (!product || !PRODUCTS[product]) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  // Ownership check: if payment is for an analysis, verify the user owns it
  if (analysisId) {
    const admin = createAdminClient();
    const { data: analysis } = await admin
      .from("analisis")
      .select("user_id")
      .eq("id", analysisId)
      .single();

    if (analysis && analysis.user_id && analysis.user_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const { amount, subject } = PRODUCTS[product];
  const commerceOrder = `franco-${randomUUID()}`;

  try {
    // Validate env vars early
    if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) {
      console.error("Payment create: FLOW_API_KEY or FLOW_SECRET_KEY not set");
      return NextResponse.json({
        error: "Error de configuración del servidor",
        details: "Flow API keys not configured",
      }, { status: 500 });
    }

    // Create Flow payment order first
    const flowResponse = await flowPost("payment/create", {
      commerceOrder,
      subject,
      currency: "CLP",
      amount,
      email: user.email!,
      paymentMethod: 9,
      urlConfirmation: `${SITE_URL}/api/payments/confirm`,
      urlReturn: `${SITE_URL}/payments/return`,
    });

    if (!flowResponse.url || !flowResponse.token) {
      console.error("Flow create error — invalid response");
      return NextResponse.json({
        error: "Error al crear orden de pago",
        details: flowResponse?.message || JSON.stringify(flowResponse),
      }, { status: 500 });
    }

    // Insert pending payment record AFTER Flow succeeds (service_role bypasses RLS)
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("payments").insert({
      user_id: user.id,
      commerce_order: commerceOrder,
      flow_order: flowResponse.flowOrder || null,
      product,
      amount,
      status: "pending",
      analysis_id: analysisId || null,
    });

    if (insertError) {
      console.error("Payment insert error:", JSON.stringify(insertError));
      return NextResponse.json({
        error: "Error al registrar pago",
        details: insertError.message || insertError.code || String(insertError),
      }, { status: 500 });
    }

    // Return redirect URL
    const redirectUrl = `${flowResponse.url}?token=${flowResponse.token}`;
    return NextResponse.json({ url: redirectUrl });
  } catch (err: unknown) {
    console.error("Payment create error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({
      error: "Error al procesar pago",
      details: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
