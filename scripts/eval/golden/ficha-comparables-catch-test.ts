/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// TIER FICHA-COMPARABLES (24-sep-2026) · la ficha del depto y «Ver los comparables» LTR.
//
// Decisión de Fabrizio (mockups `ficha-depto.html` forma A y `comparables-ltr.html`). Fija:
//   1 · TU ARRIENDO APARECE SIN REFERENCIA DE RADIO: la card de zona pinta el arriendo
//       declarado aunque no haya mediana con que compararlo (420 de 1.218 filas LTR decían «—»).
//   2 · LA LISTA ES LA MUESTRA DE LA MEDIANA: el resumen del radio devuelve los avisos limpios
//       que usó (con el filtro de dormitorios la mediana de sus precios ES la referencia; sin él,
//       la de su precio por m² × tu superficie); el wizard los guarda solo si son radio y calzan
//       con el n; al leer, una lista que no calza con el n no existe.
//   3 · COMPARABLES SIN EL OVERLAY VIEJO NI GATE DE PROSA: el grid no monta `AnalysisDrawer`, la
//       sección abre el `Modal` del informe, y ni la sección ni el cuerpo del modal leen la prosa
//       ni deshabilitan el botón.
//   4 · LA CARD Y EL MODAL DAN LA MISMA REFERENCIA: una sola síntesis (`sintesisZonaLtrR2`) para
//       las dos, las mismas celdas, la mediana de la lista es la de la card, la planilla trae el
//       n de la card, y el rango P10–P90 de la comuna no aparece en ninguna de las dos.
//   5 · SIN MONO NI SERIF en la zona: ni en el código de la sección, del modal y del mapa, ni en
//       las filas de lugares.
//   6 · LA FICHA EN EL MODAL: `FichaModal` monta el `Modal` del informe en un portal (fuera del
//       hero, cuya regla `> *{position:relative}` le robaba el `fixed`), y el overlay viejo no
//       existe ni en el componente ni en el CSS.
//   7 · LA FICHA ES DE SOLO LECTURA: ningún botón ni link en su cuerpo, ningún texto de edición,
//       y ni la ficha ni la portada reciben una acción de «ajustar».
//   8 · LAS ETIQUETAS DE PROCEDENCIA dicen la verdad: arriendo igual a la referencia = sugerido,
//       distinto = declarado; tarifa y ocupación STR = estimada sin override, definida con él.
//   9 · TODO RESPETA CLP/UF: en UF ningún monto de la ficha lleva pesos (cuotas del pie,
//       amoblamiento y tarifa incluidos); en CLP los mismos llevan pesos.
//  10 · SIN MONO NI SERIF en la ficha: ni en el componente ni en su CSS ni en su HTML.
//  11 · LA CARGA DE LA PÁGINA ES LA FORMA DEL INFORME: LTR, STR y AMBAS tienen `loading.tsx`, los
//       tres montan `EsqueletoInforme` y ninguno `LoadingEditorial`; el esqueleto no tiene texto
//       visible (ni pasos ni tiempo), ni logo, ni mono ni serif.
// Verificado EN ROJO por mutación. Corre solo:
//   node --import tsx scripts/eval/golden/ficha-comparables-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildZonaLtr, buildZonaLtrR2, ZonaCeldasLtrR2, ComparablesLtr, sintesisZonaLtrR2 } from "../../../src/components/analysis/zona/ZonaLtr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resumirComparablesRadio, median } from "../../../src/lib/services/comparables-radio";
import { leerMuestraArriendo } from "../../../src/lib/arriendo-referencia";
import { buildLtrPayload, type SubmitContext } from "../../../src/components/formulario-v4/wizardV4Submit";
import { buildFichaLtr, buildFichaStr, type FichaDepto } from "../../../src/lib/ficha-depto";
import { FichaCuerpo } from "../../../src/components/analysis/portada/FichaModal";
import { EsqueletoInforme } from "../../../src/components/analysis/EsqueletoInforme";
import { existsSync } from "node:fs";

