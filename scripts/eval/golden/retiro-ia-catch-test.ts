/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · RETIRO DE LA IA, PARTE 1 — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: la IA salió de lo que el usuario ve en el informe (el titular lo escribe
// el motor) y la maquinaria que la genera se retira por partes. Esta es la primera:
//   · se cierran las exposiciones: los endpoints de IA del informe sin llamador y los parsers de
//     avisos y cotizaciones (parse-quotation no tenía límite de uso);
//   · la generación se apaga detrás de un interruptor (`prosa-ia-interruptor.ts`), sin borrar
//     código: crear LTR, crear STR, post-pago, el cron de precalentado y la comparativa AMBAS;
//   · lo que se rompería se ajusta en el mismo cambio: el PDF STR se apaga como el LTR (410), la
//     imagen del correo cae al texto del motor sin la caja de la prosa, y AMBAS deja de pedir y
//     dibujar su prosa (web, share y PDF), sin exigirla para el PDF.
//
// FIJA, verificado EN ROJO por mutación:
//   1 · LOS ENDPOINTS NO EXISTEN y nada del código de producción los llama.
//   2 · EL INTERRUPTOR prende SOLO con "true" exacto; sin la variable, apagado.
//   3 · NADA EN PRODUCCIÓN LLAMA A LA GENERACIÓN CON EL INTERRUPTOR APAGADO: cada llamada a un
//       generador desde `src/` está DENTRO del bloque que abre `prosaIaActiva()` (o después de un
//       `if (!prosaIaActiva()) { return }` en el mismo handler), y un llamador nuevo sin guard es
//       falla. Se mide por el bloque real (llaves balanceadas), no por vecindad.
//   4 · EL PDF STR RESPONDE 410, como el LTR: el guard va antes del acceso y del render, sin el 425
//       que exigía prosa; el documento redirige al informe; ningún botón lo ofrece.
//   5 · LA IMAGEN DEL CORREO no lee la prosa ni pinta la caja «LO QUE VERÍAS».
//   6 · AMBAS no pide ni dibuja prosa, y su PDF no la exige.
//   7 · (PARTE 2, 25-sep-2026) LO BORRADO NO VUELVE Y NADIE LO IMPORTA: cada archivo de
//       `RETIRADOS` no existe, y ningún archivo trackeado de `src/` o `scripts/` lo importa ni
//       lo lee por su ruta (import, import dinámico, require o `leer("…")`).
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/retiro-ia-catch-test.ts
// ============================================================================
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, posix } from "node:path";
import { prosaIaActiva } from "../../../src/lib/prosa-ia-interruptor";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** Sin comentarios: la prosa de un acta no puede satisfacer ni romper un predicado. */
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/.*$/gm, "$1");

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

/** Índice de la llave que cierra la que abre en `abre` (la primera `{` desde ahí). */
function cierreDeBloque(s: string, desde: number): { abre: number; cierra: number } | null {
  const abre = s.indexOf("{", desde);
  if (abre < 0) return null;
  let prof = 0;
  for (let i = abre; i < s.length; i++) {
    if (s[i] === "{") prof++;
    else if (s[i] === "}") {
      prof--;
      if (prof === 0) return { abre, cierra: i };
    }
  }
  return null;
}

