// ============================================================================
// GOLDEN SET STR — tier FULL · generación fresca AUTO (BLOQUEANTE, cuesta tokens)
// ============================================================================
// Refuerzo 1 de FASE 2 (rediseño Dictamen): hasta ahora la única generación STR
// del golden eran las 2 llamadas NO-bloqueantes del tier modo-gestión (ambas
// sobre GE-1). Un cambio de prompt STR podía romper la estructura de la prosa
// sin que el runner lo viera. Este tier es el espejo de generate.ts (LTR):
// genera prosa fresca sobre los seis GE K veces y aplica checks AUTO duros que
// SÍ aportan a totalHard.
//
// Checks duros:
//   AS1  respuestaDirecta con sustancia (≥15 palabras)
//   AS2  cajaAccionable de conviene con sustancia (≥8 palabras — espejo A5 LTR)
//   AS3  tokens `**` balanceados en TODA la prosa (invariante de marcas: los
//        sanitizers recortan por oración y un par que cruce el punto queda impar)
//   AS4  titular renderizable (≤15 palabras, una marca)
//   AS5  ninguna oración del lead COPIA una fraseCanonica (run común ≥ 60% de la
//        frase, mínimo 8 palabras) — misma regla que A1 en LTR (copia-frase.ts).
//        Desde la decisividad real (03-sep-2026) el coronado cambia en 2 de cada 3
//        informes; la frase del hallazgo se queda en la card, el lead la redacta.
//   gen.null  la generación devolvió algo (sin umbral de mayoría: un null es
//        un problema real siempre)
//
// JUEZ (opcional, `judge: true` — el runner lo pasa salvo --no-semantic): cada
// corrida pasa por runJudgeV2 con el bloque-caso REAL (captureStrPrompt) y un
// criterio adicional: el lead de `conviene.respuestaDirecta` abre por el HALLAZGO
// CORONADO (§7.bis), con la excepción B-extendida (coronado = ventaja vs LTR ⇒ abre
// por el bolsillo absoluto). Los flags son REPORTE para Fabrizio, no bloquean —
// igual que el juez LTR (tiene falsos positivos).
//
// Umbral de MAYORÍA para las reglas de prosa (AS*), igual que generate.ts: con
// K=2 falla solo si fallan las dos corridas — una variación aislada del modelo
// se declara pero no bloquea; una regresión de código es sistemática y se caza.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateStrProse } from "../../../src/lib/ai-generation-str";
import { marcasBalanceadas, evaluarTitular } from "../../../src/lib/prosa-marcas";
import { ordenarHallazgosPiramideSTR } from "../../../src/lib/piramide-orden-str";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";
import { frasesCanonicasDe, oracionQueCopia } from "../../../src/lib/copia-frase";
import { buildTruthBundle, captureStrPrompt, runJudgeV2 } from "../judge";
import type { Check } from "./invariants";
import type { SeedReport } from "./recompute";

const WORDS = (s: string) => (s.trim().match(/\S+/g) || []).length;

// Los seis GE reales del corpus: dos veredictos dominantes (GE-1 COMPRAR, GE-2 AJUSTA),
// el gate de regulación (GE-3), LTR-negativo (GE-4), ocupación fallback (GE-5) y ADR
// legacy (GE-6). GE-PC y GE-PJ son síntesis de GE-1/GE-2 y no generan: cubren motor.
export const STR_GEN_SEEDS = ["GE-1", "GE-2", "GE-3", "GE-4", "GE-5", "GE-6"] as const;

/** Lo que la tanda muestra por seed: el coronado real, el lead que escribió el modelo y
 *  lo que dijo el juez. Se imprime aparte de los checks para leerlo de corrido. */
export interface TandaStr {
  key: string;
  veredicto: string;
  score: number;
  coronadoId: string | null;
  coronadoTitular: string | null;
  lead: string;
  flags: Array<{ categoria: string; severidad: string; detalle: string }>;
  error?: string;
}

