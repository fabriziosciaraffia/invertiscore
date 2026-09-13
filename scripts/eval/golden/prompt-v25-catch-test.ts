/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · PROMPT LTR v25 — el prompt recibe las seis dimensiones — catch-test (12-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El score tiene seis dimensiones desde el 12-sep-2026 (cash-on-cash y TIR ponderadas,
// `score-retorno.ts`) y el prompt LTR le seguía dando al modelo las cuatro viejas con nombre
// y puntaje: la prosa se escribía sin saber que el retorno sobre lo puesto pesa, y sin poder
// nombrarlo. El bump 24 → 25 mete las seis (con sus pesos) en el user prompt y una
// instrucción en el system sobre cómo leerlas en vocabulario del lector.
//
// Fija CINCO cosas:
//
//   1. LA VERSIÓN ES 25. El sello de la prosa y la invalidación lazy cuelgan de ella.
//
//   2. EL USER PROMPT LLEVA LAS SEIS con nombre, puntaje y pesos, y el caso pie cero dice
//      que la TIR no aplica y reparte su peso. Se fija sobre el TEMPLATE (el user prompt
//      se arma inline en `generateAiAnalysis` y no está exportado): las seis claves del
//      desglose y la lista de pesos tienen que estar en la línea de subscores.
//
//   3. EL SYSTEM EXPLICA LAS DOS NUEVAS en vocabulario del lector —«por cada $100 que
//      pones…»— y dice qué hacer cuando la TIR no aplica sin pie. El system se mueve: su
//      hash cambia con este bump.
//
//   4. EL GUARD DE PUNTAJES (espejo de `cifrasFueraDeInput`): si la prosa cita un sub-score,
//      un «NN/100» o un peso que no está en el desglose del user prompt, falla dura.
//      SOLO CON SUJETO (decisión Fabrizio, 12-sep-2026): dispara sobre las formas explícitas
//      —«NN/100», «NN de 100», «sub-score de X … NN», «pesa NN %», «peso NN %», «NN % del
//      score»— y nunca sobre un número pelado, que ya vigila el guard de cifras.
//
//   5. EL GUARD ESTÁ CABLEADO en el generador con su reintento y su marca de
//      sobrevivientes, como CATCH-MIX y CATCH-COMUNA.
//
// Corre dentro del QUICK (tier "prompt-v25") y standalone:
//   node --env-file=.env.local --import tsx scripts/eval/golden/prompt-v25-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_VERSION_LTR, SYSTEM_PROMPT } from "../../../src/lib/ai-generation";
import { puntajesFueraDeDesglose } from "../../../src/lib/cifras-guard";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
const GEN = leer("src/lib/ai-generation.ts");

// ── 1 · la versión ──────────────────────────────────────────────────────────
if (PROMPT_VERSION_LTR !== 25) F(`1 · PROMPT_VERSION_LTR = ${PROMPT_VERSION_LTR}, esperado 25`);

// ── 2 · el user prompt: las seis, con pesos, y el pie cero ─────────────────
{
  const i = GEN.indexOf("- subscores (");
  const linea = i === -1 ? "" : GEN.slice(i, GEN.indexOf("\n", i));
  if (!linea) F("2 · no se encontró la línea «- subscores (» del user prompt");
  for (const k of ["d.rentabilidad", "d.flujoCaja", "d.cashOnCash", "d.tir", "d.plusvalia", "d.eficiencia"]) {
    if (!linea.includes(k)) F(`2 · la línea de subscores no lleva «${k}»`);
  }
  if (!/retorno sobre lo puesto/.test(linea)) F("2 · la línea de subscores no nombra «retorno sobre lo puesto» (el nombre que lee el lector, no cashOnCash)");
  if (!/PESOS_SCORE_LTR/.test(linea)) F("2 · los pesos no salen de PESOS_SCORE_LTR: hardcodearlos en el prompt es tener la verdad dos veces");
  if (!/no aplica/.test(linea)) F("2 · la línea de subscores no contempla la TIR sin pie («no aplica … su peso se reparte»)");
  if (!/las dos que más suman: \$\{dimsQueSuman\}/.test(linea) || !/las dos que más restan: \$\{dimsQueRestan\}/.test(linea)) F("2 · la línea de subscores no declara «las dos que más suman» y «las dos que más restan» (el motor las nombra; el modelo no las infiere)");
  if (!/const dimsRank = DIMS_NOMBRE\.filter/.test(GEN) || !/typeof x\[1\] === "number"/.test(GEN)) F("2 · el ranking de dimensiones no excluye la TIR sin aplicar (null)");
}

// ── 3 · el system explica las dos nuevas en vocabulario del lector ─────────
{
  if (!/EL SCORE MIRA EL RETORNO SOBRE LO QUE PONES/.test(SYSTEM_PROMPT)) F("3 · el system no trae el bloque «EL SCORE MIRA EL RETORNO SOBRE LO QUE PONES»");
  if (!/por cada \$100 que pones/.test(SYSTEM_PROMPT)) F("3 · el system no explica el cash-on-cash como «por cada $100 que pones…»");
  if (!/pesos 20\/20\/20\/10\/17\/13/.test(SYSTEM_PROMPT)) F("3 · el system no declara los seis pesos (20/20/20/10/17/13)");
  if (!/TIR no aplica/i.test(SYSTEM_PROMPT)) F("3 · el system no dice qué hacer cuando la TIR no aplica sin pie");
  if (!/no calcules ni redondees/i.test(SYSTEM_PROMPT)) F("3 · el system no prohíbe recalcular o redondear puntajes y pesos");
  if (!/«las dos que más suman» y «las dos que más restan»/.test(SYSTEM_PROMPT) || !/NÓMBRALO en conviene\.cajaAccionable/.test(SYSTEM_PROMPT) || !/n[óo]mbrala TAMBI[ÉE]N, no en vez de/.test(SYSTEM_PROMPT)) F("3 · el system no manda nombrar retorno sobre lo puesto o TIR cuando el input las pone entre las que más suman o más restan");
}

// ── 4 · el guard de puntajes, con sujeto ───────────────────────────────────
{
  const userPrompt = [
    "INDICADORES CALCULADOS",
    "- Franco Score: 74/100",
    "- subscores (referenciar como \"sub-score de X\" si los mencionas; el score total es 74, único): rentabilidad 85/100 · flujo caja 84/100 · retorno sobre lo puesto 78/100 · TIR 87/100 · plusvalia 69/100 · eficiencia 30/100 · pesos 20/20/20/10/17/13",
    "- Rentabilidad bruta: 6,3%",
  ].join("\n");
  const ok = { conviene: { cajaAccionable: "El sub-score de plusvalía (69/100) y el retorno sobre lo puesto (78 de 100) sostienen el 74/100; el flujo pesa 20% del score. Con $650.000 de arriendo y un 25% de pie, cierra." } };
  const v0 = puntajesFueraDeDesglose(userPrompt, ok);
  if (v0.length) F(`4 · el guard dispara sobre puntajes que SÍ están en el desglose: ${v0.join(" | ")}`);
  const inventado = { conviene: { cajaAccionable: "El sub-score de flujo de caja es 23/100, el más débil." } };
  const v1 = puntajesFueraDeDesglose(userPrompt, inventado);
  if (v1.length !== 1 || !/23/.test(v1[0])) F(`4 · un sub-score inventado (23/100) tenía que dar UNA violación: ${JSON.stringify(v1)}`);
  const pesoInventado = { conviene: { cajaAccionable: "La plusvalía pesa 35% del score y no compensa." } };
  const v2 = puntajesFueraDeDesglose(userPrompt, pesoInventado);
  if (v2.length !== 1 || !/35/.test(v2[0])) F(`4 · un peso inventado (35 %) tenía que dar UNA violación: ${JSON.stringify(v2)}`);
  const subscoreSinBarra = { conviene: { cajaAccionable: "El sub-score de eficiencia queda en 41 y arrastra." } };
  const v3 = puntajesFueraDeDesglose(userPrompt, subscoreSinBarra);
  if (v3.length !== 1 || !/41/.test(v3[0])) F(`4 · «sub-score de eficiencia queda en 41» tenía que dar UNA violación: ${JSON.stringify(v3)}`);
  const sinSujeto = { conviene: { cajaAccionable: "Pones $23 millones y a los 41 meses recuperas el pie; la comuna subió 35% en diez años." } };
  const v4 = puntajesFueraDeDesglose(userPrompt, sinSujeto);
  if (v4.length) F(`4 · números sin sujeto de puntaje (millones, meses, plusvalía en %) NO son del guard: ${v4.join(" | ")}`);
  const tirNoAplica = userPrompt.replace("TIR 87/100", "TIR no aplica (sin pie: su peso se reparte)");
  const v5 = puntajesFueraDeDesglose(tirNoAplica, ok);
  if (v5.length) F(`4 · con la TIR sin aplicar, los demás puntajes del prompt siguen siendo permitidos: ${v5.join(" | ")}`);
}

// ── 5 · cableado en el generador ───────────────────────────────────────────
{
  if (!/puntajesFueraDeDesglose\(userPrompt, aiResult\)/.test(GEN)) F("5 · el generador LTR no corre puntajesFueraDeDesglose sobre la prosa");
  if (!/\[LTR-PUNTAJE\]/.test(GEN)) F("5 · el guard de puntajes no tiene su etiqueta de log [LTR-PUNTAJE] (como [LTR-CIFRA] y [LTR-COMUNA])");
  if (!/_puntajesFueraDeDesglose/.test(GEN)) F("5 · las violaciones que sobreviven al reintento no quedan marcadas en `_puntajesFueraDeDesglose`");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runPromptV25Tier(): { hard: number } {
  console.log("\n─── TIER PROMPT-V25 (las seis dimensiones al prompt · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — versión 25, las seis dimensiones con pesos y el pie cero en el user prompt, el system las explica en vocabulario del lector, y el guard de puntajes con sujeto está cableado con reintento");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPromptV25Tier();
  process.exit(hard ? 1 : 0);
}
