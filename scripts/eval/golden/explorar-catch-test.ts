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
  if (!f2 || f2.pie !== 30 || f2.plazo !== 30 || f2.ufMin !== 0 || JSON.stringify(f2.tipologias) !== '["1","2","4"]' || f2.comunas.length !== 2) F(`1 · pie 30 / plazo 30 / piso inferido / tipologías: ${JSON.stringify(f2)}`);
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 25, plazoAnios: 20 })?.plazo !== 25) F("1 · plazo 20 no cae a los 25 de la noche");
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: 25, plazoAnios: 20 })?.pie !== 20) F("1 · pie 25 no cae a los 20 de la noche");
  if (ex.filtrosDePerfil({ comunas: [], dormitorios: [2], precioMinUf: null, precioMaxUf: 4000, piePct: null, plazoAnios: null }) !== null) F("1 · sin comuna el perfil igual abre");
  if (ex.filtrosDePerfil({ comunas: ["Santiago"], dormitorios: [2], precioMinUf: null, precioMaxUf: null, piePct: null, plazoAnios: null }) !== null) F("1 · sin tope el perfil igual abre");
  const g = ex.cambiarFiltro(F0, { pie: 30 });
  if (F0.pie !== 20 || g.pie !== 30 || g === F0) F("1 · cambiar un chip muta el filtro anterior o no da uno nuevo");
  if (ex.cambiarFiltro(F0, { comunas: ["Marte"] }) !== F0) F("1 · un cambio inválido no deja el filtro como estaba");
  const ida = ex.urlDeFiltros(g);
  if (ida !== "c=Providencia&t=2&r=3000-4000&p=30&z=25") F(`1 · la URL de los filtros: ${ida}`);
  if (JSON.stringify(ex.filtrosDeUrl(new URLSearchParams(ida))) !== JSON.stringify(g)) F("1 · la URL no vuelve al mismo filtro");
  if (ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=25&z=25")) !== null) F("1 · un pie que la noche no evaluó pasa por la URL");
  if (ex.filtrosDeUrl(new URLSearchParams("c=Providencia&t=2&r=3000-4000&p=20&z=20")) !== null) F("1 · un plazo que la noche no evaluó pasa por la URL");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  if ((cli.match(/\/api\/perfil-busqueda/g) ?? []).length !== 1 || !/if \(eleccion\?\.guardarPerfil\) \{\s*await fetch\("\/api\/perfil-busqueda", \{ method: "PUT"/.test(cli)) F("1 · la página escribe el perfil fuera de la casilla del pop-up (o no la honra)");
  if (!/function aplicar\(parche: Partial<FiltrosExplorar>, chip: Chip\) \{\s*const f = cambiarFiltro\(filtros, parche\);[\s\S]{0,600}void cargar\(f, true\)/.test(cli)) F("1 · cambiar un chip no es un filtro nuevo leído de /api/explorar");
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
  if (!/const entrada = estadoDeEntrada\(inicial\.saldo\);\s*const \[avisoSinSaldo, setAvisoSinSaldo\] = useState\(entrada\.aviso\);/.test(cli)) F("4 · el aviso E no sale del estado de entrada");
  if (!/\{mapaListo && mapa !== "fallo" && \(\s*<MapaExplorar/.test(cli) || /saldo[^\n]{0,40}<MapaExplorar|<MapaExplorar[^\n]{0,200}saldo/.test(cli)) F("4 · el mapa depende del saldo (sin saldo tiene que verse igual)");
  if (!/\{avisoSinSaldo && !confirmar && \(\s*<AvisoSinSaldoExplorar/.test(cli) || !/alCerrar=\{\(\) => setAvisoSinSaldo\(false\)\}/.test(cli)) F("4 · el aviso E no se monta sin saldo, o «Ahora no» no lo cierra");
  try {
    const { AvisoSinSaldoExplorar } = require(join(RAIZ, "src/app/explorar/aviso-sin-saldo")) as typeof import("../../../src/app/explorar/aviso-sin-saldo");
    const compras = comprasDeExplorar({ filtros: "c=Providencia", ticket: true });
    const html = dibujar(createElement(AvisoSinSaldoExplorar as unknown as FC<Record<string, unknown>>, { n: 312, compras, vence: "mañana 11:17", alCerrar() {}, alIr() {} }));
    for (const t of ["Para explorar los 312 necesitas análisis disponibles.", ex.AVISO_SIN_SALDO.cuerpo, "Solo para cuentas nuevas", "Vence mañana 11:17", "Comprar solo 1", "Ver el plan de 20 al mes", "Ahora no"]) {
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
  if (!/pines: d\.pines\.slice\(0, TOPE_HOJA\), completo: d\.n <= TOPE_HOJA/.test(codigo("src/app/explorar/page.tsx"))) F("5 · el servidor manda todos los pines al primer pintado (o no dice si están completos)");
  // La constante vive en la lib pura: desde un módulo "use client" llegaría al servidor como referencia (23-oct-2026).
  if (!/import \{ EXPLORAR_COPY, filtrosDeUrl, MAPA_QUIETO, TOPE_HOJA \} from "@\/lib\/explorar\/explorar";/.test(codigo("src/app/explorar/page.tsx")) || ex.TOPE_HOJA !== 24 || /export const TOPE_HOJA/.test(cli)) F("5 · TOPE_HOJA no sale de la lib pura (en el servidor una constante de un módulo \"use client\" es una referencia)");
  if (!/if \(!inicial\.completo\) void cargar\(inicial\.filtros, false\);/.test(cli)) F("5 · el resto de los pines no llega con el mapa");
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
  if (!/mapaQuieto=\{\s*<picture className="ex-mapa-quieto" data-explorar="mapa-quieto">\s*<source media="\(min-width: 768px\)" srcSet=\{MAPA_QUIETO\.d\} \/>[\s\S]{0,120}<img src=\{MAPA_QUIETO_M\} alt="" width=\{560\} height=\{650\} fetchPriority="high"/.test(pag)) F("5 · la página no dibuja el mapa quieto (teléfono incrustado, escritorio archivo) con prioridad alta");
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
  if (!/void capturarServidor\(eventoExplorarVista\(\{ userId: user\.id, filtros, n: d\.n, analizados: analizadosN, fuente: "pagina" \}\)\)/.test(codigo("src/app/explorar/page.tsx"))) F("8 · la página no deja «explorar_vista»");
  if (!/if \(sp\.get\("evento"\) === "1"\) \{[\s\S]{0,300}eventoExplorarVista\(\{ userId: user\.id, filtros, n: d\.n, analizados, fuente: "cambio" \}\)/.test(codigo("src/app/api/explorar/route.ts")) || !/\$\{evento \? "&evento=1" : ""\}/.test(cli)) F("8 · cambiar un chip no deja «explorar_vista»");
  if (textoOrigenArchivo("explorar") !== "Desde Explorar" || origenDeInforme({ avisoId: "x", desde: "explorar" }, new Set()) !== "explorar") F("8 · el archivo no dice «Desde Explorar»");

  // ── 9 · el dashboard y las compras ──
  if (CASA.explorar.boton(312) !== "Explorar los 312 en el mapa" || CASA.explorar.boton(0) !== "Explorar en el mapa" || CASA.explorar.boton(1200) !== "Explorar los 1.200 en el mapa") F("9 · el botón del dashboard");
  const dash = codigo("src/app/dashboard/page.tsx");
  if ((dash.match(/<ExplorarEnCasa datos=\{explorar\} \/>/g) ?? []).length !== 2 || !/datosExplorarCasa\(admin, user\.id\)/.test(dash)) F("9 · el dashboard (las dos casas) no lleva el botón a Explorar con su número");
  const enCasa = codigo("src/app/dashboard/explorar-en-casa.tsx");
  if (!/<EnlaceCarga href="\/explorar"[^\n]*data-casa="explorar-boton"[^\n]*>\s*\{CASA\.explorar\.boton\(datos\.n\)\}/.test(enCasa) || !/conteoExplorar\(admin, filtros\)/.test(enCasa)) F("9 · el botón no va a /explorar o no cuenta con la misma RPC");
  const c = comprasDeExplorar({ filtros: "c=Providencia&t=2", avisoId: "abc", ticket: false });
  if (!/origen=explorar/.test(c.pack.href) || !/volver=%2Fexplorar%3Fc%3DProvidencia%26t%3D2%26a%3Dabc%26analizar%3D1/.test(c.pack.href) || !/product=single/.test(c.suelto.href) || !/origen=explorar/.test(c.suelto.href)) F(`9 · las compras no vuelven al mapa con el depto: ${c.pack.href} · ${c.suelto.href}`);
  if (!/product=pack3/.test(comprasDeExplorar({ filtros: "c=x", ticket: true }).pack.href) || comprasDeExplorar({ filtros: "c=x", ticket: true }).pack.label !== "3 análisis · $14.990") F("9 · con el ticket el pack no es el de $14.990");
  if (botonTrasPagar("/explorar?c=x&a=abc&analizar=1").texto !== "Volver al mapa" || botonTrasPagar("/explorar?c=x").href !== "/explorar?c=x") F("9 · la vuelta de Flow no vuelve al mapa");
  if (deptoDeVolverExplorar("/explorar?c=x&a=abc&analizar=1") !== "abc" || deptoDeVolverExplorar("/dashboard?t=1&a=abc") !== null) F("9 · deptoDeVolverExplorar");
  if (!/autoAnalizar=\{sp\.get\("analizar"\) === "1" \? a : null\}/.test(codigo("src/app/explorar/page.tsx")) || !/if \(datos\.saldo\.tipo === "sin"\) setConfirmar\(\{ it, sin: true \}\);\s*else void analizar\(it\);/.test(cli)) F("9 · la vuelta pagada no analiza el depto sola");
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

if (require.main === module) {
  runExplorarTier().then((r) => process.exit(r.hard ? 1 : 0));
}
