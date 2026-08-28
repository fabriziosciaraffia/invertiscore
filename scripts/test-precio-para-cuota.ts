/**
 * Tests de `calcPrecioParaCuota` (`src/lib/analysis.ts`).
 *
 * El repo no tiene framework de testing instalado. Este script usa
 * `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-irr-solver.ts` y `scripts/test-plausibilidad.ts`.
 *
 *   npx tsx scripts/test-precio-para-cuota.ts
 *
 * Cero red, cero DB: las funciones bajo test son puras.
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO — la PROPIEDAD, no un caso suelto:
 * para cualquier combinación (tasa, arriendo, pie, plazo), el dividendo del
 * crédito que se toma al precio devuelto tiene que dar el arriendo de vuelta.
 *
 *     calcDividendo(precio × (1 − pie/100), tasa, plazo) === arriendo
 *
 * La regresión que no puede volver: usar `calcPrecioParaFlujo(…, gastos en 0)`
 * como si fuera este inverso. Esa función descuenta corretaje y recambio de
 * forma incondicional (arriendo/24 ≈ 4,17%), así que el dividendo al precio que
 * devuelve queda 4,17% BAJO el arriendo. El mockup de comunas afirmó durante
 * tres revisiones que ambas eran equivalentes porque se verificó una RÉPLICA de
 * la fórmula en vez de ejecutar la función real. Si alguien vuelve a cambiar
 * este helper por aquella, el barrido de acá cae en las 24 combinaciones.
 */

import assert from "node:assert/strict";
import { calcDividendo, calcPrecioParaCuota, calcPrecioParaFlujo } from "../src/lib/analysis";

// ── Runner mínimo ────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const fallidos: string[] = [];

