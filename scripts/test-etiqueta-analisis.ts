/**
 * Tests de `etiquetaAnalisis` (`src/lib/format-direccion.ts`) — la etiqueta que
 * arma el `<title>` de la pestaña y el OG de las páginas de análisis.
 *
 *   npx tsx scripts/test-etiqueta-analisis.ts
 *
 * Existe por el reporte de un título que nombraba una comuna distinta a la del
 * análisis. El barrido de las 663 filas no encontró ninguna desincronizada, así
 * que esto no repara datos: cierra la clase de bug — el título ya no puede
 * quedar rotulado con una comuna que no es la de la fila.
 */

import assert from "node:assert/strict";
import { etiquetaAnalisis } from "../src/lib/format-direccion";

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

console.log("\nEtiqueta de análisis");

test("nombre autogenerado que ya nombra su comuna se usa tal cual", () => {
  assert.equal(etiquetaAnalisis("Depto 2D1B Ñuñoa", "Ñuñoa"), "Depto 2D1B Ñuñoa");
});

test("nombre STR (dirección completa) que ya nombra su comuna se usa tal cual", () => {
  const n = "Renta Corta - Av. Irarrázaval 3450, Ñuñoa";
  assert.equal(etiquetaAnalisis(n, "Ñuñoa"), n);
});

test("nombre desincronizado: la comuna autoritativa se agrega", () => {
  assert.equal(
    etiquetaAnalisis("Depto 2D1B Providencia", "Ñuñoa"),
    "Depto 2D1B Providencia · Ñuñoa",
  );
});

test("case-insensitive: no duplica por diferencia de mayúsculas", () => {
  assert.equal(etiquetaAnalisis("Depto en LAS CONDES", "Las Condes"), "Depto en LAS CONDES");
});

test("sin nombre, se arma desde la comuna", () => {
  assert.equal(etiquetaAnalisis(null, "Macul"), "Depto en Macul");
  assert.equal(etiquetaAnalisis("   ", "Macul"), "Depto en Macul");
});

test("sin nombre ni comuna, fallback neutro", () => {
  assert.equal(etiquetaAnalisis(null, null), "Análisis de inversión");
});

test("sin comuna, el nombre manda", () => {
  assert.equal(etiquetaAnalisis("Mi depto", ""), "Mi depto");
});

test("idempotente: aplicar dos veces no vuelve a pegar la comuna", () => {
  const una = etiquetaAnalisis("Depto 2D1B Providencia", "Ñuñoa");
  assert.equal(etiquetaAnalisis(una, "Ñuñoa"), una);
});

console.log(`\n${ok} OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
