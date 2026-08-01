// ============================================================================
// EVALUADOR EDITORIAL — runner (Fase 1)
// ============================================================================
// Recibe IDs de análisis de prod, ensambla cada informe como pieza de lectura
// (ensamblar.ts) y lo pasa por el juez editorial (juez.ts, rúbrica RUBRICA.md).
// Solo mide: NO escribe nada en la base, NO corrige informes.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/eval/editorial/evaluar.ts --ids id1,id2,...
//   node --env-file=.env.local --import tsx scripts/eval/editorial/evaluar.ts --muestra muestra.json
//   Flags: --dry (solo ensambla e imprime el informe, sin llamar al juez)
//          --out <dir> (default: scripts/eval/editorial/out)
//
// Output por informe: out/<id8>.json (fallas + usage + ms) y out/<id8>.informe.txt
// (el ensamblado exacto que vio el juez, para auditar el instrumento).
// Resumen final: tabla por caso + costo total.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { ensamblarInforme, type FilaAnalisis } from "./ensamblar";
import { buildSystemPrompt, evaluarInforme, leerRubrica, EVAL_MODEL, type EvalEditorial } from "./juez";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const dry = args.includes("--dry");
const outDir = flag("out") ?? path.join(__dirname, "out");

// Precios API por MTok (claude-opus-4-8) — solo para el reporte de costo.
const PRECIO_IN_USD_MTOK = 15;
const PRECIO_OUT_USD_MTOK = 75;

async function main() {
  let ids: string[] = [];
  const idsArg = flag("ids");
  const muestraArg = flag("muestra");
  if (idsArg) ids = idsArg.split(",").map((s) => s.trim()).filter(Boolean);
  else if (muestraArg) {
    const m = JSON.parse(readFileSync(path.resolve(muestraArg), "utf-8"));
    ids = Array.isArray(m) ? m : m.ids;
  }
  if (ids.length === 0) {
    console.error("Especificá --ids id1,id2,... o --muestra archivo.json");
    process.exit(1);
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  mkdirSync(outDir, { recursive: true });
  const systemPrompt = buildSystemPrompt(leerRubrica());

  const resumen: Array<{
    id8: string; tipo: string; veredicto: string; pv: number | null;
    altas: number; medias: number; bajas: number; ms: number;
    tokIn: number; tokOut: number; error?: string;
  }> = [];

  for (const id of ids) {
    const { data: row, error } = await sb
      .from("analisis")
      .select("id, comuna, created_at, tipo_analisis, input_data, results, ai_analysis, mediana_comuna_snapshot, zone_insight, guest_insight")
      .eq("id", id)
      .single();
    if (error || !row) {
      console.error(`✗ ${id.slice(0, 8)}: no se pudo leer (${error?.message ?? "sin fila"})`);
      resumen.push({ id8: id.slice(0, 8), tipo: "?", veredicto: "?", pv: null, altas: 0, medias: 0, bajas: 0, ms: 0, tokIn: 0, tokOut: 0, error: error?.message ?? "sin fila" });
      continue;
    }

    let informe;
    try {
      informe = ensamblarInforme(row as FilaAnalisis);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error(`✗ ${id.slice(0, 8)}: ensamblado falló — ${msg}`);
      resumen.push({ id8: id.slice(0, 8), tipo: "?", veredicto: "?", pv: null, altas: 0, medias: 0, bajas: 0, ms: 0, tokIn: 0, tokOut: 0, error: msg });
      continue;
    }

    writeFileSync(path.join(outDir, `${informe.meta.id8}.informe.txt`), informe.texto, "utf-8");
    if (dry) {
      console.log(`── ${informe.meta.id8} (${informe.meta.tipo} · ${informe.meta.veredicto}) — ${informe.texto.length} chars, ${informe.piezas} piezas`);
      continue;
    }

    let ev: EvalEditorial;
    try {
      ev = await evaluarInforme({ systemPrompt, meta: informe.meta, informeTexto: informe.texto });
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error(`✗ ${id.slice(0, 8)}: juez falló — ${msg}`);
      resumen.push({ id8: informe.meta.id8, tipo: informe.meta.tipo, veredicto: informe.meta.veredicto, pv: informe.meta.promptVersion, altas: 0, medias: 0, bajas: 0, ms: 0, tokIn: 0, tokOut: 0, error: msg });
      continue;
    }

    writeFileSync(path.join(outDir, `${informe.meta.id8}.json`), JSON.stringify({ meta: informe.meta, ...ev }, null, 2), "utf-8");

    const altas = ev.fallas.filter((f) => f.severidad === "alta").length;
    const medias = ev.fallas.filter((f) => f.severidad === "media").length;
    const bajas = ev.fallas.filter((f) => f.severidad === "baja").length;
    resumen.push({
      id8: informe.meta.id8, tipo: informe.meta.tipo, veredicto: informe.meta.veredicto, pv: informe.meta.promptVersion,
      altas, medias, bajas, ms: ev._ms ?? 0,
      tokIn: ev._usage?.input_tokens ?? 0, tokOut: ev._usage?.output_tokens ?? 0,
    });

    console.log(`\n═══ ${informe.meta.id8} · ${informe.meta.tipo} · ${informe.meta.veredicto} · pv=${informe.meta.promptVersion} ═══`);
    console.log(`  ${ev.resumen}`);
    for (const f of ev.fallas) {
      console.log(`  [dim ${f.dimension} · ${f.severidad.toUpperCase()} · ${f.pieza}] ${f.explicacion}`);
      console.log(`      "${f.cita.slice(0, 140)}"`);
    }
    if (ev.fallas.length === 0) console.log("  (limpio)");
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  if (!dry) {
    const totIn = resumen.reduce((a, r) => a + r.tokIn, 0);
    const totOut = resumen.reduce((a, r) => a + r.tokOut, 0);
    const totMs = resumen.reduce((a, r) => a + r.ms, 0);
    const usd = (totIn / 1e6) * PRECIO_IN_USD_MTOK + (totOut / 1e6) * PRECIO_OUT_USD_MTOK;
    console.log(`\n══════════ RESUMEN (${resumen.length} informes · modelo ${EVAL_MODEL}) ══════════`);
    console.log("id8      tipo veredicto        pv  A  M  B    seg   tokIn tokOut");
    for (const r of resumen) {
      console.log(
        `${r.id8} ${r.tipo.padEnd(4)} ${r.veredicto.padEnd(16)} ${String(r.pv ?? "-").padStart(2)} ${String(r.altas).padStart(2)} ${String(r.medias).padStart(2)} ${String(r.bajas).padStart(2)} ${(r.ms / 1000).toFixed(1).padStart(6)} ${String(r.tokIn).padStart(7)} ${String(r.tokOut).padStart(6)}${r.error ? "  ✗ " + r.error : ""}`,
      );
    }
    console.log(`\nTotales: ${totIn} tok in · ${totOut} tok out · ${(totMs / 1000).toFixed(0)}s juez · ~USD ${usd.toFixed(2)} (${(usd / Math.max(1, resumen.filter((r) => !r.error).length)).toFixed(3)}/informe)`);
    writeFileSync(path.join(outDir, "_resumen.json"), JSON.stringify(resumen, null, 2), "utf-8");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
