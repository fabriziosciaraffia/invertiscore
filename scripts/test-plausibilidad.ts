/**
 * Tests del guard de plausibilidad (`src/lib/plausibilidad.ts`).
 *
 * El repo no tiene framework de testing instalado (jest/vitest/etc.). Este
 * script usa `node:assert/strict` y se ejecuta con tsx — mismo patrón que
 * `scripts/_archivo/test-financing-health.ts` (archivado: quedó sin consumidor
 * y sus símbolos ya no existen en el motor, ver el README de esa carpeta).
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
  formatearNumero,
  formatearPct,
  valorParaMostrar,
  META_REGLA,
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
seccion("5 · Límites exactos — superficie [12, 1.000] m²");

test("superficie = 12 m² exacto → no dispara", () => {
  assertLimpio({ precioUF: 300, superficieM2: 12, ufCLP: UF }, "superficie 12 m²");
});

test("superficie = 11,9 m² → dispara solo superficie", () => {
  assertReglas({ precioUF: 300, superficieM2: 11.9, ufCLP: UF }, ["superficie_fuera_rango"], "superficie 11,9 m²");
});

test("superficie = 1.000 m² exacto → no dispara", () => {
  assertLimpio({ precioUF: 100_000, superficieM2: 1_000, ufCLP: UF }, "superficie 1.000 m²");
});

test("superficie = 1.001 m² → dispara solo superficie", () => {
  assertReglas(
    { precioUF: 100_000, superficieM2: 1_001, ufCLP: UF },
    ["superficie_fuera_rango"],
    "superficie 1.001 m²",
  );
});

test("555 m² en Vitacura (depto real grande) NO dispara — era falso positivo", () => {
  // El techo viejo de 500 rechazaba departamentos que existen en Vitacura y
  // Las Condes. La fila real b1a0b94f seguía siendo rechazada, pero por uf_m2.
  assertLimpio({ precioUF: 25_000, superficieM2: 555, ufCLP: UF }, "555 m² legítimo");
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
seccion("7 · Límite — arriendo CLP: solo piso ($80.000), sin techo");

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

test("SIN techo: arriendo de $16.000.000 en un depto de lujo NO dispara", () => {
  // El techo viejo ($15M) solo podía disparar SOLO con precio >= UF 18.557, o
  // sea sobre lujo genuino. El tipeo que pretendía cazar lo caza yield_imposible.
  assertLimpio(
    { precioUF: 30_000, superficieM2: 150, ufCLP: 40_000, arriendoMensualCLP: 16_000_000 },
    "arriendo 16M en lujo",
  );
});

test("pegar el precio de venta en el arriendo lo sigue cazando yield_imposible", () => {
  assertReglas(
    { precioUF: 5_000, superficieM2: 50, ufCLP: 40_000, arriendoMensualCLP: 186_240_000 },
    ["yield_imposible"],
    "precio de venta en el campo arriendo",
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

test("tasa = 0 NO dispara (ausente, no tipeada)", () => {
  // Hallazgo de la calibración contra filas reales: había un análisis legítimo
  // con tasaInteres=0 (dato no capturado). Ningún wizard puede emitir 0 —
  // ambos caen a 4,72 — así que 0 significa ausente y no debe bloquear.
  assertLimpio({ ...baseTasa, tasaAnualPct: 0 }, "tasa 0");
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
seccion("10 · Límite — STR tarifa/noche: solo piso ($5.000), sin techo");

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

test("SIN techo: tarifa de $2.100.000/noche en un depto de lujo NO dispara", () => {
  assertLimpio(
    {
      precioUF: 100_000,
      superficieM2: 400,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 2_100_000, ocupacionPct: 50 },
    },
    "tarifa 2,1M en lujo",
  );
});

test("pegar el ingreso del mes en la tarifa lo sigue cazando str_yield_imposible", () => {
  assertReglas(
    {
      precioUF: 5_000,
      superficieM2: 50,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 3_000_000, ocupacionPct: 50 },
    },
    ["str_yield_imposible"],
    "ingreso mensual en el campo tarifa",
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
seccion("14 · Orden de presentación estable y determinístico");

test("uf_m2 va primero cuando concurre con precio y yield", () => {
  const out = evaluarPlausibilidad({
    precioUF: 4_800_000,
    superficieM2: 45,
    ufCLP: UF,
    arriendoMensualCLP: 950_000,
  });
  assert.equal(out[0].regla, "uf_m2_fuera_rango", `primero salió ${out[0].regla}`);
  assert.equal(out[1].regla, "precio_total_fuera_rango");
  assert.equal(out[2].regla, "yield_imposible");
});

test("superficie va antes que yield", () => {
  // UF/m² = 18,2 (dentro de rango) para aislar superficie + yield.
  const out = evaluarPlausibilidad({
    precioUF: 20_000,
    superficieM2: 1_100,
    ufCLP: UF,
    arriendoMensualCLP: 100_000,
  });
  const i = out.findIndex((a) => a.regla === "superficie_fuera_rango");
  const j = out.findIndex((a) => a.regla === "yield_imposible");
  assert.ok(i >= 0 && j >= 0, `esperaba ambas reglas, salió ${JSON.stringify(reglas(out))}`);
  assert.ok(i < j, "superficie debería ir antes que yield");
});

test("el orden no depende de la secuencia de evaluación (mismo input, mismo orden)", () => {
  const input: PlausibilidadInput = {
    precioUF: 4_800_000,
    superficieM2: 700,
    ufCLP: UF,
    tasaAnualPct: 45,
    arriendoMensualCLP: 90_000_000,
    str: { tarifaNocheCLP: 9_000_000, ocupacionPct: 900 },
  };
  const a = evaluarPlausibilidad(input).map((x) => x.regla);
  const b = evaluarPlausibilidad(input).map((x) => x.regla);
  assert.deepEqual(a, b);
  assert.equal(a[0], "uf_m2_fuera_rango");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("15 · REGLA DE COPY: ningún mensaje expone el umbral del guard");

/**
 * Los rangos son fusibles de ingeniería, deliberadamente holgados. Publicarlos
 * los convierte en recomendación implícita ("no pasa de UF 500" ⇒ 499 está
 * bien, cuando en Providencia lo normal son 60-130). Este test es el candado.
 *
 * Excepción documentada: str_ocupacion_fuera_rango nombra el 100% porque es una
 * verdad aritmética (365 noches), no una elección nuestra.
 */
