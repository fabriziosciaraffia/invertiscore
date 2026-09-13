// ============================================================================
// GOLDEN · LA REGLA DEL MIX ELIGE POR SCORE — catch-test (13-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// Hasta el 12-sep el mix elegía la celda de MENOR DESCUENTO, y a igual descuento la que
// costaba menos plata el día uno: un criterio sobre lo que hay que pedirle a un tercero,
// no sobre el negocio que queda. El 12-sep pasó a elegir por retorno sobre lo puesto, y
// medirlo mostró el problema: comprar retorno significa poner más pie, y más pie baja la
// TIR en 9 de cada 10 filas donde cambia la elegida.
//
// Desde hoy la regla es «entre las celdas que cruzan, la de mayor FRANCO SCORE; el
// descuento desempata». El score pondera flujo, retorno sobre lo puesto y TIR juntas, así
// que no hay que elegir entre ellas, y es la misma vara con la que la página declara el
// veredicto: el mix no puede ofrecer una combinación que el informe que la muestra
// considere peor negocio.
//
// Fija SIETE cosas:
//
//   1. LA SONDA DEVUELVE EL SCORE. `calcularMixPalancas` recibe
//      `sondaAtPatch: (patch) => { veredicto, score }`. Una sola pasada por celda: el
//      veredicto y el score salen del MISMO recompute, no de dos.
//
//   2. ELIGE EL MAYOR SCORE ENTRE LAS QUE CRUZAN. El caso que separa las reglas: una celda
//      cruza sin descuento y es la más barata del día uno (ganaba con la regla vieja) y
//      otra cruza también sin descuento pero deja mejor score (gana ahora).
//
//   3. EL DESCUENTO DESEMPATA. A igual score gana la que pide menos descuento, y recién
//      después la que cuesta menos el día uno. Sin esto el orden dependería del recorrido
//      de la grilla, que es lo mismo que no tener regla.
//
//   4. EL TOPE DE 15 PUNTOS SIGUE SIENDO BARRERA DURA. Se filtra ANTES de elegir: una celda
//      fuera de alcance no entra al concurso por más score que deje.
//
//   5. SIN SCORE MEDIBLE, LA REGLA VIEJA. Una celda con `score: null` no le gana a una con
//      número, y si NINGUNA lo tiene la elección cae al descuento mínimo (filas legacy).
//
//   6. UNA SOLA FUNCIÓN QUE ELIGE. Antes había dos ordenamientos —el de las alcanzables y
//      el del fallback— y cada uno podía derivar por su lado.
//
//   7. EL SCORE ES EL DEL VEREDICTO QUE LA SONDA DEVUELVE. En las dos modalidades sale de
//      la misma pasada del motor. Si alguien lo recomputara aparte, el mix podría elegir
//      con un número que la página nunca mostró.
//
// Corre dentro del QUICK (tier "mix-score") y standalone:
//   node --import tsx scripts/eval/golden/mix-score-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularMixPalancas, MIX_COSTO_TOPE_PTS_PRECIO } from "../../../src/lib/mix-palancas";
import { DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

type Patch = { precio?: number; piePct?: number; plazoCredito?: number };
/** Celda de la grilla, como la ve el fixture: pie × plazo. */
type Celda = { pie: number; plazo: number };
const celdaDe = (patch: Patch, pieBase: number, plazoBase: number): Celda => ({
  pie: patch.piePct ?? pieBase,
  plazo: patch.plazoCredito ?? plazoBase,
});

const PRECIO_UF = 3_000;

/**
 * Mix sobre una grilla dirigida. `cruza` dice si la celda alcanza con ese descuento y
 * `score` qué negocio deja; las dos reciben la celda ya resuelta para que el fixture se lea
 * como una tabla y no como un parche.
 */
function mix(o: {
  piePct?: number;
  plazoCredito?: number;
  topePct?: number;
  cruza: (c: Celda, descuentoPct: number) => boolean;
  score?: (c: Celda) => number | null;
}) {
  const pieBase = o.piePct ?? 20;
  const plazoBase = o.plazoCredito ?? 25;
  return calcularMixPalancas({
    meta: "AJUSTA SUPUESTOS",
    precioUF: PRECIO_UF,
    piePct: pieBase,
    plazoCredito: plazoBase,
    pieCalifica: true,
    pieTopePct: DIST_PIE_TOPE_PCT,
    topePct: o.topePct ?? 15,
    palancasQueCruzan: [],
    sondaAtPatch: (patch: Patch) => {
      const c = celdaDe(patch, pieBase, plazoBase);
      const descuentoPct = patch.precio == null ? 0 : Math.round((1 - patch.precio / PRECIO_UF) * 1000) / 10;
      const veredicto: Veredicto = o.cruza(c, descuentoPct) ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      return { veredicto, score: o.score ? o.score(c) : null };
    },
  });
}

const donde = (m: { piePct: number; plazoAnios: number } | null) => (m ? `pie ${m.piePct}% · plazo ${m.plazoAnios}a` : "null");

// ── 1 · la sonda devuelve el score y el módulo lo consume ──────────────────
{
  const vistos: number[] = [];
  mix({
    cruza: (c) => c.pie >= 25,
    score: (c) => {
      vistos.push(c.pie);
      return c.pie;
    },
  });
  if (vistos.length === 0) F("1 · el módulo nunca leyó `score` de la sonda: la regla no puede estar mirando el score");
  const MIX = leer("src/lib/mix-palancas.ts");
  if (/veredictoAtPatch/.test(MIX)) F("1 · `mix-palancas.ts` todavía nombra `veredictoAtPatch`: la sonda de veredicto pelado sobrevivió al cambio");
  if (/retornoPct/.test(MIX)) F("1 · `mix-palancas.ts` todavía lee `retornoPct`: el criterio por retorno quedó vivo junto al del score");
  if (!/sondaAtPatch/.test(MIX)) F("1 · `mix-palancas.ts` no declara `sondaAtPatch`");
}

// ── 2 · entre las que cruzan, la de mayor score ────────────────────────────
//
// LA FILA QUE SEPARA LAS REGLAS. Las dos celdas cruzan SIN descuento, así que la regla
// vieja desempata por plata del día uno y corona (20, 30) —no agrega capital—. La nueva
// mira el score y corona (30, 25), que deja 78 contra 71.
{
  const m = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25),
    score: (c) => (c.pie === 30 && c.plazo === 25 ? 78 : c.pie === 20 && c.plazo === 30 ? 71 : null),
  });
  if (!m) F("2 · el mix devolvió null con dos celdas que cruzan");
  else if (!(m.piePct === 30 && m.plazoAnios === 25)) {
    F(`2 · con dos celdas que cruzan sin descuento eligió ${donde(m)}; la de MAYOR score es pie 30% · plazo 25a (78 contra 71)`);
  }
  if (m && m.piePct === 20 && m.plazoAnios === 30) F("2 · eligió exactamente la que coronaba el descuento mínimo con el costo más barato: la regla no cambió");
}

