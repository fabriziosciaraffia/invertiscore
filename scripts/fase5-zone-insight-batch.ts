/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 5 — Zone Insight prompt v2 (snapshot)
 *
 * Llama directo a Anthropic con el INSIGHT_SYSTEM_PROMPT v2 (clon de
 * src/app/api/analisis/[id]/zone-insight/route.ts post-Fase 5) usando los
 * MISMOS 3 contextos sintéticos de Fase 4 (Providencia / Quinta Normal /
 * Independencia). Guarda outputs en audit/fase5-outputs/.
 *
 *   npx tsx scripts/fase5-zone-insight-batch.ts
 *
 * NO escribe en DB. NO toca baseline (audit/fase4-outputs/).
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

// Snapshot del prompt v2 (sincronizado con route.ts línea ~332).
const INSIGHT_SYSTEM_PROMPT = `Eres Franco. Asesor inmobiliario chileno. Le hablas a un inversionista que está evaluando un departamento — no le vendes, no narras la pantalla, no recitas la tabla. Lees los datos por él y le dices qué significan.

REGLA 0 — ASESOR, NO NARRADOR
Antes de escribir cada frase, pregúntate: ¿esto se reemplaza por una tabla sin pérdida de información? Si la respuesta es sí, no lo escribas. Tu valor es interpretar, no listar.

Narrador (prohibido): "El Metro Tobalaba a 180m garantiza conectividad directa. El Costanera Center a 850m densifica la oferta comercial."
Asesor (esperado): "El mix Tobalaba + El Golf explica que estés en P78 de arriendo: pagas la prima de una zona ya validada."

REGLA 1 — INTERPRETA STATS, NO LOS RECITES
Cuando el contexto financiero te dé números, traduce cada uno a una lectura cualitativa con estos umbrales:

precioM2.diffPct (precio m² del depto vs mediana de la comuna):
  ≤ -3% → "bajo la mediana"
  -3% a +3% → "en línea con la mediana"
  +3% a +8% → "sobre la mediana"
  > +8% → "muy sobre la mediana — sobreprecio"

percentilTuDepto (percentil del arriendo dentro del rango local):
  P0–P25 → "barato para la zona"
  P25–P75 → "rango medio"
  P75–P90 → "caro para la zona"
  > P90 → "muy caro para la zona"

plusvaliaAnual:
  < 3% → "débil vs Santiago (~4% promedio)"
  3–5% → "en línea con Santiago"
  > 5% → "fuerte"

Prohibido recitar el número sin interpretarlo. Si el narrative menciona "+8.2%" o "P81", debe seguir con la lectura cualitativa. Si los datos contradicen un cierre optimista, escribe el cierre que dice la verdad — no el que vende.

REGLA 2 — FRAMEWORK D→C→R→A
El narrative debe construirse como: Dato → Contexto → Riesgo o ventaja. La Acción concreta NO va en el narrative — va en el campo \`accion\` separado.

REGLA 3 — \`accion\` ES IMPERATIVA Y ESPECÍFICA
Verbo en imperativo. Apunta a verificación, negociación o decisión concreta. Tope 140 caracteres. NO depende de unidad (no se duplica en UF).

OK: "Antes de firmar, pide comparables de los últimos 3 meses en el mismo edificio."
OK: "Negocia a la baja: estás pagando ~8% sobre mediana sin justificación visible."
OK: "Verifica que la línea de metro esté operativa antes de pagar la prima de cercanía."
NO: "Considera todos los factores antes de decidir."
NO: "Evalúa si esta inversión calza con tu perfil."
NO: "Analiza con detalle los pros y contras."

REGLA 4 — \`narrative\` ≤ 4 FRASES
Tope duro: 4 frases. Si llegas a 5, sobra una. La densidad importa más que la extensión.

REGLA 5 — VOCABULARIO PROHIBIDO
No uses estas palabras o construcciones (son tono de corredor, no de Franco):
- "ecosistema"
- "ubicación estratégica" / "ubicación privilegiada"
- "establece base sólida" / "posición sólida"
- "compite desde una posición"
- "valoración que el mercado otorga"
- "respiro verde"
- "arriendos resilientes"
- "polo consolidado" / "polo emergente"
- "diversifica inquilinos potenciales"
- "se posiciona como opción atractiva"
- "ofrece" + sustantivo abstracto ("ofrece tranquilidad", "ofrece calidad de vida")

REGLA 6 — REGISTRO Y FORMA (heredado v1, conservado)
- Español chileno neutro. Tuteo: "tú", "tienes", "evalúa". NO voseo ("tenés", "bajá", "decidí").
- NO jerga: "che", "dale", "cachai", "weón", "bacán", "ponele".
- Tono Franco directo. No paternalista, no alarmista, no vendedor.
- Solo menciona POIs presentes en el input. NUNCA inventes estaciones de metro futuras (L7, L8, L9), líneas en construcción ni proyectos urbanos planificados.

REGLA 7 — \`headline\` Y \`preview\` SIGUEN LA MISMA DOCTRINA
- headline_clp: 6-10 palabras. Agrega un ángulo, no titula la zona genéricamente.
  NO: "Metro y mix comercial impulsan demanda premium."
  OK: "Pagas prima por El Golf, no por el depto."
- preview_clp: 12-18 palabras (máximo 2 líneas). Frase analítica que explica el POR QUÉ, no lista datos.
  NO: "Metro a 180m, Bustamante a 410m, Costanera a 850m."
  OK: "La mezcla Metro + El Golf valida el percentil 78 de arriendo, pero no garantiza retorno."

FORMATO DE MONTOS
- CLP: "$1.500.000" — separador de miles con punto.
- UF: "UF 38,7" (decimal con coma) o "UF 1.250" (>=100).
- Rango: "$950.000–$1.700.000" / "UF 24,5–UF 43,8".

VERSIONES CLP vs UF
- Los campos *_clp y *_uf son IDÉNTICOS si el contenido no menciona montos.
- Si el contenido menciona montos, *_clp los expresa en pesos y *_uf en UF (mismo orden, mismas frases, solo cambia la unidad).
- \`accion\` NO tiene versión UF: es una sola frase, no depende de unidad.

ESQUEMA DE RESPUESTA (JSON, 7 campos)

{
  "headline_clp": "...",
  "headline_uf":  "...",
  "preview_clp":  "...",
  "preview_uf":   "...",
  "narrative_clp": "3-4 frases con estructura D→C→R. Si hay montos, en pesos.",
  "narrative_uf":  "Mismas 3-4 frases con montos en UF. Idéntica si no hay montos.",
  "accion": "1 frase imperativa específica (≤140 chars)."
}

Respondes SOLO con el JSON, sin texto adicional ni backticks.`;

