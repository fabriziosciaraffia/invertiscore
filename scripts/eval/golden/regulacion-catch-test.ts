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
// Fija CUATRO cosas:
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
//   4. EL ANCLA A DATOS REALES. Los tres bloques de arriba se prueban con objetos armados
//      a mano, y eso valida el contrato contra lo que supuso quien escribió el test. El
//      cuarto lee el `input_data` de las seis filas de producción congeladas en
//      str-seeds-frozen.json: es el único que caza un nombre de clave equivocado.
//
// Corre dentro del QUICK del runner (tier "regulación") y standalone:
//   node --import tsx scripts/eval/golden/regulacion-catch-test.ts
// ============================================================================
import { bloqueRegulacion, normalizarRegulacion, type EstadoRegulacion } from "../../../src/lib/regulacion-edificio";
import { loadFrozen } from "./str-seeds";

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

// ── 4 · EL ANCLA: filas REALES, no objetos armados a mano ───────────────────
// Los diez casos de arriba validan el contrato de la función contra lo que supuso quien
// la escribió. No cazan un nombre de clave equivocado, porque el test lo escribe el mismo
// que escribió el módulo: si los dos se equivocan igual, los dos coinciden. De hecho pasó
// —el orden del lookup tenía primero `regulacionEdificio`, que NO existe en `input_data`—
// y lo cazó una query a la base, no este archivo.
//
// Así que acá se lee el `input_data` de las seis filas de producción congeladas en
// str-seeds-frozen.json, con el MISMO loader que usa la tanda STR. El estado esperado va
// escrito en la tabla de abajo y NO se deriva del fixture: derivarlo sería una tautología
// que renombrar la clave dejaría verde.
//
// Cobertura honesta: las seis filas cubren «si» y «no_seguro». «no» no aparece porque en
// el parque hay UNA sola fila con ese valor (1 de 246) y no está entre las congeladas;
// ese estado lo fijan los bloques 1 y 3.
const ESPERADO_FROZEN: Record<string, EstadoRegulacion> = {
  "GE-1": "si", "GE-2": "no_seguro", "GE-3": "si",
  "GE-4": "no_seguro", "GE-5": "no_seguro", "GE-6": "si",
};
const frozen = loadFrozen();
for (const [key, esperado] of Object.entries(ESPERADO_FROZEN)) {
  const fx = frozen[key];
  if (!fx) { F(`4 · ${key}: no está en str-seeds-frozen.json`); continue; }
  const d = fx.input_data;
  // La costura: los DOS campos que el componente lee de `input_data`, por nombre.
  if (!("edificioPermiteAirbnb" in d)) {
    F(`4 · ${key}: la fila real no trae «edificioPermiteAirbnb» — el módulo lee una clave que no existe`);
  }
  if (typeof d.costoAmoblamiento !== "number" || !(d.costoAmoblamiento > 0)) {
    F(`4 · ${key}: «costoAmoblamiento» no es un número positivo (${JSON.stringify(d.costoAmoblamiento)})`);
  }
  const got = normalizarRegulacion(d);
  if (got !== esperado) F(`4 · ${key} (fila real ${fx.srcId.slice(0, 8)}): dio «${got}», se esperaba «${esperado}»`);
}
// Que una seed nueva no entre sin fijar su estado.
for (const key of Object.keys(frozen)) {
  if (!(key in ESPERADO_FROZEN)) F(`4 · ${key} está congelada y no tiene estado esperado en ESPERADO_FROZEN`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRegulacionTier(): { hard: number } {
  console.log("\n─── TIER REGULACIÓN (el edificio permite operar por día · regulacion-edificio.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — tres estados, el monto en riesgo, 10 casos de normalización (sin dato ⇒ no_seguro) y 6 filas reales congeladas");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRegulacionTier();
  process.exit(hard ? 1 : 0);
}
