/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · LA REFERENCIA STR CONTRA STR DE LA ZONA — catch-test (21-sep-2026). 0 tokens, sin base.
// ============================================================================
// El umbral de `rentabilidad_str` es lo que rinde, después de operar, un Airbnb típico de la
// misma comuna y tipología, con la base del estimador de AirROI (la del motor) y el modelo de
// costos del motor, sin punto extra. Fija:
//   1. la celda: comuna normalizada («Santiago Centro» → «Santiago») × dormitorios (0..3); la
//      venta usa 1D como proxy del studio;
//   2. la cascada corta, declarada en `nivel`: celda → comuna → sin_referencia; sin BDO ni LTR;
//   3. el mínimo POR LADO (15 direcciones y 15 ventas): con 14 en un lado no publica;
//   4. sin punto extra: el umbral del hallazgo ES el yield neto de la zona (a un decimal), y el
//      hallazgo sin referencia declara `sin_referencia` con el 5% de respaldo;
//   5. la base del estimador y no los listings realizados: la resolución viva lee
//      `raw_response.percentiles` (p50 de tarifa y ocupación por dirección) y NUNCA
//      `comparable_listings`; el ingreso ya trae su ocupación (adr × occ × 365 de la misma
//      respuesta), y el yield aplica el modelo de costos del motor (comisión, COSTOS_DEFAULT,
//      gastos comunes por m² y contribuciones de la comuna);
//   6. cableado: el ensamblador STR deriva el umbral del snapshot de la zona y lo reciben
//      hallazgo, neutralización, cierres y guard; se persiste en `strref_zona_snapshot` y la
//      página STR prefiere el snapshot; BDO no aparece por símbolo en ningún archivo STR.
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · `resolverStrRefZonaVivo` sin `normalizeComuna` → cae 1; `dormitoriosVentaProxy` devolviendo 0 → cae 1;
//   · `CASCADA_STRREF` con «comuna» primero → cae 2; `MIN_STRREF` a 14 → cae 3; el peldaño
//     exigiendo n en un solo lado → cae 3;
//   · `umbralStrDesdeZona` sumando 1 → cae 4; `yieldStrZona` sin la comisión → cae 5;
//   · la consulta leyendo `comparable_listings` → cae 5; el ensamblador volviendo a
//     `getCapRefComuna` → cae 6; una rama «bdo» de vuelta en la copy STR → cae 6.
//   node --import tsx scripts/eval/golden/strref-zona-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASCADA_STRREF,
  MIN_STRREF,
  MIN_TIPOLOGIA_POOL,
  comunaDeDireccionAirroi,
  dormitoriosVentaProxy,
  evaluarPeldanoStrRef,
  resolverStrRefCascada,
  yieldStrZona,
  type DireccionEstimada,
  type StrRefZonaSnapshot,
} from "../../../src/lib/strref-zona";
import { buildHallazgoRentabilidadStr, umbralStrDesdeZona, CAP_STR_UMBRAL_PCT } from "../../../src/lib/rentabilidad-str-hallazgo";
import { COMISION_AIRBNB, COSTOS_DEFAULT } from "../../../src/lib/engines/short-term-engine";
import { getMarketData } from "../../../src/lib/comunas";
import { fuenteUmbralStr, explicacionUmbralStr } from "../../../src/lib/capref-copy";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const T0 = "2026-09-21T00:00:00.000Z";
const dirs = (n: number, d = 1, ingreso = 6_825_431, comuna = "Santiago"): DireccionEstimada[] => Array.from({ length: n }, () => ({ comuna, dormitorios: d, ingresoAnual: ingreso }));
const venta = (n: number, precio = 78_688_474, m2 = 32) => ({ n, precioP50: precio, m2P50: m2 });

