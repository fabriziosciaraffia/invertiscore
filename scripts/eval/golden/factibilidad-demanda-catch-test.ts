/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER FACTIBILIDAD-DEMANDA (23-sep-2026) · la factibilidad STR mide la demanda de la zona.
//
// Decisión de Fabrizio: salen la constante de regulación, el ingreso del estimador y la tipología;
// entra la ocupación realizada de los comparables de AirROI por su NIVEL, con la curva anclada en
// la mediana de Santiago; los atractores quedan de respaldo sin comparables. Las filas que no
// guardaron el dato lo leen del caché de AirROI en el recálculo, sin escribir en la base. Fija:
//   1 · LA CONSTANTE Y EL INGRESO NO EXISTEN: ni en el código del score ni en sus entradas, y la
//       factibilidad no cambia con dormitorios, m², ingreso ni ubicación cuando hay comparables.
//   2 · NIVEL, NO BRECHA: con la misma ocupación realizada, la factibilidad no se mueve aunque la
//       ocupación ESTIMADA cambie (la brecha es la operación y ya la explica «Ocupación en renta
//       corta»); la curva pasa por sus tres anclas y es monótona.
//   3 · LAS 42 LEEN DEL CACHÉ: el recálculo toma la ocupación de los results que recibe, y TODA
//       entrada de servidor que recalcula un STR se los pasa por `conOcupacionRealizadaDelCache`;
//       el helper lee con el cliente de servicio (RLS sin políticas) y no escribe.
//   4 · EL ANCLA Y EL FILTRO SON EL MISMO: la huella guardada con el ancla es la del filtro
//       vigente, el dato del caso y el generador usan esa misma función, y el motor ancla en ese
//       generado.
//   5 · LA PROSA STR SE REGENERA: PROMPT_VERSION_STR ≥ 23 (el bump de este cambio), y la página y
//       la ruta invalidan por versión.
// Lo que necesita la base (las 42 filas del parque leyendo del caché) lo mide
// `factibilidad-demanda-sonda.ts`. Verificado EN ROJO por mutación. Corre solo:
//   node --env-file=.env.local --import tsx scripts/eval/golden/factibilidad-demanda-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { calcFrancoScoreSTR, puntajeDemandaZona } from "../../../src/lib/engines/short-term-score";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { summarizeRealizedOccupancy } from "../../../src/lib/airbnb/process-comparables";
import { OCUPACION_REALIZADA_SANTIAGO, HUELLA_FILTRO_OCUPACION } from "../../../src/lib/data/ocupacion-realizada-santiago.gen";
import { huellaFiltro } from "./huella-filtro-ocupacion";
import { loadFrozen } from "./str-seeds";
import { recomputeStrSeed } from "./str-recompute";
import { STR_GE_SEEDS } from "./str-seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const archivos = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, n).replace(/\\/g, "/");
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out);
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
};

