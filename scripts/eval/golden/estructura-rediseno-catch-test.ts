// ============================================================================
// GOLDEN · LA ESTRUCTURA DEL INFORME — catch-test (10-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §2.
//
// La estructura de hoy son secciones de color alternado a sangre. La del contrato es
// papel continuo con DOS cajas: el hero y la recomendación. La diferencia no es
// decorativa — es lo que dice qué hay que leer y qué hay que hojear.
//
// Fija SEIS cosas:
//
//   1. SOLO EL HERO PIDE CAJA HOY. `caja` se emite en un único call site. La
//      recomendación es la otra caja del contrato, pero hoy se monta DENTRO del hero
//      (`HeroLTR` monta `PosicionFranco`): sale a su propia sección en 4c. Este tier
//      fija el número esperado, así que cuando 4c la saque hay que subirlo a mano —
//      que es exactamente la conversación que tiene que pasar.
//
//   2. LA ALTERNANCIA MUERE, Y LE GANA A `.doc-sec.p2`. Las secciones sueltas dejan de
//      pintar fondo. `.doc-sec.p2{background:var(--doc-inset-0)}` tiene la MISMA
//      especificidad que `.doc-r2 .doc-sec` y va después en el archivo, así que la
//      regla del rediseño necesita `.p2` en su propio selector o no pinta nada. Medido
//      en el DOM: sin `.p2` la sección `la-inversion` conservaba su fondo.
//
//   3. LAS DOS FORMAS DEL SELECTOR DEL MARCO. Retirar la sombra huérfana de
//      `.doc-dictamen` exige `.doc-r2.doc-dictamen` (producción: las dos clases en el
//      mismo elemento) Y `.doc-r2 .doc-dictamen` (ruta dev: `.doc-r2` envuelve desde
//      afuera). Con una sola, la ruta de prueba miente. Es la trampa de
//      `docs/wireframes/rediseno-informe/entorno-de-prueba-no-es-produccion.md`.
//
//   4. LA SEPARACIÓN ES ESPACIO, NO COLOR: 38 px entre secciones sueltas, 34 entre
//      cajas, y la última sin margen. Si alguien vuelve a poner `padding` de sangrado
//      en `.doc-sec` dentro del rediseño, el papel continuo se rompe.
//
//   5. EL ANCHO DEL CONTRATO ES 700 px sobre `.doc-page--secciones`.
//
//   6. EL ANDAMIO `--doc-inset` NO SE RETIRA. En el camino nuevo se queda sin trabajo,
//      pero el camino de prosa vieja es PERMANENTE para 453 filas anónimas y lo sigue
//      usando. Borrarlo «porque ya no hace falta» rompe la mitad del parque.
//
// Corre dentro del QUICK (tier "estructura-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/estructura-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8"); } catch { return ""; } };

const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const GRID = leer("src/components/analysis/SubjectCardGrid.tsx");
const SECCION = leer("src/components/analysis/SeccionInforme.tsx");

/** El bloque §2, delimitado por su encabezado y el de la sección siguiente. */
const BLOQUE = (() => {
  const marca = CSS.indexOf("REDISEÑO · ESTRUCTURA");
  if (marca === -1) return "";
  // Desde el ABRE-COMENTARIO, no desde el rótulo: el rótulo vive DENTRO del comentario,
  // así que cortar ahí deja un `*/` huérfano y el stripper no lo reconoce como comentario.
  // La cola de ese comentario lleva comas y se cuela en el listado de selectores.
  const i = CSS.lastIndexOf("/*", marca);
  const j = CSS.indexOf("REDISEÑO · LAS TRES PRIMITIVAS", i);
  // SIN COMENTARIOS. Cada regla del bloque va precedida por su comentario, y los
  // comentarios llevan comas: sin sacarlos, el texto del comentario entra al listado de
  // selectores y ninguna regla se reconoce. La primera versión de este tier dio seis
  // fallas que eran todas del parser.
  return CSS.slice(i, j === -1 ? i + 4000 : j).replace(/\/\*[\s\S]*?\*\//g, "");
})();
if (!BLOQUE) F("0 · no existe el bloque «REDISEÑO · ESTRUCTURA» en la portada");

/** El cuerpo de la primera regla cuyo selector completo contenga exactamente `sel`.
 *  Compara selectores enteros —no substrings— para no confundir `.doc-r2 .doc-sec`
 *  con `.doc-r2 .doc-sec--caja`, que lo contiene como prefijo. */
function reglaDe(sel: string, txt = BLOQUE): string | null {
  for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (selectores.includes(sel)) return m[2];
  }
  return null;
}

