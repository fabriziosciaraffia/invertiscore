// ============================================================================
// GOLDEN · /metodologia DICE LO QUE HACE EL MOTOR — catch-test (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// Estructura aprobada por Fabrizio: una página corta —qué mide Franco, de dónde salen los datos y
// qué no hace—, sin fórmulas ni pesos, con el enlace a «Cómo se calcula» del informe de ejemplo. Lo
// que afirma del motor tiene que ser cierto hoy y leerse del motor (src/lib/metodologia.ts).
//
// FIJA, verificado EN ROJO por mutación (acta al pie):
//   1 · QUÉ ENTRA AL PUNTAJE son las claves de `PESOS_SCORE_LTR` / `PESOS_SCORE_STR`, ni una más ni
//       una menos, y ningún rótulo lleva un peso (un porcentaje).
//   2 · EL HORIZONTE es `HORIZONTE_SALIDA_ANIOS`, el mismo en renta corta (`HORIZONTE_DEFAULT`), y
//       el motor lo usa: `calcExitScenario` no recibe un 10 escrito a mano.
//   3 · LAS REGLAS son las del informe (`REGLAS_LTR` / `REGLAS_STR` de no-cierra-copy.ts) y el
//       filtro del descuento lee `AJUSTAR_DESCUENTO_MAX_PCT`.
//   4 · LA PÁGINA no escribe a mano un porcentaje ni un horizonte en años, no habla de pesos ni
//       del reglamento (salió del puntaje el 11-sep), y dibuja lo que lee de src/lib/metodologia.ts.
//   5 · EL ENLACE a «Cómo se calcula» existe (`/demo?calculo=1`) y el informe lo abre al llegar.
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/metodologia-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PESOS_SCORE_LTR, PESOS_SCORE_STR } from "../../../src/lib/score-retorno";
import { HORIZONTE_SALIDA_ANIOS } from "../../../src/lib/analysis";
import { HORIZONTE_DEFAULT } from "../../../src/lib/engines/short-term-engine";
import { REGLAS_LTR, REGLAS_STR } from "../../../src/lib/no-cierra-copy";
import { AJUSTAR_DESCUENTO_MAX_PCT } from "../../../src/lib/ajustar-sin-camino";
import { DIMENSIONES_LTR, DIMENSIONES_STR, HORIZONTE, REGLAS } from "../../../src/lib/metodologia";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const mismas = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export function runMetodologiaTier(): { hard: number } {
  console.log("\n─── TIER METODOLOGÍA (lo que la página dice del motor, leído del motor · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · las dimensiones del puntaje, sin pesos ──
  if (!mismas(Object.keys(DIMENSIONES_LTR), Object.keys(PESOS_SCORE_LTR))) F(`1 · renta larga: la página lista ${Object.keys(DIMENSIONES_LTR).join(", ")} y el motor puntúa ${Object.keys(PESOS_SCORE_LTR).join(", ")}`);
  if (!mismas(Object.keys(DIMENSIONES_STR), Object.keys(PESOS_SCORE_STR))) F(`1 · renta corta: la página lista ${Object.keys(DIMENSIONES_STR).join(", ")} y el motor puntúa ${Object.keys(PESOS_SCORE_STR).join(", ")}`);
  for (const [k, t] of [...Object.entries(DIMENSIONES_LTR), ...Object.entries(DIMENSIONES_STR)]) {
    if (/\d+(?:[.,]\d+)?\s*%/.test(t)) F(`1 · el rótulo de «${k}» lleva un porcentaje: sin pesos («${t}»)`);
    if (!t.trim()) F(`1 · la dimensión «${k}» no tiene rótulo`);
  }

  // ── 2 · el horizonte ──
  if (HORIZONTE !== HORIZONTE_SALIDA_ANIOS) F(`2 · la página dice ${HORIZONTE} años y el motor sale a ${HORIZONTE_SALIDA_ANIOS}`);
  if (HORIZONTE_DEFAULT !== HORIZONTE_SALIDA_ANIOS) F(`2 · renta corta proyecta a ${HORIZONTE_DEFAULT} años y renta larga sale a ${HORIZONTE_SALIDA_ANIOS}: la página diría uno solo`);
  const an = sinComentarios(leer("src/lib/analysis.ts"));
  if (!/export function calcExitScenario\([^)]*anios: number = HORIZONTE_SALIDA_ANIOS\)/.test(an)) F("2 · calcExitScenario no toma el horizonte de la constante");
  const aMano = an.match(/calcExitScenario\([^()]*,\s*\d+\s*\)/g) ?? [];
  if (aMano.length) F(`2 · el motor llama a calcExitScenario con un horizonte escrito a mano (${aMano[0]})`);

  // ── 3 · las reglas, con las palabras del informe ──
  if (REGLAS.ltrABuscarOtra !== REGLAS_LTR.aBuscarOtra || REGLAS.strABuscarOtra !== REGLAS_STR.aBuscarOtra || REGLAS.ltrDeComprarAAjustar !== REGLAS_LTR.deComprarAAjustar) {
    F("3 · las reglas de la página no son las de no-cierra-copy.ts: el informe y la página dirían cosas distintas");
  }
  if (REGLAS_LTR.aBuscarOtra.length !== 4) F(`3 · renta larga tiene cuatro reglas que bajan a Buscar otro y la página lee ${REGLAS_LTR.aBuscarOtra.length}`);
  if (!REGLAS.filtroDescuento.includes(`${AJUSTAR_DESCUENTO_MAX_PCT}%`)) F(`3 · el filtro del descuento no dice ${AJUSTAR_DESCUENTO_MAX_PCT}%`);
  const lib = sinComentarios(leer("src/lib/metodologia.ts"));
  if (!/filtroDescuento: `[^`]*\$\{DESCUENTO_MAX_PCT\}%/.test(lib) || !/export const DESCUENTO_MAX_PCT = AJUSTAR_DESCUENTO_MAX_PCT;/.test(lib)) F("3 · el 20% del filtro está escrito a mano: tiene que leer AJUSTAR_DESCUENTO_MAX_PCT");
  if (!/export const HORIZONTE = HORIZONTE_SALIDA_ANIOS;/.test(lib)) F("2 · el horizonte de la página está escrito a mano");

  // ── 4 · la página ──
  const pag = sinComentarios(leer("src/app/metodologia/page.tsx"));
  if (!/from "@\/lib\/metodologia";/.test(pag)) F("4 · la página no lee src/lib/metodologia.ts");
  for (const uso of ["DIMENSIONES_LTR", "DIMENSIONES_STR", "REGLAS.ltrABuscarOtra", "REGLAS.ltrDeComprarAAjustar", "REGLAS.strABuscarOtra", "REGLAS.filtroDescuento", "{HORIZONTE}", "PLUSVALIA_PCT"]) {
    if (!pag.includes(uso)) F(`4 · la página no dibuja ${uso}`);
  }
  // el texto de la página, sin las expresiones {…}: ahí no puede haber cifras escritas a mano
  const texto = pag.replace(/\{[^{}]*\}/g, " ");
  const pct = texto.match(/\d+(?:[.,]\d+)?\s*%/);
  if (pct) F(`4 · la página escribe un porcentaje a mano («${pct[0]}»): tiene que leerlo del motor`);
  const anios = texto.match(/\b\d+\s+años\b/);
  if (anios) F(`4 · la página escribe un horizonte a mano («${anios[0]}»)`);
  if (/PESOS_SCORE|\bpesos? del puntaje\b|\bponderaci/i.test(pag)) F("4 · la página habla de los pesos del puntaje: sin fórmulas ni pesos");
  if (/reglamento|arriendo por d[ií]as|permite arrendar/i.test(pag)) F("4 · la página vuelve a hablar del reglamento o del arriendo por días (salió del puntaje el 11-sep)");
  if (!/<HeaderFranco\b/.test(pag)) F("4 · la página no monta el header único");

  // ── 5 · el enlace a «Cómo se calcula» ──
  if (!/href="\/demo\?calculo=1"/.test(pag)) F("5 · falta el enlace a «Cómo se calcula» del informe de ejemplo (/demo?calculo=1)");
  const grid = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  if (!/useEffect\(\(\) => \{\s*\n\s*if \(new URLSearchParams\(window\.location\.search\)\.get\("calculo"\) === "1"\) setCalculoAbierto\(true\);\s*\n\s*\}, \[\]\);/.test(grid)) {
    F("5 · el informe no abre «Cómo se calcula» con ?calculo=1: el enlace llevaría a un informe cerrado");
  }
  if (!/<InformeLtr id=\{DEMO_LTR_ID\} demo \/>/.test(sinComentarios(leer("src/app/demo/page.tsx")))) F("5 · /demo ya no dibuja el informe de renta larga");

  if (fallas.length) {
    console.log(`  ✗ METODOLOGÍA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — la página lista las ${Object.keys(PESOS_SCORE_LTR).length} dimensiones de renta larga y las ${Object.keys(PESOS_SCORE_STR).length} de renta corta sin pesos, el horizonte de ${HORIZONTE_SALIDA_ANIOS} años del motor, las reglas del informe y el ${AJUSTAR_DESCUENTO_MAX_PCT}% del filtro, sin cifras a mano ni reglamento, y enlaza a «Cómo se calcula», que el informe abre al llegar`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMetodologiaTier();
  process.exit(hard ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (27-sep-2026) — ver scripts de la sesión; cada una en ROJO y restaurada:
//   M1 un peso en un rótulo («Rentabilidad (20%)») · M2 una dimensión menos · M3 «10 años» escrito
//   en la página · M4 el filtro con «20%» escrito a mano · M5 calcExitScenario con 10 a mano ·
//   M6 renta corta a 12 años · M7 una frase del reglamento · M8 sin el efecto de ?calculo=1 ·
//   M9 sin el enlace · M10 las reglas copiadas en vez de leídas.
// ─────────────────────────────────────────────────────────────────────────────