export function runFactibilidadDemandaTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n─── TIER FACTIBILIDAD-DEMANDA (la factibilidad STR mide la demanda de la zona · 0 tokens) ───");
  const M = OCUPACION_REALIZADA_SANTIAGO.mediana;

  // Un caso real del golden para ejercitar el score entero.
  const frozen = loadFrozen();
  const seed = STR_GE_SEEDS.find((s) => s.key === "GE-2")!;
  const r = recomputeStrSeed(seed, frozen);
  if (!r) { F("PISO · GE-2 no se pudo recomputar"); return { hard: fallas.length }; }
  const extras = { dormitorios: r.d.dormitorios, superficie: r.d.superficieUtil, lat: r.d.lat ?? -33.4378, lng: r.d.lng ?? -70.6504, ingresoMensualScore: [] as number[] };
  const fact = (o: Record<string, unknown>, results: any = r.rec) => calcFrancoScoreSTR({ results, precioCompra: r.d.precioCompra, ...extras, ocupacionRealizadaP50: 0.35, ...o } as any).desglose.factibilidad.score;

  // ── 1 · la constante y el ingreso no existen ──
  const motor = sinComentarios(leer("src/lib/engines/short-term-score.ts"));
  for (const x of ["REVENUE_BENCHMARKS", "ESCALA_REVENUE_RELATIVO", "PUNTAJE_REGULACION_RETIRADA", "calcTipologia", "ingresoP50", "puntajeRegulacion", "puntajeIngreso", "puntajeTipologia"]) {
    if (new RegExp(`\\b${x}\\b`).test(motor)) F(`1 · el score STR todavía tiene «${x}»`);
  }
  const base = fact({});
  if (fact({ dormitorios: 3, superficie: 120 }) !== base || fact({ lat: -33.6, lng: -70.55 }) !== base || fact({ ingresoP50: 99_000_000 }) !== base) F("1 · con comparables, la factibilidad cambia con dormitorios, m², ubicación o ingreso");
  if (!(base >= 25 && base <= 90)) F(`1 · la factibilidad con comparables sale del rango de la curva (${base})`);
  // La dimensión ENTERA es la curva: en la mediana da 65, en la mitad 25 y en 1,6× 90. Una
  // constante o un ingreso sumado aparte correría esos tres números.
  if (fact({ ocupacionRealizadaP50: M }) !== 65 || fact({ ocupacionRealizadaP50: M / 2 }) !== 25 || fact({ ocupacionRealizadaP50: 1.6 * M }) !== 90) F(`1 · la factibilidad no es solo la curva de demanda (mediana → ${fact({ ocupacionRealizadaP50: M })}, no 65)`);
  for (const [k, p] of [["src/lib/api-helpers/analisis-pipeline.ts", /ingresoP50/], ["src/lib/analysis/recompute-short-term-for-legacy.ts", /ingresoP50/], ["src/app/api/analisis/dry-run/route.ts", /ingresoP50/]] as const) {
    if (p.test(sinComentarios(leer(k)))) F(`1 · ${k} todavía arma el score con el ingreso del estimador`);
  }

  // ── 2 · el nivel, no la brecha ──
  const est = (occ: number) => ({ ...r.rec, escenarios: { ...r.rec.escenarios, base: { ...r.rec.escenarios.base, ocupacionReferencia: occ } } });
  if (fact({}, est(0.2)) !== fact({}, est(0.7))) F("2 · la factibilidad se mueve con la ocupación ESTIMADA: mide la brecha, no el nivel");
  if (Math.round(puntajeDemandaZona(M)) !== 65 || Math.round(puntajeDemandaZona(M / 2)) !== 25 || Math.round(puntajeDemandaZona(1.6 * M)) !== 90) F("2 · la curva no pasa por sus anclas (mediana → 65, mitad → 25, 1,6× → 90)");
  const pts = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6].map(puntajeDemandaZona);
  if (pts.some((x, i) => i > 0 && x < pts[i - 1])) F("2 · la curva de demanda no es monótona");
  if (!(fact({ ocupacionRealizadaP50: 0.2 }) < fact({ ocupacionRealizadaP50: 0.45 }))) F("2 · más demanda realizada no sube la factibilidad");
  if (/ocupacionReferencia|estimated_occupancy|ocupacionEstimada/.test(motor.slice(motor.indexOf("function calcFactibilidad"), motor.indexOf("function calcFactibilidad") + 1500))) F("2 · calcFactibilidad lee la ocupación estimada");
  // Sin comparables: los atractores, y dependen de la ubicación.
  const sin = fact({ ocupacionRealizadaP50: null });
  if (!(sin >= 0 && sin <= 100) || fact({ ocupacionRealizadaP50: null, lat: -33.2, lng: -70.3 }) === sin) F("2 · sin comparables la factibilidad no cae a los atractores de la ubicación");

  // ── 3 · las 42 leen del caché ──
  const ctx = buildStrRecomputeCtx(r.d as any, { airbnbRaw: (frozen["GE-2"] as any).airbnbRaw, ocupacionRealizadaComparables: { p50: 0.41, n: 20 } } as any, (frozen["GE-2"] as any).uf);
  if (ctx?.scoreExtras.ocupacionRealizadaP50 !== 0.41) F("3 · el recálculo no toma la ocupación realizada de los results que recibe");
  const ctxSin = buildStrRecomputeCtx(r.d as any, { airbnbRaw: (frozen["GE-2"] as any).airbnbRaw } as any, (frozen["GE-2"] as any).uf);
  if (ctxSin?.scoreExtras.ocupacionRealizadaP50 !== null) F("3 · sin el dato el recálculo inventa una ocupación");
  const helper = sinComentarios(leer("src/lib/airbnb/ocupacion-realizada-cache.ts"));
  if (!/SUPABASE_SERVICE_ROLE_KEY/.test(helper)) F("3 · el helper no lee con el cliente de servicio (RLS sin políticas: el del usuario devuelve cero)");
  if (/\.(insert|update|upsert|delete)\(/.test(helper)) F("3 · el helper escribe en la base");
  if (!/from\("airbnb_estimates"\)/.test(helper) || !/summarizeRealizedOccupancy\(/.test(helper)) F("3 · el helper no resume los comparables del caché");
  // Toda entrada de servidor que recalcula un STR pasa por el helper.
  const LLAMADAS = /\b(veredictoStrRecomputado|recomputeShortTermForLegacy)\(/g;
  let entradas = 0;
  for (const p of archivos("src")) {
    if (/recompute-short-term-for-legacy\.ts$|\/dev\//.test(p)) continue;
    const v = sinComentarios(leer(p));
    for (const m of v.matchAll(LLAMADAS)) {
      entradas++;
      // El segundo argumento, con paréntesis balanceados.
      let i = m.index! + m[0].length, prof = 0, arg = 0, a2 = "";
      for (; i < v.length; i++) {
        const c = v[i];
        if (c === "(" || c === "{" || c === "[") prof++;
        if (c === ")" || c === "}" || c === "]") { if (prof === 0) break; prof--; }
        if (c === "," && prof === 0) { arg++; if (arg === 2) break; continue; }
        if (arg === 1) a2 += c;
      }
      a2 = a2.trim();
      const id = (a2.match(/^(?:await\s+)?([A-Za-z_$][\w$]*)/) ?? [])[1] ?? "";
      const ok = /conOcupacionRealizadaDelCache\(/.test(a2) || (!!id && new RegExp(`\\b${id}\\s*=\\s*await\\s+conOcupacionRealizadaDelCache\\(`).test(v));
      if (!ok) F(`3 · ${p} recalcula un STR sin pasar los results por conOcupacionRealizadaDelCache (${a2.slice(0, 60)})`);
    }
  }
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: el piso baja de 8 a 7 porque una de las
  // entradas era la simulación de `str-prosa-persist.ts`, borrado con el generador STR.
  if (entradas < 7) F(`3 · PISO · solo ${entradas} entradas de recálculo STR encontradas: el barrido no está leyendo`);
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: `str-prosa-persist.ts` se borró; ya no hay simulación para la prosa.

  // ── 4 · el ancla y el filtro son el mismo ──
  const h = huellaFiltro(RAIZ);
  if (!h) F("4 · no se encontraron los marcadores del filtro en process-comparables.ts");
  else if (h !== HUELLA_FILTRO_OCUPACION) F(`4 · el filtro de listings cambió (huella ${h}) y el ancla es de otro filtro (${HUELLA_FILTRO_OCUPACION}): corre scripts/generar-ocupacion-realizada-santiago.ts`);
  const pc = sinComentarios(leer("src/lib/airbnb/process-comparables.ts"));
  if (!/\.filter\(listingConOcupacionRealizada\)/.test(pc)) F("4 · el dato del caso no usa el filtro único");
  const gen = sinComentarios(leer("scripts/generar-ocupacion-realizada-santiago.ts"));
  if (!/listingConOcupacionRealizada\(l\)/.test(gen)) F("4 · el generador del ancla no usa el filtro único");
  if (!/const ANCLA_DEMANDA = OCUPACION_REALIZADA_SANTIAGO\.mediana;/.test(motor)) F("4 · el motor no ancla la demanda en el generado");
  const res = summarizeRealizedOccupancy([
    { performance_metrics: { ttm_occupancy: 0.4, ttm_revenue: 1 } },
    { performance_metrics: { ttm_occupancy: 0.2, ttm_revenue: 1 } },
    { performance_metrics: { ttm_occupancy: 0.9, ttm_revenue: 0 } },
    { performance_metrics: { ttm_occupancy: 0, ttm_revenue: 5 } },
  ]);
  if (!res || res.n !== 2 || Math.abs(res.p50 - 0.3) > 1e-9) F(`4 · el dato del caso no aplica el filtro (${JSON.stringify(res)})`);
  if (!(OCUPACION_REALIZADA_SANTIAGO.n >= 1000 && M > 0.1 && M < 0.6)) F("4 · el ancla generada no es plausible");

  // ── 5 · RETIRADO. ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: fijaba el bump del prompt STR a v23 y la invalidación
  //    por versión en la página; el generador ya no existe. ──

  if (fallas.length) {
    console.log(`  ✗ FACTIBILIDAD-DEMANDA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — sin constante, ingreso ni tipología; la demanda entra por su nivel (anclas 25/65/90 sobre ${(M * 100).toFixed(1).replace(".", ",")} %) y no por la brecha; ${entradas} entradas de recálculo pasan por el caché, que se lee sin escribir; y el ancla es del filtro vigente`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFactibilidadDemandaTier();
  process.exit(hard ? 1 : 0);
}
