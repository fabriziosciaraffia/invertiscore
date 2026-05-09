import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getNearbyAttractors, type AttractorTipo } from "@/lib/data/attractors";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "@/lib/plusvalia-historica";

const anthropic = new Anthropic();

// ─── Types ──────────────────────────────────────────
interface PoiBasic {
  nombre: string;
  distancia: number;  // meters, rounded
  lat: number;
  lng: number;
  linea?: string;     // L1, L2, ... — only for metro
  comuna?: string;    // optional, for debugging/filters
}

interface ZoneInsightStats {
  plusvaliaHistorica: {
    /** Acumulado 10 años (2014-2024). Ej: 37 = 37% en la década. Fuente: Arenas & Cayo, Propital, Tinsa. */
    valor: number;
    /** Anualizado (la misma serie convertida a tasa anual). Ej: 3.2 = 3,2% anual. */
    anualizada: number;
    /** Promedio Gran Santiago **acumulado 10 años** (PLUSVALIA_DEFAULT.plusvalia10a = 35). NO es anualizado. Para el anualizado equivalente ver PLUSVALIA_DEFAULT.anualizada (3.0). */
    promedioSantiago: number;
  };
  precioM2: {
    tuDepto: number;
    medianaComuna: number;
    diffPct: number;
  } | null;
  ofertaComparable: {
    totalDeptos: number;
    rangoArriendoMin: number;
    rangoArriendoMax: number;
    percentilTuDepto: number;
    precision: "exacta" | "superficie_amplia" | "dormitorios_flexibles" | "comuna_general";
  } | null;
}

interface ZoneInsightPois {
  metro: PoiBasic[];
  clinicas: PoiBasic[];
  universidades: PoiBasic[];
  institutos: PoiBasic[];
  colegios: PoiBasic[];
  parques: PoiBasic[];
  malls: PoiBasic[];
  negocios: PoiBasic[];
  trenes: PoiBasic[];
}

interface ZoneInsightResponse {
  stats: ZoneInsightStats;
  pois: ZoneInsightPois;
  insight: {
    headline_clp: string;
    headline_uf: string;
    preview_clp: string;
    preview_uf: string;
    narrative_clp: string;
    narrative_uf: string;
    // Fase 5 v2 — campo agregado al schema. El cliente actual NO lo renderiza
    // (ZoneInsightAI.tsx / ZoneInsightMiniCard.tsx leen headline/preview/narrative).
    // Queda persistido en cache para coordinar UI por separado.
    accion: string;
  };
  valorUF: number;
}

// ─── Stats helpers ──────────────────────────────────
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], target: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v <= target).length;
  return Math.round((below / sorted.length) * 100);
}

// ─── POI selection: top 20 global + reps of missing relevant categories ──
type NearbyAttractor = ReturnType<typeof getNearbyAttractors>[number];

function makePoi(a: NearbyAttractor): PoiBasic {
  const poi: PoiBasic = {
    nombre: a.nombre,
    distancia: Math.round(a.distancia),
    lat: a.lat,
    lng: a.lng,
  };
  if (a.tipo === "metro" && a.meta) poi.linea = a.meta;
  if (a.comuna) poi.comuna = a.comuna;
  return poi;
}

/**
 * Nueva lógica: TOP 20 globales por distancia (sin cap por categoría) + representantes
 * de las categorías relevantes que hayan quedado fuera del top 20 (hasta +5). Esto evita
 * devolver clínicas a 3-4 km cuando hay parques a 200 m.
 */
