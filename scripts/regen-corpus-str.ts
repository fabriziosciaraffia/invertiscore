// regen-corpus-str.ts — regen-corpus-str · F2/F3.
// Regeneración unificada del corpus STR: normaliza motor (factorADR=1), re-ensambla la
// pirámide (results.hallazgos N≤12) y — solo para las filas que YA tenían ai_analysis —
// regenera prosa fresca (REGLA ESPEJO: prompt derivado del motor RECOMPUTADO).
//
// FUENTE: input_data + results.airbnbRaw PERSISTIDOS. NUNCA re-fetch AirROI (Decisión 2).
// PATH ANTI-HOOKS: service-role sb.update directo → no cobra crédito, no dispara email/Resend
//   (auditado F1). No usa la ruta HTTP (que llama consumeCredit + corta por caché).
//
// Modos:
//   --dry      : recompute de las 46, verifica invariante en memoria (factorADR=1, veredicto
//                canónico, hallazgos N). NO llama Claude. NO persiste. Imprime tabla.
//   --muestra  : recompute + prosa FRESCA de las filas con ai_analysis (source-determinism) →
//                regen-corpus-str-muestra.md. Llama Claude. NO persiste en DB.
//   --go       : regen real. Persiste results+score+desglose+resumen en las 46; ai_analysis
//                fresco solo en las 20 con prosa previa. Throttle + reintentos + log por fila.
//
// Uso: node --env-file=.env.local --import tsx scripts/regen-corpus-str.ts --dry
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { calcShortTerm } from "../src/lib/engines/short-term-engine";
import type { ShortTermResult, STRVerdict } from "../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../src/lib/engines/short-term-score";
import type { FrancoScoreSTR } from "../src/lib/engines/short-term-score";
import { buildStrHallazgos } from "../src/lib/str-hallazgos";
import { buildAirbnbData } from "../src/lib/api-helpers/analisis-pipeline";
import { getComunaMedianaVentaUF } from "../src/lib/comuna-stats";
import { generateStrProse } from "../src/lib/ai-generation-str";
import type { AIAnalysisSTRv2 } from "../src/lib/types";
config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CANONICOS = new Set<STRVerdict>(["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── buildInputs: idéntico al pipeline (analisis-pipeline.ts:496-526) y golden str-recompute ──
function buildInputs(d: any, airbnbData: any, uf: number) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: typeof d.comuna === "string" ? d.comuna : undefined, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100,
    plazoCredito: d.plazoCredito, airbnbData, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador,
    tipoEdificio: d.tipoEdificio, habilitacion: d.habilitacion, adminPro: d.adminPro === true,
    adrOverride: typeof d.adrOverride === "number" ? d.adrOverride : null, occOverride: typeof d.occOverride === "number" ? d.occOverride : null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf,
  };
}

interface RecomputeOut { rec: ShortTermResult; score: FrancoScoreSTR; hallazgos: any[]; newResults: any; uf: number; }

// Recompute forward-only + ensamble de pirámide. Espeja buildShortTermAnalysisRow SIN re-fetch.
async function recompute(d: any, oldResults: any, comuna: string): Promise<RecomputeOut> {
  const uf = d.precioCompra / d.precioCompraUF;
  const airbnbData = buildAirbnbData(oldResults.airbnbRaw, uf); // EXPORTADO, misma transformación que prod
  const rec = calcShortTerm(buildInputs(d, airbnbData, uf) as any);
  const lat = typeof d.lat === "number" ? d.lat : -33.4378;
  const lng = typeof d.lng === "number" ? d.lng : -70.6504;
  const score = calcFrancoScoreSTR({
    results: rec, precioCompra: d.precioCompra, dormitorios: d.dormitorios, superficie: d.superficieUtil,
    regulacionEdificio: d.edificioPermiteAirbnb || "no_seguro", lat, lng,
    revenueP50: airbnbData.percentiles.revenue.p50, monthlyRevenue: airbnbData.monthly_revenue,
  } as any);
  // mediana comunal real (sobreprecio) — mismo helper que el prefetch del pipeline.
  let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
  try { mediana = await getComunaMedianaVentaUF(sb, comuna, d.superficieUtil, d.dormitorios ?? null, uf); } catch { /* cae a null → sobreprecio omitido, patrón LTR */ }
  const strHallazgos = buildStrHallazgos({
    result: rec, francoScore: score, comuna: comuna || "", precioUF: d.precioCompraUF, superficieM2: d.superficieUtil,
    piePct: d.piePct, tasaPct: d.tasaInteres, plazoAnios: d.plazoCredito, mediana, valorUF: uf, incluyeCorretaje: false,
  });
  const hallazgos = [...(rec.hallazgos ?? []), ...strHallazgos];
  const newResults = {
    ...rec,
    hallazgos,
    tipoAnalisis: "short-term",
    veredicto: score.veredicto,
    francoScore: score,
    airbnbRaw: oldResults.airbnbRaw, // preservar el raw persistido (NO re-fetch)
    ...(oldResults.ocupacionRealizadaComparables ? { ocupacionRealizadaComparables: oldResults.ocupacionRealizadaComparables } : {}),
  };
  return { rec, score, hallazgos, newResults, uf };
}

