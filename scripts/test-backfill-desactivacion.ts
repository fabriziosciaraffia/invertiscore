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
  UMBRAL_PASE_MINIMO,
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
