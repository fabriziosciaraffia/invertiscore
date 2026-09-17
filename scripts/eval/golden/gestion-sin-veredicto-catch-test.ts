/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · GESTIÓN SIN VEREDICTO — catch-test (16-sep-2026). 0 tokens, sin base.
// ============================================================================
// El informe dejó de tomar posición sobre delegar. La razón está medida: `str_admin` corre
// con el MISMO ingreso, ADR y ocupación que `str_auto` y solo cambia la comisión, así que
// «delegar es peor» salía en el 100% del parque POR CONSTRUCCIÓN. Y la banda que sostendría
// la afirmación contraria (0,55 → 0,65) sale de 13 listings concentrados en el barrio más
// ocupado: al estratificar, el uplift se cae a +0,4pp, con el signo invertido en uno de tres.
//
// Fija CUATRO cosas, todas sobre COMPORTAMIENTO — ninguna sobre la grafía de un identificador:
//
//   1. LA IDENTIDAD DEL QUIEBRE. `ocupacionNecesaria` tiene que dejar al administrador
//      empatando: (1−comisiónAdmin)·occNecesaria ≡ (1−0,03)·occActual. Es lo que hace al
//      número verdadero con CUALQUIER calibración de ocupación — si alguien lo recalibra
//      con una banda, esto se pone rojo.
//
//   2. EL CIERRE NO EMITE VEREDICTO. Ninguna de las cuatro redacciones puede afirmar que
//      delegar conviene o no conviene. Se chequea con las frases que ESTABAN ahí hasta hoy
//      («La ventaja existe y es tuya mientras pongas las horas»), no con un regex genérico.
//
//   3. EL CIERRE SÍ DICE LAS TRES COSAS. Prohibir no alcanza: un predicado puramente
//      negativo se satisface borrando el render entero (CLAUDE.md § Testing, modo «GRAFÍA»).
//      Así que se AFIRMA que cada cierre trae el costo, el quiebre y la línea cualitativa.
//
//   4. PISO DE COBERTURA. Las cuatro redacciones tienen que salir DISTINTAS entre sí. Sin
//      esto, un `if` que colapse tres ramas en una dejaría el tier verde con una sola frase
//      repetida cuatro veces.
//
// Corre standalone:
//   node --import tsx scripts/eval/golden/gestion-sin-veredicto-catch-test.ts
// ============================================================================
import { cierreGestionStr, type ArgsCierreGestionStr } from "../../../src/lib/cierres-capitulos-str";
import { fmtCierreCLP } from "../../../src/lib/cierres-str-ensamblador";
import { COMISION_AIRBNB, puntosParaEmpatarGestion, type QuiebreGestionSTR } from "../../../src/lib/engines/short-term-engine";
import { calcVeredictoComparativo } from "../../../src/lib/engines/str-universo-santiago";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const f = fmtCierreCLP();
const texto = (segs: Array<{ t: string }>) => segs.map((s) => s.t).join("");

/** Arma el quiebre con la MISMA aritmética del motor (razón entre comisiones). */
function quiebreDe(occ: number, com: number, flujoAuto: number, flujoAdmin: number): QuiebreGestionSTR {
  // LA FÓRMULA SE LEE DEL MOTOR, no se recalcula: si se copiara acá, mutar el motor dejaría
  // este gate en verde — que es exactamente el modo de falla que CLAUDE.md § Testing describe.
  const puntosExtra = puntosParaEmpatarGestion(occ, com);
  const sobrecosto = flujoAuto - flujoAdmin;
  return {
    comisionMensual: Math.round(sobrecosto / (com - COMISION_AIRBNB) * com),
    sobrecostoMensual: sobrecosto,
    sobrecostoAnual: sobrecosto * 12,
    puntosExtra,
    ocupacionActual: occ,
    ocupacionNecesaria: occ + puntosExtra,
    cambiaElSigno: flujoAuto >= 0 && flujoAdmin < 0,
    breakEvenAdminPct: 0.8,
    comisionAdminDec: com,
  };
}

