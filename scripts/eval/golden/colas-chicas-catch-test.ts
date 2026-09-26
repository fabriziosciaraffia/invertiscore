// ============================================================================
// GOLDEN · TRES COLAS CHICAS — catch-test (25-sep-2026)
// ============================================================================
//   1 · LAS FUENTES SE SIRVEN DESDE EL SITIO. Dos builds de Vercel fallaron porque
//       `next/font/google` no pudo bajar las fuentes. Ahora viven en `public/fonts/` y
//       `src/app/fuentes.css` las declara. Ningún archivo de `src/` vuelve a pedirle fuentes a
//       Google, cada `url(/fonts/…)` existe, las cuatro variables están declaradas y el layout
//       precarga archivos que existen.
//   2 · EL COLOR DEL PUNTAJE EN EL DASHBOARD SIGUE AL VEREDICTO, no a la nota: un Buscar otro con
//       50 no puede salir gris al lado del chip rojo. Es el mismo color del chip.
//   3 · EL MODO DE GESTIÓN DE AMBAS SE NORMALIZA EN UN SOLO LUGAR (`modo-gestion.ts`): el input
//       guarda «administrador» y el hallazgo comparaba contra «admin». Nadie más castea el valor
//       crudo, y el hallazgo de gestión lee a quien ya delega como quien ya delega.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/colas-chicas-catch-test.ts
// ============================================================================
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { colorDelPuntaje } from "../../../src/app/dashboard/dashboard-ui";
import { modoGestionAmbas } from "../../../src/lib/modo-gestion";
import { ctxFromResults } from "../../../src/lib/comparativa-findings";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx|css)$/.test(n)) out.push(p);
  }
  return out;
}

