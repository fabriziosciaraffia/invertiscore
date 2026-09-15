// ============================================================================
// SIMULACIÓN — catch-test (determinístico, 0 tokens) · T1 del rediseño de la página
// ============================================================================
// Fixture obligatorio del tramo (contrato CONGELADO 02-sep-2026; la parte (1) se enmendó
// el 13-sep-2026 con 6ecd80c1 — las actas viven en el cuerpo, junto a cada aserción):
//   (1) CELDA «HOY» DE LA GRILLA DEL MIX: el `veredictoSinDescuento` de la celda
//       `esActual` —su estado a precio de hoy— es el veredicto del informe. Si divergiera,
//       la grilla estaría describiendo otro deal. Sale del hallazgo `distancia_veredicto`
//       (`mixPalancas` / `mixPalancasHastaComprar`); si la fila no trae grilla, o su plazo
//       declarado no está en ella, cuenta como vacía y NO es falla.
//       Hasta 6ecd80c1 el invariante se medía sobre `simularPieYPlazo` y comparaba además
//       `metrics.flujoNetoMensual` y `exitScenario.tir` BIT-IDÉNTICOS: esa matriz se retiró
//       y la sonda del mix devuelve veredicto y score, así que la comparación de esos dos
//       campos —y la corrida gemela sobre los seeds GS en memoria— se fueron con ella. El
//       veredicto, que es lo que decide, se conserva.
//   (2) TABLA ANUAL: los desgloses nuevos de `YearProjection` cierran exacto —
//       `arriendoAnual − gastosOperativosAnual === noiAnual` y
//       `noiAnual − vacanciaRotacionAnual − dividendoAnual === flujoAnual` en cada
//       año— y el acumulado del último año es EXACTAMENTE `exitScenario.flujoAcumulado`
//       (la suma de los años redondeados puede diferir hasta ±1 CLP por año).
//
// Corre sobre filas reales (las N más recientes con input_data) por la MISMA ruta
// que el render: recomputeResultsForLegacy con UF y fecha congeladas. Fuerza SIEMPRE dos
// casos —el del contrato (cb0e8f46) y el canónico del rediseño (7710a017)—: si alguno no
// aparece, la corrida termina en ROJO.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/simulacion-catch-test.ts [n]
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import type { CeldaMix } from "../../../src/lib/mix-palancas";
import type { HallazgoDistanciaVeredicto } from "../../../src/lib/types";
import type { AnalisisInput, FullAnalysisResult } from "../../../src/lib/types";

const CASO_CONTRATO = "cb0e8f46";
const CASO_CONTRATO_ID = "cb0e8f46-8dc5-4fc0-b24b-e68e2a927f2d"; // uuid: PostgREST no acepta LIKE sobre uuid
// Canónico del rediseño (66 · AJUSTA SUPUESTOS · −$283.194): también entra siempre.
const CASO_CANONICO = "7710a017";
const CASO_CANONICO_ID = "7710a017-8066-47a6-8b3e-8fc64143e256";
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
  for (const [pref, id] of [[CASO_CONTRATO, CASO_CONTRATO_ID], [CASO_CANONICO, CASO_CANONICO_ID]]) {
    if (filas.some((f) => f.id.startsWith(pref))) continue;
    const { data: extra } = await sb
      .from("analisis")
      .select("id, comuna, input_data, results, created_at, mediana_comuna_snapshot")
      .eq("tipo_analisis", "long-term")
      .eq("id", id)
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

    // (1) LA CELDA «HOY» REPRODUCE EL VEREDICTO DEL INFORME.
    //
    // ⚠ ACTA (13-sep-2026) · ESTE INVARIANTE SE MUDÓ DE MATRIZ. Hasta hoy medía
    // `simularPieYPlazo`, la matriz de simulación del capítulo III, que se retiró con el
    // pop-up viejo: era su único consumidor y costaba 16 recomputes completos por carga.
    // La matriz que el usuario ve ahora es la grilla del mix, que ya se calcula para
    // elegir la combinación, así que el invariante la sigue.
    //
    // Se mide sobre `veredictoSinDescuento`, no sobre `veredicto`: la celda de la grilla
    // muestra LO QUE CONSIGUES —su lectura en el descuento mínimo— y el estado a precio de
    // hoy viaja aparte. Es ese el que tiene que reproducir el informe; si divergiera, la
    // matriz estaría describiendo otro deal, que es exactamente lo que este tier existe
    // para impedir.
    //
    // Lo que NO se puede seguir midiendo, y va al acta: flujo y TIR por celda. La matriz
    // vieja los traía y la grilla del mix no —la sonda devuelve veredicto y score—, así
    // que la comparación bit-idéntica de esos dos campos se retira. El veredicto, que es
    // lo que decide, sí se conserva.
    const dv = (r.hallazgos ?? []).find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    const grilla = (dv?.valor.mixPalancas ?? dv?.valor.mixPalancasHastaComprar)?.celdas ?? [];
    if (!grilla.length) {
      matrizVacia++;
    } else {
      const hoy = (grilla as CeldaMix[]).find((c) => c.esActual);
      if (!hoy) {
        // No es falla: 16 filas del parque no tienen celda «hoy» porque su plazo declarado
        // no está en la grilla del mix (medido el 13-sep-2026). La matriz no la inventa.
        matrizVacia++;
      } else if (hoy.veredictoSinDescuento !== r.veredicto) {
        matrizFalla++;
        fallas.push(`${tag} · celda «hoy» de la grilla ${hoy.veredictoSinDescuento} ≠ informe ${r.veredicto}`);
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

  // (1.bis) ⚠ RETIRADA CON ACTA (13-sep-2026) · acá corría la misma aserción de la celda
  // «hoy» sobre los seeds GS en memoria. Se va con la matriz de simulación: la grilla del
  // mix ya se mide arriba sobre filas reales, que es donde el invariante tiene valor, y
  // los seeds no aportaban un caso que las filas no cubran.

  console.log(`\nSIMULACIÓN · catch-test sobre ${filas.length} filas`);
  console.log(`  grilla del mix     ok ${matrizOk} · sin celda «hoy» (fila sin grilla o plazo fuera de ella) ${matrizVacia} · FALLA ${matrizFalla}`);
  console.log(`  tabla anual        ok ${tablaOk} · FALLA ${tablaFalla}`);
  for (const x of fallas) console.log(`  ✗ ${x}`);
  const contrato = filas.find((f) => f.id.startsWith(CASO_CONTRATO));
  const canonico = filas.find((f) => f.id.startsWith(CASO_CANONICO));
  console.log(`  caso del contrato ${CASO_CONTRATO}: ${contrato ? "incluido" : "NO ENCONTRADO"} · canónico ${CASO_CANONICO}: ${canonico ? "incluido" : "NO ENCONTRADO"}`);
  if (matrizFalla || tablaFalla || !contrato || !canonico) {
    console.log("\n✗ ROJO");
    process.exit(1);
  }
  console.log("\n✓ VERDE");
}

main().catch((e) => { console.error(e); process.exit(1); });
