// ============================================================================
// GOLDEN · el instrumento no escribe en la base por accidente (07-sep-2026). 0 tokens.
// ============================================================================
// Todo call site del generador dentro de scripts/ tiene que declarar qué hace con la
// base: `persist: false` (corrida de validación) o un `trigger` explícito (escribir es
// el propósito y queda etiquetado como tal en pipeline_timing).
//
// Por qué existe esta regla: `captureGeneratorPrompt` (judge.ts) llamaba
// `generateAiAnalysis(id, supabase)` sin opciones. El centinela que evita el
// model-call cae en el catch del generador, que persiste una generación en `error`
// sobre la fila REAL — 522 de las 681 entradas en error de toda la base salieron de
// ahí, todas sobre las seeds `GOLDEN::GS-*` que viven en producción. Y un lote sin
// `trigger` se estampa "manual", indistinguible de una persona (157 casos el 01-sep).
//
// Fuera de la regla a propósito: `generateStrProse`, que genera y devuelve sin tocar
// la base — quien persiste es el caller (`generarYPersistirProsaStr`), y ese sí entra.
//
// Corre dentro del QUICK del runner (tier "instrumento") y standalone:
//   node --import tsx scripts/eval/golden/generador-en-scripts-catch-test.ts
// ============================================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(__dirname, "..", "..");                     // scripts/
const BASE = join(RAIZ, "..");                                 // repo
/** Generadores que ESCRIBEN salvo que se les diga lo contrario. */
const GENERADORES = ["generateAiAnalysis", "generarYPersistirProsaStr", "generateComparativaAI"];
/** `_archivo` es código jubilado a propósito; este test no se mira a sí mismo. */
const EXCLUIDOS = [/^scripts[\\/]_archivo[\\/]/, /generador-en-scripts-catch-test\.ts$/];

function* archivos(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (/\.ts$/.test(e)) yield p;
  }
}

/** Quita comentarios conservando las posiciones (una mención en un comentario no cuenta). */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => { const i = l.search(/(^|[^:'"`])\/\//); return i === -1 ? l : l.slice(0, i + (l[i] === "/" ? 0 : 1)); })
    .join("\n");
}

/** Texto de la llamada desde su `(` hasta el paréntesis que la cierra. */
function textoDeLaLlamada(src: string, desde: number): string {
  const abre = src.indexOf("(", desde);
  if (abre === -1) return "";
  let prof = 0;
  for (let i = abre; i < src.length && i < abre + 4000; i++) {
    if (src[i] === "(") prof++;
    else if (src[i] === ")") { prof--; if (prof === 0) return src.slice(abre, i + 1); }
  }
  return src.slice(abre, abre + 4000);
}

export interface HitGenerador { archivo: string; linea: number; fn: string; texto: string }

export function callSitesSinDeclarar(): HitGenerador[] {
  const hits: HitGenerador[] = [];
  for (const abs of archivos(RAIZ)) {
    const rel = relative(BASE, abs);
    if (EXCLUIDOS.some((re) => re.test(rel))) continue;
    const src = sinComentarios(readFileSync(abs, "utf-8"));
    for (const fn of GENERADORES) {
      const re = new RegExp(`\\b${fn}\\s*\\(`, "g");
      for (const m of src.matchAll(re)) {
        const idx = m.index ?? 0;
        // No son call sites: la DEFINICIÓN de la función (`function generateAiAnalysis(`)
        // y la línea de import. El guard mira lo pegado al nombre, no la línea entera:
        // con `export const a = () => generateAiAnalysis(...)` un guard por línea se
        // comía justo el caso que hay que cazar (verificado el 07-sep con un archivo
        // de prueba: con el guard amplio daba verde).
        const antes = src.slice(Math.max(0, idx - 40), idx);
        const lineaTxt = src.slice(src.lastIndexOf("\n", idx) + 1, src.indexOf("\n", idx) === -1 ? undefined : src.indexOf("\n", idx));
        if (/\bfunction\s+$/.test(antes)) continue;
        if (/^\s*import\b/.test(lineaTxt)) continue;
        const llamada = textoDeLaLlamada(src, idx + fn.length);
        if (/persist\s*:\s*false/.test(llamada) || /\btrigger\s*:/.test(llamada)) continue;
        hits.push({ archivo: rel, linea: src.slice(0, idx).split("\n").length, fn, texto: llamada.replace(/\s+/g, " ").slice(0, 110) });
      }
    }
  }
  return hits;
}

/** Tier para el runner: cada call site sin declarar es una falla dura. */
export function runGeneradorEnScriptsTier(): { hard: number } {
  console.log("\n─── TIER INSTRUMENTO (scripts/: el generador declara persist:false o trigger, 0 tokens) ───");
  const hits = callSitesSinDeclarar();
  for (const h of hits) console.log(`  ✗ ${h.archivo}:${h.linea} · ${h.fn} sin persist:false ni trigger — ${h.texto}`);
  if (!hits.length) console.log("  ✓ VERDE — ningún call site del generador escribe en la base sin declararlo");
  return { hard: hits.length };
}

if (require.main === module) {
  process.exit(runGeneradorEnScriptsTier().hard ? 1 : 0);
}