interface PoiContext {
  tipo: string;
  nombre: string;
  distancia: number;
}

interface CaseContext {
  id: string;
  label: string;
  comuna: string;
  precioUF: number;
  superficie: number;
  dormitorios: number;
  arriendoCLP: number;
  valorUF: number;
  plusvaliaAnual: number;
  precioM2: { tuDepto: number; medianaComuna: number; diffPct: number } | null;
  oferta: { rangoArriendoMin: number; rangoArriendoMax: number; percentilTuDepto: number } | null;
  pois: PoiContext[];
}

const VALOR_UF = 38800;

// MISMOS 3 contextos que Fase 4 — copia exacta para comparabilidad.
const CASOS: CaseContext[] = [
  {
    id: "A",
    label: "Providencia premium",
    comuna: "Providencia",
    precioUF: 5500,
    superficie: 60,
    dormitorios: 2,
    arriendoCLP: 1500000,
    valorUF: VALOR_UF,
    plusvaliaAnual: 5.5,
    precioM2: { tuDepto: 91.7, medianaComuna: 95.0, diffPct: -3.5 },
    oferta: { rangoArriendoMin: 950000, rangoArriendoMax: 1700000, percentilTuDepto: 78 },
    pois: [
      { tipo: "metro", nombre: "Tobalaba", distancia: 180 },
      { tipo: "parques", nombre: "Parque Bustamante", distancia: 410 },
      { tipo: "clinicas", nombre: "Clínica Indisa", distancia: 620 },
      { tipo: "malls", nombre: "Costanera Center", distancia: 850 },
      { tipo: "universidades", nombre: "Universidad del Desarrollo", distancia: 1100 },
      { tipo: "colegios", nombre: "Colegio Saint George", distancia: 1300 },
      { tipo: "negocios", nombre: "Distrito Financiero El Golf", distancia: 950 },
      { tipo: "institutos", nombre: "INACAP Providencia", distancia: 1400 },
    ],
  },
  {
    id: "B",
    label: "Quinta Normal medio",
    comuna: "Quinta Normal",
    precioUF: 3200,
    superficie: 50,
    dormitorios: 2,
    arriendoCLP: 620000,
    valorUF: VALOR_UF,
    plusvaliaAnual: 3.5,
    precioM2: { tuDepto: 64.0, medianaComuna: 62.0, diffPct: 3.2 },
    oferta: { rangoArriendoMin: 420000, rangoArriendoMax: 720000, percentilTuDepto: 72 },
    pois: [
      { tipo: "metro", nombre: "Cumming", distancia: 350 },
      { tipo: "parques", nombre: "Parque Quinta Normal", distancia: 480 },
      { tipo: "universidades", nombre: "Universidad de Santiago de Chile", distancia: 1250 },
      { tipo: "colegios", nombre: "Colegio Calicanto", distancia: 800 },
      { tipo: "clinicas", nombre: "Hospital San Juan de Dios", distancia: 1100 },
      { tipo: "institutos", nombre: "DUOC UC Padre Alonso de Ovalle", distancia: 1900 },
    ],
  },
  {
    id: "C",
    label: "Independencia económico",
    comuna: "Independencia",
    precioUF: 2800,
    superficie: 45,
    dormitorios: 1,
    arriendoCLP: 480000,
    valorUF: VALOR_UF,
    plusvaliaAnual: 3.0,
    precioM2: { tuDepto: 62.2, medianaComuna: 57.5, diffPct: 8.2 },
    oferta: { rangoArriendoMin: 320000, rangoArriendoMax: 560000, percentilTuDepto: 81 },
    pois: [
      { tipo: "metro", nombre: "Cementerios", distancia: 380 },
      { tipo: "universidades", nombre: "Universidad de Chile Campus Norte", distancia: 750 },
      { tipo: "clinicas", nombre: "Hospital San José", distancia: 920 },
      { tipo: "metro", nombre: "Hospitales", distancia: 1050 },
      { tipo: "colegios", nombre: "Colegio Hispanoamericano", distancia: 850 },
      { tipo: "parques", nombre: "Parque Los Reyes", distancia: 1300 },
    ],
  },
];

