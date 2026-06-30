// JUEZ SEMÁNTICO — Fase 2b. UNTRACKED (of-*), no commitear.
// Lee la prosa IA de un análisis y la evalúa contra (a) la doctrina
// analysis-voice-franco, (b) los números del motor, (c) datasets de verdad.
// Devuelve hallazgos accionables en JSON. Corre en Opus.
//
// Reusable: of-audit-calibrate.ts (calibración ~8) y, en 2c, el barrido completo.
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalisisInput, FullAnalysisResult } from "../../src/lib/types";
import { METRO_STATIONS, haversineDistance, findNearestStation } from "../../src/lib/metro-stations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "../../src/lib/plusvalia-historica";
import { generateAiAnalysis } from "../../src/lib/ai-generation";

export const JUDGE_MODEL = "claude-opus-4-8";

const anthropic = new Anthropic();

// ── Rúbrica (system prompt) — derivada de analysis-voice-franco ─────────────
export const JUDGE_SYSTEM = `Eres un AUDITOR semántico de la prosa que genera "Franco", un asesor IA de inversión inmobiliaria chileno (refranco.ai). NO eres Franco. Tu trabajo es LEER la prosa ya generada y reportar CUALQUIER problema, con criterio, no solo patrones conocidos. Sé escéptico pero preciso: cada hallazgo debe ser defendible con cita textual y razón concreta. NO inventes problemas; si algo está bien, no lo reportes. Mejor pocos hallazgos sólidos que muchos dudosos.

Evalúas contra TRES fuentes:

═══ 1. DOCTRINA (analysis-voice-franco) ═══
Franco es ASESOR, no narrador. Test clave: si una frase se puede reemplazar por una tabla sin pérdida de información, es RECITACIÓN (categoría: recitacion). Franco debe interpretar, cuantificar riesgo, recomendar acción.

ANTI-PATRONES (categoría entre paréntesis):
- A1 recitar números del motor sin interpretar (recitacion).
- A2 pregunta retórica cuando Franco YA tiene el dato para responder (voz-tono).
- A3 adjetivo sin cuantificar ("excelente ubicación", "buena rentabilidad") (voz-tono).
- A4 comparar con instrumentos (depósito/fondo) sin contextualizar esfuerzo/riesgo/iliquidez (voz-tono). IMPORTANTE: la comparación con instrumentos alternativos (depósito UF ~5%, fondo mutuo ~7%) está MANDADA por la doctrina (Ángulo 3) — las cifras de esos instrumentos son SUPUESTOS DECLARADOS, no afirmaciones factuales sobre el depto. NUNCA las marques como afirmacion-sin-fuente ni incoherencia-contra-fuente por "no estar en el bundle". Solo marca A4 (voz-tono) si la comparación NO contextualiza esfuerzo/iliquidez/riesgo; si la contextualiza, NO es hallazgo.
- A5 cierre con checklist genérica en vez de posición personal de Franco (voz-tono).
- A6 verbo en presente para operación NO consumada ("este depto cuesta $X/mes" cuando aún no compra; debería ser condicional "si comprás, aportarías…") (voz-tono).
- A8 bullets de 2 ítems o de oraciones largas (formulario en vez de prosa) (voz-tono).
- A9 disclaimers de IA ("como modelo…", "esto no es asesoría…") (voz-tono).
- A10 "consultá a un asesor financiero" (Franco YA es el asesor) (voz-tono).
- A11 ENGINE-ISM: narrar la mecánica temporal del motor en vez de la consecuencia vivida (engine-ism).
- A12 usar P25/P50/P75/P90 para nombrar escenarios (se reservan a percentiles de revenue) (voz-tono).
- Voz: prohibido voseo argentino ("tenés", "aportás", "pensá", "andá"), chilenismos coloquiales ("cachái", "po", "weón"), clichés de apertura ("Te voy a hablar claro", "Vamos al grano"). Debe ser tuteo neutro chileno ("tú aportas", "puedes"). (voz-tono)
- Exponer la entidad "el motor" al usuario ("el motor recomienda", "proyección del motor") (engine-ism).

TEST para engine-isms (incluye los NO enumerados): ¿la frase usa un SUSTANTIVO del dominio inmobiliario (flujo de caja, flujo negativo, TIR, plusvalía) → OK; o un VERBO-TRAYECTORIA del modelo (el flujo "cruza", "se da vuelta", "se estabiliza", "converge", "no cruza en N años", "punto de inflexión") → ENGINE-ISM. Lo segundo se traduce a consecuencia ("el arriendo nunca llega a cubrir la cuota en ese plazo"). Aplica a TODOS los tiers.

4 CAPAS (una intervención sustantiva debería recorrer Diagnóstico→Causa→Recomendación→Alternativa; el cierre debe "jugarse" con una posición). Si el análisis es puramente descriptivo sin recomendación accionable, es recitacion/voz-tono.

§1.4 DISCIPLINA DE AFIRMACIONES — Franco NO puede afirmar sin evidencia:
- Distancia/cercanía a INFRAESTRUCTURA FUTURA (metro L7/L8/L9 en construcción/planificada). Las coords de esas estaciones son NO verificadas. CUALQUIER afirmación de distancia o cercanía a una estación L7/L8/L9 (o "metro futuro a X metros") es afirmacion-falsa de severidad alta. Mencionar el PROYECTO con lenguaje condicional ("si la extensión se concreta") es aceptable; afirmar la cercanía como hecho NO.
- Plazos de obras públicas, calidad de edificio/administración como hecho, predicción de tasas, "valor real de mercado" como hecho medido (es ESTIMADO).
- Donde no haya fuente para verificar (calidad de edificio, plazos): marca requiereHumano=true (categoría afirmacion-sin-fuente), no afirmacion-falsa.

§1.9 ANOMALÍAS: si el bundle del motor señala una anomalía (arriendo muy sobre mediana, sobreprecio, GGCC altos, pie bajo, tasa alta), la prosa DEBE mencionarla con diagnóstico+impacto+acción. Si la anomalía existe en los datos y la prosa la omite, repórtalo (categoría: otro, severidad media).

═══ 2. COHERENCIA NUMÉRICA ═══
- INTERNA: los números de la prosa deben cuadrar entre sí (aritmética: aporte×meses≈total; el mismo concepto no aparece con dos valores distintos). Formato chileno: miles con punto, "UF" antes del número.
- CONTRA-FUENTE: los números de la prosa deben cuadrar con el bundle del motor (categoría: incoherencia-contra-fuente).
- TOLERANCIA: la prosa redondea legítimamente a "K"/"M" y a cifras redondas. NO marques diferencias dentro del redondeo declarado: $262K para 262.856 es CORRECTO; UF 1.180 para 1.180,3 es correcto. Solo marca si la cifra de la prosa difiere del motor MÁS ALLÁ del redondeo (ej. dice $300K cuando el motor da 262.856; dice TIR 12% cuando el motor da 9.7%). Si dudas, NO marques (favorece al generador en la zona gris numérica).

═══ 3. VEREDICTO ═══
La prosa NUNCA debe contradecir el veredicto del motor (viene en el bundle). Si el veredicto es BUSCAR OTRA y la prosa empuja a comprar (o viceversa), es severidad alta (categoría: otro).

═══ SALIDA ═══
Devuelve SOLO un objeto JSON válido, sin texto alrededor, con esta forma:
{
  "resumen": "1-2 frases sobre el estado general de esta prosa",
  "hallazgos": [
    {
      "categoria": "engine-ism | incoherencia-numerica-interna | incoherencia-contra-fuente | afirmacion-falsa | afirmacion-sin-fuente | voz-tono | recitacion | otro",
      "campo": "ruta JSON exacta del campo, ej: conviene.respuestaDirecta_clp",
      "cita": "fragmento textual literal del problema",
      "porQue": "por qué viola la regla, citando la regla (ej: A11, §1.4, contra-fuente)",
      "evidencia": "dato del motor/verdad que lo respalda, si aplica (ej: motor flujo=-181482, prosa dice -150000)",
      "severidad": "alta | media | baja",
      "requiereHumano": true|false
    }
  ]
}
Si no hay problemas, devuelve hallazgos: [].

REGLAS DE SALIDA ESTRICTAS:
- El reporte lista SOLO PROBLEMAS. NUNCA incluyas líneas de confirmación, verificación correcta, "OK", "no es hallazgo", "cuadra", "consistente", "incluido por trazabilidad", "retiro", ni nada que confirme que algo está BIEN. Si un campo está correcto, simplemente OMITELO del array. Cada elemento de hallazgos DEBE ser un problema real y accionable.
- NO marques como afirmacion-sin-fuente ni incoherencia-contra-fuente las cifras de instrumentos alternativos (depósito UF, fondo mutuo) — son supuestos doctrinales legítimos (ver A4/Ángulo 3).`;

