// ============================================================================
// GOLDEN · LA REGLA DEL MIX ELIGE POR RETORNO — catch-test (12-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// Hasta hoy el mix elegía la celda de MENOR DESCUENTO, y a igual descuento la que
// costaba menos plata el día uno. Es un criterio sobre lo que hay que pedirle a un
// tercero, no sobre lo que el comprador se lleva: medido en el parque, la celda
// elegida cambia en el 51% de las filas LTR y en el 92% de esas la TIR sube. Desde
// hoy la regla es «entre las celdas que cruzan, la de mayor retorno sobre lo puesto;
// el descuento desempata».
//
// Fija SEIS cosas:
//
//   1. LA SONDA DEVUELVE EL RETORNO. `calcularMixPalancas` ya no recibe una sonda de
//      veredicto sino `sondaAtPatch: (patch) => { veredicto, retornoPct }`. Una sola
//      pasada por celda: el veredicto y el retorno salen del MISMO recompute, no de
//      dos. `retornoPct` viene en puntos porcentuales y con la sustitución de pie
//      cero YA resuelta por el llamador (rendimiento neto sobre el precio), que es
//      como lo mira el score — el módulo no sabe de pies ni de modalidades.
//
//   2. ELIGE EL MAYOR RETORNO ENTRE LAS QUE CRUZAN. El caso que separa las dos
//      reglas: una celda cruza sin descuento y es la más barata del día uno (ganaba
//      antes) y otra cruza también sin descuento pero deja más retorno (gana ahora).
//
//   3. EL DESCUENTO DESEMPATA. A igual retorno gana la que pide menos descuento, y
//      recién después la que cuesta menos el día uno. Sin esto el orden dependería
//      del recorrido de la grilla, que es lo mismo que no tener regla.
//
//   4. EL TOPE DE 15 PUNTOS SIGUE SIENDO BARRERA DURA. Se filtra ANTES de elegir: una
//      celda fuera de alcance no entra al concurso por más retorno que deje. El tope
//      define qué es una salida real; el retorno solo ordena las que lo son.
//
//   5. SIN RETORNO MEDIBLE, LA REGLA VIEJA. Una celda con `retornoPct: null` no le
//      gana a una con número (no se inventa un retorno), y si NINGUNA lo tiene, la
//      elección cae al descuento mínimo. Es el borde de las filas legacy.
//
//   6. UNA SOLA FUNCIÓN QUE ELIGE. Antes había dos ordenamientos —el de las
//      alcanzables y el del fallback— y cada uno podía derivar por su lado. Ahora la
//      elección vive en una función, y las dos ramas la llaman.
//
// Corre dentro del QUICK (tier "mix-retorno") y standalone:
//   node --import tsx scripts/eval/golden/mix-retorno-catch-test.ts
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
 * `retorno` cuánto deja; las dos reciben la celda ya resuelta para que el fixture se
 * lea como una tabla y no como un parche.
 */
function mix(o: {
  piePct?: number;
  plazoCredito?: number;
  topePct?: number;
  cruza: (c: Celda, descuentoPct: number) => boolean;
  retorno?: (c: Celda) => number | null;
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
      return { veredicto, retornoPct: o.retorno ? o.retorno(c) : null };
    },
  });
}

const donde = (m: { piePct: number; plazoAnios: number } | null) => (m ? `pie ${m.piePct}% · plazo ${m.plazoAnios}a` : "null");

// ── 1 · la sonda devuelve el retorno y el módulo lo consume ─────────────────
{
  const vistos: number[] = [];
  mix({
    cruza: (c) => c.pie >= 25,
    retorno: (c) => {
      vistos.push(c.pie);
      return c.pie;
    },
  });
  if (vistos.length === 0) F("1 · el módulo nunca leyó `retornoPct` de la sonda: la regla no puede estar mirando el retorno");
  const MIX = leer("src/lib/mix-palancas.ts");
  if (/veredictoAtPatch/.test(MIX)) F("1 · `mix-palancas.ts` todavía nombra `veredictoAtPatch`: la sonda de veredicto pelado sobrevivió al cambio");
  if (!/sondaAtPatch/.test(MIX)) F("1 · `mix-palancas.ts` no declara `sondaAtPatch`");
  if (!/retornoPct/.test(MIX)) F("1 · `mix-palancas.ts` no lee `retornoPct`");
}

// ── 2 · entre las que cruzan, la de mayor retorno ──────────────────────────
//
// LA FILA QUE SEPARA LAS DOS REGLAS. Las dos celdas cruzan SIN descuento, así que la
// regla vieja desempata por plata del día uno y corona (20, 30) —no agrega capital—.
// La nueva mira el retorno y corona (30, 25), que deja 5,0% contra 2,0%.
{
  const m = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25),
    retorno: (c) => (c.pie === 30 && c.plazo === 25 ? 5.0 : c.pie === 20 && c.plazo === 30 ? 2.0 : null),
  });
  if (!m) F("2 · el mix devolvió null con dos celdas que cruzan");
  else if (!(m.piePct === 30 && m.plazoAnios === 25)) {
    F(`2 · con dos celdas que cruzan sin descuento eligió ${donde(m)}; la de MAYOR retorno es pie 30% · plazo 25a (5,0% contra 2,0%)`);
  }
  // Y la vieja regla tiene que quedar REALMENTE descartada, no empatada por azar.
  if (m && m.piePct === 20 && m.plazoAnios === 30) F("2 · eligió exactamente la que coronaba el descuento mínimo con el costo más barato: la regla no cambió");
}

