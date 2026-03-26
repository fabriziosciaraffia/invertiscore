import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { findNearestStation } from "@/lib/metro-stations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "@/lib/plusvalia-historica";

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

const SYSTEM_PROMPT = `Eres Franco — un analista de inversión inmobiliaria brutalmente honesto. Hablas en español chileno, claro y sin rodeos. No usas jerga financiera sin explicar. Tu misión: que el inversionista entienda EXACTAMENTE en qué se mete, con números concretos.

TU PERSONALIDAD:
- Eres directo. Si los números no dan, lo dices sin suavizar.
- Eres concreto. Siempre das cifras, nunca generalidades. "Necesitas ganar mínimo $X/mes" en vez de "necesitas buenos ingresos".
- Eres constructivo. Si algo está mal, dices QUÉ hacer: negociar a UF X, buscar en zona Y, poner más pie, etc.
- Eres honesto sobre el mercado. No vendes humo. Si el flujo es negativo, no lo escondes. Pero tampoco alarmas — en Chile 2024-2026 es lo normal con tasas de 4-5%.
- Cuando recomiendas "buscar otra", dices QUÉ buscar: qué rango de precio, qué zona, qué superficie, qué arriendo necesita.
- Cuando recomiendas negociar, dices CÓMO: qué argumentos usar, a qué precio apuntar, por qué.

CONTEXTO MERCADO CHILENO 2024-2026:
- Tasas hipotecarias 4-5%: prácticamente NINGÚN depto de inversión tiene flujo positivo con 80% financiamiento. Flujo negativo es la norma.
- Estrategia estándar: comprar con flujo negativo manejable + plusvalía 3-5% anual.
- Flujo negativo hasta $200K/mes = manejable (ingresos de $1.5M+)
- $200K-$400K = alto, viable solo con buenos ingresos y confianza en plusvalía
- Sobre $400K = difícil de sostener, solo para patrimonios altos

CRITERIOS VEREDICTO:
- COMPRAR: Score >65 con flujo manejable, O ventaja de compra significativa, O yield sobre promedio zona
- AJUSTA EL PRECIO: Score 45-65, flujo negativo pero zona con potencial. Indica el precio EXACTO al que conviene.
- BUSCAR OTRA: Score <45, O flujo insostenible sin compensación, O precio/m² muy sobre zona sin justificación. Indica QUÉ buscar.

Respondes SOLO con el JSON solicitado, sin texto adicional ni backticks.`;

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

    // Allow admin email full access
    const isAdmin = user.email === "fabriziosciaraffia@gmail.com";

    // If not premium, try to consume a credit
    if (!analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    // Return cached AI analysis if it already exists
    if (analysis.ai_analysis && typeof analysis.ai_analysis === "object" && "veredicto" in analysis.ai_analysis) {
      return NextResponse.json(analysis.ai_analysis);
    }

    const input = analysis.input_data;
    const results = analysis.results;
    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mRaw = results.metrics as any;
    // Compatibilidad con análisis guardados con nombres viejos
    const m = {
      ...mRaw,
      rentabilidadBruta: mRaw.rentabilidadBruta ?? mRaw.yieldBruto ?? 0,
      rentabilidadNeta: mRaw.rentabilidadNeta ?? mRaw.yieldNeto ?? 0,
      capRate: mRaw.capRate ?? 0,
    };
    const d = results.desglose;
    const exit = results.exitScenario;
    const UF_CLP = m.precioCLP / input.precio;

    // Zone market data
    let precioM2Zona = m.precioM2;
    let arriendoZona = input.arriendo;
    let yieldZona = m.rentabilidadBruta;
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
    const GASTOS_CIERRE_PCT = 0.02; // consistent with analysis.ts
    const inversionTotal = m.pieCLP + Math.round(m.precioCLP * GASTOS_CIERRE_PCT);

    const mesesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const fechaEntregaFmt = input.fechaEntrega ? (() => { const [a, me] = input.fechaEntrega.split("-").map(Number); return `${mesesEs[(me || 1) - 1]} ${a}`; })() : "";

    const precioConDescuento10 = Math.round(input.precio * 0.9);
    // Use projected accumulated cashflow from the engine (includes inflation-adjusted dividendo)
    const projections = results.projections as { flujoAcumulado: number }[] | undefined;
    const flujoNegAcum10 = projections && projections.length >= 10 && projections[9].flujoAcumulado < 0
      ? Math.round(Math.abs(projections[9].flujoAcumulado))
      : m.flujoNetoMensual < 0 ? Math.round(Math.abs(m.flujoNetoMensual) * 12 * 10) : 0;
    const datoDP = Math.round(inversionTotal * Math.pow(1.05, 10));
    const datoFM = Math.round(inversionTotal * Math.pow(1.07, 10));
    const valorProp5 = Math.round(m.precioCLP * Math.pow(1.04, 5));
    const valorProp10 = Math.round(m.precioCLP * Math.pow(1.04, 10));
    const dividendoSiTasaSube1 = creditoCLP > 0 ? Math.round((creditoCLP * ((input.tasaInteres + 1) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 1) / 100 / 12, -(input.plazoCredito * 12)))) : 0;
    const dividendoSiTasaSube2 = creditoCLP > 0 ? Math.round((creditoCLP * ((input.tasaInteres + 2) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 2) / 100 / 12, -(input.plazoCredito * 12)))) : 0;

    // --- Flujo acumulado 5 años (proyecciones del motor si disponibles) ---
    const flujoNegAcum5 = projections && projections.length >= 5 && projections[4].flujoAcumulado < 0
      ? Math.round(Math.abs(projections[4].flujoAcumulado))
      : Math.round(Math.abs(m.flujoNetoMensual) * 60);

    // --- Detección de anomalías ---
    const anomalias: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zonaRadio = (input as any).zonaRadio as { precioM2VentaCLP?: number; arriendoPromedio?: number } | undefined;
    // Arriendo: prefer radio data (same source as suggestion), fallback to comuna
    const arriendoRef = zonaRadio?.arriendoPromedio || arriendoZona;
    if (arriendoRef > 0 && input.arriendo > 0) {
      const diffArriendo = ((input.arriendo - arriendoRef) / arriendoRef) * 100;
      // Skip small differences (< 5%) — covers rounding between suggestion and input
      if (diffArriendo > 30) {
        const flujoConArriendoReal = m.flujoNetoMensual - (input.arriendo - arriendoRef);
        anomalias.push(`ARRIENDO ALTO: El usuario ingresó ${fmtCLP(input.arriendo)} pero el mercado paga ${fmtCLP(arriendoRef)} (${Math.round(diffArriendo)}% sobre mercado). Sé directo y ácido: "Estás inflando el arriendo un ${Math.round(diffArriendo)}%. El mercado de la zona paga ${fmtCLP(arriendoRef)}. Si no consigues tu precio, el flujo real sería ${fmtCLP(flujoConArriendoReal)}, no ${fmtCLP(m.flujoNetoMensual)}. No te autoengañes con arriendos que no vas a conseguir."`);
      } else if (diffArriendo < -30) {
        anomalias.push(`ARRIENDO BAJO: El usuario ingresó arriendo de ${fmtCLP(input.arriendo)} pero el mercado indica ${fmtCLP(arriendoRef)} (${Math.round(Math.abs(diffArriendo))}% bajo mercado). Podría estar subestimando o es una zona particular. Sugiere verificar.`);
      }
      // Differences between 5-30% are normal and not flagged
    }
    // Precio/m²: prefer radio data, fallback to comuna
    const precioM2Usuario = input.precio / input.superficie;
    const precioM2Ref = zonaRadio?.precioM2VentaCLP ? (zonaRadio.precioM2VentaCLP / UF_CLP) : precioM2Zona;
    if (precioM2Ref > 0 && precioM2Usuario > 0) {
      const diffPrecio = ((precioM2Usuario - precioM2Ref) / precioM2Ref) * 100;
      // Skip small differences (< 5%) — covers rounding between suggestion and input
      if (diffPrecio > 30) {
        anomalias.push(`PRECIO ALTO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(diffPrecio)}% sobre el promedio de la zona (${fmtUF(precioM2Ref)}/m²). Posible sobreprecio.`);
      } else if (diffPrecio < -30) {
        anomalias.push(`PRECIO BAJO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(Math.abs(diffPrecio))}% bajo el promedio de la zona (${fmtUF(precioM2Ref)}/m²). Excelente oportunidad si es correcto.`);
      }
    }
    const ggccEstimado = input.superficie * 2000;
    if (input.gastos > 0 && input.gastos > ggccEstimado * 1.5) {
      anomalias.push(`GGCC ALTOS: Gastos comunes de ${fmtCLP(input.gastos)} parecen altos para ${input.superficie}m² (estimado ~${fmtCLP(ggccEstimado)}). Verificar si incluyen calefacción central u otros servicios.`);
    }

    const valorMercadoFrancoUF = m.valorMercadoFrancoUF || input.precio;
    const valorMercadoUsuarioUF = m.valorMercadoUsuarioUF || input.precio;
    let anomaliaValorMercado = "";
    if (Math.abs(valorMercadoUsuarioUF - valorMercadoFrancoUF) / (valorMercadoFrancoUF || 1) > 0.05) {
      anomaliaValorMercado = valorMercadoUsuarioUF > valorMercadoFrancoUF
        ? `El usuario estima que vale ${fmtUF(valorMercadoUsuarioUF)} pero los datos indican ${fmtUF(valorMercadoFrancoUF)}. Posible sobreestimación. Los cálculos usan el valor de Franco.`
        : `El usuario estima ${fmtUF(valorMercadoUsuarioUF)} pero los datos indican ${fmtUF(valorMercadoFrancoUF)}. Posible subvaloración o información adicional del usuario.`;
    }

    const anomaliasTexto = anomalias.length > 0
      ? `\n\nANOMALÍAS DETECTADAS EN LOS INPUTS:\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nDEBES mencionar cada anomalía en tu análisis. Si el arriendo está inflado, advierte que las métricas reales podrían ser peores. Si el precio está bajo, reconoce la oportunidad.`
      : "";
    const anomaliaValorTexto = anomaliaValorMercado ? `\n\nSOBRE EL VALOR DE MERCADO:\n${anomaliaValorMercado}` : "";

    // --- Anomalías de financiamiento ---
    const anomaliasFinanciamiento: string[] = [];
    if (input.piePct < 15) {
      anomaliasFinanciamiento.push(`PIE BAJO: ${input.piePct}% de pie es bajo. El estándar es 20-25%. Con menos pie, el dividendo es más alto y el riesgo aumenta.`);
    }
    if (input.tasaInteres > 5.5) {
      anomaliasFinanciamiento.push(`TASA ALTA: ${input.tasaInteres}% es alta. El mercado actual está en ~4.1%. Con esta tasa el dividendo es significativamente mayor y el flujo se deteriora.`);
    }
    if (input.plazoCredito < 20) {
      anomaliasFinanciamiento.push(`PLAZO CORTO: ${input.plazoCredito} años es corto. Plazos de 25-30 años reducen el dividendo mensual y mejoran el flujo.`);
    }
    if (input.piePct < 15 && input.tasaInteres > 5) {
      anomaliasFinanciamiento.push(`COMBINACIÓN RIESGOSA: pie bajo (${input.piePct}%) + tasa alta (${input.tasaInteres}%) maximiza el flujo negativo. Evalúa mejorar al menos una variable.`);
    }
    const anomaliasFinTexto = anomaliasFinanciamiento.length > 0
      ? `\n\nANOMALÍAS DE FINANCIAMIENTO:\n${anomaliasFinanciamiento.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nMenciona los problemas de financiamiento directamente: "tu financiamiento está empeorando esta inversión".`
      : "";

    // --- Precios de equilibrio ---
    const precioFlujoNeutroUF = m.precioFlujoNeutroUF || 0;
    const precioFlujoPositivoUF = m.precioFlujoPositivoUF || 0;
    const descuentoParaNeutro = m.descuentoParaNeutro || 0;

    let datosNegociacion = "";
    if (m.flujoNetoMensual >= 0) {
      datosNegociacion = "El flujo ya es positivo — no necesita negociar por flujo. Cualquier descuento es ganancia directa.";
    } else if (precioFlujoNeutroUF > 0 && descuentoParaNeutro <= 10) {
      datosNegociacion = `Para flujo neutro: comprar a ${fmtUF(precioFlujoNeutroUF)} (${descuentoParaNeutro.toFixed(1)}% menos). Para flujo positivo (+$50K): comprar a ${fmtUF(precioFlujoPositivoUF)}. Descuento ALCANZABLE (<10%). Sugiere negociar a ese precio.`;
    } else if (precioFlujoNeutroUF > 0 && descuentoParaNeutro <= 20) {
      datosNegociacion = `Para flujo neutro: ${fmtUF(precioFlujoNeutroUF)} (${descuentoParaNeutro.toFixed(1)}% menos). Descuento alto pero no imposible. Sugiere negociar lo más posible pero advierte que probablemente no logrará flujo neutro — inversión funciona por plusvalía.`;
    } else if (precioFlujoNeutroUF > 0) {
      datosNegociacion = `Flujo neutro requiere ${fmtUF(precioFlujoNeutroUF)} (${descuentoParaNeutro.toFixed(1)}% menos) — NO realista. Ni con 10% de descuento (${fmtUF(Math.round(input.precio * 0.9))}) logra flujo neutro. Solo funciona por plusvalía.`;
    } else {
      datosNegociacion = "El arriendo no cubre ni los gastos fijos — no existe precio de compra que dé flujo neutro con este financiamiento.";
    }

    const plusvaliaFranco = m.plusvaliaInmediataFranco || 0;
    const plusvaliaFrancoPct = m.plusvaliaInmediataFrancoPct || 0;
    let datosPasada = "";
    if (Math.abs(plusvaliaFrancoPct) > 2) {
      if (plusvaliaFranco > 0) {
        const mesesRecuperados = m.flujoNetoMensual < 0 ? Math.round(plusvaliaFranco / Math.abs(m.flujoNetoMensual)) : 0;
        datosPasada = `VENTAJA DE COMPRA: Compra ${Math.abs(plusvaliaFrancoPct).toFixed(1)}% bajo mercado (${fmtCLP(plusvaliaFranco)} ganancia inmediata). ${mesesRecuperados > 0 ? `Equivale a ${mesesRecuperados} meses de flujo negativo cubiertos.` : ""} Destaca como punto muy positivo.`;
      } else {
        datosPasada = `SOBREPRECIO: Paga ${Math.abs(plusvaliaFrancoPct).toFixed(1)}% sobre mercado (${fmtCLP(Math.abs(plusvaliaFranco))} de pérdida inmediata). Advierte que está comprando caro según datos de la zona.`;
      }
    }

    // --- Datos Score v2: metro + plusvalía histórica ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputAny = input as any;
    const lat = inputAny.lat || inputAny.zonaRadio?.lat || null;
    const lng = inputAny.lng || inputAny.zonaRadio?.lng || null;

    let metroInfo = '';
    if (lat && lng) {
      const nearestActive = findNearestStation(lat, lng, 'active');
      const nearestFuture = findNearestStation(lat, lng, 'future');
      if (nearestActive) {
        const distKm = (nearestActive.distance / 1000).toFixed(1);
        metroInfo += `Estación de metro más cercana: ${nearestActive.station.name} (${nearestActive.station.line}) a ${distKm} km. `;
        if (nearestActive.distance < 500) metroInfo += 'Excelente ubicación respecto a metro. ';
        else if (nearestActive.distance < 1000) metroInfo += 'Buena cercanía a metro. ';
        else if (nearestActive.distance > 2500) metroInfo += 'Lejos de metro, puede afectar demanda de arriendo y plusvalía. ';
      }
      if (nearestFuture && nearestFuture.distance < 2000) {
        const distKm = (nearestFuture.distance / 1000).toFixed(1);
        metroInfo += `Futura estación: ${nearestFuture.station.name} (${nearestFuture.station.line}) a ${distKm} km — potencial de plusvalía adicional cuando se construya.`;
      }
    } else {
      metroInfo = 'Sin datos de ubicación exacta para evaluar cercanía a metro.';
    }

    const comunaNorm = (input.comuna || '').trim();
    const historica = PLUSVALIA_HISTORICA[comunaNorm];
    let plusvaliaHistoricaInfo = '';
    if (historica) {
      plusvaliaHistoricaInfo = `Plusvalía histórica de ${comunaNorm} (2014-2024): ${historica.plusvalia10a}% en 10 años (${historica.anualizada}% anual). Precio promedio depto pasó de UF ${historica.precio2014.toLocaleString()} a UF ${historica.precio2024.toLocaleString()}.`;
      if (historica.anualizada >= 4.5) plusvaliaHistoricaInfo += ' Comuna con plusvalía ALTA.';
      else if (historica.anualizada >= 3.0) plusvaliaHistoricaInfo += ' Comuna con plusvalía MODERADA.';
      else if (historica.anualizada >= 1.5) plusvaliaHistoricaInfo += ' Comuna con plusvalía BAJA.';
      else plusvaliaHistoricaInfo += ' Comuna con plusvalía MUY BAJA o NEGATIVA — cuidado.';
    } else {
      plusvaliaHistoricaInfo = `Sin datos históricos de plusvalía para ${comunaNorm}. Se usa promedio Gran Santiago (${PLUSVALIA_DEFAULT.anualizada}% anual).`;
    }

    const COMUNAS_GRAN_SANTIAGO = ["Santiago","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];
    const esFueraGranSantiago = comunaNorm ? !COMUNAS_GRAN_SANTIAGO.includes(comunaNorm) : false;

    const scoreBreakdownInfo = results?.scoreBreakdown
      ? `Desglose del Franco Score: Rentabilidad ${results.scoreBreakdown.rentabilidad}/100, Flujo Caja ${results.scoreBreakdown.flujoCaja}/100, Plusvalía ${results.scoreBreakdown.plusvalia}/100, Eficiencia ${results.scoreBreakdown.eficiencia}/100.`
      : '';

    // Precio sugerido dinámico
    const precioSugeridoUF = plusvaliaFrancoPct > 15
      ? Math.round(input.precio) // ya compra muy bajo mercado, no sugerir más descuento
      : precioFlujoNeutroUF > 0 && descuentoParaNeutro <= 10
        ? Math.round(precioFlujoNeutroUF)
        : Math.round(input.precio * 0.9);

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
- Administración de arriendo: ${input.usaAdministrador ? `Sí, comisión ${input.comisionAdministrador ?? 7}% sobre arriendo = ${fmtCLP(Math.round(input.arriendo * (input.comisionAdministrador ?? 7) / 100))}/mes` : "No usa administrador (gestiona solo)"}
- Estacionamientos: ${(input as unknown as Record<string, unknown>).cantidadEstacionamientos ?? (input.estacionamiento === "si" ? 1 : 0)}
- Bodegas: ${(input as unknown as Record<string, unknown>).cantidadBodegas ?? (input.bodega ? 1 : 0)}
- Estado: ${input.estadoVenta}${fechaEntregaFmt ? " (entrega " + fechaEntregaFmt + ")" : ""}

MÉTRICAS CALCULADAS:
- Franco Score: ${results.score}/100 (${results.clasificacion})
- Rentabilidad Bruta: ${m.rentabilidadBruta.toFixed(1)}%
- Rentabilidad Operativa (CAP Rate): ${m.capRate.toFixed(1)}%
- Rentabilidad Neta: ${m.rentabilidadNeta.toFixed(1)}%
- Cash-on-Cash: ${m.cashOnCash.toFixed(1)}%
- Flujo mensual neto: ${fmtCLP(m.flujoNetoMensual)} (${fmtUF(m.flujoNetoMensual / UF_CLP)})${m.flujoNetoMensual < 0 ? " (negativo)" : ""}
- Inversión inicial total (pie + costos entrada): ${fmtCLP(inversionTotal)} (${fmtUF(inversionTotal / UF_CLP)})
- ROI 10 años: ${exit.multiplicadorCapital.toFixed(2)}x
- TIR: ${exit.tir.toFixed(1)}%
- Precio máximo de compra para flujo positivo: ${fmtUF(results.valorMaximoCompra)}
- Precio con 10% descuento: ${fmtUF(precioConDescuento10)}

IMPORTANTE SOBRE EL SCORE:
El Franco Score TOTAL es ${results.score}/100. Este es EL ÚNICO score que debes mencionar como "score" o "Franco Score".
Las siguientes son DIMENSIONES (sub-scores), NO el score total. Si mencionas alguna, di "sub-score de X: Y/100":
- Rentabilidad: ${Math.round(d.rentabilidad)}/100
- Flujo de Caja: ${Math.round(d.flujoCaja)}/100
- Plusvalía: ${Math.round(d.plusvalia)}/100
- Eficiencia de compra: ${Math.round(d.eficiencia)}/100
NUNCA escribas dos scores diferentes. El score es UNO SOLO: ${results.score}/100.
Nombres EXACTOS de dimensiones. NO uses "Price score", "Location score", etc.

DATOS DE MERCADO DE LA ZONA:
- Precio/m² promedio zona: ${fmtUF(precioM2Zona)}
- Arriendo promedio zona: ${fmtCLP(arriendoZona)}
- Yield promedio zona: ${yieldZona.toFixed(1)}%

DATOS DE UBICACIÓN Y PLUSVALÍA (Score v2):
${metroInfo}
${plusvaliaHistoricaInfo}
${scoreBreakdownInfo}
${esFueraGranSantiago ? `\nADVERTENCIA: Esta propiedad está fuera del Gran Santiago. Los datos de metro, plusvalía histórica y comparación de mercado pueden no ser precisos. Menciona esta limitación al usuario.` : ''}

Menciona estos datos en tu análisis cuando sean relevantes:
- Si hay metro cerca (<500m), menciónalo como ventaja para arriendo y plusvalía
- Si hay metro futuro cerca, menciónalo como potencial de plusvalía
- Si no hay metro cerca (>2.5km), menciónalo como riesgo para demanda de arriendo
- Menciona la plusvalía histórica real de la comuna (no inventes datos)
- Si la eficiencia es baja (<40), menciona que está comprando caro o con bajo yield respecto a la zona
${anomaliasTexto}${anomaliaValorTexto}${anomaliasFinTexto}

VEREDICTO OBLIGATORIO: El veredicto del motor es "${results.veredicto || (results.score >= 70 ? "COMPRAR" : results.score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA")}". DEBES usar este mismo veredicto en tu respuesta. No lo cambies. Tu trabajo es explicar POR QUÉ el veredicto es ese, no decidir uno diferente. Si te parece contraintuitivo (ej: score 43 pero dice BUSCAR OTRA por flujo insostenible), explica qué señales negativas lo causan.

