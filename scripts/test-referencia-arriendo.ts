/**
 * Tests de `resolverReferenciaArriendo` (`src/lib/referencia-arriendo.ts`).
 *
 *   npx tsx scripts/test-referencia-arriendo.ts
 *
 * Cero red, cero DB: la función es pura. Mismo patrón que
 * `scripts/test-drift-prosa-comuna.ts`.
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO: la jerarquía tipología → comunal por m²
 * → insuficiente, con sus bordes exactos (19/20 arriendos de tipología, 14/15
 * comunales para entrar, 9/10 para mantener) y la asimetría entre superficies:
 * la página de comuna tiene histéresis porque lee "publicaba" del snapshot; el
 * informe LTR no la tiene y usa el umbral de entrada seco. Un estimado comunal
 * sale SIEMPRE como rango y nunca se confunde con una mediana de tipología.
 */

import assert from "node:assert/strict";
import {
  MIN_ARRIENDOS_COMUNAL_ENTRA,
  MIN_ARRIENDOS_COMUNAL_MANTIENE,
  MIN_ARRIENDOS_TIPOLOGIA,
  arriendoDeReferencia,
  factorParaDorms,
  medianaArriendoUFm2Mes,
  resolverReferenciaArriendo,
  umbralComunal,
  type InsumosReferenciaArriendo,
} from "../src/lib/referencia-arriendo";
import { FACTORES_TIPOLOGIA_ARRIENDO, PROCEDENCIA_FACTORES_TIPOLOGIA } from "../src/lib/factores-tipologia-arriendo.gen";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try {
    fn(); pass++; console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

const UF = 40000;
function ins(over: Partial<InsumosReferenciaArriendo> = {}): InsumosReferenciaArriendo {
  return {
    dorms: 3,
    tipologia: { n: 0, medianaCLP: 0 },
    comunal: { n: 100, ufM2Mes: 0.25 },
    superficieRefM2: 60,
    ufCLP: UF,
    ...over,
  };
}

console.log("\n── constantes con nombre ──");
test("umbrales: tipología 20, comunal entra 15, mantiene 10", () => {
  assert.equal(MIN_ARRIENDOS_TIPOLOGIA, 20);
  assert.equal(MIN_ARRIENDOS_COMUNAL_ENTRA, 15);
  assert.equal(MIN_ARRIENDOS_COMUNAL_MANTIENE, 10);
  assert.equal(umbralComunal(false), 15);
  assert.equal(umbralComunal(true), 10);
});
test("los factores vigentes no son el placeholder de bootstrap", () => {
  assert.notEqual(PROCEDENCIA_FACTORES_TIPOLOGIA.metodo, "placeholder");
  assert.equal(PROCEDENCIA_FACTORES_TIPOLOGIA.fecha.length, 10);
  for (const d of [1, 2, 3, 4] as const) {
    const f = FACTORES_TIPOLOGIA_ARRIENDO[d];
    assert.ok(f.factor > 0.5 && f.factor < 1.5, `${d}D factor ${f.factor}`);
    assert.ok(f.errorResidualPct > 0 && f.errorResidualPct < 50, `${d}D residual ${f.errorResidualPct}`);
  }
});
test("el 1D renta más por metro que el 4D: factor 1D > factor 4D", () => {
  assert.ok(FACTORES_TIPOLOGIA_ARRIENDO[1].factor > FACTORES_TIPOLOGIA_ARRIENDO[4].factor);
});

console.log("\n── camino 1: porTipologia ──");
test("20 arriendos de tipología → mediana de la tipología", () => {
  const r = resolverReferenciaArriendo(ins({ tipologia: { n: 20, medianaCLP: 500000.4 } }));
  assert.equal(r.fuente, "porTipologia");
  if (r.fuente === "porTipologia") {
    assert.equal(r.n, 20);
    assert.equal(r.medianaCLP, 500000);
  }
  assert.equal(arriendoDeReferencia(r), 500000);
});
test("19 arriendos de tipología → NO es porTipologia (borde 19/20)", () => {
  const r = resolverReferenciaArriendo(ins({ tipologia: { n: 19, medianaCLP: 500000 } }));
  assert.equal(r.fuente, "comunalPorM2");
});
test("la tipología manda aunque la comuna esté bajo umbral", () => {
  const r = resolverReferenciaArriendo(ins({ tipologia: { n: 25, medianaCLP: 450000 }, comunal: { n: 3, ufM2Mes: 0.2 } }));
  assert.equal(r.fuente, "porTipologia");
});
test("20 arriendos pero mediana 0 → no se publica una mediana vacía", () => {
  const r = resolverReferenciaArriendo(ins({ tipologia: { n: 20, medianaCLP: 0 } }));
  assert.notEqual(r.fuente, "porTipologia");
});

console.log("\n── camino 2: comunalPorM2 ──");
test("15 comunales sin tipología → estimado comunal (borde 14/15, entrada)", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 15, ufM2Mes: 0.25 } }));
  assert.equal(r.fuente, "comunalPorM2");
});
test("14 comunales sin tipología → insuficiente (borde 14/15, entrada)", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 14, ufM2Mes: 0.25 } }));
  assert.equal(r.fuente, "insuficiente");
  if (r.fuente === "insuficiente") {
    assert.equal(r.motivo, "comunal-bajo-umbral");
    assert.equal(r.nComunal, 14);
  }
});
test("estimado = UF/m² × sup × UF × factor, redondeado a miles", () => {
  const f = factorParaDorms(3).factor;
  const r = resolverReferenciaArriendo(ins({ dorms: 3, comunal: { n: 40, ufM2Mes: 0.25 }, superficieRefM2: 60 }));
  assert.equal(r.fuente, "comunalPorM2");
  if (r.fuente === "comunalPorM2") {
    const esperado = Math.round((0.25 * 60 * UF * f) / 1000) * 1000;
    assert.equal(r.estimadoCLP, esperado);
    assert.equal(r.estimadoCLP % 1000, 0);
    assert.equal(r.factorTipologia, f);
    assert.equal(r.nComunal, 40);
    assert.equal(r.ufM2Mes, 0.25);
    assert.equal(r.superficieRefM2, 60);
    assert.equal(arriendoDeReferencia(r), r.estimadoCLP);
  }
});
test("el rango es estimado ∓ error residual, simétrico y a miles", () => {
  const r = resolverReferenciaArriendo(ins({ dorms: 2, comunal: { n: 40, ufM2Mes: 0.3 }, superficieRefM2: 50 }));
  assert.equal(r.fuente, "comunalPorM2");
  if (r.fuente === "comunalPorM2") {
    const err = r.errorResidualPct / 100;
    assert.ok(r.rangoCLP.min < r.estimadoCLP && r.estimadoCLP < r.rangoCLP.max);
    assert.equal(r.rangoCLP.min % 1000, 0);
    assert.equal(r.rangoCLP.max % 1000, 0);
    const crudo = 0.3 * 50 * UF * r.factorTipologia;
    assert.ok(Math.abs(r.rangoCLP.min - crudo * (1 - err)) <= 500);
    assert.ok(Math.abs(r.rangoCLP.max - crudo * (1 + err)) <= 500);
  }
});
test("el factor de la tipología es el del .gen.ts, por dorms", () => {
  for (const d of [1, 2, 3, 4] as const) {
    const r = resolverReferenciaArriendo(ins({ dorms: d }));
    assert.equal(r.fuente, "comunalPorM2");
    if (r.fuente === "comunalPorM2") {
      assert.equal(r.factorTipologia, FACTORES_TIPOLOGIA_ARRIENDO[d].factor);
      assert.equal(r.errorResidualPct, FACTORES_TIPOLOGIA_ARRIENDO[d].errorResidualPct);
    }
  }
});
test("dorms fuera de 1..4 se acotan al borde (0 → 1D, 6 → 4D)", () => {
  assert.equal(factorParaDorms(0).factor, FACTORES_TIPOLOGIA_ARRIENDO[1].factor);
  assert.equal(factorParaDorms(6).factor, FACTORES_TIPOLOGIA_ARRIENDO[4].factor);
});