// Las cuatro redacciones, con cifras de filas REALES del parque (16-sep-2026).
const CASOS: Array<{ key: string; args: ArgsCierreGestionStr }> = [
  {
    key: "AGUANTA · 3f50506d Ñuñoa",
    args: { modo: "auto", flujoMensual: 345690, flujoOtroModo: 112226, sobreRenta: 120000, ltrIngresoNeto: 400000, quiebre: quiebreDe(0.70, 0.20, 345690, 112226) },
  },
  {
    key: "CAMBIA EL SIGNO · f2c31622 Huechuraba",
    args: { modo: "auto", flujoMensual: 138050, flujoOtroModo: -141175, sobreRenta: 90000, ltrIngresoNeto: 500000, quiebre: quiebreDe(0.60, 0.20, 138050, -141175) },
  },
  {
    key: "YA EN PÉRDIDA · 4940c056 Ñuñoa",
    args: { modo: "auto", flujoMensual: -392904, flujoOtroModo: -489982, sobreRenta: -50000, ltrIngresoNeto: 300000, quiebre: quiebreDe(0.444, 0.20, -392904, -489982) },
  },
  {
    key: "YA DELEGA · c925e85a Las Condes",
    args: { modo: "administrador", flujoMensual: 79028, flujoOtroModo: 278300, sobreRenta: 140000, ltrIngresoNeto: 600000, quiebre: quiebreDe(0.491, 0.20, 278300, 79028) },
  },
];

// ── 1 · la identidad del quiebre ────────────────────────────────────────────
for (const c of CASOS) {
  const q = c.args.quiebre!;
  const izq = (1 - q.comisionAdminDec) * q.ocupacionNecesaria;
  const der = (1 - COMISION_AIRBNB) * q.ocupacionActual;
  if (Math.abs(izq - der) > 1e-9) {
    F(`1 · ${c.key}: el quiebre no empata — (1−${q.comisionAdminDec})×${q.ocupacionNecesaria} = ${izq}, contra (1−${COMISION_AIRBNB})×${q.ocupacionActual} = ${der}`);
  }
  if (!(q.puntosExtra > 0)) F(`1 · ${c.key}: puntosExtra = ${q.puntosExtra}, y con comisión > 3% tiene que ser positivo`);
}

// ── 2 · ninguna redacción emite veredicto ───────────────────────────────────
const PROHIBIDO: Array<[RegExp, string]> = [
  [/La ventaja existe y es tuya mientras pongas las horas/i, "la tesis vieja, rama positiva"],
  [/La ventaja existe solo si pones las horas/i, "la tesis vieja, rama negativa"],
  [/da vuelta el veredicto|cambia el veredicto|cambia cuál te conviene/i, "el flip de gestión"],
  [/(no )?(te )?conviene delegar|delegar (no )?conviene/i, "veredicto explícito sobre delegar"],
  [/gestión profesional/i, "atribuye a la gestión profesional algo que el motor no mide"],
];
const salidas = CASOS.map((c) => ({ key: c.key, txt: texto(cierreGestionStr(c.args, f)) }));
for (const s of salidas) {
  for (const [rx, que] of PROHIBIDO) {
    if (rx.test(s.txt)) F(`2 · ${s.key}: el cierre emite veredicto — ${que}`);
  }
}