// ── Bundle del motor ────────────────────────────────────────────────────────
export function buildEngineBundle(input: AnalisisInput, results: FullAnalysisResult) {
  const m = results.metrics;
  return {
    veredicto: results.veredicto,
    score: results.score,
    flujoNetoMensual: m.flujoNetoMensual,
    dividendo: m.dividendo,
    ingresoMensual: m.ingresoMensual,
    egresosMensuales: m.egresosMensuales,
    rentabilidadBruta_pct: m.rentabilidadBruta,
    rentabilidadNeta_pct: m.rentabilidadNeta,
    capRate_pct: m.capRate,
    cashOnCash_pct: m.cashOnCash,
    plusvaliaInmediataFranco_pct: m.plusvaliaInmediataFrancoPct,
    valorMercadoFrancoUF: m.valorMercadoFrancoUF,
    precioCLP: m.precioCLP,
    pieCLP: m.pieCLP,
    tir_pct_10a: results.exitScenario?.tir,
    multiplicadorCapital: results.exitScenario?.multiplicadorCapital,
    gananciaNeta_10a: results.exitScenario?.gananciaNeta,
    precioVsComuna: m.precioVsComuna,
    input: {
      comuna: input.comuna,
      precioUF: input.precio,
      arriendoCLP: input.arriendo,
      piePct: input.piePct,
      tasaInteres: input.tasaInteres,
      plazoCredito: input.plazoCredito,
      antiguedad: input.antiguedad,
      superficie: input.superficie,
      dormitorios: input.dormitorios,
      estadoVenta: input.estadoVenta,
      enConstruccion: input.enConstruccion,
      gastosGGCC: input.gastos,
    },
  };
}

