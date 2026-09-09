// ============================================================================
// GOLDEN · la regulación del edificio — catch-test (09-sep-2026). 0 tokens.
// ============================================================================
// Reemplaza al bloque `riesgos` del schema STR, que se retiró con acta. La auditoría
// sobre las 12 corridas v16 encontró que de las nueve familias de riesgo que el modelo
// escribía, OCHO ya las dibuja el motor; la novena —la regulación del edificio, la más
// frecuente— no se veía en ninguna parte de la página. Ahora la dibuja el motor y esto
// la fija: cobertura del 100% de las filas, siempre, en vez de 6 de 12 corridas y solo
// si el modelo se acordaba.
//
// Fija TRES cosas:
//
//   1. LOS TRES ESTADOS. `si` no renderiza NADA (que no aparezca es la señal de que no
//      hay nada que confirmar; un bloque tranquilizador ocuparía el mismo espacio para
//      no advertir nada). `no` es crítico. `no_seguro` avisa sin ser crítico.
//
//   2. EL MONTO EN RIESGO. El amoblamiento entra en el cuerpo cuando la fila lo trae, y
//      la frase se sostiene sin él cuando no. Es la plata que queda colgando de la
//      respuesta del reglamento.
//
//   3. LA NORMALIZACIÓN. Dos nombres de campo conviven en las filas persistidas
//      (`regulacionEdificio` lo lee el prompt, `edificioPermiteAirbnb` lo escribe el
//      wizard) y hay una variante vieja del valor. Sin dato ⇒ `no_seguro`, que es el
//      default del wizard y el que NO da por buena una condición que nadie confirmó.
//      Esta es la parte que más importa: un default a `si` haría desaparecer el bloque
//      justo en las filas donde falta el dato — el silencio más caro posible.
//
// Corre dentro del QUICK del runner (tier "regulación") y standalone:
//   node --import tsx scripts/eval/golden/regulacion-catch-test.ts
// ============================================================================
import { bloqueRegulacion, normalizarRegulacion, type EstadoRegulacion } from "../../../src/lib/regulacion-edificio";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const MONTO = "$2.500.000";

// ── 1 · los tres estados ────────────────────────────────────────────────────
if (bloqueRegulacion("si", MONTO) !== null) F("1 · con «si permite» NO debe renderizar nada");

const no = bloqueRegulacion("no", MONTO);
if (!no) F("1 · con «no permite» debe renderizar");
else {
  if (!no.critico) F("1 · «no permite» tiene que ser crítico: el reglamento ya dijo no");
  if (!/no permite/i.test(no.titulo)) F(`1 · el título de «no» no nombra la prohibición: «${no.titulo}»`);
}

const ns = bloqueRegulacion("no_seguro", MONTO);
if (!ns) F("1 · con «no estoy seguro» debe renderizar");
else {
  if (ns.critico) F("1 · «no estoy seguro» NO es crítico: todavía no hay una prohibición, hay un dato que falta");
  if (!/reglamento/i.test(ns.cuerpo)) F("1 · el cuerpo de «no_seguro» no nombra el reglamento de copropiedad, que es dónde se resuelve");
  if (!/antes de comprar/i.test(ns.cuerpo)) F("1 · «no_seguro» no dice cuándo verificar (antes de comprar)");
}

// ── 2 · el monto en riesgo ──────────────────────────────────────────────────
for (const e of ["no", "no_seguro"] as EstadoRegulacion[]) {
  const con = bloqueRegulacion(e, MONTO);
  const sin = bloqueRegulacion(e, null);
  if (!con || !sin) { F(`2 · ${e} no renderizó`); continue; }
  if (!con.cuerpo.includes(MONTO)) F(`2 · ${e}: el cuerpo no cita el amoblamiento (${MONTO})`);
  if (sin.cuerpo.includes(MONTO)) F(`2 · ${e}: sin monto, el cuerpo no debería inventarlo`);
  if (/amoblamiento/i.test(sin.cuerpo)) F(`2 · ${e}: sin monto, el cuerpo no debe hablar del amoblamiento`);
  if (sin.cuerpo.trim().length < 80) F(`2 · ${e}: sin monto la frase queda coja (${sin.cuerpo.length} chars)`);
}

// ── 3 · la normalización ────────────────────────────────────────────────────
const casos: [unknown, EstadoRegulacion, string][] = [
  [{ edificioPermiteAirbnb: "si" }, "si", "wizard · si"],
  [{ edificioPermiteAirbnb: "no" }, "no", "wizard · no"],
  [{ edificioPermiteAirbnb: "no_seguro" }, "no_seguro", "wizard · no_seguro"],
  [{ regulacionEdificio: "no" }, "no", "nombre que lee el prompt"],
  [{ regulacionEdificio: "no_estoy_seguro" }, "no_seguro", "variante vieja del valor"],
  [{ edificioPermiteAirbnb: "Sí" }, "si", "con tilde y mayúscula"],
  [{}, "no_seguro", "sin dato ⇒ no_seguro, nunca si"],
  [null, "no_seguro", "input null ⇒ no_seguro"],
  [{ edificioPermiteAirbnb: "" }, "no_seguro", "vacío ⇒ no_seguro"],
  [{ edificioPermiteAirbnb: "cualquier_cosa" }, "no_seguro", "valor desconocido ⇒ no_seguro"],
];
for (const [inp, esperado, nombre] of casos) {
  const got = normalizarRegulacion(inp);
  if (got !== esperado) F(`3 · ${nombre}: dio «${got}», se esperaba «${esperado}»`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRegulacionTier(): { hard: number } {
  console.log("\n─── TIER REGULACIÓN (el edificio permite operar por día · regulacion-edificio.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — tres estados, el monto en riesgo y 10 casos de normalización (sin dato ⇒ no_seguro)");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRegulacionTier();
  process.exit(hard ? 1 : 0);
}
