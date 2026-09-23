// ─────────────────────────────────────────────────────────────────────────────
// TIER PLANILLA-CÁLCULO (23-sep-2026) · «Cómo se calcula», mockup aprobado
// (docs/wireframes/rediseno-informe/planilla-como-se-calcula.html). Fija:
//   1 · LA VENTA NO EXISTE EN LA PLANILLA: ninguno de los dos modales lee el valor de venta, el
//       saldo ni la comisión, ni monta la fila de dato, la barra o «Escenario de salida». Queda la
//       fila que remite a «Tu resultado» (renderizada: lo que te queda y el enlace).
//   2 · EL CASH ON CASH LEE EL CAMPO DEL MOTOR: sobre las seeds golden, `capitalCashOnCash` existe,
//       suma sus tres sumandos, y flujo anual ÷ ese total da `cashOnCash`; PISO: alguna seed tiene
//       corretaje, así que el denominador viejo (`inversionInicial`) NO lo daría. Y la cuenta del
//       modal LTR divide por ese campo; la del STR por `capitalInvertido`, el de su motor.
//   3 · VACANCIA Y ENTREGA SALEN DEL DATO: las funciones de texto dicen la vacancia, la entrega y
//       la comisión que reciben (y no la constante), y los modales se las pasan desde el input; ni
//       «0,6 mes» ni «Entrega inmediata» ni «comisión de plataforma 3%» escritos en un modal.
//   4 · LA MONEDA SIGUE EL TOGGLE: en UF ningún monto lleva «$» (render de la tabla y de la fila
//       que remite); pesos exactos en escritorio y millones con el aviso en teléfono; los modales
//       formatean con la moneda que reciben y los dos padres les pasan `currency`.
//   5 · EL PIE STR CITA LA REFERENCIA DE LA ZONA (`referenciaCapRateStr`), como el hero, no la
//       constante del umbral.
//   6 · SALE EL CSS MUERTO de la planilla vieja, y el título de bloque deja el rojo.
// Lo del DOM (tres filas × 390/350/1100 × temas × monedas) lo mide `planilla-calculo-sonda.ts`.
// Verificado EN ROJO por mutación. Corre solo: node --import tsx scripts/eval/golden/planilla-calculo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runAnalysis } from "../../../src/lib/analysis";
import { metricaValorONull, type AnalisisInput } from "../../../src/lib/types";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import { montoCelda, montoCuenta, bajadaFlujoLtr, bajadaFlujoStr, fuenteFlujoLtr, fuenteFlujoStr } from "../../../src/lib/planilla-calculo";
import { TablaFlujo, RemiteResultado } from "../../../src/components/analysis/shared/PlanillaCalculo";

// El JSX de los componentes compila a React.createElement bajo tsx: el global lo resuelve.
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
/** El elemento JSX `<Tag …/>` que contiene `marca`, o "" si no está. Con el formato del repo: en
 *  una línea termina en `/>`; en varias, en la primera línea que es solo `/>` (así no lo corta el
 *  `/>` de un hijo, como el `<GlosaIndicador … />` del nombre). */
const elemento = (src: string, tag: string, marca: RegExp): string => {
  for (const m of src.matchAll(new RegExp(`<${tag}\\b`, "g"))) {
    const resto = src.slice(m.index!);
    const l1 = resto.split("\n")[0];
    const el = /\/>\s*$/.test(l1) ? l1 : resto.slice(0, resto.search(/\n\s*\/>\s*\n/) + 1);
    if (marca.test(el)) return el;
  }
  return "";
};

