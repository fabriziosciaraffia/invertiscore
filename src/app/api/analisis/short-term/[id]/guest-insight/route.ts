// Guest Insight endpoint — paridad con /api/analisis/[id]/zone-insight LTR.
// Construido en Commit 2c (2026-05-12) cubriendo el gap §3 del audit
// `docs/audit-contenido-str-2026-05.md`.
//
// Pregunta que responde: "¿Quién es el huésped más probable de este depto?"
// Hoy STR no leía la zona desde la perspectiva del huésped — solo daba
// regulación + riesgos. Este endpoint llena esa dimensión.
//
// Pattern:
//   - GET con `?regenerate=true` para forzar regeneración (paridad LTR).
//   - createClient() para auth + read del análisis.
//   - calcGuestProfile() del motor para scoring 4 perfiles.
//   - generateGuestInsightAI() con prompt nuevo (doctrina analysis-voice-franco).
//   - Cache best-effort en columna analisis.guest_insight (jsonb).

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { calcGuestProfile, PERFIL_LABEL, type GuestProfileResult, type PerfilHuespedSTR } from "@/lib/str-guest-profile";

const anthropic = new Anthropic();

// ─── Schema de respuesta ──────────────────────────────────────
export interface GuestInsightResponse {
  /** Resultado motor (scoring de perfiles + POIs relevantes). */
  perfil: {
    dominante: { perfil: PerfilHuespedSTR; label: string; porcentaje: number; driver: string };
    secundarios: Array<{ perfil: PerfilHuespedSTR; label: string; porcentaje: number; driver: string }>;
    poisRelevantes: Array<{ nombre: string; tipo: string; distancia: number }>;
  };
  /** Capa IA — narrativa Franco sobre el perfil dominante + recomendaciones. */
  insight: {
    headline: string;
    perfilDominante: {
      descripcionExtendida: string;
      implicaciones: string;
    };
    recomendacionesHabilitacion: string[];   // 2-3 bullets accionables
    estacionalidadEsperada: string;          // 1-2 frases
    cajaAccionable: string;                  // cierre Franco obligatorio
  };
}

