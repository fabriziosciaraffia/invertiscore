// ============================================================================
// TIER EXPLORAR-CORREOS — la puerta a Explorar en los correos y en lo que entra por /deptos (02-nov-2026, goal de Fabrizio).
//
//   1 · EL NÚMERO SALE DE LA FUNCIÓN ÚNICA: «Estos son N de los 6.695 deptos que convienen hoy en Gran Santiago.» lleva el
//       número de la noche (desde el 02-nov-2026, el que guarda el cron: convienen-guardado.ts), el mismo del mapa, la landing y /deptos. Los correos lo piden a
//       puertaExplorarCorreo, que no lee otra cosa; las pantallas, al de la portada de /deptos, que lo lee de ahí. Sin el
//       número, la línea no sale. N son los deptos de la selección que convienen (sin los que entran por negociar).
//   2 · EL ENLACE ABRE /explorar CON LOS FILTROS DEL PERFIL: los de «Mi búsqueda» (filtrosDeMiBusqueda) en la URL, con el pie, el
//       plazo y la tasa de la selección; ida y vuelta por la ruta del clic, validados de nuevo, con `desde=correo`. El vacío va a
//       la vista global y la renta corta abre /explorar en renta corta (decisiones de Fabrizio, 02-nov-2026).
//   3 · LA MEDICIÓN: `explorar_enlace_clic` por correo (la ruta del clic, con qué correo) y por pantalla (el navegador), aparte
//       de los deptos (`destino: "explorar"`); la vista de /explorar con `llegada_explorar: "correo"`, con y sin cuenta.
//   4 · EL LUGAR: después de la selección y antes del botón en el semanal, el correo del día y el aviso inmediato; una salida
//       más en el vacío; bajo la selección en «Estás dentro» y en el dashboard (que conserva su botón).
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin base ni red: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-correos-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as pc0 from "../../../src/lib/explorar/puerta-correos";
import * as pcf from "../../../src/lib/explorar/puerta-correos-filtros";
import * as po from "../../../src/lib/explorar/portal";
import { llegadaDeExplorar } from "../../../src/lib/explorar/puertas-landing";
import { origenDeExplorar } from "../../../src/lib/vista-entrada";
import { eventoPortalVista } from "../../../src/lib/explorar/portal-servidor";
import { puertaExplorarCorreo } from "../../../src/lib/explorar/puerta-correos-servidor";
import { COLOR_VEREDICTO, correoSemanal, correoSemanalVacio, SEMANAL } from "../../../src/lib/email/correo-semanal";
import { ROJO, TINTA } from "../../../src/lib/email/plantilla-clara";
import { correoInmediato } from "../../../src/lib/email/correo-inmediato";
import { INMEDIATO } from "../../../src/lib/guia/inmediato";
import { CATALOGO_CORREOS } from "../../../src/lib/email/catalogo";

(globalThis as { React?: unknown }).React = React;
const pc = { ...pc0, ...pcf };
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
/** El cuerpo de una función: de su firma a la siguiente declaración de primer nivel (sin comentarios). */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export |async function |function |const [A-Za-z]+ = )/);
  return src.slice(i, j < 0 ? undefined : i + firma.length + j);
}
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}

