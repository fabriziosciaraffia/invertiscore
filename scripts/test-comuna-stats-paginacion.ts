/**
 * Test de la paginación de `getComunaMedianaVentaUF` (`src/lib/comuna-stats.ts`).
 *
 *   node --import "file:///<repo>/node_modules/tsx/dist/loader.mjs" scripts/test-comuna-stats-paginacion.ts
 *
 * Cero red, cero DB: se inyecta un cliente falso que se comporta como PostgREST
 * en lo único que importa acá — capa cada respuesta en 1.000 filas aunque se
 * pida más, y respeta `.range(desde, hasta)`.
 *
 * CONTRATO QUE DEFIENDE: la mediana comunal se calcula sobre TODAS las filas que
 * pasan el filtro, no sobre las primeras 1.000 en orden físico. Verificado el
 * 02-sep-2026: `.limit(2000)` sobre Santiago 1D usado 90 días devolvía 1.000 de
 * 1.230. Con el backfill, Santiago 1D en banda pasa a ~2.400.
 *
 * Desde el 04-sep-2026 cubre también el filtro de tipología de obra nueva: las
 * unidades se filtran por dormitorios exactos, las filas-proyecto no.
 */

import assert from "node:assert/strict";
import {
  esUnidadDeObraNueva,
  filtrarTipologiaObraNueva,
  getComunaMedianaVentaUF,
  MIN_VENTAS_MEDIANA,
  PAGINA_POSTGREST,
} from "../src/lib/comuna-stats";