DATOS DE NEGOCIACIÓN (calculados por el motor):
${datosNegociacion}
${datosPasada ? `\nPLUSVALÍA INMEDIATA:\n${datosPasada}` : ""}

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
    "titulo": "¿Vale la pena ajustar el precio?",
    "contenido_clp": "Análisis de negociación con montos en CLP. Ver REGLAS DE NEGOCIACIÓN abajo.",
    "contenido_uf": "Lo mismo pero con montos en UF.",
    "precioSugerido": "${fmtUF(precioSugeridoUF)}"
  },

  "proyeccion": {
    "titulo": "¿Cuándo recuperas la inversión?",
    "contenido_clp": "Da cifras CONCRETAS con plusvalía 4% anual. En 5 años: propiedad valdría ${fmtCLP(valorProp5)}, flujo negativo acumulado ${fmtCLP(flujoNegAcum5)}. En 10 años: propiedad valdría ${fmtCLP(valorProp10)}, flujo negativo acumulado ${fmtCLP(flujoNegAcum10)}, ganancia neta si vende ${fmtCLP(exit.gananciaNeta)} (ROI ${exit.multiplicadorCapital.toFixed(2)}x). Punto de equilibrio: calcula en qué año la plusvalía acumulada supera el flujo negativo acumulado. Montos en CLP.",
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
    "decision": "COMPRAR | AJUSTA EL PRECIO | BUSCAR OTRA",
    "explicacion_clp": "2-3 oraciones con montos en CLP.",
    "explicacion_uf": "Lo mismo pero con montos en UF."
  },

  "aFavor": ["Punto positivo 1", "Punto positivo 2", "Punto positivo 3 si hay"],
  "puntosAtencion": ["Punto negativo 1", "Punto negativo 2", "Punto negativo 3 si hay"]
}

