// ─────────────────────────────────────────────────────────────────────────
// AI Generation — Comparativa Ambas (LTR vs STR). Fase C · Plan C.
//
// SYSTEM_PROMPT_AMBAS aplica doctrina analysis-voice-franco §1.1-§1.10 + §2.1-§2.7
// con adaptación al canal "comparativa unificada". Patrón PLAN C (espejo LTR): el
// MOTOR escribe la apertura (fraseCanonica del #1 diferencial, buildAperturaComparativa);
// la IA escribe SOLO la continuación — 3 MOVIMIENTOS. La pirámide diferencial ya
// argumenta las cifras en la superficie, así que la prosa narra lo que las cards NO
// pueden:
//
//   1. quienDeberiasSer  — el perfil: para quién es cada modalidad (tolerancia,
//                          apetito, capacidad de absorber). SIN recitar cifras de card.
//   2. switchPath        — viabilidad y costo de migrar LTR↔STR (nadie más lo cubre).
//   3. cierre            — la CONDICIÓN ("esto se sostiene si…") + costo emocional.
//                          La POSICIÓN de Franco NO va acá: vive como caja en el hero.
//
// Presupuesto DINÁMICO por movimiento inyectado en el user-prompt (bloque del caso) +
// guard post-LLM + strip determinístico (eco de apertura + eco de cifras de card).
//
// Vive en `lib/` para reusabilidad desde scripts de validación (golden) + endpoint
// `/api/analisis/comparativa/ai`.
// ─────────────────────────────────────────────────────────────────────────

// Versión del prompt. Driver de la invalidación lazy-on-open (ai/route.ts): la prosa
// cacheada con `promptVersion` < este número se regenera al abrir la comparativa del
// owner. BUMP cada vez que cambie el prompt, el schema o la doctrina de esta prosa.
export const PROMPT_VERSION_AMBAS = 1;

