/**
 * Tests del plan y checkpoint del backfill (`src/lib/services/scraper/backfill-plan.ts`).
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-backfill-plan.ts
 *
 * Cero red, cero DB: la lógica es pura.
 *
 * CONTRATO QUE DEFIENDEN: reanudar conserva el id del pase. Si un corte a mitad
 * de camino arrancara un pase nuevo, las filas ya escritas quedarían con el id
 * viejo y la desactivación de Fase C las mataría. Y un pase solo cuenta como
 * completo con las DOS operaciones terminadas y cero errores.
 */

import assert from "node:assert/strict";
import {
  nuevoPaseId,
  parsearOperacion,
  parsearCheckpoint,
  planificar,
  paseCompleto,
  estadoVacio,
  type CheckpointBackfill,
} from "../src/lib/services/scraper/backfill-plan";

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

const AHORA = new Date("2026-09-03T12:00:00.000Z");

function cpAMedias(): CheckpointBackfill {
  return {
    pase: "p20260903T110000Z-ab12",
    iniciadoEn: "2026-09-03T11:00:00.000Z",
    actualizadoEn: "2026-09-03T11:02:00.000Z",
    operaciones: {
      venta: { total: 26095, ultimaPagina: 17, filas: 10200, nuevas: 6000, completa: false, terminadoEn: null },
    },
    errores: [],
  };
}

console.log("\nbackfill-plan\n");

test("parsearOperacion: ausente y 'ambas' → las dos; venta/arriendo → una; otra cosa → null", () => {
  assert.deepEqual(parsearOperacion(null), ["venta", "arriendo"]);
  assert.deepEqual(parsearOperacion("ambas"), ["venta", "arriendo"]);
  assert.deepEqual(parsearOperacion("venta"), ["venta"]);
  assert.deepEqual(parsearOperacion("arriendo"), ["arriendo"]);
  assert.equal(parsearOperacion("todo"), null);
});

test("nuevoPaseId: fecha compacta + sufijo, distinto entre llamadas", () => {
  const a = nuevoPaseId(AHORA, "ab12");
  assert.equal(a, "p20260903T120000Z-ab12");
  assert.notEqual(nuevoPaseId(AHORA), nuevoPaseId(AHORA));
});

test("pase nuevo: id nuevo, ambas desde la página 1, checkpoint limpio con activasAlInicio", () => {
  const plan = planificar({ operaciones: ["venta", "arriendo"], desde: null, reanudar: false, checkpoint: null, ahora: AHORA, paseId: "pX", activasAlInicio: 52674 });
  assert.ok(!("error" in plan));
  assert.equal(plan.pase, "pX");
  assert.deepEqual(plan.tramos, [
    { operacion: "venta", desdePagina: 1 },
    { operacion: "arriendo", desdePagina: 1 },
  ]);
  assert.deepEqual(plan.checkpoint.operaciones.venta, estadoVacio());
  assert.equal(plan.checkpoint.errores.length, 0);
  assert.equal(plan.checkpoint.activasAlInicio, 52674, "el denominador de la salvaguarda se fija al inicio del pase");
  assert.equal(plan.checkpoint.desactivacion, null);
  assert.equal(plan.checkpoint.desactivacionOmitida, null);
});

test("pase nuevo sin medición: activasAlInicio queda null (no se inventa)", () => {
  const plan = planificar({ operaciones: ["venta"], desde: null, reanudar: false, checkpoint: null, ahora: AHORA, paseId: "pX" });
  assert.ok(!("error" in plan));
  assert.equal(plan.checkpoint.activasAlInicio, null);
});

test("pase nuevo sobre uno incompleto: lo abandona y lo dice", () => {
  const plan = planificar({ operaciones: ["venta"], desde: null, reanudar: false, checkpoint: cpAMedias(), ahora: AHORA, paseId: "pY" });
  assert.ok(!("error" in plan));
  assert.equal(plan.pase, "pY");
  assert.match(plan.motivo, /quedó incompleto y se abandona/);
});

test("desde= y reanudar=1 conservan activasAlInicio del checkpoint aunque se pase una medición nueva", () => {
  const cp = { ...cpAMedias(), activasAlInicio: 52674 };
  const a = planificar({ operaciones: ["venta"], desde: 18, reanudar: false, checkpoint: cp, ahora: AHORA, activasAlInicio: 74482 });
  assert.ok(!("error" in a));
  assert.equal(a.checkpoint.activasAlInicio, 52674);
  const b = planificar({ operaciones: ["venta"], desde: null, reanudar: true, checkpoint: cp, ahora: AHORA, activasAlInicio: 74482 });
  assert.ok(!("error" in b));
  assert.equal(b.checkpoint.activasAlInicio, 52674);
});

