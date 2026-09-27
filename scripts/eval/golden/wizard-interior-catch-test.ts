// ============================================================================
// GOLDEN · EL INTERIOR DEL WIZARD (entrega 2) — catch-test (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// Mockup aprobado: docs/wireframes/rediseno-informe/wizard-v4-actualizado.html.
//
// FIJA:
//   1 · «OTRA FUENTE»: con pie 0 cubierto por otra fuente, su monto —en la unidad del pie— viaja
//       como `piePct` en los dos payloads (para el banco es pie), con `pieOrigen`; si es un
//       crédito, su cuota viaja en `cuotaCreditoPie` y el motor la resta del flujo. Sin monto es
//       el pie 0 de siempre; con pie > 0 o con otra razón, lo que quedó escrito no cuenta.
//   2 · SIN TOCAR NADA, EL PAYLOAD NO CAMBIA: sin las respuestas nuevas no aparece ninguna clave
//       nueva y los huéspedes son los de la regla por dormitorios.
//   3 · HUÉSPEDES: se leen de la respuesta (con tope) o de la regla; el payload STR los lleva.
//   4 · EL SUBSIDIO NO REDONDEA A FAVOR: 4,04 − 0,6 = 3,44 en lo que se ofrece; la compuerta del
//       motor sigue igual y lo reconoce como subsidiado.
//   5 · LOS AÑOS DE ENTREGA salen del año en curso.
//   6 · EL PLAZO muestra la cuota en vivo, y ya no reacciona en la pantalla siguiente.
//   7 · EL PIE 0: el aviso se va al elegir la razón; «otra fuente» abre su bloque (y no el de
//       «Pie 0%»), dice el flujo con la cuota del crédito y ya no dice «ahorro».
//   8 · EL ARRIENDO muestra gastos comunes, contribuciones y vacancia ANTES del botón.
//   9 · LA TARIFA: gestión marcada en «lo opero yo», 20% editable con administrador, amoblado,
//       huéspedes y los costos a la vista.
//  10 · EL RESUMEN: tres filas navegables; GGCC y contribuciones en «Cómo lo rentabilizas»;
//       gestión, comisión, huéspedes y amoblado editables; «otra fuente» con monto y cuota; el
//       botón en la barra fija.
//  11 · EL FORMATO DEL INFORME: cero mono, serif, mayúsculas corridas ni rojo de clase en el
//       interior; el rojo del CSS solo en el botón de avanzar y en los estados de error; el ⓘ
//       es el del informe; el dry-run mira los campos nuevos.
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/wizard-interior-catch-test.ts
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

const UF = 40000;
const CTX: SubmitContext = {
  ufCLP: UF, tasaMercado: 4.04, arriendoSugerido: 757000, arriendoN: 20, arriendoFuente: "radio",
  arriendoRango: null, precioM2UF: 80, radiusUsed: 1000, ggccSugerido: 99000,
  ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 1000,
};
const BASE: WizardV4Answers = {
  direccion: "Av. Irarrázaval 2100, Ñuñoa", direccionConfirmada: "Av. Irarrázaval 2100, Ñuñoa",
  comuna: "Ñuñoa", ciudad: "Santiago", lat: -33.45, lng: -70.6, tipoPropiedad: "usado", antiguedad: "11-20",
  superficieUtil: "55", dormitorios: "2", banos: "1", precio: "4200", pieMonto: "20", pieUnidad: "pct",
  plazoCredito: "25", tasaInteres: "4,04", tasaModo: "estimada", modalidad: "ltr", arrModo: "estimacion", arriendo: "757000",
};
const OTRA: WizardV4Answers = {
  ...BASE, pieMonto: "0", pieRazon: "otra_fuente", otraFuenteMonto: "20", otraFuenteCredito: true, otraFuenteCuota: "520.000",
};

function dataMock(over: Record<string, unknown> = {}) {
  return {
    ufCLP: UF, tasaMercado: 4.04, comparablesCount: 26, comparables: [], suggestionsLoading: false,
    arriendoSugerido: 757000, arriendoN: 20, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null,
    ggccSugerido: 99000, precioM2UF: 80, radiusUsed: 1000, ventaN: 30, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 1000,
    airRoi: { ingresoBrutoMensual: 666000, ocupacionReferencia: 0.44, sampleSize: 40, source: "comparables", isLoading: false, error: null },
    ...over,
  };
}
const noop = () => {};

