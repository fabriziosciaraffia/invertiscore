// ============================================================================
// TIER EXPLORAR-RECORRIDO — los ajustes de /explorar del recorrido real de Fabrizio (30-oct-2026), en teléfono y PC, y el
// financiamiento por defecto a 30 años en todo el sitio.
//
//   1 · EL NÚMERO CUENTA CON 30 AÑOS: una sola constante (deptos/estandar.ts › PLAZO_POR_DEFECTO = 30) que leen la vista
//       global de /explorar —y con ella la landing, la bienvenida, /deptos, el botón del dashboard y «Estás dentro», que
//       cuentan con convienenHoy—, el conteo de /deptos (con el plazo en la clave), la selección y los guardados.
//   2 · EL POP-UP Y EL WIZARD ABREN EN 30: el origen sintético del semanal, la guía y la selección diaria, y el wizard de la
//       puerta A, sin plazo elegido, con la constante.
//   3 · UN PERFIL CON 25 LO CONSERVA: el plazo elegido o inferido no se pisa (/explorar, la noche, la selección, el semanal).
//   4 · NINGÚN SUPUESTO POR DEFECTO DICE 25: «25 años» queda solo donde no es un supuesto por defecto (lista con su razón).
//   5 · LA BARRA, ABAJO Y LA LISTA: arriba solo «Filtros» y «¿Cómo se calcula?»; sin la tarjeta del número; abajo «N deptos ✓
//       Comprar · Ver lista» (teléfono) y la píldora negra (PC); la lista es una hoja (teléfono) o un panel de 480 px (PC), con
//       «Ordenar» y «Avísame de nuevos» arriba: «Ordenar» vive solo ahí.
//   6 · FILTROS EN DOS BLOQUES: «El depto» y «Tu financiamiento», con la tasa del motor fija («4,07 % · promedio de los
//       bancos»); en el PC, un panel como el de la lista.
//   7 · LA VUELTA DEL REGISTRO DESDE UN PIN: su tarjeta, desbloqueada (de borroso a nítido) y con la banda del regalo; el
//       pop-up no se abre solo; y el pop-up de «Analizar este», en todas partes, con la foto de la calle o el mapa chico.
//   8 · LAS FLECHAS EN EL PC: ‹ › en la tarjeta y las del teclado.
//   9 · LOS MAPAS EN OSCURO: el de /explorar (estilo oscuro, al momento), la imagen quieta, el de la selección y el mapa chico,
//       cada uno con su versión oscura y en caché aparte.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-recorrido-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";
import * as ex from "../../../src/lib/explorar/explorar";
import * as ab from "../../../src/lib/explorar/abierto";
import * as calle from "../../../src/lib/explorar/calle";
import { PIE_DEPTOS, PIE_POR_DEFECTO, PLAZO_DEPTOS, PLAZO_POR_DEFECTO } from "../../../src/lib/deptos/estandar";
import { PREFIJO_CONTEO } from "../../../src/lib/deptos/servidor";
import { origenSintetico } from "../../../src/lib/guia/guia-servidor";
import { plazoAnios as plazoDelWizard } from "../../../src/components/formulario-v4/derive";
import { MAPA_CASA, urlMapaCasa } from "../../../src/lib/casa/mapa-casa";
import { francoMapStaticStyleParams, francoMapStyleForTheme } from "../../../src/lib/map-styles";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up va por un portal del navegador: acá el portal se dibuja en línea (como EXPLORAR-PORTAL). */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujar(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
/** Las reglas de un bloque @media (min-width: 768px) del CSS, juntas (el PC). */
function reglasPC(css: string): string {
  const out: string[] = [];
  let i = css.indexOf("@media (min-width: 768px) {");
  while (i >= 0) {
    let prof = 0, j = css.indexOf("{", i);
    for (; j < css.length; j++) { if (css[j] === "{") prof++; else if (css[j] === "}" && --prof === 0) break; }
    out.push(css.slice(i, j + 1));
    i = css.indexOf("@media (min-width: 768px) {", j);
  }
  return out.join("\n");
}

const PIN: po.PinMapa = { avisoId: "a1111111-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.4263, lng: -70.617, m2: 79, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 142264, arriendo: 865_000, condicion: "usado", alta: null };
const PIN2: po.PinMapa = { ...PIN, avisoId: "b2222222-2222-4222-8222-222222222222", comuna: "Ñuñoa" };
const PIN3: po.PinMapa = { ...PIN, avisoId: "c3333333-3333-4333-8333-333333333333", comuna: "Macul" };
const G = po.FILTROS_GLOBALES;
const cuentaBase = () => ({
  analizados: {}, guardados: [], saldo: { tipo: "con", n: 2, noVencen: false }, suscrito: false, ticket: false, cuentaCreadaAt: null, finanzas: { uf: 39000, tasa: 4.07 },
  miBusqueda: null, busquedaActual: null, explorarEnMes: 0,
});

/**
 * Dónde «25» puede seguir, y por qué (§4). Todo lo demás que diga «25 años», «plazo de 25» o un plazo 25 por defecto es un
 * supuesto viejo y va en rojo. Clave: archivo; valor: lo que puede decir ahí, con su razón.
 */
const VEINTICINCO_PERMITIDO: Record<string, { patron: RegExp; razon: string }> = {
  "src/app/analisis/[id]/documento/DocumentoLTR.tsx": { patron: /Number\(inputData\?\.plazoCredito\) \|\| 25/, razon: "describe un análisis ya hecho: el motor siempre guarda su plazo; el 25 es solo la red de un input sin él" },
  "src/app/analisis/renta-corta/[id]/documento/DocumentoSTR.tsx": { patron: /Number\(inputData\?\.plazoCredito\) \|\| 25/, razon: "ídem, el PDF de renta corta" },
  "src/app/share/comparativa/[token]/documento/DocumentoAmbas.tsx": { patron: /Number\(ltrInput\?\.plazoCredito\) \|\| 25/, razon: "ídem, el PDF de la comparativa" },
  "src/app/analisis/[id]/results-client.tsx": { patron: /Number\(inputData\?\.plazoCredito\) \|\| 25/, razon: "ídem, la página del informe" },
  "src/app/dev/lo-que-sigue/demo-cliente.tsx": { patron: /plazoAnios: 25|"25 años"/, razon: "demo de desarrollo con un caso fijo, no se publica" },
  "src/components/formulario-v4/screenResumen.tsx": { patron: /\{ value: "25", label: "25 años" \}/, razon: "una de las opciones del plazo, no el supuesto" },
  "src/components/formulario-v4/screensActo2.tsx": { patron: /const PLAZOS = \["15", "20", "25", "30"\];/, razon: "las opciones del plazo, no el supuesto" },
  "src/lib/guia/copy.ts": { patron: /antigüedad prudente de 25 años|supuso 25 años/, razon: "la antigüedad supuesta del edificio, no el plazo" },
};
const VEINTICINCO = /25 años|plazo de 25|plazoAnios: 25|plazo_anios: 25|plazoCredito: "25"|\|\| 25\b|\?\? 25\b|plazo: 25\b|plazo = 25\b|"25"/;

export async function runExplorarRecorridoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-RECORRIDO (30 años en todo el sitio, la barra y la lista de /explorar, Filtros con la tasa, la vuelta al pin, las flechas y los mapas en oscuro · 0 tokens) ───");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  const css = leer("src/app/explorar/explorar.css");
  const cssPC = reglasPC(css);

  // ── 1 · EL NÚMERO CUENTA CON 30 AÑOS ──
  if (PLAZO_POR_DEFECTO !== 30 || PIE_POR_DEFECTO !== 20) F(`1 · el financiamiento por defecto no es pie 20 % y 30 años: ${PIE_POR_DEFECTO} / ${PLAZO_POR_DEFECTO}`);
  if (PLAZO_DEPTOS !== PLAZO_POR_DEFECTO || PIE_DEPTOS !== PIE_POR_DEFECTO || G.plazo !== PLAZO_POR_DEFECTO || G.pie !== PIE_POR_DEFECTO || ab.PLAZO_ABIERTO !== PLAZO_POR_DEFECTO || ab.PIE_ABIERTO !== PIE_POR_DEFECTO)
    F("1 · /deptos, la vista global o /explorar sin cuenta no leen la constante del sitio");
  if (!/export const PLAZO_DEPTOS = PLAZO_POR_DEFECTO;/.test(codigo("src/lib/deptos/estandar.ts")) || !/plazo: PLAZO_POR_DEFECTO/.test(codigo("src/lib/explorar/portal.ts"))) F("1 · el plazo de /deptos o de la vista global es un literal, no la constante");
  if (!/return cuantosConvienen\(await universoDeLaNocheCacheado\(FILTROS_GLOBALES\.pie, FILTROS_GLOBALES\.plazo\)\);/.test(codigo("src/lib/explorar/portal-cache.ts"))) F("1 · el número de todo el sitio no cuenta la vista global (con su plazo)");
  // El conteo de /deptos: con el plazo en cada llamada y en la clave (un conteo a 25 años nunca se sirve como de 30).
  for (const p of ["src/lib/deptos/servidor.ts", "src/lib/casa/sin-oferta-servidor.ts"]) {
    const c = codigo(p);
    const llamadas = c.match(/rpc\("deptos_conteo", \{[^}]*\}/g) ?? [];
    if (llamadas.length === 0 || llamadas.some((l) => !/plazo: PLAZO_DEPTOS/.test(l))) F(`1 · ${p} cuenta sin el plazo (${llamadas.length} llamada(s))`);
  }
  if (PREFIJO_CONTEO !== `deptos_conteo_p${PLAZO_DEPTOS}:`) F(`1 · la clave del conteo no lleva el plazo: ${PREFIJO_CONTEO}`);
  const cand = codigo("src/lib/deptos/servidor.ts").match(/rpc\("deptos_candidatos", \{[^}]*\}/g) ?? [];
  if (cand.length === 0 || cand.some((l) => !/plazo:/.test(l))) F("1 · la selección pide los candidatos sin el plazo");
  if (!/const COLS = PLAZO_POR_DEFECTO === 30 \? \{ v: "veredicto_20", s: "score_20", f: "flujo_20" \}/.test(codigo("src/lib/explorar/guardados-servidor.ts"))) F("1 · los guardados no leen el veredicto con el plazo del sitio");
  const mig = leer("supabase/migrations/20261030_plazo_por_defecto_30.sql");
  if ((mig.match(/plazo integer/g) ?? []).length < 2 || !/case when plazo = 30 then ae\.veredicto_20 else ae\.veredicto_20_25 end/.test(mig)) F("1 · la migración no le da el plazo al conteo y a los candidatos");

  // ── 2 · EL POP-UP Y EL WIZARD ABREN EN 30 ──
  const o = origenSintetico("u", { piePct: null, plazoAnios: null, comunas: ["Ñuñoa"], dormitorios: [2] }, { tasa: 4.07 });
  if (o.plazoAnios !== 30 || o.piePct !== 20) F(`2 · sin plazo elegido, el semanal y la guía no abren en 20 % y 30 años: ${o.piePct} / ${o.plazoAnios}`);
  if (!/const plazo = perfil\.plazoAnios == null \? PLAZO_DEPTOS : perfil\.plazoAnios >= 30 \? 30 : 25;/.test(codigo("src/lib/deptos/primeros-servidor.ts")) || !/const combinacion = \{ piePct: pie, plazoAnios: plazo \};/.test(codigo("src/lib/deptos/primeros-servidor.ts"))) F("2 · la selección diaria no abre el pop-up con el plazo de la persona (o 30 sin él)");
  if (!/combinacion=\{\{ piePct: filtros\.pie, plazoAnios: filtros\.plazo \}\}/.test(cli)) F("2 · el pop-up de /explorar no abre con el pie y el plazo de los filtros");
  if (plazoDelWizard({} as never) !== 30 || plazoDelWizard({ plazoCredito: "20" } as never) !== 20) F(`2 · el wizard sin plazo no abre en 30: ${plazoDelWizard({} as never)}`);
  const acto2 = codigo("src/components/formulario-v4/screensActo2.tsx");
  if (!/const plazo = answers\.plazoCredito \|\| String\(PLAZO_POR_DEFECTO\);/.test(acto2) || !/a \$\{PLAZO_POR_DEFECTO\} años con la tasa de mercado de hoy/.test(acto2)) F("2 · la pantalla del plazo del wizard no arranca en la constante (o el supuesto de la cuota dice otro)");
  if ((codigo("src/components/formulario-v4/wizardV4Payload.ts").match(/plazoCredito: Number\(a\.plazoCredito\) \|\| PLAZO_POR_DEFECTO,/g) ?? []).length !== 2) F("2 · lo que el wizard manda al motor sin plazo no es la constante");
  try {
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as { AvisoAntesDeAnalizar: FC<Record<string, unknown>> };
    const h = texto(dibujarPopup(createElement(AvisoAntesDeAnalizar, { depto: PIN, combinacion: { piePct: o.piePct, plazoAnios: o.plazoAnios }, finanzas: { tasa: 4.07, uf: 39000, arriendo: PIN.arriendo }, uso: { tipo: "con", n: 2, noVencen: false }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {} })));
    if (!h.includes("Con pie de 20 % y plazo de 30 años")) F(`2 · el pop-up con el origen sin plazo no dice «Con pie de 20 % y plazo de 30 años»: «${h.slice(0, 200)}»`);
  } catch (e) {
    F(`2 · el pop-up explotó: ${(e as Error).message}`);
  }

  // ── 3 · UN PERFIL CON 25 LO CONSERVA ──
  if (ex.plazoDeLaNoche(25) !== 25 || ex.plazoDeLaNoche(null) !== 30 || ex.plazoDeLista(25) !== 25 || ex.plazoDeLista(null) !== 30) F("3 · la noche o la lista pisan el plazo 25 de un perfil (o sin plazo no van a 30)");
  if (ex.filtrosDePerfil({ comunas: ["Ñuñoa"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 20, plazoAnios: 25 })?.plazo !== 25) F("3 · /explorar abre con 30 un perfil que eligió 25");
  if (po.filtrosDeMiBusqueda({ comunas: ["Ñuñoa"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 20, plazoAnios: 25, modalidad: "ltr" })?.plazo !== 25) F("3 · «Usar mi búsqueda» pisa el plazo 25 del perfil");
  if (origenSintetico("u", { piePct: 20, plazoAnios: 25, comunas: ["Ñuñoa"], dormitorios: [2] }, { tasa: 4.07 }).plazoAnios !== 25) F("3 · el semanal y la guía pisan el plazo 25 del perfil");
  if (!/value=\{p\.plazoAnios \?\? PLAZO_POR_DEFECTO\}/.test(codigo("src/app/dashboard/casa.tsx"))) F("3 · el perfil del dashboard no muestra el plazo elegido (o sin él, otro que la constante)");

  // ── 4 · NINGÚN SUPUESTO POR DEFECTO DICE 25 ──
  for (const f of archivos("src")) {
    const lineas = codigo(f).split("\n").filter((l) => VEINTICINCO.test(l));
    if (lineas.length === 0) continue;
    const ok = VEINTICINCO_PERMITIDO[f];
    const malas = ok ? lineas.filter((l) => !ok.patron.test(l)) : lineas;
    if (malas.length) F(`4 · ${f} dice 25 como supuesto: «${malas[0].trim().slice(0, 110)}»`);
  }
  for (const [f, ok] of Object.entries(VEINTICINCO_PERMITIDO)) if (!ok.patron.test(codigo(f))) F(`4 · la excepción de ${f} ya no existe (sácala de la lista: ${ok.razon})`);
  if (/25 años/.test(JSON.stringify(po.COMO_SE_CALCULA.estandar(4.07)) + po.PORTAL_COPY.tasaFija(4.07))) F("4 · «¿Cómo se calcula?» dice 25 años");

  // ── 5 · LA BARRA, ABAJO Y LA LISTA ──
  const modCli = cargar<{ ExplorarCliente: FC<Record<string, unknown>> }>("src/app/explorar/explorar-cliente", F);
  if (modCli) {
    for (const [cuenta, que] of [[cuentaBase(), "con cuenta"], [null, "sin cuenta"]] as const) {
      const html = dibujar(createElement(modCli.ExplorarCliente, { inicial: { filtros: G, orden: "puntaje", n: 4807, cuenta, tasa: { tasa: 4.07 }, convienen: cuenta ? null : 4807 } }));
      const barra = html.slice(html.indexOf('class="ex-barra"'), html.indexOf('class="ex-cuerpo"'));
      const botones = barra.match(/data-explorar="[a-z-]+"/g) ?? [];
      if (botones.join() !== 'data-explorar="filtros",data-explorar="como-se-calcula"') F(`5 · ${que}, la fila de arriba no es solo «Filtros» y «¿Cómo se calcula?»: ${botones.join(" ")}`);
      if (!/<button type="button" class="ex-como" data-explorar="como-se-calcula">/.test(barra)) F(`5 · ${que}, «¿Cómo se calcula?» no es un enlace de texto (va como chip)`);
      if (/data-explorar="ordenar"/.test(html)) F(`5 · ${que}, «Ordenar» aparece en la vista de mapa`);
      if (/ex-numero|data-explorar="numero"/.test(html)) F(`5 · ${que}, la tarjeta del número sigue sobre el mapa`);
      if (!texto(html).includes("4.807 deptos ✓ Comprar Ver lista") || !texto(html).includes("Ver lista · 4.807 ✓ Comprar")) F(`5 · ${que}, abajo no dice «4.807 deptos ✓ Comprar · Ver lista» (teléfono) y «Ver lista · 4.807 ✓ Comprar» (PC)`);
    }
  }
  if (/ex-numero/.test(css + cli + codigo("src/app/explorar/esqueleto.tsx")) || "numeroDelMapa" in po || "lineaSupuestos" in po) F("5 · quedan la tarjeta del número o la línea de los supuestos (CSS, cliente, esqueleto o portal.ts)");
  if (!/\.ex-pildora-lista \{ display: none; \}/.test(css) || !/\.ex-hoja \{ display: none; \}/.test(cssPC) || !/\.ex-pildora-lista \{ position: absolute; left: 50%; bottom: 24px;[^}]*border-radius: 999px;/.test(cssPC)) F("5 · la barra de abajo no es la del teléfono y la píldora la del PC");
  const modLista = cargar<{ ListaPortal: FC<Record<string, unknown>> }>("src/app/explorar/lista-portal", F);
  if (modLista) {
    const l = dibujar(createElement(modLista.ListaPortal, { pines: [PIN, PIN2], total: 4807, calculando: false, orden: "puntaje", uf: 39000, analizados: {}, guardados: new Set(), alOrden() {}, alAbrir() {}, alGuardar() {}, alAvisame() {}, alCerrar() {} }));
    const arriba = l.slice(l.indexOf('class="ex-lista-arriba"'), l.indexOf('class="ex-lista-scroll"'));
    if (!/role="dialog"/.test(l) || !/class="ex-asa ex-lista-asa"/.test(arriba) || !/data-explorar="cerrar-lista"/.test(arriba) || !/data-explorar="volver-mapa"/.test(l)) F("5 · la lista no es una hoja con asa, X y el botón «Mapa»");
    const cab = arriba.slice(0, arriba.indexOf('class="ex-lista-acciones"'));
    if (!/<h2[^>]*>4\.807 deptos <span class="chip-v c"[^>]*data-veredicto="COMPRAR"/.test(cab)) F("5 · arriba de la lista no dice «4.807 deptos» con el chip ✓ Comprar");
    const acciones = arriba.slice(arriba.indexOf('class="ex-lista-acciones"'));
    const iO = acciones.indexOf('data-explorar="ordenar"'), iA = acciones.search(/data-explorar="avisame"|Avísame de nuevos/);
    if (iO < 0 || iA < 0 || iO > iA) F("5 · debajo del título no va una fila con «Ordenar» y «Avísame de nuevos»");
  }
  const lista = codigo("src/app/explorar/lista-portal.tsx");
  if (!/const CIERRE_DESLIZANDO_PX = 90;/.test(lista) || !/if \(arrastre > CIERRE_DESLIZANDO_PX\) alCerrar\(\);/.test(lista) || !/onTouchEnd=\{alSoltar\}/.test(lista)) F("5 · la hoja de la lista no se cierra deslizando hacia abajo");
  // ⚠ ACTA (30-oct-2026, QA en WebKit 390) · casi a pantalla completa es sobre el header y la barra: el velo de la pantalla y la hoja a 24 px, como
  // Filtros (dentro del cuerpo arrancaba en 118 px).
  if (!/\.ex-lista-velo \{ position: fixed; inset: 0; z-index: 50;/.test(css) || !/\.ex-lista \{ position: absolute; left: 0; right: 0; bottom: 0; top: 24px;/.test(css) || !/\.ex-lista-velo \{ position: absolute; inset: 0; z-index: 7; background: none; pointer-events: none; \}/.test(cssPC) || !/\.ex-lista \{ pointer-events: auto; left: auto; right: 12px; top: 12px; bottom: 12px; width: 480px;/.test(cssPC) || !/\.ex-lista \.ex-boton-mapa \{ display: none; \}/.test(cssPC))
    F("5 · la lista no es casi a pantalla completa en el teléfono y un panel de 480 px a la derecha en el PC (con el mapa usable)");
  if (!/vista === "lista" && \(\s*<ListaPortal/.test(cli) || !/alCerrar=\{\(\) => setVista\("mapa"\)\}/.test(cli)) F("5 · la lista no se monta sobre el mapa o no vuelve al mapa al cerrarse");

  // ── 6 · FILTROS EN DOS BLOQUES, CON LA TASA DEL MOTOR ──
  const modFil = cargar<{ HojaFiltros: FC<Record<string, unknown>> }>("src/app/explorar/hoja-filtros", F);
  if (modFil) {
    for (const sinCuenta of [false, true]) {
      const que = sinCuenta ? "sin cuenta" : "con cuenta";
      const h = dibujar(createElement(modFil.HojaFiltros, { filtros: G, tasa: { tasa: 4.07 }, miBusqueda: sinCuenta ? null : { activa: false, alUsar() {} }, contar: () => 10, asegurar() {}, alAplicar() {}, alCerrar() {}, alPedirRegistro: sinCuenta ? () => {} : null }));
      const iD = h.indexOf('data-explorar="bloque-depto"'), iF = h.indexOf('data-explorar="bloque-financiamiento"');
      if (iD < 0 || iF < 0 || iD > iF) { F(`6 · ${que}, Filtros no va en dos bloques («El depto» y después «Tu financiamiento»)`); continue; }
      const depto = h.slice(iD, iF), fin = h.slice(iF);
      if (!/<h3[^>]*>El depto<\/h3>/.test(depto) || !/<h3[^>]*>Tu financiamiento<\/h3>/.test(fin)) F(`6 · ${que}, los bloques no llevan sus títulos`);
      for (const [cosa, ok] of [["las comunas", />Comunas</.test(depto)], ["la tipología", />Tipología</.test(depto)], ["el precio", />Precio</.test(depto)], ["tradicional o renta corta", /data-explorar="tradicional"/.test(depto) && /data-explorar="renta-corta"/.test(depto)], ["solo con flujo positivo", /data-explorar="flujo-positivo"/.test(depto)], ["publicados", />Publicados</.test(depto)]] as const)
        if (!ok) F(`6 · ${que}, «El depto» no tiene ${cosa}`);
      if (/data-explorar="(pie|plazo|tasa)"/.test(depto) || !/data-explorar="pie"/.test(fin) || !/data-explorar="plazo"/.test(fin)) F(`6 · ${que}, pie y plazo no van en «Tu financiamiento»`);
      const tasa = fin.slice(fin.indexOf('data-explorar="tasa"'));
      if (!/data-explorar="tasa"><span>Tasa<\/span><b>4,07 % · promedio de los bancos<\/b><\/div>/.test(fin) || /<(select|input)/.test(tasa.slice(0, 160))) F(`6 · ${que}, la tasa no es la del motor, fija («4,07 % · promedio de los bancos»)`);
      if (sinCuenta === /data-explorar="mi-busqueda"/.test(h)) F(`6 · ${que}, «Usar mi búsqueda» ${sinCuenta ? "aparece" : "no está dentro de Filtros"}`);
    }
  }
  if (!/\.ex-filtros \{ pointer-events: auto; width: 480px;/.test(cssPC) || !/\.ex-filtros-velo \{ position: absolute; inset: 52px 0 0 0; background: none; pointer-events: none;/.test(cssPC)) F("6 · en el PC, Filtros no es un panel como el de la lista (con el mapa a la vista)");

  // ── 7 · LA VUELTA DEL REGISTRO DESDE UN PIN, Y LA IMAGEN EN EL POP-UP ──
  const modTar = cargar<{ TarjetaPin: FC<Record<string, unknown>> }>("src/app/explorar/tarjeta-pin", F);
  const baseTar = { pines: [PIN, PIN2, PIN3], seleccionado: PIN2.avisoId, uf: 39000, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar() {}, alCerrar() {}, alGuardar() {}, alAnalizar() {} };
  if (modTar) {
    const t = dibujar(createElement(modTar.TarjetaPin, { ...baseTar, recien: { avisoId: PIN2.avisoId, regalo: true } }));
    const suya = t.slice(t.indexOf(`data-aviso="${PIN2.avisoId}"`), t.indexOf(`data-aviso="${PIN3.avisoId}"`));
    if (!/data-recien="1"/.test(suya) || /data-recien/.test(t.replace(suya, ""))) F("7 · al volver, la tarjeta del pin no queda marcada para desbloquearse (o se marcan otras)");
    if (!texto(suya).includes("Listo, ya tienes tu cuenta. Tu análisis de regalo está listo para este depto.")) F("7 · la tarjeta de la vuelta no dice «Listo, ya tienes tu cuenta. Tu análisis de regalo está listo para este depto.»");
    if (!/data-explorar="analizar"[^>]*>\s*Analizar este · usa tu regalo/.test(suya)) F("7 · el botón de la vuelta no dice «Analizar este · usa tu regalo»");
    if (!/142\.264/.test(suya) || /data-explorar="borroso"/.test(suya)) F("7 · la tarjeta de la vuelta no muestra las cifras nítidas");
    const sinRegalo = texto(dibujar(createElement(modTar.TarjetaPin, { ...baseTar, recien: { avisoId: PIN2.avisoId, regalo: false } })));
    if (!sinRegalo.includes("Listo, ya tienes tu cuenta.") || sinRegalo.includes("regalo")) F("7 · sin regalo, la vuelta igual habla del regalo");
    if (/data-recien/.test(dibujar(createElement(modTar.TarjetaPin, { ...baseTar, sinCuenta: true, recien: { avisoId: PIN2.avisoId, regalo: true } })))) F("7 · sin cuenta la tarjeta se marca como recién desbloqueada");
  }
  if (!/\.ex-tarjeta\[data-recien="1"\] \.ex-linea2, \.ex-tarjeta\[data-recien="1"\] \.ex-linea3 \{ animation: ex-desbloquear/.test(css) || !/@keyframes ex-desbloquear \{ from \{ filter: blur\(5px\);[^}]*\} to \{ filter: none;/.test(css)) F("7 · la vuelta no pasa de borroso a nítido");
  const efecto = cli.slice(cli.indexOf("const v = vuelta.current;"), cli.indexOf("}, [listaVuelta, universo]);"));
  if (!/setRecien\(\{ avisoId: it\.avisoId, regalo: usaRegalo\(cuenta\.saldo\) \}\)/.test(efecto) || /pedirAnalisis|setConfirmar/.test(efecto) || !/recien=\{recien\}/.test(cli)) F("7 · al volver no se marca la tarjeta del pin (o se abre el pop-up solo)");
  try {
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as { AvisoAntesDeAnalizar: FC<Record<string, unknown>> };
    const base = { depto: PIN, combinacion: { piePct: 20, plazoAnios: 30 }, finanzas: { tasa: 4.07, uf: 39000, arriendo: PIN.arriendo }, uso: { tipo: "con", n: 2, noVencen: false }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {} };
    const con = dibujarPopup(createElement(AvisoAntesDeAnalizar, { ...base, avisoId: PIN.avisoId }));
    const fila = con.slice(con.indexOf('class="av-tarjeta-fila"'));
    if (!/^class="av-tarjeta-fila"><span class="av-img" data-explorar="imagen"><img src="\/api\/explorar\/calle\/a1111111/.test(fila) || fila.indexOf('class="av-img"') > fila.indexOf('class="av-tarjeta"')) F("7 · el pop-up no lleva la imagen del depto a la izquierda de su tarjeta gris");
  } catch (e) {
    F(`7 · el pop-up con la imagen explotó: ${(e as Error).message}`);
  }
  // ⚠ ACTA (30-oct-2026, QA en WebKit 390) · con la imagen, la tarjeta gris queda angosta: sus líneas se envuelven en vez de
  // cortarse con «…» (la sonda popups-alto-webkit-sonda.ts mide que el pop-up siga cabiendo en 390 × 740).
  if (!/\.wz-modal-compacto \.av-tarjeta-fila:has\(\.av-img\) \.av-nombre,\s*\.wz-modal-compacto \.av-tarjeta-fila:has\(\.av-img\) \.av-linea,\s*\.wz-modal-compacto \.av-tarjeta-fila:has\(\.av-img\) \.av-incluye \{ white-space: normal; overflow: visible; \}/.test(leer("src/components/formulario-v4/wizard-v4.css"))) F("7 · con la imagen, las líneas de la tarjeta del pop-up se cortan en vez de envolverse");
  for (const p of ["src/app/explorar/explorar-cliente.tsx", "src/app/semanal/semanal-lista.tsx", "src/components/deptos/PrimeraSeleccion.tsx", "src/components/guia/GuiaBusqueda.tsx"]) {
    // El montaje entero (de «<AvisoAntesDeAnalizar» a su cierre): la imagen va como última prop.
    const c = codigo(p), i = c.indexOf("<AvisoAntesDeAnalizar"), montaje = i < 0 ? "" : c.slice(i, c.indexOf("\n        />", i));
    if (!/\n\s*avisoId=\{confirmar\.it\.avisoId\}$/.test(montaje)) F(`7 · el pop-up de ${p} no lleva la imagen del depto`);
  }

  // ── 8 · LAS FLECHAS EN EL PC ──
  if (modTar) {
    const medio = dibujar(createElement(modTar.TarjetaPin, baseTar));
    const ant = medio.match(/<button[^>]*data-explorar="flecha-anterior"[^>]*>/)?.[0] ?? "", sig = medio.match(/<button[^>]*data-explorar="flecha-siguiente"[^>]*>/)?.[0] ?? "";
    if (!ant || !sig || /disabled/.test(ant + sig) || !/aria-label="Depto anterior"/.test(ant) || !/aria-label="Depto siguiente"/.test(sig)) F("8 · la tarjeta no tiene ‹ › para pasar al depto anterior y al siguiente");
    const primero = dibujar(createElement(modTar.TarjetaPin, { ...baseTar, seleccionado: PIN.avisoId }));
    if (!/<button[^>]*disabled=""[^>]*data-explorar="flecha-anterior"/.test(primero)) F("8 · en el primero, «anterior» no se apaga");
    if (/data-explorar="flecha-/.test(dibujar(createElement(modTar.TarjetaPin, { ...baseTar, pines: [PIN], seleccionado: PIN.avisoId })))) F("8 · con un solo depto aparecen las flechas");
  }
  const tar = codigo("src/app/explorar/tarjeta-pin.tsx");
  if (!/if \(e\.key === "ArrowLeft" && anterior\) \{ e\.preventDefault\(\); alCambiar\(anterior\.avisoId\); \}/.test(tar) || !/if \(e\.key === "ArrowRight" && siguiente\) \{ e\.preventDefault\(\); alCambiar\(siguiente\.avisoId\); \}/.test(tar) || !/\/\^\(INPUT\|SELECT\|TEXTAREA\)\$\/\.test\(t\.tagName\)/.test(tar)) F("8 · las flechas del teclado no pasan de depto (o se comen las de un campo)");
  if (!/\.ex-flecha \{ display: none; \}/.test(css) || !/\.ex-flecha \{ position: absolute; top: 50%;[^}]*display: inline-flex;/.test(cssPC)) F("8 · las flechas no van solo en el PC");

  // ── 9 · LOS MAPAS EN OSCURO ──
  const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
  if (JSON.stringify(francoMapStyleForTheme("dark")) === JSON.stringify(francoMapStyleForTheme("light"))) F("9 · el estilo oscuro del mapa es el claro");
  if (!/const opcionesDeTema = \(\) => \(esClaro\(\) \? \{ styles: francoMapStyleForTheme\("light"\), backgroundColor: "#F6F6F7" \} : \{ styles: francoMapStyleForTheme\("dark"\), backgroundColor: "#1a1a1a" \}\);/.test(mapa) || !/\.\.\.opcionesDeTema\(\),/.test(mapa)) F("9 · el mapa de /explorar no toma el estilo del tema");
  if (!/new MutationObserver\(\(\) => \{\s*const map = mapRef\.current;\s*if \(!map\) return;\s*map\.setOptions\(opcionesDeTema\(\)\);\s*dibujarRef\.current\(\);\s*\}\);\s*o\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \["data-theme"\] \}\);/.test(mapa)) F("9 · el mapa de /explorar no cambia al momento cuando cambia el tema");
  if (!/const fondo = elegido \? elegidoDeTema\(\)\.fondo : t\.tipo === "analizado" \? azul : ROJO;/.test(mapa)) F("9 · los pines dejaron de ser rojos (o los analizados azules)");
  // La imagen quieta: su versión oscura, mismo tamaño que la clara, de fondo solo en oscuro.
  try {
    const sharp = require("sharp") as (p: string) => { metadata(): Promise<{ width?: number; height?: number }> };
    for (const [ruta, w, h] of [[ex.MAPA_QUIETO.dOscuro, 1120, 852], [ex.MAPA_QUIETO.mOscuro, 560, 426]] as const) {
      if (!existe(`public${ruta}`)) { F(`9 · falta la imagen quieta oscura ${ruta}`); continue; }
      const m = await sharp(join(RAIZ, `public${ruta}`)).metadata();
      if (m.width !== w || m.height !== h) F(`9 · la imagen quieta oscura ${ruta} no tiene el tamaño de la clara (${m.width}×${m.height}, se esperaba ${w}×${h})`);
      if (readFileSync(join(RAIZ, `public${ruta}`)).length > 60 * 1024) F(`9 · la imagen quieta oscura ${ruta} pesa más de 60 kB`);
    }
  } catch (e) {
    F(`9 · no se pudo medir la imagen quieta oscura: ${(e as Error).message}`);
  }
  if (!css.includes(`:root:not([data-theme="light"]) .ex-mapa-quieto { background: #1a1a1a url("${ex.MAPA_QUIETO.mOscuro}") center 30% / cover no-repeat; }`) || !css.includes(`:root:not([data-theme="light"]) .ex-mapa-quieto img { visibility: hidden; }`) || !cssPC.includes(`:root:not([data-theme="light"]) .ex-mapa-quieto { background-image: url("${ex.MAPA_QUIETO.dOscuro}"); }`)) F("9 · la imagen quieta no cambia a su versión oscura con el tema");
  if (/invert\(/.test(css + leer("src/app/dashboard/casa.css"))) F("9 · un mapa en oscuro sigue siendo el claro invertido");
  // El mapa de la selección (dashboard y «Estás dentro»).
  const e = { lat: -33.43, lng: -70.61, zoom: 13 };
  const uC = urlMapaCasa(e, "K", MAPA_CASA, "light") ?? "", uO = urlMapaCasa(e, "K", MAPA_CASA, "dark") ?? "";
  if (!uO || uO === uC || !francoMapStaticStyleParams("dark").every((p) => uO.includes(p))) F("9 · el mapa de la selección no tiene su URL oscura con el estilo oscuro");
  if (!/urlOscuro: urlMapaCasa\(encuadre, apiKey, MAPA_CASA, "dark"\),/.test(codigo("src/lib/casa/mapa-casa-servidor.ts")) || !/"--mapa-oscuro": `url\("\$\{datos\.urlOscuro\}"\)`/.test(codigo("src/app/dashboard/mapa-casa.tsx")) || !/:root:not\(\[data-theme="light"\]\) \.ca-mapa-fondo \{ background-image: var\(--mapa-oscuro, var\(--mapa-claro\)\); \}/.test(leer("src/app/dashboard/casa.css"))) F("9 · el mapa de la selección no cambia a su versión oscura con el tema");
  // El mapa chico de la tarjeta: otra URL (otra entrada de caché), y la ruta lo pide con el estilo oscuro.
  if (calle.rutaImagenCalle("x", true) !== `${calle.rutaImagenCalle("x")}?tema=oscuro` || calle.rutaImagenCalle("x").includes("tema")) F("9 · el mapa chico oscuro no tiene su propia URL (comparte caché con el claro)");
  const ruta = codigo("src/app/api/explorar/calle/[avisoId]/route.ts");
  if (!/const tema = new URL\(req\.url\)\.searchParams\.get\("tema"\) === "oscuro" \? "dark" : "light";/.test(ruta) || !/francoMapStaticStyleParams\(tema\)/.test(ruta)) F("9 · la ruta de la imagen no pide el mapa chico con el estilo del tema");
  if (!/const oscuro = useTemaOscuro\(\);/.test(codigo("src/components/guia/ImagenDepto.tsx")) || !/src=\{rutaImagenCalle\(avisoId, oscuro\)\}/.test(codigo("src/components/guia/ImagenDepto.tsx"))) F("9 · la imagen del depto no sigue al tema");
  if (!/attributeFilter: \["data-theme"\]/.test(codigo("src/lib/tema-vivo.ts")) || !/useSyncExternalStore\(suscribir, oscuroAhora, \(\) => false\)/.test(codigo("src/lib/tema-vivo.ts"))) F("9 · el tema no se lee en vivo (no cambiaría al momento)");

  if (fallas.length) {
    console.log(`  ✗ EXPLORAR-RECORRIDO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — 30 años en todo el sitio y el 25 elegido se conserva; arriba solo Filtros y «¿Cómo se calcula?», sin la tarjeta del número; la lista como hoja o panel con Ordenar; Filtros en dos bloques con la tasa del motor; la vuelta a la tarjeta desbloqueada sin pop-up; las flechas en el PC; los mapas en oscuro");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runExplorarRecorridoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (30-oct-2026) ──
// 66 de 66 en ROJO (runner `mutar-recorrido.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte):
//   §1 R1 el plazo por defecto vuelve a 25 · R2 /deptos con un literal · R3 la vista global a 25 · R4 un conteo de /deptos sin
//      el plazo · R5 el aviso sin oferta sin el plazo · R6 la clave del conteo sin el plazo · R7 los candidatos sin el plazo ·
//      R8 los guardados leen 25 · R9 el número de todo el sitio con otro plazo.
//   §2 R10 el origen sintético a 25 · R11 la selección diaria a 25 · R12 el wizard a 25 · R13 la pantalla del plazo a 25 ·
//      R14 el pop-up de /explorar con otro plazo.
//   §3 R15 la noche pisa el 25 · R16 «Usar mi búsqueda» pisa el plazo · R17 el perfil del dashboard sin su plazo.
//   §4 R18 la hoja dice 25 años · R19 los guardados dicen 25 · R20 el catálogo de correos con 25 · R21 una excepción de la lista
//      que ya no existe.
//   §5 R22 «Ordenar» vuelve a la barra · R23 vuelve la tarjeta del número · R24 «¿Cómo se calcula?» como chip · R25 la píldora
//      en el teléfono · R26 la píldora sin el número · R27 la barra de abajo sin el chip · R28 la lista sin su X · R29 «Ordenar»
//      fuera de la lista · R30 no se cierra deslizando · R31 la lista no es panel en el PC · R32 con la lista el mapa no se usa ·
//      R64 la lista vuelve adentro del cuerpo · R65 la hoja de la lista arranca más abajo (las dos por el QA en WebKit 390).
//   §6 R33 Filtros en un solo bloque · R34 la tasa editable · R35 «El depto» sin publicados · R36 Filtros no es panel en el PC.
//   §7 R37 la vuelta abre el pop-up · R38 la vuelta sin marcar la tarjeta · R39 la banda sin el regalo · R40 el botón sin «usa
//      tu regalo» · R41 sin pasar de borroso a nítido · R42 el pop-up sin la imagen · R43 la guía sin la imagen en el pop-up ·
//      R44 la fila del pop-up sin la imagen · R66 con la imagen, las líneas del pop-up se cortan (por el QA en WebKit 390).
//   §8 R45 sin la flecha siguiente · R46 el teclado sin la derecha · R47 las flechas en el teléfono · R48 flechas con un solo
//      depto (la primera vez sin aplicar: el texto estaba dos veces; con más contexto, ROJO) · R49 «anterior» no se apaga.
//   §9 R50 el mapa oscuro es el claro · R51 el mapa no cambia al momento · R52 los pines en tinta · R53 la imagen quieta
//      invertida · R54 la del PC sin su oscura · R55 el mapa de la selección invertido · R56 el servidor sin la URL oscura ·
//      R57 la URL oscura con el estilo claro · R58 el mapa chico comparte la caché · R59 la ruta ignora el tema · R60 la imagen
//      del depto no sigue al tema · R61 el tema no se lee en vivo · R62 la imagen quieta oscura del teléfono con otro tamaño ·
//      R63 sin la imagen quieta oscura del PC.
// En el mismo runner, los predicados reescritos de otros tiers (cada uno con su acta en su archivo): CONVIENEN-UNO C1–C13,
// EXPLORAR-PORTAL P1–P8, PUERTA-E E1–E5, PUERTA-B B1–B4, EXPLORAR X1–X3, DEPTOS-CONTEO D1, PERFIL-OFERTA O1–O2 y
// PUERTA-B-DASHBOARD DB1: 103 de 103 en ROJO.
