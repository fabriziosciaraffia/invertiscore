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
    sondaAtPatch: (patch) => ({ veredicto: o.regla(patch), score: null }),
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
  // (b) EL ESTRUCTURAL TAMBIÉN SE EXPLORA (10-sep-2026). Hasta este cambio la condición
  //     llevaba `&& !esEstructural` y el 63% de las BUSCAR OTRA del parque —388 de 615—
  //     se quedaba SIN ningún número hacia COMPRAR. Que ninguna palanca cruce al
  //     veredicto de al lado no es razón para no medir cuánto pediría el de dos bandas
  //     más arriba: es justamente donde el lector más necesita saberlo.
  const estructural = construir({
    veredictoBase: "BUSCAR OTRA",
    // Nada cruza a AJUSTA; el precio sí llega a COMPRAR en −20%, dentro del tope 30.
    regla: (patch) => (patch.precio != null && patch.precio <= 2_400 ? "COMPRAR" : "BUSCAR OTRA"),
  });
  const ve = estructural?.valor;
  if (ve) {
    if (!ve.esEstructural) F("4b · ninguna palanca cruza a AJUSTA: debía salir estructural");
    if (ve.viasHastaComprar === null) F("4b · el estructural TAMBIÉN explora el salto de dos bandas: `viasHastaComprar` no puede ser null");
    else if (ve.viasHastaComprar!.length !== 4) F(`4b · viasHastaComprar trae ${ve.viasHastaComprar!.length} vías, deben ser 4`);
    if (!ve.palancasHastaComprar?.length) F("4b · el precio cruza a COMPRAR en −20%: tiene que aparecer en palancasHastaComprar");
  }
  // (b2) Y si NI SIQUIERA a COMPRAR cruza nada dentro del tope, el mínimo fuera de tope
  //      se calcula igual: es el número que la frase dura necesita para no citar el umbral.
  const estrSinNada = construir({
    veredictoBase: "BUSCAR OTRA",
    regla: (patch) => (patch.precio != null && patch.precio <= 1_500 ? "COMPRAR" : "BUSCAR OTRA"),
  });
  const vsn = estrSinNada?.valor;
  if (vsn) {
    if (!vsn.esEstructural) F("4b2 · debía ser estructural");
    if (vsn.palancasHastaComprar?.length !== 0) F("4b2 · nada cruza a COMPRAR dentro de 30: la lista debe estar VACÍA, no null");
    if (!vsn.deltaMinimoComprarFueraDeTope) F("4b2 · el precio cruza a COMPRAR en −50%: el mínimo fuera de tope debe existir");
  }
  // (c) La distinción que importa: null (calculado, no aplica) ≠ undefined (fila vieja).
  //     El tipo declara los campos opcionales; una fila vieja NO los trae y el consumidor
  //     no puede leer esa ausencia como "no hay vía a COMPRAR".
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla: reglaDosBandas });
  if (h && h.valor.viasHastaComprar === undefined) {
    F("4c · en un caso que SÍ se explora el campo no puede quedar undefined: undefined es «fila vieja», null es «no aplica»");
  }
}

// ── 5 · el delta MÍNIMO a COMPRAR cuando queda fuera del tope ───────────────
{
  // Nada cruza a COMPRAR dentro de 30, pero el precio sí cruza en −40% (dentro del
  // rango extendido −70%). Sin este campo el informe se queda sin el número y solo
  // puede decir "más de un 30%", que es el umbral y no el dato.
  const regla = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
    if (patch.precio != null) return patch.precio <= 1_800 ? "COMPRAR" : patch.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    if (patch.arriendo != null) return patch.arriendo >= 520_000 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla });
  const v = h?.valor;
  if (!v) F("5 · el hallazgo no se construyó");
  else if (v.esEstructural) F("5 · el caso cruza a AJUSTA por precio: no debía salir estructural");
  else {
    if ((v.palancasHastaComprar ?? []).length !== 0) F("5 · con esta regla nada cruza a COMPRAR dentro del tope 30");
    const dm = v.deltaMinimoComprarFueraDeTope;
    if (dm === undefined) F("5 · `deltaMinimoComprarFueraDeTope` no existe: el número de COMPRAR sigue sin calcularse");
    else if (dm === null) F("5 · el precio cruza a COMPRAR en −40%, dentro del rango extendido: no puede ser null");
    else {
      if (dm.palanca !== "precio") F(`5 · el candidato debía ser el precio (el arriendo no cruza ni a +150%), dio «${dm.palanca}»`);
      if (Math.abs(dm.deltaPct + 40) > 0.6) F(`5 · el mínimo debía rondar −40%, dio ${dm.deltaPct}%`);
    }
  }
}

