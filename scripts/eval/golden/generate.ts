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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateAiAnalysis } from "../../../src/lib/ai-generation";
import { runAnalysis } from "../../../src/lib/analysis";
import { TECHO_CONTINUACION_DURO } from "../../../src/lib/prosa-presupuesto";
import { marcasBalanceadas, evaluarTitular } from "../../../src/lib/prosa-marcas";
import { GOLDEN_SEEDS, GOLDEN_UF } from "./seeds";
import { gatherHallazgos, aperturaSource } from "./extract";
import type { Check } from "./invariants";
import type { SeedReport } from "./recompute";

// Espejo del monitor de ai-generation.ts:1452 (A4).
const ENGINE_ISM_RE = /flujo[^.]{0,30}(cruza|revier|invier|da vuelta|vuelve positivo|vuelve neutro)|flujo neutro|(el|del)\s+motor|proyecci[óo]n\s+del\s+motor|se\s+(equilibr|estabiliz|neutraliz|nivela)|conver[gj]|inflexi[óo]n|punto de quiebre/i;

const WORDS = (s: string) => (s.trim().match(/\S+/g) || []).length;
// Helpers de copia de fraseCanonica: módulo compartido con la tanda STR (copia-frase.ts).
import { norm, wordsOf, sentencesOf, esCopia, REPITE_FRASE } from "./copia-frase";

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

/**
 * `dump`: escribe cada generación en `<dump>/<key>-run<N>.json` ({ ai, warns }) para
 * que otros instrumentos (juez, auditorías) corran sobre LAS MISMAS salidas.
 * `from`: en vez de generar, lee esos archivos (misma tanda, cero tokens).
 */
