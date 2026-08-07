/**
 * Sweep de regresión del solver de TIR sobre un análisis REAL.
 *
 *   node --env-file=.env.local --import tsx scripts/test-irr-sweep.ts
 *
 * Recorre el espacio completo del simulador — plazo 1..30 años × plusvalía
 * 0..15% — para el análisis `ab0b2d3a` (Zenteno 183, pre-entrega 2029-09) y
 * verifica el contrato del fix. Es el mismo barrido que expuso el bug: 55 de esas
 * 480 combinaciones devolvían exactamente `100` con el solver Newton-Raphson.
 *
 * SOLO LECTURA sobre la base: un SELECT del análisis, nada más. No persiste.
 *
 * Asserts (todos duros — exit 1 si alguno cae):
 *   1. Ningún resultado es exactamente 100 (el valor del clamp retirado).
 *   2. A plazo fijo, la TIR es monótona creciente en plusvalía.
 *   3. Las 55 combinaciones que antes daban 100 hoy dan un valor convergido —
 *      verificado contra una bisección independiente — o un {ok:false} explícito.
 *   4. Control: plazo 10 / plusvalía 3% sigue dando 6,54%.
 */

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { calcProjections } from "../src/lib/analysis";
import { calculateKPIs } from "../src/lib/analysis/kpi-calculations";
import type { AnalisisInput, AnalysisMetrics } from "../src/lib/types";
import { metricaValorONull } from "../src/lib/types";

const ID = "ab0b2d3a-905e-4133-b65b-9beea2bdc64e";
const PLAZOS = 30;
const PLUSVALIAS = 15;

/**
 * Las 55 combinaciones (plusvalía%, plazo) que el solver viejo resolvía como
 * exactamente 100. Congeladas del diagnóstico previo (SHA 96c560c): el patrón es
 * "TIR real bajo ~2,2%". Si el motor cambia y alguna deja de estar en la lista,
 * el test lo dice en vez de pasar en silencio.
 */
const COMBOS_ROTOS: Array<[pv: number, plazoDesde: number]> = [
  [0, 9], [1, 14], [2, 20], [3, 26],
];
const eraRoto = (pv: number, plazo: number) =>
  COMBOS_ROTOS.some(([p, desde]) => p === pv && plazo >= desde);

function npv(f: number[], r: number): number {
  return f.reduce((s, x, i) => s + x / Math.pow(1 + r, i), 0);
}

