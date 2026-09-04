// ============================================================================
// GOLDEN · [STR-MODALIDAD] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// "Corto o largo" tiene una fuente: el signo de la sobre-renta medida (hallazgo
// ventaja_vs_ltr). Hasta v14 el prompt obligaba "el largo rinde más neto" por banda, y la
// banda salía del tier de zona: 51 filas del parque decían LTR con STR rindiendo más.
// El detector caza la afirmación que contradice el signo y deja pasar el resto.
//   node --env-file=.env.local --import tsx scripts/eval/golden/modalidad-str-catch-test.ts
// ============================================================================
import { afirmacionesContraSigno } from "../../../src/lib/str-guards";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const STR_GANA = 180_000;   // sobre-renta +$180.000/mes: el corto rinde más
const LTR_GANA = -95_000;   // sobre-renta −$95.000/mes: el largo rinde más

const casos: { nombre: string; sr: number; texto: string; dispara: boolean }[] = [
  // ── contradicciones (deben disparar) ──
  { nombre: "v14 · largo rinde más neto con STR ganando", sr: STR_GANA, dispara: true,
    texto: "En tu zona el arriendo largo rinde más neto que el corto: la complejidad operativa no se justifica." },
  { nombre: "LTR rinde más con STR ganando", sr: STR_GANA, dispara: true,
    texto: "Con esa demanda, LTR rinde más neto y te ahorra la gestión." },
  { nombre: "conviene el largo con STR ganando", sr: STR_GANA, dispara: true,
    texto: "Con una zona de demanda baja, conviene el largo." },
  { nombre: "te conviene LTR con STR ganando", sr: STR_GANA, dispara: true,
    texto: "Acá te conviene LTR aunque el corto muestre un margen." },
  { nombre: "el corto deja menos (= largo gana) con STR ganando", sr: STR_GANA, dispara: true,
    texto: "El arriendo corto te deja menos neto que el largo una vez que pagas la gestión." },
  { nombre: "STR rinde más con LTR ganando", sr: LTR_GANA, dispara: true,
    texto: "Airbnb rinde más que el arriendo tradicional en este edificio." },
  { nombre: "el corto supera al largo con LTR ganando", sr: LTR_GANA, dispara: true,
    texto: "El corto supera al largo por la tarifa de temporada alta." },
  { nombre: "conviene más el corto con LTR ganando", sr: LTR_GANA, dispara: true,
    texto: "Por flujo, conviene más el corto." },
  { nombre: "dentro de marcas", sr: STR_GANA, dispara: true,
    texto: "**El largo rinde más neto acá** y el amoblamiento no se paga." },

  // ── coherentes con el signo (no disparan) ──
  { nombre: "el corto rinde más con STR ganando", sr: STR_GANA, dispara: false,
    texto: "El corto rinde $180.000 más neto al mes que el largo, y la gestión se paga sola." },
  { nombre: "el largo rinde más con LTR ganando", sr: LTR_GANA, dispara: false,
    texto: "El arriendo largo rinde $95.000 más neto: el esfuerzo del corto no se justifica con ese margen." },
  { nombre: "está parejo, sin ganador", sr: STR_GANA, dispara: false,
    texto: "Está parejo: la diferencia es de $180.000 al mes y la decisión es operativa." },
  { nombre: "'más que el largo' no convierte al largo en sujeto", sr: STR_GANA, dispara: false,
    texto: "STR rinde más que el largo por $180.000 al mes." },
  { nombre: "negación pegada no se evalúa", sr: STR_GANA, dispara: false,
    texto: "El largo no rinde más que el corto en esta zona." },
  { nombre: "largo plazo no es modalidad", sr: STR_GANA, dispara: false,
    texto: "A largo plazo el patrimonio rinde más que el flujo." },
  { nombre: "plazo más corto no es modalidad", sr: LTR_GANA, dispara: false,
    texto: "Un plazo más corto deja más flujo libre al año 10." },
  { nombre: "sobre-renta cero: sin signo", sr: 0, dispara: false,
    texto: "El largo rinde más neto acá." },
  { nombre: "descripción del tier sin ganador", sr: STR_GANA, dispara: false,
    texto: "La demanda de la zona es baja frente al resto de Santiago; operar corto acá depende de superar al mercado típico." },
];

for (const c of casos) {
  const v = afirmacionesContraSigno(c.texto, c.sr);
  if (c.dispara && v.length === 0) F(`${c.nombre}: debía disparar`);
  if (!c.dispara && v.length > 0) F(`${c.nombre}: no debía disparar y dio «${v.join(" | ")}»`);
}
console.log("\n[STR-MODALIDAD] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log(`✓ VERDE — ${casos.length} casos`);