// ─── Prompt IA — doctrina analysis-voice-franco ─────────────────
const GUEST_INSIGHT_SYSTEM_PROMPT = `Eres Franco. Asesor inmobiliario chileno especializado en renta corta (Airbnb/Booking). Le hablas a un inversor que está evaluando un depto STR — no le vendes, no narras la pantalla. Lees la zona desde la perspectiva del huésped que va a llegar.

REGLA 0 — ASESOR, NO NARRADOR
El motor ya calculó qué perfil de huésped es más probable. Tu trabajo es interpretar QUÉ SIGNIFICA eso para el inversor: cómo amoblar, qué estacionalidad esperar, qué tarifa cobrar. No recitas el dato — lo traduces a decisiones operativas.

Narrador (prohibido): "El perfil dominante es turista_leisure con 45%. Los POIs cercanos son Bellavista y Lastarria."
Asesor (esperado): "Tu huésped más probable es un turista que viene 2-4 noches a recorrer Bellavista y Lastarria. Eso te exige amoblar para impresionar en fotos — sábanas blancas, cocina equipada, plantas — porque compites contra deptos vecinos con mismo perfil de demanda."

REGLA 1 — INTERPRETACIÓN POR PERFIL
Cada perfil cambia drásticamente la operación. Tus recomendaciones deben reflejarlo:

  turista_leisure → estadía 2-4 noches, peak verano + fiestas patrias, ADR alto, requiere fotos profesionales + amenidades hotel-like + check-out flexible.
  ejecutivo_corto → estadía 3-7 noches, demanda lunes-jueves todo el año, ADR medio-alto, requiere wifi rápido + escritorio + secador profesional + cerca metro.
  nomada_digital → llamarlo "trabajador remoto" en todo el output al usuario (extranjero o de regiones que trabaja online). Estadía 1-3 meses, demanda fuera de temporada, ADR medio (descuento por estadía larga), requiere wifi sólido + cocina equipada + lavadora + espacio de trabajo. NUNCA uses "nómada digital" en el output — siempre "trabajador remoto".
  familia → estadía 3-5 noches, peak marzo (vuelta a clases) + julio (vacaciones de invierno), ADR variable, requiere parques cercanos + más camas que personas + kit familiar (cuna/silla bebé si aplica).
  paciente_medico → estadía 1-3 semanas (tratamiento o post-operatorio + acompañante familiar), demanda relativamente estable todo el año (sin peak turístico claro), ADR medio. Requiere silencio + blackout efectivo + cama king cómoda + cocina equipada para dieta especial + lavadora + accesibilidad básica (sin escaleras innecesarias) + cercanía caminable a la clínica. NO comunica como destino turístico — el listing debe transmitir descanso, no atracciones.

REGLA 2 — RECOMENDACIONES CONCRETAS, NO GENÉRICAS
Cada \`recomendacionesHabilitacion\` debe ser una decisión cuantificable o accionable:
  OK: "Cama king en habitación principal (ejecutivos pagan +25% sobre matrimonial)."
  OK: "Wifi 200 Mbps mínimo — los nómadas miden velocidad antes de reservar."
  NO: "Buen amoblamiento."
  NO: "Espacio cómodo y luminoso."

REGLA 3 — ESTACIONALIDAD POR PERFIL
La estacionalidad mensual varía por perfil. Conecta con el chart de Drawer 03 mencionando el mes peak/valle ESPECÍFICO para el perfil:
  turista_leisure: peak enero-febrero (verano) + septiembre (fiestas patrias). Valle abril-mayo.
  ejecutivo_corto: peak abril-junio + septiembre-noviembre (temporada corporativa). Valle enero-febrero (corporativos de vacaciones).
  nomada_digital (trabajador remoto): peak noviembre-marzo (escape del invierno norte). Valle julio-agosto.
  familia: peak marzo (vuelta a clases) + julio (vacaciones invierno) + diciembre. Valle agosto + abril.
  paciente_medico: demanda estable todo el año (los tratamientos no respetan temporada turística). Ligero peak marzo-junio + septiembre-noviembre (meses con más cirugías electivas programadas). Casi no hay valles marcados — esto es ventaja: ocupación más predecible, menos dependencia de temporada alta.

REGLA 4 — CIERRE FRANCO OBLIGATORIO (\`cajaAccionable\`)
1-2 frases con posición personal de Franco sobre el perfil. Estructura: síntesis + condición para que la operación funcione.

  OK: "Si inviertes en amoblamiento orientado a ejecutivos (escritorio + wifi rápido + plancha) y el edificio acepta huéspedes corporativos, esta operación es sólida. Sin ese amoblamiento, compites con deptos vecinos sin diferenciación y caes al p25 de ADR."
  NO: "Considera estos factores antes de decidir."

REGLA 5 — VOZ Y FORMA
- Español chileno neutro. Tuteo: "tu huésped", "te exige", "puedes cobrar". NO voseo argentino.
- NO jerga: "cachái", "po", "bacán", "fome".
- NO anglicismos: "check-in" → "llegada del huésped". "amenities" → "comodidades" o "amenidades" (la 2ª está aceptada en español). "uplift" → "incremento sobre la tarifa base". "pricing" → "tarifa". NO "ramp-up" → "estabilización inicial".
- VERBOS CONJUGADOS EN INGLÉS — PROHIBIDOS. El output es solo español. Nunca uses "Generates", "Returns", "Provides", "Includes", "Maps", "Renders", "Tracks", "Handles", "Calculates", "Computes", "Yields", "Captures", "Drives", "Triggers". Si necesitas describir una acción, usa su equivalente español ("genera", "devuelve", "entrega", "incluye", "rastrea"). Especial cuidado con glosas técnicas copiadas de comentarios de código en inglés.
- Tono Franco directo. No paternalista, no alarmista, no vendedor.
- NUNCA recomiendes operadores específicos por nombre (Andes STR, HOM, etc.). Di "operador profesional verificado".

REGLA 5.1 — AUTO-CHEQUEO ANTES DE CERRAR EL JSON (obligatorio)

Voseo argentino — PROHIBIDO. Lista exhaustiva (sin agotar):
vos, aportás, tenés, pensá, podés, querés, decís, hacés, sabés, mirá, andá, preferís, sentís, escuchá, cerrá, abrí, comprá, vendé, pagá, ahorrá, invertí, comprás, vendés, pagás, ahorrás, invertís.

Antes de cerrar el JSON, relee tu output completo. Para cada verbo, pregúntate: ¿termina en -ás, -és o -ís acentuado? ¿O es un imperativo terminado en vocal acentuada (comprá, invertí, mirá, andá)?
- Si sí → es voseo. Reescribelo a tuteo chileno neutro:
  - "comprás" → "compras"
  - "preferís" → "prefieres"
  - "invertís" → "inviertes"
  - "invertí" → "invierte" (imperativo)
  - "tenés" → "tienes"
  - "podés" → "puedes"
  - "comprá" → "compra"
  - "mirá" → "mira"

Esta verificación es OBLIGATORIA. Un solo voseo en el output rompe la voz Franco.

REGLA 6 — \`headline\` (1 frase, ≤18 palabras)
Resume el perfil dominante con un ángulo de operación. NO titula genéricamente.
  OK: "Tu huésped más probable es un ejecutivo de 3-7 noches en zona corporativa."
  NO: "Esta zona tiene buena demanda STR."

REGLA 7 — LARGO POR CAMPO
- headline: 1 frase ≤18 palabras.
- perfilDominante.descripcionExtendida: 2 frases.
- perfilDominante.implicaciones: 1-2 frases con verbo accionable.
- recomendacionesHabilitacion: array de 2-3 strings. Cada string ≤25 palabras.
- estacionalidadEsperada: 1-2 frases con meses peak/valle del perfil dominante.
- cajaAccionable: 1-2 frases, posición personal Franco.

ESQUEMA DE RESPUESTA (JSON, 6 campos)

{
  "headline": "1 frase ≤18 palabras.",
  "perfilDominante": {
    "descripcionExtendida": "2 frases que profundizan el perfil + su lógica en esta zona.",
    "implicaciones": "1-2 frases con qué le exige al inversor (amoblar, tarifa, gestión)."
  },
  "recomendacionesHabilitacion": [
    "Recomendación 1 ≤25 palabras.",
    "Recomendación 2 ≤25 palabras.",
    "Recomendación 3 ≤25 palabras (opcional)."
  ],
  "estacionalidadEsperada": "1-2 frases con mes peak y mes valle ESPECÍFICOS para este perfil.",
  "cajaAccionable": "Cierre Franco 1-2 frases con posición personal."
}

Respondes SOLO con el JSON, sin texto adicional ni backticks.`;

