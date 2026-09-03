/**
 * Tests de los parsers de TocToc (`src/lib/services/scraper/toctoc.ts`) sobre
 * FIXTURES REALES capturados el 02-sep-2026.
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-parse-toctoc.ts
 *
 * Cero red, cero DB. Mismo patrón que scripts/test-drift-prosa-comuna.ts.
 *
 * CONTRATO QUE DEFIENDEN:
 *  · GetProps: [8] es dormitorios y [5] baños. Hasta el 02-sep se leía [4]
 *    (baños) como dormitorios y el 100% de las filas vía mapa quedó con
 *    dormitorios = banos. El fixture de Quinta Normal lo dice en su propio
 *    título: "3d +2b".
 *  · GetProps usado: la superficie canónica es la ÚTIL [33], que es la que
 *    publica el aviso ([27] es la construida).
 *  · Obra nueva: dormitorios también desde [8] (el MÍNIMO del rango del
 *    proyecto); [4] es baños mín. Hasta el 04-sep-2026 leía [4] y las
 *    filas-proyecto quedaban con dormitorios = baños mín. Se prueba con la fila
 *    real de "Edificio Refugio New" (La Florida), capturada ese día.
 *  · gw-lista-seo: `latitud`/`longitud` se leen (antes se descartaban y la fila
 *    entraba sin coordenada).
 */

import assert from "node:assert/strict";
import { parseMapProperty, parsePropertyFromResult } from "../src/lib/services/scraper/toctoc";

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

// ── Fixtures reales (GetProps, viewport Gran Santiago, estado=2) ────────────

/** Quinta Normal, "Depto. 61m²/ 3d +2b". [4]=2 baños, [8]=3 dorms, [27]=0, [33]=61. */
const QUINTA_NORMAL_3D2B: unknown[] = [
  [4, 8, 13, 15, 24, 41, 42, 53, 97, 98, 99, 102, 103, 104, 105, 106, 107, 108, 109, 110],
  4247243, -70.701228, -33.419852, 2, 2, 14, "Quinta Normal", 3, 3, false, false, 0, true, "07-07-2026 0:00:00",
  1, 8, 1, 8, 2, "https://d1cfu8v5n1wsm.cloudfront.net/toctoc/fotos/20260707/4247243/s_wm_2026071312540782414.jpg",
  40, 88000000, 88000000, 2152.83, 2152.83, null, 0, 0, 3, 3, 0, 0, 61, 61, false, true, false, 0,
  "¡Oportunidad insuperable! Depto. 61m²/ 3d +2b + Bodega incluida Futura linea 7",
  "https://www.toctoc.com/propiedades/compraparticularsr/departamento/quinta-normal/oportunidad-insuperable-depto-61m-3d-2b-bodega-incluida-futura-linea-7/4247243",
  4, 1, 0, "",
];

/** La Florida, "3D + 2B". El listado publica superficie 102 (= [33]); [27]=92 es construida. */
const LA_FLORIDA_3D2B: unknown[] = [
  [2, 6, 8, 9, 11, 13, 19, 25, 27, 29, 33, 40, 41, 42, 43, 47, 48, 51, 52, 70, 99, 101, 102, 103, 104, 107, 108, 109, 110, 116],
  4250456, -70.5699599, -33.5355462, 2, 2, 15, "La Florida", 3, 3, false, false, 0, true, "09-07-2026 0:00:00",
  1, 9, 1, 9, 2, "https://d1cfu8v5n1wsm.cloudfront.net/toctoc/fotos/20260709/4250456/s_wm_ee1ad983da9b0d4c632c38402edfdc4c16f698f1.jpg",
  43, 252000001, 252000001, 6164.92, 6164.92, "5976/2015090731407547465.jpg", 92, 92, 10, 10, 0, 0, 102, 102, false, false, false, 0,
  "3D + 2B + 2 Est. + Bod. / Rojas Magallanes / Av. La Florida",
  "https://www.toctoc.com/propiedades/compracorredorasr/departamento/la-florida/3d-2b-2-est-bod-rojas-magallanes-av-la-florida/4250456",
  4, 1, 0, "",
];

/** Proyecto de obra nueva (estado=1), La Florida: dorms 2-3, baños 1-2, útil 50,99-82,96.
 *  Construido sobre la fila real recortada de la sonda: [4]=1 baños mín, [8]=2 dorms mín. */
