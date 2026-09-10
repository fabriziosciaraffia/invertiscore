// ============================================================================
// GOLDEN · LA DISTANCIA A COMPRAR — catch-test (10-sep-2026). 0 tokens, sin base.
// ============================================================================
// En BUSCAR OTRA el motor mide la distancia al veredicto INMEDIATAMENTE superior
// (AJUSTA), y de paso ya exploraba el salto de dos bandas hasta COMPRAR — pero
// guardaba una sola palanca de las cuatro y tiraba el resto. Este tier fija que
// las cuatro sobrevivan y que la ausencia signifique lo que tiene que significar.
//
// Fija CUATRO cosas:
//
//   1. LAS CUATRO VÍAS, NO UNA. `viasHastaComprar` trae las cuatro palancas en
//      orden canónico (precio · arriendo · plazo · pie), y `palancasHastaComprar`
//      solo las que cruzan, en el mismo orden que ya usa `palancas`. Antes de este
//      goal `palancasHasta("COMPRAR")` las calculaba y se descartaban tres.
//
//   2. COHERENCIA CON EL CAMPO VIEJO. `palancaHastaComprar` (que ya existía) es
//      EXACTAMENTE el primero de `palancasHastaComprar`. Si divergen, el informe
//      tendría dos respuestas para la misma pregunta.
//
//   3. EL TOPE DEL SALTO DE DOS BANDAS ES 30, NO 15. El tope gobierna el salto que
//      se mide, no el veredicto de partida: llegar a COMPRAR usa la vara de AJUSTA.
//      Es la regla escrita en `topeDe` y la que hace que el campo exista.
//
//   4. AUSENTE ≠ NO CRUZA. Sin el salto de dos bandas (AJUSTA de partida, o
//      estructural) los tres campos son `null` explícito: "se miró y no aplica".
//      `undefined` queda reservado para las filas viejas persistidas antes de este
//      goal, que NO se calcularon. Confundir las dos lecturas haría que un informe
//      viejo dijera "no hay vía a COMPRAR" cuando nadie la buscó.
//
// Corre dentro del QUICK (tier "distancia-comprar") y standalone:
//   node --import tsx scripts/eval/golden/distancia-comprar-catch-test.ts
// ============================================================================
import {
  buildHallazgoDistanciaVeredicto,
  DIST_TOPE_AJUSTA_PCT,
} from "../../../src/lib/distancia-veredicto-hallazgo";
import type { Veredicto, ViaDistancia } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const ORDEN: ViaDistancia["palanca"][] = ["precio", "arriendo", "plazo", "pie"];

/**
 * Caso sintético con veredicto DIRIGIDO: el closure decide el veredicto por regla,
 * sin motor ni base. Es la única forma de fijar los bordes que ningún seed cubre
 * (nada cruza a COMPRAR, bono pie, plazo en el techo) de manera determinista.
 */
function construir(o: {
  veredictoBase: Veredicto;
  piePct?: number;
  plazoCredito?: number;
  razonSinPie?: "bono_pie" | "otra_fuente" | "no_declarada" | "sin_pie";
  /** Qué veredicto devuelve el motor para cada patch. */
  regla: (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }) => Veredicto;
}) {
  return buildHallazgoDistanciaVeredicto({
    veredictoBase: o.veredictoBase,
    arriendo: 500_000,
    precioUF: 3_000,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    razonSinPie: o.razonSinPie,
    veredictoAtPatch: o.regla,
    brazosGate1Activos: [],
    modalidad: "ltr",
  });
}

/** Regla: cruza a AJUSTA con poco esfuerzo y a COMPRAR con mucho (dentro del tope 30). */
const reglaDosBandas = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
  if (patch.arriendo != null) return patch.arriendo >= 625_000 ? "COMPRAR" : patch.arriendo >= 525_000 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (patch.precio != null) return patch.precio <= 2_400 ? "COMPRAR" : patch.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (patch.plazoCredito != null) return patch.plazoCredito >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (patch.piePct != null) return patch.piePct >= 28 ? "COMPRAR" : patch.piePct >= 24 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  return "BUSCAR OTRA";
};