console.log("\n── histéresis: página entra con 15, mantiene con 10; informe seco ──");
test("10 comunales y publicaba antes → se mantiene el estimado", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 10, ufM2Mes: 0.25 }, publicabaAntes: true }));
  assert.equal(r.fuente, "comunalPorM2");
});
test("9 comunales y publicaba antes → insuficiente (borde 9/10, mantención)", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 9, ufM2Mes: 0.25 }, publicabaAntes: true }));
  assert.equal(r.fuente, "insuficiente");
});
test("14 comunales y NO publicaba antes → insuficiente (la histéresis no ayuda a entrar)", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 14, ufM2Mes: 0.25 }, publicabaAntes: false }));
  assert.equal(r.fuente, "insuficiente");
});
test("informe (sin publicabaAntes): 14 → insuficiente, 15 → comunal; 10 nunca entra", () => {
  assert.equal(resolverReferenciaArriendo(ins({ comunal: { n: 14, ufM2Mes: 0.25 } })).fuente, "insuficiente");
  assert.equal(resolverReferenciaArriendo(ins({ comunal: { n: 15, ufM2Mes: 0.25 } })).fuente, "comunalPorM2");
  assert.equal(resolverReferenciaArriendo(ins({ comunal: { n: 10, ufM2Mes: 0.25 } })).fuente, "insuficiente");
});

