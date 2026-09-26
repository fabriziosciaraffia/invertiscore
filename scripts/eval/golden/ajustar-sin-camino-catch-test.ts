/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · UN AJUSTAR SIN CAMINO REALISTA ES UN BUSCAR OTRO — catch-test (25-sep-2026)
// ============================================================================
// Decisión de Fabrizio: si el camino más fácil a Comprar pide más de 20% de descuento —o no hay
// ninguno—, un Ajustar pasa a Buscar otro. Entre 10% y 20% no se toca. Regla, evidencia y zona
// gris en `src/lib/ajustar-sin-camino.ts`.
//
// FIJA, verificado EN ROJO por mutación:
//   1 · NINGÚN AJUSTAR TIENE SU CAMINO MÁS FÁCIL SOBRE 20% NI SIN CAMINO: sobre las seeds del
//       golden (LTR y STR) y las 54 filas congeladas del parque.
//   2 · LAS 52 FILAS QUE LA REGLA CAMBIA PASAN A BUSCAR OTRO, y ninguna dice «más de 70%»: ni la
//       card, ni el titular, ni el capítulo «A qué precio cerrar». La card cita la combinación
//       («Aun con pie de…»), el titular pasa su formato y el capítulo no recomienda precio.
//   3 · ENTRE 10% Y 20% NINGÚN VEREDICTO CAMBIA: la función pura sobre bordes sintéticos (10,1 ·
//       15 · 20,0 quedan; 20,1 y sin camino pasan) y las dos filas grises congeladas que piden
//       exactamente 20,0%.
//   4 · EL FILTRO VIVE DESPUÉS DEL HALLAZGO DE DISTANCIA, nunca en `deriveVeredicto`,
//       `evalVeredicto` ni `calcFrancoScoreSTR` (las sondas pasan por ahí: se llamaría a sí mismo);
//       en STR corre antes del hallazgo del gate y del encuadre, y el título de la página STR lee
//       el mismo recálculo que el cuerpo.
// Fixtures: `ajustar-sin-camino-fixtures.json` (volcado por `scripts/of-dump-ajustar-sin-camino.ts`).
// Corre dentro del QUICK. Solo:  node --import tsx scripts/eval/golden/ajustar-sin-camino-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { caminoMasFacil, filtroAjustarSinCamino, pieSeExploro, AJUSTAR_DESCUENTO_MAX_PCT } from "../../../src/lib/ajustar-sin-camino";
import { construirCardLtr, construirCardStr } from "../../../src/lib/card-recomendacion";
import { titularMotor } from "../../../src/lib/titular-motor";
import { stripMarcas } from "../../../src/lib/prosa-marcas";
import { construirComoLoPagas } from "../../../src/lib/como-lo-pagas";
import { chequearTitular } from "./titular-motor-catch-test";
import { GOLDEN_SEEDS, BORDE_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { STR_GE_SEEDS } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";
import type { HallazgoDistanciaVeredicto, Veredicto } from "../../../src/lib/types";
import { SCORE_CORTE_AJUSTA } from "../../../src/lib/score-cortes";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`\w])\/\/.*$/gm, "$1");
const distanciaDe = (r: any): HallazgoDistanciaVeredicto | null => (r?.hallazgos ?? []).find((h: any) => h.id === "distancia_veredicto") ?? null;
const textoPagas = (m: any) => m.pasos.map((p: any) => `${p.k}: ${p.segs.map((x: any) => x.t).join("")}`).join(" | ");

/** El camino más fácil de un resultado, leído como lo lee el filtro. */
function caminoDe(r: any, input: { piePct: number; plazoAnios: number }) {
  const dv = distanciaDe(r);
  if (!dv || dv.valor.veredictoObjetivo !== "COMPRAR") return null;
  return caminoMasFacil(dv.valor.mixPalancas, { ...input, pieSeExploro: pieSeExploro(dv.valor), topePct: dv.valor.topePct });
}

export function runAjustarSinCaminoTier(): { hard: number } {
  console.log("\n─── TIER AJUSTAR-SIN-CAMINO (un Ajustar sobre 20% o sin camino es Buscar otro · la zona gris no se toca · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  let ajustas = 0;
  const invariante = (id: string, v: Veredicto, r: any, input: { piePct: number; plazoAnios: number }) => {
    if (v !== "AJUSTA SUPUESTOS") return;
    ajustas++;
    const c = caminoDe(r, input);
    if (!c) { F(`1 · ${id}: Ajustar sin hallazgo de distancia hacia Comprar: el tier no puede medirlo`); return; }
    if (c.descuentoPct == null) F(`1 · ${id}: Ajustar SIN ningún camino a Comprar`);
    else if (c.descuentoPct > AJUSTAR_DESCUENTO_MAX_PCT) F(`1 · ${id}: Ajustar cuyo camino más fácil pide ${c.descuentoPct}%`);
  };

  // ── 1 · las seeds del golden ──
  for (const s of [...GOLDEN_SEEDS, ...BORDE_SEEDS] as any[]) {
    const r: any = runAnalysis(s.input, GOLDEN_UF, s.mediana, GOLDEN_ASOF);
    invariante(`ltr ${s.key}`, r.veredicto, r, { piePct: s.input.piePct, plazoAnios: s.input.plazoCredito });
  }
  const frozen = JSON.parse(readFileSync(join(__dirname, "str-seeds-frozen.json"), "utf8"));
  for (const seed of STR_GE_SEEDS) {
    const r0: any = recomputeStrSeed(seed, frozen);
    if (!r0) continue;
    invariante(`str ${seed.key}`, r0.score.veredicto, { hallazgos: r0.hz }, { piePct: Number(r0.d.piePct) || 0, plazoAnios: Number(r0.d.plazoCredito) || 0 });
  }

  // ── 1 y 2 · las filas congeladas del parque ──
  const fixtures = JSON.parse(readFileSync(join(__dirname, "ajustar-sin-camino-fixtures.json"), "utf8")) as any[];
  // ⚠ ACTA (25-sep-2026, «pie cero: manda el flujo»): estas filas llegaban a Buscar otro por el
  // FILTRO del descuento. Con pie cero la dimensión de capital pasó a leer el flujo, y alguna ya
  // llega a Buscar otro por el PUNTAJE, antes del filtro: el veredicto es el mismo y la marca
  // `porDescuento` no corresponde, porque el filtro no actuó. Se eximen de los chequeos de la marca
  // solo mientras su puntaje siga bajo el corte de Ajustar — si sube, la exención deja de valer y
  // la fila vuelve a exigir la marca. No se re-vuelcan los fixtures: la fila sigue probando que el
  // veredicto final es Buscar otro.
  const POR_PUNTAJE: Record<string, string> = {
    "str b4bb8a67": "bono pie, flujo −$116 mil: puntaje 40 con la dimensión de capital en el flujo (antes, el cap rate)",
  };
  let porPuntaje = 0;
  let cambiadas = 0;
  let grises = 0;
  const designados = new Set<string>();
  for (const fx of fixtures) {
    const id = `${fx.modalidad} ${fx.id}`;
    const asOf = new Date(fx.asOf);
    let r: any; let v: Veredicto; let card: any; let pie: number; let plazo: number; let precioUF: number; let sup: number;
    if (fx.modalidad === "ltr") {
      r = recomputeResultsForLegacy(fx.input, fx.uf, fx.mediana, asOf);
      v = r?.veredicto;
      pie = Number(fx.input.piePct) || 0; plazo = Number(fx.input.plazoCredito) || 0; precioUF = Number(fx.input.precio); sup = Number(fx.input.superficie);
      card = r ? construirCardLtr({ veredicto: v, results: r, inputData: fx.input, currency: "CLP", valorUF: fx.uf }) : null;
    } else {
      r = recomputeShortTermForLegacy(fx.input, fx.persist, fx.uf, asOf, fx.mediana);
      v = r?.francoScore?.veredicto;
      pie = Number(fx.input.piePct) || 0; plazo = Number(fx.input.plazoCredito) || 0; precioUF = Number(fx.input.precioCompraUF); sup = Number(fx.input.superficieUtil) || 0;
      card = r ? construirCardStr({ veredicto: v, results: r, simulacion: null, currency: "CLP", valorUF: fx.uf }) : null;
    }
    if (!r || !v) { F(`0 · ${id}: el fixture no recomputa`); continue; }
    if (fx.designado) designados.add(fx.designado);
    invariante(id, v, r, { piePct: pie, plazoAnios: plazo });
    if (v !== fx.esperado) { F(`${fx.esperado === "BUSCAR OTRA" ? "2" : "3"} · ${id}: esperaba ${fx.esperado} y da ${v} (camino más fácil en la FASE 0: ${fx.minDescuentoFase0 ?? "sin camino"})`); continue; }
    const dv = distanciaDe(r);
    if (fx.esperado === "AJUSTA SUPUESTOS") {
      grises++;
      if (dv?.valor.porDescuento) F(`3 · ${id}: una fila de la zona gris lleva la marca del filtro`);
      continue;
    }
    if (POR_PUNTAJE[id]) {
      const score = fx.modalidad === "ltr" ? r.score : r.francoScore?.score;
      if (!(typeof score === "number" && score < SCORE_CORTE_AJUSTA)) F(`2 · ${id}: el acta la exime porque llega a Buscar otro por el puntaje, y su puntaje es ${score}: la exención ya no vale`);
      else if (dv?.valor.porDescuento) F(`2 · ${id}: llega por el puntaje y aun así lleva la marca del filtro`);
      porPuntaje++;
      continue;
    }
    cambiadas++;
    const pd = dv?.valor.porDescuento;
    if (!pd) { F(`2 · ${id}: pasó a Buscar otro sin la marca porDescuento: la card no puede citar la combinación`); continue; }
    const distancia: string = card?.buscar?.distancia ?? "";
    const titular = stripMarcas(titularMotor({ veredicto: v, modalidad: fx.modalidad, card }).titular);
    const cap = construirComoLoPagas({ modalidad: fx.modalidad === "ltr" ? "LTR" : "STR", veredicto: v, precioUF, superficieM2: sup, comuna: "", piePctActual: pie, plazoActual: plazo, distancia: dv!.valor, sobre: null, limiteTirUF: null, mesCierraUF: null, alternativa: null, capex: null, valorUF: fx.uf } as any);
    const capTexto = textoPagas(cap);
    for (const [donde, t] of [["la card", distancia], ["el titular", titular], ["el capítulo III", capTexto]] as const) {
      if (/70\s*%/.test(t)) F(`2 · ${id}: ${donde} dice «70%»: «${t.slice(0, 120)}»`);
    }
    if (!/^Aun (con pie de [1-9]\d*% y crédito a \d+ años|sin pie y con crédito a \d+ años|pagando al contado), llegar a Comprar pediría /.test(distancia)) F(`2 · ${id}: la card no cita la combinación: «${distancia}»`);
    const t = chequearTitular(id, v, fx.modalidad, card);
    for (const x of t.fallas) F(`2 · ${x}`);
    if (cap.rec) F(`2 · ${id}: el capítulo «A qué precio cerrar» recomienda precio en un Buscar otro del filtro`);
    if (pd.descuentoPct != null && !capTexto.includes("La combinación más fácil")) F(`2 · ${id}: el capítulo no nombra la combinación que sí existe`);
    if (pd.descuentoPct != null && /no encontró una combinación/.test(capTexto)) F(`2 · ${id}: el capítulo dice «no encontró una combinación» donde la hay`);
  }
  if (cambiadas + porPuntaje !== 52 || porPuntaje !== Object.keys(POR_PUNTAJE).length) F(`2 · PISO · ${cambiadas} filas congeladas pasaron a Buscar otro por el filtro y ${porPuntaje} por el puntaje: la FASE 0 midió 52, y el acta exime ${Object.keys(POR_PUNTAJE).length}`);
  if (grises < 2) F(`3 · PISO · ${grises} filas grises congeladas siguen en Ajustar: esperaba las 2`);
  for (const d of ["borde", "sin_camino", "gris"]) if (!designados.has(d)) F(`0 · falta el fixture «${d}»`);

  // ── 3 · la zona gris sobre la función pura ──
  const hallazgoCon = (min: number | null, base: Veredicto = "AJUSTA SUPUESTOS"): HallazgoDistanciaVeredicto => ({
    id: "distancia_veredicto", tipo: "distancia_umbral", direccion: "neutral", decisividad: 0,
    procedencia: { base: "", confianza: "alta" }, titular: "", fraseCanonica: "",
    valor: {
      veredictoBase: base, veredictoObjetivo: base === "BUSCAR OTRA" ? "AJUSTA SUPUESTOS" : "COMPRAR",
      palancas: [], palancaMasBarata: null, palancaHastaComprar: null, esEstructural: true, deltaMinimoFueraDeTope: null,
      topePct: 30, cercaniaUmbral: 0, brazosGate1Activos: [], modalidad: "ltr",
      vias: [{ estado: "noCruza", palanca: "pie", actual: 20, topeExplorado: 30, razon: "" }],
      mixPalancas: min == null ? null : ({ celdas: [
        { piePct: 30, plazoAnios: 30, esActual: false, esElegida: true, veredicto: "COMPRAR", score: 70, veredictoSinDescuento: base, scoreSinDescuento: 50, descuentoPct: min, costoDiaUnoUF: 0, costoPtsPrecio: 2, alcanzable: true },
        { piePct: 20, plazoAnios: 25, esActual: true, esElegida: false, veredicto: "COMPRAR", score: 70, veredictoSinDescuento: base, scoreSinDescuento: 50, descuentoPct: min + 5, costoDiaUnoUF: 0, costoPtsPrecio: 0, alcanzable: true },
      ] } as any),
    },
  });
  const casos: [number | null, Veredicto, Veredicto][] = [
    [10.1, "AJUSTA SUPUESTOS", "AJUSTA SUPUESTOS"], [15, "AJUSTA SUPUESTOS", "AJUSTA SUPUESTOS"], [20, "AJUSTA SUPUESTOS", "AJUSTA SUPUESTOS"],
    [20.1, "AJUSTA SUPUESTOS", "BUSCAR OTRA"], [null, "AJUSTA SUPUESTOS", "BUSCAR OTRA"],
    [35, "BUSCAR OTRA", "BUSCAR OTRA"], [35, "COMPRAR", "COMPRAR"],
  ];
  for (const [min, base, esperado] of casos) {
    const f = filtroAjustarSinCamino(base, hallazgoCon(min, base), { piePct: 20, plazoAnios: 25 });
    if (f.veredicto !== esperado) F(`3 · ${base} con el camino más fácil en ${min ?? "sin camino"}: da ${f.veredicto}, tenía que dar ${esperado}`);
  }

  // ── 4 · dónde vive ──
  const A = sinComentarios(leer("src/lib/analysis.ts"));
  const iDist = A.indexOf("const hallazgoDistanciaPorScore = buildHallazgoDistanciaVeredicto(");
  const iFiltro = A.indexOf("filtroAjustarSinCamino(veredictoPorScore, hallazgoDistanciaPorScore");
  if (iDist < 0 || iFiltro < 0 || iFiltro < iDist) F("4 · runAnalysis no aplica el filtro DESPUÉS del hallazgo de distancia");
  const cuerpo = (src: string, fn: string) => { const i = src.indexOf(fn); if (i < 0) return ""; const j = src.indexOf("\nexport function", i + fn.length); return src.slice(i, j < 0 ? undefined : j); };
  for (const [archivo, fn] of [["src/lib/analysis.ts", "export function deriveVeredicto("], ["src/lib/analysis.ts", "function evalVeredicto("], ["src/lib/engines/short-term-score.ts", "export function calcFrancoScoreSTR("]] as const) {
    const c = cuerpo(sinComentarios(leer(archivo)), fn);
    if (!c) F(`4 · no encuentro ${fn} en ${archivo}: el tier no lo mide`);
    else if (/filtroAjustarSinCamino|ajustar-sin-camino/.test(c)) F(`4 · ${fn} llama al filtro del descuento: las sondas pasan por ahí y se llamaría a sí mismo`);
  }
  const H = sinComentarios(leer("src/lib/str-hallazgos.ts"));
  const iF = H.indexOf("filtroAjustarSinCamino(fs.veredicto, distanciaPorScore");
  const iGate = H.indexOf("buildHallazgoGateVeredicto(");
  const iEnc = H.indexOf("aplicarEncuadreVeredicto(vivos, fs.veredicto)");
  if (iF < 0 || !/if \(filtro\.cambio\) fs\.veredicto = filtro\.veredicto;/.test(H)) F("4 · el ensamblador STR no aplica el filtro sobre francoScore");
  else if (iGate >= 0 && iGate < iF) F("4 · en STR el hallazgo del gate se arma ANTES del filtro: leería el veredicto del puntaje");
  else if (iEnc < iF) F("4 · en STR el encuadre corre ANTES del filtro");
  const META = sinComentarios(leer("src/app/analisis/renta-corta/[id]/page.tsx"));
  if (/veredictoStrRecomputado\(/.test(META)) F("4 · el título de la página STR vuelve a leer veredictoStrRecomputado, que no pasa por el filtro");
  if (ajustas < 5) F(`0 · el tier midió ${ajustas} Ajustar: no está leyendo`);

  if (fallas.length) {
    console.log(`  ✗ AJUSTAR-SIN-CAMINO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — ${ajustas} Ajustar con su camino más fácil ≤ ${AJUSTAR_DESCUENTO_MAX_PCT}%; las ${cambiadas} filas que cambian dicen la combinación y ninguna «70%»; la zona gris no se mueve (${grises} filas y 7 bordes); el filtro vive después de la distancia`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runAjustarSinCaminoTier();
  process.exit(hard ? 1 : 0);
}
