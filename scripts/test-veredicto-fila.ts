/**
 * Tests de `resolverVeredictoFila` (`src/lib/veredicto-fila.ts`).
 *
 *   npx tsx scripts/test-veredicto-fila.ts
 *
 * Cero red, cero DB: la función es pura. Mismo patrón que
 * `scripts/test-referencia-arriendo.ts`.
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO: una fila con arriendo ESTIMADO se decide
 * con su rango, no con el punto medio. Se paga sola solo si el PISO cubre la
 * cuota; no se paga sola solo si el TECHO no la cubre; si el rango cruza la
 * cuota, depende del arriendo real. Los bordes son exactos (≥ cubre, igual que
 * `cubre` en comunas-seo) y los cinco casos reales del roster al 03-sep-2026
 * están congelados acá con sus cifras.
 */

import assert from "node:assert/strict";
import {
  COPY_DEPENDE,
  ETIQUETA_VEREDICTO,
  brechaRango,
  esVeredictoBinario,
  resolverVeredictoFila,
} from "../src/lib/veredicto-fila";
import type { ReferenciaArriendo } from "../src/lib/referencia-arriendo";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try {
    fn(); pass++; console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

function estimada(min: number, max: number): ReferenciaArriendo {
  return {
    fuente: "comunalPorM2", nComunal: 15, ufM2Mes: 0.25, superficieRefM2: 60,
    factorTipologia: 0.9, errorResidualPct: 12, estimadoCLP: Math.round((min + max) / 2),
    rangoCLP: { min, max },
  };
}
const propia: ReferenciaArriendo = { fuente: "porTipologia", n: 40, medianaCLP: 500_000 };
const CUOTA = 500_000;

console.log("\n── fila propia: como siempre ──");
test("arriendo = cuota → se paga sola (borde ≥)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 500_000, referencia: propia }), "sePagaSola");
});
test("arriendo = cuota − 1 → no se paga sola", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 499_999, referencia: propia }), "noSePagaSola");
});
test("una fila propia nunca depende, aunque el arriendo esté a un peso", () => {
  assert.notEqual(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 500_001, referencia: propia }), "dependeDelArriendoReal");
});

console.log("\n── fila estimada: bordes exactos del rango contra la cuota ──");
test("piso = cuota → se paga sola (borde ≥)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 550_000, referencia: estimada(500_000, 600_000) }), "sePagaSola");
});
test("piso = cuota − 1, techo sobre → depende", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 550_000, referencia: estimada(499_999, 600_000) }), "dependeDelArriendoReal");
});
test("techo = cuota − 1 → no se paga sola", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 450_000, referencia: estimada(400_000, 499_999) }), "noSePagaSola");
});
test("techo = cuota, piso bajo → depende (el techo justo cubre)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 450_000, referencia: estimada(400_000, 500_000) }), "dependeDelArriendoReal");
});
test("el punto medio NO decide: cubre pero el piso no → depende", () => {
  // punto medio 550.000 ≥ cuota, y sin embargo no es veredicto
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 550_000, referencia: estimada(480_000, 620_000) }), "dependeDelArriendoReal");
});
test("el punto medio NO decide: no cubre pero el techo sí → depende", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: CUOTA, arriendoCLP: 480_000, referencia: estimada(420_000, 540_000) }), "dependeDelArriendoReal");
});

console.log("\n── casos reales del roster (cifras del 03-sep-2026) ──");
test("Pudahuel 3D: rango $414.000–$573.000 vs cuota $497.268 → depende", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: 497_268, arriendoCLP: 493_000, referencia: estimada(414_000, 573_000) }), "dependeDelArriendoReal");
});
test("Santiago 4D: rango $930.000–$1.287.000 vs cuota $878.098 → se paga sola (el piso cubre)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: 878_098, arriendoCLP: 1_109_000, referencia: estimada(930_000, 1_287_000) }), "sePagaSola");
});
test("Peñalolén 2D: rango $625.000–$791.000 vs cuota $1.135.662 → no se paga sola (ni el techo cubre)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: 1_135_662, arriendoCLP: 708_000, referencia: estimada(625_000, 791_000) }), "noSePagaSola");
});
// Providencia 4D y Recoleta 3D se congelan abajo con las cifras del script de
// datos (of-veredictos-fila.ts) del 03-sep-2026.
test("Providencia 4D: rango $1.461.000–$2.021.000 vs cuota $1.639.262 → depende", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: 1_639_262, arriendoCLP: 1_741_000, referencia: estimada(1_461_000, 2_021_000) }), "dependeDelArriendoReal");
});
test("Recoleta 3D: rango $445.000–$616.000 vs cuota $517.518 → depende (antes salía se paga sola por el punto medio)", () => {
  assert.equal(resolverVeredictoFila({ dividendoCLP: 517_518, arriendoCLP: 530_000, referencia: estimada(445_000, 616_000) }), "dependeDelArriendoReal");
});

console.log("\n── auxiliares ──");
test("esVeredictoBinario: solo depende es no-binario", () => {
  assert.equal(esVeredictoBinario("sePagaSola"), true);
  assert.equal(esVeredictoBinario("noSePagaSola"), true);
  assert.equal(esVeredictoBinario("dependeDelArriendoReal"), false);
});
test("brechaRango: extremos del rango menos la cuota; null en fila propia", () => {
  assert.deepEqual(brechaRango({ dividendoCLP: 497_268, referencia: estimada(414_000, 573_000) }), { min: -83_268, max: 75_732 });
  assert.equal(brechaRango({ dividendoCLP: CUOTA, referencia: propia }), null);
});
test("etiquetas y copy canónico existen para los tres valores", () => {
  assert.equal(ETIQUETA_VEREDICTO.sePagaSola, "Se paga solo");
  assert.equal(ETIQUETA_VEREDICTO.noSePagaSola, "No se paga solo");
  assert.equal(ETIQUETA_VEREDICTO.dependeDelArriendoReal, "Depende del arriendo real");
  assert.match(COPY_DEPENDE, /piso del rango no se paga; con el techo sí/);
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? ` → ${fallidos.join(", ")}` : ""}`);
process.exit(fail ? 1 : 0);