function buildPoisTopN(nearby: NearbyAttractor[]): ZoneInsightPois {
  const TOP_N = 20;
  const top = nearby.slice(0, TOP_N);
  const topTypes = new Set(top.map((p) => p.tipo));

  const relevantCategories: AttractorTipo[] = [
    "metro",
    "clinica",
    "universidad",
    "parque",
    "mall",
    "negocios",
  ];
  const reps: NearbyAttractor[] = [];
  for (const t of relevantCategories) {
    if (topTypes.has(t)) continue;
    if (reps.length >= 5) break;
    const rep = nearby.find((p) => p.tipo === t);
    if (rep) reps.push(rep);
  }

  const finalPois = [...top, ...reps];
  const pickByTipo = (tipo: AttractorTipo): PoiBasic[] =>
    finalPois.filter((p) => p.tipo === tipo).map(makePoi);

  return {
    metro: pickByTipo("metro"),
    clinicas: pickByTipo("clinica"),
    universidades: pickByTipo("universidad"),
    institutos: pickByTipo("instituto"),
    colegios: pickByTipo("colegio"),
    parques: pickByTipo("parque"),
    malls: pickByTipo("mall"),
    negocios: pickByTipo("negocios"),
    trenes: pickByTipo("tren"),
  };
}

// ─── Comparable market stats from scraped_properties ──
async function fetchComunaStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  arriendoEstimadoCLP: number,
  ufValue: number
): Promise<{ precioM2: ZoneInsightStats["precioM2"]; ofertaComparable: ZoneInsightStats["ofertaComparable"] }> {
  // Window for VENTA comparables (price/m²): ±20% surface.
  // ARRIENDO uses a cascading strategy in fetchOfertaComparableCascade below.
  const supMinV = superficie * 0.8;
  const supMaxV = superficie * 1.2;

  // ── VENTA: median price/m² in UF ──
  let ventaQ = supabase
    .from("scraped_properties")
    .select("precio, moneda, superficie_m2, dormitorios")
    .eq("comuna", comuna)
    .eq("type", "venta")
    .eq("is_active", true)
    .gte("superficie_m2", supMinV)
    .lte("superficie_m2", supMaxV)
    .limit(2000);
  if (dormitorios !== null) ventaQ = ventaQ.eq("dormitorios", dormitorios);
  const { data: ventas } = await ventaQ;

  let precioM2: ZoneInsightStats["precioM2"] = null;
  if (Array.isArray(ventas) && ventas.length >= 20) {
    const m2sUF: number[] = [];
    for (const r of ventas) {
      if (!r.superficie_m2 || r.superficie_m2 <= 0 || !r.precio || r.precio <= 0) continue;
      const precioUF = r.moneda === "UF" ? r.precio : r.precio / (ufValue || 1);
      m2sUF.push(precioUF / r.superficie_m2);
    }
    if (m2sUF.length >= 20) {
      const med = median(m2sUF);
      const tuDepto = arriendoEstimadoCLP > 0 ? 0 : 0; // unused — kept for symmetry, replaced below
      void tuDepto;
      precioM2 = {
        tuDepto: 0, // filled by caller from results.metrics.precioM2
        medianaComuna: Math.round(med * 100) / 100,
        diffPct: 0, // filled by caller
      };
    }
  }

  // ── ARRIENDO: cascade query with progressively looser filters ──
  const ofertaComparable = await fetchOfertaComparableCascade(
    supabase,
    comuna,
    superficie,
    dormitorios,
    arriendoEstimadoCLP,
    ufValue
  );

  return { precioM2, ofertaComparable };
}

// Shape of a single arriendo row we care about
interface ArriendoRow {
  precio: number;
  moneda: string;
  superficie_m2: number | null;
  dormitorios: number | null;
}

interface CascadeFilters {
  supMin: number;
  supMax: number;
  dormMin?: number;
  dormMax?: number;
}

async function runArriendoQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  f: CascadeFilters
): Promise<ArriendoRow[]> {
  let q = supabase
    .from("scraped_properties")
    .select("precio, moneda, superficie_m2, dormitorios")
    .eq("comuna", comuna)
    .eq("type", "arriendo")
    .eq("is_active", true)
    .gte("superficie_m2", f.supMin)
    .lte("superficie_m2", f.supMax)
    .limit(2000);
  if (typeof f.dormMin === "number" && typeof f.dormMax === "number") {
    if (f.dormMin === f.dormMax) q = q.eq("dormitorios", f.dormMin);
    else q = q.gte("dormitorios", f.dormMin).lte("dormitorios", f.dormMax);
  }
  const { data } = await q;
  return Array.isArray(data) ? (data as ArriendoRow[]) : [];
}

