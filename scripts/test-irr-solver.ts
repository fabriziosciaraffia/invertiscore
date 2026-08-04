/**
 * Tests del solver de TIR (`src/lib/finance/irr.ts`).
 *
 * El repo no tiene framework de testing instalado. Este script usa
 * `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-numero-cl.ts` y `scripts/test-plausibilidad.ts`.
 *
 *   npx tsx scripts/test-irr-solver.ts
 *
 * Cero red, cero DB: el módulo bajo test es puro. El sweep de regresión sobre un
 * análisis real vive aparte en `scripts/test-irr-sweep.ts` (ese sí toca la base).
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO: `calcIRR` no puede devolver un número que
 * no sea raíz del VPN. El solver anterior (Newton-Raphson con clamp del iterando)
 * devolvía exactamente 1.0 — renderizado "100%" — cada vez que la iteración se
 * disparaba. El caso `TIR real ≈ −14% que antes daba 100` es la regresión que no
 * puede volver: si alguien reintroduce un clamp, ese test cae.
 */

import assert from "node:assert/strict";
import { calcIRR, calcIRRPct } from "../src/lib/finance/irr";

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

/** VPN independiente del solver — verifica que la tasa devuelta ES una raíz. */
function npv(flujos: number[], r: number): number {
  return flujos.reduce((s, f, i) => s + f / Math.pow(1 + r, i), 0);
}

/** Desempaqueta un ok:true o falla el test con el motivo. */
function rate(flujos: number[]): number {
  const r = calcIRR(flujos);
  assert.equal(r.ok, true, `esperaba ok:true, vino ${JSON.stringify(r)}`);
  return (r as { ok: true; rate: number }).rate;
}

// ── a. Valores conocidos ─────────────────────────────────────────────────────

seccion("a. TIR contra valores conocidos");

test("[-1000, 500, 500, 500] → ~23,4%", () => {
  const r = rate([-1000, 500, 500, 500]);
  assert.ok(Math.abs(r * 100 - 23.4) < 0.1, `dio ${(r * 100).toFixed(3)}%`);
});

test("[-100, 110] → 10,0% exacto", () => {
  const r = rate([-100, 110]);
  assert.ok(Math.abs(r - 0.1) < 1e-6, `dio ${r}`);
});

test("[-1000, 1100] con un solo período → 10% (caso mínimo, length 2)", () => {
  assert.ok(Math.abs(rate([-1000, 1100]) - 0.1) < 1e-6);
});

test("TIR nula: [-1000, 0, 0, 1000] → 0%", () => {
  const r = rate([-1000, 0, 0, 1000]);
  assert.ok(Math.abs(r) < 1e-6, `dio ${r}`);
});

test("la tasa devuelta ES raíz del VPN (|VPN| despreciable vs la escala)", () => {
  const flujos = [-19_115_460, 0, 0, 0, -5_012_547, -6_458_578, 341_471_961];
  const r = rate(flujos);
  const escala = Math.max(...flujos.map(Math.abs));
  assert.ok(Math.abs(npv(flujos, r)) / escala < 1e-6, `VPN residual ${npv(flujos, r)}`);
});

// ── b. Estados sin TIR ───────────────────────────────────────────────────────

seccion("b. Estados sin TIR (no devuelve número de consuelo)");

test("todos negativos → ok:false", () => {
  const r = calcIRR([-100, -50, -50]);
  assert.equal(r.ok, false);
});

test("todos positivos → ok:false", () => {
  assert.equal(calcIRR([100, 50, 50]).ok, false);
});

test("vector con NaN → flujos-invalidos", () => {
  assert.deepEqual(calcIRR([-1000, NaN, 500]), { ok: false, reason: "flujos-invalidos" });
});

test("vector con Infinity → flujos-invalidos", () => {
  assert.deepEqual(calcIRR([-1000, Infinity]), { ok: false, reason: "flujos-invalidos" });
});

test("vector de un solo flujo → flujos-invalidos", () => {
  assert.deepEqual(calcIRR([-1000]), { ok: false, reason: "flujos-invalidos" });
});

test("vector vacío → flujos-invalidos", () => {
  assert.deepEqual(calcIRR([]), { ok: false, reason: "flujos-invalidos" });
});