/** Las llamadas que generan prosa del informe o de la comparativa. */
const LLAMADA = /\b(generateAiAnalysis|generarYPersistirProsaStr|generateStrProse|generateComparativaAI)\(|\.messages\.create\(/g;
/** Los módulos que DEFINEN la generación: adentro se llaman entre sí, y los gobierna quien los llama. */
const MODULOS_GENERADORES = new Set([
  "src/lib/ai-generation-ambas-generate.ts",
]);

/**
 * Lo que el retiro de la IA BORRÓ, por parte. Crece con cada parte; nunca se achica: si algo de
 * acá vuelve, vuelve a propósito y con este tier en rojo.
 */
export const RETIRADOS: Record<string, string[]> = {
  "parte 2 · generadores LTR/STR y evals que gastan tokens": [
    "src/lib/ai-generation.ts",
    "src/lib/ai-generation-str.ts",
    "src/lib/str-prosa-persist.ts",
    "src/app/api/cron/precalentar-prosa/route.ts",
    "scripts/eval/judge.ts",
    "scripts/eval/golden/generate.ts",
    "scripts/eval/golden/semantic.ts",
    "scripts/eval/golden/str-generate.ts",
    "scripts/eval/golden/str-semantic.ts",
    "scripts/eval/golden/ambas-semantic.ts",
    "scripts/eval/golden/magnitud-sample.ts",
    "scripts/eval/editorial/juez.ts",
    "scripts/eval/editorial/censo.ts",
    "scripts/eval/editorial/censo-ambas.ts",
    "scripts/eval/editorial/prosa-fresca.ts",
    "scripts/eval/editorial/ensamblar.ts",
    "scripts/eval/editorial/ensamblar-ambas.ts",
    "scripts/eval/editorial/evaluar.ts",
    "scripts/eval/editorial/agregar.ts",
    "scripts/lib/audit-prompt-builder.ts",
    "scripts/regen-corpus-str.ts",
    "scripts/regenerate-ai-analysis.ts",
    "scripts/regen-prosa-hallazgo.ts",
    "scripts/eval/golden/prompt-v25-catch-test.ts",
    "scripts/eval/golden/prompt-v20-str-catch-test.ts",
    "scripts/eval/golden/vocabulario-prompt-str-catch-test.ts",
    "scripts/eval/golden/niega-salida-str-catch-test.ts",
    "scripts/eval/golden/guards-contables-catch-test.ts",
    "scripts/eval/golden/timeout.ts",
    "scripts/eval/golden/str-guards-baseline.ts",
  ],
  "parte 2 · guards y helpers que solo usaban los generadores": [
    "src/lib/str-guards.ts",
    "src/lib/cifras-guard.ts",
    "src/lib/prosa-presupuesto.ts",
    "src/lib/retry-quirurgico.ts",
    "src/lib/titular-retry.ts",
    // Exportaba OTRO `titularMotor`, distinto del vivo (`titular-motor.ts`): el chequeo 7 cuida
    // que nadie lo vuelva a importar por error.
    "src/lib/titular-final.ts",
    "src/lib/hero-claim-core.ts",
    "src/lib/copia-frase.ts",
    "src/lib/precio-jerarquia.ts",
    "src/lib/referencias-zona.ts",
    "scripts/eval/golden/engineism-str-catch-test.ts",
    "scripts/eval/golden/estructural-str-catch-test.ts",
    "scripts/eval/golden/hero-claim-str-catch-test.ts",
    "scripts/eval/golden/palabras-internas-str-catch-test.ts",
    "scripts/eval/golden/titular-final-catch-test.ts",
    "scripts/eval/golden/jerarquia-catch-test.ts",
    "scripts/eval/golden/ambitos-zona-catch-test.ts",
    "scripts/eval/golden/referencias-zona-catch-test.ts",
  ],
};

/**
 * ¿El archivo `rel` (con fuente `src`) nombra a `ruta` como módulo —import, import dinámico o
 * require— o la lee por su ruta del repo? Los especificadores se RESUELVEN: `@/x` es `src/x`, y
 * uno relativo se resuelve contra la carpeta de `rel`; así `./generate` en `scripts/eval/golden`
 * es `scripts/eval/golden/generate` y no calza con otro `generate` de otra carpeta, y
 * `ai-generation` no calza con `ai-generation-ambas` porque se compara la ruta entera.
 */
export function nombraRuta(rel: string, src: string, ruta: string): boolean {
  const sinExt = (x: string) => x.replace(/\.(tsx?|mjs|js)$/, "").replace(/\/index$/, "");
  const objetivo = sinExt(ruta);
  for (const m of src.matchAll(/(?:\bfrom|\bimport\(|\brequire\()\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    let res: string | null = null;
    if (spec.startsWith("@/")) res = "src/" + spec.slice(2);
    else if (spec.startsWith(".")) res = posix.normalize(posix.join(posix.dirname(rel), spec));
    if (res && sinExt(res) === objetivo) return true;
  }
  // Por su ruta: el texto literal de la ruta del repo, como la usa un `leer("src/lib/…")`.
  const esc = ruta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["'\`]${esc}["'\`]`).test(src);
}

export function runRetiroIaTier(): { hard: number } {
  console.log("\n─── TIER RETIRO-IA (endpoints cerrados · lo borrado no vuelve ni se importa · PDF STR 410 · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · los endpoints no existen y nadie los llama ──
  const BORRADOS = [
    "src/app/api/analisis/ai/route.ts",
    "src/app/api/analisis/short-term/ai/route.ts",
    "src/app/api/analisis/[id]/ai-status/route.ts",
    "src/app/api/analisis/short-term/[id]/ai-status/route.ts",
    "src/app/api/scraping/parse-listing/route.ts",
    "src/app/api/scraping/parse-quotation/route.ts",
  ];
  for (const p of BORRADOS) if (existsSync(join(RAIZ, p))) F(`1 · ${p} volvió a existir: era una exposición sin llamador`);
  const SRC = archivos(join(RAIZ, "src")).map((a) => ({ rel: relative(RAIZ, a).replace(/\\/g, "/"), src: sinComentarios(readFileSync(a, "utf8").replace(/\r\n/g, "\n")) }));
  const LLAMA_BORRADO = /["'`]\/api\/analisis\/(short-term\/)?ai["'`?]|\/ai-status["'`]|\/api\/scraping\//;
  for (const { rel, src } of SRC) if (LLAMA_BORRADO.test(src)) F(`1 · ${rel} llama a un endpoint retirado (${src.match(LLAMA_BORRADO)![0]})`);

  // ── 2 · el interruptor prende solo con "true" exacto ──
  const previo = process.env.PROSA_IA_ENABLED;
  const casos: [string | undefined, boolean][] = [[undefined, false], ["", false], ["false", false], ["1", false], ["TRUE", false], [" true", false], ["true", true]];
  for (const [v, esperado] of casos) {
    if (v === undefined) delete process.env.PROSA_IA_ENABLED;
    else process.env.PROSA_IA_ENABLED = v;
    if (prosaIaActiva() !== esperado) F(`2 · con PROSA_IA_ENABLED=${JSON.stringify(v)} el interruptor da ${!esperado}: solo "true" exacto prende`);
  }
  if (previo === undefined) delete process.env.PROSA_IA_ENABLED;
  else process.env.PROSA_IA_ENABLED = previo;

  // ── 3 · ninguna llamada a la generación queda fuera del interruptor ──
  // Por archivo, cómo se permite que llame: DENTRO del bloque que abre el guard, o DESPUÉS de un
  // guard de salida temprana (`if (!prosaIaActiva()) { … return … }`).
  // ⚠ ACTA (25-sep-2026) · PARTE 2: los generadores LTR y STR se borraron, y con ellos sus cuatro
  // disparadores (crear LTR, crear STR, post-pago y el cron). Queda la ruta de AMBAS. Cualquier
  // llamada nueva a un generador desde `src/`, sin guard, sigue siendo falla.
  const GUARDADOS: Record<string, { dentro?: RegExp; salida?: RegExp }> = {
    "src/app/api/analisis/comparativa/ai/route.ts": { salida: /if \(!prosaIaActiva\(\)\) /g },
  };
  let llamadas = 0;
  const vistos = new Set<string>();
  for (const { rel, src } of SRC) {
    if (MODULOS_GENERADORES.has(rel)) continue;
    const ms = [...src.matchAll(LLAMADA)];
    if (!ms.length) continue;
    vistos.add(rel);
    const g = GUARDADOS[rel];
    if (!g) {
      F(`3 · ${rel} llama a la generación (${ms[0][0]}) y no está detrás del interruptor`);
      continue;
    }
    const bloques: { abre: number; cierra: number }[] = [];
    for (const m of src.matchAll(g.dentro ?? g.salida!)) {
      const b = cierreDeBloque(src, m.index! + m[0].length);
      if (b) bloques.push(b);
    }
    if (!bloques.length) F(`3 · ${rel}: no encuentro el guard del interruptor`);
    for (const m of ms) {
      llamadas++;
      const i = m.index!;
      const ok = g.dentro
        ? bloques.some((b) => b.abre < i && i < b.cierra)
        : bloques.some((b) => b.cierra < i && /\breturn\b/.test(src.slice(b.abre, b.cierra)));
      if (!ok) F(`3 · ${rel}: la llamada ${m[0]} (offset ${i}) corre con el interruptor apagado`);
    }
  }
  // Piso de cobertura: los disparadores que quedan tienen que seguir midiéndose. Si uno desaparece
  // del recorrido, el tier dejaría de probarlo sin avisar.
  for (const rel of Object.keys(GUARDADOS)) if (!vistos.has(rel)) F(`3 · ${rel} ya no llama a la generación: actualiza GUARDADOS (el tier dejó de medirlo)`);
  if (llamadas < Object.keys(GUARDADOS).length) F(`3 · el tier midió ${llamadas} llamadas a la generación: esperaba al menos ${Object.keys(GUARDADOS).length}`);

  // ── 7 · lo borrado no vuelve y nadie lo importa ──
  const ESTE = "scripts/eval/golden/retiro-ia-catch-test.ts";
  const trackeados = execSync("git ls-files src scripts", { cwd: RAIZ, encoding: "utf8" })
    .split("\n").filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.startsWith("scripts/_archivo/") && f !== ESTE && existsSync(join(RAIZ, f)))
    .map((f) => ({ rel: f, src: sinComentarios(readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n")) }));
  let retirados = 0;
  for (const [parte, rutas] of Object.entries(RETIRADOS)) {
    for (const r of rutas) {
      retirados++;
      if (existsSync(join(RAIZ, r))) F(`7 · ${r} volvió a existir (${parte})`);
      for (const { rel, src } of trackeados) if (nombraRuta(rel, src, r)) F(`7 · ${rel} importa o lee ${r}, borrado en la ${parte}`);
    }
  }
  if (trackeados.length < 500) F(`7 · el barrido leyó ${trackeados.length} archivos: no está leyendo el repo`);

  // ── 4 · el PDF STR responde 410, como el LTR ──
  const PDF_STR = sinComentarios(leer("src/app/api/analisis/renta-corta/[id]/pdf/route.ts"));
  if (!/const PDF_STR_VISIBLE = false;/.test(PDF_STR)) F("4 · el PDF STR no está apagado (PDF_STR_VISIBLE = false)");
  const g410 = PDF_STR.search(/if \(!PDF_STR_VISIBLE\) \{\s*return NextResponse\.json\([\s\S]{0,300}?\{ status: 410 \}/);
  if (g410 < 0) F("4 · el PDF STR no responde 410 con el guard apagado");
  else {
    for (const [paso, re] of [["el acceso", /accesoPdf\(/], ["el render", /renderPdf\(/]] as const) {
      const i = PDF_STR.search(re);
      if (i >= 0 && i < g410) F(`4 · el PDF STR corre ${paso} antes del 410`);
    }
  }
  if (/status: 425/.test(PDF_STR)) F("4 · el PDF STR volvió a exigir la prosa (425)");
  const DOC_STR = sinComentarios(leer("src/app/analisis/renta-corta/[id]/documento/page.tsx"));
  const redir = DOC_STR.search(/if \(!PDF_STR_VISIBLE\) \{\s*redirect\(`\/analisis\/renta-corta\/\$\{params\.id\}/);
  if (redir < 0 || !/const PDF_STR_VISIBLE = false;/.test(DOC_STR)) F("4 · el documento STR no redirige al informe con el PDF apagado");
  else if (DOC_STR.search(/createClient\(\)/) < redir) F("4 · el documento STR consulta la base antes de redirigir");
  const RC_STR = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
  if (/pdfUrl=/.test(RC_STR)) F("4 · el informe STR vuelve a ofrecer «Descargar PDF»");
  const HELP = sinComentarios(leer("src/app/dashboard/dashboard-helpers.ts"));
  if (!/export function hrefPdf\(\): string \| null \{\s*return null;\s*\}/.test(HELP)) F("4 · el dashboard vuelve a ofrecer un PDF (hrefPdf no devuelve null)");
  const ROW = sinComentarios(leer("src/app/dashboard/row-actions.tsx"));
  const enlacesPdf = (ROW.match(/href=\{hrefPdf\}/g) ?? []).length;
  const gateados = (ROW.match(/\{hrefPdf && \(\s*<a\s+href=\{hrefPdf\}/g) ?? []).length;
  if (enlacesPdf === 0 || enlacesPdf !== gateados) F(`4 · RowActions pinta ${enlacesPdf - gateados} enlace(s) de PDF sin mirar si hay PDF`);

  // ── 5 · la imagen del correo no lee la prosa ──
  const OG = sinComentarios(leer("src/app/api/og/veredicto/route.tsx"));
  if (/ai_analysis|conviene\?*\.|cajaAccionable|reencuadre|veredictoFrase/.test(OG)) F("5 · la imagen del correo volvió a leer la prosa de la IA");
  if (/LO QUE VERÍAS/.test(OG)) F("5 · la imagen del correo volvió a pintar la caja «LO QUE VERÍAS»");
  if (!/const frase = clamp\(results\?\.resumenEjecutivo \|\| defaultFrase\(veredicto\), 150\);/.test(OG)) F("5 · la frase de la imagen no es la del motor");

  // ── 6 · AMBAS no pide ni dibuja prosa, y su PDF no la exige ──
  for (const p of ["src/app/analisis/comparativa/comparativa-client.tsx", "src/app/share/comparativa/[token]/shared-client.tsx"]) {
    const s = sinComentarios(leer(p));
    if (/useComparativaAI|\/api\/analisis\/comparativa\/ai/.test(s)) F(`6 · ${p} vuelve a pedir la prosa de la comparativa`);
    const heroes = (s.match(/<HeroComparativa\b/g) ?? []).length;
    const sinProsa = (s.match(/<HeroComparativa\b[^>]*?\sai=\{null\}\s+aiLoading=\{false\}/g) ?? []).length;
    if (!heroes || heroes !== sinProsa) F(`6 · ${p} le pasa prosa (o espera) al hero de la comparativa`);
    if (/Análisis comparativo no disponible/.test(s)) F(`6 · ${p} vuelve a mostrar el error de la prosa`);
  }
  const PDF_AMBAS = sinComentarios(leer("src/app/api/share/comparativa/[token]/pdf/route.ts"));
  if (/status: 425|comparativaAI/.test(PDF_AMBAS)) F("6 · el PDF de AMBAS vuelve a exigir la prosa");
  const DOC_AMBAS = sinComentarios(leer("src/app/share/comparativa/[token]/documento/page.tsx"));
  if (!/<DocumentoAmbas\b[^>]*?\sai=\{null\}/.test(DOC_AMBAS)) F("6 · el documento de AMBAS vuelve a dibujar la prosa");

  if (fallas.length) {
    console.log(`  ✗ RETIRO-IA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${retirados} archivos retirados que nadie importa ni lee; ${BORRADOS.length} endpoints fuera y sin llamador; el interruptor prende solo con "true"; ${llamadas} llamadas a la generación en ${vistos.size} archivos, todas detrás del interruptor; el PDF STR responde 410 como el LTR y ningún botón lo ofrece; el correo y AMBAS no leen prosa`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRetiroIaTier();
  process.exit(hard ? 1 : 0);
}
