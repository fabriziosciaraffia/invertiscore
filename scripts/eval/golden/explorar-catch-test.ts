// ============================================================================
// TIER EXPLORAR — el mapa de todos los deptos que convienen (23-oct-2026, docs/puerta-b-mockups/5-explorar.html)
//
//   1 · LOS FILTROS SON EL PERFIL Y NO LO TOCAN: el mapa abre con el perfil de la persona (comunas, tipología, rango, pie
//       y plazo, llevados a lo que la noche evaluó); cambiarlos es un filtro nuevo en la URL y una lectura de /api/explorar
//       —nada en esa ruta ni en su lib escribe—, y el único lugar de la página que escribe el perfil es la casilla del
//       pop-up, marcada a mano.
//   2 · SOLO LOS COMPRAR: el SQL de la RPC los filtra y la lib los vuelve a filtrar (la segunda red); los pines se leen
//       de a mil (PostgREST corta ahí sin avisar) y salen por puntaje.
//   3 · EXPLORAR NO GASTA; ANALIZAR SÍ: ninguna ruta de Explorar cobra; «Analizar este» va por la ruta de la guía con
//       `explorar: true`, el pie y el plazo del pop-up (de sus listas), el origen sintético con la tasa de mercado, un
//       crédito una vez, `analisis_creado` via = explorar y «explorar_analiza» con el depto.
//   4 · SIN SALDO SE VE EL MAPA Y EL AVISO E: el mapa se monta igual; encima, el aviso con el pack (el ticket si la cuenta
//       es nueva), «Comprar solo 1», el plan y «Ahora no», que lo cierra.
//   5 · EL MAPA CARGA DESPUÉS DEL PRIMER PINTADO: next/dynamic sin SSR, montado con la página quieta; Google Maps no entra
//       en el grafo de la página ni del cliente; el servidor manda solo las primeras tarjetas.
//   6 · LA HOJA Y EL PIN: la píldora «312 convienen · 3 ya analizados», el título, la marca «Visto anoche», el cap rate, los
//       UF por m², «Revisado con pie X y Y años…», «Analizar este · usa 1 de tus N» y los agrupados por celdas.
//   7 · EL POP-UP CON «CAMBIAR»: el pie y el plazo se cambian, el servidor recalcula con la sonda, el aviso dice qué da
//       («Con pie 10 % este depto da Ajustar.») y, si empeora, el botón dice «Analizar igual»; la elección viaja a analizar.
//   8 · LA MEDICIÓN: «explorar_vista» con filtros y pines (la página y cada cambio), «explorar_analiza» con el depto; el
//       archivo dice «Desde Explorar».
//   9 · EL DASHBOARD: «Explorar los 312 en el mapa» lleva a /explorar, en las dos casas; las compras vuelven al mapa.
//  10 · CUALQUIER PIE Y PLAZO (24-oct-2026, decisión de Fabrizio): los chips ofrecen pie de 10 a 50 % y plazo de 15 a 30
//       años; una combinación que la noche no tiene se calcula en el momento solo para el universo de los filtros, se guarda
//       24 horas en `avisos_evaluados.combos` (vale si es posterior a la evaluación de la fila), la página no la calcula en
//       el SSR y el mapa dice «Calculando con tu pie…» mientras tanto. La evaluación nocturna no cambia.
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ex from "../../../src/lib/explorar/explorar";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { origenDeInforme, textoOrigenArchivo } from "../../../src/lib/guia/seleccion-casa";
import { botonTrasPagar } from "../../../src/lib/compra/compra";
import { comprasDeExplorar, deptoDeVolverExplorar } from "../../../src/lib/guia/compra-desde-depto";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
type ServidorMod = typeof import("../../../src/lib/explorar/servidor");

const F0: ex.FiltrosExplorar = { comunas: ["Providencia"], tipologias: ["2"], ufMin: 3000, ufMax: 4000, pie: 20, plazo: 25 };
const fila = (id: string, veredicto: string | null, score: number | null) => ({
  id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 60, dormitorios: 2, banos: 2, precio_uf: 3600, veredicto, score, flujo: 100000, arriendo: 500000, pub_estado: null, pub_at: null,
});
/** Una base de mentira: la RPC devuelve `filas` de a páginas, por `range`. Anota qué pidió. */
function baseConFilas(filas: unknown[]) {
  const pedidos: Array<[string, Record<string, unknown>, number, number]> = [];
  const admin = { rpc: (nombre: string, params: Record<string, unknown>) => ({ range: async (a: number, b: number) => { pedidos.push([nombre, params, a, b]); return { data: filas.slice(a, b + 1), error: null }; } }) };
  return { admin: admin as never, pedidos };
}