// ── 3 · y sí dice lo que le queda (afirmativo, no solo prohibitivo) ─────────
// ⛔ DOS DE ESTAS REGLAS LAS DEROGÓ LA FUSIÓN DEL 17-sep-2026, y se retiran acá EN EL MISMO
// CAMBIO que las deroga — no se dejan en rojo. Un tier rojo que nadie corrige deja de poder
// leerse: a los dos días ya no se sabe si el producto se rompió o si la regla cambió.
//
//   · «EL CIERRE DICE QUÉ CUESTA LA COMISIÓN» — ya no, y a propósito. El costo son ahora dos
//     FILAS del capítulo II («Un administrador cobra el 20%» y «Te quedaría, con
//     administrador», con el sobrecosto en su sub). Repetirlo en prosa debajo de la tabla que
//     lo acaba de mostrar es la regla del repo al revés. Lo que sí se conserva —y se endurece
//     abajo— es que el cierre NO lo repita: eso lo vigila `fusion-gestion-flujo-catch-test`.
//   · «EL CASO QUE YA DELEGA SE ESCRIBE DESDE SU LADO» — esa asimetría vivía en las cuatro
//     redacciones de «qué cuesta», que se fueron enteras. El quiebre sí conserva su lado
//     («tu administrador tiene que estar consiguiéndote…») y eso se sigue midiendo.
//   · «EL HILO DEL LARGO SOLO CON SOBRE-RENTA NEGATIVA» — se mudó a `cierreLargoStr`, que
//     cierra el capítulo V y habla con LOS DOS signos. Su gate está en el tier de la fusión.
for (const s of salidas) {
  if (!/\d puntos de ocupación más/i.test(s.txt)) F(`3 · ${s.key}: el cierre no dice el PUNTO DE QUIEBRE`);
  if (!/a la misma tarifa/i.test(s.txt)) F(`3 · ${s.key}: falta la cláusula «a la misma tarifa» — sin ella el quiebre deja de ser verdadero si el administrador sube el ADR`);
  if (!/no lo medimos/i.test(s.txt)) F(`3 · ${s.key}: el cierre no declara que el beneficio NO está medido`);
  if (!/Pídele su ocupación de los últimos doce meses/i.test(s.txt)) F(`3 · ${s.key}: falta la pregunta que el usuario le hace al operador`);
}

// el caso de quien YA delega conserva SU lado en el quiebre: el condicional del auto
// («tendría que conseguirte») describe a un administrador que todavía no contrataste, y
// a quien ya delega hay que hablarle en presente.
const yaDelega = salidas[3];
if (!/tiene que estar consiguiéndote/i.test(yaDelega.txt)) F("3 · el caso en modo administrador no usa el presente de quien YA delega");
if (/tendría que conseguirte/i.test(yaDelega.txt)) F("3 · el caso en modo administrador usa el condicional del lado auto");

// y el hilo del largo NO puede volver acá: vive en `cierreLargoStr`, que cierra el capítulo V.
// Si reapareciera, el informe diría la comparación contra el largo dos veces y en dos unidades
// —que es exactamente lo que la fusión vino a arreglar—.
const HILO = /ni (?:autogestionado|delegado) el corto le gana al largo/i;
for (const s of salidas) {
  if (HILO.test(s.txt)) F(`3 · ${s.key}: el hilo del largo volvió al cierre del capítulo II; su lugar es \`cierreLargoStr\``);
}

// ── 4 · piso de cobertura: las cuatro redacciones salen distintas ───────────
const primeras = salidas.map((s) => s.txt.split(". ")[0]);
const unicas = new Set(primeras);
if (unicas.size !== 4) {
  F(`4 · PISO DE COBERTURA: las 4 redacciones produjeron ${unicas.size} aperturas distintas — alguna rama no se ejercitó`);
}

// ── 5 · el motor ya no emite una conclusión sobre delegar ──────────────────
{
  const vc: any = calcVeredictoComparativo({
    modoActual: "auto", tierZona: "media", ltrNoiMensual: 500000, strNoiMensual: 600000,
    sobreRenta: 100000, sobreRentaPct: 0.2, sobreRentaPctConfiable: true, breakEvenPctDelMercado: 0.8,
  });
  const llaves = Object.keys(vc.flipGestion ?? {});
  for (const k of ["cambiaVeredicto", "recomendacionAuto", "recomendacionAdmin"]) {
    if (llaves.includes(k)) F(`5 · el motor todavía emite \`flipGestion.${k}\``);
  }
  if (!llaves.includes("modoActual")) F("5 · `flipGestion.modoActual` se perdió, y tiene lectores vivos");
}

// ── reporte ────────────────────────
export function runGestionSinVeredictoTier(): { hard: number } {
  console.log("\n─── TIER GESTIÓN-SIN-VEREDICTO (el informe no toma posición sobre delegar · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log(`  ✓ VERDE — el quiebre empata por identidad en los ${CASOS.length} casos, ninguna redacción emite veredicto, las cuatro dicen quiebre + «a la misma tarifa» + «no lo medimos», el modo administrador va en presente, el hilo del largo no volvió al capítulo II, y el motor ya no emite conclusión`);
  } else {
    for (const m of fallas) console.log(`  ✗ ${m}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runGestionSinVeredictoTier();
  process.exit(hard ? 1 : 0);
}
