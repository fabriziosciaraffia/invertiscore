import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}

export async function POST(request: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { analysisId } = body;

  if (!analysisId) {
    return NextResponse.json({ error: "analysisId es requerido" }, { status: 400 });
  }

  // Verify the analysis belongs to this user
  const { data: analisis } = await supabase
    .from("analisis")
    .select("id, user_id")
    .eq("id", analysisId)
    .single();

  if (!analisis || analisis.user_id !== user.id) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }

  // Use admin client (bypasses RLS) if available, otherwise user client
  const dbClient = createAdminClient() || supabase;

  // Mock payment: mark as premium immediately
  const { data: updated, error } = await dbClient
    .from("analisis")
    .update({ is_premium: true })
    .eq("id", analysisId)
    .select("id, is_premium")
    .single();

  console.log("Payment update result:", { updated, error, analysisId, userId: user.id });

  if (error) {
    console.error("Payment update error:", error);
    return NextResponse.json({ error: `Error al procesar pago: ${error.message}` }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar. Verifica permisos en Supabase." }, { status: 500 });
  }

  // Revalidate the analysis page so the reload shows fresh data
  revalidatePath(`/analisis/${analysisId}`);

  return NextResponse.json({
    success: true,
    message: "Pago procesado exitosamente",
    analysisId,
    is_premium: updated.is_premium,
  });
}
