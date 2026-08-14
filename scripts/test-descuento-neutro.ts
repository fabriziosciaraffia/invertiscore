/**
 * Test de regresión del caso "un 113% menos" (análisis real 1ad769d4).
 *
 * Bug: el user prompt LTR narraba el precio flujo-neutro SIEMPRE como
 * "(descuento X%)", incluso cuando el flujo mensual ya era positivo y el
 * neutro quedaba SOBRE el precio pedido (descuento negativo). La IA lo
 * convertía en "si el precio bajara a UF 2.767, un 113% menos" — una
 * disminución aritméticamente imposible sobre un precio de UF 1.300.
 *
 * Fix bajo test: `lecturaPrecioFlujoNeutro` (src/lib/ai-generation.ts),
 * la línea pre-digerida que reemplaza al ternario del prompt.
 *
 * Mismo patrón que scripts/test-plausibilidad.ts (sin framework):
 *   npx tsx scripts/test-descuento-neutro.ts
 * Cero red, cero DB: la función bajo test es pura.
 */

import assert from "node:assert/strict";
import { lecturaPrecioFlujoNeutro } from "../src/lib/ai-generation";

let pass = 0;
let fail = 0;
const fallidos: string[] = [];

function test(nombre: string, fn: () => void): void {
  try {
    fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (e) {
    fail++;
    fallidos.push(nombre);
    console.error(`  FAIL ${nombre}\n       ${(e as Error).message}`);
  }
}

// ── Caso de regresión: valores persistidos reales de 1ad769d4 ────────────────
// input: precio UF 1.300 · arriendo $330.000 · pie 50% → flujo +$113.454/mes.
// metrics: precioFlujoNeutroUF 2767.55 · descuentoParaNeutro −112.9.
test("1ad769d4: descuento negativo NO se narra como rebaja", () => {
  const linea = lecturaPrecioFlujoNeutro(2767.55, -112.9);
  assert.doesNotMatch(linea, /\(descuento/, "no debe emitir '(descuento ...%)'");
  assert.doesNotMatch(linea, /-112|113% menos/, "no debe emitir el % negativo como cifra de rebaja");
  assert.match(linea, /NO está bajo el precio pedido/, "debe declarar que el equilibrio no está bajo el precio");
  assert.match(linea, /PROHIBIDO/, "debe prohibir la narración como rebaja");
  assert.match(linea, /112,9% SOBRE/, "la posición se declara sobre el precio, en coma chilena");
});

// El signo del flujo NO se puede deducir del signo del descuento: el modelo de
// gastos de calcPrecioParaFlujo (arriendo/24) difiere del de flujoNetoMensual
// (provisionMantencionAjustada). Caso real 6db7a9ac: flujo −$94.855 con
// descuento −2% — la línea no puede afirmar "el flujo ya es positivo".
test("6db7a9ac: la línea NO afirma el signo del flujo mensual", () => {
  const linea = lecturaPrecioFlujoNeutro(3262.65, -2);
  assert.doesNotMatch(linea, /flujo ya es positivo/, "no debe afirmar flujo positivo");
  assert.match(linea, /lecturaFlujo/, "debe delegar el signo del flujo a lecturaFlujo");
  assert.match(linea, /2,0% SOBRE/, "declara la posición relativa al precio");
});

test("1ad769d4: la línea sigue trayendo el monto UF del neutro", () => {
  const linea = lecturaPrecioFlujoNeutro(2767.55, -112.9);
  assert.match(linea, /UF 2\.767,6/, "el monto va en formato UF de la casa (fmtUF redondea a 1 decimal)");
});

// ── Caso legítimo: descuento positivo se mantiene IDÉNTICO al formato previo ──
test("descuento positivo: formato '(descuento X.X%)' intacto", () => {
  const linea = lecturaPrecioFlujoNeutro(4423, 19.6);
  assert.equal(linea, "UF 4.423 (descuento 19.6%)");
});

test("descuento grande pero <100%: sigue siendo caso legítimo", () => {
  const linea = lecturaPrecioFlujoNeutro(1322.6, 55.8);
  assert.match(linea, /\(descuento 55\.8%\)/);
  assert.doesNotMatch(linea, /PROHIBIDO/);
});

// ── Bordes ───────────────────────────────────────────────────────────────────
test("neutro inexistente (≤ 0): mensaje 'no existe' intacto", () => {
  assert.equal(
    lecturaPrecioFlujoNeutro(0, 0),
    "no existe — arriendo no cubre gastos fijos con esta estructura",
  );
});

test("descuento exactamente 0 (neutro == precio): sin '(0% SOBRE)' sin sentido", () => {
  const linea = lecturaPrecioFlujoNeutro(1300, 0);
  assert.doesNotMatch(linea, /\(descuento/);
  assert.match(linea, /coincide con él/);
  assert.doesNotMatch(linea, /0% SOBRE/);
});

test("descuento negativo chico (−0,05%): trata como coincidencia, no como subida", () => {
  const linea = lecturaPrecioFlujoNeutro(1300.5, -0.05);
  assert.match(linea, /coincide con él/);
  assert.doesNotMatch(linea, /SOBRE él/);
});

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} OK · ${fail} FAIL${fail > 0 ? ` → ${fallidos.join(", ")}` : ""}`);
if (fail > 0) process.exit(1);