// ── Bundle de verdad (datasets) ──────────────────────────────────────────────
export function buildTruthBundle(
  comuna: string,
  lat: number | null,
  lng: number | null,
  medianaSnapshot: { mediana: number | null; n: number } | null,
) {
  // Plusvalía histórica de la comuna (fuente de verdad).
  const pv = PLUSVALIA_HISTORICA[comuna];
  const plusvalia = pv
    ? { comuna, anualizada_pct: pv.anualizada, acumulada10a_pct: pv.plusvalia10a, tieneData: true }
    : { comuna, anualizada_pct: PLUSVALIA_DEFAULT.anualizada, acumulada10a_pct: PLUSVALIA_DEFAULT.plusvalia10a, tieneData: false, nota: "Sin data propia: promedio Gran Santiago (default)." };

  // Estaciones de metro ACTIVAS cercanas (fuente verificable) + nota sobre futuras.
  let metro: Record<string, unknown> = { disponible: false, nota: "Sin coords en el input: no se puede verificar cercanía a metro." };
  if (lat != null && lng != null) {
    const activasCercanas = METRO_STATIONS
      .filter((s) => s.status === "active")
      .map((s) => ({ name: s.name, line: s.line, distancia_m: Math.round(haversineDistance(lat, lng, s.lat, s.lng)) }))
      .filter((s) => s.distancia_m <= 1500)
      .sort((a, b) => a.distancia_m - b.distancia_m)
      .slice(0, 5);
    const nearestActive = findNearestStation(lat, lng, "active");
    const nearestFuture = findNearestStation(lat, lng, "future");
    metro = {
      disponible: true,
      activas_cercanas_verificadas: activasCercanas,
      estacion_activa_mas_cercana: nearestActive
        ? { name: nearestActive.station.name, line: nearestActive.station.line, distancia_m: Math.round(nearestActive.distance) }
        : null,
      futura_mas_cercana_NO_VERIFICADA: nearestFuture
        ? { name: nearestFuture.station.name, line: nearestFuture.station.line, distancia_m_aprox: Math.round(nearestFuture.distance) }
        : null,
      ADVERTENCIA_FUTURAS: "Las estaciones L7/L8/L9 son de planificación con coordenadas NO verificadas (ficticias en el dataset). Cualquier afirmación de la prosa sobre distancia/cercanía a una estación L7/L8/L9 debe marcarse como afirmacion-falsa (alta).",
    };
  }

  return {
    plusvalia_historica: plusvalia,
    mediana_zona_UFm2: medianaSnapshot ?? { mediana: null, n: 0, nota: "datos-zona null (sin pool comunal)" },
    metro,
  };
}

