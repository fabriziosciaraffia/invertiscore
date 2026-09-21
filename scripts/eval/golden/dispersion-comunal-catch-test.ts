// ============================================================================
// GOLDEN · LA DISPERSIÓN COMUNAL VIAJA CON LA MEDIANA — catch-test (21-sep-2026).
// Tier puro: 0 tokens, sin base. El standalone agrega la sonda VIVA.
// ============================================================================
// Sin p25/p75 «caro» era la misma frase en Providencia (p75 +9% sobre la mediana) y en
// Santiago 1D (p75 +18%). Desde hoy los cuartiles salen de las MISMAS filas que la
// mediana, se persisten en `mediana_comuna_snapshot`, viajan por `MedianaComunaInyectada`
// hasta `precioVsComuna` y el hallazgo de sobreprecio, y el motor deriva la POSICIÓN del
// sujeto por cuartiles. Fija:
//
//   1. `percentil` es R-7 y coincide con `median` en p = 0,5 (n par e impar).
//   2. `posicionEnComuna` reparte las cuatro bandas con bordes ≤, y devuelve null —no
//      un cuartil inventado— sin cuartiles, con cuartiles no coherentes o con sujeto 0.
//   3. `buildPrecioVsComuna` emite `posicion` SOLO cuando el caller trae cuartiles
//      (ausencia ≠ null), y la emite también en el camino no confiable (como null).
//   4. `buildHallazgoSobreprecio` copia p25/p75/posicion sin recalcular, y no los inventa
//      cuando FASE A no los trae.
//   5. `buildMedianaSnapshot` persiste p25/p75 (también null) y no los inventa.
//   6. `runAnalysis` con una mediana inyectada CON cuartiles deja la posición en
//      `metrics.precioVsComuna` y en `metrics.hallazgoSobreprecio`; SIN cuartiles, no.
//
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · `posicionEnComuna` devolviendo "bajo_p25" siempre → cae 2 y 6.
//   · `buildPrecioVsComuna` sin el spread de `posicion` → cae 3 y 6.
//   · `buildHallazgoSobreprecio` sin copiar `posicion` → cae 4 y 6.
//   · `buildMedianaSnapshot` sin el spread de p25/p75 → cae 5.
//   · `calcMetrics` sin pasar p25/p75 al builder → cae 6.
//
// Standalone (agrega la sonda viva sobre `scraped_properties`: p25 ≤ mediana ≤ p75 y n ≥ 15
// en una celda real, y una fila real del parque recomputada con su snapshot):
//   node --env-file=.env.local --import tsx scripts/eval/golden/dispersion-comunal-catch-test.ts
// ============================================================================
import { median, percentil } from "../../../src/lib/comuna-stats";
import { buildPrecioVsComuna, posicionEnComuna } from "../../../src/lib/precio-vs-comuna";
import { buildHallazgoSobreprecio } from "../../../src/lib/sobreprecio-hallazgo";
import { buildMedianaSnapshot } from "../../../src/lib/api-helpers/analisis-pipeline";
import { runAnalysis } from "../../../src/lib/analysis";
import type { AnalisisInput } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

