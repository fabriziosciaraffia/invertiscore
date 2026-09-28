/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// ============================================================================
// GOLDEN · EL HEADER ÚNICO — catch-test (27-sep-2026). 0 tokens, sin base.
// ============================================================================
// Mockup aprobado por Fabrizio: docs/wireframes/rediseno-informe/header-unico-aprobado.html,
// estilo E (la banda con el material del hero de la landing). Componente: HeaderFranco.tsx.
//
// FIJA:
//   1 · UN SOLO COMPONENTE DE HEADER EN EL SITIO. Ningún otro archivo dibuja un <header> (salvo la
//       lista de excepciones, cada una con su razón); los cinco de antes no vuelven; cada página que
//       tenía cabecera monta HeaderFranco.
//   2 · LA BANDA DERIVADA DE LOS TOKENS DE LA TRÍADA, nunca de hexes; con bloom y grano; 56 / 64 px.
//   3 · SIN ROJO EN EL BOTÓN SOBRE LA BANDA: el principal va en tinta.
//   4 · SIN MONO.
//   5 · EL WORDMARK INVERTIDO Y FIEL: el FrancoLogo de siempre, con «re» en papel tenue y «franco»
//       en blanco; el «.ai» sigue en el rojo de marca.
//   6 · LAS SIETE DECISIONES del mockup, medidas en el HTML que el componente dibuja.
//   7 · LA IDENTIDAD AL BAJAR: la dirección, ChipVeredicto sobre la banda y el puntaje, leídos de la
//       portada misma.
//   8 · CON UN POP-UP ABIERTO, EL HEADER NO CAMBIA: no escucha modales y queda bajo su velo.
// Verificado EN ROJO por mutación (actas al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/header-unico-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

(globalThis as any).React = React;
// HeaderFranco importa su CSS; en node se carga como módulo vacío para poder dibujarlo.
(require as any).extensions[".css"] = (m: any) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) out.push(...archivos(rel));
    else if (/\.tsx$/.test(n)) out.push(relative(RAIZ, join(RAIZ, rel)).split(sep).join("/"));
  }
  return out;
}

/** Un <header> que NO es la cabecera del sitio, con su razón. Por archivo y por su clase. */
const EXCEPCIONES_HEADER: { archivo: string; clase: RegExp; razon: string }[] = [
  { archivo: "src/app/admin/usuarios/[id]/page.tsx", clase: /mb-8 flex/, razon: "el encabezado de la ficha de un usuario dentro del panel: semántico, no una cabecera del sitio" },
];

/** Las páginas que tenían cabecera y ahora montan el header único. */
const PAGINAS = [
  "src/app/page.tsx", "src/app/about/page.tsx", "src/app/aprende/page.tsx", "src/app/checkout/page.tsx",
  "src/app/cobertura/page.tsx", "src/app/comunas/page.tsx", "src/app/comunas/[slug]/page.tsx", "src/app/contact/page.tsx",
  "src/app/faq/page.tsx", "src/app/metodologia/page.tsx", "src/app/payments/return/page.tsx", "src/app/pricing/page.tsx",
  "src/app/privacy/page.tsx", "src/app/terms/page.tsx", "src/app/cuenta/page.tsx", "src/app/perfil/page.tsx",
  "src/app/comparar/comparar-client.tsx", "src/app/dashboard/page.tsx", "src/app/login/page.tsx", "src/app/register/page.tsx",
  "src/app/recuperar/page.tsx", "src/app/restablecer/page.tsx", "src/components/formulario-v4/WizardV4.tsx",
  "src/components/formulario-v4/screenEntrada.tsx", "src/app/analisis/[id]/informe-ltr.tsx",
  "src/app/analisis/renta-corta/[id]/results-client.tsx", "src/app/analisis/comparativa/comparativa-client.tsx",
  "src/app/share/comparativa/[token]/shared-client.tsx", "src/app/demo/demo-cabecera.tsx", "src/app/admin/layout.tsx",
];

