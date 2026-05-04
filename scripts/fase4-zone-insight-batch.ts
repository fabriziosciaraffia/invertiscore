/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fase 4 — Diagnóstico Zone Insight
 *
 * Llama directo a Anthropic con el INSIGHT_SYSTEM_PROMPT actual (clon de route.ts:332)
 * usando 3 contextos sintéticos (A premium / B medio / C bajo).
 * Guarda outputs JSON en audit/fase4-outputs/ para diagnóstico estructurado.
 *
 *   npx tsx scripts/fase4-zone-insight-batch.ts
 *
 * NO escribe en DB de producción. NO requiere análisis reales.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

// Prompt clonado de src/app/api/analisis/[id]/zone-insight/route.ts:332
// Si cambia ahí, hay que actualizarlo aquí (snapshot de la versión actual).
const INSIGHT_SYSTEM_PROMPT = `Eres un asistente que escribe para Franco, plataforma chilena de análisis inmobiliario.

Tu tarea: generar un párrafo narrativo de 3-5 frases sobre los drivers de demanda que tiene un depto según los atractores urbanos cercanos.

REGLAS:
1. Español chileno NEUTRO. No usar voseo ("tenés", "bajá", "decidí"). Usar "tú" y formas chilenas: "tienes", "baja", "decide", "protege", "evalúa".
2. Tono profesional pero cercano. No paternalista. No alarmista.
3. Mencionar solo los atractores más relevantes (top 4-5) por distancia e importancia.
4. Conectar los atractores con tipos de demanda concretos:
   - Metro cercano (<500m) → transporte, demanda general de arriendo, vacancia baja
   - Clínicas grandes (<1000m) → turismo médico (pacientes de regiones) y residentes médicos
   - Universidades (<1500m) → demanda estudiantil estable 1-4 años
   - Colegios top (<1500m) → demanda familiar
   - Parques (<800m) → calidad de vida, sostén de precio
   - Malls (<1000m) → densidad comercial, valoración de ubicación
   - Zonas de negocios (<1500m) → demanda ejecutiva, arriendos altos
5. Cerrar con una síntesis sobre cómo esta mezcla afecta el arriendo (vacancia baja, precio sostenible, resiliencia ante cambios de mercado).
6. Longitud: 4-6 frases.
7. NO uses lenguaje anti-corredor ni vendedor. NO exageres.
8. NO uses "che", "dale", "ponele", "cachai", "bacán", "weón".
9. NUNCA inventes ni menciones estaciones de metro futuras, líneas en construcción (L7, L8, L9), ni proyectos urbanos planificados. Solo menciona infraestructura que ya está operativa y que aparece en los datos que te paso. Si no tienes información sobre proyectos futuros, no los inventes.

SOBRE EL PREVIEW:
- El campo "preview" es una frase corta (12-18 palabras, máximo 2 líneas) que sintetiza el POR QUÉ analítico, no lista datos concretos.
- Ejemplo bueno: "La mezcla de metro, universidades y clínicas diversifica la demanda y sostiene el precio."
- Ejemplo malo: "Metro a 245m, Parque Bustamante a 149m, INACAP a 900m." (eso es datos, no análisis.)
- Usa lenguaje de consultor inmobiliario, no vendedor.

SOBRE narrative_clp Y narrative_uf:
Los dos deben ser DISTINTOS cuando hay montos concretos útiles al análisis. Solo son idénticos si el insight es puramente cualitativo.

narrative_clp:
- Menciona montos en pesos chilenos cuando aporten (percentiles de arriendo, diferencias de precio m², proyecciones).
- Formato: "$950.000", "$92.000.000", "$640.000–$1.347.000".

narrative_uf:
- Mismos montos expresados en UF. Formato: "UF 25,3", "UF 2.450", "UF 17,0–UF 35,8".
- Debe ser coherente con narrative_clp: si uno menciona un monto, el otro lo menciona en la moneda opuesta.

CUÁNDO MENCIONAR MONTOS:
- Siempre que aporten contexto financiero concreto (arriendo estimado vs. rango comparable, diferencia vs mediana m², plusvalía a X años).
- NO fuerces montos si el insight es puramente cualitativo ("zona con alta conectividad") → ahí los dos narratives pueden ser idénticos.
- NO inventes montos que no estén en el input.

EJEMPLOS:

Cualitativo (ambos iguales):
  narrative_clp: "La combinación de metro, universidades y clínicas genera demanda diversa que reduce la vacancia."
  narrative_uf:  "La combinación de metro, universidades y clínicas genera demanda diversa que reduce la vacancia."

Con montos (distintos):
  narrative_clp: "El arriendo estimado de $950.000 se ubica en el percentil 58 del rango local ($640.000–$1.347.000), posicionado para competir sin castigar precio."
  narrative_uf:  "El arriendo estimado de UF 25,3 se ubica en el percentil 58 del rango local (UF 17,0–UF 35,8), posicionado para competir sin castigar precio."

Respondes SOLO con el JSON solicitado, sin texto adicional ni backticks.`;

// Tipos
interface PoiContext {
  tipo: string;  // metro, clinicas, universidades, institutos, colegios, parques, malls, negocios, trenes
  nombre: string;
  distancia: number;  // metros
}

interface CaseContext {
  id: string;
  label: string;
  comuna: string;
  // Inputs financieros
  precioUF: number;
  superficie: number;
  dormitorios: number;
  arriendoCLP: number;
  valorUF: number;
  // Stats que normalmente vendrían del DB
  plusvaliaAnual: number;
  precioM2: { tuDepto: number; medianaComuna: number; diffPct: number } | null;
  oferta: { rangoArriendoMin: number; rangoArriendoMax: number; percentilTuDepto: number } | null;
  // POIs cercanos (top 8 ya filtrados por distancia)
  pois: PoiContext[];
}

const VALOR_UF = 38800;

// ─── Casos sintéticos ───────────────────────────────
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

// ─── Generador (clon de generateInsightAI en route.ts) ───
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
  "headline_clp": "Frase corta de 6-10 palabras que resume el insight.",
  "headline_uf":  "Igual que headline_clp si no hay montos.",
  "preview_clp": "Frase analítica 12-18 palabras (máximo 2 líneas), estilo editorial, explica el POR QUÉ, no lista datos.",
  "preview_uf":  "Igual que preview_clp si no hay montos.",
  "narrative_clp": "4-6 frases en chileno neutro. Puedes incluir montos concretos en pesos cuando aporten al análisis (usa solo los del contexto financiero).",
  "narrative_uf":  "Mismas 4-6 frases pero con los montos en UF. Si narrative_clp no menciona montos, esta versión es idéntica."
}`;
}

async function runCase(client: Anthropic, c: CaseContext): Promise<any> {
  const userPrompt = buildUserPrompt(c);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
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
      narrative_clp_words: parsed.narrative_clp ? String(parsed.narrative_clp).split(/\s+/).length : 0,
      narrative_clp_sentences: parsed.narrative_clp ? String(parsed.narrative_clp).split(/(?<=[.!?])\s+/).filter((s: string) => s.length > 5).length : 0,
      narratives_iguales: parsed.narrative_clp === parsed.narrative_uf,
      headlines_iguales: parsed.headline_clp === parsed.headline_uf,
      previews_iguales: parsed.preview_clp === parsed.preview_uf,
    },
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), "audit", "fase4-outputs");
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
      console.log(`OK → ${file}`);
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