// ── 3 · el descuento desempata ─────────────────────────────────────────────
{
  // Dos celdas con el MISMO score: (20,30) cruza sin descuento y (30,25) necesita 8%.
  const m = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c, d) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25 && d >= 8),
    score: () => 74,
  });
  if (!m) F("3 · el mix devolvió null con dos celdas de igual score");
  else if (!(m.piePct === 20 && m.plazoAnios === 30)) {
    F(`3 · a igual score (74) eligió ${donde(m)}; con el descuento como desempate gana la que cruza sin descuento (pie 20% · plazo 30a)`);
  }
}

// ── 4 · el tope de 15 puntos es barrera dura, no una preferencia ───────────
{
  // Pie declarado 5% y techo 30% ⇒ la celda pie 30% cuesta 25 puntos del precio: fuera de
  // alcance. Le damos el mejor score de la grilla: NO puede ganar.
  const m = mix({
    piePct: 5,
    plazoCredito: 25,
    cruza: (c) => c.pie >= 15,
    score: (c) => (c.pie === 30 ? 99 : c.pie === 15 ? 72 : 60),
  });
  if (!m) F("4 · el mix devolvió null habiendo celdas que cruzan dentro del tope");
  else {
    if (m.piePct === 30) F(`4 · coronó una celda de ${m.costoPtsPrecio} puntos del precio (tope ${MIX_COSTO_TOPE_PTS_PRECIO}): el score saltó la barrera de alcance`);
    if (m.costoPtsPrecio > MIX_COSTO_TOPE_PTS_PRECIO) F(`4 · la elegida cuesta ${m.costoPtsPrecio} puntos, sobre el tope de ${MIX_COSTO_TOPE_PTS_PRECIO}`);
    if (!m.dentroDelAlcance) F("4 · con celdas alcanzables el mix se declaró fuera de alcance");
  }
}

