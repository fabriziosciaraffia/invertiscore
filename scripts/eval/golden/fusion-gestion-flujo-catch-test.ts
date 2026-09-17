/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · FUSIÓN DEL CAPÍTULO V EN EL II — catch-test (17-sep-2026).
// 0 tokens, sin base.
// ============================================================================
// El capítulo «Cómo lo gestionas» tenía dos mitades y ninguna de las dos estaba en su lugar:
// la primera comparaba autogestión contra administrador en INGRESO NETO mientras el capítulo
// II hablaba en FLUJO —las dos cifras del administrador se contradecían en el 100% de las
// filas—, y la segunda no era sobre gestión sino sobre corto contra largo. La primera bajó al
// II como el bloque «Y si no vas a operarlo tú»; la segunda se quedó y pasó a titular.
//
// Fija CINCO cosas, todas sobre COMPORTAMIENTO:
//
//   1. LAS DOS COMISIONES NUNCA COEXISTEN. En el motor son la MISMA variable
//      (`base.comisionMensual`, rotulada `comisionPlataforma` en auto y `administrador` con
//      operador), así que una de las dos SIEMPRE vale cero y su suma es la comisión del caso.
//      Es la afirmación literal del sub del capítulo («reemplaza al 3%, no se suma»): si
//      alguna vez dejara de ser cierta, el informe estaría mintiendo en pantalla.
//   2. LA SUMA DE LAS TRES FILAS CIERRA. El bloque muestra «te queda», «un administrador
//      cobra», «dejas de pagar el 3%» y «te quedaría». Un lector que sume tiene que llegar al
//      total. A DOS filas no cerraba —daba el flujo auto menos la comisión admin, que se come
//      el 3% dos veces—, y así estaba dibujado en el mockup.
//   3. LA COMISIÓN DEL ADMINISTRADOR SALE DEL MOTOR, NO DE UN LITERAL. El render hacía
//      `Math.round(ingreso * 0.2)`. Se prueba con una comisión que NO es 20%: si alguien
//      vuelve al literal, el número del motor y el derivado se separan.
//   4. EL CIERRE DEL CAPÍTULO II ARRANCA EN EL QUIEBRE Y NO REPITE EL COSTO. El costo son las
//      dos filas de arriba; el cierre dice lo único que las filas no pueden decir.
//   5. `cierreLargoStr` HABLA CON LOS DOS SIGNOS. Era el segmento 4 de `cierreGestionStr` y
//      solo se emitía con sobre-renta NEGATIVA. Promovido a cierre de capítulo, un capítulo
//      no puede cerrar en blanco.
//
//   + PISO DE COBERTURA: los fixtures tienen que ejercitar LOS DOS MODOS de gestión y las dos
//     direcciones de la sobre-renta. Sin eso, un `if` que se coma una rama deja el tier verde.
//
// Corre standalone:
//   node --import tsx scripts/eval/golden/fusion-gestion-flujo-catch-test.ts
// ============================================================================
import {
  calcShortTerm,
  type AirbnbData,
  type ShortTermInputs,
} from "../../../src/lib/engines/short-term-engine";
import { cierreGestionStr, cierreLargoStr, type ArgsCierreGestionStr } from "../../../src/lib/cierres-capitulos-str";
import { fmtCierreCLP, textoCierre } from "../../../src/lib/cierres-str-ensamblador";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const f = fmtCierreCLP();

const airbnb: AirbnbData = {
  estimated_adr: 55_000,
  estimated_occupancy: 0.7,
  estimated_annual_revenue: 14_000_000,
  percentiles: {
    revenue: { p25: 10_000_000, p50: 14_000_000, p75: 17_000_000, p90: 20_000_000, avg: 14_500_000 },
    occupancy: { p25: 0.55, p50: 0.7, p75: 0.8, p90: 0.88, avg: 0.7 },
    average_daily_rate: { p25: 45_000, p50: 55_000, p75: 66_000, p90: 78_000, avg: 57_000 },
  },
  monthly_revenue: Array(12).fill(1 / 12),
  currency: "CLP",
};