const CRITERIO_LEAD_CORONADO = `LEAD-CORONADO (categoria: "lead-coronado", severidad alta). El bloque-caso trae la sección "HALLAZGO QUE LIDERA LA PIRÁMIDE" (el coronado) con su titular y su frase. \`conviene.respuestaDirecta\` es el lead del hero y DEBE abrir por ese hallazgo: su primera oración (después de la respuesta al veredicto, si la hay) habla del mismo tema que el coronado — la ocupación, la rentabilidad operativa, el precio contra la mediana, el flujo, la estructura del crédito — aunque lo diga con otras palabras y otra cifra. EXCEPCIÓN ÚNICA: si el coronado es la ventaja frente al arriendo largo (favorable o adversa), el lead NO abre por la comparación sino por el bolsillo absoluto del usuario (el flujo mensual del escenario base); en ese caso marca lead-coronado solo si abre por otra cosa distinta del bolsillo. Marca lead-coronado cuando el lead abre por un tema distinto del coronado (o del bolsillo en la excepción); en "cita" copia la primera oración del lead y en "porQue" nombra el coronado y por qué el lead no lo toca.
COPIA-CARD (categoria: "copia-card", severidad media). Si alguna oración de \`conviene.respuestaDirecta\` reproduce la frase del coronado o de otra card casi literal (misma estructura, mismas cifras, mismo orden), márcalo: la frase del hallazgo vive en la card; el lead la redacta con su ángulo, no la repite.`;

function collectStrings(node: any, out: { path: string; s: string }[], path = ""): void {
  if (typeof node === "string") { out.push({ path, s: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, out, `${path}[${i}]`)); return; }
  if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) collectStrings(v, out, path ? `${path}.${k}` : k);
}

