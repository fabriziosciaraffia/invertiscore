/**
 * Test del invariante del precio flujo-neutro (unificación del modelo de gastos):
 *
 *   descuentoParaNeutro <= 0  ⟺  flujoNetoMensual >= 0   (módulo redondeos)
 *
 * Antes de la unificación, `calcPrecioParaFlujo` omitía la mantención y el par
 * (flujo, neutro) podía ser contradictorio — la demo 6db7a9ac afirmaba flujo
 * −$94.855 y "neutro 2% SOBRE el precio" a la vez.
 *
 * Caso de regresión: input REAL de la demo 6db7a9ac (copia congelada del
 * 14-ago-2026; UF congelada 39.825 = precioCLP 127.440.000 / UF 3.200, misma
 * derivación que el render). Mismo patrón que scripts/test-plausibilidad.ts:
 *   npx tsx scripts/test-neutro-invariante.ts
 * Cero red, cero DB.
 */

import assert from "node:assert/strict";
import { recomputeResultsForLegacy } from "../src/lib/analysis/recompute-results-for-legacy";
import type { AnalisisInput } from "../src/lib/types";

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

// Input real de la demo (6db7a9ac), congelado. Mantención DECLARADA ($106.200):
// ejercita la rama del término fijo al numerador.
const DEMO_INPUT = {
  piso: 0, tipo: "Departamento", banos: 1, bodega: false, ciudad: "Santiago",
  comuna: "Providencia", gastos: 65000, nombre: "Demo congelada test", piePct: 20,
  precio: 3200, amoblado: false, arriendo: 750000, cuotasPie: 0, tipoRenta: "larga",
  antiguedad: 5, montoCuota: 0, superficie: 55, dormitorios: 2, estadoVenta: "inmediata",
  tarifaNoche: 0, tasaInteres: 4.72, ocupacionPct: 65, plazoCredito: 25,
  costoAmoblado: 0, costoLimpieza: 0, vacanciaMeses: 1, contribuciones: 180000,
  enConstruccion: false, estacionamiento: "no", superficieTotal: 55,
  serviciosBasicos: 0, comisionPlataforma: 3, provisionMantencion: 106200,
  precioEstacionamiento: 0,
} as unknown as AnalisisInput;

const UF_DEMO = 127_440_000 / 3200; // 39.825 — UF congelada del análisis real
const ASOF_DEMO = new Date("2026-03-08T03:01:57.167Z");

const recompute = (input: AnalisisInput) => {
  const r = recomputeResultsForLegacy(input, UF_DEMO, undefined, ASOF_DEMO);
  assert.ok(r?.metrics, "recompute sin metrics");
  return r!.metrics as { flujoNetoMensual: number; descuentoParaNeutro: number; precioFlujoNeutroUF: number };
};

// ── Regresión 6db7a9ac: flujo negativo ⇒ descuento POSITIVO ──────────────────
test("demo 6db7a9ac: flujo negativo y descuento positivo (invariante)", () => {
  const m = recompute(DEMO_INPUT);
  assert.ok(m.flujoNetoMensual < 0, `flujo esperado negativo, vino ${m.flujoNetoMensual}`);
  assert.ok(
    m.descuentoParaNeutro > 0,
    `con flujo ${m.flujoNetoMensual} el descuento debe ser > 0 (neutro BAJO el precio); vino ${m.descuentoParaNeutro}`,
  );
  assert.ok(
    m.precioFlujoNeutroUF < 3200,
    `el neutro debe quedar bajo el precio pedido (UF 3.200); vino UF ${m.precioFlujoNeutroUF}`,
  );
});

test("demo 6db7a9ac: el modelo viejo (neutro UF 3.262, sobre el precio) quedó atrás", () => {
  const m = recompute(DEMO_INPUT);
  assert.ok(
    Math.abs(m.precioFlujoNeutroUF - 3262.65) > 50,
    `el neutro sigue en el valor del modelo sin mantención (UF ${m.precioFlujoNeutroUF})`,
  );
});

// ── Dirección contraria: flujo positivo ⇒ descuento ≤ 0 ──────────────────────
// Mismo input con arriendo alto: el flujo cruza a positivo y el neutro debe
// quedar EN o SOBRE el precio (descuento ≤ 0).
test("flujo positivo ⇒ descuento <= 0 (neutro en o sobre el precio)", () => {
  const m = recompute({ ...DEMO_INPUT, arriendo: 1_100_000 } as AnalisisInput);
  assert.ok(m.flujoNetoMensual > 0, `flujo esperado positivo, vino ${m.flujoNetoMensual}`);
  assert.ok(
    m.descuentoParaNeutro <= 0,
    `con flujo ${m.flujoNetoMensual} el descuento debe ser <= 0; vino ${m.descuentoParaNeutro}`,
  );
});

// ── Rama de mantención DERIVADA (sin declarar): término lineal al denominador ─
test("mantención derivada: el invariante se sostiene igual", () => {
  const sinMant = { ...DEMO_INPUT, provisionMantencion: 0 } as AnalisisInput;
  const m = recompute(sinMant);
  const coherente = m.flujoNetoMensual >= 0 ? m.descuentoParaNeutro <= 0 : m.descuentoParaNeutro > 0;
  assert.ok(
    coherente,
    `flujo ${m.flujoNetoMensual} y descuento ${m.descuentoParaNeutro} incoherentes con mantención derivada`,
  );
});

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} OK · ${fail} FAIL${fail > 0 ? ` → ${fallidos.join(", ")}` : ""}`);
if (fail > 0) process.exit(1);
