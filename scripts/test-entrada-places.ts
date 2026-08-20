// ─────────────────────────────────────────────────────────────────────────────
// Tests de la pantalla de entrada del wizard v4 (`entradaPlaces.ts`).
//
// EL BUG QUE ESTOS TESTS EXISTEN PARA QUE NO VUELVA
// ─────────────────────────────────────────────────
// El 19-ago-2026 la portada hizo condicional el `<input>` de dirección: solo
// existe en el estado 2. El efecto que engancha Google Places tenía el guard
// `if (acRef.current) return`, que sobrevive al desmontaje del input — así que
// al volver al estado 2 el widget seguía atado a un nodo muerto. No aparecía el
// desplegable, `direccionConfirmada` nunca se seteaba y Continuar quedaba
// bloqueado con "elige de la lista de sugerencias".
//
// Estuvo un día en producción y atrapó al ~19% de quienes tipearon (8 de 43
// sesiones el 20-ago). `tsc` no podía verlo: comparar un ref contra otro
// compila perfecto. Por eso la decisión salió del hook a un módulo propio.
//
// El primer test de `decidirEnganche` es EL bug: contra el código anterior
// habría dado "ya-atado" (el guard viejo) en vez de "reatar".
//
// Correr: node --import tsx scripts/test-entrada-places.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { decidirEnganche, derivarComuna, plano } from "../src/components/formulario-v4/entradaPlaces";

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

// Nodos simulados: la decisión solo compara identidad, no toca el DOM.
const nodoA = { id: "input-1" };
const nodoB = { id: "input-2" };

// ─────────────────────────────────────────────────────────────────────────────
seccion("decidirEnganche — el widget sigue al nodo vivo");
// ─────────────────────────────────────────────────────────────────────────────

test("REGRESIÓN: el input se remontó → hay que RE-ATAR, no callarse", () => {
  // Este es el bug exacto. El guard viejo veía "ya hay instancia" y se iba por
  // el return, dejando Places atado al input desmontado.
  const accion = decidirEnganche({ tieneInstancia: true, nodoAtado: nodoA, nodoVivo: nodoB });
  assert.equal(accion, "reatar");
});

test("primer montaje → atar", () => {
  assert.equal(decidirEnganche({ tieneInstancia: false, nodoAtado: null, nodoVivo: nodoA }), "atar");
});

test("mismo nodo → ya-atado (no re-crear el widget en cada render)", () => {
  assert.equal(decidirEnganche({ tieneInstancia: true, nodoAtado: nodoA, nodoVivo: nodoA }), "ya-atado");
});

test("el input no está montado → sin-nodo", () => {
  assert.equal(decidirEnganche({ tieneInstancia: false, nodoAtado: null, nodoVivo: null }), "sin-nodo");
  assert.equal(decidirEnganche({ tieneInstancia: true, nodoAtado: nodoA, nodoVivo: null }), "sin-nodo");
});

test("la secuencia completa del bug: estado 2 → 3 → 2", () => {
  // Se simula lo que hace el efecto con su propio estado, como en la pantalla.
  let instancia: object | null = null;
  let atado: object | null = null;
  const paso = (vivo: object | null) => {
    const a = decidirEnganche({ tieneInstancia: !!instancia, nodoAtado: atado, nodoVivo: vivo });
    if (a === "atar" || a === "reatar") { instancia = {}; atado = vivo; }
    return a;
  };
  assert.equal(paso(nodoA), "atar", "entra al estado 2");
  assert.equal(paso(nodoA), "ya-atado", "re-render sin cambios");
  assert.equal(paso(null), "sin-nodo", "se va al estado 3 y el input se desmonta");
  assert.equal(paso(nodoB), "reatar", "vuelve al estado 2 con un nodo NUEVO");
  assert.equal(paso(nodoB), "ya-atado", "y queda estable");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("derivarComuna — la dirección manda sobre el chip");
// ─────────────────────────────────────────────────────────────────────────────

test("corrige el chip cuando la dirección es de otra comuna", () => {
  // Caso real medido contra /api/geocode: se pidió con comuna=Providencia y el
  // geocodificador devolvió Ñuñoa.
  const d = derivarComuna("Av. Irarrázaval 2100, Ñuñoa, Región Metropolitana, Chile", "Providencia");
  assert.equal(d.comuna, "Ñuñoa");
  assert.equal(d.cubierta, true);
  assert.equal(d.corrigioAlChip, true);
});

test("confirma el chip cuando coinciden", () => {
  const d = derivarComuna(
    "Av. Providencia 1234, 7500571 Providencia, Santiago, Región Metropolitana, Chile",
    "Providencia",
  );
  assert.equal(d.comuna, "Providencia");
  assert.equal(d.corrigioAlChip, false);
});

test("gana el nombre MÁS LARGO — 'Santiago' aparece en casi toda dirección de la RM", () => {
  // Sin esa regla, "Santiago" (que va en la cola de casi todo formattedAddress)
  // le ganaría a la comuna real y mandaría todo a la comuna equivocada.
  const d = derivarComuna("Apoquindo 4500, Las Condes, Santiago, Región Metropolitana, Chile", "Santiago");
  assert.equal(d.comuna, "Las Condes");
});

test("comuna fuera de cobertura: se reporta como tal, no se inventa", () => {
  const d = derivarComuna("Av. Libertad 1200, Viña del Mar, Valparaíso, Chile", "Providencia");
  assert.equal(d.cubierta, false, "Viña no está cubierta y el flujo tiene que rechazarla");
});

test("sin coincidencia se conserva la elegida (mejor que inventar una)", () => {
  const d = derivarComuna("Calle sin nombre 123", "Macul");
  assert.equal(d.comuna, "Macul");
  assert.equal(d.corrigioAlChip, false);
});

test("los acentos no rompen la comparación", () => {
  assert.equal(plano("Ñuñoa"), "nunoa");
  assert.equal(plano("  ESTACIÓN  Central "), "estación  central".normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  assert.equal(derivarComuna("Av. Grecia 1000, Nunoa, Chile", "Providencia").comuna, "Ñuñoa");
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Pantalla de entrada: hay tests en rojo.");
  process.exit(1);
}
console.log("Pantalla de entrada: todos los tests pasan.");
