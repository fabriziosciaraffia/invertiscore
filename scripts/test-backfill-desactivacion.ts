/**
 * Tests de la desactivación del pase (`src/lib/services/scraper/backfill-plan.ts`, Fase C).
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-backfill-desactivacion.ts
 *
 * Cero red, cero DB: un builder falso registra los filtros que se aplican.
 *
 * CONTRATO QUE DEFIENDEN:
 *  · La desactivación aplica a TODO source='toctoc' AND type IN (venta, arriendo)
 *    del universo usado, activas, con seen_pass_id IS DISTINCT FROM el pase.
 *    Sin filtro de comuna. NULL cuenta como distinto (or is.null).
 *  · Solo desactiva un pase completo (dos operaciones, cero errores) y de tamaño
 *    plausible (UMBRAL_PASE_MINIMO).
 */

import assert from "node:assert/strict";
import {
  aplicarFiltrosUniverso,
  aplicarFiltrosDesactivacion,
  debeDesactivar,
  paseCompleto,
  validarPaseId,
  estadoVacio,
  parsearCheckpoint,
  planificar,
  UMBRAL_PASE_MINIMO,
  PREFIJO_OMITIDA,
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

/** Builder falso: acumula los filtros como strings. */
class Q {
  filtros: string[] = [];
  eq(c: string, v: unknown) {
    this.filtros.push(`eq ${c}=${String(v)}`);
    return this;
  }
  in(c: string, v: unknown[]) {
    this.filtros.push(`in ${c}=[${v.join(",")}]`);
    return this;
  }
  or(f: string) {
    this.filtros.push(`or ${f}`);
    return this;
  }
}

console.log("\ndesactivación del pase\n");

test("filtros exactos: source toctoc, type venta+arriendo, usado o null, activas, pase distinto o NULL", () => {
  const q: Q = aplicarFiltrosDesactivacion(new Q(), "p20260903T120000Z-ab12");
  assert.deepEqual(q.filtros, [
    "eq source=toctoc",
    "in type=[venta,arriendo]",
    "or condicion.is.null,condicion.eq.usado",
    "eq is_active=true",
    "or seen_pass_id.is.null,seen_pass_id.neq.p20260903T120000Z-ab12",
  ]);
});

test("sin filtro de comuna", () => {
  const q: Q = aplicarFiltrosDesactivacion(new Q(), "p1");
  assert.ok(!q.filtros.some((f) => /comuna/.test(f)));
});

test("NULL cuenta como distinto: el filtro del pase lleva is.null (IS DISTINCT FROM, no <>)", () => {
  const q: Q = aplicarFiltrosDesactivacion(new Q(), "p1");
  const f = q.filtros[q.filtros.length - 1];
  assert.match(f, /seen_pass_id\.is\.null/);
  assert.match(f, /seen_pass_id\.neq\.p1/);
});

test("obra nueva queda fuera (condicion nuevo no pasa el or)", () => {
  const q: Q = aplicarFiltrosUniverso(new Q());
  assert.ok(q.filtros.includes("or condicion.is.null,condicion.eq.usado"));
  assert.ok(!q.filtros.some((f) => /nuevo/.test(f)));
});

test("el id de pase se valida antes de entrar al filtro or de PostgREST", () => {
  assert.throws(() => validarPaseId("p1,seen_pass_id.is.null"));
  assert.throws(() => validarPaseId("p1 x"));
  assert.doesNotThrow(() => validarPaseId("p20260903T120000Z-ab12"));
  assert.throws(() => aplicarFiltrosDesactivacion(new Q(), "malo)"));
});

test("debeDesactivar: primer pase (35k sobre 52k) sí; pase recortado (5k sobre 36k) no", () => {
  assert.equal(debeDesactivar({ escritasPase: 35000, activasAntes: 52000 }).ok, true);
  assert.equal(debeDesactivar({ escritasPase: 34000, activasAntes: 36000 }).ok, true);
  const r = debeDesactivar({ escritasPase: 5000, activasAntes: 36000 });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sospechosamente chico/);
  assert.equal(debeDesactivar({ escritasPase: Math.ceil(UMBRAL_PASE_MINIMO * 1000), activasAntes: 1000 }).ok, true);
  assert.equal(debeDesactivar({ escritasPase: 0, activasAntes: 0 }).ok, true, "sin activas no hay nada que proteger");
});