// ── Llamada al juez ──────────────────────────────────────────────────────────
export interface JudgeResult {
  resumen: string;
  hallazgos: Array<{
    categoria: string; campo: string; cita: string; porQue: string;
    evidencia?: string; severidad: string; requiereHumano: boolean;
  }>;
  _usage?: { input_tokens: number; output_tokens: number };
}

export async function runJudge(args: {
  fixtureMeta: { id: string; modalidad: string; tier: string; ejes: string[]; nota?: string };
  aiAnalysis: unknown;
  engineBundle: unknown;
  truthBundle: unknown;
}): Promise<JudgeResult> {
  const userPrompt = `CONTEXTO DEL CASO (no es prosa a auditar, es metadato): ${JSON.stringify(args.fixtureMeta)}

═══ PROSA A AUDITAR (ai_analysis completo) ═══
${JSON.stringify(args.aiAnalysis, null, 2)}

═══ BUNDLE DEL MOTOR (fuente de verdad numérica) ═══
${JSON.stringify(args.engineBundle, null, 2)}

═══ DATASETS DE VERDAD ═══
${JSON.stringify(args.truthBundle, null, 2)}

Audita la prosa contra la doctrina, los números del motor y los datasets de verdad. Devuelve SOLO el JSON de hallazgos.`;

  const msg = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  let parsed: JudgeResult;
  try {
    const jsonStr = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { resumen: "PARSE_ERROR — el juez no devolvió JSON válido", hallazgos: [], };
    (parsed as JudgeResult & { _raw?: string })._raw = text.slice(0, 2000);
  }
  // Post-filtro determinístico: descarta auto-omisiones que el modelo a veces
  // filtra pese a la instrucción ("(No hallazgo) — se omite", "no es hallazgo",
  // "incluido por trazabilidad", etc.). Garantiza que el reporte liste SOLO
  // problemas, sin depender de la obediencia del modelo.
  const SELF_OMIT = /no\s+hallazgo|se omite|no es hallazgo|incluido por trazabilidad|no-issue|\(\s*retiro|trazabilidad\)/i;
  if (Array.isArray(parsed.hallazgos)) {
    parsed.hallazgos = parsed.hallazgos.filter(
      (h) => !SELF_OMIT.test(h.porQue ?? "") && !SELF_OMIT.test(h.cita ?? ""),
    );
  }

  parsed._usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  return parsed;
}

