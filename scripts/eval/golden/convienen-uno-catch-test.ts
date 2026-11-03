// ============================================================================
// TIER CONVIENEN-UNO — «convienen» explicado y un solo número en todo el sitio (30-oct-2026, goal de Fabrizio).
//
//   1 · LA TASA DEL MOTOR: la de `config.tasa_hipotecaria` —la misma que leen la evaluación de la noche y todo pie o plazo
//       calculado—, leída por `tasaDelMotor` y bajada por la página con y sin cuenta. Nunca un número fijo: con otra tasa,
//       otro texto.
//   2 · LA HOJA «¿CÓMO SE CALCULA?» EXISTE CON Y SIN CUENTA, con un solo botón, «Entendido». Al abrirla,
//       `explorar_como_se_calcula`.
// ⚠ ACTA (30-oct-2026, goal del recorrido real de Fabrizio) · la línea bajo el número del mapa se retiró con la tarjeta del
// número: la tasa la dicen ahora «¿Cómo se calcula?» y Filtros («4,07 % · promedio de los bancos»). La hoja pasó de cuatro
// ideas a los tres párrafos del recorrido (el perfil estándar —pie, plazo y tasa, de la constante y del motor—, que se cambia
// en Filtros, y qué quiere decir el chip ✓ Comprar); sin la fecha de revisión de la tasa. §1 y §2 reescritos con su mutación.
//   3 · UN SOLO NÚMERO DE «CONVIENEN»: la landing, /explorar y su bienvenida, el botón «Explorar los N de Santiago» del
//       dashboard y la prueba de /deptos salen de `cuantosConvienen` sobre el universo de la vista global (`convienenHoy`);
//       ninguna lee el `convienen` del resumen de la noche (otro universo: 4.767 contra 4.770 el 30-oct-2026), y ningún
//       correo arma el suyo.
// ⚠ ACTA (02-nov-2026, goal de los cortes por statement_timeout, decisión de Fabrizio) · EL NÚMERO SE CUENTA DE NOCHE Y SE
// GUARDA: el cron de la evaluación lo cuenta con `cuantosConvienen` sobre el MISMO universo que dibuja el mapa
// (`universoDeLaNoche` con el pie y el plazo de la vista global) y lo guarda en `config` (`explorar_convienen_mapa`,
// `guardarConvienenMapa`); la landing y la portada de /deptos leen esa fila. `convienenHoy` se retiró: cada regeneración de
// la portada llamaba dos veces a explorar_mapa y, con la caché vencida, la revalidación se cortaba por timeout sin llegar a
// Sentry. Sin número guardado la landing sale sin cifra y lo reporta. /explorar sin cuenta cuenta el universo que dibuja, en
// UNA lectura (eran dos de la misma clave). Se acepta que la landing difiera en unos pocos deptos del mapa durante el día.
// §3 reescrito con su mutación (acta al pie).
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/convienen-uno-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";
import { COMUNAS_DISPONIBLES } from "../../../src/lib/comunas-disponibles";

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
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx?$/.test(n)) out.push(rel);
  }
  return out;
}

const G = po.FILTROS_GLOBALES;
const cuentaBase = () => ({
  analizados: {}, guardados: [], saldo: { tipo: "sin" }, suscrito: false, ticket: false, cuentaCreadaAt: null, finanzas: { uf: 39000, tasa: 4.07 },
  miBusqueda: null, busquedaActual: null, explorarEnMes: 0,
});
/** Un universo de prueba: pines con flujo negativo, sin flujo, viejos y de hoy (la vista global no filtra ninguno). */
const PINES: po.PinMapa[] = [
  { avisoId: "a1", comuna: "Santiago", lat: -33.44, lng: -70.65, m2: 50, dormitorios: 2, banos: 1, tipologia: "2D1B", precioUF: 3200, veredicto: "COMPRAR", score: 74, flujo: -24804, arriendo: 520000, alta: 1_700_000_000 },
  { avisoId: "a2", comuna: "Ñuñoa", lat: -33.45, lng: -70.6, m2: 60, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4100, veredicto: "COMPRAR", score: 81, flujo: 35000, arriendo: 650000, alta: Math.floor(Date.now() / 1000) - 3600 },
  { avisoId: "a3", comuna: "Macul", lat: -33.49, lng: -70.6, m2: 45, dormitorios: 1, banos: 1, tipologia: "1D1B", precioUF: 2600, veredicto: "COMPRAR", score: 70, flujo: null, arriendo: null, alta: null },
];