test("el denominador es activasAlInicio: la corrida real (35.382 sobre 52.674 al inicio) sí desactiva; medida post-upsert (74.482) no", () => {
  // p20260902T223350Z-2aqb: 74.482 activas DESPUÉS del upsert (los inserts nuevos
  // inflaron el denominador) → 0,48, omitida. Al inicio había 52.674 → 0,67.
  assert.equal(debeDesactivar({ escritasPase: 35382, activasAntes: 74482 }).ok, false);
  const r = debeDesactivar({ escritasPase: 35382, activasAntes: 52674 });
  assert.equal(r.ok, true);
  assert.equal(r.forzada, false);
  assert.match(r.motivo, /al inicio/);
});

test("sin activasAlInicio (checkpoint viejo) no se puede evaluar: no desactiva y lo dice", () => {
  const r = debeDesactivar({ escritasPase: 35382, activasAntes: null });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /forzarDesactivacion=1/);
});

test("forzarDesactivacion salta SOLO la proporción: ok y forzada, incluso con 0,48 o sin activasAlInicio", () => {
  const a = debeDesactivar({ escritasPase: 35382, activasAntes: 74482, forzar: true });
  assert.equal(a.ok, true);
  assert.equal(a.forzada, true);
  assert.match(a.motivo, /FORZADA/);
  const b = debeDesactivar({ escritasPase: 35382, activasAntes: null, forzar: true });
  assert.equal(b.ok, true);
  assert.equal(b.forzada, true);
  // Lo que NO salta: paseCompleto. Un pase con errores o a medias sigue sin desactivar.
  const cp: CheckpointBackfill = {
    pase: "p1", iniciadoEn: "", actualizadoEn: "",
    operaciones: { venta: { ...estadoVacio(), completa: true }, arriendo: { ...estadoVacio(), completa: false } },
    errores: [],
  };
  assert.equal(paseCompleto(cp), false, "arriendo a medias: forzar no aplica porque la ruta exige paseCompleto antes");
  cp.operaciones.arriendo!.completa = true;
  cp.errores.push("venta: universo vacío (total 0)");
  assert.equal(paseCompleto(cp), false, "universo vacío: tampoco");
});

test("recuperación del pase real: la 'desactivación omitida' anotada como error migra al campo propio y el pase vuelve a estar completo", () => {
  const viejo = JSON.stringify({
    pase: "p20260902T223350Z-2aqb", iniciadoEn: "2026-09-02T22:33:50.000Z", actualizadoEn: "2026-09-02T22:37:00.000Z",
    operaciones: { venta: { ...estadoVacio(), completa: true, filas: 26114 }, arriendo: { ...estadoVacio(), completa: true, filas: 9268 } },
    errores: [`${PREFIJO_OMITIDA} pase sospechosamente chico: escribió 35382 sobre 74482 activas (0.48 < 0.5)`],
  });
  const cp = parsearCheckpoint(viejo);
  assert.ok(cp);
  assert.deepEqual(cp.errores, []);
  assert.match(cp.desactivacionOmitida ?? "", /sospechosamente chico/);
  assert.equal(cp.activasAlInicio, null, "el pase viejo no midió activas al inicio");
  assert.equal(paseCompleto(cp), true, "sin el falso error, el pase está completo y se puede reintentar");
  // ?reanudar=1 sobre ese checkpoint: nada que recorrer, mismo pase → la ruta va directo a la desactivación.
  const plan = planificar({ operaciones: ["venta", "arriendo"], desde: null, reanudar: true, checkpoint: cp, ahora: new Date(), activasAlInicio: 74482 });
  assert.ok(!("error" in plan));
  assert.deepEqual(plan.tramos, []);
  assert.equal(plan.pase, "p20260902T223350Z-2aqb");
  assert.equal(plan.checkpoint.activasAlInicio, null, "reanudar NO pisa activasAlInicio con la medición de hoy");
  // Sin activasAlInicio la proporción no se evalúa → hace falta forzar.
  assert.equal(debeDesactivar({ escritasPase: 35382, activasAntes: plan.checkpoint.activasAlInicio ?? null }).ok, false);
  assert.equal(debeDesactivar({ escritasPase: 35382, activasAntes: null, forzar: true }).ok, true);
});

test("un pase parcial o con errores NUNCA desactiva (paseCompleto)", () => {
  const cp: CheckpointBackfill = {
    pase: "p1",
    iniciadoEn: "",
    actualizadoEn: "",
    operaciones: { venta: { ...estadoVacio(), completa: true }, arriendo: { ...estadoVacio(), completa: false, ultimaPagina: 9 } },
    errores: [],
  };
  assert.equal(paseCompleto(cp), false, "arriendo a medias");
  cp.operaciones.arriendo!.completa = true;
  assert.equal(paseCompleto(cp), true);
  cp.errores.push("arriendo: universo vacío (total 0)");
  assert.equal(paseCompleto(cp), false, "universo vacío es error, no pase completo");
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
process.exit(fail ? 1 : 0);
