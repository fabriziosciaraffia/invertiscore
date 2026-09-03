// ============================================================================
// GOLDEN · DECISIVIDAD REAL STR — catch-test (03-sep-2026). 0 tokens, read-only.
// ============================================================================
// Tres filas reales del parque, una por veredicto, recomputadas EN MEMORIA con la UF
// congelada del corto (precioCompra / precioCompraUF) y la mediana comunal como la
// resuelve la página. Fija el contrato de calcDecisividadesSTR (espejo de LTR):
//   · los siete con knob viven en [0,1] y magnitud ≤ decisividad;
//   · los seis informativos (INFORMATIVOS_STR) declaran 0;
//   · el piso 0,85 aparece SOLO por flip de veredicto o gate desarmado: 9102b7e6 lo
//     muestra en estructura_financiamiento con Δscore 0 (desarma g1_beInviable);
//   · el 01 de cada caso es el que midió el sweep del 03-sep (162 de 245 cambiaron de 01
//     respecto de la decisividad inyectada): ocupación en los dos AJUSTA/BUSCAR,
//     rentabilidad en el COMPRAR (empate 0,85 con ventaja, lo decide la magnitud).
//   · CapEx neutro: antigüedad 0 sin override ⇒ 0 CLP (el knob del capex).
// La mediana comunal es viva (sin snapshot en las tres filas), así que el fixture NO
// congela la decisividad de sobreprecio: solo exige que, si existe, cumpla el contrato.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/decisividad-str-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { calcShortTerm } from "../../../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { buildStrHallazgos, mergeHallazgosStr } from "../../../src/lib/str-hallazgos";
import { calcDecisividadesSTR, INFORMATIVOS_STR, type DecisividadesSTR } from "../../../src/lib/decisividades-str";
import { ordenarHallazgosPiramideSTR } from "../../../src/lib/piramide-orden-str";
import { getComunaMedianaVentaUF, resolverCondicionMercado } from "../../../src/lib/comuna-stats";
import { calcCapexPuestaAPunto } from "../../../src/lib/capex-puesta-a-punto";
import { DECISIVIDAD_FLOOR } from "../../../src/lib/analysis";

