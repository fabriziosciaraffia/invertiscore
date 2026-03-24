import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { flowPost } from "@/lib/flow";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Check if user already has a Flow customer
    console.log("[subscriptions/create] Checking user_credits for user:", user.id);
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
      console.log("[subscriptions/create] Creating Flow customer for:", user.email);
      const customerData = await flowPost("customer/create", {
        name: user.user_metadata?.nombre || user.email!.split("@")[0],
        email: user.email!,
        externalId: user.id,
      });
      console.log("[subscriptions/create] Flow customer response:", JSON.stringify(customerData));

      customerId = customerData.customerId;

      if (!customerId) {
        console.error("[subscriptions/create] No customerId in Flow response:", customerData);
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

    // Send customer to register their card
    console.log("[subscriptions/create] Registering card for customerId:", customerId);
    const registerData = await flowPost("customer/register", {
      customerId,
      url_return: `${SITE_URL}/api/subscriptions/register-callback`,
    });
    console.log("[subscriptions/create] Flow register response:", JSON.stringify(registerData));

    if (!registerData.url || !registerData.token) {
      console.error("[subscriptions/create] Missing url/token in register response:", registerData);
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
