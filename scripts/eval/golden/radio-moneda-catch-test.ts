// ============================================================================
// GOLDEN · RADIO-MONEDA (30-sep-2026) — catch-test
// ============================================================================
//   La venta nueva por radio salía con precio ~0 por m²: la obra nueva se publica en UF y la mediana
//   del radio trataba `precio` como pesos; el consumidor, que espera pesos por m², lo dividía por la UF.
//   El valor de mercado de 9 análisis de obra nueva quedó en UF 0 y el motor lo descartó.
//   1 · TODO PRECIO DEL RADIO SALE EN PESOS: `aPesos` convierte las filas en UF; la única lectura de la
//       RPC (leerRadio) lo aplica en sus dos salidas; sin UF válida, una fila en UF se descarta.
//   2 · UN PRECIO POR M² ABSURDO NO ES UN VALOR DE MERCADO: bajo UF 10/m² la referencia es null.
//   3 · /comunas/[slug] USA UNA VENTANA Y LA VENTA USADA: 90 días (la del motor) y sin obra nueva.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/radio-moneda-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aPesos, resumirComparablesRadio } from "../../../src/lib/services/comparables-radio";
import { PISO_UF_M2, valorMercadoRefDeSugerencia } from "../../../src/lib/valor-mercado";
import { entraVentaComuna, VENTANA_DIAS_COMUNA } from "../../../src/lib/data/comunas-seo";
import { ESPERAS_REINTENTO, esErrorTransitorio, reintentarConsulta } from "../../../src/lib/reintento-transitorio";
import { marcarRadio, type Sugerencias } from "../../../src/lib/services/market-suggestions";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

