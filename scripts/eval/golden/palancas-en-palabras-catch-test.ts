// ============================================================================
// GOLDEN · palancas en palabras — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Con total = 4 cada frase es BYTE A BYTE la que LTR mostraba antes de T1 (HeroLTR
// :117-123 y DrawerDistanciaLtr :713-721). Con total = 5 (STR) el conteo sale de las
// vías reales y nunca dice "cuatro".
//   node --env-file=.env.local --import tsx scripts/eval/golden/palancas-en-palabras-catch-test.ts
// ============================================================================
import { lineaFooterVias, introModalVias, totalEnPalabras } from "../../../src/lib/palancas-en-palabras";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const eq = (tag: string, got: string, esperado: string) => {
  if (got !== esperado) F(`${tag}\n    got:      «${got}»\n    esperado: «${esperado}»`);
};

// ── LTR (total 4): copy previo a T1, literal ──
eq("footer sin vías", lineaFooterVias(null, 4), "Franco probó cuatro ajustes que mueven el veredicto.");
eq("footer 0", lineaFooterVias(0, 4), "Franco probó cuatro ajustes. Ninguno mueve el veredicto.");
eq("footer 1", lineaFooterVias(1, 4), "Franco probó cuatro ajustes. Uno mueve el veredicto.");
eq("footer 2", lineaFooterVias(2, 4), "Franco probó cuatro ajustes. Dos mueven el veredicto.");
eq("footer 3", lineaFooterVias(3, 4), "Franco probó cuatro ajustes. Tres mueven el veredicto.");
eq("footer 4", lineaFooterVias(4, 4), "Franco probó cuatro ajustes. Los cuatro mueven el veredicto.");
const O = "COMPRAR";
eq("modal 0", introModalVias(0, 4, O), `Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Ninguna cruza a ${O}: cada una dice hasta dónde se probó.`);
eq("modal 1", introModalVias(1, 4, O), `Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Una cruza a ${O} por su cuenta; las demás dicen hasta dónde se probaron.`);
eq("modal 2", introModalVias(2, 4, O), `Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Dos cruzan a ${O}, cada una por su cuenta; las demás dicen hasta dónde se probaron.`);
eq("modal 3", introModalVias(3, 4, O), `Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Tres cruzan a ${O}, cada una por su cuenta; las demás dicen hasta dónde se probaron.`);
eq("modal 4", introModalVias(4, 4, O), `Franco probó cuatro ajustes, uno a la vez y con el resto fijo. Las cuatro cruzan a ${O}, cada una por su cuenta: no se suman, cualquiera alcanza.`);

// ── STR (total 5): vías reales, nunca "cuatro" ──
eq("total 5", totalEnPalabras(5), "cinco");
eq("footer STR 2/5", lineaFooterVias(2, 5), "Franco probó cinco ajustes. Dos mueven el veredicto.");
eq("footer STR 5/5", lineaFooterVias(5, 5), "Franco probó cinco ajustes. Los cinco mueven el veredicto.");
eq("footer STR 4/5", lineaFooterVias(4, 5), "Franco probó cinco ajustes. Los cuatro mueven el veredicto.");
eq("modal STR 2/5", introModalVias(2, 5, O), `Franco probó cinco ajustes, uno a la vez y con el resto fijo. Dos cruzan a ${O}, cada una por su cuenta; las demás dicen hasta dónde se probaron.`);
eq("modal STR 5/5", introModalVias(5, 5, O), `Franco probó cinco ajustes, uno a la vez y con el resto fijo. Las cinco cruzan a ${O}, cada una por su cuenta: no se suman, cualquiera alcanza.`);
for (const t of [lineaFooterVias(2, 5), introModalVias(2, 5, O), lineaFooterVias(0, 5)]) if (/cuatro/.test(t)) F(`STR dice "cuatro": «${t}»`);

console.log("\npalancas en palabras · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