const base = (over: Partial<ShortTermInputs> = {}): ShortTermInputs =>
  ({
    precioCompra: 160_000_000,
    superficie: 55,
    dormitorios: 2,
    banos: 2,
    piePercent: 0.2,
    tasaCredito: 0.045,
    plazoCredito: 25,
    airbnbData: airbnb,
    modoGestion: "auto",
    comisionAdministrador: 0.2,
    costoElectricidad: 45_000,
    costoAgua: 12_000,
    costoWifi: 18_000,
    costoInsumos: 10_000,
    gastosComunes: 95_000,
    mantencion: 22_000,
    contribuciones: 180_000,
    costoAmoblamiento: 5_000_000,
    arriendoLargoMensual: 620_000,
    valorUF: 39_000,
    // ⛔ Los dos ejes son enums DISTINTOS y el motor los indexa sin default: un valor cruzado
    // (`tipoEdificio: "estandar"`, que es un valor de `habilitacion`) da `undefined` en
    // `STR_ADR_FACTOR.edificio[...]` y propaga NaN por TODO el resultado, sin tirar. La
    // primera versión de este fixture lo tenía cruzado y las siete fallas que salieron eran
    // del instrumento, no del código.
    tipoEdificio: "residencial_puro",
    habilitacion: "estandar",
    adminPro: false,
    ...over,
  }) as ShortTermInputs;

// El MODO viaja con el fixture, no se lee del resultado: `ShortTermResult` no expone los
// inputs, así que `r.inputs?.modoGestion` era siempre `undefined` y el invariante 1 comparaba
// la comisión del administrador contra la del escenario auto. Daba rojo sobre código sano.
const CASOS = {
  auto: { modo: "auto" as const, r: calcShortTerm(base({ modoGestion: "auto" })) },
  admin: { modo: "administrador" as const, r: calcShortTerm(base({ modoGestion: "administrador" })) },
  // comisión que NO es 20%: el único fixture que distingue «lee el motor» de «multiplica por 0.2»
  comision15: { modo: "auto" as const, r: calcShortTerm(base({ modoGestion: "auto", comisionAdministrador: 0.15 })) },
};

// ── 1 · las dos comisiones nunca coexisten ──────────────────────────────────
for (const [k, { modo, r }] of Object.entries(CASOS)) {
  const d = r.metrics?.desgloseFall;
  if (!d) {
    F(`1 · ${k}: no hay desgloseFall — el capítulo II no tendría tabla`);
    continue;
  }
  if (d.comisionPlataforma !== 0 && d.administrador !== 0) {
    F(`1 · ${k}: las DOS comisiones cobran a la vez (plataforma ${d.comisionPlataforma}, admin ${d.administrador}) — el sub del capítulo dice que se reemplazan`);
  }
  const suma = d.comisionPlataforma + d.administrador;
  const delCaso = r.comparativa[modo === "administrador" ? "str_admin" : "str_auto"]?.comisionMensual;
  if (delCaso != null && suma !== delCaso) {
    F(`1 · ${k}: la suma de las dos filas (${suma}) ≠ la comisión del escenario (${delCaso})`);
  }
}

// ── 2 · la suma de las tres filas cierra ────────────────────────────────────
// te queda (auto) − lo que cobra el admin + lo que deja de cobrar la plataforma = te quedaría
for (const [k, { r }] of Object.entries(CASOS)) {
  const q = r.comparativa.quiebreGestion;
  const a = r.comparativa.str_auto;
  const ad = r.comparativa.str_admin;
  if (!q) {
    F(`2 · ${k}: sin quiebreGestion, el bloque del administrador no se dibuja`);
    continue;
  }
  const tresFilas = a.flujoCajaMensual - q.comisionMensual + a.comisionMensual;
  if (tresFilas !== ad.flujoCajaMensual) {
    F(`2 · ${k}: el bloque no cierra — ${a.flujoCajaMensual} − ${q.comisionMensual} + ${a.comisionMensual} = ${tresFilas}, pero el total es ${ad.flujoCajaMensual}`);
  }
  // y el caso de DOS filas, que es el que se dibujó mal en el mockup, tiene que NO cerrar:
  // si cerrara, este invariante no estaría midiendo nada.
  const dosFilas = a.flujoCajaMensual - q.comisionMensual;
  if (dosFilas === ad.flujoCajaMensual && a.comisionMensual !== 0) {
    F(`2 · ${k}: a DOS filas también cierra — el fixture no tiene comisión de plataforma, así que no distingue`);
  }
}

