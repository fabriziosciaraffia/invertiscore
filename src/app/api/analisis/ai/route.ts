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

const SYSTEM_PROMPT = `Eres un analista de inversión inmobiliaria en Chile. Hablas en español chileno, claro y directo. No usas jerga financiera sin explicar. Tu objetivo es que una persona sin conocimientos financieros entienda si esta inversión le conviene o no. Eres honesto: si es mala inversión lo dices sin rodeos. Respondes SOLO con el JSON solicitado, sin texto adicional ni backticks.

CONTEXTO IMPORTANTE DEL MERCADO CHILENO 2024-2026:
- Con tasas hipotecarias de 4-5%, prácticamente NINGÚN departamento de inversión en Santiago tiene flujo positivo con 80% de financiamiento. Flujo negativo es lo NORMAL, no la excepción.
- La estrategia estándar del inversionista chileno es: comprar con flujo negativo manejable y esperar plusvalía de 3-5% anual.
- Un flujo negativo de hasta $200K/mes se considera manejable para alguien con ingresos de $2M+.
- Un flujo negativo de $200K-$400K es alto pero viable si la plusvalía y ubicación lo justifican.
- Un flujo negativo de más de $400K es difícil de sostener para la mayoría de los inversionistas.
- NO digas "buscar otra" solo porque tiene flujo negativo — TODOS lo tienen. Di "buscar otra" solo si el flujo es extremo Y la plusvalía/ubicación no compensan.

CRITERIOS PARA VEREDICTO:
- COMPRAR: Score >65, O flujo negativo <$200K con buena plusvalía, O yield sobre promedio zona
- NEGOCIAR: Score 45-65, flujo negativo manejable ($200K-$400K), buena zona
- BUSCAR OTRA: Score <45, O flujo negativo >$500K, O ubicación mala, O yield muy bajo sin compensación de plusvalía

TONO: No seas alarmista sobre flujo negativo — es la norma del mercado. Sé realista pero constructivo. Tu rol es informar para que decida bien, no asustarlo. Si la inversión tiene potencial de plusvalía en buena zona, reconócelo aunque el flujo sea negativo. Reserva el tono negativo para inversiones realmente malas (score <40, mala zona, sin plusvalía).`;

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

    const mesesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const fechaEntregaFmt = input.fechaEntrega ? (() => { const [a, me] = input.fechaEntrega.split("-").map(Number); return `${mesesEs[(me || 1) - 1]} ${a}`; })() : "";

    const precioConDescuento10 = Math.round(input.precio * 0.9);
    const flujoNegAcum10 = m.flujoNetoMensual < 0 ? Math.round(Math.abs(m.flujoNetoMensual) * 12 * 10) : 0;
    const datoDP = Math.round(inversionTotal * Math.pow(1.05, 10));
    const datoFM = Math.round(inversionTotal * Math.pow(1.07, 10));
    const valorProp5 = Math.round(m.precioCLP * Math.pow(1.04, 5));
    const valorProp10 = Math.round(m.precioCLP * Math.pow(1.04, 10));
    const dividendoSiTasaSube1 = creditoCLP > 0 ? Math.round((creditoCLP * ((input.tasaInteres + 1) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 1) / 100 / 12, -(input.plazoCredito * 12)))) : 0;
    const dividendoSiTasaSube2 = creditoCLP > 0 ? Math.round((creditoCLP * ((input.tasaInteres + 2) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 2) / 100 / 12, -(input.plazoCredito * 12)))) : 0;

    const userPrompt = `Analiza esta inversión inmobiliaria en Chile y responde en JSON con esta estructura exacta.

IMPORTANTE: Para cada campo de texto, genera DOS versiones: una con valores en CLP (sufijo _clp) y otra con valores en UF (sufijo _uf).
- Versión CLP: usa pesos chilenos con formato $XXX.XXX (separador de miles con punto)
- Versión UF: usa UF con el valor 1 UF = ${fmtCLP(UF_CLP)}. Formato: "UF X,X" para valores menores a 100 UF, "UF X.XXX" para valores mayores. NUNCA escribas "UF 0".
- Los campos "titulo", "decision", "precioSugerido", "aFavor" y "puntosAtencion" NO llevan sufijo (son iguales en ambas monedas).

DATOS DE LA PROPIEDAD:
- Tipo: ${input.tipo}
- Ubicación: ${input.comuna}, ${input.ciudad}
- Superficie: ${input.superficie} m²
- Antigüedad: ${input.estadoVenta !== "inmediata" && fechaEntregaFmt ? "En construcción (entrega " + fechaEntregaFmt + ")" : input.antiguedad + " años"}
- Precio: ${fmtUF(input.precio)} (${fmtCLP(m.precioCLP)})
- Pie: ${input.piePct}% = ${fmtCLP(m.pieCLP)} (${fmtUF(m.pieCLP / UF_CLP)})
- Crédito: ${fmtCLP(creditoCLP)} a ${input.tasaInteres}% en ${input.plazoCredito} años
- Dividendo mensual: ${fmtCLP(m.dividendo)} (${fmtUF(m.dividendo / UF_CLP)})
- Arriendo esperado: ${fmtCLP(input.arriendo)}/mes (${fmtUF(input.arriendo / UF_CLP)}/mes)
- Gastos comunes: ${fmtCLP(input.gastos)}/mes (solo vacancia, lo paga arrendatario)
- Contribuciones: ${fmtCLP(input.contribuciones)}/trimestre
- Provisión mantención: ${fmtCLP(input.provisionMantencion)}/mes
- Estacionamiento: ${input.estacionamiento === "si" ? "Sí" : "No"}
- Bodega: ${input.bodega ? "Sí" : "No"}
- Estado: ${input.estadoVenta}${fechaEntregaFmt ? " (entrega " + fechaEntregaFmt + ")" : ""}

MÉTRICAS CALCULADAS:
- InvertiScore: ${results.score}/100 (${results.clasificacion})
- Yield bruto: ${m.yieldBruto.toFixed(1)}%
- Yield neto: ${m.yieldNeto.toFixed(1)}%
- CAP rate: ${m.capRate.toFixed(1)}%
- Cash-on-Cash: ${m.cashOnCash.toFixed(1)}%
- Flujo mensual neto: ${fmtCLP(m.flujoNetoMensual)} (${fmtUF(m.flujoNetoMensual / UF_CLP)})${m.flujoNetoMensual < 0 ? " (negativo)" : ""}
- Inversión inicial total (pie + costos entrada): ${fmtCLP(inversionTotal)} (${fmtUF(inversionTotal / UF_CLP)})
- ROI 10 años: ${exit.multiplicadorCapital.toFixed(2)}x
- TIR: ${exit.tir.toFixed(1)}%
- Precio máximo de compra para flujo positivo: ${fmtUF(results.valorMaximoCompra)}
- Precio con 10% descuento: ${fmtUF(precioConDescuento10)}

IMPORTANTE SOBRE EL SCORE:
El InvertiScore TOTAL es ${results.score}/100. Este es EL ÚNICO score que debes mencionar como "score" o "InvertiScore".
Las siguientes son DIMENSIONES (sub-scores), NO el score total. Si mencionas alguna, di "sub-score de X: Y/100":
- Rentabilidad: ${Math.round(d.rentabilidad)}/100
- Flujo de Caja: ${Math.round(d.flujoCaja)}/100
- Plusvalía: ${Math.round(d.plusvalia)}/100
- Riesgo: ${Math.round(d.riesgo)}/100
- Eficiencia de compra: ${Math.round(d.eficiencia)}/100
NUNCA escribas dos scores diferentes. El score es UNO SOLO: ${results.score}/100.
Nombres EXACTOS de dimensiones. NO uses "Price score", "Location score", etc.

DATOS DE MERCADO DE LA ZONA:
- Precio/m² promedio zona: ${fmtUF(precioM2Zona)}
- Arriendo promedio zona: ${fmtCLP(arriendoZona)}
- Yield promedio zona: ${yieldZona.toFixed(1)}%

Responde SOLO con un JSON válido con esta estructura:
{
  "resumenEjecutivo_clp": "2-3 oraciones con montos en CLP.",
  "resumenEjecutivo_uf": "Lo mismo pero con montos en UF.",

  "tuBolsillo": {
    "titulo": "Lo que sale de tu bolsillo",
    "contenido_clp": "Explica en lenguaje simple: cuánto pone de su bolsillo cada mes (${fmtCLP(m.flujoNetoMensual)}), cuánto es eso al año, y qué ingreso mensual mínimo debería tener para que ese gasto no supere el 20-25% de su sueldo. Si el flujo es positivo, felicitar y explicar cuánto gana. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF.",
    "alerta_clp": "Solo si el flujo es muy negativo (>$400K/mes): alerta con colchón de 6 meses. Si no aplica, string vacío.",
    "alerta_uf": "Lo mismo en UF. Si no aplica, string vacío."
  },

  "vsAlternativas": {
    "titulo": "¿Conviene más que otras inversiones?",
    "contenido_clp": "Compara el resultado a 10 AÑOS de invertir ${fmtCLP(inversionTotal)} en: 1) Depósito a plazo al 5% anual: ${fmtCLP(inversionTotal)} × (1.05)^10 = ${fmtCLP(datoDP)}. 2) Fondo mutuo al 7% anual: ${fmtCLP(inversionTotal)} × (1.07)^10 = ${fmtCLP(datoFM)}. 3) Este departamento: ganancia neta ${fmtCLP(exit.gananciaNeta)} (ROI ${exit.multiplicadorCapital.toFixed(2)}x), PERO resta el flujo negativo acumulado de ${fmtCLP(flujoNegAcum10)} en 10 años. Ganancia real del depto = ${fmtCLP(exit.gananciaNeta - flujoNegAcum10)}. Indica cuál gana y por cuánto. Considera el apalancamiento: compraste con ${input.piePct}% pero ganas sobre el 100% del valor. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF."
  },

  "negociacion": {
    "titulo": "¿Vale la pena negociar?",
    "contenido_clp": "Análisis de negociación con montos en CLP. Ver REGLAS DE NEGOCIACIÓN abajo.",
    "contenido_uf": "Lo mismo pero con montos en UF.",
    "precioSugerido": "${fmtUF(precioConDescuento10)}"
  },

  "proyeccion": {
    "titulo": "¿Cuándo recuperas la inversión?",
    "contenido_clp": "Da cifras CONCRETAS con plusvalía 4% anual. En 5 años: propiedad valdría ${fmtCLP(valorProp5)}, flujo negativo acumulado ${fmtCLP(Math.round(Math.abs(m.flujoNetoMensual) * 60))}. En 10 años: propiedad valdría ${fmtCLP(valorProp10)}, flujo negativo acumulado ${fmtCLP(flujoNegAcum10)}, ganancia neta si vende ${fmtCLP(exit.gananciaNeta)} (ROI ${exit.multiplicadorCapital.toFixed(2)}x). Punto de equilibrio: calcula en qué año la plusvalía acumulada supera el flujo negativo acumulado. Montos en CLP.",
    "contenido_uf": "Lo mismo pero con montos en UF."
  },

  "riesgos": {
    "titulo": "¿Qué puede salir mal?",
    "items_clp": [
      "Vacancia prolongada: cada mes sin arriendo pierdes ${fmtCLP(input.arriendo + input.gastos)} (arriendo + GGCC). Mitigación concreta con monto.",
      "Subida de tasas: si la tasa sube 1% el dividendo pasa de ${fmtCLP(m.dividendo)} a ${fmtCLP(dividendoSiTasaSube1)}. Si sube 2%, a ${fmtCLP(dividendoSiTasaSube2)}. Mitigación concreta.",
      "Baja de arriendos: si el arriendo baja 15%, tu flujo negativo empeora en ${fmtCLP(Math.round(input.arriendo * 0.15))} mensuales. Mitigación concreta.",
      "Gastos imprevistos: reparaciones mayores (calefón, pintura, piso) pueden costar $500K-$2M. Mitigación concreta con monto de reserva."
    ],
    "items_uf": ["Mismo riesgo 1 en UF.", "Mismo riesgo 2 en UF.", "Mismo riesgo 3 en UF.", "Mismo riesgo 4 en UF."]
  },

  "veredicto": {
    "titulo": "Veredicto",
    "decision": "COMPRAR | NEGOCIAR | BUSCAR OTRA",
    "explicacion_clp": "2-3 oraciones con montos en CLP.",
    "explicacion_uf": "Lo mismo pero con montos en UF."
  },

  "aFavor": ["Punto positivo 1", "Punto positivo 2", "Punto positivo 3 si hay"],
  "puntosAtencion": ["Punto negativo 1", "Punto negativo 2", "Punto negativo 3 si hay"]
}

REGLAS DE NEGOCIACIÓN (OBLIGATORIAS):
- El descuento MÁXIMO realista en Chile es 10%. NUNCA sugieras más de 10% de descuento.
- Precio sugerido siempre = precio actual × 0.90 (${fmtUF(precioConDescuento10)}) como MÁXIMO. NUNCA menos.
- PROHIBIDO sugerir precios con más de 10% de descuento.
- PROHIBIDO mencionar el precio de flujo neutro como objetivo de compra si requiere más de 10% de descuento.
- Si el flujo con 10% de descuento sigue siendo muy negativo (más de -$200K/mes): di honestamente que esta inversión no funciona por flujo, funciona solo por plusvalía. Incluso con 10% de descuento, seguiría poniendo dinero de su bolsillo cada mes. Compra solo si confía en la plusvalía y tiene ingresos para sostener el flujo negativo.
- Si el flujo con 10% de descuento se acerca a $0: sugiere ese precio y explica cuánto mejora el flujo.

REGLAS GENERALES:
- En la versión _clp, todos los montos en CLP ($XXX.XXX). En la versión _uf, todos los montos en UF.
- No uses jerga sin explicar entre paréntesis
- Sé directo y honesto, no diplomático
- Si es mala inversión, dilo claramente
- Los cálculos de comparación con alternativas deben ser correctos matemáticamente
- Adapta el tono: si el score es >70 sé positivo, si es 50-70 sé cauteloso, si es <50 sé directo sobre los problemas
- El veredicto debe ser UNA de las tres opciones: COMPRAR, NEGOCIAR, o BUSCAR OTRA
- Los campos "alerta_clp" y "alerta_uf" en tuBolsillo deben ser string vacío "" si no aplica
- Los arrays aFavor y puntosAtencion NO llevan bullet points (•, *, -) al inicio. Solo texto limpio.
- Si el estado es "En blanco" o "En verde" con fecha de entrega futura, NO digas "departamento nuevo (0 años)". Di "departamento en construcción con entrega en [fecha]".`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
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
