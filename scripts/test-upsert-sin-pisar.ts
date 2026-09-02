/**
 * Tests de `upsertSinPisarCoords` / `filaSinPisarCoords`
 * (`src/lib/services/scraper/property-row.ts`).
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-upsert-sin-pisar.ts
 *
 * Cero red, cero DB. El cliente falso modela lo que hace PostgREST con
 * `upsert(..., { onConflict })` (Prefer: resolution=merge-duplicates): el
 * ON CONFLICT DO UPDATE solo escribe las columnas PRESENTES en el payload, y
 * las que no vienen conservan su valor. De ahí las dos reglas que se defienden:
 *
 *  · El pase diario (scrape-properties → propertyToRow) no conoce
 *    `seen_pass_id`, así que una fila que el backfill ya marcó conserva su pase
 *    cuando el diario la refresca.
 *  · Una fila que llega sin lat/lng (o sin direccion) no pisa la coordenada que
 *    la tabla ya tiene: esas claves se quitan del payload.
 */

import assert from "node:assert/strict";
import { propertyToRow, filaSinPisarCoords, upsertSinPisarCoords, LOTE_UPSERT, type FilaUpsert } from "../src/lib/services/scraper/property-row";
import type { ScrapedProperty } from "../src/lib/services/scraper/toctoc";

