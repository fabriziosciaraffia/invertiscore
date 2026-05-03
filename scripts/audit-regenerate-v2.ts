/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Regenera los 3 análisis de auditoría con el prompt LTR v2:
 *   1. Backup del estado actual (results + ai_analysis) → audit/raw-backup-pre-v2.json
 *   2. Para cada ID: re-corre runAnalysis(input_data) para que results tenga
 *      financingHealth + engineSignal + francoVerdict (campos nuevos del refactor)
 *   3. Llama generateAiAnalysis(id) que usa el SYSTEM_PROMPT y USER_PROMPT v2
 *   4. Vuelca los nuevos outputs a audit/raw-dump-v2.json
 *
 * NO commitear este script.
 *   npx tsx scripts/audit-regenerate-v2.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Cargar env ANTES del dynamic import de ai-generation/analysis (que instancian
// `new Anthropic()` en module-load).
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

// Dynamic imports — se hacen dentro de main() para que el env esté ya cargado.
let runAnalysis: typeof import("../src/lib/analysis").runAnalysis;
let setUFValue: typeof import("../src/lib/analysis").setUFValue;
let generateAiAnalysis: typeof import("../src/lib/ai-generation").generateAiAnalysis;

// Filtra los IDs por env AUDIT_FILTER_VEREDICTOS (csv) si está seteado.
// Ej: AUDIT_FILTER_VEREDICTOS="COMPRAR" regenera solo el caso 1.
const ALL_IDS = [
  { veredicto: "COMPRAR",          id: "2aa47321-ec4c-4d4e-aac5-95689933105a" },
  { veredicto: "AJUSTA EL PRECIO", id: "671ed774-4873-41b2-92b2-66086dd0d841" },
  { veredicto: "BUSCAR OTRA",      id: "860f5607-d469-41f1-a6e8-6288b993fe8c" },
];

const filter = process.env.AUDIT_FILTER_VEREDICTOS;
const IDS = filter
  ? ALL_IDS.filter((c) => filter.split(",").map((s) => s.trim()).includes(c.veredicto))
  : ALL_IDS;

const RATE_LIMIT_MS = 3000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Faltan envs Supabase");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  // Dynamic import — env ya cargado, Anthropic client va a ver la key.
  const analysisMod = await import("../src/lib/analysis");
  const aiGenMod = await import("../src/lib/ai-generation");
  runAnalysis = analysisMod.runAnalysis;
  setUFValue = analysisMod.setUFValue;
  generateAiAnalysis = aiGenMod.generateAiAnalysis;

  const supabase = createClient(url, key);

  // ── Backup ────────────────────────────────────────────
  // Si ya existe el backup, NO lo sobrescribas (preserva el estado pre-v2 original).
  const backupPath = path.resolve(process.cwd(), "audit", "raw-backup-pre-v2.json");
  if (fs.existsSync(backupPath)) {
    console.log(`→ Backup ya existe en ${backupPath} — saltando step de backup.`);
  } else {
    console.log("→ Backup pre-v2 de los 3 análisis…");
    const backup: any[] = [];
    for (const c of IDS) {
      const { data, error } = await supabase
        .from("analisis")
        .select("id, results, ai_analysis")
        .eq("id", c.id)
        .single();
      if (error) {
        console.error(`Error backup ${c.id}:`, error);
        process.exit(1);
      }
      backup.push({ veredictoBuscado: c.veredicto, ...data });
    }
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`  Backup guardado en ${backupPath}`);
  }

  // ── Regenerate ────────────────────────────────────────
  for (const c of IDS) {
    console.log(`\n→ Regenerando [${c.veredicto}] ${c.id}`);

    const { data: row, error } = await supabase
      .from("analisis")
      .select("id, input_data, results")
      .eq("id", c.id)
      .single();
    if (error || !row) {
      console.error(`  Error fetch:`, error);
      continue;
    }
    const input = row.input_data;
    const oldResults = row.results as { metrics?: { precioCLP?: number } } | null;

    // Derivar UF del análisis original (preserva paridad numérica con v1)
    const ufImplicito = oldResults?.metrics?.precioCLP && input?.precio
      ? oldResults.metrics.precioCLP / input.precio
      : 38800;
    setUFValue(ufImplicito);
    console.log(`  UF set a ${ufImplicito}`);

    // 1. runAnalysis para regenerar results con financingHealth/engineSignal/francoVerdict
    const newResults = runAnalysis(input);
    console.log(`  runAnalysis: engineSignal=${(newResults as any).engineSignal} francoVerdict=${(newResults as any).francoVerdict} financingHealth.overall=${(newResults as any).financingHealth?.overall}`);

    // 2. Guardar nuevos results y limpiar ai_analysis viejo (para forzar regen)
    const { error: upErr } = await supabase
      .from("analisis")
      .update({ results: newResults, ai_analysis: null })
      .eq("id", c.id);
    if (upErr) {
      console.error(`  Error update results:`, upErr);
      continue;
    }

    // 3. generateAiAnalysis (lee el row recién actualizado)
    process.stdout.write(`  Llamando Claude IA v2… `);
    const aiResult = await generateAiAnalysis(c.id, supabase as any);
    if (aiResult) {
      console.log(`OK (francoVerdict=${(aiResult as any).francoVerdict}, reestructuracion=${(aiResult as any).reestructuracion ? "PRESENTE" : "ausente"})`);
    } else {
      console.log("FAIL");
    }

    await sleep(RATE_LIMIT_MS);
  }

  // ── Dump ──────────────────────────────────────────────
  console.log("\n→ Volcando outputs v2…");
  const out: any[] = [];
  for (const c of IDS) {
    const { data } = await supabase
      .from("analisis")
      .select("id, comuna, score, results, input_data, ai_analysis")
      .eq("id", c.id)
      .single();
    out.push({
      veredictoBuscado: c.veredicto,
      id: data?.id,
      comuna: data?.comuna,
      score: data?.score,
      precioUF: data?.input_data?.precio,
      superficie: data?.input_data?.superficie,
      engineSignal: data?.results?.engineSignal,
      francoVerdict: data?.results?.francoVerdict,
      financingHealth: data?.results?.financingHealth,
      ai_analysis: data?.ai_analysis,
    });
  }
  const dumpVersion = process.env.AUDIT_DUMP_VERSION || "v2";
  const dumpPath = path.resolve(process.cwd(), "audit", `raw-dump-${dumpVersion}.json`);
  fs.writeFileSync(dumpPath, JSON.stringify(out, null, 2));
  console.log(`  Dump guardado en ${dumpPath}`);
  console.log("\nListo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
