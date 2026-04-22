import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findNearestStation } from "@/lib/metro-stations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "@/lib/plusvalia-historica";
import { estimarContribuciones } from "@/lib/contribuciones";

const anthropic = new Anthropic();

export const SYSTEM_PROMPT = `Eres Franco — un analista de inversión inmobiliaria claro y directo. Hablas en español neutro-chileno, sin rodeos. No usas jerga financiera sin explicar. Tu misión: que el inversionista entienda con claridad en qué se mete, con números concretos.

TU PERSONALIDAD:
- Directo. Si los números no dan, lo dices sin suavizar.
- Concreto. Siempre das cifras, nunca generalidades. "Necesitas ganar mínimo $X/mes" en vez de "necesitas buenos ingresos".
- Constructivo. Si algo está mal, dices QUÉ hacer: negociar a UF X, buscar en zona Y, poner más pie.
- Honesto sobre el mercado. No vendes humo. Si el flujo es negativo, no lo escondes. Pero tampoco alarmas — en Chile 2024-2026 es lo normal con tasas de 4-5%.
- Cuando recomiendas "buscar otra", dices QUÉ buscar: rango de precio, zona, superficie, arriendo necesario.
- Cuando recomiendas negociar, dices CÓMO: argumentos concretos, precio objetivo, por qué.

TU TONO:
- Español chileno NEUTRO, con tuteo. Usa formas imperativas chilenas: "baja" (no "bajá"), "tienes" (no "tenés"), "protege" (no "protegé"), "piensa" (no "pensá"), "revisa" (no "revisá"), "considera" (no "considerá"), "decide" (no "decidí"), "usa" (no "usá"), "evalúa" (no "evaluá"), "compara" (no "comparás"), "pregunta" (no "preguntá"), "busca" (no "buscá"), "negocia" (no "negociá"), "paga" (no "pagás"), "sabes" (no "sabés"), "puedes" (no "podés"), "debes" (no "debés"), "quieres" (no "querés").
- Voseo argentino PROHIBIDO. Las conjugaciones voseadas ("bajás", "tenés", "protegés", "cachás", "sabés", "podés", "querés", "debés", "hacés", "decís") no aparecen bajo ninguna circunstancia.
- Sin expresiones coloquiales argentinas ("dale", "ponele", "tenés onda", "re bien", "che", "bárbaro"). Tampoco chilenismos fuertes ("cachai", "wena", "filete", "bacán", "weon/weón", "po").
- Profesional pero cercano. Como un asesor financiero joven chileno que habla sin rodeos pero con respeto.
- No empiezas con frases como "Te voy a hablar claro" o "Voy a ser franco contigo". El tono directo se demuestra, no se anuncia.
- Puedes ser directo con los números: "Este depto pide una negociación: el flujo negativo de $380.000/mes es difícil de sostener."
- Usa "tú", no "usted".
- Deja que los datos hablen. En vez de adjetivos ("terrible", "increíble"), muestra el número y su contexto.

TU MENSAJERÍA:
- NO hables de corredores como adversarios. No uses frases como "lo que tu corredor no te dice", "te están clavando", "no te autoengañes".
- El descalce de precio vs. valor real es un dato de mercado que mencionas neutralmente, no una acusación.
- Franco sirve por igual a inversionistas particulares, a corredores que quieren análisis para sus clientes, y a asesores. Mantén el tono neutral al canal.

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

/**
 * Detects whether an ai_analysis object already uses the new structure
 * (siendoFrancoHeadline_clp + conviene). If so, callers can skip regeneration.
 */
export function hasNewAiStructure(ai: unknown): boolean {
  if (!ai || typeof ai !== "object") return false;
  const obj = ai as Record<string, unknown>;
  return typeof obj.siendoFrancoHeadline_clp === "string" && typeof obj.conviene === "object";
}

/**
 * Generates the AI analysis for a given analysisId, persists it to the DB
 * in `ai_analysis`, and returns the result. Returns null on failure.
 *
 * This function does NOT handle auth, ownership, or credit consumption.
 * Callers must do that before invoking.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateAiAnalysis(analysisId: string, supabase: SupabaseClient): Promise<any | null> {
  try {
    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) return null;

    const input = analysis.input_data;
    const results = analysis.results;
    if (!input || !results) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mRaw = results.metrics as any;
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
      // use defaults
    }

    const creditoCLP = m.precioCLP * (1 - input.piePct / 100);
    const GASTOS_CIERRE_PCT = 0.02;
    const inversionTotal = m.pieCLP + Math.round(m.precioCLP * GASTOS_CIERRE_PCT);

    const mesesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const fechaEntregaFmt = input.fechaEntrega
      ? (() => { const [a, me] = input.fechaEntrega.split("-").map(Number); return `${mesesEs[(me || 1) - 1]} ${a}`; })()
      : "";

    const precioConDescuento10 = Math.round(input.precio * 0.9);
    const projections = results.projections as { flujoAcumulado: number }[] | undefined;
    const flujoNegAcum10 = projections && projections.length >= 10 && projections[9].flujoAcumulado < 0
      ? Math.round(Math.abs(projections[9].flujoAcumulado))
      : m.flujoNetoMensual < 0 ? Math.round(Math.abs(m.flujoNetoMensual) * 12 * 10) : 0;
    const datoDP = Math.round(inversionTotal * Math.pow(1.05, 10));
    const datoFM = Math.round(inversionTotal * Math.pow(1.07, 10));
    const valorProp5 = Math.round(m.precioCLP * Math.pow(1.04, 5));
    const valorProp10 = Math.round(m.precioCLP * Math.pow(1.04, 10));
    const dividendoSiTasaSube1 = creditoCLP > 0
      ? Math.round((creditoCLP * ((input.tasaInteres + 1) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 1) / 100 / 12, -(input.plazoCredito * 12))))
      : 0;
    const dividendoSiTasaSube2 = creditoCLP > 0
      ? Math.round((creditoCLP * ((input.tasaInteres + 2) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 2) / 100 / 12, -(input.plazoCredito * 12))))
      : 0;

    const flujoNegAcum5 = projections && projections.length >= 5 && projections[4].flujoAcumulado < 0
      ? Math.round(Math.abs(projections[4].flujoAcumulado))
      : Math.round(Math.abs(m.flujoNetoMensual) * 60);

    // --- Anomalías ---
    const anomalias: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zonaRadio = (input as any).zonaRadio as { precioM2VentaCLP?: number; arriendoPromedio?: number } | undefined;
    const arriendoRef = zonaRadio?.arriendoPromedio || arriendoZona;
    if (arriendoRef > 0 && input.arriendo > 0) {
      const diffArriendo = ((input.arriendo - arriendoRef) / arriendoRef) * 100;
      if (diffArriendo > 30) {
        const flujoConArriendoReal = m.flujoNetoMensual - (input.arriendo - arriendoRef);
        anomalias.push(`ARRIENDO ALTO: El usuario ingresó ${fmtCLP(input.arriendo)} pero el mercado paga ${fmtCLP(arriendoRef)} (${Math.round(diffArriendo)}% sobre mercado). Considera ajustar a la baja tu proyección de arriendo o verifica con propiedades similares publicadas en la zona — si no logras ese precio, tu flujo real sería ${fmtCLP(flujoConArriendoReal)}, no ${fmtCLP(m.flujoNetoMensual)}.`);
      } else if (diffArriendo < -30) {
        anomalias.push(`ARRIENDO BAJO: El usuario ingresó arriendo de ${fmtCLP(input.arriendo)} pero el mercado indica ${fmtCLP(arriendoRef)} (${Math.round(Math.abs(diffArriendo))}% bajo mercado). Podría estar subestimando o es una zona particular. Sugiere verificar.`);
      }
    }
    const precioM2Usuario = input.precio / input.superficie;
    const precioM2Ref = zonaRadio?.precioM2VentaCLP ? (zonaRadio.precioM2VentaCLP / UF_CLP) : precioM2Zona;
    if (precioM2Ref > 0 && precioM2Usuario > 0) {
      const diffPrecio = ((precioM2Usuario - precioM2Ref) / precioM2Ref) * 100;
      if (diffPrecio > 30) {
        anomalias.push(`PRECIO ALTO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(diffPrecio)}% sobre el promedio de la zona (${fmtUF(precioM2Ref)}/m²). Posible sobreprecio.`);
      } else if (diffPrecio < -30) {
        anomalias.push(`PRECIO BAJO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(Math.abs(diffPrecio))}% bajo el promedio de la zona (${fmtUF(precioM2Ref)}/m²). Excelente oportunidad si es correcto.`);
      }
    }
    const ggccEstimado = input.superficie * 2000;
    if (input.gastos > 0 && input.gastos > ggccEstimado * 1.5) {
      anomalias.push(`GGCC ALTOS: Gastos comunes de ${fmtCLP(input.gastos)} parecen altos para ${input.superficie}m² (referencia ~${fmtCLP(ggccEstimado)}). Verificar si incluyen calefacción central, agua caliente u otros servicios.`);
    } else if (input.gastos > 0 && input.gastos < ggccEstimado * 0.3) {
      anomalias.push(`GGCC MUY BAJOS: Para ${input.superficie}m², la referencia es ~${fmtCLP(ggccEstimado)}/mes pero ingresó ${fmtCLP(input.gastos)}. Puede ser correcto en edificios chicos o antiguos. Verificar que no falte incluir algún gasto.`);
    }

    const precioCLPFull = m.precioCLP || input.precio * UF_CLP;
    const esNuevo = input.tipo === "nuevo" || input.condicion === "nuevo" || input.tipoPropiedad === "nuevo";
    const contribEstimada = estimarContribuciones(precioCLPFull, esNuevo);
    const contribUsuario = input.contribuciones || 0;
    if (contribEstimada === 0 && contribUsuario > 50000) {
      anomalias.push(`CONTRIBUCIONES SOBREESTIMADAS: Franco estima $0 (posible exención DFL-2 por bajo avalúo fiscal) pero el usuario ingresó ${fmtCLP(contribUsuario)}/trimestre. Eso son ${fmtCLP(contribUsuario * 4)}/año de más si la propiedad está exenta. Sugiérele verificar en sii.cl/mapas.`);
    } else if (contribEstimada > 0 && contribUsuario > contribEstimada * 2) {
      anomalias.push(`CONTRIBUCIONES MUY ALTAS: Estimación Franco ~${fmtCLP(contribEstimada)}/trim pero usuario ingresó ${fmtCLP(contribUsuario)} (${Math.round(contribUsuario / contribEstimada * 100)}% más). Verificar en sii.cl/mapas.`);
    } else if (contribEstimada > 0 && contribUsuario > 0 && contribUsuario < contribEstimada * 0.3) {
      anomalias.push(`CONTRIBUCIONES MUY BAJAS: Estimación Franco ~${fmtCLP(contribEstimada)}/trim pero usuario ingresó ${fmtCLP(contribUsuario)}. Puede ser correcto si tiene exención parcial. Verificar en sii.cl/mapas.`);
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
      ? `\n\nANOMALÍAS DETECTADAS EN LOS INPUTS:\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nDEBES mencionar cada anomalía relevante en tu análisis. Si el arriendo está inflado, advierte que las métricas reales podrían ser peores. Si el precio está bajo, reconoce la oportunidad.`
      : "";
    const anomaliaValorTexto = anomaliaValorMercado ? `\n\nSOBRE EL VALOR DE MERCADO:\n${anomaliaValorMercado}` : "";

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
      ? `\n\nANOMALÍAS DE FINANCIAMIENTO:\n${anomaliasFinanciamiento.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nMenciona los problemas de financiamiento directamente y con montos concretos. Si aplica, calcula cuánto mejoraría el flujo con mejor tasa o plazo más largo.`
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

    // --- Datos Score v2 ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputAny = input as any;
    const lat = inputAny.lat || inputAny.zonaRadio?.lat || null;
    const lng = inputAny.lng || inputAny.zonaRadio?.lng || null;

    let metroInfo = "";
    if (lat && lng) {
      const nearestActive = findNearestStation(lat, lng, "active");
      const nearestFuture = findNearestStation(lat, lng, "future");
      if (nearestActive) {
        const distKm = (nearestActive.distance / 1000).toFixed(1);
        metroInfo += `Estación de metro más cercana: ${nearestActive.station.name} (${nearestActive.station.line}) a ${distKm} km. `;
        if (nearestActive.distance < 500) metroInfo += "Excelente ubicación respecto a metro. ";
        else if (nearestActive.distance < 1000) metroInfo += "Buena cercanía a metro. ";
        else if (nearestActive.distance > 2500) metroInfo += "Lejos de metro, puede afectar demanda de arriendo y plusvalía. ";
      }
      if (nearestFuture && nearestFuture.distance < 2000) {
        const distKm = (nearestFuture.distance / 1000).toFixed(1);
        metroInfo += `Futura estación: ${nearestFuture.station.name} (${nearestFuture.station.line}) a ${distKm} km — potencial de plusvalía adicional cuando se construya.`;
      }
    } else {
      metroInfo = "Sin datos de ubicación exacta para evaluar cercanía a metro.";
    }

    const comunaNorm = (input.comuna || "").trim();
    const historica = PLUSVALIA_HISTORICA[comunaNorm];
    let plusvaliaHistoricaInfo = "";
    if (historica) {
      plusvaliaHistoricaInfo = `Plusvalía histórica de ${comunaNorm} (2014-2024): ${historica.plusvalia10a}% en 10 años (${historica.anualizada}% anual). Precio promedio depto pasó de UF ${historica.precio2014.toLocaleString()} a UF ${historica.precio2024.toLocaleString()}.`;
      if (historica.anualizada >= 4.5) plusvaliaHistoricaInfo += " Comuna con plusvalía ALTA.";
      else if (historica.anualizada >= 3.0) plusvaliaHistoricaInfo += " Comuna con plusvalía MODERADA.";
      else if (historica.anualizada >= 1.5) plusvaliaHistoricaInfo += " Comuna con plusvalía BAJA.";
      else plusvaliaHistoricaInfo += " Comuna con plusvalía MUY BAJA o NEGATIVA — cuidado.";
    } else {
      plusvaliaHistoricaInfo = `Sin datos históricos de plusvalía para ${comunaNorm}. Se usa promedio Gran Santiago (${PLUSVALIA_DEFAULT.anualizada}% anual).`;
    }

    const COMUNAS_GRAN_SANTIAGO = ["Santiago","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín","Cerrillos","La Cisterna","Huechuraba","Conchalí","Lo Prado","Pudahuel","San Bernardo","El Bosque","Pedro Aguirre Cerda","Quilicura","Peñalolén","Renca","Cerro Navia","San Ramón","La Granja","La Pintana","Lo Espejo","Colina","Lampa"];
    const esFueraGranSantiago = comunaNorm ? !COMUNAS_GRAN_SANTIAGO.includes(comunaNorm) : false;

    const scoreBreakdownInfo = results?.scoreBreakdown
      ? `Desglose del Franco Score: Rentabilidad ${results.scoreBreakdown.rentabilidad}/100, Flujo Caja ${results.scoreBreakdown.flujoCaja}/100, Plusvalía ${results.scoreBreakdown.plusvalia}/100, Eficiencia ${results.scoreBreakdown.eficiencia}/100.`
      : "";

    const precioSugeridoUF = plusvaliaFrancoPct > 15
      ? Math.round(input.precio)
      : precioFlujoNeutroUF > 0 && descuentoParaNeutro <= 10
        ? Math.round(precioFlujoNeutroUF)
        : Math.round(input.precio * 0.9);

    const veredictoMotor = results.veredicto || (results.score >= 70 ? "COMPRAR" : results.score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");

    const userPrompt = `Analiza esta inversión inmobiliaria en Chile y responde en JSON con la estructura exacta descrita al final.

IMPORTANTE: Para cada campo con sufijo _clp / _uf, genera DOS versiones: una con valores en CLP y otra con valores en UF.
- Versión CLP: usa pesos chilenos con formato $XXX.XXX (separador de miles con punto)
- Versión UF: usa UF con el valor 1 UF = ${fmtCLP(UF_CLP)}. Formato: "UF X,X" para valores menores a 100 UF, "UF X.XXX" para valores mayores. NUNCA escribas "UF 0".
- Los campos que no tienen sufijo son iguales en ambas monedas (labels, preguntas, colores, etc).

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
${esFueraGranSantiago ? `\nADVERTENCIA: Esta propiedad está fuera del Gran Santiago. Los datos de metro, plusvalía histórica y comparación de mercado pueden no ser precisos. Menciona esta limitación al usuario.` : ""}

Menciona estos datos en tu análisis cuando sean relevantes:
- Si hay metro cerca (<500m), menciónalo como ventaja para arriendo y plusvalía
- Si hay metro futuro cerca, menciónalo como potencial de plusvalía
- Si no hay metro cerca (>2.5km), menciónalo como riesgo para demanda de arriendo
- Menciona la plusvalía histórica real de la comuna (no inventes datos)
- Si la eficiencia es baja (<40), menciona que está pagando sobre el precio de mercado de la zona o que su yield es bajo comparado con propiedades similares cercanas
- Si la eficiencia es alta (>70), destaca que está comprando a buen precio relativo al mercado del radio
${anomaliasTexto}${anomaliaValorTexto}${anomaliasFinTexto}
${(() => {
  const calificaSubsidio = (input.tipo === "Nuevo" || input.tipo === "nuevo") && input.precio <= 4000;
  if (!calificaSubsidio) return "";
  const tasaConSubsidio = 3.5;
  const usoTasaSubsidio = input.tasaInteres <= tasaConSubsidio + 0.2;
  const dividendoActual = m.dividendo;
  const creditoCLPSub = m.precioCLP * (1 - input.piePct / 100);
  const tasaMesSub = tasaConSubsidio / 100 / 12;
  const nMeses = input.plazoCredito * 12;
  const dividendoConSubsidio = Math.round((creditoCLPSub * tasaMesSub) / (1 - Math.pow(1 + tasaMesSub, -nMeses)));
  const ahorroDividendo = dividendoActual - dividendoConSubsidio;
  return `
SUBSIDIO A LA TASA (Ley 21.748):
- Este depto CALIFICA al subsidio (tipo Nuevo y ≤ 4.000 UF)
- Tasa ingresada por el usuario: ${input.tasaInteres}%
- Tasa estimada con subsidio: ~${tasaConSubsidio}%
- El usuario ${usoTasaSubsidio ? "YA usó" : "NO usó"} una tasa con subsidio
${!usoTasaSubsidio ? `- Con subsidio el dividendo bajaría de ${fmtCLP(dividendoActual)} a ~${fmtCLP(dividendoConSubsidio)} (ahorro ~${fmtCLP(ahorroDividendo)}/mes)` : ""}
INSTRUCCIONES SUBSIDIO:
${usoTasaSubsidio
    ? "- Menciona positivamente que está considerando la tasa con subsidio."
    : "- ALERTA sobre la oportunidad: calcula cuánto bajaría el dividendo y el flujo. Usa lenguaje no imperativo: 'podrías considerar', 'existe la opción de', 'vale la pena evaluar'."
}
- Menciona requisitos: primera vivienda, promesa firmada desde 2025, vigente hasta mayo 2027 o hasta agotar 50.000 cupos.
- NO uses lenguaje imperativo (por regulación).
`;
})()}
VEREDICTO OBLIGATORIO: El veredicto del motor es "${veredictoMotor}". DEBES usar este mismo veredicto. No lo cambies. Tu trabajo es explicar POR QUÉ el veredicto es ese, no decidir uno diferente. Si te parece contraintuitivo (ej: score 43 pero dice BUSCAR OTRA por flujo insostenible), explica qué señales negativas lo causan.

DATOS DE NEGOCIACIÓN (calculados por el motor):
${datosNegociacion}
${datosPasada ? `\nPLUSVALÍA INMEDIATA:\n${datosPasada}` : ""}

DATOS ADICIONALES PARA CONSTRUIR EL ANÁLISIS:
- Flujo negativo acumulado a 5 años: ${fmtCLP(flujoNegAcum5)}
- Flujo negativo acumulado a 10 años: ${fmtCLP(flujoNegAcum10)}
- Valor propiedad proyectado a 5 años (plusvalía 4%): ${fmtCLP(valorProp5)}
- Valor propiedad proyectado a 10 años (plusvalía 4%): ${fmtCLP(valorProp10)}
- Ganancia neta si vende en 10 años: ${fmtCLP(exit.gananciaNeta)}
- Alternativa: depósito a plazo al 5% anual a 10 años: ${fmtCLP(datoDP)}
- Alternativa: fondo mutuo al 7% anual a 10 años: ${fmtCLP(datoFM)}
- Si tasa sube 1%, dividendo pasa de ${fmtCLP(m.dividendo)} a ${fmtCLP(dividendoSiTasaSube1)}
- Si tasa sube 2%, dividendo pasa de ${fmtCLP(m.dividendo)} a ${fmtCLP(dividendoSiTasaSube2)}

Responde SOLO con un JSON válido con esta estructura exacta:

{
  "siendoFrancoHeadline_clp": "Frase corta (1-2 oraciones, 15-20 palabras máx) que sirve como titular principal. Responde en una línea qué hacer con este depto. Ejemplos: COMPRAR + flujo positivo: 'Los números cierran. El arriendo cubre los costos y te sobran $62.000 cada mes.' AJUSTA: 'A UF 3.200 el depto no se paga solo. Bajando a UF 2.650 los números empiezan a cerrar.' BUSCAR OTRA: 'A este precio y con esta tasa, el depto no se sostiene. Busca otra zona o mejor financiamiento.'",
  "siendoFrancoHeadline_uf": "Lo mismo con montos en UF.",

  "conviene": {
    "pregunta": "¿Conviene o no conviene?",
    "respuestaDirecta_clp": "2-3 oraciones en lenguaje cotidiano (sin tecnicismos) que responden directamente si conviene. Primer párrafo, como hablándole a alguien que nunca ha invertido. Montos en CLP.",
    "respuestaDirecta_uf": "Lo mismo en UF.",
    "veredictoFrase_clp": "1 oración corta que acompaña el badge del veredicto ${veredictoMotor}. Ejemplos: COMPRAR: 'Los números cierran y la zona acompaña.' AJUSTA EL PRECIO: 'Los números piden una negociación antes de firmar.' BUSCAR OTRA: 'Los números no dan espacio para que esto funcione.'",
    "veredictoFrase_uf": "Lo mismo en UF.",
    "datosClave": [
      {
        "label": "Etiqueta corta (2-3 palabras, ej: 'Flujo mensual', 'Precio sugerido', 'Retorno 10 años')",
        "valor_clp": "Valor formateado en CLP",
        "valor_uf": "Valor formateado en UF",
        "subtexto": "Contexto breve (2-4 palabras, opcional — puede ser '')",
        "color": "red | green | neutral | accent"
      }
    ],
    "reencuadre_clp": "2-3 oraciones que reencuadran qué tipo de decisión está tomando el usuario. Si es BUSCAR OTRA, aterrizar qué buscar (rango de precio, zona, superficie, arriendo objetivo). Si es COMPRAR, reforzar por qué tiene sentido. Si es AJUSTA, explicar qué margen hay. Montos en CLP.",
    "reencuadre_uf": "Lo mismo en UF.",
    "cajaAccionable_clp": "Pregunta o instrucción concreta que el usuario debe contestarse o hacer antes de seguir. Montos en CLP.",
    "cajaAccionable_uf": "Lo mismo en UF.",
    "cajaLabel": "Label corto de la caja. Ejemplo: 'Antes de seguir, decide:'"
  },

  "costoMensual": {
    "pregunta": "¿Qué te cuesta mes a mes?",
    "contenido_clp": "2-3 oraciones con el desglose narrativo del flujo mensual: entra X de arriendo, sale Y en dividendo + gastos, queda Z (${fmtCLP(m.flujoNetoMensual)}). Usa cifras concretas en CLP.",
    "contenido_uf": "Lo mismo en UF.",
    "cajaAccionable_clp": "Pregunta de autoevaluación sobre si el usuario puede sostener este aporte. Montos en CLP.",
    "cajaAccionable_uf": "Lo mismo en UF.",
    "cajaLabel": "Hazte esta pregunta:"
  },

  "negociacion": {
    "pregunta": "¿Hay margen para negociar?",
    "contenido_clp": "2-3 oraciones que explican a qué precio el depto se paga solo, cuánto descuento requiere, y qué tan realista es. Basado en los DATOS DE NEGOCIACIÓN calculados arriba (precioFlujoNeutro, descuentoParaNeutro). Montos en CLP.",
    "contenido_uf": "Lo mismo en UF.",
    "cajaAccionable_clp": "Guion o argumento concreto que el usuario puede usar para plantear la contraoferta. Puede incluir texto entre comillas que el usuario pueda citar. Montos en CLP.",
    "cajaAccionable_uf": "Lo mismo en UF.",
    "cajaLabel": "Guión para la contraoferta:",
    "precioSugerido": "${fmtUF(precioSugeridoUF)}"
  },

  "largoPlazo": {
    "pregunta": "¿Vale la pena a 10 años?",
    "contenido_clp": "2-3 oraciones: cuánto aporta el usuario acumulado, cuánto se valoriza el depto (${fmtCLP(valorProp10)} con plusvalía 4%), cuánto recupera si vende (${fmtCLP(exit.gananciaNeta)} ganancia neta), TIR estimada (${exit.tir.toFixed(1)}%). Compara vs depósito a plazo (${fmtCLP(datoDP)}) o fondo mutuo (${fmtCLP(datoFM)}). Montos en CLP.",
    "contenido_uf": "Lo mismo en UF.",
    "cajaAccionable_clp": "Cuál es la apuesta implícita que el usuario está haciendo (plusvalía de la zona, crecimiento, etc). Le da claridad sobre qué tiene que creer para que la inversión funcione. Montos en CLP.",
    "cajaAccionable_uf": "Lo mismo en UF.",
    "cajaLabel": "La apuesta que estás haciendo:"
  },

  "riesgos": {
    "pregunta": "¿Qué puede salir mal?",
    "contenido_clp": "3 riesgos principales, cada uno en 1-2 oraciones, separados por saltos de línea dobles. Cada riesgo empieza con el nombre del riesgo en negrita usando markdown: '**Vacancia larga.** Si el depto queda sin arrendatario 3 meses...'. Usa los datos concretos: si tasa sube 1% dividendo pasa a ${fmtCLP(dividendoSiTasaSube1)}; vacancia cuesta ${fmtCLP(input.arriendo + input.gastos)}/mes; etc. Montos en CLP.",
    "contenido_uf": "Lo mismo en UF.",
    "cajaAccionable_clp": "Si el usuario decide avanzar, qué flancos concretos debe proteger (fondo de reserva, comparación de tasas bancarias, verificación del edificio, etc). Montos en CLP.",
    "cajaAccionable_uf": "Lo mismo en UF.",
    "cajaLabel": "Si decides avanzar, protegé estos flancos:"
  }
}

REGLAS PARA datosClave (OBLIGATORIAS):
- Generar EXACTAMENTE 3 datos clave.
- Uno de los 3 debe tener "color": "accent" — es el dato más accionable/importante. Los otros 2 usan "red" (negativo), "green" (positivo) o "neutral" (contextual) según el valor.
- Según el veredicto ${veredictoMotor}:
  * Si COMPRAR: típicamente (1) Flujo mensual color "green", (2) Rentabilidad neta color "accent", (3) Retorno 10 años color "green".
  * Si AJUSTA EL PRECIO: típicamente (1) Aporte mensual color "red", (2) Precio sugerido (${fmtUF(precioSugeridoUF)}) color "accent", (3) Retorno 10 años color "green" o "neutral".
  * Si BUSCAR OTRA: típicamente (1) Aporte mensual color "red", (2) Sobreprecio de zona o precio imposible color "accent", (3) Meses hasta break-even o alternativas color "neutral".

REGLAS DE NEGOCIACIÓN (OBLIGATORIAS):
- Si la plusvalía inmediata es >15% (ya compra MUY bajo mercado): NO sugieras más descuento. Destaca que ya está comprando excelente y que revise estado: estructura, deuda de GGCC, litigios, humedad, estado de instalaciones. Un descuento tan grande puede esconder problemas. precioSugerido = precio actual.
- USA los datos de negociación calculados arriba. NO inventes porcentajes genéricos.
- Si el descuento para flujo neutro es ≤10%: sugiere ESE precio exacto.
- Si el descuento para flujo neutro es >10% pero ≤20%: sugiere máximo realista (10%) y advierte que aún tendrá flujo negativo.
- Si el descuento es >20%: NO sugieras negociar por flujo. Di que solo funciona por plusvalía. precioSugerido = máximo descuento realista (10%): ${fmtUF(Math.round(input.precio * 0.9))}.
- NUNCA sugieras más de 10% de descuento como objetivo realista.
- Si hay ventaja de compra moderada (5-15% bajo mercado): destaca que YA está comprando bien.
- CÓMO NEGOCIAR (argumentos a incluir en la cajaAccionable cuando aplique):
  * Mucha oferta en la zona: "hay deptos similares publicados, tienes poder de negociación"
  * Flujo negativo: "con las tasas actuales, pocos compradores pueden pagar precio lista"
  * Depto publicado hace tiempo: "si lleva más de 3 meses, el vendedor está más flexible"
  * Proyecto nuevo: "pide descuento directo o que bonifiquen gastos de cierre/estacionamiento"

REGLAS DE "BUSCAR OTRA":
- Si el veredicto es BUSCAR OTRA, en el reencuadre_clp/_uf incluye QUÉ buscar:
  * Rango de precio: "busca en el rango UF X a UF Y"
  * Zona: "en ${input.comuna} o comunas similares"
  * Características: "un depto de X-Y m² con estacionamiento"
  * Arriendo objetivo: "necesitas arriendo de al menos ${fmtCLP(Math.round(m.dividendo * 0.8))} para flujo manejable"

REGLAS GENERALES:
- En la versión _clp, todos los montos en CLP ($XXX.XXX). En la versión _uf, todos los montos en UF.
- No uses jerga sin explicar
- Sé directo y honesto, no diplomático
- Si los números no favorecen la inversión, dilo claramente
- Adapta el tono según score: >70 positivo, 50-70 cauteloso, <50 directo sobre los problemas
- Si el estado es "futura" con fecha de entrega, NO digas "departamento nuevo (0 años)". Di "departamento en construcción con entrega en [fecha]".
- Si hay ANOMALÍAS DETECTADAS arriba, menciónalas en el campo relevante (costoMensual o riesgos o reencuadre según el tipo).`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let aiResult;
    try {
      const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      aiResult = JSON.parse(cleaned);
    } catch (e) {
      console.error("Error parsing AI response:", e, "raw:", text.slice(0, 500));
      return null;
    }

    await supabase
      .from("analisis")
      .update({ ai_analysis: aiResult })
      .eq("id", analysisId);

    return aiResult;
  } catch (error) {
    console.error("generateAiAnalysis error:", error);
    return null;
  }
}
