// ============================================================================
// GOLDEN · LA REGULACIÓN YA NO PESA — catch-test (11-sep-2026). 0 tokens, sin base.
// ============================================================================
// Decisión V1 (Fabrizio, 11-sep-2026): la regulación del edificio se retira del producto.
// No se pregunta, no se muestra y no pesa. En el score vale «sí» para todo el parque —la
// constante queda con acta hasta el rediseño del score STR— y el gate g1_regulacion se
// retira. Costo asumido: cambian 4 veredictos, todos suben (la fila «no» y tres «no seguro»).
//
// Este tier fija TRES cosas sobre la fila «no» del golden (el fixture frozen de GE-3, la
// misma fila que la síntesis `reg_no` volvía BUSCAR OTRA por el gate) y sobre una «sí» (GE-1):
//
//   1. EL GATE NO EXISTE. `G1_BRAZOS` no lo lista y los brazos evaluados no lo traen: el
//      veredicto de una fila «no» sale de sus números, no de un input que ya no se pide.
//   2. NO PESA. Con el input en «no», en «no_seguro» y en «sí» el score y el veredicto son
//      IDÉNTICOS: la dimensión no lee el campo.
//   3. NI COMO CONSTANTE (23-sep-2026). Hasta hoy la regla era «las "sí" quedan byte-idénticas»:
//      la constante valía lo que valía «sí» (100 × 0,25 de la factibilidad). La factibilidad pasó
//      a medir la demanda de la zona y la constante salió (tier `factibilidad-demanda`), así que
//      lo que se fija ahora es que no exista.
//
// Verificado EN ROJO antes del retiro: (1) y (2) caían con el motor viejo.
//   node --import tsx scripts/eval/golden/regulacion-no-pesa-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, G1_BRAZOS, type FrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { loadFrozen } from "./str-seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const ASOF = new Date("2026-01-01T00:00:00Z");

/** Score de un fixture frozen con la regulación forzada. El cast es deliberado: antes del
 *  retiro el campo existía en `ScoreSTRInputs`; después no, y el test tiene que compilar en
 *  los dos mundos para poder verse en rojo. */
function scoreCon(key: string, regulacion: string): FrancoScoreSTR | null {
  const fx = loadFrozen()[key];
  if (!fx) return null;
  const ctx = buildStrRecomputeCtx(fx.input_data as Record<string, unknown>, { airbnbRaw: fx.airbnbRaw }, fx.uf);
  if (!ctx) return null;
  const result = calcShortTerm(ctx.inputs, ASOF);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extras: any = { ...ctx.scoreExtras, regulacionEdificio: regulacion };
  return calcFrancoScoreSTR({ ...extras, results: result, precioCompra: ctx.inputs.precioCompra });
}

// ── 1 · el gate no existe ─────────────────────────────────────────────────
{
  if ((G1_BRAZOS as readonly string[]).includes("g1_regulacion")) F("1 · G1_BRAZOS sigue listando g1_regulacion");
  const no = scoreCon("GE-3", "no");
  if (!no) F("1 · el fixture frozen GE-3 (la fila «no» del golden) no se pudo recomputar");
  else {
    if ("g1_regulacion" in no.gates.brazos) F("1 · los brazos evaluados siguen trayendo g1_regulacion");
    if ((no.gates.motivos as readonly string[]).includes("g1_regulacion")) F("1 · el veredicto de la fila «no» sigue decidido por la regulación");
  }
}

// ── 2 · no pesa: «no», «no_seguro» y «sí» dan lo mismo ────────────────────
{
  const no = scoreCon("GE-3", "no");
  const ns = scoreCon("GE-3", "no_seguro");
  const si = scoreCon("GE-3", "si");
  if (!no || !ns || !si) F("2 · GE-3 no se pudo recomputar en las tres variantes");
  else {
    if (no.score !== si.score) F(`2 · la fila «no» pesa distinto que «sí»: ${no.score} vs ${si.score}`);
    if (ns.score !== si.score) F(`2 · «no_seguro» pesa distinto que «sí»: ${ns.score} vs ${si.score}`);
    if (no.veredicto !== si.veredicto) F(`2 · el veredicto cambia con la regulación: «no» ${no.veredicto} vs «sí» ${si.veredicto}`);
    if (no.desglose.factibilidad.score !== si.desglose.factibilidad.score) F("2 · la factibilidad sigue leyendo la regulación");
  }
}

// ── 3 · ni como constante: la regulación no ocupa ningún lugar en la factibilidad ─
{
  const motor = readFileSync(join(process.cwd(), "src/lib/engines/short-term-score.ts"), "utf-8").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  if (/PUNTAJE_REGULACION_RETIRADA|puntajeRegulacion|regulacion/i.test(motor)) F("3 · la regulación sigue en el código del score, como constante o como lectura");
}

export function runRegulacionNoPesaTier(): { hard: number } {
  console.log("\n─── TIER REGULACIÓN NO PESA (retiro V1 · short-term-score.ts, 0 tokens, sin base) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — sin gate g1_regulacion, «no» = «no_seguro» = «sí» en score y veredicto, y la regulación fuera del score, también como constante");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRegulacionNoPesaTier();
  process.exit(hard ? 1 : 0);
}
