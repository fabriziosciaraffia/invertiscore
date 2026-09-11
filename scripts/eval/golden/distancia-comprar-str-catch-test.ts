// ============================================================================
// GOLDEN · LA DISTANCIA A COMPRAR EN STR — catch-test (11-sep-2026). 0 tokens, sin base.
// ============================================================================
// Espejo del tier LTR `distancia-comprar` para el builder STR
// (`distancia-veredicto-str-hallazgo.ts`). En BUSCAR OTRA el motor mide la distancia al
// escalón (AJUSTA) y ya exploraba el salto de dos bandas hasta COMPRAR con
// `palancasHasta("COMPRAR")` —pero guardaba UNA palanca de las cinco, solo cuando no era
// estructural, y tiraba el resto. Sin ese dato la card de §5 no podía decir nada en las
// 129 BUSCAR del parque (52%): ni «con esto llegas» ni «no hay forma, pediría X%».
//
// Fija SEIS cosas:
//
//   1. LAS CINCO VÍAS, NO UNA. `viasHastaComprar` trae las cinco en orden canónico
//      (precio · tarifa · plazo · pie · gestión) y `palancasHastaComprar` solo las que
//      cruzan, en el orden de recomendación que ya usa `palancas`.
//
//   2. COHERENCIA CON EL CAMPO VIEJO. `palancaHastaComprar` es EXACTAMENTE el primero de
//      `palancasHastaComprar`: una sola respuesta para la misma pregunta.
//
//   3. EL TOPE DEL SALTO DE DOS BANDAS ES 25, NO 15. Gobierna el salto que se mide, no el
//      veredicto de partida: llegar a COMPRAR usa la vara de AJUSTA (`topeDe`).
//
//   4. AUSENTE ≠ NO CRUZA. Desde AJUSTA los cuatro campos son `null` explícito («se miró
//      y no aplica»); `undefined` queda para las filas viejas. Y EL ESTRUCTURAL TAMBIÉN
//      SE EXPLORA: que ninguna palanca cruce al escalón no es razón para no medir COMPRAR.
//
//   5. EL MÍNIMO REAL FUERA DEL TOPE. Cuando ninguna cruza a COMPRAR dentro de 25,
//      `deltaMinimoComprarFueraDeTope` trae el número en rango extendido (tarifa +150% ·
//      precio −70%): «más de un 25%» es el umbral, no el dato. El pie no es candidato.
//
//   6. LA SEGUNDA CORRIDA DEL MIX. `mixPalancasHastaComprar` es pie × plazo × precio con
//      meta COMPRAR desde BUSCAR, con el tope de ese salto (25) y `destino: "COMPRAR"`.
//      `mixPalancas` NO cambia: sigue apuntando al escalón, con su tope de 15, y
//      `sinSalida` conserva su significado (escalón). Desde AJUSTA el campo nuevo es null:
//      ahí `mixPalancas` ya apunta a COMPRAR.
//
// Corre dentro del QUICK (tier "distancia-comprar-str") y standalone:
//   node --import tsx scripts/eval/golden/distancia-comprar-str-catch-test.ts
// ============================================================================
import { buildHallazgoDistanciaVeredictoStr, DIST_STR_TOPE_AJUSTA_PCT, DIST_STR_TOPE_BUSCAR_PCT } from "../../../src/lib/distancia-veredicto-str-hallazgo";
import type { StrPatch } from "../../../src/lib/analysis/veredicto-str-con-patch";
import type { Veredicto } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

const PRECIO_UF = 3_000;
const UF = 38_500;
const PRECIO_CLP = PRECIO_UF * UF;
const ADR = 45_000;
const ORDEN = ["precio", "adr", "plazo", "pie", "gestion"];

const esSondaMix = (x: StrPatch) => x.precioCompra != null && x.piePercent != null && x.plazoCredito != null;
const pie = (x: StrPatch, dflt: number) => (x.piePercent != null ? x.piePercent * 100 : dflt);
const plazo = (x: StrPatch, dflt: number) => x.plazoCredito ?? dflt;
const dcto = (x: StrPatch) => (x.precioCompra != null ? 1 - x.precioCompra / PRECIO_CLP : 0);
const adrF = (x: StrPatch) => (x.adrOverride != null ? x.adrOverride / ADR : 1);