let pass = 0;
let fail = 0;
const fallidos: string[] = [];
async function test(nombre: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

// ── PostgREST de juguete: tabla en memoria con merge por (source, source_id) ──

type Fila = Record<string, unknown>;

function tablaFalsa(inicial: Fila[]) {
  const filas = new Map<string, Fila>(inicial.map((f) => [`${f.source}|${f.source_id}`, { ...f }]));
  const llamadas: Array<{ payload: Fila[]; keys: string[]; select: string | null }> = [];
  const cliente = {
    from: () => ({
      upsert: (payload: Fila[]) => {
        const keys = Object.keys(payload[0] ?? {}).sort();
        // Regla de PostgREST: todas las filas del bulk con las mismas claves.
        for (const p of payload) assert.deepEqual(Object.keys(p).sort(), keys, "bulk upsert con formas distintas");
        const escritas: Fila[] = [];
        for (const p of payload) {
          const k = `${p.source}|${p.source_id}`;
          const prev = filas.get(k);
          const next = prev ? { ...prev, ...p } : { created_at: "2026-09-03T12:00:00", ...p };
          filas.set(k, next);
          escritas.push(next);
        }
        const reg = { payload, keys, select: null as string | null };
        llamadas.push(reg);
        const thenable = {
          select: (cols: string) => {
            reg.select = cols;
            return Promise.resolve({ data: escritas.map((f) => ({ created_at: f.created_at })), error: null });
          },
          then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
        };
        return thenable;
      },
    }),
  };
  return { cliente, filas, llamadas };
}

function prop(over: Partial<ScrapedProperty> = {}): ScrapedProperty {
  return {
    source: "toctoc",
    sourceId: "https://www.toctoc.com/propiedades/x/1",
    type: "venta",
    comuna: "Santiago",
    precio: 3000,
    moneda: "UF",
    superficieM2: 45,
    dormitorios: 1,
    banos: 1,
    url: "https://www.toctoc.com/propiedades/x/1",
    condicion: "usado",
    ...over,
  };
}

(async () => {
  console.log("\nupsert sin pisar\n");

  await test("el pase diario no manda seen_pass_id: la fila conserva el pase que le puso el backfill", async () => {
    const t = tablaFalsa([{ source: "toctoc", source_id: prop().sourceId, lat: -33.45, lng: -70.65, seen_pass_id: "p20260903-ab12", precio: 2900, is_active: true }]);
    // Exactamente lo que hace scrape-properties: propertyToRow → filaSinPisarCoords → upsert.
    const rows: FilaUpsert[] = [prop({ lat: -33.4501, lng: -70.6502, precio: 3000 })].map(propertyToRow).map((r) => filaSinPisarCoords(r));
    assert.ok(!("seen_pass_id" in rows[0]), "propertyToRow no debe emitir seen_pass_id");
    const r = await upsertSinPisarCoords(t.cliente, rows);
    assert.equal(r.escritas, 1);
    assert.deepEqual(r.errores, []);
    const fila = t.filas.get(`toctoc|${prop().sourceId}`)!;
    assert.equal(fila.seen_pass_id, "p20260903-ab12", "seen_pass_id intacto");
    assert.equal(fila.precio, 3000, "el precio sí se actualiza");
    assert.equal(fila.lat, -33.4501, "la coordenada nueva sí se escribe cuando viene");
  });

  await test("una fila sin lat/lng no pisa la coordenada existente (las claves no viajan)", async () => {
    const t = tablaFalsa([{ source: "toctoc", source_id: prop().sourceId, lat: -33.45, lng: -70.65, location: "POINT", seen_pass_id: "p1" }]);
    const rows = [prop({ lat: undefined, lng: undefined, direccion: undefined })].map(propertyToRow).map((r) => filaSinPisarCoords(r));
    assert.ok(!("lat" in rows[0]) && !("lng" in rows[0]) && !("direccion" in rows[0]));
    await upsertSinPisarCoords(t.cliente, rows);
    const fila = t.filas.get(`toctoc|${prop().sourceId}`)!;
    assert.equal(fila.lat, -33.45);
    assert.equal(fila.lng, -70.65);
    assert.equal(fila.location, "POINT");
    assert.equal(fila.seen_pass_id, "p1");
  });

  await test("filas con y sin coordenada van en upserts separados, cada uno homogéneo", async () => {
    const t = tablaFalsa([]);
    const rows = [
      prop({ sourceId: "u1", lat: -33.4, lng: -70.6 }),
      prop({ sourceId: "u2", lat: undefined, lng: undefined }),
      prop({ sourceId: "u3", lat: -33.41, lng: -70.61 }),
    ].map(propertyToRow).map((r) => filaSinPisarCoords(r));
    const r = await upsertSinPisarCoords(t.cliente, rows);
    assert.equal(r.escritas, 3);
    assert.equal(t.llamadas.length, 2, "dos formas → dos upserts");
    assert.ok(t.llamadas.some((l) => l.keys.includes("lat") && l.payload.length === 2));
    assert.ok(t.llamadas.some((l) => !l.keys.includes("lat") && l.payload.length === 1));
  });

  await test("el backfill marca seen_pass_id y cuenta nuevas vs actualizadas por created_at", async () => {
    const t = tablaFalsa([{ source: "toctoc", source_id: "vieja", created_at: "2026-08-01T00:00:00", lat: -33.4, lng: -70.6 }]);
    const rows = [prop({ sourceId: "vieja", lat: -33.4, lng: -70.6 }), prop({ sourceId: "nueva", lat: -33.5, lng: -70.7 })]
      .map(propertyToRow)
      .map((r) => filaSinPisarCoords({ ...r, seen_pass_id: "p9" }));
    const r = await upsertSinPisarCoords(t.cliente, rows, { contarNuevasDesde: "2026-09-03T11:59:00.000Z" });
    assert.equal(r.escritas, 2);
    assert.equal(r.nuevas, 1, "solo 'nueva' tiene created_at dentro de la corrida");
    assert.equal(t.filas.get("toctoc|vieja")!.seen_pass_id, "p9");
    assert.equal(t.filas.get("toctoc|nueva")!.seen_pass_id, "p9");
    assert.equal(t.llamadas[0].select, "created_at", "pide created_at de vuelta solo cuando cuenta nuevas");
  });

  await test("lotes de LOTE_UPSERT filas", async () => {
    const t = tablaFalsa([]);
    const rows = Array.from({ length: LOTE_UPSERT + 1 }, (_, i) => prop({ sourceId: `u${i}`, lat: -33.4, lng: -70.6 }))
      .map(propertyToRow)
      .map((r) => filaSinPisarCoords(r));
    const r = await upsertSinPisarCoords(t.cliente, rows);
    assert.equal(r.escritas, LOTE_UPSERT + 1);
    assert.equal(t.llamadas.length, 2);
  });

  console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
  process.exit(fail ? 1 : 0);
})();