export function runPlanillaCalculoTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n─── TIER PLANILLA-CÁLCULO («Cómo se calcula» del mockup aprobado · 0 tokens) ───");
  const LTR = sinComentarios(leer("src/components/analysis/ModalCalculo.tsx"));
  const STR = sinComentarios(leer("src/components/analysis/str/ModalCalculoStr.tsx"));
  const modales = [["LTR", LTR], ["STR", STR]] as const;
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
  const filas = [
    { anio: 1, mesesEntrega: 1, entra: 610126, gastos: 3620694, cuota: 609203, flujo: -3619771 },
    { anio: 2, entra: 7577767, gastos: 2541137, cuota: 7529749, flujo: -2493119 },
  ];

  // ── 1 · la venta no existe en la planilla ──
  for (const [k, s] of modales) {
    const v = s.match(/\b(valorVenta|saldoCredito\w*|comisionVenta|gastosCierre|FilasDato|FilaDato|firme|amortizacion|plusvaliaNeta)\b|className="(?:kv|compo)|Escenario de salida|Tu parte/);
    if (v) F(`1 · la planilla ${k} todavía arma la venta (${v[0]})`);
    if (!/<RemiteResultado\b[^>]*equity=\{exit\.equityCLP\}[^>]*onVerResultado=\{onVerResultado\}/.test(s)) F(`1 · la planilla ${k} no monta la fila que remite con lo que te queda y el enlace`);
  }
  const remite = html(createElement(RemiteResultado, { anios: 10, equity: 104039128, conSobreprecio: true, moneda: "CLP", valorUF: 40000, onVerResultado: () => {} }));
  if (!/Si vendes el año 10, te queda/.test(remite) || !/\$104\.039\.128/.test(remite) || !/sobreprecio de hoy/.test(remite) || !/<button[^>]*>El desglose, en «Tu resultado a 10 años» →/.test(remite)) F("1 · la fila que remite no dice lo que te queda ni lleva el enlace");
  if (/saldo|Tu parte/i.test(remite)) F("1 · la fila que remite desglosa la venta");

  // ── 2 · el cash on cash lee el campo del motor ──
  let conCorretaje = 0, medidas = 0;
  // Cada seed, y además con el corretaje de compra encendido: con él, el denominador viejo
  // (`inversionInicial`, que lo suma) y el del motor se separan.
  const casos = GOLDEN_SEEDS.flatMap((seed) => [
    { id: seed.key, mediana: seed.mediana, input: seed.input as AnalisisInput },
    { id: `${seed.key}+corretaje`, mediana: seed.mediana, input: { ...(seed.input as AnalisisInput), incluyeCorretajeInicial: true } },
  ]);
  for (const seed of casos) {
    const r = runAnalysis(seed.input, GOLDEN_UF, seed.mediana, GOLDEN_ASOF);
    const c = r.metrics.capitalCashOnCash;
    if (!c) { F(`2 · ${seed.id}: el motor no emite capitalCashOnCash`); continue; }
    if (Math.abs(c.pieCLP + c.gastosCompraCLP + c.capexCLP - c.totalCLP) > 1) F(`2 · ${seed.id}: capitalCashOnCash no suma sus sumandos`);
    const coc = metricaValorONull(r.metrics.cashOnCash);
    if (coc == null) continue;
    medidas++;
    const cuenta = ((r.metrics.flujoNetoMensual * 12) / c.totalCLP) * 100;
    if (Math.abs(cuenta - coc) > 0.006) F(`2 · ${seed.id}: flujo anual ÷ capitalCashOnCash da ${cuenta.toFixed(2)}, no el ${coc}`);
    if ((r.metrics.corretajeInicialCLP ?? 0) > 0 && r.exitScenario && Math.abs(r.exitScenario.inversionInicial - c.totalCLP) > 1) conCorretaje++;
  }
  if (!medidas) F("2 · PISO · ninguna seed tiene cash on cash: la cuenta no se midió");
  if (!conCorretaje) F("2 · PISO · ninguna seed tiene corretaje: el denominador viejo daría lo mismo y el chequeo no distingue");
  if (!/const capCoc = metrics\.capitalCashOnCash;/.test(LTR)) F("2 · el modal LTR no lee capitalCashOnCash");
  const cocLtr = elemento(LTR, "Indicador", /Cash on cash/);
  if (!/cuenta=\{[^}]*\$\{P\(flujoAnual0\)\} ÷ \$\{P\(capCoc\.totalCLP\)\}/.test(cocLtr) || /inversion/i.test(cocLtr)) F("2 · la cuenta del cash on cash LTR no divide por el campo del motor");
  if (!/resultado=\{coc != null \? pct2\(coc\)/.test(cocLtr) || !/const coc = metricaValorONull\(metrics\.cashOnCash\);/.test(LTR)) F("2 · el resultado del cash on cash LTR no es el del motor");
  const cocStr = elemento(STR, "Indicador", /Cash on cash/);
  if (!/const capitalCoc = results\.capitalInvertido;/.test(STR) || !/\$\{P\(base\.flujoCajaMensual \* 12\)\} ÷ \$\{P\(capitalCoc\)\}/.test(cocStr) || /inversion/i.test(cocStr)) F("2 · la cuenta del cash on cash STR no divide por capitalInvertido");
  if (!/const coc = metricaValorONull\(base\.cashOnCash\);/.test(STR) || !/resultado=\{coc != null \? pct2\(coc \* 100\)/.test(cocStr)) F("2 · el resultado del cash on cash STR no es el del motor");

  // ── 3 · vacancia, entrega y comisión salen del dato ──
  if (!/vacancia de 1,2 meses al año/.test(fuenteFlujoLtr({ vacanciaMeses: 1.2 })) || !/vacancia de 1 mes al año/.test(fuenteFlujoLtr({ vacanciaMeses: 1 }))) F("3 · la fuente LTR no dice la vacancia que recibe");
  if (/0,6/.test(fuenteFlujoLtr({ vacanciaMeses: 1.2 }))) F("3 · la fuente LTR dice la vacancia fija");
  if (!/administración 7% del arriendo/.test(fuenteFlujoLtr({ vacanciaMeses: 1, usaAdministrador: true, comisionAdministradorPct: 7 })) || /administración/.test(fuenteFlujoLtr({ vacanciaMeses: 1 }))) F("3 · la fuente LTR no sigue a la administración");
  if (!/agosto de 2028: los primeros 2 años no hay arriendo/.test(bajadaFlujoLtr({ aniosSinArriendo: 2, fechaEntrega: "2028-8" }))) F("3 · la bajada LTR no dice la entrega");
  const ent = bajadaFlujoStr({ primerAnioOperativo: 1, mesesPrimerAnio: 1, fechaEntrega: "2027-8" });
  if (!/se entrega en agosto de 2027: el año 1 opera 1 mes/.test(ent) || /inmediata/.test(ent)) F("3 · la bajada STR no dice la entrega futura");
  if (!/^Entrega inmediata/.test(bajadaFlujoStr({ primerAnioOperativo: 1, mesesPrimerAnio: 12 }))) F("3 · la bajada STR no dice la entrega inmediata cuando lo es");
  if (!/administrador 25% del ingreso, en vez de la comisión de plataforma/.test(fuenteFlujoStr({ comisionAdministradorPct: 25, estabilizacion: "$1", amoblamiento: null }))) F("3 · la fuente STR no nombra al administrador");
  if (!/comisión de plataforma 3% del ingreso/.test(fuenteFlujoStr({ comisionAdministradorPct: null, estabilizacion: "$1", amoblamiento: null }))) F("3 · la fuente STR en autogestión no dice la comisión de plataforma");
  if (!/amoblamiento \$2 el año de la entrega/.test(fuenteFlujoStr({ comisionAdministradorPct: null, estabilizacion: "$1", amoblamiento: "$2" }))) F("3 · la fuente STR no suma el amoblamiento de la entrega");
  for (const [k, s] of modales) {
    const lit = s.match(/0,6 mes|Entrega inmediata|comisión de plataforma 3%|vacancia y rotación =/);
    if (lit) F(`3 · el modal ${k} escribe a mano «${lit[0]}»`);
  }
  if (!/fuenteFlujoLtr\(\{\s*vacanciaMeses: inputData\?\.vacanciaMeses \?\? 0,\s*usaAdministrador: inputData\?\.usaAdministrador,/.test(LTR)) F("3 · el modal LTR no le pasa la vacancia y la administración del input");
  if (!/bajadaFlujoLtr\(\{ aniosSinArriendo: preEntregaAnios, fechaEntrega: inputData\?\.fechaEntrega \}\)/.test(LTR)) F("3 · el modal LTR no le pasa la entrega del dato");
  if (!/const fechaEntrega = typeof inputData\?\.fechaEntrega === "string" \? inputData\.fechaEntrega : null;/.test(STR) || !/bajadaFlujoStr\(\{ primerAnioOperativo: primerOp\?\.year \?\? 1, mesesPrimerAnio: mesesPrimerOp, fechaEntrega \}\)/.test(STR)) F("3 · el modal STR no le pasa la entrega del dato");
  if (!/const mesesPrimerOp = primerOp\?\.mesesOperativos \?\? 12;/.test(STR)) F("3 · el modal STR no lee los meses operativos del motor");
  if (!/const conAdmin = inputData\?\.modoGestion === "administrador";/.test(STR) || !/fuenteFlujoStr\(\{ comisionAdministradorPct: comisionAdminPct,/.test(STR)) F("3 · el modal STR no le pasa la comisión según quién opera");

  // ── 4 · la moneda sigue el toggle ──
  if (montoCelda(6_000_000, "CLP", 40000, false) !== "6.000.000" || montoCelda(-4_291_260, "CLP", 40000, true) !== "−4,3") F("4 · la celda en pesos no es exacta en escritorio o millones en teléfono");
  if (montoCelda(6_000_000, "UF", 40000, false) !== "150,0" || montoCelda(6_000_000, "UF", 40000, true) !== "150") F("4 · la celda en UF no sigue la forma");
  if (montoCuenta(6_000_000, "UF", 40000) !== "UF 150,0" || montoCuenta(-6_000_000, "CLP", 40000) !== "−$6.000.000") F("4 · el monto de una cuenta no sigue la moneda");
  const tel = html(createElement(TablaFlujo, { filas, moneda: "CLP", valorUF: 40000, compacto: true }));
  const esc = html(createElement(TablaFlujo, { filas, moneda: "CLP", valorUF: 40000, compacto: false }));
  const uf = html(createElement(TablaFlujo, { filas, moneda: "UF", valorUF: 40000, compacto: true }));
  if (!/Millones de pesos de cada año/.test(tel) || !/Redondeado a cien mil pesos: una fila puede no sumar por una décima/.test(tel) || !/>−3,6</.test(tel)) F("4 · en teléfono la tabla no va en millones con el redondeo avisado");
  if (!/Pesos de cada año/.test(esc) || /no sumar/.test(esc) || !/>−3\.620\.694</.test(esc)) F("4 · en escritorio la tabla no va en pesos exactos sin aviso");
  if (!/UF de cada año, sin decimales/.test(uf) || !/En UF sin decimales/.test(uf) || uf.includes("$")) F("4 · en UF la tabla lleva pesos");
  if ((tel.match(/<th>/g) ?? []).length !== 5) F("4 · la tabla no tiene cinco columnas");
  if (!/<tr class="ent"><td>1<small>entrega · 1 mes<\/small>/.test(esc)) F("4 · el año de entrega no se marca con su mes");
  if (html(createElement(RemiteResultado, { anios: 10, equity: 1e8, conSobreprecio: false, moneda: "UF", valorUF: 40000 })).includes("$")) F("4 · la fila que remite en UF lleva pesos");
  for (const [k, s] of modales) {
    if (!/const P = \(n: number\) => montoCuenta\(n, currency, valorUF\);/.test(s)) F(`4 · el modal ${k} no formatea con la moneda que recibe`);
    if (!/<TablaFlujo filas=\{filas\} moneda=\{currency\} valorUF=\{valorUF\} compacto=\{compacto\} \/>/.test(s) || !/const compacto = useEsHoja\(\);/.test(s)) F(`4 · la tabla del modal ${k} no recibe la moneda o la forma`);
    if (!/<RemiteResultado\b[^>]*moneda=\{currency\}/.test(s)) F(`4 · la fila que remite del modal ${k} no recibe la moneda`);
    const suelto = s.match(/`[^`]*\$\$\{|(?<!Math\.round\(valorUF\)\.)toLocaleString\("es-CL"\)/);
    if (suelto) F(`4 · el modal ${k} formatea un monto por fuera de la moneda (${suelto[0].slice(0, 30)})`);
  }
  const padres = [
    ["LTR", "src/components/analysis/SubjectCardGrid.tsx", "ModalCalculo"],
    ["STR", "src/app/analisis/renta-corta/[id]/results-client.tsx", "ModalCalculoStr"],
  ] as const;
  for (const [k, p, tag] of padres) {
    const e = elemento(sinComentarios(leer(p)), tag, /abierto=\{calculoAbierto\}/);
    if (!e) { F(`4 · no se encontró el ${tag} montado en ${p}`); continue; }
    if (!/currency=\{currency\}/.test(e)) F(`4 · el padre ${k} no le pasa la moneda a la planilla`);
    if (!/onVerResultado=\{\(\) => \{\s*setCalculoAbierto\(false\);\s*abrirCapitulo\("resultado"\);/.test(e)) F(`4 · el enlace de la planilla ${k} no cierra y abre «Tu resultado»`);
  }

  // ── 5 · el pie STR cita la referencia de la zona ──
  if (!/const ref = referenciaCapRateStr\(results\.hallazgos\);/.test(STR) || !/ref\.hayRef \? `referencia de la zona \$\{pct1\(ref\.pct\)\}`/.test(STR)) F("5 · el pie STR no cita la referencia de la zona");
  if (/CAP_STR_UMBRAL_PCT|umbral de renta corta/.test(STR)) F("5 · el pie STR vuelve a la constante del umbral");

  // ── 6 · el CSS muerto sale ──
  const P = leer("src/components/analysis/portada/PortadaInforme.tsx");
  const T = leer("src/components/analysis/shared/TokensShared.tsx");
  const muerto = P.match(/\.(?:calc-tbl|ind-tbl|m-tblwrap|m-scrollcue)\b|\.kv\{|\.compo\{|\.compo-leg\{display:flex/);
  if (muerto) F(`6 · queda CSS de la planilla vieja en PortadaInforme (${muerto[0]})`);
  if (/\.pl\.ind\b/.test(T)) F("6 · queda la variante de indicadores de la planilla vieja en TokensShared");
  if (/\.m-block \.bt\{[^}]*signal-red/.test(P) || /\.m-block \.bq\{[^}]*font-heading/.test(P)) F("6 · el título de bloque sigue en rojo o la bajada en serif");
  if (/\{b\.letra\}|letra:/.test(sinComentarios(leer("src/components/analysis/shared/ModalCalculoBase.tsx")) + LTR + STR)) F("6 · los bloques siguen con letra");

  if (fallas.length) {
    console.log(`  ✗ PLANILLA-CÁLCULO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log(`  ✓ VERDE — sin la venta en la planilla (remite a «Tu resultado»), el cash on cash con el denominador del motor (${medidas} seeds, ${conCorretaje} con corretaje), vacancia, entrega y comisión desde el dato, la moneda del toggle con la forma de cada ancho, el pie STR con la referencia de la zona y el CSS viejo fuera`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPlanillaCalculoTier();
  process.exit(hard ? 1 : 0);
}
