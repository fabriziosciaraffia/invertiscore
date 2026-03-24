import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // Auth check via session client
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Query with service_role to bypass RLS on payments table
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(request.url);
  const commerceOrder = url.searchParams.get("order");

  if (!commerceOrder) {
    // Get latest payment for this user
    const { data } = await admin
      .from("payments")
      .select("id, commerce_order, product, amount, status, created_at, analysis_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ payment: data });
  }

  const { data } = await admin
    .from("payments")
    .select("id, commerce_order, product, amount, status, created_at, analysis_id")
    .eq("commerce_order", commerceOrder)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ payment: data });
}
