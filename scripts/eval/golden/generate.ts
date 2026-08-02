// ============================================================================
// GOLDEN SET — tier FULL · generación fresca AUTO (cuesta tokens)
// ============================================================================
// REGLA ESPEJO: valida la GENERACIÓN, no solo el recompute. Corre
// generateAiAnalysis(uuid, {persist:false}) K veces por caso GS (los BE son solo
// motor), captura los guards vía console.warn y aplica los checks automáticos
// A1-A8 del checklist (patrón/regex/conteo). Lo semántico va en semantic.ts.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF } from "./seeds";
import { gatherHallazgos, aperturaSource } from "./extract";
import type { Check } from "./invariants";
import type { SeedReport } from "./recompute";

// Espejo del monitor de ai-generation.ts:1452 (A4).
const ENGINE_ISM_RE = /flujo[^.]{0,30}(cruza|revier|invier|da vuelta|vuelve positivo|vuelve neutro)|flujo neutro|(el|del)\s+motor|proyecci[óo]n\s+del\s+motor|se\s+(equilibr|estabiliz|neutraliz|nivela)|conver[gj]|inflexi[óo]n|punto de quiebre/i;

const WORDS = (s: string) => (s.trim().match(/\S+/g) || []).length;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function collectStrings(node: any, out: { path: string; s: string }[], path = ""): void {
  if (typeof node === "string") { out.push({ path, s: node }); return; }
  if (Array.isArray(node)) { node.forEach((n, i) => collectStrings(n, out, `${path}[${i}]`)); return; }
  if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) collectStrings(v, out, path ? `${path}.${k}` : k);
}

async function captureWarns<T>(fn: () => Promise<T>): Promise<{ result: T; warns: string[] }> {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...args: any[]) => { warns.push(args.map(String).join(" ")); };
  try { const result = await fn(); return { result, warns }; }
  finally { console.warn = orig; }
}