/** Bisección independiente del módulo bajo test — el juez externo del sweep. */
function tirIndependiente(f: number[]): number | null {
  let lo = -0.95;
  let hi = 10;
  if (npv(f, lo) * npv(f, hi) > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (npv(f, lo) * npv(f, mid) <= 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await supabase
    .from("analisis")
    .select("input_data, results, created_at")
    .eq("id", ID)
    .single();
  if (error) throw error;

  const input = data.input_data as AnalisisInput;
  const m = (data.results as { metrics: AnalysisMetrics }).metrics;
  const ufClp = m.precioCLP / input.precio;
  const asOf = new Date(data.created_at);

  let cien = 0;
  let noMonotona = 0;
  let rotosSinResolver = 0;
  let desviados = 0;
  let sinTIR = 0;
  const detalles: string[] = [];
  const mapa: string[] = [];

  for (let pv = 0; pv <= PLUSVALIAS; pv++) {
    // Espejo EXACTO de results-client.tsx: array de 30 años, plusvalía del slider.
    const projections = calcProjections({
      input, metrics: m, plazoVenta: 30, plusvaliaAnual: pv / 100, ufClp, asOf,
    });
    const marcas: string[] = [];

    for (let plazo = 1; plazo <= PLAZOS; plazo++) {
      const kpis = calculateKPIs({ projections, metrics: m, plazoAnios: plazo, plusvaliaAnual: pv / 100, input });
      // `kpis.tir` dejó de ser `number | null`: lleva su razón de ausencia (pie 0,
      // horizonte antes de la escritura, VPN sin raíz). Acá solo interesa el
      // número, así que se desenvuelve — las razones se auditan en el render.
      const tir = metricaValorONull(kpis.tir);

      // Vector tal cual lo arma calcExitScenario, para el juez independiente.
      const proy = projections[plazo - 1];
      const comision = Math.round(proy.valorPropiedad * 0.02);
      const flujos = [-kpis.inversionInicial];
      for (let i = 0; i < plazo; i++) {
        let f = projections[i].flujoAnual;
        if (i === plazo - 1) f += proy.valorPropiedad - proy.saldoCredito - comision;
        flujos.push(f);
      }
      const real = tirIndependiente(flujos);

      // ── Assert 1: nunca el valor del clamp.
      if (tir === 100) {
        cien++;
        detalles.push(`pv=${pv}% plazo=${plazo}a devolvió exactamente 100`);
      }

      // ── Assert 3: los combos rotos hoy resuelven o declaran ausencia.
      if (eraRoto(pv, plazo)) {
        if (tir === null) {
          // Ausencia explícita: válida solo si tampoco hay raíz de verdad.
          if (real !== null) {
            rotosSinResolver++;
            detalles.push(`pv=${pv}% plazo=${plazo}a: null pero SÍ hay raíz (${real.toFixed(2)}%)`);
          }
        } else if (real === null || Math.abs(tir - real) > 0.05) {
          rotosSinResolver++;
          detalles.push(
            `pv=${pv}% plazo=${plazo}a: motor ${tir} vs independiente ${real?.toFixed(2) ?? "sin raíz"}`,
          );
        }
      }

      // Coherencia global motor ↔ juez independiente (todas las celdas).
      if (tir === null) {
        sinTIR++;
        marcas.push("·");
      } else if (real === null || Math.abs(tir - real) > 0.05) {
        desviados++;
        detalles.push(`pv=${pv}% plazo=${plazo}a: ${tir} vs ${real?.toFixed(2) ?? "sin raíz"}`);
        marcas.push("X");
      } else {
        marcas.push(".");
      }
    }
    mapa.push(`pv ${String(pv).padStart(2)}% | ${marcas.join("")}`);
  }

  // ── Assert 2: monotonía en plusvalía a plazo fijo.
  for (let plazo = 1; plazo <= PLAZOS; plazo++) {
    let previa: number | null = null;
    for (let pv = 0; pv <= PLUSVALIAS; pv++) {
      const projections = calcProjections({
        input, metrics: m, plazoVenta: 30, plusvaliaAnual: pv / 100, ufClp, asOf,
      });
      const tir = metricaValorONull(
        calculateKPIs({ projections, metrics: m, plazoAnios: plazo, plusvaliaAnual: pv / 100, input }).tir,
      );
      if (tir === null) continue;
      if (previa !== null && tir < previa - 1e-9) {
        noMonotona++;
        detalles.push(`plazo=${plazo}a: TIR baja de ${previa} (pv ${pv - 1}%) a ${tir} (pv ${pv}%)`);
      }
      previa = tir;
    }
  }

  // ── Assert 4: control.
  const projCtrl = calcProjections({
    input, metrics: m, plazoVenta: 30, plusvaliaAnual: 0.03, ufClp, asOf,
  });
  const control = calculateKPIs({ projections: projCtrl, metrics: m, plazoAnios: 10, plusvaliaAnual: 0.03, input }).tir;

  console.log("Mapa (columna = plazo 1..30; X = motor ≠ bisección independiente; · = sin TIR)");
  console.log("        | 123456789012345678901234567890");
  mapa.forEach((f) => console.log(f));
  console.log(`\nCeldas: ${(PLUSVALIAS + 1) * PLAZOS} · sin TIR: ${sinTIR} · desviadas: ${desviados}`);
  console.log(`Control plazo 10 / plusvalía 3%: ${control}% (esperado 6,54%)`);
  if (detalles.length) {
    console.log("\nDetalle:");
    detalles.slice(0, 40).forEach((d) => console.log("  " + d));
    if (detalles.length > 40) console.log(`  … y ${detalles.length - 40} más`);
  }

  console.log("\n─── ASSERTS ───");
  const checks: Array<[string, () => void]> = [
    ["1. ningún resultado es exactamente 100", () => assert.equal(cien, 0)],
    ["2. TIR monótona creciente en plusvalía a plazo fijo", () => assert.equal(noMonotona, 0)],
    ["3. las 55 combinaciones rotas hoy resuelven o declaran ausencia", () => assert.equal(rotosSinResolver, 0)],
    ["4. control plazo 10 / plusvalía 3% = 6,54%", () => assert.equal(control, 6.54)],
    ["5. motor coincide con bisección independiente en las 480 celdas", () => assert.equal(desviados, 0)],
  ];
  let fail = 0;
  for (const [nombre, fn] of checks) {
    try {
      fn();
      console.log(`  OK   ${nombre}`);
    } catch (err) {
      fail++;
      console.log(`  FAIL ${nombre}`);
      console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
