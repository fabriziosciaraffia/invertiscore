import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { AnalisisInput } from "@/lib/types";
import { runAnalysis, setUFValue } from "@/lib/analysis";
import { getUFValue } from "@/lib/uf";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { generateAiAnalysis } from "@/lib/ai-generation";

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

    const isGuest = !user;

    const body: AnalisisInput = await request.json();

    // Set dynamic UF value before analysis
    const ufValue = await getUFValue();
    setUFValue(ufValue);

    const result = runAnalysis(body);

    // Guest: use service role to bypass RLS (user_id will be null)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (isGuest && !serviceRoleKey) {
      return NextResponse.json({ error: "Regístrate gratis para guardar tu análisis" }, { status: 401 });
    }
    const dbClient = isGuest
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey!)
      : supabase;

    const { data, error } = await dbClient
      .from("analisis")
      .insert({
        user_id: user?.id ?? null,
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
        arriendo: body.arriendo,
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: result.score,
        desglose: result.desglose,
        resumen: result.resumen,
        results: result,
        input_data: body,
        creator_name: user?.user_metadata?.nombre || user?.user_metadata?.full_name || null,
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

    // Send analysis ready email (non-blocking, only for logged-in users)
    if (user?.email && data?.id) {
      sendAnalysisReadyEmail(
        user.email,
        user.user_metadata?.nombre || user.user_metadata?.full_name || '',
        body.nombre || `${body.comuna} - ${body.superficie}m²`,
        result.score,
        result.veredicto || (result.score >= 70 ? 'COMPRAR' : result.score >= 40 ? 'AJUSTA EL PRECIO' : 'BUSCAR OTRA'),
        data.id
      ).catch(e => console.error("Analysis email error:", e));
    }

    // Fire-and-forget: generate AI analysis in background without blocking response.
    // No credit consumption here — this is the user's free first analysis. The /ai endpoint
    // still handles credits for on-demand regeneration when needed.
    if (data?.id) {
      generateAiAnalysis(data.id, dbClient).catch((e) =>
        console.error("Background AI generation failed:", e)
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
