/**
 * Tests del catch-layer de voz chilena (`src/lib/voz-chilena.ts`).
 *
 * El repo no tiene framework de testing instalado. Este script usa
 * `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-plausibilidad.ts`.
 *
 *   npx tsx scripts/test-voz-chilena.ts
 *
 * Cero red, cero DB: el módulo bajo test es puro.
 *
 * El grueso de los casos son NEGATIVOS. El riesgo real de este guard no es
 * dejar pasar un voseo (lo caza el léxico), es dispararse sobre prosa correcta
 * — futuro de tuteo ("comprarás"), sustantivos en -és ("interés", "parqués"),
 * irregulares ("estás"). Cada falso positivo cuesta una regeneración.
 */

import assert from "node:assert/strict";
import {
  scanVozChilena,
  scanVozChilenaTexto,
  sanitizeVozChilena,
  sanitizeVozChilenaTexto,
  hitsQueExigenReintento,
  correctivoVoz,
} from "../src/lib/voz-chilena";

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

// ── Positivos: léxico cerrado ────────────────────────────────────────────────
console.log("\nLéxico cerrado (detecta y corrige)");

test("voseo en -ás se caza y se corrige", () => {
  const hits = scanVozChilenaTexto("Si negociás el precio, ganás margen.");
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.capa), ["lexico", "lexico"]);
  assert.equal(sanitizeVozChilenaTexto("Si negociás el precio, ganás margen."), "Si negocias el precio, ganas margen.");
});

test("voseo en -és/-ís se caza y se corrige", () => {
  assert.equal(
    sanitizeVozChilenaTexto("Tenés que decidir si preferís flujo o plusvalía."),
    "Tienes que decidir si prefieres flujo o plusvalía.",
  );
});

test("encontrás → encuentras (caso medido en producción)", () => {
  assert.equal(sanitizeVozChilenaTexto("encontrás mejores números"), "encuentras mejores números");
});

test("imperativo voseo se corrige", () => {
  assert.equal(sanitizeVozChilenaTexto("Cotizá en dos bancos y pedí el certificado."), "Cotiza en dos bancos y pide el certificado.");
});

test("mayúscula inicial se conserva", () => {
  assert.equal(sanitizeVozChilenaTexto("Negociás fuerte. Tenés margen."), "Negocias fuerte. Tienes margen.");
});

test("el swap es word-count neutro (no invalida el guard de presupuesto)", () => {
  const antes = "Si negociás y aportás más pie, tenés mejor flujo y encontrás holgura.";
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  assert.equal(wc(sanitizeVozChilenaTexto(antes)), wc(antes));
});

test("sanitize es idempotente", () => {
  const una = sanitizeVozChilenaTexto("Si tenés dudas, mirá los comparables.");
  assert.equal(sanitizeVozChilenaTexto(una), una);
});

// ── Positivos: typos recurrentes ─────────────────────────────────────────────
console.log("\nTypos recurrentes (detecta y corrige)");

test("commune → comuna", () => {
  const hits = scanVozChilenaTexto("la mediana de la commune");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].capa, "typo");
  assert.equal(sanitizeVozChilenaTexto("la mediana de la commune"), "la mediana de la comuna");
});

test("delgas → delegas · autoggestión → autogestión", () => {
  assert.equal(
    sanitizeVozChilenaTexto("Si delgas en un administrador pierdes margen; con autoggestión no."),
    "Si delegas en un administrador pierdes margen; con autogestión no.",
  );
});

// ── Positivos: capa morfológica (detecta, NO corrige → reintento) ────────────
console.log("\nMorfología desconocida y pronombre (detecta, dispara reintento)");

test("pronombre 'vos' se caza y no tiene corrección", () => {
  const hits = scanVozChilenaTexto("Esto lo decides vos, no el banco.");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].capa, "pronombre");
  assert.equal(hits[0].sugerencia, null);
  assert.equal(hitsQueExigenReintento(hits).length, 1);
});

