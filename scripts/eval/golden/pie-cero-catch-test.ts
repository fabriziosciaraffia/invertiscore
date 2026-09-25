// ============================================================================
// GOLDEN · PIE CERO: MANDA EL FLUJO, Y UN BUSCAR OTRO NO TIENE SALIDA SIN DESCUENTO — catch-test
// (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio (actas en `ACTAS-pie-cero-manda-flujo.md`):
//
//   1 · CON PIE 0% LA DIMENSIÓN DE CAPITAL NO LEE LA RENTABILIDAD NETA: toma el puntaje del flujo.
//       Desde el 12-sep se rellenaba con el rendimiento neto sobre el precio y un depto que pierde
//       $371 mil al mes puntuaba como comprado al contado. Se verifica por METAMORFOSIS: moverle
//       la rentabilidad neta a las métricas no mueve la dimensión; moverle el flujo, sí.
//   2 · CON PIE 0% EL FILTRO QUE BAJA COMPRAR A AJUSTAR NO SE SALTA: aplica su brazo de flujo
//       (flujo bajo −5% del ingreso), igual con bono pie, otra fuente, sin declarar o sin pie.
//   3 · NINGÚN BUSCAR OTRO TIENE UNA COMBINACIÓN DE PIE Y PLAZO SIN DESCUENTO QUE LLEGUE A
//       COMPRAR, dentro de los topes de la grilla (pie hasta 30%, plazo hasta 30): se barren las
//       seeds del golden y las filas del parque congeladas, sondeando cada combinación con el
//       motor sin rescate. Las filas que el rescate saca de BUSCAR quedan en AJUSTA —el filtro
//       del descuento no las devuelve— y nombran la combinación.
//
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/pie-cero-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis, dimensionesScoreLtr, deriveVeredicto, sondaConPatch } from "../../../src/lib/analysis";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { calcCashOnCashDim } from "../../../src/lib/engines/short-term-score";
import { combinacionesSinDescuento, rescatarPorPieYPlazo } from "../../../src/lib/rescate-pie-plazo";
import { metricaNoAplica, metricaValor, type RazonSinCapital, type Veredicto } from "../../../src/lib/types";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { STR_GE_SEEDS, loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Cuerpo de una función (desde su firma hasta la llave que la cierra), sin comentarios. */
function cuerpo(src: string, firma: RegExp): string {
  const m = src.match(firma);
  if (!m || m.index == null) return "";
  const abre = src.indexOf("{", m.index + m[0].length - 1);
  let prof = 0;
  for (let i = abre; i < src.length; i++) {
    if (src[i] === "{") prof++;
    else if (src[i] === "}") { prof--; if (prof === 0) return sinComentarios(src.slice(abre, i + 1)); }
  }
  return "";
}

export function runPieCeroTier(): { hard: number } {
  console.log("\n─── TIER PIE-CERO (sin pie manda el flujo · un Buscar otro no tiene salida sin descuento · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la dimensión de capital, sin pie, es el flujo ─────────────────────
  let casosPie0 = 0;
  for (const key of ["GS-PC1", "GS-PC2"]) {
    const s = GOLDEN_SEEDS.find((x) => x.key === key);
    if (!s) { F(`0 · falta la seed ${key}`); continue; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
    if (r.metrics.cashOnCash?.tipo !== "no_aplica") { F(`0 · ${key} dejó de ser pie cero en el motor: el caso no prueba nada`); continue; }
    casosPie0++;
    if (r.desglose.cashOnCash !== r.desglose.flujoCaja) F(`1 · ${key}: la dimensión de capital (${r.desglose.cashOnCash}) no es el puntaje del flujo (${r.desglose.flujoCaja})`);
    const dim = (m: object) => dimensionesScoreLtr(s.input, { ...r.metrics, ...m }, GOLDEN_UF, GOLDEN_ASOF, undefined, null).desglose;
    const base = dim({});
    for (const delta of [-3, 3, 8]) {
      const d = dim({ rentabilidadNeta: r.metrics.rentabilidadNeta + delta });
      if (d.cashOnCash !== base.cashOnCash) F(`1 · ${key}: mover la rentabilidad neta ${delta > 0 ? "+" : ""}${delta} pts movió la dimensión de capital (${base.cashOnCash} → ${d.cashOnCash}): la está leyendo`);
    }
    const peor = dim({ flujoNetoMensual: r.metrics.flujoNetoMensual - 0.4 * r.metrics.ingresoMensual });
    if (!(peor.cashOnCash! < base.cashOnCash!)) F(`1 · ${key}: empeorar el flujo no bajó la dimensión de capital (${base.cashOnCash} → ${peor.cashOnCash}): no está leyendo el flujo`);
  }
  // Con pie, la dimensión sigue siendo la curva del CoC: el cambio es solo para pie cero.
  {
    const s = GOLDEN_SEEDS.find((x) => x.key === "GS-1")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
    if (r.metrics.cashOnCash?.tipo === "no_aplica") F("0 · GS-1 quedó sin pie: el control de «con pie no cambia» no prueba nada");
    else if (r.desglose.cashOnCash === r.desglose.flujoCaja) F("1 · GS-1 (con pie): la dimensión de capital es el puntaje del flujo — el cambio tenía que ser solo para pie cero");
  }
  // STR: la dimensión sin pie sale del flujo y no recibe el cap rate.
  {
    const a = calcCashOnCashDim(null, -300_000).score, b = calcCashOnCashDim(null, 0).score, c = calcCashOnCashDim(null, 150_000).score;
    if (!(a < b && b < c)) F(`1 · STR: sin pie la dimensión de capital no sigue al flujo (−$300k ${a} · $0 ${b} · +$150k ${c})`);
    if (calcCashOnCashDim.length !== 2) F(`1 · STR: calcCashOnCashDim recibe ${calcCashOnCashDim.length} argumentos: sin pie solo puede leer el CoC y el flujo`);
    const S = leer("src/lib/engines/short-term-score.ts");
    if (!/const cashOnCash = calcCashOnCashDim\(metricaValorONull\(base\.cashOnCash\), base\.flujoCajaMensual\);/.test(S)) F("1 · STR: el score no le pasa el flujo a la dimensión de capital");
    const frozen = loadFrozen();
    const pc = recomputeStrSeed(STR_GE_SEEDS.find((s) => s.key === "GE-PC")!, frozen);
    if (!pc) F("0 · GE-PC sin fixture");
    else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fs: any = pc.score; const flujo = pc.rec.escenarios.base.flujoCajaMensual;
      if (pc.rec.escenarios.base.cashOnCash?.tipo !== "no_aplica") F("0 · GE-PC dejó de ser pie cero en el motor STR");
      else if (fs.desglose.cashOnCash.score !== calcCashOnCashDim(null, flujo).score) F(`1 · GE-PC: la dimensión de capital (${fs.desglose.cashOnCash.score}) no es el puntaje del flujo (${calcCashOnCashDim(null, flujo).score})`);
      else casosPie0++;
    }
  }

  // ── 2 · sin pie, el filtro que baja COMPRAR a AJUSTAR aplica su brazo de flujo ──
  {
    const s = GOLDEN_SEEDS.find((x) => x.key === "GS-PC2")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
    const ing = r.metrics.ingresoMensual;
    const razones: RazonSinCapital[] = ["sin_pie", "bono_pie", "otra_fuente", "no_declarada"];
    for (const razon of razones) {
      // Flujo apenas bajo −5% del ingreso, lejos del flujo severo del gate 1 (50% de la cuota) y
      // sin el gate 3 (que pide flujo ≥ 0). Score de COMPRAR y break-even con salida.
      const m = { ...r.metrics, cashOnCash: metricaNoAplica(razon), flujoNetoMensual: -0.06 * ing };
      const v = deriveVeredicto(85, m, 3);
      if (v !== "AJUSTA SUPUESTOS") F(`2 · pie cero (${razon}): COMPRAR con flujo −6% del ingreso dio ${v}; el brazo de flujo del gate 2 tenía que bajarlo a AJUSTA`);
      const ok = deriveVeredicto(85, { ...m, flujoNetoMensual: -0.04 * ing }, 3);
      if (ok !== "COMPRAR") F(`2 · pie cero (${razon}): con flujo −4% del ingreso dio ${ok}; el brazo es «bajo −5%», no más`);
    }
    // Con pie el gate 2 sigue igual: flujo −6% con CoC positivo no degrada (el brazo pide CoC < 0).
    const conPie = deriveVeredicto(85, { ...r.metrics, cashOnCash: metricaValor(2), flujoNetoMensual: -0.06 * ing }, 3);
    if (conPie !== "COMPRAR") F(`2 · con pie y CoC +2%, flujo −6% dio ${conPie}: el gate 2 con pie cambió`);
  }

  // ── 3 · ningún BUSCAR OTRO llega a COMPRAR con pie y plazo sin descuento ───
  // Unidad: la función pura.
  {
    const sonda = (meta: { piePct: number; plazoAnios: number }) => (c: { piePct: number; plazoAnios: number }): Veredicto =>
      c.piePct === meta.piePct && c.plazoAnios === meta.plazoAnios ? "COMPRAR" : "BUSCAR OTRA";
    const r1 = rescatarPorPieYPlazo("BUSCAR OTRA", { piePct: 10, plazoAnios: 25 }, sonda({ piePct: 10, plazoAnios: 30 }));
    if (!(r1.cambio && r1.veredicto === "AJUSTA SUPUESTOS" && r1.combinacion?.plazoAnios === 30)) F(`3 · unidad: un BUSCAR que llega a COMPRAR con 30 años no se rescató (${JSON.stringify(r1)})`);
    const r2 = rescatarPorPieYPlazo("AJUSTA SUPUESTOS", { piePct: 10, plazoAnios: 25 }, () => "COMPRAR");
    if (r2.cambio) F("3 · unidad: el rescate tocó un veredicto que no era BUSCAR");
    const combos = combinacionesSinDescuento({ piePct: 10, plazoAnios: 25 });
    // Dos topes: el alcance (15 puntos sobre el pie declarado) y el pie de la grilla (30%).
    if (combos.some((c) => c.piePct < 10 || c.plazoAnios < 25 || c.piePct > 25 || c.plazoAnios > 30)) F("3 · unidad: desde pie 10% la grilla prueba menos pie, menos plazo o más de 15 puntos de pie extra");
    if (!combos.some((c) => c.piePct === 25 && c.plazoAnios === 30) || !combos.some((c) => c.piePct === 10 && c.plazoAnios === 30)) F("3 · unidad: desde pie 10% la grilla no llega a sus topes (pie 25 · plazo 30)");
    const alto = combinacionesSinDescuento({ piePct: 20, plazoAnios: 20 });
    if (alto.some((c) => c.piePct > 30) || !alto.some((c) => c.piePct === 30)) F("3 · unidad: desde pie 20% la grilla no se detiene en el pie de 30%");
    const bono = combinacionesSinDescuento({ piePct: 0, plazoAnios: 20, razonSinPie: "bono_pie" });
    if (bono.some((c) => c.piePct !== 0)) F("3 · unidad: con bono pie la grilla movió el pie");
    const otra = combinacionesSinDescuento({ piePct: 0, plazoAnios: 20, razonSinPie: "otra_fuente" });
    if (!otra.some((c) => c.piePct > 0)) F("3 · unidad: con otra fuente la grilla no movió el pie (solo el bono pie lo congela)");
  }
  // Cableado: el rescate corre entre el veredicto del puntaje y el hallazgo de distancia, fuera de
  // `deriveVeredicto` (las sondas pasan por ahí y no pueden rescatar).
  {
    const A = sinComentarios(leer("src/lib/analysis.ts"));
    const run = cuerpo(A, /export function runAnalysis\(/);
    const iDeriv = run.indexOf("const veredictoDelPuntaje: Veredicto = deriveVeredicto(score, metrics, breakEvenTasa);");
    const iResc = run.indexOf("const rescatePieYPlazo = rescatarPorPieYPlazo(");
    const iUsa = run.indexOf("const veredictoPorScore: Veredicto = rescatePieYPlazo.veredicto;");
    const iDist = run.indexOf("const hallazgoDistanciaPorScore = buildHallazgoDistanciaVeredicto(");
    if (!(iDeriv >= 0 && iDeriv < iResc && iResc < iUsa && iUsa < iDist)) F("3 · runAnalysis no rescata entre el veredicto del puntaje y el hallazgo de distancia");
    if (/rescatarPorPieYPlazo/.test(cuerpo(A, /export function deriveVeredicto\(/) + cuerpo(A, /function evalVeredicto\(/))) F("3 · el rescate entró a deriveVeredicto/evalVeredicto: las sondas rescatarían");
    const H = sinComentarios(leer("src/lib/str-hallazgos.ts"));
    const iR = H.indexOf("const rescate = rescatarPorPieYPlazo(");
    // En STR ninguna fila del parque se rescata: el cableado es lo único que lo prueba, así que se
    // exige también que el rescate ESCRIBA el veredicto, no solo que se calcule.
    const iW = H.search(/if \(rescate\.cambio && rescate\.combinacion\) \{\s*fs\.veredicto = rescate\.veredicto;/);
    const iD = H.indexOf("const distanciaPorScore = buildHallazgoDistanciaVeredictoStr(");
    if (!(iR >= 0 && iR < iW && iW < iD)) F("3 · STR: el ensamblador no rescata antes del hallazgo de distancia");
    if (/rescatarPorPieYPlazo/.test(sinComentarios(leer("src/lib/engines/short-term-score.ts")))) F("3 · STR: el rescate entró a calcFrancoScoreSTR: las sondas rescatarían");
  }
  // Las seeds del golden y las filas congeladas: ningún BUSCAR final con una combinación que llegue.
  type Caso = { id: string; r: any; input: any; uf: number; mediana: any; asOf: Date; esperado?: string; combinacion?: { piePct: number; plazoAnios: number } };
  const casos: Caso[] = [];
  for (const s of [...GOLDEN_SEEDS, ...BORDE_SEEDS]) casos.push({ id: s.key, r: runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF), input: s.input, uf: GOLDEN_UF, mediana: s.mediana, asOf: GOLDEN_ASOF });
  const fixtures = JSON.parse(readFileSync(join(__dirname, "pie-cero-fixtures.json"), "utf8")) as any[];
  for (const fx of fixtures) {
    const asOf = new Date(fx.asOf);
    casos.push({ id: `parque ${fx.id}`, r: recomputeResultsForLegacy(fx.input, fx.uf, fx.mediana, asOf), input: fx.input, uf: fx.uf, mediana: fx.mediana, asOf, esperado: fx.esperado, combinacion: fx.combinacion });
  }
  let buscar = 0, rescatadas = 0;
  for (const c of casos) {
    if (!c.r?.veredicto) { F(`0 · ${c.id}: no recomputa`); continue; }
    if (c.esperado && c.r.veredicto !== c.esperado) F(`3 · ${c.id}: esperaba ${c.esperado} y da ${c.r.veredicto}`);
    if (c.combinacion) {
      rescatadas++;
      const rp = c.r.rescatePieYPlazo;
      if (!rp) F(`3 · ${c.id}: se rescata en el parque y el resultado no nombra la combinación`);
      else if (sondaConPatch(c.input, c.uf, c.mediana, c.asOf, { piePct: rp.piePct, plazoCredito: rp.plazoAnios }).veredicto !== "COMPRAR") F(`3 · ${c.id}: la combinación que nombra (pie ${rp.piePct}% · ${rp.plazoAnios} años) no llega a COMPRAR`);
    }
    if (c.r.veredicto !== "BUSCAR OTRA") continue;
    buscar++;
    for (const k of combinacionesSinDescuento({ piePct: Number(c.input.piePct), plazoAnios: Number(c.input.plazoCredito), razonSinPie: c.input.razonSinPie })) {
      const v = sondaConPatch(c.input, c.uf, c.mediana, c.asOf, { piePct: k.piePct, plazoCredito: k.plazoAnios }).veredicto;
      if (v === "COMPRAR") { F(`3 · ${c.id}: es BUSCAR OTRA y con pie ${k.piePct}% · ${k.plazoAnios} años, sin descuento, llega a COMPRAR`); break; }
    }
  }
  const esperadasRescate = fixtures.filter((f) => f.combinacion).length;
  if (rescatadas !== esperadasRescate || esperadasRescate === 0) F(`0 · PISO · ${rescatadas} filas rescatadas congeladas: el volcado trae ${esperadasRescate}`);
  if (buscar < 5) F(`0 · PISO · solo ${buscar} BUSCAR OTRA barridos: el barrido no está leyendo los casos`);

  if (fallas.length) {
    console.log(`  ✗ PIE-CERO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — sin pie la dimensión de capital es el flujo (${casosPie0} casos, la rentabilidad neta no la mueve), el gate 2 aplica su brazo de flujo con las cuatro razones, y de ${buscar} BUSCAR OTRA ninguno llega a COMPRAR con pie y plazo sin descuento (${rescatadas} rescatadas del parque quedan en AJUSTA)`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPieCeroTier();
  process.exit(hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (25-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las trece en ROJO; restauradas, VERDE.
//    1 · vuelve el relleno con la rentabilidad neta en LTR          → «no es el puntaje del flujo»
//    2 · el flujo más un pellizco de rentabilidad neta                → «no es el puntaje del flujo»
//    3 · el puntaje del flujo también con pie                         → «GS-1 (con pie) … solo para pie cero»
//    4 · el gate 2 vuelve a saltarse sin pie                          → «flujo −6% dio COMPRAR»
//    5 · el brazo sin pie con umbral −10% en vez de −5%               → «flujo −6% dio COMPRAR»
//    6 · STR vuelve a pasarle el cap rate a la dimensión              → «no le pasa el flujo»
//    7 · runAnalysis sin rescate                                      → «no rescata entre …»
//    8 · la grilla del rescate no prueba plazo                        → unidad: 30 años no se rescató
//    9 · sin el alcance de 15 puntos de pie extra                     → unidad: más de 15 puntos
//   10 · con bono pie el pie se mueve                                 → unidad: movió el pie
//   11 · el rescate devuelve COMPRAR en vez de AJUSTA                 → unidad
//   12 · STR calcula el rescate y no escribe el veredicto            → «el ensamblador no rescata»
//   13 · el rescate prueba plazos más cortos                          → unidad: menos plazo
