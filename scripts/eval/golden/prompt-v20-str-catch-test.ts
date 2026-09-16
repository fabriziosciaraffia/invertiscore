/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · PROMPT STR v20 — el prompt recibe las seis dimensiones — catch-test (12-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// Espejo del bump LTR v25. El score STR tiene cash-on-cash y TIR como dimensiones
// ponderadas (`score-retorno.ts`, pesos 15/20/20/20/15/10) y el user prompt seguía
// mostrando CUATRO: rentabilidad, sostenibilidad, ventaja y factibilidad. El modelo
// explicaba un veredicto sin saber que el retorno sobre lo puesto pesa el 15% ni que
// la TIR pesa el 10%, y sin poder nombrarlos.
//
// Fija CINCO cosas:
//
//   1. LA VERSIÓN ES 20. El sello de la prosa y la invalidación lazy cuelgan de ella.
//
//   2. EL BLOQUE DEL SCORE LLEVA LAS SEIS, con su puntaje y con los pesos leídos de
//      `PESOS_SCORE_STR` —no hardcodeados, o la verdad viviría en dos lados— y con el
//      caso pie cero: sin capital propio la TIR no aplica y reparte su peso, y el
//      retorno sobre lo puesto es el rendimiento neto sobre el precio.
//
//   3. EL MOTOR DICE CUÁLES MANDAN. «Las dos que más suman» y «las dos que más restan»
//      salen calculadas del desglose, no inferidas por el modelo (la lección del v25:
//      sin el ranking explícito la prosa elige los extremos por su cuenta).
//
//   4. EL SYSTEM EXPLICA LAS DOS NUEVAS en vocabulario del lector y manda nombrarlas
//      cuando el input las pone entre las que mandan. Con pie 0 la TIR no se nombra
//      como dimensión (§5.bis ya prohíbe celebrar métricas sobre capital).
//
//   5. LA SALIDA COMBINADA SIGUE LEYENDO DEL MOTOR. El bloque SALIDA COMBINADA se arma
//      desde `salidaPorMixStr`, la misma fuente que la card, así que la celda nueva
//      —la de mayor retorno— llega al prompt sin tocar nada. Si alguien lo desconecta
//      para hardcodear la combinación, esto lo caza.
//
// Corre dentro del QUICK (tier "prompt-v20-str") y standalone:
//   node --import tsx scripts/eval/golden/prompt-v20-str-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_VERSION_STR, SYSTEM_PROMPT_STR } from "../../../src/lib/ai-generation-str";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const GEN = leer("src/lib/ai-generation-str.ts");

// ── 1 · la versión ──────────────────────────────────────────────────────────
// ⛔ Esto pineaba `!== 20` y se ponía ROJO SOLO cada vez que alguien bumpeaba el prompt
// por una razón legítima — el 16-sep-2026 lo hizo con el bump a v21 (retiro del
// contrafáctico de gestión). Es el antipatrón que `CLAUDE.md` § Testing nombra: FIJABA LA
// CIFRA, NO LA REGLA. La regla real es que las cinco cosas que este tier vigila entraron
// en v20 y no pueden RETROCEDER: una versión anterior no las tendría.
if (PROMPT_VERSION_STR < 20) F(`1 · PROMPT_VERSION_STR = ${PROMPT_VERSION_STR}, y las seis dimensiones entraron en la 20`);

// ── 2 · el bloque del score lleva las seis, con pesos del motor ─────────────
{
  const i = GEN.indexOf("=== FRANCO SCORE STR:");
  const bloque = i === -1 ? "" : GEN.slice(i, i + 2600);
  if (!bloque) F("2 · no se encontró el bloque «=== FRANCO SCORE STR:» del user prompt");
  for (const k of ["desglose.rentabilidad", "desglose.sostenibilidad", "desglose.ventaja", "desglose.factibilidad", "desglose.cashOnCash", "desglose.tir"]) {
    if (!bloque.includes(k)) F(`2 · el bloque del score no lleva «${k}»`);
  }
  if (!/Retorno sobre lo puesto|retorno sobre lo puesto/.test(bloque)) F("2 · el bloque no nombra «retorno sobre lo puesto» (el nombre que lee el lector, no cashOnCash)");
  if (!/PESOS_SCORE_STR/.test(bloque)) F("2 · los pesos no salen de PESOS_SCORE_STR: hardcodearlos es tener la verdad dos veces");
  if (!/aplica/.test(bloque)) F("2 · el bloque no contempla la TIR sin pie (`aplica: false` ⇒ no aplica y reparte su peso)");
}

// ── 3 · el motor dice cuáles mandan ────────────────────────────────────────
{
  if (!/dimsQueSumanStr|las dos que más suman/.test(GEN)) F("3 · el user prompt STR no declara «las dos que más suman»");
  if (!/dimsQueRestanStr|las dos que más restan/.test(GEN)) F("3 · el user prompt STR no declara «las dos que más restan»");
  if (!/\.filter\(\(x\): x is \[string, number\] => typeof x\[1\] === "number"\)/.test(GEN) && !/aplica !== false/.test(GEN)) {
    F("3 · el ranking de dimensiones STR no excluye la que no aplica (la TIR sin pie no entra al ranking)");
  }
}

// ── 4 · el system explica las dos nuevas ───────────────────────────────────
{
  if (!/EL SCORE MIRA EL RETORNO SOBRE LO QUE PONES/.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no trae el bloque «EL SCORE MIRA EL RETORNO SOBRE LO QUE PONES»");
  if (!/por cada \$100 que pones/.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no explica el cash-on-cash como «por cada $100 que pones…»");
  if (!/15\/20\/20\/20\/15\/10/.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no declara los seis pesos (15/20/20/20/15/10)");
  if (!/no calcules ni redondees/i.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no prohíbe recalcular o redondear puntajes y pesos");
  if (!/«las dos que más suman» y «las dos que más restan»/.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no usa el ranking que le manda el motor");
  if (!/N[ÓO]MBRALO/.test(SYSTEM_PROMPT_STR)) F("4 · el system STR no manda nombrar el retorno sobre lo puesto cuando manda");
  if (!/5\.bis/.test(SYSTEM_PROMPT_STR)) F("4 · el bloque nuevo no remite a §5.bis para el caso pie 0 (donde las métricas sobre capital no se celebran)");
}

// ── 5 · la salida combinada sigue leyendo del motor ────────────────────────
{
  if (!/salidaPorMixStr\(dv\)/.test(GEN)) F("5 · el user prompt STR ya no arma SALIDA COMBINADA desde `salidaPorMixStr`: la celda que elige el motor dejaría de llegar al modelo");
  if (!/mixAlEscalonStr\(dv\)/.test(GEN)) F("5 · el user prompt STR perdió `mixAlEscalonStr`: la combinación que llega solo al escalón dejaría de distinguirse");
  if (!/hayMixACOMPRAR/.test(GEN)) F("5 · el bloque SALIDA COMBINADA perdió `hayMixACOMPRAR`");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPromptV20StrTier(): { hard: number } {
  console.log("\n─── TIER PROMPT-V20-STR (las seis dimensiones al prompt STR · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log(`  ✓ VERDE — versión ${PROMPT_VERSION_STR} (≥ 20), las seis dimensiones con pesos del motor y el pie cero en el user prompt, el ranking lo manda el motor, el system las explica en vocabulario del lector y la salida combinada sigue leyendo la celda elegida`);
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPromptV20StrTier();
  process.exit(hard ? 1 : 0);
}