export function runWizardInteriorTier(): { hard: number } {
  console.log("\n─── TIER WIZARD-INTERIOR (el interior del wizard con el formato del informe · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  /* eslint-disable @typescript-eslint/no-var-requires */
  const { buildLtrPayload, buildStrPayload } = require("../../../src/components/formulario-v4/wizardV4Submit");
  const D = require("../../../src/components/formulario-v4/derive");
  const { runAnalysis } = require("../../../src/lib/analysis");
  const { tasaConSubsidioV4 } = require("../../../src/components/formulario-v4/wizardV4Subsidio");
  const { calcTasaConSubsidio, aplicaSubsidio } = require("../../../src/lib/constants/subsidio");
  const { aniosEntrega } = require("../../../src/components/formulario-v4/screensActo1");
  const A2 = require("../../../src/components/formulario-v4/screensActo2");
  const { avisoPie } = require("../../../src/components/formulario-v4/avisoEscala");
  const A3 = require("../../../src/components/formulario-v4/screensActo3");
  const { nodeReacts, reactionText, ACTO_LABEL, PIE_RAZON_OPCIONES } = require("../../../src/components/formulario-v4/wizardV4Nodes");
  const { ResumenScreen } = require("../../../src/components/formulario-v4/screenResumen");
  const { PrimaryBtn, FieldLabel } = require("../../../src/components/formulario-v4/ui");
  const { getCostosDefault } = require("../../../src/lib/engines/short-term-engine");
  /* eslint-enable @typescript-eslint/no-var-requires */

  const pantalla = (Comp: unknown, answers: WizardV4Answers, data = dataMock()) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderToStaticMarkup(createElement(Comp as any, { answers, data, patchAnswers: noop, answer: noop, goDetour: noop }));

  // ── 1 · «OTRA FUENTE» ──────────────────────────────────────────────────────
  for (const [nombre, build] of [["LTR", buildLtrPayload], ["STR", buildStrPayload]] as const) {
    const p = build(OTRA, CTX);
    if (p.piePct !== 20) F(`1 · ${nombre}: con otra fuente del 20% el payload manda piePct ${p.piePct}`);
    if (p.pieOrigen !== "otra_fuente") F(`1 · ${nombre}: el payload no marca pieOrigen`);
    if (p.cuotaCreditoPie !== 520000) F(`1 · ${nombre}: la cuota del crédito del pie viaja como ${p.cuotaCreditoPie}`);
    if (p.razonSinPie !== undefined) F(`1 · ${nombre}: con monto de otra fuente sigue mandando razonSinPie`);
    const sinCredito = build({ ...OTRA, otraFuenteCredito: false }, CTX);
    if ("cuotaCreditoPie" in sinCredito) F(`1 · ${nombre}: sin crédito igual manda cuotaCreditoPie`);
    const enUF = build({ ...OTRA, pieUnidad: "uf", otraFuenteMonto: "840" }, CTX);
    if (enUF.piePct !== 20) F(`1 · ${nombre}: UF 840 de otra fuente sobre UF 4.200 da piePct ${enUF.piePct}`);
    const enPesos = build({ ...OTRA, pieUnidad: "clp", otraFuenteMonto: String(840 * UF) }, CTX);
    if (enPesos.piePct !== 20) F(`1 · ${nombre}: $33.600.000 de otra fuente da piePct ${enPesos.piePct}`);
    const sinMonto = build({ ...OTRA, otraFuenteMonto: undefined }, CTX);
    if (sinMonto.piePct !== 0 || sinMonto.razonSinPie !== "otra_fuente" || "pieOrigen" in sinMonto) F(`1 · ${nombre}: sin monto no es el pie 0 de siempre`);
    const conPie = build({ ...OTRA, pieMonto: "10" }, CTX);
    if (conPie.piePct !== 10 || "pieOrigen" in conPie || "cuotaCreditoPie" in conPie) F(`1 · ${nombre}: con pie > 0 lo escrito de otra fuente cuenta`);
    const otraRazon = build({ ...OTRA, pieRazon: "bono_pie" }, CTX);
    if (otraRazon.piePct !== 0 || "cuotaCreditoPie" in otraRazon) F(`1 · ${nombre}: con bono pie lo escrito de otra fuente cuenta`);
  }
  if (D.cuotaCLP(OTRA, UF) !== D.cuotaCLP(BASE, UF) || !(D.cuotaCLP(OTRA, UF) > 0)) F("1 · la cuota del hipotecario no se calcula sobre el pie que ve el banco");
  // De punta a punta: el payload del wizard, por el motor, baja el flujo exactamente la cuota.
  const asOf = new Date("2026-09-27T12:00:00Z");
  const conC = runAnalysis(buildLtrPayload(OTRA, CTX), UF, undefined, asOf);
  const sinC = runAnalysis(buildLtrPayload({ ...OTRA, otraFuenteCredito: false }, CTX), UF, undefined, asOf);
  if (sinC.metrics.flujoNetoMensual - conC.metrics.flujoNetoMensual !== 520000) F(`1 · del wizard al motor, la cuota del pie baja el flujo ${sinC.metrics.flujoNetoMensual - conC.metrics.flujoNetoMensual}`);

  // ── 2 · SIN TOCAR NADA, EL PAYLOAD NO CAMBIA ───────────────────────────────
  for (const a of [BASE, { ...BASE, pieMonto: "0", pieRazon: "bono_pie" as const }, { ...BASE, esStudio: true, dormitorios: "0", modalidad: "str" as const }]) {
    for (const [nombre, build] of [["LTR", buildLtrPayload], ["STR", buildStrPayload]] as const) {
      const p = build(a, CTX);
      if ("pieOrigen" in p || "cuotaCreditoPie" in p) F(`2 · ${nombre}: sin otra fuente aparece una clave nueva en el payload`);
      if (p.piePct !== D.piePct(a, UF)) F(`2 · ${nombre}: sin otra fuente el piePct (${p.piePct}) no es el escrito`);
    }
    if (buildStrPayload(a, CTX).capacidadHuespedes !== D.capacidadHuespedesDe(D.dormitoriosNum(a))) F("2 · sin respuesta, los huéspedes no son los de la regla por dormitorios");
  }

  // ── 3 · HUÉSPEDES ──────────────────────────────────────────────────────────
  if (D.huespedesNum(BASE) !== 4) F(`3 · un 2D sin respuesta recibe ${D.huespedesNum(BASE)} huéspedes (son 4)`);
  if (D.huespedesNum({ ...BASE, capacidadHuespedes: "5" }) !== 5) F("3 · la respuesta de huéspedes no se lee");
  if (buildStrPayload({ ...BASE, modalidad: "str", capacidadHuespedes: "5" }, CTX).capacidadHuespedes !== 5) F("3 · el payload STR no lleva los huéspedes respondidos");
  if (D.huespedesNum({ ...BASE, capacidadHuespedes: "0" }) !== 4 || D.huespedesNum({ ...BASE, capacidadHuespedes: "x" }) !== 4) F("3 · una respuesta inválida no cae a la regla");
  if (D.huespedesNum({ ...BASE, capacidadHuespedes: "40" }) !== D.HUESPEDES_MAX) F("3 · los huéspedes no respetan el tope");

  // ── 4 · SUBSIDIO ───────────────────────────────────────────────────────────
  if (tasaConSubsidioV4(4.04) !== 3.44) F(`4 · con mercado 4,04 el subsidio ofrece ${tasaConSubsidioV4(4.04)} (es 3,44)`);
  if (tasaConSubsidioV4(4.72) !== 4.12) F(`4 · con mercado 4,72 el subsidio ofrece ${tasaConSubsidioV4(4.72)} (es 4,12)`);
  if (calcTasaConSubsidio(4.04) !== 3.4) F("4 · la compuerta del motor cambió (análisis ya hechos se moverían)");
  if (!aplicaSubsidio(3.44, calcTasaConSubsidio(4.04))) F("4 · el motor no reconoce 3,44 como tasa subsidiada");

  // ── 5 · AÑOS DE ENTREGA ────────────────────────────────────────────────────
  if (aniosEntrega(new Date("2027-01-15T12:00:00Z")).join() !== "2027,2028,2029,2030") F("5 · los años de entrega no salen del año en curso");
  if (/anioActual = 20\d\d/.test(sinComentarios(leer("src/components/formulario-v4/screensActo1.tsx")))) F("5 · vuelve el año de entrega escrito a mano");

  // ── 6 · PLAZO ──────────────────────────────────────────────────────────────
  for (const plazo of ["15", "30"]) {
    const a = { ...BASE, plazoCredito: plazo };
    const html = pantalla(A2.PlazoScreen, a);
    const cuota = D.fmtCLP(D.cuotaCLP(a, UF));
    if (!html.includes("Tu cuota mensual") || !html.includes(cuota)) F(`6 · a ${plazo} años la pantalla no muestra la cuota ${cuota}`);
  }
  if (nodeReacts("plazo", BASE) || reactionText("plazo", BASE, {}) !== null) F("6 · el plazo vuelve a reaccionar en la pantalla siguiente");
  const plazoOtra = pantalla(A2.PlazoScreen, OTRA);
  if (!plazoOtra.includes(D.fmtCLP(520000))) F("6 · con crédito del pie, el plazo no dice que su cuota va aparte");

  // ── 7 · PIE 0 ──────────────────────────────────────────────────────────────
  if (avisoPie(0, undefined) === null) F("7 · con pie 0 sin razón no hay aviso");
  if (avisoPie(0, "bono_pie") !== null || avisoPie(0, "otra_fuente") !== null) F("7 · el aviso del pie 0 no se va al elegir la razón");
  if (avisoPie(125, "bono_pie") === null) F("7 · un pie sobre el 100% deja de avisar");
  if (!/escala=\{\(v\) => avisoPie\(unidad === "pct" \? v : pct, answers\.pieRazon\)\}/.test(sinComentarios(leer("src/components/formulario-v4/screensActo2.tsx")))) F("7 · el campo del pie no usa avisoPie");
  const pieOtra = pantalla(A2.PieScreen, OTRA);
  if (!pieOtra.includes("¿Cuánto cubre esa otra fuente?") || pieOtra.includes(">Pie 0%<")) F("7 · con otra fuente no abre su bloque, o sigue el de «Pie 0%»");
  const cuotaBanco = D.cuotaCLP(OTRA, UF);
  if (!pieOtra.includes("La cuota del crédito se suma a tu flujo mensual") || !pieOtra.includes(D.fmtCLP(cuotaBanco + 520000))) F("7 · el bloque no dice el flujo con la cuota del crédito");
  const pieBono = pantalla(A2.PieScreen, { ...OTRA, pieRazon: "bono_pie" });
  if (!pieBono.includes(">Pie 0%<") || pieBono.includes("¿Cuánto cubre")) F("7 · con bono pie no está el bloque «Pie 0%», o aparece el de otra fuente");
  const subOtra = PIE_RAZON_OPCIONES.find((o: { value: string }) => o.value === "otra_fuente")?.sub ?? "";
  if (/ahorro/i.test(subOtra) || !/crédito/.test(subOtra)) F(`7 · «otra fuente» dice «${subOtra}»`);

  // ── 8 · ARRIENDO ───────────────────────────────────────────────────────────
  const arr = pantalla(A3.ArrScreen, BASE);
  const iBoton = arr.indexOf("Usar estimación");
  for (const k of ["Gastos comunes", "Contribuciones", "Vacancia"]) {
    const i = arr.indexOf(`>${k}<`);
    if (i < 0 || iBoton < 0 || i > iBoton) F(`8 · «${k}» no está a la vista antes del botón`);
  }
  if (/<details/.test(arr)) F("8 · los supuestos vuelven a un desplegable");

  // ── 9 · TARIFA ─────────────────────────────────────────────────────────────
  const STR_A: WizardV4Answers = { ...BASE, modalidad: "str" };
  const adr = pantalla(A3.AdrScreen, STR_A);
  if (!/aria-label="Lo opero yo[^"]*" aria-pressed="true"/.test(adr)) F("9 · la gestión no parte marcada en «lo opero yo»");
  if (adr.includes("Comisión del administrador")) F("9 · sin administrador aparece su comisión");
  const adrAdmin = pantalla(A3.AdrScreen, { ...STR_A, modoGestion: "administrador" });
  if (!adrAdmin.includes("Comisión del administrador") || !/value="20"/.test(adrAdmin)) F("9 · con administrador no aparece el 20% editable");
  for (const k of ["Luz, agua, wifi e insumos", "Mantención", "Gastos comunes", "Contribuciones", "Amoblarlo"]) {
    if (!adr.includes(`>${k}<`)) F(`9 · la tarifa no muestra «${k}»`);
  }
  if (pantalla(A3.AdrScreen, { ...STR_A, estaAmoblado: true }).includes(">Amoblarlo<")) F("9 · amoblado, igual cobra amoblarlo");
  if (!/<span class="wz-stepper-n"[^>]*>4<\/span>/.test(adr)) F("9 · el stepper de huéspedes no muestra los de la regla");
  if (!adr.includes(`$${getCostosDefault(2, "basico").costoAmoblamiento.toLocaleString("es-CL")}`)) F("9 · el amoblamiento no es el de la tipología");
  if (!pantalla(A3.AdrScreen, { ...STR_A, esStudio: true, dormitorios: "0" }).includes("para un studio")) F("9 · el studio no lleva sus propios números");

  // ── 10 · RESUMEN ───────────────────────────────────────────────────────────
  const resumen = (a: WizardV4Answers, cardInicial: string | null) =>
    renderToStaticMarkup(createElement(ResumenScreen, {
      w: { nav: { answers: a }, patchAnswers: noop },
      data: dataMock(), tier: { tier: "guest", anonCapAvailable: true }, isLoggedIn: false, onTerminal: noop, cardInicial,
    }));
  const r0 = resumen(BASE, null);
  if ((r0.match(/class="wz-fnav(?: abierta)?"/g) ?? []).length !== 3) F("10 · el resumen no son tres filas navegables");
  if (!/class="wz-barra-cta"[\s\S]*Generar mi análisis gratis/.test(r0)) F("10 · el botón del resumen no está en la barra fija");
  const r01 = resumen(BASE, "01");
  if (r01.includes(">Gastos comunes<") || r01.includes(">Contribuciones<")) F("10 · gastos comunes o contribuciones siguen en «Qué compras»");
  const r03 = resumen(BASE, "03");
  for (const k of ["Arriendo mensual", "Gastos comunes", "Contribuciones", "Vacancia", "Comisión de administración"]) {
    if (!r03.includes(`>${k}<`)) F(`10 · LTR: «${k}» no está en «Cómo lo rentabilizas»`);
  }
  const r03s = resumen(STR_A, "03");
  for (const k of ["Tarifa por noche", "Ocupación", "Quién lo opera", "Comisión", "Huéspedes", "Amoblado", "Luz, agua, wifi e insumos", "Mantención", "Gastos comunes", "Contribuciones", "Amoblarlo"]) {
    if (!r03s.includes(`>${k}<`)) F(`10 · STR: «${k}» no está en «Cómo lo rentabilizas»`);
  }
  if (!resumen({ ...STR_A, modoGestion: "administrador", comisionStrPct: "18" }, "03").includes(">18<")) F("10 · STR: la comisión del administrador no es editable");
  const r02 = resumen(OTRA, "02");
  for (const k of ["Cómo se cubre", "Cuánto cubre", "¿Es un crédito?", "Cuota de ese crédito", "Cuota del crédito del pie"]) {
    if (!r02.includes(`>${k}<`)) F(`10 · «otra fuente»: falta «${k}» en «Cómo lo financias»`);
  }
  // El aviso del pie 0 también se va en el resumen cuando la razón está dada (la fila del pie
  // mostraba «sin indicar cómo se cubre» con la razón elegida, visto en el navegador).
  if (/sin indicar cómo se cubre/.test(r02)) F("10 · el resumen avisa «sin indicar cómo se cubre» con la razón ya elegida");
  if (!/sin indicar cómo se cubre/.test(resumen({ ...OTRA, pieRazon: undefined }, "02"))) F("10 · sin razón, el resumen ya no avisa el pie 0 (el guard no mide)");

  // ── 11 · FORMATO ───────────────────────────────────────────────────────────
  const INTERIOR = ["ui.tsx", "filas.tsx", "screensActo1.tsx", "screensActo2.tsx", "screensActo3.tsx", "screenInforme.tsx", "screenResumen.tsx", "NumericInput.tsx", "ModalPlausibilidad.tsx", "MapaPinAjustable.tsx", "WizardV4.tsx"];
  for (const f of INTERIOR) {
    const src = sinComentarios(leer(`src/components/formulario-v4/${f}`));
    const m = src.match(/\b(font-mono|font-heading|signal-red|uppercase|tracking-\[)/);
    if (m) F(`11 · ${f} usa «${m[1]}»: el interior va en Inter, sin mayúsculas corridas ni rojo de clase`);
  }
  const ent = sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx"));
  const mapaScr = ent.slice(ent.indexOf("export function MapaScreen"));
  if (!mapaScr.startsWith("export function MapaScreen")) F("11 · no encuentro la pantalla del mapa: el tier no la mide");
  else if (/\b(font-mono|font-heading|signal-red|uppercase)/.test(mapaScr)) F("11 · la pantalla del mapa vuelve a mono, serif o rojo");
  // El rojo del CSS: solo el botón de avanzar y los estados de error / atención.
  const css = sinComentarios(leer("src/components/formulario-v4/wizard-v4.css"));
  const PERMITIDOS = new Set([".wz-cta", ".wz-aviso.fuerte", '.wz-input[aria-invalid="true"]', ".wz-modal-o .ov.sosp", ".wz-fe.wz-ilumina", ".wz-error"]);
  let rojos = 0;
  for (const regla of css.split("}")) {
    const [sel, cuerpo] = regla.split("{");
    if (!cuerpo || !/var\(--wz-rojo\)/.test(cuerpo)) continue;
    rojos++;
    for (const s of sel.split(",").map((x) => x.trim())) if (!PERMITIDOS.has(s)) F(`11 · el CSS pinta de rojo «${s}»`);
  }
  if (!/\.wz-cta \{[^}]*background: var\(--wz-rojo\)/.test(css)) F("11 · el botón de avanzar no es rojo");
  if (rojos === 0) F("11 · no encuentro reglas rojas: el tier no midió");
  const btn = renderToStaticMarkup(createElement(PrimaryBtn, { onClick: noop }, "Continuar →"));
  if (btn !== '<button type="button" class="wz-cta">Continuar →</button>') F(`11 · el botón de avanzar se dibuja ${btn}`);
  const rot = renderToStaticMarkup(createElement(FieldLabel, { tooltip: "Qué es" }, "Superficie útil"));
  if (!/class="v-i"/.test(rot)) F("11 · el ⓘ de los campos no es el del informe");
  if (/InfoTooltip/.test(sinComentarios(leer("src/components/formulario-v4/ui.tsx")))) F("11 · vuelve el InfoTooltip de shadcn");
  for (const [k, v] of Object.entries(ACTO_LABEL as Record<string, string>)) {
    if (v === v.toUpperCase()) F(`11 · el rótulo del acto «${k}» va en mayúsculas corridas`);
  }
  const shell = sinComentarios(leer("src/components/formulario-v4/WizardV4.tsx"));
  if (!/<main className="wz4 doc-dictamen /.test(shell) || !/<h1 className="wz-titulo">/.test(shell)) F("11 · el interior no va dentro de los tokens del informe, o el título no es el suyo");
  const dry = sinComentarios(leer("src/components/formulario-v4/useWizardV4DryRun.ts"));
  if (!/answers\.otraFuenteMonto, answers\.otraFuenteCredito, answers\.otraFuenteCuota,\s*\n\s*answers\.capacidadHuespedes, answers\.estaAmoblado,/.test(dry)) F("11 · el dry-run no se recalcula con otra fuente, huéspedes o amoblado");

  if (fallas.length) {
    console.log(`  ✗ WIZARD-INTERIOR · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — «otra fuente» viaja como pie y su cuota llega al flujo; sin tocar nada el payload no cambia; huéspedes, subsidio a dos decimales y años del año en curso; la cuota en vivo; el arriendo y la tarifa con sus supuestos a la vista; el resumen en filas del informe; y el interior en Inter, con el rojo solo en el botón y en los errores");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runWizardInteriorTier().hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (27-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las 27 en ROJO; restauradas, VERDE. Después el paseo por el navegador encontró que la fila del
// pie del resumen seguía avisando «sin indicar cómo se cubre» con la razón elegida: se arregló, se
// sumó al punto 10 y se mutó otra vez — I28 el resumen vuelve a `escalaPie`, I11b la regla pierde
// la razón, I29 la pantalla deja `avisoPie`: las tres en ROJO.
//    I1 pieEfectivoPct ignora otra fuente          I15 la gestión parte en administrador
//    I2 el LTR no manda otra fuente                I16 amoblado, igual cobra amoblarlo
//    I3 la cuota viaja sin crédito                 I17 el resumen LTR sin GGCC en la 03
//    I4 el monto en UF se lee como %               I18 el resumen STR sin «quién lo opera»
//    I5 pieOrigen siempre                          I19 el CSS pinta la barra de rojo
//    I6 huéspedes ignora la respuesta              I20 el botón vuelve a mono
//    I7 el subsidio redondea a un decimal          I21 vuelve «Fuera de escala» en mono
//    I8 años de entrega fijos                      I22 los actos en mayúsculas
//    I9 el plazo sin la cuota                      I23 el dry-run no mira otra fuente
//    I10 el plazo vuelve a reaccionar              I24 el ⓘ deja de ser el del informe
//    I11 el aviso del pie no mira la razón         I25 el resumen sin la cuota del crédito
//    I12 «Pie 0%» también con otra fuente          I26 el aviso del mapa vuelve a mono
//    I13 otra fuente vuelve a decir «ahorro»       I27 el resumen deja la barra fija
//    I14 los supuestos del arriendo bajo el botón