// ── 1 · solo el hero pide caja ─────────────────────────────────────────────
{
  const CAJAS_ESPERADAS = 1; // sube a 2 cuando 4c saque la recomendación del hero
  const usos = [...GRID.matchAll(/<SeccionInforme\b[^>]*\bcaja\b/g)].length;
  if (usos !== CAJAS_ESPERADAS) {
    F(`1 · hay ${usos} secciones con «caja» y el tier espera ${CAJAS_ESPERADAS}. Si 4c sacó la recomendación del hero, subí la constante; si no, alguien le puso caja a una sección que el contrato deja suelta.`);
  }
  if (!/id="hero"[^>]*\bcaja\b/.test(GRID)) F("1 · el hero dejó de pedir caja: es una de las dos del contrato");
  if (!/caja\s*\?\s*" doc-sec--caja"/.test(SECCION)) F("1 · SeccionInforme no emite la clase doc-sec--caja");
}

// ── 2 · la alternancia muere, y le gana a .doc-sec.p2 ──────────────────────
{
  const suelta = reglaDe(".doc-r2 .doc-sec");
  if (!suelta) F("2 · no existe la regla de la sección suelta");
  else {
    if (!/background:\s*none/.test(suelta)) F("2 · la sección suelta volvió a pintar fondo: el papel es continuo");
    if (/padding:\s*(?!0)/.test(suelta)) F("2 · la sección suelta recuperó padding de sangrado");
  }
  if (reglaDe(".doc-r2 .doc-sec.p2") === null) {
    F("2 · falta «.doc-r2 .doc-sec.p2» en el selector de la sección suelta. `.doc-sec.p2` tiene la MISMA especificidad y va después: sin esto la sección alternada conserva su fondo, medido en el DOM.");
  }
  if (reglaDe(".doc-r2 .doc-sec--caja.p2") === null) {
    F("2 · falta «.doc-r2 .doc-sec--caja.p2»: el hero es p2, así que sin esa forma la caja pierde contra la regla de la suelta");
  }
}

// ── 3 · las dos formas del selector del marco ──────────────────────────────
for (const sel of [".doc-r2.doc-dictamen", ".doc-r2 .doc-dictamen"]) {
  const r = reglaDe(sel);
  if (r === null) {
    F(`3 · falta «${sel}» al retirar la sombra del marco. Hacen falta las DOS formas: en producción «.doc-r2» va en el mismo elemento, en la ruta dev envuelve desde afuera.`);
  } else if (!/box-shadow:\s*none/.test(r)) {
    F(`3 · «${sel}» ya no retira la sombra huérfana del marco: con ella el informe entero flota y las dos cajas dejan de destacarse`);
  }
}

// ── 4 · la separación es espacio ───────────────────────────────────────────
{
  const suelta = reglaDe(".doc-r2 .doc-sec") ?? "";
  const caja = reglaDe(".doc-r2 .doc-sec--caja") ?? "";
  const mb = (c: string) => Number((c.match(/margin-bottom:\s*(\d+)px/) ?? [])[1]);
  if (mb(suelta) !== 38) F(`4 · la separación entre secciones sueltas es ${mb(suelta) || "?"}px y el contrato pide 38`);
  if (mb(caja) !== 34) F(`4 · la separación de las cajas es ${mb(caja) || "?"}px y el contrato pide 34`);
  if (reglaDe(".doc-r2 .doc-sec:last-child") === null) F("4 · la última sección no anula su margen: deja un hueco al pie del informe");
}

// ── 5 · el ancho del contrato ──────────────────────────────────────────────
{
  const p = reglaDe(".doc-r2 .doc-page--secciones");
  if (!p) F("5 · no se fija el ancho de la página de secciones");
  else if (!/max-width:\s*700px/.test(p)) F(`5 · el ancho no es 700px: «${p.trim().slice(0, 60)}»`);
}

// ── 6 · el andamio --doc-inset sigue en pie ────────────────────────────────
{
  // Los tres contextos NO viven en el mismo archivo: `.v-modal` declara su escalera en
  // HallazgosAcordeon. Contar solo la portada da 6 y parece un andamio a medio retirar.
  const conInsets = CSS + leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx");
  const decls = [...conInsets.matchAll(/--doc-inset-[0-2]\s*:/g)].length;
  if (decls < 9) {
    F(`6 · quedan ${decls} declaraciones de --doc-inset y hacen falta 9 (tres contextos × tres niveles). El camino de prosa vieja es PERMANENTE para 453 filas anónimas y lo sigue usando.`);
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runEstructuraRedisenoTier(): { hard: number } {
  console.log("\n─── TIER ESTRUCTURA-REDISEÑO (contrato §2 · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — una sola caja (el hero), la alternancia muerta con la especificidad resuelta, el marco sin sombra en las dos formas del selector, 38/34 px de separación, 700 px de ancho y el andamio --doc-inset en pie");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runEstructuraRedisenoTier();
  process.exit(hard ? 1 : 0);
}
