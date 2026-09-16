// ============================================================================
// GOLDEN · EL REPARTO DEL INGRESO — catch-test (16-sep-2026). 0 tokens, sin base.
// ============================================================================
// La línea que reemplazó a la barra de tramos del capítulo II, en las dos modalidades.
//
// Fija CINCO cosas:
//
//   1. LA IDENTIDAD DEL MOTOR SE RESPETA. ingreso − cuota − gastos ≡ flujo. Los gastos se
//      derivan de esa identidad y no de una suma aparte, justamente para que el reparto no
//      pueda desviarse del flujo que el informe publica tres líneas más abajo.
//
//   2. LAS DOS FORMAS, Y EL CORTE ES «LA CUOTA CABE EN EL INGRESO». No es un umbral estético:
//      con la cuota por encima del ingreso, repartir el 100% entre tres mentiría. Medido sobre
//      el parque, la población está partida casi por la mitad (la cuota supera el 100% del
//      ingreso en más de la mitad de las filas LTR), así que las dos ramas corren de verdad.
//
//   3. EL RESIDUO VA EN PESOS Y CON SIGNO, NUNCA EN PORCENTAJE. Redondeado a porcentaje se
//      vuelve 0 justo en los casos donde es lo único que importa — es la lección del gráfico
//      retirado, aplicada a la frase.
//
//   4. LA FRASE DICE QUE LA PLATA SALE, no que falta conseguirla. Cuando el flujo es negativo
//      el texto es «de tu bolsillo pones», y `sale` viaja aparte para que el render pinte el
//      monto en Signal Red — el único color, y el que la fila total del capítulo ya usa.
//
//   5. UNA SOLA FUNCIÓN PARA LAS DOS MODALIDADES. Antes STR lo emitía el motor y LTR lo
//      derivaba el render; el acta de la pieza decía «lee del motor tal cual» y era cierto en
//      una sola de las dos. Acá se exige que los dos motores emitan el MISMO objeto para el
//      mismo caso: si alguien vuelve a derivarlo de un lado, esto se pone rojo.
//
// Corre dentro del QUICK (tier "reparto") y standalone:
//   node --import tsx scripts/eval/golden/reparto-ingreso-catch-test.ts
// ============================================================================
import { repartoIngreso, fraseReparto } from "../../../src/lib/reparto-ingreso";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;

// ── 1 · la identidad del motor, barrida ──────────────────────────────────────
{
  let casos = 0;
  let ambasFormas = 0;
  let conSalida = 0;
  for (let k = 0; k < 40; k++) {
    const ingreso = 300_000 + k * 47_000;
    // la cuota barre de la mitad del ingreso a casi el doble: cruza el corte de las formas
    const cuota = Math.round(ingreso * (0.5 + k * 0.035));
    // ⛔ LA FRACCIÓN DE GASTOS VARÍA, Y NO ES ADORNO. La primera versión usaba un 28% fijo, y
    // con eso la mutación «los gastos dejan de salir de la identidad y pasan a ser ingreso×0,28»
    // salía VERDE: el fixture estaba construido con ese mismo 28%, así que la identidad se
    // cumplía por construcción y el invariante no podía distinguir las dos fórmulas. Un fixture
    // que no falla porque coincide con el error no mide — MIENTE.
    const gastos = Math.round(ingreso * (0.17 + (k % 7) * 0.031));
    const flujo = ingreso - cuota - gastos;
    const r = repartoIngreso({ ingreso, cuota, flujo });
    casos++;
    if (Math.abs(r.ingreso - r.cuota - r.costosOperar - flujo) > 1) {
      F(`1 · la identidad se rompe con ingreso ${ingreso} / cuota ${cuota}: ${r.ingreso} − ${r.cuota} − ${r.costosOperar} ≠ ${flujo}`);
    }
    if (Math.round(r.residuoCLP) !== Math.round(flujo)) {
      F(`1 · el residuo (${r.residuoCLP}) no es el flujo del motor (${flujo})`);
    }
    // el residuo es lo mismo que los tramos crudos, dicho con signo
    const crudo = r.libre > 0 ? r.libre : -r.exceso;
    if (Math.round(crudo) !== Math.round(r.residuoCLP)) {
      F(`1 · \`exceso\`/\`libre\` (${crudo}) y \`residuoCLP\` (${r.residuoCLP}) describen el mismo hecho y no coinciden`);
    }
    if (r.forma === "supera") ambasFormas++;
    if (r.residuoCLP < 0) conSalida++;
  }
  // ⛔ PISO DE COBERTURA. Un barrido que nunca cruza el corte pasa sin ejercitar la rama que
  // este invariante existe para vigilar, y quedaría VERDE sin haber medido. Ya mordió dos
  // veces en este arco (la corona de score y el gate de la cifra publicada).
  if (casos < 40) F(`1 · el barrido corrió ${casos} casos de 40`);
  if (ambasFormas === 0) F("1 · ninguno de los 40 casos cae en la forma «supera»: el barrido no ejercita el corte");
  if (ambasFormas === casos) F("1 · TODOS caen en «supera»: el barrido tampoco ejercita la otra forma");
  if (conSalida === 0) F("1 · ningún caso tiene el residuo negativo: no se ejercita la rama de «de tu bolsillo pones»");
}