export async function runGenerateTier(sb: SupabaseClient, K: number, opts: { dump?: string; from?: string } = {}): Promise<SeedReport[]> {
  if (opts.dump) mkdirSync(opts.dump, { recursive: true });
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
    const todosHallazgos = gatherHallazgos(recomputed);
    const apSrc = aperturaSource(todosHallazgos);
    const coronaFrase = apSrc ? norm(apSrc.fraseCanonica) : "";
    const frasesCanonicas = todosHallazgos.map((h) => wordsOf(norm(String(h.fraseCanonica ?? "")))).filter((w) => w.length >= REPITE_FRASE);
    const vmFrancoUF = seed.input.valorMercadoFranco || seed.input.precio;
    const vmSolido = Math.abs(vmFrancoUF - seed.input.precio) * GOLDEN_UF > 1_000_000;
    // A6 · TECHO ESCALADO (fuente única: src/lib/prosa-presupuesto.ts). El techo NO
    // es plano: la continuación tiene presupuesto propio y el total escala con lo que
    // el motor antepone (respuesta al veredicto + apertura fija). Se computa por seed
    // desde las MISMAS piezas determinísticas que usa ai-generation.
    //
    // MURIÓ el techo de emergencia 140 del pie 0. Existía porque el guard PLANC no
    // enforzaba (aceptaba lo que hubiera tras 2 reintentos) y GS-PC1 desbordaba
    // sistemático; ahora el guard recorta por oración y el desborde no puede llegar
    // acá. Su comentario además diagnosticaba mal: culpaba a una "apertura fija larga"
    // de flujo_mensual que en realidad mide 35 palabras contra las 40 de cap_rate —
    // GS-PC1 desbordaba con MÁS presupuesto que su control, no con menos.
    const techoContinuacion = TECHO_CONTINUACION_DURO;

    let genOk = 0;
    // Uso REAL del presupuesto por corrida. No es un check: es la evidencia que hace
    // auditable la calibración de CONTINUACION_MAX. Un techo que nadie mide vuelve a
    // ser doctrina muerta — acá se ve si la prosa se infla o si vive pegada al techo.
    const totalesWC: number[] = [];
    const failCounts: Record<string, number> = {};
    const bump = (rule: string) => { failCounts[rule] = (failCounts[rule] ?? 0) + 1; };

    for (let run = 0; run < K; run++) {
      // Progreso a stderr (console.warn está interceptado por captureWarns durante la
      // generación). Este tier tarda minutos por corrida y hasta acá no emitía NADA
      // hasta terminar el seed entero: sin esta línea, un run colgado y uno lento se
      // ven exactamente igual.
      const t0 = Date.now();
      process.stderr.write(`      · ${seed.key} run ${run + 1}/${K}…`);
      const archivo = (dir: string) => join(dir, `${seed.key}-run${run}.json`);
      const { result: ai, warns } = opts.from && existsSync(archivo(opts.from))
        ? (JSON.parse(readFileSync(archivo(opts.from), "utf-8")) as { result: any; warns: string[] })
        : await captureWarns(() => generateAiAnalysis(seed.uuid, sb, { persist: false }));
      if (opts.dump) writeFileSync(archivo(opts.dump), JSON.stringify({ result: ai, warns }, null, 2), "utf-8");
      process.stderr.write(` ${((Date.now() - t0) / 1000).toFixed(0)}s${opts.from ? " (desde dump)" : ""}\n`);
      if (!ai) { bump("gen.null"); continue; }
      genOk++;
      const strings = ((): { path: string; s: string }[] => { const o: { path: string; s: string }[] = []; collectStrings(ai, o); return o; })();
      const rd = norm(ai.conviene?.respuestaDirecta_clp ?? "");

      // A1 (HARD) — v18: la respuestaDirecta EMPIEZA con la respuesta al veredicto
      // ("Conviene." / "No conviene." / "Todavía no: tienes que ajustar los supuestos."),
      // que el motor antepone, y NINGUNA de sus oraciones COPIA una fraseCanonica (run
      // común ≥ 60% de la frase, mínimo 8 palabras): la apertura ya no es prefabricada — el modelo escribe la razón
      // que manda en su voz y la frase del hallazgo se queda en la card.
      const RESPUESTAS_VEREDICTO = [
        "Todavía no: tienes que ajustar los supuestos.",
        "Conviene, con una condición.",
        "No conviene.",
        "Conviene.",
      ];
      const respUsada = RESPUESTAS_VEREDICTO.find((r) => rd.startsWith(r));
      if (!respUsada) {
        bump("A1.apertura");
      } else if (sentencesOf(rd).some((o) => { const w = wordsOf(o); return frasesCanonicas.some((f) => esCopia(w, f)); })) {
        bump("A1.apertura");
      }

      // A2 (HARD) — fabricación de cifra de zona: el flag interno _catchRootAFlag se
      // setea SOLO si la fabricación sobrevivió los reintentos (robusto, no parsea logs).
      if ((ai as any)._catchRootAFlag === true) bump("A2.catch-root-a");

      // A5 (HARD) — §9 en conviene.cajaAccionable presente y con sustancia.
      if (WORDS(ai.conviene?.cajaAccionable_clp ?? "") < 8) bump("A5.§9-cajaAccionable");

      // A6 (HARD) — presupuesto escalado (v18): el techo TOTAL no cambió — respuesta del
      // motor + presupuesto de la primera oración (lo que medía la fraseCanonica del #1,
      // que ya no se antepone) + continuación con TECHO_CONTINUACION_DURO. Se mide la
      // respuestaDirecta COMPLETA. Si A1 falló y no sabemos qué respuesta se usó, se asume
      // la más larga (7 palabras) para no cobrarle a A6 una falla que es de A1.
      const fijoWC = (respUsada ? WORDS(respUsada) : 7) + WORDS(coronaFrase);
      totalesWC.push(WORDS(rd));
      if (WORDS(rd) > fijoWC + techoContinuacion) bump("A6.presupuesto");

      // A7·D2 (HARD) — break-even sin negar VM cuando VM es sólido.
      if (vmSolido) {
        const neg = norm(ai.negociacion?.contenido_clp ?? "");
        if (/no hay (comparables|un valor de mercado|suficientes|valor de mercado)/i.test(neg)) bump("A7.D2-niega-VM");
      }

      // A8·D1 (HARD) — largoPlazo compara con instrumentos (depósito/fondo).
      // Acepta el PLURAL ("depósitos a plazo", "fondos mutuos"): es la forma
      // natural en español y el matcher literal en singular la rechazaba, o sea
      // podía cobrar una falla por gramática y no por doctrina. NO se aceptan
      // categorías como "renta fija": nombran el género, no el instrumento, y
      // aflojarían justo lo que la regla protege (la comparación concreta del
      // Ángulo 3). El prompt pide el instrumento por su nombre — ai-generation.ts:627.
      const lp = norm(ai.largoPlazo?.contenido_clp ?? "");
      if (lp && !/(dep[óo]sitos?\s+a\s+plazo|fondos?\s+mutuos?)/i.test(lp)) bump("A8.D1-instrumentos");

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

      // A9 (HARD) — titular §18 presente y bien formado (validarTitular, fuente
      // única con el guard de generación: ≤15 palabras, exactamente un par `**`
      // con núcleo ≤7, sin montos en moneda). Es la clase "campo nuevo ausente"
      // del contrato FASE 2: si el prompt deja de emitirlo o el guard lo anula
      // sistemáticamente, esto se pone rojo.
      // A9 (HARD) — DOS NIVELES (decisión PARÁ 3): el duro exige un titular
      // RENDERIZABLE (evaluarTitular ≠ invalido: presente, sin montos, ≤20
      // palabras). El estricto ≤15+un-par pasa a medirse como soft
      // ~titular-largo-renderizado cuando cae en 16-20.
      const evTit = evaluarTitular((ai as any).titular);
      if (evTit.nivel === "invalido") bump("A9.titular");
      if (evTit.nivel === "largo_renderizable") bump("~titular-largo-renderizado");
      // Métricas BLANDAS del titular (decisión PARÁ 2, 25-ago): tasa de núcleos
      // sobre las 7 palabras (regla de prompt, no de check) y de titular null
      // (el fallback del retry) — visibles en cada FULL, sin bloquear.
      if ((ai as any).titular === null) bump("~titular-null");
      const nucleoTit = typeof (ai as any).titular === "string" ? ((ai as any).titular.match(/\*\*([\s\S]+?)\*\*/)?.[1] ?? "") : "";
      if ((nucleoTit.trim().match(/\S+/g) || []).length > 7) bump("~titular-nucleo-largo");

      // A10 (HARD) — tokens `**` balanceados en toda la prosa final (FASE 2
      // dictamen · refuerzo 3): los sanitizers recortan por ORACIÓN entera
      // (PLANC-BUDGET-TRIM, PLANC-DUAL-STRIPPED) y un par de destacador que
      // cruce el punto queda mutilado en un `**` impar. Verde trivial mientras
      // el prompt no emita marcas; caza la clase entera cuando las emita.
      if (strings.some((x) => !marcasBalanceadas(x.s))) bump("A10.marcas-balanceadas");

      // SOFT (reporta TASA, NO bloquea) — detectores de FRASEO estocásticos. El producto
      // mismo trata engine-ism como detección no-bloqueante; hard-gatear sobre variación
      // rara del LLM (engine-ism ~1/6 runs) volvería flaky al golden. Una REGRESIÓN de
      // código dispara la tasa (ej. 5/6) y se ve. [ZONA-DRIFT] se confunde con el
      // arriendo-en-UF; los strippers PLANC auto-corrigen. "mediana de la zona" para el
      // ARRIENDO es legítimo (la mediana COMUNAL determinística la cubre el recompute).
      if (strings.some((x) => ENGINE_ISM_RE.test(x.s))) bump("~engine-ism");
      if (warns.some((w) => w.includes("[ZONA-DRIFT]"))) bump("~zona-drift");
      // El guard tuvo que AMPUTAR: ni el original ni 2 reintentos entraron en el
      // presupuesto y se cayó una oración entera. Es el fallback diseñado, no una
      // regresión — pero si la tasa sube, el número a mover es CONTINUACION_MAX, no
      // el check. SOFT por la misma razón que el resto: es varianza del modelo.
      if (warns.some((w) => w.includes("[RD-BUDGET-TRIM]"))) bump("~rd-trim");
    }

    // Consolidar. Regla dura falla si falló en ≥1 run; soft (~) reporta sin bloquear.
    checks.push({ rule: `gen.runs(K=${K})`, pass: genOk === K, detail: `${genOk}/${K} generaciones OK` });
    // Se imprime SIEMPRE (printSeed solo lista las reglas que fallan): el uso del
    // presupuesto es evidencia de calibración, no un veredicto.
    if (totalesWC.length) {
      console.log(
        `      · ${seed.key} presupuesto: respuestaDirecta ${Math.min(...totalesWC)}-${Math.max(...totalesWC)} palabras` +
          ` [techo = respuesta + ${WORDS(coronaFrase)} (presupuesto de la razón que manda) + ≤${techoContinuacion}] · corridas: ${totalesWC.join("·")}`,
      );
    }
    const HARD = ["A1.apertura", "A2.catch-root-a", "A5.§9-cajaAccionable", "A6.presupuesto", "A7.D2-niega-VM", "A8.D1-instrumentos", "A9.titular", "A10.marcas-balanceadas", "A-PC1.doctrina-100pct", "A-PC2.vacancia", "A-PC3.retorno-sobre-capital", "gen.null"];
    const SOFT = ["~engine-ism", "~zona-drift", "~rd-trim", "~aguanta-lectura", "~titular-null", "~titular-nucleo-largo", "~titular-largo-renderizado"];

    // ── Umbral de MAYORÍA para las reglas que juzgan PROSA GENERADA ────────────
    //
    // Las `A*` evalúan una salida estocástica: el mismo prompt produce texto
    // distinto en cada run. Con el `c > 0` anterior, UNA sola generación mala de
    // las K pintaba el gate de rojo, y con K=2 eso convertía el FULL en una
    // moneda al aire.
    //
    // Medido sobre master (5 corridas × K=2 × 9 seeds = 90 generaciones, más 12
    // dirigidas): A8.D1-instrumentos falla ~1% de las generaciones. Con 18
    // generaciones por corrida eso da 16,3% de corridas rojas POR AZAR — y era
    // justo lo observado (3 rojas en 9 corridas, en cuatro seeds distintos:
    // GS-4, GS-7, GS-PC1, GS-PC2). A-PC1.doctrina-100pct tiene la misma firma.
    //
    // Exigir mayoría (con K=2 ⇒ falla solo si fallan las DOS generaciones) baja
    // la falsa alarma a 0,09% por corrida sin perder el guard: una regresión real
    // es sistemática, no aleatoria. Si una regresión lleva la tasa al 50%, el
    // gate la caza en el 92% de las corridas; si la lleva al 100%, en el 100%.
    //
    // `gen.null` y todo lo que NO sea prosa quedan en `c > 0`: una generación que
    // devuelve null o un timeout de red es un problema real y promediarlo lo
    // escondería (ya pasó una vez, con un APIConnectionTimeoutError).
    const esReglaDeProsa = (r: string) => r.startsWith("A");
    const umbralMayoria = Math.floor(K / 2);
    for (const r of HARD) {
      const c = failCounts[r] ?? 0;
      const limite = esReglaDeProsa(r) ? umbralMayoria : 0;
      if (c > limite) checks.push({ rule: r, pass: false, detail: `falló ${c}/${K} runs` });
      else if (c > 0) {
        // Falla minoritaria: no bloquea, pero se DECLARA. Un guard que absorbe
        // varianza en silencio es indistinguible de uno que dejó de mirar.
        console.log(`      · ${seed.key} ${r}: falló ${c}/${K} runs — bajo el umbral de mayoría, no bloquea`);
      }
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
