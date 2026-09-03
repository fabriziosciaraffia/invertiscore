// ============================================================================
// GOLDEN · VALOR DE MERCADO CON PROCEDENCIA — catch-test (Tramo A "una sola
// referencia de precio", 03-sep-2026). 0 tokens.
// ============================================================================
// Lo que fija:
//   1. resolverValorMercado: solo con procedencia, muestra y universo del depto.
//   2. resolverMedianaZona: sin snapshot, La zona consulta viva (7710a017).
//   3. Filas reales del parque (recompute):
//      · d3a6149a La Florida NUEVO: VM legacy 1.987 sin procedencia ⇒ plusvalía
//        inmediata 0, sin gate de plusvalía, negociación sin "comparables".
//      · 93316ad0 Ñuñoa NUEVO: ídem.
//      · 7710a017 Providencia: sin snapshot ⇒ la zona no hereda el `confiable=false`.
//      · VM con fuente real (radio, n ≥ 20, mismo universo), inyectada sobre
//        d3a6149a: debe seguir moviendo la plusvalía inmediata exactamente como antes.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/valor-mercado-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import { resolverValorMercado, vmFrancoUFDe, valorMercadoRefDeSugerencia, universoDeSugerenciaVenta } from "../../../src/lib/valor-mercado";
import { resolverMedianaZona } from "../../../src/lib/zone-insight-core";
import type { AnalisisInput, FullAnalysisResult } from "../../../src/lib/types";

type Fila = { id: string; comuna: string | null; input_data: AnalisisInput | null; results: FullAnalysisResult | null; created_at: string; mediana_comuna_snapshot: { mediana: number | null; n?: number; universo?: "nuevo" | "usado" } | null };
const CASOS = ["d3a6149a", "93316ad0", "7710a017"];

