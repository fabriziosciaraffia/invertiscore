/**
 * Probe v_new (post-iteración REGLA 10) para Sesión B3 H7 final.
 *
 * Re-corre los 3 casos críticos del audit anterior con la REGLA 10 reforzada:
 * - Ñuñoa (3,2% — borderline original que disparó la iteración)
 * - Santiago (-1,1% — más sensible, verificar no over-corrige al alza)
 * - Quilicura (5,3% — histórica > 4%, verificar no over-corrige al alza)
 *
 * Patrón: insertar análisis sintético en Supabase con runAnalysis del motor
 * actual, llamar generateAiAnalysis (LTR) + Anthropic directo (zone-insight),
 * volcar outputs a audit/sesionB3-h7-final/_outputs.json, limpiar la fila.
 *
 * Uso: node --env-file=.env.local --import tsx scripts/audit-b3h7-final-probe.ts
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "fs";
import { runAnalysis } from "../src/lib/analysis";
import { generateAiAnalysis } from "../src/lib/ai-generation";
import { INSIGHT_SYSTEM_PROMPT } from "../src/app/api/analisis/[id]/zone-insight/route";
import { PLUSVALIA_HISTORICA } from "../src/lib/plusvalia-historica";
import type { AnalisisInput } from "../src/lib/types";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const anthropic = new Anthropic();
const UF_CLP = 40213;

interface Caso {
  id: string;
  comuna: string;
  plusvHistAnual: number;
  nota: string;
}

const casos: Caso[] = [
  { id: "1-nunoa",     comuna: "Ñuñoa",     plusvHistAnual: 3.2,  nota: "Histórica positiva moderada — borderline original" },
  { id: "2-santiago",  comuna: "Santiago",  plusvHistAnual: -1.1, nota: "Histórica NEGATIVA — caso más sensible" },
  { id: "3-quilicura", comuna: "Quilicura", plusvHistAnual: 5.3,  nota: "Histórica POSITIVA ALTA (>4%) — control over-corrección" },
];

function makeInput(comuna: string): AnalisisInput {
  // Input fijo, comuna varía. Mismas cifras que el probe v_old.
  return {
    nombre: `PROBE_B3H7_FINAL_${comuna}`,
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

async function correrZoneInsight(comuna: string, plusvHistAnual: number): Promise<string> {
  // Reproduce el shape de userPrompt usado por route.ts pero con POIs sintéticos
  // y stats fijos. Variable única: comuna + plusvHistAnual.
  const userPrompt = `Comuna: ${comuna}
Tipo: análisis LTR (arriendo de largo plazo)

Atractores cercanos (los más relevantes por distancia):
- METRO: Estación Test (320 m)
- UNIVERSIDADES: Universidad Test (600 m)
- COLEGIOS: Colegio Test (450 m)

Contexto financiero del depto (usar solo montos presentes acá):
- Arriendo estimado: $1.200.000 / UF 29,8
- Rango comparable arriendo: $850.000–$1.450.000 / UF 21,1–UF 36,1
- Percentil de tu arriendo dentro del rango: P72
- Precio m² tu depto: UF 100,0 (mediana ${comuna}: UF 96,0, +4,0%)
- Plusvalía histórica anualizada ${comuna}: ${plusvHistAnual}%

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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function main() {
  console.log("Probe v_new B3 H7 final — 3 casos críticos");
  console.log("Verificando que comunas estén en PLUSVALIA_HISTORICA...");
  for (const c of casos) {
    const data = PLUSVALIA_HISTORICA[c.comuna];
    if (!data || data.anualizada !== c.plusvHistAnual) {
      console.error(`✗ ${c.comuna}: esperado ${c.plusvHistAnual}, encontrado ${data?.anualizada ?? "null"}`);
      process.exit(1);
    }
    console.log(`  ✓ ${c.comuna}: ${data.anualizada}% anualizada`);
  }

  const out: Array<{ id: string; comuna: string; plusvHistAnual: number; nota: string; ltr: string; zone: string }> = [];

  for (const c of casos) {
    console.log(`\n[${c.id}] ${c.comuna} (${c.plusvHistAnual}%) — ${c.nota}`);

    // 1. Computar results vía runAnalysis
    const input = makeInput(c.comuna);
    const results = runAnalysis(input, UF_CLP);

    // 2. Insertar análisis sintético
    const { data: inserted, error: insertErr } = await sb
      .from("analisis")
      .insert({
        nombre: input.nombre,
        comuna: input.comuna,
        ciudad: input.ciudad,
        direccion: input.direccion,
        tipo: input.tipo,
        dormitorios: input.dormitorios,
        banos: input.banos,
        superficie: input.superficie,
        antiguedad: input.antiguedad,
        precio: input.precio * UF_CLP,
        arriendo: input.arriendo,
        gastos: input.gastos,
        contribuciones: input.contribuciones,
        score: results.score,
        desglose: results.desglose,
        resumen: results.resumen ?? "Probe sintético — borrar.",
        results,
        input_data: input,
        is_premium: true,
        user_id: null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      console.error("  ✗ Insert falló:", insertErr);
      process.exit(1);
    }
    const tmpId = inserted.id as string;
    console.log(`  ✓ Inserted tmp id ${tmpId}`);

    try {
      // 3. LTR via generateAiAnalysis (escribe ai_analysis en la fila tmp)
      console.log("  → llamando generateAiAnalysis...");
      const ltr = await generateAiAnalysis(tmpId, sb);
      const ltrText = JSON.stringify(ltr, null, 2);
      console.log(`  ✓ LTR ok (${ltrText.length} chars)`);

      // 4. Zone-insight via Anthropic directo
      console.log("  → llamando Anthropic zone-insight...");
      const zone = await correrZoneInsight(c.comuna, c.plusvHistAnual);
      console.log(`  ✓ zone-insight ok (${zone.length} chars)`);

      out.push({ id: c.id, comuna: c.comuna, plusvHistAnual: c.plusvHistAnual, nota: c.nota, ltr: ltrText, zone });
    } finally {
      // 5. Delete tmp row siempre
      const { error: delErr } = await sb.from("analisis").delete().eq("id", tmpId);
      if (delErr) console.error("  ⚠️ Delete falló:", delErr);
      else console.log(`  ✓ Deleted tmp ${tmpId}`);
    }
  }

  mkdirSync("audit/sesionB3-h7-final", { recursive: true });
  writeFileSync("audit/sesionB3-h7-final/_outputs.json", JSON.stringify(out, null, 2));
  console.log("\nOutputs guardados en audit/sesionB3-h7-final/_outputs.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