const EXCEPCIONES_UMBRAL: Regla[] = ["str_ocupacion_fuera_rango"];

/** Todas las formas en que un umbral podría aparecer renderizado. */
function formasDelUmbral(n: number): string[] {
  const miles = Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });
  return [
    `UF ${miles}`,
    `$${miles}`,
    `${miles} m²`,
    `${(n * 100).toFixed(2).replace(".", ",")}%`,
    `${(n * 100).toFixed(3).replace(".", ",")}%`,
    `${String(n).replace(".", ",")}%`,
  ];
}

/** Casos que disparan cada regla, para inspeccionar su mensaje. */
const CASOS_COPY: Array<{ nombre: string; input: PlausibilidadInput }> = [
  { nombre: "uf_m2 alto", input: { precioUF: 4_800_000, superficieM2: 45, ufCLP: UF } },
  { nombre: "uf_m2 bajo", input: { precioUF: 400, superficieM2: 60, ufCLP: UF } },
  { nombre: "precio alto", input: { precioUF: 4_800_000, superficieM2: 45, ufCLP: UF } },
  { nombre: "precio bajo", input: { precioUF: 299, superficieM2: 29, ufCLP: UF } },
  { nombre: "superficie alta", input: { precioUF: 100_000, superficieM2: 1_200, ufCLP: UF } },
  { nombre: "superficie baja", input: { precioUF: 300, superficieM2: 11.9, ufCLP: UF } },
  {
    nombre: "yield bajo",
    input: { precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 95_000 },
  },
  {
    nombre: "yield alto",
    input: { precioUF: 300, superficieM2: 30, ufCLP: 40_000, arriendoMensualCLP: 260_000 },
  },
  {
    nombre: "arriendo bajo",
    input: { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 79_999 },
  },
  { nombre: "tasa alta", input: { ...baseTasa, tasaAnualPct: 45 } },
  { nombre: "tasa baja", input: { ...baseTasa, tasaAnualPct: 0.1 } },
  {
    nombre: "tarifa baja",
    input: {
      precioUF: 2_000,
      superficieM2: 20,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 4_999, ocupacionPct: 50 },
    },
  },
  {
    nombre: "str yield alto",
    input: {
      precioUF: 2_200,
      superficieM2: 20,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 100_000, ocupacionPct: 100 },
    },
  },
  {
    nombre: "str yield bajo",
    input: {
      precioUF: 10_000,
      superficieM2: 100,
      ufCLP: 40_000,
      str: { tarifaNocheCLP: 5_000, ocupacionPct: 100 },
    },
  },
];