export async function runGenerateTier(sb: SupabaseClient, K: number): Promise<SeedReport[]> {
  const reports: SeedReport[] = [];

  // --solo=GS-PC1,GS-PC2 → corre el tier AUTO solo sobre esos seeds (mismo
  // patrón --solo del regen STR del paquete B). Sin flag: todos.
  const soloArg = process.argv.find((a) => a.startsWith("--solo="));
  const solo = soloArg ? new Set(soloArg.slice("--solo=".length).split(",").map((s) => s.trim())) : null;
  const seedsARecorrer = solo ? GOLDEN_SEEDS.filter((s) => solo.has(s.key)) : GOLDEN_SEEDS;

  for (const seed of seedsARecorrer) {
    const checks: Check[] = [];
    // Fuente de la apertura para A1: #1 por decisividad pura entre los 6 builders
    // (NO la corona adverso-first de la pirámide — divergen cuando un favorable
    // tiene la mayor decisividad, ej. GS-2 cap_rate). Espejo de ai-generation.ts.
    const recomputed = runAnalysis(seed.input, GOLDEN_UF, seed.mediana);
    const apSrc = aperturaSource(gatherHallazgos(recomputed));
    const coronaFrase = apSrc ? norm(apSrc.fraseCanonica) : "";
    const vmFrancoUF = seed.input.valorMercadoFranco || seed.input.precio;
    const vmSolido = Math.abs(vmFrancoUF - seed.input.precio) * GOLDEN_UF > 1_000_000;
    const maxTotal = 85; // presupuesto Plan C (apertura + continuación)
    // A6 · EXCEPCIÓN PIE CERO (decisión de Fabrizio, 2026-08-02): con pie 0 la
    // doctrina `## 5.bis` del system agrega una capa explicativa DELIBERADA
    // (estructura 100% + vacancia en plata) que el presupuesto Plan C no
    // contempló; su prosa ya fue aprobada en pixel review. Techo propio, no
    // pase libre: calibrado sobre K=6 medidos en GS-PC1 (87·92·95·104·105·121)
    // → máximo 121 + ~15% de holgura = 140. Sobre eso sigue fallando.
    //
    // MEDIDO (no borrar — evita re-diagnosticar): la causa PRÓXIMA del desborde
    // no es el pie sino la APERTURA FIJA LARGA. GS-PC2 también es pie 0, activa
    // la misma doctrina y no desborda (74-88, PLANC nunca se rinde), igual que
    // el control GS-1 con pie 20% (79-87). En GS-PC1 la fraseCanonica del flujo
    // "fuerte" deja solo 48 palabras de continuación (vs ~60-65 con apertura de
    // cap_rate) y el modelo entrega 50-84 en 6/6 corridas. Si algún día un seed
    // con pie > 0 y apertura "fuerte" desborda, este condicional NO lo cubre —
    // y debe fallar: ahí la conversación es acortar esa fraseCanonica (builder)
    // o escalar el techo por longitud de apertura.
    const seedSinPie = (recomputed as unknown as { metrics?: { pieCLP?: number } }).metrics?.pieCLP === 0;
    const techoA6 = seedSinPie ? 140 : maxTotal * 1.15;

    let genOk = 0;
    const failCounts: Record<string, number> = {};
    const bump = (rule: string) => { failCounts[rule] = (failCounts[rule] ?? 0) + 1; };

    for (let run = 0; run < K; run++) {
      const { result: ai, warns } = await captureWarns(() => generateAiAnalysis(seed.uuid, sb, { persist: false }));
      if (!ai) { bump("gen.null"); continue; }
      genOk++;
      const strings = ((): { path: string; s: string }[] => { const o: { path: string; s: string }[] = []; collectStrings(ai, o); return o; })();
      const rd = norm(ai.conviene?.respuestaDirecta_clp ?? "");

      // A1 (HARD) — apertura == RESPUESTA al veredicto + fraseCanonica del #1 (una moneda).
      // El contrato cambió: el motor antepone la respuesta ("Conviene." / "No conviene." /
      // "Todavía no: tienes que ajustar los supuestos.") antes de la apertura fija, para que
      // la primera línea conteste la pregunta que el usuario hizo. El check verifica AMBAS
      // piezas y en ese orden — es más estricto que el anterior, no menos: antes bastaba con
      // que la fraseCanonica estuviera al inicio; ahora además la respuesta tiene que estar
      // y la fraseCanonica tiene que seguirla.
      const RESPUESTAS_VEREDICTO = [
        "Todavía no: tienes que ajustar los supuestos.",
        "Conviene, con una condición.",
        "No conviene.",
        "Conviene.",
      ];
      const respUsada = RESPUESTAS_VEREDICTO.find((r) => rd.startsWith(r));
      if (!respUsada) {
        bump("A1.apertura");
      } else if (coronaFrase) {
        const resto = rd.slice(respUsada.length).trim();
        if (!resto.startsWith(coronaFrase.slice(0, Math.min(40, coronaFrase.length)))) bump("A1.apertura");
      }

      // A2 (HARD) — fabricación de cifra de zona: el flag interno _catchRootAFlag se
      // setea SOLO si la fabricación sobrevivió los reintentos (robusto, no parsea logs).
      if ((ai as any)._catchRootAFlag === true) bump("A2.catch-root-a");

      // A5 (HARD) — §9 en conviene.cajaAccionable presente y con sustancia.
      if (WORDS(ai.conviene?.cajaAccionable_clp ?? "") < 8) bump("A5.§9-cajaAccionable");

      // A6 (HARD) — presupuesto Plan C: apertura + continuación ≤ 85 (+15% tolerancia
      // del guard). Con pie 0 rige `techoA6` = 140 (ver la excepción calibrada arriba).
      if (WORDS(rd) > techoA6) bump("A6.presupuesto");

      // A7·D2 (HARD) — break-even sin negar VM cuando VM es sólido.
      if (vmSolido) {
        const neg = norm(ai.negociacion?.contenido_clp ?? "");
        if (/no hay (comparables|un valor de mercado|suficientes|valor de mercado)/i.test(neg)) bump("A7.D2-niega-VM");
      }

      // A8·D1 (HARD) — largoPlazo compara con instrumentos (depósito/fondo).
      const lp = norm(ai.largoPlazo?.contenido_clp ?? "");
      if (lp && !/(dep[óo]sito a plazo|fondo mutuo)/i.test(lp)) bump("A8.D1-instrumentos");

      // ── Checks pie-0 (GS-PC* · fase 4, aprobados 2026-08-01) — doctrina ## 5.bis ──
      if (seed.key.startsWith("GS-PC")) {
        const todo = strings.map((x) => x.s).join(" || ");
        // A-PC1 (HARD) — nombra la estructura sin eufemismos y sin celebración:
        // financiamiento + 100% presentes; "pie bajo", "infinit", "espectacular"
        // y múltiplos ×N prohibidos.
        const nombra = /financi/i.test(todo) && /100\s*%/.test(todo);
        const celebra = /pie\s+bajo/i.test(todo) || /infinit/i.test(todo) || /espectacular/i.test(todo) || /×\s*\d/.test(todo);
        if (!nombra || celebra) bump("A-PC1.doctrina-100pct");
        // A-PC2 (HARD) — el escenario de vacancia aparece en ALGÚN campo de la
        // prosa (## 5.bis.b manda narrarlo pero NO fija campo: la generación real
        // lo ubica donde el análisis lo pide — largoPlazo, costoMensual,
        // reestructuracion...). Scope global a propósito.
        if (!/vacancia/i.test(todo)) bump("A-PC2.vacancia");
        // A-PC3 (PC2 · flujo positivo) — HARD: prohibido narrar el flujo positivo
        // como retorno sobre capital. SOFT: presencia de la lectura correcta
        // "aguanta/sostiene su (propio) financiamiento" (fraseo estocástico —
        // guardrail positivo vive en el system; acá solo se reporta la tasa).
        if (seed.key === "GS-PC2") {
          // Prohibida la CELEBRACIÓN, no la mención: la doctrina misma manda
          // negar el retorno sobre capital ("no hay capital que rente"). Un match
          // SIN negación en la ventana previa = atribución/celebración → HARD.
          const reRetorno = /(rentabilidad|retorno)\s+(sobre|de|del)\s+(tu\s+|su\s+)?(capital|pie)/gi;
          let celebra = false;
          for (const mt of todo.matchAll(reRetorno)) {
            const prev = todo.slice(Math.max(0, (mt.index ?? 0) - 70), mt.index ?? 0);
            if (!/\bno\b|\bni\b|\bnunca\b|\bsin\b/i.test(prev)) { celebra = true; break; }
          }
          if (celebra) bump("A-PC3.retorno-sobre-capital");
          // Lectura correcta del flujo positivo — el modelo la parafrasea
          // legítimamente ("se financia sola desde el día uno"): soft, reporta tasa.
          if (!/(aguanta|sostiene|banca)[^.]{0,80}financiamiento|financia\s+sola|paga\s+su\s+propio\s+(cr[eé]dito|financiamiento)/i.test(todo)) bump("~aguanta-lectura");
        }
      }

      // SOFT (reporta TASA, NO bloquea) — detectores de FRASEO estocásticos. El producto
      // mismo trata engine-ism como detección no-bloqueante; hard-gatear sobre variación
      // rara del LLM (engine-ism ~1/6 runs) volvería flaky al golden. Una REGRESIÓN de
      // código dispara la tasa (ej. 5/6) y se ve. [ZONA-DRIFT] se confunde con el
      // arriendo-en-UF; los strippers PLANC auto-corrigen. "mediana de la zona" para el
      // ARRIENDO es legítimo (la mediana COMUNAL determinística la cubre el recompute).
      if (strings.some((x) => ENGINE_ISM_RE.test(x.s))) bump("~engine-ism");
      if (warns.some((w) => w.includes("[ZONA-DRIFT]"))) bump("~zona-drift");
      if (warns.some((w) => /\[PLANC-(DUAL|REPEAT)-STRIPPED\]/.test(w))) bump("~planc-stripped");
    }

    // Consolidar. Regla dura falla si falló en ≥1 run; soft (~) reporta sin bloquear.
    checks.push({ rule: `gen.runs(K=${K})`, pass: genOk === K, detail: `${genOk}/${K} generaciones OK` });
    const HARD = ["A1.apertura", "A2.catch-root-a", "A5.§9-cajaAccionable", "A6.presupuesto", "A7.D2-niega-VM", "A8.D1-instrumentos", "A-PC1.doctrina-100pct", "A-PC2.vacancia", "A-PC3.retorno-sobre-capital", "gen.null"];
    const SOFT = ["~engine-ism", "~zona-drift", "~planc-stripped", "~aguanta-lectura"];
    for (const r of HARD) {
      const c = failCounts[r] ?? 0;
      if (c > 0) checks.push({ rule: r, pass: false, detail: `falló ${c}/${K} runs` });
    }
    for (const r of SOFT) {
      const c = failCounts[r] ?? 0;
      if (c > 0) checks.push({ rule: r, pass: false, rebaseline: true, detail: `${c}/${K} runs (soft — guard ruidoso, no bloquea)` });
    }
    if (checks.filter((c) => !c.pass).length === 0) checks.push({ rule: "AUTO", pass: true, detail: `todos los checks AUTO verdes (K=${K})` });

    const hardFail = checks.filter((c) => !c.pass && !c.rebaseline).length;
    const soft = checks.filter((c) => !c.pass && c.rebaseline).length;
    reports.push({ key: seed.key, checks, hardFail, rebaseline: soft });
  }
  return reports;
}