// El JSX de los componentes compila a React.createElement bajo tsx: el global lo resuelve.
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (x: string) => x.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
/** El cuerpo de una función exportada: desde su firma hasta la próxima declaración de nivel 0. */
const cuerpoDe = (src: string, nombre: string): string => {
  const i = src.indexOf(`export function ${nombre}(`);
  if (i < 0) return "";
  const resto = src.slice(i + 10);
  const j = resto.search(/\n(export |function |const |type |interface )/);
  return j < 0 ? resto : resto.slice(0, j);
};
const MONO_SERIF = /font-mono|--font-mono|JetBrains|font-heading|font-serif|Source Serif|Georgia|monospace/;

/** El valor grande de la primera tarjeta («Tu arriendo»), tal como sale en el HTML. */
const valorTuArriendo = (h: string): string | null => {
  const i = h.indexOf("Tu arriendo");
  if (i < 0) return null;
  const m = /class="zc-v">([^<]*)</.exec(h.slice(i));
  return m ? m[1] : null;
};

/** Una fila LTR con arriendo declarado; `conRadio` le pone la referencia de radio. */
function zona(arriendo: number, conRadio: boolean) {
  const inputData: any = { arriendo, precio: 3800, superficie: 68, comuna: "Providencia" };
  if (conRadio) inputData.zonaRadio = { arriendoPromedio: 980000, sampleSizeArriendo: 47, radioMetros: 1500 };
  const base = buildZonaLtr({ stats: null, sobre: null, medianaResolvedAt: null, arriendoUsuarioCLP: arriendo, comuna: "Providencia" });
  return buildZonaLtrR2({ base, inputData, arriendoUsuarioCLP: arriendo, precioUF: 3800, superficie: 68 });
}

