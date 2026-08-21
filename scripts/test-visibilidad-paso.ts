// ─────────────────────────────────────────────────────────────────────────────
// Tests de la contabilidad interrupción-vs-abandono (`visibilidadPaso.ts`).
//
// EL NÚMERO QUE ESTOS TESTS EXISTEN PARA QUE NO VUELVA
// ────────────────────────────────────────────────────
// La portada marcaba ~41% de "abandono" contra 25% de la pantalla anterior. Al
// desglosar: 44 de sus 45 abandonos eran `tab_oculta_sin_retorno` —"cambió de
// app"— contra UNO de navegación, y las pantallas rápidas del wizard (medianas
// de 2-3 s) marcaban CERO. Entre esas "salidas" había dwells de 4.241 s y
// 1.465 s: pestañas olvidadas, no gente frustrada.
//
// El umbral de 30 s contaba la vida normal de un teléfono como abandono, y lo
// hacía con más fuerza en las pantallas que MÁS retienen — que es donde el
// número importaba.
//
// Lo que se prueba acá es la decisión, no el DOM: la contabilidad es pura y
// vive fuera del hook justo para poder probarla (misma razón que
// `entradaPlaces.ts`). Los dos primeros tests son la regresión: contra la regla
// vieja daban "abandono".
//
// Correr: node --import tsx scripts/test-visibilidad-paso.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  ESQUEMA_SALIDA,
  MS_OCULTA_NO_VOLVIO,
  alMostrar,
  alOcultar,
  clasificar,
  dwellActivoMs,
  nuevaVisibilidad,
  ocultaMsTotal,
  propsVisibilidad,
} from "../src/components/formulario-v4/visibilidadPaso";

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

const S = 1000;
const MIN = 60 * S;
/** t0 arbitrario y fijo: los tests hablan de duraciones, no de relojes. */
const T0 = 1_700_000_000_000;

/**
 * LA REGLA VIEJA, para que la comparación esté en el repo y no en un reporte.
 * `if (oculta > 30s) → "tab_oculta_sin_retorno"`, decidido al vencer el timer y
 * sin mirar si el usuario volvía.
 */
const REGLA_VIEJA_MS = 30 * S;
function veredictoViejo(ocultaMs: number): "abandono" | "nada" {
  return ocultaMs > REGLA_VIEJA_MS ? "abandono" : "nada";
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("Los cinco casos que el producto necesita separar");
// ─────────────────────────────────────────────────────────────────────────────

test("se ocultó 5 s y volvió → interrupción breve, y no genera evento propio", () => {
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0 + 10 * S);
  v = alMostrar(v, T0 + 15 * S);
  assert.equal(clasificar(v, T0 + 20 * S), "volvio_breve");
  assert.equal(v.ultimaOcultaMs, 5 * S, "tiene que quedar cuánto tardó en volver");
  assert.equal(veredictoViejo(5 * S), "nada", "la regla vieja también acertaba acá");
});

test("REGRESIÓN · se ocultó 2 minutos y volvió → NO es abandono", () => {
  // Una llamada. Con la regla vieja el paso ya estaba cerrado y archivado como
  // abandono a los 30 s, aunque el usuario volviera y terminara el wizard.
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0 + 10 * S);
  v = alMostrar(v, T0 + 10 * S + 2 * MIN);
  assert.equal(clasificar(v, T0 + 3 * MIN), "volvio_breve", "volvió: no es abandono");
  assert.equal(v.ocultaDesde, null);
  assert.equal(veredictoViejo(2 * MIN), "abandono", "la regla vieja lo llamaba abandono");
});

test("nunca volvió a los 30 s → ya NO se da por cerrado", () => {
  // El caso que inflaba la métrica: a los 30 s todavía puede estar respondiendo
  // un mensaje. Sigue oculta, pero por debajo del umbral.
  const v = alOcultar(nuevaVisibilidad(), T0 + 10 * S);
  const ahora = T0 + 40 * S;
  assert.equal(clasificar(v, ahora), "no_volvio");
  assert.ok(ocultaMsTotal(v, ahora) < MS_OCULTA_NO_VOLVIO, "30 s no alcanza el umbral nuevo");
  assert.equal(veredictoViejo(30 * S + 1), "abandono", "la regla vieja ya lo había cerrado");
});

test("nunca volvió a los 40 minutos → pestaña olvidada, y se puede distinguir", () => {
  const v = alOcultar(nuevaVisibilidad(), T0);
  const ahora = T0 + 40 * MIN;
  assert.equal(clasificar(v, ahora), "no_volvio");
  // La clase es la misma que a los 4 minutos: lo que los separa es el número,
  // que por eso viaja en el evento. Un dwell de 4.241 s no es una decisión sobre
  // el producto.
  assert.equal(ocultaMsTotal(v, ahora), 40 * MIN);
  assert.ok(ocultaMsTotal(v, ahora) > 10 * MIN, "la query puede cortar donde quiera");
});

