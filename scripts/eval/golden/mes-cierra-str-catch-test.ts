// ============================================================================
// GOLDEN · "donde el mes cierra" STR — test de PROPIEDAD (05-sep-2026). 0 tokens, lee dos
// filas reales y recomputa en memoria; nada se persiste.
// ============================================================================
// Para eb7b3a66 (Sta. Rosa, AJUSTA) y 5dc42a82 (Grajales, BUSCAR OTRA):
//   · el flujo mensual recomputado AL precio hallado queda dentro de ±$1 (regla plata-dia1);
//   · a $500 más de precio el flujo ya es negativo (es el precio MÁS ALTO que cierra);
//   · Sta. Rosa cierra cerca de UF 2.211 y bajo el techo de la vía de precio (UF 2.536);
//   · el límite de TIR 6% queda sobre el precio actual y la TIR ahí es ≥ 6%.
//   node --env-file=.env.local --import tsx scripts/eval/golden/mes-cierra-str-catch-test.ts
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { buildStrRecomputeCtx } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { recomputeStrConPatch, type VeredictoStrCtx } from "../../../src/lib/analysis/veredicto-str-con-patch";
import { simularStrDesdePersistido, TIR_LIMITE_PCT } from "../../../src/lib/analysis/simular-str";
import { metricaValorONull } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const CASOS = [
  { id: "eb7b3a66-5769-4c57-92dc-a7c40229d6f9", nombre: "Sta. Rosa", cierraUF: 2211, techoUF: 2536 },
  { id: "5dc42a82-69d8-4aeb-84c8-1e8b908ca474", nombre: "Grajales", cierraUF: null, techoUF: null },
];

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  for (const c of CASOS) {
    const { data: row, error } = await sb.from("analisis").select("id, input_data, results, created_at").eq("id", c.id).single();
    if (error || !row) { F(`${c.nombre}: fila no cargó (${error?.message})`); continue; }
    const d = row.input_data as Record<string, number>;
    const uf = d.precioCompra / d.precioCompraUF;
    const sim = simularStrDesdePersistido(row.input_data, row.results, uf, new Date(row.created_at));
    const ctx = buildStrRecomputeCtx(row.input_data, row.results, uf);
    if (!sim || !ctx) { F(`${c.nombre}: sin simulación o sin contexto`); continue; }
    const vctx: VeredictoStrCtx = { inputs: ctx.inputs, scoreExtras: ctx.scoreExtras, asOf: new Date(row.created_at) };
    const flujoA = (p: number) => { const r = recomputeStrConPatch(vctx, { precioCompra: p }).result; return r.metrics?.flujoMensual ?? r.escenarios.base.flujoCajaMensual; };
    const mc = sim.mesCierra;
    console.log(`${c.nombre}: precio UF ${Math.round(d.precioCompraUF)} · mes cierra ${mc ? `UF ${mc.precioUF} ($${mc.precioCLP.toLocaleString("es-CL")}, ×${mc.factor.toFixed(3)}, flujo ahí $${Math.round(flujoA(mc.precioCLP))})` : "no cierra ni a −70%"} · límite TIR ${sim.limiteTir ? `UF ${sim.limiteTir.precioUF}` : "—"}`);
    if (mc) {
      const f0 = flujoA(mc.precioCLP);
      if (!(f0 >= -1 && f0 <= 1)) F(`${c.nombre}: flujo al precio de cierre = $${f0.toFixed(2)}, fuera de ±$1`);
      if (mc.precioCLP < d.precioCompra && flujoA(mc.precioCLP + 500) >= 0) F(`${c.nombre}: $500 más arriba el mes sigue cerrando: no es el precio más alto`);
      if (c.cierraUF != null && Math.abs(mc.precioUF - c.cierraUF) > 5) F(`${c.nombre}: cierra en UF ${mc.precioUF}, esperado ≈ ${c.cierraUF}`);
      if (c.techoUF != null && !(mc.precioUF < c.techoUF)) F(`${c.nombre}: el cierre (UF ${mc.precioUF}) debía quedar bajo el techo UF ${c.techoUF}`);
    } else if (c.cierraUF != null) F(`${c.nombre}: debía cerrar`);
    const lt = sim.limiteTir;
    if (lt) {
      const r = recomputeStrConPatch(vctx, { precioCompra: lt.precioCLP }).result;
      const tir = r.metrics?.tirPct ?? (r.exitScenario ? metricaValorONull(r.exitScenario.tirAnual) : null);
      if (tir == null || tir < TIR_LIMITE_PCT) F(`${c.nombre}: la TIR al límite es ${tir}, bajo ${TIR_LIMITE_PCT}%`);
      if (lt.precioCLP < d.precioCompra) F(`${c.nombre}: el límite (${lt.precioCLP}) quedó bajo el precio actual`);
    }
  }
  console.log("\nmes cierra STR · catch-test\n");
  if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
  console.log("✓ VERDE");
}
main().catch((e) => { console.error(e); process.exit(1); });