export async function runRadioMonedaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER RADIO-MONEDA (todo precio del radio en pesos · 0 tokens) ───");

  // ── 1 · aPesos ──
  const uf = 41000;
  const filas = [
    { precio: 4790, moneda: "UF", superficie_m2: 25.6 },
    { precio: 120_000_000, moneda: "CLP", superficie_m2: 50 },
    { precio: 3000, moneda: null, superficie_m2: 40 },
  ];
  const p = aPesos(filas, uf);
  if (p.length !== 3 || p[0].precio !== 4790 * uf || p[1].precio !== 120_000_000 || p[2].precio !== 3000) F(`1 · aPesos no deja todo en pesos (${JSON.stringify(p.map((x) => x.precio))})`);
  if (aPesos(filas, 0).some((x) => x.moneda === "UF")) F("1 · sin UF válida, una fila en UF se cuenta como pesos");
  // La mediana de un radio de obra nueva en UF, ya en pesos, da un UF/m² de mercado.
  const nuevas = Array.from({ length: 8 }, (_, i) => ({ precio: (170 + i * 2) * 30, moneda: "UF", superficie_m2: 30, dormitorios: 1 }));
  const r = resumirComparablesRadio(aPesos(nuevas, uf), 30, { modo: "conDorms", factorCierre: 1 });
  const ufM2 = r?.precioM2 ? r.precioM2 / uf : 0;
  if (!(ufM2 > 150 && ufM2 < 200)) F(`1 · la venta nueva por radio no sale a precio de mercado (UF ${ufM2.toFixed(3)}/m²)`);
  const ms = leer("src/lib/services/market-suggestions.ts");
  const salidas = ms.match(/if \(error\) \{ reg\.fallas\+\+; return \{ data: aPesos\(filas, uf\), error \}; \}/g)?.length ?? 0;
  const salidas2 = ms.match(/if \(pagina\.length < PAGINA_POSTGREST\) return \{ data: aPesos\(filas, uf\), error: null \};/g)?.length ?? 0;
  if (salidas !== 1 || salidas2 !== 1 || !/const uf = await getUFValue\(\);\n  for \(let off = 0; ; off \+= PAGINA_POSTGREST\)/.test(ms)) F("1 · leerRadio no pasa las dos salidas por aPesos");
  // Sin nombrar la RPC: el tier LECTURA-PAGINADA exige que su nombre solo aparezca en la llamada misma.
  if ((ms.match(/\.rpc\(/g)?.length ?? 0) !== 1) F("1 · hay otra lectura de la RPC fuera de leerRadio (se saltaría aPesos)");

  // ── 2 · el piso del valor de mercado ──
  const base = { superficieUtilM2: 25.6, source: "radio", sampleSize: 6, universoVenta: "nuevo", radiusUsed: 500 };
  if (valorMercadoRefDeSugerencia({ ...base, precioM2UF: 0.0044 }) !== null) F("2 · un precio de UF 0,004/m² viaja como valor de mercado");
  const bueno = valorMercadoRefDeSugerencia({ ...base, precioM2UF: 178.4 });
  if (!bueno || bueno.valorUF !== Math.round(178.4 * 25.6)) F("2 · un precio sano no arma su referencia");
  if (PISO_UF_M2 !== 10) F(`2 · el piso no es UF 10/m² (${PISO_UF_M2})`);

  // ── 3 · /comunas ──
  const cs = leer("src/lib/data/comunas-seo.ts");
  if (VENTANA_DIAS_COMUNA !== 90 || !/\.gt\("precio", 0\)\s*\.gte\("scraped_at", desde\)/.test(cs) || !/const desde = new Date\(Date\.now\(\) - VENTANA_DIAS_COMUNA \* 864e5\)\.toISOString\(\)\.slice\(0, 10\);/.test(cs)) F("3 · /comunas no lee con la ventana de 90 días");
  if (entraVentaComuna({ condicion: "nuevo" }) || !entraVentaComuna({ condicion: "usado" }) || !entraVentaComuna({ condicion: null })) F("3 · la venta de /comunas no es la usada (o deja fuera los sin condición)");
  if (!/const ventaRowsRaw = \(await fetchAllRows\(supabase, "venta"\)\)\.filter\(entraVentaComuna\);/.test(cs)) F("3 · la página no aplica el filtro de venta usada");

  // ── 4 · el reintento y la caída no silenciosa (30-sep-2026, Sentry W/Q «fetch failed») ──
  {
    const red = { message: "TypeError: fetch failed" };
    if (!esErrorTransitorio(red) || esErrorTransitorio({ message: "relation does not exist", code: "42P01" }) || esErrorTransitorio({ message: "x", code: "PGRST116" }) || esErrorTransitorio({ message: "canceling statement due to statement timeout", code: "57014" }) || esErrorTransitorio(null)) F("4 · no distingue un corte de red de un error de la consulta");
    if (ESPERAS_REINTENTO.length !== 2 || !(ESPERAS_REINTENTO[0] > 0 && ESPERAS_REINTENTO[1] > ESPERAS_REINTENTO[0])) F(`4 · el reintento por defecto no son dos esperas crecientes (${JSON.stringify(ESPERAS_REINTENTO)})`);
    const seq = (lista: Array<{ error: { message: string; code?: string } | null }>) => { let k = 0; return { fn: () => Promise.resolve(lista[Math.min(k++, lista.length - 1)]), n: () => k }; };
    const a = seq([{ error: red }, { error: red }, { error: null }]);
    const ra = await reintentarConsulta(a.fn, [0, 0]);
    if (ra.error || a.n() !== 3 || ra.intentos !== 3) F(`4 · un corte de red no se reintenta dos veces (${a.n()} intentos)`);
    const b = seq([{ error: red }]);
    const rb = await reintentarConsulta(b.fn, [0, 0]);
    if (!rb.error || b.n() !== 3) F(`4 · tras reintentar, el error no vuelve (${b.n()} intentos)`);
    const c = seq([{ error: { message: "no existe", code: "42P01" } }]);
    await reintentarConsulta(c.fn, [0, 0]);
    if (c.n() !== 1) F("4 · un error de la consulta se reintenta (no lo arregla)");
    const base: Sugerencias = { arriendo: 500000, ggcc: null, contribTrim: null, source: "comuna", sampleSize: 30 };
    const m0 = marcarRadio(base, { fallas: 0 });
    const m2 = marcarRadio(base, { fallas: 2 });
    const mr = marcarRadio({ ...base, source: "radio" }, { fallas: 1 });
    if (m0.degradada !== undefined || m2.degradada !== true || m2.lecturasRadioFallidas !== 2 || mr.degradada !== false || mr.lecturasRadioFallidas !== 1) F("4 · la sugerencia no queda marcada cuando el radio falló (o se marca sin falla)");
    const ms2 = leer("src/lib/services/market-suggestions.ts");
    if (!/const \{ data, error \} = await reintentarConsulta\(\(\) => supabase/.test(ms2) || !/if \(error\) \{ reg\.fallas\+\+; return/.test(ms2)) F("4 · la lectura del radio no reintenta o no cuenta la falla");
    if (!/return marcarRadio\(s, reg\);/.test(ms2)) F("4 · getSugerencias no marca la sugerencia");
    const ev = leer("src/lib/avisos/evaluar-aviso.ts");
    if (!/radio_degradado: !!arr\.degradada \|\| !!vta\.degradada,/.test(ev) || !/lecturas_radio_fallidas: \(arr\.lecturasRadioFallidas \?\? 0\) \+ \(vta\.lecturasRadioFallidas \?\? 0\),/.test(ev)) F("4 · la fila evaluada no guarda la degradación");
    const cr = leer("src/app/api/cron/evaluar-avisos/route.ts");
    if (!/if \(fila\.radio_degradado\) degradadas\+\+;/.test(cr) || !/exitosos: exitosos - degradadas, fallidos: fallidos \+ degradadas/.test(cr)) F("4 · el cierre del cron no cuenta las degradadas como falla");
    if (!/add column if not exists radio_degradado boolean not null default false/.test(leer("supabase/migrations/20260930_avisos_radio_degradado.sql"))) F("4 · la migración no crea la columna");
  }

  if (fallas.length) {
    console.log(`  ✗ RADIO-MONEDA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el radio sale en pesos (la venta nueva da su UF/m² de mercado), bajo UF 10/m² no hay valor de mercado y /comunas lee 90 días de venta usada");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES ─────────────────────────────────────────────────────────
// 30-sep-2026, scratchpad mutar.py: 8/8 en rojo, restauradas byte a byte.
//   R1 aPesos no convierte ........................................ 1 · no deja todo en pesos
//   R2 sin UF, la fila en UF entra como pesos ...................... 1 · sin UF válida se cuenta como pesos
//   R3 leerRadio sin aPesos (el bug) ............................... 1 · no pasa las dos salidas por aPesos
//   R4 sin piso del valor de mercado ............................... 2 · UF 0,004/m² viaja como valor de mercado
//   R5 /comunas sin ventana ........................................ 3 · no lee con la ventana de 90 días
//   R6 /comunas con obra nueva ..................................... 3 · la venta no es la usada
//   R7 /comunas deja fuera los sin condición ....................... 3 · ídem
//   R8 el filtro no se aplica ...................................... 3 · la página no aplica el filtro
// 30-sep-2026: la cuenta de lecturas de la RPC ya no nombra la función (LECTURA-PAGINADA lo prohíbe fuera
// de la llamada: el QUICK de master quedó en rojo con 67f7bff7). 1/1 en rojo.
//   R9 otra lectura de la RPC fuera de leerRadio ................... 1 · hay otra lectura fuera de leerRadio
// 30-sep-2026 (reintento del radio y caída no silenciosa, Sentry W/Q): 9/9 en rojo.
//   T1 sin reintento por defecto (quedó VERDE: el test pasaba sus propias esperas; ahora exige las del módulo)
//   T2 reintenta errores con código (quedó VERDE: el mensaje de prueba no sonaba a red; ahora usa el
//      statement timeout 57014, un error de la consulta que dice «timeout»)
//   T3 no reconoce «fetch failed» ................................... 4 · no distingue red de consulta
//   T4 leerRadio sin reintento ...................................... 4 · no reintenta
//   T5 la falla no se cuenta ........................................ 1 · (la salida con error cambia de forma)
//   T6 la sugerencia no se marca .................................... 4 · getSugerencias no marca
//   T7 marca degradada aunque salga del radio ....................... 4 · marcada sin caída
//   T8 la fila no guarda la degradación ............................. 4 · la fila no la guarda
//   T9 el cierre no la cuenta ....................................... 4 · el cierre no la cuenta

if (require.main === module) {
  runRadioMonedaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