/** Caso sintético con veredicto DIRIGIDO por regla: sin motor ni base. */
function construir(o: { base?: "AJUSTA SUPUESTOS" | "BUSCAR OTRA"; piePct?: number; plazoCredito?: number; regla: (patch: StrPatch) => Veredicto }) {
  const base = o.base ?? "BUSCAR OTRA";
  return buildHallazgoDistanciaVeredictoStr({
    veredictoBase: base,
    score: base === "BUSCAR OTRA" ? 40 : 60,
    precioUF: PRECIO_UF,
    precioCLP: PRECIO_CLP,
    adrActual: ADR,
    modoGestionActual: "auto",
    comisionAutoDec: 0.03,
    comisionAdminDec: 0.2,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    motivosGate: [],
    veredictoAtPatch: o.regla,
  });
}

/** Regla de dos bandas: precio y tarifa cruzan a AJUSTA con poco y a COMPRAR con más
 *  (dentro de 25); el plazo solo llega a AJUSTA; el pie llega a COMPRAR con 28. Ninguna
 *  sonda del mix cruza (lo decide `esSondaMix` primero). */
const reglaDosBandas = (x: StrPatch): Veredicto => {
  if (esSondaMix(x)) return "BUSCAR OTRA";
  if (x.precioCompra != null) return dcto(x) >= 0.2 ? "COMPRAR" : dcto(x) >= 0.05 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (x.adrOverride != null) return adrF(x) >= 1.08 ? "COMPRAR" : adrF(x) >= 1.03 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (x.plazoCredito != null) return x.plazoCredito >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  if (x.piePercent != null) return pie(x, 20) >= 28 ? "COMPRAR" : pie(x, 20) >= 24 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
  return "BUSCAR OTRA";
};

// ── 1 · las CINCO vías, no una ──────────────────────────────────────────────
{
  const v = construir({ regla: reglaDosBandas })?.valor;
  if (!v) F("1 · el hallazgo no se construyó");
  else if (!v.viasHastaComprar) F("1 · `viasHastaComprar` ausente en BUSCAR OTRA: las cinco se calculan en `palancasHasta(\"COMPRAR\")` y se tiraban cuatro");
  else {
    if (v.viasHastaComprar.length !== 5) F(`1 · viasHastaComprar trae ${v.viasHastaComprar.length} vías, deben ser 5`);
    const orden = v.viasHastaComprar.map((x) => x.palanca);
    if (ORDEN.some((p, i) => orden[i] !== p)) F(`1 · orden canónico roto: ${orden.join(",")} (esperado ${ORDEN.join(",")})`);
    if (!v.palancasHastaComprar) F("1 · `palancasHastaComprar` ausente");
    else {
      const cruzan = v.viasHastaComprar.filter((x) => x.estado === "cruza").length;
      if (v.palancasHastaComprar.length !== cruzan) F(`1 · palancasHastaComprar (${v.palancasHastaComprar.length}) ≠ vías que cruzan (${cruzan})`);
      const nombres = v.palancasHastaComprar.map((x) => x.palanca).sort().join(",");
      if (nombres !== "adr,pie,precio") F(`1 · con esta regla precio, tarifa y pie cruzan a COMPRAR; dio «${nombres}»`);
    }
  }
}

// ── 2 · coherencia con el campo viejo ───────────────────────────────────────
{
  const v = construir({ regla: reglaDosBandas })?.valor;
  const primera = v?.palancasHastaComprar?.[0] ?? null;
  if (v && primera && v.palancaHastaComprar) {
    if (v.palancaHastaComprar.palanca !== primera.palanca || v.palancaHastaComprar.objetivo !== primera.objetivo) {
      F(`2 · palancaHastaComprar (${v.palancaHastaComprar.palanca}) ≠ palancasHastaComprar[0] (${primera.palanca}): dos respuestas para la misma pregunta`);
    }
  } else if (v && !v.palancaHastaComprar && primera) {
    F("2 · hay palancas a COMPRAR pero `palancaHastaComprar` quedó null");
  }
}