test("ningún mensaje contiene su propio min ni su propio max renderizado", () => {
  const leaks: string[] = [];
  for (const caso of CASOS_COPY) {
    for (const a of evaluarPlausibilidad(caso.input)) {
      if (EXCEPCIONES_UMBRAL.includes(a.regla)) continue;
      for (const umbral of [a.rango[0], a.rango[1]]) {
        if (!Number.isFinite(umbral)) continue; // reglas sin techo
        for (const forma of formasDelUmbral(umbral)) {
          // Match con frontera: "UF 106.667" contiene "UF 10" como substring,
          // pero ese 10 es el valor del USUARIO, no el umbral. Exigimos que no
          // siga un dígito ni un separador de miles/decimal.
          const re = new RegExp(
            `${forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d.,])`,
          );
          if (re.test(a.mensaje)) {
            leaks.push(`${a.regla} (${caso.nombre}) filtra "${forma}" → ${a.mensaje}`);
          }
        }
      }
    }
  }
  assert.deepEqual(leaks, [], `umbrales filtrados:\n  ${leaks.join("\n  ")}`);
});

test("ningún mensaje dice 'Franco analiza hasta/desde'", () => {
  const leaks: string[] = [];
  for (const caso of CASOS_COPY) {
    for (const a of evaluarPlausibilidad(caso.input)) {
      if (/Franco analiza (hasta|desde)/.test(a.mensaje)) {
        leaks.push(`${a.regla}: ${a.mensaje}`);
      }
    }
  }
  assert.deepEqual(leaks, [], `mensajes con umbral explícito:\n  ${leaks.join("\n  ")}`);
});

test("ningún mensaje califica al usuario", () => {
  const prohibidas = /\b(absurd|ridícul|irrisori|disparat|insensat|obvio|error tuyo)/i;
  const leaks: string[] = [];
  for (const caso of CASOS_COPY) {
    for (const a of evaluarPlausibilidad(caso.input)) {
      if (prohibidas.test(a.mensaje)) leaks.push(`${a.regla}: ${a.mensaje}`);
    }
  }
  assert.deepEqual(leaks, [], `mensajes que califican al usuario:\n  ${leaks.join("\n  ")}`);
});