function testPuros(fallas: string[]) {
  const F = (m: string) => fallas.push(`puro · ${m}`);
  const base = { esNuevo: false, precio: 3000 } as AnalisisInput;
  if (resolverValorMercado({ ...base, valorMercadoRef: { valorUF: 2800, nivel: "radio", universo: "usado", n: 25 } }) === null) F("radio n=25 usado/usado debía ser válido");
  if (resolverValorMercado({ ...base, valorMercadoRef: { valorUF: 2800, nivel: "radio", universo: "mixto", n: 25 } }) !== null) F("universo mixto debía ser ausente");
  if (resolverValorMercado({ ...base, valorMercadoRef: { valorUF: 2800, nivel: "comuna", universo: "nuevo", n: 400 } }) !== null) F("universo nuevo para depto usado debía ser ausente");
  if (resolverValorMercado({ ...base, valorMercadoRef: { valorUF: 2800, nivel: "radio", universo: "usado", n: 0 } }) !== null) F("n=0 debía ser ausente");
  if (resolverValorMercado({ ...base, valorMercadoFranco: 2800 } as AnalisisInput) !== null) F("número legacy sin procedencia debía ser ausente");
  if (vmFrancoUFDe({ ...base, valorMercadoFranco: 2800 } as AnalisisInput) !== 3000) F("sin procedencia vm debía caer al precio");
  if (universoDeSugerenciaVenta("radio", null) !== "mixto" || universoDeSugerenciaVenta("comuna", null) !== "usado" || universoDeSugerenciaVenta("radio", "nuevo") !== "nuevo") F("universoDeSugerenciaVenta");
  const ref = valorMercadoRefDeSugerencia({ precioM2UF: 80, superficieUtilM2: 40, source: "radio", sampleSize: 22, universoVenta: "usado", radiusUsed: 750 });
  if (!ref || ref.valorUF !== 3200 || ref.nivel !== "radio" || ref.n !== 22 || ref.radioMetros !== 750) F("valorMercadoRefDeSugerencia radio");
  if (valorMercadoRefDeSugerencia({ precioM2UF: 80, superficieUtilM2: 40, source: "sin-dato", sampleSize: 0, universoVenta: null }) !== null) F("sin-dato debía ser null");
  // La zona sin snapshot consulta viva aunque el motor haya dicho confiable=false al crear
  const live = { tuDepto: 0, medianaComuna: 94.2, diffPct: 0 };
  if (resolverMedianaZona({ medSnap: null, pvcMotor: { confiable: false, desviacionPct: null }, precioM2Live: live }).precioM2?.medianaComuna !== 94.2) F("zona sin snapshot debía usar la query viva");
  if (resolverMedianaZona({ medSnap: { mediana: null, n: 0 }, pvcMotor: { confiable: true }, precioM2Live: live }).precioM2 !== null) F("snapshot con mediana null sigue congelado");
  if (resolverMedianaZona({ medSnap: { mediana: 91.7, n: 448, universo: "nuevo" }, pvcMotor: null, precioM2Live: null }).precioM2?.medianaComuna !== 91.7) F("snapshot con mediana manda");
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const fallas: string[] = [];
  testPuros(fallas);
  const filas = new Map<string, Fila>();
  for (const pref of CASOS) {
    // uuid: rango [pref-0000…, pref+1-0000…) — `like` no aplica sobre uuid.
    const sig = (parseInt(pref, 16) + 1).toString(16).padStart(8, "0");
    const { data } = await sb.from("analisis").select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
      .gte("id", `${pref}-0000-0000-0000-000000000000`).lt("id", `${sig}-0000-0000-0000-000000000000`).limit(1);
    if (data?.[0]) filas.set(pref, data[0] as Fila);
    else fallas.push(`${pref} · no se encontró en el parque`);
  }
  const recompute = (f: Fila, input: AnalisisInput) => {
    const uf = resolveUfForAnalysis(f.results, input, 39000, f.id);
    const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0, universo: f.mediana_comuna_snapshot.universo } : undefined;
    return recomputeResultsForLegacy(input, uf, mediana, new Date(f.created_at));
  };
  for (const pref of ["d3a6149a", "93316ad0"]) {
    const f = filas.get(pref); if (!f?.input_data) continue;
    const F = (m: string) => fallas.push(`${pref} ${f.comuna} · ${m}`);
    const r = recompute(f, f.input_data);
    const m = r.metrics;
    console.log(`── ${pref} ${f.comuna} · esNuevo=${f.input_data.esNuevo} · VM legacy ${f.input_data.valorMercadoFranco} · vm resuelto ${m.valorMercadoFrancoUF} · plusv ${m.plusvaliaInmediataFrancoPct}% · ref ${JSON.stringify(m.valorMercadoRef)} · veredicto ${r.veredicto} · negociación ${r.negociacion?.modo}`);
    if (m.valorMercadoRef !== null && m.valorMercadoRef !== undefined) F("valorMercadoRef debía ser null (VM legacy sin procedencia)");
    if (Math.round(m.valorMercadoFrancoUF ?? 0) !== Math.round(f.input_data.precio)) F(`vm resuelto ${m.valorMercadoFrancoUF} ≠ precio ${f.input_data.precio}`);
    if ((m.plusvaliaInmediataFrancoPct ?? 0) !== 0) F(`plusvalía inmediata ${m.plusvaliaInmediataFrancoPct} ≠ 0`);
    if (r.negociacion?.modo === "alinear_mercado" && /comparables/.test(r.negociacion.razon ?? "")) F("negociación invoca comparables sin valor de mercado");
    if (pref === "d3a6149a") {
      // VM con fuente real, mismo universo (nuevo): la plusvalía inmediata vuelve a moverse como antes
      const conFuente = { ...f.input_data, valorMercadoRef: { valorUF: 3300, nivel: "radio", universo: "nuevo", n: 24, radioMetros: 750 } } as AnalisisInput;
      const r2 = recompute(f, conFuente);
      const esperado = Math.round(((3300 - f.input_data.precio) / 3300) * 1000) / 10;
      console.log(`   con fuente real (radio n=24 nuevo, VM 3.300): plusv ${r2.metrics.plusvaliaInmediataFrancoPct}% (esperado ${esperado}) · ref ${JSON.stringify(r2.metrics.valorMercadoRef)}`);
      if (!r2.metrics.valorMercadoRef) F("VM con fuente real debía aceptarse");
      if (Math.abs((r2.metrics.plusvaliaInmediataFrancoPct ?? 0) - esperado) > 0.11) F(`plusvalía con fuente ${r2.metrics.plusvaliaInmediataFrancoPct} ≠ ${esperado}`);
      // mismo VM pero universo usado para un depto nuevo: ausente
      const otroUniverso = { ...f.input_data, valorMercadoRef: { valorUF: 3300, nivel: "radio", universo: "usado", n: 24 } } as AnalisisInput;
      if (recompute(f, otroUniverso).metrics.valorMercadoRef) F("VM de universo usado para depto nuevo debía ser ausente");
    }
  }
  const f77 = filas.get("7710a017");
  if (f77) {
    const F = (m: string) => fallas.push(`7710a017 · ${m}`);
    if (f77.mediana_comuna_snapshot !== null) F("el caso perdió su condición (ahora trae snapshot); revisar el fixture");
    const pvc = f77.results?.metrics?.precioVsComuna;
    const snap = f77.mediana_comuna_snapshot ? { mediana: f77.mediana_comuna_snapshot.mediana, n: f77.mediana_comuna_snapshot.n ?? 0, universo: f77.mediana_comuna_snapshot.universo } : null;
    const z = resolverMedianaZona({ medSnap: snap, pvcMotor: pvc ?? null, precioM2Live: { tuDepto: 91.7, medianaComuna: 94.2, diffPct: -2.7 } });
    console.log(`── 7710a017 ${f77.comuna} · snapshot ${JSON.stringify(f77.mediana_comuna_snapshot)} · pvc.confiable ${pvc?.confiable} · zona → ${JSON.stringify(z.precioM2)}`);
    if (z.precioM2?.medianaComuna !== 94.2) F("La zona debía tomar la query viva sin snapshot");
  }
  console.log("\nVALOR DE MERCADO CON PROCEDENCIA · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
