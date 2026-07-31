/**
 * Tests de `lineaConsumo` — la línea bajo el CTA final del wizard v4.
 *
 * Existe porque el copy anterior ("· 1 crédito") era FALSO para ilimitados y
 * admins, que no consumen nada. Estas ramas dependen del tier y no se pueden
 * alcanzar en el navegador sin loguearse con cada tipo de cuenta, así que se
 * cubren acá.
 *
 *   npx tsx scripts/test-linea-consumo.ts
 *
 * Mismo patrón que scripts/test-plausibilidad.ts: node:assert/strict + tsx.
 */

import assert from "node:assert/strict";
import { lineaConsumo } from "../src/components/formulario-v4/screenResumen";
import type { TierInfo } from "../src/components/formulario-v3/Paso3Modalidad";

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

const base: TierInfo = {
  tier: "free",
  isAdmin: false,
  credits: 0,
  welcomeAvailable: false,
  email: "x@y.cl",
  activePlan: null,
  isUnlimited: false,
};

console.log("\nLínea de consumo bajo el CTA");

test("plan10 con saldo 3 → 'Te quedan 3 de 10'", () => {
  const t: TierInfo = { ...base, credits: 3, activePlan: "plan10" };
  assert.equal(
    lineaConsumo(t, true, true, "ltr", "Providencia"),
    "Esto usa uno de tus análisis. Te quedan 3 de 10.",
  );
});

test("plan50 con saldo 47 → 'Te quedan 47 de 50'", () => {
  const t: TierInfo = { ...base, credits: 47, activePlan: "plan50" };
  assert.equal(
    lineaConsumo(t, true, true, "ltr", undefined),
    "Esto usa uno de tus análisis. Te quedan 47 de 50.",
  );
});

test("saldo 1 usa singular ('Te queda 1')", () => {
  const t: TierInfo = { ...base, credits: 1, activePlan: "plan10" };
  assert.equal(
    lineaConsumo(t, true, true, "ltr", undefined),
    "Esto usa uno de tus análisis. Te queda 1 de 10.",
  );
});

test("créditos sueltos (sin plan) → sin denominador", () => {
  const t: TierInfo = { ...base, credits: 2, activePlan: null };
  assert.equal(
    lineaConsumo(t, true, true, "ltr", undefined),
    "Esto usa uno de tus análisis. Te quedan 2.",
  );
});

test("welcome disponible → análisis de bienvenida (manda sobre el saldo)", () => {
  const t: TierInfo = { ...base, credits: 0, welcomeAvailable: true };
  assert.equal(
    lineaConsumo(t, true, true, "ltr", undefined),
    "Este es tu análisis de bienvenida — el primero va por cuenta de Franco.",
  );
});

test("ILIMITADO → null: el bloque no se renderiza", () => {
  const t: TierInfo = { ...base, isUnlimited: true, credits: 0 };
  assert.equal(lineaConsumo(t, true, true, "ltr", "Ñuñoa"), null);
});

test("ADMIN → null: el bloque no se renderiza", () => {
  const t: TierInfo = { ...base, isAdmin: true, credits: 0 };
  assert.equal(lineaConsumo(t, true, true, "both", "Las Condes"), null);
});

test("ilimitado gana aunque welcome siga disponible", () => {
  const t: TierInfo = { ...base, isUnlimited: true, welcomeAvailable: true };
  assert.equal(lineaConsumo(t, true, true, "ltr", undefined), null);
});

test("sin saldo → compra, con modalidad y comuna", () => {
  const t: TierInfo = { ...base, credits: 0 };
  assert.equal(
    lineaConsumo(t, true, false, "both", "Providencia"),
    "Estás comprando este análisis comparativo de Providencia. Pagas y se desbloquea al instante.",
  );
});

test("sin saldo, modalidad simple y sin comuna", () => {
  const t: TierInfo = { ...base, credits: 0 };
  assert.equal(
    lineaConsumo(t, true, false, "ltr", undefined),
    "Estás comprando este análisis. Pagas y se desbloquea al instante.",
  );
});

test("guest → rama propia, coherente con 'Crear cuenta gratis'", () => {
  // Antes decía "Después de esto, el informe es final." bajo ese botón.
  assert.equal(
    lineaConsumo(null, false, false, "ltr", "Providencia"),
    "Creas tu cuenta y el primero va por cuenta de Franco.",
  );
});

test("ningún mensaje dice 'crédito' (vocabulario de usuario)", () => {
  const casos: Array<[TierInfo | null, boolean, boolean]> = [
    [{ ...base, credits: 3, activePlan: "plan10" }, true, true],
    [{ ...base, welcomeAvailable: true }, true, true],
    [{ ...base, credits: 0 }, true, false],
    [null, false, false],
  ];
  for (const [t, logged, can] of casos) {
    const linea = lineaConsumo(t, logged, can, "ltr", "Providencia");
    if (linea) assert.ok(!/crédito/i.test(linea), `dice "crédito": ${linea}`);
  }
});

console.log(`\n${"─".repeat(56)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Línea de consumo: todos los tests pasan.");
