// ============================================================================
// GOLDEN · GATE DE SOBREPRECIO COMUNAL — catch-test (Tramo B1 "una sola
// referencia de precio", 03-sep-2026). 0 tokens.
// ============================================================================
// El brazo `sobreprecioComunalConFlujo` del Gate 1 fuerza BUSCAR OTRA cuando
// precioVsComuna es confiable, del mismo universo que el depto, con desviación
// > SOBREPRECIO_GATE_UMBRAL_PCT (10) y el flujo mensual es negativo. Reemplaza al
// brazo de plusvalía inmediata (valor de mercado sin procedencia).
//   · 6d2cfaaf Santiago usado, +20% comuna, flujo < 0 ⇒ el brazo dispara, queda BUSCAR.
//   · 64c498e2 Santiago nuevo, −25% comuna ⇒ sin brazo, sube a AJUSTA.
//   · +12 sin confiable ⇒ no dispara (puro). Universo distinto ⇒ no dispara (puro).
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/gate-sobreprecio-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { evalGate1Brazos } from "../../../src/lib/analysis";
import { SOBREPRECIO_GATE_UMBRAL_PCT } from "../../../src/lib/sobreprecio-hallazgo";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import type { AnalisisInput, AnalysisMetrics, FullAnalysisResult, HallazgoDistanciaVeredicto } from "../../../src/lib/types";

type Fila = { id: string; comuna: string | null; input_data: AnalisisInput | null; results: FullAnalysisResult | null; created_at: string; mediana_comuna_snapshot: { mediana: number | null; n?: number; universo?: "nuevo" | "usado" } | null };

function testPuros(fallas: string[]) {
  const F = (m: string) => fallas.push(`puro · ${m}`);
  const base = { flujoNetoMensual: -100000, dividendo: 500000, cashOnCash: { estado: "valor", valor: -5 }, universoDepto: "usado" } as unknown as AnalysisMetrics;
  const pvc = (desviacionPct: number | null, confiable: boolean, universo?: "nuevo" | "usado") => ({ sujetoUfM2: 60, medianaComunaUfM2: 50, desviacionPct, sobreprecioUfM2: 10, confiable, n: 100, universo });
  if (!evalGate1Brazos({ ...base, precioVsComuna: pvc(12, true, "usado") }, 1).sobreprecioComunalConFlujo) F("+12 confiable mismo universo con flujo<0 debía disparar");
  if (evalGate1Brazos({ ...base, precioVsComuna: pvc(12, false, "usado") }, 1).sobreprecioComunalConFlujo) F("+12 sin confiable no debía disparar");
  if (evalGate1Brazos({ ...base, precioVsComuna: pvc(12, true, "nuevo") }, 1).sobreprecioComunalConFlujo) F("universo distinto no debía disparar");
  if (evalGate1Brazos({ ...base, precioVsComuna: pvc(12, true, undefined) }, 1).sobreprecioComunalConFlujo) F("mediana sin universo no debía disparar");
  if (evalGate1Brazos({ ...base, precioVsComuna: pvc(SOBREPRECIO_GATE_UMBRAL_PCT, true, "usado") }, 1).sobreprecioComunalConFlujo) F("exactamente 10 no debía disparar (> 10)");
  if (evalGate1Brazos({ ...base, flujoNetoMensual: 50000, precioVsComuna: pvc(25, true, "usado") }, 1).sobreprecioComunalConFlujo) F("flujo positivo no debía disparar");
  if ((evalGate1Brazos({ ...base, precioVsComuna: pvc(12, true, "usado") }, 1) as unknown as Record<string, unknown>).plusvaliaConFlujo !== undefined) F("el brazo de plusvalía debía desaparecer de la lista");
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const fallas: string[] = [];
  testPuros(fallas);
  const casos: { pref: string; espera: "BUSCAR OTRA" | "AJUSTA SUPUESTOS"; brazo: boolean }[] = [
    { pref: "6d2cfaaf", espera: "BUSCAR OTRA", brazo: true },
    { pref: "64c498e2", espera: "AJUSTA SUPUESTOS", brazo: false },
  ];
  for (const c of casos) {
    const sig = (parseInt(c.pref, 16) + 1).toString(16).padStart(8, "0");
    const { data } = await sb.from("analisis").select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
      .gte("id", `${c.pref}-0000-0000-0000-000000000000`).lt("id", `${sig}-0000-0000-0000-000000000000`).limit(1);
    const f = data?.[0] as Fila | undefined;
    if (!f?.input_data) { fallas.push(`${c.pref} · no se encontró en el parque`); continue; }
    const F = (m: string) => fallas.push(`${c.pref} ${f.comuna} · ${m}`);
    const uf = resolveUfForAnalysis(f.results, f.input_data, 39000, f.id);
    const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0, universo: f.mediana_comuna_snapshot.universo } : undefined;
    const r = recomputeResultsForLegacy(f.input_data, uf, mediana, new Date(f.created_at));
    const dv = (r.hallazgos as { id: string }[]).find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    const brazos = dv?.valor.brazosGate1Activos ?? [];
    const pvc = r.metrics.precioVsComuna;
    console.log(`── ${c.pref} ${f.comuna} · ${r.metrics.universoDepto} · vsComuna ${pvc?.desviacionPct}% (confiable ${pvc?.confiable}, universo ${pvc?.universo}, n=${pvc?.n}) · flujo ${r.metrics.flujoNetoMensual} · veredicto ${r.veredicto} · brazos [${brazos.join(", ")}]`);
    if (r.veredicto !== c.espera) F(`veredicto ${r.veredicto} ≠ ${c.espera}`);
    if (brazos.includes("sobreprecioComunalConFlujo") !== c.brazo) F(`brazo sobreprecioComunalConFlujo ${c.brazo ? "debía" : "no debía"} estar activo`);
    if (brazos.includes("plusvaliaConFlujo")) F("brazo de plusvalía sigue vivo");
  }
  console.log("\nGATE DE SOBREPRECIO COMUNAL · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
