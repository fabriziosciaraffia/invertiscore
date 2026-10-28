// ============================================================================
// TIER EXPLORAR-PORTAL — Explorar como portal (28-oct-2026, docs/puerta-b-mockups/5b-explorar-portal.html, estados A-D)
//
//   1 · LA VISTA GLOBAL SIN FILTROS DEL PERFIL: sin nada en la URL, todo Gran Santiago, arriendo tradicional, pie 20 % y
//       25 años (los supuestos del número de anoche), todas las comunas, tipologías y precios; la página no lee el perfil
//       para abrir y el primer pintado dice «N convienen en Gran Santiago» con la línea de los supuestos, aunque la cuenta
//       tenga una búsqueda guardada. «Mi búsqueda» aplica el perfil entero de una vez, solo si se toca.
//   2 · LA TARJETA DEL PIN SIN LAS LÍNEAS RETIRADAS: la imagen, comuna · tipología · m² · Usado/Nuevo, el precio, el
//       veredicto con el puntaje, el flujo, cap rate y UF por m², el corazón y «Analizar este»; sin «visto publicado», sin
//       «revisado con pie y plazo», sin la caja gris.
//   3 · LA FOTO DE CALLE SOLO A MENOS DE 40 METROS, Y SI NO EL MAPA CHICO: metadata por coordenadas (exterior, 40 m), de
//       Google, cámara hacia el punto, etiqueta «Vista de la calle» y nunca «el edificio»; lo demás, el mapa estático con el
//       pin; la respuesta queda guardada 30 días y un rechazo de Google no se guarda.
//   4 · SIN SALDO SE EXPLORA Y EL COBRO SALE AL ANALIZAR: nada se cierra sin saldo; «Analizar este» abre el pop-up de compra
//       de siempre; el aviso «Para explorar necesitas análisis disponibles» y el mapa cerrado ya no existen.
//   5 · «AVÍSAME DE NUEVOS» GUARDA EL PERFIL: los filtros activos pasan a `perfil_busqueda` (lo que leen el semanal y la
//       selección diaria), la confirmación dice cuál reemplaza, y sin comunas no guarda.
//   6 · LOS FILTROS, LA URL Y EL ORDEN (en el navegador, al instante) · 7 · EL UNIVERSO (la noche en un pedido, lo calculado
//       por comuna, la renta corta por zona) · 8 · EL PIN CON ZOOM · 9 · EL PLAN DONDE SE USA · 10 · LA MEDICIÓN ·
//   11 · LOS GUARDADOS EN EL DASHBOARD · 12 · EL PRIMER PINTADO LIVIANO.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-portal-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";
import * as calle from "../../../src/lib/explorar/calle";
import * as gu from "../../../src/lib/explorar/guardados";
import { PIE_DEPTOS, PLAZO_DEPTOS } from "../../../src/lib/deptos/estandar";
import { COMUNAS_DISPONIBLES } from "../../../src/lib/comunas-disponibles";
import { PLAN_ANALISIS_MES, PLAN_PRECIO_CLP, RUTA_PLAN } from "../../../src/lib/planes";
import { validarCambiosPerfil } from "../../../src/lib/perfil-busqueda";
import { comprasDeExplorar } from "../../../src/lib/guia/compra-desde-depto";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up va por un portal del navegador: acá el portal se dibuja en línea (como PUERTA-B-DASHBOARD). */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujar(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}

/** Una base de mentira: filtra por eq/in sobre las filas dadas, anota lo escrito y los filtros, responde las RPC. */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, rpcRes: Record<string, unknown> = {}) {
  const escrito: Array<{ tabla: string; op: string; filas: unknown; opts?: unknown }> = [];
  const filtros: Array<[string, string, string, unknown]> = [];
  const rpcs: Array<{ nombre: string; params: Record<string, unknown> }> = [];
  const from = (tabla: string) => {
    let filas = [...(tablas[tabla] ?? [])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api: any = {
      select: () => api,
      eq: (c: string, v: unknown) => { filtros.push([tabla, "eq", c, v]); if (!c.includes("->")) filas = filas.filter((r) => r[c] === v); return api; },
      in: (c: string, vs: unknown[]) => { filtros.push([tabla, "in", c, vs]); filas = filas.filter((r) => vs.includes(r[c])); return api; },
      gte: (c: string, v: unknown) => { filtros.push([tabla, "gte", c, v]); return api; },
      order: () => api, limit: () => api, not: () => api, range: () => api,
      maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
      single: async () => ({ data: filas[0] ?? null, error: null }),
      upsert: async (f: unknown, opts?: unknown) => { escrito.push({ tabla, op: "upsert", filas: f, opts }); return { error: null }; },
      insert: async (f: unknown) => { escrito.push({ tabla, op: "insert", filas: f }); return { error: null }; },
      delete: () => ({ match: async (m: unknown) => { escrito.push({ tabla, op: "delete", filas: m }); return { error: null }; } }),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: filas, error: null, count: filas.length }).then(ok, ko),
    };
    return api;
  };
  const rpc = (nombre: string, params: Record<string, unknown>) => {
    rpcs.push({ nombre, params });
    const r = rpcRes[nombre];
    return Promise.resolve(typeof r === "function" ? (r as (p: Record<string, unknown>) => unknown)(params) : { data: r ?? null, error: null });
  };
  return { admin: { from, rpc } as never, escrito, filtros, rpcs };
}

