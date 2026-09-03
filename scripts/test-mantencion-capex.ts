/**
 * Tests de PROPIEDAD del modelo de costos v3 (`src/lib/modelo-costos.ts`,
 * `src/lib/capex-puesta-a-punto.ts`) y de su gate por versión.
 *
 * El repo no tiene framework de testing instalado. Este script usa
 * `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-precio-para-cuota.ts`.
 *
 *   npx tsx scripts/test-mantencion-capex.ts
 *   (en un worktree sin node_modules: NODE_PATH=<repo>/node_modules node
 *    --import file:///<repo>/node_modules/tsx/dist/loader.mjs scripts/test-mantencion-capex.ts)
 *
 * Cero red, cero DB: las funciones bajo test son puras.
 *
 * CONTRATOS QUE DEFIENDE ESTE ARCHIVO — propiedades sobre el dominio entero
 * (antigüedad 0..30 × superficies × arriendos), no casos sueltos. La lección
 * detrás: una verificación que replica la fórmula en vez de ejecutarla se
 * confirma a sí misma.
 *
 *   P1  mantención v3 es INVARIANTE al precio: m(precio×2) === m(precio).
 *   P2  mantención v3 ≤ 6% del arriendo del depto, siempre; sin piso (arriendo 0 ⇒ 0).
 *   P3  mantención legacy reproduce byte-idéntico round(precio × tasa / 12).
 *   P4  CapEx v3: montoUF ∈ [montoMinUF, montoMaxUF] y montoUF === round1(punto × m²),
 *       con punto === medio del rango. Legacy y override colapsan min = max = punto.
 *   P5  antiguedadEfectiva(20, 0, true) cae en el tramo 0-2; (20, 0, false) en 16-25.
 *   P6  La inversión inicial del motor usa el PUNTO, nunca min ni max.
 *   P7  Gate: sin methodologyVersion (o v1/v2) el motor corre legacy; con v3, la tabla nueva.
 *   P8  Reset post-CapEx en la proyección: con CapEx el año 1 arranca en tramo 0-2.
 */

import assert from "node:assert/strict";
import {
  calcMantencionMensual,
  antiguedadEfectiva,
  getMantencionUfM2Anio,
  getMantencionRateLegacy,
  resolverModeloCostos,
  MANTENCION_TECHO_ARRIENDO_PCT,
  MANTENCION_UF_M2_ANIO,
} from "../src/lib/modelo-costos";
import {
  calcCapexPuestaAPunto,
  getPuestaAPuntoRango,
  getPuestaAPuntoUfM2Legacy,
  PUESTA_A_PUNTO_UF_M2,
} from "../src/lib/capex-puesta-a-punto";
import { calcInversionInicialCLP } from "../src/lib/inversion-inicial";
import { runAnalysis } from "../src/lib/analysis";
import { ltr } from "./eval/fixtures";

// ── Runner mínimo ────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const fallidos: string[] = [];