export async function runExplorarTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR (el mapa de los que convienen: filtros que no tocan el perfil, solo Comprar, explorar no gasta, sin saldo el aviso E · 0 tokens) ───");

  // ── 1 · los filtros son el perfil y no lo tocan ──
  const f1 = ex.filtrosDePerfil({ comunas: ["Providencia"], dormitorios: [2], precioMinUf: 3000, precioMaxUf: 4000, piePct: 20, plazoAnios: 25, editado: ["precioMin"] });
  if (JSON.stringify(f1) !== JSON.stringify(F0)) F(`1 · el perfil no abre tal cual: ${JSON.stringify(f1)}`);
  const f2 = ex.filtrosDePerfil({ comunas: ["Santiago", "Ñuñoa"], dormitorios: [1, 2, 4, 5], precioMinUf: 3000, precioMaxUf: 4000, piePct: 30, plazoAnios: 30, editado: [] });
  // ⚠ ACTA (26-oct-2026, PERFIL-OFERTA §1) · el piso inferido es un chip de /deptos y el mapa abre con él (antes, desde UF 0).
  if (!f2 || f2.pie !== 30 || f2.plazo !== 30 || f2.ufMin !== 3000 || JSON.stringify(f2.tipologias) !== '["1","2","4"]' || f2.comunas.length !== 2) F(`1 · pie 30 / plazo 30 / piso inferido / tipologías: ${JSON.stringify(f2)}`);
  // ⚠ ACTA (24-oct-2026, goal «cualquier pie y plazo») · el perfil abre con SU pie y SU plazo (el de la lista más cercano), ya no con el de la noche.
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 25, plazoAnios: 20 })?.plazo !== 20) F("1 · el plazo 20 del perfil no abre con 20");
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 25, plazoAnios: 20 })?.pie !== 25) F("1 · el pie 25 del perfil no abre con 25");
  if (ex.pieDeLista(12) !== 10 || ex.pieDeLista(13) !== 15 || ex.pieDeLista(null) !== 20 || ex.pieDeLista(80) !== 50 || ex.plazoDeLista(18) !== 20 || ex.plazoDeLista(null) !== 25 || ex.plazoDeLista(40) !== 30) F("1 · el pie o el plazo del perfil no caen al más cercano de la lista");
  if (ex.filtrosDePerfil({ comunas: [], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: null, plazoAnios: null }) !== null) F("1 · sin comuna el perfil igual abre");
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: null, piePct: null, plazoAnios: null }) !== null) F("1 · sin tope el perfil igual abre");
  const g = ex.cambiarFiltro(F0, { pie: 30 });
  if (F0.pie !== 20 || g.pie !== 30 || g === F0) F("1 · cambiar un chip muta el filtro anterior o no da uno nuevo");
  if (ex.cambiarFiltro(F0, { comunas: ["Marte"] }) !== F0) F("1 · un cambio inválido no deja el filtro como estaba");
  const ida = ex.urlDeFiltros(g);
  if (ida !== "c=Providencia&t=2&r=3000-4000&p=30&z=25") F(`1 · la URL de los filtros: ${ida}`);
  if (JSON.stringify(ex.filtrosDeUrl(new URLSearchParams(ida))) !== JSON.stringify(g)) F("1 · la URL no vuelve al mismo filtro");
  if (ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=25&z=25"))?.pie !== 25 || ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=20&z=20"))?.plazo !== 20) F("1 · un pie o un plazo de la lista no pasa por la URL");
  if (ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=12&z=25")) !== null || ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=20&z=35")) !== null) F("1 · un pie o un plazo fuera de la lista pasa por la URL");
  if (JSON.stringify(ex.PIES_EXPLORAR) !== "[10,15,20,25,30,40,50]" || JSON.stringify(ex.PLAZOS_EXPLORAR) !== "[15,20,25,30]") F("1 · los chips no ofrecen pie de 10 a 50 % y plazo de 15 a 30 años");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  if ((cli.match(/\/api\/perfil-busqueda/g) ?? []).length !== 1 || !/if \(eleccion\?\.guardarPerfil\) \{\s*await fetch\("\/api\/perfil-busqueda", \{ method: "PUT"/.test(cli)) F("1 · la página escribe el perfil fuera de la casilla del pop-up (o no la honra)");
  // ⚠ ACTA (24-oct-2026, Explorar cerrado sin saldo) · cerrado, el chip no busca: `if (cerrado) return;` antes del filtro nuevo.
  if (!/function aplicar\(parche: Partial<FiltrosExplorar>, chip: Chip\) \{\s*if \(cerrado\) return;\s*const f = cambiarFiltro\(filtros, parche\);[\s\S]{0,600}void cargar\(f, true\)/.test(cli)) F("1 · cambiar un chip no es un filtro nuevo leído de /api/explorar");
  if (!/window\.history\.replaceState\(window\.history\.state, "", `\$\{window\.location\.pathname\}\?\$\{urlDeFiltros\(f\)\}`\)/.test(cli)) F("1 · el cambio de chip no queda en la URL");
  for (const p of ["src/app/api/explorar/route.ts", "src/app/api/explorar/recalcular/route.ts", "src/lib/explorar/servidor.ts"]) {
    const s = codigo(p);
    if (!s) F(`1 · falta ${p}`);
    else if (/\.(upsert|update|insert|delete)\(/.test(s) || /perfil_busqueda/.test(s)) F(`1 · ${p} escribe (explorar no toca nada)`);
  }
  if (!/const filtros = filtrosDeUrl\(sp\) \?\? \(await filtrosDeLaCuenta\(admin, user\.id\)\)\.filtros;/.test(codigo("src/app/api/explorar/route.ts"))) F("1 · la API no lee los filtros de la URL, o sin ellos no cae al perfil");
  if (!/const deUrl = filtrosDeUrl\(sp\);\s*const cuenta = deUrl \? null : await filtrosDeLaCuenta\(admin, user\.id\);/.test(codigo("src/app/explorar/page.tsx"))) F("1 · la página no abre con el perfil (o no respeta los filtros de la URL)");

  // ── 2 · solo los Comprar ──
  const sc = ex.soloComprar([{ veredicto: "COMPRAR", id: 1 }, { veredicto: "AJUSTA SUPUESTOS", id: 2 }, { veredicto: null, id: 3 }, { veredicto: "BUSCAR OTRA", id: 4 }]);
  if (sc.length !== 1 || sc[0].id !== 1) F(`2 · soloComprar deja pasar otros veredictos: ${JSON.stringify(sc)}`);
  const srv = cargar<ServidorMod>("src/lib/explorar/servidor.ts");
  if (!srv) F("2 · no carga src/lib/explorar/servidor.ts");
  else {
    const { admin, pedidos } = baseConFilas([fila("a", "COMPRAR", 80), fila("b", "AJUSTA SUPUESTOS", 90), fila("c", "COMPRAR", 95), fila("d", null, 99)]);
    const pines = await srv.pinesExplorar(admin, F0, new Date("2026-10-23T12:00:00Z"));
    if (pines.map((p) => p.avisoId).join(",") !== "c,a") F(`2 · los pines no son solo los Comprar por puntaje: ${pines.map((p) => `${p.avisoId}:${p.veredicto}:${p.score}`).join(",")}`);
    if (pedidos[0]?.[0] !== "explorar_pines" || pedidos[0]?.[1].pie !== 20 || pedidos[0]?.[1].plazo !== 25 || JSON.stringify(pedidos[0]?.[1].dorms) !== "[2]") F(`2 · la RPC no recibe el pie, el plazo y los dormitorios del filtro: ${JSON.stringify(pedidos[0])}`);
    const muchas = Array.from({ length: 1005 }, (_, i) => fila(`p${String(i).padStart(4, "0")}`, "COMPRAR", 1000 - i));
    const { admin: a2, pedidos: p2 } = baseConFilas(muchas);
    const todos = await srv.pinesExplorar(a2, F0);
    if (todos.length !== 1005 || p2.length !== 2 || p2[0][2] !== 0 || p2[0][3] !== 999 || p2[1][2] !== 1000) F(`2 · no pagina de a mil: ${todos.length} pines en ${p2.length} pedidos (${p2.map((x) => `${x[2]}-${x[3]}`).join(",")})`);
    if (pines[0].arriendo !== 500000 || pines[0].vistoAt !== null || pines[0].tipologia !== "2D2B") F(`2 · el pin no trae el arriendo, la marca o la tipología: ${JSON.stringify(pines[0])}`);
  }
  const sql = leer("supabase/migrations/20261023_explorar.sql");
  if (!/create or replace function public\.explorar_pines\(/.test(sql) || !/end\) = 'COMPRAR'\s*order by/.test(sql)) F("2 · la RPC explorar_pines no filtra los Comprar en el SQL");
  if (!/revoke execute on function public\.explorar_pines\(/.test(sql) || !/revoke execute on function public\.explorar_conteo\(/.test(sql)) F("2 · las RPC de Explorar quedan ejecutables por anon/authenticated");
  if (!/and ae\.arriendo_sospechoso is not true/.test(sql) || !/pa\.estado is distinct from 'despublicado'/.test(sql)) F("2 · la RPC no es el mismo universo que el semanal (sospechosos, despublicados)");
  const srvSrc = codigo("src/lib/explorar/servidor.ts");
  if (!/return porPuntaje\(soloComprar\(pines\)\);/.test(srvSrc)) F("2 · la lib no vuelve a filtrar los Comprar ni ordena por puntaje");
  if (!/\.rpc\("explorar_pines", params\)\.range\(desde, desde \+ PAGINA_PINES - 1\)/.test(srvSrc) || srv?.PAGINA_PINES !== 1000) F("2 · la lectura no pagina con range de a mil");

  // ── 3 · explorar no gasta; analizar sí ──
  for (const p of ["src/app/api/explorar/route.ts", "src/app/api/explorar/recalcular/route.ts", "src/lib/explorar/servidor.ts", "src/app/explorar/page.tsx"]) {
    if (/ensureCreditCharged|chargeAnalysisCredit|consumeCredit|analizarAvisoDeGuia/.test(codigo(p))) F(`3 · ${p} cobra o analiza`);
  }
  const an = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
  if (!/const desdeExplorar = b\.explorar === true && b\.origenId == null && typeof b\.semanal !== "string";/.test(an)) F("3 · la ruta de la guía no conoce «explorar: true»");
  if (!/if \(desdeExplorar\) \{[\s\S]{0,200}if \(!esPiePopup\(b\.piePct\) \|\| !esPlazoPopup\(b\.plazoAnios\)\) return NextResponse\.json\(\{ error: "combinacion" \}, \{ status: 400 \}\);/.test(an)) F("3 · desde Explorar el pie y el plazo no se validan contra las listas del pop-up");
  if (!/combo = \{ piePct: Number\(b\.piePct\), plazoAnios: Number\(b\.plazoAnios\) \};\s*o = origenSintetico\(user\.id, \{ piePct: combo\.piePct, plazoAnios: combo\.plazoAnios, comunas: pp\.perfil\.comunas, dormitorios: pp\.perfil\.dormitorios \}, await leerConfigGuia\(admin\)\);/.test(an)) F("3 · desde Explorar no se analiza con el origen sintético y la tasa de mercado");
  if (!/const desde: "semanal" \| "guia" \| "explorar" = desdeExplorar \? "explorar" : desdeSemanal \? "semanal" : "guia";/.test(an) || !/via: desde \}\)\);/.test(an) || !/body\.origenAviso\.desde = desde;/.test(an)) F("3 · «explorar» no llega a analisis_creado (via) ni al informe (origenAviso.desde)");
  if (!/if \(desdeExplorar\) \{\s*waitUntil\(capturarServidor\(eventoExplorarAnaliza\(\{ userId: user\.id, analysisId: id, avisoId: aviso\.avisoId/.test(an)) F("3 · «explorar_analiza» no sale al crear el informe desde el mapa");
  if (!/idAnalizarEste\(b\.avisoId, desdeExplorar \? "explorar" :/.test(an)) F("3 · el AnalizarEste de Meta desde Explorar no lleva su propio id");
  if (!/body: JSON\.stringify\(\{ avisoId: it\.avisoId, piePct: combinacion\.piePct, plazoAnios: combinacion\.plazoAnios, explorar: true \}\)/.test(cli)) F("3 · «Analizar este» del mapa no va por la ruta de la guía con explorar: true");
  if (ex.lineaSaldo({ tipo: "con", n: 2, noVencen: false }) !== "Tienes 2 análisis. Explorar no gasta; analizar sí.") F(`3 · la línea del saldo: ${ex.lineaSaldo({ tipo: "con", n: 2, noVencen: false })}`);
  if (ex.lineaSaldo({ tipo: "sin" }) !== "No te quedan análisis. Explorar no gasta; analizar sí.") F("3 · la línea sin saldo");
  if (ex.botonAnalizar({ tipo: "con", n: 2, noVencen: false }) !== "Analizar este · usa 1 de tus 2" || ex.botonAnalizar({ tipo: "regalo", vence: null }) !== "Analizar este · usa tu análisis de regalo" || ex.botonAnalizar({ tipo: "sin" }) !== "Analizar este") F("3 · «Analizar este · usa 1 de tus N»");

  // ── 4 · sin saldo se ve el mapa y el aviso E ──
  const e1 = ex.estadoDeEntrada({ tipo: "sin" }), e2 = ex.estadoDeEntrada({ tipo: "con", n: 1, noVencen: false });
  if (e1.mapa !== true || e1.aviso !== true || e2.mapa !== true || e2.aviso !== false) F(`4 · estadoDeEntrada: ${JSON.stringify([e1, e2])}`);
  // ── 4b · SIN SALDO, EXPLORAR ESTÁ CERRADO ── (⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio))
  // Hasta hoy, al cerrar el aviso se podía explorar igual. Ahora el mapa queda a la vista pero cerrado: los chips no se
  // tocan, los pines no se abren, la hoja muestra solo la oferta; el servidor manda los pines sin detalle y la ruta de los
  // pines responde 403. El plan cuenta como saldo.
  if (!e1.cerrado || e2.cerrado || ex.estadoDeEntrada({ tipo: "plan" }).cerrado || ex.estadoDeEntrada({ tipo: "regalo", vence: null }).cerrado || !ex.explorarCerrado({ tipo: "sin" })) F("4b · sin saldo Explorar no queda cerrado (o queda cerrado con saldo, con el regalo o con el plan)");
  const pc = ex.pinCerrado({ avisoId: "a1", lat: -33.4, lng: -70.6 });
  if (pc.precioUF !== 0 || pc.m2 !== 0 || pc.score !== null || pc.flujo !== null || pc.arriendo !== null || pc.tipologia !== null || pc.comuna !== "" || pc.lat !== -33.4) F(`4b · el pin del mapa cerrado trae detalle: ${JSON.stringify(pc)}`);
  if (ex.AVISO_SIN_SALDO.cerrado !== "Con análisis disponibles exploras todo Santiago") F("4b · la línea del mapa cerrado");
  const srvC = codigo("src/lib/explorar/servidor.ts");
  if (!/if \(explorarCerrado\(saldo\)\) \{[\s\S]{0,400}return \{ \.\.\.comun, filtros: fn, calculando: false, cuenta, pines: deLaNoche\.map\(pinCerrado\), n: deLaNoche\.length, cerrado: true \};/.test(srvC)) F("4b · el servidor manda los pines con detalle sin saldo");
  const rutaC = codigo("src/app/api/explorar/route.ts");
  const iCerr = rutaC.indexOf("if (await explorarCerradoPara(admin, user.id)) return NextResponse.json({ error: \"cerrado\" }, { status: 403"), iCarga = rutaC.indexOf("await cargarExplorar(");
  if (iCerr < 0 || iCarga < 0 || iCerr > iCarga) F("4b · la ruta de los pines no responde 403 sin saldo antes de leer nada");
  const pagC = codigo("src/app/explorar/page.tsx");
  if (!/inicial=\{d\.cerrado \? \{/.test(pagC) || !/abrir=\{d\.cerrado \? null : a\}/.test(pagC) || !/autoAnalizar=\{!d\.cerrado && sp\.get\("analizar"\) === "1" \? a : null\}/.test(pagC)) F("4b · la página no entra cerrada sin saldo (o abre un depto)");
  // ⚠ ACTA (26-oct-2026) · antes de cortar, `seleccionar` deja «explorar_pin» si el toque fue en el mapa (también cerrado):
  // nada más que esa medición va antes del `if (cerrado) return;`.
  if (!/function seleccionar\(avisoId: string, desde: "mapa" \| "tarjeta" = "tarjeta"\) \{\s*if \(desde === "mapa"\) posthog\?\.capture\(EVENTOS_EXPLORAR\.pin, \{ aviso_id: avisoId, cerrado \}\);\s*if \(cerrado\) return;/.test(cli) || !/function aplicar\(parche: Partial<FiltrosExplorar>, chip: Chip\) \{\s*if \(cerrado\) return;/.test(cli)) F("4b · cerrado, un pin o un chip todavía abren o buscan");
  try {
    const { ExplorarCliente } = require(join(RAIZ, "src/app/explorar/explorar-cliente")) as typeof import("../../../src/app/explorar/explorar-cliente");
    const filtros = ex.filtrosDePerfil({ comunas: ["Providencia"], dormitorios: [2], precioMinUf: 0, precioMaxUf: 60000, piePct: 20, plazoAnios: 25 } as never);
    const baseC = { filtros, n: 2, analizadosN: 0, analizados: {}, ticket: true, cuentaCreadaAt: new Date(Date.now() - 3600_000).toISOString(), finanzas: { uf: 39000, tasa: 4.2 }, desdePerfil: true, completo: true, totalNoche: 4807 };
    const pinesV = [{ avisoId: "a1", comuna: "Providencia", lat: -33.43, lng: -70.61, m2: 50, dormitorios: 2, tipologia: "2D1B", precioUF: 4500, veredicto: "COMPRAR", score: 80, flujo: 50000, arriendo: 700000, vistoAt: null }];
    const cerradoHtml = dibujar(createElement(ExplorarCliente as unknown as FC<Record<string, unknown>>, { inicial: { ...baseC, pines: pinesV.map(ex.pinCerrado), saldo: { tipo: "sin" }, cerrado: true } }));
    const abiertoHtml = dibujar(createElement(ExplorarCliente as unknown as FC<Record<string, unknown>>, { inicial: { ...baseC, pines: pinesV, saldo: { tipo: "con", n: 2, noVencen: false }, cerrado: false } }));
    const chipsC = cerradoHtml.slice(cerradoHtml.indexOf('class="ex-chips"'), cerradoHtml.indexOf("ex-chips-fin"));
    const apagados = (chipsC.match(/disabled=""/g) ?? []).length;
    if (apagados < 5 || !/data-cerrado="1"/.test(chipsC)) F(`4b · cerrado, los chips no están apagados (${apagados} de 5)`);
    const tC = cerradoHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (!/data-explorar="cerrado"/.test(cerradoHtml) || !tC.includes("Solo para cuentas nuevas · 3 análisis por $14.990") || !tC.includes("Aprovechar · 3 por $14.990") || !tC.includes("Comprar solo 1") || !tC.includes("Con análisis disponibles exploras todo Santiago")) F("4b · cerrado, la hoja no muestra la oferta y «Con análisis disponibles exploras todo Santiago»");
    if (/data-explorar="tarjeta"|data-explorar="titulo-hoja"|data-explorar="saldo"/.test(cerradoHtml)) F("4b · cerrado, la hoja muestra tarjetas o la lista");
    const chipsA = abiertoHtml.slice(abiertoHtml.indexOf('class="ex-chips"'), abiertoHtml.indexOf("ex-chips-fin"));
    if (/disabled=""/.test(chipsA) || /data-explorar="cerrado"/.test(abiertoHtml) || !/data-explorar="tarjeta"/.test(abiertoHtml)) F("4b · con saldo Explorar queda cerrado (chips apagados o sin tarjetas)");
  } catch (e) {
    F(`4b · no se pudo dibujar Explorar: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!/const entrada = estadoDeEntrada\(inicial\.saldo\);\s*const \[avisoSinSaldo, setAvisoSinSaldo\] = useState\(entrada\.aviso\);/.test(cli)) F("4 · el aviso E no sale del estado de entrada");
  if (!/\{mapaListo && mapa !== "fallo" && \(\s*<MapaExplorar/.test(cli) || /saldo[^\n]{0,40}<MapaExplorar|<MapaExplorar[^\n]{0,200}saldo/.test(cli)) F("4 · el mapa depende del saldo (sin saldo tiene que verse igual)");
  if (!/\{avisoSinSaldo && !confirmar && \(\s*<AvisoSinSaldoExplorar/.test(cli) || !/alCerrar=\{\(\) => setAvisoSinSaldo\(false\)\}/.test(cli)) F("4 · el aviso E no se monta sin saldo, o «Ahora no» no lo cierra");
  try {
    const { AvisoSinSaldoExplorar } = require(join(RAIZ, "src/app/explorar/aviso-sin-saldo")) as typeof import("../../../src/app/explorar/aviso-sin-saldo");
    const compras = comprasDeExplorar({ filtros: "c=Providencia", ticket: true });
    const html = dibujar(createElement(AvisoSinSaldoExplorar as unknown as FC<Record<string, unknown>>, { totalNoche: 4807, compras, vence: "mañana 11:17", alCerrar() {}, alIr() {} }));
    // ⚠ ACTA (24-oct-2026, goal «los pop-ups caben en 390 × 740») · la oferta va en UNA fila: «Solo para cuentas nuevas · vence mañana 11:17».
    // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · el título dice el total de anoche en Santiago.
    for (const t of ["Para explorar los 4.807 de Santiago necesitas análisis disponibles.", ex.AVISO_SIN_SALDO.cuerpo, "Solo para cuentas nuevas", "· vence mañana 11:17", "Comprar solo 1", "Ver el plan de 20 al mes", "Ahora no"]) {
      if (!html.includes(t)) F(`4 · el aviso E no dice «${t.slice(0, 50)}»`);
    }
    if (!/data-modal="explorar-sin-saldo"/.test(html) || !/data-explorar="ahora-no"/.test(html) || !/href="\/pricing"/.test(html)) F("4 · el aviso E sin su marca, sin «Ahora no» o sin el enlace al plan");
    if (!/Aprovechar · 3 por \$14\.990/.test(html)) F("4 · con el ticket el principal no es «Aprovechar · 3 por $14.990»");
    const sinTicket = dibujar(createElement(AvisoSinSaldoExplorar as unknown as FC<Record<string, unknown>>, { n: 0, compras: comprasDeExplorar({ filtros: "c=Providencia", ticket: false }), vence: null, alCerrar() {}, alIr() {} }));
    if (/Solo para cuentas nuevas/.test(sinTicket) || !/Para explorar el mapa necesitas análisis disponibles\./.test(sinTicket) || !/3 análisis · \$19\.990/.test(sinTicket)) F("4 · sin ticket el aviso E igual dice «Solo para cuentas nuevas», o no ofrece el pack de tres");
  } catch (e) {
    F(`4 · el aviso E explotó al dibujarse: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 5 · el mapa carga después del primer pintado ──
  if (!/const MapaExplorar = dynamic\(\(\) => import\("\.\/mapa-explorar"\), \{ ssr: false/.test(cli)) F("5 · el mapa no entra por next/dynamic sin SSR");
  if (!/cuandoLaPaginaEsteQuieta\(\(\) => \{\s*setMapaListo\(true\);/.test(cli)) F("5 · el mapa no espera a que la página esté quieta");
  for (const p of ["src/app/explorar/explorar-cliente.tsx", "src/app/explorar/page.tsx", "src/lib/explorar/explorar.ts"]) {
    if (/loadGoogleMaps|maps\.googleapis/.test(codigo(p))) F(`5 · ${p} trae Google Maps al primer pintado`);
  }
  if (!/import \{ loadGoogleMaps \} from "@\/lib\/loadGoogleMaps";/.test(codigo("src/app/explorar/mapa-explorar.tsx"))) F("5 · el mapa no usa el cargador de siempre");
  if (!/pines: d\.pines\.slice\(0, TOPE_HOJA\), completo: noche && d\.n <= TOPE_HOJA/.test(codigo("src/app/explorar/page.tsx"))) F("5 · el servidor manda todos los pines al primer pintado (o no dice si están completos)");
  // La constante vive en la lib pura: desde un módulo "use client" llegaría al servidor como referencia (23-oct-2026).
  if (!/import \{ esCombinacionDeLaNoche, EXPLORAR_COPY, filtrosDeUrl, MAPA_QUIETO, TOPE_HOJA \} from "@\/lib\/explorar\/explorar";/.test(codigo("src/app/explorar/page.tsx")) || ex.TOPE_HOJA !== 24 || /export const TOPE_HOJA/.test(cli)) F("5 · TOPE_HOJA no sale de la lib pura (en el servidor una constante de un módulo \"use client\" es una referencia)");
  if (!/if \(!inicial\.completo && !inicial\.calculando\) void cargar\(inicial\.filtros, false\);/.test(cli)) F("5 · el resto de los pines no llega con el mapa");
  // ⚠ ACTA (23-oct-2026, medido en producción: 9,7 s) · sin el mapa quieto, la primera tesela de Google (a los 8 s) es el LCP.
  // En el teléfono va INCRUSTADO en el HTML (mapa-quieto.ts): como archivo precargado llegaba 1,3 s tarde y el LCP daba 2,5 s.
  const quieto = cargar<typeof import("../../../src/lib/explorar/mapa-quieto")>("src/lib/explorar/mapa-quieto.ts");
  if (!quieto?.MAPA_QUIETO_M?.startsWith("data:image/webp;base64,")) F("5 · falta el mapa quieto incrustado (MAPA_QUIETO_M, data URI webp)");
  else if (quieto.MAPA_QUIETO_M.length > 24 * 1024) F(`5 · el mapa quieto incrustado pesa ${Math.round(quieto.MAPA_QUIETO_M.length / 1024)} kB en el HTML (tope 24)`);
  if (!existe(`public${ex.MAPA_QUIETO.d}`)) F("5 · falta el mapa quieto de escritorio");
  else if (readFileSync(join(RAIZ, `public${ex.MAPA_QUIETO.d}`)).length > 60 * 1024) F("5 · el mapa quieto de escritorio pesa más de 60 kB");
  const pag = codigo("src/app/explorar/page.tsx");
  if (!/<link rel="preload" as="image" href=\{MAPA_QUIETO\.d\} media="\(min-width: 768px\)" fetchPriority="high" \/>/.test(pag)) F("5 · el mapa quieto de escritorio no se precarga desde el <head>");
  if (/MAPA_QUIETO_M/.test(cli) || /mapa-quieto"/.test(cli)) F("5 · el mapa quieto incrustado entra al JS del cliente (va dibujado por el servidor y pasado como nodo)");
  if (!/mapaQuieto=\{\s*<picture className="ex-mapa-quieto" data-explorar="mapa-quieto">\s*<source media="\(min-width: 768px\)" srcSet=\{MAPA_QUIETO\.d\} \/>[\s\S]{0,120}<img src=\{MAPA_QUIETO_M\} alt="" width=\{560\} height=\{514\} fetchPriority="high"/.test(pag)) F("5 · la página no dibuja el mapa quieto (teléfono incrustado, escritorio archivo) con prioridad alta");
  const iQuieto = cli.indexOf("{mapaQuieto}"), iMapa = cli.indexOf("<MapaExplorar");
  if (iQuieto < 0 || iMapa < 0 || iQuieto > iMapa) F("5 · el mapa quieto no se dibuja antes del mapa real");
  if (!/g\.maps\.event\.addListenerOnce\(map, "tilesloaded", \(\) => onEstadoRef\.current\("teselas"\)\);/.test(codigo("src/app/explorar/mapa-explorar.tsx")) || !/\.ex-mapa-wrap\[data-mapa="teselas"\] \.ex-mapa-quieto \{ opacity: 0; \}/.test(leer("src/app/explorar/explorar.css")) || !/<div className="ex-mapa-wrap" data-mapa=\{mapa\}>/.test(cli)) F("5 · el mapa quieto no se va cuando el real dibujó sus teselas (o se va antes)");

  // ── 6 · la hoja y el pin ──
  if (ex.pildora(312, 3) !== "312 convienen · 3 ya analizados" || ex.pildora(1, 0) !== "1 conviene" || ex.pildora(1200, 1) !== "1.200 convienen · 1 ya analizado") F("6 · la píldora");
  if (ex.tituloHoja(312) !== "312 deptos que convienen" || ex.tituloHoja(1) !== "1 depto que conviene" || !ex.tituloHoja(0).startsWith("Ninguno")) F("6 · el título de la hoja");
  const rev = ex.textoRevisado({ pie: 20, plazo: 25 });
  if (`${rev.antes}${rev.enlace}.` !== "Revisado con pie 20 % y 25 años. El informe completo incluye el enlace a la publicación.") F(`6 · «Revisado con…»: ${rev.antes}${rev.enlace}`);
  if (ex.marcaDePin({ vistoAt: null }) !== "Visto anoche" || !ex.marcaDePin({ vistoAt: "2026-10-23T06:12:00Z" }, new Date("2026-10-23T12:00:00Z")).startsWith("Visto publicado hoy")) F("6 · la marca del pin");
  const cap = ex.capRatePct(500000, 3600, 39000);
  if (cap == null || Math.abs(cap - 4.2735) > 0.01 || ex.capRatePct(null, 3600, 39000) !== null || ex.capRatePct(500000, 3600, null) !== null) F(`6 · el cap rate: ${cap}`);
  if (ex.ufPorM2(3600, 61) == null || Math.abs((ex.ufPorM2(3600, 61) ?? 0) - 59.016) > 0.01 || ex.ufPorM2(3600, 0) !== null) F("6 · los UF por m²");
  if (ex.pctUno(4.2735) !== "4,3 %" || ex.flujoTexto(-45120) !== "−$45.120" || ex.flujoTexto(142000) !== "+$142.000") F("6 · los formatos");
  const cerca = [{ avisoId: "a", lat: -33.43, lng: -70.61 }, { avisoId: "b", lat: -33.43009, lng: -70.61 }, { avisoId: "c", lat: -33.47, lng: -70.56 }];
  const g12 = ex.agruparPines(cerca, 12, new Set(["b"]));
  if (g12.length !== 2 || !g12.some((x) => x.n === 2 && x.analizados === 1 && x.ids.includes("a") && x.ids.includes("b")) || !g12.some((x) => x.n === 1 && x.ids[0] === "c")) F(`6 · a zoom 12 dos pines a 10 m no se agrupan (o el lejano sí): ${JSON.stringify(g12)}`);
  const g19 = ex.agruparPines(cerca, 19);
  if (g19.length !== 3 || g19.some((x) => x.n !== 1)) F(`6 · a zoom 19 los pines siguen agrupados: ${JSON.stringify(g19)}`);
  if (!/data-explorar="pildora"[\s\S]{0,220}\{pildora\(total, datos\.analizadosN\)\}/.test(cli)) F("6 · la píldora no cuenta los pines ni los ya analizados");
  if (!/const total = datos\.completo \? pines\.length : Math\.max\(0, datos\.n - caidos\.length\);/.test(cli)) F("6 · antes del mapa la píldora cuenta las tarjetas (24) y no lo que contó el servidor");
  if (!/data-explorar="revisado">\{revisado\.antes\}<strong>\{revisado\.enlace\}<\/strong>\.<\/p>/.test(cli)) F("6 · el detalle no lleva «Revisado con…» con el enlace destacado");
  if (!/<dt>\{EXPLORAR_COPY\.capRate\}<\/dt><dd>\{cap != null \? pctUno\(cap\) : "—"\}/.test(cli) || !/<dt>\{EXPLORAR_COPY\.ufM2\}<\/dt>/.test(cli) || !/<dt>\{EXPLORAR_COPY\.flujo\}<\/dt>/.test(cli)) F("6 · el detalle no muestra flujo, cap rate y UF por m²");
  if (!/data-explorar="analizar-detalle">\s*\{generando === p\.avisoId \? GUIA\.analizando : usa\}/.test(cli) || !/const usa = botonAnalizar\(datos\.saldo\);/.test(cli)) F("6 · el botón del detalle no dice «usa 1 de tus N»");
  if (!/data-explorar="ya-analizado">\{EXPLORAR_COPY\.yaAnalizado\} · <EnlaceCarga href=\{`\/analisis\/\$\{informe\}`\}/.test(cli)) F("6 · la tarjeta del ya analizado no lleva a su informe");
  const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
  if (!/agruparPines\(visibles\.filter\(\(p\) => p\.avisoId !== sel\), zoom, analizadosRef\.current\)/.test(mapa) || !/iconoPin\(analizadosRef\.current\.has\(id\) \? azul : ROJO\)/.test(mapa) || !/iconoGrupo\(gr\.n,/.test(mapa)) F("6 · el mapa no agrupa, o no pinta de azul los ya analizados y de rojo los que convienen");
  if (!/const ROJO = "#C8323C";/.test(mapa) || !/const AZUL_CLARO = "#2B558F";/.test(mapa)) F("6 · los colores de los pines no son Signal Red y el azul de Comprar");

  // ── 7 · el pop-up con «Cambiar» ──
  const tc = ex.textoCambio({ antes: { pie: 20, veredicto: "COMPRAR", score: 88, flujo: 88363 }, despues: { pie: 10, plazo: 25, veredicto: "AJUSTA SUPUESTOS", score: 61, flujo: -45120 } }, (v) => (v === "COMPRAR" ? "Comprar" : v === "AJUSTA SUPUESTOS" ? "Ajustar" : "Buscar otro"));
  if (tc.titulo !== "Con pie 10 % este depto da Ajustar." || tc.detalle !== "Flujo mensual −$45.120 de tu bolsillo. Con 20 % daba Comprar 88 y +$88.363." || !tc.empeora) F(`7 · el texto del cambio: ${JSON.stringify(tc)}`);
  const tc2 = ex.textoCambio({ antes: { pie: 20, veredicto: "COMPRAR", score: 88, flujo: 88363 }, despues: { pie: 30, plazo: 25, veredicto: "COMPRAR", score: 92, flujo: 150000 } }, (v) => (v === "COMPRAR" ? "Comprar" : v));
  if (tc2.titulo !== "Con pie 30 % este depto da Comprar 92." || tc2.empeora) F(`7 · con más pie: ${JSON.stringify(tc2)}`);
  if (!ex.esPiePopup(10) || ex.esPiePopup(12) || !ex.esPlazoPopup(20) || ex.esPlazoPopup(35)) F("7 · las listas del pop-up");
  const av = codigo("src/components/guia/AvisoAntesDeAnalizar.tsx");
  if (!/data-modal-cambiar onClick=\{\(\) => setEditando\(true\)\}>\{EXPLORAR_COPY\.cambiar\}/.test(av)) F("7 · el pop-up no tiene «Cambiar»");
  if (!/void cambio\.recalcular\(combo\)\.then/.test(av)) F("7 · al cambiar no se recalcula con el servidor");
  if (!/const analizar = da\?\.empeora \? EXPLORAR_COPY\.analizarIgual : AVISO_ANALIZAR\.analizar;/.test(av)) F("7 · si empeora el botón no dice «Analizar igual»");
  if (!/alAnalizar\(cambio \? \{ combinacion: combo, guardarPerfil: cambiada && guardar \} : undefined\)/.test(av)) F("7 · la elección (pie, plazo, guardar) no viaja a analizar");
  if (!/data-modal-guardar>\s*<input type="checkbox" checked=\{guardar\}/.test(av) || !/\{EXPLORAR_COPY\.guardarPerfil\(combo\.piePct, combo\.plazoAnios\)\}/.test(av)) F("7 · falta la casilla de guardar como perfil");
  if (!/derivados: derivadosAviso\(depto, combo, finanzas\),/.test(av)) F("7 · los derivados (dividendo, retorno) no siguen al cambio");
  if (!/cambio=\{\{ recalcular: \(combo\) => recalcular\(confirmar\.it\.avisoId, combo\), base: \{ veredicto: confirmar\.it\.veredicto/.test(cli)) F("7 · el mapa no abre el pop-up con «Cambiar»");
  const rc = codigo("src/app/api/explorar/recalcular/route.ts");
  if (!/const s = sondaDeCandidato\(c, \{ piePct: Number\(b\.piePct\), plazoAnios: Number\(b\.plazoAnios\) \}, cfg\);/.test(rc) || !/!esPiePopup\(b\.piePct\) \|\| !esPlazoPopup\(b\.plazoAnios\)/.test(rc)) F("7 · el recálculo no va por la sonda con el pie y el plazo validados");
  const ed = codigo("src/lib/avisos/estandar-deptos.ts");
  if (!/export function sondaDeCandidato\(/.test(ed) || !/const s = sondaDeCandidato\(c, \{ piePct: pie, plazoAnios: PLAZO_DEPTOS \}, cfg, asOf\);/.test(ed)) F("7 · el estándar de 25 años y el recálculo no comparten la sonda");

  // ── 8 · la medición ──
  if (srv) {
    const v = srv.eventoExplorarVista({ userId: "u", filtros: F0, n: 312, analizados: 3, fuente: "pagina" });
    if (v.event !== "explorar_vista" || v.distinctId !== "u" || v.properties?.n !== 312 || v.properties?.analizados !== 3 || v.properties?.pie !== 20 || JSON.stringify(v.properties?.comunas) !== '["Providencia"]' || v.properties?.fuente !== "pagina") F(`8 · explorar_vista: ${JSON.stringify(v)}`);
    const a = srv.eventoExplorarAnaliza({ userId: "u", analysisId: "an", avisoId: "av", comuna: "Providencia", precioUF: 3600, m2: 61, piePct: 20, plazoAnios: 25 });
    if (a.event !== "explorar_analiza" || a.properties?.aviso_id !== "av" || a.properties?.analysis_id !== "an" || a.properties?.pie_pct !== 20) F(`8 · explorar_analiza: ${JSON.stringify(a)}`);
  }
  // ⚠ ACTA (26-oct-2026) · la vista lleva además `robot` (vista-entrada.ts › robotDeVisita; tier PAUTA-ARREGLOS §3).
  if (!/void capturarServidor\(eventoExplorarVista\(\{ userId: user\.id, filtros, n: noche \? d\.n : null, analizados: analizadosN, fuente: "pagina", cuenta: d\.cuenta, robot: robotDeVisita\(headers\(\)\.get\("user-agent"\), headers\(\)\) \}\)\)/.test(codigo("src/app/explorar/page.tsx"))) F("8 · la página no deja «explorar_vista»");
  if (!/if \(sp\.get\("evento"\) === "1"\) \{[\s\S]{0,300}eventoExplorarVista\(\{ userId: user\.id, filtros, n: d\.n, analizados, fuente: "cambio", cuenta: d\.cuenta, robot: robotDeVisita\(request\.headers\.get\("user-agent"\), request\.headers\) \}\)/.test(codigo("src/app/api/explorar/route.ts")) || !/\$\{evento \? "&evento=1" : ""\}/.test(cli)) F("8 · cambiar un chip no deja «explorar_vista»");
  if (textoOrigenArchivo("explorar") !== "Desde Explorar" || origenDeInforme({ avisoId: "x", desde: "explorar" }, new Set()) !== "explorar") F("8 · el archivo no dice «Desde Explorar»");

  // ── 10 · cualquier pie y plazo: una combinación que la noche no tiene ──
  const liviano = (leer("supabase/migrations/20261024_explorar_combos.sql").split("create or replace function").find((x) => x.startsWith(" public.explorar_universo_liviano")) ?? "");
  if (!ex.esCombinacionDeLaNoche({ pie: 20, plazo: 25 }) || !ex.esCombinacionDeLaNoche({ pie: 30, plazo: 30 }) || ex.esCombinacionDeLaNoche({ pie: 15, plazo: 20 }) || ex.esCombinacionDeLaNoche({ pie: 20, plazo: 20 })) F("10 · esCombinacionDeLaNoche");
  if (ex.claveCombo({ pie: 15, plazo: 20 }) !== "15-20") F("10 · la clave del combo");
  const ahora = new Date("2026-10-24T12:00:00Z");
  const vivo = { v: "COMPRAR", s: 80, f: 100, at: "2026-10-24T10:00:00Z" };
  if (!ex.comboVigente(vivo, "2026-10-24T03:00:00Z", ahora)) F("10 · un combo de hace dos horas, posterior a la noche, no vale");
  if (ex.comboVigente({ ...vivo, at: "2026-10-23T10:00:00Z" }, "2026-10-23T03:00:00Z", ahora)) F("10 · un combo de hace 26 horas sigue valiendo");
  if (ex.comboVigente(vivo, "2026-10-24T11:00:00Z", ahora)) F("10 · un combo anterior a una reevaluación de la fila sigue valiendo");
  if (ex.comboVigente(null, "2026-10-24T03:00:00Z", ahora) || ex.comboVigente({ v: "COMPRAR" }, "2026-10-24T03:00:00Z", ahora)) F("10 · sin combo, o sin fecha, vale");
  if (srv) {
    // Una base de mentira: el universo trae tres filas —A con el combo guardado y vigente, B con uno viejo (anterior a la
    // reevaluación), C sin combo—; la sonda de mentira da Comprar a C y Ajustar a B. Tienen que salir A y C, calcularse
    // solo B y C, guardarse B y C, y no tocar la RPC de la noche.
    const llamadas: string[] = [];
    const guardadas: Array<{ aviso_id: string; combo: Record<string, unknown> }> = [];
    const filaU = (id: string, combo: unknown, evaluado: string) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 60, dormitorios: 2, banos: 2, precio_uf: 3600, arriendo_monto: 500000, evaluado_at: evaluado, combo, pub_estado: null, pub_at: null });
    const pesada = (id: string) => ({ ...fila(id, null, null), score_cron: 70, arriendo: { monto: 500000, fuente: "radio", n: 5, radio: 1000, radioMonto: 500000, radioFuente: "radio", segmento: null }, venta: null, gastos_comunes: null, mediana_comuna: { x: 1 }, antiguedad_anios: null, antiguedad_origen: "supuesta", condicion: "usado", direccion: null, fecha_entrega: null, url: null });
    const pedidasPesadas: string[] = [];
    const filas = [
      filaU("A", { v: "COMPRAR", s: 91, f: 120000, at: "2026-10-24T10:00:00Z" }, "2026-10-24T03:00:00Z"),
      filaU("B", { v: "COMPRAR", s: 85, f: 90000, at: "2026-10-23T10:00:00Z" }, "2026-10-24T03:00:00Z"),
      filaU("C", null, "2026-10-24T03:00:00Z"),
    ];
    const admin = {
      rpc: (nombre: string, params: Record<string, unknown>) => {
        llamadas.push(nombre);
        if (nombre === "explorar_guardar_combos") { for (const x of params.filas as typeof guardadas) guardadas.push(x); return Promise.resolve({ data: guardadas.length, error: null }); }
        if (nombre === "explorar_filas_para_sonda") { const ids = params.ids as string[]; pedidasPesadas.push(...ids); return Promise.resolve({ data: ids.map(pesada), error: null }); }
        if (nombre === "explorar_universo_liviano") return Promise.resolve({ data: params.clave === "15-20" ? filas : [], error: null });
        return { range: async () => ({ data: [], error: null }) };
      },
    } as never;
    const sonda = (c: { avisoId: string }, combo: { piePct: number; plazoAnios: number }) => (combo.piePct !== 15 || combo.plazoAnios !== 20 ? null : c.avisoId === "C" ? { veredicto: "COMPRAR", score: 77, flujo: 50000, cuota: 1 } : { veredicto: "AJUSTA SUPUESTOS", score: 60, flujo: -10000, cuota: 1 });
    const cuenta = { calculados: 0, ms: 0 };
    const pines = await srv.pinesExplorar(admin, { ...F0, pie: 15, plazo: 20 }, ahora, cuenta, { sonda: sonda as never, cfg: { uf: 39000, tasa: 4.2 } });
    if (pines.map((p) => `${p.avisoId}:${p.score}`).join(",") !== "A:91,C:77") F(`10 · con una combinación nueva no salen los Comprar guardados más los calculados, por puntaje: ${pines.map((p) => `${p.avisoId}:${p.veredicto}:${p.score}`).join(",")}`);
    if (cuenta.calculados !== 2) F(`10 · se calcularon ${cuenta.calculados} y no los 2 que faltaban (B vencido por la reevaluación, C sin combo)`);
    if (llamadas.includes("explorar_pines") || !llamadas.includes("explorar_universo_liviano") || !llamadas.includes("explorar_guardar_combos")) F(`10 · las RPC: ${llamadas.join(",")} (una combinación nueva lee el universo y guarda; no toca la de la noche)`);
    if (pedidasPesadas.sort().join() !== "B,C") F(`10 · los datos pesados de la evaluación se piden para ${pedidasPesadas.join(",") || "nadie"} y no solo para lo que falta calcular (B, C)`);
    const ids = guardadas.map((g) => g.aviso_id).sort().join(",");
    if (ids !== "B,C" || !guardadas.every((g) => Object.keys(g.combo).join() === "15-20" && typeof (g.combo["15-20"] as { at?: unknown }).at === "string")) F(`10 · lo guardado no es solo lo calculado, bajo la clave del combo: ${JSON.stringify(guardadas).slice(0, 200)}`);
    if (!guardadas.some((g) => g.aviso_id === "B" && (g.combo["15-20"] as { v?: unknown }).v === "AJUSTA SUPUESTOS")) F("10 · lo que no da Comprar también se guarda (si no, se recalcularía en cada visita)");
    // La misma combinación, pedida de nuevo con todo guardado: nada se calcula y la sonda no corre.
    const llamadas2: string[] = [];
    const admin2 = { rpc: (nombre: string) => { llamadas2.push(nombre); return Object.assign(Promise.resolve({ data: [filaU("A", vivo, "2026-10-24T03:00:00Z")], error: null }), { range: async () => ({ data: [], error: null }) }); } } as never;
    const cuenta2 = { calculados: 0, ms: 0 };
    const otra = await srv.pinesExplorar(admin2, { ...F0, pie: 15, plazo: 20 }, ahora, cuenta2, { sonda: (() => { throw new Error("no debía calcular"); }) as never, cfg: { uf: 39000, tasa: 4.2 } });
    if (otra.length !== 1 || cuenta2.calculados !== 0 || llamadas2.includes("explorar_guardar_combos")) F("10 · con todo guardado igual calcula o guarda");
    // Y una combinación de la noche sigue saliendo de sus columnas, sin leer el universo.
    const llamadas3: string[] = [];
    const admin3 = { rpc: (nombre: string) => { llamadas3.push(nombre); return { range: async () => ({ data: [], error: null }) }; } } as never;
    await srv.pinesExplorar(admin3, F0, ahora);
    if (llamadas3.join() !== "explorar_pines") F(`10 · una combinación de la noche no sale de explorar_pines: ${llamadas3.join()}`);
  }
  // ⚠ ACTA (24-oct-2026, Explorar cerrado sin saldo) · la página lee junto el total de anoche de /deptos (el título del aviso sin saldo).
  if (!/const noche = esCombinacionDeLaNoche\(filtros\);[\s\S]{0,200}const \[d, portada\] = await Promise\.all\(\[cargarExplorar\(admin, user, filtros, new Date\(\), \{ pines: noche \}\), portadaDeptos\(\)\]\);/.test(codigo("src/app/explorar/page.tsx"))) F("10 · la página calcula una combinación nueva en el SSR (tardaría segundos antes del primer byte)");
  if (!/calculando: !noche, analizados: d\.analizados,/.test(codigo("src/app/explorar/page.tsx"))) F("10 · la página no le dice al navegador que está calculando");
  if (!/if \(inicial\.calculando\) \{ setCargando\("todo"\); void cargar\(inicial\.filtros, false\)/.test(cli)) F("10 · con una combinación nueva el navegador no pide los pines enseguida");
  if (!/const calculando = \(cargando !== null \|\| !!datos\.calculando\) && !esCombinacionDeLaNoche\(filtros\);/.test(cli) || !/\{calculando \? EXPLORAR_COPY\.calculando : <>/.test(cli) || !/data-calculando=\{calculando \? "1" : undefined\}>\{calculando \? EXPLORAR_COPY\.calculando : tituloHoja\(total\)\}/.test(cli)) F("10 · el mapa no dice «Calculando con tu pie…» mientras calcula");
  if (ex.EXPLORAR_COPY.calculando !== "Calculando con tu pie…") F("10 · el texto no es «Calculando con tu pie…»");
  if (!/data-chip="pie">[\s\S]{0,400}\{PIES_EXPLORAR\.map\(\(p\) => <option key=\{p\} value=\{p\}>/.test(cli) || !/data-chip="plazo">[\s\S]{0,400}\{PLAZOS_EXPLORAR\.map\(\(z\) => <option key=\{z\} value=\{z\}>/.test(cli)) F("10 · los chips de pie y plazo no ofrecen las listas enteras");
  const sqlC = leer("supabase/migrations/20261024_explorar_combos.sql");
  if (!/add column if not exists combos jsonb null/.test(sqlC) || !/ae\.combos -> clave/.test(sqlC) || !/set combos = coalesce\(ae\.combos, '\{\}'::jsonb\) \|\| f\.combo/.test(sqlC)) F("10 · la caché no vive en avisos_evaluados.combos (la misma tabla que la noche) o pisa las otras combinaciones");
  if (/combos/.test(codigo("src/app/api/cron/evaluar-avisos/route.ts"))) F("10 · la evaluación nocturna toca `combos` (no tenía que cambiar)");
  if (!/const \{ data, error \} = await admin\.rpc\("explorar_universo_liviano", params\);\s*if \(error\) throw/.test(srvSrc) || !/const porCalcular = filas\.filter\(\(r\) => !comboVigente\(r\.combo, r\.evaluado_at, ahora\)\);/.test(srvSrc)) F("10 · el universo no se lee en un solo pedido o no se reparte entre lo vigente y lo que falta calcular");
  if (!/returns jsonb[\s\S]{0,200}select coalesce\(jsonb_agg\(jsonb_build_object\(/.test(liviano)) F("10 · el universo liviano no devuelve un solo jsonb (el tope de mil de PostgREST lo cortaría)");
  if (!/const PEDIDOS_A_LA_VEZ = 12;/.test(srvSrc) || (srvSrc.match(/todos\.slice\(i, i \+ PEDIDOS_A_LA_VEZ\)\.map/g) ?? []).length !== 2) F("10 · lo pesado y el guardado no se piden de a varios a la vez");
  if (!liviano || /ae\.arriendo,|ae\.venta|mediana_comuna/.test(liviano)) F("10 · el universo liviano trae los jsonb de la evaluación (es lo que costaba 5,5 s), o no existe");
  if (ex.VIDA_COMBO_MS !== 24 * 3600_000) F("10 · la caché no dura 24 horas");

  // ── 9 · el dashboard y las compras ──
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) · el botón del dashboard vive en el mapa de la selección
  // (app/dashboard/mapa-casa.tsx, lib/casa/mapa-casa.ts › botonExplorar) y el número son los pines de Explorar menos nada:
  // la misma RPC, por pinesExplorar (lib/casa/mapa-casa-servidor.ts). Una sola casa.
  const { botonExplorar } = require(join(RAIZ, "src/lib/casa/mapa-casa")) as typeof import("../../../src/lib/casa/mapa-casa");
  // ⚠ ACTA (24-oct-2026, goal «Estás dentro con mapa, el perfil que se pliega y Explorar cerrado», recorrido de Fabrizio) · el botón dice el total de anoche en Santiago (el de /deptos); al tocarlo, /explorar abre con
  // los filtros del perfil.
  if (botonExplorar(4807) !== "Explorar los 4.807 de Santiago" || botonExplorar(0) !== "Explorar en el mapa" || botonExplorar(null) !== "Explorar en el mapa") F("9 · el botón del dashboard");
  const dash = codigo("src/app/dashboard/page.tsx");
  if ((dash.match(/<MapaCasa datos=\{mapa\} totalNoche=\{totalNoche\} \/>/g) ?? []).length !== 1 || !/datosMapaCasa\(admin, user\.id,/.test(dash) || !/const totalNoche = portada\.noche\?\.convienen \?\? null;/.test(dash)) F("9 · el dashboard no lleva el mapa de la selección con el botón a Explorar");
  const enCasa = codigo("src/app/dashboard/mapa-casa.tsx");
  if (!/<EnlaceCarga href="\/explorar"[^\n]*data-casa="explorar-boton"[^\n]*>\s*\{botonExplorar\(totalNoche\)\}/.test(enCasa) || !/pinesExplorar\(admin, filtros\)/.test(codigo("src/lib/casa/mapa-casa-servidor.ts"))) F("9 · el botón no va a /explorar o no cuenta con la misma RPC");
  const c = comprasDeExplorar({ filtros: "c=Providencia&t=2", avisoId: "abc", ticket: false });
  if (!/origen=explorar/.test(c.pack.href) || !/volver=%2Fexplorar%3Fc%3DProvidencia%26t%3D2%26a%3Dabc%26analizar%3D1/.test(c.pack.href) || !/product=single/.test(c.suelto.href) || !/origen=explorar/.test(c.suelto.href)) F(`9 · las compras no vuelven al mapa con el depto: ${c.pack.href} · ${c.suelto.href}`);
  if (!/product=pack3/.test(comprasDeExplorar({ filtros: "c=x", ticket: true }).pack.href) || comprasDeExplorar({ filtros: "c=x", ticket: true }).pack.label !== "3 análisis · $14.990") F("9 · con el ticket el pack no es el de $14.990");
  if (botonTrasPagar("/explorar?c=x&a=abc&analizar=1").texto !== "Volver al mapa" || botonTrasPagar("/explorar?c=x").href !== "/explorar?c=x") F("9 · la vuelta de Flow no vuelve al mapa");
  if (deptoDeVolverExplorar("/explorar?c=x&a=abc&analizar=1") !== "abc" || deptoDeVolverExplorar("/dashboard?t=1&a=abc") !== null) F("9 · deptoDeVolverExplorar");
  // ⚠ ACTA (24-oct-2026, Explorar cerrado sin saldo) · sin saldo no se abre ni se analiza solo (cerrado); con saldo, como siempre.
  if (!/autoAnalizar=\{!d\.cerrado && sp\.get\("analizar"\) === "1" \? a : null\}/.test(codigo("src/app/explorar/page.tsx")) || !/if \(datos\.saldo\.tipo === "sin"\) setConfirmar\(\{ it, sin: true \}\);\s*else void analizar\(it\);/.test(cli)) F("9 · la vuelta pagada no analiza el depto sola");
  if (!/"\/dashboard\/:path\*", "\/explorar",/.test(leer("src/middleware.ts"))) F("9 · /explorar no pasa por el middleware (la sesión no se refresca)");

  if (fallas.length) {
    console.log(`  ✗ EXPLORAR · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — los filtros son el perfil y no lo tocan; solo Comprar, de a mil; explorar no gasta; sin saldo el mapa y el aviso E; el mapa después del primer pintado; la hoja, el pin y el pop-up con «Cambiar»; la medición y el botón del dashboard");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (23-oct-2026). CONTRA EL CÓDIGO DE HOY: en rojo mientras se construía (la píldora que contaba las tarjetas
// antes del mapa y el TOPE_HOJA desde el cliente fueron hallazgos del QA que el tier fijó después). Y 26 mutaciones, cada una
// restaurada byte a byte, todas ROJAS (scratchpad mutar-explorar.cjs): M1 un chip escribe el perfil · M2 el filtro muta el
// anterior · M3 la lib deja pasar Ajustar · M4 la API escribe · M5 sin paginar (limit) · M6 el SQL sin el filtro de Comprar ·
// M7 la ruta de la guía sin validar el pie · M8 analisis_creado sin via explorar · M9 el mapa depende del saldo · M10 el aviso
// E no se cierra · M11 sin «Ahora no» · M12 el mapa con SSR · M13 sin esperar la página quieta · M14 el servidor manda todos
// los pines · M15 la píldora cuenta las tarjetas · M16 «Revisado con…» sin el enlace · M17 los agrupados por latitud a secas ·
// M18 «Analizar igual» nunca · M19 la elección no viaja · M20 el recálculo sin validar el pie · M21 explorar_vista sin los
// pines · M22 el botón del dashboard sin el número · M23 la compra no vuelve al mapa · M24 /explorar fuera del middleware ·
// M25 la URL acepta un pie que la noche no evaluó · M26 TOPE_HOJA desde el cliente. Y el mapa quieto (medido en producción
// 9,7 s de LCP sin él, mutar-quieto.cjs): Q1 sin precarga · Q2 sin prioridad alta · Q3 se va al crear el mapa y no con las
// teselas · Q4 la foto pesada. 4/4 ROJO. Y el incrustado (como archivo precargado el LCP daba 2,5 s; mutar-quieto2.cjs): Q1'
// sin la precarga de escritorio · Q2'' el mapa quieto después del real · Q3' el incrustado entra al JS del cliente · Q4' el
// incrustado pesado · Q5' sin prioridad alta. 5/5 ROJO.
// CUALQUIER PIE Y PLAZO (24-oct-2026, mutar-combos.cjs): K1 el combo vale aunque la fila se reevaluó después · K2 vale para
// siempre · K3 lo calculado no se guarda · K4 se calcula todo, lo vigente también · K5 una combinación nueva pasa por la RPC de
// la noche · K6 la página calcula en el SSR · K7 el navegador no dice «Calculando…» · K8 los chips vuelven a las cuatro de la
// noche · K9 el perfil abre con el pie de la noche · K10 el cron toca combos · K11 lo pesado se pide para todos. 11/11 ROJO.

if (require.main === module) {
  runExplorarTier().then((r) => process.exit(r.hard ? 1 : 0));
}