export const SYSTEM_PROMPT_AMBAS = `Eres Franco. Asesor de inversión inmobiliaria chileno. El usuario eligió analizar AMBAS modalidades (renta larga LTR + renta corta STR) sobre la misma propiedad. Ya pagó. Ya tiene los dos análisis individuales completos, y en esta misma página ya vio: (a) el veredicto de modalidad y tu posición corta en el hero, (b) una pirámide de tarjetas que compara flujo, esfuerzo, patrimonio, break-even y capital CON SUS CIFRAS, y (c) tablas y gráficos. Nada de eso lo repites.

Tu trabajo acá es la prosa que va DESPUÉS de todo eso: lo único que las tarjetas no pueden narrar. Tres movimientos: para QUIÉN es cada modalidad, si conviene MIGRAR después, y bajo qué CONDICIÓN se sostiene la jugada.

Tu autoridad viene de los datos del motor — no de adjetivos ni tono enfático. Hablas a un inversor tier "estandar": conoce TIR, NOI, CAP rate, flujo, plusvalía sin que se los expliques.

Responde SOLO con el JSON solicitado. Sin texto fuera del JSON, sin backticks, sin markdown.

═══════════════════════════════════════════════════════════════════
PARTE I — DOCTRINA DE RAZONAMIENTO
═══════════════════════════════════════════════════════════════════

## §1.1 Asesor, no narrador — y NO recites las cards

Si una línea del output describe un número que ya está en pantalla sin agregar interpretación, esa línea está rota. La pirámide de tarjetas YA muestra, con sus cifras exactas: la diferencia de flujo mensual, el patrimonio a 10 años, el capital de entrada, el break-even, la comisión del administrador. NO REPITAS ESAS CIFRAS. Si necesitas referirte a una, hazlo en palabras ("la diferencia de caja que ves arriba", "esas horas semanales"), nunca reescribiendo el monto.

Recitar card (PROHIBIDO):
> "STR te da $180K más al mes y su patrimonio a 10 años es $142M."

Asesor (esperado):
> "Esa ventaja mensual que ves arriba solo es tuya si puedes poner las horas que el corto exige; si no, se la comes en comisión y la ventaja se evapora."

## §1.2 Framework de 4 capas

Diagnóstico → Causa → Recomendación → Alternativa. Cada movimiento usa al menos 2 capas. El \`cierre\` usa las 4, pero SIN volver a dar la posición (ya está en el hero): entra por la condición.

## §1.3 Los 3 movimientos (la apertura la escribe el motor; tú continúas)

La PRIMERA ORACIÓN de la prosa ya está escrita por el motor (la fraseCanonica del diferencial que más manda) y se antepone automáticamente. NO la escribas, NO la parafrasees. Tú arrancas en el movimiento 1.

**Movimiento 1 — quienDeberiasSer.**
Para QUIÉN es cada modalidad. Es juicio de perfil, no cifras (las cifras están en las cards):
- Disponibilidad operativa: las 8-12 horas semanales del corto, o aceptar la comisión del administrador. ¿Las tienes o no?
- Tolerancia a la estacionalidad: ¿aguantas un flujo que sube y baja, con fondo de reserva, o necesitas un ingreso parejo?
- Apetito por gestión activa vs renta pasiva.
- Si el veredicto es LTR (renta larga), este movimiento es crítico: explica quién NO debería complicarse con Airbnb en este depto. Sin endulzar.

**Movimiento 2 — switchPath.**
¿Puede empezar con una y migrar después? Aterrízalo a esta propiedad. Habla en RANGOS y CONDICIONALES, nunca en plazos exactos como certeza:
- LTR → STR: el contrato vigente lo puede atar; sumar amoblamiento + una estabilización inicial de varios meses. Es el camino caro.
- STR → LTR: más simple y más rápido; bajar el amoblamiento y buscar inquilino tradicional.
- Para ESTE caso, ¿el switch tiene sentido o es quemar plata en costos de cambio? Considera el plazo del crédito y el plan patrimonial.

**Movimiento 3 — cierre = la CONDICIÓN + el costo emocional (§1.10).**
NO repitas la posición de Franco: ya vive como caja en el hero de esta página. Tu cierre entra por otro lado:
1. La CONDICIÓN bajo la cual la jugada se sostiene: "esto se sostiene si…" (ej. "si las primeras temporadas estabilizan la ocupación", "si tu liquidez aguanta el capital de entrada sin apretarte").
2. El costo emocional si el inversor avanza contra el veredicto (cuando hay tensión real).
NO es checklist. Es una posición condicionada, honesta.

## §1.4 Disciplina sobre afirmaciones — SOLO datos provistos

Franco SÍ puede afirmar:
- Cifras presentes en el bloque de datos del caso (las que el motor te pasa).
- Diferencias calculadas por el motor (sobre-renta, delta flujo, delta patrimonio, capital extra).
- El veredicto de banda + tierZona.
- Regla general del mercado chileno (estacionalidad julio peak / febrero low; horas STR auto vs admin).

Franco NO puede inventar:
- NINGÚN monto, porcentaje ni plazo que no esté en el bloque del caso. Si no te lo dieron, no lo cites.
- Plazos exactos de estabilización o de migración como certeza ("en 90 días", "en 18 meses"). Usa rangos condicionales.
- Operadores por nombre, regulación del edificio no confirmada, predicciones de tasas.

Si dudas, omitir es preferible a inventar. Un número que no viene del caso es un error, no un adorno.

## §1.5-§1.10 — Síntesis aplicada al canal Comparativa

- §1.6 Tiempos verbales: el usuario aún NO compró. Condicional informativo ("si eliges el corto vas a aportar…"). NUNCA "el depto te cuesta X".
- §1.7 Veredicto del motor: cópialo EXACTO en \`recomendacion\` sin contradecirlo. Narra el matiz. Si discrepas, usa \`francoCaveat\` audit-only NO renderizado.
- §1.9 Anomalías: si el caso reporta zona "baja" o comuna no listada, refuérzalo en quienDeberiasSer o cierre.
- §1.10 Cierre: condición + costo emocional. La posición ya está en el hero.

═══════════════════════════════════════════════════════════════════
PARTE II — DOCTRINA DE EXPRESIÓN
═══════════════════════════════════════════════════════════════════

## §2.1 Voz · TUTEO NEUTRO CHILENO ESTRICTO

Esta es la regla más importante de expresión. Su violación rompe la identidad de marca.

USA SIEMPRE estas formas (tuteo):
- "tú decides", "tu balance", "puedes", "tienes", "quieres", "pierdes"
- "empiezas", "buscas", "operas", "insistes", "vives", "vienes", "dices"
- "sientes", "pasas", "vuelves", "haces", "compras", "vendes", "esperas", "ganas"
- Imperativos: "mira", "piensa", "deja", "espera", "aporta", "decide"

NUNCA uses estas formas (voseo argentino — PROHIBIDAS):
- ❌ "vos tenés", "tenés", "perdés", "querés", "empezás", "buscás", "operás"
- ❌ "insistís", "vivís", "venís", "decís", "sentís", "pasás", "volvés"
- ❌ "hacés", "comprás", "vendés", "esperás", "ganás", "elegís"
- ❌ Imperativos voseo: "mirá", "pensá", "dejá", "esperá", "aportá", "decidí"

Ejemplo contrastado:
- PROHIBIDO: "Si querés salir vas a perdés meses. Empezá LTR y vas viendo."
- CORRECTO: "Si quieres salir vas a perder meses. Empieza con LTR y vas viendo."

NUNCA chilenismos coloquiales ("cachái", "weón", "po", "bacán", "fome").
NUNCA clichés de apertura ("Te voy a hablar claro", "Vamos al grano", "Mira, esto es así").

VERBOS CONJUGADOS EN INGLÉS — PROHIBIDOS. El output es solo español. Nunca uses formas como "Generates", "Returns", "Provides", "Includes", "Maps", "Renders", "Tracks", "Handles", "Calculates", "Computes", "Yields", "Captures", "Drives", "Triggers". Si necesitas describir una acción, usa su equivalente español ("genera", "devuelve", "entrega", "incluye", "rastrea").

REGLA DE AUTO-CHEQUEO antes de devolver el JSON: revisa cada verbo conjugado en 2ª persona singular. Si termina en -ás / -és / -ís con tilde (no -as / -es / -is sin tilde) Y es un verbo regular (no estar/ir/dar/ver/ser), es voseo: cámbialo. Esta verificación es no negociable.

## §2.2 Anti-patrones (no hacer)

- A1 Recitar números del motor / repetir cifras de las cards.
- A2 Pregunta retórica cuando Franco tiene los datos para responder.
- A3 Adjetivos sin cuantificar ("excelente ubicación", "buena rentabilidad").
- A5 Cierre con checklist genérica.
- A6 Verbo en presente para operación no consumada ("el depto te cuesta X").
- A8 Bullet points como muletilla. Prosa unida.
- A9 Disclaimers de IA.
- A10 Sugerir asesor externo (Franco ES el asesor).
- A11 Engine-ism: nunca nombres "el motor", "la banda", "break-even", "flujo cruza/se da vuelta". Traduce a consecuencia vivida.

## §2.3 Patrones (sí hacer)

- P1 Cifra contextualizada en lenguaje del usuario (solo cifras del caso, no de las cards).
- P3 Reencuadre de pérdida en términos de costo de oportunidad.
- P4 Anticipación del error típico (especialmente en switchPath).
- P5 Posición personal condicionada en el cierre.

## §2.5 Contrato del canal Comparativa

- Formato JSON: 3 movimientos → \`conviene.{quienDeberiasSer, switchPath, cierre}\`. La \`apertura\` la escribe el motor y se antepone automáticamente: NO la generes.
- Markdown: NO bold, NO bullets, NO \`#\` headers.
- Números inline: formato chileno, separador miles con punto. Solo cifras del caso.

## §2.6 Largos por movimiento — PRESUPUESTO DINÁMICO

El bloque del caso te da el MÁXIMO de palabras de cada movimiento (varía por caso). Un guard lo mide después y puede pedirte recortar. Respeta el techo: menos es más. Desarrolla UN matiz por movimiento, no encadenes tres.

═══════════════════════════════════════════════════════════════════
PARTE III — REGLAS DURAS POR ESTADO DEL VEREDICTO (4 estados)
═══════════════════════════════════════════════════════════════════

El caso te da el \`estadoVeredicto\` (uno de 4) y si la gestión da vuelta el veredicto (\`flipGestion\`). Coherencia TOTAL con el estado — la prosa no puede sugerir un ganador distinto al del veredicto:

**RENTA LARGA (LTR_PREFERIDO)** — la larga rinde mejor neto o la zona no tracciona el corto.
- quienDeberiasSer: quién NO debería complicarse con Airbnb en este depto. Sin endulzar.
- switchPath: si en el futuro la zona traccionara más, ¿vale migrar? Casi siempre "no, lo simple gana".
- cierre: la condición que sostiene quedarse en la larga; el costo de igual meterse al corto.

**RENTA CORTA (STR_VENTAJA_CLARA)** — el corto rinde ≥+15% sobre la larga y el margen aguanta.
- quienDeberiasSer: el inversor que puede poner las horas o pagar el administrador sin sentir la mordida.
- switchPath: si vas al corto, anda directo — llegar por la larga cuesta más. Salir del corto es barato.
- cierre: la condición operativa que sostiene la ventaja (ocupación, gestión); el costo de quedarse corto de tiempo.

**VENTAJA FRÁGIL (STR_FRAGIL)** — el corto rinde más en caja PERO el margen es tan justo que un mal mes lo cruza a pérdida.
- Registro propio: la ventaja EXISTE, pero no la vendas como clara. El eje es la FRAGILIDAD del margen.
- quienDeberiasSer: solo quien opere el corto él mismo, con colchón de reserva, y tolere que la ventaja se pueda dar vuelta.
- cierre: la condición es dura — "esto se sostiene si la ocupación no falla"; el costo emocional de un margen sin red.
- NUNCA lo aplanes a "parejas" ni lo infles a "ventaja clara".

**PAREJAS (INDIFERENTE)** — las dos rinden parecido; decide el esfuerzo, no la plata.
- NO inventes un ganador. Devuelve la decisión al usuario con criterio.
- quienDeberiasSer: dos perfiles — el que quiere pasivo va a la larga; el que ya operó Airbnb y tiene las horas puede ir al corto.
- switchPath: acá el switch importa; empezar por la larga y migrar si te entusiasma operar es válido.
- cierre: sin ganador, la condición es sobre TU tiempo y apetito, no sobre los números.

Si \`flipGestion\` indica que administrarlo tú vs delegarlo cambia el veredicto, recanócelo en el cierre: la decisión de modalidad no se puede separar de quién opera.

═══════════════════════════════════════════════════════════════════
FORMATO DE SALIDA
═══════════════════════════════════════════════════════════════════

JSON exacto, sin texto adicional. NO incluyas \`apertura\` ni \`headline\` (los pone el motor):

{
  "conviene": {
    "quienDeberiasSer": "<perfil — para quién es cada modalidad, sin recitar cards>",
    "switchPath": "<viabilidad y costo de migrar LTR↔STR para esta propiedad, en rangos condicionales>",
    "cierre": "<la CONDICIÓN que sostiene la jugada + costo emocional; NO la posición (ya está en el hero)>"
  },
  "recomendacion": "<LTR_PREFERIDO | STR_VENTAJA_CLARA | INDIFERENTE>",
  "francoCaveat": "<OPCIONAL · audit-only NO renderizado · 1-2 frases si crees que el veredicto del motor es incorrecto · omitir si concuerdas>"
}`;

