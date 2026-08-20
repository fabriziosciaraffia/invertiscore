// ─────────────────────────────────────────────────────────────────────────────
// Tests del GRAFO del wizard v4 (`wizardV4Nodes.ts`).
//
// Por qué existe: la modalidad se mudó de la PRIMERA pantalla al final
// (19-ago-2026). El grafo es lógica pura sin React, así que se puede probar
// entero — y lo que se rompe al moverlo no es visible en `tsc` (todos los nodos
// siguen siendo `NodeId` válidos: un orden equivocado compila perfecto).
//
// Lo que estos tests fijan:
//   · dir es la primera pantalla y mod la última pregunta antes de la renta.
//   · Los actos 1 y 2 son IDÉNTICOS para las tres modalidades — es la premisa
//     que hizo barato el reordenamiento. Si alguna vez deja de serlo, mover la
//     modalidad al final pasa a ser un bug y este test lo dice.
//   · El recorrido termina en `resumen` en las tres ramas, sin ciclos.
//   · El contador y la barra no mienten en `mod` ("última pregunta" tiene que
//     ser verdad, no copy).
//
// Correr: node --import tsx scripts/test-wizard-grafo.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  computeNext,
  computePlannedPath,
  progressFor,
  stepCounter,
  type NodeId,
  type WizardV4Answers,
} from "../src/components/formulario-v4/wizardV4Nodes";

let ok = 0;
let fail = 0;

function test(nombre: string, fn: () => void) {
  try {
    fn();
    ok += 1;
    console.log(`  OK   ${nombre}`);
  } catch (e) {
    fail += 1;
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${e instanceof Error ? e.message : String(e)}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

/** Recorrido real desde la primera pantalla, siguiendo `computeNext`. */
function recorrer(a: WizardV4Answers): NodeId[] {
  const path: NodeId[] = [];
  const visto = new Set<NodeId>();
  let n: NodeId | null = "dir";
  while (n && !visto.has(n)) {
    visto.add(n);
    path.push(n);
    n = computeNext(n, a);
  }
  return path;
}

const LTR: WizardV4Answers = { modalidad: "ltr", tipoPropiedad: "usado" };
const STR: WizardV4Answers = { modalidad: "str", tipoPropiedad: "nuevo", edificioPermiteAirbnb: "si" };
const BOTH: WizardV4Answers = { modalidad: "both", tipoPropiedad: "usado", edificioPermiteAirbnb: "si" };

// ─────────────────────────────────────────────────────────────────────────────
seccion("El orden nuevo: dir primero, mod última pregunta");
// ─────────────────────────────────────────────────────────────────────────────

test("la primera pantalla es la dirección, no la modalidad", () => {
  assert.equal(recorrer(LTR)[0], "dir");
  assert.equal(computePlannedPath(LTR)[0], "dir");
});

test("plazo entrega a mod, y mod bifurca la renta", () => {
  assert.equal(computeNext("plazo", LTR), "mod");
  assert.equal(computeNext("plazo", STR), "mod", "el destino de plazo no depende de la modalidad");
  assert.equal(computeNext("mod", LTR), "arr");
  assert.equal(computeNext("mod", STR), "gate");
  assert.equal(computeNext("mod", BOTH), "arr");
});

test("mod es lo último que se pregunta antes de la rama de renta", () => {
  const path = recorrer(LTR);
  const i = path.indexOf("mod");
  assert.ok(i > 0, "mod tiene que estar en el camino");
  assert.deepEqual(path.slice(0, i), ["dir", "tipo", "ant", "tam", "precio", "pie", "tasa", "plazo"]);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("La premisa que hizo barato el reordenamiento");
// ─────────────────────────────────────────────────────────────────────────────

test("los actos 1 y 2 son idénticos en las tres modalidades", () => {
  // Mismo tipo de propiedad en las tres para aislar la variable modalidad.
  const usado = (m: WizardV4Answers["modalidad"]): NodeId[] => {
    const p = recorrer({ modalidad: m, tipoPropiedad: "usado", edificioPermiteAirbnb: "si" });
    return p.slice(0, p.indexOf("mod"));
  };
  const base = usado("ltr");
  assert.deepEqual(usado("str"), base);
  assert.deepEqual(usado("both"), base);
  assert.deepEqual(base, ["dir", "tipo", "ant", "tam", "precio", "pie", "tasa", "plazo"]);
});

test("sin modalidad elegida el camino sigue siendo navegable hasta mod", () => {
  // Es el estado REAL del usuario durante los primeros 8 pasos.
  const path = recorrer({ tipoPropiedad: "usado" });
  assert.deepEqual(path.slice(0, 9), ["dir", "tipo", "ant", "tam", "precio", "pie", "tasa", "plazo", "mod"]);
});

test("la rama de nuevo cambia ant por ent, y nada más", () => {
  const p = recorrer({ modalidad: "ltr", tipoPropiedad: "nuevo" });
  assert.deepEqual(p.slice(0, 9), ["dir", "tipo", "ent", "tam", "precio", "pie", "tasa", "plazo", "mod"]);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Las tres ramas terminan en el resumen");
// ─────────────────────────────────────────────────────────────────────────────

test("LTR: mod → arr → resumen", () => {
  assert.deepEqual(recorrer(LTR).slice(-3), ["mod", "arr", "resumen"]);
});

test("STR: mod → gate → adr → resumen", () => {
  assert.deepEqual(recorrer(STR).slice(-4), ["mod", "gate", "adr", "resumen"]);
});

test("BOTH: mod → arr → gate → adr → resumen", () => {
  assert.deepEqual(recorrer(BOTH).slice(-5), ["mod", "arr", "gate", "adr", "resumen"]);
});

test("ningún recorrido cicla ni se queda sin salida", () => {
  for (const [rot, a] of [["ltr", LTR], ["str", STR], ["both", BOTH]] as Array<[string, WizardV4Answers]>) {
    const p = recorrer(a);
    assert.equal(p[p.length - 1], "resumen", `la rama ${rot} no llegó al resumen`);
    assert.equal(new Set(p).size, p.length, `la rama ${rot} repite un nodo`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El encuadre no miente: 'última pregunta' tiene que ser verdad");
// ─────────────────────────────────────────────────────────────────────────────

test("en mod queda exactamente una pantalla de datos antes del resumen (LTR)", () => {
  const { step, total } = stepCounter("mod", LTR);
  assert.equal(total - step, 2, "mod + arr + resumen ⇒ faltan 2 saltos");
});

test("la barra en mod está por encima del 75%", () => {
  const pct = progressFor("mod", LTR);
  assert.ok(pct >= 0.75, `la barra marcaba ${Math.round(pct * 100)}%, y el copy promete que queda poco`);
  assert.ok(pct < 1, "todavía no es el final");
});

test("la barra avanza monótona a lo largo del camino planificado", () => {
  const path = computePlannedPath(LTR);
  let previo = -1;
  for (const n of path) {
    const p = progressFor(n, LTR);
    assert.ok(p > previo, `la barra retrocedió en ${n}`);
    previo = p;
  }
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Grafo del wizard: hay tests en rojo.");
  process.exit(1);
}
console.log("Grafo del wizard: todos los tests pasan.");