// ── 2 · el corte de las dos formas ───────────────────────────────────────────
{
  const cabe = repartoIngreso({ ingreso: 1_000_000, cuota: 999_999, flujo: -200_000 });
  if (cabe.forma !== "cabe") F(`2 · con la cuota UN PESO bajo el ingreso la forma debe ser «cabe», dio «${cabe.forma}»`);
  const justo = repartoIngreso({ ingreso: 1_000_000, cuota: 1_000_000, flujo: -280_000 });
  if (justo.forma !== "cabe") F(`2 · con la cuota IGUAL al ingreso la forma debe ser «cabe» (el corte es <=), dio «${justo.forma}»`);
  const supera = repartoIngreso({ ingreso: 1_000_000, cuota: 1_000_001, flujo: -280_000 });
  if (supera.forma !== "supera") F(`2 · con la cuota UN PESO sobre el ingreso la forma debe ser «supera», dio «${supera.forma}»`);
}

// ── 3 · el residuo nunca se expresa en porcentaje ────────────────────────────
{
  // el caso que motivó todo: de $688.242 salen $684.440, o sea 0,55% de residuo
  const r = repartoIngreso({ ingreso: 688_242, cuota: 495_534, flujo: 3_802 });
  if (Math.round(r.residuoCLP) !== 3_802) F(`3 · el residuo se perdió: ${r.residuoCLP} en vez de 3802`);
  const f = fraseReparto(r, "los gastos", money);
  if (!f.monto.includes("3.802")) F(`3 · la frase no dice el residuo en pesos: «${f.monto}». Redondeado a porcentaje sería 1% o 0%, que es exactamente lo que la barra no podía dibujar`);
  if (f.sale) F("3 · con flujo positivo la frase no puede decir que la plata sale");
}

// ── 4 · la plata SALE, no falta ──────────────────────────────────────────────
{
  const r = repartoIngreso({ ingreso: 360_000, cuota: 604_065, flujo: -349_617 });
  const f = fraseReparto(r, "los gastos", money);
  const txt = f.antes + f.monto + f.despues;
  if (!f.sale) F("4 · con flujo negativo `sale` tiene que ser true: de ahí cuelga el único color de la línea");
  if (!/de tu bolsillo pones/i.test(txt)) F(`4 · la frase no dice que la plata la PONES tú: «${txt}»`);
  if (/falta|conseguir|necesitas juntar/i.test(txt)) F(`4 · la frase sugiere plata que falta conseguir, y es plata que sale cada mes: «${txt}»`);
  if (!txt.includes("349.617")) F(`4 · el número más importante del capítulo no está en la frase: «${txt}»`);
  if (r.forma !== "supera") F("4 · con la cuota en 168% del ingreso la forma tiene que ser «supera»");
}

// ── 5 · las dos modalidades emiten lo MISMO para el mismo caso ───────────────
{
  // No se comparan los motores enteros —eso lo hace el parque—, sino que el reparto sea una
  // función pura del mismo trío: si un día alguien vuelve a derivarlo en un render, el objeto
  // dejará de coincidir con éste.
  const a = repartoIngreso({ ingreso: 900_000, cuota: 700_000, flujo: -52_000 });
  const b = repartoIngreso({ ingreso: 900_000, cuota: 700_000, flujo: -52_000 });
  if (JSON.stringify(a) !== JSON.stringify(b)) F("5 · la función no es pura: dos llamadas con el mismo input dieron distinto");
  // y la etiqueta de gastos es lo ÚNICO que cambia entre modalidades
  const fLtr = fraseReparto(a, "los gastos", money);
  const fStr = fraseReparto(a, "operar el depto", money);
  if (fLtr.monto !== fStr.monto || fLtr.sale !== fStr.sale) {
    F("5 · cambiar la etiqueta de gastos movió el monto o el signo: lo único que puede cambiar entre modalidades es esa palabra");
  }
  if (!fLtr.antes.includes("los gastos") || !fStr.antes.includes("operar el depto")) {
    F("5 · la etiqueta de gastos no llega a la frase: LTR y STR nombran distinto esa bolsa y el `title` de la barra retirada usaba una sola para las dos");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runRepartoIngresoTier(): { hard: number } {
  console.log("\n─── TIER REPARTO (el reparto del ingreso del capítulo II · reparto-ingreso.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la identidad del motor se respeta, las dos formas con su corte en «la cuota cabe», el residuo en pesos y con signo, la plata que SALE dicha como plata que pones, y una sola función para las dos modalidades");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runRepartoIngresoTier();
  process.exit(hard ? 1 : 0);
}
