// ============================================================================
// GOLDEN · «OTRA FUENTE» CON CRÉDITO EN EL MOTOR — catch-test (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// Entrega 2 del wizard (mockup aprobado, decisión 1): cuando el pie lo cubre otra fuente, para el
// banco ESO ES PIE —el wizard manda su monto en `piePct`— y, si esa otra fuente es un crédito, su
// cuota mensual (`cuotaCreditoPie`) entra al flujo del mes.
//
// FIJA:
//   1 · LTR: la cuota baja el flujo mensual exactamente su monto, sube los egresos, no toca la
//       cuota del hipotecario, entra al mes vacío y a cada año de la proyección —con la identidad
//       del desglose anual exacta—.
//   2 · STR: la cuota baja el flujo del escenario base exactamente su monto, no toca el NOI ni el
//       cap rate ni la cuota del hipotecario, sube el punto de equilibrio, viaja en el desglose del
//       capítulo II y baja cada año de la proyección.
//   3 · SIN CUOTA, NADA CAMBIA: el análisis sin el campo es idéntico al de cuota 0.
//   4 · EL CABLEADO: las ocho llamadas a `calcFlujoDesglose` la pasan, el pipeline STR la lee del
//       body, y el informe la dibuja como fila propia en LTR y STR.
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/otra-fuente-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis, calcMesVacio } from "../../../src/lib/analysis";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { fraseReparto } from "../../../src/lib/reparto-ingreso";
import { ltr, str, AUDIT_UF } from "../fixtures";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

const CUOTA = 520_000;
const AS_OF = new Date("2026-09-27T12:00:00Z");

