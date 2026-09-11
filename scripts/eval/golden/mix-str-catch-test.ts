// ============================================================================
// GOLDEN · EL MIX STR — pie × plazo × precio con la forma de LTR (11-sep-2026). 0 tokens.
// ============================================================================
// El builder STR (`distancia-veredicto-str-hallazgo.ts`) llama al MISMO módulo que LTR
// (`mix-palancas.ts`) a través de un adaptador de tres líneas: el módulo habla en UF y en
// puntos de pie, el motor STR en CLP y en decimal. Este tier fija lo que ese cableado no
// puede perder sin que el informe mienta:
//
//   1. EL ADAPTADOR CONVIERTE, NO INVENTA. Cada sonda del mix llega al motor con
//      `precioCompra` en CLP (precio UF × la UF congelada del análisis), `piePercent` en
//      decimal y `plazoCredito` en años del wizard. Sin tarifa ni gestión en la sonda: la
//      tarifa es el arriendo de STR y la pone el mercado; la gestión ya se reporta sola.
//   2. EL DESTINO ES EL ESCALÓN, y se declara. Desde AJUSTA el mix apunta a COMPRAR; desde
//      BUSCAR OTRA, a AJUSTA SUPUESTOS — nunca a COMPRAR—. La card filtra por `destino`;
//      el escalón vive en el pop-up.
//   3. EL TOPE ES EL DE LA PALANCA SOLA: 25% desde AJUSTA, 15% desde BUSCAR. Un
//      descuento que el precio solo tiene prohibido, el mix tampoco lo pide.
//   4. REDUNDANCIA. Si el mix mueve UNA sola dimensión y esa palanca ya cruza sola, lo
//      declara: el render tiene que poder no dibujarlo.
//   5. «SIN SALIDA» ES `esEstructural && !alcanzable`, y `esEstructural` NO cambia de
//      significado: sigue siendo «ninguna palanca sola cruza».
//   6. BONO PIE: con el pie cubierto por la inmobiliaria el mix no lo mueve.
//
// Corre: node --import tsx scripts/eval/golden/mix-str-catch-test.ts
// ============================================================================
import { buildHallazgoDistanciaVeredictoStr, DIST_STR_TOPE_AJUSTA_PCT, DIST_STR_TOPE_BUSCAR_PCT } from "../../../src/lib/distancia-veredicto-str-hallazgo";
import { DIST_PIE_RAZON_EXCLUIDA, DIST_PIE_TOPE_PCT } from "../../../src/lib/distancia-veredicto-hallazgo";
import { MIX_COSTO_TOPE_PTS_PRECIO, MIX_PLAZOS_WIZARD } from "../../../src/lib/mix-palancas";
import type { StrPatch } from "../../../src/lib/analysis/veredicto-str-con-patch";
import type { Veredicto, RazonSinCapital } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

const PRECIO_UF = 3_000;
const UF = 38_500;
const PRECIO_CLP = PRECIO_UF * UF;
const ADR = 45_000;

/** ¿Es una sonda del MIX? Las tres claves juntas: la exploración de a una manda una sola. */
const esSondaMix = (x: StrPatch) => x.precioCompra != null && x.piePercent != null && x.plazoCredito != null;

function construir(o: {
  base?: "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
  piePct?: number;
  plazoCredito?: number;
  razonSinPie?: RazonSinCapital;
  regla: (patch: StrPatch) => Veredicto;
}) {
  const base = o.base ?? "BUSCAR OTRA";
  return buildHallazgoDistanciaVeredictoStr({
    veredictoBase: base,
    // Bajo la banda del objetivo: sin puro-gate, la vía se mide contra el puntaje.
    score: base === "BUSCAR OTRA" ? 40 : 60,
    precioUF: PRECIO_UF,
    precioCLP: PRECIO_CLP,
    adrActual: ADR,
    modoGestionActual: "auto",
    comisionAutoDec: 0.03,
    comisionAdminDec: 0.2,
    plazoCredito: o.plazoCredito ?? 25,
    piePct: o.piePct ?? 20,
    razonSinPie: o.razonSinPie,
    motivosGate: [],
    veredictoAtPatch: o.regla,
  });
}

