import { NextResponse } from "next/server";
import { flowPost } from "@/lib/flow";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refranco.ai";

export async function POST(request: Request) {
  // Protect with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await flowPost("plans/create", {
      planId: "FrancoMensual",
      name: "Franco Suscripción Mensual",
      currency: "CLP",
      amount: 19990,
      interval: 3,
      interval_count: 1,
      trial_period_days: 0,
      days_until_due: 3,
      urlCallback: `${SITE_URL}/api/subscriptions/payment-callback`,
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Create plan error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