function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtUF(n: number, valorUF: number): string {
  const uf = valorUF > 0 ? n / valorUF : 0;
  return uf >= 100
    ? "UF " + Math.round(uf).toLocaleString("es-CL")
    : "UF " + (Math.round(uf * 10) / 10).toFixed(1).replace(".", ",");
}

function buildUserPrompt(c: CaseContext): string {
  const top = [...c.pois].sort((a, b) => a.distancia - b.distancia).slice(0, 8);

  const finLines: string[] = [];
  if (c.arriendoCLP > 0) {
    finLines.push(`- Arriendo estimado: ${fmtCLP(c.arriendoCLP)} / ${fmtUF(c.arriendoCLP, c.valorUF)}`);
  }
  if (c.oferta) {
    finLines.push(
      `- Rango comparable arriendo: ${fmtCLP(c.oferta.rangoArriendoMin)}–${fmtCLP(c.oferta.rangoArriendoMax)} / ${fmtUF(c.oferta.rangoArriendoMin, c.valorUF)}–${fmtUF(c.oferta.rangoArriendoMax, c.valorUF)}`
    );
    finLines.push(`- Percentil de tu arriendo dentro del rango: P${c.oferta.percentilTuDepto}`);
  }
  if (c.precioM2) {
    const diff = c.precioM2.diffPct;
    finLines.push(
      `- Precio m² tu depto: UF ${c.precioM2.tuDepto.toFixed(1).replace(".", ",")} (mediana ${c.comuna}: UF ${c.precioM2.medianaComuna.toFixed(1).replace(".", ",")}, ${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%)`
    );
  }
  finLines.push(`- Plusvalía histórica anualizada ${c.comuna}: ${c.plusvaliaAnual}%`);

  const finBlock = `\n\nContexto financiero del depto (usar solo montos presentes acá):\n${finLines.join("\n")}`;

  return `Comuna: ${c.comuna}
Tipo: análisis LTR (arriendo de largo plazo)

Atractores cercanos (los más relevantes por distancia):
${top.map(t => `- ${t.tipo.toUpperCase()}: ${t.nombre} (${t.distancia} m)`).join("\n")}${finBlock}

Genera tu respuesta como JSON exactamente con esta forma:
{
  "headline_clp": "6-10 palabras. Agrega un ángulo, no titula la zona genéricamente.",
  "headline_uf":  "Igual que headline_clp si no contiene montos.",
  "preview_clp":  "12-18 palabras. Frase analítica, estilo editorial, explica el POR QUÉ, no lista datos.",
  "preview_uf":   "Igual que preview_clp si no contiene montos.",
  "narrative_clp": "3-4 frases con estructura D→C→R (Dato→Contexto→Riesgo/ventaja). Interpreta los stats, no los recites. Si hay montos, en pesos.",
  "narrative_uf":  "Mismas 3-4 frases con montos en UF. Idéntica si narrative_clp no contiene montos.",
  "accion": "1 frase imperativa específica (≤140 chars). Verifica/negocia/decide algo concreto."
}`;
}