const PERFIL = { comunas: ["Ñuñoa", "Macul"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4500, piePct: 20, plazoAnios: 30, tasaPct: null, modalidad: "ltr" };
const BASE = "https://refranco.ai/api/semanal/clic?t=0123456789abcdef0123";
const DEPTO = { comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 4290, veredicto: "COMPRAR", score: 82, flujo: 64000, url: "https://refranco.ai/x" };
const datosSemanal = (explorar: pc0.PuertaExplorarCorreo | null) => ({
  variante: "tarjetas" as const, nombre: "Camila", busca: "2 dormitorios, Ñuñoa y Macul, hasta UF 4.500", piePct: 20, plazoAnios: 30,
  deptos: [DEPTO, { ...DEPTO, precioUF: 3980 }, { ...DEPTO, precioUF: 3650, tramo: "negociar" as const }], saldo: 1, conRegalo: false,
  urlBoton: `${BASE}`, urlTres: `${BASE}&ir=tres`, urlBaja: "https://refranco.ai/baja", explorar,
});

export async function runExplorarCorreosTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-CORREOS (la línea «Estos son N de los … que convienen hoy» con el número único y el enlace a /explorar con los filtros del perfil, en los correos y bajo la selección; clic y llegada «correo» · 0 tokens) ───");

  // ── 1 · EL NÚMERO SALE DE LA FUNCIÓN ÚNICA ──
  if (pc.lineaConvienen(4, 6695) !== "Estos son 4 de los 6.695 deptos que convienen hoy en Gran Santiago.") F(`1 · la línea con 4 dice «${pc.lineaConvienen(4, 6695)}»`);
  if (pc.lineaConvienen(1, 6695) !== "Este es 1 de los 6.695 deptos que convienen hoy en Gran Santiago.") F(`1 · la línea con 1 dice «${pc.lineaConvienen(1, 6695)}»`);
  if (pc.lineaConvienen(0, 6695) !== "Hoy convienen 6.695 deptos en Gran Santiago.") F(`1 · la línea del vacío dice «${pc.lineaConvienen(0, 6695)}»`);
  if (pc.lineaConvienen(3, null) !== null || pc.lineaConvienen(3, 0) !== null) F("1 · sin el número de la noche, la línea sale igual (con otra cifra)");
  if (pc.PUERTA_EXPLORAR.enlace !== "Míralos todos en el mapa") F(`1 · el enlace dice «${pc.PUERTA_EXPLORAR.enlace}»`);
  if (pc.convienenEnSeleccion([{}, { tramo: "vecina" }, { tramo: "negociar" }, { tramo: null }]) !== 3) F("1 · N cuenta los que entran por negociar (o deja fuera a las vecinas)");
  // La función del servidor: el total que le llega es el que dice, y solo de ahí.
  const p4321 = await puertaExplorarCorreo({ baseClic: BASE, de: "semanal", n: 2, perfil: PERFIL }, { convienen: async () => 4321 });
  if (p4321?.linea !== "Estos son 2 de los 4.321 deptos que convienen hoy en Gran Santiago.") F(`1 · puertaExplorarCorreo no dice el número que le llega: «${p4321?.linea}»`);
  if ((await puertaExplorarCorreo({ baseClic: BASE, de: "semanal", n: 2, perfil: PERFIL }, { convienen: async () => null })) !== null) F("1 · puertaExplorarCorreo arma la línea sin el número de la noche");
  if ((await puertaExplorarCorreo({ baseClic: BASE, de: "semanal", n: 2, perfil: PERFIL }, { convienen: async () => { throw new Error("caída"); } })) !== null) F("1 · si el número falla, la línea sale igual");
  const srv = codigo("src/lib/explorar/puerta-correos-servidor.ts");
  // ⚠ ACTA (02-nov-2026, goal de los cortes por statement_timeout, tier CONVIENEN-UNO §3) · el número ya no lo cuenta cada
  // superficie con convienenHoy (retirado): lo cuenta el cron sobre el universo del mapa y lo guarda en config; los correos y la
  // portada de /deptos leen esa fila (leerConvienenMapa).
  if (!/^import \{ leerConvienenMapa \} from "\.\/convienen-guardado";$/m.test(srv) || !/^const convienenGuardado = \(\) => leerConvienenMapa\(createServiceClient\(\)\);$/m.test(srv)
    || !/const total = await \(deps\.convienen \?\? convienenGuardado\)\(\)\.catch\(\(\) => null\);\n  const linea = lineaConvienen\(p\.n, total\);/.test(srv)) F("1 · puertaExplorarCorreo no lee el número guardado de la noche");
  // Los correos: cada envío pide la puerta y se la pasa al correo.
  const sem = codigo("src/lib/guia/semanal-servidor.ts");
  const envSel = cuerpo(sem, "export async function enviarSeleccion(");
  if (!/const explorar = await puertaExplorarCorreo\(\{\n    baseClic: enlaces\.boton, de: "semanal", n: convienenEnSeleccion\(\[\.\.\.deptos, \.\.\.deptosCortos\]\),\n    perfil: conLargo \? fila\.perfil : fila\.perfil_str \?\? null, combo: combo, modalidad: conLargo \? "ltr" : "str",\n  \}\);/.test(envSel)) F("1 · el semanal no pide la puerta (con N de sus deptos y el perfil de su primer bloque)");
  if (!/  const correo = correoSemanal\(\{(?:(?!\n  \}\);)[\s\S])*\n    invitar,\n    explorar,\n  \}\);\n  const r = await sendSemanalEmail/.test(envSel)) F("1 · el semanal no le pasa la puerta al correo");
  const envVac = cuerpo(sem, "export async function enviarSinSeleccion(");
  if (!/  const correo = correoSemanalVacio\(\{(?:(?!\n  \}\);)[\s\S])*\n    explorar: await puertaExplorarCorreo\(\{ baseClic: enlaces\.boton, de: "semanal_vacio", n: 0 \}\),\n(?:(?!\n  \}\);)[\s\S])*\n  \}\);\n  const r = await sendSemanalEmail/.test(envVac)) F("1 · el semanal vacío no lleva la puerta (a la vista global)");
  const dd = cuerpo(codigo("src/lib/guia/del-dia-servidor.ts"), "async function enviarDelDia(");
  if (!/const explorar = await puertaExplorarCorreo\(conDeptos\n    \? \{ baseClic: enlaces\.boton, de: "del_dia", n: convienenEnSeleccion\(\[\.\.\.deptos, \.\.\.cortos\]\), perfil: col\.combinacion \? perfil : perfilStr, combo: col\.combinacion \?\? col\.combinacion_str, modalidad: col\.combinacion \? "ltr" : "str" \}\n    : \{ baseClic: enlaces\.boton, de: "del_dia_vacio", n: 0 \}\);/.test(dd)) F("1 · el correo del día no pide la puerta (con deptos con su perfil; vacío, la vista global)");
  if (!/        urlBaja: enlaces\.baja,\n        explorar,\n      \}\)\n    : correoSemanalVacio\(\{ [^\n]*, explorar \}\);/.test(dd)) F("1 · el correo del día no le pasa la puerta a sus dos correos");
  const inm = cuerpo(codigo("src/lib/guia/inmediato-servidor.ts"), "export async function procesarInmediato(") || codigo("src/lib/guia/inmediato-servidor.ts");
  if (!/  const correo = correoInmediato\(\{(?:(?!\n  \}\);)[\s\S])*\n    explorar: await puertaExplorarCorreo\(\{ baseClic: enlaces\.boton, de: "inmediato", n: convienenEnSeleccion\(items\), perfil, combo, modalidad: modalidad === "str" \? "str" : "ltr" \}\),\n  \}\);/.test(inm)) F("1 · el aviso inmediato no lleva la puerta (con su perfil y su modalidad)");
  // Las pantallas: el número de la portada de /deptos, que lee el número guardado (acta del 02-nov-2026, arriba).
  if (!/const \[resumen, convienen\] = await Promise\.all\(\[resumenDeLaNoche\(admin\), leerConvienenMapa\(admin\)\]\);/.test(codigo("src/lib/deptos/portada.ts"))) F("1 · la portada de /deptos no lee el número guardado");
  const dash = codigo("src/app/dashboard/page.tsx");
  if (!/  const totalNoche = portada\.noche\?\.convienen \?\? null;\n/.test(dash) || !/const lineaPuerta = bloques\.length > 0 \? lineaConvienen\(convienenEnSeleccion\(bloques\.flatMap\(\(b\) => b\.filas\.map\(\(f\) => f\.reemplazo \?\? f\.item\)\)\), totalNoche\) : null;/.test(dash)) F("1 · el dashboard no arma la línea con el número de la portada y los deptos de la selección");
  const prim = codigo("src/app/api/deptos/primeros/route.ts");
  if (!/      conDeptos \? portadaDeptos\(\) : Promise\.resolve\(null\),\n/.test(prim) || !/  const totalNoche = portada\?\.noche\?\.convienen \?\? null;|    const totalNoche = portada\?\.noche\?\.convienen \?\? null;/.test(prim)) F("1 · «Estás dentro» no recibe el número de la portada cuando hay deptos");
  const sel = codigo("src/components/deptos/PrimeraSeleccion.tsx");
  if (!/linea=\{lineaConvienen\(convienenEnSeleccion\(items\), datos\.totalNoche\)\}/.test(sel)) F("1 · «Estás dentro» no arma la línea con el número que le llega");
  // El correo dibuja la línea que le llega, tal cual, y sin ella no hay nada.
  const conLinea = correoSemanal(datosSemanal({ linea: "LÍNEA-DE-PRUEBA", url: `${BASE}&ir=explorar&de=semanal` })).html;
  if (texto(conLinea).split("LÍNEA-DE-PRUEBA").length !== 2) F("1 · el semanal no dibuja la línea que le llega (o la repite)");
  if (correoSemanal(datosSemanal(null)).html.includes('data-correo="explorar"')) F("1 · sin puerta, el semanal dibuja la línea igual");

  // ── 2 · EL ENLACE ABRE /explorar CON LOS FILTROS DEL PERFIL ──
  const q = pc.consultaExplorar(PERFIL);
  const esperada = po.urlDePortal(po.filtrosDeMiBusqueda({ ...PERFIL, modalidad: "ltr" } as never)!);
  if (!q || q !== esperada) F(`2 · la consulta del perfil no es la de «Mi búsqueda»: «${q}» contra «${esperada}»`);
  const ida = po.portalDeUrl(new URLSearchParams(q)).filtros;
  if (ida.comunas.join() !== "Ñuñoa,Macul" || ida.tipologias.join() !== "2" || ida.ufMax !== 4500 || ida.pie !== 20 || ida.plazo !== 30 || ida.tasa !== null || ida.modalidad !== "ltr") F(`2 · los filtros del enlace no son los del perfil: ${JSON.stringify(ida)}`);
  const conCombo = po.portalDeUrl(new URLSearchParams(pc.consultaExplorar(PERFIL, { combo: { piePct: 30, plazoAnios: 25, tasaPct: 4.5 } }))).filtros;
  if (conCombo.pie !== 30 || conCombo.plazo !== 25 || conCombo.tasa !== 4.5) F("2 · el enlace no lleva el pie, el plazo y la tasa de la selección");
  if (po.portalDeUrl(new URLSearchParams(pc.consultaExplorar(PERFIL, { modalidad: "str" }))).filtros.modalidad !== "str") F("2 · el enlace de renta corta no abre /explorar en renta corta");
  if (pc.consultaExplorar(null) !== "" || pc.consultaExplorar({ comunas: null, dormitorios: undefined }) !== "") F("2 · sin perfil con qué buscar, el enlace no es la vista global");
  // Ida y vuelta: el enlace del correo, la ruta del clic y a dónde aterriza.
  const enlace = (await puertaExplorarCorreo({ baseClic: BASE, de: "del_dia", n: 2, perfil: PERFIL, combo: { piePct: 20, plazoAnios: 30 } }, { convienen: async () => 6695 }))?.url ?? "";
  const u = new URL(enlace || "https://x.cl");
  if (u.searchParams.get("t") !== "0123456789abcdef0123" || u.searchParams.get("ir") !== "explorar" || u.searchParams.get("de") !== "del_dia") F(`2 · el enlace del correo no pasa por la ruta del clic con ir=explorar y de qué correo: ${enlace}`);
  const ruta = pc.rutaExplorarDesdeCorreo(u.searchParams.get("q"));
  const aterriza = new URLSearchParams(ruta.split("?")[1] ?? "");
  const vuelta = po.portalDeUrl(aterriza).filtros;
  if (!ruta.startsWith("/explorar?") || aterriza.get("desde") !== "correo" || vuelta.comunas.join() !== "Ñuñoa,Macul" || vuelta.tipologias.join() !== "2" || vuelta.ufMax !== 4500) F(`2 · el clic no aterriza en /explorar con los filtros del perfil y desde=correo: ${ruta}`);
  if (pc.rutaExplorarDesdeCorreo("c=Narnia&h=abc&p=99&x=%3Cscript%3E") !== "/explorar?desde=correo") F(`2 · la ruta reenvía lo que llega sin validarlo: ${pc.rutaExplorarDesdeCorreo("c=Narnia&h=abc&p=99&x=%3Cscript%3E")}`);
  if (pc.rutaExplorarDesdeCorreo(null) !== "/explorar?desde=correo") F("2 · sin filtros, el clic no va a la vista global con desde=correo");
  const vacio = await puertaExplorarCorreo({ baseClic: BASE, de: "semanal_vacio", n: 0 }, { convienen: async () => 6695 });
  if (!vacio || vacio.url.includes("&q=") || vacio.linea !== "Hoy convienen 6.695 deptos en Gran Santiago.") F("2 · el vacío no va a la vista global (decisión de Fabrizio)");
  const clic = codigo("src/app/api/semanal/clic/route.ts");
  if (!/  if \(destino === "explorar"\) \{\n[\s\S]{0,400}?    return volver\(rutaExplorarDesdeCorreo\(q\)\);\n  \}/.test(clic) || !/    const q = url\.searchParams\.get\("q"\);\n/.test(clic)) F("2 · la ruta del clic no aterriza en rutaExplorarDesdeCorreo con la consulta del enlace");
  if (!/const sinSeleccion = \(\) => volver\(ir === "explorar" \? rutaExplorarDesdeCorreo\(url\.searchParams\.get\("q"\)\) : "\/dashboard"\);/.test(clic)) F("2 · un enlace sin selección reconocible no lleva al mapa");
  // Las pantallas: el enlace con la consulta del perfil.
  const modLinea = (() => { try { return require(join(RAIZ, "src/components/explorar/LineaPuertaExplorar")) as { LineaPuertaExplorar: React.FC<{ linea: string | null; consulta: string; donde: pc0.PantallaConPuerta }> }; } catch (e) { F(`2 · no carga LineaPuertaExplorar: ${(e as Error).message}`); return null; } })();
  if (modLinea) {
    const h = dibujar(createElement(modLinea.LineaPuertaExplorar, { linea: "Estos son 3 de los 6.695 deptos que convienen hoy en Gran Santiago.", consulta: q, donde: "dashboard" }));
    const href = (h.match(/<a[^>]*href="([^"]+)"[^>]*data-puerta-explorar="enlace"/) ?? h.match(/<a[^>]*data-puerta-explorar="enlace"[^>]*href="([^"]+)"/) ?? [])[1]?.replace(/&amp;/g, "&");
    if (href !== `/explorar?${q}`) F(`2 · el enlace de la pantalla no abre /explorar con los filtros del perfil: ${href}`);
    if (texto(h) !== "Estos son 3 de los 6.695 deptos que convienen hoy en Gran Santiago. Míralos todos en el mapa") F(`2 · la línea de la pantalla dice «${texto(h)}»`);
    if (dibujar(createElement(modLinea.LineaPuertaExplorar, { linea: null, consulta: q, donde: "dashboard" })) !== "") F("2 · sin línea, la pantalla dibuja algo");
  }
  if (!/const consultaPuerta = bloques\[0\]\?\.bloque === "corto" \? consultaExplorar\(perfilPersona\.perfilStr, \{ modalidad: "str" \}\) : consultaExplorar\(perfilPersona\.perfilLtr \?\? perfilPersona\.perfil, \{ modalidad: "ltr" \}\);/.test(dash)) F("2 · el dashboard no arma el enlace con los filtros de su perfil");
  if (!/const explorar = perfil \? consultaExplorar\(perfil\.perfilLtr \?\? perfil\.perfil, \{ combo: r\.combinacion, modalidad: "ltr" \}\) : null;/.test(prim) || !/mapa, totalNoche, explorar \}/.test(prim) || !/consulta=\{datos\.explorar \?\? ""\}/.test(sel)) F("2 · «Estás dentro» no recibe el enlace con los filtros de su perfil");

  // ── 3 · LA MEDICIÓN ──
  if (pc.EVENTO_PUERTA_EXPLORAR !== "explorar_enlace_clic") F("3 · el clic de la puerta no tiene su evento propio");
  const props = pc.propsPuertaExplorar("correo", "semanal", { global: false });
  if (props.canal !== "correo" || props.donde !== "semanal") F("3 · el clic no dice canal y dónde");
  if (!/: ir === "ajustar" \? "ajustar" : ir === "explorar" \? "explorar" : avisoId \? "depto" : "seleccion";/.test(clic)) F("3 · el clic de la puerta no tiene su destino propio (se cuenta como depto o selección)");
  // El bloque entero, tal como corre: la medición en su propia línea, antes de aterrizar (un `if (false)` delante no pasa).
  if (!/\n  if \(destino === "explorar"\) \{\n    const de = url\.searchParams\.get\("de"\);\n    const q = url\.searchParams\.get\("q"\);\n    await capturarServidor\(\{ event: EVENTO_PUERTA_EXPLORAR, distinctId: sel\.user_id, properties: propsPuertaExplorar\("correo", esCorreoConPuerta\(de\) \? de : sel\.fuente === "inmediato" \? "inmediato" : "semanal", \{ global: !q, semana: sel\.semana \}\) \}\)\.catch\(\(\) => \{\}\);\n    return volver\(rutaExplorarDesdeCorreo\(q\)\);\n  \}\n/.test(clic)) F("3 · la ruta del clic no mide explorar_enlace_clic con qué correo antes de aterrizar");
  if (!pc.esCorreoConPuerta("del_dia_vacio") || pc.esCorreoConPuerta("hackeo") || pc.CORREOS_CON_PUERTA.length !== 5) F("3 · los correos con puerta no son los cinco (semanal, del día, inmediato y sus vacíos)");
  const lin = codigo("src/components/explorar/LineaPuertaExplorar.tsx");
  if (!/onClick=\{\(\) => posthog\?\.capture\(EVENTO_PUERTA_EXPLORAR, propsPuertaExplorar\("pantalla", donde, \{ global: !consulta \}\)\)\}/.test(lin)) F("3 · la pantalla no mide el clic de la puerta");
  if (llegadaDeExplorar("correo") !== "correo" || llegadaDeExplorar("landing") !== "landing" || llegadaDeExplorar(null) !== "directo" || llegadaDeExplorar("otra") !== "directo") F("3 · la llegada no distingue correo, landing y directo");
  if (origenDeExplorar("?c=Macul&desde=correo") !== "correo") F("3 · la vista sin cuenta (middleware) no marca la llegada «correo»");
  const ev = eventoPortalVista({ userId: "u", filtros: po.FILTROS_GLOBALES, orden: "puntaje", n: 3, llegada: "correo" });
  if (ev.properties?.llegada_explorar !== "correo") F("3 · la vista con cuenta no lleva llegada_explorar");
  if (!/robot: robotDeVisita\(headers\(\)\.get\("user-agent"\), headers\(\)\), llegada: llegadaDeExplorar\(sp\.get\("desde"\)\) \}\)/.test(codigo("src/app/explorar/page.tsx"))) F("3 · la página de /explorar no le pasa la llegada a su vista");
  if (!/extra: \{ llegada_explorar: origenDeExplorar\(request\.nextUrl\.search\) \}/.test(codigo("src/middleware.ts"))) F("3 · el middleware no le pone la llegada a la vista sin cuenta");
  // /explorar ignora `desde` en los filtros: lo que trae el enlace se ve tal cual.
  if (po.portalDeUrl(new URLSearchParams("c=Macul&desde=correo")).filtros.comunas.join() !== "Macul") F("3 · `desde=correo` cambia los filtros de /explorar");

  // ── 4 · EL LUGAR ──
  const posiciones = (html: string, boton: string) => {
    const linea = html.indexOf('data-correo="explorar"'), ultima = html.lastIndexOf(SEMANAL.verDepto), btn = html.indexOf(`>${boton}</a>`);
    return { linea, ultima, btn, ok: linea > 0 && ultima > 0 && btn > 0 && ultima < linea && linea < btn };
  };
  for (const id of ["semanal_banda", "semanal_tarjetas", "semanal_vistos", "del_dia"]) {
    const e = CATALOGO_CORREOS.find((x) => x.id === id);
    const html = e?.render?.().html ?? "";
    const p = posiciones(html, SEMANAL.boton);
    if (!p.ok) F(`4 · en ${id} la línea no va después de la selección y antes del botón (${JSON.stringify(p)})`);
    if (!/Estos son \d+ de los 6\.695 deptos que convienen hoy en Gran Santiago\. Míralos todos en el mapa/.test(texto(html))) F(`4 · ${id} no trae la línea del catálogo`);
  }
  const inmHtml = correoInmediato({ nombre: "Camila", busca: "x", piePct: 20, plazoAnios: 30, deptos: [DEPTO], saldo: 0, urlBoton: BASE, urlComprar: `${BASE}&ir=comprar`, urlBaja: "https://refranco.ai/baja", explorar: { linea: pc.lineaConvienen(1, 6695)!, url: `${BASE}&ir=explorar&de=inmediato` } }).html;
  const pi = posiciones(inmHtml, INMEDIATO.botonSinSaldo);
  if (!pi.ok) F(`4 · en el aviso inmediato la línea no va después de la selección y antes del botón (${JSON.stringify(pi)})`);
  const vacHtml = correoSemanalVacio({ nombre: "Camila", urlPerfil: "https://refranco.ai/p", urlBaja: "https://refranco.ai/b", salidas: { linea: "Hasta UF 3.000, 810 sí.", botones: [{ boton: "Buscar hasta UF 3.000", url: "https://refranco.ai/a" }] }, explorar: { linea: "Hoy convienen 6.695 deptos en Gran Santiago.", url: `${BASE}&ir=explorar&de=semanal_vacio` } }).html;
  const iAj = vacHtml.lastIndexOf('data-ajuste="1"'), iLin = vacHtml.indexOf('data-correo="explorar"'), iBot = vacHtml.indexOf('data-correo="explorar-enlace"');
  if (!(iAj > 0 && iAj < iLin && iLin < iBot)) F("4 · en el vacío, «Míralos todos en el mapa» no es una salida más después de las otras");
  // LA CARD DE LA TRÍADA (02-nov-2026, pedido de Fabrizio: «es casi un CTA para llevar a Explorar», «todo el texto que alude
  // a Explorar en una card de tríada»): en todo correo, la línea y «Míralos todos en el mapa» van JUNTAS dentro de una card con
  // el degradado azul → ciruela → rojo de la tríada y el azul de respaldo; la línea en blanco y el enlace, botón blanco en tinta.
  const C = COLOR_VEREDICTO, triada = `linear-gradient(100deg, ${C.COMPRAR} 0%, ${C["AJUSTA SUPUESTOS"]} 52%, ${C["BUSCAR OTRA"]} 100%)`;
  if (C.COMPRAR !== "#2B558F" || C["AJUSTA SUPUESTOS"] !== "#6E4560" || C["BUSCAR OTRA"] !== ROJO) F("4 · los colores del correo no son los de la tríada");
  const CIERRE_CARD = "\n    </td>\n  </tr></table>\n</td></tr>";
  for (const [nombre, html, linea] of [["el semanal", conLinea, "LÍNEA-DE-PRUEBA"], ["el aviso inmediato", inmHtml, pc.lineaConvienen(1, 6695)!], ["el vacío", vacHtml, "Hoy convienen 6.695 deptos en Gran Santiago."]] as const) {
    const card = html.match(/<td bgcolor="([^"]+)" style="([^"]*)" data-correo="explorar">/);
    const i0 = card?.index ?? -1, fin = i0 >= 0 ? html.indexOf(CIERRE_CARD, i0) : -1;
    const dentro = i0 >= 0 && fin > i0 ? html.slice(i0, fin) : "";
    const lin = dentro.match(/<td style="([^"]*)" data-correo="explorar-linea">([^<]*)<\/td>/);
    const bot = dentro.match(/<td bgcolor="#FFFFFF" style="[^"]*" data-correo="explorar-boton">\s*<a href="[^"]*" style="([^"]*)" data-correo="explorar-enlace">([^<]*)<\/a>/);
    if (!card || card[1] !== C.COMPRAR || !card[2].includes(`background-color: ${C.COMPRAR};`) || !card[2].includes(`background-image: ${triada};`)) F(`4 · en ${nombre}, la puerta no va en la card de la tríada`);
    else if (!lin || lin[2] !== linea || !/color: #FFFFFF;/.test(lin[1])) F(`4 · en ${nombre}, la línea no va dentro de la card de la tríada, en blanco`);
    else if (!bot || bot[2] !== "Míralos todos en el mapa" || !bot[1].includes(`color: ${TINTA};`)) F(`4 · en ${nombre}, «Míralos todos en el mapa» no es el botón blanco dentro de la card`);
  }
  if (!correoSemanalVacio({ nombre: null, urlPerfil: "p", urlBaja: "b", explorar: { linea: "Hoy convienen 6.695 deptos en Gran Santiago.", url: "u" } }).html.includes('data-correo="explorar-enlace"')) F("4 · el vacío sin otras salidas no lleva «Míralos todos»");
  for (const id of ["semanal_vacio", "del_dia_vacio", "aviso_inmediato"]) if (!(CATALOGO_CORREOS.find((x) => x.id === id)?.render?.().html ?? "").includes('data-correo="explorar"')) F(`4 · ${id} del catálogo no trae la puerta`);
  if (!/          <SeleccionEnCasa sel=\{sel\} autoAnalizar=\{autoAnalizar\} primera=\{!hayDeptos\(sel\)\} \/>\n          <LineaPuertaExplorar linea=\{lineaPuerta\} consulta=\{consultaPuerta\} donde="dashboard" \/>\n        <\/section>/.test(dash)) F("4 · en el dashboard la línea no va bajo la selección");
  if (!/\{botonExplorar\(totalNoche\)\}/.test(codigo("src/app/dashboard/mapa-casa.tsx"))) F("4 · el dashboard perdió su botón «Explorar los N de Santiago»");
  if (!/data-primera="ver-mas">\{PRIMERA_SELECCION\.verMas\(faltanPorVer\)\}<\/button>\}\n            <\/div>\n          \)\}\n\s*\{items\.length > 0 && <LineaPuertaExplorar /.test(sel) || !/donde=\{encabezado === "casa" \? "dashboard" : "estas_dentro"\}/.test(sel)) F("4 · en «Estás dentro» la línea no va bajo la selección");

  if (fallas.length) {
    console.log(`  ✗ ${fallas.length} falla(s) dura(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la línea lleva el número único y N de la selección; el enlace abre /explorar con los filtros del perfil (el vacío, la vista global; renta corta, en renta corta); el clic se mide por correo y por pantalla y la vista llega «correo»; va después de la selección y antes del botón, y bajo la selección en las pantallas");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runExplorarCorreosTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (02-nov-2026) ──
// 49 de 49 en ROJO (runner `mutar-puerta.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte):
//   §1 P1 la línea sin «en Gran Santiago» · P2 el singular en plural · P3 el vacío sin el número · P4 sin el número de la noche
//      sale igual · P5 N cuenta los negociables · P6 el servidor lee otro número · P7 el servidor ignora el que lee · P8 el
//      semanal sin la puerta · P9 el semanal cuenta los negociables · P10 el semanal vacío sin la puerta · P11 el correo del día
//      vacío sin la puerta · P12 el aviso inmediato sin la puerta · P13 el dashboard con otro número · P14 «Estás dentro» con
//      otro número · P15 el número solo para el mapa de la casa · P16 el correo repite la línea · P17 sin puerta la dibuja igual.
//   §2 E1 la consulta no es la de «Mi búsqueda» · E2 sin el pie de la selección · E3 renta corta abre en tradicional · E4 el
//      enlace sin la consulta · E5 la ruta reenvía lo que llega · E6 sin desde=correo · E7 el vacío con el perfil · E8 el clic
//      no aterriza con los filtros · E9 sin selección no va al mapa · E10 la pantalla sin la consulta · E11 el dashboard sin su
//      perfil · E12 «Estás dentro» sin el enlace.
//   §3 M1 el evento con el nombre de otro · M2 el clic sin destino propio · M3 la ruta no mide (con un `if (false)` delante:
//      la primera versión del predicado lo dejaba pasar, se reescribió al bloque entero) · M4 la pantalla no mide · M5 la
//      llegada sin «correo» · M6 la vista con cuenta sin llegada · M7 la página no pasa la llegada.
//   §4 L1 la línea después del botón en el semanal · L2 en el aviso inmediato · L3 el vacío con un enlace en vez de la card ·
//      L4 el dashboard con la línea sobre la selección · L5 «Estás dentro» sin la línea · L6 el catálogo del vacío sin la
//      puerta · L7 el dashboard pierde su botón.
//   LA CARD DE LA TRÍADA (pedido de Fabrizio a mitad del goal): T1 sin el degradado · T2 el degradado sin la ciruela · T3 sin
//      el azul de respaldo · T4 la línea fuera de la card · T5 el enlace sin su botón blanco · T6 la línea en tinta sobre la card.
// En el mismo runner, los predicados reescritos de otros tiers (X1–X4, cada uno con su línea de acta en su archivo): 53 de 53.

// ── ACTA DE MUTACIONES (02-nov-2026, goal de los cortes por statement_timeout) ──
// §1 al día con el número guardado de noche (convienenHoy retirado): 3 de 3 en ROJO (runner `mutar-correos.cjs` en el
// scratchpad de la sesión b526f69b; cada archivo restaurado byte a byte, con hash): C1 los correos dicen un número fijo · C2
// los correos no leen el número · C3 la portada de /deptos no lee el número guardado (también en CONVIENEN-UNO).
