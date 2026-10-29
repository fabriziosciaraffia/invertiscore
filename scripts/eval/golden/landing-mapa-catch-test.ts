// ============================================================================
// TIER LANDING-MAPA — el hero de la landing con las dos puertas. Nació el 29-oct-2026 con el mapa como hero (opción 3 de
// docs/puerta-b-mockups/7-landing-puertas.html); desde el 30-oct-2026 vigila el HERO LIMPIO (7c-landing-limpia.html, goal de
// Fabrizio): la tríada a pantalla completa, sin mapa. El nombre del tier quedó del primero.
//
//   1 · LAS DOS PUERTAS EN EL HERO, EN EL ORDEN DEL MOCKUP: lo revisado anoche, el título, «Verlos en el mapa →» (a /explorar
//       con `?desde=landing`), el separador «¿Tienes uno en la mira?», el campo y «Franco te dice si conviene. Ver un
//       ejemplo». Sin mapa en el hero. Se retiraron el hero compacto, la tarjeta, el rótulo y el mapa con sus grupos.
//   2 · EL NÚMERO SALE DE LA NOCHE: el del título es el número único de «convienen» (convienenHoy); el «+21.000» es lo
//       revisado del resumen de la noche, hacia abajo a miles. Sin dato, la frase sale sin cifra: ninguna cifra a mano.
//   3 · LAS DOS PUERTAS EN EL PRIMER PANTALLAZO DEL TELÉFONO, también a 360 × 640: el hero ocupa la pantalla en columna, el
//       bloque se centra en el alto que queda y el título va en px fijos (38, no en vw); en pantallas bajas se aprieta el
//       aire, no el título.
//   4 · EL TÍTULO ES EL LCP: el hero pinta solo el degradado chico (bajo 0,05 bits por píxel), sin otra imagen ni dibujo.
//   5 · EL CAMPO ES EL DE SIEMPRE, CON SU ANIMACIÓN: CampoEntrada, que escribe sola una dirección de ejemplo. «¿No tienes la
//       dirección?» vive en la hoja en el teléfono y aparece bajo el campo al enfocarlo en el PC (decisión de Fabrizio), con
//       «Ubícalo tú en el mapa» en la landing.
//   6 · LA MEDICIÓN: el botón y el campo, como eventos separados; el botón lleva la llegada de la landing.
//   7 · EL PC: el bloque a la izquierda con un margen generoso, el botón y el campo del ancho de la columna, la derecha
//       limpia y el header a lo ancho. Material fijo: igual en claro y en oscuro.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/landing-mapa-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as pl from "../../../src/lib/explorar/puertas-landing";
import { EV } from "../../../src/components/landing-v14/eventos";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) out.push(...archivos(rel));
    else if (/\.(tsx?|css)$/.test(n)) out.push(rel);
  }
  return out;
}
/** La regla CSS de un selector exacto (la primera), sin la media query. */
const regla = (css: string, sel: string) => (css.match(new RegExp(`(^|\\n)\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`)) ?? [])[2] ?? "";
/** El cuerpo de una media query (la primera que empieza así). */
const media = (css: string, cabeza: string) => {
  const i = css.indexOf(cabeza);
  if (i < 0) return "";
  let d = 0;
  for (let j = css.indexOf("{", i); j < css.length; j++) {
    if (css[j] === "{") d++;
    else if (css[j] === "}" && --d === 0) return css.slice(css.indexOf("{", i) + 1, j);
  }
  return "";
};