// ── 3 · el descuento desempata ─────────────────────────────────────────────
{
  // Dos celdas con el MISMO retorno: (20,30) cruza sin descuento y (30,25) necesita 8%.
  const m = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c, d) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25 && d >= 8),
    retorno: () => 4.0,
  });
  if (!m) F("3 · el mix devolvió null con dos celdas de igual retorno");
  else if (!(m.piePct === 20 && m.plazoAnios === 30)) {
    F(`3 · a igual retorno (4,0%) eligió ${donde(m)}; con el descuento como desempate gana la que cruza sin descuento (pie 20% · plazo 30a)`);
  }
}

// ── 4 · el tope de 15 puntos es barrera dura, no una preferencia ────────────
{
  // Pie declarado 5% y techo 30% ⇒ la celda pie 30% cuesta 25 puntos del precio: fuera
  // de alcance. Le damos el mejor retorno de la grilla: NO puede ganar.
  const m = mix({
    piePct: 5,
    plazoCredito: 25,
    cruza: (c) => c.pie >= 15,
    retorno: (c) => (c.pie === 30 ? 99 : c.pie === 15 ? 3 : 1),
  });
  if (!m) F("4 · el mix devolvió null habiendo celdas que cruzan dentro del tope");
  else {
    if (m.piePct === 30) F(`4 · coronó una celda de ${m.costoPtsPrecio} puntos del precio (tope ${MIX_COSTO_TOPE_PTS_PRECIO}): el retorno saltó la barrera de alcance`);
    if (m.costoPtsPrecio > MIX_COSTO_TOPE_PTS_PRECIO) F(`4 · la elegida cuesta ${m.costoPtsPrecio} puntos, sobre el tope de ${MIX_COSTO_TOPE_PTS_PRECIO}`);
    if (!m.dentroDelAlcance) F("4 · con celdas alcanzables el mix se declaró fuera de alcance");
  }
}

// ── 5 · sin retorno medible, la regla vieja ────────────────────────────────
{
  // (a) una celda sin retorno no le gana a una con número.
  const a = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 25 && c.plazo === 25),
    retorno: (c) => (c.pie === 25 ? 3.0 : null),
  });
  if (a && !(a.piePct === 25 && a.plazoAnios === 25)) {
    F(`5a · una celda con retorno null ganó (${donde(a)}): sin número no se compite, gana la que sí lo tiene`);
  }
  // (b) si NINGUNA tiene retorno, vuelve el descuento mínimo (y su desempate por costo).
  const b = mix({
    piePct: 20,
    plazoCredito: 25,
    cruza: (c) => (c.pie === 20 && c.plazo === 30) || (c.pie === 30 && c.plazo === 25),
    retorno: () => null,
  });
  if (b && !(b.piePct === 20 && b.plazoAnios === 30)) {
    F(`5b · sin retorno en ninguna celda eligió ${donde(b)}; el fallback es la regla vieja (pie 20% · plazo 30a)`);
  }
}

// ── 6 · una sola función que elige ─────────────────────────────────────────
{
  const MIX = leer("src/lib/mix-palancas.ts");
  if (!/function elegirCelda/.test(MIX)) F("6 · no existe `elegirCelda`: la elección tiene que vivir en UNA función, no repartida en dos sorts");
  const sorts = (MIX.match(/\.sort\(/g) ?? []).length;
  if (sorts > 1) F(`6 · quedan ${sorts} \`.sort(\` en mix-palancas.ts: la elección volvió a estar en dos lugares`);
}

// ── 7 · las dos modalidades alimentan la sonda con el retorno ──────────────
{
  const LTR = leer("src/lib/analysis.ts");
  const STR = leer("src/lib/analysis/veredicto-str-con-patch.ts");
  if (!/export function sondaConPatch/.test(LTR)) F("7 · analysis.ts no exporta `sondaConPatch` (veredicto + retorno en un solo recompute)");
  if (!/rentabilidadNeta/.test(LTR.slice(Math.max(0, LTR.indexOf("export function sondaConPatch")), LTR.indexOf("export function sondaConPatch") + 1200))) {
    F("7 · `sondaConPatch` (LTR) no resuelve el pie cero con la rentabilidad neta, que es la sustitución que usa el score");
  }
  if (!/export function sondaStrConPatch/.test(STR)) F("7 · veredicto-str-con-patch.ts no exporta `sondaStrConPatch`");
  if (!/capRate/.test(STR)) F("7 · `sondaStrConPatch` no resuelve el pie cero con el cap rate, que es la sustitución que usa el score STR");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runMixRetornoTier(): { hard: number } {
  console.log("\n─── TIER MIX-RETORNO (la elegida es la de mayor retorno · mix-palancas.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — la sonda devuelve retorno, la elegida es la de mayor retorno entre las que cruzan, el descuento desempata, el tope sigue filtrando antes y sin retorno vuelve la regla vieja");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMixRetornoTier();
  process.exit(hard ? 1 : 0);
}
