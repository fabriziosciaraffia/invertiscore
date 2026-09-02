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
 */

import assert from "node:assert/strict";
import { getComunaMedianaVentaUF, PAGINA_POSTGREST, MIN_VENTAS_MEDIANA } from "../src/lib/comuna-stats";

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

type Fila = { id: number; precio: number; moneda: string; superficie_m2: number; dormitorios: number; condicion: string };

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

function dataset(n: number, opts: { dorms?: number; sup?: number; precioUF?: (i: number) => number } = {}): Fila[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    precio: opts.precioUF ? opts.precioUF(i) : 2000 + i, // UF
    moneda: "UF",
    superficie_m2: opts.sup ?? 40,
    dormitorios: opts.dorms ?? 1,
    condicion: "usado",
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

  console.log(`\n${pass} OK · ${fail} FAIL${fail ? " → " + fallidos.join(", ") : ""}\n`);
  process.exit(fail ? 1 : 0);
})();