export async function runLandingMapaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER LANDING-MAPA (el hero limpio: las dos puertas en la primera pantalla, el número único, el título como LCP, el campo con su animación · 0 tokens) ───");

  type Props = { cabecera: ReactNode; datos: { convienen: number | null; revisados: number | null } };
  const mod = cargar<{ HeroMapa: FC<Props> }>("src/components/landing-v14/HeroMapa");
  let html = "", vacio = "";
  if (!mod) F("1 · el hero no carga");
  else {
    try {
      html = dibujar(createElement(mod.HeroMapa, { cabecera: createElement("header", { className: "cab-de-prueba" }), datos: { convienen: 4807, revisados: 21247 } }));
      vacio = dibujar(createElement(mod.HeroMapa, { cabecera: null, datos: { convienen: null, revisados: null } }));
    } catch (e) {
      F(`1 · el hero no se dibuja: ${(e as Error).message}`);
    }
  }

  // ── 1 · LAS DOS PUERTAS EN EL HERO, EN EL ORDEN DEL MOCKUP ──
  if (html) {
    const orden = [
      ["la cabecera", 'class="cab-de-prueba"'], ["lo revisado anoche", 'data-landing="hero-ojo"'], ["el título", 'data-landing="hero-titulo"'],
      ["«Verlos en el mapa →»", 'data-landing="hero-boton"'], ["el separador", 'data-landing="hero-separador"'],
      ["el campo", 'data-landing="hero-campo"'], ["«Ver un ejemplo»", 'href="/demo"'],
    ] as const;
    let previo = -1;
    for (const [que, marca] of orden) {
      const i = html.indexOf(marca);
      if (i < 0) F(`1 · el hero no tiene ${que}`);
      else if (i < previo) F(`1 · ${que} está fuera del orden del mockup`);
      previo = Math.max(previo, i);
    }
    const t = texto(html);
    for (const frase of ["Verlos en el mapa →", "¿Tienes uno en la mira?", "Franco te dice si conviene. Ver un ejemplo"]) if (!t.includes(frase)) F(`1 · el hero no dice «${frase}»`);
    if (!/<a(?=[^>]*\bhref="\/explorar\?desde=landing")(?=[^>]*data-landing="hero-boton")[^>]*>Verlos en el mapa →<\/a>/.test(html)) F("1 · «Verlos en el mapa →» no lleva a /explorar con la llegada de la landing");
    // ⚠ ACTA (30-oct-2026, el hero limpio de 7c-landing-limpia) · el mapa salió del hero: sin dibujo, sin enlace en el mapa.
    if (/<svg\b|hero-mapa-enlace|hm-mapa|hm-grupo/.test(html)) F("1 · vuelve el mapa al hero");
  }
  const pagina = codigo("src/app/page.tsx");
  if (!/<Hero cabecera=\{<HeaderFranco contexto="wizard" sobreMaterial \/>\} datos=\{\{ convienen: datos\.convienen, revisados: datos\.revisados \}\} \/>/.test(pagina) || pagina.indexOf("<Hero ") > pagina.indexOf("<RotacionEjemplos")) F("1 · la landing no abre con el hero y los datos de la noche");
  if (!/<HeroMapa cabecera=\{cabecera\} datos=\{datos\} \/>/.test(codigo("src/components/landing-v14/Secciones.tsx"))) F("1 · la sección del hero no monta el hero de las dos puertas");
  // Lo retirado: el hero compacto, la tarjeta del mapa bajo el hero, el rótulo sobre el título y el mapa del hero con sus grupos.
  if (existe("src/components/landing-v14/TarjetaExplorar.tsx") || /TarjetaExplorar|lv-explorar|lv-puertas/.test(pagina + leer("src/components/landing-v14/landing.css"))) F("1 · la tarjeta del mapa bajo el hero sigue en la landing");
  // (La frase «¿Tienes un depto en la mira?» sigue, con razón, en /deptos: lo retirado es el rótulo del hero de la landing.)
  const conRotulo = archivos("src").filter((f) => /he-root--puertas|he-rotulo|rotuloInforme/.test(leer(f)) || (/^src\/(components\/landing-v14|lib\/explorar)\//.test(f) && /¿Tienes un depto en la mira\?/.test(leer(f))));
  if (conRotulo.length) F(`1 · el rótulo o el hero compacto siguen: ${conRotulo.join(", ")}`);
  if (/export function HeroEntrada\b/.test(codigo("src/components/entrada/HeroEntrada.tsx"))) F("1 · el hero de la entrada sigue exportado sin quien lo monte (reemplazado se retira)");
  const conMapa = archivos("src").filter((f) => /gruposDeLanding|MAPA_LANDING|RADIO_CON_NUMERO|GrupoLanding|DibujoMapa/.test(codigo(f)));
  if (conMapa.length || "gruposDeLanding" in pl) F(`1 · el mapa del hero se retiró y sus piezas siguen: ${conMapa.join(", ") || "puertas-landing.ts"}`);

  // ── 2 · EL NÚMERO SALE DE LA NOCHE ──
  if (html) {
    const tit = (html.match(/data-landing="hero-titulo">([^<]*)</) ?? [])[1] ?? "";
    const ojo = (html.match(/data-landing="hero-ojo">([^<]*)</) ?? [])[1] ?? "";
    if (tit !== "Invierte en uno de los 4.807 deptos que convienen hoy.") F(`2 · el título no lleva el total de anoche: «${tit}»`);
    if (ojo !== "Cada noche Franco analiza los +21.000 deptos en venta de Santiago.") F(`2 · lo revisado no sale de la noche, hacia abajo a miles: «${ojo}»`);
  }
  if (vacio && /\d/.test(texto(vacio).replace(/Linares 1415|1415/g, ""))) F("2 · sin los datos de la noche el hero escribe una cifra igual");
  if (pl.pisoDeMiles(21_999) !== 21_000 || pl.HERO_MAPA.ojo(999).includes("+")) F("2 · lo revisado no va hacia abajo a miles (o promete una cifra con menos de mil)");
  const vivo = codigo("src/lib/landing-vivo.ts");
  // ⚠ ACTA (30-oct-2026, el hero limpio) · sin el mapa, la landing no necesita el universo: el número es convienenHoy, el único
  // de todo el sitio (tier CONVIENEN-UNO).
  if (!/convienenHoy\(\)\.then\(\(n\) => \{ if \(n == null\) aviso\("convienen", new Error\("sin el universo de la noche"\)\); return n; \}\),/.test(vivo)) F("2 · el número del título no es el número único de «convienen» (convienenHoy)");
  if (!/\.from\("config"\)\.select\("value"\)\.eq\("key", CLAVE_RESUMEN_NOCHE\)\.maybeSingle\(\)\)\s*\.then\(\(\{ data, error \}\) => \{ if \(error\) throw error; return resumenGuardado\(data\?\.value as string \| null \| undefined\)\?\.revisados \?\? null; \}\)/.test(vivo)) F("2 · lo revisado no sale del resumen de la noche guardado");
  const heroFuente = codigo("src/components/landing-v14/HeroMapa.tsx") + codigo("src/lib/explorar/puertas-landing.ts");
  if (/\b\d{1,3}\.\d{3}\b/.test(heroFuente.replace(/0\.\d+/g, ""))) F("2 · el hero escribe una cifra a mano");

  // ── 3 · LAS DOS PUERTAS EN EL PRIMER PANTALLAZO DEL TELÉFONO ──
  // ⚠ ACTA (30-oct-2026, el hero limpio) · sin mapa, lo que cedía alto ya no existe: «el mapa cede antes que el título» y «el
  // panel no se encoge» se reemplazan por el hero en columna a pantalla completa, el bloque centrado en lo que queda, el título
  // en px fijos y menos aire en pantallas bajas. La geometría (el campo dentro de 640) la mide el QA en WebKit.
  const css = codigo("src/components/landing-v14/hero-mapa.css");
  const rHm = regla(css, ".hm"), rCol = regla(css, ".hm-col"), rH1 = regla(css, ".hm-h1"), rCab = regla(css, ".hm-cab");
  if (!/display: flex; flex-direction: column; min-height: 100svh;/.test(rHm)) F("3 · el hero no ocupa la pantalla del teléfono en columna");
  if (!/flex: none;/.test(rCab) || !/flex: 1;/.test(rCol) || !/justify-content: center;/.test(rCol) || /min-height/.test(rCol)) F("3 · el bloque no se centra en el alto que deja el header");
  const gap = Number((rCol.match(/gap: (\d+)px/) ?? [])[1] ?? NaN);
  if (!(gap <= 16)) F(`3 · el bloque del teléfono va con más aire que el del mockup (gap ${gap})`);
  const h1px = Number((rH1.match(/font-size: (\d+)px;/) ?? [])[1] ?? NaN);
  if (!(h1px >= 34 && h1px <= 40) || /vw|vh/.test(rH1)) F(`3 · el título del teléfono no va en px fijos entre 34 y 40 (más grande que en el hero del mapa, sin empujar las puertas): ${h1px}`);
  const bajas = media(css, "@media (max-height: 680px) and (max-width: 899px)");
  if (!/\.hm-col \{[^}]*gap: (?:1[0-2]|[0-9])px;/.test(bajas) || /\.hm-h1/.test(bajas)) F("3 · en pantallas bajas no se aprieta el aire (o se achica el título)");

  // ── 4 · EL TÍTULO ES EL LCP ──
  if (html) {
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    if (imgs.length !== 1 || !/src="\/landing\/hero-liso-chico-m\.webp"/.test(imgs[0]) || !/srcSet="\/landing\/hero-liso-chico-d\.webp"/.test(html)) F(`4 · el hero pinta otra imagen que el degradado chico: ${imgs.join(" ")}`);
    if (/<image\b|<svg\b|<foreignObject\b|<video\b|href="data:image/.test(html)) F("4 · el hero trae otra imagen o un dibujo (competiría con el título)");
  }
  const bytes = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p)).length : Infinity);
  if ((bytes("public/landing/hero-liso-chico-m.webp") * 8) / (360 * 400) >= 0.05 || (bytes("public/landing/hero-liso-chico-d.webp") * 8) / (720 * 600) >= 0.05) F("4 · el degradado chico pasa el umbral de 0,05 bits por píxel (o no existe): Chrome lo contaría como LCP");
  if (/url\((?!"\/landing\/grano-fino\.png")/.test(css)) F("4 · el hero pinta otra imagen de fondo que el grano");

  // ── 5 · EL CAMPO DE SIEMPRE, CON SU ANIMACIÓN ──
  const entrada = codigo("src/components/landing-v14/Entrada.tsx");
  if (!/export function CampoHero\(\) \{\s*const acciones = useAccionesCampo\("hero"\);\s*return <CampoEntrada caminosAlEnfocar textoMapa=\{HERO_MAPA\.ubicarEnMapa\} \{\.\.\.acciones\} \/>;\s*\}/.test(entrada)) F("5 · el hero no monta el campo de siempre con los caminos al enfocar y «Ubícalo tú en el mapa»");
  if (!/<CampoHero \/>/.test(codigo("src/components/landing-v14/HeroMapa.tsx"))) F("5 · el hero no lleva el campo");
  const campo = codigo("src/components/entrada/HeroEntrada.tsx");
  if (!/const animar = !enfocado && !hoja && texto === "";/.test(campo) || !/\{animar && \(\s*<span className="he-ph" aria-hidden="true">\{ph\}<span className="he-caret" \/><\/span>\s*\)\}/.test(campo) || !/t = setTimeout\(tick, 60\);/.test(campo)) F("5 · el campo perdió la animación que escribe sola una dirección de ejemplo");
  if (html && !/<span class="he-ph" aria-hidden="true">Linares 1415, Providencia<span class="he-caret"><\/span><\/span>/.test(html)) F("5 · el campo del hero no arranca escribiendo la dirección de ejemplo");
  if (/\.hm-campo \.he-ph \{[^}]*display: none/.test(css) || /\.hm-campo \.he-caret \{[^}]*display: none/.test(css)) F("5 · el CSS del hero esconde la animación del campo");
  const cssCampo = codigo("src/components/entrada/hero-entrada.css");
  if (!/\.he-campo--caminos-foco \.he-alt \{ display: none; \}/.test(cssCampo) || !/@media \(min-width: 768px\) \{\s*\.he-campo--caminos-foco:focus-within \.he-alt \{ display: flex; \}\s*\}/.test(cssCampo)) F("5 · «¿No tienes la dirección?» sigue bajo el campo en reposo, o no aparece al enfocarlo en el PC");
  if (!/<div className=\{caminosAlEnfocar \? "he-campo he-campo--caminos-foco" : "he-campo"\}>/.test(campo) || !/onMouseDown=\{caminosAlEnfocar \? \(e\) => e\.preventDefault\(\) : undefined\}/.test(campo)) F("5 · el campo no marca los caminos al enfocar (o un clic en Safari los esconde antes de recibirlo)");
  if ((campo.match(/\{ocupado === "mapa" \? "Abriendo el mapa…" : textoMapa\}/g) ?? []).length !== 2 || !/textoMapa = "Marcarlo en el mapa",/.test(campo)) F("5 · la hoja y el campo no dicen el camino del mapa como lo pide quien monta (el wizard sigue con «Marcarlo en el mapa»)");
  if (pl.HERO_MAPA.ubicarEnMapa !== "Ubícalo tú en el mapa") F("5 · en la landing el camino del mapa no es «Ubícalo tú en el mapa»");
  if (html && !/class="he-campo he-campo--caminos-foco"/.test(html)) F("5 · el campo del hero no lleva los caminos al enfocar");

  // ── 6 · LA MEDICIÓN: el botón y el campo, por separado ──
  // ⚠ ACTA (30-oct-2026, el hero limpio) · `landing_mapa_click` se retiró con el mapa: quedan el botón y el campo.
  const fuenteHero = codigo("src/components/landing-v14/HeroMapa.tsx");
  if (!/className="hm-boton" evento=\{EV\.explorar\}/.test(fuenteHero) || new Set<string>([EV.explorar, EV.ctaFocus]).size !== 2 || !EV.explorar) F("6 · el botón no mide su evento, aparte del campo");
  if ("explorarMapa" in EV || archivos("src").some((f) => /landing_mapa_click/.test(codigo(f)))) F("6 · vuelve el evento del mapa del hero (landing_mapa_click)");
  if (!/hero: "landing_hero",/.test(entrada) || !/if \(e\.tipo === "foco"\) posthog\?\.capture\(EV\.ctaFocus, \{ ubicacion \}\);/.test(entrada)) F("6 · el uso del campo del hero no se mide");
  if (pl.HREF_DESDE_LANDING !== "/explorar?desde=landing") F("6 · el botón del hero no lleva la llegada de la landing (el panel no separaría la puerta E desde la landing)");

  // ── 7 · EL PC: a la izquierda, la columna, la derecha limpia ──
  const pc = media(css, "@media (min-width: 900px)");
  const izq = Number((pc.match(/\.hm-col \{[^}]*padding: [^;]*clamp\((\d+)px,/) ?? [])[1] ?? NaN);
  if (!/\.hm-col \{[^}]*align-items: flex-start;/.test(pc) || !(izq >= 48)) F(`7 · en el PC el bloque no va a la izquierda con un margen generoso (${izq})`);
  if (!/\.hm-col > \* \{ width: 100%; max-width: 600px; box-sizing: border-box; \}/.test(pc)) F("7 · en el PC el botón y el campo no van del ancho de la columna");
  if (!/\.hm-cab \.hf--material \.hf-col \{ max-width: none; \}/.test(css) || !/\.hm-cab \.hf--material \.hf-col \{ padding: 0 40px; \}/.test(pc)) F("7 · el header no va a lo ancho, con el logo a la izquierda y «Entrar» a la derecha");
  if (html) {
    // Los hijos directos de la sección: el material, el header y la columna, nada más (la derecha, limpia).
    const hijos: string[] = [];
    let prof = 0;
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g)) {
      const [, cierra, tag, attrs, sola] = m;
      const vacio = sola === "/" || /^(img|source|input|br|meta|link|hr)$/i.test(tag);
      if (cierra) { prof--; continue; }
      if (prof === 1) hijos.push(`${tag}.${(attrs.match(/class="([^"]*)"/) ?? [])[1] ?? ""}`);
      if (!vacio) prof++;
    }
    if (hijos.join(" ") !== "picture.hm-fondo div.hm-cab div.hm-col") F(`7 · el hero trae más que el material, el header y la columna (la derecha no está limpia): ${hijos.join(" ")}`);
  }
  // Material fijo: el hero no cambia con el tema (la versión oscura del mapa se fue con él).
  if (/data-theme|prefers-color-scheme/.test(css)) F("7 · el hero cambia con el tema (el material va igual en claro y en oscuro)");

  if (fallas.length) {
    console.log(`  ✗ LANDING-MAPA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el hero limpio: las dos puertas en el orden del mockup y en la primera pantalla, el número único, el título como LCP, el campo de siempre con su animación y los caminos al tocarlo, el botón y el campo medidos aparte, el PC a la izquierda");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runLandingMapaTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA (30-oct-2026, el hero limpio de 7c-landing-limpia) ──
// Se retiraron con el mapa: §3 «el mapa cede su alto antes que el título» y «el panel no se encoge»; §7 «los grupos del mapa»
// (sin pisarse, centrados, con su versión oscura); §6 el evento del mapa. Se mantienen la animación del campo, las dos puertas
// en el primer pantallazo, el número único y el título como LCP. 37 de 37 mutaciones en ROJO (runner `mutar-hero-limpio.cjs`
// en el scratchpad de la sesión cb466df3, con reintento al escribir: en Windows una restauración falló una vez por un archivo
// tomado y dejó la mutación puesta; se restauró a mano y se verificó). Entre otras: el campo sin animación; el título en 48 px
// o en vw, el bloque con más aire o un alto mínimo, sin centrar o el hero sin columna; en pantallas bajas sin apretar o
// achicando el título; el campo antes del botón; el número a mano o de otra fuente; el degradado grande, un dibujo o un fondo
// de CSS; el botón con el evento del campo o sin la llegada, vuelve landing_mapa_click; el PC centrado, sin margen, con la
// columna angosta, algo a la derecha, el header angosto o un hero que cambia con el tema; vuelven los grupos del mapa.
