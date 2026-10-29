// ============================================================================
// TIER LANDING-MAPA — el mapa es el hero de la landing (29-oct-2026, goal de Fabrizio; opción 3 de
// docs/puerta-b-mockups/7-landing-puertas.html, en teléfono y PC). Reemplaza al hero compacto y a la tarjeta del mapa de la
// puerta E.
//
//   1 · LAS DOS PUERTAS EN EL HERO, EN EL ORDEN DEL MOCKUP: lo revisado anoche, el título, «Verlos en el mapa →» (a /explorar
//       con `?desde=landing`), el separador «¿Tienes uno en la mira?», el campo y «Franco te dice si conviene. Ver un
//       ejemplo». El mapa también lleva a /explorar. Se retiraron el hero compacto, la tarjeta y el rótulo.
//   2 · EL NÚMERO SALE DE LA NOCHE: el del título es el universo de Explorar sin cuenta (pie 20 %, 25 años), el mismo que la
//       bienvenida y el mapa; el «+21.000» es lo revisado del resumen de la noche, hacia abajo a miles. Sin dato, la frase
//       sale sin cifra: ninguna cifra escrita a mano.
//   3 · LAS DOS PUERTAS EN EL PRIMER PANTALLAZO DEL TELÉFONO: el hero ocupa la pantalla, el panel no se encoge y el mapa
//       cede su alto antes que el título (que va en px fijos, no en vw).
//   4 · EL TÍTULO ES EL LCP: el mapa es un dibujo sin imágenes, el panel pinta el degradado chico (bajo 0,05 bits por píxel)
//       y no hay otra imagen en el hero.
//   5 · EL CAMPO ES EL DE SIEMPRE, CON SU ANIMACIÓN: CampoEntrada, que escribe sola una dirección de ejemplo. «¿No tienes la
//       dirección?» sale del hero: en el teléfono vive en la hoja y en el PC aparece bajo el campo al enfocarlo (decisión de
//       Fabrizio), con «Ubícalo tú en el mapa» en la landing.
//   6 · LA MEDICIÓN: el botón, el mapa y el campo, como eventos separados; los dos enlaces llevan la llegada de la landing.
//   7 · LOS GRUPOS DEL MAPA, SIN PISARSE, centrados donde están los deptos.
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
import type { PinMapa } from "../../../src/lib/explorar/portal";

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

const PIN: Pick<PinMapa, "comuna" | "lat" | "lng"> = { comuna: "Providencia", lat: -33.4263, lng: -70.617 };

