/**
 * Tests de la lógica pura de /admin/operacion:
 *   · plegarCobertura (src/lib/admin-cobertura.ts)
 *   · estadoPase      (src/lib/admin-backfill-toctoc.ts)
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-admin-operacion.ts
 *
 * Cero red, cero DB.
 *
 * CONTRATO QUE DEFIENDEN: el total plegado es la suma de TODAS las filas de la
 * RPC (roster + otras), o sea la misma cifra que la pastilla "Propiedades";
 * una comuna del roster sin activas aparece igual, en cero; y el pase semanal
 * se declara atrasado a los 8 días, no a los 14.
 */

import assert from "node:assert/strict";
import { plegarCobertura, type CoberturaRpcRow } from "../src/lib/admin-cobertura";
import { estadoPase, DIAS_ATRASO_PASE } from "../src/lib/admin-backfill-toctoc";
import { parsearCheckpoint, type CheckpointBackfill } from "../src/lib/services/scraper/backfill-plan";

let pass = 0;
let fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}\n       ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── plegarCobertura ─────────────────────────────────────────────────────────

const ROSTER = ["Santiago", "Ñuñoa", "Renca"];

const fila = (
  comuna: string,
  vu: number,
  ar: number,
  obn: number,
  sc: number,
  ultimo: string | null
): CoberturaRpcRow => ({
  comuna,
  venta_usada: vu,
  arriendo: ar,
  obra_nueva: obn,
  sin_coords: sc,
  ultimo,
});

console.log("plegarCobertura");

test("el total suma roster + otras; el roster sale completo y en su orden", () => {
  const rows = [
    fila("Santiago", 100, 50, 20, 3, "2026-09-03 06:00:00"),
    fila("Ñuñoa", 40, 10, 5, 0, "2026-09-01 06:00:00"),
    fila("San Bernardo", 7, 2, 0, 1, "2026-08-20 06:00:00"),
    fila("Colina", 3, 0, 1, 0, "2026-08-30 06:00:00"),
  ];
  const c = plegarCobertura(rows, ROSTER);
  assert.deepEqual(
    c.roster.map((r) => r.comuna),
    ROSTER
  );
  assert.equal(c.total.total, 100 + 50 + 20 + 40 + 10 + 5 + 7 + 2 + 3 + 1);
  assert.equal(c.total.ventaUsada, 150);
  assert.equal(c.total.arriendo, 62);
  assert.equal(c.total.obraNueva, 26);
  assert.equal(c.total.sinCoords, 4);
  assert.equal(c.total.ultimo, "2026-09-03 06:00:00");
});

test("una comuna del roster sin filas sale en cero y sin fecha", () => {
  const c = plegarCobertura([fila("Santiago", 1, 0, 0, 0, "2026-09-03 06:00:00")], ROSTER);
  const renca = c.roster.find((r) => r.comuna === "Renca");
  assert.ok(renca);
  assert.equal(renca.total, 0);
  assert.equal(renca.ultimo, null);
});

test("las de fuera del roster se agrupan en otras, con conteo de comunas y max(ultimo)", () => {
  const c = plegarCobertura(
    [
      fila("San Bernardo", 7, 2, 0, 1, "2026-08-20 06:00:00"),
      fila("Colina", 3, 0, 1, 0, "2026-08-30 06:00:00"),
      fila("Temuco", 0, 1, 0, 1, null),
    ],
    ROSTER
  );
  assert.ok(c.otras);
  assert.equal(c.otras.comunas, 3);
  assert.equal(c.otras.total, 14);
  assert.equal(c.otras.sinCoords, 2);
  assert.equal(c.otras.ultimo, "2026-08-30 06:00:00");
});

test("sin filas fuera del roster, otras es null", () => {
  const c = plegarCobertura([fila("Santiago", 1, 0, 0, 0, null)], ROSTER);
  assert.equal(c.otras, null);
});

test("el match es por nombre exacto: 'Nunoa' sin tilde NO es 'Ñuñoa'", () => {
  const c = plegarCobertura([fila("Nunoa", 5, 0, 0, 0, null)], ROSTER);
  assert.equal(c.roster.find((r) => r.comuna === "Ñuñoa")?.total, 0);
  assert.equal(c.otras?.total, 5);
});

