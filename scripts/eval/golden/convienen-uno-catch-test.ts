// ============================================================================
// TIER CONVIENEN-UNO — «convienen» explicado y un solo número en todo el sitio (30-oct-2026, goal de Fabrizio).
//
//   1 · LA LÍNEA MUESTRA LA TASA DEL MOTOR: bajo el número del mapa de /explorar, con y sin cuenta, «Con pie 20 %, 25 años y
//       tasa X % · ¿Cómo se calcula?». El pie y el plazo son los de los filtros; la tasa, la de `config.tasa_hipotecaria`
//       —la misma que leen la evaluación de la noche y todo pie o plazo calculado—, leída por `tasaDelMotor` y bajada por la
//       página. Nunca un número fijo: con otra tasa, la línea dice otra.
//   2 · LA HOJA «¿CÓMO SE CALCULA?» EXISTE CON Y SIN CUENTA: cuatro ideas (cada noche y con qué crédito; qué quiere decir
//       «conviene», con la frase de Fabrizio y «algunos te piden poner un poco cada mes»; de dónde sale la tasa y cuándo se
//       revisó; con otro pie o plazo cambia) y un solo botón, «Entendido». Al abrirla, `explorar_como_se_calcula`.
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
  console.log("\n─── TIER CONVIENEN-UNO (la línea con la tasa del motor, «¿Cómo se calcula?» con y sin cuenta, un solo número de «convienen» · 0 tokens) ───");

  // ── 1 · LA LÍNEA MUESTRA LA TASA DEL MOTOR ──
  if (po.lineaSupuestos(G, 4.07) !== "Con pie 20 %, 25 años y tasa 4,07 %") F(`1 · la línea no dice el crédito con la tasa: «${po.lineaSupuestos(G, 4.07)}»`);
  if (po.lineaSupuestos({ ...G, pie: 30, plazo: 30 }, 5.5) !== "Con pie 30 %, 30 años y tasa 5,5 %") F("1 · con otro pie, plazo o tasa, la línea no dice los suyos");
  if (po.lineaSupuestos(G, null) !== "Con pie 20 % y 25 años" || /\d+,\d+/.test(po.lineaSupuestos(G, null))) F("1 · sin la tasa del motor, la línea inventa una");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");
  if (!/\{lineaSupuestos\(filtros, inicial\.tasa\?\.tasa \?\? null\)\} ·\{" "\}\s*<button type="button" className="ex-numero-como" data-explorar="como-se-calcula" onClick=\{abrirCalculo\}>\{COMO_SE_CALCULA\.enlace\}<\/button>/.test(cli)) F("1 · bajo el número del mapa no va la línea con la tasa y «¿Cómo se calcula?»");
  // La tasa la lee el servidor de la misma fila que el motor, y la página la baja en las dos ramas.
  const cache = codigo("src/lib/explorar/portal-cache.ts");
  const delMotor = /\.from\("config"\)\.select\("value, updated_at"\)\.eq\("key", "tasa_hipotecaria"\)\.maybeSingle\(\)/.test(cache);
  const motorNoche = /\.in\("key", \["uf_value", "tasa_hipotecaria"\]\)/.test(codigo("src/app/api/cron/evaluar-avisos/route.ts"));
  const motorCalculo = /\.in\("key", \["uf_value", "tasa_hipotecaria"\]\)/.test(codigo("src/lib/guia/guia-servidor.ts"));
  if (!delMotor || !motorNoche || !motorCalculo) F("1 · la tasa de la línea no sale de la misma fila que lee el motor (config.tasa_hipotecaria)");
  const pag = codigo("src/app/explorar/page.tsx");
  const abierta = pag.slice(pag.indexOf("async function ExplorarAbierto"), pag.indexOf("async function ExplorarConDatos"));
  const conCuenta = pag.slice(pag.indexOf("async function ExplorarConDatos"));
  if (!/tasaDelMotor\(\),/.test(abierta) || !/tasaDelMotor\(\),/.test(conCuenta) || !/inicial=\{\{ filtros, orden, n, cuenta: null, tasa, convienen \}\}/.test(abierta) || !/inicial=\{\{ filtros, orden, n, cuenta, tasa, convienen: null \}\}/.test(conCuenta))
    F("1 · la página no baja la tasa del motor con y sin cuenta");
  // En el navegador: con otra tasa, otra línea (ningún número fijo en el componente).
  const modCli = (() => { try { return require(join(RAIZ, "src/app/explorar/explorar-cliente")) as { ExplorarCliente: FC<Record<string, unknown>> }; } catch (e) { F(`0 · no carga explorar-cliente: ${(e as Error).message}`); return null; } })();
  const pintar = (cuenta: unknown, tasa: po.TasaDelMotor | null) =>
    modCli ? dibujar(createElement(modCli.ExplorarCliente, { inicial: { filtros: G, orden: "puntaje", n: 3, cuenta, tasa, convienen: cuenta ? null : 3 } })) : "";
  for (const [cuenta, que] of [[cuentaBase(), "con cuenta"], [null, "sin cuenta"]] as const) {
    const a = texto(pintar(cuenta, { tasa: 4.07, revisada: "29 de octubre" }));
    const b = texto(pintar(cuenta, { tasa: 5.3, revisada: "2 de noviembre" }));
    if (!a.includes("Con pie 20 %, 25 años y tasa 4,07 % · ¿Cómo se calcula?") || !b.includes("Con pie 20 %, 25 años y tasa 5,3 % · ¿Cómo se calcula?")) F(`1 · ${que}, la línea no muestra la tasa que le llega (o la tiene fija)`);
    if (!pintar(cuenta, null).includes('data-explorar="como-se-calcula"')) F(`2 · ${que}, no hay «¿Cómo se calcula?»`);
  }

  // ── 2 · LA HOJA «¿CÓMO SE CALCULA?», CON Y SIN CUENTA ──
  const modHoja = (() => { try { return require(join(RAIZ, "src/app/explorar/hoja-calculo")) as { HojaCalculo: FC<Record<string, unknown>> }; } catch (e) { F(`2 · no carga la hoja: ${(e as Error).message}`); return null; } })();
  if (modHoja) {
    for (const sinCuenta of [false, true]) {
      const h = dibujar(createElement(modHoja.HojaCalculo, { filtros: G, tasa: { tasa: 4.07, revisada: "29 de octubre" }, sinCuenta, alCerrar: () => {} }));
      const t = texto(h);
      const que = sinCuenta ? "sin cuenta" : "con cuenta";
      if (!/role="dialog"/.test(h) || !t.startsWith("¿Cómo se calcula?")) F(`2 · ${que}, la hoja no es un diálogo con su título`);
      if ((h.match(/<li\b/g) ?? []).length !== 4) F(`2 · ${que}, la hoja no lleva cuatro ideas`);
      if ((h.match(/<button\b/g) ?? []).length !== 1 || !/data-explorar="calculo-ok"[^>]*>Entendido<\/button>/.test(h)) F(`2 · ${que}, la hoja no tiene un solo botón, «Entendido»`);
      if (!t.includes("Cada noche Franco revisa los deptos en venta de Santiago y calcula cuáles convienen con un crédito de pie 20 %, 25 años y tasa 4,07 %.")) F(`2 · ${que}, la primera idea no dice la noche y el crédito`);
      if (!t.includes("Que convenga quiere decir que Franco le da Comprar: su nota de 1 a 100 llega a 70, o el arriendo lo paga solo sin estar caro para su zona. Y en ningún caso tiene señales graves, como perder mucha plata todos los meses."))
        F(`2 · ${que}, «conviene» no es la frase de Fabrizio`);
      const poner = sinCuenta ? "Algunos te piden poner un poco cada mes: con tu cuenta gratis, cada tarjeta te dice cuánto." : "Algunos te piden poner un poco cada mes: cada tarjeta te dice cuánto.";
      if (!t.includes(poner)) F(`2 · ${que}, la hoja no avisa que algunos piden poner plata cada mes (o promete una cifra que sin cuenta va borrosa)`);
      if (!t.includes("según el Banco Central. Franco la revisa cada mañana; la última vez, el 29 de octubre.")) F(`2 · ${que}, la hoja no dice de dónde sale la tasa ni cuándo se revisó`);
      if (!t.includes("Con otro pie o plazo el resultado cambia. Con cuenta lo ajustas en Filtros, y siempre puedes cambiarlo antes de analizar.")) F(`2 · ${que}, la hoja no dice que con otro pie o plazo cambia`);
    }
  }
  // La monta el cliente sin depender de la cuenta, y al abrirla se mide.
  if (!/\{calculo && <HojaCalculo filtros=\{filtros\} tasa=\{inicial\.tasa\} sinCuenta=\{sinCuenta\} alCerrar=\{\(\) => setCalculo\(false\)\} \/>\}/.test(cli)
    || /(!sinCuenta|sinCuenta) &&[^\n]*<HojaCalculo/.test(cli)) F("2 · la hoja no se monta igual con y sin cuenta");
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
  if (!/const n = cuantosConvienen\(u\); return n \? \{ n, grupos: gruposDeLanding\(descompactar\(u\)\) \} : null;/.test(vivo)) F("3 · el título de la landing no sale de cuantosConvienen");
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
    console.log("  ✓ VERDE — la línea dice el crédito con la tasa del motor, «¿Cómo se calcula?» abre la misma hoja con y sin cuenta y se mide, y la landing, /explorar, la bienvenida, el dashboard y /deptos dicen un solo número de «convienen»");
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