REGLAS DE NEGOCIACIÓN (OBLIGATORIAS):
- Si la plusvalía inmediata es >15% (ya compra MUY bajo mercado): NO sugieras más descuento. En vez, di que ya está comprando excelente y que revise bien el estado del departamento: estructura, deuda de GGCC, litigios, humedad, estado de instalaciones. Un descuento tan grande puede esconder problemas. El precioSugerido debe ser el precio de compra actual.
- USA los datos de negociación calculados arriba. NO inventes porcentajes de descuento genéricos.
- Si el descuento para flujo neutro es ≤10%: sugiere ESE precio exacto. "Negociando a ${fmtUF(precioFlujoNeutroUF > 0 ? Math.round(precioFlujoNeutroUF) : input.precio)} logras flujo neutro — ese es tu objetivo."
- Si el descuento para flujo neutro es >10% pero ≤20%: sugiere el máximo realista (10%) y advierte que aún tendrá flujo negativo.
- Si el descuento es >20%: NO sugieras negociar por flujo. Di que solo funciona por plusvalía. Precio sugerido = máximo descuento realista (10%): ${fmtUF(Math.round(input.precio * 0.9))}.
- NUNCA sugieras más de 10% de descuento como objetivo realista.
- Si hay ventaja de compra moderada (5-15% bajo mercado): destaca que YA está comprando bien.
- CÓMO NEGOCIAR: da argumentos concretos:
  * Mucha oferta en la zona: "hay deptos similares publicados, tienes poder de negociación"
  * Flujo negativo: "el vendedor sabe que con las tasas actuales pocos pueden pagar precio lista"
  * Depto publicado hace tiempo: "si lleva más de 3 meses, el vendedor está más flexible"
  * Proyecto nuevo: "pide descuento directo o que bonifiquen gastos de cierre/estacionamiento"

