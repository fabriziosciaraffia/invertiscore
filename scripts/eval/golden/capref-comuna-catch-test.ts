/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · EL BENCHMARK DE CAP RATE POR COMUNA — catch-test (21-sep-2026). 0 tokens, sin base.
// ============================================================================
// La referencia de cap rate deja de ser el 4% nacional para todos: es el BRUTO de los avisos de
// la comuna (mediana arriendo/m² × 12 sobre mediana precio/m²), en la misma celda que la mediana
// comunal, con una cascada DECLARADA en el dato y BDO como cruce citable. Fija:
//   1. la celda: comuna normalizada («Santiago Centro» → «Santiago»), condición, dormitorios,
//      superficie ±20% — la geometría del motor;
//   2. la cascada, en ese orden y declarada en `nivel`: celda 90 → celda 180 → comuna 90 →
//      comuna 180 → bdo → nacional; obra nueva rotulada con arriendo usado como proxy;
//   3. el n mínimo POR LADO (15): con 14 en un lado el peldaño no publica;
//   4. el bruto NO se ajusta por ningún factor: ni el de cierre (0,93/0,95) ni uno de arriendo;
//      el neto de BDO se convierte a bruto implícito (÷ 0,8, la conversión que BDO declara) UNA
//      sola vez, en `BDO_NETO_A_BRUTO`, y solo en el peldaño bdo (21-sep, decisión de Fabrizio);
//   5. la tabla de BDO: 22 comunas leídas del gráfico (Ñuñoa incluida, Santiago 3,0, Lo
//      Barnechea 4,7), y se busca por alias;
//   6. el cableado: la referencia inyectada llega al hallazgo (base bruta, `sujetoPct` = la
//      bruta del sujeto) y a la neutralización de la decisividad (misma referencia, misma base);
//      el snapshot se persiste en los tres flujos de creación y lo leen las dos páginas;
//   7. un solo mapa de alias: los tres mapas locales desaparecieron y todos pasan por
//      `normalizeComuna`.
// VERIFICADO EN ROJO (21-sep-2026), once mutaciones, cada una aplicada, corrida y devuelta:
//   · `construirCeldaCapRef` sin `normalizeComuna` → cae 1;
//   · `CASCADA_CAPREF` con «comuna» antes que «celda» → caen 2 y 6;
//   · `MIN_AVISOS_CAPREF` a 14 → cae 3 (×3); el peldaño exigiendo n en un solo lado → cae 3;
//   · `brutoDeMuestra` dividiendo la venta por 0,93 → cae 4 (5,38 donde debía 5,00);
//   · Santiago en 3,5 (la tabla corrida) → cae 5 (×2); sin Ñuñoa → caen 2, 4 y 5;
//   · el builder ignorando `ref.base` (sujeto = neto siempre) → cae 6;
//   · la neutralización volviendo al 4 nacional → cae 6 (×2: la magnitud y el cableado);
//   · `calcMetrics` sin pasar la referencia inyectada → cae 6 (×7);
//   · un mapa de alias local de vuelta en `cifras-guard` → cae 7.
//   node --import tsx scripts/eval/golden/capref-comuna-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import {
  AVISOS_CAPREF_CONFIANZA_ALTA,
  BDO_NETO_A_BRUTO,
  CASCADA_CAPREF,
  brutoImplicitoBdo,
  FACTOR_ARRIENDO_SUPUESTO,
  MIN_AVISOS_CAPREF,
  brutoDeMuestra,
  capRefSinAvisos,
  construirCeldaCapRef,
  evaluarPeldanoCapRef,
  resolverCapRefCascada,
  type CapRefComunaSnapshot,
  type MuestraCapRef,
} from "../../../src/lib/capref-comuna";
import { CAP_RATE_REF_NACIONAL, capRateDisplayPct, capRateNetoLtrPct, getCapRefComuna } from "../../../src/lib/cap-rate-hallazgo";
import { BDO_CAPRATE_COMUNA, bdoCapRateNetoComuna } from "../../../src/lib/data/bdo-caprate-comuna";
import { normalizeComuna } from "../../../src/lib/comuna-stats";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const T0 = "2026-09-21T00:00:00.000Z";
const muestra = (nArr: number, nVta: number, arr = 0.25, vta = 60): MuestraCapRef => ({
  arriendoUFm2Mes: Array.from({ length: nArr }, () => arr),
  ventaUFm2: Array.from({ length: nVta }, () => vta),
});