let pass = 0;
let fail = 0;
const fallidos: string[] = [];
async function test(nombre: string, fn: () => Promise<void>) {
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

// ── Cliente falso: PostgREST de juguete ─────────────────────────────────────

type Fila = { id: number; precio: number; moneda: string; superficie_m2: number; dormitorios: number; condicion: string; source_id: string };

interface Registro {
  llamadas: number;
  rangos: Array<[number, number]>;
  usoLimit: boolean;
}

function clienteFalso(dataset: Fila[], registro: Registro) {
  const builder = (filtros: { dorms?: number; supMin?: number; supMax?: number; rango?: [number, number]; orden?: boolean }) => {
    const b = {
      select: () => b,
      eq: (col: string, v: unknown) => (col === "dormitorios" ? builder({ ...filtros, dorms: v as number }) : b),
      gte: (col: string, v: unknown) => (col === "superficie_m2" ? builder({ ...filtros, supMin: v as number }) : b),
      lte: (col: string, v: unknown) => (col === "superficie_m2" ? builder({ ...filtros, supMax: v as number }) : b),
      or: () => b,
      order: () => builder({ ...filtros, orden: true }),
      limit: () => {
        registro.usoLimit = true;
        return b;
      },
      range: (desde: number, hasta: number) => builder({ ...filtros, rango: [desde, hasta] }),
      then: (resolve: (v: { data: Fila[]; error: null }) => void) => {
        registro.llamadas++;
        let rows = dataset.filter(
          (f) =>
            (filtros.dorms == null || f.dormitorios === filtros.dorms) &&
            (filtros.supMin == null || f.superficie_m2 >= filtros.supMin) &&
            (filtros.supMax == null || f.superficie_m2 <= filtros.supMax),
        );
        if (filtros.orden) rows = rows.slice().sort((a, b) => a.id - b.id);
        const [desde, hasta] = filtros.rango ?? [0, Infinity];
        registro.rangos.push([desde, hasta]);
        // Lo que hace PostgREST: nunca más de 1.000 por respuesta.
        const pagina = rows.slice(desde, Math.min(hasta + 1, desde + 1000));
        resolve({ data: pagina, error: null });
      },
    };
    return b;
  };
  return { from: () => builder({}) };
}

function dataset(
  n: number,
  opts: { dorms?: number; sup?: number; precioUF?: (i: number) => number; condicion?: string; unidad?: boolean; base?: number } = {},
): Fila[] {
  const base = opts.base ?? 0;
  return Array.from({ length: n }, (_, i) => ({
    id: base + i + 1,
    precio: opts.precioUF ? opts.precioUF(i) : 2000 + i, // UF
    moneda: "UF",
    superficie_m2: opts.sup ?? 40,
    dormitorios: opts.dorms ?? 1,
    condicion: opts.condicion ?? "usado",
    // Unidad de obra nueva = source_id con '#'; fila-proyecto = sin '#'.
    source_id: `https://toctoc/p/${base + i + 1}${opts.unidad ? "#u1" : ""}`,
  }));
}

// ── Tests ───────────────────────────────────────────────────────────────────

(async () => {
  console.log("\ncomuna-stats · paginación de fetchVentas\n");

  await test("1.230 filas: la mediana usa las 1.230, no las primeras 1.000", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(dataset(1230), reg);
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 40, 1, 40000, "usado");
    assert.equal(r.n, 1230, `n devuelto: ${r.n}`);
    assert.ok(!reg.usoLimit, "no debe usar .limit()");
    assert.equal(reg.rangos[0][0], 0);
    assert.equal(reg.rangos[0][1], PAGINA_POSTGREST - 1);
    assert.equal(reg.rangos[1][0], PAGINA_POSTGREST);
    // Mediana de precio/m² con factor 0,93 (Santiago no es premium):
    // precios 2000..3229 UF sobre 40 m² → mediana precio 2614,5 UF → 2614,5*0,93/40.
    assert.equal(r.mediana, Math.round(((2614.5 * 0.93) / 40) * 100) / 100);
    assert.equal(r.ventanaDias, 90);
  });

  await test("exactamente 1.000 filas: una sola página más una vacía, n = 1.000", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(dataset(1000), reg);
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 40, 1, 40000, "usado");
    assert.equal(r.n, 1000);
    // Página llena → pide la siguiente (vacía) y corta. Por ventana: 2 llamadas.
    assert.equal(reg.llamadas, 2, `llamadas: ${reg.llamadas}`);
  });

  await test("2.450 filas (Santiago 1D tras el backfill): tres páginas, n = 2.450", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(dataset(2450), reg);
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 40, 1, 40000, "usado");
    assert.equal(r.n, 2450);
    assert.equal(reg.llamadas, 3);
  });

  await test("menos de 15 en 90 y 180 días: mediana null con el conteo parcial", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(dataset(MIN_VENTAS_MEDIANA - 1), reg);
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 40, 1, 40000, "usado");
    assert.equal(r.mediana, null);
    assert.equal(r.n, MIN_VENTAS_MEDIANA - 1);
    assert.equal(r.ventanaDias, null);
  });

  await test("el filtro de dormitorios sigue exacto en usado (las 2D no entran a 1D)", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso([...dataset(1100, { dorms: 1 }), ...dataset(900, { dorms: 2 })], reg);
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 40, 1, 40000, "usado");
    assert.equal(r.n, 1100);
  });

  console.log("\ncomuna-stats · tipología en obra nueva\n");

  await test("el source_id con # marca unidad; sin # (o sin valor) es fila-proyecto", async () => {
    assert.equal(esUnidadDeObraNueva("https://toctoc/p/1384492#12345"), true);
    assert.equal(esUnidadDeObraNueva("https://toctoc/p/1384492"), false);
    assert.equal(esUnidadDeObraNueva(null), false);
    assert.equal(esUnidadDeObraNueva(undefined), false);
  });

  await test("filtrarTipologiaObraNueva: la unidad 2D no entra a 3D, la fila-proyecto sí", async () => {
    const filas = [
      { source_id: "p/1#u1", dormitorios: 2 },
      { source_id: "p/1#u2", dormitorios: 3 },
      { source_id: "p/9", dormitorios: 1 },
    ];
    const r = filtrarTipologiaObraNueva(filas, 3);
    assert.deepEqual(r.map((f) => f.source_id), ["p/1#u2", "p/9"]);
  });

  await test("sin dormitorios del sujeto no se filtra nada", async () => {
    const filas = [{ source_id: "p/1#u1", dormitorios: 2 }];
    assert.equal(filtrarTipologiaObraNueva(filas, null).length, 1);
  });

  await test("obra nueva: las unidades de otra tipología quedan fuera de la mediana", async () => {
    // 20 unidades 3D + 40 unidades 2D en la misma banda de superficie: antes del
    // 04-sep-2026 la mediana salía de las 60. Ahora sale de las 20.
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(
      [
        ...dataset(20, { dorms: 3, sup: 75, condicion: "nuevo", unidad: true, precioUF: () => 6000 }),
        ...dataset(40, { dorms: 2, sup: 75, condicion: "nuevo", unidad: true, precioUF: () => 4000, base: 100 }),
      ],
      reg,
    );
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 75, 3, 40000, "nuevo");
    assert.equal(r.n, 20);
    // Obra nueva no lleva factor de cierre: 6000/75 = 80 UF/m².
    assert.equal(r.mediana, 80);
  });

  await test("obra nueva: la fila-proyecto entra aunque su dormitorios sea el mínimo del rango", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(
      [
        ...dataset(15, { dorms: 3, sup: 75, condicion: "nuevo", unidad: true, precioUF: () => 6000 }),
        ...dataset(5, { dorms: 1, sup: 75, condicion: "nuevo", unidad: false, precioUF: () => 6000, base: 100 }),
      ],
      reg,
    );
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 75, 3, 40000, "nuevo");
    assert.equal(r.n, 20);
  });

  await test("el filtro se aplica ANTES de la escalera: 14 unidades 3D no alcanzan el mínimo", async () => {
    const reg: Registro = { llamadas: 0, rangos: [], usoLimit: false };
    const cli = clienteFalso(
      [
        ...dataset(14, { dorms: 3, sup: 75, condicion: "nuevo", unidad: true, precioUF: () => 6000 }),
        ...dataset(60, { dorms: 2, sup: 75, condicion: "nuevo", unidad: true, precioUF: () => 4000, base: 100 }),
      ],
      reg,
    );
    const r = await getComunaMedianaVentaUF(cli, "Santiago", 75, 3, 40000, "nuevo");
    assert.equal(r.mediana, null, "con 14 de 15 no hay mediana, aunque haya 74 filas en la banda");
    assert.equal(r.n, 14);
    // Los tres peldaños de la escalera de obra nueva: 90, 180 y 365 días.
    assert.equal(reg.llamadas, 3, `llamadas: ${reg.llamadas}`);
  });

  console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
  process.exit(fail ? 1 : 0);
})();
