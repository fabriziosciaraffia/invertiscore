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

    const body: AnalisisInput = await request.json();

    // Set dynamic UF value before analysis
    const ufValue = await getUFValue();
    setUFValue(ufValue);

    const result = runAnalysis(body);

    const { data, error } = await supabase
      .from("analisis")
      .insert({
        user_id: user.id,
        nombre: body.nombre,
        comuna: body.comuna,
        ciudad: body.ciudad,
        direccion: body.direccion || null,
        tipo: body.tipo,
        dormitorios: body.dormitorios,
        banos: body.banos,
        superficie: body.superficie,
        antiguedad: body.antiguedad,
        precio: body.precio,
        arriendo: body.tipoRenta === "larga" ? body.arriendo : Math.round(body.tarifaNoche * 30 * (body.ocupacionPct / 100)),
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: body,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Error al guardar el análisis" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