function filterValidPrices(rows: ArriendoRow[], ufValue: number): number[] {
  const preciosCLP: number[] = [];
  for (const r of rows) {
    if (!r.precio || r.precio <= 0) continue;
    const precioCLP = r.moneda === "UF" ? r.precio * (ufValue || 0) : r.precio;
    // Filter outliers (rent ought to be 80k–10M CLP)
    if (precioCLP < 80_000 || precioCLP > 10_000_000) continue;
    preciosCLP.push(precioCLP);
  }
  return preciosCLP;
}

function buildOferta(
  prices: number[],
  arriendoEstimadoCLP: number,
  precision: "exacta" | "superficie_amplia" | "dormitorios_flexibles" | "comuna_general"
): ZoneInsightStats["ofertaComparable"] {
  const sorted = [...prices].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  return {
    totalDeptos: sorted.length,
    rangoArriendoMin: Math.round(p10),
    rangoArriendoMax: Math.round(p90),
    percentilTuDepto: percentile(sorted, arriendoEstimadoCLP),
    precision,
  };
}

/**
 * Tries progressively looser filters until >= MIN_REQUIRED comparable rentals are found.
 * Returns null if even the broadest query is too thin.
 */
async function fetchOfertaComparableCascade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  arriendoEstimadoCLP: number,
  ufValue: number
): Promise<ZoneInsightStats["ofertaComparable"]> {
  const MIN_REQUIRED = 15;

  // Attempt 1: strict — ±10% surface, exact dormitorios (if provided)
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.9,
      supMax: superficie * 1.1,
      dormMin: dormitorios ?? undefined,
      dormMax: dormitorios ?? undefined,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "exacta");
  }

  // Attempt 2: wider surface — ±20%, exact dormitorios
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.8,
      supMax: superficie * 1.2,
      dormMin: dormitorios ?? undefined,
      dormMax: dormitorios ?? undefined,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "superficie_amplia");
  }

  // Attempt 3: dormitorios ±1 (if we had a target)
  if (dormitorios !== null) {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.8,
      supMax: superficie * 1.2,
      dormMin: Math.max(1, dormitorios - 1),
      dormMax: dormitorios + 1,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "dormitorios_flexibles");
  }

  // Attempt 4: broadest — comuna + ±30% surface, any dormitorios
  {
    const rows = await runArriendoQuery(supabase, comuna, {
      supMin: superficie * 0.7,
      supMax: superficie * 1.3,
    });
    const prices = filterValidPrices(rows, ufValue);
    if (prices.length >= MIN_REQUIRED) return buildOferta(prices, arriendoEstimadoCLP, "comuna_general");
  }

  return null;
}

// ─── AI insight generator ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// INSIGHT_SYSTEM_PROMPT v2 (Fase 5)
// Hereda doctrina del skill analysis-voice-franco: asesor no narrador, framework
// D→C→R→A, interpretación obligatoria de stats. Conserva reglas defensivas que
// funcionaban en v1 (chileno neutro, no jerga, no metros futuros). Agrega campo
// `accion` imperativa al schema de respuesta.
// ─────────────────────────────────────────────────────────────────────────────
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

plusvaliaAnual (histórica anualizada 2014-2024 de la comuna):
  < 3% → "débil vs proyección motor 4% — la histórica observada de Gran Santiago promedia 3% anual"
  3–5% → "alineada con la proyección motor 4%"
  > 5% → "fuerte vs la proyección motor 4%"

CRÍTICO: el "4%" en estos umbrales es la PROYECCIÓN del motor (supuesto canónico para todos los cálculos), NO una observación histórica. El promedio histórico observado de Gran Santiago es 3% anual, distinto del 4% proyectado. Cuando el narrative cite "4%", debe quedar claro al usuario que es la proyección del motor, no un dato observado.

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

REGLA 8 — Plusvalía: jerarquía canónica IA ↔ motor

La proyección del motor es 4% anual flat. Es canónica para los cálculos del análisis (TIR, Cash-on-Cash, valor venta, patrimonio proyectado). La histórica de la comuna que recibís en el contexto es CONTEXTO DE RIESGO sobre esa apuesta, no proyección alternativa.