const NUEVO_LA_FLORIDA: unknown[] = (() => {
  const row = [...LA_FLORIDA_3D2B];
  row[1] = 1384492; row[2] = -70.5858681; row[3] = -33.5339223;
  row[4] = 1; row[5] = 2; row[8] = 2; row[9] = 3;
  // Precio "desde" en UF en las cuatro posiciones: el parser toma CLP si alguna
  // de [22..24] supera 50.000, así que un proyecto publicado en UF viene así.
  row[22] = 2100; row[23] = 2100; row[24] = 2100; row[25] = 2100;
  row[27] = 54.08; row[28] = 87.92; row[29] = 0; row[30] = 0; row[31] = 54.08; row[32] = 87.92; row[33] = 50.99; row[34] = 82.96;
  row[39] = "Proyecto";
  row[40] = "https://www.toctoc.com/propiedades/compranuevo/departamento/la-florida/proyecto/1384492";
  return row;
})();

/** Fila REAL del GetProps con estado=1, capturada el 04-sep-2026 (sonda
 *  of-sonda-getprops-nuevo.ts): "Edificio Refugio New", La Florida. [4]=1 baño
 *  mín, [5]=2 baños máx, [8]=2 dorms mín, [9]=3 dorms máx, [33]=50,99 útil mín. */
const NUEVO_LA_FLORIDA_REAL: unknown[] = [
  [25, 27, 28, 29, 30, 37],
  1384492, -70.5858681, -33.5339223, 1, 2, 7, "La Florida", 2, 3, false, true, 0, false, "20-12-2019 0:00:00",
  2, 7, 2, 7, 2, "https://d1cfu8v5n1wsm.cloudfront.net/toctoc/fotos/20191220/1384492/s_wm_2020082631447222663.jpg",
  1, 3594, 3594, 146914561.62, 0, "912/2019043008494788677.jpg", 54.08, 87.92, 0, 0, 54.08, 87.92, 50.99, 82.96,
  false, false, false, 0, "Edificio Refugio New",
  "https://www.toctoc.com/propiedades/compranuevo/departamento/la-florida/edificio-refugio-new/1384492",
  4, 1, 0, "",
];

// ── Fixture real (gw-lista-seo, Renca venta, page 1) ────────────────────────

const GW_RENCA_NUEVO = {
  titulo: "Vista Costanera",
  comuna: "Renca",
  region: "Metropolitana",
  urlFicha: "https://www.toctoc.com/venta/departamento/metropolitana/renca/r_b4b025a443bad264aed984c70488fa2fff42d500",
  hashId: "b4b025a443bad264aed984c70488fa2fff42d500",
  tipoPropiedad: "Departamento",
  tipoOperacion: "Venta Nuevo",
  precios: [
    { order: 0, prefix: "UF", value: "1.779" },
    { order: 1, prefix: "$", value: "72.719.133" },
  ],
  currencyType: 2,
  superficie: ["36,9", "46,18"],
  dormitorios: ["2", "3"],
  bannos: ["1", "1"],
  idProperty: 1509722,
  idEstadoPropiedad: 1,
  latitud: -33.421939,
  longitud: -70.677323,
};

// ── Tests ───────────────────────────────────────────────────────────────────

console.log("\nparseMapProperty (GetProps)\n");

test("usado: dormitorios sale de [8] y baños de [5] (Quinta Normal '3d +2b')", () => {
  const p = parseMapProperty(QUINTA_NORMAL_3D2B, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.dormitorios, 3);
  assert.equal(p.banos, 2);
});

test("usado: superficie canónica es la útil [33] aunque [27] exista (La Florida 102 vs 92)", () => {
  const p = parseMapProperty(LA_FLORIDA_3D2B, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.superficieM2, 102);
  assert.equal(p.dormitorios, 3);
  assert.equal(p.banos, 2);
});

test("usado: con [27]=0 la útil [33] igual manda (Quinta Normal 61 m²)", () => {
  const p = parseMapProperty(QUINTA_NORMAL_3D2B, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.superficieM2, 61);
});

test("usado: precio, moneda, coordenadas, comuna de la fila, url como sourceId, condicion usado", () => {
  const p = parseMapProperty(LA_FLORIDA_3D2B, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.precio, 252000001);
  assert.equal(p.moneda, "CLP");
  assert.equal(p.lat, -33.5355462);
  assert.equal(p.lng, -70.5699599);
  assert.equal(p.comuna, "La Florida");
  assert.equal(p.url, LA_FLORIDA_3D2B[40]);
  assert.equal(p.sourceId, LA_FLORIDA_3D2B[40]);
  assert.equal(p.condicion, "usado");
  assert.equal(p.type, "venta");
});

