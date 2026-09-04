// ============================================================================
// GOLDEN · [STR-INTERNAS] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Testigo GE-5: "partiendo de un mercado donde el dato observado es fallback". El prompt
// nombra "override" y "fallback" como fuentes y el modelo las copia; la lista cubre además
// los nombres de rama del código que no tienen traducción al usuario.
//   node --env-file=.env.local --import tsx scripts/eval/golden/palabras-internas-str-catch-test.ts
// ============================================================================
import { hitsPalabrasInternas } from "../../../src/lib/str-guards";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const casos: { nombre: string; texto: string; dispara: boolean }[] = [
  { nombre: "GE-5 · fallback", dispara: true, texto: "Necesitas llenar 14 noches al mes partiendo de un mercado donde el dato observado es fallback." },
  { nombre: "override", dispara: true, texto: "La ocupación base viene de tu override, no de la zona." },
  { nombre: "recompute / snapshot", dispara: true, texto: "El recompute usa el snapshot de la mediana." },
  { nombre: "no_seguro", dispara: true, texto: "La regulación del edificio quedó en no_seguro." },
  { nombre: "lenguaje de usuario", dispara: false, texto: "No hay dato de ocupación observado propio: se usa una referencia conservadora de mercado del 45%." },
  { nombre: "el valor que tú definiste", dispara: false, texto: "La ocupación base es el valor que tú definiste, no lo observado en la zona." },
  { nombre: "palabras vecinas legítimas", dispara: false, texto: "El respaldo del banco y la ocupación de la comuna no cambian: sin sobresaltos." },
];
for (const c of casos) {
  const v = hitsPalabrasInternas(c.texto);
  if (c.dispara && v.length === 0) F(`${c.nombre}: debía disparar`);
  if (!c.dispara && v.length > 0) F(`${c.nombre}: no debía disparar y dio ${v.join(" | ")}`);
}
console.log("\n[STR-INTERNAS] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