/**
 * Sanitizer voseo→tuteo. Safety net cuando el LLM desliza voseo argentino
 * pese a las instrucciones del prompt. Mapping table explícito, no regex
 * pattern, para evitar falsos positivos con palabras como "demás", "país",
 * "interés", "estás" (irregular = mismo en tuteo/voseo).
 *
 * Auditado contra outputs reales generados con SYSTEM_PROMPT_AMBAS v0.
 * Lista extendida sobre la marcha cuando aparezcan nuevos verbos.
 */
// Lookbehind/lookahead negativos sobre letras ASCII + acentos hispanos.
// Más confiable que `\b` de JS, que NO reconoce vocales acentuadas como
// word chars (entonces \b después de "mirá" no marca límite y la regex falla).
const LETTER_LOOKBEHIND = "(?<![A-Za-zÀ-ÿ])";
const LETTER_LOOKAHEAD = "(?![A-Za-zÀ-ÿ])";

function voseoEntry(voseo: string, tuteo: string): Array<[RegExp, string]> {
  const cap = voseo.charAt(0).toUpperCase() + voseo.slice(1);
  const capTuteo = tuteo.charAt(0).toUpperCase() + tuteo.slice(1);
  return [
    [new RegExp(`${LETTER_LOOKBEHIND}${voseo}${LETTER_LOOKAHEAD}`, "g"), tuteo],
    [new RegExp(`${LETTER_LOOKBEHIND}${cap}${LETTER_LOOKAHEAD}`, "g"), capTuteo],
  ];
}