// ── 3 · el tope del salto de dos bandas es 25, no 15 ────────────────────────
{
  // El precio cruza a COMPRAR recién en −20%: fuera del tope de BUSCAR (15), dentro del de AJUSTA (25).
  const regla = (x: StrPatch): Veredicto => {
    if (esSondaMix(x)) return "BUSCAR OTRA";
    if (x.precioCompra != null) return dcto(x) >= 0.2 ? "COMPRAR" : dcto(x) >= 0.05 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const v = construir({ regla })?.valor;
  const via = v?.viasHastaComprar?.find((x) => x.palanca === "precio");
  if (!via) F("3 · sin vía de precio hacia COMPRAR");
  else if (via.estado !== "cruza") F(`3 · el precio cruza a COMPRAR en −20% y el salto de dos bandas usa tope ${DIST_STR_TOPE_AJUSTA_PCT}: debía cruzar, dio «${via.estado}»`);
  // y el escalón sigue con su tope de 15
  if (v && v.topePct !== DIST_STR_TOPE_BUSCAR_PCT) F(`3 · topePct desde BUSCAR debía seguir en ${DIST_STR_TOPE_BUSCAR_PCT}, dio ${v.topePct}`);
}

// ── 4 · ausente ≠ no cruza, y el estructural también se explora ─────────────
{
  const desdeAjusta = construir({
    base: "AJUSTA SUPUESTOS",
    regla: (x) => (x.precioCompra != null && dcto(x) >= 0.05 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
  })?.valor;
  if (!desdeAjusta) F("4 · el caso desde AJUSTA no se construyó");
  else {
    for (const k of ["palancasHastaComprar", "viasHastaComprar", "deltaMinimoComprarFueraDeTope", "mixPalancasHastaComprar"] as const) {
      if (desdeAjusta[k] !== null) F(`4 · desde AJUSTA \`${k}\` debía ser null explícito (se miró y no aplica), dio ${desdeAjusta[k] === undefined ? "undefined" : "un valor"}`);
    }
  }
  // Estructural: nada cruza al escalón; a COMPRAR se explora IGUAL y devuelve arrays.
  const estructural = construir({ regla: () => "BUSCAR OTRA" })?.valor;
  if (!estructural) F("4 · el caso estructural no se construyó");
  else {
    if (!estructural.esEstructural) F("4 · el caso estructural dejó de serlo");
    if (!Array.isArray(estructural.viasHastaComprar)) F("4 · en el estructural `viasHastaComprar` no se exploró: que ninguna palanca cruce al escalón no es razón para no medir COMPRAR");
    if (!Array.isArray(estructural.palancasHastaComprar) || estructural.palancasHastaComprar.length !== 0) F("4 · en el estructural `palancasHastaComprar` debía ser [] (explorado y vacío)");
  }
}

// ── 5 · el mínimo real hacia COMPRAR, fuera del tope ───────────────────────
{
  // Precio cruza a COMPRAR recién en −40% (fuera de 25, dentro de −70%); la tarifa en +80%
  // (fuera de su tope de 10, dentro de +150%). El mínimo es el precio: 40 < 80.
  const regla = (x: StrPatch): Veredicto => {
    if (esSondaMix(x)) return "BUSCAR OTRA";
    if (x.precioCompra != null) return dcto(x) >= 0.4 ? "COMPRAR" : dcto(x) >= 0.05 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    if (x.adrOverride != null) return adrF(x) >= 1.8 ? "COMPRAR" : adrF(x) >= 1.03 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    return "BUSCAR OTRA";
  };
  const v = construir({ regla })?.valor;
  if (!v) F("5 · el caso no se construyó");
  else {
    if ((v.palancasHastaComprar?.length ?? 0) !== 0) F("5 · con esta regla ninguna palanca cruza a COMPRAR dentro del tope");
    const d = v.deltaMinimoComprarFueraDeTope;
    if (!d) F("5 · `deltaMinimoComprarFueraDeTope` es null: el precio cruza en −40% y la tarifa en +80%, el número existe y hay que citarlo");
    else {
      if (d.palanca !== "precio") F(`5 · el mínimo es el precio (40 < 80), dio «${d.palanca}»`);
      if (Math.abs(Math.abs(d.deltaPct) - 40) > 1.5) F(`5 · el delta mínimo debía rondar −40%, dio ${d.deltaPct}`);
    }
    // sin nada en el rango extendido: null explícito
    const nada = construir({ regla: () => "BUSCAR OTRA" })?.valor;
    if (nada && nada.deltaMinimoComprarFueraDeTope !== null) F("5 · sin cruce ni en rango extendido el mínimo debía ser null");
  }
}

// ── 6 · la segunda corrida del mix: meta COMPRAR desde BUSCAR, tope 25 ─────
{
  // El escalón (AJUSTA) se alcanza con pie ≥ 25; COMPRAR con pie ≥ 30 y 30 años y −20% de
  // precio. Ese descuento existe con el tope de 25 y NO con el de 15.
  const sondas: StrPatch[] = [];
  const regla = (x: StrPatch): Veredicto => {
    if (esSondaMix(x)) {
      sondas.push({ ...x });
      if (pie(x, 20) >= 30 && plazo(x, 25) >= 30 && dcto(x) >= 0.2 - 1e-9) return "COMPRAR";
      return pie(x, 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA";
    }
    return "BUSCAR OTRA";
  };
  const v = construir({ regla })?.valor;
  if (!v) F("6 · el caso no se construyó");
  else {
    const m = v.mixPalancasHastaComprar;
    if (m === undefined) F("6 · desde BUSCAR el builder no emite `mixPalancasHastaComprar` (undefined = no calculado)");
    else if (m === null) F("6 · el mix hacia COMPRAR existe (pie 30 · 30 años · −20%) y el builder devolvió null: ¿corrió con el tope de 15?");
    else {
      if (m.destino !== "COMPRAR") F(`6 · el destino del mix nuevo es COMPRAR, dio «${m.destino}»`);
      if (m.piePct !== 30 || m.plazoAnios !== 30) F(`6 · el mix a COMPRAR debía ser pie 30 · 30 años, dio pie ${m.piePct} · ${m.plazoAnios} años`);
      if (Math.abs(m.descuentoPct - 20) > 1) F(`6 · el descuento del mix a COMPRAR debía rondar 20%, dio ${m.descuentoPct}`);
    }
    // el escalón NO cambia: su mix sigue apuntando a AJUSTA y su tope sigue en 15
    const e = v.mixPalancas;
    if (!e) F("6 · el mix al escalón desapareció: la segunda corrida no reemplaza a la primera");
    else if (e.destino !== "AJUSTA SUPUESTOS") F(`6 · el mix al escalón cambió de destino: «${e.destino}»`);
    const pasoTope = sondas.filter((s) => dcto(s) > DIST_STR_TOPE_AJUSTA_PCT / 100 + 1e-6);
    if (pasoTope.length) F(`6 · una sonda del mix pidió más del ${DIST_STR_TOPE_AJUSTA_PCT}% (${pasoTope.length}): el tope del salto a COMPRAR es el de AJUSTA, no más`);
    // sinSalida conserva su significado (escalón): acá el escalón cruza por mix, así que no es sin salida
    if (v.sinSalida !== false) F("6 · `sinSalida` cambió de significado: sigue siendo «ninguna sola Y ningún mix al ESCALÓN»");
  }
  // y desde BUSCAR sin mix a COMPRAR: null explícito, sin tocar el del escalón
  const sinComprar = construir({
    regla: (x) => (esSondaMix(x) ? (pie(x, 20) >= 25 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") : "BUSCAR OTRA"),
  })?.valor;
  if (sinComprar && sinComprar.mixPalancasHastaComprar !== null) F("6 · sin combinación que llegue a COMPRAR el campo nuevo debía ser null explícito");
  if (sinComprar && !sinComprar.mixPalancas) F("6 · el mix al escalón se perdió en el caso sin mix a COMPRAR");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runDistanciaComprarStrTier(): { hard: number } {
  console.log("\n─── TIER DISTANCIA-COMPRAR-STR (las cinco vías y el mix hacia COMPRAR desde BUSCAR · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — las cinco vías a COMPRAR sobreviven en orden canónico, coherentes con el campo viejo, con tope 25, exploradas también en el estructural, el mínimo fuera de tope con su número, y el mix a COMPRAR aparte del mix al escalón, que no se mueve");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runDistanciaComprarStrTier();
  process.exit(hard ? 1 : 0);
}