test("TIR sobre 1000% (fuera del rango de bracketing) → sin-bracket, NO un número", () => {
  // [-1, 20000] tiene TIR de 1.999.900%. Está fuera del rango, y el contrato es
  // decirlo, no clampear al extremo del rango.
  const r = calcIRR([-1, 20_000]);
  assert.deepEqual(r, { ok: false, reason: "sin-bracket" });
});

// ── c. La regresión del "100%" ───────────────────────────────────────────────

seccion("c. Regresión: el 100% fantasma del solver viejo");

/**
 * Réplica EXACTA del solver retirado (analysis.ts:95 / short-term-engine.ts:782).
 * Vive acá y solo acá, como testigo: sirve para demostrar que el caso que hoy
 * pasa ANTES fallaba. No se importa de ningún lado — el original está borrado.
 */
function solverViejo(flujos: number[], guess = 0.1): number {
  let rateIter = guess;
  for (let iter = 0; iter < 100; iter++) {
    let vpn = 0;
    let dvpn = 0;
    for (let i = 0; i < flujos.length; i++) {
      vpn += flujos[i] / Math.pow(1 + rateIter, i);
      dvpn -= (i * flujos[i]) / Math.pow(1 + rateIter, i + 1);
    }
    if (Math.abs(vpn) < 1) break;
    if (dvpn === 0) break;
    rateIter -= vpn / dvpn;
    if (rateIter < -0.99) rateIter = -0.5;
    if (rateIter > 10) rateIter = 1; // ← el clamp que salía como "100%"
  }
  return rateIter;
}

/**
 * Fixture CONGELADO: el vector real que produce `calcExitScenario` para el
 * análisis ab0b2d3a (Zenteno 183) a 30 años con plusvalía 0% — pre-entrega de
 * 3 años sin flujo operativo, aportes mensuales negativos crecientes, y la venta
 * entrando en el último período. Extraído del motor, no reconstruido a mano.
 *
 * TIR real: −7,8448%. El solver viejo devolvía exactamente 1.0 → "100%" en verde.
 */
const FLUJO_REGRESION = [
  -19_115_460, 0, 0, 0,
  -5_012_547, -5_612_333, -5_760_078, -6_291_933, -6_458_578, -6_629_436,
  -7_428_190, -7_626_521, -7_829_928, -8_038_600, -8_252_562, -8_953_918,
  -9_193_415, -9_439_087, -9_691_057, -9_949_531, -11_052_595, -11_349_596,
  -11_654_299, -11_966_882, -12_287_559, -13_264_135, -13_620_974, -13_987_100,
  -14_362_750, -14_748_099, 118_662_602,
];

test("el solver VIEJO devuelve exactamente 1.0 (el bug, documentado)", () => {
  assert.equal(solverViejo(FLUJO_REGRESION), 1, "el testigo del bug ya no reproduce");
});

test("calcIRR devuelve la TIR real negativa, no 100%", () => {
  const r = rate(FLUJO_REGRESION);
  assert.ok(r < 0, `esperaba TIR negativa, dio ${(r * 100).toFixed(2)}%`);
  assert.ok(Math.abs(r * 100 + 7.8448) < 0.01, `esperaba −7,8448%, dio ${(r * 100).toFixed(4)}%`);
});

test("ninguna TIR convergida puede ser exactamente 100 (el valor del clamp)", () => {
  const r = calcIRRPct(FLUJO_REGRESION);
  assert.equal(r.ok, true);
  assert.notEqual((r as { ok: true; rate: number }).rate, 100);
});

test("el vector de regresión sí tiene raíz — el bug no era 'flujo sin TIR'", () => {
  const flujos = FLUJO_REGRESION;
  assert.ok(npv(flujos, -0.5) * npv(flujos, 0.5) < 0, "debería haber cambio de signo");
});

// ── d. calcIRRPct: el redondeo vive en un solo lugar ─────────────────────────

seccion("d. calcIRRPct (porcentaje, 2 decimales)");

test("[-100, 110] → 10 (porcentaje, no decimal)", () => {
  const r = calcIRRPct([-100, 110]);
  assert.deepEqual(r, { ok: true, rate: 10 });
});

test("propaga el ok:false sin convertirlo en número", () => {
  assert.deepEqual(calcIRRPct([-100, -100]), { ok: false, reason: "flujos-invalidos" });
});

// ── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`  Fallidos: ${fallidos.join(", ")}`);
  process.exit(1);
}
