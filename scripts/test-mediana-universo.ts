/**
 * Tests de la segmentación por universo de la mediana comunal
 * (`src/lib/comuna-stats.ts` → `src/lib/precio-vs-comuna.ts` →
 * `src/lib/sobreprecio-hallazgo.ts`).
 *
 * Existe porque el golden NO cubre esta ruta: sus seeds congelan
 * `{ mediana, n }` SIN `universo`, así que las 12 filas del golden ejercitan la
 * rama legacy (frase sin universo) y ninguna la rama nueva. Este script pinta
 * las dos ramas y el corte de universo.
 *
 * El repo no tiene framework de testing (jest/vitest). Mismo patrón que
 * `scripts/test-plausibilidad.ts`: node:assert/strict + tsx.
 *
 *   node --import tsx scripts/test-mediana-universo.ts
 *
 * Cero red, cero DB: todo lo que se testea es puro.
 */

import assert from "node:assert/strict";
import { resolverCondicionMercado } from "../src/lib/comuna-stats";
import { buildPrecioVsComuna } from "../src/lib/precio-vs-comuna";
import { buildHallazgoSobreprecio } from "../src/lib/sobreprecio-hallazgo";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try { fn(); pass++; console.log(`  OK   ${nombre}`); }
  catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}
const seccion = (t: string) => console.log(`\n${t}`);

// ── 1. Corte de universo del sujeto ──────────────────────────────────────────

seccion("resolverCondicionMercado");

test("esNuevo=true manda, aunque la antigüedad diga otra cosa", () => {
  assert.equal(resolverCondicionMercado({ esNuevo: true, antiguedad: 30 }), "nuevo");
});

test("esNuevo=false con antigüedad 0-1 igual cae en NUEVO (pregunta de mercado, no legal)", () => {
  // Un usado recién estrenado transa contra obra nueva. NO es el corte del
  // subsidio (Ley 21.748 exige primera venta) — es el del universo de precios.
  assert.equal(resolverCondicionMercado({ esNuevo: false, antiguedad: 1 }), "nuevo");
});

test("sin esNuevo: antigüedad <= 1 => nuevo (bucket '0-2 años' del wizard => 1)", () => {
  assert.equal(resolverCondicionMercado({ antiguedad: 0 }), "nuevo");
  assert.equal(resolverCondicionMercado({ antiguedad: 1 }), "nuevo");
});

test("sin esNuevo: antigüedad >= 2 => usado (el siguiente bucket del wizard es 4)", () => {
  assert.equal(resolverCondicionMercado({ antiguedad: 2 }), "usado");
  assert.equal(resolverCondicionMercado({ antiguedad: 4 }), "usado");
  assert.equal(resolverCondicionMercado({ antiguedad: 25 }), "usado");
});

test("sin señal alguna => usado (universo del ~96% del inventario)", () => {
  assert.equal(resolverCondicionMercado({}), "usado");
  assert.equal(resolverCondicionMercado(undefined), "usado");
  assert.equal(resolverCondicionMercado({ antiguedad: null }), "usado");
});

// ── 2. El universo viaja hasta la frase ──────────────────────────────────────

seccion("buildPrecioVsComuna → buildHallazgoSobreprecio · rotulación");

const hallazgo = (p: { sujeto: number; mediana: number | null; n: number; universo?: "nuevo" | "usado" }) =>
  buildHallazgoSobreprecio(
    buildPrecioVsComuna({
      sujetoUfM2: p.sujeto,
      medianaComunaUfM2: p.mediana,
      confiable: p.mediana != null,
      n: p.n,
      universo: p.universo,
    }),
    1, 1, "Santiago",
  );

test("caso 4daf13eb con el universo correcto: favorable y rotulado 'nuevos'", () => {
  const h = hallazgo({ sujeto: 77.1, mediana: 91.15, n: 34, universo: "nuevo" });
  assert.ok(h);
  assert.equal(h.direccion, "favorable");
  assert.equal(h.valor.desviacionPct, -15);
  assert.equal(h.valor.universo, "nuevo");
  assert.equal(
    h.fraseCanonica,
    "Tu precio por m² (UF 77,1) está 15% bajo la mediana de 34 publicaciones de departamentos nuevos de la comuna (UF 91,2). Entras barato para esta comuna.",
  );
  assert.match(h.procedencia.base, /NUEVOS/);
});

test("mismo sujeto contra el universo equivocado: la frase ADVERSA que el fix retira", () => {
  const h = hallazgo({ sujeto: 77.1, mediana: 48.96, n: 192, universo: "usado" });
  assert.ok(h);
  assert.equal(h.direccion, "adverso");
  assert.equal(h.valor.desviacionPct, 57);
  assert.match(h.fraseCanonica, /192 publicaciones de departamentos usados de la comuna/);
});

test("sin universo (snapshot pre-segmentación) => redacción legacy, sin etiqueta", () => {
  const h = hallazgo({ sujeto: 77.1, mediana: 48.96, n: 192 });
  assert.ok(h);
  assert.equal(h.valor.universo, undefined);
  assert.equal(
    h.fraseCanonica,
    "Tu precio por m² (UF 77,1) está 57% sobre la mediana de la comuna (UF 49,0). Estás pagando caro el metro para esta comuna.",
  );
  assert.doesNotMatch(h.procedencia.base, /NUEVOS|USADOS/);
});

test("n=0 no rotula: 'la mediana de 0 publicaciones' sería peor que la genérica", () => {
  const h = hallazgo({ sujeto: 77.1, mediana: 48.96, n: 0, universo: "usado" });
  assert.ok(h);
  assert.match(h.fraseCanonica, /la mediana de la comuna/);
});

test("N grande lleva separador de miles chileno", () => {
  const h = hallazgo({ sujeto: 60, mediana: 58, n: 1540, universo: "usado" });
  assert.ok(h);
  assert.match(h.fraseCanonica, /1\.540 publicaciones/);
});

test("las tres direcciones rotulan el universo", () => {
  assert.match(hallazgo({ sujeto: 58.5, mediana: 58, n: 40, universo: "usado" })!.fraseCanonica,
    /en línea con la mediana de 40 publicaciones de departamentos usados de la comuna/);
  assert.match(hallazgo({ sujeto: 40, mediana: 58, n: 40, universo: "usado" })!.fraseCanonica,
    /bajo la mediana de 40 publicaciones de departamentos usados de la comuna/);
  assert.match(hallazgo({ sujeto: 90, mediana: 58, n: 40, universo: "usado" })!.fraseCanonica,
    /sobre la mediana de 40 publicaciones de departamentos usados de la comuna/);
});

// ── 3. Sin muestra del universo correcto NO hay hallazgo ──────────────────────

seccion("fallback explícito · sin muestra no se emite hallazgo");

test("mediana null (el universo no juntó muestra) => hallazgo omitido", () => {
  assert.equal(hallazgo({ sujeto: 77.1, mediana: null, n: 3, universo: "nuevo" }), null);
});

test("mediana null preserva el universo y el n parcial en precioVsComuna", () => {
  const pvc = buildPrecioVsComuna({
    sujetoUfM2: 77.1, medianaComunaUfM2: null, confiable: false, n: 3, universo: "nuevo",
  });
  assert.equal(pvc.confiable, false);
  assert.equal(pvc.desviacionPct, null);
  assert.equal(pvc.universo, "nuevo");
  assert.equal(pvc.n, 3);
});

// ── Cierre ───────────────────────────────────────────────────────────────────

console.log(`\n${pass} OK · ${fail} FAIL`);
if (fail) { console.log(`fallidos: ${fallidos.join(", ")}`); process.exit(1); }