console.log("\n── camino 3: insuficiente con motivo ──");
test("comuna con muestra pero sin superficie de venta de la tipología", () => {
  const r = resolverReferenciaArriendo(ins({ superficieRefM2: null }));
  assert.equal(r.fuente, "insuficiente");
  if (r.fuente === "insuficiente") assert.equal(r.motivo, "sin-superficie-de-referencia");
});
test("superficie 0 cuenta como sin superficie", () => {
  const r = resolverReferenciaArriendo(ins({ superficieRefM2: 0 }));
  assert.equal(r.fuente, "insuficiente");
  if (r.fuente === "insuficiente") assert.equal(r.motivo, "sin-superficie-de-referencia");
});
test("comuna con avisos pero ninguno con superficie → sin UF/m² comunal", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 30, ufM2Mes: 0 } }));
  assert.equal(r.fuente, "insuficiente");
  if (r.fuente === "insuficiente") assert.equal(r.motivo, "sin-uf-m2-comunal");
});
test("el umbral se evalúa antes que la superficie: 14 comunales → bajo-umbral, no sin-superficie", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 14, ufM2Mes: 0.25 }, superficieRefM2: null }));
  assert.equal(r.fuente, "insuficiente");
  if (r.fuente === "insuficiente") assert.equal(r.motivo, "comunal-bajo-umbral");
});
test("insuficiente no entrega arriendo con que calcular", () => {
  const r = resolverReferenciaArriendo(ins({ comunal: { n: 0, ufM2Mes: 0 } }));
  assert.equal(arriendoDeReferencia(r), null);
});

console.log("\n── medianaArriendoUFm2Mes (pooled) ──");
test("mediana de precio/sup/UF ignorando filas sin superficie", () => {
  const v = medianaArriendoUFm2Mes(
    [
      { precio: 400000, superficie_m2: 40 },   // 0.25
      { precio: 300000, superficie_m2: 30 },   // 0.25
      { precio: 500000, superficie_m2: 100 },  // 0.125
      { precio: 999999, superficie_m2: null },
      { precio: 999999, superficie_m2: 0 },
    ],
    UF,
  );
  assert.ok(Math.abs(v - 0.25) < 1e-9, String(v));
});
test("sin filas válidas → 0; UF 0 → 0", () => {
  assert.equal(medianaArriendoUFm2Mes([{ precio: 1, superficie_m2: null }], UF), 0);
  assert.equal(medianaArriendoUFm2Mes([{ precio: 400000, superficie_m2: 40 }], 0), 0);
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? ` → ${fallidos.join(", ")}` : ""}`);
process.exit(fail ? 1 : 0);
