/**
 * Tests de `esEdicionReal` (`src/components/formulario-v4/derive.ts`).
 *
 * Es la pregunta que decide si un commit del resumen cuenta como corrección del
 * usuario. Antes no existía: los campos commiteaban en blur, y el blur ocurre
 * igual cuando alguien solo mira el campo y sale con un click o con Tab. Ese
 * paseo marcaba "corregido por ti" sobre un número puesto por Franco, emitía
 * `wizard4_edit_from_summary` a PostHog, borraba la nota de cascada y forzaba
 * `arrModo: "corregir"`, que en el dry-run saca al arriendo del set de sensibles.
 *
 *   npx tsx scripts/test-edicion-real.ts
 *
 * Mismo patrón que test-numeric-input.ts / test-numero-cl.ts: node:assert/strict
 * sobre el MÓDULO REAL. La conducta vive fuera del componente justamente para
 * esto — el repo no tiene runner de React, así que testear el componente sería
 * testear una réplica.
 */

import assert from "node:assert/strict";
import { esEdicionReal } from "../src/components/formulario-v4/derive";
import { estadoNumericInput } from "../src/components/formulario-v4/NumericInput";
import { DEC } from "../src/components/formulario-v4/wizardV4Nodes";
import { evaluarPlausibilidad } from "../src/lib/plausibilidad";

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

console.log("\nesEdicionReal — el blur no es una corrección\n");

// ── El bug que originó esto ──────────────────────────────────────────────────

test("mismo texto, sin tocar nada → NO es edición", () => {
  assert.equal(esEdicionReal("820.000", "820.000", DEC.arriendo), false);
});

test("mismo valor con otro formato de miles → NO es edición", () => {
  // El caso exacto del resumen: `raw` llega como String(sugArriendo) sin puntos
  // y el input lo devuelve formateado (o al revés). Comparar textos daría true.
  assert.equal(esEdicionReal("820000", "820.000", DEC.arriendo), false);
  assert.equal(esEdicionReal("820.000", "820000", DEC.arriendo), false);
});

test("default no persistido reescrito igual → NO es edición", () => {
  // Vacancia: raw={a.vacanciaPct ?? "5"}. Entrar y salir commiteaba "5" y el
  // campo pasaba de undefined a string, con lo que aparecía el tag.
  assert.equal(esEdicionReal("5", "5", DEC.vacancia), false);
});

test("decimal irrelevante para la precisión del campo → NO es edición", () => {
  // DEC.vacancia = 1: 5 y 5,0 son el mismo número.
  assert.equal(esEdicionReal("5,0", "5", DEC.vacancia), false);
  // DEC.arriendo = 0: los decimales no se leen.
  assert.equal(esEdicionReal("820.000", "820.000", DEC.arriendo), false);
});

test("tasa: coma y punto decimal son el mismo número", () => {
  assert.equal(esEdicionReal("4,72", "4.72", DEC.tasa), false);
});

// ── Lo que SÍ debe contar ────────────────────────────────────────────────────

test("valor distinto → SÍ es edición", () => {
  assert.equal(esEdicionReal("7", "5", DEC.vacancia), true);
  assert.equal(esEdicionReal("900.000", "820.000", DEC.arriendo), true);
});

test("diferencia dentro de la precisión del campo → SÍ es edición", () => {
  // DEC.tasa = 2: 4,72 y 4,73 son distintos.
  assert.equal(esEdicionReal("4,73", "4,72", DEC.tasa), true);
});

test("borrar un campo que tenía valor → SÍ es edición", () => {
  // El usuario quiso vaciarlo. Ahí el valor cambió de verdad.
  assert.equal(esEdicionReal("", "820.000", DEC.arriendo), true);
});

test("escribir sobre un campo vacío → SÍ es edición", () => {
  assert.equal(esEdicionReal("820.000", "", DEC.arriendo), true);
});

// ── Bordes del 0 de leerNum ──────────────────────────────────────────────────

test("texto ilegible sobre campo vacío → NO es edición", () => {
  // leerNum devuelve 0 tanto para vacío como para ilegible. Buscado: no queremos
  // marcar como corregido un campo donde el usuario no dejó un número.
  assert.equal(esEdicionReal("82o.ooo", "", DEC.arriendo), false);
  assert.equal(esEdicionReal("abc", "", DEC.arriendo), false);
});

