// ============================================================================
// GOLDEN · el respaldo del arriendo — catch-test (09-sep-2026). 0 tokens.
// ============================================================================
// F1, la familia más importante de las cinco: el arriendo es el número del que cuelga
// todo el informe y lo puso el usuario. La prosa decía si estaba contrastado en 17 de 30
// generaciones medidas; en las otras 13 el lector no se enteraba.
//
// Fija CUATRO cosas:
//
//   1. LOS CINCO ESTADOS, incluidos los que no son el camino feliz. Sin referencia,
//      orden de magnitud, muestra chica, coincide con la referencia, y declarado con
//      brecha. El más importante es el PRIMERO: 424 de 1.200 filas del parque no tienen
//      referencia, y ahí la línea tiene que decir que el número no se puede contrastar.
//
//   2. QUE NUNCA SE CALLE. `respaldoArriendo` no devuelve null: si no hay con qué
//      contrastar, eso ES lo que hay que decir. El silencio dejaría al lector creyendo
//      que el número está verificado, que es el error más caro posible acá.
//
//   3. EL UMBRAL n≥10, en sus dos bordes. Con 9 es muestra chica, con 10 es mediana.
//      El umbral venía calibrado del wizard y hasta hoy no se podía leer en el informe.
//
//   4. LA DIRECCIÓN DE LA BRECHA. Por SOBRE la mediana el supuesto es más exigente que
//      lo que la zona publica y hay que advertir; por debajo es conservador y no. Que la
//      advertencia dependa del SIGNO y no de la existencia de brecha es la parte que un
//      refactor rompe sin darse cuenta.
//
// Corre dentro del QUICK del runner (tier "respaldo") y standalone:
//   node --import tsx scripts/eval/golden/respaldo-arriendo-catch-test.ts
// ============================================================================
import { N_MINIMO_MEDIANA, respaldoArriendo } from "../../../src/lib/arriendo-referencia";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

/** Input con la forma que el motor lee de `input_data`. */
const conZona = (o: { valor?: number; n?: number; radio?: number; fuente?: string } | null) =>
  o === null
    ? {}
    : {
        zonaRadio: {
          arriendoPromedio: o.valor ?? 500000,
          sampleSizeArriendo: o.n ?? 25,
          radioMetros: o.radio ?? 500,
          arriendoFuente: o.fuente ?? "radio",
        },
      };

// ── 1 · los cinco estados ───────────────────────────────────────────────────
const casos: [unknown, number, string, string][] = [
  [conZona(null), 500000, "sin_referencia", "sin dato de zona"],
  [{ zonaRadio: { arriendoPromedio: 0, sampleSizeArriendo: 30 } }, 500000, "sin_referencia", "referencia en cero"],
  [conZona({ fuente: "comuna-m2", n: 15 }), 500000, "orden_de_magnitud", "estimado del m² comunal"],
  [conZona({ n: 9 }), 500000, "muestra_chica", "n justo bajo el umbral"],
  [conZona({ valor: 500000, n: 30 }), 500000, "coincide_con_referencia", "el declarado ES la sugerencia"],
  [conZona({ valor: 500000, n: 30 }), 540000, "declarado_con_brecha", "declarado sobre la mediana"],
  [conZona({ valor: 500000, n: 30 }), 460000, "declarado_con_brecha", "declarado bajo la mediana"],
];
for (const [input, arriendo, esperado, nombre] of casos) {
  const r = respaldoArriendo(input, arriendo);
  if (r.estado !== esperado) F(`1 · ${nombre}: estado «${r.estado}», se esperaba «${esperado}»`);
  if (!r.texto || r.texto.trim().length < 20) F(`1 · ${nombre}: la línea quedó vacía o mocha — «${r.texto}»`);
}

// ── 2 · nunca se calla ──────────────────────────────────────────────────────
for (const input of [conZona(null), {}, null, undefined, { zonaRadio: null }]) {
  const r = respaldoArriendo(input, 500000);
  if (!r.texto) F("2 · sin referencia el módulo NO puede quedarse callado: el silencio se lee como «verificado»");
  if (!r.advertencia) F("2 · sin referencia la línea tiene que advertir");
  if (!/no lo puede contrastar|pusiste t[úu]/i.test(r.texto)) {
    F(`2 · la línea sin referencia no dice que el número lo puso el usuario: «${r.texto}»`);
  }
}

// ── 3 · el umbral n≥10, en sus dos bordes ───────────────────────────────────
const bajo = respaldoArriendo(conZona({ n: N_MINIMO_MEDIANA - 1 }), 500000);
const justo = respaldoArriendo(conZona({ n: N_MINIMO_MEDIANA, valor: 500000 }), 500000);
if (bajo.estado !== "muestra_chica") F(`3 · n=${N_MINIMO_MEDIANA - 1} tiene que ser muestra chica, dio «${bajo.estado}»`);
if (justo.estado === "muestra_chica") F(`3 · n=${N_MINIMO_MEDIANA} ya NO es muestra chica: el umbral es >=, dio «${justo.estado}»`);
if (!bajo.advertencia) F("3 · una muestra chica se advierte: es un indicio, no una medida");
if (!/solo/.test(bajo.texto)) F(`3 · la línea de muestra chica no dice «solo»: «${bajo.texto}»`);
if (respaldoArriendo(conZona({ n: 1 }), 500000).texto.includes("arriendos publicados")) {
  F("3 · con n=1 la línea tiene que ir en singular («1 arriendo publicado»)");
}

// ── 4 · la dirección de la brecha decide la advertencia ─────────────────────
const sobre = respaldoArriendo(conZona({ valor: 500000, n: 30 }), 535000);
const bajoRef = respaldoArriendo(conZona({ valor: 500000, n: 30 }), 465000);
if (sobre.brechaPct !== 7) F(`4 · brecha mal calculada: dio ${sobre.brechaPct}, se esperaba 7`);
if (bajoRef.brechaPct !== -7) F(`4 · brecha negativa mal calculada: dio ${bajoRef.brechaPct}, se esperaba -7`);
if (!sobre.advertencia) F("4 · SOBRE la mediana hay que advertir: el supuesto exige más que lo que la zona publica");
if (bajoRef.advertencia) F("4 · BAJO la mediana NO se advierte: el supuesto es conservador");
if (!/sobre esa mediana/.test(sobre.texto)) F(`4 · la línea no dice la dirección: «${sobre.texto}»`);
if (!/bajo esa mediana/.test(bajoRef.texto)) F(`4 · la línea no dice la dirección: «${bajoRef.texto}»`);
// Y que la brecha cero no invente dirección.
const cero = respaldoArriendo(conZona({ valor: 500000, n: 30 }), 500001);
if (/sobre esa mediana|bajo esa mediana/.test(cero.texto)) {
  F(`4 · con brecha redondeada a 0 la línea no debe declarar dirección: «${cero.texto}»`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRespaldoArriendoTier(): { hard: number } {
  console.log("\n─── TIER RESPALDO (qué respalda el arriendo declarado · arriendo-referencia.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log(`  ✓ VERDE — cinco estados, el umbral n>=${N_MINIMO_MEDIANA} en sus dos bordes, la dirección de la brecha y que nunca se calle`);
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRespaldoArriendoTier();
  process.exit(hard ? 1 : 0);
}
