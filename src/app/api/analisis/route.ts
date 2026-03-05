import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalisisInput } from "@/lib/types";

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

    // Call Claude for AI analysis
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `Eres un experto analista de inversiones inmobiliarias en Chile. Analiza la siguiente propiedad y genera un puntaje de inversión (InvertiScore) de 0 a 100.

Datos de la propiedad:
- Nombre: ${body.nombre}
- Tipo: ${body.tipo}
- Ubicación: ${body.comuna}, ${body.ciudad}${body.direccion ? `, ${body.direccion}` : ""}
- Dormitorios: ${body.dormitorios} | Baños: ${body.banos}
- Superficie: ${body.superficie} m²
- Antigüedad: ${body.antiguedad} años
- Precio de venta: ${body.precio} UF
- Arriendo mensual esperado: $${body.arriendo.toLocaleString("es-CL")} CLP
- Gastos comunes: $${body.gastos.toLocaleString("es-CL")} CLP
- Contribuciones trimestrales: $${body.contribuciones.toLocaleString("es-CL")} CLP

Considera para tu análisis:
- Valor UF aproximado: 38.000 CLP
- CAP rate = (arriendo anual neto) / (precio en CLP) × 100
- Arriendo neto = arriendo - gastos comunes - (contribuciones/3)
- Un CAP rate sobre 4% es bueno en Chile, sobre 5% es excelente
- Evalúa plusvalía según la comuna y ciudad
- Evalúa riesgo según tipo de propiedad, antigüedad y ubicación
- Evalúa ubicación según demanda de arriendo en la zona

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "score": <número entero 0-100>,
  "desglose": {
    "rentabilidad": <número entero 0-100>,
    "plusvalia": <número entero 0-100>,
    "riesgo": <número entero 0-100, donde 100 = menor riesgo>,
    "ubicacion": <número entero 0-100>
  },
  "resumen": "<párrafo de 3-5 oraciones con el análisis detallado, mencionando CAP rate, perspectivas de plusvalía, y recomendación>"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const aiText =
      message.content[0].type === "text" ? message.content[0].text : "";
    const aiResult = JSON.parse(aiText);

    // Save to Supabase
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
        arriendo: body.arriendo,
        gastos: body.gastos,
        contribuciones: body.contribuciones,
        score: aiResult.score,
        desglose: aiResult.desglose,
        resumen: aiResult.resumen,
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
