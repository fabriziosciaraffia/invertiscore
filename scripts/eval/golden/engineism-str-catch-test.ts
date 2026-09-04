// ============================================================================
// GOLDEN · [STR-ENGINEISM] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Verbo-trayectoria del modelo: la tanda v13 lo destapó cuatro veces en tres seeds
// ("el flujo cruza a positivo"), más "converge" (GE-1) y "cruza el umbral" / "lo cruza"
// (GE-5, GE-6). El monitor solo detectaba; ahora la lista es una y el guard reintenta.
//   node --env-file=.env.local --import tsx scripts/eval/golden/engineism-str-catch-test.ts
// ============================================================================
import { hitsEngineIsm } from "../../../src/lib/str-guards";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const casos: { nombre: string; texto: string; dispara: boolean }[] = [
  { nombre: "GE-2 · cruza a positivo", dispara: true, texto: "autogestionando te ahorras $141.552 al mes y el flujo cruza a positivo" },
  { nombre: "GE-1 · converge", dispara: true, texto: "Si el ADR real converge a ese valor, el NOI cae y el CAP se aleja aún más del umbral." },
  { nombre: "GE-5 · cruza el umbral", dispara: true, texto: "El CAP no cruza el umbral con ningún ajuste de gestión." },
  { nombre: "GE-6 · lo cruza", dispara: true, texto: "ni un descuento de 10% en el precio lo cruza" },
  { nombre: "GE-6 · apenas cruza a positivo", dispara: true, texto: "la matriz muestra que el flujo apenas cruza a positivo" },
  { nombre: "lista vieja · punto de quiebre", dispara: true, texto: "el punto de quiebre está en 61% de ocupación" },
  { nombre: "GE-3 · puede cruzar", dispara: true, texto: "un margen muy estrecho que cualquier mes flojo puede cruzar" },
  { nombre: "consecuencia vivida", dispara: false, texto: "Autogestionando dejas de poner plata cada mes: el arriendo pasa a cubrir la cuota." },
  { nombre: "cruzar la calle no es trayectoria", dispara: false, texto: "El depto queda a dos cuadras del metro, cruzando la avenida." },
  { nombre: "número redondo", dispara: false, texto: "Si la tarifa real baja a la del mercado, el NOI queda en $477.219 al mes." },
];
for (const c of casos) {
  const v = hitsEngineIsm(c.texto);
  if (c.dispara && v.length === 0) F(`${c.nombre}: debía disparar`);
  if (!c.dispara && v.length > 0) F(`${c.nombre}: no debía disparar y dio ${v.join(" | ")}`);
}
console.log("\n[STR-ENGINEISM] · catch-test\n");
if (fallas.length) { for (const x of fallas) console.log("  ✗ " + x); console.log(`\n✗ ROJO — ${fallas.length} falla(s)`); process.exit(1); }
console.log("✓ VERDE");
