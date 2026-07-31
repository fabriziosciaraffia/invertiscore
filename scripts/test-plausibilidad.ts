/**
 * Tests del guard de plausibilidad (`src/lib/plausibilidad.ts`).
 *
 * El repo no tiene framework de testing instalado (jest/vitest/etc.). Este
 * script usa `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/test-financing-health.ts`.
 *
 *   npx tsx scripts/test-plausibilidad.ts
 *
 * Salida: lista de tests con OK/FAIL y exit code != 0 si alguno falla.
 *
 * Cero red, cero DB: el módulo bajo test es puro.
 */

import assert from "node:assert/strict";
import {
  evaluarPlausibilidad,
  desdeBodyLtr,
  desdeBodyStr,
  type Anomalia,
  type Regla,
  type PlausibilidadInput,
} from "../src/lib/plausibilidad";

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

const reglas = (as: Anomalia[]): Regla[] => as.map((a) => a.regla).sort();

/** Assert de "no dispara ninguna regla", con el detalle en el mensaje de error. */
function assertLimpio(input: PlausibilidadInput, ctx: string) {
  const out = evaluarPlausibilidad(input);
  assert.deepEqual(
    reglas(out),
    [],
    `${ctx}: esperaba [] y salió ${JSON.stringify(reglas(out))} — ${out.map((a) => a.mensaje).join(" | ")}`,
  );
}

/** Assert de "dispara exactamente estas reglas". */
function assertReglas(input: PlausibilidadInput, esperadas: Regla[], ctx: string) {
  const out = evaluarPlausibilidad(input);
  assert.deepEqual(
    reglas(out),
    [...esperadas].sort(),
    `${ctx}: esperaba ${JSON.stringify([...esperadas].sort())} y salió ${JSON.stringify(reglas(out))}`,
  );
}

// UF de referencia para los casos narrativos (la del corpus congelado).
const UF = 38800;

// ─────────────────────────────────────────────────────────────────────────────
seccion("1 · El caso real que motivó la pieza");

test("precio UF 4.800.000 (quiso 4.800) · 45 m² · arriendo $950.000 → >= 3 anomalías", () => {
  const out = evaluarPlausibilidad({
    precioUF: 4_800_000,
    superficieM2: 45,
    ufCLP: UF,
    tasaAnualPct: 4.72,
    arriendoMensualCLP: 950_000,
  });
  assert.ok(out.length >= 3, `esperaba >= 3 anomalías, salieron ${out.length}`);
  const r = reglas(out);
  assert.ok(r.includes("uf_m2_fuera_rango"), "falta uf_m2_fuera_rango");
  assert.ok(r.includes("precio_total_fuera_rango"), "falta precio_total_fuera_rango");
  assert.ok(r.includes("yield_imposible"), "falta yield_imposible");
});

test("el mismo caso bien tipeado (UF 4.800) pasa limpio", () => {
  assertLimpio(
    {
      precioUF: 4_800,
      superficieM2: 45,
      ufCLP: UF,
      tasaAnualPct: 4.72,
      arriendoMensualCLP: 950_000,
    },
    "UF 4.800 · 45 m²",
  );
});

