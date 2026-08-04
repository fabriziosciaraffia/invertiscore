/**
 * Tests del parser/formateador numérico chileno (`src/lib/numero-cl.ts`).
 *
 * El repo no tiene framework de testing instalado (jest/vitest/etc.). Este
 * script usa `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-plausibilidad.ts`.
 *
 *   npx tsx scripts/test-numero-cl.ts
 *
 * Salida: lista de tests con OK/FAIL y exit code != 0 si alguno falla.
 *
 * Cero red, cero DB: el módulo bajo test es puro.
 *
 * La TABLA OBLIGATORIA de abajo es la matriz de la auditoría de separadores.
 * Es contrato: si un caso falla, se arregla el módulo, nunca la tabla.
 */

import assert from "node:assert/strict";
import { parseNumeroCL, formatNumeroCL, type Decimales } from "../src/lib/numero-cl";

// ── Runner mínimo ────────────────────────────────────────────────────────────

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

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

/** Rótulo legible del esperado, para que el nombre del test se lea solo. */
const muestra = (v: number | null) => (v === null ? "null" : String(v));

/** Un caso de la matriz: entrada, decimales del campo, resultado esperado. */
type Caso = [entrada: string, decimales: Decimales, esperado: number | null];

function correrTabla(casos: Caso[]) {
  for (const [entrada, decimales, esperado] of casos) {
    test(`parse("${entrada}", ${decimales}) → ${muestra(esperado)}`, () => {
      const real = parseNumeroCL(entrada, decimales);
      assert.strictEqual(
        real,
        esperado,
        `esperaba ${muestra(esperado)} y salió ${muestra(real)}`,
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("TABLA OBLIGATORIA · decimales = 2");
// ─────────────────────────────────────────────────────────────────────────────

const TABLA_DEC2: Caso[] = [
  ["4,5", 2, 4.5],
  ["4.5", 2, 4.5],
  ["4.297,4", 2, 4297.4],
  ["4297,4", 2, 4297.4],
  ["1.500", 2, 1500],
  ["1500", 2, 1500],
  ["0,75", 2, 0.75],
  ["", 2, null],
  ["2.750,25", 2, 2750.25],
  ["1.234.567", 2, 1234567],
  ["1.234.567,89", 2, 1234567.89],
];
correrTabla(TABLA_DEC2);

// ─────────────────────────────────────────────────────────────────────────────
seccion("TABLA OBLIGATORIA · decimales = 0");
// ─────────────────────────────────────────────────────────────────────────────

const TABLA_DEC0: Caso[] = [
  ["1.500", 0, 1500],
  ["1500", 0, 1500],
  ["4,5", 0, null],
  ["4.5", 0, null],
];
correrTabla(TABLA_DEC0);

// ─────────────────────────────────────────────────────────────────────────────
seccion("TABLA OBLIGATORIA · casos borde");
// ─────────────────────────────────────────────────────────────────────────────

const TABLA_BORDE: Caso[] = [
  [",", 2, null],
  [".", 2, null],
  ["4,", 2, 4],
  ["-", 2, null],
];
correrTabla(TABLA_BORDE);

// ─────────────────────────────────────────────────────────────────────────────
seccion("TABLA OBLIGATORIA · round-trip (format∘parse estable e idempotente)");
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Para cada caso VÁLIDO de la tabla: formatear el parseado y volver a parsear
 * tiene que dar el mismo número, y volver a formatear el mismo texto. Es la
 * propiedad que hace que un valor pueda ir y venir entre el estado y la pantalla
 * sin degradarse — justo lo que hoy no se cumple (`fmtMiles` le come la coma a
 * su propio valor).
 */
for (const [entrada, decimales, esperado] of [...TABLA_DEC2, ...TABLA_DEC0, ...TABLA_BORDE]) {
  if (esperado === null) continue;
  test(`round-trip "${entrada}" (${decimales} dec)`, () => {
    const v1 = parseNumeroCL(entrada, decimales);
    assert.strictEqual(v1, esperado, `parse inicial dio ${muestra(v1)}`);

    const texto = formatNumeroCL(v1 as number, decimales);
    const v2 = parseNumeroCL(texto, decimales);
    assert.strictEqual(
      v2,
      v1,
      `format→parse no es estable: ${muestra(v1)} → "${texto}" → ${muestra(v2)}`,
    );

    const texto2 = formatNumeroCL(v2 as number, decimales);
    assert.strictEqual(
      texto2,
      texto,
      `format no es idempotente: "${texto}" vs "${texto2}"`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("Regla 4 · nunca truncar en silencio");
// ─────────────────────────────────────────────────────────────────────────────

correrTabla([
  // Más decimales que los del campo → null, no un valor recortado.
  ["0,75", 1, null],
  ["0,75", 0, null],
  ["4,5", 1, 4.5],
  ["1.234,56", 1, null],
  // Ceros decorativos NO cuentan como decimales significativos: el propio
  // `formatNumeroCL` los escribe, así que rechazarlos rompería el round-trip
  // entre campos de distinta precisión.
  ["4,50", 1, 4.5],
  ["4,00", 0, 4],
  ["1.500,00", 0, 1500],
]);

// ─────────────────────────────────────────────────────────────────────────────
seccion("Regla 3 · agrupamiento de miles mal formado → null");
// ─────────────────────────────────────────────────────────────────────────────

correrTabla([
  ["12.34.567", 2, null], // grupo intermedio de 2
  ["1234.567", 2, null], // primer grupo de 4
  ["1..500", 2, null], // separadores pegados
  [".500", 2, null], // primer grupo vacío
  ["1.2345", 2, null], // 4 dígitos tras el último separador
  ["1.50", 2, 1.5], // 2 dígitos → decimal, no miles mal formado
]);

// ─────────────────────────────────────────────────────────────────────────────
seccion("Regla posicional · el formato gringo cae solo");
// ─────────────────────────────────────────────────────────────────────────────

correrTabla([
  ["1,234.56", 2, 1234.56],
  ["1,234,567", 2, 1234567],
  ["1,234,567.89", 2, 1234567.89],
]);

// ─────────────────────────────────────────────────────────────────────────────
seccion("Signo, cero y basura");
// ─────────────────────────────────────────────────────────────────────────────

correrTabla([
  ["0", 0, 0],
  ["0,00", 2, 0],
  ["-0", 0, 0], // normalizado: nunca -0
  ["-1.500", 0, -1500],
  ["-4,5", 2, -4.5],
  ["+1.500", 0, 1500],
  [",5", 2, 0.5], // entero implícito
  ["  1.500  ", 0, 1500], // trim
  ["1 500", 0, null], // espacio interno
  ["$1.500", 0, null], // prefijo de moneda: lo limpia el consumidor
  ["UF 3.200", 0, null],
  ["abc", 2, null],
  ["1e3", 0, null], // notación científica fuera
]);

// ─────────────────────────────────────────────────────────────────────────────
seccion("formatNumeroCL");
// ─────────────────────────────────────────────────────────────────────────────

const FORMATOS: Array<[number, Decimales, string]> = [
  [1500, 0, "1.500"],
  [1500, 2, "1.500,00"],
  [4.5, 2, "4,50"],
  [4.5, 1, "4,5"],
  [1234567.89, 2, "1.234.567,89"],
  [1234567, 0, "1.234.567"],
  [0, 0, "0"],
  [0, 2, "0,00"],
  [500, 0, "500"],
  [-1234.5, 1, "-1.234,5"],
  [-0.004, 0, "0"], // el signo no sobrevive al redondeo
  [0.75, 2, "0,75"],
];

for (const [valor, decimales, esperado] of FORMATOS) {
  test(`format(${valor}, ${decimales}) → "${esperado}"`, () => {
    assert.strictEqual(formatNumeroCL(valor, decimales), esperado);
  });
}

test("format de no finitos → «—»", () => {
  assert.strictEqual(formatNumeroCL(NaN, 2), "—");
  assert.strictEqual(formatNumeroCL(Infinity, 0), "—");
  assert.strictEqual(formatNumeroCL(-Infinity, 1), "—");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Sweep de round-trip sobre las 3 precisiones");
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Barrido determinístico: todo valor representable en `decimales` tiene que
 * sobrevivir el ida y vuelta. Sin esto, el round-trip solo estaría probado en
 * los pocos valores de la tabla.
 */
test("format→parse es identidad para valores representables", () => {
  const bases = [0, 1, 7, 99, 100, 500, 999, 1000, 1500, 12345, 999999, 1234567, 87654321];
  const fallas: string[] = [];
  for (const decimales of [0, 1, 2] as Decimales[]) {
    const paso = decimales === 0 ? 1 : decimales === 1 ? 0.1 : 0.01;
    for (const base of bases) {
      for (const k of [0, 1, 2, 5, 9]) {
        for (const signo of [1, -1]) {
          // Redondeo explícito: evita que el propio caso de prueba nazca con
          // basura de punto flotante (0.1*3 = 0.30000000000000004).
          const bruto = signo * (base + k * paso);
          const valor = Number(bruto.toFixed(decimales));
          const texto = formatNumeroCL(valor, decimales);
          const vuelta = parseNumeroCL(texto, decimales);
          if (vuelta !== valor) {
            fallas.push(`${valor} (${decimales} dec) → "${texto}" → ${muestra(vuelta)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(fallas, [], `round-trip roto en ${fallas.length} valores:\n  ${fallas.slice(0, 10).join("\n  ")}`);
});

/**
 * El contraste que motiva el módulo: hoy el MISMO string vale distinto según
 * qué parser lo lea. Acá se fija la lectura única.
 */
test("un solo significado por string: «1.500» es 1500 en todo campo entero", () => {
  assert.strictEqual(parseNumeroCL("1.500", 0), 1500);
  assert.strictEqual(parseNumeroCL("1.500", 1), 1500);
  assert.strictEqual(parseNumeroCL("1.500", 2), 1500);
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("numero-cl: todos los tests pasan.");
