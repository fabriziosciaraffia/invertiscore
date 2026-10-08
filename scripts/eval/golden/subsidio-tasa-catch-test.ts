// ============================================================================
// GOLDEN · SUBSIDIO A LA TASA — catch-test (08-oct-2026). 0 tokens, sin base.
// ============================================================================
// Ley 21.836 (Diario Oficial, 17-ago-2026), que amplía la 21.748: vivienda nueva en primera
// venta hasta UF 6.000, para solicitar hasta el 31-may-2028, rebaja de hasta 60 puntos base.
//
// FIJA:
//   1 · RESUMEN, TIPO: de nuevo con la tasa del subsidio a usado, la tasa vuelve a mercado DE
//       VERDAD —en las respuestas y en el payload— y la nota lo dice. Una tasa pre-aprobada no se
//       toca. El resumen aplica el parche que arma `cambioConSubsidio`, y ningún otro.
//       (Hasta el 08-oct-2026 la nota decía «volví la tasa a mercado» y la tasa seguía en 3,44.)
//   2 · RESUMEN, PRECIO: sobre UF 6.000, lo mismo, con aviso; 6.000 exactas siguen calificando.
//   3 · PRECARGA DEL PACK: la tasa con subsidio del informe de origen no se copia; el depto
//       siguiente pasa por la pantalla de tasa —y solo por ella: pie, plazo y modalidad siguen
//       precargados— y arranca en mercado si no califica. La compuerta es la del motor.
//   4 · EL COPY DEL WIZARD: todo texto que nombra el subsidio dice «vivienda nueva en primera
//       venta hasta UF 6.000, hasta mayo de 2028» y cita la Ley 21.836; la rebaja se dice como
//       referencia («usamos 0,6 puntos como referencia»), nunca como «la mínima».
//   5 · EL INFORME: con la tasa del subsidio, LTR y STR dicen una línea junto a la tasa; sin
//       ella —mercado, o un usado—, nada.
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/subsidio-tasa-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WizardV4Answers } from "../../../src/components/formulario-v4/wizardV4Nodes";
import type { SubmitContext } from "../../../src/components/formulario-v4/wizardV4Submit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
// Los componentes del wizard importan CSS; en node se carga como módulo vacío.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).extensions[".css"] = (m: any) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** El cuerpo de la función que empieza en `inicio`, contando llaves desde la primera `{`. Vacío si no está. */
function cuerpoDe(src: string, inicio: string): string {
  const i = src.indexOf(inicio);
  if (i < 0) return "";
  const a = src.indexOf("{", i);
  if (a < 0) return "";
  let prof = 0;
  for (let j = a; j < src.length; j++) {
    if (src[j] === "{") prof++;
    else if (src[j] === "}" && --prof === 0) return src.slice(i, j + 1);
  }
  return "";
}

/** Lo que dice la ley, en las palabras del goal: el gate fija el texto, no lo deriva. */
const CONDICION = "vivienda nueva en primera venta hasta UF 6.000, hasta mayo de 2028";
const LEY = "Ley 21.836";
const LINEA_INFORME = "Tasa con subsidio estatal: vivienda nueva hasta UF 6.000, rige hasta mayo de 2028. Tú ves si calificas.";

const UF = 40000;
const MERCADO = 4.04;
const CTX: SubmitContext = {
  ufCLP: UF, tasaMercado: MERCADO, arriendoSugerido: 757000, arriendoN: 20, arriendoFuente: "radio",
  arriendoRango: null, precioM2UF: 80, radiusUsed: 1000, ggccSugerido: 99000,
  ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 1000,
};
const USADO: WizardV4Answers = {
  direccion: "Av. Irarrázaval 2100, Ñuñoa", direccionConfirmada: "Av. Irarrázaval 2100, Ñuñoa",
  comuna: "Ñuñoa", ciudad: "Santiago", lat: -33.45, lng: -70.6, tipoPropiedad: "usado", antiguedad: "11-20",
  superficieUtil: "55", dormitorios: "2", banos: "1", precio: "5500", pieMonto: "20", pieUnidad: "pct",
  plazoCredito: "25", tasaInteres: "4,04", tasaModo: "estimada", modalidad: "ltr", arrModo: "estimacion", arriendo: "757000",
};
/** Nuevo de UF 5.500 con la tasa que ofrece la opción «Con subsidio» (4,04 − 0,6). */
const NUEVO_SUB: WizardV4Answers = { ...USADO, tipoPropiedad: "nuevo", antiguedad: undefined, estadoVenta: "inmediata", tasaInteres: "3,44" };