// ── 6 · el PIE queda fuera del sort de candidatos ───────────────────────────
{
  // El pie cruza a COMPRAR con un salto ENORME en puntos porcentuales (0 → 90) y el
  // precio con −40% en cambio relativo. Si el pie entrara al sort, |90| vs |40|
  // ordenaría mal dos unidades distintas — la regla ya escrita para el estructural.
  const regla = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
    if (patch.piePct != null) return patch.piePct >= 90 ? "COMPRAR" : patch.piePct >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    if (patch.precio != null) return patch.precio <= 1_800 ? "COMPRAR" : patch.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const h = construir({ veredictoBase: "BUSCAR OTRA", piePct: 10, regla });
  const dm = h?.valor.deltaMinimoComprarFueraDeTope;
  if (dm && dm.palanca !== "precio" && dm.palanca !== "arriendo") {
    F(`6 · el pie no puede ser candidato del delta fuera de tope (puntos vs cambio relativo), dio «${dm.palanca}»`);
  }
}

// ── 7 · ni el rango extendido cruza ⇒ null, y ausente ≠ null ────────────────
{
  // Nada llega a COMPRAR ni a −70% de precio ni a +150% de arriendo: null explícito.
  const regla = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
    if (patch.precio != null) return patch.precio <= 2_850 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const h = construir({ veredictoBase: "BUSCAR OTRA", regla });
  const v = h?.valor;
  if (v && !v.esEstructural && v.deltaMinimoComprarFueraDeTope !== null) {
    F(`7 · nada llega a COMPRAR ni en rango extendido: debía ser null explícito, dio ${JSON.stringify(v.deltaMinimoComprarFueraDeTope)}`);
  }
  // Y desde AJUSTA el campo no se calcula: null, nunca un número.
  const desdeAjusta = construir({
    veredictoBase: "AJUSTA SUPUESTOS",
    regla: (patch) => (patch.precio != null && patch.precio <= 2_800 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
  });
  if (desdeAjusta && desdeAjusta.valor.deltaMinimoComprarFueraDeTope !== null) {
    F("7 · desde AJUSTA el salto de dos bandas no existe: el campo debe ser null");
  }
}


// ── 8 · LA CIFRA PUBLICADA CRUZA, SONDEADA EN LA MISMA REGLA ─────────────────
//
// Las celdas de la tabla «Un cambio a la vez» muestran, juntas, un % y su monto. Son la misma
// magnitud dicha de dos formas, así que el lector puede confrontarlas con una multiplicación —
// y es la única aritmética del informe que alguien verifica a mano.
//
// LA REGLA QUE SE FIJA ACÁ: **el redondeo va siempre hacia MÁS ESFUERZO** (más descuento, más
// arriendo, más tarifa), de modo que CUALQUIERA de las dos cifras que el lector use lo deje en
// un punto que cruza. Lo que cambia entre celdas es cuál de las dos es la PETICIÓN —el % cuando
// hay contraparte a quien pedirle (precio), el monto cuando es una apuesta que se publica
// (arriendo, tarifa)— pero eso decide cuál queda EXACTA, no hacia dónde se redondea.
//
// Y EL % TIENE QUE CRUZAR AUNQUE NO SEA LA PETICIÓN, PORQUE VIAJA SOLO: el cierre del capítulo
// II escribe «subir a COMPRAR por el arriendo pediría un +X%» sin el monto al lado, y encima
// bifurca el copy en el umbral de 30 (`cierres-capitulos.ts`). El PDF STR hace lo mismo.
//
// Medido sobre el parque el 17-sep-2026, antes del arreglo: precio LTR publicaba un descuento
// que no cruza en 269 de 510 filas; el % del arriendo dejaba la cuenta del lector corta en 22
// de 160 sondeadas; ADR en 9 de 55; precio STR en 10 de 72. Los cuatro a 0.
//
// ⛔ NO SE VERIFICA LEYENDO LA ARITMÉTICA. Comprobar que `actual × (1+pct/100) ≈ objetivo` mide
// la GRAFÍA; lo que importa es si ese punto alcanza la meta, así que se SONDEA. Y la regla se
// declara UNA vez y se usa para las dos cosas —emitir y sondear—: escribir los umbrales dos
// veces sería el error de las «constantes espejo» que este arco viene persiguiendo.
//
// ⛔ Y VA POR BARRIDO, NO CON UNA FRONTERA ELEGIDA A MANO. La primera versión usaba UNA, puesta
// entre décimos a propósito, y salió VERDE sobre el código mutado: la bisección tiene su propia
// resolución (`DIST_PREC_PTS` = 0,1 sobre el factor), así que el punto que devuelve cae en una
// grilla y la frontera «incómoda» que yo elegí terminaba en un décimo cómodo. Con 60 fronteras
// el azar deja de decidir — y el PISO DE COBERTURA de abajo exige que al menos una haya caído
// donde `round` y `ceil` difieren, porque si ninguna cae ahí el barrido no probó nada.
{
  const ARRIENDO_HOY = 500_000;
  const PRECIO_HOY = 3_000;
  let casos = 0;
  let ejercitanElRedondeo = 0;

  for (let k = 0; k < 60; k++) {
    // fronteras repartidas a paso irregular para no alinearse con la grilla de la bisección
    const tArr = 505_000 + k * 1_117;      // hasta `+14% sobre 500.000 (tope BUSCAR = 15)
    const tPre = 2_990 - k * 6.83;         // hasta `−12,4% sobre 3.000
    const regla = (patch: { arriendo?: number; precio?: number; plazoCredito?: number; piePct?: number }): Veredicto => {
      if (patch.arriendo != null) return patch.arriendo >= tArr ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      if (patch.precio != null) return patch.precio <= tPre ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
      return "BUSCAR OTRA";
    };
    const hall = construir({ veredictoBase: "BUSCAR OTRA", regla });
    const meta = hall?.valor.veredictoObjetivo;
    const pals = (hall?.valor.palancas ?? []).filter((p) => p.palanca === "arriendo" || p.palanca === "precio");
    if (!hall || pals.length !== 2) continue; // se contabiliza abajo, con el piso de cobertura
    for (const p of pals) {
      casos++;
      const campo = p.palanca as "arriendo" | "precio";
      const base = campo === "arriendo" ? ARRIENDO_HOY : PRECIO_HOY;
      // ¿este caso distingue `round` de `ceil`? si no, no prueba el invariante
      const exacto = Math.abs((p.objetivo / base - 1) * 100);
      if (Math.round(exacto * 10) !== Math.ceil(exacto * 10 - 1e-9)) ejercitanElRedondeo++;
      // (a) el MONTO publicado
      if (regla({ [campo]: p.objetivo }) !== meta) {
        F(`8 · ${p.palanca} (frontera ${campo === "arriendo" ? tArr : tPre}): el MONTO publicado (${p.objetivo}) no alcanza ${meta} — el informe promete un número que no llega`);
      }
      // (b) la cuenta del LECTOR a partir del % publicado
      const delLector = Math.round(p.actual * (1 + p.deltaPct / 100));
      if (regla({ [campo]: delLector }) !== meta) {
        F(`8 · ${p.palanca} (frontera ${campo === "arriendo" ? tArr : tPre}): el % publicado (${p.deltaPct}%) lleva a ${delLector} y ESO no alcanza ${meta}. El % viaja solo en el cierre del capítulo II, así que tiene que cruzar por sí mismo`);
      }
    }
  }

  // ⛔ PISO DE COBERTURA. Sin esto el barrido puede quedar VERDE por no haber medido: si el
  // emisor deja de emitir las vías, `pals.length !== 2` salta todas y el bucle recorre cero
  // casos; y si ninguna frontera cae donde `round` y `ceil` difieren, el invariante pasa sin
  // haber ejercitado lo que vigila. Es «un cero de medición que no distingue NO CORRIÓ», que
  // ya mordió dos veces hoy — una en el gate de la corona de score y otra en la primera
  // versión de éste.
  if (casos < 100) F(`8 · el barrido midió ${casos} celdas de las ~120 que debia: las vías dejaron de emitirse y el invariante no probó nada`);
  if (ejercitanElRedondeo === 0) F("8 · ninguna de las fronteras barridas cae donde `round` y `ceil` difieren: el barrido pasó sin ejercitar el redondeo que este invariante vigila");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runDistanciaComprarTier(): { hard: number } {
  console.log("\n─── TIER DISTANCIA-COMPRAR (las cuatro vías al salto de dos bandas · distancia-veredicto-hallazgo.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — las cuatro vías sobreviven, coherentes con el campo viejo, con tope 30, el mínimo fuera de tope a COMPRAR, ausente ≠ no cruza, y la cifra publicada CRUZA por las dos lecturas (monto y %)");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runDistanciaComprarTier();
  process.exit(hard ? 1 : 0);
}