test("todo mensaje incluye el valor derivado del usuario", () => {
  for (const caso of CASOS_COPY) {
    for (const a of evaluarPlausibilidad(caso.input)) {
      assert.ok(a.mensaje.length > 20, `${a.regla}: mensaje demasiado corto`);
      assert.ok(/\d/.test(a.mensaje), `${a.regla}: no muestra ningún número — ${a.mensaje}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("16 · PRINCIPIO DE REDONDEO: el valor mostrado sigue estando fuera");

/**
 * El redondeo nunca puede mover el valor hacia adentro del rango aceptado. Un
 * mensaje que diga "12 m² no alcanza" cuando 12 es aceptado es incoherente.
 *
 * Para cada regla tomamos un valor APENAS fuera del rango y verificamos que el
 * número renderizado, parseado de vuelta, siga estando fuera.
 */

/** Parsea el primer número en formato chileno que aparezca tras `ancla`. */
function numeroTras(mensaje: string, ancla: string): number {
  const i = mensaje.indexOf(ancla);
  assert.ok(i >= 0, `no encontré "${ancla}" en: ${mensaje}`);
  const m = mensaje.slice(i + ancla.length).match(/-?[\d.]+(?:,\d+)?/);
  assert.ok(m, `no encontré número tras "${ancla}" en: ${mensaje}`);
  return Number(m[0].replace(/\./g, "").replace(",", "."));
}

const CASOS_REDONDEO: Array<{
  nombre: string;
  input: PlausibilidadInput;
  regla: Regla;
  ancla: string;
  dir: "alto" | "bajo";
  /** Escala del número renderizado respecto del rango (1 = misma, 100 = %). */
  escala?: number;
}> = [
  { nombre: "superficie 11,9 (piso 12)", input: { precioUF: 300, superficieM2: 11.9, ufCLP: UF }, regla: "superficie_fuera_rango", ancla: "", dir: "bajo" },
  { nombre: "superficie 1.000,4 (techo 1.000)", input: { precioUF: 50_000, superficieM2: 1_000.4, ufCLP: UF }, regla: "superficie_fuera_rango", ancla: "", dir: "alto" },
  { nombre: "uf_m2 9,96 (piso 10)", input: { precioUF: 597.6, superficieM2: 60, ufCLP: UF }, regla: "uf_m2_fuera_rango", ancla: "El m² te queda en UF ", dir: "bajo" },
  { nombre: "uf_m2 500,4 (techo 500)", input: { precioUF: 30_024, superficieM2: 60, ufCLP: UF }, regla: "uf_m2_fuera_rango", ancla: "El m² te queda en UF ", dir: "alto" },
  { nombre: "precio 299,6 (piso 300)", input: { precioUF: 299.6, superficieM2: 29, ufCLP: UF }, regla: "precio_total_fuera_rango", ancla: "UF ", dir: "bajo" },
  { nombre: "precio 0,1 (piso 300)", input: { precioUF: 0.1004, superficieM2: 43.2, ufCLP: UF }, regla: "precio_total_fuera_rango", ancla: "UF ", dir: "bajo" },
  { nombre: "arriendo 79.999,6 (piso 80.000)", input: { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 79_999.6 }, regla: "arriendo_fuera_rango", ancla: "$", dir: "bajo" },
  { nombre: "ocupación 100,4 (techo 100)", input: { precioUF: 5_000, superficieM2: 50, ufCLP: 40_000, str: { tarifaNocheCLP: 50_000, ocupacionPct: 100.4 } }, regla: "str_ocupacion_fuera_rango", ancla: "Una ocupación de ", dir: "alto" },
  { nombre: "tarifa 4.999,6 (piso 5.000)", input: { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 4_999.6, ocupacionPct: 50 } }, regla: "str_tarifa_fuera_rango", ancla: "$", dir: "bajo" },
  { nombre: "yield 0,4996% (piso 0,5%)", input: { precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 99_992 }, regla: "yield_imposible", ancla: "retorno bruto te da ", dir: "bajo", escala: 100 },
  { nombre: "yield 25,04% (techo 25%)", input: { precioUF: 300, superficieM2: 30, ufCLP: 40_000, arriendoMensualCLP: 250_400 }, regla: "yield_imposible", ancla: "retorno bruto te da ", dir: "alto", escala: 100 },
  { nombre: "str yield 40,04% (techo 40%)", input: { precioUF: 2_281.25, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 100_100, ocupacionPct: 100 } }, regla: "str_yield_imposible", ancla: "retorno bruto te da ", dir: "alto", escala: 100 },
];

for (const c of CASOS_REDONDEO) {
  test(`${c.nombre} → el número mostrado sigue fuera`, () => {
    const out = evaluarPlausibilidad(c.input);
    const a = out.find((x) => x.regla === c.regla);
    assert.ok(a, `no disparó ${c.regla}; salió ${JSON.stringify(reglas(out))}`);
    const mostrado = numeroTras(a.mensaje, c.ancla);
    const escala = c.escala ?? 1;
    const [min, max] = a.rango;
    if (c.dir === "bajo") {
      assert.ok(
        mostrado < min * escala,
        `mostró ${mostrado}, que el guard ACEPTA (piso ${min * escala}) — ${a.mensaje}`,
      );
      assert.notEqual(mostrado, 0, `mostró 0 para un valor no nulo — ${a.mensaje}`);
    } else {
      assert.ok(
        mostrado > max * escala,
        `mostró ${mostrado}, que el guard ACEPTA (techo ${max * escala}) — ${a.mensaje}`,
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
seccion("17 · Formato de porcentajes por tramo");

test("≥10% sin decimales · 1-10% un decimal · <1% tres decimales", () => {
  const alto = evaluarPlausibilidad({
    precioUF: 300, superficieM2: 30, ufCLP: 40_000, arriendoMensualCLP: 260_000,
  }).find((a) => a.regla === "yield_imposible");
  assert.ok(alto?.mensaje.includes("26% al año"), `esperaba "26% al año": ${alto?.mensaje}`);

  const bajo = evaluarPlausibilidad({
    precioUF: 6_000, superficieM2: 60, ufCLP: 40_000, arriendoMensualCLP: 95_000,
  }).find((a) => a.regla === "yield_imposible");
  assert.ok(bajo?.mensaje.includes("0,475% al año"), `esperaba "0,475% al año": ${bajo?.mensaje}`);
});

test("un valor entero se muestra entero (ocupación -5, no -5,0)", () => {
  const a = evaluarPlausibilidad({
    precioUF: 5_000, superficieM2: 50, ufCLP: 40_000,
    str: { tarifaNocheCLP: 50_000, ocupacionPct: -5 },
  }).find((x) => x.regla === "str_ocupacion_fuera_rango");
  assert.ok(a?.mensaje.includes("de -5% no existe"), `esperaba "-5%": ${a?.mensaje}`);
});

test("ningún porcentaje arrastra ceros de relleno (26,00%)", () => {
  const leaks: string[] = [];
  for (const caso of CASOS_COPY) {
    for (const a of evaluarPlausibilidad(caso.input)) {
      const m = a.mensaje.match(/\d+,(\d+)%/g) ?? [];
      for (const hit of m) if (/,0+%$/.test(hit)) leaks.push(`${a.regla}: ${hit} en "${a.mensaje}"`);
    }
  }
  assert.deepEqual(leaks, [], `porcentajes con ceros de relleno:\n  ${leaks.join("\n  ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("18 · Formateadores compartidos (los usa el modal en estado limpio)");

/**
 * El estado limpio del modal tenía formateadores propios: el mismo valor salía
 * "106667" ahí y "106.667" en el estado anomalía, y un retorno de 0,004% se
 * mostraba "0,0%". Estos son los que ahora usa, para que no haya dos.
 */

test("formatearNumero pone separador de miles chileno", () => {
  assert.equal(formatearNumero(106666.67), "106.667");
  assert.equal(formatearNumero(1234567), "1.234.567");
  assert.equal(formatearNumero(92), "92");
});

test("formatearNumero conserva decimales útiles en valores chicos", () => {
  assert.equal(formatearNumero(5.766), "5,8");
  assert.equal(formatearNumero(0.1004), "0,10");
});

test("formatearNumero coincide con el número del estado anomalía", () => {
  // Mismo valor, mismo string en los dos estados del modal.
  const a = evaluarPlausibilidad({ precioUF: 4_800_000, superficieM2: 45, ufCLP: UF })
    .find((x) => x.regla === "uf_m2_fuera_rango");
  assert.ok(a);
  assert.ok(a.mensaje.includes(formatearNumero(a.valor)), `"${a.mensaje}" no contiene "${formatearNumero(a.valor)}"`);
});

test("formatearPct aplica los tramos: ≥10% sin decimales", () => {
  assert.equal(formatearPct(0.26), "26%");
  assert.equal(formatearPct(0.048), "4,8%");
});

test("formatearPct usa tres decimales bajo 1% (no pierde la información)", () => {
  // El caso que motivó el fix: 0,004% se mostraba como "0,0%".
  assert.equal(formatearPct(0.00004), "0,004%");
  assert.equal(formatearPct(0.000061), "0,006%");
});

test("formatearPct no arrastra ceros de relleno", () => {
  assert.ok(!/,0+%$/.test(formatearPct(0.26)));
  assert.ok(!/,0+%$/.test(formatearPct(0.15)));
});

test("no finitos caen a guion, no a NaN", () => {
  assert.equal(formatearNumero(NaN), "—");
  assert.equal(formatearPct(Infinity), "—");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("19 · valorParaMostrar: el % va PEGADO y coincide con el mensaje");

/**
 * El modal separa número y unidad con 7-9px. Con el "%" en la unidad el símbolo
 * quedaba huérfano de su cifra — "0,006" + gap + "% anual" — contra el formato
 * del resto del sistema, que lo escribe pegado.
 */

test("ninguna unidad contiene '%'", () => {
  const conPct = (Object.keys(META_REGLA) as Regla[]).filter((r) => META_REGLA[r].unidad.includes("%"));
  assert.deepEqual(conPct, [], `unidades con % suelto: ${conPct.join(", ")}`);
});

test("yield: el número lleva el % pegado y la unidad es solo 'anual'", () => {
  const a = evaluarPlausibilidad({
    precioUF: 4_800_000, superficieM2: 45, ufCLP: UF, arriendoMensualCLP: 950_000,
  }).find((x) => x.regla === "yield_imposible");
  assert.ok(a);
  const v = valorParaMostrar(a);
  assert.equal(v.numero, "0,006%");
  assert.equal(v.unidad, "anual");
});

test("tasa y ocupación también llevan el % pegado", () => {
  const tasa = evaluarPlausibilidad({ precioUF: 5_500, superficieM2: 60, ufCLP: UF, tasaAnualPct: 45 })
    .find((x) => x.regla === "tasa_fuera_rango");
  assert.ok(tasa);
  assert.equal(valorParaMostrar(tasa).numero, "45%");
  assert.equal(valorParaMostrar(tasa).unidad, "anual");

  const occ = evaluarPlausibilidad({
    precioUF: 5_000, superficieM2: 50, ufCLP: 40_000,
    str: { tarifaNocheCLP: 50_000, ocupacionPct: 990 },
  }).find((x) => x.regla === "str_ocupacion_fuera_rango");
  assert.ok(occ);
  assert.equal(valorParaMostrar(occ).numero, "990%");
});

test("las unidades NO porcentuales quedan intactas", () => {
  const a = evaluarPlausibilidad({ precioUF: 4_800_000, superficieM2: 45, ufCLP: UF })
    .find((x) => x.regla === "uf_m2_fuera_rango");
  assert.ok(a);
  assert.equal(valorParaMostrar(a).numero, "106.667");
  assert.equal(valorParaMostrar(a).unidad, "UF / m²");
});

/**
 * COHERENCIA modal ↔ mensaje. Si difirieran sería el bug de los dos
 * formateadores otra vez. Para el MISMO input el número mostrado en el modal
 * tiene que aparecer literalmente dentro del mensaje.
 */
test("el número del modal aparece literal en el mensaje, para todas las reglas", () => {
  const casos: PlausibilidadInput[] = [
    { precioUF: 4_800_000, superficieM2: 45, ufCLP: UF, arriendoMensualCLP: 950_000 },
    { precioUF: 4_800_000, superficieM2: 45, ufCLP: UF, arriendoMensualCLP: 673_000 },
    { precioUF: 299, superficieM2: 29, ufCLP: UF },
    { precioUF: 100_000, superficieM2: 1_001, ufCLP: UF },
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, arriendoMensualCLP: 50_000 },
    { precioUF: 5_500, superficieM2: 60, ufCLP: UF, tasaAnualPct: 45 },
    { precioUF: 5_000, superficieM2: 50, ufCLP: 40_000, str: { tarifaNocheCLP: 50_000, ocupacionPct: 990 } },
    { precioUF: 2_000, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 2_000, ocupacionPct: 50 } },
    { precioUF: 2_200, superficieM2: 20, ufCLP: 40_000, str: { tarifaNocheCLP: 100_000, ocupacionPct: 100 } },
  ];
  const fallos: string[] = [];
  const vistas = new Set<Regla>();
  for (const input of casos) {
    for (const a of evaluarPlausibilidad(input)) {
      vistas.add(a.regla);
      const { numero } = valorParaMostrar(a);
      // El mensaje puede llevar el número con prefijo ($ / UF); comparamos la
      // parte numérica, que es la que tiene que coincidir dígito a dígito.
      const soloDigitos = numero.replace(/^[$]/, "");
      if (!a.mensaje.includes(soloDigitos)) {
        fallos.push(`${a.regla}: modal="${numero}" no aparece en "${a.mensaje}"`);
      }
    }
  }
  assert.deepEqual(fallos, [], `divergencias modal↔mensaje:\n  ${fallos.join("\n  ")}`);
  assert.equal(vistas.size, 9, `faltó cubrir alguna regla: ${[...vistas].join(", ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`\nFallidos:\n${fallidos.map((f) => `  · ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Guard de plausibilidad: todos los tests pasan.");
