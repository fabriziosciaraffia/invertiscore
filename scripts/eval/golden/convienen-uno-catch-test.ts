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
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/convienen-uno-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";

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
  const C = po.COMO_SE_CALCULA;
  if (!C.estandar(4.07).includes("tasa de 4,07 %") || !C.estandar(5.3).includes("tasa de 5,3 %") || /\d+,\d+ %/.test(C.estandar(null))) F("1 · la hoja no dice la tasa que le llega (o, sin ella, inventa una)");
  if (po.PORTAL_COPY.tasaFija(4.07) !== "4,07 % · promedio de los bancos" || po.PORTAL_COPY.tasaFija(5.3) !== "5,3 % · promedio de los bancos") F("1 · Filtros no dice la tasa que le llega con «promedio de los bancos»");
  // Los números del perfil estándar salen de la constante del sitio, no escritos a mano.
  if (!/pie de \$\{PIE_POR_DEFECTO\} %, crédito a \$\{PLAZO_POR_DEFECTO\} años y \$\{/.test(codigo("src/lib/explorar/portal.ts"))) F("1 · el pie o el plazo de la hoja no salen de la constante del financiamiento por defecto");
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
  if (!/tasaDelMotor\(\),/.test(abierta) || !/tasaDelMotor\(\),/.test(conCuenta) || !/inicial=\{\{ filtros, orden, n, cuenta: null, tasa, convienen \}\}/.test(abierta) || !/inicial=\{\{ filtros, orden, n, cuenta, tasa, convienen: null \}\}/.test(conCuenta))
    F("1 · la página no baja la tasa del motor con y sin cuenta");
  // ⚠ ACTA (30-oct-2026, goal «la tasa editable en Filtros») · la hoja recibe además la tasa elegida (`elegida`).
  if (!/\{calculo && <HojaCalculo tasa=\{inicial\.tasa\} elegida=\{filtros\.tasa\} sinCuenta=\{sinCuenta\} alCerrar=\{\(\) => setCalculo\(false\)\} \/>\}/.test(cli) || !/<HojaFiltros\s+filtros=\{filtros\}\s+tasa=\{inicial\.tasa\}/.test(cli)) F("1 · la hoja o Filtros no reciben la tasa que bajó la página");
  // En el navegador, el enlace está con y sin cuenta.
  const modCli = (() => { try { return require(join(RAIZ, "src/app/explorar/explorar-cliente")) as { ExplorarCliente: FC<Record<string, unknown>> }; } catch (e) { F(`0 · no carga explorar-cliente: ${(e as Error).message}`); return null; } })();
  const pintar = (cuenta: unknown, tasa: po.TasaDelMotor | null) =>
    modCli ? dibujar(createElement(modCli.ExplorarCliente, { inicial: { filtros: G, orden: "puntaje", n: 3, cuenta, tasa, convienen: cuenta ? null : 3 } })) : "";
  for (const [cuenta, que] of [[cuentaBase(), "con cuenta"], [null, "sin cuenta"]] as const) {
    if (!/data-explorar="como-se-calcula"[^>]*>[\s\S]{0,120}¿Cómo se calcula\?/.test(pintar(cuenta, { tasa: 4.07 }))) F(`2 · ${que}, no hay «¿Cómo se calcula?» arriba`);
  }

  // ── 2 · LA HOJA «¿CÓMO SE CALCULA?», CON Y SIN CUENTA ──
  const modHoja = (() => { try { return require(join(RAIZ, "src/app/explorar/hoja-calculo")) as { HojaCalculo: FC<Record<string, unknown>> }; } catch (e) { F(`2 · no carga la hoja: ${(e as Error).message}`); return null; } })();
  if (modHoja) {
    for (const sinCuenta of [false, true]) {
      const h = dibujar(createElement(modHoja.HojaCalculo, { tasa: { tasa: 4.07 }, sinCuenta, alCerrar: () => {} }));
      const t = texto(h);
      const que = sinCuenta ? "sin cuenta" : "con cuenta";
      if (!/role="dialog"/.test(h) || !t.startsWith("¿Cómo se calcula?")) F(`2 · ${que}, la hoja no es un diálogo con su título`);
      if ((h.match(/<p\b/g) ?? []).length !== 3) F(`2 · ${que}, la hoja no lleva tres párrafos`);
      if ((h.match(/<button\b/g) ?? []).length !== 1 || !/data-explorar="calculo-ok"[^>]*>Entendido<\/button>/.test(h)) F(`2 · ${que}, la hoja no tiene un solo botón, «Entendido»`);
      if (!t.includes("Cada noche Franco revisa los deptos en venta de Santiago y calcula cuáles convienen con un perfil de búsqueda estándar: pie de 20 %, crédito a 30 años y tasa de 4,07 %, el promedio de los créditos hipotecarios según el Banco Central."))
        F(`2 · ${que}, el primer párrafo no es el del recorrido (la noche, el perfil estándar y la tasa del motor)`);
      const cambiar = sinCuenta ? "Puedes cambiar ese perfil en Filtros, registrándote gratis con tu correo." : "Puedes cambiar ese perfil en Filtros.";
      // texto() deja un espacio donde cerraba el <strong>: se junta con su puntuación antes de comparar.
      if (!t.replace(/ ([.,])/g, "$1").includes(cambiar) || !/<strong>Filtros<\/strong>/.test(h)) F(`2 · ${que}, no dice dónde se cambia el perfil (Filtros en negrita${sinCuenta ? ", registrándose" : ""})`);
      const cuanto = sinCuenta ? "con tu cuenta gratis, cada tarjeta te dice cuánto." : "cada tarjeta te dice cuánto.";
      if (!t.includes(`Un depto lleva ✓ Comprar cuando su nota de 1 a 100 llega a 70, o cuando el arriendo lo paga solo sin estar caro para su zona. Y nunca tiene señales graves, como perder mucha plata todos los meses. Algunos te piden poner un poco cada mes: ${cuanto}`))
        F(`2 · ${que}, el párrafo del chip no es el del recorrido (o promete una cifra que sin cuenta va borrosa)`);
      if (!/data-explorar="calculo-conviene">Un depto lleva <span class="chip-v c"[^>]*data-veredicto="COMPRAR"/.test(h)) F(`2 · ${que}, «Un depto lleva» no lleva el chip ✓ Comprar de siempre`);
      if (/revisa cada mañana|la última vez|25 años/.test(t)) F(`2 · ${que}, la hoja trae la fecha de la tasa o los 25 años`);
    }
    if (!texto(dibujar(createElement(modHoja.HojaCalculo, { tasa: { tasa: 5.3 }, sinCuenta: false, alCerrar: () => {} }))).includes("tasa de 5,3 %, el promedio")) F("2 · con otra tasa la hoja dice la misma");
  }
  // La monta el cliente sin depender de la cuenta, y al abrirla se mide.
  if (/(!sinCuenta|sinCuenta) &&[^\n]*<HojaCalculo/.test(cli)) F("2 · la hoja no se monta igual con y sin cuenta");
  if (po.EVENTOS_PORTAL.comoSeCalcula !== "explorar_como_se_calcula" || !/setCalculo\(true\);\s*posthog\?\.capture\(EVENTOS_PORTAL\.comoSeCalcula, \{ sin_cuenta: sinCuenta,/.test(cli)) F("3 · abrir la hoja no deja «explorar_como_se_calcula»");
  // La bienvenida no cambia (lo pide el goal): sus textos siguen.
  const ab = codigo("src/lib/explorar/abierto.ts");
  if (!/titulo: "Deptos en venta que convienen como inversión hoy\.",/.test(ab) || !/boton: "Ver el mapa",/.test(ab)) F("2 · la bienvenida cambió");

  // ── 3 · UN SOLO NÚMERO DE «CONVIENEN» ──
  const u = po.compactar(PINES);
  if (po.cuantosConvienen(u) !== 3 || po.cuantosConvienen(po.compactar([])) !== null || po.cuantosConvienen(null) !== null) F("3 · cuantosConvienen no cuenta el universo (o inventa un cero)");
  // El número del mapa en la vista global es el mismo: la vista global no filtra nada.
  if (po.filtrar(po.descompactar(u), G).length !== po.cuantosConvienen(u)) F("3 · el número del mapa en la vista global no es el de cuantosConvienen");
  if (!/return cuantosConvienen\(await universoDeLaNocheCacheado\(FILTROS_GLOBALES\.pie, FILTROS_GLOBALES\.plazo\)\);/.test(cache)) F("3 · convienenHoy no cuenta el universo del mapa de la vista global");
  // Cada superficie, de esa función.
  const vivo = codigo("src/lib/landing-vivo.ts");
  // ⚠ ACTA (30-oct-2026, el hero limpio de 7c-landing-limpia) · sin el mapa del hero la landing no necesita el universo: lee el
  // número directo de convienenHoy, como /deptos y la bienvenida.
  if (!/convienenHoy\(\)\.then\(\(n\) => \{ if \(n == null\) aviso\("convienen", new Error\("sin el universo de la noche"\)\); return n; \}\),/.test(vivo) || /universoDeLaNocheCacheado|descompactar/.test(vivo)) F("3 · el título de la landing no sale de convienenHoy (cuantosConvienen)");
  const por = codigo("src/lib/deptos/portada.ts");
  if (!/const \[resumen, convienen\] = await Promise\.all\(\[resumenDeLaNoche\(admin\), convienenHoy\(\)\]\);\s*return resumen \? \{ revisados: resumen\.revisados, convienen \} : null;/.test(por)
    || (por.match(/nocheDeptos\(admin\)/g) ?? []).length !== 2 || /resumen\.convienen|noche\.convienen/.test(por)) F("3 · la portada de /deptos no toma «convienen» de convienenHoy");
  if (!/const totalNoche = portada\.noche\?\.convienen \?\? null;/.test(codigo("src/app/dashboard/page.tsx"))) F("3 · el botón del dashboard no lee el número de la portada");
  if (!/const totalNoche = portada\?\.noche\?\.convienen \?\? null;/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("3 · «Estás dentro» no lee el número de la portada");
  if (!/DEPTOS_COPY\.prueba\(portada\?\.noche\?\.revisados \?\? null, portada\?\.noche\?\.convienen \?\? null\)/.test(codigo("src/app/deptos/deptos-cliente.tsx"))) F("3 · la prueba de /deptos no lee el número de la portada");
  if (!/convienenHoy\(\),/.test(abierta) || !/<Bienvenida n=\{inicial\.convienen \?\? inicial\.n \?\? total\}/.test(cli)) F("3 · la bienvenida de /explorar no dice el número de todo el sitio");
  // Nadie más lee el «convienen» del resumen de la noche ni arma un total propio (los correos tampoco).
  const resumenConvienen = archivos("src").filter((f) => f !== "src/lib/deptos/servidor.ts").filter((f) => {
    const s = codigo(f);
    return /resumenGuardado\([^)]*\)\??\.convienen|resumenDeLaNoche\([^)]*\)\)?\??\.convienen|deptos_resumen_noche/.test(s);
  });
  if (resumenConvienen.length) F(`3 · leen el «convienen» del resumen de la noche: ${resumenConvienen.join(", ")}`);
  const correos = archivos("src/lib/email").concat(archivos("src/lib/guia")).filter((f) => /convienenHoy|resumenDeLaNoche|universoDeLaNocheCacheado|deptos_conteo/.test(codigo(f)));
  if (correos.length) F(`3 · un correo arma su propio total de «convienen»: ${correos.join(", ")}`);
  const otrosConteos = archivos("src").filter((f) => !/src\/lib\/explorar\/portal(-cache)?\.ts$/.test(f) && /universoDeLaNocheCacheado\([^)]*\)\s*\.then\(\(u\) => [^\n]*\.length/.test(codigo(f)));
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
