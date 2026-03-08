import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis, setUFValue } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";

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
            // ignored in route handler
          }
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId, inputData }: { analysisId: string; inputData: AnalisisInput } = await request.json();

    if (!analysisId || !inputData) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Verify the analysis belongs to this user
    const { data: existing } = await supabase
      .from("analisis")
      .select("id, user_id")
      .eq("id", analysisId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // Allow admin or owner
    const isAdmin = user.email === "fabriziosciaraffia@gmail.com";
    if (existing.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Set dynamic UF value before analysis
    const ufValue = await getUFValue();
    setUFValue(ufValue);

    const result = runAnalysis(inputData);

    const { error } = await supabase
      .from("analisis")
      .update({
        precio: inputData.precio,
        arriendo: inputData.arriendo,
        gastos: inputData.gastos,
        contribuciones: inputData.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: inputData,
      })
      .eq("id", analysisId);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: "Error al actualizar el análisis" }, { status: 500 });
    }

    return NextResponse.json({ success: true, score: result.score, results: result });
  } catch (error) {
    console.error("Recalculate API error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