test("desde=: conserva el id del pase y arranca en esa página", () => {
  const plan = planificar({ operaciones: ["venta"], desde: 18, reanudar: false, checkpoint: cpAMedias(), ahora: AHORA });
  assert.ok(!("error" in plan));
  assert.equal(plan.pase, "p20260903T110000Z-ab12", "reanudar NO cambia el pase");
  assert.deepEqual(plan.tramos, [{ operacion: "venta", desdePagina: 18 }]);
  assert.equal(plan.checkpoint.operaciones.venta?.ultimaPagina, 17);
  assert.equal(plan.checkpoint.operaciones.venta?.completa, false);
  assert.equal(plan.checkpoint.operaciones.venta?.filas, 10200, "los acumulados del pase se conservan");
});

test("desde= con ambas operaciones → error", () => {
  const plan = planificar({ operaciones: ["venta", "arriendo"], desde: 5, reanudar: false, checkpoint: cpAMedias(), ahora: AHORA });
  assert.ok("error" in plan);
});

test("desde= sin checkpoint → error (no hay pase que reanudar)", () => {
  const plan = planificar({ operaciones: ["venta"], desde: 5, reanudar: false, checkpoint: null, ahora: AHORA });
  assert.ok("error" in plan);
});

test("desde= y reanudar=1 juntos → error", () => {
  const plan = planificar({ operaciones: ["venta"], desde: 5, reanudar: true, checkpoint: cpAMedias(), ahora: AHORA });
  assert.ok("error" in plan);
});

test("reanudar=1: sigue desde la última página + 1 y salta las operaciones completas", () => {
  const cp = cpAMedias();
  cp.operaciones.venta!.completa = true;
  cp.operaciones.venta!.ultimaPagina = 44;
  cp.operaciones.arriendo = { ...estadoVacio(), ultimaPagina: 9, total: 9259 };
  const plan = planificar({ operaciones: ["venta", "arriendo"], desde: null, reanudar: true, checkpoint: cp, ahora: AHORA });
  assert.ok(!("error" in plan));
  assert.equal(plan.pase, cp.pase);
  assert.deepEqual(plan.tramos, [{ operacion: "arriendo", desdePagina: 10 }]);
  assert.match(plan.motivo, /ya completas: venta/);
});

test("reanudar=1 de una operación nunca empezada arranca en la 1", () => {
  const plan = planificar({ operaciones: ["arriendo"], desde: null, reanudar: true, checkpoint: cpAMedias(), ahora: AHORA });
  assert.ok(!("error" in plan));
  assert.deepEqual(plan.tramos, [{ operacion: "arriendo", desdePagina: 1 }]);
});

test("paseCompleto: solo con las dos operaciones completas y cero errores", () => {
  const cp = cpAMedias();
  assert.equal(paseCompleto(cp), false, "venta a medias");
  cp.operaciones.venta!.completa = true;
  assert.equal(paseCompleto(cp), false, "falta arriendo");
  cp.operaciones.arriendo = { ...estadoVacio(), completa: true };
  assert.equal(paseCompleto(cp), true);
  cp.errores.push("venta p12: upsert falló");
  assert.equal(paseCompleto(cp), false, "con errores no cuenta");
  assert.equal(paseCompleto(null), false);
});

test("parsearCheckpoint: tolera basura y conserva lo válido", () => {
  assert.equal(parsearCheckpoint(null), null);
  assert.equal(parsearCheckpoint("no es json"), null);
  assert.equal(parsearCheckpoint(JSON.stringify({ operaciones: {} })), null, "sin pase → null");
  const cp = parsearCheckpoint(JSON.stringify(cpAMedias()));
  assert.ok(cp);
  assert.equal(cp.pase, "p20260903T110000Z-ab12");
  assert.equal(cp.operaciones.venta?.ultimaPagina, 17);
  const sinErrores = parsearCheckpoint(JSON.stringify({ pase: "p", operaciones: {} }));
  assert.deepEqual(sinErrores?.errores, []);
  assert.equal(sinErrores?.activasAlInicio, null);
  assert.equal(sinErrores?.desactivacionOmitida, null);
  const conInicio = parsearCheckpoint(JSON.stringify({ pase: "p", operaciones: {}, activasAlInicio: 52674, desactivacionOmitida: "x" }));
  assert.equal(conInicio?.activasAlInicio, 52674);
  assert.equal(conInicio?.desactivacionOmitida, "x");
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
process.exit(fail ? 1 : 0);