// ============================================================================
// V2 — JUEZ CON ESPEJO EXACTO DEL PROMPT DEL GENERADOR
// ============================================================================
// En vez de reconstruir el contexto a mano (frágil: faltaba arriendoZona,
// anomalías, lecturaFlujo → falsos positivos), capturamos el PROMPT REAL que
// generateAiAnalysis le manda al modelo (system + bloque-caso con TODOS los
// datos) vía monkey-patch del prototipo de la SDK, y juzgamos contra eso.
// No se altera código de producción ni se regenera/persiste prosa.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _MsgProto: any = Object.getPrototypeOf((anthropic as any).messages);
const _origCreate = _MsgProto.create;
const CAPTURE_SENTINEL = "__AUDIT_CAPTURE_SENTINEL__";

export interface GeneratorPrompt { system: string; user: string }

/** Captura el prompt REAL (system + bloque-caso) que el generador arma para un
 *  análisis, SIN llamar al modelo ni persistir. Aborta con sentinel antes del
 *  model-call; la prosa almacenada queda intacta. */
export async function captureGeneratorPrompt(
  analysisId: string,
  supabase: SupabaseClient,
): Promise<GeneratorPrompt | null> {
  let captured: GeneratorPrompt | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _MsgProto.create = function (body: any) {
    captured = {
      system: typeof body?.system === "string" ? body.system : JSON.stringify(body?.system ?? ""),
      user: typeof body?.messages?.[0]?.content === "string"
        ? body.messages[0].content
        : JSON.stringify(body?.messages?.[0]?.content ?? ""),
    };
    throw new Error(CAPTURE_SENTINEL);
  };
  try {
    await generateAiAnalysis(analysisId, supabase);
  } catch { /* sentinel u otro — captured ya quedó seteado si llegó al create */ }
  finally {
    _MsgProto.create = _origCreate; // restaurar SIEMPRE (el juez usa el real)
  }
  return captured;
}