const pie = (x: StrPatch, dflt: number) => (x.piePercent != null ? x.piePercent * 100 : dflt);
const plazo = (x: StrPatch, dflt: number) => x.plazoCredito ?? dflt;
const dcto = (x: StrPatch) => (x.precioCompra != null ? 1 - x.precioCompra / PRECIO_CLP : 0);

// ── 1 · el adaptador convierte, no inventa ──────────────────────────────────
{
  const vistas: StrPatch[] = [];
  construir({
    piePct: 10,
    regla: (x) => {
      if (esSondaMix(x)) vistas.push({ ...x });
      return "BUSCAR OTRA";
    },
  });
  if (vistas.length === 0) F("1 · el builder STR no llamó al mix: ninguna sonda con precio + pie + plazo llegó al motor");
  for (const s of vistas) {
    if (s.adrOverride != null || s.modoGestion != null || s.occOverride != null) { F("1 · una sonda del mix trae tarifa, ocupación o gestión: el mix es pie × plazo × precio"); break; }
  }
  const precios = vistas.map((s) => s.precioCompra!);
  if (precios.some((c) => c > PRECIO_CLP + 1)) F("1 · una sonda pide MÁS que el precio declarado (¿UF sin convertir?)");
  if (precios.some((c) => c < PRECIO_CLP * 0.5)) F(`1 · una sonda llegó en UF, no en CLP: ${Math.min(...precios)}`);
  if (precios.some((c) => !Number.isInteger(c))) F("1 · el precio en CLP tiene que ir redondeado (el motor no recibe centavos)");
  const pies = [...new Set(vistas.map((s) => s.piePercent!))].sort((a, b) => a - b);
  if (pies.some((x) => x > 1)) F(`1 · el pie llegó en puntos, no en decimal: ${pies.join(",")}`);
  if (pies.some((x) => x < 0.1 - 1e-9)) F(`1 · la grilla del pie bajó del declarado (10%): ${pies.join(",")}`);
  if (pies.some((x) => x > DIST_PIE_TOPE_PCT / 100 + 1e-9)) F(`1 · la grilla del pie pasó el techo ${DIST_PIE_TOPE_PCT}%: ${pies.join(",")}`);
  const plazos = [...new Set(vistas.map((s) => s.plazoCredito!))].sort((a, b) => a - b);
  if (plazos.some((x) => !MIX_PLAZOS_WIZARD.includes(x as never))) F(`1 · plazo fuera del enum del wizard: ${plazos.join(",")}`);
  if (plazos.some((x) => x < 25)) F(`1 · la grilla del plazo bajó del declarado (25 años): ${plazos.join(",")}`);
}

// ── 2 · el destino es el escalón, y se declara ──────────────────────────────
{
  const desdeBuscar = construir({
    base: "BUSCAR OTRA",
    regla: (x) => (pie(x, 20) >= 30 && plazo(x, 25) >= 30 ? "COMPRAR" : "BUSCAR OTRA"),
  });
  const m = desdeBuscar?.valor.mixPalancas;
  if (m === undefined) F("2 · desde BUSCAR el builder no emite `mixPalancas` (undefined = no calculado)");
  else if (!m) F("2 · pie 30 + 30 años cruza: el mix no puede ser null");
  else {
    if (m.destino !== "AJUSTA SUPUESTOS") F(`2 · desde BUSCAR el destino es el escalón (AJUSTA SUPUESTOS), dio «${m.destino}»`);
    if (m.destino !== desdeBuscar!.valor.veredictoObjetivo) F("2 · el destino del mix tiene que ser el `veredictoObjetivo` del hallazgo");
  }
  const desdeAjusta = construir({
    base: "AJUSTA SUPUESTOS",
    regla: (x) => (pie(x, 20) >= 30 && plazo(x, 25) >= 30 ? "COMPRAR" : "AJUSTA SUPUESTOS"),
  });
  const mA = desdeAjusta?.valor.mixPalancas;
  if (!mA) F("2 · desde AJUSTA el mix hacia COMPRAR no se construyó");
  else if (mA.destino !== "COMPRAR") F(`2 · desde AJUSTA el destino es COMPRAR, dio «${mA.destino}»`);
}

