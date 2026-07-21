// ============================================================================
// MUESTRA SEMÁNTICA · criterio-magnitud (§15) — LTR + STR, REPORT-ONLY
// ============================================================================
// Ejercita la superficie R1–R4 del audit anti-invención sobre una muestra de
// seeds golden, corriendo el juez V2 (REGLA ESPEJO: bloque-caso REAL capturado)
// con el nuevo criterio MAGNITUD. NO bloquea, NO persiste, NO toca prompts.
// Escribe un markdown para lectura de Fabrizio como criterio final.
//
//   R1 (STR instrumentos): largoPlazo ancla en datoDP/datoFM provistos.
//   R2 (LTR fondo mutuo):  largoPlazo no dice "más del doble" salvo razón real.
//   R4 (LTR patrimonio):   equity como monto único, sin descomponer.
//   ABSTENCIÓN:            si la razón NO viene provista → cita dos absolutos.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/magnitud-sample.ts
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { generateStrProse } from "../../../src/lib/ai-generation-str";
import {
  buildTruthBundle,
  captureGeneratorPrompt,
  captureStrPrompt,
  runJudgeV2,
  type JudgeResult,
} from "../judge";
import { GOLDEN_SEEDS } from "./seeds";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";

const MAG = "incoherencia-numerica-interna"; // categoría del criterio §15