test("texto ilegible sobre campo con valor → SÍ es edición", () => {
  // Acá el commit debe pasar: el campo queda en estado de error visible y el
  // usuario tiene que resolverlo. Conducta previa, preservada a propósito.
  assert.equal(esEdicionReal("82o.ooo", "820.000", DEC.arriendo), true);
});

test("dos campos vacíos → NO es edición", () => {
  assert.equal(esEdicionReal("", "", DEC.arriendo), false);
});

test("cero explícito sobre campo vacío → NO es edición (limitación conocida)", () => {
  // `leerNum` colapsa vacío e ilegible en 0, así que un 0 tecleado sobre un
  // campo vacío no se distingue de no haber escrito. Solo afecta a campos cuyo
  // 0 es un dato declarado; hoy el único es el pie, que tiene su propia marca
  // (`pieDeclarado` mira el texto crudo, no este número).
  assert.equal(esEdicionReal("0", "", DEC.pieCLP), false);
});

// ── Simetría ─────────────────────────────────────────────────────────────────

test("la pregunta es simétrica", () => {
  const casos: Array<[string, string, typeof DEC.arriendo | typeof DEC.tasa]> = [
    ["820.000", "820000", DEC.arriendo],
    ["900.000", "820.000", DEC.arriendo],
    ["4,72", "4,73", DEC.tasa],
  ];
  for (const [a, b, d] of casos) {
    assert.equal(esEdicionReal(a, b, d), esEdicionReal(b, a, d), `asimetría en ${a} vs ${b}`);
  }
});

// ── Cruce con el aviso de escala ─────────────────────────────────────────────
//
// Las dos conductas llegaron por ramas distintas y se tocan en el mismo campo:
// una decide si el commit se propaga, la otra avisa cuando el número está fuera
// de escala. La pregunta era si bloquear el commit puede tragarse el aviso.
//
// No puede, y esta es la razón, congelada en un test: el aviso es función del
// VALOR, no del commit. `estadoNumericInput` lo calcula en vivo desde el texto
// que se está escribiendo y en reposo desde `raw`. Si el número no cambió —el
// único caso en que `esEdicionReal` bloquea—, el aviso que corresponde es el
// mismo que ya se estaba mostrando.

test("bloquear el commit NO se traga el aviso de escala", () => {
  const escalaArriendo = (v: number) => {
    const a = evaluarPlausibilidad({ precioUF: NaN, superficieM2: NaN, ufCLP: NaN, arriendoMensualCLP: v })
      .find((x) => x.campo === "arriendo");
    return a ? { mensaje: a.mensaje, sobreMaximo: a.valor > a.rango[1] } : null;
  };
  const eco = (v: number) => `$${v}`;

  // Un arriendo bajo el piso, reescrito con otro formato: mismo número.
  const previo = "40000";
  const escrito = "40.000";

  assert.equal(esEdicionReal(escrito, previo, DEC.arriendo), false, "el commit debería bloquearse");

  const enVivo = estadoNumericInput(escrito, { decimales: DEC.arriendo, blurred: false, formatEco: eco, escala: escalaArriendo });
  const enReposo = estadoNumericInput(previo, { decimales: DEC.arriendo, blurred: true, formatEco: eco, escala: escalaArriendo });

  // Desde el fix del prefijo (19-ago-2026) los dos momentos ya NO son iguales, y
  // esa asimetría es la conducta buscada: $40.000 está bajo el piso del arriendo,
  // así que mientras se escribe puede ser todavía el prefijo de $400.000 y el
  // campo se calla. El commit sigue bloqueado igual — son dos mecanismos
  // distintos— y al soltar el campo el aviso aparece, que es lo que este test
  // protege: bloquear el commit no puede hacer desaparecer el aviso EN REPOSO.
  assert.equal(enVivo.estado, "ok", "mientras escribe, un valor bajo el piso puede ser un prefijo");
  assert.equal(enReposo.estado, "escala", "en reposo el aviso aparece pese al commit bloqueado");
  assert.equal(
    enReposo.estado === "escala" ? enReposo.aviso : "",
    escalaArriendo(40000)?.mensaje ?? "",
    "y es exactamente el aviso del guard, sin copy duplicado",
  );
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("esEdicionReal: todos los tests pasan.");