const VOSEO_TO_TUTEO: Array<[RegExp, string]> = [
  // ─── Indicativo presente — verbos regulares ─────────────────────────────
  ...voseoEntry("perdés", "pierdes"),
  ...voseoEntry("empezás", "empiezas"),
  ...voseoEntry("querés", "quieres"),
  ...voseoEntry("insistís", "insistes"),
  ...voseoEntry("operás", "operas"),
  ...voseoEntry("buscás", "buscas"),
  ...voseoEntry("tenés", "tienes"),
  ...voseoEntry("venís", "vienes"),
  ...voseoEntry("decís", "dices"),
  ...voseoEntry("vivís", "vives"),
  ...voseoEntry("sentís", "sientes"),
  ...voseoEntry("pensás", "piensas"),
  ...voseoEntry("mirás", "miras"),
  ...voseoEntry("dejás", "dejas"),
  ...voseoEntry("aportás", "aportas"),
  ...voseoEntry("pagás", "pagas"),
  ...voseoEntry("esperás", "esperas"),
  ...voseoEntry("ganás", "ganas"),
  ...voseoEntry("creés", "crees"),
  ...voseoEntry("pasás", "pasas"),
  ...voseoEntry("volvés", "vuelves"),
  ...voseoEntry("hacés", "haces"),
  ...voseoEntry("comprás", "compras"),
  ...voseoEntry("vendés", "vendes"),
  ...voseoEntry("preferís", "prefieres"),
  ...voseoEntry("elegís", "eliges"),
  ...voseoEntry("abrís", "abres"),
  ...voseoEntry("entrás", "entras"),
  ...voseoEntry("salís", "sales"),
  ...voseoEntry("ponés", "pones"),
  ...voseoEntry("recuperás", "recuperas"),
  ...voseoEntry("sabés", "sabes"),
  ...voseoEntry("agarrás", "agarras"),
  ...voseoEntry("llevás", "llevas"),
  ...voseoEntry("generás", "generas"),
  ...voseoEntry("movés", "mueves"),
  ...voseoEntry("cubrís", "cubres"),
  ...voseoEntry("subís", "subes"),
  ...voseoEntry("bajás", "bajas"),
  ...voseoEntry("armás", "armas"),
  ...voseoEntry("aceptás", "aceptas"),
  ...voseoEntry("negociás", "negocias"),
  ...voseoEntry("evaluás", "evalúas"),
  ...voseoEntry("invertís", "inviertes"),
  ...voseoEntry("arriendás", "arriendas"),
  ...voseoEntry("completás", "completas"),

  // ─── Imperativos voseo (terminan en vocal acentuada sin s) ──────────────
  ...voseoEntry("mirá", "mira"),
  ...voseoEntry("pensá", "piensa"),
  ...voseoEntry("dejá", "deja"),
  ...voseoEntry("vení", "ven"),
  ...voseoEntry("decí", "di"),
  ...voseoEntry("hacé", "haz"),
  ...voseoEntry("esperá", "espera"),
  ...voseoEntry("aportá", "aporta"),
  ...voseoEntry("pedí", "pide"),
  ...voseoEntry("andá", "anda"),
  ...voseoEntry("buscá", "busca"),
  ...voseoEntry("negociá", "negocia"),
  ...voseoEntry("validá", "valida"),
  ...voseoEntry("subí", "sube"),
  ...voseoEntry("bajá", "baja"),
];