export function runFichaComparablesTier(): { hard: number } {
  fallas.length = 0;
  console.log("\n── Tier FICHA-COMPARABLES (la ficha y los comparables LTR) ──");

  // ── 1 · tu arriendo aparece aunque no haya referencia de radio ──
  const sinRef = zona(750000, false);
  if (sinRef.arriendoTuyo !== 750000) F(`1 · buildZonaLtrR2 sin referencia de radio devuelve arriendoTuyo = ${sinRef.arriendoTuyo}, no el declarado (750000)`);
  if (sinRef.arriendo !== null) F("1 · sin zonaRadio la referencia de arriendo tendría que ser null");
  const vSin = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: sinRef, currency: "CLP", valorUF: 40849 })));
  if (vSin !== "$750 mil") F(`1 · sin referencia de radio la card pinta «${vSin}» en «Tu arriendo», no «$750 mil»`);
  const vUf = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: sinRef, currency: "UF", valorUF: 40849 })));
  if (!vUf || !/^UF \d/.test(vUf)) F(`1 · en UF, sin referencia, «Tu arriendo» pinta «${vUf}»`);
  const conRef = zona(750000, true);
  const vCon = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: conRef, currency: "CLP", valorUF: 40849 })));
  if (vCon !== "$750 mil") F(`1 · con referencia de radio la card pinta «${vCon}», no «$750 mil»`);
  const vCero = valorTuArriendo(html(createElement(ZonaCeldasLtrR2, { zona: zona(0, false), currency: "CLP", valorUF: 40849 })));
  if (vCero !== "—") F(`1 · sin arriendo declarado ni referencia la card tendría que decir «—» y dice «${vCero}»`);

  // ── 2 · la lista es la muestra de la mediana, se guarda solo si calza, y se lee igual ──
  const filas = [
    { precio: 610000, superficie_m2: 34, distance_meters: 66.4 }, { precio: 490000, superficie_m2: 40, distance_meters: 84 },
    { precio: 430000, superficie_m2: 34, distance_meters: 119 }, { precio: 540000, superficie_m2: 32, distance_meters: 154 },
    { precio: 495000, superficie_m2: 33, distance_meters: 210 }, { precio: 520000, superficie_m2: 36, distance_meters: 218 },
    { precio: 5000000, superficie_m2: 36, distance_meters: 20 }, // extremo: la limpieza lo saca
  ];
  const con = resumirComparablesRadio(filas, 38, { modo: "conDorms", factorCierre: 1 });
  if (!con) F("2 · el resumen del radio no dio muestra con seis avisos limpios");
  else {
    if (con.muestra.avisos.length !== con.sampleSize) F(`2 · la muestra trae ${con.muestra.avisos.length} avisos y el n es ${con.sampleSize}`);
    if (con.muestra.avisos.some((a) => a.precio === 5000000)) F("2 · la muestra guarda un aviso que la limpieza descartó");
    const medCon = Math.round(median(con.muestra.avisos.map((a) => a.precio)) / 1000) * 1000;
    if (con.muestra.modo !== "conDorms" || medCon !== con.arriendo) F(`2 · con dormitorios la mediana de la muestra (${medCon}) no es la referencia (${con.arriendo})`);
    const d = con.muestra.avisos.map((a) => a.distanciaM ?? 0);
    if (d.some((x, i) => i > 0 && x < d[i - 1])) F("2 · la muestra no va por distancia");
  }
  const sin = resumirComparablesRadio(filas, 38, { modo: "sinDorms", factorCierre: 1 });
  if (!sin || sin.muestra.modo !== "sinDorms") F("2 · sin dormitorios la muestra no declara su modo");
  else {
    const pm2 = sin.muestra.avisos.filter((a) => a.m2).map((a) => a.precio / (a.m2 as number)).sort((a, b) => a - b);
    const ref = Math.round((pm2[Math.floor(pm2.length / 2)] * 38) / 1000) * 1000;
    if (ref !== sin.arriendo) F(`2 · sin dormitorios el precio por m² de la muestra × 38 m² (${ref}) no es la referencia (${sin.arriendo})`);
  }
  if (con) {
    const ctx: SubmitContext = {
      ufCLP: 40000, tasaMercado: 4.5, arriendoSugerido: con.arriendo, arriendoN: con.sampleSize, arriendoFuente: "radio", arriendoRango: null,
      muestraArriendo: con.muestra, precioM2UF: null, radiusUsed: 500, ggccSugerido: null, ventaN: 0, ventaFuente: "sin-dato", ventaUniverso: null, ventaRadio: null,
    };
    const a: any = { comuna: "Ñuñoa", superficieUtil: "38", precio: "4205", dormitorios: "1", banos: "1", tipoPropiedad: "usado", lat: -33.45, lng: -70.62 };
    const guardada = (buildLtrPayload(a, ctx) as any).zonaRadio?.muestraArriendo;
    if (!guardada || guardada.avisos?.length !== con.sampleSize) F("2 · el payload del wizard no guarda la muestra de radio");
    if ((buildLtrPayload(a, { ...ctx, arriendoFuente: "comuna" }) as any).zonaRadio?.muestraArriendo) F("2 · el payload guarda una muestra con referencia comunal");
    if ((buildLtrPayload(a, { ...ctx, arriendoN: con.sampleSize + 1 }) as any).zonaRadio?.muestraArriendo) F("2 · el payload guarda una muestra que no calza con el n");
    const input = { zonaRadio: { arriendoPromedio: con.arriendo, sampleSizeArriendo: con.sampleSize, radioMetros: 500, muestraArriendo: con.muestra } };
    if (leerMuestraArriendo(input)?.avisos.length !== con.sampleSize) F("2 · leerMuestraArriendo no devuelve la muestra guardada");
    if (leerMuestraArriendo({ zonaRadio: { ...input.zonaRadio, sampleSizeArriendo: con.sampleSize + 3 } }) !== null) F("2 · leerMuestraArriendo acepta una lista que no calza con el n");
    if (leerMuestraArriendo({ zonaRadio: { ...input.zonaRadio, arriendoFuente: "comuna" } }) !== null) F("2 · leerMuestraArriendo acepta una lista con referencia comunal");
    if (leerMuestraArriendo({ zonaRadio: { arriendoPromedio: con.arriendo, sampleSizeArriendo: con.sampleSize, radioMetros: 500 } }) !== null) F("2 · una fila sin lista guardada tendría que leer null");
  }

  // ── 3 · sin el overlay viejo ni gate de prosa ──
  const grid = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  if (/AnalysisDrawer/.test(grid)) F("3 · SubjectCardGrid todavía usa AnalysisDrawer (el overlay viejo)");
  const zonaSrc = sinComentarios(leer("src/components/analysis/zona/ZonaLtr.tsx"));
  const seccion = cuerpoDe(zonaSrc, "ZonaLtrSection");
  const cuerpoModal = cuerpoDe(zonaSrc, "ComparablesLtr");
  if (!seccion) F("3 · no se encontró ZonaLtrSection");
  if (!/<Modal\b/.test(seccion)) F("3 · ZonaLtrSection no abre el Modal del informe");
  if (!/<ComparablesLtr\b/.test(seccion)) F("3 · el Modal de la zona no monta el cuerpo de comparables");
  for (const [nombre, src] of [["ZonaLtrSection", seccion], ["ComparablesLtr", cuerpoModal]] as const) {
    if (/\bprosa\b|aiAnalysis|hasAiV2/.test(src)) F(`3 · ${nombre} lee la prosa: el botón de comparables tiene que abrir sin ella`);
  }
  if (/disabled=/.test(seccion)) F("3 · el botón «Ver los comparables» se puede deshabilitar");
  const tramoZona = grid.slice(grid.indexOf('id="la-zona"') - 200, grid.indexOf("<ZonaLtrSection"));
  if (grid.indexOf("<ZonaLtrSection") < 0) F("3 · el grid no monta ZonaLtrSection");
  else if (/prosa\s*&&|&&\s*prosa/.test(tramoZona)) F("3 · la sección de zona se monta detrás de la prosa");

  // ── 4 · la card y el modal dan la misma referencia ──
  if (!/sintesisZonaLtrR2\(/.test(seccion) || /sintesisZonaLtr\(/.test(seccion)) F("3 · la card de zona no usa la síntesis del radio (sintesisZonaLtrR2)");
  if (/ofertaComparable/.test(seccion + cuerpoModal)) F("4 · la sección o el modal leen el rango P10–P90 de la comuna (ofertaComparable)");
  {
    const avisos = [
      [66, 610000, 34], [84, 490000, 40], [119, 430000, 34], [154, 540000, 32], [210, 495000, 33], [218, 520000, 36], [220, 505000, 43],
      [221, 485000, 36], [222, 500000, 36], [233, 486000, 33], [239, 505000, 43], [242, 500000, 30],
    ].map(([d, p, m]) => ({ distanciaM: d, precio: p, m2: m }));
    const med = Math.round(median(avisos.map((a) => a.precio)) / 1000) * 1000;
    const inputData: any = { arriendo: 520000, precio: 4205, superficie: 38, comuna: "Ñuñoa",
      zonaRadio: { arriendoPromedio: med, sampleSizeArriendo: avisos.length, radioMetros: 500, arriendoFuente: "radio", muestraArriendo: { modo: "conDorms", avisos } } };
    const base = buildZonaLtr({ stats: null, sobre: null, medianaResolvedAt: null, arriendoUsuarioCLP: 520000, comuna: "Ñuñoa" });
    const z = buildZonaLtrR2({ base, inputData, arriendoUsuarioCLP: 520000, precioUF: 4205, superficie: 38 });
    const sint = sintesisZonaLtrR2(z);
    const muestra = leerMuestraArriendo(inputData);
    const cardHtml = html(createElement(ZonaCeldasLtrR2, { zona: z, currency: "CLP", valorUF: 40861 }));
    const modalHtml = html(createElement(ComparablesLtr, { zona: z, sintesis: sint, muestra, superficie: 38, currency: "CLP", valorUF: 40861, zoneInsight: null, zoneCargando: false, zoneCenter: null, comuna: "Ñuñoa" }));
    if (!modalHtml.includes(sint)) F("4 · el modal no dice la misma síntesis que la card");
    if (!new RegExp(`${avisos.length} arriendos publicados a menos de 500 m`).test(sint)) F(`4 · la síntesis no nombra la referencia del radio con su n («${sint}»)`);
    if (!modalHtml.includes(cardHtml.slice(0, 200))) F("4 · el modal no monta las mismas celdas que la card");
    const medTxt = `$${med.toLocaleString("es-CL")}`;
    // El valor DE ESA FILA, no la cifra suelta: «$500.000» también está en la planilla, y un
    // `includes` pasaba por vecindad con la mediana cambiada (medido por mutación).
    const filaMed = /Mediana de sus arriendos[^]*?<span class="dv">([^<]*)</.exec(modalHtml)?.[1] ?? null;
    if (filaMed !== medTxt) F(`4 · la mediana de la lista (${filaMed}) no es la de la card (${medTxt})`);
    const filasPl = (modalHtml.match(/<tr[ >]/g) ?? []).length - 1;
    if (filasPl !== avisos.length) F(`4 · la planilla trae ${filasPl} filas y la card dice ${avisos.length}`);
    if (/avisos activos|Arriendo típico de esta zona/.test(modalHtml + cardHtml)) F("4 · aparece la referencia comunal (rango de avisos activos)");
    const viejo = html(createElement(ComparablesLtr, { zona: z, sintesis: sint, muestra: null, superficie: 38, currency: "CLP", valorUF: 40861, zoneInsight: null, zoneCargando: false, zoneCenter: null, comuna: "Ñuñoa" }));
    if (!/guardó la mediana y cuántos avisos la forman, no los avisos/.test(viejo)) F("4 · una fila sin lista guardada no dice que no la tiene");
    if (/<table/.test(viejo)) F("4 · una fila sin lista guardada muestra una planilla");
    if (MONO_SERIF.test(modalHtml)) F("5 · el HTML del modal de comparables trae una clase mono o serif");
  }

  // ── 5 · sin mono ni serif en la zona ──
  for (const p of ["src/components/analysis/zona/ZonaLtr.tsx", "src/components/zone-insight/ZoneMap.tsx"]) {
    const m = sinComentarios(leer(p)).match(MONO_SERIF);
    if (m) F(`5 · ${p} usa «${m[0]}»`);
  }
  const portada = leer("src/components/analysis/portada/PortadaInforme.tsx");
  for (const regla of portada.match(/\.lugar[^{]*\{[^}]*\}/g) ?? []) if (MONO_SERIF.test(regla)) F(`5 · la fila de lugares usa mono: ${regla.slice(0, 60)}`);

  // ── 6 · la ficha en el Modal, sin el overlay viejo ──
  const fichaSrc = sinComentarios(leer("src/components/analysis/portada/FichaModal.tsx"));
  const portadaSrc = sinComentarios(leer("src/components/analysis/portada/PortadaInforme.tsx"));
  if (!/<Modal\b/.test(fichaSrc)) F("6 · FichaModal no abre el Modal del informe");
  if (!/createPortal\(/.test(fichaSrc)) F("6 · FichaModal no va en portal: dentro del hero pierde el position:fixed");
  if (/doc-ficha-overlay|doc-ficha-sheet/.test(fichaSrc + portadaSrc)) F("6 · el overlay viejo de la ficha sigue en el componente o en el CSS");

  // ── 7 · solo lectura ──
  if (/onAjustar/.test(fichaSrc + portadaSrc)) F("7 · la ficha o la portada reciben una acción de ajustar");
  const inLtr = (arriendo: number, extra: Record<string, unknown> = {}): any => ({
    precio: 4205, superficie: 38, dormitorios: 1, banos: 1, arriendo, gastos: 68000, piePct: 20, tasaInteres: 3.4, plazoCredito: 30,
    estadoVenta: "futura", fechaEntrega: "2029-8", cuotasPie: 35, montoCuota: 981831, esNuevo: true, antiguedad: 0, estacionamiento: "si", bodega: true,
    zonaRadio: { arriendoPromedio: 498000, sampleSizeArriendo: 22, radioMetros: 500 }, ...extra,
  });
  const fLtr = (arriendo: number, moneda: "CLP" | "UF") => buildFichaLtr({ input: inLtr(arriendo), results: null, medianaUfM2: 107.5, universoMediana: "nuevo", nMediana: 496, desviacionMediana: 3, direccion: "Av. Irarrázaval 401", comuna: "Ñuñoa", ufValue: 40861, moneda });
  const inStr = (extra: Record<string, unknown> = {}) => ({ precioCompra: 195746000, precioCompraUF: 5045, superficieUtil: 50, dormitorios: 2, banos: 1, tipoPropiedad: "usado", antiguedad: 4,
    capacidadHuespedes: 2, modoGestion: "administrador", comisionAdministrador: 0.25, costoAmoblamiento: 4550000, piePct: 20, tasaInteres: 4.11, plazoCredito: 25, adrOverride: null, occOverride: null, ...extra });
  const fStr = (moneda: "CLP" | "UF", extra: Record<string, unknown> = {}) => buildFichaStr({ input: inStr(extra), adrNoche: 74713, ocupacionZona: 0.4755, direccion: "Av. Providencia 1500", comuna: "Providencia", moneda });
  const fichas: [string, FichaDepto][] = [["LTR sugerido", fLtr(498000, "CLP")], ["LTR declarado", fLtr(750000, "UF")], ["STR", fStr("CLP")]];
  for (const [nombre, f] of fichas) {
    const h = html(createElement(FichaCuerpo, { ficha: f }));
    if (/<button|<a[\s>]/.test(h)) F(`7 · la ficha ${nombre} trae un botón o un link`);
    if (/cambiar|ajust|editar|modificar|corrig/i.test(h)) F(`7 · la ficha ${nombre} ofrece editar: «${(h.match(/[^>]*(cambiar|ajust|editar|modificar|corrig)[^<]*/i) ?? [""])[0]}»`);
    if (MONO_SERIF.test(h)) F(`10 · el HTML de la ficha ${nombre} trae una clase mono o serif`);
  }

  // ── 8 · etiquetas de procedencia ──
  const etiqueta = (f: FichaDepto, k: string) => f.grupos.flatMap((g) => g.filas).find((x) => x.k === k)?.etiqueta ?? null;
  if (etiqueta(fLtr(498000, "CLP"), "Arriendo") !== "sugerido") F("8 · un arriendo igual a la mediana sugerida no dice «sugerido»");
  if (etiqueta(fLtr(750000, "CLP"), "Arriendo") !== "declarado") F("8 · un arriendo distinto a la referencia no dice «declarado»");
  if (etiqueta(buildFichaLtr({ input: inLtr(750000, { zonaRadio: undefined }), results: null, medianaUfM2: null, direccion: "", comuna: "Ñuñoa", ufValue: 40861, moneda: "CLP" }), "Arriendo") !== "declarado") F("8 · un arriendo sin referencia no dice «declarado»");
  if (etiqueta(fStr("CLP"), "Tarifa por noche") !== "estimada" || etiqueta(fStr("CLP"), "Ocupación") !== "estimada") F("8 · tarifa u ocupación STR sin override no dicen «estimada»");
  if (etiqueta(fStr("CLP", { adrOverride: 80000, occOverride: 0.6 }), "Tarifa por noche") !== "definida") F("8 · una tarifa con override no dice «definida»");

  // ── 9 · CLP/UF ──
  const valores = (f: FichaDepto) => f.grupos.flatMap((g) => g.filas.map((x) => `${x.k}: ${x.v}`));
  const MONTOS = /^(Precio|Arriendo|Mediana de la zona|Gastos comunes|Pie|Cuotas del pie|Crédito|Amoblamiento|Tarifa por noche):/;
  for (const [nombre, f] of [["LTR", fLtr(498000, "UF")], ["LTR declarado", fLtr(750000, "UF")], ["STR", fStr("UF")]] as const) {
    const conPesos = valores(f).filter((v) => /\$/.test(v));
    if (conPesos.length) F(`9 · en UF la ficha ${nombre} deja montos en pesos: ${conPesos.join(" · ")}`);
    const sinMontoUf = valores(f).filter((v) => MONTOS.test(v) && !/UF /.test(v));
    if (sinMontoUf.length) F(`9 · en UF la ficha ${nombre} tiene montos sin UF: ${sinMontoUf.join(" · ")}`);
  }
  for (const [nombre, f] of [["LTR", fLtr(750000, "CLP")], ["STR", fStr("CLP")]] as const) {
    const sinPesos = valores(f).filter((v) => MONTOS.test(v) && !/^Precio por m²/.test(v) && !/\$/.test(v));
    if (sinPesos.length) F(`9 · en CLP la ficha ${nombre} tiene montos sin pesos: ${sinPesos.join(" · ")}`);
  }

  // ── 10 · sin mono ni serif en el código y el CSS de la ficha ──
  {
    const m = fichaSrc.match(MONO_SERIF);
    if (m) F(`10 · FichaModal.tsx usa «${m[0]}»`);
    for (const regla of leer("src/components/analysis/portada/PortadaInforme.tsx").match(/\.fa[-\w]*[^{]*\{[^}]*\}/g) ?? []) if (MONO_SERIF.test(regla)) F(`10 · el CSS de la ficha usa mono o serif: ${regla.slice(0, 60)}`);
  }

  // ── 11 · la carga de la página es la forma del informe, en las tres modalidades ──
  for (const ruta of ["src/app/analisis/[id]/loading.tsx", "src/app/analisis/renta-corta/[id]/loading.tsx", "src/app/analisis/comparativa/loading.tsx"]) {
    if (!existsSync(join(RAIZ, ruta))) { F(`11 · falta ${ruta}`); continue; }
    const src = sinComentarios(leer(ruta));
    if (!/<EsqueletoInforme\b/.test(src)) F(`11 · ${ruta} no monta EsqueletoInforme`);
    if (/LoadingEditorial/.test(src)) F(`11 · ${ruta} sigue usando LoadingEditorial`);
  }
  {
    const h = html(createElement(EsqueletoInforme));
    // Solo el CSS PROPIO del esqueleto (el que define `.esq-`): el de `DocTokens` es el del
    // informe entero y redefine `--font-mono` como Inter, así que nombrarlo no es usarlo.
    const css = (h.match(/<style[^>]*>([^]*?)<\/style>/g) ?? []).filter((b) => b.includes(".esq-")).join(" ");
    const visible = h.replace(/<style[^>]*>[^]*?<\/style>/g, "").replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, "").trim();
    if (visible) F(`11 · el esqueleto muestra texto: «${visible.slice(0, 80)}»`);
    const esqSrc = sinComentarios(leer("src/components/analysis/EsqueletoInforme.tsx"));
    if (/FrancoLogo|Wordmark|DocumentoFrame/.test(esqSrc)) F("11 · el esqueleto trae el logo (FrancoLogo, Wordmark o DocumentoFrame)");
    if (MONO_SERIF.test(h.replace(/<style[^>]*>[^]*?<\/style>/g, "") + css) || MONO_SERIF.test(esqSrc)) F("11 · el esqueleto usa mono o serif");
    if (!/aria-busy="true"/.test(h)) F("11 · el esqueleto no se declara ocupado (aria-busy) para lectores de pantalla");
  }

  if (fallas.length) {
    console.log(`  ✗ FICHA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — tu arriendo aparece con y sin referencia de radio; la lista guardada es la muestra de la mediana y solo existe si calza con el n; comparables abre en el Modal sin prosa, con la misma referencia que la card; la ficha abre en el Modal, de solo lectura, con su procedencia y en CLP/UF; y nada de las dos usa mono ni serif; y la carga de las tres modalidades es la forma del informe, sin texto");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFichaComparablesTier();
  process.exit(hard ? 1 : 0);
}