test("el mensaje nombra la consecuencia, no el rango", () => {
  const out = evaluarPlausibilidad({ precioUF: 4_800_000, superficieM2: 45, ufCLP: UF });
  const ufM2 = out.find((a) => a.regla === "uf_m2_fuera_rango");
  assert.ok(ufM2, "no salió la anomalía de UF/m²");
  assert.ok(ufM2.mensaje.startsWith("El m² te queda en UF 106.667"), `mensaje inesperado: ${ufM2.mensaje}`);
  // `valor` es el DERIVADO, no el tipeado.
  assert.ok(Math.abs(ufM2.valor - 4_800_000 / 45) < 1e-6, "valor debería ser el UF/m² derivado");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("2 · Casos sanos — no deben disparar");

test("canónico: Providencia UF 5.500 · 60 m² · arriendo $950.000 → []", () => {
  assertLimpio(
    {
      precioUF: 5_500,
      superficieM2: 60,
      ufCLP: UF,
      tasaAnualPct: 4.72,
      arriendoMensualCLP: 950_000,
    },
    "Providencia canónico",
  );
});

test("borde caro: Vitacura UF 15.000 · 200 m² → []", () => {
  assertLimpio(
    { precioUF: 15_000, superficieM2: 200, ufCLP: UF, tasaAnualPct: 4.72 },
    "Vitacura UF 15.000",
  );
});

test("borde: yield 1,2% (caro pero real) → []", () => {
  // precioCLP = 2000 * 40000 = 80.000.000 · arriendo 80.000 → yield = 1,2%
  assertLimpio(
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 80_000 },
    "yield 1,2%",
  );
});

test("borde: tasa 8% (crédito malo pero existe) → []", () => {
  assertLimpio(
    { precioUF: 5_500, superficieM2: 60, ufCLP: UF, tasaAnualPct: 8 },
    "tasa 8%",
  );
});

test("studio chico y caro: UF 3.000 · 22 m² · arriendo $520.000 → []", () => {
  assertLimpio(
    { precioUF: 3_000, superficieM2: 22, ufCLP: UF, tasaAnualPct: 4.72, arriendoMensualCLP: 520_000 },
    "studio 22 m²",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("3 · Límites exactos — UF/m² [10, 500]");

test("UF/m² = 10 exacto (600 UF / 60 m²) → no dispara", () => {
  assertLimpio({ precioUF: 600, superficieM2: 60, ufCLP: UF }, "UF/m² = 10");
});

test("UF/m² = 9,99 (599,4 UF / 60 m²) → dispara", () => {
  assertReglas({ precioUF: 599.4, superficieM2: 60, ufCLP: UF }, ["uf_m2_fuera_rango"], "UF/m² = 9,99");
});

test("UF/m² = 500 exacto (30.000 UF / 60 m²) → no dispara", () => {
  assertLimpio({ precioUF: 30_000, superficieM2: 60, ufCLP: UF }, "UF/m² = 500");
});

test("UF/m² = 501 (30.060 UF / 60 m²) → dispara", () => {
  assertReglas({ precioUF: 30_060, superficieM2: 60, ufCLP: UF }, ["uf_m2_fuera_rango"], "UF/m² = 501");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("4 · Límites exactos — precio total UF [300, 100.000]");

test("precio = 300 UF exacto → no dispara", () => {
  assertLimpio({ precioUF: 300, superficieM2: 30, ufCLP: UF }, "precio 300 UF");
});

test("precio = 299 UF → dispara solo precio", () => {
  assertReglas({ precioUF: 299, superficieM2: 29, ufCLP: UF }, ["precio_total_fuera_rango"], "precio 299 UF");
});

test("precio = 100.000 UF exacto → no dispara", () => {
  assertLimpio({ precioUF: 100_000, superficieM2: 500, ufCLP: UF }, "precio 100.000 UF");
});

test("precio = 100.001 UF → dispara solo precio", () => {
  assertReglas(
    { precioUF: 100_001, superficieM2: 500, ufCLP: UF },
    ["precio_total_fuera_rango"],
    "precio 100.001 UF",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("5 · Límites exactos — superficie [12, 500] m²");

test("superficie = 12 m² exacto → no dispara", () => {
  assertLimpio({ precioUF: 300, superficieM2: 12, ufCLP: UF }, "superficie 12 m²");
});

test("superficie = 11,9 m² → dispara solo superficie", () => {
  assertReglas({ precioUF: 300, superficieM2: 11.9, ufCLP: UF }, ["superficie_fuera_rango"], "superficie 11,9 m²");
});

test("superficie = 500 m² exacto → no dispara", () => {
  assertLimpio({ precioUF: 100_000, superficieM2: 500, ufCLP: UF }, "superficie 500 m²");
});

test("superficie = 501 m² → dispara solo superficie", () => {
  assertReglas(
    { precioUF: 100_000, superficieM2: 501, ufCLP: UF },
    ["superficie_fuera_rango"],
    "superficie 501 m²",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("6 · Límites exactos — yield bruto LTR [0,5%, 25%]");

test("yield = 0,5% exacto (6.000 UF · $100.000/mes) → no dispara", () => {
  assertLimpio(
    { precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 100_000 },
    "yield 0,5%",
  );
});

test("yield = 0,475% (6.000 UF · $95.000/mes) → dispara solo yield", () => {
  assertReglas(
    { precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 95_000 },
    ["yield_imposible"],
    "yield 0,475%",
  );
});

test("yield = 25% exacto (300 UF · $250.000/mes) → no dispara", () => {
  assertLimpio(
    { precioUF: 300, superficieM2: 30, ufCLP: 40_000, arriendoMensualCLP: 250_000 },
    "yield 25%",
  );
});

test("yield = 26% (300 UF · $260.000/mes) → dispara solo yield", () => {
  assertReglas(
    { precioUF: 300, superficieM2: 30, ufCLP: 40_000, arriendoMensualCLP: 260_000 },
    ["yield_imposible"],
    "yield 26%",
  );
});

test("sin arriendo declarado el yield no se evalúa", () => {
  assertLimpio({ precioUF: 6_000, superficieM2: 60, ufCLP: 40_000 }, "sin arriendo");
  assertLimpio({ precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 0 }, "arriendo 0");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("7 · Límites exactos — arriendo CLP [80.000, 15.000.000]");

test("arriendo = $80.000 exacto → no dispara", () => {
  assertLimpio(
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 80_000 },
    "arriendo 80.000",
  );
});

test("arriendo = $79.999 → dispara solo arriendo", () => {
  assertReglas(
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 79_999 },
    ["arriendo_fuera_rango"],
    "arriendo 79.999",
  );
});

test("arriendo = $15.000.000 exacto → no dispara", () => {
  assertLimpio(
    { precioUF: 20_000, superficieM2: 100, ufCLP: 40_000, arriendoMensualCLP: 15_000_000 },
    "arriendo 15.000.000",
  );
});

test("arriendo = $15.000.001 → dispara solo arriendo", () => {
  assertReglas(
    { precioUF: 20_000, superficieM2: 100, ufCLP: 40_000, arriendoMensualCLP: 15_000_001 },
    ["arriendo_fuera_rango"],
    "arriendo 15.000.001",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("8 · Límites exactos — tasa anual [0,5%, 20%]");

const baseTasa = { precioUF: 5_500, superficieM2: 60, ufCLP: UF };

test("tasa = 0,5% exacto → no dispara", () => {
  assertLimpio({ ...baseTasa, tasaAnualPct: 0.5 }, "tasa 0,5%");
});

test("tasa = 0,49% → dispara solo tasa", () => {
  assertReglas({ ...baseTasa, tasaAnualPct: 0.49 }, ["tasa_fuera_rango"], "tasa 0,49%");
});

test("tasa = 20% exacto → no dispara", () => {
  assertLimpio({ ...baseTasa, tasaAnualPct: 20 }, "tasa 20%");
});

test("tasa = 20,01% → dispara solo tasa", () => {
  assertReglas({ ...baseTasa, tasaAnualPct: 20.01 }, ["tasa_fuera_rango"], "tasa 20,01%");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("9 · Límites exactos — STR ocupación [0, 100] %");

const baseOcc = { precioUF: 5_000, superficieM2: 50, ufCLP: 40_000 };

test("ocupación = 0% exacto → no dispara", () => {
  assertLimpio({ ...baseOcc, str: { tarifaNocheCLP: 50_000, ocupacionPct: 0 } }, "ocupación 0%");
});

test("ocupación = -1% → dispara solo ocupación", () => {
  assertReglas(
    { ...baseOcc, str: { tarifaNocheCLP: 50_000, ocupacionPct: -1 } },
    ["str_ocupacion_fuera_rango"],
    "ocupación -1%",
  );
});

test("ocupación = 100% exacto → no dispara", () => {
  assertLimpio({ ...baseOcc, str: { tarifaNocheCLP: 50_000, ocupacionPct: 100 } }, "ocupación 100%");
});

test("ocupación = 101% → dispara solo ocupación", () => {
  assertReglas(
    { ...baseOcc, str: { tarifaNocheCLP: 50_000, ocupacionPct: 101 } },
    ["str_ocupacion_fuera_rango"],
    "ocupación 101%",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("10 · Límites exactos — STR tarifa/noche [$5.000, $2.000.000]");

test("tarifa = $5.000 exacto → no dispara", () => {
  assertLimpio(
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 5_000, ocupacionPct: 50 } },
    "tarifa 5.000",
  );
});

test("tarifa = $4.999 → dispara solo tarifa", () => {
  assertReglas(
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 4_999, ocupacionPct: 50 } },
    ["str_tarifa_fuera_rango"],
    "tarifa 4.999",
  );
});

test("tarifa = $2.000.000 exacto → no dispara", () => {
  assertLimpio(
    {
      precioUF: 100_000,
      superficieM2: 400,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 2_000_000, ocupacionPct: 50 },
    },
    "tarifa 2.000.000",
  );
});

test("tarifa = $2.000.001 → dispara solo tarifa", () => {
  assertReglas(
    {
      precioUF: 100_000,
      superficieM2: 400,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 2_000_001, ocupacionPct: 50 },
    },
    ["str_tarifa_fuera_rango"],
    "tarifa 2.000.001",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("11 · Límites exactos — STR yield bruto [0,5%, 40%]");

test("yield STR = 40% exacto (2.281,25 UF · $100.000 · 100%) → no dispara", () => {
  assertLimpio(
    {
      precioUF: 2_281.25,
      superficieM2: 20,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 100_000, ocupacionPct: 100 },
    },
    "yield STR 40%",
  );
});

test("yield STR = 41,5% (2.200 UF · $100.000 · 100%) → dispara solo yield STR", () => {
  assertReglas(
    {
      precioUF: 2_200,
      superficieM2: 20,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 100_000, ocupacionPct: 100 },
    },
    ["str_yield_imposible"],
    "yield STR 41,5%",
  );
});

test("yield STR = 0,5% exacto (10.000 UF · $5.479,45 · 100%) → no dispara", () => {
  assertLimpio(
    {
      precioUF: 10_000,
      superficieM2: 100,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 2_000_000 / 365, ocupacionPct: 100 },
    },
    "yield STR 0,5%",
  );
});

test("yield STR = 0,456% (10.000 UF · $5.000 · 100%) → dispara solo yield STR", () => {
  assertReglas(
    {
      precioUF: 10_000,
      superficieM2: 100,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 5_000, ocupacionPct: 100 },
    },
    ["str_yield_imposible"],
    "yield STR 0,456%",
  );
});

test("sin overrides STR (estimación AirROI) no se evalúa la rama STR", () => {
  assertLimpio(
    { precioUF: 5_000, superficieM2: 50, ufCLP: 40_000, str: { tarifaNocheCLP: null, ocupacionPct: null } },
    "overrides null",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("12 · Fail-open: campos ausentes o no numéricos NO bloquean");

test("input vacío → []", () => {
  assertLimpio({} as unknown as PlausibilidadInput, "input vacío");
});

test("NaN / undefined / null no disparan ninguna regla", () => {
  assertLimpio(
    {
      precioUF: NaN,
      superficieM2: undefined as unknown as number,
      ufCLP: NaN,
      tasaAnualPct: NaN,
      arriendoMensualCLP: NaN,
      str: { tarifaNocheCLP: null, ocupacionPct: null },
    },
    "NaN everywhere",
  );
});

test("Infinity no dispara (no es finito)", () => {
  assertLimpio(
    { precioUF: Infinity, superficieM2: Infinity, ufCLP: Infinity },
    "Infinity",
  );
});

test("sin ufCLP los yields se omiten pero el resto sigue evaluándose", () => {
  assertReglas(
    { precioUF: 4_800_000, superficieM2: 45, ufCLP: NaN, arriendoMensualCLP: 950_000 },
    ["precio_total_fuera_rango", "uf_m2_fuera_rango"],
    "sin ufCLP",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("13 · Adaptadores desde los bodies de las rutas");

test("desdeBodyLtr mapea el body de POST /api/analisis", () => {
  const input = desdeBodyLtr(
    { precio: 4_800_000, superficie: 45, arriendo: 950_000, tasaInteres: 4.72 },
    UF,
  );
  assert.equal(input.precioUF, 4_800_000);
  assert.equal(input.superficieM2, 45);
  assert.equal(input.arriendoMensualCLP, 950_000);
  assert.equal(input.tasaAnualPct, 4.72);
  assert.ok(evaluarPlausibilidad(input).length >= 3);
});

test("desdeBodyStr convierte occOverride (fracción) a porcentaje", () => {
  const input = desdeBodyStr(
    {
      precioCompraUF: 5_000,
      precioCompra: 200_000_000,
      superficieUtil: 50,
      tasaInteres: 4.72,
      arriendoLargoMensual: 900_000,
      adrOverride: 50_000,
      occOverride: 0.65,
    },
    40_000,
  );
  assert.equal(input.str?.ocupacionPct, 65);
  assert.equal(input.str?.tarifaNocheCLP, 50_000);
  assertLimpio(input, "STR sano vía adaptador");
});

test("desdeBodyStr cae a precioCompra (CLP) cuando falta precioCompraUF", () => {
  const input = desdeBodyStr(
    { precioCompra: 200_000_000, superficieUtil: 50, adrOverride: null, occOverride: null },
    40_000,
  );
  assert.equal(input.precioUF, 5_000);
  assertLimpio(input, "STR sin precioCompraUF");
});

test("desdeBodyStr con overrides null deja la rama STR inerte", () => {
  const input = desdeBodyStr(
    {
      precioCompraUF: 5_000,
      superficieUtil: 50,
      arriendoLargoMensual: 900_000,
      adrOverride: null,
      occOverride: null,
    },
    40_000,
  );
  assert.equal(input.str?.tarifaNocheCLP, null);
  assert.equal(input.str?.ocupacionPct, null);
  assertLimpio(input, "STR overrides null");
});

test("desdeBodyStr caza el caso real tipeado en la rama STR", () => {
  const input = desdeBodyStr(
    {
      precioCompraUF: 4_800_000,
      superficieUtil: 45,
      tasaInteres: 4.72,
      arriendoLargoMensual: 950_000,
      adrOverride: 55_000,
      occOverride: 0.6,
    },
    UF,
  );
  const r = reglas(evaluarPlausibilidad(input));
  assert.ok(r.includes("uf_m2_fuera_rango"));
  assert.ok(r.includes("precio_total_fuera_rango"));
  assert.ok(r.includes("str_yield_imposible"));
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Guard de plausibilidad: todos los tests pasan.");