// ── 3 · el tope es el de la palanca sola: 25 desde AJUSTA, 15 desde BUSCAR ──
{
  // Cruza recién con −20% de precio, con cualquier pie y plazo.
  const regla20 = (meta: Veredicto, base: Veredicto) => (x: StrPatch) => (dcto(x) >= 0.20 - 1e-9 ? meta : base);
  const sondasBuscar: StrPatch[] = [];
  const hB = construir({
    base: "BUSCAR OTRA",
    regla: (x) => { if (esSondaMix(x)) sondasBuscar.push(x); return regla20("AJUSTA SUPUESTOS", "BUSCAR OTRA")(x); },
  });
  if (hB?.valor.mixPalancas) F(`3 · desde BUSCAR el tope es ${DIST_STR_TOPE_BUSCAR_PCT}%: un mix que necesita −20% no existe, dio ${JSON.stringify(hB.valor.mixPalancas.descuentoPct)}`);
  const pasoTope = sondasBuscar.filter((s) => dcto(s) > DIST_STR_TOPE_BUSCAR_PCT / 100 + 1e-6);
  if (pasoTope.length) F(`3 · desde BUSCAR la bisección sondeó más allá del ${DIST_STR_TOPE_BUSCAR_PCT}% (${pasoTope.length} sondas)`);
  if (hB && hB.valor.topePct !== DIST_STR_TOPE_BUSCAR_PCT) F(`3 · topePct desde BUSCAR debía ser ${DIST_STR_TOPE_BUSCAR_PCT}, dio ${hB.valor.topePct}`);

  const sondasAjusta: StrPatch[] = [];
  const hA = construir({
    base: "AJUSTA SUPUESTOS",
    regla: (x) => { if (esSondaMix(x)) sondasAjusta.push(x); return regla20("COMPRAR", "AJUSTA SUPUESTOS")(x); },
  });
  const mA = hA?.valor.mixPalancas;
  if (!mA) F(`3 · desde AJUSTA el tope es ${DIST_STR_TOPE_AJUSTA_PCT}%: un mix con −20% sí existe`);
  else if (Math.abs(mA.descuentoPct - 20) > 0.2) F(`3 · el descuento del mix debía rondar 20%, dio ${mA.descuentoPct}`);
  if (sondasAjusta.some((s) => dcto(s) > DIST_STR_TOPE_AJUSTA_PCT / 100 + 1e-6)) F(`3 · desde AJUSTA la bisección sondeó más allá del ${DIST_STR_TOPE_AJUSTA_PCT}%`);
}

