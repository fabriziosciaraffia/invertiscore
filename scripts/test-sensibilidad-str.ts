/**
 * Tests de las bandas de SENSIBILIDAD_STR (`src/lib/sensibilidad-str-hallazgo.ts`).
 *
 * Sin framework de testing: `node:assert/strict` + tsx, mismo patrón que
 * `scripts/test-plausibilidad.ts`.
 *
 *   npx tsx scripts/test-sensibilidad-str.ts
 *
 * Lo que estos tests fijan es la TERCERA banda: sobre 130% del nivel de mercado
 * (el mismo corte con el que Gate-1 fuerza BUSCAR OTRA) la frase ya no puede
 * decir "margen apretado". Necesitar el 159% de lo que rinde la zona no es un
 * margen: es una condición que el motor ya declaró inviable.
 */

import assert from "node:assert/strict";
import {
  buildHallazgoSensibilidadStr,
  BE_STR_CORTE_FAVORABLE,
  BE_STR_CORTE_FRAGIL,
  BE_STR_CORTE_INVIABLE,
} from "../src/lib/sensibilidad-str-hallazgo";

let ok = 0;
let fail = 0;
function test(nombre: string, fn: () => void): void {
  try {
    fn();
    ok++;
    console.log(`  OK   ${nombre}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL ${nombre}\n       ${(e as Error).message.split("\n")[0]}`);
  }
}

const build = (pct: number) =>
  buildHallazgoSensibilidadStr({ breakEvenPctDelMercado: pct / 100, modalidad: "str" });

console.log("\nBandas de break-even");

test("holgado (<100%) — favorable, habla de colchón", () => {
  const h = build(88)!;
  assert.equal(h.direccion, "favorable");
  assert.match(h.fraseCanonica, /colchón/);
  assert.equal(h.valor.beRatioPct, 88);
});

test("borde [100,110] — favorable, sin colchón", () => {
  const h = build(105)!;
  assert.equal(h.direccion, "favorable");
  assert.match(h.fraseCanonica, /justo en el borde/);
});

test("frágil (110,130] — adverso, sí dice margen apretado", () => {
  const h = build(120)!;
  assert.equal(h.direccion, "adverso");
  assert.match(h.fraseCanonica, /margen apretado/);
  assert.doesNotMatch(h.fraseCanonica, /No es un margen apretado/);
});

test("inviable (>130) — adverso y NIEGA el margen apretado", () => {
  const h = build(159)!;
  assert.equal(h.direccion, "adverso");
  assert.match(h.fraseCanonica, /No es un margen apretado/);
  assert.match(h.titular, /No cuadra al nivel que rinde la zona/);
});

test("inviable — cuantifica el exceso sobre la zona (159 ⇒ 59%)", () => {
  const h = build(159)!;
  assert.match(h.fraseCanonica, /el 159% del nivel de mercado/);
  assert.match(h.fraseCanonica, /un 59% por sobre lo que rinde la zona/);
});

test("el caso extremo del corpus (308%) no minimiza", () => {
  const h = build(308)!;
  assert.match(h.fraseCanonica, /No es un margen apretado/);
  assert.match(h.fraseCanonica, /un 208% por sobre/);
});

console.log("\nBordes exactos (el redondeo decide ANTES que la rama)");

test("130 exacto sigue siendo frágil, 131 ya es inviable", () => {
  assert.match(build(130)!.fraseCanonica, /Es un margen apretado/);
  assert.match(build(131)!.fraseCanonica, /No es un margen apretado/);
});

test("110 exacto es borde; 111 es frágil", () => {
  assert.match(build(110)!.fraseCanonica, /justo en el borde/);
  assert.match(build(111)!.fraseCanonica, /Es un margen apretado/);
});

test("el float 1,10×100 = 110,0000001 no se cuela a la banda adversa", () => {
  const h = buildHallazgoSensibilidadStr({ breakEvenPctDelMercado: 1.1000000001, modalidad: "str" })!;
  assert.equal(h.valor.beRatioPct, 110);
  assert.equal(h.direccion, "favorable");
});

console.log("\nContrato del hallazgo");

test("los tres cortes viajan en `valor` (los lee el render)", () => {
  const h = build(159)!;
  assert.equal(h.valor.corteFavorable, BE_STR_CORTE_FAVORABLE);
  assert.equal(h.valor.corteFragil, BE_STR_CORTE_FRAGIL);
  assert.equal(h.valor.corteInviable, BE_STR_CORTE_INVIABLE);
});

test("sigue siendo SOLO-LECTURA (decisividad 0)", () => {
  assert.equal(build(159)!.decisividad, 0);
  assert.equal(build(88)!.decisividad, 0);
});

test("break-even no computable ⇒ null", () => {
  assert.equal(buildHallazgoSensibilidadStr({ breakEvenPctDelMercado: NaN, modalidad: "str" }), null);
});

console.log(`\n${ok} OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
