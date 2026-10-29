// ============================================================================
// TIER PUERTA-E — Explorar abierto sin cuenta y la landing con dos puertas (29-oct-2026, goal de Fabrizio; mockup
// docs/puerta-b-mockups/6-puerta-e.html, estados A a D).
//
//   1 · LA LANDING TIENE LAS DOS PUERTAS: el hero es la del informe, con «¿Tienes un depto en la mira?» sobre el título;
//       debajo, la tarjeta de Explorar con el mismo peso (el mapa chico con los grupos, «¿Buscas dónde invertir?», el número
//       en rojo, «Míralos en el mapa, sin registrarte.» y «Ver en el mapa →» a /explorar?desde=landing) y «Ver un análisis de
//       ejemplo» como enlace de texto. «Ver un análisis real» no queda en ninguna parte del sitio.
//   2 · SIN SESIÓN, EL FLUJO NO VIAJA AL NAVEGADOR: el universo sin cuenta llega sin flujo ni arriendo; la tarjeta y la lista
//       los dibujan borrosos con un relleno fijo, nunca con el valor; con zoom el pin es solo el punto; sin «Mi búsqueda».
//       Pie y plazo quedan en 20 % y 25 años, y lo que depende del flujo pide registro.
//   3 · EL REGISTRO DESDE UN PIN VUELVE A ESE PIN CON EL REGALO: la hoja guarda lo elegido con la puerta E y vuelve a la URL
//       del pin con lo que tocó (`a` y `hacer`); el código espera el regalo antes de volver; Google y el enlace hacen el alta
//       al volver; el pop-up se abre solo, sin «Estás dentro», y con el regalo no habla del ticket.
//   4 · LA CUENTA NACE CON PUERTA E Y EL PERFIL DEL PIN: comuna, tipología y chip de precio del pin, y la modalidad del
//       filtro; «Avísame» sin cuenta, el perfil de los filtros. La base y la RPC admiten la E; la atribución lleva la llegada.
//   5 · LA BIENVENIDA SALE UNA SOLA VEZ: sin cuenta, la primera vez en el navegador, con el número de la noche y un solo
//       botón, sin pie, plazo ni ticket.
//   6 · LA MEDICIÓN: la vista desde el servidor sin sesión (con la llegada y los robots marcados) y los eventos del embudo.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/puerta-e-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ab from "../../../src/lib/explorar/abierto";
import * as po from "../../../src/lib/explorar/portal";
import { RANGOS_UF, validarElecciones, perfilManualDeElecciones, claveDeDestino } from "../../../src/lib/deptos/respuesta";
import { esPuerta, PUERTAS } from "../../../src/lib/atribucion-puerta";
import { preguntasPendientes } from "../../../src/lib/casa/reglas";
import { EVENTO_VISTA, eventoVistaEntrada, paginaDeEntrada } from "../../../src/lib/vista-entrada";
import { ordenarAlta, type PiezasAlta } from "../../../src/lib/deptos/alta-orden";

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
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
/** Todos los archivos de código de una carpeta (para buscar una frase en todo el sitio). */
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(tsx?|css)$/.test(n)) out.push(rel);
  }
  return out;
}

const PIN: po.PinMapa = {
  avisoId: "a1111111-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.4263, lng: -70.617, m2: 79, dormitorios: 2, banos: 2,
  tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 142264, arriendo: 650000, condicion: "usado", alta: null,
};