Cuando interpretes la histórica vs la proyección 4%:
- Histórica > 4%: la proyección es conservadora vs lo observado.
- Histórica ≈ 4%: la proyección está alineada con la trayectoria.
- Histórica < 4%: la proyección descansa en una densificación o cambio de zona distinto a la década pasada.
- Histórica negativa: la proyección es una apuesta a recuperación frente a una década de pérdida.
- Sin data histórica: la proyección es supuesto puro, sin verificación local.

PROHIBIDO:
- "el motor sobreestima la plusvalía"
- "la plusvalía real será X%" (X ≠ 4%)
- "no esperes plusvalía aquí"
- Cualquier sugerencia de una proyección distinta al 4%.

VÁLIDO:
- "Santiago perdió 1% anual histórico — la proyección 4% del motor es apuesta a recuperación."
- "Providencia subió 3% anual; proyección 4% queda ligeramente optimista vs trayectoria."
- "Sin data histórica para esta comuna; proyección 4% es supuesto sin ancla local."

Esta REGLA 8 NO sustituye los umbrales cualitativos de REGLA 1 (que clasifican la histórica como "fuerte/en línea/débil" vs el promedio histórico Gran Santiago). Disciplina la JERARQUÍA entre proyección motor y histórica al hablarle al usuario.

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

interface InsightAIContext {
  arriendoCLP: number;
  valorUF: number;
  plusvaliaAnual?: number;
  precioM2?: { tuDepto: number; medianaComuna: number; diffPct: number } | null;
  oferta?: { rangoArriendoMin: number; rangoArriendoMax: number; percentilTuDepto: number } | null;
}