export function runColasChicasTier(): { hard: number } {
  console.log("\n─── TIER COLAS-CHICAS (fuentes locales · color del puntaje · modo de gestión · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · las fuentes, desde el sitio ──
  const rutas = archivos(join(RAIZ, "src")).map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
  if (rutas.length < 300) F(`0 · el barrido leyó ${rutas.length} archivos de src/`);
  for (const r of rutas) {
    const s = sinComentarios(leer(r));
    if (/from ["']next\/font\/google["']|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(s)) F(`1 · ${r} vuelve a pedirle las fuentes a Google: el build depende de que responda`);
  }
  const layout = sinComentarios(leer("src/app/layout.tsx"));
  if (!/import "\.\/fuentes\.css";/.test(layout)) F("1 · el layout no importa fuentes.css");
  if (!/<body className="fuentes-franco /.test(layout)) F("1 · <body> no lleva la clase fuentes-franco: las variables de fuente no existen");
  const css = leer("src/app/fuentes.css");
  const urls = [...css.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map((m) => m[1]);
  if (urls.length < 20) F(`1 · fuentes.css declara ${urls.length} archivos: no está leyendo las caras`);
  for (const u of new Set(urls)) {
    if (!/\.woff2$/.test(u)) F(`1 · ${u} no es woff2`);
    if (!existsSync(join(RAIZ, "public", "fonts", u))) F(`1 · fuentes.css apunta a /fonts/${u} y el archivo no existe`);
  }
  for (const [variable, familia] of [["--font-heading", "Source Serif 4 Franco"], ["--font-body", "IBM Plex Sans Franco"], ["--font-ui", "Inter Franco"], ["--font-mono", "JetBrains Mono Franco"]]) {
    if (!new RegExp(`\\.fuentes-franco \\{[^}]*${variable}: '${familia}', '${familia} Fallback';`).test(css)) F(`1 · ${variable} no apunta a ${familia} con su respaldo`);
    const caras = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]).filter((c) => c.includes(`font-family: '${familia}';`));
    if (!caras.some((c) => /unicode-range: U\+0000-00FF/.test(c))) F(`1 · ${familia} sin la cara latin`);
    if (caras.some((c) => !/font-display: swap;/.test(c))) F(`1 · ${familia} tiene caras sin font-display: swap`);
    if (!css.includes(`font-family: '${familia} Fallback';`)) F(`1 · ${familia} sin su fuente de respaldo con métricas`);
  }
  const precarga = [...layout.matchAll(/"([a-z0-9-]+\.woff2)"/g)].map((m) => m[1]);
  if (precarga.length < 4) F("1 · el layout no precarga las fuentes");
  for (const f of precarga) if (!existsSync(join(RAIZ, "public", "fonts", f))) F(`1 · el layout precarga /fonts/${f} y no existe`);

  // ── 2 · el color del puntaje sigue al veredicto ──
  if (!/signal-red/.test(colorDelPuntaje("BUSCAR OTRA"))) F("2 · un Buscar otro no pinta su puntaje en rojo");
  if (colorDelPuntaje("COMPRAR") !== "var(--franco-text)") F("2 · un Comprar no pinta su puntaje en tinta");
  if (colorDelPuntaje("AJUSTA SUPUESTOS") !== "var(--franco-text-secondary)") F("2 · un Ajustar no pinta su puntaje en gris");
  const ui = sinComentarios(leer("src/app/dashboard/dashboard-ui.tsx"));
  if (!/export function colorDelPuntaje\(veredicto: Veredicto\): string \{\s*return VERDICT_STYLE\[veredicto\]\.color;/.test(ui)) F("2 · el color del puntaje no es el del chip de veredicto");
  if (!/stroke=\{colorDelPuntaje\(veredicto\)\}/.test(ui)) F("2 · el anillo del puntaje no se pinta por el veredicto");
  for (const r of ["src/app/dashboard/archive.tsx", "src/app/dashboard/continuar.tsx", "src/app/dashboard/dashboard-ui.tsx"]) {
    const s = sinComentarios(leer(r));
    if (/\bscoreColor\b|score(_efectivo)?\s*>=\s*\d{2}\)?\s*(\?|return)/.test(s)) F(`2 · ${r} vuelve a colorear el puntaje por la nota`);
  }
  if (!/colorDelPuntaje\(veredictoDisplay\(row\)\)/.test(sinComentarios(leer("src/app/dashboard/archive.tsx")))) F("2 · la tabla del dashboard no pinta el puntaje con el veredicto de la fila");
  const cont = sinComentarios(leer("src/app/dashboard/continuar.tsx"));
  if ((cont.match(/<ScoreRing score=\{\w+\.score_efectivo\} veredicto=\{veredictoDisplay\(\w+\)\}/g) ?? []).length < 2) F("2 · los anillos de «Continuar» no reciben el veredicto de su fila");

  // ── 3 · el modo de gestión, normalizado en un solo lugar ──
  const casos: [unknown, string][] = [["auto", "auto"], ["administrador", "admin"], ["admin", "admin"], [undefined, "admin"], [null, "admin"]];
  for (const [raw, esperado] of casos) if (modoGestionAmbas(raw) !== esperado) F(`3 · modoGestionAmbas(${JSON.stringify(raw)}) da ${modoGestionAmbas(raw)}, esperaba ${esperado} (la regla del motor: solo "auto" es autogestión)`);
  for (const r of rutas) {
    if (r === "src/lib/modo-gestion.ts") continue;
    const s = sinComentarios(leer(r));
    if (/modoGestion[^;\n]*as "auto" \| "admin"/.test(s)) F(`3 · ${r} castea el modo de gestión crudo: tiene que pasar por modoGestionAmbas`);
  }
  for (const r of ["src/app/analisis/comparativa/page.tsx", "src/app/share/comparativa/[token]/page.tsx", "src/app/share/comparativa/[token]/documento/page.tsx"]) {
    if (!/const modoGestion = modoGestionAmbas\(strInput\?\.modoGestion\);/.test(sinComentarios(leer(r)))) F(`3 · ${r} no normaliza el modo de gestión`);
  }
  if (!/modoActual: modoGestionAmbas\(modoGestion\),/.test(sinComentarios(leer("src/lib/engines/short-term-engine.ts")))) F("3 · el motor STR no usa la misma normalización para el veredicto comparativo");
  // El hallazgo: un par con administrador, aunque llegue crudo, se lee como quien ya delega.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = ctxFromResults({ metrics: {}, projections: [] } as any, { escenarios: { base: {} }, comparativa: {} } as any, { modoGestion: "administrador" as any, comisionAdministrador: 0.2, costoAmoblamiento: 0 });
  if (!ctx) F("0 · ctxFromResults no armó el contexto con resultados mínimos");
  else if (ctx.modoGestion !== "admin") F(`3 · un par con «administrador» llega al hallazgo como «${ctx.modoGestion}»: se lee como autogestionado`);

  if (fallas.length) {
    console.log(`  ✗ COLAS-CHICAS · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — fuentes desde el sitio (${new Set(urls).size} archivos, ninguno de Google), el puntaje del dashboard con el color del veredicto, y el modo de gestión normalizado en un solo lugar`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runColasChicasTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (25-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las quince en ROJO; restauradas, VERDE.
//    1 · el layout vuelve a importar de next/font/google
//    2 · el layout deja de importar fuentes.css
//    3 · <body> sin la clase fuentes-franco
//    4 · una cara apunta a un archivo que no existe
//    5 · --font-heading sin su fuente de respaldo
//    6 · una cara sin font-display: swap
//    7 · fuentes.css con un @import de Google Fonts
//    8 · un Buscar otro vuelve a pintar el puntaje en gris
//    9 · la tabla del dashboard colorea con un veredicto fijo
//   10 · un anillo de «Continuar» sin el veredicto de su fila
//   11 · la normalización trata «administrador» como autogestión
//   12 · la vista compartida vuelve al cast crudo
//   13 · el hallazgo de gestión lee el valor crudo
//   14 · el motor STR con su propia regla en vez de la normalización
//   15 · falta un archivo de fuente en public/fonts