function test(nombre: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

// ── La propiedad, barrida ────────────────────────────────────────────────────

const TASAS = [3.0, 3.5, 4.0, 4.11, 4.5, 5.2, 6.75];
const ARRIENDOS = [180_000, 280_000, 385_000, 650_000, 935_994, 1_620_000, 2_400_000];
const PIES = [10, 20, 25, 30, 40];
const PLAZOS = [15, 20, 25, 30];

seccion("Propiedad · el dividendo al precio devuelto reconstruye el arriendo");

let combinaciones = 0;
let peorDelta = 0;
let peorCaso = "";
for (const tasa of TASAS) {
  for (const arriendo of ARRIENDOS) {
    for (const pie of PIES) {
      for (const plazo of PLAZOS) {
        combinaciones++;
        const precio = calcPrecioParaCuota(arriendo, pie, tasa, plazo);
        const credito = precio * ((100 - pie) / 100);
        const delta = calcDividendo(credito, tasa, plazo) - arriendo;
        if (Math.abs(delta) > Math.abs(peorDelta)) {
          peorDelta = delta;
          peorCaso = `arriendo ${arriendo} · pie ${pie}% · tasa ${tasa}% · ${plazo}a`;
        }
      }
    }
  }
}

test(`${combinaciones} combinaciones · |delta| <= $1 (redondeo de calcDividendo)`, () => {
  assert.ok(
    Math.abs(peorDelta) <= 1,
    `peor delta $${peorDelta} en ${peorCaso} — el precio devuelto no reconstruye el arriendo`
  );
});
console.log(`       peor delta observado: $${peorDelta}${peorCaso ? ` (${peorCaso})` : ""}`);

// ── La regresión concreta: por qué no sirve calcPrecioParaFlujo ──────────────

seccion("Regresión · calcPrecioParaFlujo con gastos en 0 NO es este inverso");

test("su precio deja el dividendo ~4,17% bajo el arriendo", () => {
  const arriendo = 2_400_000;
  const precioFlujo = calcPrecioParaFlujo(0, arriendo, 0, 0, 0, 0, 20, 4.0, 30, 0, 0);
  const divFlujo = calcDividendo(precioFlujo * 0.8, 4.0, 30);
  // arriendo/24 = corretaje (arriendo×0,5/24) + recambio (arriendo×0,5/24)
  assert.equal(arriendo - divFlujo, Math.round(arriendo / 24));
});

test("y siempre pide MENOS precio que el inverso de la cuota", () => {
  for (const arriendo of ARRIENDOS) {
    const cuota = calcPrecioParaCuota(arriendo, 20, 4.0, 30);
    const flujo = calcPrecioParaFlujo(0, arriendo, 0, 0, 0, 0, 20, 4.0, 30, 0, 0);
    assert.ok(flujo < cuota, `arriendo ${arriendo}: ${flujo} no es menor que ${cuota}`);
  }
});

test("con gastos reales la brecha se abre todavía más", () => {
  const arriendo = 935_994;
  const cuota = calcPrecioParaCuota(arriendo, 20, 4.0, 30);
  const conGastos = calcPrecioParaFlujo(0, arriendo, 120_000, 600_000, 8.3, 0, 20, 4.0, 30, 0, 0.005);
  const sinGastos = calcPrecioParaFlujo(0, arriendo, 0, 0, 0, 0, 20, 4.0, 30, 0, 0);
  assert.ok(conGastos < sinGastos && sinGastos < cuota);
});

// ── Monotonía y bordes ───────────────────────────────────────────────────────

seccion("Monotonía · el precio se mueve en la dirección que corresponde");

test("más arriendo ⇒ más precio soportable", () => {
  const a = calcPrecioParaCuota(400_000, 20, 4.0, 30);
  const b = calcPrecioParaCuota(800_000, 20, 4.0, 30);
  assert.ok(b > a);
  // es lineal en el arriendo: el doble de arriendo, el doble de precio
  assert.ok(Math.abs(b / a - 2) < 1e-9);
});

test("más tasa ⇒ menos precio soportable", () => {
  const barata = calcPrecioParaCuota(650_000, 20, 3.0, 30);
  const cara = calcPrecioParaCuota(650_000, 20, 6.0, 30);
  assert.ok(cara < barata);
});

test("más pie ⇒ más precio soportable (el crédito es menor)", () => {
  const pie20 = calcPrecioParaCuota(650_000, 20, 4.0, 30);
  const pie40 = calcPrecioParaCuota(650_000, 40, 4.0, 30);
  assert.ok(pie40 > pie20);
});

test("más plazo ⇒ más precio soportable (la cuota se estira)", () => {
  const p15 = calcPrecioParaCuota(650_000, 20, 4.0, 15);
  const p30 = calcPrecioParaCuota(650_000, 20, 4.0, 30);
  assert.ok(p30 > p15);
});

seccion("Bordes · devuelve 0 donde la pregunta no tiene sentido");

test("arriendo 0 o negativo → 0", () => {
  assert.equal(calcPrecioParaCuota(0, 20, 4.0, 30), 0);
  assert.equal(calcPrecioParaCuota(-100, 20, 4.0, 30), 0);
});

test("plazo 0 → 0 (no divide por cero)", () => {
  assert.equal(calcPrecioParaCuota(650_000, 20, 4.0, 0), 0);
});

test("pie 100% → 0 (sin crédito no hay cuota que igualar)", () => {
  assert.equal(calcPrecioParaCuota(650_000, 100, 4.0, 30), 0);
  assert.equal(calcPrecioParaCuota(650_000, 120, 4.0, 30), 0);
});

test("tasa 0 → precio = arriendo × meses / financiamiento", () => {
  const precio = calcPrecioParaCuota(500_000, 20, 0, 30);
  assert.equal(precio, (500_000 * 360) / 0.8);
  // y la propiedad se sostiene también en esa rama
  assert.equal(calcDividendo(precio * 0.8, 0, 30), 500_000);
});

// ── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`  Fallidos: ${fallidos.join(", ")}`);
  process.exit(1);
}
