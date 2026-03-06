import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Mock payment: mark as premium immediately
  const { error } = await supabase
    .from("analisis")
    .update({ is_premium: true })
    .eq("id", analysisId);

  if (error) {
    return NextResponse.json({ error: "Error al procesar pago", details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Pago procesado exitosamente (mock)",
    analysisId,
  });
}