export async function runLandingMapaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER LANDING-MAPA (el mapa es el hero: las dos puertas en la primera pantalla, el número de la noche, el título como LCP, el campo con su animación · 0 tokens) ───");

  type Props = { cabecera: ReactNode; datos: { explorar: { n: number; grupos: pl.GrupoLanding[] } | null; revisados: number | null } };
  const mod = cargar<{ HeroMapa: FC<Props> }>("src/components/landing-v14/HeroMapa");
  const pines = [
    ...Array.from({ length: 9 }, () => ({ ...PIN, comuna: "Santiago", lat: -33.445, lng: -70.655 })),
    ...Array.from({ length: 5 }, () => ({ ...PIN })),
    ...Array.from({ length: 3 }, () => ({ ...PIN, comuna: "La Florida", lat: -33.53, lng: -70.59 })),
  ];
  const grupos = pl.gruposDeLanding(pines);
  let html = "", vacio = "";
  if (!mod) F("1 · el hero del mapa no carga");
  else {
    try {
      html = dibujar(createElement(mod.HeroMapa, { cabecera: createElement("header", { className: "cab-de-prueba" }), datos: { explorar: { n: 4807, grupos }, revisados: 21247 } }));
      vacio = dibujar(createElement(mod.HeroMapa, { cabecera: null, datos: { explorar: null, revisados: null } }));
    } catch (e) {
      F(`1 · el hero del mapa no se dibuja: ${(e as Error).message}`);
    }
  }

  // ── 1 · LAS DOS PUERTAS EN EL HERO, EN EL ORDEN DEL MOCKUP ──
  if (html) {
    const orden = [
      ["el mapa", 'data-landing="hero-mapa-enlace"'], ["la cabecera", 'class="cab-de-prueba"'],
      ["lo revisado anoche", 'data-landing="hero-ojo"'], ["el título", 'data-landing="hero-titulo"'],
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
    if (!/<a(?=[^>]*\bhref="\/explorar\?desde=landing")(?=[^>]*data-landing="hero-mapa-enlace")[^>]*>\s*<svg/.test(html)) F("1 · tocar el mapa no lleva a /explorar con la llegada de la landing");
    if (!/<a(?=[^>]*\bhref="\/explorar\?desde=landing")(?=[^>]*data-landing="hero-boton")[^>]*>Verlos en el mapa →<\/a>/.test(html)) F("1 · «Verlos en el mapa →» no lleva a /explorar con la llegada de la landing");
  }
  const pagina = codigo("src/app/page.tsx");
  if (!/<Hero cabecera=\{<HeaderFranco contexto="wizard" sobreMaterial \/>\} datos=\{\{ explorar: datos\.explorar, revisados: datos\.revisados \}\} \/>/.test(pagina) || pagina.indexOf("<Hero ") > pagina.indexOf("<RotacionEjemplos")) F("1 · la landing no abre con el hero del mapa y los datos de la noche");
  if (!/<HeroMapa cabecera=\{cabecera\} datos=\{datos\} \/>/.test(codigo("src/components/landing-v14/Secciones.tsx"))) F("1 · la sección del hero no monta el hero del mapa");
  // Lo retirado: el hero compacto, la tarjeta del mapa bajo el hero y el rótulo sobre el título.
  if (existe("src/components/landing-v14/TarjetaExplorar.tsx") || /TarjetaExplorar|lv-explorar|lv-puertas/.test(pagina + leer("src/components/landing-v14/landing.css"))) F("1 · la tarjeta del mapa bajo el hero sigue en la landing");
  // (La frase «¿Tienes un depto en la mira?» sigue, con razón, en /deptos: lo retirado es el rótulo del hero de la landing.)
  const conRotulo = archivos("src").filter((f) => /he-root--puertas|he-rotulo|rotuloInforme/.test(leer(f)) || (/^src\/(components\/landing-v14|lib\/explorar)\//.test(f) && /¿Tienes un depto en la mira\?/.test(leer(f))));
  if (conRotulo.length) F(`1 · el rótulo o el hero compacto siguen: ${conRotulo.join(", ")}`);
  if (/export function HeroEntrada\b/.test(codigo("src/components/entrada/HeroEntrada.tsx"))) F("1 · el hero de la entrada sigue exportado sin quien lo monte (reemplazado se retira)");

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
  // El universo Y su tamaño: vigilar solo la llamada dejaba pasar un `n: 4807` fijo (LM13, verde en la primera pasada).
  if (!/universoDeLaNocheCacheado\(PIE_ABIERTO, PLAZO_ABIERTO\)\s*\.then\(\(u\) => \{ const pines = descompactar\(u\); return pines\.length \? \{ n: pines\.length, grupos: gruposDeLanding\(pines\) \} : null; \}\)/.test(vivo)) F("2 · el número del título no es el tamaño del mismo universo que Explorar sin cuenta");
  if (!/\.from\("config"\)\.select\("value"\)\.eq\("key", CLAVE_RESUMEN_NOCHE\)\.maybeSingle\(\)\)\s*\.then\(\(\{ data, error \}\) => \{ if \(error\) throw error; return resumenGuardado\(data\?\.value as string \| null \| undefined\)\?\.revisados \?\? null; \}\)/.test(vivo)) F("2 · lo revisado no sale del resumen de la noche guardado");
  const heroFuente = codigo("src/components/landing-v14/HeroMapa.tsx") + codigo("src/lib/explorar/puertas-landing.ts");
  if (/\b\d{1,3}\.\d{3}\b/.test(heroFuente.replace(/0\.\d+/g, ""))) F("2 · el hero escribe una cifra a mano");

  // ── 3 · LAS DOS PUERTAS EN EL PRIMER PANTALLAZO DEL TELÉFONO ──
  const css = codigo("src/components/landing-v14/hero-mapa.css");
  const rHm = regla(css, ".hm"), rMapa = regla(css, ".hm-mapa"), rPanel = regla(css, ".hm-panel"), rH1 = regla(css, ".hm-h1");
  if (!/display: flex; flex-direction: column; min-height: 100svh;/.test(rHm)) F("3 · el hero no ocupa la pantalla del teléfono en columna (el panel no queda abajo)");
  const pisoMapa = Number((rMapa.match(/min-height: (\d+)px/) ?? [])[1] ?? NaN);
  if (!/flex: 1 1 auto;/.test(rMapa) || !(pisoMapa <= 140)) F(`3 · el mapa no cede su alto antes que el título (flex 1 1 auto y un piso de 140 px o menos; hoy ${pisoMapa})`);
  if (!/flex: none;/.test(rPanel)) F("3 · el panel se encoge (el título o el campo quedarían bajo el pliegue)");
  if (!/font-size: 32px;/.test(rH1) || /vw|vh/.test(rH1)) F("3 · el título del teléfono no va en 32 px fijos");

  // ── 4 · EL TÍTULO ES EL LCP ──
  if (html) {
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    if (imgs.length !== 1 || !/src="\/landing\/hero-liso-chico-m\.webp"/.test(imgs[0]) || !/srcSet="\/landing\/hero-liso-chico-d\.webp"/.test(html)) F(`4 · el hero pinta otra imagen que el degradado chico: ${imgs.join(" ")}`);
    if (/<image\b|<foreignObject\b|href="data:image/.test(html)) F("4 · el dibujo del mapa trae una imagen (competiría con el título)");
    if (/data-landing="hero-mapa-enlace"[^>]*>(?:(?!<\/a>)[\s\S])*<h1/.test(html)) F("4 · el título quedó dentro del mapa");
  }
  const bytes = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p)).length : Infinity);
  if ((bytes("public/landing/hero-liso-chico-m.webp") * 8) / (360 * 400) >= 0.05 || (bytes("public/landing/hero-liso-chico-d.webp") * 8) / (720 * 600) >= 0.05) F("4 · el degradado chico pasa el umbral de 0,05 bits por píxel (o no existe): Chrome lo contaría como LCP");
  if (/url\((?!"\/landing\/grano-fino\.png")/.test(css)) F("4 · el hero pinta otra imagen de fondo que el grano");

  // ── 5 · EL CAMPO DE SIEMPRE, CON SU ANIMACIÓN ──
  const entrada = codigo("src/components/landing-v14/Entrada.tsx");
  if (!/export function CampoHero\(\) \{\s*const acciones = useAccionesCampo\("hero"\);\s*return <CampoEntrada caminosAlEnfocar textoMapa=\{HERO_MAPA\.ubicarEnMapa\} \{\.\.\.acciones\} \/>;\s*\}/.test(entrada)) F("5 · el hero no monta el campo de siempre con los caminos al enfocar y «Ubícalo tú en el mapa»");
  if (!/<CampoHero \/>/.test(codigo("src/components/landing-v14/HeroMapa.tsx"))) F("5 · el hero del mapa no lleva el campo");
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

  // ── 6 · LA MEDICIÓN: el botón, el mapa y el campo, por separado ──
  const fuenteHero = codigo("src/components/landing-v14/HeroMapa.tsx");
  if (!/className="hm-mapa" evento=\{EV\.explorarMapa\}/.test(fuenteHero) || !/className="hm-boton" evento=\{EV\.explorar\}/.test(fuenteHero)) F("6 · el mapa y el botón no miden cada uno su evento");
  if (new Set<string>([EV.explorarMapa, EV.explorar, EV.ctaFocus]).size !== 3 || !EV.explorarMapa) F("6 · el botón, el mapa y el campo no son eventos separados");
  if (!/hero: "landing_hero",/.test(entrada) || !/if \(e\.tipo === "foco"\) posthog\?\.capture\(EV\.ctaFocus, \{ ubicacion \}\);/.test(entrada)) F("6 · el uso del campo del hero no se mide");
  if (pl.HREF_DESDE_LANDING !== "/explorar?desde=landing") F("6 · los enlaces del hero no llevan la llegada de la landing (el panel no separaría la puerta E desde la landing)");

  // ── 7 · LOS GRUPOS DEL MAPA ──
  const { lado, margen } = pl.MAPA_LANDING;
  if (grupos.length !== 3 || grupos[0].comuna !== "Santiago" || grupos.some((g) => g.x < margen || g.x > lado - margen || g.y < margen || g.y > lado - margen)) F(`7 · los grupos del mapa: ${JSON.stringify(grupos)}`);
  for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) if (Math.hypot(grupos[i].x - grupos[j].x, grupos[i].y - grupos[j].y) < grupos[i].r + grupos[j].r) F("7 · dos grupos del mapa se pisan");
  // Dos comunas con el centro a medio kilómetro: el grupo más chico de los dos no entra (QA del 29-oct-2026, la cifra de abajo
  // se tapaba). A la escala del hero, Providencia y Ñuñoa ya caben sin tocarse.
  const vecinos = pl.gruposDeLanding([PIN, PIN, { ...PIN, comuna: "Vecina", lat: -33.43, lng: -70.612 }]);
  if (vecinos.length !== 1 || vecinos[0].comuna !== "Providencia") F("7 · el mapa dibuja dos grupos uno encima del otro");
  // Centrado en los deptos: el teléfono ve solo el centro del dibujo.
  const cx = grupos.reduce((s, g) => s + g.x * g.n, 0) / grupos.reduce((s, g) => s + g.n, 0);
  if (Math.abs(cx - lado / 2) > 60) F(`7 · el dibujo no está centrado en los deptos (el teléfono vería el borde): ${Math.round(cx)}`);
  if (html && (html.match(/<g class="hm-grupo">/g) ?? []).length !== grupos.length) F("7 · el mapa no dibuja los grupos");
  if (!/html:not\(\[data-theme="light"\]\) \.hm \{/.test(css)) F("7 · el mapa no tiene su versión oscura");

  if (fallas.length) {
    console.log(`  ✗ LANDING-MAPA · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el mapa es el hero: las dos puertas en el orden del mockup y en la primera pantalla, el número de la noche, el título como LCP, el campo de siempre con su animación y los caminos al tocarlo, tres eventos separados");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runLandingMapaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
