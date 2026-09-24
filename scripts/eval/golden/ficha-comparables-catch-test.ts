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
// Verificado EN ROJO por mutación. Corre solo:
//   node --import tsx scripts/eval/golden/ficha-comparables-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildZonaLtr, buildZonaLtrR2, ZonaCeldasLtrR2 } from "../../../src/components/analysis/zona/ZonaLtr";
import { resumirComparablesRadio, median } from "../../../src/lib/services/comparables-radio";
import { leerMuestraArriendo } from "../../../src/lib/arriendo-referencia";
import { buildLtrPayload, type SubmitContext } from "../../../src/components/formulario-v4/wizardV4Submit";

// El JSX de los componentes compila a React.createElement bajo tsx: el global lo resuelve.
(globalThis as any).React = React;

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

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

  if (fallas.length) {
    console.log(`  ✗ FICHA-COMPARABLES · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — tu arriendo aparece con y sin referencia de radio; la lista guardada es la muestra de la mediana y solo existe si calza con el n");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFichaComparablesTier();
  process.exit(hard ? 1 : 0);
}
