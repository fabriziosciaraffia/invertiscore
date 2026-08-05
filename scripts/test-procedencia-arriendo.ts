/**
 * Tests de la procedencia del arriendo (`src/components/formulario-v4/derive.ts`).
 *
 * Dos caras de la misma información:
 *   · `fuenteArriendoLine`      — frase completa, se ve con el editor abierto.
 *   · `procedenciaArriendoCorta` — línea comprimida, visible EN REPOSO.
 *
 * Lo que estos tests protegen es que ninguna de las dos afirme más de lo que el
 * dato aguanta. La versión anterior miraba solo el tamaño de la muestra y podía
 * decir "194 arriendos comparables publicados en la zona" sobre un número traído
 * de la comuna entera; ahora manda el nivel que declaró el endpoint.
 *
 *   npx tsx scripts/test-procedencia-arriendo.ts
 *
 * Mismo patrón que test-numeric-input.ts: node:assert/strict sobre el módulo real.
 */

import assert from "node:assert/strict";
import { fuenteArriendoLine, procedenciaArriendoCorta } from "../src/components/formulario-v4/derive";

// ── Runner mínimo ────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const fallidos: string[] = [];

function test(nombre: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  OK   ${nombre}`);
  } catch (e) {
    fail++;
    fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
}

console.log("\nProcedencia del arriendo — el nivel manda, no el n\n");

// ── Línea corta (modo lectura) ───────────────────────────────────────────────

test("radio con muestra robusta → n + distancia, sin caveat", () => {
  assert.equal(procedenciaArriendoCorta("radio", 29, 750, 820000, false), "29 arriendos a 750 m");
});

test("radio con muestra chica → lleva el caveat", () => {
  assert.equal(procedenciaArriendoCorta("radio", 4, 2000, 780000, false), "solo 4 arriendos a 2 km — muestra chica");
});

test("un solo comparable → singular", () => {
  assert.equal(procedenciaArriendoCorta("radio", 1, 500, 700000, false), "solo 1 arriendo a 500 m — muestra chica");
});

test("sin dato → lo dice, no queda mudo", () => {
  assert.equal(procedenciaArriendoCorta("sin-dato", 0, null, null, true), "sin arriendos publicados cerca para comparar");
});

test("n=0 con fuente radio también cuenta como sin dato", () => {
  // Defensa: si el endpoint dijera "radio" con muestra vacía, no afirmamos nada.
  assert.equal(procedenciaArriendoCorta("radio", 0, 750, null, false), "sin arriendos publicados cerca para comparar");
});

test("corregido → muestra la sugerencia descartada", () => {
  assert.equal(procedenciaArriendoCorta("radio", 29, 750, 820000, true), "29 arriendos a 750 m marcan $820.000");
});

test("corregido con muestra chica → gana el contraste, no el caveat", () => {
  // Con el valor ya reemplazado, el caveat de muestra chica no aporta: lo que
  // importa es contra qué se compara el número que puso el usuario.
  assert.equal(procedenciaArriendoCorta("radio", 3, 1000, 700000, true), "3 arriendos a 1 km marcan $700.000");
});

test("corregido sin sugerencia válida → cae a la forma normal", () => {
  assert.equal(procedenciaArriendoCorta("radio", 29, 750, null, true), "29 arriendos a 750 m");
  assert.equal(procedenciaArriendoCorta("radio", 29, 750, 0, true), "29 arriendos a 750 m");
});

test("fuente comuna → dice comuna, nunca distancia", () => {
  // El arriendo no usa este nivel desde 2026-08-04, pero el tipo lo admite y la
  // frase no debe mentir si alguna vez vuelve.
  assert.equal(procedenciaArriendoCorta("comuna", 194, null, 326000, false), "194 arriendos de la comuna");
});

test("radio sin radiusUsed → no inventa distancia", () => {
  assert.equal(procedenciaArriendoCorta("radio", 29, null, 820000, false), "29 arriendos en la zona");
});

test("formato de distancia: metros bajo 1 km, coma decimal arriba", () => {
  assert.match(procedenciaArriendoCorta("radio", 12, 750, 1, false)!, /750 m$/);
  assert.match(procedenciaArriendoCorta("radio", 12, 1000, 1, false)!, /1 km$/);
  assert.match(procedenciaArriendoCorta("radio", 12, 1500, 1, false)!, /1,5 km$/);
  assert.match(procedenciaArriendoCorta("radio", 12, 2000, 1, false)!, /2 km$/);
});

// ── Frase completa (modo edición) ────────────────────────────────────────────

test("frase completa: robusta nombra el radio real", () => {
  assert.equal(
    fuenteArriendoLine("radio", 29, 750),
    "mediana de 29 arriendos publicados a menos de 750 m de la dirección",
  );
});

test("frase completa: muestra chica pide ajustarlo", () => {
  assert.match(fuenteArriendoLine("radio", 4, 2000), /muestra chica/);
  assert.match(fuenteArriendoLine("radio", 4, 2000), /a menos de 2 km/);
});

test("frase completa: comuna se declara como comuna", () => {
  assert.match(fuenteArriendoLine("comuna", 194, null), /comuna completa/);
  assert.doesNotMatch(fuenteArriendoLine("comuna", 194, null), /de la dirección/);
});

test("frase completa: sin dato no promete un número", () => {
  assert.match(fuenteArriendoLine("sin-dato", 0, null), /el valor lo pones tú/);
});

// ── Coherencia entre las dos ─────────────────────────────────────────────────

test("las dos coinciden en cuándo NO hay dato", () => {
  const casos: Array<[Parameters<typeof fuenteArriendoLine>[0], number]> = [
    ["sin-dato", 0], ["sin-dato", 29], ["radio", 0], ["comuna", 0],
  ];
  for (const [fuente, n] of casos) {
    const corta = procedenciaArriendoCorta(fuente, n, 750, 820000, false);
    const larga = fuenteArriendoLine(fuente, n, 750);
    assert.equal(
      corta === "sin arriendos publicados cerca para comparar",
      larga.startsWith("sin arriendos"),
      `desacuerdo en (${fuente}, n=${n}): corta="${corta}" larga="${larga}"`,
    );
  }
});

test("la corta nunca es más larga que la completa", () => {
  const combos: Array<[Parameters<typeof fuenteArriendoLine>[0], number, number | null]> = [
    ["radio", 29, 750], ["radio", 4, 2000], ["radio", 1, 500], ["comuna", 194, null],
  ];
  for (const [f, n, r] of combos) {
    const corta = procedenciaArriendoCorta(f, n, r, 820000, false)!;
    const larga = fuenteArriendoLine(f, n, r);
    assert.ok(corta.length < larga.length, `"${corta}" (${corta.length}) no es más corta que "${larga}" (${larga.length})`);
  }
});

test("ninguna de las dos dice 'en la zona' cuando el dato es comunal", () => {
  // El bug original en una línea: afirmar cercanía sobre una mediana de comuna.
  assert.doesNotMatch(procedenciaArriendoCorta("comuna", 194, 750, 1, false)!, /en la zona|a \d/);
  assert.doesNotMatch(fuenteArriendoLine("comuna", 194, 750), /en la zona|a menos de/);
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Procedencia del arriendo: todos los tests pasan.");