// ── 1 · las CUATRO vías, no una ─────────────────────────────────────────────
{
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla: reglaDosBandas });
  const v = h?.valor;
  if (!v) F("1 · el hallazgo no se construyó");
  else if (!v.viasHastaComprar) F("1 · `viasHastaComprar` ausente en BUSCAR OTRA no estructural: las cuatro se calculan y se tiraban tres");
  else {
    if (v.viasHastaComprar.length !== 4) F(`1 · viasHastaComprar trae ${v.viasHastaComprar.length} vías, deben ser 4`);
    const orden = v.viasHastaComprar.map((x) => x.palanca);
    if (ORDEN.some((p, i) => orden[i] !== p)) F(`1 · orden canónico roto: ${orden.join(",")} (esperado ${ORDEN.join(",")})`);
    if (!v.palancasHastaComprar) F("1 · `palancasHastaComprar` ausente");
    else {
      const cruzan = v.viasHastaComprar.filter((x) => x.estado === "cruza").length;
      if (v.palancasHastaComprar.length !== cruzan) {
        F(`1 · palancasHastaComprar (${v.palancasHastaComprar.length}) ≠ vías que cruzan (${cruzan})`);
      }
      if (v.palancasHastaComprar.length === 0) F("1 · con esta regla precio y arriendo cruzan a COMPRAR: la lista no puede estar vacía");
    }
  }
}

// ── 2 · coherencia con el campo viejo ───────────────────────────────────────
{
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla: reglaDosBandas });
  const v = h?.valor;
  const primera = v?.palancasHastaComprar?.[0] ?? null;
  if (v && primera && v.palancaHastaComprar) {
    if (v.palancaHastaComprar.palanca !== primera.palanca || v.palancaHastaComprar.objetivo !== primera.objetivo) {
      F(`2 · palancaHastaComprar (${v.palancaHastaComprar.palanca}) ≠ palancasHastaComprar[0] (${primera.palanca}): dos respuestas para la misma pregunta`);
    }
  } else if (v && !v.palancaHastaComprar && primera) {
    F("2 · hay palancas a COMPRAR pero `palancaHastaComprar` quedó null");
  }
}

// ── 3 · el tope del salto de dos bandas es 30, no 15 ────────────────────────
{
  // Precio cruza a COMPRAR recién en −25%: fuera del tope de BUSCAR (15) y dentro
  // del de AJUSTA (30). Si el salto de dos bandas usara 15, no aparecería.
  const regla = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
    if (patch.precio != null) return patch.precio <= 2_250 ? "COMPRAR" : patch.precio <= 2_900 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    if (patch.arriendo != null) return patch.arriendo >= 520_000 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla });
  const via = h?.valor.viasHastaComprar?.find((x) => x.palanca === "precio");
  if (!via) F("3 · sin vía de precio hacia COMPRAR");
  else if (via.estado !== "cruza") {
    F(`3 · el precio cruza a COMPRAR en −25% y el salto de dos bandas usa tope ${DIST_TOPE_AJUSTA_PCT}: debía cruzar, dio «${via.estado}»`);
  }
}

// ── 4 · ausente ≠ no cruza ──────────────────────────────────────────────────
{
  // (a) Partiendo de AJUSTA no hay salto de dos bandas: null explícito, no undefined.
  const desdeAjusta = construir({
    veredictoBase: "AJUSTA SUPUESTOS",
    regla: (patch) => (patch.precio != null && patch.precio <= 2_800 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
  });
  const va = desdeAjusta?.valor;
  if (va) {
    if (va.palancasHastaComprar !== null) F("4a · desde AJUSTA `palancasHastaComprar` debe ser null explícito (se miró, no aplica)");
    if (va.viasHastaComprar !== null) F("4a · desde AJUSTA `viasHastaComprar` debe ser null explícito");
    if (va.palancaHastaComprar !== null) F("4a · desde AJUSTA `palancaHastaComprar` debe seguir siendo null");
  }
  // (b) Estructural: tampoco se explora el salto de dos bandas.
  const estructural = construir({
    veredictoBase: "BUSCAR OTRA",
    regla: () => "BUSCAR OTRA",
  });
  const ve = estructural?.valor;
  if (ve) {
    if (!ve.esEstructural) F("4b · el caso donde nada cruza debía salir estructural");
    if (ve.palancasHastaComprar !== null) F("4b · en el estructural `palancasHastaComprar` debe ser null explícito");
    if (ve.viasHastaComprar !== null) F("4b · en el estructural `viasHastaComprar` debe ser null explícito");
  }
  // (c) La distinción que importa: null (calculado, no aplica) ≠ undefined (fila vieja).
  //     El tipo declara los campos opcionales; una fila vieja NO los trae y el consumidor
  //     no puede leer esa ausencia como "no hay vía a COMPRAR".
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla: reglaDosBandas });
  if (h && h.valor.viasHastaComprar === undefined) {
    F("4c · en un caso que SÍ se explora el campo no puede quedar undefined: undefined es «fila vieja», null es «no aplica»");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runDistanciaComprarTier(): { hard: number } {
  console.log("\n─── TIER DISTANCIA-COMPRAR (las cuatro vías al salto de dos bandas · distancia-veredicto-hallazgo.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — las cuatro vías sobreviven, coherentes con el campo viejo, con tope 30, y ausente ≠ no cruza");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runDistanciaComprarTier();
  process.exit(hard ? 1 : 0);
}