test("usado: una fila con [4] ≠ [8] ya no confunde baños con dormitorios (regresión del bug)", () => {
  const row = [...LA_FLORIDA_3D2B];
  row[4] = 1; row[5] = 1; row[8] = 3; row[9] = 3;
  const p = parseMapProperty(row, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.dormitorios, 3, "dormitorios debe venir de [8]");
  assert.equal(p.banos, 1);
});

test("obra nueva (fila real): dormitorios mínimos desde [8], no baños mínimos [4]", () => {
  const p = parseMapProperty(NUEVO_LA_FLORIDA_REAL, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.condicion, "nuevo");
  assert.equal(p.dormitorios, 2, "[8] = 2 dorms mín; [4] = 1 baño mín era lo que se leía antes");
  assert.equal(p.banos, 2);
  assert.equal(p.comuna, "La Florida");
  assert.equal(p.superficieM2, 50.99, "útil mínima [33]");
  assert.equal(p.moneda, "CLP");
  assert.equal(p.precio, 146914561.62);
  assert.equal(p.url, NUEVO_LA_FLORIDA_REAL[40]);
});

test("obra nueva (fila sintética): [8] manda aunque [4] traiga otro valor; superficie mínima en [33]", () => {
  const p = parseMapProperty(NUEVO_LA_FLORIDA, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.condicion, "nuevo");
  assert.equal(p.dormitorios, 2);
  assert.equal(p.banos, 2);
  assert.equal(p.superficieM2, 50.99);
  assert.equal(p.precio, 2100);
  assert.equal(p.moneda, "UF");
});

test("regresión del bug en obra nueva: [4]=1 con [8]=3 → 3 dormitorios, 1 baño mín", () => {
  const row = [...NUEVO_LA_FLORIDA_REAL];
  row[4] = 1; row[5] = 1; row[8] = 3; row[9] = 3;
  const p = parseMapProperty(row, "santiago", "venta");
  assert.ok(p);
  assert.equal(p.dormitorios, 3);
  assert.equal(p.banos, 1);
});

test("fila sin coordenadas válidas se descarta", () => {
  const row = [...LA_FLORIDA_3D2B];
  row[2] = 0; row[3] = 0;
  assert.equal(parseMapProperty(row, "santiago", "venta"), null);
});

console.log("\nparsePropertyFromResult (gw-lista-seo)\n");

test("lee latitud/longitud del resultado", () => {
  const p = parsePropertyFromResult(GW_RENCA_NUEVO, "venta", "Renca");
  assert.ok(p);
  assert.equal(p.lat, -33.421939);
  assert.equal(p.lng, -70.677323);
});

test("precio CLP manda sobre UF, superficie/dorms/baños del primer valor, condicion por tipoOperacion", () => {
  const p = parsePropertyFromResult(GW_RENCA_NUEVO, "venta", "Renca");
  assert.ok(p);
  assert.equal(p.precio, 72719133);
  assert.equal(p.moneda, "CLP");
  assert.equal(p.superficieM2, 36);
  assert.equal(p.dormitorios, 2);
  assert.equal(p.banos, 1);
  assert.equal(p.condicion, "nuevo");
  assert.equal(p.url, GW_RENCA_NUEVO.urlFicha);
  assert.equal(p.sourceId, GW_RENCA_NUEVO.urlFicha);
  assert.equal(p.comuna, "Renca");
});

test("sin latitud/longitud la fila entra igual, sin coordenada (no se inventa)", () => {
  const sin = { ...GW_RENCA_NUEVO, latitud: undefined, longitud: undefined, tipoOperacion: "Venta" };
  const p = parsePropertyFromResult(sin, "venta", "Renca");
  assert.ok(p);
  assert.equal(p.lat, undefined);
  assert.equal(p.lng, undefined);
  assert.equal(p.condicion, "usado");
});

test("coordenadas fuera de Chile se descartan, la fila entra sin ellas", () => {
  const fuera = { ...GW_RENCA_NUEVO, latitud: 27.6, longitud: -70.6 };
  const p = parsePropertyFromResult(fuera, "venta", "Renca");
  assert.ok(p);
  assert.equal(p.lat, undefined);
  assert.equal(p.lng, undefined);
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
process.exit(fail ? 1 : 0);
