// ============================================================================
// GOLDEN · [STR-ENGINEISM] — catch-test (04-sep-2026). 0 tokens, puro.
// ============================================================================
// Verbo-trayectoria del modelo: la tanda v13 lo destapó cuatro veces en tres seeds
// ("el flujo cruza a positivo"), más "converge" (GE-1) y "cruza el umbral" / "lo cruza"
// (GE-5, GE-6). El monitor solo detectaba; ahora la lista es una y el guard reintenta.
//   node --env-file=.env.local --import tsx scripts/eval/golden/engineism-str-catch-test.ts
//
// 06-sep-2026 (goal guards STR (c)): la familia "cruza al veredicto" que el juez vio en las
// tandas v15 y v16 y el regex no cazaba (20 oraciones en 12 salidas, 0 cazadas), las formas
// peladas ("ninguno cruza", "cruzarlo", "para cruzar"), la matriz como mecánica ("celdas")
// y las formas sin "cruza" ("pasa a positivo", "cambia el signo", "la ecuación se invierte",
// "el análisis marca a favor", "el modelo base"). El corpus completo vive en
// guards-v16-dump-catch-test.ts; acá van los testigos literales y lo que NO dispara.
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
  // ── v16 · familia "cruza al veredicto" (juez, 8 flags en 4 seeds) ──
  { nombre: "GE-3 · cruza al veredicto de arriba", dispara: true, texto: "ningún ajuste realista —ni bajar el precio 15%, ni subir la tarifa 10%, ni cambiar el modo de gestión— cruza al veredicto de arriba." },
  { nombre: "GE-2 · cruza el veredicto a COMPRAR", dispara: true, texto: "Decide el modo de gestión antes de firmar: autogestión cruza el veredicto a COMPRAR; con administrador, sigues en negativo $99.472 al mes." },
  { nombre: "GE-4 · cruza al veredicto superior", dispara: true, texto: "Ningún ajuste de tarifa, plazo ni modo de gestión cruza al veredicto superior: la brecha es estructural." },
  { nombre: "GE-4 · cruza a COMPRAR", dispara: true, texto: "el bloque de vías confirma que ningún ajuste realista cruza a COMPRAR: precio, tarifa, plazo, pie y gestión fueron probados y ninguno cruza." },
  { nombre: "GE-6 · cruza a AJUSTA SUPUESTOS", dispara: true, texto: "indica que la autogestión cruza a AJUSTA SUPUESTOS, lo que técnicamente abre una vía." },
  { nombre: "GE-1 · cruza esa línea", dispara: true, texto: "La frontera entre COMPRAR y AJUSTA SUPUESTOS está a solo −6,7% de ingreso desde el base: cualquier caída de tarifa o vacancia sostenida cruza esa línea." },
  { nombre: "GE-3 · cruza ese umbral", dispara: true, texto: "ni cambiar el modo de gestión— cruza ese umbral: la brecha es de la zona, no del departamento." },
  { nombre: "GE-5 · cruzar el veredicto hacia COMPRAR", dispara: true, texto: "ninguna de las cinco vías alcanza a cruzar el veredicto hacia COMPRAR según los datos provistos." },
  { nombre: "GE-3 · celdas cruzando al veredicto", dispara: true, texto: "la matriz de tarifa por ocupación tiene 0 de 16 celdas cruzando al veredicto de arriba, y bajar el precio hasta un 15% tampoco alcanza." },
  { nombre: "GE-4 · combinaciones cruza el veredicto", dispara: true, texto: "ninguna de las 16 combinaciones cruza el veredicto de arriba, lo que confirma que el techo está en el precio, no en la operación." },
  // ── v16 · formas peladas ──
  { nombre: "GE-4 · no se cruza con ningún ajuste", dispara: true, texto: "la brecha de UF 378 de sobreprecio no se cruza con ningún ajuste realista." },
  { nombre: "GE-5 · podría cruzarlo", dispara: true, texto: "la única variable que podría cruzarlo requiere un salto de ingreso de 14,6% que esta zona no muestra en sus datos." },
  { nombre: "GE-4 · para cruzar", dispara: true, texto: "no hay supuesto accionable que el usuario pueda mover para cruzar." },
  // ── v15 · sin "cruza" (juez) ──
  { nombre: "GE-2 v15 · el flujo pasa a positivo", dispara: true, texto: "si gestionas tú el depto en vez de delegarlo, el flujo pasa a positivo en $42.080 al mes" },
  { nombre: "GE-2 v15 · el flujo llega a positivo", dispara: true, texto: "con autogestión el flujo llega a positivo ($42.080 al mes)" },
  { nombre: "GE-4 v15 · cambia el signo del flujo", dispara: true, texto: "y cruzar ese umbral cambia el signo del flujo" },
  { nombre: "GE-6 v15 · la ecuación se invierte", dispara: true, texto: "el STR sube a $433.495 de NOI y la ecuación se invierte" },
  { nombre: "GE-5 v15 · el análisis marca a favor", dispara: true, texto: "28 pesos de cada 100 en costos operativos es una proporción que el análisis marca a favor" },
  { nombre: "GE-1 v16 · el modelo base", dispara: true, texto: "la estimación de mercado está en $47.496, y ahí el modelo base cambia por completo." },
  { nombre: "GE-1 v16 · el modelo positivo", dispara: true, texto: "el flujo base se estrecha y el modelo positivo se sostiene solo por el buen comportamiento de la ocupación." },
  // ── lo que NO dispara: consecuencia vivida y usos legítimos ──
  { nombre: "consecuencia vivida", dispara: false, texto: "Autogestionando dejas de poner plata cada mes: el arriendo pasa a cubrir la cuota." },
  { nombre: "consecuencia · ningún ajuste alcanza a cambiar la conclusión", dispara: false, texto: "Ningún ajuste realista de tarifa, plazo ni gestión alcanza a cambiar la conclusión: la brecha es del negocio, no de los supuestos." },
  { nombre: "consecuencia · el veredicto sube si mueves la gestión (juez: baja)", dispara: false, texto: "el veredicto solo sube si mueves la gestión o el precio, no la tarifa." },
  { nombre: "GE-6 · el análisis marca como referencia (fuente, no mecánica)", dispara: false, texto: "El stack de gastos y comisión consume 52 de cada 100 pesos del ingreso bruto, sobre la banda de 30-40% que el análisis marca como referencia." },
  { nombre: "modo de gestión / modelo de negocio", dispara: false, texto: "El modelo de negocio del corto exige 8-12 horas semanales; con administrador el modo de gestión cambia y el margen también." },
  { nombre: "el mes queda en positivo", dispara: false, texto: "Con 68% de ocupación el mes queda en positivo: $42.080 después de la cuota." },
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