async function generateInsightAI(
  comuna: string,
  pois: ZoneInsightPois,
  ctx: InsightAIContext,
): Promise<{ headline_clp: string; headline_uf: string; preview_clp: string; preview_uf: string; narrative_clp: string; narrative_uf: string; accion: string }> {
  const flatTop: Array<{ tipo: string; nombre: string; distancia: number }> = [];
  (Object.keys(pois) as Array<keyof ZoneInsightPois>).forEach((bucket) => {
    pois[bucket].slice(0, 3).forEach((p) => flatTop.push({ tipo: bucket, nombre: p.nombre, distancia: p.distancia }));
  });
  flatTop.sort((a, b) => a.distancia - b.distancia);
  const top = flatTop.slice(0, 8);

  const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  const fmtUF = (n: number) => {
    const uf = ctx.valorUF > 0 ? n / ctx.valorUF : 0;
    return uf >= 100
      ? "UF " + Math.round(uf).toLocaleString("es-CL")
      : "UF " + (Math.round(uf * 10) / 10).toFixed(1).replace(".", ",");
  };

  const finLines: string[] = [];
  if (ctx.arriendoCLP > 0) {
    finLines.push(`- Arriendo estimado: ${fmtCLP(ctx.arriendoCLP)} / ${fmtUF(ctx.arriendoCLP)}`);
  }
  if (ctx.oferta) {
    finLines.push(
      `- Rango comparable arriendo: ${fmtCLP(ctx.oferta.rangoArriendoMin)}–${fmtCLP(ctx.oferta.rangoArriendoMax)} / ${fmtUF(ctx.oferta.rangoArriendoMin)}–${fmtUF(ctx.oferta.rangoArriendoMax)}`
    );
    finLines.push(`- Percentil de tu arriendo dentro del rango: P${ctx.oferta.percentilTuDepto}`);
  }
  if (ctx.precioM2) {
    const diff = ctx.precioM2.diffPct;
    finLines.push(
      `- Precio m² tu depto: UF ${ctx.precioM2.tuDepto.toFixed(1).replace(".", ",")} (mediana ${comuna}: UF ${ctx.precioM2.medianaComuna.toFixed(1).replace(".", ",")}, ${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%)`
    );
  } else {
    // B4-1: cuando no hay data de mediana de precio/m² para esta comuna
    // (zona sin scraped_properties suficientes), el IA debe mencionarlo
    // explícitamente — no omitirlo en silencio. El usuario tiene que saber
    // que la comparación de precio/m² vs zona NO está disponible.
    finLines.push(`- Precio m² zona: SIN DATA confiable para ${comuna} (sample insuficiente). Debes mencionarlo explícitamente en el narrative — no omitas en silencio.`);
  }
  if (typeof ctx.plusvaliaAnual === "number") {
    // B4-2: el número es ANUALIZADO (ej. 3.2 = 3,2% anual). El acumulado 10
    // años de la misma comuna sería ~37% — no confundir un valor con el otro.
    // Cualquier mención al "4%" de los umbrales en REGLA 1 es la PROYECCIÓN
    // del motor, no la histórica observada.
    finLines.push(`- Plusvalía histórica anualizada ${comuna}: ${ctx.plusvaliaAnual}% (cifra ANUAL, no acumulada 10 años).`);
  }

  const finBlock = finLines.length > 0 ? `\n\nContexto financiero del depto (usar solo montos presentes acá):\n${finLines.join("\n")}` : "";

  const userPrompt = `Comuna: ${comuna}
Tipo: análisis LTR (arriendo de largo plazo)

Atractores cercanos (los más relevantes por distancia):
${top.length === 0 ? "(ninguno dentro de 2,5 km — comuna periférica)" : top.map(t => `- ${t.tipo.toUpperCase()}: ${t.nombre} (${t.distancia} m)`).join("\n")}${finBlock}

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

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      headline_clp: String(parsed.headline_clp || ""),
      headline_uf: String(parsed.headline_uf || parsed.headline_clp || ""),
      preview_clp: String(parsed.preview_clp || ""),
      preview_uf: String(parsed.preview_uf || parsed.preview_clp || ""),
      narrative_clp: String(parsed.narrative_clp || ""),
      narrative_uf: String(parsed.narrative_uf || parsed.narrative_clp || ""),
      accion: String(parsed.accion || ""),
    };
  } catch (e) {
    console.error("zone-insight: AI generation failed", e);
    return {
      headline_clp: "",
      headline_uf: "",
      preview_clp: "",
      preview_uf: "",
      narrative_clp: "",
      narrative_uf: "",
      accion: "",
    };
  }
}

// ─── GET handler ────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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
    if (!force && row.zone_insight && typeof row.zone_insight === "object") {
      const cached = row.zone_insight as ZoneInsightResponse & {
        insight: { preview_clp?: string; preview_uf?: string; accion?: string };
      };
      // Backfill preview fields if cache was generated before they existed.
      if (cached.insight && !cached.insight.preview_clp) {
        const n = cached.insight.narrative_clp || "";
        cached.insight.preview_clp = n ? n.slice(0, 140).trim() + (n.length > 140 ? "…" : "") : "";
        cached.insight.preview_uf = cached.insight.preview_clp;
      }
      // Fase 5 — backfill accion para caches v1 (campo agregado en v2).
      if (cached.insight && typeof cached.insight.accion !== "string") {
        cached.insight.accion = "";
      }
      return NextResponse.json(cached);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (row.input_data ?? {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (row.results ?? {}) as any;

    const lat = input.lat ?? input.zonaRadio?.lat ?? null;
    const lng = input.lng ?? input.zonaRadio?.lng ?? null;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Análisis sin coordenadas" }, { status: 400 });
    }

    // Read from top-level columns first (row.precio / row.superficie / row.arriendo).
    // These are the values the UI shows in the HeroCard (page.tsx uses the same source).
    // input_data.* can diverge — e.g. superficie útil vs total — so falling back to it
    // caused precioM2 and percentilTuDepto to be off.
    const comuna: string = (row.comuna || input.comuna || "").trim();
    const precioUF: number = Number(row.precio) || Number(input.precio) || 0;
    const superficie: number = Number(row.superficie) || Number(input.superficie) || 50;
    const dormitorios: number | null =
      typeof row.dormitorios === "number" ? row.dormitorios
      : typeof input.dormitorios === "number" ? input.dormitorios
      : null;
    const arriendoEstimadoCLP: number =
      Number(row.arriendo) || Number(input.arriendo) || Number(results?.metrics?.ingresoMensual) || 0;
    const ufValue: number = results?.metrics?.precioCLP && precioUF
      ? results.metrics.precioCLP / precioUF
      : 38800;

    // 1) POIs ─────────────────────────────────────────
    const nearby = getNearbyAttractors(lat, lng, 2500);
    const pois = buildPoisTopN(nearby);

    // NOTA: la mención de metros futuros (L7/L8/L9) fue desactivada temporalmente
    // porque el dataset metro-stations.ts contiene estaciones ficticias (ej. "Pocuro")
    // con líneas/coordenadas incorrectas. El IA las inventaba en el narrative.
    // La auditoría completa del dataset de estaciones futuras contra fuentes oficiales
    // de metro.cl queda como proyecto separado (ver backlog). Reactivar SOLO después
    // de limpiar el dataset.

    // 2) Stats — plusvalía ───────────────────────────
    const histo = PLUSVALIA_HISTORICA[comuna];
    const plusvaliaHistorica = histo
      ? { valor: histo.plusvalia10a, anualizada: histo.anualizada, promedioSantiago: PLUSVALIA_DEFAULT.plusvalia10a }
      : { valor: PLUSVALIA_DEFAULT.plusvalia10a, anualizada: PLUSVALIA_DEFAULT.anualizada, promedioSantiago: PLUSVALIA_DEFAULT.plusvalia10a };

    // 3) Stats — comparable comuna ───────────────────
    let precioM2: ZoneInsightStats["precioM2"] = null;
    let ofertaComparable: ZoneInsightStats["ofertaComparable"] = null;
    try {
      // Use service role for stats so we can read the full scraped dataset regardless of RLS.
      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const dbForStats = serviceUrl && serviceKey
        ? createAdminClient(serviceUrl, serviceKey)
        : supabase;

      const stats = await fetchComunaStats(
        dbForStats,
        comuna,
        superficie,
        dormitorios,
        arriendoEstimadoCLP,
        ufValue
      );
      precioM2 = stats.precioM2;
      ofertaComparable = stats.ofertaComparable;
      // Fill in tuDepto using precioUF / superficie directly (in UF).
      // We deliberately ignore results.metrics.precioM2 (it can add optional parking
      // price into precioTotal) and input_data.* (which can diverge from the top-level
      // columns the UI reads). precioUF + superficie above already unify both sources.
      if (precioM2) {
        const tuM2UF = superficie > 0 ? precioUF / superficie : 0;
        precioM2.tuDepto = Math.round(tuM2UF * 100) / 100;
        if (precioM2.medianaComuna > 0) {
          precioM2.diffPct = Math.round(((precioM2.tuDepto - precioM2.medianaComuna) / precioM2.medianaComuna) * 1000) / 10;
        }
      }
    } catch (e) {
      console.error("zone-insight: stats query failed", e);
    }

    // 4) AI insight ──────────────────────────────────
    const insight = await generateInsightAI(comuna, pois, {
      arriendoCLP: arriendoEstimadoCLP,
      valorUF: ufValue,
      plusvaliaAnual: plusvaliaHistorica.anualizada,
      precioM2: precioM2,
      oferta: ofertaComparable
        ? {
            rangoArriendoMin: ofertaComparable.rangoArriendoMin,
            rangoArriendoMax: ofertaComparable.rangoArriendoMax,
            percentilTuDepto: ofertaComparable.percentilTuDepto,
          }
        : null,
    });

    const response: ZoneInsightResponse = {
      stats: { plusvaliaHistorica, precioM2, ofertaComparable },
      pois,
      insight,
      valorUF: ufValue,
    };

    // 5) Cache ───────────────────────────────────────
    // Best-effort: if the column doesn't exist yet, swallow the error so the user
    // still gets the response.
    try {
      await supabase.from("analisis").update({ zone_insight: response }).eq("id", params.id);
    } catch (e) {
      console.warn("zone-insight: cache write failed (column missing?)", e);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("zone-insight error:", error);
    return NextResponse.json({ error: "Error generando insight" }, { status: 500 });
  }
}
