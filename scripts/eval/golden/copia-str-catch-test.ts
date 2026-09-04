// ============================================================================
// GOLDEN · [STR-COPIA] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Ninguna oración de NINGÚN campo STR copia una fraseCanonica (run común ≥ 60% de la
// frase, mínimo 8 palabras). Hasta acá solo el lead pasaba por la regla (AS5 del golden);
// en producción no la miraba nadie. Misma función que A1 en LTR (copia-frase.ts).
//   node --env-file=.env.local --import tsx scripts/eval/golden/copia-str-catch-test.ts
// ============================================================================
import { frasesCanonicasDe } from "../../../src/lib/copia-frase";
import { copiaFraseCanonica, violacionesPorCampo, type ContextoGuardsStr } from "../../../src/lib/str-guards";
import type { AIAnalysisSTRv2 } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const frase = "La zona observa 47% de ocupación, bajo la banda típica de la comuna, y con ese piso el depto no se paga solo.";
const frases = frasesCanonicasDe([{ fraseCanonica: frase }, { fraseCanonica: "Tu CAP rate en corto es 2,4%, bajo el umbral de 5%." }]);

const casos: { nombre: string; texto: string; dispara: boolean }[] = [
  { nombre: "copia literal", dispara: true, texto: "Conviene con cuidado. La zona observa 47% de ocupación, bajo la banda típica de la comuna, y con ese piso el depto no se paga solo." },
  { nombre: "copia con marcas y recorte final", dispara: true, texto: "**La zona observa 47% de ocupación, bajo la banda típica de la comuna, y con ese piso** no alcanza." },
  { nombre: "reformulación fiel (cláusula métrica corta)", dispara: false, texto: "Con 47% de ocupación, bajo la banda típica, el depto necesita más noches de las que la zona entrega hoy." },
  { nombre: "frase corta de la card (menos de 8 palabras en común)", dispara: false, texto: "Tu CAP rate en corto es 2,4%: no justifica la operación." },
];
for (const c of casos) {
  const v = copiaFraseCanonica(c.texto, frases);
  if (c.dispara && !v) F(`${c.nombre}: debía disparar`);
  if (!c.dispara && v) F(`${c.nombre}: no debía disparar y dio «${v}»`);
}
// Cualquier campo, no solo el lead.
const ai = {
  conviene: { respuestaDirecta: "Limpio.", reencuadre: "Limpio.", cajaAccionable: "Limpio." },
  riesgos: { contenido: `Riesgo uno. ${frase} Riesgo dos.`, cajaAccionable: "Limpio." },
} as unknown as AIAnalysisSTRv2;
const ctx: ContextoGuardsStr = { razones: {}, estructural: false, frases, sobreRenta: 0 };
const v = violacionesPorCampo(ai, "copia", ctx);
if (!v["riesgos.contenido"]) F("la copia en riesgos.contenido debía disparar");
if (Object.keys(v).length !== 1) F(`solo un campo debía disparar, dispararon ${Object.keys(v).join(", ")}`);

console.log("\n[STR-COPIA] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