function test(nombre: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (e) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}\n       ${(e as Error).message.split("\n")[0]}`);
  }
}

const UF = 38800;
const ANTIGUEDADES = Array.from({ length: 31 }, (_, i) => i); // 0..30 (26+ defensivo)
const SUPERFICIES = [25, 38, 50, 60, 90, 140];
const ARRIENDOS = [0, 150_000, 300_000, 450_000, 700_000, 1_200_000, 5_000_000];
const PRECIOS_CLP = [60_000_000, 120_000_000, 250_000_000];
const round1 = (v: number) => Math.round(v * 10) / 10;

// ── P1 · invariante al precio ────────────────────────────────────────────────

test("P1 · mantención v3: m(precio×2) === m(precio) en todo tramo × superficie × arriendo", () => {
  let n = 0;
  for (const antiguedad of ANTIGUEDADES) for (const sup of SUPERFICIES) for (const arr of ARRIENDOS) for (const precio of PRECIOS_CLP) {
    const base = { modelo: "v3" as const, antiguedad, superficieUtilM2: sup, arriendoCLP: arr, ufClp: UF };
    const a = calcMantencionMensual({ ...base, precioCLP: precio });
    const b = calcMantencionMensual({ ...base, precioCLP: precio * 2 });
    assert.equal(a, b, `antig=${antiguedad} sup=${sup} arr=${arr} precio=${precio}: ${a} vs ${b}`);
    n++;
  }
  assert.ok(n > 3000, `barrido demasiado chico: ${n}`);
});

test("P1b · legacy SÍ escala con el precio (la propiedad distingue los modelos)", () => {
  // Precios que dividen exacto (0,8% / 12 de 120M = 80.000) para no medir redondeo.
  const base = { modelo: "legacy" as const, antiguedad: 10, superficieUtilM2: 50, arriendoCLP: 600_000, ufClp: UF };
  assert.equal(
    calcMantencionMensual({ ...base, precioCLP: 240_000_000 }),
    2 * calcMantencionMensual({ ...base, precioCLP: 120_000_000 }),
  );
});

// ── P2 · techo 6% del arriendo, sin piso ─────────────────────────────────────

test("P2 · mantención v3 ≤ 0,06 × arriendo siempre (incluye arriendo 0 ⇒ 0)", () => {
  for (const antiguedad of ANTIGUEDADES) for (const sup of SUPERFICIES) for (const arr of ARRIENDOS) {
    const m = calcMantencionMensual({ modelo: "v3", antiguedad, superficieUtilM2: sup, precioCLP: 1, arriendoCLP: arr, ufClp: UF });
    assert.ok(m <= Math.round(arr * MANTENCION_TECHO_ARRIENDO_PCT), `antig=${antiguedad} sup=${sup} arr=${arr}: ${m}`);
    assert.ok(m >= 0);
    if (arr === 0) assert.equal(m, 0, "sin piso: arriendo 0 ⇒ mantención 0");
  }
});

test("P2b · el techo también rige con factor de inflación (proyección)", () => {
  for (const anio of [1, 5, 10, 20]) {
    const factor = Math.pow(1.03, anio - 1);
    const arr = 300_000 * Math.pow(1.035, anio - 1);
    const m = calcMantencionMensual({ modelo: "v3", antiguedad: 25, superficieUtilM2: 140, precioCLP: 1, arriendoCLP: arr, ufClp: UF, factorInflacion: factor });
    assert.ok(m <= Math.round(arr * MANTENCION_TECHO_ARRIENDO_PCT), `año ${anio}: ${m}`);
  }
});

test("P2c · cuando el techo no muerde, v3 = round(ufM2 × m² × UF / 12)", () => {
  for (const antiguedad of ANTIGUEDADES) for (const sup of SUPERFICIES) {
    const esperado = Math.round((getMantencionUfM2Anio(antiguedad) * sup * UF) / 12);
    const m = calcMantencionMensual({ modelo: "v3", antiguedad, superficieUtilM2: sup, precioCLP: 1, arriendoCLP: 50_000_000, ufClp: UF });
    assert.equal(m, esperado, `antig=${antiguedad} sup=${sup}`);
  }
});

test("P2d · tramos de mantención: 0-2 · 3-7 · 8-15 · 16-25 · 26+", () => {
  const t = (a: number) => getMantencionUfM2Anio(a);
  assert.equal(t(0), 0.02); assert.equal(t(2), 0.02);
  assert.equal(t(3), 0.05); assert.equal(t(7), 0.05);
  assert.equal(t(8), 0.09); assert.equal(t(15), 0.09);
  assert.equal(t(16), 0.14); assert.equal(t(25), 0.14);
  assert.equal(t(26), 0.18); assert.equal(t(60), 0.18);
  assert.equal(MANTENCION_UF_M2_ANIO.length, 5);
});

// ── P3 · legacy byte-idéntico ────────────────────────────────────────────────

test("P3 · legacy === round(precio × tasa(antig) / 12), y con inflación round(base × factor)", () => {
  for (const antiguedad of ANTIGUEDADES) for (const precio of PRECIOS_CLP) {
    const base = Math.round((precio * getMantencionRateLegacy(antiguedad)) / 12);
    assert.equal(calcMantencionMensual({ modelo: "legacy", antiguedad, superficieUtilM2: 50, precioCLP: precio, arriendoCLP: 0, ufClp: UF }), base);
    const factor = Math.pow(1.03, 7);
    assert.equal(
      calcMantencionMensual({ modelo: "legacy", antiguedad, superficieUtilM2: 50, precioCLP: precio, arriendoCLP: 0, ufClp: UF, factorInflacion: factor }),
      Math.round(base * factor),
    );
  }
});

// ── P4 · CapEx: rango y punto ────────────────────────────────────────────────

test("P4 · CapEx v3: montoUF ∈ [min, max], montoUF === round1(punto × m²), punto === medio", () => {
  for (const antiguedad of ANTIGUEDADES) for (const sup of SUPERFICIES) {
    const r = getPuestaAPuntoRango(antiguedad, "v3");
    assert.equal(r.punto, Math.round(((r.min + r.max) / 2) * 100) / 100, `punto medio antig=${antiguedad}`);
    const c = calcCapexPuestaAPunto({ antiguedad, superficieUtilM2: sup, valorUF: UF, modelo: "v3" });
    assert.ok(c.montoUF >= c.montoMinUF && c.montoUF <= c.montoMaxUF, `antig=${antiguedad} sup=${sup}: ${c.montoMinUF} ≤ ${c.montoUF} ≤ ${c.montoMaxUF}`);
    assert.ok(c.montoCLP >= c.montoMinCLP && c.montoCLP <= c.montoMaxCLP);
    assert.equal(c.montoUF, round1(r.punto * sup));
    assert.equal(c.montoMinUF, round1(r.min * sup));
    assert.equal(c.montoMaxUF, round1(r.max * sup));
    assert.equal(c.montoCLP, Math.round(r.punto * sup * UF));
    assert.equal(c.ufM2, r.punto);
    assert.equal(c.origen, "derivado");
    if (antiguedad <= 2) assert.equal(c.montoCLP, 0, "nuevo/casi nuevo ⇒ sin CapEx");
  }
  assert.equal(PUESTA_A_PUNTO_UF_M2.length, 5);
});

test("P4b · tramos CapEx v3: [0,0] · [0.2,0.4] · [0.5,0.9] · [1.0,1.6] · [1.8,2.6]", () => {
  const r = (a: number) => getPuestaAPuntoRango(a, "v3");
  assert.deepEqual([r(0).min, r(0).max], [0, 0]); assert.deepEqual([r(2).min, r(2).max], [0, 0]);
  assert.deepEqual([r(3).min, r(3).max, r(3).punto], [0.2, 0.4, 0.3]); assert.deepEqual([r(7).min, r(7).max], [0.2, 0.4]);
  assert.deepEqual([r(8).min, r(8).max, r(8).punto], [0.5, 0.9, 0.7]); assert.deepEqual([r(15).min, r(15).max], [0.5, 0.9]);
  assert.deepEqual([r(16).min, r(16).max, r(16).punto], [1.0, 1.6, 1.3]); assert.deepEqual([r(25).min, r(25).max], [1.0, 1.6]);
  assert.deepEqual([r(26).min, r(26).max, r(26).punto], [1.8, 2.6, 2.2]);
});

test("P4c · CapEx legacy: min = max = punto = curva vieja (1.5 · 3.5 · 6.0 · 9.0)", () => {
  for (const antiguedad of ANTIGUEDADES) for (const sup of SUPERFICIES) {
    const v = getPuestaAPuntoUfM2Legacy(antiguedad);
    const c = calcCapexPuestaAPunto({ antiguedad, superficieUtilM2: sup, valorUF: UF, modelo: "legacy" });
    assert.equal(c.ufM2, v);
    assert.equal(c.montoMinUF, c.montoUF);
    assert.equal(c.montoMaxUF, c.montoUF);
    assert.equal(c.montoUF, round1(v * sup));
    assert.equal(c.montoCLP, Math.round(v * sup * UF));
  }
  assert.equal(getPuestaAPuntoUfM2Legacy(4), 1.5);
  assert.equal(getPuestaAPuntoUfM2Legacy(20), 6.0);
});

test("P4d · override: min = max = monto, origen 'override', en ambos modelos", () => {
  for (const modelo of ["legacy", "v3"] as const) {
    const c = calcCapexPuestaAPunto({ antiguedad: 20, superficieUtilM2: 60, valorUF: UF, overrideCLP: 2_500_000, modelo });
    assert.equal(c.origen, "override");
    assert.equal(c.montoCLP, 2_500_000);
    assert.equal(c.montoMinCLP, c.montoCLP); assert.equal(c.montoMaxCLP, c.montoCLP);
    assert.equal(c.montoMinUF, c.montoUF); assert.equal(c.montoMaxUF, c.montoUF);
  }
});

// ── P5 · antigüedad efectiva ─────────────────────────────────────────────────

test("P5 · antiguedadEfectiva(20, 0, true) → tramo 0-2; (20, 0, false) → tramo 16-25", () => {
  const conCapex = antiguedadEfectiva(20, 0, true);
  const sinCapex = antiguedadEfectiva(20, 0, false);
  assert.equal(conCapex, 0);
  assert.equal(sinCapex, 20);
  assert.equal(getMantencionUfM2Anio(conCapex), 0.02, "tramo 0-2");
  assert.equal(getMantencionUfM2Anio(sinCapex), 0.14, "tramo 16-25");
});

test("P5b · envejece desde el reset: t=2 → 0-2, t=3 → 3-7, t=8 → 8-15; sin CapEx suma a la real", () => {
  assert.equal(getMantencionUfM2Anio(antiguedadEfectiva(20, 2, true)), 0.02);
  assert.equal(getMantencionUfM2Anio(antiguedadEfectiva(20, 3, true)), 0.05);
  assert.equal(getMantencionUfM2Anio(antiguedadEfectiva(20, 8, true)), 0.09);
  for (let t = 0; t <= 20; t++) assert.equal(antiguedadEfectiva(7, t, false), 7 + t);
  assert.equal(antiguedadEfectiva(7, -3, false), 7, "t negativo se clampa a 0");
});

// ── P6 · inversión inicial usa el PUNTO ──────────────────────────────────────

const inputV3 = {
  ...ltr({ antiguedad: 20, superficie: 60, precio: 4000, arriendo: 700_000, piePct: 20, incluyeCorretajeInicial: true }),
  methodologyVersion: "v3",
};

test("P6 · runAnalysis(v3): capexPuestaAPuntoCLP === punto e inversionInicial suma el punto, no min/max", () => {
  const r = runAnalysis(inputV3, UF, undefined, new Date("2026-09-01"));
  const capex = calcCapexPuestaAPunto({ antiguedad: 20, superficieUtilM2: 60, valorUF: UF, modelo: "v3" });
  assert.ok(capex.montoMinCLP < capex.montoCLP && capex.montoCLP < capex.montoMaxCLP, "el rango 16-25 no es degenerado");
  assert.equal(r.metrics.capexPuestaAPuntoCLP, capex.montoCLP);
  const precioCLP = 4000 * UF;
  const pieCLP = precioCLP * 0.2;
  const cierre = Math.round(precioCLP * 0.02);
  const corretaje = r.metrics.corretajeInicialCLP ?? 0;
  const conPunto = calcInversionInicialCLP({ pieCLP, gastosCierreCLP: cierre, capexPuestaAPuntoCLP: capex.montoCLP, corretajeInicialCLP: corretaje });
  const conMin = calcInversionInicialCLP({ pieCLP, gastosCierreCLP: cierre, capexPuestaAPuntoCLP: capex.montoMinCLP, corretajeInicialCLP: corretaje });
  const conMax = calcInversionInicialCLP({ pieCLP, gastosCierreCLP: cierre, capexPuestaAPuntoCLP: capex.montoMaxCLP, corretajeInicialCLP: corretaje });
  assert.equal(r.exitScenario.inversionInicial, conPunto);
  assert.notEqual(r.exitScenario.inversionInicial, conMin);
  assert.notEqual(r.exitScenario.inversionInicial, conMax);
  // El hallazgo cita el mismo punto.
  assert.equal(r.metrics.hallazgoPuestaAPunto?.valor.montoCLP, capex.montoCLP);
});

// ── P7 · gate por versión ────────────────────────────────────────────────────

test("P7 · resolverModeloCostos: ausente/v1/v2 ⇒ legacy · v3/v4 ⇒ v3", () => {
  for (const v of [undefined, null, "", "v1", "v2", "V2", "basura"]) assert.equal(resolverModeloCostos(v), "legacy", String(v));
  for (const v of ["v3", "V3", "v4", "v10"]) assert.equal(resolverModeloCostos(v), "v3", v);
});

test("P7b · runAnalysis sin methodologyVersion corre LEGACY (provisión % del precio, CapEx 6,0 UF/m²)", () => {
  const { methodologyVersion: _omit, ...inputLegacy } = inputV3;
  void _omit;
  const r = runAnalysis(inputLegacy, UF, undefined, new Date("2026-09-01"));
  const precioCLP = 4000 * UF;
  assert.equal(r.metrics.provisionMantencionAjustada, Math.round((precioCLP * getMantencionRateLegacy(20)) / 12));
  assert.equal(r.metrics.capexPuestaAPuntoCLP, Math.round(6.0 * 60 * UF));
  const r2 = runAnalysis({ ...inputLegacy, methodologyVersion: "v2" }, UF, undefined, new Date("2026-09-01"));
  assert.equal(r2.metrics.capexPuestaAPuntoCLP, r.metrics.capexPuestaAPuntoCLP);
  assert.equal(r2.score, r.score);
});

test("P7c · runAnalysis con v3: provisión = fuente única v3 (techo 6% incluido) y CapEx 1,3 UF/m²", () => {
  const r = runAnalysis(inputV3, UF, undefined, new Date("2026-09-01"));
  const esperado = calcMantencionMensual({ modelo: "v3", antiguedad: 20, superficieUtilM2: 60, precioCLP: 4000 * UF, arriendoCLP: 700_000, ufClp: UF });
  assert.equal(r.metrics.provisionMantencionAjustada, esperado);
  assert.ok(esperado <= Math.round(700_000 * 0.06));
  assert.equal(r.metrics.capexPuestaAPuntoCLP, Math.round(1.3 * 60 * UF));
});

test("P7d · v3 respeta la provisión declarada (> 0) igual que hoy", () => {
  const r = runAnalysis({ ...inputV3, provisionMantencion: 123_456 }, UF, undefined, new Date("2026-09-01"));
  assert.equal(r.metrics.provisionMantencionAjustada, 123_456);
});

// ── P8 · reset post-CapEx en la proyección ───────────────────────────────────

test("P8 · proyección v3 con CapEx: la mantención del año 1 es la del tramo 0-2, no la de 20 años", () => {
  const r = runAnalysis(inputV3, UF, undefined, new Date("2026-09-01"));
  const p1 = r.projections[0];
  // gastosOperativosAnual = (ggccVacancia + contribucionesMes + mantencion) × 12; despejo la mantención
  // restando los otros dos términos, que son los del año 1 de metrics (sin reajuste).
  assert.ok(p1.gastosOperativosAnual != null, "el motor emite el desglose anual");
  const mantencionResetada = calcMantencionMensual({ modelo: "v3", antiguedad: 0, superficieUtilM2: 60, precioCLP: 4000 * UF, arriendoCLP: 700_000, ufClp: UF });
  const mantencionSinReset = calcMantencionMensual({ modelo: "v3", antiguedad: 20, superficieUtilM2: 60, precioCLP: 4000 * UF, arriendoCLP: 700_000, ufClp: UF });
  assert.ok(mantencionResetada < mantencionSinReset, "el reset tiene que bajar la mantención");
  // Comparo contra un análisis idéntico sin CapEx posible (antigüedad 0): misma mantención año 1.
  const sinCapex = runAnalysis({ ...inputV3, antiguedad: 0 }, UF, undefined, new Date("2026-09-01"));
  const opSin = sinCapex.projections[0].gastosOperativosAnual!;
  const opCon = p1.gastosOperativosAnual!;
  // Las contribuciones estimadas distinguen nuevo (≤2) de usado, así que aíslo la mantención
  // restando (ggcc vacancia + contribuciones) × 12 de cada uno con sus propias metrics.
  const restoCon = (r.metrics.contribuciones / 3 + Math.round(r.metrics.gastos * (inputV3.vacanciaMeses / 12))) * 12;
  const restoSin = (sinCapex.metrics.contribuciones / 3 + Math.round(sinCapex.metrics.gastos * (inputV3.vacanciaMeses / 12))) * 12;
  const mantCon = Math.round((opCon - restoCon) / 12);
  const mantSin = Math.round((opSin - restoSin) / 12);
  assert.ok(Math.abs(mantCon - mantSin) <= 1, `año 1 con CapEx (${mantCon}) debe igualar la de antigüedad 0 (${mantSin})`);
  assert.ok(Math.abs(mantCon - mantencionResetada) <= 1, `año 1 = tramo 0-2 (${mantencionResetada}), obtuve ${mantCon}`);
});

test("P8b · proyección LEGACY no resetea: año 1 usa antigüedad + 1 (convención histórica)", () => {
  const { methodologyVersion: _omit, ...inputLegacy } = inputV3;
  void _omit;
  const r = runAnalysis(inputLegacy, UF, undefined, new Date("2026-09-01"));
  const p1 = r.projections[0];
  const precioCLP = 4000 * UF;
  const resto = (r.metrics.contribuciones / 3 + Math.round(r.metrics.gastos * (inputV3.vacanciaMeses / 12))) * 12;
  const mant1 = Math.round((p1.gastosOperativosAnual! - resto) / 12);
  assert.ok(Math.abs(mant1 - Math.round((precioCLP * getMantencionRateLegacy(21)) / 12)) <= 1, `legacy año 1: ${mant1}`);
});

// ── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Fallidos:\n  - " + fallidos.join("\n  - "));
  process.exit(1);
}
