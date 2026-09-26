// ============================================================================
// GOLDEN · EL DEMO PÚBLICO SON DOS FILAS REALES, PROTEGIDAS — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio. `/demo` era un `FullAnalysisResult` escrito a mano en el código: sin
// hallazgos, su titular caía a la rama «sin card» y envejecía con cada cambio del informe. Ahora
// son dos filas reales —una por modalidad— dibujadas por el mismo camino que cualquier informe.
//
//   1 · /demo NO TIENE RESULTADOS ESCRITOS A MANO. Ningún archivo de `src/app/demo/` arma un
//       resultado (tipos de resultado, `metricaValor`, el componente de resultados con datos
//       propios); las dos rutas dibujan `InformeLtr` / `InformeStr` con los ids de `demo.ts`, sin
//       caché estática.
//   2 · LAS DOS FILAS ESTÁN PROTEGIDAS: acceso completo para cualquiera en las dos páginas del
//       informe (también por su URL `/analisis/...`), y ningún botón de borrar se dibuja para
//       ellas (informe LTR y dashboard). La página STR tiene su rama de demo, antes que la de
//       invitado.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/demo-publico-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DEMO_IDS, DEMO_LTR_ID, DEMO_STR_ID, esDemo } from "../../../src/lib/demo";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

export function runDemoPublicoTier(): { hard: number } {
  console.log("\n─── TIER DEMO-PUBLICO (dos filas reales, recalculadas y protegidas · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 0 · las ids ──
  if (DEMO_LTR_ID !== "86bff34a-6856-4d2c-b747-0b18da224eb7" || DEMO_STR_ID !== "642b58ed-f24c-4bf2-87dc-ee741e5d32ad") F("0 · las filas del demo no son las elegidas por Fabrizio (86bff34a · 642b58ed)");
  if (DEMO_IDS.length !== 2 || !esDemo(DEMO_LTR_ID) || !esDemo(DEMO_STR_ID)) F("0 · `DEMO_IDS`/`esDemo` no reconocen las dos filas");
  if (esDemo("6db7a9ac-f030-4ccf-b5a8-5232ae997fb1")) F("0 · 6db7a9ac sigue siendo demo");

  // ── 1 · /demo no tiene resultados escritos a mano ──
  const dir = join(RAIZ, "src", "app", "demo");
  const rutas = archivos(dir).map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
  if (rutas.length < 3) F(`0 · el barrido de src/app/demo leyó ${rutas.length} archivos`);
  const ARMA_RESULTADO = /\bFullAnalysisResult\b|\bShortTermResult\b|\bmetricaValor\b|\bPremiumResults\b|\bSTRResultsClient\b|\bresults=\{|\bcashflowYear1\b|\bexitScenario\b|\bgenerateProjections\b/;
  for (const r of rutas) {
    const m = sinComentarios(leer(r)).match(ARMA_RESULTADO);
    if (m) F(`1 · ${r} arma un resultado a mano («${m[0]}»): el demo tiene que ser una fila del motor`);
  }
  const larga = sinComentarios(leer("src/app/demo/page.tsx"));
  if (!/<InformeLtr id=\{DEMO_LTR_ID\} demo \/>/.test(larga)) F("1 · /demo no dibuja InformeLtr con DEMO_LTR_ID");
  if (!/export const dynamic = "force-dynamic";/.test(larga)) F("1 · /demo puede quedar como página estática congelada");
  const corta = sinComentarios(leer("src/app/demo/renta-corta/page.tsx"));
  if (!/<InformeStr id=\{DEMO_STR_ID\} demo \/>/.test(corta)) F("1 · /demo/renta-corta no dibuja InformeStr con DEMO_STR_ID");
  if (!/export const dynamic = "force-dynamic";/.test(corta)) F("1 · /demo/renta-corta puede quedar como página estática congelada");
  // Las rutas del informe dibujan el MISMO componente: el demo no puede ir por otro camino.
  if (!/return <InformeLtr id=\{params\.id\} \/>;/.test(sinComentarios(leer("src/app/analisis/[id]/page.tsx")))) F("1 · /analisis/[id] no dibuja InformeLtr: el demo y el informe irían por caminos distintos");
  if (!/return <InformeStr id=\{params\.id\} \/>;/.test(sinComentarios(leer("src/app/analisis/renta-corta/[id]/page.tsx")))) F("1 · /analisis/renta-corta/[id] no dibuja InformeStr");
  // El selector no compara: sin puntaje ni veredicto, sin «vs».
  const cab = sinComentarios(leer("src/app/demo/demo-cabecera.tsx"));
  if (/\bscore\b|veredicto|COMPRAR|AJUSTA|BUSCAR|\bvs\b|versus|cuál conviene/i.test(cab)) F("1 · el selector del demo muestra puntaje, veredicto o compara modalidades");
  if (!/"Ejemplo en renta larga"/.test(cab) || !/"Ejemplo en renta corta"/.test(cab) || !/href: "\/demo"/.test(cab) || !/href: "\/demo\/renta-corta"/.test(cab)) F("1 · el selector no tiene las dos pestañas con su URL");
  if (!/posthog\?\.capture\("demo_pestana_vista", \{ modalidad \}\)/.test(cab)) F("1 · el selector no manda el evento de PostHog por pestaña");

  // ── 2 · las dos filas protegidas ──
  const ltr = sinComentarios(leer("src/app/analisis/[id]/informe-ltr.tsx"));
  if (!/const isDemo = esDemo\(analisis\.id\);/.test(ltr)) F("2 · el informe LTR no reconoce las filas del demo");
  if (!/\} else if \(isDemo\) \{\s*accessLevel = "premium";/.test(ltr)) F("2 · el informe LTR no le da acceso completo al demo");
  if (!/const isPremium = isAdmin \|\| isDemo \|\|/.test(ltr)) F("2 · el informe LTR no marca premium al demo");
  const str = sinComentarios(leer("src/app/analisis/renta-corta/[id]/informe-str.tsx"));
  const iDemo = str.search(/\} else if \(esDemo\(data\.id\)\) \{\s*accessLevel = "premium";/);
  const iGuest = str.search(/\} else if \(!isLoggedIn\) \{\s*accessLevel = "guest";/);
  if (iDemo < 0) F("2 · el informe STR no tiene rama de demo con acceso completo");
  else if (iGuest >= 0 && iDemo > iGuest) F("2 · en el informe STR la rama del demo va después de la de invitado: un invitado no la alcanza");
  if (!/const isPremium = isAdmin \|\| esDemo\(data\.id\) \|\|/.test(str)) F("2 · el informe STR no marca premium al demo");
  const del = sinComentarios(leer("src/app/analisis/[id]/delete-button.tsx"));
  const iGuard = del.search(/if \(esDemo\(id\)\) return null;/);
  const iDelete = del.search(/\.delete\(\)/);
  if (iGuard < 0 || (iDelete >= 0 && iGuard > iDelete)) F("2 · el botón de borrar del informe no excluye las filas del demo");
  const row = sinComentarios(leer("src/app/dashboard/row-actions.tsx"));
  if (!/const esDemo = esFilaDemo\(id\);/.test(row) || !/if \(esDemo\) return;/.test(row) || (row.match(/\{!esDemo && \(/g) ?? []).length < 2) F("2 · el dashboard no protege las filas del demo (borrar y su menú)");
  // Nadie más decide qué es demo con un literal propio.
  for (const r of archivos(join(RAIZ, "src")).map((a) => relative(RAIZ, a).replace(/\\/g, "/"))) {
    if (r === "src/lib/demo.ts") continue;
    const src = sinComentarios(leer(r));
    if (/6db7a9ac-f030|86bff34a-6856|642b58ed-f24c/.test(src)) F(`2 · ${r} escribe a mano el id de un demo: tiene que leerlo de src/lib/demo.ts`);
  }

  if (fallas.length) {
    console.log(`  ✗ DEMO-PUBLICO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — /demo y /demo/renta-corta dibujan las filas reales por el camino del informe (${rutas.length} archivos sin resultados a mano), el selector no compara, y las dos filas tienen acceso completo y no se borran`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runDemoPublicoTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (25-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las trece en ROJO; restauradas, VERDE.
//    1 · /demo vuelve a dibujar un resultado escrito a mano (PremiumResults con datos propios)
//    2 · /demo dibuja otra fila que la de DEMO_LTR_ID
//    3 · /demo sin `force-dynamic`
//    4 · /demo/renta-corta no dibuja InformeStr
//    5 · el informe STR sin rama de demo
//    6 · la rama de demo STR movida DESPUÉS de la de invitado      → «un invitado no la alcanza»
//    7 · el informe LTR deja de reconocer el demo
//    8 · el botón de borrar del informe no excluye el demo
//    9 · el dashboard deja borrar el demo
//   10 · `DEMO_IDS` pierde la fila STR
//   11 · el selector muestra el puntaje
//   12 · el selector sin el evento de PostHog
//   13 · el dashboard vuelve a escribir el id del demo viejo a mano
