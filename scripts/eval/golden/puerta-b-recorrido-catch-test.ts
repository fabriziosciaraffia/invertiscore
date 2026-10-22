// ============================================================================
// TIER PUERTA-B-RECORRIDO — el recorrido real de Fabrizio por la puerta B con una cuenta nueva (21-oct-2026)
//
//   1 · EL PERFIL ES DE LA PERSONA, NO DEL EJEMPLO. /deptos no trae la comuna elegida: pide elegirla y recién ahí muestra
//       el número y el correo. Una cuenta que deja el correo sin tocar ningún chip no existe: sin comuna no hay correo
//       ni Google. «Estás dentro» dice «Buscas: Santiago · 2D · UF 3.000 a 4.000 · Cambiar», y lo que se cambia se
//       guarda recién al seguir. EN ROJO CON EL CÓDIGO DE HOY: la portada venía con Santiago y el correo a la vista.
//   2 · «Estás dentro» no se va sola al dashboard (el `?entro=1` volvía a correr el alta y caía en «sin-pendiente»).
//   3 · LA TARJETA DEL DASHBOARD ABRE EL POP-UP: la selección se dibuja en el dashboard con «Analizar este», que abre el
//       aviso antes de gastar («Usa tu análisis de regalo»), sin pasar por /semanal. EN ROJO CON EL CÓDIGO DE HOY.
//   4 · «Analizar» deja el aviso abierto con «Franco está analizando este depto…» y la barra de carga, hasta el informe.
//   5 · EL TICKET ES DE TODA CUENTA NUEVA: el primer informe de una cuenta con menos de 24 horas lo lleva, y el aviso sin
//       saldo ofrece el pack —3 por $14.990 en esas 24 horas, $19.990 después— y debajo «Comprar solo 1 · $9.990», los
//       dos a la pantalla de compra con el depto puesto, y de vuelta al depto, que se analiza solo. EN ROJO CON EL
//       CÓDIGO DE HOY.
//   6 · EL DASHBOARD SE ACTUALIZA SOLO al volver del informe, y el depto ya analizado dice «Ya lo analizaste · Ver
//       informe» en vivo, también en renta larga y en la primera selección del día. EN ROJO CON EL CÓDIGO DE HOY.
//   7 · UNA SOLA PÁGINA: el clic del correo (que se sigue midiendo) y /semanal aterrizan en el dashboard, en la selección,
//       con el depto clicado arriba.
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/puerta-b-recorrido-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
/** El trozo de `s` entre dos marcas (la primera aparición de cada una, en orden). Vacío si falta alguna. */
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};
/** Carga un módulo del repo; null si no existe o no carga (el código de hoy no lo tiene). */
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
/** Dibuja un componente cliente con un router de app falso (useRouter exige uno montado). */
function dibujarConRouter(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up se monta en un portal sobre `document.body`: para dibujarlo en el servidor, el portal se dibuja en el lugar
 *  y hay un `document` de mentira mientras dura. Los dos se devuelven como estaban. */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujarConRouter(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
const textos = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Un cliente de Supabase de mentira: toda consulta encadenada termina en `{ count, data: [], error: null }`, con el
 *  conteo de su tabla. Anota los filtros de cada consulta. */
function baseDeConteos(conteos: Record<string, number>) {
  const consultas: Array<{ tabla: string; filtros: string[] }> = [];
  const cadena = (tabla: string) => {
    const c = { tabla, filtros: [] as string[] };
    consultas.push(c);
    const q: unknown = new Proxy({}, {
      get: (_t, k) => (k === "then"
        ? (ok: (v: unknown) => void) => ok({ count: conteos[tabla] ?? 0, data: [], error: null })
        : (...a: unknown[]) => { c.filtros.push(`${String(k)}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q; }),
    });
    return q;
  };
  return { admin: { from: (t: string) => cadena(t) } as unknown as SupabaseClient, consultas };
}

const TOKEN = "0123456789abcdef0123456789abcdef";
const HORA = 3600_000;
type Item = { avisoId: string; comuna: string; tipologia: string | null; m2: number; precioUF: number; veredicto: string | null; score: number | null; flujo: number | null; informeId?: string };
const item = (avisoId: string, extra: Partial<Item> = {}): Item => ({ avisoId, comuna: "Santiago", tipologia: "2D1B", m2: 52, precioUF: 3400, veredicto: "COMPRAR", score: 80, flujo: -40000, ...extra });

export async function runPuertaBRecorridoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PUERTA-B-RECORRIDO (la comuna la elige la persona, la selección en el dashboard, el ticket de toda cuenta nueva, lo analizado en vivo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  const respuesta = require(join(RAIZ, "src/lib/deptos/respuesta")) as typeof import("../../../src/lib/deptos/respuesta");
  const compra = cargar<typeof import("../../../src/lib/guia/compra-desde-depto")>("src/lib/guia/compra-desde-depto");
  const casaSel = require(join(RAIZ, "src/lib/guia/seleccion-casa")) as typeof import("../../../src/lib/guia/seleccion-casa");
  const { GUIA } = require(join(RAIZ, "src/lib/guia/copy")) as typeof import("../../../src/lib/guia/copy");
  const { YA_ANALIZADO } = require(join(RAIZ, "src/lib/guia/semanal-str")) as typeof import("../../../src/lib/guia/semanal-str");
  const { REGALO_COPY } = require(join(RAIZ, "src/lib/regalo-alta")) as typeof import("../../../src/lib/regalo-alta");

  // ── 1 · EL PERFIL ES DE LA PERSONA ──
  try {
    const dc = codigo("src/app/deptos/deptos-cliente.tsx");
    const r = respuesta as typeof respuesta & { puedePedirCorreo?: (c: readonly string[]) => boolean; lineaBuscas?: (b: unknown) => string; busquedaDePerfil?: (p: unknown) => unknown; cambiosDeBusqueda?: (b: unknown) => unknown; BUSCAS_COPY?: Record<string, string> };
    if (typeof r.puedePedirCorreo !== "function") F("1 · no hay regla de cuándo se puede pedir el correo (puedePedirCorreo)");
    else if (r.puedePedirCorreo([]) || !r.puedePedirCorreo(["Ñuñoa"])) F("1 · sin comuna se puede pedir el correo, o con una no");
    // La portada sin `?comuna=`: ninguna comuna (portada.ts). El componente, dibujado con ella, sin sesión.
    const portada = codigo("src/lib/deptos/portada.ts");
    if (!/if \(!comuna\) \{[\s\S]{0,200}comunas: \[\]/.test(portada) || !/comunas: comuna \? \[comuna\] : \[\]/.test(portada)) F("1 · la portada de /deptos sin ?comuna= no deja la comuna vacía (en la búsqueda y en el respaldo)");
    const { DeptosCliente } = require(join(RAIZ, "src/app/deptos/deptos-cliente")) as typeof import("../../../src/app/deptos/deptos-cliente");
    const rango = respuesta.ELECCIONES_POR_DEFECTO.rango;
    const sinChip = dibujarConRouter(createElement(DeptosCliente, { sesion: null, portada: { noche: null, inicial: null, comunas: [], rango } }));
    if (/data-deptos="correo"/.test(sinChip) || /type="email"/.test(sinChip)) F("1 · /deptos sin comuna elegida muestra el campo del correo: una cuenta podría dejar el correo sin tocar ningún chip");
    if (r.BUSCAS_COPY && !textos(sinChip).includes(r.BUSCAS_COPY.eligeComuna)) F(`1 · /deptos sin comuna no pide elegirla («${r.BUSCAS_COPY.eligeComuna}»)`);
    if (/data-deptos="respuesta"|data-deptos="banda"/.test(sinChip)) F("1 · /deptos sin comuna ya muestra el número o el banner del correo");
    const conChip = dibujarConRouter(createElement(DeptosCliente, { sesion: null, portada: { noche: null, inicial: null, comunas: ["Santiago"], rango } }));
    if (!/data-deptos="correo"/.test(conChip)) F("1 · con la comuna elegida, /deptos no muestra el correo (el guard no puede ser sacar el correo)");
    // El código y Google, las dos puertas, también cortan sin comuna (no solo lo que se dibuja).
    for (const fn of ["async function pedirCodigo", "async function conGoogle"]) {
      const cuerpo = entre(dc, fn, "\n  }\n");
      if (!/if \(!puedePedirCorreo\(comunas\)\) return;/.test(cuerpo)) F(`1 · ${fn.replace("async function ", "")} no corta sin comuna`);
    }
    // «Buscas:» y sus chips: la línea, ida y vuelta con el perfil, y lo que se guarda.
    if (typeof r.lineaBuscas !== "function" || typeof r.busquedaDePerfil !== "function" || typeof r.cambiosDeBusqueda !== "function") F("1 · falta la línea «Buscas» (lineaBuscas, busquedaDePerfil, cambiosDeBusqueda)");
    else {
      if (r.lineaBuscas({ comunas: ["Santiago"], tipologia: "2", rango: "3000-4000" }) !== "Santiago · 2D · UF 3.000 a 4.000") F(`1 · la línea «Buscas» no dice «Santiago · 2D · UF 3.000 a 4.000»: «${r.lineaBuscas({ comunas: ["Santiago"], tipologia: "2", rango: "3000-4000" })}»`);
      for (const t of respuesta.TIPOLOGIAS_DEPTOS) for (const rg of respuesta.RANGOS_UF) {
        const v = respuesta.validarElecciones({ comunas: ["Ñuñoa", "Macul"], tipologias: [t.id], rango: rg.id, modalidad: "ltr" });
        if (!v.ok) { F(`1 · la elección ${t.id}/${rg.id} no valida`); continue; }
        const b = r.busquedaDePerfil(respuesta.perfilManualDeElecciones(v)) as { comunas: string[]; tipologia: string; rango: string } | null;
        if (!b || b.tipologia !== t.id || b.rango !== rg.id || b.comunas.join() !== "Ñuñoa,Macul") F(`1 · el perfil guardado no vuelve a los chips ${t.id}/${rg.id}: ${JSON.stringify(b)}`);
      }
      if (r.cambiosDeBusqueda({ comunas: [], tipologia: "2", rango: "3000-4000" }) !== null) F("1 · «Buscas» sin comuna se guardaría");
    }
    const alta = codigo("src/app/api/deptos/alta/route.ts");
    if (!/estado: "nueva", regaloVence: regalo\.vence, busqueda: busquedaDePerfil\(pend\.perfil/.test(alta)) F("1 · el alta no devuelve la búsqueda con que nació la cuenta (la línea «Buscas»)");
    const dentro = entre(dc, 'paso === "dentro"', "</main>") || entre(dc, 'paso === "dentro"', "\n}\n");
    if (!/data-deptos="buscas"/.test(dentro) || !/lineaBuscas\(busca\)/.test(dentro) || !/data-deptos="cambiar"/.test(dentro)) F("1 · «Estás dentro» no dice «Buscas: … · Cambiar» antes de los deptos");
    // Lo que se toca no se guarda en el toque: recién al seguir («Listo» o «Ir a mi panel»).
    for (const fn of ["const tocarBusca = (", "const tocarComunaBusca = ("]) {
      const cuerpo = entre(dc, fn, "\n  };\n");
      const nombre = fn.replace(/const | = \($/g, "");
      if (!cuerpo) F(`1 · falta ${nombre}`);
      else if (/fetch\(|guardarBusca\(/.test(cuerpo)) F(`1 · ${nombre} guarda en el toque, antes de que la persona siga`);
    }
    if (!/const tocarBusca = \(cambio: Partial<BusquedaDeptos>\) => \{\s*setBusca\(\(b\) => \(b \? \{ \.\.\.b, \.\.\.cambio \} : b\)\);\s*setSinGuardar\(true\);/.test(dc)) F("1 · tocar un chip de «Buscas» no cambia la línea ni queda pendiente de guardar");
    const guardar = entre(dc, "async function guardarBusca", "\n  }\n");
    if (!/fetch\("\/api\/perfil-busqueda", \{ method: "PUT"/.test(guardar) || !/fetch\("\/api\/deptos\/rearmar"/.test(guardar)) F("1 · «Listo» no guarda el perfil y rearma la selección del día");
    const irPanel = entre(dc, "async function irAlPanel", "\n  }\n");
    if (!/if \(sinGuardar && !\(await guardarBusca\(\)\)\) return;\s*router\.push\("\/dashboard"\);/.test(irPanel)) F("1 · «Ir a mi panel» no guarda lo cambiado antes de irse");
    const rearmar = codigo("src/app/api/deptos/rearmar/route.ts");
    if (!/if \(fila\?\.enviada_at\) return/.test(rearmar) || !/\.delete\(\)\.eq\("id", fila\.id\)\.is\("enviada_at", null\)/.test(rearmar) || !/encolarPrimeraSeleccion\(/.test(rearmar)) F("1 · /api/deptos/rearmar no rearma solo la selección del día que todavía no salió");
  } catch (e) {
    F(`1 · no corrió: ${(e as Error).message}`);
  }

  // ── 2 · «ESTÁS DENTRO» NO SE VA SOLA ──
  try {
    const dc = codigo("src/app/deptos/deptos-cliente.tsx");
    const terminar = entre(dc, "const terminarAlta = useCallback(", "}, [posthog, router]);");
    if (!/if \(pasoActual\.current === "dentro"\) return;\s*router\.push\("\/dashboard"\);/.test(terminar) || !/pasoActual\.current = paso;/.test(dc)) F("2 · el alta puede llevar sola al dashboard estando en «Estás dentro»");
    const efecto = entre(dc, 'const entro = new URLSearchParams(window.location.search).get("entro");', "}, [sesion, terminarAlta");
    if (!/\|\| altaPedida\.current\) return;\s*const entro = /.test(dc) || !/altaPedida\.current = true;\s*window\.history\.replaceState\(window\.history\.state, "", window\.location\.pathname\);/.test(efecto) || efecto.indexOf("claveDeDestino(") > efecto.indexOf("replaceState(")) F("2 · el `?entro=1` vuelve a correr el alta después del refresco (o la clave de Google se lee después de limpiar la dirección)");
    if (!/data-deptos="ir-panel"/.test(dc) || !/onClick=\{\(\) => void irAlPanel\(\)\}|onClick=\{irAlPanel\}/.test(dc)) F("2 · «Estás dentro» no tiene «Ir a mi panel»");
  } catch (e) {
    F(`2 · no corrió: ${(e as Error).message}`);
  }

  // ── 3 · LA TARJETA DEL DASHBOARD ABRE EL POP-UP ──
  try {
    const dash = codigo("src/app/dashboard/page.tsx");
    const enCasa = codigo("src/app/dashboard/seleccion-en-casa.tsx");
    if (!enCasa || !/<SemanalLista/.test(enCasa)) F("3 · el dashboard no dibuja la selección con las tarjetas de la selección (SemanalLista)");
    // El banner de arriba ya marca su lista con `data-casa="seleccion"`: el bloque de tarjetas lleva la suya (visto en el QA).
    if (/data-casa="seleccion"/.test(enCasa) || (enCasa.match(/data-casa="tarjetas"/g) ?? []).length !== 3) F("3 · el bloque de tarjetas usa la misma marca que la lista del banner");
    if ((dash.match(/<SeleccionEnCasa sel=\{sel\}/g) ?? []).length < 2) F("3 · la selección como tarjetas no está en las dos ramas del dashboard (sin informes y con informes)");
    if (casaSel.SELECCION_CASA.href !== "#seleccion" || !/id: SELECCION_CASA\.ancla/.test(enCasa)) F(`3 · «Ver tu selección» no baja a la selección del dashboard (href ${casaSel.SELECCION_CASA.href})`);
    for (const p of ["src/app/semanal/semanal-lista.tsx", "src/components/deptos/PrimeraSeleccion.tsx", "src/app/dashboard/seleccion-en-casa.tsx", "src/app/dashboard/casa.tsx", "src/app/dashboard/page.tsx"]) {
      if (/["'`]\/semanal(?:[?"'`]|\$\{)/.test(codigo(p))) F(`3 · ${p} todavía lleva a /semanal`);
    }
    // La tarjeta, dibujada: «Analizar este» es un botón (abre el aviso), con lo que usa al lado.
    const { SemanalLista } = require(join(RAIZ, "src/app/semanal/semanal-lista")) as typeof import("../../../src/app/semanal/semanal-lista");
    const filas = [{ item: item("a1"), caido: false, reemplazo: null }, { item: item("a2", { comuna: "Ñuñoa" }), caido: false, reemplazo: null }];
    const base = { token: TOKEN, origenId: null, combinacion: { piePct: 20, plazoAnios: 25 }, filas, destacado: "a2", variante: null } as const;
    const conRegalo = dibujarConRouter(createElement(SemanalLista, { ...base, saldo: { tipo: "regalo", vence: null } }));
    if (!new RegExp(`<button[^>]*class="guia-an"[^>]*>${GUIA.analizar}</button>`).test(conRegalo)) F("3 · la tarjeta no tiene el botón «Analizar este»");
    if (/href="\/semanal/.test(conRegalo)) F("3 · la tarjeta lleva a /semanal");
    if (!textos(conRegalo).toLowerCase().includes(REGALO_COPY.usaRegalo.toLowerCase().replace(/\.$/, ""))) F("3 · la tarjeta no dice que usa el análisis de regalo");
    const sl = codigo("src/app/semanal/semanal-lista.tsx");
    if (!/onClick=\{\(\) => \{ setError\(null\); setPopup\(null\); setConfirmar\(\{ it, sin: false \}\); \}\}/.test(sl)) F("3 · «Analizar este» no abre el aviso antes de gastar");
    // El aviso, dibujado: con el regalo dice «Usa tu análisis de regalo.»; con saldo, «Usa 1 de tus 3 análisis.».
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
    const aviso = (uso: unknown, extra: Record<string, unknown> = {}) => dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as React.FC<Record<string, unknown>>, {
      depto: item("a2"), combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.5, uf: 39000, arriendo: 450000 }, uso, rutaCompra: "/checkout?product=tres_analisis", alAnalizar() {}, alCancelar() {}, ...extra,
    }));
    if (!textos(aviso({ tipo: "regalo", vence: null })).includes(REGALO_COPY.usaRegalo)) F("3 · el aviso con el regalo no dice «Usa tu análisis de regalo.»");
    if (!textos(aviso({ tipo: "con", n: 3, noVencen: true })).includes(REGALO_COPY.usaUnoDe(3))) F("3 · el aviso con saldo no dice «Usa 1 de tus 3 análisis.»");
  } catch (e) {
    F(`3 · no corrió: ${(e as Error).message}`);
  }

  // ── 4 · ANALIZANDO, CON EL AVISO ABIERTO ──
  try {
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
    const html = dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as React.FC<Record<string, unknown>>, {
      depto: item("a2"), combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.5, uf: 39000, arriendo: 450000 }, uso: { tipo: "regalo", vence: null }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {}, analizando: true,
    }));
    if (!textos(html).includes("Franco está analizando este depto…")) F("4 · al analizar, el aviso no dice «Franco está analizando este depto…»");
    if (!/<button[^>]*disabled=""[^>]*class="wz-cta wz-cta-modal"/.test(html)) F("4 · al analizar, el botón del aviso sigue tocable");
    const sl = codigo("src/app/semanal/semanal-lista.tsx");
    const an = entre(sl, "async function analizar(", "\n  }\n");
    if (!/const soltar = corta \? null : iniciarCarga\(claveActual\(\)\);/.test(an) || !/if \(!corta\) setConfirmar\(\{ it, sin: false, analizando: true \}\);/.test(an)) F("4 · la selección no deja el aviso abierto cargando, con la barra del header, mientras genera");
    if (!/alCancelar=\{\(\) => \{ if \(!confirmar\.analizando\) setConfirmar\(null\); \}\}/.test(sl)) F("4 · el aviso se puede cerrar mientras genera");
    const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
    const anPs = entre(ps, "async function analizar(", "\n  }\n");
    if (!/iniciarCarga\(claveActual\(\)\)/.test(anPs) || !/setConfirmar\(\{ it, sin: false, analizando: true \}\)/.test(anPs)) F("4 · la primera selección no deja el aviso abierto cargando mientras genera");
  } catch (e) {
    F(`4 · no corrió: ${(e as Error).message}`);
  }

  // ── 5 · EL TICKET DE TODA CUENTA NUEVA ──
  try {
    if (!compra) throw new Error("falta lib/guia/compra-desde-depto");
    const ahora = new Date("2026-10-21T15:00:00Z");
    const hace = (h: number) => new Date(ahora.getTime() - h * HORA).toISOString();
    if (!compra.ticketDeCuenta(hace(2), ahora) || compra.ticketDeCuenta(hace(25), ahora) || compra.ticketDeCuenta(null, ahora)) F("5 · el ticket no es de la cuenta con menos de 24 horas");
    const enInforme = (p: Partial<Parameters<typeof compra.ticketEnElInforme>[0]>) => compra.ticketEnElInforme({ cuentaCreadaAt: hace(5), informeCreadoAt: hace(4), primerInforme: true, packPagado: false, ...p });
    if (!enInforme({})) F("5 · el primer informe de una cuenta nueva no lleva el ticket");
    if (enInforme({ primerInforme: false }) || enInforme({ packPagado: true }) || enInforme({ cuentaCreadaAt: hace(30), informeCreadoAt: hace(1) })) F("5 · lleva el ticket un informe que no es el primero, o con el pack pagado, o nacido después de las 24 horas");
    // El informe: leerOfertaPack con la cuenta, contra una base de mentira.
    const { leerOfertaPack } = require(join(RAIZ, "src/lib/lo-que-sigue/oferta-informe-servidor")) as typeof import("../../../src/lib/lo-que-sigue/oferta-informe-servidor");
    const ahoraReal = Date.now();
    const cuenta = { creadaAt: new Date(ahoraReal - 2 * HORA).toISOString(), informeCreadoAt: new Date(ahoraReal - HORA).toISOString(), ambasGroupId: null };
    const oferta = async (conteos: Record<string, number>, extra: Record<string, unknown> = {}) => {
      const b = baseDeConteos(conteos);
      const r = await (leerOfertaPack as unknown as (a: SupabaseClient, p: Record<string, unknown>) => Promise<{ oferta: boolean; motivo: string; desde?: string | null; correo: string | null }>)(b.admin, {
        analysisId: "inf-1", fila: {}, quienMira: "sesion", esDemo: false, correoSesion: "nueva@prueba.cl", duenoId: "u-1", cuenta, ...extra,
      });
      return { r, consultas: b.consultas };
    };
    const o1 = await oferta({ analisis: 0, payments: 0 });
    if (!o1.r.oferta || o1.r.desde !== cuenta.creadaAt || o1.r.correo !== "nueva@prueba.cl") F(`5 · el primer informe de una cuenta con menos de 24 horas no lleva el ticket, desde la cuenta: ${JSON.stringify(o1.r)}`);
    const previa = o1.consultas.find((c) => c.tabla === "analisis");
    if (!previa || !previa.filtros.some((f) => f.startsWith('lt("created_at"')) || !previa.filtros.some((f) => f.startsWith('neq("id"'))) F("5 · «el primer informe» no se cuenta por los informes anteriores de la cuenta");
    if ((await oferta({ analisis: 1, payments: 0 })).r.oferta) F("5 · el segundo informe de la cuenta lleva el ticket");
    if ((await oferta({ analisis: 0, payments: 1 })).r.oferta) F("5 · con el pack ya pagado, el informe lleva el ticket otra vez");
    if ((await oferta({ analisis: 0, payments: 0 }, { quienMira: "anonimo" })).r.oferta) F("5 · el ticket de la cuenta sale para quien no entró con ella");
    // El ticket en el informe cuenta desde la cuenta y sube la primera vez (entrar con la sesión no es volver).
    for (const p of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) {
      const c = codigo(p);
      if (!/<TicketPack ctx=\{ctxLqs\} createdAt=\{ticketDesde \?\? createdAt\}[^>]*conSesion=\{[^}]*&& !ticketDesde\}/.test(c)) F(`5 · ${p}: el ticket no cuenta desde la cuenta o no sube la primera vez`);
    }
    for (const p of ["src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/renta-corta/[id]/informe-str.tsx"]) {
      if (!/cuenta: isOwner && user \? \{ creadaAt: user\.created_at/.test(codigo(p))) F(`5 · ${p} no le pasa la cuenta a la oferta del pack`);
    }
    // El pop-up sin saldo: el pack (ticket o no) y el suelto, de vuelta al depto.
    const conTicket = compra.comprasDelDepto({ token: TOKEN, avisoId: "a2", origen: "semanal", ticket: true });
    const sinTicket = compra.comprasDelDepto({ token: TOKEN, avisoId: "a2", origen: "semanal", ticket: false });
    const q = (href: string) => new URL(href, "https://x.cl").searchParams;
    if (conTicket.pack.label !== "3 análisis · $14.990" || q(conTicket.pack.href).get("product") !== "pack3") F(`5 · con la cuenta nueva el pack no va a 3 por $14.990: ${conTicket.pack.label} ${conTicket.pack.href}`);
    if (sinTicket.pack.label !== "3 análisis · $19.990" || q(sinTicket.pack.href).get("product") !== "tres_analisis") F(`5 · sin el ticket el pack no es el de $19.990: ${sinTicket.pack.label}`);
    if (conTicket.suelto.label !== "Comprar solo 1 · $9.990" || q(conTicket.suelto.href).get("product") !== "single") F(`5 · el secundario no es «Comprar solo 1 · $9.990»: ${conTicket.suelto.label}`);
    for (const [n, href] of [["pack", conTicket.pack.href], ["pack de tres", sinTicket.pack.href], ["suelto", conTicket.suelto.href]] as const) {
      const v = q(href).get("volver");
      const d = compra.deptoDeVolver(v);
      if (!d || d.t !== TOKEN || d.a !== "a2" || !compra.analizaAlVolver(v)) F(`5 · el ${n} no vuelve al depto para analizarlo solo: ${v}`);
    }
    if (compra.deptoDeVolver("//evil.com/dashboard?t=" + TOKEN + "&a=a2") || compra.analizaAlVolver("/dashboard?t=" + TOKEN)) F("5 · la vuelta acepta un destino de afuera, o analiza sin depto");
    // El aviso dibujado sin saldo: el pack principal y el suelto debajo.
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
    const sinSaldo = textos(dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as React.FC<Record<string, unknown>>, {
      depto: item("a2"), combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.5, uf: 39000, arriendo: 450000 }, uso: { tipo: "sin" }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {}, compras: conTicket,
    })));
    const iPack = sinSaldo.indexOf("3 análisis · $14.990"), iSuelto = sinSaldo.indexOf("Comprar solo 1 · $9.990");
    if (iPack < 0 || iSuelto < 0 || iSuelto < iPack) F("5 · el aviso sin saldo no ofrece el pack y debajo «Comprar solo 1 · $9.990»");
    if (!sinSaldo.includes("3 análisis por $14.990")) F("5 · el aviso sin saldo de una cuenta nueva no dice el precio del ticket");
    const sl = codigo("src/app/semanal/semanal-lista.tsx"), ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
    if (!/compras=\{comprasDelDepto\(\{ token, avisoId: confirmar\.it\.avisoId, origen: origenCompra, variante: varianteCompra, ticket \}\)\}/.test(sl)) F("5 · la selección no le pasa las dos compras al aviso");
    if (!/compras=\{datos\.token \? comprasDelDepto\(\{ token: datos\.token, avisoId: confirmar\.it\.avisoId, origen: "semanal", ticket: !!datos\.ticket \}\) : null\}/.test(ps)) F("5 · la primera selección no le pasa las dos compras al aviso");
    if (!/ticketDeCuentaDisponible\(admin, user\)/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("5 · la primera selección no sabe si la cuenta tiene el ticket");
    // El cobro: el pack sin informe atado vale para la cuenta nueva; el pack y el suelto vuelven al depto.
    const pc = codigo("src/app/api/payments/create/route.ts");
    if (!/const ticketCuenta = product === PRODUCTO_PACK && ticketDeCuenta\(user\.created_at\)\s*&& !\(await packPagadoPorCuenta\(/.test(pc) || !/if \(product === PRODUCTO_PACK && !analysisId && !ticketCuenta\)/.test(pc)) F("5 · payments/create no cobra el pack del ticket a la cuenta nueva sin informe atado (o lo cobra dos veces)");
    if (!/const conVuelta = esTres \|\| \(\(product === PRODUCTO_PACK \|\| product === "single"\) && !analysisId\);/.test(pc)) F("5 · el pack y el suelto comprados desde un depto no vuelven al depto");
    const ck = codigo("src/app/checkout/page.tsx"), cc = codigo("src/app/checkout/compra-cliente.tsx");
    if (!/const conVuelta = esTres \|\| \(\(productKey === PRODUCTO_PACK \|\| productKey === "single"\) && !analysisId\);/.test(ck) || !/deptoDeVolver\(volver\)/.test(ck) || !/data-compra="depto"/.test(cc)) F("5 · la pantalla de compra no muestra el depto ni guarda la vuelta");
    const rt = codigo("src/app/payments/return/page.tsx");
    if (!/!data\.payment\.analysis_id && volver && analizaAlVolver\(volver\)\) \{[\s\S]{0,140}router\.replace\(volver\)/.test(rt)) F("5 · pagado desde un depto, la vuelta de Flow no sigue sola al depto");
  } catch (e) {
    F(`5 · no corrió: ${(e as Error).message}`);
  }

  // ── 6 · EN VIVO ──
  try {
    const { SemanalLista } = require(join(RAIZ, "src/app/semanal/semanal-lista")) as typeof import("../../../src/app/semanal/semanal-lista");
    const filas = [{ item: item("a1"), caido: false, reemplazo: null }, { item: item("a2"), caido: false, reemplazo: null }];
    const html = dibujarConRouter(createElement(SemanalLista as unknown as React.FC<Record<string, unknown>>, {
      token: TOKEN, origenId: null, combinacion: { piePct: 20, plazoAnios: 25 }, filas, destacado: null, variante: null, saldo: { tipo: "con", n: 2, noVencen: true }, informes: { a1: "inf-1" },
    }));
    if (!/href="\/analisis\/inf-1"/.test(html) || !textos(html).includes(YA_ANALIZADO.texto)) F("6 · en renta larga, el depto ya analizado no dice «Ya lo analizaste · Ver informe» con lo leído en vivo");
    if ((html.match(/class="guia-an"/g) ?? []).length !== 1) F(`6 · el ya analizado sigue con «Analizar este» (o el otro lo perdió): ${(html.match(/class="guia-an"/g) ?? []).length} botones`);
    const sps = codigo("src/lib/guia/seleccion-pagina-servidor.ts");
    if (!/informesDeAvisos\(admin, userId, ids\)/.test(sps) || !/informes: informesLargos/.test(sps)) F("6 · la selección del dashboard no lee en vivo los informes de renta larga");
    const prim = codigo("src/lib/deptos/primeros-servidor.ts");
    // Los dos caminos, cada uno con su mapeo: la selección del día ya armada (`i`) y los de la noche (`d`).
    if ((prim.match(/informesDeAvisos\(admin, userId,/g) ?? []).length < 2 || !/enSeleccion: true, informeId: informes\[i\.avisoId\] \?\? null,/.test(prim) || !/\(\{ \.\.\.d, enSeleccion, informeId: informes\[d\.avisoId\] \?\? null \}\)/.test(prim)) F("6 · la primera selección del día no trae lo ya analizado (en sus dos caminos)");
    const ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
    if (!/\{it\.informeId \? \([\s\S]{0,200}data-primera="ya-analizado"[\s\S]{0,300}href=\{`\/analisis\/\$\{it\.informeId\}`\}/.test(ps)) F("6 · la primera selección no dice «Ya lo analizaste · Ver informe»");
    if (!/window\.addEventListener\("pageshow", alVolver\)/.test(ps)) F("6 · la primera selección no se relee al volver atrás desde el informe");
    // El dashboard se pide de nuevo al volver, sin recargar.
    const fresco = cargar<typeof import("../../../src/app/dashboard/fresco-al-volver")>("src/app/dashboard/fresco-al-volver");
    if (!fresco) F("6 · falta el refresco del dashboard al volver (fresco-al-volver)");
    else {
      if (!fresco.debeRefrescar(0, fresco.FRESCO_MS + 1) || fresco.debeRefrescar(0, 1000)) F("6 · el refresco al volver no distingue lo recién dibujado de lo guardado");
      const fv = codigo("src/app/dashboard/fresco-al-volver.tsx");
      if (!/if \(debeRefrescar\(dibujadoAt, Date\.now\(\)\)\) router\.refresh\(\);/.test(fv) || !/if \(e\.persisted\) router\.refresh\(\);/.test(fv)) F("6 · el dashboard no se pide de nuevo al volver (router o caché del navegador)");
    }
    const dash = codigo("src/app/dashboard/page.tsx");
    if ((dash.match(/<FrescoAlVolver dibujadoAt=\{dibujadoAt\} \/>/g) ?? []).length < 2 || !/const dibujadoAt = Date\.now\(\);/.test(dash)) F("6 · el refresco al volver no está en las dos ramas del dashboard");
    // Volvió pagado: el depto se analiza solo, una vez, y la dirección queda sin `analizar`.
    const sl = codigo("src/app/semanal/semanal-lista.tsx");
    const auto = entre(sl, "const autoHecho = useRef(false);", "}, [autoAnalizar]);");
    if (!/u\.searchParams\.delete\("analizar"\)/.test(auto) || !/void analizar\(it, true\);/.test(auto) || !/autoHecho\.current = true;/.test(auto)) F("6 · al volver pagado, el depto no se analiza solo una vez");
    if (!/const autoAnalizar = uno\("analizar"\) === "1" \? aSel : null;/.test(dash)) F("6 · el dashboard no le pasa a la selección el depto que vuelve pagado");
  } catch (e) {
    F(`6 · no corrió: ${(e as Error).message}`);
  }

  // ── 7 · UNA SOLA PÁGINA ──
  try {
    const href = (casaSel as { hrefSeleccion?: (t: string | null, a?: string | null, d?: boolean) => string }).hrefSeleccion;
    if (typeof href !== "function") F("7 · no hay un destino único para la selección (hrefSeleccion)");
    else {
      if (href(TOKEN, "a2") !== `/dashboard?t=${TOKEN}&a=a2#seleccion`) F(`7 · el destino del clic no es el dashboard con el depto: ${href(TOKEN, "a2")}`);
      if (href(TOKEN, "a2", true) !== `/dashboard?t=${TOKEN}&a=a2&d=1#seleccion` || href(null) !== "/dashboard#seleccion") F("7 · el destino del clic pierde el despublicado o la selección sin token");
    }
    const clic = codigo("src/app/api/semanal/clic/route.ts");
    if (/\/semanal\?t=/.test(clic) || !/return volver\(hrefSeleccion\(t, avisoId, estado === "despublicado"\)\);/.test(clic) || !/if \(!avisoId\) return volver\(hrefSeleccion\(t\)\);/.test(clic)) F("7 · el clic del correo no aterriza en el dashboard");
    if (!/event: "semanal_clic"/.test(clic) || !/event: "aviso_inmediato_clic"/.test(clic) || !/evento: EVENTOS_META\.semanalClic/.test(clic) || !/entrarConCorreo\(/.test(clic)) F("7 · el clic del correo dejó de medirse (semanal_clic, aviso_inmediato_clic, SemanalClic) o de entrar solo");
    const sem = codigo("src/app/semanal/page.tsx");
    if (!/redirect\(hrefSeleccion\(/.test(sem) || /<SemanalLista/.test(sem)) F("7 · /semanal no redirige al dashboard");
    const dash = codigo("src/app/dashboard/page.tsx");
    if (!/if \(!user && tSel\) redirect\(hrefEntrar\(`\/dashboard\?\$\{/.test(dash) || !/cargarSeleccionPagina\(admin, user, \{ t: tSel, a: aSel \}\)/.test(dash)) F("7 · el dashboard no abre la selección del token del correo (o sin sesión la pierde)");
  } catch (e) {
    F(`7 · no corrió: ${(e as Error).message}`);
  }

  if (fallas.length) {
    console.log(`  ✗ ROJO — ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — /deptos pide la comuna antes del correo y «Estás dentro» dice qué busca y se queda; la selección vive en el dashboard con «Analizar este», el aviso cargando y el ticket de la cuenta nueva con el suelto debajo; lo analizado se ve en vivo y el clic del correo aterriza ahí");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (21-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 3a84847f, todo `src/` del goal de vuelta a HEAD y los
// archivos nuevos apartados): 43 fallas, entre ellas «/deptos sin comuna elegida muestra el campo del correo», «el dashboard
// no dibuja la selección con las tarjetas de la selección», «falta lib/guia/compra-desde-depto» y «en renta larga, el depto
// ya analizado no dice «Ya lo analizaste · Ver informe»». Y 38 mutaciones, cada una restaurada byte a byte, todas ROJAS:
//   R1 la portada trae Santiago · R2 el correo sin comuna · R3 el código sin comuna · R4 la regla deja pedirlo sin comuna ·
//   R5 el alta sin la búsqueda · R6 un chip guarda en el toque · R7 «Ir a mi panel» no guarda · R8 el rearmado borra la ya
//   enviada · R9 el alta se va al dashboard · R10 el `?entro` corre dos veces · R11 «Ver tu selección» a /semanal · R12 la
//   casa con informes sin tarjetas · R13 «Analizar este» genera sin aviso · R14 sin «Franco está analizando» · R15 el aviso
//   se cierra al generar · R16 el botón sigue tocable · R17 el ticket sin las 24 horas · R18 el informe de la cuenta sin
//   ticket · R19 «el primero» sin mirar los anteriores · R20 el ticket cuenta desde el informe · R21 el suelto sin vuelta ·
//   R22 sin «Comprar solo 1» · R23 el cobro sin el ticket de la cuenta · R24 la vuelta de Flow no sigue · R25 el pack a
//   $19.990 con el ticket · R26 la compra sin el depto · R27 lo analizado no en vivo · R28 el cargador sin informes ·
//   R29 un camino de la primera selección sin lo analizado (la primera versión lo dejaba VERDE: le bastaba un mapeo de los
//   dos; ahora exige cada uno) · R30 sin releer al volver · R31 sin refresco · R32 una casa sin refresco · R33 analiza dos
//   veces · R34 refresca siempre · R35 el clic a /semanal · R36 el destino a /semanal · R37 /semanal no redirige · R38 sin
//   sesión se pierde el token.

if (require.main === module) {
  runPuertaBRecorridoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