export function runStrRefZonaTier(): { hard: number } {
  fallas.length = 0;
  const celda = { comuna: "Santiago", dormitorios: 1 };

  // 1 · la celda
  if (comunaDeDireccionAirroi("Merced 562, 8320148 Santiago, Región Metropolitana, Chile") !== "Santiago") F("1 · la dirección con región resuelve a Santiago");
  if (comunaDeDireccionAirroi("Av. Providencia 1234, Providencia, Región Metropolitana, Chile") !== "Providencia") F("1 · la dirección con región resuelve a Providencia");
  if (comunaDeDireccionAirroi("Santiago Centro, Región Metropolitana, Chile") !== "Santiago") F("1 · «Santiago Centro» normaliza a «Santiago»");
  if (comunaDeDireccionAirroi("Calle Sin Comuna 1") !== null) F("1 · sin comuna reconocible devuelve null");
  if (dormitoriosVentaProxy(0) !== 1 || dormitoriosVentaProxy(2) !== 2 || dormitoriosVentaProxy(5) !== 3) F("1 · el proxy de venta: studio → 1D, tope 3");
  const q = leer("src/lib/strref-zona-query.ts");
  if (!/const comuna = normalizeComuna\(input\.comuna\);/.test(q)) F("1 · la resolución viva no normaliza la comuna");
  if (!/\.eq\("dormitorios", dormitorios\)/.test(q) || !/dormitoriosVentaProxy\(d\)/.test(q)) F("1 · la venta no filtra por la tipología proxy");

  // 2 · la cascada corta, declarada
  if (CASCADA_STRREF.join(">") !== "celda>comuna") F(`2 · la cascada es ${CASCADA_STRREF.join(">")}`);
  const soloComuna = resolverStrRefCascada(celda, (n) => (n === "comuna" ? { direcciones: dirs(30), venta: venta(40) } : { direcciones: dirs(3), venta: venta(40) }), T0);
  if (soloComuna.nivel !== "comuna" || soloComuna.celda.dormitorios !== null) F(`2 · con celda corta cae a «comuna» sin dormitorios (dio ${soloComuna.nivel}/${soloComuna.celda.dormitorios})`);
  const enCelda = resolverStrRefCascada(celda, () => ({ direcciones: dirs(15), venta: venta(15) }), T0);
  if (enCelda.nivel !== "celda" || enCelda.celda.dormitorios !== 1) F("2 · con muestra en la celda gana «celda» con sus dormitorios");
  const sin = resolverStrRefCascada(celda, () => ({ direcciones: dirs(2), venta: venta(3) }), T0);
  if (sin.nivel !== "sin_referencia" || sin.neto !== null || !/sin referencia/i.test(sin.fuente)) F("2 · sin muestra declara sin_referencia con neto null y lo dice");
  if (sin.nDirecciones !== 2 || sin.nVenta !== 3) F("2 · sin referencia declara el n máximo que juntó");
  const s = leer("src/lib/strref-zona.ts");
  if (/bdo|BDO|nacional|capref/i.test(s.replace(/\/\/[^\n]*/g, ""))) F("2 · strref-zona.ts nombra BDO, nacional o el benchmark LTR fuera de comentarios");
  // 2b · el peldaño «comuna» pooled-ea SOLO las estimaciones: la venta y los costos son los de la
  // tipología del sujeto (Vitacura daba −0,3% con la venta pooled de 148 m²; decisión 21-sep).
  if (!/estimaciones de Airbnb \(todas las tipologías\)/.test(soloComuna.fuente) || !/venta usados \(1D, 90 días\)/.test(soloComuna.fuente)) F(`2b · la fuente de «comuna» no declara estimaciones pooled sobre la venta de la tipología (${soloComuna.fuente})`);
  const enCeldaC = resolverStrRefCascada({ comuna: "Santiago", dormitorios: 3 }, () => ({ direcciones: dirs(15, 3), venta: venta(15) }), T0);
  const comunaC = resolverStrRefCascada({ comuna: "Santiago", dormitorios: 3 }, (n) => (n === "comuna" ? { direcciones: [...dirs(5, 3), ...dirs(25, 1)], venta: venta(15) } : { direcciones: dirs(3, 3), venta: venta(15) }), T0);
  if (enCeldaC.costosMes !== comunaC.costosMes || comunaC.costosMes === null) F(`2b · los costos de «comuna» no son los de la tipología del sujeto (3D: celda ${enCeldaC.costosMes} vs comuna ${comunaC.costosMes})`);
  // 2c · el caché de AirROI se lee con el service role: `airbnb_estimates` tiene RLS sin políticas
  // y el cliente de sesión devuelve CERO filas sin error (el snapshot nacía «sin referencia»).
  const qCache = q.replace(/\/\/[^\n]*/g, "");
  const fnDirs = qCache.match(/async function direccionesDeComuna\(([^)]*)\)[^]*?\n}/);
  if (!fnDirs || /supabase/.test(fnDirs[1]) || !/process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(qCache) || !/const supabase = clienteAdminCache\(\);/.test(fnDirs[0])) F("2c · direccionesDeComuna no lee airbnb_estimates con el cliente admin (service role)");
  // 2d · el peldaño «comuna» solo vale con la tipología del sujeto en el pool (n ≥ 5 y ≥ 10%), y un
  //      yield ≤ 0 nunca es referencia (decisión de Fabrizio, 22-sep-2026: las 20 filas de Vitacura,
  //      Ñuñoa 3D y Macul 3D caen a «sin referencia»).
  if (MIN_TIPOLOGIA_POOL.n !== 5 || MIN_TIPOLOGIA_POOL.share !== 0.1) F(`2d · MIN_TIPOLOGIA_POOL debía ser n 5 / share 0,10 (es ${JSON.stringify(MIN_TIPOLOGIA_POOL)})`);
  const c3 = { comuna: "Santiago", dormitorios: 3 };
  const pool = (n3: number, n1: number) => [...dirs(n3, 3), ...dirs(n1, 1)];
  const poolCorto = resolverStrRefCascada(c3, (n) => (n === "comuna" ? { direcciones: pool(4, 40), venta: venta(15) } : { direcciones: dirs(4, 3), venta: venta(15) }), T0);
  if (poolCorto.nivel !== "sin_referencia") F(`2d · con 4 de la tipología en el pool (< n 5) el peldaño comuna publicó (${poolCorto.nivel})`);
  const poolDiluido = resolverStrRefCascada(c3, (n) => (n === "comuna" ? { direcciones: pool(5, 60), venta: venta(15) } : { direcciones: dirs(5, 3), venta: venta(15) }), T0);
  if (poolDiluido.nivel !== "sin_referencia") F(`2d · con 5 de 65 (8% < share) el peldaño comuna publicó (${poolDiluido.nivel})`);
  const poolOk = resolverStrRefCascada(c3, (n) => (n === "comuna" ? { direcciones: pool(5, 40), venta: venta(15) } : { direcciones: dirs(5, 3), venta: venta(15) }), T0);
  if (poolOk.nivel !== "comuna") F(`2d · con 5 de 45 (11%) el peldaño comuna no publicó (${poolOk.nivel})`);
  const negativo = resolverStrRefCascada(celda, () => ({ direcciones: dirs(20), venta: venta(20, 900_000_000, 32) }), T0);
  if (negativo.nivel !== "sin_referencia") F(`2d · un yield neto ≤ 0 se publicó como referencia (${negativo.nivel} / ${negativo.neto})`);
  // Positivo al decimal que se muestra: con este precio el neto da 0,04 (se imprime «0,0%»).
  const casiCero = resolverStrRefCascada(celda, () => ({ direcciones: dirs(20), venta: venta(20, 604_343_481, 32) }), T0);
  if (casiCero.nivel !== "sin_referencia") F(`2d · un yield que se imprime «0,0%» se publicó como referencia (${casiCero.nivel} / ${casiCero.neto})`);
  const qVenta = q.replace(/\/\/[^\n]*/g, "");
  if ((qVenta.match(/ventaDe\(supabase, comuna, dormitoriosVentaProxy\(d\), ufValue\)/g) ?? []).length !== 1 || /ventaDe\(supabase, comuna, (null|nivel)/.test(qVenta)) F("2b · la resolución viva no trae UNA venta de la tipología del sujeto para los dos peldaños");

  // 3 · el mínimo por lado
  if (MIN_STRREF !== 15) F(`3 · MIN_STRREF debía ser 15 (es ${MIN_STRREF})`);
  if (evaluarPeldanoStrRef("celda", dirs(14), venta(40), celda, T0) !== null) F("3 · 14 direcciones no publican aunque la venta sobre");
  if (evaluarPeldanoStrRef("celda", dirs(40), venta(14), celda, T0) !== null) F("3 · 14 ventas no publican aunque las direcciones sobren");
  const justo = evaluarPeldanoStrRef("celda", dirs(15), venta(15), celda, T0);
  if (!justo || justo.nDirecciones !== 15 || justo.nVenta !== 15) F("3 · 15 y 15 publican y declaran los n");

  // 4 · sin punto extra
  const snap = justo as StrRefZonaSnapshot;
  const u = umbralStrDesdeZona(snap);
  if (u.pct !== Math.round((snap.neto as number) * 10) / 10 || u.nivel !== "celda" || u.comuna !== "Santiago" || u.dormitorios !== 1) F(`4 · el umbral ES el yield neto de la zona a un decimal (${snap.neto} → dio ${u.pct})`);
  if (Math.abs(u.pct - (snap.neto as number)) > 0.06) F("4 · PISO · el fixture no distingue un punto extra");
  const uSin = umbralStrDesdeZona(sin);
  if (uSin.pct !== CAP_STR_UMBRAL_PCT || uSin.nivel !== "sin_referencia") F("4 · sin referencia el umbral de respaldo es 5 y se declara sin_referencia");
  const h = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str", umbral: u });
  if (!h || h.valor.umbralPct !== u.pct || h.valor.nivel !== "celda" || h.valor.refPct !== u.pct || h.valor.nDirecciones !== 15) F("4 · el hallazgo declara el umbral y su procedencia");
  if (h && !/proyectan los Airbnb de 1 dormitorio en Santiago/.test(h.fraseCanonica)) F(`4 · la frase nombra lo que proyectan los Airbnb de la celda: «${h?.fraseCanonica}»`);
  const hs = buildHallazgoRentabilidadStr({ capRatePct: 5.4, decisividad: 0.5, modalidad: "str", umbral: uSin });
  if (!hs || hs.valor.nivel !== "sin_referencia" || !/No hay Airbnb suficientes/.test(hs.fraseCanonica)) F("4 · sin referencia el hallazgo lo dice");
  if (/cap rate/i.test((h?.fraseCanonica ?? "") + (hs?.fraseCanonica ?? ""))) F("4 · la frase STR dice «cap rate»");

  // 5 · la base del estimador, el ingreso con su ocupación, el modelo de costos del motor
  const y = yieldStrZona({ ingresoAnual: 6_825_431, precio: 78_688_474, m2: 32, comuna: "Santiago", dormitorios: 1 });
  const cd = COSTOS_DEFAULT["1"], md = getMarketData("Santiago");
  const costos = cd[0] + cd[1] + cd[2] + cd[3] + cd[4] + md.gastosComunesPorM2 * 32 + (78_688_474 * md.contribucionesPctAnual) / 100 / 12;
  const netoEsperado = Math.round(((6_825_431 * (1 - COMISION_AIRBNB) - costos * 12) / 78_688_474) * 100 * 100) / 100;
  if (y.neto !== netoEsperado) F(`5 · el neto de la zona usa comisión, costos por tipología, GC y contribuciones del motor (esperado ${netoEsperado}, dio ${y.neto})`);
  if (y.bruto !== Math.round((6_825_431 / 78_688_474) * 100 * 100) / 100) F("5 · el bruto es ingreso ÷ precio");
  if (Math.round(((6_825_431 - costos * 12) / 78_688_474) * 100 * 100) / 100 === y.neto) F("5 · PISO · el fixture no distingue la comisión");
  if (/comparable_listings|ttm_revenue|ttm_occupancy|ttm_avg_rate/.test(q)) F("5 · la resolución viva lee los listings realizados: la base es el estimador");
  if (!/raw_response->percentiles/.test(q) || !/adr \* occ \* 365/.test(q)) F("5 · la resolución viva no lee el p50 de tarifa y ocupación del estimador ni proyecta adr × occ × 365 de la misma respuesta");
  if (/ocupacionReferencia|occFinal|ocupacionBaseline/.test(q + s)) F("5 · la referencia mezcla la ocupación que el motor estima con tarifas de listing (doble conteo)");

  // 6 · cableado y BDO fuera por símbolo
  const asm = leer("src/lib/str-hallazgos.ts");
  if (!/umbralStrDesdeZona\(ctx\.mediana\.strRefZona, ctx\.comuna \|\| ""\)/.test(asm) || !/umbral: umbralStr,/.test(asm) || !/umbralPct: umbralStr\.pct/.test(asm)) F("6 · el ensamblador STR no deriva el umbral del snapshot de la zona para hallazgo y decisividad");
  if (!/\(extras\.umbralPct \?\? CAP_STR_UMBRAL_PCT\) \/ 100/.test(leer("src/lib/decisividades-str.ts"))) F("6 · la neutralización STR no usa el umbral resuelto");
  if (!/const umbralPct = hRenta\?\.valor\.umbralPct \?\? CAP_STR_UMBRAL_PCT;/.test(leer("src/lib/cierres-str-ensamblador.ts"))) F("6 · los cierres STR no usan el umbral del hallazgo");
  if (!/div\(r\.capPct, r\.umbralPct \?\? CAP_STR_UMBRAL_PCT\)/.test(leer("src/lib/str-guards.ts"))) F("6 · el guard STR no usa el umbral del hallazgo");
  const pipe = leer("src/lib/api-helpers/analisis-pipeline.ts");
  if (!/strref_zona_snapshot: medianaComuna\?\.strRefZona \?\? null,/.test(pipe) || !/export async function prefetchMercadoStr\(/.test(pipe) || !/if \(snapshot\) return snapshot;/.test(pipe)) F("6 · el pipeline no persiste el snapshot STR ni prefiere el persistido");
  for (const p of ["src/app/analisis/renta-corta/[id]/page.tsx", "src/app/analisis/renta-corta/[id]/documento/page.tsx", "src/lib/str-prosa-persist.ts"]) {
    if (!/strref_zona_snapshot as StrRefZonaSnapshot/.test(leer(p)) || !/prefetchMercadoStr\(/.test(leer(p))) F(`6 · ${p} no pasa el snapshot persistido a prefetchMercadoStr`);
  }
  if (!/ADD COLUMN IF NOT EXISTS strref_zona_snapshot JSONB/.test(leer("supabase/migrations/20260921b_strref_zona_snapshot.sql"))) F("6 · falta la migración de la columna");
  for (const p of ["src/lib/rentabilidad-str-hallazgo.ts", "src/lib/str-hallazgos.ts", "src/lib/decisividades-str.ts", "src/lib/cierres-str-ensamblador.ts", "src/lib/cierres-capitulos-str.ts", "src/lib/str-guards.ts", "src/lib/strref-zona.ts", "src/lib/strref-zona-query.ts", "src/components/analysis/str/CapitulosInversionStr.tsx"]) {
    const src = leer(p).replace(/\/\/[^\n]*/g, "").replace(/\/\*[^]*?\*\//g, "");
    if (/\bBDO\b|bdoNeto|capRefComuna|getCapRefComuna|umbralStrDesde\(|PRIMA_STR/.test(src)) F(`6 · ${p} sigue nombrando BDO o la referencia LTR (por símbolo)`);
  }
  const copy = leer("src/lib/capref-copy.ts");
  const strCopy = copy.slice(copy.indexOf("export interface RefStrCopy"), copy.indexOf("/** Cómo se llama la referencia en el capítulo"));
  if (/bdo|nacional|un punto sobre/i.test(strCopy.replace(/\/\/[^\n]*/g, "").replace(/\/\*[^]*?\*\//g, ""))) F("6 · la copy STR conserva una rama bdo/nacional o «un punto sobre»");
  if (fuenteUmbralStr({ nivel: "celda", comuna: "Providencia", celdaDormitorios: 1 }) !== "Referencia: lo que proyectan los Airbnb de 1 dormitorio en Providencia.") F(`6 · fuente STR celda: «${fuenteUmbralStr({ nivel: "celda", comuna: "Providencia", celdaDormitorios: 1 })}»`);
  if (fuenteUmbralStr({ nivel: "comuna", comuna: "Providencia", celdaDormitorios: null }) !== "Referencia: lo que proyectan los Airbnb de Providencia.") F("6 · fuente STR comuna");
  if (!/^Sin referencia/.test(fuenteUmbralStr({ nivel: "sin_referencia", comuna: "Maipú", celdaDormitorios: null }))) F("6 · fuente STR sin referencia lo dice");
  if (/cap rate|umbral/i.test(explicacionUmbralStr({ nivel: "celda", comuna: "Providencia", celdaDormitorios: 1 }))) F("6 · la explicación STR dice «cap rate» o «umbral»");

  if (fallas.length) {
    console.log(`   strref-zona ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   strref-zona ✓ (celda comuna × dormitorios, cascada celda → comuna → sin referencia, 15 por lado, sin punto extra, base del estimador con los costos del motor, BDO fuera de STR por símbolo)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runStrRefZonaTier();
  process.exit(hard ? 1 : 0);
}
