/**
 * Tests de la FUENTE de la referencia de arriendo (`src/lib/arriendo-referencia.ts`).
 *
 *   npx tsx scripts/test-arriendo-referencia-fuente.ts
 *
 * Cero red, cero DB: las funciones son puras. Mismo patrón que
 * `scripts/test-procedencia-arriendo.ts`.
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO: la referencia que llega al informe LTR
 * dice de dónde salió (radio · comuna · comuna-m2), las filas anteriores al
 * campo `arriendoFuente` se leen como radio (que es lo que eran), el rótulo
 * nombra cada fuente por lo que es, y un estimado desde el m² comunal NUNCA es
 * contrastable: no alimenta anomalías, corte de apuesta ni precio-justo. La
 * procedencia (estimación de Franco vs declarado) sigue derivándose por
 * igualdad con cualquier fuente.
 */

import assert from "node:assert/strict";
import {
  esReferenciaContrastable,
  resolverArriendoReferencia,
  resolverProcedenciaArriendo,
  rotuloArriendoReferencia,
} from "../src/lib/arriendo-referencia";

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

const radioViejo = { zonaRadio: { arriendoPromedio: 650000, sampleSizeArriendo: 29, radioMetros: 750 } };
const radio = { zonaRadio: { ...radioViejo.zonaRadio, arriendoFuente: "radio" } };
const comuna = { zonaRadio: { arriendoPromedio: 520000, sampleSizeArriendo: 43, radioMetros: 500, arriendoFuente: "comuna" } };
const comunaM2 = {
  zonaRadio: {
    arriendoPromedio: 700000, sampleSizeArriendo: 15, radioMetros: 500,
    arriendoFuente: "comuna-m2", arriendoRangoMin: 587000, arriendoRangoMax: 813000,
  },
};

console.log("\n── resolución de la fuente ──");
test("fila vieja sin arriendoFuente → radio (lo que era)", () => {
  const r = resolverArriendoReferencia(radioViejo)!;
  assert.equal(r.fuente, "radio");
  assert.equal(r.valorCLP, 650000);
  assert.equal(r.n, 29);
  assert.equal(r.rangoCLP, undefined);
});
test("fuente explícita radio / comuna / comuna-m2", () => {
  assert.equal(resolverArriendoReferencia(radio)!.fuente, "radio");
  assert.equal(resolverArriendoReferencia(comuna)!.fuente, "comuna");
  assert.equal(resolverArriendoReferencia(comunaM2)!.fuente, "comuna-m2");
});
test("una fuente desconocida cae a radio, no rompe", () => {
  const r = resolverArriendoReferencia({ zonaRadio: { ...radio.zonaRadio, arriendoFuente: "seed" } })!;
  assert.equal(r.fuente, "radio");
});
test("comuna-m2 trae su rango, redondeado", () => {
  const r = resolverArriendoReferencia(comunaM2)!;
  assert.deepEqual(r.rangoCLP, { min: 587000, max: 813000 });
});
test("comuna-m2 sin rango válido → referencia sin rango, no null", () => {
  const r = resolverArriendoReferencia({ zonaRadio: { ...comunaM2.zonaRadio, arriendoRangoMin: null, arriendoRangoMax: null } })!;
  assert.equal(r.fuente, "comuna-m2");
  assert.equal(r.rangoCLP, undefined);
});
test("el rango solo se lee con fuente comuna-m2", () => {
  const r = resolverArriendoReferencia({ zonaRadio: { ...radio.zonaRadio, arriendoRangoMin: 1, arriendoRangoMax: 2 } })!;
  assert.equal(r.rangoCLP, undefined);
});
test("sin arriendoPromedio no hay referencia, con cualquier fuente", () => {
  assert.equal(resolverArriendoReferencia({ zonaRadio: { arriendoPromedio: null, arriendoFuente: "comuna-m2" } }), null);
  assert.equal(resolverArriendoReferencia({ zonaRadio: { arriendoPromedio: 0, arriendoFuente: "radio" } }), null);
  assert.equal(resolverArriendoReferencia({}), null);
});

console.log("\n── contrastabilidad: el estimado sugiere, no reprocha ──");
test("radio y comuna contrastan; comuna-m2 no", () => {
  assert.equal(esReferenciaContrastable(resolverArriendoReferencia(radioViejo)!), true);
  assert.equal(esReferenciaContrastable(resolverArriendoReferencia(radio)!), true);
  assert.equal(esReferenciaContrastable(resolverArriendoReferencia(comuna)!), true);
  assert.equal(esReferenciaContrastable(resolverArriendoReferencia(comunaM2)!), false);
});

console.log("\n── procedencia: igualdad exacta, con cualquier fuente ──");
test("el usuario aceptó el estimado comunal → estimacion_franco", () => {
  assert.equal(resolverProcedenciaArriendo(700000, resolverArriendoReferencia(comunaM2)), "estimacion_franco");
});
test("el usuario puso otro valor sobre un estimado → declarado_usuario", () => {
  assert.equal(resolverProcedenciaArriendo(750000, resolverArriendoReferencia(comunaM2)), "declarado_usuario");
});
test("sin referencia → sin_registro", () => {
  assert.equal(resolverProcedenciaArriendo(750000, null), "sin_registro");
});

console.log("\n── rótulo: cada fuente se llama por su nombre ──");
test("radio: comparables en un radio, con n", () => {
  const t = rotuloArriendoReferencia(resolverArriendoReferencia(radio)!);
  assert.match(t, /29 arriendos comparables publicados en un radio de 750m/);
});
test("comuna: mediana de la tipología en la comuna entera, no del radio", () => {
  const t = rotuloArriendoReferencia(resolverArriendoReferencia(comuna)!);
  assert.match(t, /43 arriendos publicados de esta tipología en la comuna entera/);
  assert.match(t, /no del radio del depto/);
  assert.doesNotMatch(t, /comparables/);
});
test("comuna-m2: estimación desde el metro cuadrado, con rango", () => {
  const t = rotuloArriendoReferencia(resolverArriendoReferencia(comunaM2)!);
  assert.match(t, /^estimación desde el metro cuadrado de 15 arriendos publicados en la comuna/);
  assert.match(t, /ajustada por tipología/);
  assert.match(t, /rango \$587\.000 a \$813\.000/);
  assert.doesNotMatch(t, /mediana|comparables/);
});
test("comuna-m2 sin rango: sigue diciendo estimación, sin inventar rango", () => {
  const t = rotuloArriendoReferencia({ valorCLP: 700000, n: 15, radioMetros: 500, fuente: "comuna-m2" });
  assert.match(t, /^estimación desde el metro cuadrado/);
  assert.doesNotMatch(t, /rango/);
});
test("ningún rótulo dice 'referencia de zona' a secas", () => {
  for (const c of [radioViejo, radio, comuna, comunaM2]) {
    assert.doesNotMatch(rotuloArriendoReferencia(resolverArriendoReferencia(c)!), /referencia de zona/);
  }
});

console.log(`\n${pass} OK · ${fail} FAIL${fail ? ` → ${fallidos.join(", ")}` : ""}`);
process.exit(fail ? 1 : 0);