function tierPuro() {
  // 1 · percentil R-7 ≡ median en 0,5
  for (const xs of [[3, 1, 2], [4, 1, 3, 2], [7], [10, 20, 30, 40, 50]]) {
    if (Math.abs(percentil(xs, 0.5) - median(xs)) > 1e-9) F(`1 · percentil(0,5) ≠ median para ${JSON.stringify(xs)}`);
  }
  if (percentil([10, 20, 30, 40], 0.25) !== 17.5) F("1 · percentil R-7 de [10,20,30,40] en 0,25 debía ser 17,5");
  if (percentil([10, 20, 30, 40], 0.75) !== 32.5) F("1 · percentil R-7 de [10,20,30,40] en 0,75 debía ser 32,5");
  if (percentil([], 0.5) !== 0) F("1 · percentil de [] debía ser 0");

  // 2 · posicionEnComuna: cuatro bandas, bordes ≤, null cuando no puede
  const m = 100, p25 = 90, p75 = 110;
  const esperado: Array<[number, string]> = [[80, "bajo_p25"], [90, "bajo_p25"], [95, "p25_mediana"], [100, "p25_mediana"], [105, "mediana_p75"], [110, "mediana_p75"], [111, "sobre_p75"]];
  for (const [s, e] of esperado) if (posicionEnComuna(s, m, p25, p75) !== e) F(`2 · sujeto ${s} debía ser ${e}, dio ${posicionEnComuna(s, m, p25, p75)}`);
  if (posicionEnComuna(105, m, null, p75) !== null) F("2 · sin p25 debía ser null");
  if (posicionEnComuna(105, m, p25, undefined) !== null) F("2 · sin p75 debía ser null");
  if (posicionEnComuna(105, m, 120, 130) !== null) F("2 · p25 > mediana (terna incoherente) debía ser null");
  if (posicionEnComuna(105, m, p25, 95) !== null) F("2 · p75 < mediana (terna incoherente) debía ser null");
  if (posicionEnComuna(0, m, p25, p75) !== null) F("2 · sujeto 0 debía ser null");

  // 3 · buildPrecioVsComuna: ausencia ≠ null; posición también en el camino no confiable
  const sin = buildPrecioVsComuna({ sujetoUfM2: 105, medianaComunaUfM2: 100, confiable: true, n: 50 });
  if ("posicion" in sin || "p25UfM2" in sin) F("3 · sin cuartiles del caller no debía emitir posición ni p25");
  const con = buildPrecioVsComuna({ sujetoUfM2: 105, medianaComunaUfM2: 100, confiable: true, n: 50, p25UfM2: 90, p75UfM2: 110 });
  if (con.posicion !== "mediana_p75" || con.p25UfM2 !== 90 || con.p75UfM2 !== 110) F(`3 · con cuartiles debía dar mediana_p75 (dio ${con.posicion}) y copiar p25/p75`);
  const nulos = buildPrecioVsComuna({ sujetoUfM2: 105, medianaComunaUfM2: 100, confiable: true, n: 50, p25UfM2: null, p75UfM2: null });
  if (!("posicion" in nulos) || nulos.posicion !== null || nulos.p25UfM2 !== null) F("3 · cuartiles null debían viajar como null y dejar posición null");
  const noConf = buildPrecioVsComuna({ sujetoUfM2: 105, medianaComunaUfM2: null, confiable: false, n: 3, p25UfM2: 90, p75UfM2: 110 });
  if (noConf.confiable || !("posicion" in noConf) || noConf.posicion !== null) F("3 · no confiable con cuartiles debía emitir posicion null");

  // 4 · el hallazgo copia, no recalcula ni inventa
  const h = buildHallazgoSobreprecio(con, 0.5, 0.5, "Ñuñoa");
  if (!h) { F("4 · el hallazgo debía existir"); } else {
    if (h.valor.posicion !== "mediana_p75" || h.valor.p25UfM2 !== 90 || h.valor.p75UfM2 !== 110) F("4 · el hallazgo debía copiar p25/p75/posicion");
  }
  const h0 = buildHallazgoSobreprecio(sin, 0.5, 0.5, "Ñuñoa");
  if (!h0) { F("4 · el hallazgo sin cuartiles debía existir"); } else if ("posicion" in h0.valor || "p25UfM2" in h0.valor) F("4 · sin cuartiles el hallazgo no debía inventarlos");
  const hRedondeo = buildHallazgoSobreprecio(buildPrecioVsComuna({ sujetoUfM2: 105, medianaComunaUfM2: 100, confiable: true, n: 50, p25UfM2: 90.123, p75UfM2: 110.987 }), 0.5, 0.5, "Ñuñoa");
  if (hRedondeo && (hRedondeo.valor.p25UfM2 !== 90.1 || hRedondeo.valor.p75UfM2 !== 111)) F("4 · el hallazgo redondea los cuartiles a 1 decimal (round-una-vez)");

  // 5 · el snapshot persiste (también null) y no inventa
  const snap = buildMedianaSnapshot({ mediana: 100, n: 50, universo: "usado", p25: 90, p75: 110 });
  if (snap.p25 !== 90 || snap.p75 !== 110) F("5 · el snapshot debía persistir p25/p75");
  const snapNull = buildMedianaSnapshot({ mediana: null, n: 3, universo: "usado", p25: null, p75: null });
  if (!("p25" in snapNull) || snapNull.p25 !== null || snapNull.p75 !== null) F("5 · el snapshot debía persistir p25/p75 null (se midió y no alcanzó)");
  const snapViejo = buildMedianaSnapshot({ mediana: 100, n: 50 });
  if ("p25" in snapViejo || "p75" in snapViejo) F("5 · sin cuartiles en la resuelta el snapshot no debía inventarlos");

  // 6 · el motor de punta a punta: con cuartiles hay posición, sin cuartiles no
  const input = {
    precio: 3200, superficie: 55, dormitorios: 2, banos: 1, arriendo: 750000, piePct: 20, tasaInteres: 4.5, plazoCredito: 25,
    gastosComunes: 60000, contribuciones: 0, vacanciaMeses: 1, comuna: "Providencia", esNuevo: false, antiguedad: 5,
  } as unknown as AnalisisInput;
  const uf = 39000;
  // sujeto 3200/55 = 58,2 UF/m²; mediana 55, p25 50, p75 60 → mediana_p75
  const conC = runAnalysis(input, uf, { mediana: 55, n: 120, universo: "usado", p25: 50, p75: 60 }, new Date("2026-09-01"));
  if (conC.metrics.precioVsComuna?.posicion !== "mediana_p75") F(`6 · precioVsComuna.posicion debía ser mediana_p75, dio ${conC.metrics.precioVsComuna?.posicion}`);
  if (conC.metrics.hallazgoSobreprecio?.valor.posicion !== "mediana_p75") F(`6 · hallazgoSobreprecio.posicion debía ser mediana_p75, dio ${conC.metrics.hallazgoSobreprecio?.valor.posicion}`);
  if (conC.metrics.hallazgoSobreprecio?.valor.p75UfM2 !== 60) F("6 · el hallazgo debía llevar p75 = 60");
  const sinC = runAnalysis(input, uf, { mediana: 55, n: 120, universo: "usado" }, new Date("2026-09-01"));
  if (sinC.metrics.precioVsComuna && "posicion" in sinC.metrics.precioVsComuna) F("6 · sin cuartiles inyectados el motor no debía emitir posición");
  if (sinC.metrics.hallazgoSobreprecio && "posicion" in sinC.metrics.hallazgoSobreprecio.valor) F("6 · sin cuartiles el hallazgo no debía emitir posición");
  // y la posición no toca lo que ya existía: misma desviación con y sin cuartiles
  if (conC.metrics.precioVsComuna?.desviacionPct !== sinC.metrics.precioVsComuna?.desviacionPct) F("6 · los cuartiles no deben mover la desviación");
}