REGLAS DE "BUSCAR OTRA":
- Si el veredicto es BUSCAR OTRA, incluye QUÉ buscar:
  * Rango de precio: "busca en el rango UF X a UF Y"
  * Zona: "en ${input.comuna} o comunas similares"
  * Características: "un depto de X-Y m² con estacionamiento para mejorar el arriendo"
  * Arriendo objetivo: "necesitas arriendo de al menos ${fmtCLP(Math.round(m.dividendo * 0.8))} para flujo manejable"

REGLAS GENERALES:
- En la versión _clp, todos los montos en CLP ($XXX.XXX). En la versión _uf, todos los montos en UF.
- No uses jerga sin explicar entre paréntesis
- Sé directo y honesto, no diplomático
- Si los números no favorecen la inversión, dilo claramente
- Los cálculos de comparación con alternativas deben ser correctos matemáticamente
- Adapta el tono: si el score es >70 sé positivo, si es 50-70 sé cauteloso, si es <50 sé directo sobre los problemas
- El veredicto debe ser UNA de las tres opciones: COMPRAR, AJUSTA EL PRECIO, o BUSCAR OTRA
- Los campos "alerta_clp" y "alerta_uf" en tuBolsillo deben ser string vacío "" si no aplica
- Los arrays aFavor y puntosAtencion NO llevan bullet points (•, *, -) al inicio. Solo texto limpio.
- Si el estado es "En blanco" o "En verde" con fecha de entrega futura, NO digas "departamento nuevo (0 años)". Di "departamento en construcción con entrega en [fecha]".
- Si hay ANOMALÍAS DETECTADAS arriba, DEBES mencionarlas. Si el arriendo está inflado, advierte: "Ojo: tu arriendo de $X está Y% sobre mercado. Si no logras arrendar a ese precio, tu flujo empeora." Si el precio está bajo, reconoce la ventaja.`;

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