const PIN: po.PinMapa = { avisoId: "a1111111-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.4263, lng: -70.617, m2: 79, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 142264, arriendo: 865_000, condicion: "usado", alta: null };
const UF = 39000;
const SALDO_CON = { tipo: "con", n: 2, noVencen: false } as const;
const cuentaBase = (o: Partial<Record<string, unknown>> = {}) => ({
  analizados: {}, guardados: [], saldo: SALDO_CON, suscrito: false, ticket: false, cuentaCreadaAt: null, finanzas: { uf: UF, tasa: 4.2 },
  miBusqueda: po.validarPortal({ comunas: ["Ñuñoa"], tipologias: ["2"], ufMax: 4000, pie: 30, plazo: 30 }), busquedaActual: "Ñuñoa · 2D · hasta UF 4.000", explorarEnMes: 0, ...o,
});

export async function runExplorarPortalTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-PORTAL (vista global sin perfil, la tarjeta sin lo retirado, la calle a 40 m, sin saldo se explora, «Avísame» guarda el perfil · 0 tokens) ───");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  const pag = codigo("src/app/explorar/page.tsx");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modCli = (() => { try { return require(join(RAIZ, "src/app/explorar/explorar-cliente")) as any; } catch (e) { F(`0 · no carga explorar-cliente: ${(e as Error).message}`); return null; } })();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modTar = (() => { try { return require(join(RAIZ, "src/app/explorar/tarjeta-pin")) as any; } catch (e) { F(`0 · no carga tarjeta-pin: ${(e as Error).message}`); return null; } })();

  // ── 1 · la vista global sin filtros del perfil ──
  const g = po.portalDeUrl(new URLSearchParams(""));
  if (JSON.stringify(g.filtros) !== JSON.stringify(po.FILTROS_GLOBALES) || g.orden !== "puntaje") F(`1 · sin nada en la URL no abre la vista global: ${JSON.stringify(g)}`);
  const G = po.FILTROS_GLOBALES;
  if (G.comunas.length || G.tipologias.length || G.ufMin != null || G.ufMax != null || G.modalidad !== "ltr" || G.flujoPositivo || G.publicados !== "todos" || G.zona) F(`1 · la vista global filtra algo: ${JSON.stringify(G)}`);
  if (G.pie !== PIE_DEPTOS || G.plazo !== PLAZO_DEPTOS) F(`1 · la vista global no tiene los supuestos del número de anoche (pie ${PIE_DEPTOS} %, ${PLAZO_DEPTOS} años): ${G.pie}/${G.plazo}`);
  if (!po.esVistaGlobal(G) || po.filtrosActivos(G) !== 0 || po.urlDePortal(G) !== "") F("1 · la vista global cuenta filtros o deja algo en la URL");
  if (po.lineaSupuestos(G) !== "Arriendo tradicional · pie 20 % · 25 años" || po.numeroDelMapa(4807, G) !== "4.807 convienen en Gran Santiago") F(`1 · el número o la línea de los supuestos: ${po.numeroDelMapa(4807, G)} / ${po.lineaSupuestos(G)}`);
  // La página abre con la URL y nada más: el perfil no decide los filtros iniciales.
  const asignaFiltros = pag.match(/\bfiltros\s*[=:]/g) ?? [];
  if (!/const \{ filtros, orden \} = portalDeUrl\(sp\);/.test(pag) || !/inicial=\{\{ filtros, orden, n, cuenta \}\}/.test(pag) || asignaFiltros.length !== 0) F("1 · la página no abre con portalDeUrl(sp) tal cual (o reasigna los filtros)");
  if (/filtrosDeLaCuenta|filtrosDePerfil|leerPerfilBusqueda|miBusqueda/.test(pag)) F("1 · la página lee el perfil para abrir");
  if (!/const \[filtros, setFiltros\] = useState\(inicial\.filtros\);/.test(cli)) F("1 · el cliente no arranca con los filtros que mandó el servidor");
  if (modCli) {
    const html = dibujar(createElement(modCli.ExplorarCliente as FC<Record<string, unknown>>, { inicial: { filtros: G, orden: "puntaje", n: 4807, cuenta: cuentaBase() } }));
    const t = texto(html);
    if (!t.includes("4.807 convienen en Gran Santiago") || !t.includes("Arriendo tradicional · pie 20 % · 25 años")) F("1 · el primer pintado no dice «4.807 convienen en Gran Santiago» con sus supuestos (con una búsqueda guardada en la cuenta)");
    if (/Ñuñoa/.test(t) || /Filtros · \d/.test(t)) F("1 · el primer pintado trae los filtros del perfil");
    if (!/data-explorar="mi-busqueda"/.test(html) || !/data-explorar="filtros"/.test(html) || !/data-explorar="ordenar"/.test(html)) F("1 · falta la fila de arriba: Filtros, Ordenar y Mi búsqueda");
    if (!t.includes("4.807 deptos que convienen") || !t.includes("Ver lista")) F("1 · la hoja cerrada no dice «N deptos que convienen · Ver lista»");
  }
  const mb = po.filtrosDeMiBusqueda({ comunas: ["Ñuñoa", "Santiago"], dormitorios: [1, 2], precioMinUf: 1500, precioMaxUf: 3000, piePct: 30, plazoAnios: 30, modalidad: "str" });
  if (!mb || mb.comunas.join() !== "Ñuñoa,Santiago" || mb.tipologias.join() !== "1,2" || mb.ufMin !== 1500 || mb.ufMax !== 3000 || mb.pie !== 30 || mb.plazo !== 30 || mb.modalidad !== "str" || mb.zona || mb.flujoPositivo) F(`1 · «Mi búsqueda» no aplica comunas, tipología, rango, pie, plazo y modalidad de una vez: ${JSON.stringify(mb)}`);
  // El tope que «Avísame» guarda sin «hasta» vuelve como «cualquier precio» (cazado en el QA: «Mi búsqueda» filtraba h=60000).
  if (po.filtrosDeMiBusqueda({ comunas: ["Ñuñoa"], dormitorios: [2], precioMinUf: null, precioMaxUf: po.TOPE_PERFIL_UF, piePct: 20, plazoAnios: 25, modalidad: "ltr" })?.ufMax !== null) F("1 · «Mi búsqueda» convierte el tope de «cualquier precio» en un precio máximo");
  if (!/function miBusqueda\(\) \{\s*if \(!cuenta\.miBusqueda\) \{ setSinBusqueda\(true\); return; \}\s*aplicar\(cuenta\.miBusqueda, "mi_busqueda"\);/.test(cli) || !/onClick=\{miBusqueda\}/.test(cli)) F("1 · el botón «Mi búsqueda» no aplica el perfil de una vez");

  // ── 2 · la tarjeta del pin sin las líneas retiradas ──
  if (modTar) {
    const html = dibujar(createElement(modTar.TarjetaPin as FC<Record<string, unknown>>, { pines: [PIN, { ...PIN, avisoId: "b2222222-2222-4222-8222-222222222222", comuna: "Ñuñoa" }], seleccionado: PIN.avisoId, uf: UF, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar() {}, alCerrar() {}, alGuardar() {}, alAnalizar() {} }));
    const t = texto(html);
    const una = html.slice(html.indexOf(`data-aviso="${PIN.avisoId}"`), html.indexOf('data-aviso="b2222222'));
    for (const [que, ok] of [
      ["la línea «Providencia · 2D2B · 79 m² · Usado»", t.includes("Providencia · 2D2B · 79 m² · Usado")],
      ["el precio «UF 4.591»", t.includes("UF 4.591")],
      ["el veredicto y el puntaje «Comprar · 84»", t.includes("Comprar · 84")],
      ["el flujo «+$142.264 al mes»", /\+\$142\.264\s*al mes/.test(t)],
      ["el cap rate y la UF por m² «Cap rate 5,8 % · 58 UF/m²»", t.includes("Cap rate 5,8 % · 58 UF/m²")],
      ["«Analizar este»", /data-explorar="analizar"[^>]*>\s*Analizar este/.test(una)],
      ["el corazón", /data-explorar="corazon"/.test(una)],
      ["la imagen", /data-explorar="imagen"/.test(una) && /\/api\/explorar\/calle\//.test(una)],
      ["los puntos para deslizar entre los cercanos", /class="ex-puntos"/.test(html) && /scroll-snap-type: x mandatory/.test(leer("src/app/explorar/explorar.css"))],
    ] as const) if (!ok) F(`2 · la tarjeta no tiene ${que}`);
    if (/visto publicado|visto anoche|revisado con|ex-revisado|ex-cifras/i.test(html)) F("2 · la tarjeta trae «visto publicado», «revisado con pie y plazo» o la caja gris de cifras");
  }
  const tarSrc = codigo("src/app/explorar/tarjeta-pin.tsx");
  if (/marcaDePin|textoRevisado|vistoAt|ex-revisado/.test(tarSrc) || /\.ex-revisado|\.ex-cifras/.test(leer("src/app/explorar/explorar.css"))) F("2 · quedan en la tarjeta (o en su CSS) las líneas retiradas");
  if (!/\.ex-tarjeta-caja \{[^}]*background: var\(--franco-card\)/.test(leer("src/app/explorar/explorar.css"))) F("2 · la caja de la tarjeta no es la superficie de card (la caja gris volvió)");

  // ── 3 · la foto de calle solo a menos de 40 m; si no, el mapa chico ──
  const P = { lat: -33.4263, lng: -70.617 };
  const aMetros = (m: number, dirLat = -1) => ({ lat: P.lat + dirLat * (m / 111_195), lng: P.lng });
  const meta = (m: number, copyright = "© 2026 Google", status = "OK") => ({ status, pano_id: "PANO1", location: aMetros(m), copyright, date: "2025-03" });
  const d39 = calle.decidirCalle(meta(39), P), d41 = calle.decidirCalle(meta(41), P), d40 = calle.decidirCalle(meta(40.05), P);
  if (d39?.estado !== "foto" || d41?.estado !== "mapa" || d40?.estado !== "mapa") F(`3 · la regla de los 40 m: 39 m → ${d39?.estado}, 40,05 m → ${d40?.estado}, 41 m → ${d41?.estado}`);
  if (d39?.estado === "foto" && Math.abs(d39.rumbo - 0) > 1) F(`3 · con el panorama al sur del aviso la cámara no mira al norte (hacia el punto): ${d39.rumbo}°`);
  const alOeste = calle.decidirCalle({ status: "OK", pano_id: "P2", location: { lat: P.lat, lng: P.lng - 20 / 93_000 }, copyright: "© Google" }, P);
  if (alOeste?.estado !== "foto" || Math.abs(alOeste.rumbo - 90) > 1) F(`3 · con el panorama al oeste la cámara no mira al este: ${JSON.stringify(alOeste)}`);
  if (calle.decidirCalle(meta(10, "© Omar Propiedades"), P)?.estado !== "mapa") F("3 · un panorama que no es de Google (un particular, una corredora) da foto");
  if (calle.decidirCalle({ status: "ZERO_RESULTS" }, P)?.estado !== "mapa") F("3 · sin panorama no es el mapa chico");
  if (calle.decidirCalle({ status: "REQUEST_DENIED" }, P) !== null || calle.decidirCalle({ status: "OVER_QUERY_LIMIT" }, P) !== null || calle.decidirCalle(null, P) !== null) F("3 · un rechazo de Google se decide (y se guardaría como «sin foto»)");
  const um = calle.urlMetadataCalle(P, "K");
  if (!/streetview\/metadata\?location=-33\.426300,-70\.617000&radius=40&source=outdoor/.test(um)) F(`3 · la metadata no es por coordenadas, a 40 m y de exterior: ${um}`);
  const uf = calle.urlFotoCalle({ panoId: "PANO1", rumbo: 12.5 }, "K");
  if (!/\/streetview\?/.test(uf) || !/pano=PANO1/.test(uf) || !/heading=12\.5/.test(uf) || /location=/.test(uf)) F(`3 · la foto no es ESE panorama con la cámara hacia el punto: ${uf}`);
  if (!/staticmap\?center=-33\.426300,-70\.617000&zoom=17/.test(calle.urlMapaChico(P, "K")) || !/markers=color:0xC8323C/.test(calle.urlMapaChico(P, "K"))) F("3 · el mapa chico no es la cuadra con el pin");
  if (/direccion|address/i.test(codigo("src/lib/explorar/calle.ts") + codigo("src/lib/explorar/calle-servidor.ts"))) F("3 · la vista de la calle usa la dirección (va por coordenadas)");
  if (calle.CALLE_COPY.etiqueta !== "Vista de la calle" || /edificio/i.test(codigo("src/lib/explorar/calle.ts") + codigo("src/app/explorar/tarjeta-pin.tsx") + JSON.stringify(calle.CALLE_COPY))) F("3 · la etiqueta no es «Vista de la calle» (o dice «edificio»)");
  if (modTar) {
    const foto = dibujar(createElement(modTar.ImagenDepto as FC<Record<string, unknown>>, { avisoId: PIN.avisoId, tipo: "foto", clase: "ex-img" }));
    const mapa = dibujar(createElement(modTar.ImagenDepto as FC<Record<string, unknown>>, { avisoId: PIN.avisoId, tipo: "mapa", clase: "ex-img" }));
    if (!/data-explorar="vista-calle"[^>]*>Vista de la calle/.test(foto) || /Vista de la calle/.test(mapa)) F("3 · la etiqueta «Vista de la calle» no va solo con la foto");
  }
  try {
    const srvCalle = require(join(RAIZ, "src/lib/explorar/calle-servidor")) as typeof import("../../../src/lib/explorar/calle-servidor");
    const ahora = new Date("2026-10-28T12:00:00Z");
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6"];
    const avisos = ids.map((id) => ({ id, lat: P.lat, lng: P.lng }));
    const { admin, escrito } = baseFalsa({
      scraped_properties: avisos,
      calle_avisos: [
        { aviso_id: "c4", lat: P.lat, lng: P.lng, estado: "foto", pano_id: "X", rumbo: 3, consultado_at: "2026-10-20T00:00:00Z" },
        { aviso_id: "c5", lat: P.lat, lng: P.lng, estado: "foto", pano_id: "X", rumbo: 3, consultado_at: "2026-09-20T00:00:00Z" },
        { aviso_id: "c6", lat: P.lat + 0.01, lng: P.lng, estado: "mapa", pano_id: null, rumbo: null, consultado_at: "2026-10-27T00:00:00Z" },
      ],
    });
    const consultados: string[] = [];
    const respuestas: Record<string, unknown> = { c1: meta(15), c2: { status: "ZERO_RESULTS" }, c3: { status: "REQUEST_DENIED" }, c5: meta(80), c6: meta(5) };
    let i = 0;
    const orden = ["c1", "c2", "c3", "c5", "c6"];
    const r = await srvCalle.decisionesDeCalle(admin, ids, ahora, { key: "K", metadata: async () => { const id = orden[i++]; consultados.push(id); return respuestas[id] as never; } });
    if (r.c1 !== "foto" || r.c2 !== "mapa" || r.c3 !== "mapa" || r.c4 !== "foto" || r.c5 !== "mapa" || r.c6 !== "foto") F(`3 · las decisiones por aviso: ${JSON.stringify(r)}`);
    if (consultados.join() !== "c1,c2,c3,c5,c6") F(`3 · se consultó ${consultados.join()} (lo guardado y vigente no se consulta; lo vencido a los 30 días o con el aviso movido, sí)`);
    const guardadas = ((escrito.find((e) => e.tabla === "calle_avisos")?.filas ?? []) as Array<{ aviso_id: string; estado: string; rumbo: number | null }>);
    if (guardadas.map((x) => x.aviso_id).sort().join() !== "c1,c2,c5,c6" || guardadas.some((x) => x.aviso_id === "c3")) F(`3 · lo guardado: ${guardadas.map((x) => `${x.aviso_id}:${x.estado}`).join(",")} (el rechazo de Google no se guarda)`);
    const { admin: a2 } = baseFalsa({ calle_avisos: [{ aviso_id: "f", lat: P.lat, lng: P.lng, estado: "foto", pano_id: "PANO9", rumbo: 45, consultado_at: ahora.toISOString() }, { aviso_id: "m", lat: P.lat, lng: P.lng, estado: "mapa", pano_id: null, rumbo: null, consultado_at: ahora.toISOString() }] });
    const imF = await srvCalle.imagenDeCalle(a2, "f", [], ahora, { key: "K" }), imM = await srvCalle.imagenDeCalle(a2, "m", [], ahora, { key: "K" });
    if (imF?.tipo !== "foto" || !/pano=PANO9/.test(imF.url) || imM?.tipo !== "mapa" || !/staticmap/.test(imM.url)) F(`3 · la imagen servida: ${JSON.stringify([imF, imM])}`);
  } catch (e) {
    F(`3 · la decisión del servidor explotó: ${(e as Error).message}`);
  }
  const rutaImg = codigo("src/app/api/explorar/calle/[avisoId]/route.ts");
  if (!/s-maxage=2592000/.test(rutaImg) || /createClient\(\)/.test(rutaImg)) F("3 · la imagen no queda en la caché del CDN (o pide sesión y no se puede guardar)");

  // ── 4 · sin saldo se explora; el cobro sale al analizar ──
  if (modCli) {
    const html = dibujar(createElement(modCli.ExplorarCliente as FC<Record<string, unknown>>, { inicial: { filtros: G, orden: "puntaje", n: 4807, cuenta: cuentaBase({ saldo: { tipo: "sin" } }) } }));
    const t = texto(html);
    if (!t.includes("4.807 convienen en Gran Santiago") || /disabled=""/.test(html.slice(0, html.indexOf("ex-cuerpo")))) F("4 · sin saldo el mapa o la fila de arriba quedan cerrados");
    if (/necesitas análisis disponibles|Para explorar|data-explorar="cerrado"|data-hoja="cerrada"/.test(html)) F("4 · sin saldo aparece el aviso «Para explorar necesitas análisis disponibles» o el mapa cerrado");
  }
  if (existe("src/app/explorar/aviso-sin-saldo.tsx")) F("4 · el aviso sin saldo de Explorar sigue en el repo");
  for (const p of ["src/lib/explorar/explorar.ts", "src/lib/explorar/servidor.ts", "src/lib/explorar/portal.ts", "src/lib/explorar/portal-servidor.ts", "src/app/explorar/page.tsx", "src/app/explorar/explorar-cliente.tsx", "src/app/api/explorar/route.ts"]) {
    if (/explorarCerrado|pinCerrado|AVISO_SIN_SALDO|cerrado: true/.test(codigo(p))) F(`4 · ${p} todavía cierra Explorar sin saldo`);
  }
  const ruta = codigo("src/app/api/explorar/route.ts");
  if (/status: 403|leerSaldo|estadoSaldo/.test(ruta)) F("4 · la API del mapa mira el saldo (sin saldo se explora igual)");
  if (!/function pedirAnalisis\(it: PinMapa\) \{\s*setError\(null\);\s*setConfirmar\(\{ it, sin: cuenta\.saldo\.tipo === "sin" \}\);/.test(cli) || !/uso=\{confirmar\.sin \? \{ tipo: "sin" \} : cuenta\.saldo\}/.test(cli) || !/compras=\{compras\(confirmar\.it\.avisoId\)\}/.test(cli)) F("4 · «Analizar este» sin saldo no abre el pop-up de compra de siempre");
  if (!/alAnalizar=\{pedirAnalisis\}/.test(cli)) F("4 · la tarjeta no pide el análisis por el pop-up");
  try {
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
    const compras = comprasDeExplorar({ filtros: "", avisoId: PIN.avisoId, ticket: false });
    const base = { depto: PIN, combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.2, uf: UF, arriendo: PIN.arriendo }, compras, rutaCompra: compras.pack.href, alAnalizar() {}, alCancelar() {} };
    const sin = texto(dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as FC<Record<string, unknown>>, { ...base, uso: { tipo: "sin" } })));
    if (!sin.includes("No te quedan análisis.") || !sin.includes(compras.pack.label) || !sin.includes(compras.suelto.label)) F(`4 · el pop-up sin saldo no ofrece la compra de siempre: «${sin.slice(0, 160)}»`);
    // ── 9 (acá, con el pop-up a mano) · la línea del plan, sin frenar: una nota con su enlace bajo el uso del saldo.
    const conPlan = dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as FC<Record<string, unknown>>, { ...base, uso: SALDO_CON, compras: null, planLinea: po.lineaPlan(3, false) }));
    if (!/data-modal-plan[^>]*>Llevas 3 este mes\. Con el Plan Franco, 20 al mes por \$39\.990\.</.test(conPlan.replace(/href="[^"]*"\s*/g, "")) || !conPlan.includes(`href="${RUTA_PLAN}"`) || !/¿Analizar este depto\?/.test(texto(conPlan))) F("9 · el pop-up con saldo no suma la línea del plan con el enlace a la compra (o la línea frena el análisis)");
    const sinPlan = dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as FC<Record<string, unknown>>, { ...base, uso: SALDO_CON, compras: null, planLinea: null }));
    if (/data-modal-plan/.test(sinPlan)) F("9 · sin la línea del plan el pop-up igual la dibuja");
  } catch (e) {
    F(`4 · el pop-up sin saldo explotó: ${(e as Error).message}`);
  }

  // ── 5 · «Avísame de nuevos» guarda el perfil ──
  const fA = po.validarPortal({ comunas: ["Ñuñoa", "Santiago"], tipologias: ["1", "2"], ufMin: 1500, ufMax: 3000, pie: 30, plazo: 20, modalidad: "str", flujoPositivo: true, publicados: "7d" });
  const pA = po.perfilDeFiltros(fA);
  if (!pA.ok || pA.cambios.comunas.join() !== "Ñuñoa,Santiago" || pA.cambios.dormitorios.join() !== "1,2" || pA.cambios.precioMinUf !== 1500 || pA.cambios.precioMaxUf !== 3000 || pA.cambios.piePct !== 30 || pA.cambios.plazoAnios !== 20 || pA.cambios.modalidad !== "str") F(`5 · los filtros activos no pasan enteros al perfil: ${JSON.stringify(pA)}`);
  else if (!validarCambiosPerfil(pA.cambios as never).ok) F("5 · lo que «Avísame» guardaría no lo acepta el perfil (validarCambiosPerfil)");
  if (po.perfilDeFiltros(G).ok || po.perfilDeFiltros({ ...G, comunas: (COMUNAS_DISPONIBLES as readonly string[]).slice(0, 9) }).ok) F("5 · sin comunas (o con más de ocho) igual guarda un perfil");
  try {
    const srv = require(join(RAIZ, "src/lib/explorar/portal-servidor")) as typeof import("../../../src/lib/explorar/portal-servidor");
    const { admin, escrito } = baseFalsa({});
    const r = await srv.guardarBusquedaComoPerfil(admin, "u1", fA, new Date("2026-10-28T12:00:00Z"));
    const up = escrito.find((e) => e.tabla === "perfil_busqueda" && e.op === "upsert");
    const fila = (up?.filas ?? {}) as Record<string, unknown>;
    if (!r.ok || !up || fila.user_id !== "u1" || JSON.stringify(fila.comunas) !== '["Ñuñoa","Santiago"]' || JSON.stringify(fila.dormitorios) !== "[1,2]" || fila.precio_min_uf !== 1500 || fila.precio_max_uf !== 3000 || fila.pie_pct !== 30 || fila.plazo_anios !== 20 || fila.modalidad !== "str" || (up.opts as { onConflict?: string })?.onConflict !== "user_id") F(`5 · «Avísame» no escribe el perfil de búsqueda: ${JSON.stringify({ r, up })}`);
    // Desde ahí el semanal y la selección diaria buscan con eso: los dos leen el perfil por leerPerfilBusqueda.
    const { leerPerfilBusqueda } = require(join(RAIZ, "src/lib/perfil-busqueda-servidor")) as typeof import("../../../src/lib/perfil-busqueda-servidor");
    const { admin: a2 } = baseFalsa({ perfil_busqueda: [fila] });
    const pp = await leerPerfilBusqueda(a2, "u1");
    const p = pp.perfilStr;
    if (!p || p.comunas.join() !== "Ñuñoa,Santiago" || p.dormitorios.join() !== "1,2" || p.precioMinUf !== 1500 || p.precioMaxUf !== 3000 || p.piePct !== 30 || p.plazoAnios !== 20) F(`5 · el perfil que leen el semanal y la selección diaria no es la búsqueda guardada: ${JSON.stringify(p)}`);
    const { admin: a3, escrito: e3 } = baseFalsa({});
    const r3 = await srv.guardarBusquedaComoPerfil(a3, "u1", G);
    if (r3.ok || e3.length) F("5 · con la vista global (sin comunas) «Avísame» escribe igual");
  } catch (e) {
    F(`5 · «Avísame» explotó: ${(e as Error).message}`);
  }
  for (const p of ["src/lib/guia/semanal-servidor.ts", "src/lib/guia/inmediato-servidor.ts"]) if (!/leerPerfilBusqueda/.test(codigo(p))) F(`5 · ${p} no lee el perfil de búsqueda (el semanal o la diaria no usarían lo de «Avísame»)`);
  const rAv = codigo("src/app/api/explorar/avisame/route.ts");
  if (!/const filtros = validarPortal\(b\.filtros \?\? null\);\s*const r = await guardarBusquedaComoPerfil\(createServiceClient\(\), user\.id, filtros\);/.test(rAv)) F("5 · la ruta de «Avísame» no guarda los filtros activos como perfil");
  try {
    const { AvisameDialogo } = require(join(RAIZ, "src/app/explorar/avisame-dialogo")) as typeof import("../../../src/app/explorar/avisame-dialogo");
    const h1 = texto(dibujar(createElement(AvisameDialogo as unknown as FC<Record<string, unknown>>, { filtros: fA, busquedaActual: "Providencia · 2D · hasta UF 4.000", alElegirComunas() {}, alCerrar() {} })));
    if (!h1.includes(po.PORTAL_COPY.aviso.reemplaza) || !h1.includes("Providencia · 2D · hasta UF 4.000") || !h1.includes(po.lineaBusqueda((pA as { cambios: Parameters<typeof po.lineaBusqueda>[0] }).cambios)) || !h1.includes("Guardar y avisarme")) F("5 · la confirmación no muestra la búsqueda nueva y cuál reemplaza");
    const h2 = texto(dibujar(createElement(AvisameDialogo as unknown as FC<Record<string, unknown>>, { filtros: G, busquedaActual: null, alElegirComunas() {}, alCerrar() {} })));
    if (!h2.includes(po.PORTAL_COPY.aviso.faltanComunas) || h2.includes("Guardar y avisarme")) F("5 · sin comunas la confirmación ofrece guardar");
  } catch (e) {
    F(`5 · la confirmación de «Avísame» explotó: ${(e as Error).message}`);
  }
  // Los filtros no tocan el perfil: el cliente solo lo escribe con la casilla del pop-up; «Avísame», por su ruta.
  if ((cli.match(/\/api\/perfil-busqueda/g) ?? []).length !== 1 || !/if \(eleccion\?\.guardarPerfil\) \{\s*await fetch\("\/api\/perfil-busqueda", \{ method: "PUT"/.test(cli) || /\/api\/explorar\/avisame/.test(cli + codigo("src/app/explorar/hoja-filtros.tsx"))) F("5 · los filtros escriben el perfil fuera de la casilla del pop-up y de «Avísame»");
  for (const p of ["src/app/api/explorar/route.ts", "src/lib/explorar/portal-cache.ts"]) if (/perfil_busqueda|\.upsert\(|\.insert\(|\.delete\(/.test(codigo(p))) F(`5 · ${p} escribe (el mapa no toca nada)`);

  // ── 6 · los filtros, la URL y el orden ──
  const ahora = new Date("2026-10-28T12:00:00Z");
  const s = ahora.getTime() / 1000;
  const pin = (id: string, o: Partial<po.PinMapa>): po.PinMapa => ({ ...PIN, avisoId: id, ...o });
  const pines = [
    pin("p1", { comuna: "Santiago", dormitorios: 1, precioUF: 2390, flujo: 168400, score: 91, alta: s - 3600 }),
    pin("p2", { comuna: "Ñuñoa", dormitorios: 2, precioUF: 2980, flujo: -5000, score: 88, alta: s - 3 * 86400 }),
    pin("p3", { comuna: "Santiago", dormitorios: 6, precioUF: 6100, flujo: 140900, score: 86, alta: s - 20 * 86400, lat: -33.40 }),
    pin("p4", { comuna: "Independencia", dormitorios: 0, precioUF: 2150, flujo: 121500, score: 85, alta: null, arriendo: 900_000 }),
  ];
  const ids = (xs: po.PinMapa[]) => xs.map((x) => x.avisoId).join(",");
  const cas: Array<[string, Partial<po.FiltrosPortal>, string]> = [
    ["comunas", { comunas: ["Santiago"] }, "p1,p3"],
    ["tipología (4D+ incluye 6)", { tipologias: ["4"] }, "p3"],
    ["estudio", { tipologias: ["0"] }, "p4"],
    ["precio desde y hasta", { ufMin: 2200, ufMax: 3000 }, "p1,p2"],
    ["solo flujo positivo", { flujoPositivo: true }, "p1,p3,p4"],
    ["publicados hoy", { publicados: "hoy" }, "p1"],
    ["publicados 7 días", { publicados: "7d" }, "p1,p2"],
    ["la zona del mapa", { zona: [-33.45, -70.7, -33.41, -70.6] }, "p1,p2,p4"],
  ];
  for (const [que, parche, esperado] of cas) {
    const r = ids(po.filtrar(pines, po.validarPortal({ ...G, ...parche }), ahora));
    if (r !== esperado) F(`6 · el filtro de ${que}: ${r} (esperado ${esperado})`);
  }
  if (ids(po.filtrar([pin("z0", { flujo: 0 }), pin("zn", { flujo: null }), pin("z1", { flujo: 1 })], po.validarPortal({ ...G, flujoPositivo: true }), ahora)) !== "z1") F("6 · «Solo con flujo positivo» deja pasar el flujo cero o el que no se sabe");
  const ord = (o: po.OrdenPortal) => ids(po.ordenar(pines, o, UF));
  if (ord("puntaje") !== "p1,p2,p3,p4" || ord("flujo") !== "p1,p3,p4,p2" || ord("precio") !== "p4,p1,p2,p3" || ord("recientes") !== "p1,p2,p3,p4" || !ord("caprate").startsWith("p4")) F(`6 · el orden: puntaje ${ord("puntaje")} · flujo ${ord("flujo")} · precio ${ord("precio")} · recientes ${ord("recientes")} · cap rate ${ord("caprate")}`);
  if (po.ORDENES.map((o) => o.etiqueta).join(" · ") !== "Puntaje · Mayor flujo · Cap rate · Menor precio · Más recientes" || po.ORDEN_POR_DEFECTO !== "puntaje") F("6 · las opciones de «Ordenar» no son las del mockup, o el puntaje no es el por defecto");
  const ida = po.urlDePortal(fA, "flujo");
  const vuelta = po.portalDeUrl(new URLSearchParams(ida));
  if (JSON.stringify(vuelta.filtros) !== JSON.stringify(fA) || vuelta.orden !== "flujo") F(`6 · la URL no vuelve a los mismos filtros: ${ida}`);
  if (po.filtrosActivos(fA) !== 7 || po.etiquetaFiltros(fA) !== "Filtros · 7") F(`6 · «Filtros · N»: ${po.etiquetaFiltros(fA)}`);
  if (po.botonVer(1236) !== "Ver 1.236 deptos" || po.botonVer(1) !== "Ver 1 depto" || po.botonVer(null) !== "Ver deptos") F("6 · el botón «Ver N deptos»");
  if (po.PORTAL_COPY.hoja.cortaNota !== "Estimado por zona; se mide al analizar.") F("6 · la renta corta no dice «Estimado por zona; se mide al analizar»");
  const hoja = codigo("src/app/explorar/hoja-filtros.tsx");
  if (!/const n = contar\(b\);/.test(hoja) || !/\{botonVer\(n\)\}/.test(hoja) || !/b\.modalidad === "str" && <p className="ex-nota" data-explorar="nota-corta">\{H\.cortaNota\}<\/p>/.test(hoja)) F("6 · la hoja no cuenta «Ver N deptos» a cada toque, o la renta corta va sin su línea");
  if (!/return u \? filtrar\(u, f\)/.test(cli)) F("6 · el número de la hoja no sale del universo cargado (filtrar)");

  // ── 7 · el universo ──
  try {
    const srv = require(join(RAIZ, "src/lib/explorar/portal-servidor")) as typeof import("../../../src/lib/explorar/portal-servidor");
    const fila = [PIN.avisoId, "Providencia", -33.42, -70.61, 79, 2, 2, 4591, 84, 142264, 865000, "usado", s - 100];
    const { admin, rpcs } = baseFalsa({}, { explorar_mapa: [fila, fila] });
    const u = await srv.universoDeLaNoche(admin, 20, 25, ahora);
    if (rpcs.length !== 1 || rpcs[0].nombre !== "explorar_mapa" || (rpcs[0].params.comunas as string[]).length !== (COMUNAS_DISPONIBLES as readonly string[]).length || rpcs[0].params.pie !== 20 || rpcs[0].params.plazo !== 25) F(`7 · la noche no sale de UN pedido a explorar_mapa con todo Gran Santiago: ${JSON.stringify(rpcs.map((r) => r.nombre))}`);
    if (u.length !== 2 || u[0].precioUF !== 4591 || u[0].condicion !== "usado" || u[0].tipologia !== "2D2B" || u[0].alta !== s - 100) F(`7 · el pin de la noche: ${JSON.stringify(u[0])}`);
    // Renta corta por zona: la clave str-pie-plazo, solo los Comprar, el ingreso guardado para el cap rate.
    const filaU = (id: string, combo: unknown) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 50, dormitorios: 1, banos: 1, precio_uf: 3000, arriendo_monto: 500000, evaluado_at: "2026-10-28T03:00:00Z", combo, pub_estado: null, pub_at: null, condicion: "usado", alta: s - 50 });
    const pesada = (id: string) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 50, dormitorios: 1, banos: 1, condicion: "usado", precio_uf: 3000 });
    const guardados: unknown[] = [];
    const { admin: a2, rpcs: r2 } = baseFalsa({}, {
      explorar_universo_liviano: (p: Record<string, unknown>) => ({ data: p.clave === "str-20-25" ? [filaU("A", null), filaU("B", null), filaU("C", { v: "COMPRAR", s: 70, f: 1000, i: 900000, at: "2026-10-28T10:00:00Z" })] : [], error: null }),
      explorar_filas_para_sonda: (p: Record<string, unknown>) => ({ data: (p.ids as string[]).map(pesada), error: null }),
      explorar_guardar_combos: (p: Record<string, unknown>) => { guardados.push(...(p.filas as unknown[])); return { data: 1, error: null }; },
    });
    const cuenta = { calculados: 0, ms: 0 };
    const str = await srv.universoCalculado(a2, { comunas: ["Providencia"], modalidad: "str", pie: 20, plazo: 25 }, ahora, cuenta, {
      cfg: { uf: UF, tasa: 4.2 }, zonas: async () => new Map([[1, { n: 5 } as never]]),
      sondaStr: (f) => (f.id === "A" ? { v: "COMPRAR", s: 80, f: 50000, i: 1_200_000 } : { v: "AJUSTA SUPUESTOS", s: 60, f: -1, i: 700_000 }),
    });
    if (str.map((p) => p.avisoId).join() !== "A,C" || str[0].arriendo !== 1_200_000 || cuenta.calculados !== 2) F(`7 · la renta corta por zona: ${JSON.stringify(str.map((p) => [p.avisoId, p.score, p.arriendo]))}, calculados ${cuenta.calculados}`);
    if (!r2.some((r) => r.nombre === "explorar_universo_liviano" && r.params.clave === "str-20-25") || guardados.length !== 2 || !guardados.every((g) => Object.keys((g as { combo: object }).combo).join() === "str-20-25")) F("7 · la renta corta no se guarda bajo su propia clave (str-pie-plazo) en combos");
    if (srv.claveComboPortal("ltr", 15, 20) !== "15-20") F("7 · la clave de renta larga cambió (pisaría lo calculado por el pop-up)");
  } catch (e) {
    F(`7 · el universo explotó: ${(e as Error).message}`);
  }
  if (!po.universoDeLaNoche({ modalidad: "ltr", pie: 30, plazo: 25 }) || po.universoDeLaNoche({ modalidad: "str", pie: 20, plazo: 25 }) || po.universoDeLaNoche({ modalidad: "ltr", pie: 15, plazo: 25 })) F("7 · qué sale de la noche y qué se calcula");
  if (!/if \(esDeLaNoche\(q\)\) \{\s*const u = await universoDeLaNocheCacheado\(pie, plazo\);/.test(ruta) || !/comunas\.length === 0 \|\| comunas\.length > MAX_COMUNAS_POR_PEDIDO/.test(ruta)) F("7 · la API no sirve la noche de la caché, o calcula sin acotar por comuna");
  if (!/\["explorar-mapa-v1"\],\s*\{ revalidate: 600 \}/.test(codigo("src/lib/explorar/portal-cache.ts"))) F("7 · el universo de la noche no queda en caché diez minutos");
  // LA FORMA DE LA RESPUESTA (28-oct-2026, cazado en el QA: la noche esparcía el universo en la raíz y pisaba su tabla de
  // comunas; el navegador leía `universo` y el mapa decía «0 convienen»). Las dos ramas arman RespuestaUniverso y el
  // navegador lee eso; y lo compacto ida y vuelta por JSON da los mismos pines.
  if (!/const r: RespuestaUniverso = \{ clave: claveUniverso\(q\), comunas: \[\], universo: u, calculados: 0, ms: 0 \};\s*return NextResponse\.json\(r,/.test(ruta) || /\.\.\.u[,}]/.test(ruta) || (cli.match(/\(await res\.json\(\)\) as RespuestaUniverso;/g) ?? []).length !== 2 || (cli.match(/descompactar\(d\.universo\)/g) ?? []).length !== 2) F("7 · la respuesta del universo no tiene la forma que lee el navegador (`universo` con su tabla de comunas)");
  try {
    const srv = require(join(RAIZ, "src/lib/explorar/portal-servidor")) as typeof import("../../../src/lib/explorar/portal-servidor");
    const ida = JSON.parse(JSON.stringify(srv.respuestaUniverso([PIN, { ...PIN, avisoId: "z9", comuna: "Ñuñoa" }], { modalidad: "ltr", pie: 15, plazo: 20, comunas: ["Providencia"] })));
    const vuelta = po.descompactar(ida.universo);
    if (vuelta.length !== 2 || vuelta[1].comuna !== "Ñuñoa" || vuelta[0].precioUF !== PIN.precioUF || vuelta[0].condicion !== "usado" || ida.clave !== "ltr-15-20") F(`7 · el universo compacto no vuelve igual por JSON: ${JSON.stringify(vuelta[1])}`);
  } catch (e) {
    F(`7 · la respuesta del universo explotó: ${(e as Error).message}`);
  }
  const sql = leer("supabase/migrations/20261028_explorar_portal.sql");
  if (!/create or replace function public\.explorar_mapa\(/.test(sql) || !/returns jsonb/.test(sql) || !/revoke execute on function public\.explorar_mapa\(/.test(sql) || !/= 'COMPRAR'\s*\) u;/.test(sql) || !/ae\.arriendo_sospechoso is not true/.test(sql)) F("7 · explorar_mapa no es un jsonb del mismo universo, solo Comprar y solo para el service role");

  // ── 8 · el pin con zoom ──
  if (po.flujoCorto(142264) !== "+$142 mil" || po.flujoCorto(-22100) !== "−$22 mil" || po.flujoCorto(400) !== "+$400") F(`8 · el flujo del pin: ${po.flujoCorto(142264)} / ${po.flujoCorto(-22100)} / ${po.flujoCorto(400)}`);
  if (po.textoPin({ flujo: 1, alta: s - 60 }, { analizado: true, ahora }).texto !== "✓ Analizado" || po.textoPin({ flujo: 142264, alta: s - 3600 }, { analizado: false, ahora }).texto !== "Nuevo hoy" || po.textoPin({ flujo: 142264, alta: s - 2 * 86400 }, { analizado: false, ahora }).texto !== "+$142 mil") F("8 · lo que dice el pin: «✓ Analizado», «Nuevo hoy» o el flujo");
  if (po.esNuevoHoy({ alta: s - 86401 }, ahora) || !po.esNuevoHoy({ alta: s - 86000 }, ahora)) F("8 · «Nuevo hoy» no son las últimas 24 horas");
  const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
  if (!/if \(zoom >= ZOOM_ETIQUETAS \|\| elegido\) \{\s*const t = textoPin\(p, \{ analizado: an\.has\(id\), ahora \}\);\s*const fondo = elegido \? TINTA : t\.tipo === "analizado" \? azul : ROJO;/.test(mapa) || !/iconoGrupo\(gr\.n,/.test(mapa)) F("8 · el mapa no muestra grupos lejos y el texto del pin con zoom (azul el analizado)");
  if (!/map\.addListener\("idle", \(\) => \{\s*dibujarRef\.current\(\);\s*if \(tocado\.current && !propio\.current\)/.test(mapa) || !/onMovido=\{\(c\) => setZonaPendiente\(c\)\}/.test(cli) || !/data-explorar="buscar-zona" onClick=\{\(\) => aplicar\(\{ \.\.\.filtros, zona: zonaPendiente \}, "zona"\)\}/.test(cli)) F("8 · al mover el mapa no aparece «Buscar en esta zona» (o no aplica la zona)");

  // ── 9 · el plan donde se usa ──
  const lp = po.lineaPlan(3, false);
  const esperado = `Llevas 3 este mes. Con el Plan Franco, ${PLAN_ANALISIS_MES} al mes por $${PLAN_PRECIO_CLP.toLocaleString("es-CL")}.`;
  if (po.lineaPlan(2, false) !== null || lp?.texto !== esperado || lp.href !== RUTA_PLAN || po.lineaPlan(5, true) !== null || po.lineaPlan(4, false)?.texto.startsWith("Llevas 4") !== true) F(`9 · la línea del plan: ${JSON.stringify([po.lineaPlan(2, false), lp, po.lineaPlan(5, true)])}`);
  if (esperado !== "Llevas 3 este mes. Con el Plan Franco, 20 al mes por $39.990.") F(`9 · el plan no es 20 al mes por $39.990: ${esperado}`);
  try {
    const srv = require(join(RAIZ, "src/lib/explorar/portal-servidor")) as typeof import("../../../src/lib/explorar/portal-servidor");
    const { admin, filtros } = baseFalsa({ analisis: [{ id: "x", user_id: "u1" }] });
    await srv.analisisDesdeExplorar(admin, "u1", ahora);
    const gte = filtros.find((f) => f[0] === "analisis" && f[1] === "gte");
    if (!filtros.some((f) => f[0] === "analisis" && f[2] === "input_data->origenAviso->>desde" && f[3] === "explorar") || !gte || Math.abs(Date.parse(String(gte[3])) - (ahora.getTime() - 30 * 864e5)) > 1000) F("9 · la cuenta del plan no son los informes desde Explorar de los últimos 30 días");
  } catch (e) {
    F(`9 · la cuenta del plan explotó: ${(e as Error).message}`);
  }
  if (!/planLinea=\{plan\}/.test(cli) || !/const plan = lineaPlan\(cuenta\.explorarEnMes, cuenta\.suscrito\);/.test(cli)) F("9 · el pop-up de Explorar no lleva la línea del plan");
  if (!/\{planLinea && <EnlaceCarga href=\{planLinea\.href\} className="wz-modal-nota-enlace" data-modal-plan>\{planLinea\.texto\}<\/EnlaceCarga>\}/.test(codigo("src/components/guia/AvisoAntesDeAnalizar.tsx"))) F("9 · el pop-up no dibuja la línea del plan con su enlace (sin frenar: es una nota)");

  // ── 10 · la medición ──
  const E = po.EVENTOS_PORTAL;
  if ([E.vista, E.filtro, E.pin, E.guardar, E.avisame, E.analiza, E.planVisto].join() !== "explorar_vista,explorar_filtro,explorar_pin,explorar_guardar,explorar_avisame,explorar_analiza,explorar_plan_visto") F("10 · los nombres de los eventos");
  const props = po.propsDeFiltros(fA, "flujo");
  if (props.orden !== "flujo" || props.modalidad !== "str" || props.pie !== 30 || JSON.stringify(props.comunas) !== '["Ñuñoa","Santiago"]' || props.global !== false) F(`10 · «explorar_vista» no lleva los filtros y el orden: ${JSON.stringify(props)}`);
  if (!/posthog\?\.capture\(EVENTOS_PORTAL\.vista, \{ \.\.\.propsDeFiltros\(f, o\), n, fuente \}\)/.test(cli) || !/posthog\?\.capture\(EVENTOS_PORTAL\.filtro, \{ cambiados,/.test(cli) || !/posthog\?\.capture\(EVENTOS_PORTAL\.pin,/.test(cli) || !/posthog\?\.capture\(EVENTOS_PORTAL\.planVisto,/.test(cli)) F("10 · el navegador no deja explorar_vista, explorar_filtro, explorar_pin o explorar_plan_visto");
  if (!/void capturarServidor\(eventoPortalVista\(\{ userId: user\.id, filtros, orden, n, robot: robotDeVisita\(headers\(\)\.get\("user-agent"\), headers\(\)\) \}\)\)/.test(pag)) F("10 · la página no deja «explorar_vista» al entrar");
  if (!/eventoPortal\(EVENTOS_PORTAL\.guardar,/.test(codigo("src/app/api/explorar/guardados/route.ts")) || !/eventoPortal\(EVENTOS_PORTAL\.avisame,/.test(rAv)) F("10 · guardar y «Avísame» no dejan su evento");
  if (!/if \(desdeExplorar\) waitUntil\(capturarServidor\(eventoExplorarAnaliza\(/.test(codigo("src/app/api/semanal/analizar-str/route.ts")) || !/if \(desdeExplorar\) \{\s*waitUntil\(capturarServidor\(eventoExplorarAnaliza\(/.test(codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts"))) F("10 · analizar desde Explorar (renta larga o corta) no deja «explorar_analiza»");
  if (po.filtrosCambiados(G, fA).join() !== "comunas,tipologia,precio,pie_plazo,modalidad,flujo,publicados") F(`10 · qué cambió: ${po.filtrosCambiados(G, fA).join()}`);

  // ── 11 · los guardados en el dashboard ──
  const dg = (id: string, o: Partial<gu.DeptoGuardado> = {}): gu.DeptoGuardado => ({ avisoId: id, comuna: "Providencia", m2: 79, tipologia: "2D2B", condicion: "usado", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 142264, arriendo: 865000, activo: true, informeId: null, ...o });
  const tab = gu.tablaComparacion([dg("a"), dg("b", { precioUF: 3000, flujo: -1000 })], UF);
  if (tab.map((f) => f.dato).join() !== "Depto,Precio,UF por m²,Veredicto,Flujo mensual,Cap rate,Arriendo estimado" || tab[1].valores.join() !== "UF 4.591,UF 3.000" || tab[4].valores[1] !== "−$1.000") F(`11 · la tabla de «Comparar»: ${JSON.stringify(tab)}`);
  if (gu.COMPARAR_MIN_GUARDADOS !== 2 || gu.COMPARAR_MAX_GUARDADOS !== 4 || gu.lineaGuardado(dg("x", { activo: false })) !== "Ya no está publicado") F("11 · los topes de «Comparar» o el aviso dado de baja");
  try {
    const { GuardadosCasa } = require(join(RAIZ, "src/app/dashboard/guardados-casa")) as typeof import("../../../src/app/dashboard/guardados-casa");
    const h = dibujar(createElement(GuardadosCasa as unknown as FC<Record<string, unknown>>, { inicial: [dg("a"), dg("b")], uf: UF }));
    if (!/data-casa="guardados"/.test(h) || !texto(h).includes("Guardados") || !/data-casa="guardados-comparar"/.test(h) || (h.match(/data-casa="guardado"/g) ?? []).length !== 2) F("11 · el dashboard no muestra la fila «Guardados» con sus deptos y «Comparar»");
    if (dibujar(createElement(GuardadosCasa as unknown as FC<Record<string, unknown>>, { inicial: [], uf: UF })) !== "") F("11 · sin guardados la fila aparece igual");
  } catch (e) {
    F(`11 · la fila «Guardados» explotó: ${(e as Error).message}`);
  }
  if (!/<GuardadosCasa inicial=\{guardados\} uf=\{cfgGuia\?\.uf \?\? null\} \/>/.test(codigo("src/app/dashboard/page.tsx"))) F("11 · el dashboard no monta «Guardados»");
  if (!/explorar_guardados/.test(sql) || !/primary key \(user_id, aviso_id\)/.test(sql) || !/alter table public\.explorar_guardados enable row level security/.test(sql)) F("11 · la tabla de guardados no es una por persona y aviso, con RLS");

  // ── 12 · el primer pintado liviano ──
  if (!/const MapaExplorar = dynamic\(\(\) => import\("\.\/mapa-explorar"\), \{ ssr: false/.test(cli) || !/cuandoLaPaginaEsteQuieta\(\(\) => \{\s*setMapaListo\(true\);\s*if \(universoDeLaNoche\(inicial\.filtros\)\) void asegurar\(inicial\.filtros\);/.test(cli)) F("12 · el mapa o el universo de la noche no esperan a la página quieta");
  if (!/vivo\.current = true;\s*if \(!universoDeLaNoche\(inicial\.filtros\)\) void asegurar\(inicial\.filtros\);\s*const cancelar = cuandoLaPaginaEsteQuieta\(/.test(cli)) F("12 · el universo de la noche se pide antes de la página quieta (compite con el LCP)");
  if (/loadGoogleMaps|maps\.googleapis/.test(cli + pag + codigo("src/lib/explorar/portal.ts"))) F("12 · Google Maps entra al primer pintado");
  if (/universo=|pines=\{/.test(pag)) F("12 · la página manda los pines en el HTML (rompe el LCP)");
  if (!/<img src=\{MAPA_QUIETO_M\} alt="" width=\{560\} height=\{514\} fetchPriority="high"/.test(pag)) F("12 · falta el mapa quieto incrustado (el LCP del teléfono)");
  // CON LA LISTA EL MAPA NO SE ESCONDE (28-oct-2026, cazado en el QA en WebKit 390): con display:none el mapa de Google queda sin
  // tamaño y al volver se descuadra («Buscar en esta zona» caía a 50 km). La lista lo cubre entera.
  if (/data-mapa=\{mapa\}[^>]*hidden=\{/.test(cli.replace(/aria-hidden=/g, "")) || /\.ex-mapa-wrap\[hidden\]/.test(leer("src/app/explorar/explorar.css")) || !/\.ex-lista \{ position: absolute; inset: 0; z-index: 4;/.test(leer("src/app/explorar/explorar.css"))) F("12 · con la lista abierta el mapa se esconde (y se descuadra al volver)");
  // EL AVISO DE COOKIES NO TAPA LA PANTALLA FIJA (28-oct-2026, cazado en el QA en WebKit 390: tapaba la hoja «Ver lista» y el botón
  // «Mapa» a quien todavía no eligió): la barra publica su alto y Explorar lo resta.
  const css = leer("src/app/explorar/explorar.css");
  if (!/\.ex-pagina \{ height: calc\(100dvh - var\(--alto-aviso-cookies, 0px\)\);/.test(css) || !/\.ex-boton-mapa \{[^}]*bottom: calc\(18px \+ var\(--alto-aviso-cookies, 0px\)/.test(css) || !/raiz\.style\.setProperty\("--alto-aviso-cookies", `\$\{h\}px`\);/.test(codigo("src/components/consentimiento/AvisoCookies.tsx")) || !/raiz\.style\.removeProperty\("--alto-aviso-cookies"\)/.test(codigo("src/components/consentimiento/AvisoCookies.tsx"))) F("12 · el aviso de cookies tapa la hoja de abajo o el botón «Mapa» de Explorar");

  if (fallas.length) {
    console.log(`  ✗ EXPLORAR-PORTAL · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la vista global sin el perfil; la tarjeta sin lo retirado; la calle a menos de 40 m o el mapa chico; sin saldo se explora y se cobra al analizar; «Avísame» guarda el perfil; filtros, universo, pin, plan, medición, guardados y primer pintado");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (28-oct-2026). 58 mutaciones, cada una restaurada byte a byte con su hash (scratchpad mutar-portal.cjs),
// todas ROJAS. La primera pasada dio 49 de 52: tres gates flojos que se afirmaron —4D+ sin un 6D en el fixture (M32), el flujo
// positivo sin un flujo cero (M34) y el primer pintado sin mirar la línea de antes de la página quieta (M52)—. Después del QA
// en WebKit 390 y PC, seis más por lo que el QA cazó: M53 la noche esparce el universo en la raíz (el mapa decía «0
// convienen») · M54 el cliente lee otra forma (verde la primera vez: se afirmó con `descompactar(d.universo)`) · M55 el aviso
// de cookies tapa la pantalla · M56 la barra no publica su alto · M57 la lista esconde el mapa · M58 «Mi búsqueda» filtra el
// tope de «cualquier precio».
//   1 · VISTA GLOBAL: M1 el cliente abre con el perfil · M2 la global filtra Santiago · M3 la página pasa el perfil · M4 pie 30 ·
//       M5 «Mi búsqueda» sin modalidad.
//   2 · TARJETA: M6 «Visto publicado» · M7 «Revisado con pie» · M8 sin cap rate · M9 la caja gris · M10 sin corazón.
//   3 · CALLE: M11 hasta 60 m · M12 cualquier copyright · M13 el rechazo de Google se guarda · M14 la cámara al revés ·
//       M15 «el edificio» · M16 lo guardado no vence · M17 sin exterior · M18 la etiqueta con el mapa · M19 sin caché del CDN.
//   4 · SIN SALDO: M20 el pop-up sin compra · M21 el aviso «Para explorar» · M22 la API corta · M23 la barra apagada ·
//       M24 el pop-up con el saldo en vez de «sin».
//   5 · AVÍSAME: M25 no escribe · M26 sin modalidad · M27 sin comunas · M28 la ruta guarda la global · M29 sin «reemplaza» ·
//       M30 sin el piso · M31 los filtros escriben el perfil.
//   6-12: M32 4D+ · M33 «hoy» = 7 días · M34 flujo cero · M35 menor precio al revés · M36 renta corta sin su línea · M37 la noche
//       de a páginas · M38 la clave de renta corta · M39 sale lo que no da · M40 «Nuevo hoy» sobre el analizado · M41 el flujo
//       sin redondear · M42 sin «Buscar en esta zona» · M43 el plan desde el segundo · M44 el plan al suscrito · M45 el pop-up
//       sin el plan · M46 60 días · M47 sin explorar_filtro · M48 la vista sin el orden · M49 guardar sin evento · M50 el
//       dashboard sin «Guardados» · M51 comparar hasta 6 · M52 el universo antes de la página quieta.

if (require.main === module) {
  runExplorarPortalTier().then((r) => process.exit(r.hard ? 1 : 0));
}