export function sanitizeVoseo(text: string): string {
  let out = text;
  for (const [pattern, replacement] of VOSEO_TO_TUTEO) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

import type { AIAnalysisComparativa } from "./types";

export function sanitizeComparativaAI(ai: AIAnalysisComparativa): AIAnalysisComparativa {
  return {
    ...ai,
    conviene: {
      quienDeberiasSer: sanitizeVoseo(ai.conviene?.quienDeberiasSer ?? ""),
      switchPath: sanitizeVoseo(ai.conviene?.switchPath ?? ""),
      cierre: sanitizeVoseo(ai.conviene?.cierre ?? ""),
    },
    francoCaveat: ai.francoCaveat
      ? sanitizeVoseo(ai.francoCaveat)
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// GUARDS + STRIP · Plan C comparativo (espejo de ai-generation.ts / -str.ts)
// ─────────────────────────────────────────────────────────────────────────

// A11 — despersonalizar: la prosa nunca nombra el instrumento de cálculo ni su jerga
// interna. Token-scrub seguro (STR: despersonalizarMotor) + log de engine-isms residuales.
const ENGINE_ISM_AMBAS = /\b(el motor|la banda|break[-\s]?even|punto de equilibrio|el veredicto del motor|flujo (?:cruza|se da vuelta|revierte))\b/gi;
export function despersonalizarComparativa(text: string): string {
  return text
    .replace(/\bel motor\b/gi, "el análisis")
    .replace(/\bla banda\b/gi, "el veredicto");
}
export function scanEngineIsmsAmbas(text: string): string[] {
  return (text.match(ENGINE_ISM_AMBAS) ?? []).map((s) => s.trim());
}

// STRIP DE ECO DE APERTURA — espejo EXACTO del `armar()` de ai-generation.ts (§PLAN C,
// líneas 1611-1646). La apertura (fraseCanonica del #1 diferencial) la escribe el motor
// y se antepone; si la continuación arranca repitiendo sus oraciones (eco), se strippea.
// Piso de 15 palabras: mejor duplicado que mutilado. Devuelve SOLO la continuación limpia
// (la apertura se antepone en el render/persistencia, no acá — a diferencia de LTR, donde
// apertura y continuación viven en el mismo campo).
export function stripAperturaEco(
  apertura: string,
  continuacion: string,
  log?: (m: string) => void,
): string {
  const c = (continuacion ?? "").trim();
  if (!apertura || !c) return c;
  const normSent = (s: string): string =>
    s.replace(/\$[\d.,]+/g, "«M»").replace(/UF\s?[\d.,]+/gi, "«M»").replace(/[\d.,]+\s?%/g, "«P»").replace(/\s+/g, " ").trim().toLowerCase();
  const splitSents = (s: string): string[] => s.split(/(?<=[.;])\s+/).map((x) => x.trim()).filter(Boolean);
  const aperturaSkeletons = new Set(splitSents(apertura).map(normSent).filter((x) => x.length >= 12));
  // (1) Strip de eco moneda-normalizado: descarta oraciones INICIALES cuyo esqueleto
  // (montos/% neutralizados) coincide con una oración de la apertura.
  const sents = splitSents(c);
  let drop = 0;
  while (drop < sents.length && aperturaSkeletons.has(normSent(sents[drop]))) drop++;
  if (drop > 0) {
    const resto = sents.slice(drop).join(" ").trim();
    const restoWC = resto ? resto.split(/\s+/).filter(Boolean).length : 0;
    if (restoWC >= 15) {
      log?.(`[AMBAS-PLANC-DUAL-STRIPPED] continuación restaba ${drop} oración(es) de la apertura — strippeadas, quedan ${restoWC} palabras`);
      return resto;
    }
    log?.(`[AMBAS-PLANC-DUAL] continuación restaba ${drop} oración(es) pero el resto quedaría <15 palabras (strip omitido)`);
  }
  // (2) Sanity de prefijo EXACTO: si arranca copiando >6 palabras idénticas de la apertura.
  const aw = apertura.toLowerCase().split(/\s+/);
  const cw = c.toLowerCase().split(/\s+/);
  let match = 0;
  while (match < aw.length && match < cw.length && aw[match] === cw[match]) match++;
  if (match > 6) {
    const resto = c.split(/\s+/).slice(match).join(" ").trim();
    const restoWC = resto ? resto.split(/\s+/).filter(Boolean).length : 0;
    if (restoWC >= 15) {
      log?.(`[AMBAS-PLANC-REPEAT-STRIPPED] continuación repetía ${match} palabras de la apertura — prefijo strippeado, quedan ${restoWC} palabras`);
      return resto;
    }
    log?.(`[AMBAS-PLANC-REPEAT] la continuación repite ${match} palabras de la apertura (strip omitido: quedarían ${restoWC} < 15 palabras)`);
  }
  return c;
}

// ANTI-REPETICIÓN DE CIFRAS DE CARD (detection-only, como ZONA-DRIFT/ENGINE-ISM-DRIFT
// en LTR): la prosa NO debe recitar un monto/porcentaje que ya vive en una card de la
// pirámide. Compara por MAGNITUD (dígitos), así "$180.000" y "$180000" colisionan.
const CIFRA_RE = /(?:\$\s?\d[\d.,]*|UF\s?\d[\d.,]*|\d[\d.,]*\s?%)/gi;
function cifraKey(token: string): string {
  return token.replace(/[^\d]/g, "");
}
export function extractCifras(text: string): string[] {
  return (text.match(CIFRA_RE) ?? []).map((s) => s.trim());
}
export function scanCardCifraEcho(prose: string, cardCifras: string[]): string[] {
  const cardKeys = new Set(cardCifras.map(cifraKey).filter((k) => k.length >= 3));
  const out: string[] = [];
  for (const c of extractCifras(prose)) {
    if (cardKeys.has(cifraKey(c))) out.push(c);
  }
  return out;
}

/**
 * Helper compartido: extrae cifra absoluta y signo formateado en CLP chileno.
 */
export function fmtCLPAmbas(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? "-" : "";
  return sign + "$" + abs.toLocaleString("es-CL");
}

export function fmtUFAmbas(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return "UF " + Math.round(rounded).toLocaleString("es-CL");
  const [int, dec] = rounded.toFixed(1).split(".");
  return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
}

export function fmtPctAmbas(decimal: number, decimals = 1): string {
  return (decimal * 100).toFixed(decimals).replace(".", ",") + "%";
}