// ── 4 · redundancia con una palanca sola ────────────────────────────────────
{
  // Con 30 años cruza, con lo demás fijo: el plazo cruza SOLO y el mix solo mueve el plazo.
  const h = construir({ regla: (x) => (plazo(x, 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  const vPlazo = h?.valor.vias?.find((v) => v.palanca === "plazo");
  if (vPlazo?.estado !== "cruza") F("4 · el caso está mal armado: el plazo debía cruzar solo");
  const m = h?.valor.mixPalancas;
  if (!m) F("4 · con 30 años cruza: el mix no puede ser null");
  else if (!m.redundanteConPalancaSola) F("4 · el mix mueve solo el plazo y el plazo ya cruza solo: debía declararse redundante");
  if (h && h.valor.esEstructural) F("4 · con una palanca que cruza sola no es estructural");
  if (h && h.valor.sinSalida !== false) F("4 · con una palanca que cruza sola `sinSalida` es false");

  // Pie 30 + 30 años: dos dimensiones, ninguna cruza sola ⇒ no redundante.
  const dos = construir({ regla: (x) => (pie(x, 20) >= 30 && plazo(x, 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  const m2 = dos?.valor.mixPalancas;
  if (!m2) F("4 · pie 30 + 30 años cruza: el mix no puede ser null");
  else if (m2.redundanteConPalancaSola) F("4 · el mix mueve dos cosas que no cruzan solas: no es redundante");
}

// ── 5 · «sin salida» es `esEstructural && !alcanzable` ──────────────────────
{
  const nada = construir({ regla: () => "BUSCAR OTRA" });
  if (nada) {
    if (!nada.valor.esEstructural) F("5 · sin ninguna palanca que cruce debía ser estructural");
    if (nada.valor.mixPalancas !== null) F("5 · sin ninguna combinación que cruce el mix debe ser null explícito");
    if (nada.valor.sinSalida !== true) F("5 · sin palanca sola y sin mix ⇒ `sinSalida` true");
  }
  const conSalida = construir({ regla: (x) => (pie(x, 20) >= 30 && plazo(x, 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  if (conSalida) {
    if (!conSalida.valor.esEstructural) F("5 · «sin palanca sola» NO cambia de significado: ninguna cruza sola, sigue estructural");
    if (conSalida.valor.sinSalida !== false) F("5 · el mix cruza dentro del alcance ⇒ `sinSalida` false");
    if (!conSalida.valor.mixPalancas?.dentroDelAlcance) F("5 · pie 20→30 son 10 pts: cabe en el alcance");
  }
  // Cruza solo con pie 25 Y 30 años, partiendo de pie 0: ninguna palanca sola alcanza
  // (el pie solo va con 25 años; el plazo solo, con pie 0), y la combinación cuesta 25
  // puntos del precio, más que el alcance.
  const caro = construir({ piePct: 0, regla: (x) => (pie(x, 0) >= 25 && plazo(x, 25) >= 30 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA") });
  if (caro) {
    const m = caro.valor.mixPalancas;
    if (!m) F("5 · la combinación cruza: se devuelve aunque esté fuera de alcance");
    else if (m.dentroDelAlcance) F(`5 · pie 0→25 son 25 pts > ${MIX_COSTO_TOPE_PTS_PRECIO}: fuera de alcance`);
    if (caro.valor.sinSalida !== true) F("5 · mix fuera de alcance ⇒ `sinSalida` true (cruza, pero no es una salida)");
  }
  // Coherencia contable en los cuatro casos: sinSalida ≡ esEstructural && !alcanzable.
  for (const [k, h] of Object.entries({ nada, conSalida, caro })) {
    if (!h) continue;
    const esperado = h.valor.esEstructural && !(h.valor.mixPalancas?.dentroDelAlcance ?? false);
    if (h.valor.sinSalida !== esperado) F(`5 · ${k}: sinSalida=${h.valor.sinSalida} no es esEstructural && !alcanzable (${esperado})`);
  }
}

// ── 6 · bono pie: el mix no mueve el pie ────────────────────────────────────
{
  const vistas: StrPatch[] = [];
  const h = construir({
    piePct: 0,
    razonSinPie: DIST_PIE_RAZON_EXCLUIDA,
    regla: (x) => { if (esSondaMix(x)) vistas.push(x); return pie(x, 0) >= 20 ? "AJUSTA SUPUESTOS" : "BUSCAR OTRA"; },
  });
  if (!h?.valor.pieExcluidoPorBono) F("6 · el caso está mal armado: debía ser bono pie");
  if (vistas.some((s) => (s.piePercent ?? 0) > 0)) F("6 · con bono pie una sonda del mix subió el pie: subirlo desarma el trato");
  if (h?.valor.mixPalancas) F("6 · con el pie clavado en 0 y una regla que exige pie 20, el mix no puede existir");
}

export function runMixStrTier(): { hard: number } {
  console.log("\n─── TIER MIX STR (pie × plazo × precio con la forma de LTR · distancia-veredicto-str-hallazgo.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el adaptador convierte UF→CLP y %→decimal, destino = escalón declarado, tope 25/15 por veredicto, redundancia con palanca sola, «sin salida» coherente, bono pie intacto");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMixStrTier();
  process.exit(hard ? 1 : 0);
}