// ── 5 · sin score medible, la regla vieja ──────────────────────────────────
{
  // (a) una celda sin score no le gana a una con número.
  const a = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 25 && c.plazo === 25),
    score: (c) => (c.pie === 25 ? 70 : null),
  });
  if (a && !(a.piePct === 25 && a.plazoAnios === 25)) {
    F(`5a · una celda con score null ganó (${donde(a)}): sin número no se compite, gana la que sí lo tiene`);
  }
  // (b) si NINGUNA tiene score, vuelve el descuento mínimo (y su desempate por costo).
  const b = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25),
    score: () => null,
  });
  if (b && !(b.piePct === 20 && b.plazoAnios === 30)) {
    F(`5b · sin score en ninguna celda eligió ${donde(b)}; el fallback es la regla vieja (pie 20% · plazo 30a)`);
  }
}

// ── 6 · una sola función que elige ─────────────────────────────────────────
{
  const MIX = leer("src/lib/mix-palancas.ts");
  if (!/function elegirCelda/.test(MIX)) F("6 · no existe `elegirCelda`: la elección tiene que vivir en UNA función, no repartida en dos sorts");
  const sorts = (MIX.match(/\.sort\(/g) ?? []).length;
  if (sorts > 1) F(`6 · quedan ${sorts} \`.sort(\` en mix-palancas.ts: la elección volvió a estar en dos lugares`);
}

// ── 7 · el score es el del veredicto que la sonda devuelve ─────────────────
{
  const LTR = leer("src/lib/analysis.ts");
  const STR = leer("src/lib/analysis/veredicto-str-con-patch.ts");
  if (!/export function sondaConPatch/.test(LTR)) F("7 · analysis.ts no exporta `sondaConPatch` (veredicto + score en un solo recompute)");
  // El invariante es que el score devuelto SEA el que alimentó a deriveVeredicto, no la
  // forma exacta del return: desde el goal A la sonda devuelve además las métricas.
  if (!/veredicto: deriveVeredicto\(s, m, bet\)/.test(LTR) || !/score: Number\.isFinite\(s\) \? s : null/.test(LTR)) {
    F("7 · `sondaConPatch` (LTR) no devuelve el MISMO score que alimentó a deriveVeredicto: elegir con un score recomputado aparte es elegir con un número que la página no mostró");
  }
  if (!/export function sondaStrConPatch/.test(STR)) F("7 · veredicto-str-con-patch.ts no exporta `sondaStrConPatch`");
  if (!/veredicto: francoScore\.veredicto/.test(STR) || !/score: Number\.isFinite\(francoScore\.score\) \? francoScore\.score : null/.test(STR)) {
    F("7 · `sondaStrConPatch` no devuelve veredicto y score del mismo `francoScore`");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runMixScoreTier(): { hard: number } {
  console.log("\n─── TIER MIX-SCORE (la elegida es la de mayor score · mix-palancas.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la sonda devuelve el score del veredicto, la elegida es la de mayor score entre las que cruzan, el descuento desempata, el tope sigue filtrando antes y sin score vuelve la regla vieja");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMixScoreTier();
  process.exit(hard ? 1 : 0);
}