const VOCAB_PROHIBIDO = [
  "ecosistema",
  "ubicación estratégica",
  "ubicación privilegiada",
  "establece base sólida",
  "posición sólida",
  "compite desde una posición",
  "valoración que el mercado otorga",
  "respiro verde",
  "arriendos resilientes",
  "polo consolidado",
  "polo emergente",
  "diversifica inquilinos potenciales",
  "se posiciona como opción atractiva",
];

function checkVocabProhibido(text: string): string[] {
  const lower = text.toLowerCase();
  return VOCAB_PROHIBIDO.filter(w => lower.includes(w.toLowerCase()));
}

async function runCase(client: Anthropic, c: CaseContext): Promise<any> {
  const userPrompt = buildUserPrompt(c);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    parsed = { _parseError: String(e), _raw: text };
  }

  const narrative = String(parsed.narrative_clp || "");
  const accion = String(parsed.accion || "");

  return {
    caso: c.id,
    label: c.label,
    comuna: c.comuna,
    contextoEnviado: {
      precioUF: c.precioUF,
      superficie: c.superficie,
      dormitorios: c.dormitorios,
      arriendoCLP: c.arriendoCLP,
      plusvaliaAnual: c.plusvaliaAnual,
      precioM2: c.precioM2,
      oferta: c.oferta,
      pois: c.pois.map(p => ({ tipo: p.tipo, nombre: p.nombre, distancia: p.distancia })),
    },
    userPromptUsado: userPrompt,
    output: parsed,
    rawText: text,
    metricas: {
      headline_clp_words: parsed.headline_clp ? String(parsed.headline_clp).split(/\s+/).length : 0,
      preview_clp_words: parsed.preview_clp ? String(parsed.preview_clp).split(/\s+/).length : 0,
      narrative_clp_words: narrative ? narrative.split(/\s+/).length : 0,
      narrative_clp_sentences: narrative ? narrative.split(/(?<=[.!?])\s+/).filter((s: string) => s.length > 5).length : 0,
      accion_chars: accion.length,
      accion_starts_with_imperative: /^(antes|negocia|verifica|pide|exige|baja|sube|compara|revisa|consulta|deja|busca|elige|descarta|firma|pregunta|evalúa|valida|considera|analiza)/i.test(accion.trim()),
      narratives_iguales: parsed.narrative_clp === parsed.narrative_uf,
      headlines_iguales: parsed.headline_clp === parsed.headline_uf,
      previews_iguales: parsed.preview_clp === parsed.preview_uf,
      vocab_prohibido_hits: [
        ...checkVocabProhibido(String(parsed.headline_clp || "")),
        ...checkVocabProhibido(String(parsed.preview_clp || "")),
        ...checkVocabProhibido(narrative),
      ],
      narrative_max_4_frases: narrative ? narrative.split(/(?<=[.!?])\s+/).filter((s: string) => s.length > 5).length <= 4 : true,
    },
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), "audit", "fase5-outputs");
  fs.mkdirSync(outDir, { recursive: true });

  const client = new Anthropic();

  const all: any[] = [];
  for (const c of CASOS) {
    process.stdout.write(`Caso ${c.id} (${c.label})… `);
    try {
      const result = await runCase(client, c);
      all.push(result);
      const file = path.join(outDir, `caso-${c.id}-${c.comuna.replace(/\s+/g, "_")}.json`);
      fs.writeFileSync(file, JSON.stringify(result, null, 2));
      const m = result.metricas;
      console.log(`OK frases=${m.narrative_clp_sentences} accion="${result.output.accion?.slice(0, 60)}" vocab=${m.vocab_prohibido_hits.length}`);
    } catch (e) {
      console.log(`FAIL ${e}`);
    }
  }

  const summary = path.join(outDir, "_summary.json");
  fs.writeFileSync(summary, JSON.stringify(all, null, 2));
  console.log(`\nSummary → ${summary}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
