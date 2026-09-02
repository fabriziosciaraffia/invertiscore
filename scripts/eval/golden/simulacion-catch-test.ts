// ============================================================================
// SIMULACIÓN — catch-test (determinístico, 0 tokens) · T1 del rediseño de la página
// ============================================================================
// Fixture obligatorio del tramo (contrato CONGELADO 02-sep-2026):
//   (1) MATRIZ PIE × PLAZO: la celda `esActual` de `simularPieYPlazo` reproduce
//       BIT-IDÉNTICO `metrics.flujoNetoMensual` y `exitScenario.tir` del análisis
//       canónico. Si divergiera, la matriz describiría otro deal.
//   (2) TABLA ANUAL: los desgloses nuevos de `YearProjection` cierran exacto —
//       `arriendoAnual − gastosOperativosAnual === noiAnual` y
//       `noiAnual − vacanciaRotacionAnual − dividendoAnual === flujoAnual` en cada
//       año— y el acumulado del último año es EXACTAMENTE `exitScenario.flujoAcumulado`
//       (la suma de los años redondeados puede diferir hasta ±1 CLP por año).
//
// Corre sobre filas reales (las N más recientes con input_data) por la MISMA ruta
// que el render: recomputeResultsForLegacy con UF y fecha congeladas. Incluye
// SIEMPRE el caso del contrato (cb0e8f46) si sigue en la base.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/simulacion-catch-test.ts [n]
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import { simularPieYPlazo } from "../../../src/lib/analysis";
import { metricaValorONull } from "../../../src/lib/types";
import type { AnalisisInput, FullAnalysisResult } from "../../../src/lib/types";

const CASO_CONTRATO = "cb0e8f46";
const CASO_CONTRATO_ID = "cb0e8f46-8dc5-4fc0-b24b-e68e2a927f2d"; // uuid: PostgREST no acepta LIKE sobre uuid
const N = Number(process.argv[2] ?? 40);

