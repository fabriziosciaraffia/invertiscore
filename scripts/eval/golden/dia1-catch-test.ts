// ============================================================================
// GOLDEN · INVARIANTE DEL DÍA 1 — catch-test (03-sep-2026). 0 tokens, puro.
// ============================================================================
// El capítulo V descompone la plata del día 1 en pie + gastos de compra + puesta a
// punto, y esos tres tienen que sumar `exit.inversionInicial`. La comprobación vivía
// en el componente con igualdad estricta y avisaba en 190 de 1.192 filas del parque
// por centavos: `pieCLP` es `precio × pie%` (float) y el exit guarda
// `Math.round(inversionInicial)`. Ninguna fila descuadra por $1 o más.
// Lo que fija:
//   · caso exacto (diferencia 0) ⇒ sin aviso.
//   · cb0e8f46 real (28 centavos de redondeo) ⇒ sin aviso.
//   · descuadre de $1 y de $1.000 ⇒ avisa, con el monto en el mensaje.
//   · barraDia1 sigue devolviendo la misma geometría en los tres casos.
//
//   node --env-file=.env.local --import tsx scripts/eval/golden/dia1-catch-test.ts
// ============================================================================
import { avisoDia1, descuadreDia1, barraDia1, TOLERANCIA_DIA1_CLP } from "../../../src/lib/plata-dia1";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

// Caso exacto: pie entero, sin capex.
const exacto = { pieCLP: 20_000_000, gastosCompraCLP: 2_000_000, capexCLP: 0, inversionInicial: 22_000_000 };
if (descuadreDia1(exacto) !== 0) F(`exacto · descuadre ${descuadreDia1(exacto)} ≠ 0`);
if (avisoDia1(exacto) !== null) F(`exacto · debía no avisar, avisó: ${avisoDia1(exacto)}`);

// cb0e8f46 (Huechuraba) tal cual lo recomputa el motor: el pie trae 28 centavos y el
// exit guarda la inversión inicial redondeada.
const cb0e8f46 = { pieCLP: 41_618_724.28, gastosCompraCLP: 4_161_872, capexCLP: 0, inversionInicial: 45_780_596 };
const dCb = descuadreDia1(cb0e8f46);
if (Math.abs(dCb - 0.28) > 0.001) F(`cb0e8f46 · descuadre ${dCb} ≠ 0,28`);
if (avisoDia1(cb0e8f46) !== null) F(`cb0e8f46 · 28 centavos no debía avisar, avisó: ${avisoDia1(cb0e8f46)}`);

// Justo bajo la tolerancia: no avisa. Justo en la tolerancia: avisa.
if (avisoDia1({ ...exacto, inversionInicial: 22_000_000 - 0.99 }) !== null) F("0,99 no debía avisar");
if (avisoDia1({ ...exacto, inversionInicial: 22_000_000 - TOLERANCIA_DIA1_CLP }) === null) F("$1 exacto debía avisar");

// Sumando perdido de verdad: la puesta a punto que no llegó al total.
const faltaCapex = { pieCLP: 20_000_000, gastosCompraCLP: 2_000_000, capexCLP: 1_000, inversionInicial: 22_000_000 };
const aviso = avisoDia1(faltaCapex);
if (aviso === null) F("un descuadre de $1.000 debía avisar");
else if (!aviso.includes("1.000")) F(`el aviso debía nombrar el monto: ${aviso}`);

// La geometría no cambia con el descuadre: los tres casos reparten igual.
for (const [nombre, caso] of [["exacto", exacto], ["cb0e8f46", cb0e8f46], ["faltaCapex", faltaCapex]] as const) {
  const b = barraDia1({ ...caso, patrimonio: 44_000_000 });
  const suma = b.segmentos.reduce((a, s) => a + s.pct, 0);
  if (b.segmentos.length === 0) F(`${nombre} · sin segmentos`);
  if (Math.abs(suma - 100) > 0.01) F(`${nombre} · los segmentos suman ${suma.toFixed(2)}, no 100`);
  if (b.anchoPct <= 0 || b.anchoPct > 100) F(`${nombre} · ancho fuera de rango: ${b.anchoPct}`);
}
// Sin capex el segmento no existe (dos barras, no tres).
if (barraDia1({ ...exacto, patrimonio: 44_000_000 }).segmentos.length !== 2) F("sin capex debían quedar 2 segmentos");

console.log("\nINVARIANTE DEL DÍA 1 · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