function dataMock() {
  return {
    ufCLP: UF, tasaMercado: MERCADO, comparables: [], restoRadio: [], suggestionsLoading: false,
    arriendoSugerido: 757000, arriendoN: 20, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null,
    ggccSugerido: 99000, precioM2UF: 80, radiusUsed: 1000, ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 1000,
    airRoi: { ingresoBrutoMensual: 666000, ocupacionReferencia: 0.44, sampleSize: 40, source: "comparables", isLoading: false, error: null },
  };
}
const noop = () => {};

export function runSubsidioTasaTier(): { hard: number } {
  console.log("\n─── TIER SUBSIDIO-TASA (un usado nunca con tasa rebajada; ley, vencimiento e informe · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  /* eslint-disable @typescript-eslint/no-var-requires */
  const S = require("../../../src/components/formulario-v4/wizardV4Subsidio");
  const K = require("../../../src/lib/constants/subsidio");
  const { buildLtrPayload, buildStrPayload } = require("../../../src/components/formulario-v4/wizardV4Submit");
  const { computeNext, computePlannedPath, reactionText } = require("../../../src/components/formulario-v4/wizardV4Nodes");
  const { precargaDesdeInforme } = require("../../../src/lib/lo-que-sigue/precarga");
  const P = require("../../../src/lib/lo-que-sigue/precarga");
  const A2 = require("../../../src/components/formulario-v4/screensActo2");
  const { ResumenScreen } = require("../../../src/components/formulario-v4/screenResumen");
  const { runAnalysis } = require("../../../src/lib/analysis");
  const { FilaDato } = require("../../../src/components/analysis/shared/FilaDato");
  /* eslint-enable @typescript-eslint/no-var-requires */
  let LS: { conLineaSubsidio?: (base: string, st: unknown) => React.ReactNode } = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    LS = require("../../../src/components/analysis/shared/LineaSubsidio");
  } catch {
    F("5 · no existe `LineaSubsidio`: el informe no tiene con qué decir la línea del subsidio");
  }

  const asOf = new Date("2026-10-08T12:00:00Z");
  const motorLtr = (a: WizardV4Answers) => runAnalysis(buildLtrPayload(a, CTX), UF, undefined, asOf);
  const cambio = typeof S.cambioConSubsidio === "function" ? S.cambioConSubsidio : null;
  if (!cambio) F("1 · no existe `cambioConSubsidio`: el resumen cambia tipo y precio sin mirar la tasa");
  const res = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));

  // ── 1 · RESUMEN, TIPO ──────────────────────────────────────────────────────
  if (cambio) {
    const r = cambio(NUEVO_SUB, { tipoPropiedad: "usado" }, MERCADO, "tipo");
    const despues = { ...NUEVO_SUB, ...r.patch } as WizardV4Answers;
    if (despues.tipoPropiedad !== "usado") F("1 · el parche no lleva el cambio de tipo");
    if (despues.tasaInteres !== "4,04" || despues.tasaModo !== "estimada") F(`1 · de nuevo con subsidio a usado, la tasa queda en ${despues.tasaInteres} (${despues.tasaModo})`);
    if (buildLtrPayload(despues, CTX).tasaInteres !== MERCADO || buildStrPayload({ ...despues, modalidad: "str" }, CTX).tasaInteres !== MERCADO) F("1 · el usado llega al motor con una tasa que no es la de mercado");
    if (!/volví la tasa a mercado, 4,04%/.test(r.nota ?? "")) F(`1 · la nota no dice que la tasa volvió a mercado: «${r.nota}»`);
    const pre = cambio({ ...NUEVO_SUB, tasaModo: "preaprobada", tasaInteres: "3,5" }, { tipoPropiedad: "usado" }, MERCADO, "tipo");
    if ("tasaInteres" in pre.patch || "tasaModo" in pre.patch) F("1 · una tasa pre-aprobada se pisa al cambiar a usado");
    if (!/Tu tasa no cambia/.test(pre.nota ?? "")) F("1 · con la pre-aprobada, la nota no dice que la tasa sigue");
    const mer = cambio({ ...NUEVO_SUB, tasaInteres: "4,04" }, { tipoPropiedad: "usado" }, MERCADO, "tipo");
    if ("tasaInteres" in mer.patch) F("1 · en mercado igual se reescribe la tasa");
    const entra = cambio(USADO, { tipoPropiedad: "nuevo" }, MERCADO, "tipo");
    if ("tasaInteres" in entra.patch || !/Revisa la opción en la tasa/.test(entra.nota ?? "")) F("1 · de usado a nuevo no ofrece revisar la tasa, o la toca");
    const igual = cambio(USADO, { tipoPropiedad: "usado" }, MERCADO, "tipo");
    if (igual.nota !== null || Object.keys(igual.patch).length !== 1) F("1 · sin cambio de calificación igual hay nota o parche de más");
  }
  const onTipo = cuerpoDe(res, "const onTipoChange");
  if (!onTipo) F("1 · no encuentro `onTipoChange` en el resumen: el tier no lo mide");
  else {
    if (!/const r = cambioConSubsidio\(a, \{ tipoPropiedad: nuevo \}, data\.tasaMercado, "tipo"\);/.test(onTipo)) F("1 · el resumen no arma el cambio de tipo con `cambioConSubsidio`");
    if (!/w\.patchAnswers\(r\.patch\);/.test(onTipo) || (onTipo.match(/patchAnswers\(/g) ?? []).length !== 1) F("1 · el resumen cambia el tipo con otro parche que el de `cambioConSubsidio`");
    if (!/if \(r\.nota\) \{\s*setCascade\(\(c\) => \(\{ \.\.\.c, "02": r\.nota \?\? "" \}\)\);/.test(onTipo)) F("1 · la nota del tipo no llega a «Cómo lo financias»");
  }

  // ── 2 · RESUMEN, PRECIO ────────────────────────────────────────────────────
  if (cambio) {
    const r = cambio(NUEVO_SUB, { precio: "6500" }, MERCADO, "precio");
    const despues = { ...NUEVO_SUB, ...r.patch } as WizardV4Answers;
    if (despues.precio !== "6500") F("2 · el parche no lleva el precio nuevo");
    if (despues.tasaInteres !== "4,04" || despues.tasaModo !== "estimada") F(`2 · sobre UF 6.000 la tasa queda en ${despues.tasaInteres}`);
    if (buildLtrPayload(despues, CTX).tasaInteres !== MERCADO) F("2 · el nuevo de UF 6.500 llega al motor con la tasa del subsidio");
    if (!/^Con ese precio ya no entra al subsidio a la tasa/.test(r.nota ?? "") || !/volví la tasa a mercado, 4,04%/.test(r.nota ?? "")) F(`2 · sobre UF 6.000 la nota no avisa: «${r.nota}»`);
    const borde = cambio(NUEVO_SUB, { precio: "6000" }, MERCADO, "precio");
    if ("tasaInteres" in borde.patch || borde.nota !== null) F("2 · UF 6.000 exactas pierden el subsidio (el techo es inclusivo)");
    const baja = cambio({ ...NUEVO_SUB, precio: "6500", tasaInteres: "4,04" }, { precio: "5500" }, MERCADO, "precio");
    if (!/^Con ese precio puede entrar al subsidio a la tasa/.test(baja.nota ?? "")) F("2 · al bajar del techo no ofrece revisar la tasa");
  }
  const commitPrecio = cuerpoDe(res, "const commitPrecio");
  if (!commitPrecio) F("2 · no encuentro `commitPrecio` en el resumen: el precio se edita sin mirar la tasa");
  else {
    if (!/const r = cambioConSubsidio\(a, \{ precio: v \}, data\.tasaMercado, "precio"\);/.test(commitPrecio)) F("2 · el precio no se arma con `cambioConSubsidio`");
    if (!/commitEdit\("precio", r\.patch\);/.test(commitPrecio)) F("2 · el precio se guarda sin el parche del subsidio");
    if (!/if \(r\.nota\) \{\s*setCascade\(\(c\) => \(\{ \.\.\.c, "02": r\.nota \?\? "" \}\)\);/.test(commitPrecio)) F("2 · el aviso del precio no llega a «Cómo lo financias»");
  }
  if (!/onCommit=\{\(v\) => commitPrecio\(v\)\}/.test(res) || /commitEdit\("precio", \{ precio: v \}\)/.test(res)) F("2 · la fila del precio guarda directo, sin `commitPrecio`");

  // ── 3 · PRECARGA DEL PACK ──────────────────────────────────────────────────
  {
    const sinFinanciamiento: WizardV4Answers = { ...USADO, pieMonto: undefined, pieUnidad: undefined, plazoCredito: undefined, tasaInteres: undefined, tasaModo: undefined, modalidad: undefined };
    const origenLtr = buildLtrPayload(NUEVO_SUB, CTX);
    const pre = precargaDesdeInforme(origenLtr, "long-term");
    if ("tasaInteres" in pre || "tasaModo" in pre) F(`3 · la precarga copia la tasa con subsidio del informe de origen (${pre.tasaInteres})`);
    if (pre.financiamientoPrecargado !== true || pre.pieMonto !== "20" || pre.plazoCredito !== "25" || pre.modalidad !== "ltr") F("3 · sin la tasa, la precarga deja de traer pie, plazo y modalidad");
    const sig = { ...sinFinanciamiento, ...pre } as WizardV4Answers;
    if (computeNext("precio", sig) !== "tasa") F(`3 · el depto siguiente no pasa por la pantalla de tasa (va a «${computeNext("precio", sig)}»)`);
    const plan = computePlannedPath(sig) as string[];
    if (plan.includes("pie") || plan.includes("plazo") || plan.includes("mod") || plan[plan.indexOf("tasa") + 1] !== "arr") F(`3 · el camino planificado no es precio → tasa → arriendo: ${plan.join(" → ")}`);
    const tasaHtml = renderToStaticMarkup(createElement(A2.TasaScreen, { answers: sig, data: dataMock(), patchAnswers: noop, answer: noop, goDetour: noop }));
    if (/Con subsidio/.test(tasaHtml) || !/4,04/.test(tasaHtml)) F("3 · el usado siguiente no arranca en la tasa de mercado");
    for (const nodo of ["tasa", "tasaFix"]) {
      if (computeNext(nodo, { ...sig, tasaInteres: "4,04", tasaModo: "estimada" }) !== "arr") F(`3 · después de «${nodo}» no vuelve a la renta (pregunta lo precargado)`);
    }
    const preStr = precargaDesdeInforme(buildStrPayload({ ...NUEVO_SUB, modalidad: "str" }, CTX), "short-term");
    if ("tasaInteres" in preStr) F("3 · la precarga de renta corta copia la tasa con subsidio");
    const sigStr = { ...sinFinanciamiento, ...preStr } as WizardV4Answers;
    if (computeNext("precio", sigStr) !== "tasa" || computeNext("tasa", { ...sigStr, tasaInteres: "4,04" }) !== "adr") F("3 · en renta corta no pasa por la tasa y vuelve a la tarifa");
    // Lo de siempre sigue igual: sin subsidio en el origen, la tasa viaja y el wizard salta a la renta.
    for (const [nombre, origen] of [["usado en mercado", USADO], ["nuevo en mercado", { ...NUEVO_SUB, tasaInteres: "4,04" }]] as const) {
      const p = precargaDesdeInforme(buildLtrPayload(origen, CTX), "long-term");
      if (p.tasaInteres !== "4,04" || computeNext("precio", { ...sinFinanciamiento, ...p }) !== "arr") F(`3 · ${nombre}: la precarga dejó de traer la tasa o de saltar a la renta`);
    }
    // La compuerta es la del motor: «tasa con subsidio» en la precarga ≡ `subsidioTasa.aplicado`.
    if (typeof P.origenConTasaSubsidio !== "function") F("3 · no existe `origenConTasaSubsidio`: la precarga no sabe qué tasa es con subsidio");
    else {
      for (const a of [NUEVO_SUB, { ...NUEVO_SUB, tasaInteres: "4,04" }, { ...NUEVO_SUB, tasaInteres: "3,5", tasaModo: "preaprobada" as const }, { ...NUEVO_SUB, precio: "6500" }, { ...USADO, tasaInteres: "3,44" }]) {
        const payload = buildLtrPayload(a, CTX);
        const motor = motorLtr(a).metrics.subsidioTasa?.aplicado === true;
        if (P.origenConTasaSubsidio(payload, "long-term") !== motor) F(`3 · la precarga y el motor no coinciden en «con subsidio» (${a.tipoPropiedad}, UF ${a.precio}, ${a.tasaInteres}%)`);
      }
    }
  }

  // ── 4 · EL COPY DEL WIZARD ─────────────────────────────────────────────────
  {
    const dice = (t: string) => t.includes(CONDICION) && t.includes(LEY);
    const tasaHtml = renderToStaticMarkup(createElement(A2.TasaScreen, { answers: { ...NUEVO_SUB, tasaInteres: undefined }, data: dataMock(), patchAnswers: noop, answer: noop, goDetour: noop }));
    if (!/Con subsidio/.test(tasaHtml)) F("4 · el nuevo de UF 5.500 no ve la opción con subsidio (el tier no mide el copy)");
    else {
      if (!dice(tasaHtml)) F("4 · la opción con subsidio no dice la condición, el vencimiento y la Ley 21.836");
      if (!tasaHtml.includes("La rebaja exacta la fija tu banco; usamos 0,6 puntos como referencia.")) F("4 · la opción con subsidio no dice la rebaja como referencia");
      if (!/aria-label="[^"]*usamos 0,6 puntos como referencia[^"]*"/.test(tasaHtml)) F("4 · el aria-label de la opción sigue con la rebaja vieja");
    }
    const aviso = reactionText("tam", { ...NUEVO_SUB }, { subsidioAviso: true }) ?? "";
    if (!dice(aviso)) F(`4 · el aviso anticipado no dice la condición y la ley: «${aviso}»`);
    const r02 = renderToStaticMarkup(createElement(ResumenScreen, {
      w: { nav: { answers: NUEVO_SUB }, patchAnswers: noop },
      data: dataMock(), tier: { tier: "guest", anonCapAvailable: true }, isLoggedIn: false, onTerminal: noop, cardInicial: "02",
    }));
    if (!/Subsidio 3,44%/.test(r02)) F("4 · el resumen no muestra la tasa con subsidio");
    // La fuente de la fila solo se dibuja con la fila abierta (estado del componente, que el render
    // estático no abre): se lee la prop, con las dos constantes que el punto de abajo fija.
    if (!/fuente=\{conSubsidio \? `Subsidio estatal a la tasa \(\$\{LEY_SUBSIDIO\}\): \$\{CONDICION_SUBSIDIO\}\.` : undefined\}/.test(res)) F("4 · la fuente de la tasa en el resumen no dice la condición y la ley");
    if (cambio) {
      for (const [nombre, r] of [
        ["sale por tipo", cambio(NUEVO_SUB, { tipoPropiedad: "usado" }, MERCADO, "tipo")],
        ["sale por tipo, pre-aprobada", cambio({ ...NUEVO_SUB, tasaModo: "preaprobada", tasaInteres: "3,5" }, { tipoPropiedad: "usado" }, MERCADO, "tipo")],
        ["entra por tipo", cambio(USADO, { tipoPropiedad: "nuevo" }, MERCADO, "tipo")],
        ["sale por precio", cambio(NUEVO_SUB, { precio: "6500" }, MERCADO, "precio")],
        ["entra por precio", cambio({ ...NUEVO_SUB, precio: "6500", tasaInteres: "4,04" }, { precio: "5500" }, MERCADO, "precio")],
      ] as const) {
        if (!dice(r.nota ?? "")) F(`4 · la nota «${nombre}» no dice la condición y la ley: «${r.nota}»`);
      }
    }
    // Barrido del wizard: ni la ley vieja ni «la mínima» en lo que se ve.
    for (const f of ["screensActo2.tsx", "screenResumen.tsx", "wizardV4Nodes.ts", "wizardV4Subsidio.ts", "WizardV4.tsx"]) {
      const src = sinComentarios(leer(`src/components/formulario-v4/${f}`));
      if (/21\.748/.test(src)) F(`4 · ${f} todavía cita la Ley 21.748 en un texto`);
      if (/es la mínima/.test(src)) F(`4 · ${f} todavía dice «esta es la mínima»`);
    }
    if (K.CONDICION_SUBSIDIO !== CONDICION || K.LEY_SUBSIDIO !== LEY) F("4 · la condición o la ley de `constants/subsidio` no son las de la Ley 21.836");
  }

  // ── 5 · EL INFORME ─────────────────────────────────────────────────────────
  {
    if (K.LINEA_INFORME_SUBSIDIO !== LINEA_INFORME) F("5 · la línea del informe no es la aprobada");
    const fila = (sub: React.ReactNode) => renderToStaticMarkup(createElement(FilaDato, { k: "Cuota del crédito", sub, v: "$1" }));
    const base = "UF 4.400 a 25 años al 3,4%";
    if (LS.conLineaSubsidio) {
      const con = motorLtr(NUEVO_SUB).metrics.subsidioTasa;
      const htmlCon = fila(LS.conLineaSubsidio(base, con));
      if (!htmlCon.includes(base) || !htmlCon.includes(LINEA_INFORME)) F("5 · con la tasa del subsidio la fila de la cuota no dice la línea");
      for (const [nombre, a] of [["nuevo en mercado", { ...NUEVO_SUB, tasaInteres: "4,04" }], ["usado con 3,44", { ...USADO, tasaInteres: "3,44" }], ["nuevo de UF 6.500 con 3,44", { ...NUEVO_SUB, precio: "6500" }]] as const) {
        const html = fila(LS.conLineaSubsidio(base, motorLtr(a).metrics.subsidioTasa));
        if (/subsidio/i.test(html)) F(`5 · ${nombre}: el informe dice la línea del subsidio`);
      }
      if (/subsidio/i.test(fila(LS.conLineaSubsidio(base, undefined)))) F("5 · un informe sin el dato del subsidio dice la línea");
    }
    const ltr = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
    if (!/k: "Cuota del crédito",[^\n]*sub: credito > 0 \? conLineaSubsidio\(`\$\{compact\(credito\)\} a \$\{plazoCred\} años al \$\{pct1\(tasaCred\)\}%`, m\?\.subsidioTasa\) : "sin crédito"/.test(ltr)) F("5 · la cuota del crédito del informe LTR no lleva la línea del subsidio");
    const str = sinComentarios(leer("src/components/analysis/str/CapitulosInversionStr.tsx"));
    if (!/<FilaDato k="Cuota del crédito"[^\n]*sub=\{results\.montoCredito > 0 \? conLineaSubsidio\(`\$\{compact\(results\.montoCredito\)\} a \$\{plazo\} años al \$\{pct1\(tasa\)\}%`, results\.subsidioTasa\) : "sin crédito"\}/.test(str)) F("5 · la cuota del crédito del informe STR no lleva la línea del subsidio");
  }

  if (fallas.length) {
    console.log(`  ✗ SUBSIDIO-TASA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — un usado nunca queda con la tasa del subsidio (tipo, precio y precarga), el wizard dice la condición, mayo de 2028 y la Ley 21.836, y el informe lo dice junto a la tasa");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runSubsidioTasaTier().hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (08-oct-2026) — cada una aplicada sobre el código arreglado, corrida contra
// este tier y restaurada desde una copia en memoria. Las 18 en ROJO; restauradas, VERDE. Antes del
// arreglo el tier dio 28 fallas sobre master (d9c09cca).
//    M1  el resumen cambia el tipo con el parche viejo      M10 la vigencia pasa a mayo de 2027
//    M2  cambioConSubsidio no devuelve la tasa a mercado    M11 el informe LTR sin la línea
//    M3  la fila del precio guarda directo                  M12 el informe STR sin la línea
//    M4  la precarga copia la tasa con subsidio             M13 la línea sale con solo calificar
//    M5  precio no pasa por la tasa (computeNext)           M14 la precarga mira el depto y no la tasa
//    M5b el plan no pasa por la tasa (plannedNext)          M15 una pre-aprobada se pisa
//    M6  después de la tasa pregunta el plazo               M16 LineaSubsidio no lee el dato del motor
//    M7  el plan no salta a la renta después de la tasa
//    M8  la rebaja vuelve a «esta es la mínima»
//    M9  el aviso anticipado vuelve al texto viejo
