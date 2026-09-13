// ============================================================================
// GOLDEN · EL MOTOR EMITE LA GRILLA DEL POP-UP — catch-test (13-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El pop-up de ajustes (mockup `popup-palancas-final.html`) necesita, por celda de la
// matriz pie × plazo: veredicto, score, el descuento que pide y el pie extra del día uno.
// Y del ajuste óptimo, siete pares antes → después. Nada de eso viajaba, aunque el motor
// lo calcula TODO hoy:
//
//   · cada celda se sondea a descuento 0 para saber si ya cruza — ahí están su veredicto
//     y su score, y se descartaban;
//   · las celdas que cruzan se bisecan hasta el descuento mínimo y se vuelven a sondear
//     para leer el score de la elegida — ahí están las cifras del «después», y también
//     se descartaban;
//   · `MixPalancas` ni siquiera llevaba el score de la elegida, con el que se eligió.
//
// MEDIDO ANTES DE TOCAR NADA (scripts/of-conteo-grilla.ts, gitignored): una carga LTR con
// mix recorre 16 celdas de la matriz de simulación SIN bisecar, y 42-50 sondas del mix,
// que sí bisecan. Son DOS pasadas. Este goal no agrega una tercera: emite lo que la
// segunda ya calculó.
//
// Fija SEIS cosas:
//
//   1. LA GRILLA VIAJA. `MixPalancas.celdas` trae TODAS las combinaciones probadas, no
//      solo las que cruzan: la matriz del pop-up tiene que poder pintar «Buscar» en una
//      celda que no llega.
//
//   2. CADA CELDA TRAE LOS CUATRO DATOS. Veredicto y score SIN descuento (que es lo que
//      la celda muestra), descuento mínimo que cruza —o null— y el pie extra del día uno.
//
//   3. LA ELEGIDA ESTÁ MARCADA Y ES LA DEL CONTRATO. Exactamente una celda con
//      `esElegida`, y es la que `MixPalancas` describe en sus campos planos.
//
//   4. EL ÓPTIMO TRAE SU «DESPUÉS». Cuota, flujo, retorno sobre lo puesto, cap rate, TIR
//      y score de la combinación elegida. Sin eso el pop-up tendría que recomputar en el
//      cliente, que es exactamente lo que el informe no hace.
//
//   5. LAS PALANCAS SOLAS TRAEN SCORE Y DESTINO. La tabla «No depende de ti» dice
//      «Llegas a Comprar · score NN» por palanca.
//
//   6. NO SE AGREGA UNA TERCERA PASADA. El módulo del mix no puede sondear más veces por
//      celda que antes: una a descuento 0, la bisección, y una final en el mínimo.
//
// Corre dentro del QUICK (tier "grilla-popup") y standalone:
//   node --import tsx scripts/eval/golden/grilla-popup-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularMixPalancas, MIX_COSTO_TOPE_PTS_PRECIO } from "../../../src/lib/mix-palancas";
import { DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

type Patch = { precio?: number; piePct?: number; plazoCredito?: number };
const PRECIO_UF = 3_000;

/** Mix sobre una grilla dirigida, contando las sondas por celda. */
function mix(o: {
  piePct?: number;
  plazoCredito?: number;
  cruza: (pie: number, plazo: number, descuentoPct: number) => boolean;
  score?: (pie: number, plazo: number, descuentoPct: number) => number;
}) {
  const pieBase = o.piePct ?? 20;
  const plazoBase = o.plazoCredito ?? 25;
  const sondasPorCelda = new Map<string, number>();
  const m = calcularMixPalancas({
    meta: "COMPRAR",
    precioUF: PRECIO_UF,
    piePct: pieBase,
    plazoCredito: plazoBase,
    pieCalifica: true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: 15,
    palancasQueCruzan: [],
    sondaAtPatch: (patch: Patch) => {
      const pie = patch.piePct ?? pieBase;
      const plazo = patch.plazoCredito ?? plazoBase;
      const d = patch.precio == null ? 0 : Math.round((1 - patch.precio / PRECIO_UF) * 1000) / 10;
      const k = `${pie}|${plazo}`;
      sondasPorCelda.set(k, (sondasPorCelda.get(k) ?? 0) + 1);
      const veredicto: Veredicto = o.cruza(pie, plazo, d) ? "COMPRAR" : "AJUSTA SUPUESTOS";
      const score = o.score ? o.score(pie, plazo, d) : 60;
      return {
        veredicto,
        score,
        metricas: { cuotaMensual: 800_000 - pie * 1_000, flujoMensual: -100_000 + pie * 2_000, cocPct: -3 + pie / 10, capRateNetoPct: 4 + d / 10, tirPct: 7 + pie / 50 },
      };
    },
  });
  return { m, sondasPorCelda };
}

// ── 1 · la grilla viaja entera ─────────────────────────────────────────────
{
  // Solo cruza pie 30 · plazo 30: las demás celdas NO cruzan y tienen que venir igual.
  const { m } = mix({ cruza: (pie, plazo) => pie === 30 && plazo === 30 });
  if (!m) F("1 · el mix devolvió null con una celda que cruza");
  else if (!Array.isArray(m.celdas)) F("1 · `MixPalancas.celdas` no existe: la matriz del pop-up no tiene de dónde leer");
  else {
    // pie 20/25/30 × plazo 25/30 (el mix no baja del plazo declarado) = 6 celdas.
    if (m.celdas.length !== 6) F(`1 · la grilla trae ${m.celdas.length} celdas, esperaba las 6 probadas (3 pies × 2 plazos)`);
    if (m.celdas.length !== m.combinacionesProbadas) F(`1 · celdas (${m.celdas.length}) ≠ combinacionesProbadas (${m.combinacionesProbadas}): la matriz mostraría menos de lo que el motor probó`);
    const queNoCruzan = m.celdas.filter((c) => c.descuentoPct === null);
    if (queNoCruzan.length === 0) F("1 · ninguna celda viaja con `descuentoPct: null`: las que no llegan se están filtrando");
  }
}

// ── 2 · los cuatro datos por celda ─────────────────────────────────────────
{
  const { m } = mix({
    cruza: (pie, plazo, d) => pie >= 25 || (plazo === 30 && d >= 10),
    score: (pie, plazo, d) => 50 + pie + (plazo - 25) + Math.round(d),
  });
  const c = m?.celdas?.find((x) => x.piePct === 20 && x.plazoAnios === 25);
  if (!c) F("2 · falta la celda del caso declarado (pie 20% · plazo 25a)");
  else {
    if (c.veredicto !== "AJUSTA SUPUESTOS") F(`2 · la celda declarada trae veredicto ${c.veredicto}; tiene que ser el de SIN descuento`);
    if (c.score !== 70) F(`2 · la celda declarada trae score ${c.score}; el de SIN descuento es 70 (50 + 20 + 0 + 0)`);
    if (!c.esActual) F("2 · la celda del pie y plazo declarados no viene marcada como `esActual`");
    if (c.costoDiaUnoUF !== 0) F(`2 · el pie extra de la celda declarada es ${c.costoDiaUnoUF}, tiene que ser 0`);
  }
  const c30 = m?.celdas?.find((x) => x.piePct === 30 && x.plazoAnios === 25);
  if (!c30) F("2 · falta la celda pie 30% · plazo 25a");
  else {
    if (c30.descuentoPct !== 0) F(`2 · pie 30% cruza sin descuento y la celda dice ${c30.descuentoPct}`);
    // pie 30 sobre 20 declarado = 10 puntos del precio = UF 300 sobre UF 3.000.
    if (c30.costoDiaUnoUF !== 300) F(`2 · el pie extra de pie 30% es ${c30.costoDiaUnoUF} UF, esperaba 300`);
    if (c30.costoPtsPrecio > MIX_COSTO_TOPE_PTS_PRECIO && c30.alcanzable) F("2 · una celda sobre el tope viaja como alcanzable");
  }
}

// ── 3 · la elegida, marcada y coherente con los campos planos ──────────────
{
  const { m } = mix({
    cruza: (pie) => pie >= 25,
    score: (pie) => 50 + pie,
  });
  const marcadas = m?.celdas?.filter((c) => c.esElegida) ?? [];
  if (marcadas.length !== 1) F(`3 · hay ${marcadas.length} celdas marcadas como elegidas, tiene que haber exactamente una`);
  const e = marcadas[0];
  if (m && e && !(e.piePct === m.piePct && e.plazoAnios === m.plazoAnios && e.descuentoPct === m.descuentoPct)) {
    F(`3 · la celda marcada (pie ${e.piePct}% · ${e.plazoAnios}a · −${e.descuentoPct}%) no es la que describen los campos planos (pie ${m.piePct}% · ${m.plazoAnios}a · −${m.descuentoPct}%)`);
  }
  if (m && m.score == null) F("3 · `MixPalancas.score` no viaja: se elige POR score y el número con el que se eligió no llega al informe");
}

// ── 4 · el «después» del óptimo ────────────────────────────────────────────
{
  const { m } = mix({ cruza: (pie) => pie >= 25, score: (pie) => 50 + pie });
  const d = m?.despues;
  if (!d) F("4 · `MixPalancas.despues` no viaja: los siete pares del pop-up no tienen el lado derecho");
  else {
    for (const k of ["cuotaMensual", "flujoMensual", "cocPct", "capRateNetoPct", "tirPct"] as const) {
      if (typeof d[k] !== "number" && d[k] !== null) F(`4 · el «después» no trae \`${k}\``);
    }
    // La elegida es pie 25 (la más barata de las que cruzan a igual score… no: mayor score
    // gana, y el score sube con el pie ⇒ gana pie 30). El «después» es el de ESA celda.
    if (m && m.piePct === 30 && d.cuotaMensual !== 800_000 - 30 * 1_000) {
      F(`4 · el «después» no corresponde a la celda elegida (cuota ${d.cuotaMensual} para pie ${m.piePct}%)`);
    }
  }
}

// ── 5 · las palancas solas: score y destino ────────────────────────────────
{
  // Se fija sobre el TIPO, que es lo que el pop-up lee. El cableado y su costo los mide
  // el censo; acá basta que los campos existan en el contrato del motor.
  const T = readFileSync(join(__dirname, "..", "..", "..", "src", "lib", "types.ts"), "utf8").replace(/\r\n/g, "\n");
  const i = T.indexOf("export interface PalancaDistancia");
  const bloque = i === -1 ? "" : T.slice(i, T.indexOf("\n}", i));
  if (!/score\??:/.test(bloque)) F("5 · `PalancaDistancia` no lleva `score`: la tabla «No depende de ti» no puede decir el score del destino");
  if (!/destino\??:/.test(bloque)) F("5 · `PalancaDistancia` no lleva `destino`: la tabla no puede decir a qué veredicto llegas");
}

// ── 6 · ni una sonda más por celda ─────────────────────────────────────────
{
  // Presupuesto: 1 sonda a descuento 0 + la bisección (tope 15, precisión 0,1 ⇒ ≤ 8
  // pasos) + 1 en el mínimo + 1 de control del tope = 12 con holgura. Si alguien agrega
  // una pasada para leer datos nuevos, esto se dispara.
  const { sondasPorCelda } = mix({ cruza: (pie, plazo, d) => pie >= 25 && d >= 5 });
  const peor = [...sondasPorCelda.entries()].sort((a, b) => b[1] - a[1])[0];
  if (peor && peor[1] > 12) F(`6 · la celda ${peor[0]} recibió ${peor[1]} sondas: emitir lo que ya se calcula no puede agregar una pasada`);
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runGrillaPopupTier(): { hard: number } {
  console.log("\n─── TIER GRILLA-POPUP (el motor emite la grilla, el óptimo y los scores · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la grilla viaja entera con veredicto, score, descuento y pie extra por celda; la elegida marcada con su «después»; las palancas solas con score y destino; y ni una sonda más por celda");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runGrillaPopupTier();
  process.exit(hard ? 1 : 0);
}