export async function runConvienenUnoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CONVIENEN-UNO (la tasa del motor, «¿Cómo se calcula?» con y sin cuenta, un solo número de «convienen» · 0 tokens) ───");

  // ── 1 · LA TASA DEL MOTOR ──
  // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · el perfil estándar va en tres viñetas (COMO_SE_CALCULA.perfil); la
  // tasa es la tercera. El texto exacto de la hoja lo fija EXPLORAR-PASADA §2; acá, que los números sean los del motor.
  const C = po.COMO_SE_CALCULA;
  if (!C.perfil(4.07)[2].includes("tasa de 4,07 %") || !C.perfil(5.3)[2].includes("tasa de 5,3 %") || /\d+,\d+ %/.test(C.perfil(null)[2])) F("1 · la hoja no dice la tasa que le llega (o, sin ella, inventa una)");
  if (po.PORTAL_COPY.tasaFija(4.07) !== "4,07 % · promedio de los bancos" || po.PORTAL_COPY.tasaFija(5.3) !== "5,3 % · promedio de los bancos") F("1 · Filtros no dice la tasa que le llega con «promedio de los bancos»");
  // Los números del perfil estándar salen de la constante del sitio, no escritos a mano.
  if (!/`pie de \$\{PIE_POR_DEFECTO\} %`,\s*`crédito a \$\{PLAZO_POR_DEFECTO\} años`,/.test(codigo("src/lib/explorar/portal.ts"))) F("1 · el pie o el plazo de la hoja no salen de la constante del financiamiento por defecto");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  // La tasa la lee el servidor de la misma fila que el motor, y la página la baja en las dos ramas.
  const cache = codigo("src/lib/explorar/portal-cache.ts");
  const delMotor = /\.from\("config"\)\.select\("value"\)\.eq\("key", "tasa_hipotecaria"\)\.maybeSingle\(\)/.test(cache);
  const motorNoche = /\.in\("key", \["uf_value", "tasa_hipotecaria"\]\)/.test(codigo("src/app/api/cron/evaluar-avisos/route.ts"));
  const motorCalculo = /\.in\("key", \["uf_value", "tasa_hipotecaria"\]\)/.test(codigo("src/lib/guia/guia-servidor.ts"));
  if (!delMotor || !motorNoche || !motorCalculo) F("1 · la tasa de la hoja y de Filtros no sale de la misma fila que lee el motor (config.tasa_hipotecaria)");
  const pag = codigo("src/app/explorar/page.tsx");
  const abierta = pag.slice(pag.indexOf("async function ExplorarAbierto"), pag.indexOf("async function ExplorarConDatos"));
  const conCuenta = pag.slice(pag.indexOf("async function ExplorarConDatos"));
  // ⚠ ACTA (03-nov-2026) · `inicial` lleva además los − Ajustar (nAjustar; sin cuenta, negociadosGlobal para la bienvenida).
  // ⚠ ACTA (03-nov-2026, «una sola caché, con una sola edad») · y el sello de la noche que contó esas cifras (EXPLORAR-PASADA §9).
  if (!/tasaDelMotor\(\),/.test(abierta) || !/tasaDelMotor\(\),/.test(conCuenta) || !/inicial=\{\{ filtros, orden, n, cuenta: null, tasa, convienen, negociadosGlobal, nAjustar, sello: noche\?\.sello \?\? null \}\}/.test(abierta) || !/inicial=\{\{ filtros, orden, n, cuenta, tasa, convienen: null, negociadosGlobal: null, nAjustar, sello: noche\?\.sello \?\? null \}\}/.test(conCuenta))
    F("1 · la página no baja la tasa del motor con y sin cuenta");
  // ⚠ ACTA (30-oct-2026, goal «la tasa editable en Filtros») · la hoja recibe además la tasa elegida (`elegida`).
  if (!/\{calculo && <HojaCalculo tasa=\{inicial\.tasa\} elegida=\{filtros\.tasa\} sinCuenta=\{sinCuenta\} alCerrar=\{\(\) => setCalculo\(false\)\} \/>\}/.test(cli) || !/<HojaFiltros\s+filtros=\{filtros\}\s+tasa=\{inicial\.tasa\}/.test(cli)) F("1 · la hoja o Filtros no reciben la tasa que bajó la página");
  // En el navegador, el enlace está con y sin cuenta.
  const modCli = (() => { try { return require(join(RAIZ, "src/app/explorar/explorar-cliente")) as { ExplorarCliente: FC<Record<string, unknown>> }; } catch (e) { F(`0 · no carga explorar-cliente: ${(e as Error).message}`); return null; } })();
  const pintar = (cuenta: unknown, tasa: po.TasaDelMotor | null) =>
    modCli ? dibujar(createElement(modCli.ExplorarCliente, { inicial: { filtros: G, orden: "puntaje", n: 3, cuenta, tasa, convienen: cuenta ? null : 3 } })) : "";
  for (const [cuenta, que] of [[cuentaBase(), "con cuenta"], [null, "sin cuenta"]] as const) {
    // (03-nov-2026) El botón trae antes la ⓘ del PC y la redonda del teléfono: el texto queda a menos de 200 caracteres.
    if (!/data-explorar="como-se-calcula"[^>]*>[\s\S]{0,200}¿Cómo se calcula\?/.test(pintar(cuenta, { tasa: 4.07 }))) F(`2 · ${que}, no hay «¿Cómo se calcula?» arriba`);
  }

  // ── 2 · LA HOJA «¿CÓMO SE CALCULA?», CON Y SIN CUENTA ──
  const modHoja = (() => { try { return require(join(RAIZ, "src/app/explorar/hoja-calculo")) as { HojaCalculo: FC<Record<string, unknown>> }; } catch (e) { F(`2 · no carga la hoja: ${(e as Error).message}`); return null; } })();
  if (modHoja) {
    for (const sinCuenta of [false, true]) {
      const h = dibujar(createElement(modHoja.HojaCalculo, { tasa: { tasa: 4.07 }, sinCuenta, alCerrar: () => {} }));
      // texto() deja un espacio donde cerraba un elemento en línea: se junta con su puntuación antes de comparar.
      const t = texto(h).replace(/ ([.,:])/g, "$1");
      const que = sinCuenta ? "sin cuenta" : "con cuenta";
      if (!/role="dialog"/.test(h) || !t.startsWith("¿Cómo se calcula?")) F(`2 · ${que}, la hoja no es un diálogo con su título`);
      // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar», el texto de Fabrizio) · cuatro párrafos —la noche y el perfil, dónde
      // se cambia, los dos chips del mapa y la metodología— y el perfil en tres viñetas; la regla del veredicto (la nota de 70, las
      // señales graves, «cada tarjeta te dice cuánto») salió de la hoja: vive en la metodología. El texto exacto, en EXPLORAR-PASADA §2.
      if ((h.match(/<p\b/g) ?? []).length !== 4 || (h.match(/<li\b/g) ?? []).length !== 3) F(`2 · ${que}, la hoja no lleva cuatro párrafos y el perfil en tres viñetas`);
      if ((h.match(/<button\b/g) ?? []).length !== 1 || !/data-explorar="calculo-ok"[^>]*>Entendido<\/button>/.test(h)) F(`2 · ${que}, la hoja no tiene un solo botón, «Entendido»`);
      if (!t.includes("Cada noche Franco revisa todos los deptos en venta de Santiago y calcula cuáles convienen al precio publicado, con un perfil de búsqueda estándar: pie de 20 % crédito a 30 años tasa de 4,07 %, el promedio mensual de los créditos hipotecarios según el Banco Central"))
        F(`2 · ${que}, el primer párrafo no es el pedido (la noche, el perfil estándar y la tasa del motor)`);
      const cambiar = sinCuenta ? "Puedes cambiar ese perfil en Filtros, registrándote gratis." : "Puedes cambiar ese perfil en Filtros.";
      if (!t.includes(cambiar) || !/<strong>Filtros<\/strong>/.test(h)) F(`2 · ${que}, no dice dónde se cambia el perfil (Filtros en negrita${sinCuenta ? ", registrándose" : ""})`);
      if (!/data-explorar="calculo-chips">En el mapa, los deptos que convienen al precio publicado llevan <span class="chip-v c"[^>]*data-veredicto="COMPRAR"/.test(h) || !/<span class="chip-v a"[^>]*data-veredicto="AJUSTA SUPUESTOS"/.test(h)) F(`2 · ${que}, el párrafo de los chips no lleva los chips ✓ Comprar y − Ajustar de siempre`);
      if (/revisa cada mañana|la última vez|25 años|señales graves|\b70\b/.test(t)) F(`2 · ${que}, la hoja trae la fecha de la tasa, los 25 años o la regla del veredicto`);
    }
    if (!texto(dibujar(createElement(modHoja.HojaCalculo, { tasa: { tasa: 5.3 }, sinCuenta: false, alCerrar: () => {} }))).includes("tasa de 5,3 %, el promedio")) F("2 · con otra tasa la hoja dice la misma");
  }
  // La monta el cliente sin depender de la cuenta, y al abrirla se mide.
  if (/(!sinCuenta|sinCuenta) &&[^\n]*<HojaCalculo/.test(cli)) F("2 · la hoja no se monta igual con y sin cuenta");
  if (po.EVENTOS_PORTAL.comoSeCalcula !== "explorar_como_se_calcula" || !/setCalculo\(true\);\s*posthog\?\.capture\(EVENTOS_PORTAL\.comoSeCalcula, \{ sin_cuenta: sinCuenta,/.test(cli)) F("3 · abrir la hoja no deja «explorar_como_se_calcula»");
  // La bienvenida no cambia (lo pide el goal): sus textos siguen.
  // ⚠ ACTA (02-nov-2026, goal «Filtros v2 y negociar», tier EXPLORAR-NEGOCIAR) · cambió solo para decir «al precio publicado» (lo pide ese goal).
  const ab = codigo("src/lib/explorar/abierto.ts");
  if (!/titulo: "Deptos en venta que convienen como inversión hoy, al precio publicado\.",/.test(ab) || !/boton: "Ver el mapa",/.test(ab)) F("2 · la bienvenida cambió");

  // ── 3 · UN SOLO NÚMERO DE «CONVIENEN» ──
  const u = po.compactar(PINES);
  if (po.cuantosConvienen(u) !== 3 || po.cuantosConvienen(po.compactar([])) !== null || po.cuantosConvienen(null) !== null) F("3 · cuantosConvienen no cuenta el universo (o inventa un cero)");
  // El número del mapa en la vista global es el mismo: la vista global no filtra nada.
  if (po.filtrar(po.descompactar(u), G).length !== po.cuantosConvienen(u)) F("3 · el número del mapa en la vista global no es el de cuantosConvienen");
  // ⚠ ACTA (02-nov-2026) · el número lo cuenta el cron con el universo del mapa y lo guarda (guardarConvienenMapa); las
  // pantallas leen lo guardado. Se prueba sobre la función, con una base falsa: qué pide, qué escribe y cuándo no escribe.
  const modCache = (() => { try { return require(join(RAIZ, "src/lib/explorar/convienen-guardado")) as typeof import("../../../src/lib/explorar/convienen-guardado"); } catch (e) { F(`3 · no carga convienen-guardado: ${(e as Error).message}`); return null; } })();
  if (modCache) {
    // La clave es la que siembra la migración del 02-nov-2026.
    if (modCache.CLAVE_CONVIENEN_MAPA !== "explorar_convienen_mapa" || !leer("supabase/migrations/20261102_planes_a_medida.sql").includes(`select '${modCache.CLAVE_CONVIENEN_MAPA}',`)) F("3 · la clave del número guardado no es la que siembra la migración");
    if (modCache.convienenMapaGuardado(JSON.stringify({ convienenMapa: 6698, calculadoAt: "2026-11-02T04:31:00Z" })) !== 6698
      || modCache.convienenMapaGuardado(JSON.stringify({ convienenMapa: 0 })) !== null || modCache.convienenMapaGuardado("no-json") !== null || modCache.convienenMapaGuardado(null) !== null)
      F("3 · el número guardado se lee mal (o un cero o un valor roto se leen como número)");
    const fila = (id: string) => [id, "Santiago", -33.44, -70.65, 50, 2, 1, 3200, 74, -24804, 520000, "usado", 1_700_000_000];
    const falsa = (rpc: { data: unknown; error: unknown }) => {
      const pedidos: Array<Record<string, unknown>> = [];
      const escritos: Array<Record<string, unknown>> = [];
      const admin = {
        rpc: async (n: string, a: Record<string, unknown>) => { pedidos.push({ n, ...a }); return rpc; },
        from: (t: string) => ({ upsert: async (v: Record<string, unknown>) => { escritos.push({ t, ...v }); return { error: null }; } }),
      };
      return { admin, pedidos, escritos };
    };
    const ok = falsa({ data: [fila("a1"), fila("a2"), fila("a3")], error: null });
    const nOk = await modCache.guardarConvienenMapa(ok.admin as never, new Date("2026-11-02T04:30:00Z"));
    const p0 = ok.pedidos[0] as { n?: string; comunas?: string[]; pie?: number; plazo?: number } | undefined;
    const e0 = ok.escritos[0] as { t?: string; key?: string; value?: string } | undefined;
    if (nOk !== 3 || p0?.n !== "explorar_mapa" || p0.pie !== G.pie || p0.plazo !== G.plazo || p0.comunas?.length !== COMUNAS_DISPONIBLES.length)
      F(`3 · el cron no cuenta el universo del mapa de la vista global (${JSON.stringify({ nOk, p0: p0 && { ...p0, comunas: p0.comunas?.length } })})`);
    if (e0?.t !== "config" || e0.key !== modCache.CLAVE_CONVIENEN_MAPA || modCache.convienenMapaGuardado(e0.value) !== 3) F("3 · el cron no guarda en config el número que contó");
    for (const [rpc, que] of [[{ data: null, error: { message: "canceling statement due to statement timeout", code: "57014" } }, "la consulta falla"], [{ data: [], error: null }, "el mapa sale vacío"]] as const) {
      const f = falsa(rpc);
      if ((await modCache.guardarConvienenMapa(f.admin as never)) !== null || f.escritos.length) F(`3 · si ${que}, se pisa el número guardado`);
    }
    // La portada lee lo guardado; sin fila, null (la frase sale sin cifra).
    const lectura = (value: string | null) => ({
      from: (t: string) => ({ select: () => ({ eq: (c: string, k: string) => ({ maybeSingle: async () => ({ data: value != null && t === "config" && c === "key" && k === modCache.CLAVE_CONVIENEN_MAPA ? { value } : null, error: null }) }) }) }),
    });
    if ((await modCache.leerConvienenMapa(lectura(JSON.stringify({ convienenMapa: 6698 })) as never)) !== 6698 || (await modCache.leerConvienenMapa(lectura(null) as never)) !== null) F("3 · la portada no lee el número guardado");
  }
  if (!/const convienenMapa = dry \? null : await guardarConvienenMapa\(sb\)/.test(codigo("src/app/api/cron/evaluar-avisos/route.ts"))) F("3 · el cron de la evaluación no guarda el número del mapa");
  // Sin número guardado la falta queda en Sentry (en la landing y en la portada).
  if (!/if \(n == null && !error\) captureApiWarning\(/.test(codigo("src/lib/explorar/convienen-guardado.ts"))) F("3 · sin número guardado, la portada no lo reporta");
  const vivo = codigo("src/lib/landing-vivo.ts");
  // La landing lee las dos filas de la noche en un pedido, el número de la del mapa, y sin él lo reporta. No calcula el universo.
  if (!/\.from\("config"\)\.select\("key, value"\)\.in\("key", \[CLAVE_RESUMEN_NOCHE, CLAVE_CONVIENEN_MAPA\]\)/.test(vivo)
    || !/const convienen = convienenMapaGuardado\(valor\(CLAVE_CONVIENEN_MAPA\)\);\s*if \(convienen == null\) aviso\("convienen", /.test(vivo)
    || !/convienen: noche\.convienen,/.test(vivo)) F("3 · el título de la landing no sale del número del mapa guardado (o su falta no se reporta)");
  if (/universoDeLaNoche|descompactar|cuantosConvienen|explorar_mapa/.test(vivo)) F("3 · la landing calcula el universo para decir el número");
  const por = codigo("src/lib/deptos/portada.ts");
  if (!/const \[resumen, convienen\] = await Promise\.all\(\[resumenDeLaNoche\(admin\), leerConvienenMapa\(admin\)\]\);\s*return resumen \? \{ revisados: resumen\.revisados, convienen \} : null;/.test(por)
    || (por.match(/nocheDeptos\(admin\)/g) ?? []).length !== 2 || /resumen\.convienen|noche\.convienen/.test(por)) F("3 · la portada de /deptos no toma «convienen» del número del mapa guardado");
  const retirado = archivos("src").filter((f) => /\bconvienenHoy\b/.test(codigo(f)));
  if (retirado.length) F(`3 · vuelve convienenHoy (el número contado en cada pantalla): ${retirado.join(", ")}`);
  if (!/const totalNoche = portada\.noche\?\.convienen \?\? null;/.test(codigo("src/app/dashboard/page.tsx"))) F("3 · el botón del dashboard no lee el número de la portada");
  if (!/const totalNoche = portada\?\.noche\?\.convienen \?\? null;/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("3 · «Estás dentro» no lee el número de la portada");
  if (!/DEPTOS_COPY\.prueba\(portada\?\.noche\?\.revisados \?\? null, portada\?\.noche\?\.convienen \?\? null\)/.test(codigo("src/app/deptos/deptos-cliente.tsx"))) F("3 · la prueba de /deptos no lee el número de la portada");
  // La bienvenida cuenta el universo que el mapa abierto dibuja, en UNA lectura de la caché (eran dos de la misma clave).
  // ⚠ ACTA (02-nov-2026, goal «Compartir un depto desde Explorar») · el Promise.all lee además el depto del enlace compartido
  // (`compartido`), así que el predicado ya no fija la lista entera: exige que `noche` sea la primera lectura y que haya UNA
  // sola llamada a universoDeLaNocheCacheado en ExplorarAbierto —la regla—, que antes solo se seguía de la forma exacta.
  // ⚠ ACTA (03-nov-2026, goal «la pasada real de /explorar») · el Promise.all lee además la capa de los − Ajustar (`capa`, para
  // la línea aparte de la bienvenida): `noche` sigue siendo la primera lectura y la única del universo.
  // ⚠ ACTA (03-nov-2026, «una sola caché, con una sola edad») · la noche se lee con nocheExplorar (el universo y la capa juntos, por
  // sello) y la cuenta cifrasDeLaNoche (cifras-noche.ts): «convienen» es cuantosConvienen del universo de esa noche, y la del mapa
  // solo si los filtros son de la noche. La regla de una sola lectura sigue: UNA llamada, la primera del Promise.all.
  const cifrasSrc = codigo("src/lib/explorar/cifras-noche.ts");
  if (!/const \[noche(?:, \w+)*\] = await Promise\.all\(\[\s*nocheExplorar\(PIE_ABIERTO, PLAZO_ABIERTO\)\.catch\(\(\) => null\),/.test(abierta)
    || (abierta.match(/nocheExplorar\(/g) ?? []).length !== 1
    || !/const deLaNoche = !!noche && universoDeLaNoche\(filtros\);/.test(cifrasSrc) || !/convienen: noche \? cuantosConvienen\(noche\.universo\) : null,/.test(cifrasSrc)
    || !/const \{ n, convienen, negociadosGlobal, nAjustar \} = cifrasDeLaNoche\(noche, filtros\);/.test(abierta)
    || !/<Bienvenida n=\{inicial\.convienen \?\? inicial\.n \?\? total\}/.test(cli)) F("3 · la bienvenida de /explorar no dice el número de todo el sitio");
  if ((abierta.match(/nocheExplorar\(|universoDeLaNoche\w+\(|negociabl\w*\(/g) ?? []).length !== 1) F("3 · /explorar sin cuenta lee el universo más de una vez");
  // Nadie más lee el «convienen» del resumen de la noche ni arma un total propio (los correos tampoco).
  const resumenConvienen = archivos("src").filter((f) => f !== "src/lib/deptos/servidor.ts").filter((f) => {
    const s = codigo(f);
    return /resumenGuardado\([^)]*\)\??\.convienen|resumenDeLaNoche\([^)]*\)\)?\??\.convienen|deptos_resumen_noche/.test(s);
  });
  if (resumenConvienen.length) F(`3 · leen el «convienen» del resumen de la noche: ${resumenConvienen.join(", ")}`);
  // ⚠ ACTA (03-nov-2026, «una sola caché, con una sola edad») · la lectura de la noche ahora es nocheExplorar (portal-cache.ts):
  // los dos barridos la buscan a ella además del nombre viejo, y la cuenta de la página vive en cifras-noche.ts.
  const correos = archivos("src/lib/email").concat(archivos("src/lib/guia")).filter((f) => /convienenHoy|resumenDeLaNoche|universoDeLaNocheCacheado|nocheExplorar|deptos_conteo/.test(codigo(f)));
  if (correos.length) F(`3 · un correo arma su propio total de «convienen»: ${correos.join(", ")}`);
  const otrosConteos = archivos("src").filter((f) => !/src\/lib\/explorar\/(portal(-cache)?|cifras-noche)\.ts$/.test(f) && /(?:universoDeLaNocheCacheado|nocheExplorar)\([^)]*\)\s*\.then\(\((?:u|n|noche)\) => [^\n]*\.length/.test(codigo(f)));
  if (otrosConteos.length) F(`3 · cuentan el universo sin cuantosConvienen: ${otrosConteos.join(", ")}`);

  if (fallas.length) {
    console.log(`  ✗ CONVIENEN-UNO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — «¿Cómo se calcula?» y Filtros dicen la tasa del motor, la hoja del recorrido abre igual con y sin cuenta y se mide, y la landing, /explorar, la bienvenida, el dashboard y /deptos dicen un solo número de «convienen»");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runConvienenUnoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (30-oct-2026) ──
// 25 de 25 en ROJO (runner `mutar-convienen.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte):
// la línea con una tasa fija en el componente o en el texto, la tasa de otra fila de config, sin cuenta sin tasa, una tasa
// inventada cuando falta; la hoja o «¿Cómo se calcula?» solo con cuenta, con tres ideas, con dos botones, «conviene» sin
// «mucha», sin cuenta prometiendo la cifra borrosa, sin la fecha de la tasa, sin el aviso de poner plata; otro evento u otro
// nombre; la portada leyendo el resumen, el dashboard con un número propio, la landing contando los pines o leyendo el
// «convienen» del resumen, la bienvenida con el número filtrado, convienenHoy de otro universo, cuantosConvienen con un
// cero, un correo que arma su total, la prueba de /deptos y «Estás dentro» sin el número de la portada.

// ── ACTA DE MUTACIONES (30-oct-2026, goal del recorrido real) ──
// §1 y §2 reescritos: 13 de 13 en ROJO (runner `mutar-recorrido.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte): C1 la tasa de la hoja a mano · C2 la tasa de otra fila de config · C3 sin
// cuenta no dice «registrándote» · C4 Filtros sin negrita · C5 el chip escrito a mano · C6 sin cuenta promete la cifra · C7 un
// cuarto párrafo · C8 dos botones · C9 la hoja solo con cuenta · C10 Filtros sin la tasa de la página · C11 el pie y el plazo
// de la hoja a mano · C12 la tasa de Filtros a mano · C13 la hoja vuelve a decir la fecha de la tasa.

// ACTA DE MUTACIÓN (30-oct-2026, goal «la tasa editable en Filtros»): X3 —la hoja sin la tasa elegida—, en ROJO (runner `mutar-tasa.cjs` en el scratchpad de la sesión cb466df3; cada archivo restaurado byte a byte).

// ── ACTA DE MUTACIONES (02-nov-2026, goal de los cortes por statement_timeout) ──
// §3 reescrito (el número guardado de noche): 16 de 16 en ROJO (runner `mutar-convienen-guardado.cjs` en el scratchpad de la
// sesión b526f69b; cada archivo restaurado byte a byte, con hash). En CONVIENEN-UNO: M1 la landing lee el convienen del
// resumen · M2 la landing no reporta la falta · M3 la landing devuelve null · M4 la landing llama a explorar_mapa · M5 la
// portada lee el convienen del resumen · M6 el cron no guarda el número · M7 el cron cuenta otro universo (pie 30, 25 años) ·
// M8 escribe con el mapa vacío · M9 escribe aunque la consulta falle · M10 un cero guardado se lee como número · M11 otra
// clave que la de la migración · M12 la portada no reporta la falta · M13 /explorar sin cuenta lee el universo dos veces ·
// M14 vuelve convienenHoy · M15 la portada lee otra fila. M1 y M3 también en LANDING-MAPA §2, M1 y M7 en PUERTA-E §1, y M16
// —lo revisado no sale del resumen— en LANDING-MAPA §2.

// ── ACTA DE MUTACIONES (02-nov-2026, goal «Compartir un depto desde Explorar») ──
// §3, el predicado de la bienvenida reescrito (el Promise.all de ExplorarAbierto lee además el depto compartido): 3 de 3 en
// ROJO (runner `mutar-compartir.cjs` en el scratchpad de la sesión 1243824f; cada archivo restaurado byte a byte): Y1 una
// segunda lectura del universo dentro del Promise.all (la forma de antes la dejaba pasar si la lista empezaba con `noche`) ·
// Y2 la noche no es la primera lectura · Y3 el mapa lee el universo aparte, fuera del Promise.all.
