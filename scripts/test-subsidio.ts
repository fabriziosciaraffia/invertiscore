// ─────────────────────────────────────────────────────────────────────────────
// Tests del Subsidio a la Tasa (`src/lib/constants/subsidio.ts` + el margen del
// aviso anticipado del wizard).
//
// POR QUÉ EXISTEN
// ──────────────
// El audit del 20-ago-2026 encontró que este camino no tenía NINGUNA red:
// ningún seed del Golden setea `esNuevo`, así que ninguno califica al subsidio
// y el Golden pasa en verde con la lógica del subsidio completamente rota.
//
// Y lo que se rompe acá se rompe en silencio. El caso testigo es `AVISO_MARGEN_UF`:
// era el literal 4400 (techo 4.000 + 10%), y al subir el techo a 6.000 ese
// literal habría apagado el aviso anticipado para TODO el tramo nuevo — sin
// excepción, sin log, sin que nadie se enterara. Un número que se queda quieto
// mientras el otro se mueve compila perfecto.
//
// Correr: node --import tsx scripts/test-subsidio.ts
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  REBAJA_SUBSIDIO,
  TECHO_UF_SUBSIDIO,
  calcTasaConSubsidio,
  calificaSubsidio,
  aplicaSubsidio,
} from "../src/lib/constants/subsidio";
import { AVISO_MARGEN_UF } from "../src/components/formulario-v4/wizardV4Subsidio";

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

// ─────────────────────────────────────────────────────────────────────────────
seccion("El techo: 6.000 UF, inclusivo");
// ─────────────────────────────────────────────────────────────────────────────

test("el techo vigente es 6.000 UF (ampliación despachada el 11-ago-2026)", () => {
  assert.equal(TECHO_UF_SUBSIDIO, 6000);
});

test("6.000 UF EXACTAS califican — el borde es inclusivo", () => {
  assert.equal(calificaSubsidio("nuevo", 6000), true);
});

test("6.000,01 UF ya no califica", () => {
  assert.equal(calificaSubsidio("nuevo", 6000.01), false);
});

test("el tramo que la ampliación abrió (4.000-6.000) ahora califica", () => {
  // Son los ~15 deptos que el audit encontró en la base esperando este cambio.
  for (const p of [4000.01, 4135, 4800, 5300, 5900, 6000]) {
    assert.equal(calificaSubsidio("nuevo", p), true, `UF ${p} debería calificar`);
  }
});

test("lo que ya calificaba sigue calificando", () => {
  for (const p of [300, 2600, 3200, 4000]) {
    assert.equal(calificaSubsidio("nuevo", p), true, `UF ${p} dejó de calificar`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("Solo vivienda nueva — y el precio tiene que ser un precio");
// ─────────────────────────────────────────────────────────────────────────────

test("un usado NO califica, por barato que sea", () => {
  assert.equal(calificaSubsidio("usado", 2000), false);
  assert.equal(calificaSubsidio("usado", 6000), false);
});

test("acepta 'nuevo' y 'Nuevo' (las dos formas que llegan del wizard)", () => {
  assert.equal(calificaSubsidio("nuevo", 3000), true);
  assert.equal(calificaSubsidio("Nuevo", 3000), true);
});

test("'Departamento' NO califica — es el fallback legacy y debe dar false", () => {
  // Es lo que reciben los análisis v3/históricos sin `esNuevo`, y también los
  // seeds del Golden. Si esto diera true, medio Golden cambiaría de prosa.
  assert.equal(calificaSubsidio("Departamento", 3000), false);
  assert.equal(calificaSubsidio("", 3000), false);
});

test("precio 0 o negativo no califica", () => {
  assert.equal(calificaSubsidio("nuevo", 0), false);
  assert.equal(calificaSubsidio("nuevo", -100), false);
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("La rebaja: 0,6 pp como PISO");
// ─────────────────────────────────────────────────────────────────────────────

test("resta la rebaja a la tasa de mercado", () => {
  assert.equal(calcTasaConSubsidio(4.7), 4.1);
  assert.equal(calcTasaConSubsidio(5.2), 4.6);
});

test("redondea a un decimal, que es como se muestra la tasa", () => {
  assert.equal(calcTasaConSubsidio(4.72), 4.1);
  assert.equal(calcTasaConSubsidio(4.75), 4.2);
});

test("la rebaja modelada es el PISO de la ley, no la cifra exacta", () => {
  // La ley fija "hasta 60 pb" y la rebaja efectiva va de 0,61 a 1,16 pp según
  // el banco. Modelar 0,6 subestima el beneficio a propósito: Franco nunca
  // promete de más. Si alguien sube esta constante, está prometiendo.
  assert.equal(REBAJA_SUBSIDIO, 0.6);
});

test("`aplicado` tolera el redondeo del usuario, pero no una tasa cualquiera", () => {
  const conSub = calcTasaConSubsidio(4.7); // 4,1
  assert.equal(aplicaSubsidio(4.1, conSub), true, "la tasa exacta cuenta");
  assert.equal(aplicaSubsidio(4.3, conSub), true, "dentro de la tolerancia de 0,2");
  assert.equal(aplicaSubsidio(3.8, conSub), true, "una tasa mejor también cuenta");
  assert.equal(aplicaSubsidio(4.7, conSub), false, "la de mercado NO es la subsidiada");
});

// ─────────────────────────────────────────────────────────────────────────────
seccion("El margen del aviso anticipado sigue al techo");
// ─────────────────────────────────────────────────────────────────────────────

test("REGRESIÓN: `AVISO_MARGEN_UF` es DERIVADO del techo, no un literal", () => {
  // Este es el test que existe por el riesgo #1 del audit. Si alguien vuelve a
  // escribir el número a mano y después mueve el techo, el aviso anticipado se
  // apaga en silencio para todo el tramo nuevo.
  assert.equal(AVISO_MARGEN_UF, (TECHO_UF_SUBSIDIO * 11) / 10);
});

test("el margen queda por ENCIMA del techo (para eso existe)", () => {
  // Compara contra una estimación interna de valor, que puede quedar corta:
  // el margen es la holgura para no perder casos que sí van a calificar.
  assert.ok(AVISO_MARGEN_UF > TECHO_UF_SUBSIDIO);
});

test("con el techo en 6.000, el margen cubre el tramo nuevo completo", () => {
  assert.equal(AVISO_MARGEN_UF, 6600);
  assert.ok(AVISO_MARGEN_UF >= 6000, "un depto estimado en 6.000 tiene que avisar");
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`${ok} OK · ${fail} FAIL`);
if (fail > 0) {
  console.log("Subsidio: hay tests en rojo.");
  process.exit(1);
}
console.log("Subsidio: todos los tests pasan.");