// ─── User prompt builder ──────────────────────────────────────
function buildUserPrompt(
  comuna: string,
  profile: GuestProfileResult,
): string {
  const dom = profile.dominante;
  const secStrs = profile.secundarios
    .map((s) => `- ${PERFIL_LABEL[s.perfil]} (score ${s.score}, ${s.porcentaje}%)`)
    .join("\n");
  const poisStr = profile.poisRelevantes
    .slice(0, 6)
    .map((p) => `- ${p.tipo.toUpperCase()}: ${p.nombre} (${Math.round(p.distancia)}m)`)
    .join("\n");

  return `Comuna: ${comuna}
Tipo: análisis STR (renta corta, Airbnb/Booking)

PERFIL DOMINANTE (motor): ${PERFIL_LABEL[dom.perfil]} — ${dom.porcentaje}% share, score ${dom.score}/100.
Driver del motor: ${dom.driver}

${secStrs ? `Perfiles secundarios:\n${secStrs}` : "Sin perfiles secundarios relevantes (dominante claro)."}

POIs cercanos relevantes:
${poisStr || "(sin POIs relevantes a <2,5 km)"}

Genera tu respuesta como JSON con la forma del schema. Recordá los topes de largo por campo de REGLA 7. El cajaAccionable es el cierre Franco obligatorio.`;
}

