/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// TIER REANALISIS — el informe completo al precio que Franco recomendó (21-oct-2026, decisión de Fabrizio)
//
// El botón «Analízalo a UF 3.131» del pop-up Ajustar no hacía nada: era un <span aria-disabled> desde el 13-sep-2026
// (d7bf2004), inerte por decisión hasta tener el precio en el wizard, la precarga del informe y la decisión del crédito.
// Ahora (lib/reanalisis.ts):
//   1 · EL BOTÓN NAVEGA. «Ver el informe completo a UF X» es un enlace al wizard con el informe de origen, el precio
//       recomendado y el pie y el plazo de la celda de Franco. Solo para el dueño (`reanalisisOrigen`), nunca en
//       Comprar. EN ROJO CON EL BOTÓN DE HOY: el <span aria-disabled> no tiene href.
//   2 · TODO PRECARGADO. El informe vuelve al wizard como respuestas (`respuestasDesdeInforme`), y armar el cuerpo con
//       ellas da el MISMO cuerpo que el informe de origen (ida y vuelta, LTR y STR); la recomendación cambia solo el
//       precio, el pie y el plazo. El wizard abre en el resumen y no ofrece el borrador.
//   3 · EL AVISO ANTES DE GASTAR es el del semanal (`textoUso`): «Usa tu análisis de regalo.» / «Usa 1 de tus N
//       análisis.». Sin saldo, la compra del suelto con el depto y el precio, y al pagar, al informe.
//   4 · EL INFORME NUEVO DICE ARRIBA «Analizado a UF X, el precio que Franco recomendó negociar» y enlaza al original.
//       El marcador lo valida el servidor (de la misma cuenta, al precio recomendado); si la persona cambia el precio,
//       se cae.
//   5 · `reanalisis_precio` en PostHog, una vez por informe: al crearlo con saldo, o al confirmarse el pago. Y el panel
//       de activación lo cuenta.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/reanalisis-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalysis } from "../../../src/lib/analysis";
import { AUDIT_FIXTURES, AUDIT_UF } from "../fixtures";
import { PopupAjustes } from "../../../src/components/analysis/shared/PopupAjustes";
import { celdaFranco, grillaDelPopup } from "../../../src/lib/matriz-popup";
import {
  REANALISIS_COPY, esAlPrecioRecomendado, leerPedidoReanalisis, leerReanalisis, precioRecomendadoUF, urlReanalisis, usoDesdeTier,
} from "../../../src/lib/reanalisis";
import { EVENTO_REANALISIS, eventoReanalisisPrecio } from "../../../src/lib/reanalisis-servidor";
import { conRecomendacion, respuestasDesdeInforme } from "../../../src/components/formulario-v4/wizardV4Reanalisis";
import { buildLtrPayload, buildStrPayload } from "../../../src/components/formulario-v4/wizardV4Payload";
import { textoUso } from "../../../src/lib/guia/aviso-analizar";
import { resumenCompra } from "../../../src/lib/compra/compra";
import { RUTA_WIZARD } from "../../../src/lib/cta-analizar";
import type { HallazgoDistanciaVeredicto, Veredicto } from "../../../src/lib/types";

(globalThis as any).React = React;
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(tenés|querés|podés|mirá|confirmá|usá|analizá|pagá|negociá|vos)(?![a-záéíóúñ])/i;
const ORIGEN = "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";
const NUEVO = "0b6f2b8e-3c1d-4f5a-9e7d-2a4c6e8f1b3d";
const html = (s: string) => s.replace(/&/g, "&amp;");
/** El trozo de `s` entre dos marcas (la primera aparición de cada una, en orden). Vacío si falta alguna. */
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};