// ── generarProsa: usa el orquestador compartido (mismo prompt v3 + guards que
// producción, vía generateStrProse). `leaks` = HARD drift residual (revenue /
// ramp-up / "el|del motor"); si >0 la prosa NO se persiste (invariante del regen).
// Los engine-isms SOFT son detección-only y NO bloquean persistencia (paridad LTR). ──
async function generarProsa(inp: any, newResults: any, comuna: string): Promise<{ ai: AIAnalysisSTRv2; leaks: number }> {
  const gen = await generateStrProse({ anthropic, inp, r: newResults, comuna });
  return { ai: gen.ai, leaks: gen.hardDriftHits.length };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry"), muestra = args.includes("--muestra"), go = args.includes("--go");
  if (!dry && !muestra && !go) { console.error("Especificá --dry | --muestra | --go"); process.exit(1); }

  const { data: rows, error } = await sb.from("analisis")
    .select("id, nombre, user_id, comuna, input_data, results, ai_analysis, created_at")
    .eq("tipo_analisis", "short-term").order("created_at", { ascending: true }).range(0, 999);
  if (error) { console.error(error); process.exit(1); }
  // Exclusiones explícitas (⛔#2, decisión Fabrizio) — NO se persisten (ni results ni prosa):
  //  · 4ea0b582 — LTR ingreso bruto $0 → LTR_PREFERIDO diferencial 3483% ininterpretable;
  //    ventaja_vs_ltr (dim DECISIVA) cargaría un decisivo basura. A investigación aparte (LTR $0).
  //  · c53331bf — base occ 74% + ADR 93993 vienen de occOverride/adrOverride, pero occFuente="observada"
  //    → la prosa presentaría un override manual como "mediana observada de la zona" (no fiel). Bug de
  //    etiquetado del motor a ticket aparte.
  const EXCLUDE_PREFIXES = ["4ea0b582", "c53331bf"];
  const isExcluded = (id: string) => EXCLUDE_PREFIXES.some((p) => id.startsWith(p));
  // Solo las recomputables: con input_data + airbnbRaw persistido (excluye 8e006a8 sin insumos, Decisión F1)
  // y las exclusiones semánticas de ⛔#2.
  const recomputables = (rows ?? []).filter((r) => {
    const d = r.input_data as any, res = r.results as any;
    return d?.precioCompra && d?.precioCompraUF && res?.airbnbRaw && !isExcluded(r.id);
  });
  const excluidas = (rows ?? []).filter((r) => !recomputables.includes(r));
  console.log(`\nCorpus: ${rows?.length} · recomputables: ${recomputables.length} · excluidas: ${excluidas.length} [${excluidas.map((e) => e.id.slice(0, 8)).join(", ")}]`);

  // ── DRY: invariante en memoria ──────────────────────────────────────────
  if (dry) {
    const tabla: any[] = [];
    let violaciones = 0;
    for (const r of recomputables) {
      const { rec, score, hallazgos } = await recompute(r.input_data, r.results, r.comuna as string);
      const factor = rec.ejesAplicados?.factorADRTotal;
      const factorOK = Number.isFinite(factor) && Math.abs(factor! - 1) < 1e-6;
      const verOK = CANONICOS.has(score.veredicto);
      const N = hallazgos.length;
      const nOK = N >= 7 && N <= 12;
      if (!factorOK || !verOK || !nOK) violaciones++;
      tabla.push({ id: r.id.slice(0, 8), comuna: r.comuna, factorADR: Number.isFinite(factor) ? +factor!.toFixed(3) : factor, veredicto: score.veredicto, N, ok: factorOK && verOK && nOK ? "✓" : "✗" });
    }
    console.table(tabla);
    const nDist: Record<number, number> = {};
    for (const t of tabla) nDist[t.N] = (nDist[t.N] || 0) + 1;
    console.log(`\n=== INVARIANTE DRY (${recomputables.length} filas) ===`);
    console.log(`  factorADR=1 · veredicto canónico · N∈[7,12]: ${violaciones === 0 ? "TODAS ✓" : `${violaciones} violaciones ✗`}`);
    console.log(`  distribución N (hallazgos):`, nDist);
    return;
  }

  // Filas con prosa previa (Decisión F1: prosa fresca SOLO donde ya existía).
  const conProsa = recomputables.filter((r) => r.ai_analysis && typeof r.ai_analysis === "object");
  console.log(`Con ai_analysis previo (reciben prosa fresca): ${conProsa.length}`);

  // ── MUESTRA: prosa fresca de las filas con prosa → md (NO persiste) ──────
  if (muestra) {
    const outPath = path.resolve(process.cwd(), "regen-corpus-str-muestra.md");
    const jsonPath = path.resolve(process.cwd(), "scripts/output/regen-str-muestra-full-20260710.json");
    const parts: string[] = [`# Muestra semántica — regen STR v3 (prosa fresca, drawer-profundiza)\n`, `> Generada con motor RECOMPUTADO desde airbnbRaw persistido. ${conProsa.length} filas con prosa previa. NO persistido. Prompt v3 + guards (strip eco card↔drawer, drift, presupuestos) vía generateStrProse.\n`];
    const fullDump: any[] = [];
    let i = 0;
    for (const r of conProsa) {
      i++;
      process.stdout.write(`[${i}/${conProsa.length}] ${r.id.slice(0, 8)} prosa... `);
      try {
        const { newResults, score } = await recompute(r.input_data, r.results, r.comuna as string);
        const oldVer = (r.results as any)?.francoScore?.veredicto ?? (r.results as any)?.veredicto ?? "(null)";
        const { ai, leaks } = await generarProsa(r.input_data, newResults, r.comuna as string);
        const a = ai as any;
        fullDump.push({ id: r.id, comuna: r.comuna, oldVer, newVer: score.veredicto, leaks, ai });
        parts.push(`\n---\n\n## ${r.id.slice(0, 8)} · ${r.comuna} · veredicto ${oldVer} → **${score.veredicto}**${leaks ? ` · ⚠️ DRIFT(${leaks})` : ""}\n`);
        if (a.conviene) { parts.push(`**conviene · respuestaDirecta:** ${a.conviene.respuestaDirecta ?? "—"}\n`); parts.push(`**conviene · veredictoFrase:** ${a.conviene.veredictoFrase ?? "—"}\n`); parts.push(`**conviene · reencuadre:** ${a.conviene.reencuadre ?? "—"}\n`); parts.push(`**conviene · cajaAccionable:** ${a.conviene.cajaAccionable ?? "—"}\n`); }
        if (a.rentabilidad?.contenido) parts.push(`**rentabilidad:** ${a.rentabilidad.contenido}${a.rentabilidad.cajaAccionable ? `\n_caja:_ ${a.rentabilidad.cajaAccionable}` : ""}\n`);
        if (a.vsLTR?.contenido) parts.push(`**vsLTR:** ${a.vsLTR.contenido}${a.vsLTR.estrategiaSugerida ? `\n_estrategia:_ ${a.vsLTR.estrategiaSugerida}` : ""}${a.vsLTR.cajaAccionable ? `\n_caja:_ ${a.vsLTR.cajaAccionable}` : ""}\n`);
        if (a.operacion?.contenido) parts.push(`**operacion:** ${a.operacion.contenido}\n`);
        if (a.largoPlazo?.contenido) parts.push(`**largoPlazo:** ${a.largoPlazo.contenido}${a.largoPlazo.cajaAccionable ? `\n_caja:_ ${a.largoPlazo.cajaAccionable}` : ""}\n`);
        if (a.riesgos?.contenido) parts.push(`**riesgos:** ${a.riesgos.contenido}\n`);
        if (a.riesgos?.cajaAccionable) parts.push(`**cajaAccionable (§9):** ${a.riesgos.cajaAccionable}\n`);
        if (a.francoCaveat) parts.push(`_francoCaveat (audit-only, no render):_ ${a.francoCaveat}\n`);
        console.log(`ok${leaks ? ` ⚠️revenue(${leaks})` : ""}`);
      } catch (e: any) { console.log("FAIL", e.message); parts.push(`\n---\n\n## ${r.id.slice(0, 8)} — FALLO: ${e.message}\n`); }
      await sleep(1000);
    }
    fs.writeFileSync(outPath, parts.join("\n"));
    fs.writeFileSync(jsonPath, JSON.stringify(fullDump, null, 2));
    const totalLeaks = fullDump.reduce((s, d) => s + (d.leaks || 0), 0);
    console.log(`\n[muestra] → ${outPath}  ·  full JSON → ${jsonPath}`);
    console.log(`[muestra] filas=${fullDump.length} · leaks residuales de "revenue": ${totalLeaks}`);
    return;
  }

  // ── GO: regen real (results 46 + prosa 20), throttle + reintentos + log ──
  if (go) {
    const CONC = 4;
    const log: any[] = [];
    let idx = 0;
    async function worker() {
      while (idx < recomputables.length) {
        const r = recomputables[idx++];
        const oldVer = (r.results as any)?.francoScore?.veredicto ?? (r.results as any)?.veredicto ?? "(null)";
        try {
          const { newResults, score } = await recompute(r.input_data, r.results, r.comuna as string);
          const update: any = { results: newResults, score: score.score, desglose: score.desglose, resumen: score.veredicto };
          const debeProsa = conProsa.includes(r);
          let prosaStatus = "sin-prosa";
          if (debeProsa) {
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                // generarProsa ya reintenta hasta 3× por fuga de "revenue" y devuelve la más limpia.
                const { ai, leaks } = await generarProsa(r.input_data, newResults, r.comuna as string);
                if (leaks === 0) { update.ai_analysis = ai; prosaStatus = "prosa-ok"; }
                // Guard invariante: prosa con "revenue" residual NO se persiste (results/hallazgos sí).
                else { prosaStatus = `prosa-FAIL-REVENUE(${leaks})`; }
                lastErr = null; break;
              } catch (e: any) { lastErr = e; await sleep(1000 * attempt * attempt); }
            }
            if (lastErr) prosaStatus = `prosa-FAIL:${lastErr.message}`;
          }
          const { error: upErr } = await sb.from("analisis").update(update).eq("id", r.id);
          if (upErr) throw upErr;
          log.push({ id: r.id.slice(0, 8), comuna: r.comuna, antes: oldVer, despues: score.veredicto, flip: oldVer !== score.veredicto ? "⚡" : "=", N: newResults.hallazgos.length, prosa: prosaStatus, ok: prosaStatus.startsWith("prosa-FAIL") ? "⚠" : "✓" });
        } catch (e: any) {
          log.push({ id: r.id.slice(0, 8), comuna: r.comuna, antes: oldVer, despues: "FAIL", flip: "?", N: 0, prosa: "-", ok: `✗ ${e.message}` });
        }
        await sleep(300);
      }
    }
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    console.table(log);
    const fails = log.filter((l) => l.ok.startsWith("✗"));
    const prosaFails = log.filter((l) => l.prosa.startsWith("prosa-FAIL"));
    const prosaLeaks = log.filter((l) => l.prosa.startsWith("prosa-FAIL-REVENUE"));
    console.log(`\n=== GO RESUMEN ===`);
    console.log(`  filas persistidas (results): ${log.length - fails.length}/${recomputables.length} · fails: ${fails.length}`);
    console.log(`  prosa fresca ok: ${log.filter((l) => l.prosa === "prosa-ok").length}/${conProsa.length} · prosa API-fail: ${prosaFails.length} · prosa NO persistida por "revenue": ${prosaLeaks.length}`);
    if (fails.length) console.log(`  FAILS:`, fails.map((f) => `${f.id}:${f.ok}`).join(" · "));
    if (prosaFails.length) console.log(`  PROSA API-FAILS:`, prosaFails.map((f) => f.id).join(" · "));
    if (prosaLeaks.length) console.log(`  ⚠️ PROSA NO PERSISTIDA (revenue residual tras 3×3 intentos):`, prosaLeaks.map((f) => f.id).join(" · "));
    fs.writeFileSync(path.resolve(process.cwd(), "scripts/output/regen-str-go-log-20260710.json"), JSON.stringify(log, null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