export async function runPuertaETier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PUERTA-E (Explorar sin cuenta y la landing con dos puertas: el flujo no viaja, el registro vuelve al pin con el regalo, la cuenta nace con E · 0 tokens) ───");

  // ── 1 · LA LANDING TIENE LAS DOS PUERTAS ──
  {
    const pagina = codigo("src/app/page.tsx");
    const iHero = pagina.indexOf("<Hero cabecera="), iTarjeta = pagina.indexOf("<TarjetaExplorar datos={datos.explorar} />"), iResp = pagina.indexOf("<RotacionEjemplos");
    if (iHero < 0 || iTarjeta < iHero || iResp < iTarjeta) F("1 · la landing no monta la tarjeta de Explorar justo debajo del hero");
    const entrada = codigo("src/components/landing-v14/Entrada.tsx");
    const hero = codigo("src/components/entrada/HeroEntrada.tsx");
    if (!/<HeroEntrada cabecera=\{cabecera\} rotulo=\{LANDING_PUERTAS\.rotuloInforme\} \{\.\.\.acciones\} \/>/.test(entrada) || !/\{rotulo && <p className="he-rotulo" data-landing="rotulo">\{rotulo\}<\/p>\}\s*<h1 className="he-h1">/.test(hero)) F("1 · el hero no lleva «¿Tienes un depto en la mira?» sobre el título");
    if (ab.LANDING_PUERTAS.rotuloInforme !== "¿Tienes un depto en la mira?") F("1 · el rótulo de la puerta del informe no es «¿Tienes un depto en la mira?»");
    if (!/\.he-root--puertas \{ min-height: 0; \}/.test(leer("src/components/entrada/hero-entrada.css"))) F("1 · el hero sigue ocupando la pantalla entera (la segunda puerta queda bajo el pliegue)");
    const mod = cargar<{ TarjetaExplorar: FC<{ datos: { n: number; grupos: ab.GrupoLanding[] } | null }> }>("src/components/landing-v14/TarjetaExplorar");
    if (!mod) F("1 · la tarjeta de Explorar no carga");
    else {
      const grupos = ab.gruposDeLanding([PIN, { ...PIN, avisoId: "b", comuna: "Maipú", lat: -33.51, lng: -70.757 }, { ...PIN, avisoId: "c" }]);
      // SIN PISARSE (QA del 29-oct-2026: Santiago, Providencia y Ñuñoa quedaban uno encima del otro y una cifra se tapaba).
      // Providencia y Ñuñoa están a dos kilómetros: en el mapa chico, el más chico de los dos no entra.
      const vecinos = ab.gruposDeLanding([PIN, { ...PIN, avisoId: "c" }, { ...PIN, avisoId: "b", comuna: "Ñuñoa", lat: -33.456, lng: -70.598 }]);
      if (vecinos.length !== 1 || vecinos[0].comuna !== "Providencia") F("1 · el mapa chico de la landing dibuja dos grupos uno encima del otro (la cifra de abajo se tapa)");
      for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) if (Math.hypot(grupos[i].x - grupos[j].x, grupos[i].y - grupos[j].y) < grupos[i].r + grupos[j].r) F("1 · dos grupos del mapa chico se pisan");
      const html = dibujar(createElement(mod.TarjetaExplorar, { datos: { n: 4807, grupos } }));
      const t = texto(html);
      for (const [que, ok] of [
        ["«¿Buscas dónde invertir?»", t.includes("¿Buscas dónde invertir?")],
        ["el número en rojo con «deptos en venta convienen hoy.»", /<span class="lv-explorar-cifra">4\.807<\/span> deptos en venta convienen hoy\./.test(html) && /\.lv-explorar-cifra \{ color: #C8323C;/.test(leer("src/components/landing-v14/landing.css"))],
        ["«Míralos en el mapa, sin registrarte.»", t.includes("Míralos en el mapa, sin registrarte.")],
        ["«Ver en el mapa →» a /explorar?desde=landing", /href="\/explorar\?desde=landing"[^>]*>Ver en el mapa →/.test(html)],
        ["el mapa chico con los grupos (un dibujo)", /<div class="lv-explorar-mapa" aria-hidden="true"><svg/.test(html) && (html.match(/<g class="lv-explorar-grupo">/g) ?? []).length === 2 && !/<img/.test(html)],
        ["«Ver un análisis de ejemplo» al demo, debajo de la tarjeta", /href="\/demo"[^>]*>Ver un análisis de ejemplo/.test(html) && html.indexOf('href="/demo"') > html.indexOf("Ver en el mapa")],
      ] as const) if (!ok) F(`1 · la tarjeta de la landing no tiene ${que}`);
      if (/<button|onclick/i.test(html)) F("1 · la tarjeta de la landing trae un botón propio (el enlace medido de siempre basta)");
      const sinDatos = dibujar(createElement(mod.TarjetaExplorar, { datos: null }));
      if (/lv-explorar"|Ver en el mapa/.test(sinDatos) || !/Ver un análisis de ejemplo/.test(sinDatos)) F("1 · sin el número de la noche la tarjeta sale igual (o se pierde el enlace al demo)");
      if (grupos[0]?.comuna !== "Providencia" || grupos[0].n !== 2 || grupos.some((g) => g.x < ab.MAPA_LANDING.margen || g.x > ab.MAPA_LANDING.ancho - ab.MAPA_LANDING.margen)) F(`1 · los grupos del mapa chico: ${JSON.stringify(grupos)}`);
    }
    // El número es el MISMO universo que Explorar sin cuenta (pie 20 %, 25 años): la landing, la bienvenida y el mapa dicen lo mismo.
    if (!/universoDeLaNocheCacheado\(PIE_ABIERTO, PLAZO_ABIERTO\)/.test(codigo("src/lib/landing-vivo.ts"))) F("1 · el número de la landing no sale del mismo universo que Explorar sin cuenta");
    // La landing es un cliente liviano: el hero no arrastra Explorar.
    if (/explorar\/abierto|explorar\/portal/.test(entrada) || /^import (?!type)[^\n]*from "\.\/portal"/m.test(leer("src/lib/explorar/puertas-landing.ts"))) F("1 · el hero de la landing importa Explorar entero (pesa antes del primer pintado)");
    const real = archivos("src").filter((f) => /an[áa]lisis real\b/i.test(leer(f)));
    if (real.length) F(`1 · «Ver un análisis real» sigue en el sitio: ${real.join(", ")}`);
  }

  // ── 2 · SIN SESIÓN, EL FLUJO NO VIAJA AL NAVEGADOR ──
  {
    const u = po.compactar([PIN]);
    const s = ab.sinCifras(u);
    if (s.filas[0][9] !== null || s.filas[0][10] !== null || s.filas[0][8] !== 84 || s.filas[0][7] !== 4591) F(`2 · el universo sin cuenta trae el flujo o el arriendo (o pierde el puntaje y el precio): ${JSON.stringify(s.filas[0])}`);
    const ruta = codigo("src/app/api/explorar/abierto/route.ts");
    if ((ruta.match(/sinCifras\(/g) ?? []).length !== 2 || /createClient\(\)|auth\.getUser/.test(ruta) || !/const q = \{ modalidad, pie: PIE_ABIERTO, plazo: PLAZO_ABIERTO \} as const;/.test(ruta)) F("2 · la ruta sin cuenta no quita las cifras en las dos ramas (o mira la sesión, o deja elegir pie y plazo)");
    if (!/const CACHE = "public, /.test(ruta)) F("2 · la ruta sin cuenta no es pública (no queda en el CDN)");
    if (/sinCifras|PIE_ABIERTO/.test(codigo("src/app/api/explorar/route.ts")) || !/if \(!user\) return NextResponse\.json\(\{ error: "sin-sesion" \}, \{ status: 401 \}\);/.test(codigo("src/app/api/explorar/route.ts"))) F("2 · la ruta con cifras se abrió sin sesión");
    const cli = codigo("src/app/explorar/explorar-cliente.tsx");
    if (!/const base = sinCuentaRef\.current \? `\/api\/explorar\/abierto\?m=\$\{f\.modalidad\}` : `\/api\/explorar\?m=/.test(cli)) F("2 · sin cuenta el navegador pide el universo con cifras");
    const modTar = cargar<{ TarjetaPin: FC<Record<string, unknown>> }>("src/app/explorar/tarjeta-pin");
    const modLista = cargar<{ ListaPortal: FC<Record<string, unknown>> }>("src/app/explorar/lista-portal");
    const cifras = ["142.264", "142 mil", "7,3", "17,0", "58 UF", "+$142"];
    if (modTar) {
      const base = { pines: [PIN], seleccionado: PIN.avisoId, uf: 39500, analizados: {}, guardados: new Set(), generando: null, error: null, alCambiar() {}, alCerrar() {}, alGuardar() {}, alAnalizar() {} };
      const sin = dibujar(createElement(modTar.TarjetaPin, { ...base, sinCuenta: true }));
      const con = dibujar(createElement(modTar.TarjetaPin, { ...base }));
      if (cifras.some((c) => sin.includes(c))) F("2 · la tarjeta sin cuenta dibuja el flujo, el cap rate o la UF por m²");
      if (!con.includes("142.264")) F("2 · la tarjeta con cuenta perdió el flujo (el fixture no mide)");
      if ((sin.match(/data-explorar="borroso"/g) ?? []).length !== 3 || !sin.includes(ab.BORROSO.flujo) || !/aria-hidden="true" data-explorar="borroso"/.test(sin)) F("2 · la tarjeta sin cuenta no muestra el flujo, el cap rate y la UF por m² borrosos");
      if (!/data-explorar="registrate">Regístrate gratis para ver este depto</.test(sin) || /data-explorar="analizar"/.test(sin) || !/class="ex-cta ex-cta-triada"/.test(sin)) F("2 · el botón sin cuenta no es «Regístrate gratis para ver este depto» en el material de la tríada");
      if (!texto(sin).includes("Providencia · 2D2B · 79 m² · Usado") || !texto(sin).includes("UF 4.591") || !texto(sin).includes("Comprar · 84")) F("2 · sin cuenta la tarjeta pierde la línea, el precio o «Comprar · 84»");
      if (!/\.ex-borroso \{ filter: blur\(5px\); user-select: none;/.test(leer("src/app/explorar/explorar.css"))) F("2 · lo borroso no está desenfocado");
    } else F("2 · la tarjeta no carga");
    if (modLista) {
      const l = dibujar(createElement(modLista.ListaPortal, { pines: [PIN], total: 1, calculando: false, orden: "puntaje", uf: 39500, analizados: {}, guardados: new Set(), alOrden() {}, alAbrir() {}, alGuardar() {}, alAvisame() {}, alMapa() {}, sinCuenta: true }));
      if (cifras.some((c) => l.includes(c)) || !l.includes(ab.BORROSO.flujo)) F("2 · la lista sin cuenta dibuja el flujo (o no lo muestra borroso)");
    } else F("2 · la lista no carga");
    const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
    if (!/if \(sinCifrasRef\.current\) \{\s*marcador\(\{ lat: p\.lat, lng: p\.lng \}, elegido \? iconoElegido\(\) : iconoPunto\(ROJO\)/.test(mapa) || !/sinCifras=\{sinCuenta\}/.test(cli)) F("2 · sin cuenta, con zoom, el pin dice algo más que el punto");
    if (!/\{!sinCuenta && <button type="button" className="ex-boton ex-boton-suave"[^>]*data-explorar="mi-busqueda"/.test(cli) || !/\{!sinCuenta && <span className="ex-boton ex-boton-suave">\{PORTAL_COPY\.miBusqueda\}<\/span>\}/.test(codigo("src/app/explorar/esqueleto.tsx"))) F("2 · sin cuenta aparece «Mi búsqueda»");
    // Pie y plazo en 20 % y 25 años; lo que depende del flujo pide registro.
    const f30 = ab.filtrosAbiertos({ ...po.FILTROS_GLOBALES, pie: 30, plazo: 30, flujoPositivo: true, modalidad: "str" } as po.FiltrosPortal);
    if (f30.pie !== 20 || f30.plazo !== 25 || f30.flujoPositivo || f30.modalidad !== "str") F(`2 · sin cuenta los supuestos no quedan en 20 % y 25 años (o la modalidad no se respeta): ${JSON.stringify(f30)}`);
    if (ab.ordenAbierto("flujo") !== "puntaje" || ab.ordenAbierto("caprate") !== "puntaje" || ab.ordenAbierto("precio") !== "precio") F("2 · sin cuenta se ordena por el flujo o el cap rate sin registrarse");
    if (!/if \(sinCuenta && ORDENES_CON_CIFRAS\.includes\(o\)\) \{ setMenuOrden\(false\); pedirRegistro\("orden"/.test(cli) || !/const f = sinCuenta \? filtrosAbiertos\(f0\) : f0;/.test(cli)) F("2 · sin cuenta, ordenar por el flujo o cambiar pie y plazo no pide registro");
    const hojaF = codigo("src/app/explorar/hoja-filtros.tsx");
    if (!/\{alPedirRegistro \? \(\s*<div className="ex-dos">\s*<button type="button" className="ex-campo ex-campo-cerrado" onClick=\{\(\) => alPedirRegistro\("pie-plazo", b\)\}/.test(hojaF) || !/if \(alPedirRegistro && e\.target\.checked\) \{ alPedirRegistro\("flujo", b\); return; \}/.test(hojaF)) F("2 · sin cuenta, pie, plazo o «Solo flujo positivo» se cambian sin registro");
  }

  // ── 3 · EL REGISTRO DESDE UN PIN VUELVE A ESE PIN CON EL REGALO ──
  {
    const filtros = { ...po.FILTROS_GLOBALES, comunas: ["Providencia"] } as po.FiltrosPortal;
    const vuelta = ab.destinoDeVuelta({ filtros, orden: "puntaje", pedido: { motivo: "analizar", pin: PIN } });
    const sp = new URLSearchParams(vuelta.split("?")[1]);
    const accion = ab.accionDeVuelta(sp);
    if (!vuelta.startsWith("/explorar?") || accion?.motivo !== "analizar" || accion.avisoId !== PIN.avisoId || sp.get("c") !== "Providencia") F(`3 · la vuelta no lleva al mismo pin con lo que tocó: ${vuelta}`);
    const clave = "0123456789abcdef0123456789abcdef";
    const g = ab.destinoGoogleExplorar(vuelta, clave);
    if (claveDeDestino(g) !== clave || ab.accionDeVuelta(new URLSearchParams(g.split("?")[1]))?.avisoId !== PIN.avisoId) F(`3 · la vuelta de Google no lleva la clave (el callback no la reconoce) o pierde el pin: ${g}`);
    if (!/entro=1$/.test(ab.destinoEnlaceExplorar(vuelta))) F("3 · la vuelta por el enlace del correo no dice entro=1");
    if (ab.accionDeVuelta(new URLSearchParams("a=x&hacer=otra")) !== null) F("3 · una acción desconocida en la URL se ejecuta");
    const hoja = codigo("src/app/explorar/hoja-registro.tsx");
    if (!/if \(r\.valor\.d\.estado === "nueva" && !r\.valor\.d\.regaloVence && r\.valor\.d\.regalo === "pendiente"\) await esperarRegalo\(\);\s*window\.location\.assign\(vuelta\);/.test(hoja)) F("3 · por código, la hoja no espera el regalo antes de volver al pin");
    if (!/body: JSON\.stringify\(\{ correo: c, \.\.\.loElegido, puerta: "E", detalle \}\)/.test(hoja) || !/body: JSON\.stringify\(\{ \.\.\.loElegido, puerta: "E", detalle \}\)/.test(hoja)) F("3 · la hoja no guarda lo elegido con la puerta E (por correo o por Google)");
    if (!/redirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\$\{encodeURIComponent\(destinoGoogleExplorar\(vuelta, d\.p\)\)\}`/.test(hoja) || !/emailRedirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\$\{encodeURIComponent\(destinoEnlaceExplorar\(vuelta\)\)\}`/.test(hoja)) F("3 · Google o el enlace del correo no vuelven al pin");
    if (/Estás dentro|estas-dentro|\/dashboard/.test(hoja)) F("3 · la hoja pasa por «Estás dentro» o por el dashboard");
    const cli = codigo("src/app/explorar/explorar-cliente.tsx");
    if (!/const r = await conTopeYReintento\(async \(senal\) => \{\s*const res = await fetch\("\/api\/deptos\/alta"/.test(cli) || !/const c = await fetch\("\/api\/explorar\/cuenta"/.test(cli)) F("3 · al volver de Google o del enlace, el alta no corre o la cuenta no se refresca (el regalo no estaría en el saldo)");
    if (!/if \(v\.motivo === "analizar" && it && !cuenta\.analizados\[it\.avisoId\]\) pedirAnalisis\(it\);/.test(cli) || !/if \(it\) \{ setCarrusel\(cercanos\(visibles, it\.avisoId\)\.map\(\(p\) => p\.avisoId\)\); setSel\(it\.avisoId\); \}/.test(cli)) F("3 · al volver no se abre el mismo pin con el pop-up de analizar");
    if (!/!usaRegalo\(cuenta\.saldo\) \? lineaTicketConSaldo\(/.test(cli) || !/const usaRegalo = \(s: EstadoSaldo\): boolean => s\.tipo === "regalo" \|\| \(s\.tipo === "con" && !!s\.proximoRegalo\);/.test(cli)) F("3 · con el regalo el pop-up habla también del ticket (ofertas de a una)");
    if (!/if \(v\.motivo === "guardar" && it && !guardados\.has\(it\.avisoId\)\) void alternarGuardado\(it\.avisoId, "tarjeta"\);/.test(cli) || !/if \(v\.motivo === "pie-plazo"\) setHojaFiltros\(true\);/.test(cli)) F("3 · al volver no se hace lo que había tocado (guardar, pie y plazo)");
    // LO QUE CAZÓ EL QA (29-oct-2026, local): con las imágenes de la calle de los cercanos ocupando la red, el chunk de la hoja
    // quedaba en cola y la hoja tardaba segundos en abrir; y una foto que Google no entrega dejaba la imagen rota.
    if (!/function tocarPin\(avisoId: string\) \{\s*if \(sinCuenta\) void import\("\.\/hoja-registro"\);/.test(cli)) F("3 · sin cuenta la hoja de registro no se precarga al tocar un pin (abre tarde)");
    const rutaImg = codigo("src/app/api/explorar/calle/[avisoId]/route.ts");
    if (!/const m = img\.respaldo \? await traer\(img\.respaldo\) : null;/.test(rutaImg) || !/"Cache-Control": CACHE_SIN_DECIDIR, "X-Calle": "mapa"/.test(rutaImg) || !/respaldo: urlMapaChico\(\{ lat: Number\(fila\.lat\), lng: Number\(fila\.lng\) \}, keyMapa, estilo\)/.test(codigo("src/lib/explorar/calle-servidor.ts"))) F("3 · si la foto de la calle no llega, la tarjeta queda con la imagen rota (sin el mapa chico de respaldo)");
    // ESCAPE CIERRA LA HOJA (QA del 29-oct-2026): el primer Escape cerraba la tarjeta de abajo y no la hoja; el listener de la
    // hoja, re-registrado a cada render, se quitaba en medio del mismo evento. Va una vez, en captura, y corta el evento.
    if (!/const esc = \(e: KeyboardEvent\) => \{\s*if \(e\.key !== "Escape"\) return;\s*e\.stopImmediatePropagation\(\);\s*if \(!ocupadoRef\.current\) cerrarRef\.current\(\);\s*\};\s*window\.addEventListener\("keydown", esc, true\);\s*return \(\) => window\.removeEventListener\("keydown", esc, true\);\s*\}, \[\]\);/.test(hoja)) F("3 · Escape no cierra la hoja de registro a la primera (el listener se re-registra a cada render)");
    // La hoja: los textos del mockup, del regalo, sin el ticket.
    const modH = cargar<{ HojaRegistro: FC<Record<string, unknown>> }>("src/app/explorar/hoja-registro");
    if (modH) {
      const con = dibujar(createElement(modH.HojaRegistro, { pedido: { motivo: "analizar", pin: PIN }, filtros, orden: "puntaje", origen: "landing", alCerrar() {} }));
      const tc = texto(con);
      for (const [que, ok] of [
        ["«Te regalamos el análisis de este depto.»", tc.includes("Te regalamos el análisis de este depto.")],
        ["el depto en una línea", tc.includes("Providencia · 2D2B · 79 m² · Usado · UF 4.591")],
        ["«el enlace a la publicación» en negrita", /con <strong>el enlace a la publicación<\/strong>\./.test(con)],
        ["primero «Entrar con Google», después el correo", con.indexOf("Entrar con Google") > 0 && con.indexOf("Entrar con Google") < con.indexOf('data-explorar="registro-correo"')],
        ["el logo oficial de Google", /<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4"/.test(con)],
        ["«Ver este depto»", /data-explorar="registro-ver">Ver este depto</.test(con)],
        ["«Sin contraseña: te mandamos un código.»", tc.includes("Sin contraseña: te mandamos un código.")],
        ["el material de la tríada", /class="ex-registro ex-triada"/.test(con)],
      ] as const) if (!ok) F(`3 · la hoja de registro no tiene ${que}`);
      const av = texto(dibujar(createElement(modH.HojaRegistro, { pedido: { motivo: "avisame", pin: null }, filtros, orden: "puntaje", origen: "directo", alCerrar() {} })));
      if (!av.includes("Te regalamos un análisis.") || !av.includes("te avisamos de los nuevos que convienen con estos filtros") || av.includes("Ver este depto")) F("3 · «Avísame» sin cuenta no habla del regalo sin depto");
      if (/14\.990|ticket|\bpie\b|plazo/i.test(tc + av)) F("3 · la hoja de registro habla del ticket, del pie o del plazo");
    } else F("3 · la hoja de registro no carga");
  }

  // ── 4 · LA CUENTA NACE CON PUERTA E Y EL PERFIL DEL PIN ──
  {
    const el = ab.eleccionesDePin(PIN, "str");
    const v = validarElecciones(el);
    const perfil = v.ok ? perfilManualDeElecciones(v) : null;
    if (!perfil || JSON.stringify(perfil.comunas) !== '["Providencia"]' || JSON.stringify(perfil.dormitorios) !== "[2]" || perfil.precio_min_uf !== 4000 || perfil.precio_max_uf !== 6000 || perfil.modalidad !== "str") F(`4 · el perfil no nace del pin (comuna, tipología, chip de precio, modalidad): ${JSON.stringify(perfil)}`);
    const chips = [[2999, "hasta-3000"], [3000, "hasta-3000"], [3500, "3000-4000"], [5999, "4000-6000"], [9000, "6000-mas"]] as const;
    for (const [uf, id] of chips) if (ab.rangoDePrecio(uf) !== id || !RANGOS_UF.some((r) => r.id === id)) F(`4 · el chip de UF ${uf} no es ${id}: ${ab.rangoDePrecio(uf)}`);
    if (ab.tipologiaDePin(0) !== "0" || ab.tipologiaDePin(4) !== "4" || ab.tipologiaDePin(6) !== "4") F("4 · la tipología del pin no es la de /deptos");
    const conFiltros = ab.perfilDelPedido({ puerta: "E", filtros: { comunas: ["Ñuñoa", "Santiago"], tipologias: ["2"], ufMax: 4000, pie: 30, plazo: 30, modalidad: "ltr" } });
    if (!conFiltros.ok || JSON.stringify((conFiltros as { perfil: Record<string, unknown> }).perfil.comunas) !== '["Ñuñoa","Santiago"]' || (conFiltros as { perfil: Record<string, unknown> }).perfil.pie_pct !== 20) F(`4 · «Avísame» sin cuenta no arma el perfil de los filtros (con 20 % y 25 años): ${JSON.stringify(conFiltros)}`);
    if (ab.perfilDelPedido({ puerta: "E", filtros: { comunas: [] } }).ok) F("4 · «Avísame» sin comunas arma un perfil");
    if (ab.perfilDelPedido({ puerta: "B", filtros: { comunas: ["Ñuñoa"] }, elecciones: {} }).ok) F("4 · fuera de la puerta E se aceptan filtros en vez de los chips");
    if (!esPuerta("E") || PUERTAS.E !== "explorar") F("4 · la E no es una puerta");
    if (JSON.stringify(preguntasPendientes({ puerta: "E", modalidad: null, horizonte: null })) !== '["modalidad","cuando"]') F("4 · el perfil de la casa no le pregunta a la cuenta E lo que le pregunta a B y C");
    const mig = leer("supabase/migrations/20261029_puerta_e_explorar.sql");
    if (!/check \(puerta is null or puerta in \('A', 'B', 'C', 'D', 'E'\)\)/.test(mig) || !/when p_puerta in \('A', 'B', 'C', 'E'\) then p_puerta/.test(mig) || !/add column if not exists puerta_detalle text/.test(mig)) F("4 · la base no admite la puerta E (o no guarda su detalle)");
    const alta = codigo("src/lib/deptos/alta-servidor.ts");
    if (!/const puerta: PuertaAlta = ref && ref\.estado !== "cuenta_previa" \? "C" : puertaElegida\.puerta === "E" \? "E" : "B";/.test(alta) || !/if \(puerta === "E"\) await guardarAtribucion\(admin, user\.id, \{ puerta: "E", puerta_detalle: detalleExplorar\(puertaElegida\.detalle\) \}\);/.test(alta) || !/if \(pend\) puertaElegida = \{ puerta: pend\.puerta \?\? null, detalle: pend\.puertaDetalle \?\? null \};/.test(alta)) F("4 · el alta no fija la puerta E con su detalle (o la invitada deja de ser C)");
    for (const ruta of ["src/app/api/deptos/correo/route.ts", "src/app/api/deptos/google/route.ts"]) if (!/puerta === "E" \? detalleExplorar\(typeof b\.detalle === "string" \? b\.detalle : null\) : null/.test(codigo(ruta))) F(`4 · ${ruta} no guarda el detalle de la puerta E`);
    if (ab.detalleExplorar("explorar:landing") !== "explorar:landing" || ab.detalleExplorar("cualquier") !== "explorar:directo" || ab.detalleDeOrigen(ab.origenDeLlegada("landing")) !== "explorar:landing" || ab.origenDeLlegada(null) !== "directo") F("4 · la llegada (landing o directo) no queda en el detalle");
    // El orden del alta pasa la E a todo lo de después (atribución, Meta, PostHog, el espejo).
    const vistos: string[] = [];
    const piezas: PiezasAlta = {
      pendiente: async () => ({ existe: false, creadoAt: "2026-10-29T12:00:00Z", perfil: { comunas: ["Providencia"] } }),
      reclavarGoogle: null, repetida: async () => null, existente: async () => ({}), perfilSiFalta: async () => "creado", filaDelDia: async () => null, creditos: async () => null,
      puerta: async () => ({ puerta: "E", invitacionUsada: false }), esPrueba: async () => false, regalo: async () => ({ estado: "otorgado", vence: "2026-11-28T12:00:00Z" }),
      vueltaDelDia: async () => null, atribucion: async (p) => { vistos.push(`atr:${p}`); }, meta: async (p) => { vistos.push(`meta:${p}`); }, borrarPendiente: async () => null, posthog: async (p) => { vistos.push(`ph:${p.puerta}`); },
    };
    const espera: Promise<unknown>[] = [];
    const r = await ordenarAlta(piezas, { cuentaCreadaAt: "2026-10-29T12:00:05Z", cuentaNueva: true, busquedaDe: () => null, espejoDe: (p) => ({ evento: "CompleteRegistration", eventId: "x", datos: { puerta: p } }) }, (p) => { espera.push(p); }, { esperaRegaloMs: 50 });
    await Promise.all(espera);
    if (r.cuerpo.estado !== "nueva" || !vistos.includes("atr:E") || !vistos.includes("meta:E") || !vistos.includes("ph:E") || (r.espejos[0]?.datos as { puerta?: string } | undefined)?.puerta !== "E") F(`4 · el alta no lleva la E a la atribución, Meta, PostHog y el espejo: ${vistos.join(",")}`);
  }

  // ── 5 · LA BIENVENIDA SALE UNA SOLA VEZ ──
  {
    const mem = new Map<string, string>();
    const almacen = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    if (ab.bienvenidaVista(almacen)) F("5 · la bienvenida se da por vista antes de verla");
    ab.marcarBienvenida(almacen);
    if (!ab.bienvenidaVista(almacen)) F("5 · la bienvenida sale de nuevo después de verla");
    if (!ab.bienvenidaVista(null)) F("5 · sin almacenamiento la bienvenida sale a cada carga");
    const roto = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    if (!ab.bienvenidaVista(roto)) F("5 · con el almacenamiento bloqueado la bienvenida sale a cada carga");
    const cli = codigo("src/app/explorar/explorar-cliente.tsx");
    if (!/if \(!sinCuenta \|\| inicial\.n == null\) return;[\s\S]{0,200}if \(bienvenidaVista\(almacen\)\) return;\s*marcarBienvenida\(almacen\);\s*setBienvenida\(true\);/.test(cli)) F("5 · la bienvenida no se marca vista al mostrarse (o sale con cuenta)");
    const modB = cargar<{ Bienvenida: FC<{ n: number; alCerrar: () => void }> }>("src/app/explorar/bienvenida");
    if (modB) {
      const b = dibujar(createElement(modB.Bienvenida, { n: 4807, alCerrar() {} }));
      const tb = texto(b);
      if (!/data-explorar="bienvenida-n">4\.807</.test(b) || !tb.includes("Revisados por Franco") || !tb.includes("Deptos en venta que convienen como inversión hoy.") || !tb.includes("Toca uno en el mapa para ver por qué conviene.") || !/Regístrate gratis y <strong>te regalamos el análisis completo<\/strong> del que más te interese\./.test(b)) F("5 · la bienvenida no dice lo del mockup");
      if ((b.match(/<button/g) ?? []).length !== 1 || !/data-explorar="bienvenida-ok">Ver el mapa</.test(b)) F("5 · la bienvenida no tiene un solo botón «Ver el mapa»");
      if (/\bpie\b|plazo|ticket|14\.990/i.test(tb)) F("5 · la bienvenida menciona pie, plazo o el ticket");
      if (!/class="ex-bienvenida-cab ex-triada"/.test(b)) F("5 · el número de la bienvenida no va en la tríada");
    } else F("5 · la bienvenida no carga");
  }

  // ── 6 · LA MEDICIÓN ──
  {
    if (paginaDeEntrada("/explorar") !== "explorar" || EVENTO_VISTA.explorar !== ab.EVENTOS_ABIERTO.vista) F("6 · /explorar no emite su vista de entrada (o con otro nombre que el del embudo)");
    const ev = eventoVistaEntrada({ pagina: "explorar", ruta: "/explorar", search: "?desde=landing", referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "11111111-1111-4111-8111-111111111111", esCarga: true, agente: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", cabeceras: { get: () => null }, extra: { llegada: "landing" } });
    const evNav = eventoVistaEntrada({ pagina: "explorar", ruta: "/explorar", search: "", referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "22222222-2222-4222-8222-222222222222", esCarga: true, agente: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", cabeceras: { get: (n: string) => (n === "accept-language" ? "es-CL" : null) }, extra: { llegada: "directo" } });
    if (!ev || ev.event !== "explorar_abierto_vista" || ev.properties?.llegada !== "landing" || ev.properties?.robot !== true || evNav?.properties?.robot !== false || evNav?.properties?.llegada !== "directo") F(`6 · la vista sin cuenta no lleva la llegada o no marca los robots: ${JSON.stringify([ev?.properties, evNav?.properties])}`);
    const mw = codigo("src/middleware.ts");
    if (!/if \(pagina === "explorar" && persona\) return res;/.test(mw) || !/\.\.\.\(pagina === "explorar" \? \{ extra: \{ llegada: origenDeExplorar\(request\.nextUrl\.search\) \} \} : \{\}\)/.test(mw)) F("6 · la vista de /explorar sale también con sesión, o sin la llegada");
    const cli = codigo("src/app/explorar/explorar-cliente.tsx");
    for (const [que, re] of [
      ["bienvenida vista", /posthog\?\.capture\(EVENTOS_ABIERTO\.bienvenida, \{ n: inicial\.n, llegada: origen \}\)/],
      ["pin tocado", /posthog\?\.capture\(EVENTOS_PORTAL\.pin, \{ aviso_id: avisoId, modalidad: filtros\.modalidad, \.\.\.\(sinCuenta \? \{ sin_cuenta: true, llegada: origen \} : \{\}\) \}\)/],
      ["registro abierto", /posthog\?\.capture\(EVENTOS_ABIERTO\.registroAbierto, \{ motivo, aviso_id: pin\?\.avisoId \?\? null, modalidad: f\.modalidad, llegada: origen \}\)/],
      ["regalo usado", /if \(usaRegalo\(cuenta\.saldo\)\) posthog\?\.capture\(EVENTOS_ABIERTO\.regaloUsado,/],
    ] as const) if (!re.test(cli)) F(`6 · falta el evento «${que}»`);
    if (!/if \(puerta === "E"\) await capturarServidor\(\{ event: EVENTOS_ABIERTO\.registroHecho,/.test(codigo("src/lib/deptos/alta-servidor.ts"))) F("6 · falta el evento «registro hecho» (desde el servidor, con la llegada)");
    // Nada de datos de la persona antes del registro: los eventos del embudo no llevan el correo.
    if (/capture\([^)]*correo/.test(cli) || /capture\([^)]*correo/.test(codigo("src/app/explorar/hoja-registro.tsx"))) F("6 · un evento antes del registro lleva el correo");
  }

  if (fallas.length) {
    console.log(`  ✗ ROJO — ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la landing con las dos puertas; sin cuenta el flujo no viaja y lo que depende de él pide registro; el registro vuelve al pin con el regalo, sin «Estás dentro» ni el ticket; la cuenta nace con E y el perfil del pin; la bienvenida, una vez; la medición del embudo");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (29-oct-2026). 44 mutaciones, cada una restaurada byte a byte con su hash (scratchpad mutar-puerta-e.cjs),
// todas ROJAS a la primera. Y una falla que el tier cazó ANTES de mutar nada: la llegada de la vista se mandaba como `origen`, y
// eventoVistaEntrada escribe `origen: "servidor"` después del extra: se perdía en silencio. Ahora es `llegada`.
//   1 · LANDING: E1 sin la segunda puerta · E2 el hero sin el rótulo · E3 el número sin rojo · E4 «Ver en el mapa» sin la llegada ·
//       E5 vuelve «Ver un análisis real» · E6 el hero a pantalla completa · E7 el mapa chico con una foto.
//   2 · SIN CIFRAS: E8 el universo trae el flujo · E9 la ruta de la noche sin quitarlas · E10 la tarjeta con el flujo de verdad ·
//       E11 la lista igual · E12 sin cuenta pide el universo con cifras · E13 con zoom el pin dice el flujo · E14 se elige pie y
//       plazo · E15 «Solo flujo positivo» sin registro · E16 aparece «Mi búsqueda» · E17 la ruta con cifras sin sesión.
//   3 · LA VUELTA: E18 sin el pin · E19 el código no espera el regalo · E20 no se abre el pop-up · E21 con el regalo habla del
//       ticket · E22 pasa por el dashboard · E23 Google no vuelve al pin · E24 al volver no corre el alta.
//   4 · LA CUENTA E: E25 sin el chip del pin · E26 sin la modalidad del filtro · E27 el alta ignora la E · E28 la atribución sin
//       la E · E29 la base sin la E · E30 la llegada se pierde · E31 el correo sin el detalle · E32 lo elegido no se anota.
//   5 · LA BIENVENIDA: E33 no se marca vista · E34 sin almacenamiento sale siempre · E35 habla del pie · E36 dos botones.
//   6 · LA MEDICIÓN: E37 la vista sale con sesión · E38 sin «regalo usado» · E39 sin «registro hecho» · E40 la vista sin la llegada.
//   Y lo que cazó el QA en local: E41 la hoja sin precarga · E42 la foto que no llega sin el mapa de respaldo · E43 el Escape de
//   la hoja se re-registra a cada render · E44 los grupos del mapa chico de la landing se pisan.

if (require.main === module) {
  runPuertaETier().then((r) => process.exit(r.hard ? 1 : 0));
}
