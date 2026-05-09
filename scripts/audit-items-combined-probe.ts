/**
 * Probe v_new — Items 12 + 13 + B4-1 + B4-2 (combinado).
 *
 * Caso 1 (Item 12) — Quilicura LTR: caveat ambidireccional (boom 2014-2018).
 * Caso 2 (Item 13) — Santiago zone-insight: "4%" como proyección motor.
 * Caso 3 (B4-1) — Comuna sin precioM2 zone-insight: mención explícita.
 * Caso 4 (B4-2) — Quilicura zone-insight: número anualizado claro.
 *
 * Para LTR usa el patrón insert-tmp + generateAiAnalysis + delete.
 * Para zone-insight extrae INSIGHT_SYSTEM_PROMPT del route via fs+regex y llama
 * Anthropic directo (no requiere insertar fila).
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { runAnalysis } from "../src/lib/analysis";
import { generateAiAnalysis } from "../src/lib/ai-generation";
import { PLUSVALIA_HISTORICA } from "../src/lib/plusvalia-historica";
import type { AnalisisInput } from "../src/lib/types";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const anthropic = new Anthropic();
const UF_CLP = 40213;

// Extraer INSIGHT_SYSTEM_PROMPT del route.ts (Next 14 no permite export).
const INSIGHT_SYSTEM_PROMPT = (() => {
  const route = readFileSync("src/app/api/analisis/[id]/zone-insight/route.ts", "utf8");
  const m = route.match(/const INSIGHT_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
  if (!m) throw new Error("INSIGHT_SYSTEM_PROMPT no encontrado en route.ts");
  return m[1];
})();

function makeInput(comuna: string): AnalisisInput {
  return {
    nombre: `PROBE_ITEMS_COMBINED_${comuna}`,
    tipo: "Departamento",
    comuna,
    ciudad: "Santiago",
    direccion: "Test",
    superficie: 50,
    superficieTotal: 50,
    dormitorios: 2,
    banos: 1,
    antiguedad: 5,
    precio: 5000,
    arriendo: 1200000,
    gastos: 80000,
    contribuciones: 282331,
    piso: 0,
    bodega: false,
    cantidadBodegas: 0,
    estacionamiento: "no",
    cantidadEstacionamientos: 0,
    precioEstacionamiento: 0,
    arriendoEstacionamiento: 0,
    arriendoBodega: 0,
    piePct: 20,
    cuotasPie: 0,
    montoCuota: 0,
    plazoCredito: 25,
    tasaInteres: 4.11,
    tipoRenta: "larga",
    vacanciaMeses: 1,
    enConstruccion: false,
    estadoVenta: "inmediata",
    valorMercadoUsuario: 5000,
    valorMercadoFranco: 5000,
    usaAdministrador: false,
    provisionMantencion: 60151,
    fechaEntrega: null as unknown as string,
  } as unknown as AnalisisInput;
}

async function correrLtr(comuna: string): Promise<string> {
  const input = makeInput(comuna);
  const results = runAnalysis(input, UF_CLP);
  const { data: ins, error } = await sb
    .from("analisis")
    .insert({
      nombre: input.nombre, comuna: input.comuna, ciudad: input.ciudad, direccion: input.direccion,
      tipo: input.tipo, dormitorios: input.dormitorios, banos: input.banos, superficie: input.superficie,
      antiguedad: input.antiguedad, precio: input.precio * UF_CLP, arriendo: input.arriendo,
      gastos: input.gastos, contribuciones: input.contribuciones, score: results.score,
      desglose: results.desglose, resumen: results.resumen ?? "Probe sintético — borrar.",
      results, input_data: input, is_premium: true, user_id: null,
    })
    .select("id").single();
  if (error || !ins?.id) throw new Error("Insert: " + JSON.stringify(error));
  const tmpId = ins.id as string;
  try {
    const r = await generateAiAnalysis(tmpId, sb as any);
    if (!r) throw new Error("generateAiAnalysis null");
    return JSON.stringify(r, null, 2);
  } finally {
    await sb.from("analisis").delete().eq("id", tmpId);
  }
}

interface InsightCtx {
  comuna: string;
  arriendoCLP: number;
  valorUF: number;
  plusvaliaAnual?: number;
  precioM2?: { tuDepto: number; medianaComuna: number; diffPct: number } | null;
  oferta?: { rangoArriendoMin: number; rangoArriendoMax: number; percentilTuDepto: number } | null;
  poisTop: Array<{ tipo: string; nombre: string; distancia: number }>;
}

function buildInsightUserPrompt(ctx: InsightCtx): string {
  const fmtCLP = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  const fmtUF = (n: number) => {
    const uf = ctx.valorUF > 0 ? n / ctx.valorUF : 0;
    return uf >= 100 ? "UF " + Math.round(uf).toLocaleString("es-CL")
      : "UF " + (Math.round(uf * 10) / 10).toFixed(1).replace(".", ",");
  };
  const finLines: string[] = [];
  if (ctx.arriendoCLP > 0) {
    finLines.push(`- Arriendo estimado: ${fmtCLP(ctx.arriendoCLP)} / ${fmtUF(ctx.arriendoCLP)}`);
  }
  if (ctx.oferta) {
    finLines.push(
      `- Rango comparable arriendo: ${fmtCLP(ctx.oferta.rangoArriendoMin)}–${fmtCLP(ctx.oferta.rangoArriendoMax)} / ${fmtUF(ctx.oferta.rangoArriendoMin)}–${fmtUF(ctx.oferta.rangoArriendoMax)}`,
    );
    finLines.push(`- Percentil de tu arriendo dentro del rango: P${ctx.oferta.percentilTuDepto}`);
  }
  if (ctx.precioM2) {
    const diff = ctx.precioM2.diffPct;
    finLines.push(
      `- Precio m² tu depto: UF ${ctx.precioM2.tuDepto.toFixed(1).replace(".", ",")} (mediana ${ctx.comuna}: UF ${ctx.precioM2.medianaComuna.toFixed(1).replace(".", ",")}, ${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%)`,
    );
  } else {
    finLines.push(`- Precio m² zona: SIN DATA confiable para ${ctx.comuna} (sample insuficiente). Debes mencionarlo explícitamente en el narrative — no omitas en silencio.`);
  }
  if (typeof ctx.plusvaliaAnual === "number") {
    finLines.push(`- Plusvalía histórica anualizada ${ctx.comuna}: ${ctx.plusvaliaAnual}% (cifra ANUAL, no acumulada 10 años).`);
  }
  const finBlock = finLines.length > 0 ? `\n\nContexto financiero del depto (usar solo montos presentes acá):\n${finLines.join("\n")}` : "";
  const top = ctx.poisTop.slice(0, 8);
  return `Comuna: ${ctx.comuna}
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
}

async function correrZoneInsight(ctx: InsightCtx): Promise<string> {
  const userPrompt = buildInsightUserPrompt(ctx);
  const m = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  return m.content[0].type === "text" ? m.content[0].text : "";
}

async function main() {
  console.log("Probe v_new Items 12+13+B4 — 4 casos");

  // Caso 1 — Quilicura LTR (Item 12: caveat boom 2014-2018)
  console.log("\n[1] Quilicura LTR (Item 12 — caveat boom)...");
  if (!PLUSVALIA_HISTORICA["Quilicura"]) throw new Error("Quilicura no en PLUSVALIA_HISTORICA");
  const c1 = await correrLtr("Quilicura");
  console.log("  ✓ LTR ok");

  // Caso 2 — Santiago zone-insight (Item 13: 4% como proyección motor)
  console.log("\n[2] Santiago zone-insight (Item 13 — 4% proyección)...");
  const c2 = await correrZoneInsight({
    comuna: "Santiago",
    arriendoCLP: 1200000,
    valorUF: UF_CLP,
    plusvaliaAnual: -1.1,
    precioM2: { tuDepto: 100, medianaComuna: 96, diffPct: 4 },
    oferta: { rangoArriendoMin: 850000, rangoArriendoMax: 1450000, percentilTuDepto: 72 },
    poisTop: [
      { tipo: "metro", nombre: "Estación Test", distancia: 320 },
      { tipo: "universidades", nombre: "Universidad Test", distancia: 600 },
    ],
  });
  console.log("  ✓ zone-insight ok");

  // Caso 3 — Sin precioM2 zone-insight (B4-1: mención explícita)
  console.log("\n[3] Sin precioM2 zone-insight (B4-1 — mención sin data)...");
  const c3 = await correrZoneInsight({
    comuna: "El Bosque",
    arriendoCLP: 450000,
    valorUF: UF_CLP,
    plusvaliaAnual: -0.7,
    precioM2: null, // <-- B4-1 trigger
    oferta: null,
    poisTop: [
      { tipo: "colegios", nombre: "Colegio Local", distancia: 800 },
    ],
  });
  console.log("  ✓ zone-insight ok");

  // Caso 4 — Quilicura zone-insight (B4-2: número anualizado claro)
  console.log("\n[4] Quilicura zone-insight (B4-2 — anualizado vs acumulado)...");
  const c4 = await correrZoneInsight({
    comuna: "Quilicura",
    arriendoCLP: 1200000,
    valorUF: UF_CLP,
    plusvaliaAnual: 5.3,
    precioM2: { tuDepto: 100, medianaComuna: 36, diffPct: 178 },
    oferta: { rangoArriendoMin: 350000, rangoArriendoMax: 650000, percentilTuDepto: 95 },
    poisTop: [
      { tipo: "metro", nombre: "Estación Quilicura", distancia: 1200 },
    ],
  });
  console.log("  ✓ zone-insight ok");

  const out = [
    { id: "1-quilicura-ltr",    item: "Item 12 — caveat ambidireccional", comuna: "Quilicura", plusv: 5.3,  output_kind: "LTR",          output: c1 },
    { id: "2-santiago-zone",    item: "Item 13 — 4% proyección motor",     comuna: "Santiago",  plusv: -1.1, output_kind: "zone-insight", output: c2 },
    { id: "3-sindata-zone",     item: "B4-1 — sin precioM2 mención",       comuna: "El Bosque", plusv: -0.7, output_kind: "zone-insight", output: c3 },
    { id: "4-quilicura-zone",   item: "B4-2 — anualizado vs acumulado",    comuna: "Quilicura", plusv: 5.3,  output_kind: "zone-insight", output: c4 },
  ];

  mkdirSync("audit/sesionB-items-combined", { recursive: true });
  writeFileSync("audit/sesionB-items-combined/_outputs.json", JSON.stringify(out, null, 2));
  console.log("\nOutputs → audit/sesionB-items-combined/_outputs.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
