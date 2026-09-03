/**
 * Tests de `barraDia1` (`src/lib/plata-dia1.ts`): geometría de la barra "Lo que
 * pusiste · el día 1" del capítulo V. Mismo patrón que test-mantencion-capex.ts
 * (node:assert/strict + tsx, cero red).
 *
 *   npx tsx scripts/test-plata-dia1.ts
 *
 * Propiedades:
 *   G1 misma escala: anchoPct === inversionInicial / patrimonio × 100 (09cad61e ⇒ 36%).
 *   G2 los segmentos suman 100% de la barra y respetan los montos del motor.
 *   G3 sin CapEx ⇒ dos segmentos; sin pie ⇒ sin segmento pie.
 *   G4 multiplicador < 1 (inversión > patrimonio): la barra se acota al 100%, marca
 *      `desborda` y los segmentos siguen sumando 100 — el layout no se rompe.
 */

import assert from "node:assert/strict";
import { barraDia1 } from "../src/lib/plata-dia1";

let pass = 0;
let fail = 0;
function test(nombre: string, fn: () => void) {
  try { fn(); pass++; console.log(`  OK   ${nombre}`); }
  catch (e) { fail++; console.log(`  FAIL ${nombre}\n       ${(e as Error).message.split("\n")[0]}`); }
}
const cerca = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

// 09cad61e (v3): pie 32.702.400 · gastos 6.540.480 · capex 1.226.340 · inv 40.469.220 · patrimonio 112.294.544
const C = { pieCLP: 32_702_400, gastosCompraCLP: 6_540_480, capexCLP: 1_226_340, inversionInicial: 40_469_220, patrimonio: 112_294_544 };

test("G1 · misma escala que la barra de abajo: 09cad61e ⇒ 36%", () => {
  const b = barraDia1(C);
  assert.ok(cerca(b.anchoPct, (C.inversionInicial / C.patrimonio) * 100));
  assert.equal(Math.round(b.anchoPct), 36);
  assert.equal(b.desborda, false);
});

test("G2 · los segmentos suman 100 y respetan pie/gastos/capex del motor", () => {
  const b = barraDia1(C);
  assert.equal(b.segmentos.length, 3);
  assert.ok(cerca(b.segmentos.reduce((a, s) => a + s.pct, 0), 100));
  assert.deepEqual(b.segmentos.map((s) => s.tono), ["pie", "gastos", "capex"]);
  assert.deepEqual(b.segmentos.map((s) => s.montoCLP), [C.pieCLP, C.gastosCompraCLP, C.capexCLP]);
  assert.ok(cerca(b.segmentos[0].pct, (C.pieCLP / C.inversionInicial) * 100));
});

test("G3 · sin CapEx ⇒ dos segmentos; sin pie ⇒ sin segmento pie", () => {
  const sinCapex = barraDia1({ ...C, capexCLP: 0, inversionInicial: C.pieCLP + C.gastosCompraCLP });
  assert.deepEqual(sinCapex.segmentos.map((s) => s.tono), ["pie", "gastos"]);
  assert.ok(cerca(sinCapex.segmentos.reduce((a, s) => a + s.pct, 0), 100));
  const sinPie = barraDia1({ pieCLP: 0, gastosCompraCLP: 3_000_000, capexCLP: 1_000_000, inversionInicial: 4_000_000, patrimonio: 20_000_000 });
  assert.deepEqual(sinPie.segmentos.map((s) => s.tono), ["gastos", "capex"]);
});

test("G4 · multiplicador < 1: ancho acotado a 100, desborda=true, segmentos suman 100 (layout intacto)", () => {
  const b = barraDia1({ ...C, patrimonio: 30_000_000 }); // inversión 40,5 MM > patrimonio 30 MM
  assert.equal(b.anchoPct, 100);
  assert.equal(b.desborda, true);
  assert.ok(cerca(b.segmentos.reduce((a, s) => a + s.pct, 0), 100));
  for (const s of b.segmentos) assert.ok(s.pct >= 0 && s.pct <= 100);
  // Degenerados: patrimonio 0 o inversión 0 ⇒ ancho 0, sin NaN.
  assert.equal(barraDia1({ ...C, patrimonio: 0 }).anchoPct, 0);
  const vacio = barraDia1({ pieCLP: 0, gastosCompraCLP: 0, capexCLP: 0, inversionInicial: 0, patrimonio: 100 });
  assert.equal(vacio.anchoPct, 0);
  assert.equal(vacio.segmentos.length, 0);
});

console.log(`\n${pass} OK · ${fail} FAIL`);
if (fail > 0) process.exit(1);
