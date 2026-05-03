/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests del clasificador financingHealth.
 *
 * El repo no tiene framework de testing instalado (jest/vitest/etc.). Este
 * script usa `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/audit-attractors.ts`.
 *
 *   npx tsx scripts/test-financing-health.ts
 *
 * Salida: lista de tests con OK/FAIL y exit code != 0 si alguno falla.
 */

import assert from "node:assert/strict";
import {
  classifyFinancingHealth,
  MARKET_AVG_TASA_UF,
  type FinancingHealth,
} from "../src/lib/financing-health";
import { setUFValue } from "../src/lib/analysis";

// Fijamos UF a un valor estable para que los impact_message sean determinísticos.
const TEST_UF = 38800;
setUFValue(TEST_UF);

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  OK   ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL ${name}`);
    console.error("       ", (e as Error).message);
    fail++;
  }
}

function classify(opts: Partial<{
  pie_pct: number;
  tasa_pct: number;
  precio_uf: number;
  plazo_anios: number;
}> = {}): FinancingHealth {
  return classifyFinancingHealth({
    pie_pct: opts.pie_pct ?? 20,
    tasa_pct: opts.tasa_pct ?? MARKET_AVG_TASA_UF,
    precio_uf: opts.precio_uf ?? 5000,
    plazo_anios: opts.plazo_anios ?? 25,
  });
}

console.log("\n──── PIE: clasificación por umbral ────");

test("pie 30% (≥25) → optimo", () => {
  const r = classify({ pie_pct: 30 });
  assert.equal(r.pie.level, "optimo");
});

test("pie 25% (frontera) → optimo", () => {
  const r = classify({ pie_pct: 25 });
  assert.equal(r.pie.level, "optimo");
});

test("pie 24% → aceptable", () => {
  const r = classify({ pie_pct: 24 });
  assert.equal(r.pie.level, "aceptable");
});

test("pie 20% (frontera) → aceptable", () => {
  const r = classify({ pie_pct: 20 });
  assert.equal(r.pie.level, "aceptable");
});

test("pie 19% → mejorable", () => {
  const r = classify({ pie_pct: 19 });
  assert.equal(r.pie.level, "mejorable");
});

test("pie 15% (frontera) → mejorable", () => {
  const r = classify({ pie_pct: 15 });
  assert.equal(r.pie.level, "mejorable");
});

test("pie 14% → problematico", () => {
  const r = classify({ pie_pct: 14 });
  assert.equal(r.pie.level, "problematico");
});

test("pie 10% → problematico", () => {
  const r = classify({ pie_pct: 10 });
  assert.equal(r.pie.level, "problematico");
});

console.log("\n──── TASA: clasificación por spread vs MARKET_AVG_TASA_UF ────");
// MARKET_AVG_TASA_UF = 4.1 → óptima ≤ 4.30, aceptable 4.31-4.60, mejorable 4.61-4.90, problemática > 4.90.

test(`tasa = market_avg (${MARKET_AVG_TASA_UF}%) → optimo (spread 0bps)`, () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF });
  assert.equal(r.tasa.level, "optimo");
  assert.equal(r.tasa.spread_bps, 0);
});

test("tasa market_avg + 20bps → optimo (frontera)", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.2 });
  assert.equal(r.tasa.level, "optimo");
  assert.equal(r.tasa.spread_bps, 20);
});

test("tasa market_avg + 21bps → aceptable", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.21 });
  assert.equal(r.tasa.level, "aceptable");
  assert.equal(r.tasa.spread_bps, 21);
});

test("tasa market_avg + 50bps → aceptable (frontera)", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.5 });
  assert.equal(r.tasa.level, "aceptable");
  assert.equal(r.tasa.spread_bps, 50);
});

test("tasa market_avg + 51bps → mejorable", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.51 });
  assert.equal(r.tasa.level, "mejorable");
  assert.equal(r.tasa.spread_bps, 51);
});

test("tasa market_avg + 80bps → mejorable (frontera)", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.8 });
  assert.equal(r.tasa.level, "mejorable");
  assert.equal(r.tasa.spread_bps, 80);
});

test("tasa market_avg + 81bps → problematico", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.81 });
  assert.equal(r.tasa.level, "problematico");
  assert.equal(r.tasa.spread_bps, 81);
});

test("tasa market_avg + 200bps → problematico", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 2 });
  assert.equal(r.tasa.level, "problematico");
});

test("tasa bajo el promedio (3.5%) → optimo (spread negativo permitido)", () => {
  const r = classify({ tasa_pct: 3.5 });
  assert.equal(r.tasa.level, "optimo");
  assert.equal(r.tasa.spread_bps, -60);
});

console.log("\n──── OVERALL: peor de los dos ────");

test("pie optimo + tasa optima → optimo", () => {
  const r = classify({ pie_pct: 30, tasa_pct: MARKET_AVG_TASA_UF });
  assert.equal(r.overall, "optimo");
});

test("pie aceptable + tasa optima → aceptable", () => {
  const r = classify({ pie_pct: 22, tasa_pct: MARKET_AVG_TASA_UF });
  assert.equal(r.overall, "aceptable");
});

test("pie optimo + tasa mejorable → mejorable", () => {
  const r = classify({ pie_pct: 30, tasa_pct: MARKET_AVG_TASA_UF + 0.7 });
  assert.equal(r.overall, "mejorable");
});

test("pie problematico + tasa optima → problematico", () => {
  const r = classify({ pie_pct: 10, tasa_pct: MARKET_AVG_TASA_UF });
  assert.equal(r.overall, "problematico");
});

test("pie aceptable + tasa problematico → problematico", () => {
  const r = classify({ pie_pct: 22, tasa_pct: MARKET_AVG_TASA_UF + 1.5 });
  assert.equal(r.overall, "problematico");
});

console.log("\n──── IMPACT_MESSAGE: presencia y forma ────");

test("pie optimo NO incluye impact_message", () => {
  const r = classify({ pie_pct: 30 });
  assert.equal(r.pie.impact_message, undefined);
});

test("pie aceptable incluye impact_message con número en CLP", () => {
  const r = classify({ pie_pct: 20 });
  assert.ok(r.pie.impact_message, "esperaba impact_message");
  assert.match(r.pie.impact_message!, /subir el pie a 25% baja la cuota en \$/);
});

test("pie mejorable incluye impact_message", () => {
  const r = classify({ pie_pct: 17 });
  assert.ok(r.pie.impact_message);
  assert.match(r.pie.impact_message!, /\$/);
});

test("pie problematico incluye impact_message con monto sustantivo", () => {
  // Pie 10% sobre UF 5000 → crédito ~UF 4500 vs UF 3750 al subir a 25%.
  // Diferencia mensual no debería ser cero ni un peso.
  const r = classify({ pie_pct: 10 });
  assert.ok(r.pie.impact_message);
  // El monto formateado tiene al menos un "."
  assert.match(r.pie.impact_message!, /\$\d+\.\d/);
});

test("tasa optima NO incluye impact_message", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF });
  assert.equal(r.tasa.impact_message, undefined);
});

test("tasa aceptable incluye impact_message", () => {
  const r = classify({ tasa_pct: MARKET_AVG_TASA_UF + 0.4 });
  assert.ok(r.tasa.impact_message);
  assert.match(r.tasa.impact_message!, /bajar la tasa a/);
});

test("tasa problematico incluye impact_message con tasa formateada con coma decimal", () => {
  const r = classify({ tasa_pct: 5.5 });
  assert.ok(r.tasa.impact_message);
  // Formato chileno: separador decimal coma
  assert.match(r.tasa.impact_message!, /\d,\d\d%/);
});

console.log("\n──── INVARIANTES ────");

test("recommended_pct de pie es siempre 25", () => {
  for (const pie of [10, 15, 20, 25, 30]) {
    const r = classify({ pie_pct: pie });
    assert.equal(r.pie.recommended_pct, 25);
  }
});

test("market_avg_pct de tasa es siempre MARKET_AVG_TASA_UF", () => {
  for (const tasa of [3.5, 4.1, 4.5, 5.5]) {
    const r = classify({ tasa_pct: tasa });
    assert.equal(r.tasa.market_avg_pct, MARKET_AVG_TASA_UF);
  }
});

test("actual_pct refleja el input tal cual", () => {
  const r = classify({ pie_pct: 17, tasa_pct: 4.73 });
  assert.equal(r.pie.actual_pct, 17);
  assert.equal(r.tasa.actual_pct, 4.73);
});

console.log("\n────────────────────────────────────");
console.log(`Total: ${pass + fail}  ·  OK: ${pass}  ·  FAIL: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