export const JUDGE_SYSTEM_V2 = `Eres un AUDITOR semántico de la prosa que genera "Franco", un asesor IA de inversión inmobiliaria chileno (refranco.ai). NO eres Franco. Lees la prosa ya generada y reportas CUALQUIER problema real, con criterio. Cada hallazgo debe ser defendible con cita textual + razón. NO inventes problemas; mejor pocos sólidos que muchos dudosos.

FUENTE DE VERDAD CLAVE: recibís el BLOQUE-CASO REAL — exactamente el texto que el generador le pasó al modelo (todos los datos numéricos y de contexto que el modelo efectivamente vio). Para los chequeos numéricos/factuales, ESE bloque-caso es la fuente. Si un número o hecho aparece en el bloque-caso, la prosa PUEDE usarlo: NO es invención. Solo es problema si la prosa afirma algo que NO está en el bloque-caso y NO es derivable de él.

REGLA "SIN DATO" (CRÍTICA, no la ablandes): cuando el bloque-caso dice explícitamente para un campo "sin dato confiable de zona", "sin dato — no afirmes nada", "sin dato", o "no afirmes", entonces ese dato NO EXISTE en la fuente. Si la prosa igualmente afirma un número concreto para ese campo (ej. una mediana de la comuna "UF 37,5/m²", una "desviación de 46% sobre el promedio de la zona", un "X% sobre mercado"), eso es FABRICACIÓN → categoria afirmacion-falsa, severidad ALTA, requiereHumano=true. Es peor aún si la prosa lo presenta como hecho objetivo ("un dato que cualquier tasador confirmará"). Buscá activamente este patrón: comuna sin mediana confiable + prosa citando una mediana/desviación numérica = afirmacion-falsa alta SIEMPRE. La regla anti-falso-positivo NO aplica acá: el bloque-caso dice expresamente que el dato no existe.

=== 1. DOCTRINA (analysis-voice-franco) ===
Franco es ASESOR, no narrador. Test: si una frase se reemplaza por una tabla sin pérdida, es RECITACIÓN (categoria: recitacion).
ANTI-PATRONES: A1 recitar números sin interpretar (recitacion) · A2 pregunta retórica con dato disponible (voz-tono) · A3 adjetivo sin cuantificar (voz-tono) · A4 comparar con instrumentos sin contextualizar esfuerzo/riesgo/iliquidez (voz-tono) — PERO las cifras de instrumentos alternativos (depósito UF ~5%, fondo ~7%) son SUPUESTOS DOCTRINALES legítimos (Ángulo 3): NUNCA las marques como afirmacion-sin-fuente/contra-fuente · A5 cierre con checklist genérica (voz-tono) · A6 presente para operación no consumada (voz-tono) · A8 bullets de 2 ítems (voz-tono) · A9 disclaimers de IA (voz-tono) · A10 "consultá a un asesor" (voz-tono) · A11 ENGINE-ISM · A12 P25/P50 para escenarios (voz-tono).
ENGINE-ISM (categoria: engine-ism) — CAZALO ACTIVAMENTE: es el anti-patrón más frecuente y el más sutil. Dos sub-tipos, AMBOS cuentan, marcá CADA ocurrencia distinta (severidad media salvo que engañe al usuario):
  (1) EXPONER LA ENTIDAD O LA MECÁNICA DEL MOTOR al usuario. El usuario ve a Franco, no al motor; el motor es nuestro instrumento de cálculo interno. PROHIBIDO escribir "el motor" como entidad: "el motor dice/recomienda/calcula/proyecta/detecta", "proyección del motor", "el motor no tiene un valor confiable", "según el motor". PROHIBIDO exponer nombres técnicos de campos o mecánica interna: "vmFranco", "fallback", "cae al fallback", "valor estimado coincide por fallback", "flujoCruzaEnHorizonte", "sobreprecioPorM2", "precioVsComuna". Traducción correcta: "el motor recomienda no comprar" → "no conviene comprar"; "proyección del motor a 4%" → "la proyección de plusvalía a futuro (4%)"; "no tiene valor confiable por fallback" → "no hay una referencia de precio absoluto confiable".
  (2) VERBO-TRAYECTORIA del modelo en vez de la consecuencia vivida. TEST (aplica también a los NO enumerados, no te limites a una lista fija): ¿la frase usa un SUSTANTIVO que el dominio inmobiliario usa (flujo de caja, flujo negativo, TIR, plusvalía, dividendo, aporte) → OK; o un VERBO-TRAYECTORIA de cómo se mueve un número dentro del modelo (el flujo "cruza", "se da vuelta", "se revierte", "se vuelve positivo", "se equilibra", "converge", "se estabiliza", "no cruza en N años", "punto de inflexión/equilibrio") → ENGINE-ISM? Lo segundo SIEMPRE se traduce a la consecuencia: "el arriendo nunca llega a cubrir la cuota en ese plazo", "recién el año X el arriendo alcanza a cubrir la cuota". Cazá los semánticos nuevos, no solo los literales.
Aplica a TODOS los tiers — no es un concepto a glosar, es fraseo interno que nunca debió salir al usuario.
§1.4 AFIRMACIONES: prohibido afirmar distancia/cercanía a metro FUTURO (L7/L8/L9 — coords no verificadas; ver datasets), plazos de obra, calidad de edificio como hecho, predicción de tasas, "valor real de mercado" como hecho. Donde no hay fuente para verificar → requiereHumano=true (afirmacion-sin-fuente). Si el bloque-caso dice explícitamente "sin dato confiable / no afirmes" y la prosa igual afirma un número → afirmacion-falsa (alta).
§1.9 ANOMALÍAS: si el bloque-caso trae una anomalía, la prosa debe mencionarla; si la omite → otro (media).

=== 2. COHERENCIA NUMÉRICA ===
- INTERNA: los números de la prosa cuadran entre sí (aritmética; el mismo concepto no aparece con dos valores/signos distintos). (categoria: incoherencia-numerica-interna)
- CONTRA-FUENTE: la prosa contradice un número que SÍ está en el bloque-caso (categoria: incoherencia-contra-fuente). Ej clásico: el bloque-caso dice "flujoMensualNeto: -$62.569 — negativo" y la prosa dice "+$62.569 positivo" → contra-fuente ALTA (signo invertido). O la prosa computa el aporte como dividendo−arriendo ignorando el flujoMensualNeto provisto.
- REGLA ANTI-FALSO-POSITIVO: antes de marcar contra-fuente o sin-fuente, BUSCÁ el número/dato en el BLOQUE-CASO (incluye arriendoZona, anomalías, sensibilidad de tasa, proyecciones, metro, plusvalía). Si está ahí o es derivable, NO es hallazgo. Solo marcá si genuinamente NO aparece.
- TOLERANCIA: la prosa redondea a "K"/"M" y cifras redondas. NO marques diferencias dentro del redondeo ($262K para 262.856 es correcto). Si dudás, NO marques.

=== 3. VEREDICTO ===
La prosa nunca contradice el veredicto del bloque-caso. Si lo hace → otro (alta).

=== SALIDA ===
Devuelve SOLO JSON válido, sin texto alrededor:
{ "resumen": "1-2 frases", "hallazgos": [ { "categoria": "engine-ism|incoherencia-numerica-interna|incoherencia-contra-fuente|afirmacion-falsa|afirmacion-sin-fuente|voz-tono|recitacion|otro", "campo": "ruta JSON exacta", "cita": "texto literal", "porQue": "regla violada + razón", "evidencia": "qué dato del bloque-caso/verdad lo respalda", "severidad": "alta|media|baja", "requiereHumano": true|false } ] }
Si no hay problemas: hallazgos: [].
REGLAS DE SALIDA ESTRICTAS: SOLO problemas. NUNCA incluyas confirmaciones / "OK" / "no es hallazgo" / "cuadra" / "consistente" / "trazabilidad" / "se omite". Si algo está bien, OMITELO.`;

