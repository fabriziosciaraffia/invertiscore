// ============================================================================
// TIER TASA-EDITABLE — la tasa editable en Filtros, con cuenta (30-oct-2026, goal de Fabrizio).
//
//   1 · LA TASA ELEGIDA SE VE: en Filtros («Tu financiamiento»: «La de hoy (X %)» y de 3,0 % a 6,0 %, de a 0,25; sin cuenta,
//       cerrada y pide registro), en «¿Cómo se calcula?» («Ahora el mapa calcula con tu tasa, 4,5 %; la de hoy es 4,07 %.»),
//       en el pop-up de «Analizar este» (la línea y «Cambiar», con el veredicto recalculado antes de cobrar) y en la portada
//       del informe que sale de ahí («Calculado con tu tasa, 4,5 % (tasa promedio sistema financiero: 4,07 %)»).
//   2 · UNA TASA NUEVA SE CALCULA Y SE GUARDA CON SU CLAVE: nada sale de la noche; lo calculado va a `combos` con la tasa en
//       la clave («20-30-t4.5»), 24 horas; el crédito se hace con ella y la «de mercado» sigue siendo la del motor.
//   3 · UN PERFIL CON TASA LA USA: el semanal (renta larga y corta), la selección del día y el pop-up; el informe se hace con
//       ella. Sin tasa elegida, la del motor —no la de su último informe (decisión de Fabrizio)—.
//   4 · «LA DE HOY» SIGUE AL MOTOR: es null en los filtros y en el perfil (nunca el número del día), y su etiqueta dice la
//       tasa del motor que le llega.
//   5 · LA MEDICIÓN: «explorar_tasa» con la tasa elegida, en Filtros y en el pop-up.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. §2 lee una fila real (solo lectura).
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/tasa-editable-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";
import * as ab from "../../../src/lib/explorar/abierto";
import { esTasaElegible, TASAS_ELEGIBLES, tasaElegidaDe } from "../../../src/lib/deptos/estandar";
import { MANUAL_VACIO, perfilDeBusqueda, validarCambiosPerfil } from "../../../src/lib/perfil-busqueda";
import { lineaTasaPortada, tasaDePortada } from "../../../src/lib/guia/tasa-portada";
import { EXPLORAR_COPY, textoCambio } from "../../../src/lib/explorar/explorar";

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
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujar(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
/** Una base de mentira para lo calculado (como EXPLORAR-PORTAL §7): anota las RPC y lo que se guarda. */
function baseFalsa(rpcRes: Record<string, (p: Record<string, unknown>) => unknown>) {
  const rpcs: Array<{ nombre: string; params: Record<string, unknown> }> = [];
  const rpc = (nombre: string, params: Record<string, unknown>) => { rpcs.push({ nombre, params }); return Promise.resolve(rpcRes[nombre] ? rpcRes[nombre](params) : { data: null, error: null }); };
  return { admin: { rpc, from: () => ({}) } as never, rpcs };
}

const G = po.FILTROS_GLOBALES;
const PIN: po.PinMapa = { avisoId: "a1111111-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.4263, lng: -70.617, m2: 79, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 142264, arriendo: 865_000, condicion: "usado", alta: null };
const cuentaBase = () => ({
  analizados: {}, guardados: [], saldo: { tipo: "con", n: 2, noVencen: false }, suscrito: false, ticket: false, cuentaCreadaAt: null, finanzas: { uf: 39000, tasa: 4.07 },
  miBusqueda: null, busquedaActual: null, explorarEnMes: 0,
});

export async function runTasaEditableTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER TASA-EDITABLE (la tasa en Filtros, la hoja, el pop-up y la portada; se calcula con su clave; el perfil la usa; «La de hoy» sigue al motor · 0 tokens) ───");

  // ── 1 · LA TASA ELEGIDA SE VE ──
  if (TASAS_ELEGIBLES.length !== 13 || TASAS_ELEGIBLES[0] !== 3 || TASAS_ELEGIBLES[12] !== 6 || TASAS_ELEGIBLES[1] !== 3.25 || !esTasaElegible(4.75) || esTasaElegible(4.3) || esTasaElegible(6.25)) F("1 · las tasas elegibles no son de 3,0 % a 6,0 %, de a 0,25");
  const modFil = cargar<{ HojaFiltros: FC<Record<string, unknown>> }>("src/app/explorar/hoja-filtros", F);
  if (modFil) {
    const con = dibujar(createElement(modFil.HojaFiltros, { filtros: { ...G, tasa: 4.5 }, tasa: { tasa: 4.07 }, miBusqueda: { activa: false, alUsar() {} }, contar: () => 10, asegurar() {}, alAplicar() {}, alCerrar() {}, alPedirRegistro: null }));
    const fin = con.slice(con.indexOf('data-explorar="bloque-financiamiento"'));
    const sel = fin.match(/<select[^>]*data-explorar="tasa"[^>]*>([\s\S]*?)<\/select>/);
    const opciones = sel ? Array.from(sel[1].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)).map((m) => `${m[1]}=${m[2]}`) : [];
    if (!sel || opciones[0] !== "=La de hoy (4,07 %)" || opciones.length !== 14 || opciones[1] !== "3=3 %" || opciones[13] !== "6=6 %" || !opciones.includes("4.25=4,25 %")) F(`1 · Filtros no ofrece «La de hoy (4,07 %)» y de 3 % a 6 % de a 0,25: ${opciones.slice(0, 3).join(" | ")}…`);
    if (!/<option value="4\.5" selected="">4,5 %<\/option>/.test(fin)) F("1 · Filtros no muestra la tasa elegida (4,5 %)");
    const sin = dibujar(createElement(modFil.HojaFiltros, { filtros: G, tasa: { tasa: 4.07 }, miBusqueda: null, contar: () => 10, asegurar() {}, alAplicar() {}, alCerrar() {}, alPedirRegistro: () => {} }));
    if (/<select[^>]*data-explorar="tasa"/.test(sin) || !/<button type="button" class="ex-campo ex-campo-cerrado ex-campo-fijo" data-explorar="tasa"><span>Tasa<\/span><b>4,07 % · promedio de los bancos<\/b><\/button>/.test(sin)) F("1 · sin cuenta la tasa no va cerrada, con la de hoy");
  }
  if (!/onClick=\{\(\) => alPedirRegistro\("pie-plazo", b\)\} data-explorar="tasa"/.test(codigo("src/app/explorar/hoja-filtros.tsx"))) F("1 · sin cuenta, tocar la tasa no abre el registro");
  const modCal = cargar<{ HojaCalculo: FC<Record<string, unknown>> }>("src/app/explorar/hoja-calculo", F);
  if (modCal) {
    const t = (elegida: number | null, sinCuenta = false) => texto(dibujar(createElement(modCal.HojaCalculo, { tasa: { tasa: 4.07 }, elegida, sinCuenta, alCerrar() {} }))).replace(/ ([.,;])/g, "$1");
    if (!t(4.5).includes("Puedes cambiar ese perfil en Filtros. Ahora el mapa calcula con tu tasa, 4,5 %; la de hoy es 4,07 %.")) F("1 · «¿Cómo se calcula?» no dice la tasa elegida y la de hoy");
    if (/tu tasa|la de hoy es/.test(t(null)) || /tu tasa/.test(t(4.5, true))) F("1 · «¿Cómo se calcula?» habla de una tasa elegida sin que la haya");
  }
  if (!/elegida=\{filtros\.tasa\}/.test(codigo("src/app/explorar/explorar-cliente.tsx"))) F("1 · la hoja no recibe la tasa de los filtros");
  const modAv = cargar<{ AvisoAntesDeAnalizar: FC<Record<string, unknown>> }>("src/components/guia/AvisoAntesDeAnalizar", F);
  if (modAv) {
    const base = { depto: PIN, finanzas: { tasa: 4.07, uf: 39000, arriendo: PIN.arriendo }, uso: { tipo: "con", n: 2, noVencen: false }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {} };
    // texto() deja un espacio donde cerraba el <b>: se junta con su puntuación.
    const conT = texto(dibujarPopup(createElement(modAv.AvisoAntesDeAnalizar, { ...base, combinacion: { piePct: 20, plazoAnios: 30, tasaPct: 4.5 } }))).replace(/ ([.,;])/g, "$1");
    const hoy = texto(dibujarPopup(createElement(modAv.AvisoAntesDeAnalizar, { ...base, combinacion: { piePct: 20, plazoAnios: 30 } }))).replace(/ ([.,;])/g, "$1");
    if (!conT.includes("Con pie de 20 %, plazo de 30 años y tasa de 4,5 %") || !hoy.includes("Con pie de 20 %, plazo de 30 años y tasa de 4,07 %")) F("1 · el pop-up no dice la tasa (la elegida, o la de hoy)");
  }
  const av = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
  if (!/<select className="av-select" data-aviso="tasa"[^>]*value=\{combo\.tasaPct \?\? ""\} onChange=\{\(e\) => setCombo\(\(x\) => \(\{ \.\.\.x, tasaPct: e\.target\.value === "" \? null : Number\(e\.target\.value\) \}\)\)\}/.test(av) || !/<option value="">\{EXPLORAR_COPY\.tasaHoy\(finanzas\.tasa\)\}<\/option>\s*\{TASAS_ELEGIBLES\.map/.test(av)) F("1 · «Cambiar» del pop-up no deja elegir la tasa (o «La de hoy» no es la primera)");
  if (!/const cambiada = [^;]*combo\.tasaPct !== \(combinacion\.tasaPct \?\? null\);/.test(av) || !/\}, \[combo\.piePct, combo\.plazoAnios, combo\.tasaPct, cambiada\]\);/.test(av)) F("1 · cambiar la tasa en el pop-up no recalcula el veredicto (y se cobraría sin él)");
  if (!/derivadosAviso\(depto, combo, \{ \.\.\.finanzas, tasa: tasaVista \}\)/.test(av) || !/EXPLORAR_COPY\.guardarPerfil\(combo\.piePct, combo\.plazoAnios, combo\.tasaPct\)/.test(av)) F("1 · el dividendo o la casilla del perfil no siguen a la tasa elegida");
  const cambio = textoCambio({ antes: { pie: 20, plazo: 30, tasa: null, veredicto: "COMPRAR", score: 84, flujo: 1000 }, despues: { pie: 20, plazo: 30, tasa: 5.5, veredicto: "AJUSTA SUPUESTOS", score: 60, flujo: -2000 } }, (v) => (v === "COMPRAR" ? "Comprar" : "Ajustar"));
  if (!cambio.titulo.startsWith("Con tasa 5,5 % este depto da") || !cambio.detalle.includes("Con la tasa de hoy daba Comprar 84")) F(`1 · el cambio de solo la tasa no lo dice: «${cambio.titulo} ${cambio.detalle}»`);
  if (EXPLORAR_COPY.guardarPerfil(20, 30, 4.5) !== "Guardar 20 %, 30 años y tasa 4,5 % como mi perfil de búsqueda") F("1 · la casilla del perfil no nombra la tasa elegida");
  // La portada del informe.
  const tp = tasaDePortada({ origenAviso: { avisoId: "x", tasaElegida: 4.5, tasaMercado: 4.07 } });
  if (!tp || lineaTasaPortada(tp) !== "Calculado con tu tasa, 4,5 % (tasa promedio sistema financiero: 4,07 %)" || tasaDePortada({ origenAviso: { avisoId: "x" } }) !== null || tasaDePortada(null) !== null) F("1 · la portada no dice «Calculado con tu tasa, 4,5 % (tasa promedio sistema financiero: 4,07 %)» (o lo dice sin tasa elegida)");
  if (!/\{tasaElegida && <p className="doc-hero-tasa" data-portada="tasa-elegida">\{lineaTasaPortada\(tasaElegida\)\}<\/p>\}/.test(codigo("src/components/analysis/portada/PortadaInforme.tsx"))) F("1 · la portada no dibuja la línea de la tasa bajo el veredicto");
  for (const p of ["src/components/analysis/SubjectCardGrid.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) if (!/tasaElegida=\{tasaDePortada\(inputData\)\}/.test(codigo(p))) F(`1 · ${p} no le pasa la tasa elegida a la portada`);
  // Cada ruta deja la tasa elegida y la del motor en `origenAviso`: la portada las lee de ahí.
  for (const [p, deja] of [
    ["src/app/api/lo-que-sigue/guia/analizar/route.ts", /body\.origenAviso\.tasaElegida = tasaElegida; body\.origenAviso\.tasaMercado = cfg\.tasa;/],
    ["src/app/api/semanal/analizar-str/route.ts", /\.\.\.\(tasaElegida != null \? \{ tasaElegida, tasaMercado: cfg\.tasa \} : \{\}\)/],
  ] as const) {
    const c = codigo(p);
    if (!/const tasaElegida = "tasaPct" in b \? tasaElegidaDe\(b\.tasaPct\) : /.test(c) || !deja.test(c)) F(`1 · ${p} no hace el informe con la tasa elegida o no la deja para la portada`);
  }

  // ── 2 · UNA TASA NUEVA SE CALCULA Y SE GUARDA CON SU CLAVE ──
  if (po.universoDeLaNoche({ modalidad: "ltr", pie: 20, plazo: 30, tasa: 4.5 }) || !po.universoDeLaNoche({ modalidad: "ltr", pie: 20, plazo: 30, tasa: null })) F("2 · con una tasa elegida el universo sale de la noche (o sin ella, no)");
  if (po.claveUniverso({ modalidad: "ltr", pie: 20, plazo: 30, tasa: 4.5 }) !== "ltr-20-30-t4.5" || po.claveUniverso({ modalidad: "ltr", pie: 20, plazo: 30, tasa: null }) !== "ltr-20-30") F("2 · la clave del universo no lleva la tasa");
  if (po.urlDePortal({ ...G, tasa: 4.5 }) !== "ta=4.5" || po.portalDeUrl(new URLSearchParams("ta=4.5")).filtros.tasa !== 4.5 || po.portalDeUrl(new URLSearchParams("ta=4.3")).filtros.tasa !== null || po.validarPortal({ tasa: 7 }).tasa !== null) F("2 · la tasa no va y vuelve por la URL (o acepta una que no es de la lista)");
  try {
    const srv = require(join(RAIZ, "src/lib/explorar/portal-servidor")) as typeof import("../../../src/lib/explorar/portal-servidor");
    if (srv.claveComboPortal("ltr", 20, 30, 4.5) !== "20-30-t4.5" || srv.claveComboPortal("str", 20, 30, 4.5) !== "str-20-30-t4.5" || srv.claveComboPortal("ltr", 15, 20) !== "15-20") F("2 · la clave de lo calculado no lleva la tasa (o cambió la de siempre)");
    const ahora = new Date("2026-10-30T12:00:00Z");
    const fila = (id: string) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 50, dormitorios: 1, banos: 1, precio_uf: 3000, arriendo_monto: 500000, evaluado_at: "2026-10-30T03:00:00Z", combo: null, pub_estado: null, pub_at: null, condicion: "usado", alta: 1 });
    const pesada = (id: string) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 50, dormitorios: 1, banos: 1, condicion: "usado", precio_uf: 3000 });
    const guardados: Array<{ combo: Record<string, unknown> }> = [];
    const tasasVistas: Array<number | null | undefined> = [];
    const { admin, rpcs } = baseFalsa({
      explorar_universo_liviano: () => ({ data: [fila("A"), fila("B")], error: null }),
      explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map(pesada), error: null }),
      explorar_guardar_combos: (p) => { guardados.push(...(p.filas as Array<{ combo: Record<string, unknown> }>)); return { data: 1, error: null }; },
    });
    const pines = await srv.universoCalculado(admin, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 4.5 }, ahora, undefined, {
      cfg: { uf: 39000, tasa: 4.07 },
      sondaLtr: ((_c: unknown, combo: { tasa?: number | null }, cfg: { tasa: number }) => { tasasVistas.push(combo.tasa); return { veredicto: cfg.tasa === 4.07 && combo.tasa === 4.5 ? "COMPRAR" : null, score: 70, flujo: 1, cuota: 1 }; }) as never,
    });
    const liviano = rpcs.find((r) => r.nombre === "explorar_universo_liviano");
    if (liviano?.params.clave !== "20-30-t4.5") F(`2 · lo calculado se lee con otra clave: ${String(liviano?.params.clave)}`);
    if (tasasVistas.length !== 2 || tasasVistas.some((t) => t !== 4.5) || pines.length !== 2) F(`2 · el cálculo no usa la tasa elegida para el crédito (o la de mercado dejó de ser la del motor): ${tasasVistas.join(",")}`);
    if (guardados.length !== 2 || !guardados.every((g) => Object.keys(g.combo).join() === "20-30-t4.5")) F("2 · lo calculado con la tasa no se guarda bajo su clave");
  } catch (e) {
    F(`2 · lo calculado con tasa explotó: ${(e as Error).message}`);
  }
  if (!/const comboVigente|comboVigente\(r\.combo, r\.evaluado_at, ahora\)/.test(codigo("src/lib/explorar/portal-servidor.ts")) || !/export const VIDA_COMBO_MS = 24 \* 3600_000;/.test(codigo("src/lib/explorar/explorar.ts"))) F("2 · lo calculado no vale 24 horas");
  const ruta = codigo("src/app/api/explorar/route.ts");
  if (!/const tasa = tasaElegidaDe\(sp\.get\("ta"\)\);/.test(ruta) || !/const q = \{ modalidad, pie, plazo, tasa \} as const;/.test(ruta)) F("2 · la API del mapa no recibe la tasa");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  if (!/&z=\$\{f\.plazo\}\$\{f\.tasa != null \? `&ta=\$\{f\.tasa\}` : ""\}/.test(cli)) F("2 · el navegador no pide el universo con la tasa");
  if (!/const enCalculo = progreso \? \(conTasa \? PORTAL_COPY\.calculandoTasaComunas : PORTAL_COPY\.calculandoComunas\)/.test(cli) || po.PORTAL_COPY.calculandoTasa !== "Calculando con tu tasa…") F("2 · mientras calcula con una tasa elegida no dice «Calculando con tu tasa…»");
  const modCli = cargar<{ ExplorarCliente: FC<Record<string, unknown>> }>("src/app/explorar/explorar-cliente", F);
  if (modCli && !texto(dibujar(createElement(modCli.ExplorarCliente, { inicial: { filtros: { ...G, tasa: 4.5 }, orden: "puntaje", n: null, cuenta: cuentaBase(), tasa: { tasa: 4.07 }, convienen: null } }))).includes("Calculando con tu tasa…")) F("2 · el mapa con una tasa elegida no dice «Calculando con tu tasa…»");
  const rec = codigo("src/app/api/explorar/recalcular/route.ts");
  if (!/const tasa = tasaElegidaDe\(b\.tasaPct\);/.test(rec) || !/sondaDeCandidato\(c, \{ piePct: Number\(b\.piePct\), plazoAnios: Number\(b\.plazoAnios\), tasa \}, cfg\)/.test(rec)) F("2 · el recálculo del pop-up no usa la tasa elegida");
  if (!/respuestasDeAviso\(avisoDeCandidato\(c\), combo\.piePct, combo\.tasa \?\? cfg\.tasa, c\.arriendo\.monto, \{ plazo: combo\.plazoAnios, tasaMercado: cfg\.tasa \}\)/.test(codigo("src/lib/avisos/estandar-deptos.ts"))) F("2 · la sonda no hace el crédito con la tasa elegida (o la de mercado no es la del motor)");
  // Con un aviso real (solo lectura): con 6 % la cuota sube y con 3 % baja.
  try {
    const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await admin.from("avisos_evaluados").select("aviso_id").eq("veredicto_20", "COMPRAR").order("aviso_id").limit(5);
    const { candidatoExplorar } = require(join(RAIZ, "src/lib/explorar/servidor")) as typeof import("../../../src/lib/explorar/servidor");
    const { leerConfigGuia } = require(join(RAIZ, "src/lib/guia/guia-servidor")) as typeof import("../../../src/lib/guia/guia-servidor");
    const { sondaDeCandidato } = require(join(RAIZ, "src/lib/avisos/estandar-deptos")) as typeof import("../../../src/lib/avisos/estandar-deptos");
    const cfg = await leerConfigGuia(admin);
    let medido = false;
    for (const f of (data ?? []) as Array<{ aviso_id: string }>) {
      const c = await candidatoExplorar(admin, f.aviso_id);
      if (!c) continue;
      const s3 = sondaDeCandidato(c, { piePct: 20, plazoAnios: 30, tasa: 3 }, cfg), s6 = sondaDeCandidato(c, { piePct: 20, plazoAnios: 30, tasa: 6 }, cfg), sh = sondaDeCandidato(c, { piePct: 20, plazoAnios: 30 }, cfg);
      if (!s3?.cuota || !s6?.cuota || !sh?.cuota) continue;
      medido = true;
      if (!(s6.cuota > sh.cuota && sh.cuota > s3.cuota)) F(`2 · con un aviso real la cuota no sigue a la tasa: 3 % ${s3.cuota}, hoy ${sh.cuota}, 6 % ${s6.cuota}`);
      console.log(`  · aviso real ${f.aviso_id.slice(0, 8)}: cuota con 3 % $${s3.cuota.toLocaleString("es-CL")}, con la de hoy (${cfg.tasa} %) $${sh.cuota.toLocaleString("es-CL")}, con 6 % $${s6.cuota.toLocaleString("es-CL")}`);
      break;
    }
    if (!medido) F("2 · no hubo un aviso real con qué medir la tasa (el instrumento no corrió)");
  } catch (e) {
    F(`2 · la medición con un aviso real explotó: ${(e as Error).message}`);
  }

  // ── 3 · UN PERFIL CON TASA LA USA ──
  const p45 = perfilDeBusqueda([], { ...MANUAL_VACIO, comunas: ["Ñuñoa"], dormitorios: [2], precioMaxUf: 4000, tasaPct: 4.5 });
  const pHoy = perfilDeBusqueda([], { ...MANUAL_VACIO, comunas: ["Ñuñoa"], dormitorios: [2], precioMaxUf: 4000 });
  if (p45.tasaPct !== 4.5 || !p45.editado.includes("tasa") || pHoy.tasaPct !== null) F("3 · el perfil no lleva la tasa elegida (o sin ella no es la de hoy)");
  if (!/tasaPct: num\(m\.tasa_pct\),/.test(codigo("src/lib/perfil-busqueda-servidor.ts"))) F("3 · el perfil no lee la tasa guardada");
  const v45 = validarCambiosPerfil({ tasaPct: 4.5 }), vMal = validarCambiosPerfil({ tasaPct: 4.3 });
  if (!v45.ok || v45.cambios.tasa_pct !== 4.5 || vMal.ok) F("3 · «Guardar como mi perfil» no guarda la tasa (o acepta una que no es de la lista)");
  const sem = codigo("src/lib/guia/semanal-servidor.ts");
  if (!/const tasa = perfil\.tasaPct \?\? cfg\.tasa;/.test(sem) || !/respuestasDeAviso\(avisoDeCandidato\(cc\), combo\.piePct, tasa, c\.arriendo\.monto,/.test(sem) || !/\.\.\.\(perfil\.tasaPct != null \? \{ tasaPct: perfil\.tasaPct \} : \{\}\) \};/.test(sem)) F("3 · el semanal no evalúa con la tasa del perfil (o sin ella, no con la del motor)");
  if (!/\.\.\.\(typeof c\.tasaPct === "number" \? \{ tasaPct: c\.tasaPct \} : \{\}\)/.test(sem) || !/return \{ tasa: tasaSinOrigen \?\? o\?\.tasa \?\? null, uf, arriendos \};/.test(sem)) F("3 · la selección no le pasa la tasa al pop-up y al informe (o la de hoy del pop-up no es la del motor)");
  if (!/const conTasa: OrigenStr = \{ \.\.\.o, tasa: perfil\.tasaPct \?\? cfg\.tasa \};/.test(codigo("src/lib/guia/semanal-str-servidor.ts")) || !/cuerpoStrDeAviso\(c, conTasa, combo, cfg\)/.test(codigo("src/lib/guia/semanal-str-servidor.ts"))) F("3 · el semanal de renta corta no evalúa con la tasa del perfil");
  const prim = codigo("src/lib/deptos/primeros-servidor.ts");
  if (!/const tasaPct = perfil\.tasaPct \?\? null;/.test(prim) || !/tasaPct != null \? \(await conTasaElegida\(admin, deptos, \{ piePct: pie, plazoAnios: plazo, tasa: tasaPct \}, cfg, ahora\)\)/.test(prim) || !/const combinacion = \{ piePct: pie, plazoAnios: plazo, \.\.\.\(tasaPct != null \? \{ tasaPct \} : \{\}\) \};/.test(prim)) F("3 · la selección del día no evalúa con la tasa del perfil");
  const anl = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
  if (!/const conTasa: OrigenGuia = \{ \.\.\.origen, tasa: tasaElegida \?\? \(desde === "guia" \? origen\.tasa : cfg\.tasa\) \};/.test(anl)) F("3 · el informe no se hace con la tasa elegida o, sin ella, con la del motor");
  for (const p of ["src/app/semanal/semanal-lista.tsx", "src/components/deptos/PrimeraSeleccion.tsx"]) if ((codigo(p).match(/tasaPct: (?:conCombo|combo)\.tasaPct \?\? null/g) ?? []).length < 2) F(`3 · ${p} no manda la tasa al informe y al perfil`);
  if (!/tasaPct: combo\.tasaPct \?\? null/.test(codigo("src/lib/explorar/recalcular-cliente.ts"))) F("3 · el recálculo del semanal y la selección no manda la tasa");
  const mb = po.filtrosDeMiBusqueda({ comunas: ["Ñuñoa"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 20, plazoAnios: 30, tasaPct: 4.5, modalidad: "ltr" });
  const av2 = po.perfilDeFiltros({ ...G, comunas: ["Ñuñoa"], tasa: 4.5 });
  if (mb?.tasa !== 4.5 || !av2.ok || av2.cambios.tasaPct !== 4.5) F("3 · «Usar mi búsqueda» o «Avísame de nuevos» pierden la tasa");

  // ── 4 · «LA DE HOY» SIGUE AL MOTOR ──
  if (G.tasa !== null || ab.filtrosAbiertos({ ...G, tasa: 4.5 }).tasa !== null) F("4 · la vista global o /explorar sin cuenta no van con la de hoy");
  const vHoy = validarCambiosPerfil({ tasaPct: null });
  if (!vHoy.ok || !("tasa_pct" in vHoy.cambios) || vHoy.cambios.tasa_pct !== null) F("4 · elegir «La de hoy» no guarda vacío (guardaría el número del día)");
  const avHoy = po.perfilDeFiltros({ ...G, comunas: ["Ñuñoa"], tasa: null });
  if (!avHoy.ok || avHoy.cambios.tasaPct !== null) F("4 · «Avísame» con la de hoy guarda un número");
  if (po.PORTAL_COPY.tasaHoy(4.07) !== "La de hoy (4,07 %)" || po.PORTAL_COPY.tasaHoy(4.2) !== "La de hoy (4,2 %)" || EXPLORAR_COPY.tasaHoy(5.1) !== "La de hoy (5,1 %)") F("4 · «La de hoy» no dice la tasa del motor que le llega");
  if (!/onChange=\{\(e\) => poner\(\{ tasa: e\.target\.value === "" \? null : Number\(e\.target\.value\) \}\)\}/.test(codigo("src/app/explorar/hoja-filtros.tsx")) || !/<option value="">\{PORTAL_COPY\.tasaHoy\(tasa\?\.tasa \?\? null\)\}<\/option>/.test(codigo("src/app/explorar/hoja-filtros.tsx"))) F("4 · en Filtros, «La de hoy» no es vacío (guardaría el número del día)");
  if (tasaElegidaDe("") !== null || tasaElegidaDe(null) !== null || tasaElegidaDe("4.07") !== null || tasaElegidaDe("4.5") !== 4.5) F("4 · una tasa que no es de la lista (la del motor, por ejemplo) se toma por elegida");

  // ── 5 · LA MEDICIÓN ──
  const pt = po.propsDeTasa(4.5, 4.07, "filtros");
  if (po.EVENTOS_PORTAL.tasa !== "explorar_tasa" || pt.tasa !== 4.5 || pt.la_de_hoy !== false || pt.tasa_hoy !== 4.07 || pt.tasa_usada !== 4.5 || po.propsDeTasa(null, 4.07, "popup").tasa_usada !== 4.07) F("5 · «explorar_tasa» no lleva la tasa elegida, la de hoy y dónde");
  if (!/if \(fuente === "filtros" && f\.tasa !== filtros\.tasa\) posthog\?\.capture\(EVENTOS_PORTAL\.tasa, propsDeTasa\(f\.tasa, inicial\.tasa\?\.tasa \?\? null, "filtros"\)\);/.test(cli) || !/if \(eleccion && tasaPct !== filtros\.tasa\) posthog\?\.capture\(EVENTOS_PORTAL\.tasa, propsDeTasa\(tasaPct, inicial\.tasa\?\.tasa \?\? null, "popup"\)\);/.test(cli)) F("5 · elegir la tasa en Filtros o en el pop-up no deja «explorar_tasa»");
  if (!leer("docs/posthog-activacion-por-puerta.md").includes("explorar_tasa")) F("5 · «explorar_tasa» no está en el diccionario de eventos");

  if (fallas.length) {
    console.log(`  ✗ TASA-EDITABLE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la tasa elegida se ve en Filtros, la hoja, el pop-up y la portada; se calcula y se guarda con su clave; el perfil la usa en el semanal, la selección y el informe; «La de hoy» sigue al motor; «explorar_tasa» se mide");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runTasaEditableTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (30-oct-2026) ──
// 46 de 46 en ROJO (runner `mutar-tasa.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte):
//   §1 T1 la lista de a 0,5 · T2 Filtros sin la tasa elegida · T3 sin «La de hoy» · T4 sin cuenta la tasa se elige · T5 la
//      hoja sin la tasa elegida · T6 sin «la de hoy es» · T7 el cliente no le pasa la tasa a la hoja · T8 el pop-up sin la tasa
//      en la línea · T9 el pop-up sin elegir la tasa · T10 cambiar la tasa no recalcula · T11 el dividendo con la de hoy · T12 la
//      casilla sin la tasa · T13 el cambio de tasa dice el plazo · T14 la portada sin la línea · T15 la línea sin «tasa promedio
//      sistema financiero» · T16 renta corta sin la tasa en la portada · T17 el informe no guarda la tasa elegida.
//   §2 T18 con tasa sale de la noche · T19 la clave sin la tasa · T20 lo calculado con la del motor · T21 la API sin la tasa ·
//      T22 el navegador no pide con la tasa · T23 sin «Calculando con tu tasa…» · T24 el recálculo con la del motor · T25 la sonda
//      ignora la tasa elegida · T26 la de mercado pasa a ser la elegida · T27 la URL sin la tasa.
//   §3 T28 el perfil no lee la tasa · T29 guarda una que no es de la lista · T30 el semanal con la del informe · T31 el semanal
//      ignora el perfil · T32 la selección no guarda la tasa · T33 la renta corta con la del informe · T34 la selección del día
//      ignora la tasa · T35 el informe con la del informe · T36 la selección pierde la tasa al analizar · T37 el pop-up del
//      semanal con la del informe · T38 «Usar mi búsqueda» pierde la tasa · T39 el semanal no manda la tasa al informe.
//   §4 T40 «La de hoy» guarda el número · T41 sin cuenta con tasa · T42 la vista global con una tasa · T43 «La de hoy» con un
//      número fijo · T44 en Filtros la de hoy es un número.
//   §5 T45 sin explorar_tasa en Filtros · T46 explorar_tasa sin la de hoy.
// En el mismo runner, los predicados reescritos de otros tiers (X1–X10, cada uno con su línea de acta en su archivo):
// 56 de 56 en ROJO.