export function runCapRefComunaTier(): { hard: number } {
  fallas.length = 0;

  // 1 · la celda es la geometría del motor
  const c = construirCeldaCapRef({ comuna: "Santiago Centro", superficie: 50, dormitorios: 2, antiguedad: 20 });
  if (c.comuna !== "Santiago") F(`1 · «Santiago Centro» debía normalizar a «Santiago» (dio ${c.comuna})`);
  if (c.condicion !== "usado" || c.dormitorios !== 2) F("1 · condición usado y 2D");
  if (Math.abs(c.supMin - 40) > 1e-9 || Math.abs(c.supMax - 60) > 1e-9) F(`1 · superficie ±20% de 50 debía ser 40–60 (dio ${c.supMin}–${c.supMax})`);
  const cn = construirCeldaCapRef({ comuna: "Ñuñoa", superficie: 40, dormitorios: 0, esNuevo: true });
  if (cn.condicion !== "nuevo" || cn.dormitorios !== null) F("1 · esNuevo ⇒ nuevo, y dormitorios 0 ⇒ null (sin filtro)");

  // 2 · la cascada, en orden y declarada en el dato
  const orden = CASCADA_CAPREF.map((p) => `${p.nivel}${p.ventana}`).join(">");
  if (orden !== "celda90>celda180>comuna90>comuna180") F(`2 · el orden de la cascada es ${orden}`);
  const soloComuna180 = resolverCapRefCascada(c, (p) => (p.nivel === "comuna" && p.ventana === 180 ? muestra(20, 20) : muestra(3, 40)), T0);
  if (soloComuna180.nivel !== "comuna" || soloComuna180.ventana !== 180) F(`2 · con muestra solo en comuna@180 debía declarar nivel comuna/180 (dio ${soloComuna180.nivel}/${soloComuna180.ventana})`);
  if (soloComuna180.celda.dormitorios !== null) F("2 · en el peldaño comuna la celda no lleva dormitorios");
  const celda90 = resolverCapRefCascada(c, () => muestra(15, 15), T0);
  if (celda90.nivel !== "celda" || celda90.ventana !== 90 || celda90.celda.dormitorios !== 2) F("2 · con muestra en todos los peldaños gana celda@90 con sus dormitorios");
  const bdo = resolverCapRefCascada(construirCeldaCapRef({ comuna: "Ñuñoa", superficie: 50, dormitorios: 2, antiguedad: 20 }), () => muestra(0, 0), T0);
  if (bdo.nivel !== "bdo" || bdo.bdoNeto !== 3.4 || bdo.bruto !== null) F(`2 · Ñuñoa sin avisos debía caer a bdo 3,4 (dio ${bdo.nivel} ${bdo.bdoNeto})`);
  const nac = resolverCapRefCascada(construirCeldaCapRef({ comuna: "Pirque", superficie: 50, dormitorios: 2, antiguedad: 20 }), () => muestra(0, 0), T0);
  if (nac.nivel !== "nacional" || !/sin referencia/i.test(nac.fuente)) F("2 · Pirque sin avisos ni BDO debía caer a nacional y decirlo en la fuente");
  const nuevo = resolverCapRefCascada(cn, () => muestra(20, 20), T0);
  if (!nuevo.arriendoProxyUsado || !/proxy/.test(nuevo.fuente)) F("2 · obra nueva se rotula con arriendo usado como proxy");
  if (celda90.arriendoProxyUsado) F("2 · usado no lleva el rótulo de proxy");

  // 3 · n mínimo POR LADO
  if (MIN_AVISOS_CAPREF !== 15) F(`3 · MIN_AVISOS_CAPREF debía ser 15 (es ${MIN_AVISOS_CAPREF})`);
  const paso = { nivel: "celda" as const, ventana: 90 };
  if (evaluarPeldanoCapRef(paso, muestra(14, 40), c, T0) !== null) F("3 · 14 arriendos no publican aunque la venta sobre");
  if (evaluarPeldanoCapRef(paso, muestra(40, 14), c, T0) !== null) F("3 · 14 ventas no publican aunque el arriendo sobre");
  const justo = evaluarPeldanoCapRef(paso, muestra(15, 15), c, T0);
  if (!justo || justo.nArriendo !== 15 || justo.nVenta !== 15) F("3 · 15 y 15 publican y declaran los n");
  const sinAvisos = resolverCapRefCascada(c, () => muestra(14, 9), T0);
  if (sinAvisos.nArriendo !== 14 || sinAvisos.nVenta !== 9) F("3 · el peldaño sin avisos declara el n máximo que juntó");
  if (getCapRefComuna("x", justo).confianza !== "media") F("3 · con 15 por lado la confianza es media");
  if (getCapRefComuna("x", evaluarPeldanoCapRef(paso, muestra(AVISOS_CAPREF_CONFIANZA_ALTA, AVISOS_CAPREF_CONFIANZA_ALTA), c, T0)).confianza !== "alta") F("3 · con 30 por lado la confianza es alta");

  // 4 · sin factor: 0,25 UF/m²/mes × 12 sobre 60 UF/m² = 5,00 exacto
  const b = brutoDeMuestra(muestra(15, 15, 0.25, 60));
  if (b !== 5) F(`4 · el bruto de la muestra debía ser 5,00 sin factor (dio ${b})`);
  if (capRateDisplayPct(5 / 0.93) === 5 || capRateDisplayPct(5 * 0.93) === 5) F("4 · PISO · el fixture ya no distingue un factor de cierre");
  if (FACTOR_ARRIENDO_SUPUESTO !== 1) F("4 · el factor de arriendo es un supuesto en 1,0 y no se aplica");
  for (const p of ["src/lib/capref-comuna.ts", "src/lib/capref-comuna-query.ts", "src/lib/data/bdo-caprate-comuna.ts"]) {
    const src = leer(p);
    if (/getFactorCierre|FACTOR_CIERRE|FACTOR_ARRIENDO_SUPUESTO\s*\*|\*\s*FACTOR_ARRIENDO_SUPUESTO/.test(src)) F(`4 · ${p} aplica un factor`);
  }
  // El neto de BDO se convierte a bruto implícito UNA sola vez, con la constante que BDO declara
  // (neto = bruto × 0,8), y solo en el peldaño bdo: el capítulo habla de una sola base (21-sep).
  if (BDO_NETO_A_BRUTO !== 0.8 || brutoImplicitoBdo(3.4) !== 4.25) F("4 · el bruto implícito de BDO es neto ÷ 0,8 (3,4 → 4,25)");
  for (const p of ["src/lib/capref-comuna-query.ts", "src/lib/data/bdo-caprate-comuna.ts", "src/lib/cap-rate-hallazgo.ts", "src/lib/rentabilidad-str-hallazgo.ts"]) {
    if (/\/\s*0[.,]8\b/.test(leer(p))) F(`4 · ${p} divide por 0,8 a pelo: la conversión vive solo en BDO_NETO_A_BRUTO`);
  }
  const refBdo = getCapRefComuna("Ñuñoa", bdo);
  if (bdo.bdoNeto !== 3.4 || refBdo.base !== "bruta" || refBdo.pct !== 4.25 || refBdo.nivel !== "bdo") F(`4 · en el peldaño bdo la referencia es el bruto implícito (4,25) en base bruta (dio ${refBdo.base} ${refBdo.pct})`);

  // 5 · la tabla de BDO, leída del gráfico
  const t = BDO_CAPRATE_COMUNA.netoPorComuna;
  if (Object.keys(t).length !== 22) F(`5 · BDO cubre 22 comunas (la tabla trae ${Object.keys(t).length})`);
  for (const [k, v] of [["Santiago", 3.0], ["Ñuñoa", 3.4], ["Lo Barnechea", 4.7], ["Las Condes", 3.9], ["Maipú", 2.8], ["Estación Central", 3.5]] as const) {
    if (t[k] !== v) F(`5 · BDO ${k} debía ser ${v} (es ${t[k]}): la tabla corrida del texto ponía a Santiago en 3,5`);
  }
  if (BDO_CAPRATE_COMUNA.promedioNetoPct !== 2.98) F("5 · el promedio neto del reporte es 2,98");
  if (bdoCapRateNetoComuna("Santiago Centro") !== 3.0) F("5 · la tabla se busca por alias («Santiago Centro»)");
  if (bdoCapRateNetoComuna("Pirque") !== null) F("5 · fuera de cobertura devuelve null");
  if (!/Reporte N° 52/.test(BDO_CAPRATE_COMUNA.reporte) || !/^https:\/\/www\.bdo\.cl\//.test(BDO_CAPRATE_COMUNA.url)) F("5 · la tabla lleva reporte y URL");

  // 6 · cableado: la referencia inyectada llega al hallazgo y a la decisividad
  const seed = GOLDEN_SEEDS[0];
  const base: any = runAnalysis(seed.input, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
  const brutoSujeto = base.metrics.rentabilidadBruta as number;
  const refCelda: CapRefComunaSnapshot = { ...celda90, bruto: Math.round((brutoSujeto + 1.5) * 100) / 100 };
  const con: any = runAnalysis(seed.input, GOLDEN_UF, { ...seed.mediana, capRefComuna: refCelda }, GOLDEN_ASOF);
  const h = con.metrics.hallazgoCapRate;
  if (!h) { F("6 · el hallazgo cap_rate debía existir"); } else {
    if (h.valor.base !== "bruta" || h.valor.nivel !== "celda" || h.valor.scope !== "comuna") F(`6 · con referencia de celda el hallazgo compara en base bruta, nivel celda, scope comuna (dio ${h.valor.base}/${h.valor.nivel}/${h.valor.scope})`);
    if (h.valor.sujetoPct !== capRateDisplayPct(brutoSujeto)) F(`6 · sujetoPct debía ser la bruta del sujeto redondeada una vez (${capRateDisplayPct(brutoSujeto)}), dio ${h.valor.sujetoPct}`);
    // capRatePct es el neto DEL HERO: desde el 23-sep-2026, `rentabilidadNeta` (capRateNetoLtrPct).
    if (h.valor.capRatePct !== capRateNetoLtrPct(base.metrics)) F("6 · capRatePct no es el cap rate neto del hero (rentabilidadNeta)");
    if (h.valor.capRefPct !== capRateDisplayPct(refCelda.bruto as number)) F("6 · capRefPct es el bruto inyectado");
    if (Math.abs(h.valor.gapPts - Math.round((h.valor.sujetoPct - h.valor.capRefPct) * 10) / 10) > 1e-9) F("6 · gapPts = sujeto − referencia, en la base bruta");
    if (h.direccion !== "adverso") F("6 · 1,5 puntos bajo la referencia es adverso");
    if (h.valor.bdoNeto !== bdoCapRateNetoComuna(refCelda.celda.comuna)) F("6 · el cruce BDO viaja en el hallazgo");
    if (!/avisos de/.test(h.fraseCanonica) || /referencia nacional/.test(h.fraseCanonica)) F("6 · la frase nombra los avisos de la comuna, no la referencia nacional");
  }
  const sin: any = base.metrics.hallazgoCapRate;
  // Sin referencia, el nacional llevado a BRUTO con el factor de BDO (4,0 ÷ 0,8 = 5,0): el
  // capítulo compara siempre bruto contra bruto (23-sep-2026).
  if (!sin || sin.valor.nivel !== "nacional" || sin.valor.base !== "bruta" || sin.valor.capRefPct !== brutoImplicitoBdo(CAP_RATE_REF_NACIONAL) || sin.valor.sujetoPct !== capRateDisplayPct(base.metrics.rentabilidadBruta)) F("6 · sin referencia inyectada el hallazgo declara nivel nacional y compara bruto contra 5,0 bruto");
  // La neutralización sigue a la referencia: con la referencia igual a la bruta del sujeto, el
  // arriendo neutralizado es el propio y la decisión no se mueve (magnitud 0); con el nacional
  // (5,0 bruto contra una bruta distinta) sí se mueve.
  const refIgual: CapRefComunaSnapshot = { ...celda90, bruto: brutoSujeto };
  const igual: any = runAnalysis(seed.input, GOLDEN_UF, { ...seed.mediana, capRefComuna: refIgual }, GOLDEN_ASOF);
  const magIgual = igual.metrics.hallazgoCapRate?.magnitudContinua ?? -1;
  const magNac = base.metrics.hallazgoCapRate?.magnitudContinua ?? -1;
  if (magIgual !== 0) F(`6 · con la referencia igual a la bruta del sujeto la neutralización no mueve nada (magnitud ${magIgual})`);
  if (magNac === 0) F("6 · PISO · GS-1 contra el nacional debía mover la decisión (magnitud 0): el fixture ya no distingue la referencia");
  const an = leer("src/lib/analysis.ts");
  if (/CAP_RATE_REF_NACIONAL/.test(an)) F("6 · analysis.ts vuelve a neutralizar contra CAP_RATE_REF_NACIONAL a pelo");
  if (!/solveArriendoForCapRate\(input, ufClp, medianaComuna, refNeu\.pct\)/.test(an)) F("6 · la neutralización no usa la referencia resuelta");
  if (!/getCapRefComuna\(input\.comuna, medianaComunaVentaUF\?\.capRefComuna\)/.test(an)) F("6 · calcMetrics no pasa la referencia inyectada al builder");
  for (const p of ["src/app/api/analisis/route.ts", "src/app/api/analisis/recalculate/route.ts"]) {
    if (!/capref_comuna_snapshot: medianaComuna\.capRefComuna \?\? null/.test(leer(p))) F(`6 · ${p} no persiste capref_comuna_snapshot`);
  }
  if (!/capref_comuna_snapshot: medianaComuna\?\.capRefComuna \?\? null/.test(leer("src/app/api/analisis/locked/route.ts"))) F("6 · locked no persiste capref_comuna_snapshot");
  // (25-sep-2026) El informe salió de la ruta a `informe-*.tsx` para que el demo público lo dibuje igual.
  for (const p of ["src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/[id]/documento/page.tsx"]) {
    if (!/capRefComuna: capRefSnapshot \?\? \(await prefetchCapRefComuna\(/.test(leer(p))) F(`6 · ${p} no lee el snapshot (ni resuelve vivo sin él)`);
  }
  if (!/return \{ \.\.\.mediana, capRefComuna \};/.test(leer("src/lib/api-helpers/analisis-pipeline.ts"))) F("6 · el prefetch de la mediana no trae la referencia");
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: se fue el chequeo de que la generación usara la misma referencia; el
  // generador ya no existe.
  if (!/ADD COLUMN IF NOT EXISTS capref_comuna_snapshot JSONB/.test(leer("supabase/migrations/20260921_capref_comuna_snapshot.sql"))) F("6 · falta la migración de la columna");
  if (!/\{ nivel: "celda", ventana: 90 \}/.test(leer("src/lib/capref-comuna.ts")) || !/for \(const paso of CASCADA_CAPREF\)/.test(leer("src/lib/capref-comuna-query.ts"))) F("6 · la resolución viva no itera CASCADA_CAPREF");
  if (!/evaluarPeldanoCapRef\(paso, muestra, celda, resolvedAt\)/.test(leer("src/lib/capref-comuna-query.ts")) || !/capRefSinAvisos\(celda, resolvedAt/.test(leer("src/lib/capref-comuna-query.ts"))) F("6 · la resolución viva no decide con las mismas funciones puras");

  // 7 · un solo mapa de alias
  if (normalizeComuna("Santiago Centro") !== "Santiago" || normalizeComuna("Santiago centro") !== "Santiago") F("7 · normalizeComuna no resuelve los dos alias");
  // ⚠ ACTA (25-sep-2026) · RETIRO DE LA IA, PARTE 2: `cifras-guard.ts` se borró, y con él su mapa de alias.
  if (/const COMUNA_ALIASES/.test(leer("src/lib/comunas-disponibles.ts"))) F("7 · comunas-disponibles conserva su propio mapa de alias");
  if (/ALIAS_COMUNA/.test(leer("src/lib/engines/str-universo-santiago.ts"))) F("7 · str-universo conserva su propio mapa de alias");
  for (const p of ["src/lib/comunas-disponibles.ts", "src/lib/engines/str-universo-santiago.ts", "src/lib/data/bdo-caprate-comuna.ts"]) {
    if (!/\bnormalizeComuna\b/.test(leer(p))) F(`7 · ${p} no pasa por normalizeComuna`);
  }
  void capRefSinAvisos;

  if (fallas.length) {
    console.log(`   capref-comuna ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   capref-comuna ✓ (celda del motor, cascada declarada, n ≥ 15 por lado, sin factor, BDO de 22 comunas, cableado hasta el hallazgo y la decisividad, un solo alias)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCapRefComunaTier();
  process.exit(hard ? 1 : 0);
}