// ─── estadoPase ──────────────────────────────────────────────────────────────

/** Checkpoint real de la base al 03-sep-2026 (pase del 02-sep, forzado). */
const CP_REAL = JSON.stringify({
  pase: "p20260902T225138Z-cbf9",
  iniciadoEn: "2026-09-02T22:51:38.878Z",
  actualizadoEn: "2026-09-02T22:54:15.109Z",
  operaciones: {
    venta: {
      total: 26112,
      ultimaPagina: 44,
      filas: 26112,
      nuevas: 6,
      completa: true,
      terminadoEn: "2026-09-02T22:53:34.772Z",
    },
    arriendo: {
      total: 9279,
      ultimaPagina: 16,
      filas: 9279,
      nuevas: 5,
      completa: true,
      terminadoEn: "2026-09-02T22:54:12.812Z",
    },
  },
  errores: [],
  activasAlInicio: 74482,
  desactivacion: {
    en: "2026-09-02T22:54:15.108Z",
    pase: "p20260902T225138Z-cbf9",
    filas: 39102,
    activasAntes: 74482,
    forzada: true,
  },
  desactivacionOmitida: null,
});

function cpReal(): CheckpointBackfill {
  const cp = parsearCheckpoint(CP_REAL);
  assert.ok(cp);
  return cp;
}

/** `n` días (y un segundo) después de que terminó la última operación del pase real. */
const dias = (n: number) =>
  new Date(new Date("2026-09-02T22:54:12.812Z").getTime() + n * 24 * 60 * 60 * 1000 + 1000);

console.log("\nestadoPase");

test("pase completo y reciente: ok, con filas por operación, nuevas y desactivadas", () => {
  const e = estadoPase(cpReal(), dias(1));
  assert.equal(e.estado, "ok");
  assert.equal(e.completo, true);
  assert.equal(e.pase, "p20260902T225138Z-cbf9");
  assert.equal(e.fecha, "2026-09-02T22:54:12.812Z");
  assert.equal(e.dias, 1);
  assert.deepEqual(e.filas, { venta: 26112, arriendo: 9279, total: 35391 });
  assert.equal(e.nuevas, 11);
  assert.equal(e.desactivadas, 39102);
  assert.equal(e.forzada, true);
  assert.match(e.resumen, /desactivó 39102/);
});

test(`a los ${DIAS_ATRASO_PASE} días sigue ok; al día siguiente es error`, () => {
  assert.equal(estadoPase(cpReal(), dias(DIAS_ATRASO_PASE)).estado, "ok");
  const e = estadoPase(cpReal(), dias(DIAS_ATRASO_PASE + 1));
  assert.equal(e.estado, "error");
  assert.match(e.resumen, /atrasado/);
});

test("sin checkpoint: error", () => {
  const e = estadoPase(null, dias(0));
  assert.equal(e.estado, "error");
  assert.equal(e.pase, null);
});

test("pase a medias sin errores: warn, y la fecha es la última actualización", () => {
  const cp = cpReal();
  cp.operaciones.arriendo = { ...cp.operaciones.arriendo!, completa: false, terminadoEn: null };
  cp.desactivacion = null;
  const e = estadoPase(cp, dias(0));
  assert.equal(e.estado, "warn");
  assert.equal(e.completo, false);
  assert.equal(e.fecha, "2026-09-02T22:54:15.109Z");
  assert.equal(e.desactivadas, null);
});

test("pase a medias con errores: error", () => {
  const cp = cpReal();
  cp.errores = ["venta p12: 502"];
  cp.desactivacion = null;
  const e = estadoPase(cp, dias(0));
  assert.equal(e.estado, "error");
  assert.match(e.resumen, /1 error$/);
});

test("completo pero con la desactivación omitida por la salvaguarda: warn", () => {
  const cp = cpReal();
  cp.desactivacion = null;
  cp.desactivacionOmitida = "pase sospechosamente chico";
  const e = estadoPase(cp, dias(0));
  assert.equal(e.estado, "warn");
  assert.equal(e.omitida, "pase sospechosamente chico");
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
process.exit(fail ? 1 : 0);