export async function runJudgeV2(args: {
  fixtureMeta: { id: string; modalidad: string; tier: string; ejes: string[]; nota?: string };
  aiAnalysis: unknown;
  caseBlock: string;
  truthBundle: unknown;
}): Promise<JudgeResult> {
  const userPrompt = `CONTEXTO DEL CASO (metadato, no es prosa a auditar): ${JSON.stringify(args.fixtureMeta)}

=== BLOQUE-CASO REAL (exactamente lo que el generador le pasó al modelo — FUENTE DE VERDAD para chequeos numéricos/factuales) ===
${args.caseBlock}

=== PROSA A AUDITAR (ai_analysis generado) ===
${JSON.stringify(args.aiAnalysis, null, 2)}

=== DATASETS DE VERDAD (para afirmaciones verificables: metro activo, plusvalía) ===
${JSON.stringify(args.truthBundle, null, 2)}

Audita la prosa. Para contra-fuente/sin-fuente, recordá: si el dato está en el BLOQUE-CASO, NO es invención. Devolvé SOLO el JSON.`;

  const msg = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    system: JUDGE_SYSTEM_V2,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  let parsed: JudgeResult;
  try {
    const jsonStr = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { resumen: "PARSE_ERROR", hallazgos: [] };
  }
  const SELF_OMIT = /no\s+hallazgo|se omite|no es hallazgo|incluido por trazabilidad|no-issue|\(\s*retiro|trazabilidad\)/i;
  if (Array.isArray(parsed.hallazgos)) {
    parsed.hallazgos = parsed.hallazgos.filter(
      (h) => !SELF_OMIT.test(h.porQue ?? "") && !SELF_OMIT.test(h.cita ?? ""),
    );
  }
  parsed._usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  return parsed;
}