export function runDispersionComunalTier(): { hard: number } {
  fallas.length = 0;
  tierPuro();
  if (fallas.length === 0) {
    console.log("   dispersion-comunal ✓ (6 invariantes puros, 0 tokens)");
  } else {
    console.log(`   dispersion-comunal ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  }
  return { hard: fallas.length };
}

// ── standalone: tier puro + sonda VIVA ─────────────────────────────────────
async function sondaViva() {
  const { createClient } = await import("@supabase/supabase-js");
  const { getComunaMedianaVentaUF } = await import("../../../src/lib/comuna-stats");
  const { recomputeResultsForLegacy } = await import("../../../src/lib/analysis/recompute-results-for-legacy");
  const { resolveUfForAnalysis } = await import("../../../src/lib/uf");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const V = (m: string) => fallas.push(`vivo · ${m}`);
  // una celda real
  const r = await getComunaMedianaVentaUF(sb, "Ñuñoa", 57, 2, 39000, "usado");
  console.log(`   vivo · Ñuñoa 2D ~57 m² usado: n=${r.n} · p25 ${r.p25} · mediana ${r.mediana} · p75 ${r.p75} · ventana ${r.ventanaDias}`);
  if (r.mediana == null || r.p25 == null || r.p75 == null) V("la celda real debía traer mediana y cuartiles");
  else if (!(r.p25 <= r.mediana && r.mediana <= r.p75)) V("p25 ≤ mediana ≤ p75 no se cumple en la celda real");
  if (r.n < 15) V("n < 15 en una celda que sí alcanza");
  // una fila real, recomputada con la mediana viva (con cuartiles) como haría el prefetch
  const { data } = await sb.from("analisis").select("id, input_data, results, created_at").or("tipo_analisis.is.null,tipo_analisis.neq.short-term").not("results", "is", null).eq("comuna", "Ñuñoa").order("created_at", { ascending: false }).limit(1);
  const row = (data as Array<{ id: string; input_data: AnalisisInput; results: Parameters<typeof resolveUfForAnalysis>[0]; created_at: string }> | null)?.[0];
  if (!row) { V("no hay fila LTR de Ñuñoa para la sonda"); return; }
  const input = row.input_data as AnalisisInput;
  const uf = resolveUfForAnalysis(row.results, input, 39000, row.id);
  const viva = await getComunaMedianaVentaUF(sb, input.comuna, input.superficie, input.dormitorios ?? null, uf, input.esNuevo ? "nuevo" : "usado");
  const res = recomputeResultsForLegacy(input, uf, viva, new Date(row.created_at));
  const pos = res.metrics.hallazgoSobreprecio?.valor.posicion;
  console.log(`   vivo · ${row.id.slice(0, 8)} · sujeto ${res.metrics.precioVsComuna?.sujetoUfM2} UF/m² · desv ${res.metrics.precioVsComuna?.desviacionPct}% · posición ${pos ?? "—"}`);
  if (viva.mediana != null && viva.p25 != null && viva.p75 != null && !pos) V("con la mediana viva (con cuartiles) la fila debía tener posición");
}

if (require.main === module) {
  (async () => {
    runDispersionComunalTier();
    await sondaViva();
    if (fallas.length) { console.log(`\n✗ ${fallas.length} falla(s)`); process.exit(1); }
    console.log("\n✓ dispersión comunal: tier puro + sonda viva en verde");
  })().catch((e) => { console.error(e); process.exit(1); });
}
