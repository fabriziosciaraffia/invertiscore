import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const anthropic = new Anthropic();

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
            // ignored
          }
        },
      },
    }
  );
}

const SYSTEM_PROMPT = `Eres un analista de inversión inmobiliaria en Chile. Hablas en español chileno, claro y directo. No usas jerga financiera sin explicar. Tu objetivo es que una persona sin conocimientos financieros entienda si esta inversión le conviene o no. Eres honesto: si es mala inversión lo dices sin rodeos. Respondes SOLO con el JSON solicitado, sin texto adicional ni backticks.`;

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}

function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId } = await request.json();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }

    // Fetch analysis from DB
    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const input = analysis.input_data;
    const results = analysis.results;
    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const m = results.metrics;
    const d = results.desglose;
    const exit = results.exitScenario;
    const UF_CLP = m.precioCLP / input.precio;

    // Zone market data
    let precioM2Zona = m.precioM2;
    let arriendoZona = input.arriendo;
    let yieldZona = m.yieldBruto;
    try {
      const { getMarketDataForComuna } = await import("@/lib/market-data");
      const market = await getMarketDataForComuna(input.comuna, input.dormitorios);
      if (market) {
        precioM2Zona = market.precio_m2_venta_promedio;
        arriendoZona = market.arriendo_promedio;
        yieldZona = Math.round((arriendoZona * 12 / (precioM2Zona * input.superficie * UF_CLP)) * 1000) / 10;
      }
    } catch {
      // Use defaults
    }

    const creditoCLP = m.precioCLP * (1 - input.piePct / 100);
    const inversionTotal = m.pieCLP + Math.round(m.precioCLP * 0.03); // pie + ~3% costos entrada

    const userPrompt = `Analiza esta inversión inmobiliaria en Chile y responde en JSON con esta estructura exacta:

DATOS DE LA PROPIEDAD:
- Tipo: ${input.tipo}
- Ubicación: ${input.comuna}, ${input.ciudad}
- Superficie: ${input.superficie} m²
- Antigüedad: ${input.antiguedad} años
- Precio: ${fmtUF(input.precio)} (${fmtCLP(m.precioCLP)})
- Pie: ${input.piePct}% = ${fmtCLP(m.pieCLP)}
- Crédito: ${fmtCLP(creditoCLP)} a ${input.tasaInteres}% en ${input.plazoCredito} años
- Dividendo mensual: ${fmtCLP(m.dividendo)}
- Arriendo esperado: ${fmtCLP(input.arriendo)}/mes
- Gastos comunes: ${fmtCLP(input.gastos)}/mes (solo vacancia, lo paga arrendatario)
- Contribuciones: ${fmtCLP(input.contribuciones)}/trimestre
- Provisión mantención: ${fmtCLP(input.provisionMantencion || Math.round(m.precioCLP * 0.01 / 12))}/mes
- Estacionamiento: ${input.estacionamiento === "si" ? "Sí" : "No"}
- Bodega: ${input.bodega ? "Sí" : "No"}
- Estado: ${input.estadoVenta}${input.fechaEntrega ? " (entrega " + input.fechaEntrega + ")" : ""}

MÉTRICAS CALCULADAS:
- InvertiScore: ${results.score}/100 (${results.clasificacion})
- Yield bruto: ${m.yieldBruto.toFixed(1)}%
- Yield neto: ${m.yieldNeto.toFixed(1)}%
- CAP rate: ${m.capRate.toFixed(1)}%
- Cash-on-Cash: ${m.cashOnCash.toFixed(1)}%
- Flujo mensual neto: ${fmtCLP(m.flujoNetoMensual)}${m.flujoNetoMensual < 0 ? " (negativo)" : ""}
- Inversión inicial total (pie + costos entrada): ${fmtCLP(inversionTotal)}
- ROI 10 años: ${exit.multiplicadorCapital.toFixed(2)}x
- TIR: ${exit.tir.toFixed(1)}%
- Precio máximo de compra para flujo positivo: ${fmtUF(results.valorMaximoCompra)}

DIMENSIONES DEL SCORE:
- Rentabilidad: ${Math.round(d.rentabilidad)}/100
- Flujo de Caja: ${Math.round(d.flujoCaja)}/100
- Plusvalía: ${Math.round(d.plusvalia)}/100
- Riesgo: ${Math.round(d.riesgo)}/100
- Eficiencia de compra: ${Math.round(d.eficiencia)}/100

DATOS DE MERCADO DE LA ZONA:
- Precio/m² promedio zona: ${fmtUF(precioM2Zona)}
- Arriendo promedio zona: ${fmtCLP(arriendoZona)}
- Yield promedio zona: ${yieldZona.toFixed(1)}%

Responde SOLO con un JSON válido con esta estructura:
{
  "resumenEjecutivo": "2-3 oraciones. Lo más importante que debe saber. Si es buena inversión o no, por qué, y la acción recomendada. Directo al grano.",

  "tuBolsillo": {
    "titulo": "Lo que sale de tu bolsillo",
    "contenido": "Explica en lenguaje simple: cuánto pone de su bolsillo cada mes (${fmtCLP(m.flujoNetoMensual)}), cuánto es eso al año, y qué ingreso mensual mínimo debería tener para que ese gasto no supere el 20-25% de su sueldo. Ejemplo: 'Vas a poner $364.590 de tu bolsillo cada mes. Eso son $4.4M al año. Para que esto sea cómodo, deberías ganar al menos $1.8M líquidos mensuales.' Si el flujo es positivo, felicitar y explicar cuánto gana.",
    "alerta": "Solo si el flujo es muy negativo (>$400K/mes): 'Ojo: este monto es alto. Asegúrate de tener un colchón de al menos 6 meses ($X) por si pierdes el arriendo o te quedas sin trabajo.' Si no aplica, dejar como string vacío."
  },

  "vsAlternativas": {
    "titulo": "¿Conviene más que otras inversiones?",
    "contenido": "Compara poner el pie (${fmtCLP(inversionTotal)}) en: 1) Depósito a plazo al 5% anual = cuánto gana en 10 años. 2) Fondo mutuo conservador al 7% anual = cuánto gana en 10 años. 3) Este departamento con TIR de ${exit.tir.toFixed(1)}% = cuánto gana en 10 años. Indica cuál gana y por cuánto. Sé honesto: si el depósito a plazo gana más, dilo. Considera que el depto tiene apalancamiento (compraste con ${input.piePct}% pero ganas sobre el 100% del valor)."
  },

  "negociacion": {
    "titulo": "¿A cuánto deberías comprar?",
    "contenido": "El precio actual es ${fmtUF(input.precio)}. El precio máximo para flujo positivo es ${fmtUF(results.valorMaximoCompra)}. El precio/m² de la zona es ${fmtUF(precioM2Zona)} y el de esta propiedad es ${fmtUF(m.precioM2)}. Basándote en esto, sugiere: 1) El precio ideal para negociar (donde el flujo sea cercano a $0). 2) El descuento en UF y porcentaje respecto al precio publicado. 3) Un argumento que pueda usar para negociar. Si el precio ya está bajo el promedio de la zona, decirlo también.",
    "precioSugerido": "UF X.XXX"
  },

  "proyeccion": {
    "titulo": "¿Cuándo recuperas la inversión?",
    "contenido": "Explica en simple: 1) En 5 años: cuánto vale la propiedad, cuánto debes, cuánto ganaste si vendes. 2) En 10 años: lo mismo. 3) El punto de equilibrio: en cuántos años lo que ganaste por plusvalía supera lo que perdiste por flujo negativo. Usa los datos del ROI (${exit.multiplicadorCapital.toFixed(2)}x) y la ganancia neta (${fmtCLP(exit.gananciaNeta)})."
  },

  "riesgos": {
    "titulo": "¿Qué puede salir mal?",
    "items": [
      "Riesgo 1 con mitigación concreta.",
      "Riesgo 2 con mitigación.",
      "Riesgo 3 con mitigación.",
      "Máximo 4 riesgos, los más relevantes para ESTA propiedad específica."
    ]
  },

  "veredicto": {
    "titulo": "Veredicto",
    "decision": "COMPRAR | NEGOCIAR | BUSCAR OTRA",
    "explicacion": "2-3 oraciones explicando la decisión. Terminar con una frase de acción concreta."
  },

  "aFavor": ["Punto positivo 1", "Punto positivo 2", "Punto positivo 3 si hay"],
  "puntosAtencion": ["Punto negativo 1", "Punto negativo 2", "Punto negativo 3 si hay"]
}

REGLAS:
- Todos los montos en CLP a menos que se indique UF
- No uses jerga sin explicar entre paréntesis
- Sé directo y honesto, no diplomático
- Si es mala inversión, dilo claramente
- Los cálculos de comparación con alternativas deben ser correctos matemáticamente
- Adapta el tono: si el score es >70 sé positivo, si es 50-70 sé cauteloso, si es <50 sé directo sobre los problemas
- El veredicto debe ser UNA de las tres opciones: COMPRAR, NEGOCIAR, o BUSCAR OTRA
- El campo "alerta" en tuBolsillo debe ser string vacío "" si no aplica`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON — handle possible markdown wrapping
    let aiResult;
    try {
      const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      aiResult = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Error parsing AI response", raw: text }, { status: 500 });
    }

    // Save to DB
    await supabase
      .from("analisis")
      .update({ ai_analysis: aiResult })
      .eq("id", analysisId);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
