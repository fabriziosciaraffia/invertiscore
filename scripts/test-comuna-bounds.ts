// ─────────────────────────────────────────────────────────────────────────────
// Tests de las cajas que acotan el autocompletado (`src/lib/comuna-bounds.ts`).
//
// QUÉ PROTEGEN
// ────────────
// El 20-ago-2026 escribir "Av. Providencia 1500" con Providencia elegida
// devolvía Providencia, Ovalle, Valdivia, Arica y La Florida. El chip prometía
// acotar y no acotaba nada.
//
// La corrección es geográfica y los números viven en una tabla, así que lo que
// se puede romper en silencio es la tabla: una caja mal tipeada (signo cambiado,
// dígito de menos, sur/norte al revés) compila perfecto y deja pasar medio país
// o deja fuera a la comuna entera. Estos tests son sobre coordenadas conocidas,
// no sobre la forma del código.
//
// Correr: node --import tsx scripts/test-comuna-bounds.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { CAJA_COBERTURA, cajaParaComuna, dentroDeCaja, tieneCajaPropia } from "../src/lib/comuna-bounds";
import { COMUNAS_DISPONIBLES } from "../src/lib/comunas-disponibles";

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

function seccion(t: string) { console.log(`\n${t}`); }

/** Puntos reales, para que los tests hablen de lugares y no de números sueltos. */
const PUNTOS = {
  // Dentro de la cobertura
  providencia: [-33.4262, -70.6187],   // Av. Providencia 1234
  nunoa: [-33.4535, -70.6091],         // Av. Irarrázaval 2100
  lasCondes: [-33.4088, -70.5687],     // Apoquindo 4500
  puenteAlto: [-33.6109, -70.5756],
  // Las tres que aparecían y no deberían
  ovalle: [-30.6017, -71.1996],
  valdivia: [-39.8142, -73.2459],
  arica: [-18.4783, -70.3126],
  // Otros falsos positivos vistos en la medición
  linares: [-35.8464, -71.5931],
  vinaDelMar: [-33.0245, -71.5518],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
seccion("PISO DURO: el área cubierta, pase lo que pase");
// ─────────────────────────────────────────────────────────────────────────────

test("REGRESIÓN: Ovalle, Valdivia y Arica quedan fuera del piso", () => {
  // Los tres salían en producción con el chip de Providencia tocado.
  for (const c of ["ovalle", "valdivia", "arica"] as const) {
    const [lat, lng] = PUNTOS[c];
    assert.equal(dentroDeCaja(CAJA_COBERTURA, lat, lng), false, `${c} no puede entrar al piso`);
  }
});

test("Linares y Viña tampoco — Viña obligó a bajar el piso de la RM a la cobertura", () => {
  // Este test empezó ROJO: con una caja alrededor de la RM entera, Viña del Mar
  // caía adentro. Un rectángulo no puede excluirla, así que el piso pasó a ser
  // la unión de las comunas cubiertas, que es lo que Franco analiza de verdad.
  for (const c of ["linares", "vinaDelMar"] as const) {
    const [lat, lng] = PUNTOS[c];
    assert.equal(dentroDeCaja(CAJA_COBERTURA, lat, lng), false);
  }
});

test("sin comuna elegida NO se vuelve a 'todo Chile': cae al piso", () => {
  assert.deepEqual(cajaParaComuna(undefined), CAJA_COBERTURA);
  assert.deepEqual(cajaParaComuna(null), CAJA_COBERTURA);
  assert.deepEqual(cajaParaComuna(""), CAJA_COBERTURA);
});

test("una comuna desconocida tampoco abre la puerta: cae al piso", () => {
  assert.deepEqual(cajaParaComuna("Ovalle"), CAJA_COBERTURA);
  assert.deepEqual(cajaParaComuna("Valdivia"), CAJA_COBERTURA);
});

test("toda caja comunal está CONTENIDA en el piso", () => {
  // Es lo que hace que el piso no dependa de la comuna elegida.
  const [rs, rw, rn, re] = CAJA_COBERTURA;
  for (const c of COMUNAS_DISPONIBLES) {
    const [s, w, n, e] = cajaParaComuna(c);
    assert.ok(s >= rs && n <= rn && w >= rw && e <= re, `${c} se sale del piso`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("FILTRO POR COMUNA: el chip cumple lo que promete");
// ─────────────────────────────────────────────────────────────────────────────

test("las 24 comunas cubiertas tienen caja propia", () => {
  const sin = COMUNAS_DISPONIBLES.filter((c) => !tieneCajaPropia(c));
  assert.deepEqual(sin, [], `sin caja propia: ${sin.join(", ")}`);
});

test("cada comuna contiene su propio punto conocido", () => {
  assert.ok(dentroDeCaja(cajaParaComuna("Providencia"), ...PUNTOS.providencia));
  assert.ok(dentroDeCaja(cajaParaComuna("Ñuñoa"), ...PUNTOS.nunoa));
  assert.ok(dentroDeCaja(cajaParaComuna("Las Condes"), ...PUNTOS.lasCondes));
  assert.ok(dentroDeCaja(cajaParaComuna("Puente Alto"), ...PUNTOS.puenteAlto));
});

test("la caja de una comuna NO contiene una comuna lejana", () => {
  // Providencia y Puente Alto están a ~25 km: ninguna caja razonable las junta.
  assert.equal(dentroDeCaja(cajaParaComuna("Providencia"), ...PUNTOS.puenteAlto), false);
  assert.equal(dentroDeCaja(cajaParaComuna("Puente Alto"), ...PUNTOS.providencia), false);
});

test("los acentos y el alias del dataset no rompen el lookup", () => {
  assert.deepEqual(cajaParaComuna("Ñuñoa"), cajaParaComuna("nunoa"));
  assert.deepEqual(cajaParaComuna("Peñalolén"), cajaParaComuna("PENALOLEN"));
  assert.deepEqual(cajaParaComuna("Estación Central"), cajaParaComuna("  estacion  central "));
  // El dataset interno llama "Santiago Centro" a la comuna que Places devuelve
  // como "Santiago" (mismo alias que `comunas-disponibles.ts`).
  assert.deepEqual(cajaParaComuna("Santiago Centro"), cajaParaComuna("Santiago"));
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Sanidad de la tabla: una caja mal tipeada compila perfecto");
// ─────────────────────────────────────────────────────────────────────────────

test("sur < norte y oeste < este en TODAS las cajas", () => {
  for (const c of [...COMUNAS_DISPONIBLES, undefined]) {
    const [s, w, n, e] = cajaParaComuna(c);
    assert.ok(s < n, `${c ?? "piso"}: sur >= norte`);
    assert.ok(w < e, `${c ?? "piso"}: oeste >= este`);
  }
});

test("todas las cajas están en el hemisferio sur y al oeste de Greenwich", () => {
  // El outlier de La Florida en el dataset estaba en latitud +27,6 (Caribe);
  // por eso la tabla se generó con percentiles y no con min/max.
  for (const c of [...COMUNAS_DISPONIBLES, undefined]) {
    const [s, w, n, e] = cajaParaComuna(c);
    for (const lat of [s, n]) assert.ok(lat < 0 && lat > -60, `${c ?? "piso"}: latitud fuera de Chile`);
    for (const lng of [w, e]) assert.ok(lng < 0 && lng > -80, `${c ?? "piso"}: longitud fuera de Chile`);
  }
});

test("ninguna caja comunal es absurdamente grande", () => {
  // Media ciudad en una caja comunal sería un filtro que no filtra. La más ancha
  // medida (Lo Barnechea, que se estira hacia la cordillera) no llega a 0,25°.
  for (const c of COMUNAS_DISPONIBLES) {
    const [s, w, n, e] = cajaParaComuna(c);
    assert.ok(n - s < 0.25, `${c}: caja demasiado alta (${(n - s).toFixed(3)}°)`);
    assert.ok(e - w < 0.25, `${c}: caja demasiado ancha (${(e - w).toFixed(3)}°)`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Cajas de comuna: hay tests en rojo.");
  process.exit(1);
}
console.log("Cajas de comuna: todos los tests pasan.");