test("volvió y DESPUÉS navegó fuera → el abandono es real y el paso sigue vivo", () => {
  // Este es el caso que la regla vieja no podía medir: al cerrar el paso por el
  // timer, el abandono real nunca llegaba a registrarse.
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0 + 20 * S);
  v = alMostrar(v, T0 + 20 * S + 45 * S);
  const alNavegar = T0 + 2 * MIN;
  const p = propsVisibilidad(T0, alNavegar, v);
  assert.equal(p.clase_interrupcion, "volvio_breve");
  assert.equal(p.oculta_al_salir, false, "al salir la pestaña estaba visible");
  assert.equal(p.oculta_ultima_ms, 45 * S);
  // El paso siguió vivo: el evento sale con `salida` real (lo pone el hook) y
  // con la historia de la interrupción adentro.
  assert.equal(p.dwell_ms, 2 * MIN);
  assert.equal(p.dwell_activo_ms, 2 * MIN - 45 * S);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El dwell activo no cuenta el tiempo en otra app");
// ─────────────────────────────────────────────────────────────────────────────

test("REGRESIÓN · el dwell de reloj de pared infla las pantallas que retienen", () => {
  // La portada marcaba 42 s de mediana. Si media parte es tiempo en WhatsApp,
  // esa mediana no se puede comparar con la de una pantalla de 2 s.
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0 + 15 * S);
  v = alMostrar(v, T0 + 15 * S + 30 * S);
  const p = propsVisibilidad(T0, T0 + 60 * S, v);
  assert.equal(p.dwell_ms, 60 * S, "el de siempre no cambia de significado");
  assert.equal(p.dwell_activo_ms, 30 * S, "el activo descuenta la ausencia");
});

test("cuenta la ocultación EN CURSO, no solo las cerradas", () => {
  const v = alOcultar(nuevaVisibilidad(), T0 + 10 * S);
  const ahora = T0 + 70 * S;
  assert.equal(ocultaMsTotal(v, ahora), 60 * S);
  assert.equal(dwellActivoMs(T0, ahora, v), 10 * S, "solo los 10 s antes de ocultarse");
});

test("varias interrupciones se suman", () => {
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0 + 10 * S);  v = alMostrar(v, T0 + 20 * S);
  v = alOcultar(v, T0 + 30 * S);  v = alMostrar(v, T0 + 45 * S);
  assert.equal(v.veces, 2);
  assert.equal(ocultaMsTotal(v, T0 + 60 * S), 25 * S);
  assert.equal(v.ultimaOcultaMs, 15 * S);
});

test("tres pausas cortas NO se leen como una ausencia larga", () => {
  // Se clasifica por la ocultación más larga establecida, no por la suma: tres
  // pausas de 40 s son tres interrupciones normales.
  let v = nuevaVisibilidad();
  for (let i = 0; i < 3; i++) {
    v = alOcultar(v, T0 + (i * 100 + 10) * S);
    v = alMostrar(v, T0 + (i * 100 + 50) * S);
  }
  assert.equal(ocultaMsTotal(v, T0 + 400 * S), 120 * S, "suman 2 minutos");
  assert.equal(clasificar(v, T0 + 400 * S), "volvio_breve", "pero ninguna llegó al umbral");
});

test("dwell nunca negativo aunque el reloj se mueva", () => {
  const v = nuevaVisibilidad();
  assert.equal(dwellActivoMs(T0, T0 - 5 * S, v), 0);
  assert.equal(propsVisibilidad(T0, T0 - 5 * S, v).dwell_ms, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Contrato del evento y robustez");
// ─────────────────────────────────────────────────────────────────────────────

test("sin interrupciones el evento no miente: activo === total", () => {
  const p = propsVisibilidad(T0, T0 + 12 * S, nuevaVisibilidad());
  assert.equal(p.clase_interrupcion, "sin_interrupcion");
  assert.equal(p.dwell_ms, p.dwell_activo_ms);
  assert.equal(p.oculta_ms, 0);
  assert.equal(p.oculta_veces, 0);
  assert.equal(p.oculta_ultima_ms, null);
  assert.equal(p.oculta_al_salir, false);
});

test("dos `hidden` seguidos no cuentan dos ocultaciones", () => {
  // visibilitychange puede repetir; contar dos veces inventaría interrupciones.
  let v = alOcultar(nuevaVisibilidad(), T0);
  v = alOcultar(v, T0 + 5 * S);
  assert.equal(v.veces, 1);
  assert.equal(v.ocultaDesde, T0, "manda la primera, no la repetición");
});

test("un `visible` sin `hidden` previo no rompe nada", () => {
  const v = alMostrar(nuevaVisibilidad(), T0 + 10 * S);
  assert.equal(v.veces, 0);
  assert.equal(v.ocultaMsCerrado, 0);
  assert.equal(v.ultimaOcultaMs, null);
});

test("el umbral es de 3 minutos y el esquema es el 2", () => {
  assert.equal(MS_OCULTA_NO_VOLVIO, 180_000);
  assert.equal(ESQUEMA_SALIDA, 2, "sin esto no se puede separar la serie vieja de la nueva");
});

test("el umbral se puede mover en la lectura sin re-instrumentar", () => {
  // Es la propiedad que hace que este número no sea una decisión irreversible.
  let v = nuevaVisibilidad();
  v = alOcultar(v, T0);
  v = alMostrar(v, T0 + 90 * S);
  assert.equal(clasificar(v, T0 + 2 * MIN, 3 * MIN), "volvio_breve");
  assert.equal(clasificar(v, T0 + 2 * MIN, 60 * S), "volvio_largo", "otro corte, otra lectura");
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Visibilidad del paso: hay tests en rojo.");
  process.exit(1);
}
console.log("Visibilidad del paso: todos los tests pasan.");