export function runOtraFuenteTier(): { hard: number } {
  console.log("\n─── TIER OTRA-FUENTE (la cuota del crédito del pie en el flujo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · LTR ────────────────────────────────────────────────────────────────
  const baseL = ltr({ piePct: 20 });
  const sinL = runAnalysis(baseL, AUDIT_UF, undefined, AS_OF);
  const ceroL = runAnalysis({ ...baseL, cuotaCreditoPie: 0 }, AUDIT_UF, undefined, AS_OF);
  const conL = runAnalysis({ ...baseL, cuotaCreditoPie: CUOTA }, AUDIT_UF, undefined, AS_OF);
  const mS = sinL.metrics, mC = conL.metrics;
  if (mS.flujoNetoMensual - mC.flujoNetoMensual !== CUOTA) F(`1 · LTR: la cuota del pie baja el flujo ${mS.flujoNetoMensual - mC.flujoNetoMensual}, no ${CUOTA}`);
  if (mC.egresosMensuales - mS.egresosMensuales !== CUOTA) F("1 · LTR: la cuota del pie no suma a los egresos del mes");
  if (mC.dividendo !== mS.dividendo) F("1 · LTR: la cuota del pie cambió la cuota del hipotecario");
  if (calcMesVacio({ dividendo: 100, ggcc: 0, contribuciones: 0, cuotaCreditoPie: CUOTA }) !== 100 + CUOTA) F("1 · LTR: el mes vacío no suma la cuota del pie");
  const pS = sinL.projections ?? [], pC = conL.projections ?? [];
  if (!pS.length || pS.length !== pC.length) F("1 · LTR: no hay proyección que comparar (el extractor no corrió)");
  for (let i = 0; i < Math.min(pS.length, pC.length); i++) {
    const meses = pC[i].mesesOperativos ?? 12;
    const d = Math.round(pS[i].flujoAnual - pC[i].flujoAnual);
    if (d !== CUOTA * meses) { F(`1 · LTR: el año ${i + 1} de la proyección baja ${d}, no ${CUOTA * meses}`); break; }
    const y = pC[i];
    if (y.noiAnual != null && y.vacanciaRotacionAnual != null && y.dividendoAnual != null && Math.round(y.noiAnual - y.vacanciaRotacionAnual - y.dividendoAnual) !== Math.round(y.flujoAnual)) {
      F(`1 · LTR: con la cuota del pie, el desglose del año ${i + 1} no suma el flujo`); break;
    }
  }

  // ── 2 · STR ────────────────────────────────────────────────────────────────
  const baseS = str({ piePercent: 0.2 });
  const sinS = calcShortTerm(baseS, AS_OF);
  const ceroS = calcShortTerm({ ...baseS, cuotaCreditoPie: 0 }, AS_OF);
  const conS = calcShortTerm({ ...baseS, cuotaCreditoPie: CUOTA }, AS_OF);
  const bS = sinS.escenarios.base, bC = conS.escenarios.base;
  if (bS.flujoCajaMensual - bC.flujoCajaMensual !== CUOTA) F(`2 · STR: la cuota del pie baja el flujo ${bS.flujoCajaMensual - bC.flujoCajaMensual}, no ${CUOTA}`);
  if (bS.noiMensual !== bC.noiMensual || bS.capRate !== bC.capRate) F("2 · STR: la cuota del pie tocó el NOI o el cap rate (es egreso financiero, no operativo)");
  if (sinS.dividendoMensual !== conS.dividendoMensual) F("2 · STR: la cuota del pie cambió la cuota del hipotecario");
  if (!(conS.breakEvenPctDelMercado > sinS.breakEvenPctDelMercado)) F("2 · STR: la cuota del pie no sube el punto de equilibrio");
  if (conS.metrics?.desgloseFall?.cuotaCreditoPie !== CUOTA || conS.metrics?.desgloseFall?.saleDeTuBolsillo !== bC.flujoCajaMensual) F("2 · STR: el desglose del capítulo II no lleva la cuota del pie");
  const yS = sinS.projections ?? [], yC = conS.projections ?? [];
  if (!yS.length) F("2 · STR: no hay proyección que comparar (el extractor no corrió)");
  if (yS.length && yC.length && !(yC[1].flujoOperacionalAnual < yS[1].flujoOperacionalAnual)) F("2 · STR: la proyección no baja con la cuota del pie");

  // ── 3 · SIN CUOTA, NADA CAMBIA ─────────────────────────────────────────────
  if (JSON.stringify(sinL.metrics) !== JSON.stringify(ceroL.metrics)) F("3 · LTR: el análisis sin el campo difiere del de cuota 0");
  if (JSON.stringify(sinS.escenarios) !== JSON.stringify(ceroS.escenarios)) F("3 · STR: el análisis sin el campo difiere del de cuota 0");

  // ── 4 · EL CABLEADO ────────────────────────────────────────────────────────
  const motor = sinComentarios(leer("src/lib/analysis.ts"));
  if ((motor.match(/cuotaCreditoPie: input\.cuotaCreditoPie,/g) ?? []).length !== 4) F("4 · no todas las llamadas del motor LTR pasan la cuota del pie");
  if (!/const totalEgresos = [^;]*\+ cuotaCreditoPie;/.test(motor)) F("4 · la cuota del pie no entra a los egresos del desglose");
  const rc = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
  if ((rc.match(/cuotaCreditoPie: inputData!?\.cuotaCreditoPie,/g) ?? []).length !== 3) F("4 · el recompute del informe LTR no pasa la cuota del pie");
  const cap = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  if (!/\{ k: "Cuota del crédito del pie", v: d\.cuotaCreditoPie/.test(cap)) F("4 · el capítulo del flujo LTR no dibuja la cuota del pie");
  const capS = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
  if (!/\(fl\.cuotaCreditoPie \?\? 0\) > 0 && \(\s*\n\s*<FilaDato k="Cuota del crédito del pie"/.test(capS)) F("4 · el capítulo del flujo STR no dibuja la cuota del pie");
  const pipe = sinComentarios(leer("src/lib/api-helpers/analisis-pipeline.ts"));
  if (!/cuotaCreditoPie: typeof body\.cuotaCreditoPie === "number" && body\.cuotaCreditoPie > 0 \? body\.cuotaCreditoPie : undefined,/.test(pipe)) F("4 · el pipeline STR no lee la cuota del pie del body");

  // ── 5 · LA FRASE DEL REPARTO CUENTA LAS DOS CUOTAS (prueba de Fabrizio, 27-sep) ──
  // «La cuota sola se lleva el X%» usaba el dividendo solo mientras el capítulo mostraba las dos
  // cuotas como filas: la del pie quedaba escondida en «los gastos». Ahora la cuota del reparto es
  // la misma del capítulo y la frase nombra a las dos.
  const rL = conL.metrics.repartoIngreso, rL0 = sinL.metrics.repartoIngreso;
  if (!rL || rL.cuota !== mC.dividendo + CUOTA || rL.cuotaPie !== CUOTA) F(`5 · LTR: la cuota del reparto es ${rL?.cuota}, no la del crédito + la del pie (${mC.dividendo + CUOTA})`);
  if (!rL0 || rL0.cuota !== mS.dividendo || "cuotaPie" in rL0) F("5 · LTR: sin crédito del pie el reparto cambió");
  if (rL && rL0 && rL.costosOperar !== rL0.costosOperar) F("5 · LTR: la cuota del pie sigue escondida en «los gastos»");
  const money = (n: number) => `$${Math.round(n)}`;
  if (rL && !/^Las dos cuotas( solas)? —la del crédito y la del pie— se llevan el \d+%/.test(fraseReparto(rL, "los gastos", money).antes)) F(`5 · LTR: la frase no nombra las dos cuotas: «${rL && fraseReparto(rL, "los gastos", money).antes}»`);
  if (rL0 && !/^La cuota (sola )?se lleva el/.test(fraseReparto(rL0, "los gastos", money).antes)) F("5 · LTR: sin crédito del pie la frase cambió");
  const rS = conS.metrics?.repartoIngreso, rS0 = sinS.metrics?.repartoIngreso;
  if (!rS || rS.cuotaPie !== CUOTA || !/^Las dos cuotas/.test(fraseReparto(rS, "operar el depto", money).antes)) F("5 · STR: la frase del reparto no nombra las dos cuotas");
  if (!rS0 || "cuotaPie" in rS0 || (rS && rS0 && rS.cuota - rS0.cuota !== CUOTA)) F("5 · STR: el reparto sin crédito del pie cambió, o la cuota no suma la del pie");

  if (fallas.length) {
    console.log(`  ✗ OTRA-FUENTE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la cuota del crédito del pie baja el flujo exactamente su monto en LTR y STR, no toca el hipotecario ni el NOI, entra al mes vacío y a la proyección, y sin ella nada cambia");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runOtraFuenteTier().hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (27-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las 12 en ROJO; restauradas, VERDE. O1 la cuota fuera de los egresos · O2 la proyección no la
// pasa · O3 el desglose anual sin la cuota · O4 el mes vacío sin la cuota · O5 STR el escenario
// sin la cuota · O6 STR el equilibrio sin la cuota · O7 STR el desglose sin la cuota · O8 STR la
// proyección sin la cuota · O9 el pipeline no la lee · O10 STR sin la fila · O11 LTR sin la fila ·
// O12 el recompute del informe no la pasa.
//
// ACTAS del punto 5 (27-sep-2026, prueba de Fabrizio) — las 4 en ROJO; restauradas, VERDE.
// C1 el motor LTR no pasa la cuota del pie al reparto · C2 la frase no nombra las dos cuotas ·
// C3 STR vuelve a la suma sin nombrar · C4 el reparto sin crédito del pie gana una clave.
