import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AnalisisInput } from "@/lib/types";

const UF_CLP = 38000;

function calcularScore(body: AnalisisInput) {
  const arriendoNeto = body.arriendo - body.gastos - body.contribuciones / 3;
  const precioCLP = body.precio * UF_CLP;
  const capRate = (arriendoNeto * 12) / precioCLP * 100;
  const yieldBruto = (body.arriendo * 12) / precioCLP * 100;

  // Rentabilidad (0-100): basado en CAP rate neto
  // <2% = malo, 2-3% = regular, 3-4% = bueno, 4-5% = muy bueno, >5% = excelente
  const rentabilidad = Math.min(100, Math.max(0, Math.round(capRate * 18)));

  // Plusvalía (0-100): basado en precio/m² vs promedio y antigüedad
  const precioM2UF = body.precio / body.superficie;
  let plusvalia = 60;
  if (precioM2UF < 50) plusvalia += 15; // bajo precio/m² = más potencial
  else if (precioM2UF > 80) plusvalia -= 10;
  if (body.antiguedad <= 5) plusvalia += 10;
  else if (body.antiguedad > 20) plusvalia -= 15;
  plusvalia = Math.min(100, Math.max(0, plusvalia));

  // Riesgo (0-100, donde 100 = menor riesgo)
  let riesgo = 60;
  if (body.tipo.toLowerCase().includes("departamento")) riesgo += 10;
  if (body.antiguedad <= 10) riesgo += 10;
  else if (body.antiguedad > 25) riesgo -= 15;
  if (capRate > 3) riesgo += 10;
  if (body.gastos < body.arriendo * 0.2) riesgo += 5;
  riesgo = Math.min(100, Math.max(0, riesgo));

  // Ubicación (0-100): placeholder heurístico
  let ubicacion = 65;
  const comunasPremium = ["providencia", "las condes", "vitacura", "ñuñoa", "santiago centro", "santiago"];
  if (comunasPremium.some(c => body.comuna.toLowerCase().includes(c))) {
    ubicacion = 85;
  }
  ubicacion = Math.min(100, Math.max(0, ubicacion));

  const score = Math.round(
    rentabilidad * 0.35 + plusvalia * 0.25 + riesgo * 0.2 + ubicacion * 0.2
  );

  const resumen = `Propiedad con yield bruto de ${yieldBruto.toFixed(1)}% y CAP rate neto estimado de ${capRate.toFixed(1)}%. ` +
    `El precio por m² es de ${precioM2UF.toFixed(1)} UF/m². ` +
    `${capRate >= 4 ? "La rentabilidad es atractiva, superando el promedio del mercado chileno." : capRate >= 3 ? "La rentabilidad es aceptable para el mercado actual." : "La rentabilidad está por debajo del promedio, se recomienda negociar el precio o buscar mejores opciones."} ` +
    `${body.antiguedad <= 5 ? "La baja antigüedad reduce riesgos de mantención." : body.antiguedad > 20 ? "La antigüedad elevada puede implicar costos de mantención adicionales." : "La antigüedad es moderada."} ` +
    `Se recomienda verificar gastos comunes históricos y estado de la administración antes de tomar una decisión.`;

  return {
    score: Math.min(100, Math.max(0, score)),
    desglose: { rentabilidad, plusvalia, riesgo, ubicacion },
    resumen,
  };
}

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

    // TODO: Reemplazar con Claude AI cuando haya créditos
    // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiResult = calcularScore(body);

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
