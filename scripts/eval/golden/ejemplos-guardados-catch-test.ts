// ============================================================================
// GOLDEN · EJEMPLOS-GUARDADOS (29-sep-2026) — catch-test
// ============================================================================
//   La landing y el demo no corren el motor por cada visitante. Los calcula el motor una vez y se
//   sirven guardados: se regeneran en cada deploy y una vez al día, para seguir la UF y los
//   comparables. Nada escrito a mano: sigue siendo el motor.
//   1 · /demo y /demo/renta-corta: sin force-dynamic, `revalidate` de un día, y nada en la página
//       que lea la sesión (cookies, headers, searchParams).
//   2 · El informe en modo demo se lee SIN sesión: cliente de servicio, sin getUser y sin la cookie
//       del anónimo. Si lee cookies, Next vuelve la ruta dinámica y el demo corre por visita.
//   3 · La landing: ISR, sin force-dynamic. Los tres ejemplos pasan por `unstable_cache` con la
//       versión del deploy en la clave y un día de vida; un resultado degradado no se guarda.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/ejemplos-guardados-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

const UN_DIA = 86400;
const DINAMICO_POR_VISITA = /\b(cookies|headers)\(\)|searchParams|useSearchParams|dynamic\s*=\s*["']force-dynamic["']|revalidate\s*=\s*0\b|noStore\(|unstable_noStore/;

export function runEjemplosGuardadosTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EJEMPLOS-GUARDADOS (la landing y el demo no son dinámicos por visita, 0 tokens) ───");

  // ── 1 · Las páginas del demo ──────────────────────────────────────────────
  for (const p of ["src/app/demo/page.tsx", "src/app/demo/renta-corta/page.tsx"]) {
    const s = sinComentarios(leer(p));
    const m = s.match(/export const revalidate = (\d+);/);
    if (!m || Number(m[1]) !== UN_DIA) F(`1 · ${p} no se regenera una vez al día (export const revalidate = ${UN_DIA})`);
    if (DINAMICO_POR_VISITA.test(s)) F(`1 · ${p} lee algo por visita (force-dynamic, cookies, headers o searchParams)`);
    if (!/<Informe(Ltr|Str) id=\{DEMO_(LTR|STR)_ID\} demo \/>/.test(s)) F(`1 · ${p} no dibuja el informe del demo en modo demo`);
  }
  const cabecera = sinComentarios(leer("src/app/demo/demo-cabecera.tsx"));
  if (/\b(cookies|headers)\(\)/.test(cabecera)) F("1 · la cabecera del demo lee cookies o headers");

  // ── 2 · El informe en modo demo, sin sesión ───────────────────────────────
  for (const p of ["src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/renta-corta/[id]/informe-str.tsx"]) {
    const s = sinComentarios(leer(p));
    if (!/const modoDemo = demo && esDemo\(id\);/.test(s)) F(`2 · ${p}: el modo demo no exige que la fila sea del demo (esDemo)`);
    if (!/const supabase = modoDemo \? createServiceClient\(\) : createClient\(\);/.test(s)) F(`2 · ${p}: el demo se lee con el cliente de cookies (vuelve la ruta dinámica)`);
    if (!/modoDemo \? Promise\.resolve\(null\) : supabase\.auth\.getUser\(\)/.test(s)) F(`2 · ${p}: el demo pide la sesión (getUser lee cookies)`);
    if (!/const anonToken = !isLoggedIn && !modoDemo \? tokenAnonDelRequest\(\) : null;/.test(s)) F(`2 · ${p}: el demo lee la cookie del anónimo`);
    if ((s.match(/\bcookies\(\)|\bheaders\(\)/g) ?? []).length) F(`2 · ${p}: lee cookies() o headers() directo`);
  }

  // ── 3 · La landing ────────────────────────────────────────────────────────
  const page = sinComentarios(leer("src/app/page.tsx"));
  const rev = page.match(/export const revalidate = (\d+);/);
  if (!rev || Number(rev[1]) <= 0) F("3 · la landing no es ISR (export const revalidate > 0)");
  if (DINAMICO_POR_VISITA.test(page)) F("3 · la landing lee algo por visita (force-dynamic, cookies, headers o searchParams)");
  const vivo = sinComentarios(leer("src/lib/landing-vivo.ts"));
  if (!/import \{ unstable_cache \} from "next\/cache";/.test(vivo)) F("3 · los ejemplos no se guardan (sin unstable_cache)");
  if (!/export const EJEMPLOS_REVALIDATE_S = 86400;/.test(vivo)) F("3 · los ejemplos no vencen al día");
  if (!/const VERSION_DEPLOY = process\.env\.VERCEL_GIT_COMMIT_SHA/.test(vivo)) F("3 · la versión del deploy no sale del commit");
  if (!/unstable_cache\([\s\S]*?\["landing-ejemplos", VERSION_DEPLOY, \.\.\.EJEMPLOS_LANDING\.map\(\(e\) => e\.id\)\],\s*\{ revalidate: EJEMPLOS_REVALIDATE_S/.test(vivo)) F("3 · la clave de los ejemplos no lleva la versión del deploy y los ids, o no vence al día");
  if (!/if \(r\.degradado\) throw new EjemplosDegradados\(r\.ejemplos\);/.test(vivo)) F("3 · un resultado degradado se guarda un día entero");
  const leerDatos = vivo.slice(vivo.indexOf("export async function leerDatosLanding"));
  if (/ejemploDe\(|recomputeResultsForLegacy\(/.test(leerDatos)) F("3 · leerDatosLanding corre el motor directo, fuera de la caché");
  if (!/leerEjemplos\(\)/.test(leerDatos)) F("3 · leerDatosLanding no lee los ejemplos guardados");

  if (fallas.length) {
    console.log(`  ✗ EJEMPLOS-GUARDADOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el demo se genera en el deploy y se regenera al día, sin sesión; la landing es ISR y sus tres ejemplos se guardan un día con la versión del deploy en la clave");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (29-sep-2026) ─────────────────────────────────────────────────────────
// 14/14 en rojo, restauradas byte a byte: M1 /demo vuelve a force-dynamic · M2 /demo/renta-corta
// a 10 min · M3 el informe LTR con el cliente de cookies · M4 el STR pide la sesión en el demo · M5
// el LTR lee la cookie del anónimo en el demo · M6 modo demo sin esDemo · M7 la landing
// force-dynamic · M8 la landing revalidate 0 · M9 ejemplos a 10 min · M10 la clave sin la versión
// del deploy · M11 el degradado se guarda · M12 leerDatosLanding corre el motor directo · M13 el
// demo lee cookies() · M14 el informe STR lee headers() directo.

if (require.main === module) {
  const { hard } = runEjemplosGuardadosTier();
  process.exit(hard ? 1 : 0);
}