export function runReanalisisTier(): { hard: number } {
  console.log("\n─── TIER REANALISIS (el informe completo al precio recomendado · lib/reanalisis.ts · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · El botón navega: un enlace al wizard con la recomendación de Franco ──
  const fecha = new Date("2026-09-24T12:00:00Z");
  const filas = AUDIT_FIXTURES.filter((f: any) => f.ltrInput).map((f: any) => {
    const res: any = runAnalysis(f.ltrInput, AUDIT_UF, f.ltrMediana, fecha);
    const dist = (res.hallazgos ?? []).find((h: any) => h?.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined;
    return { id: f.id as string, input: f.ltrInput, res, v: res.veredicto as Veredicto, dist: dist ?? null };
  });
  const render = (r: (typeof filas)[number], origen: string | null) =>
    renderToStaticMarkup(createElement(PopupAjustes, {
      veredicto: r.v, modalidad: "LTR", distancia: r.dist, mixComprar: r.res.mixComprar ?? null, currency: "CLP", valorUF: AUDIT_UF,
      precioUF: Number(r.input.precio), antes: null, reanalisisOrigen: origen,
    }));
  let conBoton = 0;
  for (const r of filas) {
    if (r.v === "BUSCAR OTRA") continue;
    const grilla = grillaDelPopup({ veredicto: r.v, distancia: r.dist, mixComprar: r.res.mixComprar ?? null });
    if (!grilla?.celdas?.length) continue;
    const fr = celdaFranco({ veredicto: r.v, distancia: r.dist, grilla });
    const h = render(r, ORIGEN);
    if (r.v === "COMPRAR" || !fr || !((fr.descuentoPct ?? 0) > 0)) {
      if (/data-reanalisis|Ver el informe completo/.test(h)) F(`1 · ${r.id} (${r.v}): hay botón de re-análisis sin una recomendación de Franco con descuento`);
      continue;
    }
    conBoton++;
    const precio = Number(r.input.precio);
    const uf = Math.round(precio * (1 - (fr.descuentoPct ?? 0) / 100));
    const href = html(`${RUTA_WIZARD}?reanalisis=${ORIGEN}&precio=${uf}&pie=${fr.piePct}&plazo=${fr.plazoAnios}`);
    const enlace = h.match(/<a\b[^>]*data-reanalisis[^>]*>([\s\S]*?)<\/a>/);
    if (!enlace) F(`1 · ${r.id}: la recomendación de Franco (−${fr.descuentoPct}%, pie ${fr.piePct}% · ${fr.plazoAnios} años) no tiene un enlace: el botón no lleva a ninguna parte`);
    else {
      if (!enlace[0].includes(`href="${href}"`)) F(`1 · ${r.id}: el botón no lleva al wizard con el informe, UF ${uf}, pie ${fr.piePct} y plazo ${fr.plazoAnios} (${enlace[0].match(/href="([^"]*)"/)?.[1] ?? "sin href"})`);
      if (enlace[1].replace(/<[^>]+>/g, "").trim() !== REANALISIS_COPY.boton(uf) || REANALISIS_COPY.boton(uf) !== `Ver el informe completo a UF ${uf.toLocaleString("es-CL")}`) F(`1 · ${r.id}: el botón no dice «Ver el informe completo a UF ${uf.toLocaleString("es-CL")}»`);
    }
    if (/aria-disabled/.test(h) || /Analízalo a UF/.test(h)) F(`1 · ${r.id}: volvió el botón inerte «Analízalo a UF…»`);
    if (precioRecomendadoUF(precio, fr.descuentoPct ?? 0) !== uf) F(`1 · ${r.id}: el precio del botón no es el pedido con el descuento de la celda de Franco`);
    // «Si consigues el precio de la recomendación, el informe cambia entero»: el mismo depto a ese precio, con ese pie y
    // ese plazo, da Comprar (medido el 21-oct-2026 en las 8 filas Ajustar del golden con celda de Franco).
    const alPrecio: any = runAnalysis({ ...r.input, precio: uf, piePct: fr.piePct, plazoCredito: fr.plazoAnios }, AUDIT_UF, (AUDIT_FIXTURES.find((f: any) => f.id === r.id) as any)?.ltrMediana, fecha);
    if (alPrecio.veredicto !== "COMPRAR") F(`1 · ${r.id}: a UF ${uf}, pie ${fr.piePct}% y ${fr.plazoAnios} años el informe dice ${alPrecio.veredicto}, no Comprar (el botón promete otro informe)`);
    // Sin el informe de origen (quien no es dueño, el enlace compartido), no hay botón.
    if (/data-reanalisis|Ver el informe completo/.test(render(r, null))) F(`1 · ${r.id}: el botón aparece sin el informe de origen (lo vería quien no es dueño)`);
  }
  if (conBoton === 0) F("1 · ninguna fila del golden tiene recomendación de Franco con descuento: el botón no se midió");
  // Lo pasan los dos heros, solo para el dueño.
  const rc = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
  const rcStr = sinComentarios(leer("src/app/analisis/renta-corta/[id]/results-client.tsx"));
  if (!/reanalisisOrigen=\{isLoggedIn && !isSharedView && !isSharedLink && analysisId \? analysisId : null\}/.test(rc)) F("1 · el informe de renta larga no le pasa su id al pop-up, o se lo pasa a quien no es dueño");
  if (!/reanalisisOrigen=\{userId && !isSharedView && analysisId \? analysisId : null\}/.test(rcStr)) F("1 · el informe de renta corta no le pasa su id al pop-up, o se lo pasa a quien no es dueño");
  const sg = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  const hl = sinComentarios(leer("src/components/analysis/HeroLTR.tsx"));
  const hs = sinComentarios(leer("src/components/analysis/str/HeroStrDictamen.tsx"));
  if (!/<HeroLTR[\s\S]*?reanalisisOrigen=\{reanalisisOrigen\}/.test(sg) || !/<PopupAjustes[\s\S]*?reanalisisOrigen=\{reanalisisOrigen\}/.test(hl) || !/<PopupAjustes[\s\S]*?reanalisisOrigen=\{reanalisisOrigen\}/.test(hs)) F("1 · el id del informe no llega al pop-up por los heros (SubjectCardGrid → HeroLTR → PopupAjustes; HeroStrDictamen → PopupAjustes)");

  // ── 1b · La URL, ida y vuelta, y lo que no es un re-análisis ──
  const pedido = { origenId: ORIGEN, precioUF: 3131, piePct: 25, plazoAnios: 30 };
  const url = urlReanalisis(pedido);
  const leido = leerPedidoReanalisis(new URLSearchParams(url.split("?")[1]));
  if (!url.startsWith(`${RUTA_WIZARD}?`) || JSON.stringify(leido) !== JSON.stringify(pedido)) F(`1 · la URL del botón no se lee de vuelta igual (${JSON.stringify(leido)})`);
  for (const q of ["reanalisis=no-es-un-id&precio=3131&pie=25&plazo=30", `reanalisis=${ORIGEN}&precio=0&pie=25&plazo=30`, `reanalisis=${ORIGEN}&precio=3131&pie=25&plazo=17`, `reanalisis=${ORIGEN}&precio=3131&pie=120&plazo=30`, `reanalisis=${ORIGEN}&pie=25&plazo=30`]) {
    if (leerPedidoReanalisis(new URLSearchParams(q)) !== null) F(`1 · «?${q}» se lee como re-análisis`);
  }

  // ── 2 · Todo precargado: el informe vuelve al wizard y arma el mismo cuerpo ──
  const ctx: any = { ufCLP: 39500, tasaMercado: 4.72, arriendoSugerido: 690000, arriendoN: 18, arriendoFuente: "radio", arriendoRango: null, muestraArriendo: null, precioM2UF: 82, radiusUsed: 600, ggccSugerido: 95000, ventaN: 22, ventaFuente: "radio", ventaUniverso: "usado", ventaRadio: 600 };
  const baseDepto: any = { direccion: "Av. Providencia 1234, Providencia", direccionConfirmada: "Av. Providencia 1234, Providencia", lat: -33.4263, lng: -70.6152, ubicacionPrecision: "numero", comuna: "Providencia", ciudad: "Santiago" };
  const casosLtr: Array<[string, any]> = [
    ["usado, arriendo estimado, con administrador", { ...baseDepto, modalidad: "ltr", tipoPropiedad: "usado", antiguedad: "6-10", superficieUtil: "58,5", dormitorios: "2", banos: "2", estacionamientos: "1", bodegas: "1", precio: "3480", pieUnidad: "pct", pieMonto: "20", plazoCredito: "30", tasaInteres: "4,35", tasaModo: "preaprobada", arrModo: "estimacion", vacanciaPct: "8", amoblado: "si", comisionAdminPct: "7" }],
    ["obra nueva en verde, studio, arriendo corregido, contribuciones declaradas", { ...baseDepto, modalidad: "ltr", tipoPropiedad: "nuevo", estadoVenta: "futura", fechaEntregaAnio: "2027", fechaEntregaMes: "06", cuotasPie: "24", esStudio: true, dormitorios: "0", banos: "1", superficieUtil: "32", precio: "2650,5", pieUnidad: "pct", pieMonto: "10", plazoCredito: "25", tasaInteres: "4,72", tasaModo: "estimada", arrModo: "corregir", arriendo: "520000", gastosComunes: "78000", contribuciones: "61000", amoblado: "no" }],
    ["pie cero con bono pie", { ...baseDepto, modalidad: "ltr", tipoPropiedad: "usado", antiguedad: "20+", superficieUtil: "71", dormitorios: "3", banos: "2", precio: "4100", pieUnidad: "pct", pieMonto: "0", pieRazon: "bono_pie", plazoCredito: "20", tasaInteres: "4,9", tasaModo: "preaprobada", arrModo: "corregir", arriendo: "890000", amoblado: "no" }],
  ];
  for (const [nombre, a] of casosLtr) {
    const p1: any = buildLtrPayload(a, ctx);
    const vuelta = respuestasDesdeInforme(p1, "long-term");
    const p2: any = buildLtrPayload(vuelta.respuestas, ctx);
    if (JSON.stringify(p2) !== JSON.stringify(p1)) {
      const dif = Object.keys({ ...p1, ...p2 }).filter((k) => JSON.stringify(p1[k]) !== JSON.stringify(p2[k]));
      F(`2 · LTR «${nombre}»: el informe de vuelta al wizard no arma el mismo cuerpo (${dif.join(", ")})`);
    }
    if (vuelta.precioUF !== p1.precio) F(`2 · LTR «${nombre}»: el precio original no vuelve (${vuelta.precioUF} ≠ ${p1.precio})`);
    for (const k of ["dir", "tipo", "tam", "precio", "pie", "tasa", "plazo", "mod", "arr", a.tipoPropiedad === "nuevo" ? "ent" : "ant"]) {
      if (!(vuelta.completadas as any)[k]) F(`2 · LTR «${nombre}»: la pantalla «${k}» no queda respondida (el resumen la pediría de nuevo)`);
    }
    // La recomendación cambia el precio, el pie y el plazo, y nada del depto.
    const rec = { precioUF: Math.round(p1.precio * 0.9), piePct: 25, plazoAnios: 30 };
    const p3: any = buildLtrPayload(conRecomendacion(vuelta.respuestas, rec), ctx);
    if (p3.precio !== rec.precioUF || p3.piePct !== rec.piePct || p3.plazoCredito !== rec.plazoAnios) F(`2 · LTR «${nombre}»: la recomendación no queda puesta (precio ${p3.precio}, pie ${p3.piePct}, plazo ${p3.plazoCredito})`);
    for (const k of ["direccion", "comuna", "ubicacionPrecision", "dormitorios", "esStudio", "banos", "superficie", "antiguedad", "esNuevo", "estadoVenta", "fechaEntrega", "cantidadEstacionamientos", "cantidadBodegas", "arriendo", "gastos", "tasaInteres", "vacanciaMeses", "amoblado", "comisionAdministrador", "zonaRadio"]) {
      if (JSON.stringify(p3[k]) !== JSON.stringify(p1[k])) F(`2 · LTR «${nombre}»: la recomendación cambió «${k}» del depto`);
    }
    if (p3.razonSinPie !== undefined) F(`2 · LTR «${nombre}»: con pie ${rec.piePct}% el cuerpo sigue con razón de pie cero`);
  }
  const conPieCero = conRecomendacion(respuestasDesdeInforme(buildLtrPayload(casosLtr[2][1], ctx) as any, "long-term").respuestas, { precioUF: 3900, piePct: 0, plazoAnios: 30 });
  if (conPieCero.pieRazon !== "bono_pie") F("2 · con pie cero la recomendación pierde la razón que dio la persona");
  const conPie = conRecomendacion({ ...conPieCero, otraFuenteMonto: "300" } as any, { precioUF: 3900, piePct: 20, plazoAnios: 30 });
  if (conPie.pieRazon !== undefined || (conPie as any).otraFuenteMonto !== undefined) F("2 · con pie la recomendación arrastra la razón del pie cero o el monto de otra fuente del origen (el resumen los mostraría)");
  const casosStr: Array<[string, any]> = [
    ["con administrador, tarifa corregida, costos propios", { ...baseDepto, modalidad: "str", tipoPropiedad: "usado", antiguedad: "3-5", superficieUtil: "45", dormitorios: "1", banos: "1", capacidadHuespedes: "4", precio: "3150", pieUnidad: "pct", pieMonto: "20", plazoCredito: "25", tasaInteres: "4,5", modoGestion: "administrador", comisionStrPct: "18", adrModo: "corregir", adrTarifa: "55000", adrOcupacion: "62,5", costosOperativos: "90000", mantencionStr: "25000", estaAmoblado: true, costoAmoblamiento: "3500000" }],
    ["obra nueva inmediata, todo estimado", { ...baseDepto, modalidad: "str", tipoPropiedad: "nuevo", estadoVenta: "inmediata", superficieUtil: "38", dormitorios: "1", banos: "1", capacidadHuespedes: "3", precio: "2800", pieUnidad: "pct", pieMonto: "15", plazoCredito: "30", tasaInteres: "4,72", modoGestion: "auto", adrModo: "estimacion" }],
  ];
  for (const [nombre, a] of casosStr) {
    const p1: any = buildStrPayload(a, ctx);
    const vuelta = respuestasDesdeInforme(p1, "short-term");
    const p2: any = buildStrPayload(vuelta.respuestas, ctx);
    if (JSON.stringify(p2) !== JSON.stringify(p1)) {
      const dif = Object.keys({ ...p1, ...p2 }).filter((k) => JSON.stringify(p1[k]) !== JSON.stringify(p2[k]));
      F(`2 · STR «${nombre}»: el informe de vuelta al wizard no arma el mismo cuerpo (${dif.join(", ")})`);
    }
    if (vuelta.respuestas.modalidad !== "str" || !(vuelta.completadas as any).adr) F(`2 · STR «${nombre}»: vuelve sin la modalidad o sin la tarifa respondida`);
    const p3: any = buildStrPayload(conRecomendacion(vuelta.respuestas, { precioUF: 2700, piePct: 30, plazoAnios: 20 }), ctx);
    if (p3.precioCompraUF !== 2700 || p3.piePct !== 30 || p3.plazoCredito !== 20) F(`2 · STR «${nombre}»: la recomendación no queda puesta`);
  }
  // El wizard: la URL → el informe propio → la recomendación encima → el resumen, sin ofrecer el borrador.
  const pg = sinComentarios(leer("src/app/analisis/nuevo-v4/page.tsx"));
  const wz = sinComentarios(leer("src/components/formulario-v4/WizardV4.tsx"));
  const hk = sinComentarios(leer("src/components/formulario-v4/useWizardV4.ts"));
  const ruta = sinComentarios(leer("src/app/api/analisis/reanalisis/route.ts"));
  if (!/leerPedidoReanalisis\(searchParams\)/.test(pg) || !/reanalisis=\{reanalisis\}/.test(pg)) F("2 · el wizard no lee el re-análisis de la URL");
  if (!/fetch\(`\/api\/analisis\/reanalisis\?origen=\$\{encodeURIComponent\(reanalisis\.origenId\)\}`\)/.test(wz) || !/w\.cargarRespuestas\(conRecomendacion\(r\.respuestas, reanalisis\), r\.completadas \?\? \{\}\)/.test(wz)) F("2 · el wizard no carga el informe de origen con la recomendación encima");
  if (!/useState\(!!reanalisis\)/.test(wz) || !/\{reanalisisEsperando \? \(\s*<p className="wz-indic" role="status" data-reanalisis-cargando>Cargando el depto de tu informe…<\/p>\s*\) : \(\s*<>\s*<h1 className="wz-titulo">\{NODE_TITLE\[nav\.current\]\}<\/h1>\s*\{esPortada \? \(/.test(wz) || !/setReanalisisEsperando\(false\);/.test(wz)) F("2 · mientras llega el informe de origen el wizard muestra la portada (la persona ve «¿Dónde está el depto?» antes del resumen)");
  if (!/if \(reanalisis\) return;\s*if \(!w\.inicializado \|\| !w\.draftPendiente/.test(wz)) F("2 · el re-análisis no apaga la oferta del borrador (la persona tendría que elegir antes de confirmar)");
  if (!/setNav\(\{ current: "resumen", history: \[\], answers, completed,/.test(hk)) F("2 · `cargarRespuestas` no abre el wizard en el resumen");
  if (!/\.eq\("id", origen\)\s*\.eq\("user_id", user\.id\)/.test(ruta) || !/status: 401/.test(ruta) || !/respuestasDesdeInforme\(/.test(ruta)) F("2 · /api/analisis/reanalisis no exige sesión y dueño, o no arma las respuestas con `respuestasDesdeInforme`");

  // ── 3 · El aviso antes de gastar, el del semanal; sin saldo, la compra con el depto y el precio ──
  const avisos: Array<[Parameters<typeof usoDesdeTier>[0], string]> = [
    [{ credits: 0, welcomeAvailable: true }, "Usa tu análisis de regalo."],
    [{ credits: 1, proximoRegalo: true }, "Usa tu análisis de regalo."],
    [{ credits: 3 }, "Usa 1 de tus 3 análisis."],
    [{ credits: 3, welcomeAvailable: true }, "Usa 1 de tus 3 análisis."],
    [{ credits: 1 }, "Usa tu último análisis."],
  ];
  for (const [t, esperado] of avisos) if (textoUso(usoDesdeTier(t)) !== esperado) F(`3 · con ${JSON.stringify(t)} el aviso dice «${textoUso(usoDesdeTier(t))}», no «${esperado}»`);
  if (usoDesdeTier({ isUnlimited: true, credits: 0 }).tipo !== "plan" || usoDesdeTier({ isAdmin: true, credits: 0 }).tipo !== "plan" || usoDesdeTier({ credits: 0 }).tipo !== "sin") F("3 · el plan o el saldo en cero no se leen como tales");
  const rs = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/const marcaReanalisis = reanalisis && isLoggedIn && mod !== "both" && esAlPrecioRecomendado\(leerNum\(a\.precio, DEC\.precioUF\), reanalisis\) \? reanalisis : null;/.test(rs)) F("3 · el resumen no ata el marcador al precio recomendado (o lo manda en el comparativo)");
  if (!/const consumo = marcaReanalisis && canAnalyze \? textoUso\(usoDesdeTier\(tier\)\) : lineaConsumo\(/.test(rs)) F("3 · el resumen del re-análisis no dice el aviso del semanal antes de gastar");
  if (!/submitConCredito\(a, ctx, marcaReanalisis \? \{ reanalisis: marcaReanalisis \} : \{\}\)/.test(rs) || !/comprarLocked\(a, ctx, marcaReanalisis \? \{ reanalisis: marcaReanalisis \} : \{\}\)/.test(rs)) F("3 · el marcador no viaja en el cuerpo, con saldo o sin él");
  // Por función: `submitAnonimo` tiene la MISMA línea con su propio `extra` (el token de Turnstile), así que buscarla en
  // el archivo entero la daba por cableada aunque el envío con crédito la perdiera (mutación R33, 21-oct-2026).
  const sub = sinComentarios(leer("src/components/formulario-v4/wizardV4Submit.ts"));
  const conCredito = entre(sub, "export async function submitConCredito(", "export async function submitAnonimo(");
  const locked = entre(sub, "export async function comprarLocked(", "\n}\n");
  if (!/extra: Record<string, unknown> = \{\}/.test(conCredito) || !/postJson\("\/api\/analisis", \{ \.\.\.buildLtrPayload\(a, ctx\), \.\.\.extra \}\)/.test(conCredito) || !/postJson\("\/api\/analisis\/short-term", \{ \.\.\.buildStrPayload\(a, ctx\), \.\.\.extra \}\)/.test(conCredito)) F("3 · el envío con saldo no suma el marcador al cuerpo de una modalidad");
  if (!/extra: Record<string, unknown> = \{\}/.test(locked) || !/const payload = \{ \.\.\.\(mod === "str" \? buildStrPayload\(a, ctx\) : buildLtrPayload\(a, ctx\)\), \.\.\.extra \};/.test(locked)) F("3 · la compra sin saldo no suma el marcador al cuerpo");
  const compra = resumenCompra("single", { analysisId: NUEVO, comuna: "Providencia", reanalisis: { direccion: "Av. Providencia 1234", precioUF: 3131 } });
  if (compra?.nombre !== "Tu análisis de Av. Providencia 1234" || compra?.incluye !== "El informe completo de este depto a UF 3.131, el precio que Franco recomendó negociar.") F(`3 · la compra no dice el depto y el precio («${compra?.nombre}» · «${compra?.incluye}»)`);
  const sinMarca = resumenCompra("single", { analysisId: NUEVO, comuna: "Providencia" });
  if (sinMarca?.nombre === compra?.nombre || /recomendó/.test(sinMarca?.incluye ?? "")) F("3 · la compra de un análisis cualquiera habla del precio recomendado");
  const co = sinComentarios(leer("src/app/checkout/page.tsx"));
  if (!/\.select\("comuna, input_data"\)/.test(co) || !/const marca = leerReanalisis\(/.test(co) || !/resumenCompra\(productKey, \{ analysisId, companionStrId, comuna, reanalisis \}\)/.test(co)) F("3 · /checkout no lee el marcador del análisis atado");
  const ret = sinComentarios(leer("src/app/payments/return/page.tsx"));
  if (!/router\.push\(`\/analisis\/\$\{data\.payment\.analysis_id\}`\);/.test(ret)) F("3 · al pagar el suelto no sigue solo al análisis");

  // ── 4 · El informe nuevo lo dice arriba y enlaza al original; el servidor valida el marcador ──
  if (REANALISIS_COPY.linea(3131) !== "Analizado a UF 3.131, el precio que Franco recomendó negociar" || REANALISIS_COPY.original !== "Ver el informe original") F("4 · la línea del informe nuevo no es la pedida");
  const idr = sinComentarios(leer("src/components/analysis/InformeDeReanalisis.tsx"));
  if (!/\{REANALISIS_COPY\.linea\(reanalisis\.precioRecomendadoUF\)\}\.\{" "\}\s*<EnlaceCarga href=\{original\}/.test(idr) || !/modalidad === "str" \? `\/analisis\/renta-corta\/\$\{reanalisis\.origenId\}` : `\/analisis\/\$\{reanalisis\.origenId\}`/.test(idr)) F("4 · el informe nuevo no dice la línea con el enlace al original");
  if (!/: marcaReanalisis \? \(\s*<InformeDeReanalisis reanalisis=\{marcaReanalisis\} modalidad="ltr" \/>/.test(rc) || !/const marcaReanalisis = leerReanalisis\(/.test(rc)) F("4 · el informe de renta larga no monta la línea arriba");
  if (!/\{!origenAviso && marcaReanalisis && \(\s*<SeccionInforme id="origen-reanalisis"[^>]*>\s*<InformeDeReanalisis reanalisis=\{marcaReanalisis\} modalidad="str" \/>/.test(rcStr)) F("4 · el informe de renta corta no monta la línea arriba");
  const marca = { origenId: ORIGEN, precioOriginalUF: 3480, precioRecomendadoUF: 3131, piePct: 25, plazoAnios: 30 };
  if (JSON.stringify(leerReanalisis(marca)) !== JSON.stringify(marca)) F("4 · un marcador válido no se lee");
  for (const malo of [{ ...marca, origenId: "x" }, { ...marca, precioRecomendadoUF: 3600 }, { ...marca, precioOriginalUF: 0 }, null, "3131"]) if (leerReanalisis(malo) !== null) F(`4 · el marcador ${JSON.stringify(malo)} se acepta`);
  if (!esAlPrecioRecomendado(3131, marca) || !esAlPrecioRecomendado(3131.4, marca) || esAlPrecioRecomendado(3200, marca)) F("4 · si la persona cambia el precio, el informe igual diría «el precio que Franco recomendó»");
  const ra = sinComentarios(leer("src/app/api/analisis/route.ts"));
  const rst = sinComentarios(leer("src/app/api/analisis/short-term/route.ts"));
  const rl = sinComentarios(leer("src/app/api/analisis/locked/route.ts"));
  const srv = sinComentarios(leer("src/lib/reanalisis-servidor.ts"));
  if (!/const reanalisis = await sanearReanalisis\(supabase, user\?\.id, body as unknown as Record<string, unknown>, Number\(body\.precio\)\);/.test(ra)) F("4 · /api/analisis no valida el marcador");
  if (!/const reanalisis = ambasGroupId \? null : await sanearReanalisis\(supabase, user\?\.id, body as Record<string, unknown>, Number\(body\?\.precioCompraUF\)\);/.test(rst) || !/if \(ambasGroupId\) delete \(body as Record<string, unknown>\)\.reanalisis;/.test(rst)) F("4 · /api/analisis/short-term no valida el marcador, o lo deja en el comparativo");
  if (!/await sanearReanalisis\(supabase, user\.id, crudo, Number\(isStr \? crudo\.precioCompraUF : crudo\.precio\)\);/.test(rl) || !/delete \(p as Record<string, unknown>\)\.reanalisis;/.test(rl)) F("4 · /api/analisis/locked no valida el marcador, o lo deja en el comparativo");
  if (!/\.eq\("id", r\.origenId\)\.eq\("user_id", userId\)/.test(srv) || !/!esAlPrecioRecomendado\(precioUF, r\)\) return null;/.test(srv) || !/if \(r\) body\.reanalisis = r;\s*else delete body\.reanalisis;/.test(srv)) F("4 · el servidor no exige que el informe de origen sea de la cuenta y el precio el recomendado");

  // ── 5 · `reanalisis_precio`, una vez por informe, y el panel lo cuenta ──
  const ev = eventoReanalisisPrecio({ userId: "u-1", analysisId: NUEVO, r: marca, modalidad: "ltr", conPago: false });
  const ev2 = eventoReanalisisPrecio({ userId: "u-1", analysisId: NUEVO, r: marca, modalidad: "ltr", conPago: true });
  const pr = ev.properties as Record<string, unknown>;
  if (EVENTO_REANALISIS !== "reanalisis_precio" || ev.event !== "reanalisis_precio" || ev.distinctId !== "u-1") F("5 · el evento no se llama «reanalisis_precio» o no es de la persona");
  if (pr.informe_original !== ORIGEN || pr.informe_nuevo !== NUEVO || pr.precio_original_uf !== 3480 || pr.precio_recomendado_uf !== 3131 || pr.descuento_pct !== 10 || pr.pie_pct !== 25 || pr.plazo_anios !== 30 || pr.modalidad !== "ltr" || pr.con_pago !== false) F(`5 · el evento no lleva el informe original, el precio original y el recomendado (${JSON.stringify(pr)})`);
  if (!ev.uuid || ev.uuid !== ev2.uuid) F("5 · el evento no tiene un uuid por informe (un reenvío del pago lo duplicaría)");
  if (!/via: reanalisis \? "reanalisis" : "wizard"/.test(ra) || !/if \(reanalisis\) waitUntil\(capturarReanalisis\(\{ userId: user\.id, analysisId: data\.id as string, r: reanalisis, modalidad: "ltr", conPago: false \}\)\);/.test(ra)) F("5 · /api/analisis no manda «reanalisis_precio» al crear con saldo");
  if (!/if \(reanalisis\) waitUntil\(capturarReanalisis\(\{ userId: user\.id, analysisId: data\.id as string, r: reanalisis, modalidad: "str", conPago: false \}\)\);/.test(rst)) F("5 · /api/analisis/short-term no manda «reanalisis_precio» al crear con saldo");
  // ⛔ ACTA 21-oct-2026 · el informe que abre el pago se movió de payments/confirm a `abrirInformePagado`
  // (lib/desbloqueo-pago.ts, tier PANEL-ACTIVACION): la regla es la misma, se lee de ahí y de que confirm lo llame.
  const cf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  const dp = sinComentarios(leer("src/lib/desbloqueo-pago.ts"));
  if (!/const r = leerReanalisis\(f\?\.input_data\?\.reanalisis\);\s*if \(r\) await \(deps\.contarReanalisis \?\? capturarReanalisis\)\(\{ userId, analysisId, r, modalidad: f\?\.tipo_analisis === "short-term" \? "str" : "ltr", conPago: true \}\);/.test(dp) || !/await abrirInformePagado\(supabase, \{ userId, analysisId, companionStrId \}\);/.test(cf)) F("5 · al confirmarse el pago del suelto no sale «reanalisis_precio»");
  const doc = leer("docs/posthog-activacion-por-puerta.md");
  if (!/`reanalisis_precio`/.test(doc) || !/event = 'reanalisis_precio'/.test(doc)) F("5 · el panel de activación no cuenta los informes que salen del re-análisis (docs/posthog-activacion-por-puerta.md)");

  // ── voz ──
  for (const t of [REANALISIS_COPY.boton(3131), REANALISIS_COPY.linea(3131), REANALISIS_COPY.original, REANALISIS_COPY.compraIncluye(3131)]) if (VOSEO.test(t)) F(`voz · «${t}» tiene voseo`);

  if (fallas.length) {
    console.log(`  ✗ REANALISIS · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
    if (fallas.length > 40) console.log(`     · … y ${fallas.length - 40} más`);
  } else {
    console.log(`  ✓ VERDE — el botón de la recomendación lleva al wizard con todo puesto (${conBoton} filas del golden), el informe vuelve al wizard y arma el mismo cuerpo (${casosLtr.length} LTR, ${casosStr.length} STR), el aviso del semanal antes de gastar, la compra con el depto y el precio, la línea arriba con el original, el marcador validado y «reanalisis_precio» una vez por informe`);
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (21-oct-2026) — 40 mutaciones, cada una restaurada byte a byte; todas ROJAS:
//   R1  EL BOTÓN DE HOY: el <span aria-disabled>«Analízalo a UF…» de vuelta (también rojo en POPUP-AJUSTES §8)
//   R2  pie y plazo cambiados en la URL · R3 el precio sin descuento · R4 el botón sin informe de origen · R5 el id a
//       quien no es dueño · R32 cualquier plazo se lee como re-análisis · R36/R37 los heros no pasan el id al pop-up
//   R6  el arriendo no vuelve · R7 la antigüedad 8 → «3-5» · R8 las contribuciones declaradas se re-estiman · R9 la
//       tarifa corregida STR no vuelve · R10 los costos propios STR no vuelven · R11 la recomendación no pone el pie ·
//       R12 con pie arrastra la razón del pie cero · R13 ofrece el borrador · R14 abre en «precio» y no en el resumen ·
//       R38 la portada mientras carga · R34 /api/analisis/reanalisis sin dueño
//   R15 el resumen sin el aviso del semanal · R16 sin «proximoRegalo» · R17 el welcome antes que el saldo · R18 la compra
//       sin el depto ni el precio · R19 /checkout no lee el marcador · R33/R33b el envío con saldo sin el marcador (LTR,
//       STR) · R33c la compra sin el marcador
//   R20 otra línea · R21 el enlace al original va al dashboard · R22 renta corta no monta la línea · R23 un precio
//       recomendado mayor que el original · R24 cualquier precio es «el recomendado» · R25 sin el dueño del origen · R26
//       el marcador queda en el comparativo · R35 /api/analisis/locked no lo valida
//   R27 el precio original del evento es el recomendado · R28 un uuid por pago y no por informe · R29 el pago no lo
//       emite · R30 `analisis_creado` sin via = reanalisis · R31 el panel no lo cuenta
// R33 salió VERDE la primera vez: `submitAnonimo` tiene la misma línea con su propio `extra` (el token de Turnstile) y
// el regex sobre el archivo entero la daba por cableada. Ahora se mira dentro de cada función (`entre`).

if (require.main === module) {
  const { hard } = runReanalisisTier();
  process.exit(hard ? 1 : 0);
}
