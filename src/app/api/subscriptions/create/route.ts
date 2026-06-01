import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";
import { FLOW_PRODUCTS, type FlowProductKey } from "@/lib/flow-products";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Product key recurrente (plan10_mensual ... unlimited_anual) desde el body.
  const body = await request.json().catch(() => ({}));
  const product = (body as { product?: string }).product as FlowProductKey | undefined;
  const chosen = product ? FLOW_PRODUCTS[product] : undefined;

  if (!product || !chosen || chosen.kind !== "recurring") {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Check if user already has a Flow customer
    // Check if user already has a Flow customer
    const { data: credits, error: creditsError } = await admin
      .from("user_credits")
      .select("flow_customer_id, subscription_status")
      .eq("user_id", user.id)
      .single();

    if (creditsError && creditsError.code !== "PGRST116") {
      console.error("[subscriptions/create] Error fetching user_credits:", creditsError);
    }

    if (credits?.subscription_status === "active") {
      return NextResponse.json({ error: "Ya tienes una suscripción activa" }, { status: 400 });
    }

    let customerId = credits?.flow_customer_id;

    // Create Flow customer if needed
    if (!customerId) {
      // Create Flow customer
      const customerData = await flowPost("customer/create", {
        name: user.user_metadata?.nombre || user.email!.split("@")[0],
        email: user.email!,
        externalId: user.id,
      });
      // Customer created

      customerId = customerData.customerId;

      if (!customerId) {
        console.error("[subscriptions/create] No customerId in Flow response");
        return NextResponse.json({
          error: "Error al crear cliente en Flow",
          details: "Flow no retornó customerId",
        }, { status: 500 });
      }

      // Save customer ID
      if (credits) {
        await admin
          .from("user_credits")
          .update({ flow_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await admin.from("user_credits").insert({
          user_id: user.id,
          flow_customer_id: customerId,
        });
      }
    }

    // Persistir el plan elegido DESDE EL ORIGEN (sin créditos aún; los grants
    // llegan en el callback de pago). Esto deja active_plan/billing_period como
    // fuente de verdad para register-callback y payment-callback (mata el mapeo
    // por monto). La fila user_credits ya existe en todos los caminos previos.
    await admin
      .from("user_credits")
      .update({
        active_plan: chosen.plan ?? null,
        billing_period: chosen.billing ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Send customer to register their card
    // Register card
    const registerData = await flowPost("customer/register", {
      customerId,
      url_return: `${SITE_URL}/api/subscriptions/register-callback`,
    });
    // Register response received

    if (!registerData.url || !registerData.token) {
      console.error("[subscriptions/create] Missing url/token in register response");
      return NextResponse.json({
        error: "Error al registrar tarjeta",
        details: registerData?.message || "Flow no retornó URL de registro",
      }, { status: 500 });
    }

    return NextResponse.json({ url: `${registerData.url}?token=${registerData.token}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[subscriptions/create] Unhandled error:", message);
    return NextResponse.json({
      error: "Error al crear suscripción",
      details: message,
    }, { status: 500 });
  }
}