// ── 3 · la comisión del administrador sale del motor, no de un literal ──────
{
  const r = CASOS.comision15.r;
  const q = r.comparativa.quiebreGestion!;
  const bruto = r.comparativa.str_auto.ingresoBrutoMensual;
  const literal = Math.round(bruto * 0.2);
  if (q.comisionMensual === literal && q.comisionAdminDec !== 0.2) {
    F(`3 · con comisión 15% la cifra sigue siendo el 20% del bruto (${literal}): alguien está derivando en vez de leer el motor`);
  }
  const esperado = Math.round(bruto * 0.15);
  if (q.comisionMensual !== esperado) {
    F(`3 · comisión 15%: el motor emite ${q.comisionMensual}, se esperaba ${esperado} (= ${bruto} × 0,15)`);
  }
  if (q.comisionAdminDec !== 0.15) {
    F(`3 · \`comisionAdminDec\` dice ${q.comisionAdminDec}, no 0,15: el rótulo del capítulo saldría con otro porcentaje`);
  }
}

// ── 4 · el cierre del II arranca en el quiebre y no repite el costo ─────────
{
  const r = CASOS.auto.r;
  const q = r.comparativa.quiebreGestion!;
  const args: ArgsCierreGestionStr = {
    modo: "auto",
    sobreRenta: r.comparativa.sobreRenta,
    flujoMensual: r.comparativa.str_auto.flujoCajaMensual,
    flujoOtroModo: r.comparativa.str_admin.flujoCajaMensual,
    ltrIngresoNeto: r.comparativa.ltr.noiMensual,
    quiebre: q,
  };
  const txt = textoCierre(cierreGestionStr(args, f));
  if (!/se pague sola/.test(txt)) {
    F("4 · el cierre del capítulo II no arranca en el punto de quiebre");
  }
  if (!/puntos de ocupación/.test(txt)) {
    F("4 · el cierre perdió los puntos de ocupación, que son lo único que las filas no muestran");
  }
  // el sobrecosto es una FILA; repetirlo en prosa debajo de la tabla es lo que se retiró
  const sobrecosto = f.money(Math.abs(q.sobrecostoMensual));
  if (txt.includes(sobrecosto)) {
    F(`4 · el cierre repite el sobrecosto (${sobrecosto}), que ya es el sub de la fila «Te quedaría»`);
  }
  // y el hilo del largo se fue a `cierreLargoStr`
  if (/arrendar el mismo depto/.test(txt)) {
    F("4 · el cierre del capítulo II todavía trae el hilo del arriendo largo: ése es el cierre del capítulo V");
  }
}

