/**
 * Tests de `resumirComparablesRadio` (`src/lib/services/comparables-radio.ts`),
 * el consumidor de la RPC `properties_within_radius`.
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-comparables-radio.ts
 *
 * Cero red, cero DB. Mismo patrón que scripts/test-drift-prosa-comuna.ts.
 *
 * CONTRATO QUE DEFIENDE: la sugerencia del wizard hace algo con `gastos_comunes`.
 * La función viva en la base hasta el 04-sep-2026 devolvía la fila SIN esa
 * columna (ver migración 20260904) y el consumidor la leía igual, siempre
 * undefined: el gasto común por radio nunca se estimó y nadie lo vio, porque la
 * lógica estaba pegada a la llamada RPC y no se podía probar con un fixture. El
 * fixture de abajo tiene la forma exacta que devuelve la función nueva.
 */

import assert from "node:assert/strict";
import {
  MIN_COMPARABLES_RADIO,
  MIN_GGCC_RADIO,
  filterOutliers,
  resumirComparablesRadio,
  type FilaRadio,
} from "../src/lib/services/comparables-radio";

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

// ── Fixture: seis arriendos 2D de ~50 m² a 750 m, con la forma de la RPC nueva ──
const fila = (precio: number, sup: number, ggcc: number | null, dist: number): FilaRadio => ({
  precio, superficie_m2: sup, gastos_comunes: ggcc, dormitorios: 2, lat: -33.44, lng: -70.63, distance_meters: dist,
});
// Precios/m² entre 10.000 y 12.150: dispersión realista para que el IQR no
// recorte ninguna fila del fixture (con seis valores casi iguales, las cercas
// de 1,5×IQR se cierran tanto que botan los extremos).
const CON_GGCC: FilaRadio[] = [
  fila(450000, 45, 78000, 310),
  fila(520000, 48, 85000, 120),
  fila(560000, 52, 90000, 240),
  fila(600000, 50, 110000, 480),
  fila(640000, 55, null, 610),
  fila(680000, 56, 0, 720),
];
/** La misma muestra tal como la devolvía la función VIVA antes de la migración: sin la columna. */
const SIN_COLUMNA: FilaRadio[] = CON_GGCC.map(({ precio, superficie_m2, lat, lng, distance_meters }) => ({
  precio, superficie_m2, lat, lng, distance_meters,
}));

console.log("\n── gastos comunes: el dato que la RPC vieja no devolvía ──");
test("con gastos_comunes en las filas, el ggcc es su mediana a miles", () => {
  const r = resumirComparablesRadio(CON_GGCC, 50, { modo: "conDorms", factorCierre: 1 })!;
  assert.ok(r);
  // 78.000, 85.000, 90.000, 110.000 → mediana 87.500 → a miles 88.000
  assert.equal(r.ggcc, 88000);
});
test("las filas con gastos_comunes null o 0 no cuentan para la mediana ni para el mínimo", () => {
  const tres = [...CON_GGCC.slice(0, 3), ...CON_GGCC.slice(4)]; // 78.000, 85.000, 90.000 + null + 0
  const r = resumirComparablesRadio(tres, 50, { modo: "conDorms", factorCierre: 1 })!;
  assert.equal(r.ggcc, 85000);
});
test(`con menos de ${MIN_GGCC_RADIO} gastos comunes conocidos, ggcc es null (no se inventa)`, () => {
  const dos = CON_GGCC.map((f, i) => (i < 2 ? f : { ...f, gastos_comunes: null }));
  const r = resumirComparablesRadio(dos, 50, { modo: "conDorms", factorCierre: 1 })!;
  assert.equal(r.ggcc, null);
});
test("EL BUG: la misma muestra sin la columna da ggcc null — por eso nunca se estimó", () => {
  const r = resumirComparablesRadio(SIN_COLUMNA, 50, { modo: "conDorms", factorCierre: 1 })!;
  assert.ok(r, "la mediana de arriendo sí salía");
  assert.equal(r.ggcc, null);
  assert.equal(r.arriendo, 580000);
});

console.log("\n── modo conDorms ──");
test("arriendo = mediana de precios a miles; sampleSize = filas limpias", () => {
  const r = resumirComparablesRadio(CON_GGCC, 50, { modo: "conDorms", factorCierre: 1 })!;
  assert.equal(r.arriendo, 580000); // mediana(450,520,560,600,640,680)=580.000
  assert.equal(r.sampleSize, 6);
});
test("precioM2 lleva el factor de cierre", () => {
  // Se compara contra la mediana cruda, no contra el precioM2 ya redondeado:
  // round(x × 0,93) y round(round(x) × 0,93) pueden diferir en 1.
  const ppm2 = CON_GGCC.map((f) => f.precio / f.superficie_m2!).sort((a, b) => a - b);
  const medianaPpm2 = (ppm2[2] + ppm2[3]) / 2;
  const con = resumirComparablesRadio(CON_GGCC, 50, { modo: "conDorms", factorCierre: 0.93 })!;
  assert.equal(con.precioM2, Math.round(medianaPpm2 * 0.93));
});
test(`menos de ${MIN_COMPARABLES_RADIO} comparables limpios → null`, () => {
  assert.equal(resumirComparablesRadio(CON_GGCC.slice(0, 4), 50, { modo: "conDorms", factorCierre: 1 }), null);
});

console.log("\n── modo sinDorms ──");
test("sinDorms escala la mediana de precio/m² a la superficie del sujeto", () => {
  const r = resumirComparablesRadio(CON_GGCC, 60, { modo: "sinDorms", factorCierre: 1 })!;
  const ppm2 = CON_GGCC.map((f) => f.precio / f.superficie_m2!).sort((a, b) => a - b);
  const medianaM2 = ppm2[Math.floor(ppm2.length / 2)];
  assert.equal(r.arriendo, Math.round((medianaM2 * 60) / 1000) * 1000);
  assert.equal(r.ggcc, 88000);
});
test("sinDorms sin superficies → null", () => {
  const sinSup = CON_GGCC.map((f) => ({ ...f, superficie_m2: null }));
  assert.equal(resumirComparablesRadio(sinSup, 60, { modo: "sinDorms", factorCierre: 1 }), null);
});

console.log("\n── limpieza ──");
test("un outlier de precio/m² se descarta por IQR", () => {
  const conOutlier = [...CON_GGCC, fila(5_000_000, 50, 90000, 100)];
  const limpio = filterOutliers(conOutlier);
  assert.equal(limpio.length, 6);
  assert.ok(!limpio.some((f) => f.precio === 5_000_000));
});
test("una superficie absurda se descarta antes del IQR", () => {
  const limpio = filterOutliers([...CON_GGCC, fila(500000, 900, 90000, 100)]);
  assert.equal(limpio.length, 6);
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? ` → ${fallidos.join(", ")}` : ""}`);
process.exit(fail ? 1 : 0);