/** La regla CSS de un selector exacto (la primera). */
function regla(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return "";
  return css.slice(i, css.indexOf("\n}", i) + 2);
}

export function runHeaderUnicoTier(): { hard: number } {
  console.log("\n─── TIER HEADER-ÚNICO (un solo header, la banda de la tríada · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const HDR = "src/components/chrome/HeaderFranco.tsx";
  const CSSP = "src/components/chrome/header-franco.css";
  const hdr = sinComentarios(leer(HDR));
  const css = leer(CSSP);

  // ── 1 · UN SOLO COMPONENTE ─────────────────────────────────────────────────
  const todos = [...archivos("src/app"), ...archivos("src/components")];
  if (todos.length < 200) F(`1 · el recorrido leyó ${todos.length} archivos: no encontró el sitio`);
  for (const p of todos) {
    if (p === HDR) continue;
    const src = sinComentarios(leer(p));
    for (const m of src.matchAll(/<header\b([^>]*)>/g)) {
      const exc = EXCEPCIONES_HEADER.find((e) => e.archivo === p && e.clase.test(m[1] ?? ""));
      if (!exc) F(`1 · ${p}: dibuja su propio <header${(m[1] ?? "").slice(0, 60)}> (el único es HeaderFranco)`);
    }
    if (/\bUnifiedNav\b|\bPublicShareHeader\b|\bConversionHook\b/.test(src)) F(`1 · ${p}: vuelve UnifiedNav, PublicShareHeader o la franja ConversionHook`);
  }
  for (const viejo of ["src/components/chrome/UnifiedNav.tsx", "src/components/chrome/PublicShareHeader.tsx", "src/app/analisis/[id]/analysis-nav.tsx"]) {
    if (existsSync(join(RAIZ, viejo))) F(`1 · sigue vivo ${viejo}`);
  }
  for (const p of PAGINAS) {
    if (!/<HeaderFranco\b/.test(sinComentarios(leer(p)))) F(`1 · ${p} no monta el header único`);
  }
  const heroEnt = sinComentarios(leer("src/components/entrada/HeroEntrada.tsx"));
  if (/he-top|he-wm|\bderecha\b/.test(heroEnt) || !/\{cabecera\}/.test(heroEnt)) F("1 · el hero de la entrada vuelve a dibujar su propia cabecera");
  if (!/cabecera=\{<HeaderFranco contexto="wizard" sobreMaterial \/>\}/.test(sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx")))) F("1 · la portada del wizard no monta el header único sobre el material");
  const demo = sinComentarios(leer("src/app/demo/demo-cabecera.tsx"));
  if (/FrancoLogo|CtaAnalizar|signal-red/.test(demo)) F("1 · el demo vuelve a tener wordmark o botón propios");

  // ── 2 · LA BANDA, DE LOS TOKENS DE LA TRÍADA ───────────────────────────────
  const banda = regla(css, ".hf");
  const fondo = (banda.match(/background:([\s\S]*?);\n/) ?? [])[1] ?? "";
  if (!fondo) F("2 · no encuentro el fondo de la banda (el extractor no corrió)");
  for (const t of ["--verdict-comprar", "--verdict-ajusta", "--verdict-buscar"]) {
    if (!fondo.includes(`var(${t})`)) F(`2 · la banda no deriva de ${t}`);
  }
  if (/#[0-9a-fA-F]{3,8}\b/.test(fondo)) F("2 · la banda lleva hexes: tiene que derivarse de los tokens de la tríada");
  if (!/linear-gradient\(104deg/.test(fondo) || (fondo.match(/radial-gradient\(/g) ?? []).length < 2) F("2 · la banda perdió el degradado en diagonal o el bloom");
  if (!/\.hf::after \{[^}]*grano-256\.png/.test(css)) F("2 · la banda perdió el grano");
  if (!/height: 56px;/.test(banda) || !/@media \(min-width: 768px\) \{\s*\n\s*\.hf \{ height: 64px; \}/.test(css)) F("2 · la banda no mide 56 a 390 y 64 desde 768");
  if (!/:root\{--verdict-buscar:#C8323C; --verdict-ajusta:#6E4560; --verdict-comprar:#2B558F\}/.test(leer("src/app/globals.css"))) F("2 · los tokens de la tríada no están declarados en :root: la banda no resolvería");

  // ── 3 · SIN ROJO EN EL BOTÓN SOBRE LA BANDA ────────────────────────────────
  const btn = regla(css, ".hf-btn");
  if (!/background: var\(--ink-900\);/.test(btn)) F("3 · el botón principal no va en tinta");
  for (const m of css.matchAll(/\.hf-btn[^{]*\{[^}]*\}/g)) {
    if (/signal|verdict-buscar|#C8323C|#c8323c/.test(m[0])) F("3 · una regla del botón lo pinta de rojo");
  }
  if (/signal-red|#C8323C|bg-red|text-red/.test(hdr) || /signal|#C8323C/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ""))) F("3 · el header usa el rojo (el único rojo es el «.ai» del wordmark, que pone FrancoLogo)");

  // ── 4 · SIN MONO ───────────────────────────────────────────────────────────
  if (/font-mono|--font-mono|JetBrains|monospace/.test(hdr + css)) F("4 · el header usa mono");

  // ── 5 · EL WORDMARK INVERTIDO Y FIEL ───────────────────────────────────────
  if (!/<FrancoLogo size="banda"/.test(hdr)) F("5 · el wordmark no es el FrancoLogo de siempre");
  if (!/--franco-wm-re: rgb\(250 250 248 \/ 0\.55\);/.test(banda) || !/--franco-wm-franco: rgb\(255 255 255\);/.test(banda)) F("5 · el wordmark no va invertido («re» papel tenue, «franco» blanco)");
  const logo = leer("src/components/franco-logo.tsx");
  if (!/className="font-heading italic font-normal/.test(logo) || !/text-\[#C8323C\]/.test(logo) || !/banda: \{ text: "text-\[22px\] md:text-\[26px\]"/.test(logo)) F("5 · el wordmark dejó de ser el de la marca (serif, «re» en cursiva, «.ai» en el rojo de marca)");

  // ── 6 · LAS SIETE DECISIONES, EN EL HTML ───────────────────────────────────
  const { HeaderFranco } = require("../../../src/components/chrome/HeaderFranco");
  const dibujar = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(HeaderFranco, props));
  const sinSesion = dibujar({ sesion: null });
  const conSesion = dibujar({ sesion: { email: "fabrizio@refranco.ai" }, activo: "mis" });
  const wizard = dibujar({ contexto: "wizard", sesion: null });
  const wizardCon = dibujar({ contexto: "wizard", sesion: { email: "a@b.cl" } });
  const compartido = dibujar({ informe: { modo: "compartido", fecha: "23 de septiembre de 2026" } });
  const anonimo = dibujar({ informe: { modo: "anonimo", registroNext: "/analisis/x" } });
  const ejemplo = dibujar({ sesion: null, informe: { modo: "ejemplo" } });
  const auth = dibujar({ contexto: "auth", sesion: null });
  const cuenta = (h: string) => (h.match(/class="hf-btn/g) ?? []).length;
  // 1 · enlaces largos al pie
  if (/href="\/metodologia"|href="\/comunas"|>Qué<|>Cómo<|>Precios</.test(sinSesion + conSesion)) F("6.1 · los enlaces largos volvieron al header (van al pie)");
  if (!/class="hf-lnk hf-solo-ancho on" href="\/dashboard">Mis análisis</.test(conSesion) || !/class="hf-lnk hf-solo-ancho" href="\/pricing">Planes</.test(conSesion)) F("6.1 · con sesión, «Mis análisis» y «Planes» no quedan solo desde 768");
  const pie = leer("src/components/chrome/AppFooter.tsx");
  if (!/\{ href: "\/metodologia", rotulo: "Cómo calcula" \}/.test(pie) || !/\{ href: "\/comunas", rotulo: "Comunas" \}/.test(pie) || !/\{ href: "\/pricing", rotulo: "Planes" \}/.test(pie)) F("6.1 · el pie no lleva los enlaces largos");
  // 2 · un solo botón principal por pantalla; el wizard sin botón
  // «Lo que sigue» (28-sep-2026): el dueño sin cuenta ya no lleva botón principal en el header —el
  // registro vive en el banner después de la card y en su barra fija—; queda «Entrar».
  for (const [h, n] of [[sinSesion, "sin sesión"], [conSesion, "con sesión"], [compartido, "compartido"]] as const) {
    if (cuenta(h) !== 1) F(`6.2 · ${n}: el header no lleva exactamente un botón principal (${cuenta(h)})`);
  }
  if (cuenta(wizard) !== 0 || cuenta(wizardCon) !== 0) F("6.2 · el wizard lleva botón en el header: el principal de la pantalla es avanzar");
  if (/Analizar inversión/.test(sinComentarios(leer("src/app/dashboard/page.tsx")))) F("6.2 · vuelve «Analizar inversión →» al dashboard: dos botones principales");
  if (!/>Analizar el mío</.test(compartido)) F("6.2 · el informe compartido perdió su botón");
  if (cuenta(anonimo) !== 0 || /Guardarlo/.test(anonimo) || !/>Entrar</.test(anonimo)) F("6.2 · el dueño sin cuenta tiene que ver solo «Entrar» en el header: el registro vive en el banner de «Lo que sigue»");
  // 3 · con sesión el tema va al menú de cuenta
  if (/aria-label="Cambiar a modo/.test(conSesion)) F("6.3 · con sesión, el tema sigue en la barra (va al menú de cuenta)");
  if (!/aria-label="Cambiar a modo/.test(sinSesion)) F("6.3 · sin sesión, el tema no queda como ícono");
  if (!/<span>Tema<\/span>[\s\S]{0,200}?>Claro<\/button>[\s\S]{0,200}?>Oscuro<\/button>/.test(hdr)) F("6.3 · el menú de cuenta no lleva el tema");
  if (!/<BotonTema className="hf-solo-ancho" \/>/.test(hdr)) F("6.3 · en el informe compartido el tema no sale a 390");
  // 4 · a 390 los rótulos se acortan
  if (!/<span class="hf-largo">Analizar departamento<\/span><span class="hf-corto">Analizar<\/span>/.test(sinSesion) || !/@media \(max-width: 767px\) \{\s*\n\s*\.hf-largo \{ display: none; \}\s*\n\s*\.hf-corto \{ display: inline; \}/.test(css)) F("6.4 · a 390 el rótulo no se acorta");
  // 5 · Eliminar sale del header del informe
  if (/DeleteButton|Trash2|Eliminar/.test(hdr)) F("6.5 · Eliminar volvió al header");
  const ltr = sinComentarios(leer("src/app/analisis/[id]/informe-ltr.tsx"));
  if (!/\{!demo && isLoggedIn && !isSharedView && !isSubordinated && \(\s*\n\s*<div className="mt-12 flex justify-center">\s*\n\s*<DeleteButton id=\{analisis\.id\} \/>/.test(ltr)) F("6.5 · Eliminar no quedó al pie del informe LTR");
  if (!/Verifica los datos antes de tomar decisiones financieras\.[\s\S]{0,400}?\{p\.isOwner && \([\s\S]{0,300}?onClick=\{handleDeleteGroup\}/.test(sinComentarios(leer("src/app/analisis/comparativa/comparativa-client.tsx")))) F("6.5 · Eliminar no quedó al pie de la comparativa");
  // 6 · el demo se ve como sin sesión
  if (ejemplo !== sinSesion) F("6.6 · el demo no se ve como sin sesión");
  if (!/isDemo\s*\n?\s*\? \{ modo: "ejemplo" \}/.test(ltr) || !/<HeaderFranco informe=\{\{ modo: "ejemplo" \}\} \/>/.test(demo)) F("6.6 · el demo no pasa como ejemplo");
  // 7 · sin eslogan
  if (/estado más franco|TAGLINE|showTagline/i.test(hdr + sinSesion)) F("6.7 · el eslogan volvió al header");
  if (auth.includes("hf-der")) F("6 · en login y registro el header lleva algo más que el wordmark");

  // ── 7 · LA IDENTIDAD AL BAJAR ──────────────────────────────────────────────
  if (!/<ChipVeredicto v=\{identidad\.veredicto\} variante="sobre-fondo" \/>/.test(hdr)) F("7 · la identidad no usa ChipVeredicto sobre la banda");
  if (!/document\.querySelector\("section\.doc-portada"\)/.test(hdr) || !/getAttribute\("data-verdict"\)/.test(hdr) || !/getAttribute\("data-direccion"\)/.test(hdr) || !/getAttribute\("data-score"\)/.test(hdr)) F("7 · la identidad no se lee de la portada");
  if (!/<section className="doc-portada doc-hero" data-verdict=\{veredicto\} data-score=\{score \?\? ""\} data-direccion=\{direccion \|\| comuna\}>/.test(sinComentarios(leer("src/components/analysis/portada/PortadaInforme.tsx")))) F("7 · la portada no publica la identidad que dibuja");
  if (!/rootMargin: "-64px 0px 0px 0px"/.test(hdr)) F("7 · la identidad no aparece cuando la portada pasa bajo el header");
  if (!/@media \(max-width: 767px\) \{[\s\S]*?\.hf--fijo \.hf-wm, \.hf--fijo \.hf-oculta-fija \{ display: none !important; \}/.test(css)) F("7 · a 390 la identidad no toma el lugar del wordmark");

  // ── 8 · CON UN POP-UP ABIERTO, EL HEADER NO CAMBIA ─────────────────────────
  if (/v-modal|pilaHojas|body\.style|he-hoja/.test(hdr)) F("8 · el header escucha a los pop-ups: con uno abierto tiene que quedar igual");
  const zHeader = Number((banda.match(/z-index: (\d+);/) ?? [])[1]);
  const zVelo = Number((leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx").match(/\.v-modal-overlay\{position:fixed;inset:0;[^}]*z-index:(\d+)/) ?? [])[1]);
  if (!zHeader || !zVelo || zHeader >= zVelo) F(`8 · el header (z ${zHeader}) no queda bajo el velo de los pop-ups (z ${zVelo})`);

  if (fallas.length) {
    console.log(`  ✗ HEADER-ÚNICO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — un solo header en el sitio, la banda sale de los tokens de la tríada, el botón en tinta, sin mono, el wordmark fiel, las siete decisiones en el HTML, la identidad leída de la portada y el header quieto bajo los pop-ups");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runHeaderUnicoTier().hard ? 1 : 0);
}

// ACTAS DE MUTACIÓN (27-sep-2026) — cada una aplicada, corrida contra este tier y restaurada.
// Las 30 en ROJO; restauradas, VERDE. 1a una página dibuja su <header> · 1b una página sin el
// header único · 1c el hero vuelve a su cabecera · 1d el demo vuelve a su wordmark · 2a la banda
// con un hex · 2b sin grano · 2c a 60 px · 2d sin bloom · 3a el botón en rojo · 3b rojo al pasar ·
// 3c rojo en el header · 4 mono · 5a otro wordmark · 5b sin invertir · 6.1a un enlace largo en la
// barra · 6.1b el pie sin Comunas · 6.2a el wizard con botón · 6.2b vuelve «Analizar inversión →»
// · 6.3a con sesión el tema en la barra · 6.3b el menú sin tema · 6.4 sin rótulo corto · 6.5a
// Eliminar vuelve al header · 6.5b Eliminar sale del pie · 6.6 el demo como compartido · 6.7
// vuelve el eslogan · 7a el chip sin la variante sobre fondo · 7b la portada sin la dirección
// publicada · 7c sin el margen del header · 8a el header escucha al pop-up · 8b el header sobre
// el velo.
