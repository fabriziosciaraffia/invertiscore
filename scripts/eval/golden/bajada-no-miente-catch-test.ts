// ============================================================================
// GOLDEN · LA CARD NO DICE «NO HAY FORMA» CUANDO SÍ LA HAY — catch-test. 0 tokens.
// ============================================================================
// El invariante más duro de la card de §5, y el único que es sobre la VERDAD y no sobre
// la forma: si el motor produjo un mix que llega a COMPRAR, o palancas que cruzan solas,
// la bajada NO puede decir que no hay forma de que el departamento convenga.
//
// POR QUÉ EXISTE. Se encontró midiendo el DOM con el interruptor ya encendido:
// `providenciaLtrV20` es AJUSTA SUPUESTOS, su motor tiene mix Y palancas solas, y la
// card decía «No hay forma de que este departamento convenga». La causa era un gate de
// prosa —`dosBloques`— delante del bloque determinista: sin prosa v21+ el bloque llegaba
// `undefined` y la bajada leía esa ausencia como «no hay salida». 1.194 de 1.202 filas
// del parque estaban en esa rama.
//
// «SIN BLOQUE» NO ES «SIN SALIDA». Es la tercera vez que la misma confusión aparece en
// otra capa: primero «sin mix ≠ sin salida», después ésta. Lo que se fija acá es la
// afirmación, no la implementación: la bajada puede decir muchas cosas, pero no ESA
// cuando el dato la contradice.
//
// Fija CUATRO casos, todos deterministas y sin base:
//
//   1. Mix que llega a COMPRAR        → no dice «no hay forma»
//   2. Sin mix, con palancas que cruzan → no dice «no hay forma»
//   3. Bloque AUSENTE                  → no afirma: ni promete ni niega
//   4. Sin mix y sin palancas          → sí puede decirlo, que es cuando es verdad
//
// Corre dentro del QUICK (tier "bajada-no-miente") y standalone:
//   node --import tsx scripts/eval/golden/bajada-no-miente-catch-test.ts
// ============================================================================
import { bajadaRecomendacion, type BloqueLoQueHariaYo, type MixLoQueHariaYo } from "@/lib/lo-que-haria-yo";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

const NIEGA = "No hay forma";

const mixA = (destino: "COMPRAR" | "AJUSTA SUPUESTOS"): MixLoQueHariaYo => ({
  titulo: "x",
  destino,
  movimiento: { pie: { de: 20, a: 30 }, plazo: { de: 25, a: 30 } },
  contraste: null,
  costo: "$1 más el día uno",
  descuento: "−4,8%",
  sinDescuento: null,
});

const bloque = (p: Partial<BloqueLoQueHariaYo>): BloqueLoQueHariaYo => ({
  rotulo: "x", contexto: null, filas: [], mix: null, descarte: null, ...p,
});

const unaFila = { titulo: "Bajar el precio", rotuloCorto: "Solo el precio", quien: "vendedor" as const, cifra: "−24,1%", objetivo: "UF 4.175" };

// ── 1 · mix que llega a COMPRAR ───────────────────────────────────────────
{
  const b = bajadaRecomendacion("AJUSTA SUPUESTOS", bloque({ mix: mixA("COMPRAR") }));
  if (b.includes(NIEGA)) F(`1 · con un mix que llega a COMPRAR la bajada dice «${b}». El motor encontró la salida y la card la niega.`);
}

// ── 2 · sin mix, pero con palancas que cruzan ─────────────────────────────
{
  const b = bajadaRecomendacion("AJUSTA SUPUESTOS", bloque({ filas: [unaFila] }));
  if (b.includes(NIEGA)) F(`2 · con palancas que cruzan solas la bajada dice «${b}». Esas filas SON salidas: el motor las midió contra COMPRAR.`);
}

// ── 3 · bloque AUSENTE: no se afirma nada ─────────────────────────────────
// Es el caso de las 1.194 filas: el bloque no llegó, y de la ausencia no se deduce que
// no haya salida — solo que no se sabe. Afirmar ahí es lo que rompió esto.
for (const ausente of [null, undefined]) {
  const b = bajadaRecomendacion("AJUSTA SUPUESTOS", ausente);
  if (b.includes(NIEGA)) {
    F(`3 · sin bloque (${ausente === null ? "null" : "undefined"}) la bajada AFIRMA: «${b}». «Sin bloque» no es «sin salida» — es «no se sabe», y de eso no se concluye nada.`);
  }
}

// ── 3b · mix al escalón PERO con palancas que cruzan ──────────────────────
// El cruce que faltaba. El mix al escalón no es una recomendación (§5) y no se dibuja,
// pero si además hay palancas que cruzan solas a COMPRAR, sí hay forma. Medido: 2 filas
// del parque están ahí, y con el orden invertido la card les negaba la salida.
{
  const b = bajadaRecomendacion("BUSCAR OTRA", bloque({ mix: mixA("AJUSTA SUPUESTOS"), filas: [unaFila] }));
  if (b.includes(NIEGA)) {
    F(`3b · con el mix al escalón PERO palancas que cruzan solas, la bajada dice «${b}». El mix no es la recomendación, pero las palancas sí llegan: negarlo es falso.`);
  }
}

// ── 4 · sin mix y sin palancas: ahí sí ────────────────────────────────────
// El invariante no es «nunca lo diga»: es «no lo diga cuando el dato lo contradice».
// Con un bloque que existe y no trae ninguna salida, decirlo es correcto.
{
  const b = bajadaRecomendacion("BUSCAR OTRA", bloque({}));
  if (!b.includes(NIEGA)) F(`4 · con un bloque SIN mix y SIN palancas la bajada dejó de decirlo: «${b}». Ahí es verdad, y callarla sería el error opuesto.`);
}

// ── 5 · COMPRAR nunca lo dice ─────────────────────────────────────────────
{
  const b = bajadaRecomendacion("COMPRAR", bloque({ filas: [unaFila] }));
  if (b.includes(NIEGA)) F(`5 · en COMPRAR la bajada dice «${b}»`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runBajadaNoMienteTier(): { hard: number } {
  console.log("\n─── TIER BAJADA-NO-MIENTE (la card no niega lo que el motor encontró · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la bajada no niega con mix a COMPRAR ni con palancas que cruzan, no afirma sin bloque, y sí lo dice cuando el bloque existe y no trae salida");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runBajadaNoMienteTier();
  process.exit(hard ? 1 : 0);
}
