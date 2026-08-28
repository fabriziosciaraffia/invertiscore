/**
 * Tests de `detectarDrift` (`src/lib/data/comuna-prosa.ts`).
 *
 *   npx tsx scripts/test-drift-prosa-comuna.ts
 *
 * Cero red, cero DB: la función es pura. Mismo patrón que
 * `scripts/test-precio-para-cuota.ts`.
 *
 * CONTRATO QUE DEFIENDE ESTE ARCHIVO: la prosa de una comuna se genera una vez
 * y se persiste con la foto de los números que narró. Si esos números se mueven,
 * hay que REGENERAR — y el caso grave es que una tipología cambie de lado,
 * porque ahí la prosa afirma lo contrario de la tabla que tiene al lado.
 *
 * No es hipotético: durante la implementación, Providencia dio vuelta su
 * veredicto en cuatro días (su 4D pasó de faltarle $23.418 a sobrarle $99.734).
 * Si `veredicto-dado-vuelta` deja de detectarse, la página publica una
 * contradicción sin que nadie se entere.
 */

import assert from "node:assert/strict";
import { detectarDrift, snapshotDe, PROMPT_VERSION_COMUNA, type ProsaComuna } from "../src/lib/data/comuna-prosa";
import type { ComunaStats, TipologiaStats } from "../src/lib/data/comunas-seo";

let pass = 0, fail = 0;
const fallidos: string[] = [];
function test(nombre: string, fn: () => void) {
  try {
    fn(); pass++; console.log(`  OK   ${nombre}`);
  } catch (err) {
    fail++; fallidos.push(nombre);
    console.log(`  FAIL ${nombre}`);
    console.log(`       ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

function tip(over: Partial<TipologiaStats> = {}): TipologiaStats {
  return {
    dorms: 2, nArriendos: 400, nVentas: 500,
    arriendoCLP: 950_000, ventaCLP: 324_000_000, ventaUF: 7_942,
    rentabilidadBruta: 3.5, dividendoCLP: 1_239_700,
    brechaCLP: -289_700, cubre: false,
    precioCuotaCLP: 248_000_000, precioCuotaUF: 6_086,
    deltaPct: -23.4, pieNecesarioPct: 39, banda: "dificil", muestraChica: false,
    ...over,
  };
}

function stats(tipologias: TipologiaStats[], tasaAnual = 4.0): ComunaStats {
  return {
    nombre: "Providencia", slug: "providencia",
    totalPropiedades: 2806, arriendoRepresentativo: 1_011_554,
    rentabilidadBruta: 3.8, precioM2Promedio: 101.1, arriendoUFm2Mes: 0.2,
    nSegmentos: tipologias.length,
    tipologias,
    supuestos: { piePct: 20, plazoAnos: 30, tasaAnual, tasaEsViva: true, ufCLP: 40_870 },
    procedencia: {
      activosTotales: 3744, sinSuperficie: 894, fueraDeRango: 77,
      bajoUmbral: 0, enCalculo: 2806, ultimaActualizacion: "2026-08-28",
    },
  };
}

function prosaDe(s: ComunaStats, liderDorms: number | null): ProsaComuna {
  return {
    slug: s.slug, comuna: s.nombre,
    prosa: "…", snapshot: snapshotDe(s, liderDorms),
    promptVersion: PROMPT_VERSION_COMUNA, modelo: "test",
    generadaEn: "2026-08-28T00:00:00Z",
  };
}

// ── Sin drift ───────────────────────────────────────────────────────────────

console.log("\nEstabilidad · lo que no cambió no se regenera");

test("misma foto, mismos números → sin drift", () => {
  const s = stats([tip()]);
  const d = detectarDrift(prosaDe(s, 2), s, 2);
  assert.equal(d.hayDrift, false, `motivos: ${d.motivos.join(", ")}`);
});

test("una cifra que se mueve dentro de la tolerancia no dispara", () => {
  const s = stats([tip()]);
  const p = prosaDe(s, 2);
  const s2 = stats([tip({ arriendoCLP: 950_000 * 1.02 })]); // +2%, bajo el 3%
  assert.equal(detectarDrift(p, s2, 2).hayDrift, false);
});

// ── Con drift ───────────────────────────────────────────────────────────────

console.log("\nDetección · lo que vuelve vieja a la prosa");

test("sin prosa previa → drift", () => {
  const d = detectarDrift(null, stats([tip()]), 2);
  assert.equal(d.hayDrift, true);
  assert.deepEqual(d.motivos, ["sin-prosa"]);
});

test("EL CASO PROVIDENCIA: la tipología cambia de lado → drift", () => {
  const antes = stats([tip({ dorms: 4, cubre: false, brechaCLP: -23_418, deltaPct: -1.4 })]);
  const p = prosaDe(antes, 4);
  const ahora = stats([tip({ dorms: 4, cubre: true, brechaCLP: 99_734, deltaPct: 6.0 })]);
  const d = detectarDrift(p, ahora, 4);
  assert.equal(d.hayDrift, true);
  assert.ok(d.motivos.includes("veredicto-dado-vuelta"), `motivos: ${d.motivos.join(", ")}`);
});

test("el arriendo se mueve sobre la tolerancia → drift", () => {
  const s = stats([tip()]);
  const p = prosaDe(s, 2);
  const s2 = stats([tip({ arriendoCLP: 950_000 * 1.09 })]);
  const d = detectarDrift(p, s2, 2);
  assert.ok(d.motivos.includes("cifra-movida"));
});

test("aparece una tipología nueva → drift", () => {
  const s = stats([tip({ dorms: 2 })]);
  const p = prosaDe(s, 2);
  const s2 = stats([tip({ dorms: 2 }), tip({ dorms: 3 })]);
  const d = detectarDrift(p, s2, 2);
  assert.ok(d.motivos.includes("cambio-de-tipologias"));
});

test("cambia la tipología que encabeza → drift", () => {
  const s = stats([tip({ dorms: 2 }), tip({ dorms: 3 })]);
  const p = prosaDe(s, 2);
  assert.ok(detectarDrift(p, s, 3).motivos.includes("cambio-de-lider"));
});

test("se mueve la tasa → drift (mueve todos los dividendos a la vez)", () => {
  const s = stats([tip()], 4.0);
  const p = prosaDe(s, 2);
  const d = detectarDrift(p, stats([tip()], 4.5), 2);
  assert.ok(d.motivos.includes("supuestos-movidos"));
});

test("bump de versión del prompt → drift", () => {
  const s = stats([tip()]);
  const p = { ...prosaDe(s, 2), promptVersion: PROMPT_VERSION_COMUNA - 1 };
  assert.ok(detectarDrift(p, s, 2).motivos.includes("version-de-prompt"));
});

test("los motivos no se repiten aunque los gatille más de una tipología", () => {
  const s = stats([tip({ dorms: 2 }), tip({ dorms: 3 })]);
  const p = prosaDe(s, 2);
  const s2 = stats([
    tip({ dorms: 2, arriendoCLP: 950_000 * 1.2 }),
    tip({ dorms: 3, arriendoCLP: 950_000 * 1.2 }),
  ]);
  const d = detectarDrift(p, s2, 2);
  assert.equal(new Set(d.motivos).size, d.motivos.length);
});

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${pass} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log(`  Fallidos: ${fallidos.join(", ")}`);
  process.exit(1);
}