type Fila = {
  id: string;
  comuna: string | null;
  input_data: AnalisisInput | null;
  results: FullAnalysisResult | null;
  created_at: string;
  mediana_comuna_snapshot: { mediana: number; n?: number } | null;
};

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const { data, error } = await sb
    .from("analisis")
    .select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
    .eq("tipo_analisis", "long-term")
    .not("input_data", "is", null)
    .order("created_at", { ascending: false })
    .limit(N);
  if (error) throw error;
  const filas = (data ?? []) as Fila[];
  if (!filas.some((f) => f.id.startsWith(CASO_CONTRATO))) {
    const { data: extra } = await sb
      .from("analisis")
      .select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("tipo_analisis", "long-term")
      .eq("id", CASO_CONTRATO_ID)
      .limit(1);
    if (extra?.length) filas.push(extra[0] as Fila);
  }

  let matrizOk = 0, matrizVacia = 0, matrizFalla = 0;
  let tablaOk = 0, tablaFalla = 0;
  const fallas: string[] = [];

  for (const f of filas) {
    if (!f.input_data) continue;
    const uf = resolveUfForAnalysis(f.results, f.input_data, 39000, f.id);
    const mediana = f.mediana_comuna_snapshot ? { mediana: f.mediana_comuna_snapshot.mediana, n: f.mediana_comuna_snapshot.n ?? 0 } : undefined;
    const asOf = new Date(f.created_at);
    const r = recomputeResultsForLegacy(f.input_data, uf, mediana, asOf);
    const tag = `${f.id.slice(0, 8)} ${f.comuna ?? ""}`;

    // (1) matriz pie × plazo
    const mx = simularPieYPlazo(f.input_data, uf, asOf, mediana);
    if (!mx.celdas.length) {
      matrizVacia++;
    } else {
      const hoy = mx.celdas.find((c) => c.esActual);
      const tirCanon = metricaValorONull(r.exitScenario.tir);
      if (!hoy) {
        matrizFalla++; fallas.push(`${tag} · matriz sin celda actual (pie ${f.input_data.piePct} · plazo ${f.input_data.plazoCredito})`);
      } else if (hoy.flujoMensual !== r.metrics.flujoNetoMensual || hoy.tirPct !== tirCanon) {
        matrizFalla++;
        fallas.push(`${tag} · celda actual ${hoy.flujoMensual} / ${hoy.tirPct} ≠ informe ${r.metrics.flujoNetoMensual} / ${tirCanon}`);
      } else if (mx.celdas.length !== mx.pies.length * mx.plazos.length) {
        matrizFalla++; fallas.push(`${tag} · ${mx.celdas.length} celdas para ${mx.pies.length}×${mx.plazos.length}`);
      } else {
        matrizOk++;
      }
    }

    // (2) tabla anual
    const p10 = r.projections.slice(0, r.exitScenario.anios);
    // El exit toma `projections[anios-1].flujoAcumulado` (acumulado SIN redondear por
    // año, redondeado al final): esa identidad es exacta y es la que muestra la
    // columna "Acumulado" de la tabla. La suma de los `flujoAnual` redondeados difiere
    // hasta ±1 CLP por año (redondeo de un arriendo con decimales): se tolera eso y
    // ni un peso más.
    const ultimo = p10[p10.length - 1];
    const acumOk = ultimo != null && ultimo.flujoAcumulado === r.exitScenario.flujoAcumulado;
    const suma = p10.reduce((a, p) => a + p.flujoAnual, 0);
    const sumaOk = Math.abs(suma - r.exitScenario.flujoAcumulado) <= p10.length;
    // Los desgloses son opcionales en el tipo (demo/legacy); el motor los emite siempre.
    // Acá se exige que estén: un año sin desglose es falla, no omisión.
    const rota = p10.filter(
      (p) =>
        p.mesesOperativos == null || p.arriendoAnual == null || p.gastosOperativosAnual == null || p.noiAnual == null ||
        p.vacanciaRotacionAnual == null || p.dividendoAnual == null ||
        p.arriendoAnual - p.gastosOperativosAnual !== p.noiAnual ||
        p.noiAnual - p.vacanciaRotacionAnual - p.dividendoAnual !== p.flujoAnual,
    );
    if (!acumOk) {
      tablaFalla++; fallas.push(`${tag} · projections[${p10.length - 1}].flujoAcumulado ${ultimo?.flujoAcumulado} ≠ exit.flujoAcumulado ${r.exitScenario.flujoAcumulado}`);
    } else if (!sumaOk) {
      tablaFalla++; fallas.push(`${tag} · Σ flujoAnual ${suma} se aleja más de ${p10.length} CLP de exit.flujoAcumulado ${r.exitScenario.flujoAcumulado}`);
    } else if (rota.length) {
      tablaFalla++; fallas.push(`${tag} · desglose no cierra en ${rota.map((p) => p.anio).join(",")} (ej. año ${rota[0].anio}: noi ${rota[0].noiAnual} − rot ${rota[0].vacanciaRotacionAnual} − div ${rota[0].dividendoAnual} vs flujo ${rota[0].flujoAnual})`);
    } else {
      tablaOk++;
    }
  }

  console.log(`\nSIMULACIÓN · catch-test sobre ${filas.length} filas`);
  console.log(`  matriz pie×plazo   ok ${matrizOk} · vacía (pie 0/100 o plazo no comercial) ${matrizVacia} · FALLA ${matrizFalla}`);
  console.log(`  tabla anual        ok ${tablaOk} · FALLA ${tablaFalla}`);
  for (const x of fallas) console.log(`  ✗ ${x}`);
  const contrato = filas.find((f) => f.id.startsWith(CASO_CONTRATO));
  console.log(`  caso del contrato ${CASO_CONTRATO}: ${contrato ? "incluido" : "NO ENCONTRADO"}`);
  if (matrizFalla || tablaFalla || !contrato) {
    console.log("\n✗ ROJO");
    process.exit(1);
  }
  console.log("\n✓ VERDE");
}

main().catch((e) => { console.error(e); process.exit(1); });