const CASOS: { id: string; veredicto: string; primero: string; pisos: (keyof DecisividadesSTR)[]; gateDesarmadoSinDelta?: keyof DecisividadesSTR }[] = [
  { id: "bc61f612-f1d0-44c9-af0c-a689ca4ab7fd", veredicto: "COMPRAR", primero: "rentabilidad_str", pisos: ["rentabilidad_str", "ventaja_vs_ltr", "ocupacion_vs_banda"] },
  { id: "29bbcd75-96a8-4f9f-bef1-5e0a179b4d83", veredicto: "AJUSTA SUPUESTOS", primero: "ocupacion_vs_banda", pisos: ["ocupacion_vs_banda", "rentabilidad_str"] },
  { id: "9102b7e6-3bae-4174-971f-afb8bd99547c", veredicto: "BUSCAR OTRA", primero: "ocupacion_vs_banda", pisos: ["ocupacion_vs_banda", "rentabilidad_str", "estructura_financiamiento"], gateDesarmadoSinDelta: "estructura_financiamiento" },
];
const CON_KNOB: (keyof DecisividadesSTR)[] = ["rentabilidad_str", "flujo_str", "ocupacion_vs_banda", "ventaja_vs_ltr", "sobreprecio", "estructura_financiamiento", "capex_puesta_a_punto"];

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

  // Knob del capex: antigüedad 0 sin override es CapEx 0 en los dos modelos de costos.
  for (const modelo of ["legacy", "v3"] as const) {
    const c = calcCapexPuestaAPunto({ antiguedad: 0, superficieUtilM2: 45, valorUF: 39_000, overrideCLP: null, modelo });
    if (c.montoCLP !== 0) F(`capex neutro (${modelo}) · antigüedad 0 da ${c.montoCLP} CLP, no 0`);
  }

  for (const caso of CASOS) {
    const pref = caso.id.slice(0, 8);
    const { data: row, error } = await sb.from("analisis").select("id, comuna, input_data, results, created_at").eq("id", caso.id).single();
    if (error || !row) { F(`${pref} · fila no cargó: ${error?.message}`); continue; }
    const d = row.input_data as Record<string, number | string>;
    const uf = (d.precioCompra as number) / (d.precioCompraUF as number);
    const ctx = buildStrRecomputeCtx(row.input_data, row.results, uf);
    if (!ctx) { F(`${pref} · sin contexto de recompute`); continue; }
    const asOf = new Date(row.created_at);
    const result = calcShortTerm(ctx.inputs, asOf);
    const francoScore = calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra: ctx.inputs.precioCompra });
    if (francoScore.veredicto !== caso.veredicto) F(`${pref} · veredicto recomputado ${francoScore.veredicto}, esperado ${caso.veredicto}`);
    let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
    try {
      mediana = await getComunaMedianaVentaUF(sb, row.comuna as string, d.superficieUtil as number, (d.dormitorios as number) ?? null, uf,
        resolverCondicionMercado({ esNuevo: d.tipoPropiedad === "nuevo", antiguedad: d.antiguedad as number | undefined }));
    } catch { /* sin mediana ⇒ sobreprecio ausente, contrato igual */ }
    const veredictoCtx = { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf };

    // 1) El módulo, directo.
    const dec = calcDecisividadesSTR(veredictoCtx, { comuna: row.comuna as string, medianaUfM2: mediana.mediana, medianaN: mediana.n, superficieM2: d.superficieUtil as number, valorUF: uf }, { result, francoScore });
    for (const k of CON_KNOB) {
      const f = dec[k];
      if (!f) continue;
      if (!(f.decisividad >= 0 && f.decisividad <= 1)) F(`${pref} · ${k} decisividad fuera de [0,1]: ${f.decisividad}`);
      if (!(f.magnitud >= 0 && f.magnitud <= 1)) F(`${pref} · ${k} magnitud fuera de [0,1]: ${f.magnitud}`);
      if (f.magnitud > f.decisividad + 1e-9) F(`${pref} · ${k} magnitud ${f.magnitud} > decisividad ${f.decisividad}`);
      if (f.decisividad >= DECISIVIDAD_FLOOR - 1e-9 && f.magnitud < DECISIVIDAD_FLOOR && Math.abs(f.decisividad - DECISIVIDAD_FLOOR) > 1e-9)
        F(`${pref} · ${k} sobre el piso sin ser el piso ni la magnitud: ${f.decisividad}/${f.magnitud}`);
    }
    for (const k of caso.pisos) {
      const f = dec[k];
      if (!f) { F(`${pref} · ${k} debía calibrarse y está ausente`); continue; }
      if (f.decisividad < DECISIVIDAD_FLOOR - 1e-9) F(`${pref} · ${k} debía pasar el piso 0,85 y da ${f.decisividad.toFixed(2)}`);
    }
    if (caso.gateDesarmadoSinDelta) {
      const f = dec[caso.gateDesarmadoSinDelta];
      if (!f || Math.abs(f.decisividad - DECISIVIDAD_FLOOR) > 1e-9 || f.magnitud !== 0)
        F(`${pref} · ${caso.gateDesarmadoSinDelta} debía valer exactamente el piso con magnitud 0 (gate desarmado sin Δscore): ${f?.decisividad}/${f?.magnitud}`);
    }
    if (!(d.antiguedad as number > 2) && dec.capex_puesta_a_punto) F(`${pref} · capex calibrado sin CapEx`);

    // 2) La pirámide, como la ve el informe.
    const hz = ordenarHallazgosPiramideSTR(mergeHallazgosStr(result.hallazgos, buildStrHallazgos({
      result, francoScore, comuna: row.comuna as string, precioUF: d.precioCompraUF as number, superficieM2: d.superficieUtil as number,
      piePct: d.piePct as number, tasaPct: d.tasaInteres as number, plazoAnios: d.plazoCredito as number, mediana, valorUF: uf, incluyeCorretaje: false, veredictoCtx,
    })));
    if (hz[0]?.id !== caso.primero) F(`${pref} · 01 es ${hz[0]?.id}, esperado ${caso.primero}`);
    for (const h of hz) {
      const inf = (INFORMATIVOS_STR as readonly string[]).includes(h.id);
      if (inf && h.decisividad !== 0) F(`${pref} · informativo ${h.id} con decisividad ${h.decisividad}`);
      const f = dec[h.id as keyof DecisividadesSTR];
      if (!inf && f && Math.abs(h.decisividad - f.decisividad) > 1e-9) F(`${pref} · ${h.id} en la pirámide (${h.decisividad}) ≠ módulo (${f.decisividad})`);
      if (!inf && f && Math.abs((h.magnitudContinua ?? 0) - f.magnitud) > 1e-9) F(`${pref} · ${h.id} magnitud en la pirámide ≠ módulo`);
    }
    if (hz.filter((h) => h.id === "capex_puesta_a_punto").length > 1) F(`${pref} · capex duplicado tras el merge`);
    console.log(`  ${pref} · ${francoScore.veredicto}/${francoScore.score} · 01 ${hz[0]?.id} · ${hz.slice(0, 4).map((h) => `${h.id} ${h.decisividad.toFixed(2)}`).join(" | ")}`);
  }

  console.log("\nDECISIVIDAD REAL STR · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
