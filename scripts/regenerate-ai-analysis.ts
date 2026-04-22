/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Regenerates ai_analysis for existing analyses using the new JSON structure.
 *
 * Usage:
 *   npx tsx scripts/regenerate-ai-analysis.ts
 *   npx tsx scripts/regenerate-ai-analysis.ts --dry-run
 *   npx tsx scripts/regenerate-ai-analysis.ts --ids=id1,id2,id3
 *   npx tsx scripts/regenerate-ai-analysis.ts --dry-run --ids=id1,id2
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { generateAiAnalysis, hasNewAiStructure } from "../src/lib/ai-generation";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const RATE_LIMIT_MS = 2000;

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const idsArg = args.find((a) => a.startsWith("--ids="));
  const ids = idsArg ? idsArg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean) : null;
  return { dryRun, ids };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { dryRun, ids } = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let query = supabase.from("analisis").select("id, ai_analysis, nombre, comuna").order("created_at", { ascending: false });
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }
  const { data: rows, error } = await query;

  if (error) {
    console.error("Error fetching analyses:", error);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("No hay análisis para procesar.");
    return;
  }

  const toRegenerate = rows.filter((r: any) => r.ai_analysis !== null && !hasNewAiStructure(r.ai_analysis));
  const alreadyNew = rows.filter((r: any) => hasNewAiStructure(r.ai_analysis));
  const noAi = rows.filter((r: any) => r.ai_analysis === null);

  console.log(`Total análisis en scope: ${rows.length}`);
  console.log(`  - Con estructura NUEVA (skip): ${alreadyNew.length}`);
  console.log(`  - Sin ai_analysis (skip, se generará on-demand): ${noAi.length}`);
  console.log(`  - Con estructura VIEJA (se regenerarán): ${toRegenerate.length}`);

  if (dryRun) {
    console.log("\n--dry-run: no se ejecuta nada. IDs que se regenerarían:");
    for (const r of toRegenerate) {
      console.log(`  ${r.id}  ${r.nombre || "(sin nombre)"}  ${r.comuna || ""}`);
    }
    return;
  }

  if (toRegenerate.length === 0) {
    console.log("Nada que regenerar.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < toRegenerate.length; i++) {
    const r: any = toRegenerate[i];
    const label = `[${i + 1}/${toRegenerate.length}] ${r.id} (${r.comuna || "?"})`;
    process.stdout.write(`${label} ... `);
    try {
      const result = await generateAiAnalysis(r.id, supabase as any);
      if (result && hasNewAiStructure(result)) {
        ok++;
        console.log("OK");
      } else {
        fail++;
        console.log("FAIL (null o estructura incorrecta)");
      }
    } catch (e) {
      fail++;
      console.log("FAIL", (e as Error).message);
    }
    if (i < toRegenerate.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`\nListo. Exitosos: ${ok}. Fallidos: ${fail}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