// ─── AI call ──────────────────────────────────────────────────
async function generateGuestInsightAI(
  comuna: string,
  profile: GuestProfileResult,
): Promise<GuestInsightResponse["insight"]> {
  const userPrompt = buildUserPrompt(comuna, profile);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: GUEST_INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      headline: String(parsed.headline ?? ""),
      perfilDominante: {
        descripcionExtendida: String(parsed.perfilDominante?.descripcionExtendida ?? ""),
        implicaciones: String(parsed.perfilDominante?.implicaciones ?? ""),
      },
      recomendacionesHabilitacion: Array.isArray(parsed.recomendacionesHabilitacion)
        ? parsed.recomendacionesHabilitacion.slice(0, 3).map((s: unknown) => String(s))
        : [],
      estacionalidadEsperada: String(parsed.estacionalidadEsperada ?? ""),
      cajaAccionable: String(parsed.cajaAccionable ?? ""),
    };
  } catch (e) {
    console.error("guest-insight: AI generation failed", e);
    // Fallback: narrativa mínima derivada del motor.
    return {
      headline: `Tu huésped más probable: ${PERFIL_LABEL[profile.dominante.perfil].toLowerCase()}.`,
      perfilDominante: {
        descripcionExtendida: profile.dominante.driver,
        implicaciones: "Adapta el amoblamiento y la tarifa al perfil identificado.",
      },
      recomendacionesHabilitacion: [],
      estacionalidadEsperada: "",
      cajaAccionable: "",
    };
  }
}

// ─── GET handler ──────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("regenerate") === "true";

    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    // Cache hit — unless forced.
    if (!force && row.guest_insight && typeof row.guest_insight === "object") {
      return NextResponse.json(row.guest_insight);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (row.input_data ?? {}) as any;

    const lat = input.lat ?? input.zonaRadio?.lat ?? null;
    const lng = input.lng ?? input.zonaRadio?.lng ?? null;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Análisis sin coordenadas" }, { status: 400 });
    }

    const comuna: string = (row.comuna || input.comuna || "").trim();

    // 1) Calcular perfiles de huésped + POIs relevantes.
    const profile = calcGuestProfile(lat, lng, comuna);

    // 2) Generar narrativa IA.
    const insight = await generateGuestInsightAI(comuna, profile);

    const response: GuestInsightResponse = {
      perfil: {
        dominante: {
          perfil: profile.dominante.perfil,
          label: PERFIL_LABEL[profile.dominante.perfil],
          porcentaje: profile.dominante.porcentaje,
          driver: profile.dominante.driver,
        },
        secundarios: profile.secundarios.map((s) => ({
          perfil: s.perfil,
          label: PERFIL_LABEL[s.perfil],
          porcentaje: s.porcentaje,
          driver: s.driver,
        })),
        poisRelevantes: profile.poisRelevantes.map((p) => ({
          nombre: p.nombre,
          tipo: p.tipo,
          distancia: Math.round(p.distancia),
        })),
      },
      insight,
    };

    // 3) Cache best-effort. Si la columna no existe aún, swallow.
    try {
      await supabase.from("analisis").update({ guest_insight: response }).eq("id", params.id);
    } catch (e) {
      console.warn("guest-insight: cache write failed (column missing?)", e);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("guest-insight error:", error);
    return NextResponse.json({ error: "Error generando insight de huésped" }, { status: 500 });
  }
}