// ── 5 · cierreLargoStr habla con los dos signos ─────────────────────────────
{
  const mk = (sobreRenta: number, modo: "auto" | "administrador"): ArgsCierreGestionStr => ({
    modo,
    sobreRenta,
    flujoMensual: 100_000,
    flujoOtroModo: 50_000,
    ltrIngresoNeto: 420_000,
    quiebre: CASOS.auto.r.comparativa.quiebreGestion,
  });
  for (const [etiqueta, sr] of [["gana", 180_000], ["pierde", -180_000]] as const) {
    for (const modo of ["auto", "administrador"] as const) {
      const segs = cierreLargoStr(mk(sr, modo), f);
      const txt = textoCierre(segs);
      if (!txt.trim()) F(`5 · ${etiqueta}/${modo}: el cierre del capítulo V salió VACÍO`);
      if (!/arrendar el mismo depto/.test(txt)) F(`5 · ${etiqueta}/${modo}: el cierre no nombra la comparación contra el largo`);
      if (!segs.some((s) => s.mark)) F(`5 · ${etiqueta}/${modo}: el cierre no lleva plumón en la cifra`);
      if (txt.includes(f.money(0))) F(`5 · ${etiqueta}/${modo}: el cierre imprimió un $0`);
    }
  }
  // ⛔ NO ALCANZA CON QUE LAS DOS REDACCIONES DIFIERAN. La primera versión pedía solo
  // `gana !== pierde`, y quedó VERDE al mutar la guardia del signo a `if (true)` —con las dos
  // ramas en la redacción NEGATIVA los textos siguen siendo distintos, porque el monto cambia
  // de signo—. O sea: el capítulo podía decirle «el corto no le gana al largo» a un caso donde
  // sí le gana, y el tier no se enteraba. Cazado mutando. Ahora cada rama tiene que decir lo
  // que su signo significa, y no solo ser distinta de la otra.
  const gana = textoCierre(cierreLargoStr(mk(180_000, "auto"), f));
  const pierde = textoCierre(cierreLargoStr(mk(-180_000, "auto"), f));
  if (gana === pierde) F("5 · las dos redacciones del signo son idénticas: la rama no está haciendo nada");
  if (!/le gana al largo/.test(pierde)) F("5 · la redacción del caso que PIERDE no lo dice");
  if (!/menos al mes/.test(pierde)) F("5 · el caso que PIERDE no dice «menos al mes»");
  if (/le gana al largo/.test(gana)) F("5 · el caso que GANA dice que no le gana: la guardia del signo no separa las ramas");
  if (!/más al mes/.test(gana)) F("5 · el caso que GANA no dice «más al mes»");
  // y ninguna de las dos puede imprimir un monto negativo: cada rama ya invierte el signo
  for (const [etiqueta, txt] of [["gana", gana], ["pierde", pierde]] as const) {
    if (/−\s*\$|-\$/.test(txt)) F(`5 · el caso que ${etiqueta.toUpperCase()} imprime un monto negativo: la rama está usando el signo del otro lado`);
  }
}

// ── PISO DE COBERTURA ───────────────────────────────────────────────────────
// Cada fixture tiene que hacer lo que su nombre declara. Sin esto, `auto` y `admin` podrían
// haber quedado los dos en el mismo modo y el tier seguiría verde sin ejercitar la rama.
{
  if (CASOS.auto.r.comparativa.quiebreGestion == null) F("PISO · el fixture `auto` no produjo quiebreGestion");
  if (CASOS.admin.r.comparativa.quiebreGestion == null) F("PISO · el fixture `admin` no produjo quiebreGestion");
  const dAuto = CASOS.auto.r.metrics?.desgloseFall;
  const dAdmin = CASOS.admin.r.metrics?.desgloseFall;
  if (!dAuto || dAuto.comisionPlataforma <= 0) F("PISO · el fixture `auto` no cobra comisión de plataforma: el invariante 2 no distingue dos filas de tres");
  if (!dAdmin || dAdmin.administrador <= 0) F("PISO · el fixture `admin` no cobra comisión de administrador: la rama del modo administrador no se ejercitó");
  if (CASOS.comision15.r.comparativa.quiebreGestion?.comisionAdminDec === 0.2) {
    F("PISO · el fixture `comision15` quedó en 20%: es el ÚNICO que separa «lee el motor» de «multiplica por 0.2»");
  }
  const q = CASOS.auto.r.comparativa.quiebreGestion;
  if (!q || !(q.puntosExtra > 0)) F("PISO · `puntosExtra` no es positivo en el fixture base: el cierre del capítulo II no se dibujaría y el invariante 4 mediría sobre texto vacío");
}

export function runFusionGestionFlujoTier(): { hard: number } {
  console.log("\n─── TIER FUSIÓN-GESTIÓN-FLUJO (el capítulo V dentro del II · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — las dos comisiones nunca coexisten, el bloque cierra a tres filas, la comisión sale del motor con cualquier valor, el cierre del II arranca en el quiebre sin repetir el costo, y el del V habla con los dos signos");
  } else {
    for (const m of fallas) console.log(`  ✗ ${m}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFusionGestionFlujoTier();
  process.exit(hard ? 1 : 0);
}