export async function runStrGenerateTier(
  K: number,
  opts: {
    dump?: string;
    judge?: boolean;
    /** Solo estos seeds (default: los seis). */
    seeds?: readonly string[];
    /** Reutiliza las generaciones dumpeadas en `<from>/<key>-str-run<n>.json` en vez de
     *  generar: los checks y el juez miran LA MISMA prosa contra el recompute ACTUAL
     *  (motor, mediana y coronado de hoy). Espejo del --from de LTR. */
    from?: string;
  } = {},
): Promise<{ reports: SeedReport[]; tanda: TandaStr[] }> {
  const anthropic = new Anthropic();
  const frozen = loadFrozen();
  const reports: SeedReport[] = [];
  const tanda: TandaStr[] = [];
  if (opts.dump) mkdirSync(opts.dump, { recursive: true });
  const seeds = (opts.seeds ?? STR_GEN_SEEDS).filter((k) => (STR_GEN_SEEDS as readonly string[]).includes(k));

  for (const key of seeds) {
    const seed = STR_GE_SEEDS.find((s) => s.key === key);
    const checks: Check[] = [];
    if (!seed || !frozen[key]) {
      checks.push({ rule: "gen.seed", pass: false, detail: `sin seed/fixture frozen para ${key}` });
      reports.push({ key: `${key}-gen`, checks, hardFail: 1, rebaseline: 0 });
      continue;
    }

    let genOk = 0;
    const failCounts: Record<string, number> = {};
    const bump = (rule: string) => { failCounts[rule] = (failCounts[rule] ?? 0) + 1; };
    const detalles: string[] = [];

    for (let run = 0; run < K; run++) {
      const t0 = Date.now();
      process.stderr.write(`      · ${key}-gen run ${run + 1}/${K}…`);
      try {
        const r = recomputeStrSeed(seed, frozen);
        if (!r) throw new Error("recompute devolvió null");
        const rForProse = { ...r.rec, francoScore: r.score, hallazgos: r.hz };
        const comuna = (frozen[key].input_data.comuna as string) || "";
        const coronado = ordenarHallazgosPiramideSTR(r.hz)[0] ?? null;
        const archivo = opts.from ? join(opts.from, `${key}-str-run${run}.json`) : null;
        let ai: any;
        if (archivo && existsSync(archivo)) {
          ai = (JSON.parse(readFileSync(archivo, "utf-8")) as { result: any }).result;
          process.stderr.write(` (dump)\n`);
        } else {
          const gen = await generateStrProse({ anthropic, inp: frozen[key].input_data, r: rForProse as any, comuna });
          process.stderr.write(` ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
          ai = gen.ai;
        }
        if (!ai) { bump("gen.null"); continue; }
        genOk++;
        const lead: string = ai.conviene?.respuestaDirecta ?? "";

        // AS1 — el lead del hero existe y tiene sustancia.
        if (WORDS(lead) < 15) bump("AS1.respuestaDirecta");
        // AS2 — posición/acción de cierre del hero presente (espejo A5 LTR).
        if (WORDS(ai.conviene?.cajaAccionable ?? "") < 8) bump("AS2.§9-cajaAccionable");
        // AS3 — invariante de marcas sobre TODOS los strings de la prosa final
        // (post-sanitizers: generateStrProse ya aplicó stripCardEcho y guards).
        const strings: { path: string; s: string }[] = [];
        collectStrings(ai, strings);
        const desbalance = strings.find((x) => !marcasBalanceadas(x.s));
        if (desbalance) bump("AS3.marcas-balanceadas");
        // AS4 — DOS NIVELES (decisión PARÁ 3, espejo A9): duro = renderizable;
        // 16-20 palabras = soft ~titular-largo-renderizado.
        const evTit = evaluarTitular(ai.titular);
        if (evTit.nivel === "invalido") bump("AS4.titular");
        if (evTit.nivel === "largo_renderizable") bump("~titular-largo-renderizado");
        // AS5 — ninguna oración del lead copia una fraseCanonica (regla A1 de LTR).
        const copia = oracionQueCopia(lead, frasesCanonicasDe(r.hz));
        if (copia) { bump("AS5.copia-fraseCanonica"); detalles.push(`AS5 run ${run + 1}: «${copia.slice(0, 120)}»`); }
        // Métricas BLANDAS del titular (decisión PARÁ 2) — espejo LTR.
        if (ai.titular === null) bump("~titular-null");
        const nucleoTit = typeof ai.titular === "string" ? (ai.titular.match(/\*\*([\s\S]+?)\*\*/)?.[1] ?? "") : "";
        if ((nucleoTit.trim().match(/\S+/g) || []).length > 7) bump("~titular-nucleo-largo");

        if (opts.dump) {
          writeFileSync(join(opts.dump, `${key}-str-run${run}.json`), JSON.stringify({
            key, run, veredicto: r.score.veredicto, score: r.score.score,
            coronado: coronado ? { id: coronado.id, titular: coronado.titular, fraseCanonica: coronado.fraseCanonica, decisividad: coronado.decisividad } : null,
            piramide: r.hz.map((h) => ({ id: h.id, decisividad: h.decisividad, direccion: h.direccion })),
            result: ai,
          }, null, 2), "utf-8");
        }

        // JUEZ — solo la primera corrida (K=1 en la tanda; con K>1 juzgar todas duplica tokens
        // sin cambiar el veredicto del reporte).
        if (opts.judge && run === 0) {
          const t: TandaStr = {
            key, veredicto: r.score.veredicto, score: r.score.score,
            coronadoId: coronado?.id ?? null, coronadoTitular: coronado?.titular ?? null, lead, flags: [],
          };
          try {
            const cap = await captureStrPrompt({ inp: frozen[key].input_data, r: rForProse, comuna });
            const inp = frozen[key].input_data as Record<string, unknown>;
            const truthBundle = buildTruthBundle(
              comuna,
              typeof inp.lat === "number" ? inp.lat : null,
              typeof inp.lng === "number" ? inp.lng : null,
              r.mediana,
            );
            const judge = await runJudgeV2({
              fixtureMeta: { id: key, modalidad: "STR", tier: "experto", ejes: seed.ejes, nota: seed.nota },
              aiAnalysis: ai,
              caseBlock: cap?.user ?? "",
              truthBundle,
              criteriosExtra: CRITERIO_LEAD_CORONADO,
            });
            t.flags = (judge.hallazgos ?? []).map((h) => ({
              categoria: h.categoria, severidad: h.severidad,
              detalle: `${h.campo}: ${h.porQue} — "${(h.cita ?? "").slice(0, 110)}"`,
            }));
          } catch (e) {
            t.error = String((e as Error)?.message ?? e);
          }
          tanda.push(t);
        }
      } catch (e) {
        process.stderr.write(` ERROR ${String((e as Error)?.message ?? e).slice(0, 80)}\n`);
        bump("gen.null");
      }
    }

    checks.push({ rule: `gen.runs(K=${K})`, pass: genOk === K, detail: `${genOk}/${K} generaciones OK` });
    const HARD = ["AS1.respuestaDirecta", "AS2.§9-cajaAccionable", "AS3.marcas-balanceadas", "AS4.titular", "AS5.copia-fraseCanonica", "gen.null"];
    const SOFT = ["~titular-null", "~titular-nucleo-largo", "~titular-largo-renderizado"];
    const esReglaDeProsa = (r: string) => r.startsWith("AS");
    const umbralMayoria = Math.floor(K / 2);
    for (const r of HARD) {
      const c = failCounts[r] ?? 0;
      const limite = esReglaDeProsa(r) ? umbralMayoria : 0;
      const det = detalles.filter((d) => d.startsWith(r.slice(0, 3))).join(" · ");
      if (c > limite) checks.push({ rule: r, pass: false, detail: `falló ${c}/${K} runs${det ? ` — ${det}` : ""}` });
      else if (c > 0) console.log(`      · ${key}-gen ${r}: falló ${c}/${K} runs — bajo el umbral de mayoría, no bloquea${det ? ` — ${det}` : ""}`);
    }
    for (const r of SOFT) {
      const c = failCounts[r] ?? 0;
      if (c > 0) checks.push({ rule: r, pass: false, rebaseline: true, detail: `${c}/${K} runs (soft — métrica blanda, no bloquea)` });
    }
    if (checks.filter((c) => !c.pass).length === 0) checks.push({ rule: "AUTO-STR", pass: true, detail: `checks AUTO STR verdes (K=${K})` });

    const hardFail = checks.filter((c) => !c.pass && !c.rebaseline).length;
    const soft = checks.filter((c) => !c.pass && c.rebaseline).length;
    reports.push({ key: `${key}-gen`, checks, hardFail, rebaseline: soft });
  }
  return { reports, tanda };
}

// Ejecución directa (standalone): `--k=N` (default 1), `--judge`, `--dump=<dir>`,
// `--seeds=GE-1,GE-4` (solo esos) y `--from=<dir>` (re-chequea un dump sin generar).
// El runner lo importa vía runStrGenerateTier() dentro de --full.
if (process.argv[1] && /str-generate\.ts$/.test(process.argv[1])) {
  const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const K = Math.max(1, parseInt(arg("k") ?? "1", 10) || 1);
  const seedsArg = arg("seeds")?.split(",").map((x) => x.trim()).filter(Boolean);
  runStrGenerateTier(K, { dump: arg("dump"), from: arg("from"), seeds: seedsArg, judge: process.argv.includes("--judge") }).then(({ reports, tanda }) => {
    let hard = 0;
    for (const r of reports) {
      console.log(`\n  ${r.hardFail > 0 ? "✗ FAIL" : "✓ PASS"}  ${r.key}`);
      for (const c of r.checks) console.log(`      ${c.pass ? "✓" : "✗"} ${c.rule}${c.detail ? ` — ${c.detail}` : ""}`);
      hard += r.hardFail;
    }
    for (const t of tanda) {
      console.log(`\n  ${t.key} ${t.veredicto}/${t.score} · 01 ${t.coronadoId}\n    lead: ${t.lead}`);
      for (const fl of t.flags) console.log(`    ⚑ [${fl.severidad}/${fl.categoria}] ${fl.detalle}`);
      if (t.error) console.log(`    ⚠ juez: ${t.error}`);
    }
    process.exit(hard === 0 ? 0 : 1);
  }).catch((e) => { console.error("FATAL", e); process.exit(1); });
}