test("verbo en -és fuera del léxico se caza sin corrección", () => {
  const hits = scanVozChilenaTexto("Si lo retenés dos años más, el número cambia.");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].capa, "morfologia");
  assert.equal(hits[0].sugerencia, null);
});

test("los hits corregibles NO exigen reintento", () => {
  const hits = scanVozChilenaTexto("Si negociás bien, la commune te da margen.");
  assert.equal(hits.length, 2);
  assert.equal(hitsQueExigenReintento(hits).length, 0);
});

test("el correctivo cita el token y su oración", () => {
  const c = correctivoVoz(scanVozChilenaTexto("Esto lo decides vos."));
  assert.ok(c.includes('"vos"'));
  assert.ok(c.includes("Esto lo decides vos."));
});

// ── Negativos: prosa correcta que NO puede disparar ──────────────────────────
console.log("\nNegativos — prosa chilena correcta (0 hits, 0 cambios)");

const LIMPIAS = [
  // futuro de tuteo: termina en -ás y es IMPECABLE
  "Si compras hoy, pagarás $530.000 al mes y tendrás flujo negativo tres años.",
  "Verás el efecto recién cuando el arriendo suba; recuperarás el pie en ocho años.",
  "Con ese precio no encontrarás nada mejor en la zona.",
  // irregulares idénticos en tuteo
  "Estás pagando UF 116 por m² y vas a necesitar colchón.",
  // sustantivos y adverbios en -ás / -és / -ís
  "El interés del crédito y los gastos comunes se comen el margen; además, quedan las contribuciones.",
  "Después de la vacancia, y a través del ajuste de tarifa, el país sigue con tasas altas.",
  "Los parqués del edificio están nuevos, quizás por eso el precio.",
  "Todo lo demás está dentro de rango; el análisis no muestra estrés de flujo.",
  // tuteo chileno normal, denso en segunda persona
  "Tú controlas el precio, no la tasa: si negocias UF 200 menos, tu dividendo baja $48.000 y el flujo se acomoda.",
  "Antes de firmar, pide el certificado de deudas y revisa las últimas tres actas del comité.",
];

for (const frase of LIMPIAS) {
  test(`sin hits: "${frase.slice(0, 46)}…"`, () => {
    const hits = scanVozChilenaTexto(frase);
    assert.deepEqual(hits.map((h) => h.token), []);
    assert.equal(sanitizeVozChilenaTexto(frase), frase);
  });
}

// ── Recorrido de objetos ─────────────────────────────────────────────────────
console.log("\nRecorrido del objeto de IA");

test("scan reporta el path de cada hit", () => {
  const ai = {
    conviene: { respuestaDirecta_clp: "Conviene. Si negociás, mejora.", cajaAccionable_uf: "limpio" },
    riesgos: { contenido: ["ok", "la commune sube"] },
    numero: 42,
    nulo: null,
  };
  const hits = scanVozChilena(ai);
  assert.deepEqual(
    hits.map((h) => h.path).sort(),
    ["conviene.respuestaDirecta_clp", "riesgos.contenido[1]"],
  );
});

test("sanitize no muta el original y corrige la copia", () => {
  const ai = { a: { b: "Si tenés dudas, revisá los comparables." } };
  const out = sanitizeVozChilena(ai);
  assert.equal(ai.a.b, "Si tenés dudas, revisá los comparables.");
  assert.equal(out.a.b, "Si tienes dudas, revisa los comparables.");
});

test("sanitize preserva no-strings", () => {
  const ai = { n: 7, b: true, nulo: null, arr: [1, "tenés"], undef: undefined };
  const out = sanitizeVozChilena(ai);
  assert.equal(out.n, 7);
  assert.equal(out.b, true);
  assert.equal(out.nulo, null);
  assert.deepEqual(out.arr, [1, "tienes"]);
});

console.log(`\n${ok} OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