interface CaseReport {
  modalidad: "LTR" | "STR";
  key: string;
  label: string;
  veredicto?: string;
  largoPlazo?: string;
  hallazgos: JudgeResult["hallazgos"];
  error?: string;
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Extrae el texto de largoPlazo de cualquiera de las dos formas (LTR/STR).
function largoPlazoText(ai: any): string {
  const lp = ai?.largoPlazo;
  if (!lp) return "";
  if (typeof lp === "string") return lp;
  return lp.contenido ?? lp.contenido_clp ?? JSON.stringify(lp).slice(0, 600);
}

async function runLtr(): Promise<CaseReport[]> {
  const client = sb();
  const out: CaseReport[] = [];
  for (const seed of GOLDEN_SEEDS) {
    try {
      const ai = await generateAiAnalysis(seed.uuid, client, { persist: false });
      if (!ai) { out.push({ modalidad: "LTR", key: seed.key, label: seed.nota ?? "", hallazgos: [], error: "generación devolvió null (¿seed en DB?)" }); continue; }
      const cap = await captureGeneratorPrompt(seed.uuid, client);
      const truthBundle = buildTruthBundle(seed.input.comuna, seed.input.lat ?? null, seed.input.lng ?? null, seed.mediana);
      const fixtureMeta = { id: seed.key, modalidad: "LTR", tier: "experto", ejes: seed.ejes, nota: seed.nota };
      const judge = await runJudgeV2({ fixtureMeta, aiAnalysis: ai, caseBlock: cap?.user ?? "", truthBundle });
      out.push({ modalidad: "LTR", key: seed.key, label: seed.nota ?? "", veredicto: (ai as any)?.veredicto, largoPlazo: largoPlazoText(ai), hallazgos: judge.hallazgos ?? [] });
    } catch (e: any) {
      out.push({ modalidad: "LTR", key: seed.key, label: seed.nota ?? "", hallazgos: [], error: e?.message ?? String(e) });
    }
  }
  return out;
}

async function runStr(): Promise<CaseReport[]> {
  const anthropic = new Anthropic();
  const frozen = loadFrozen();
  const out: CaseReport[] = [];
  for (const seed of STR_GE_SEEDS) {
    try {
      const r = recomputeStrSeed(seed, frozen);
      if (!r) { out.push({ modalidad: "STR", key: seed.key, label: seed.label, hallazgos: [], error: "sin fixture frozen" }); continue; }
      const fx = frozen[seed.key];
      const inp = fx.input_data as Record<string, unknown>;
      const comuna = (inp.comuna as string) || fx.comuna || "";
      const rForProse = { ...r.rec, francoScore: r.score, hallazgos: r.hz };
      const gen = await generateStrProse({ anthropic, inp, r: rForProse as any, comuna });
      const cap = await captureStrPrompt({ inp, r: rForProse, comuna });
      const fixtureMeta = { id: seed.key, modalidad: "STR", tier: "experto", ejes: seed.ejes, nota: seed.nota };
      const judge = await runJudgeV2({ fixtureMeta, aiAnalysis: gen.ai, caseBlock: cap?.user ?? "", truthBundle: {} });
      out.push({ modalidad: "STR", key: seed.key, label: seed.label, veredicto: (r.score as any)?.veredicto, largoPlazo: largoPlazoText(gen.ai), hallazgos: judge.hallazgos ?? [] });
    } catch (e: any) {
      out.push({ modalidad: "STR", key: seed.key, label: seed.label, hallazgos: [], error: e?.message ?? String(e) });
    }
  }
  return out;
}

function md(cases: CaseReport[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const totalMag = cases.reduce((n, c) => n + c.hallazgos.filter((h) => h.categoria === MAG).length, 0);
  const totalFlags = cases.reduce((n, c) => n + c.hallazgos.length, 0);
  const errs = cases.filter((c) => c.error).length;
  const L: string[] = [];
  L.push(`# Muestra semántica · criterio-magnitud (§15) — REPORT-ONLY`);
  L.push(``);
  L.push(`Generado: ${stamp} · casos: ${cases.length} (${cases.filter((c) => c.modalidad === "LTR").length} LTR + ${cases.filter((c) => c.modalidad === "STR").length} STR) · errores: ${errs}`);
  L.push(`Flags de MAGNITUD (\`${MAG}\`): **${totalMag}** · flags totales del juez: ${totalFlags}`);
  L.push(``);
  L.push(`Criterio: toda comparación verbal de magnitud ("el doble", "X veces", "N puntos") se verifica contra las dos cifras del bloque-caso REAL capturado (REGLA ESPEJO). Los flags NO bloquean; son lectura para Fabrizio. Cero magnitud-flags = el modelo respeta §15 (usa el múltiplo provisto o se abstiene y cita los dos absolutos).`);
  L.push(``);
  for (const c of cases) {
    L.push(`## ${c.modalidad} · ${c.key} — ${c.label}`);
    if (c.error) { L.push(`> ⚠️ ERROR: ${c.error}`); L.push(``); continue; }
    if (c.veredicto) L.push(`Veredicto: \`${c.veredicto}\``);
    const mag = c.hallazgos.filter((h) => h.categoria === MAG);
    L.push(`Magnitud-flags: **${mag.length}** · flags totales: ${c.hallazgos.length}`);
    if (c.largoPlazo) {
      L.push(``);
      L.push(`**largoPlazo (sitio R1/R2/R4):**`);
      L.push(`> ${c.largoPlazo.replace(/\n+/g, " ").slice(0, 700)}`);
    }
    if (c.hallazgos.length) {
      L.push(``);
      L.push(`| categoría | campo | sev | cita | porqué |`);
      L.push(`|---|---|---|---|---|`);
      for (const h of c.hallazgos) {
        const cita = (h.cita ?? "").replace(/\|/g, "/").slice(0, 80);
        const pq = (h.porQue ?? "").replace(/\|/g, "/").slice(0, 80);
        const mark = h.categoria === MAG ? `**${h.categoria}**` : h.categoria;
        L.push(`| ${mark} | ${h.campo ?? ""} | ${h.severidad ?? ""} | ${cita} | ${pq} |`);
      }
    }
    L.push(``);
  }
  return L.join("\n");
}

async function main() {
  console.log("── Muestra magnitud (§15) · LTR + STR · report-only ──");
  const ltr = await runLtr();
  const str = await runStr();
  const cases = [...ltr, ...str];
  const outDir = path.resolve(process.cwd(), "scripts/output");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(outDir, `muestra-magnitud-${stamp}.md`);
  fs.writeFileSync(file, md(cases), "utf8");
  const totalMag = cases.reduce((n, c) => n + c.hallazgos.filter((h) => h.categoria === MAG).length, 0);
  console.log(`  casos: ${cases.length} · magnitud-flags: ${totalMag} · errores: ${cases.filter((c) => c.error).length}`);
  console.log(`  markdown: ${file}`);
  process.exit(0);
}

if (process.argv[1] && /magnitud-sample\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error("FATAL", e); process.exit(1); });
}
