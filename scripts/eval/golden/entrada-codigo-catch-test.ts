/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// ============================================================================
// GOLDEN · UNA SOLA ENTRADA: EL CÓDIGO — catch-test (01-oct-2026). 0 tokens, sin base.
// ============================================================================
// Decisiones de Fabrizio (01-oct-2026). Las cuentas nacen por código; entrar también:
//   1 · /entrar es la entrada. Copy EXACTO por contexto (genérico · pack · informe · semanal) y
//       después de mandar; sin informe NUNCA dice «este informe»; sin mono ni mayúsculas.
//       /registro redirige a /entrar con toda su query. /login (contraseña) queda para cuentas viejas.
//   2 · «Entrar» del header —en todos sus estados— lleva a /entrar con `next` (nunca a /login).
//       El `next` se valida: solo rutas internas; externo, «//» o «/\» → /dashboard.
//   3 · Con sesión, el avatar con su menú en TODAS las páginas, también landing y wizard.
//   4 · Después del código en el banner del informe, la página se refresca (header y ticket dejan
//       de tratarlo como anónimo) y «Estás dentro» sobrevive al refresco (marca «recién dentro»).
//   5 · La bienvenida sale al registrarse por código (claim con `porCodigo`) y en /auth/callback.
//   6 · Ningún correo a la persona saluda con resolveDisplayName (la parte del correo antes de la
//       @): nombreReal(user_metadata), y sin nombre «Hola,».
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/entrada-codigo-catch-test.ts
// ============================================================================
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  ENTRAR, ENTRAR_CONTEXTO, contextoEntrada, destinoTrasEntrar, hrefConContrasena, hrefEntrar, type ContextoEntrada,
} from "../../../src/lib/entrar/entrada";
import { CLAVE_RECIEN_DENTRO, VIGENCIA_RECIEN_DENTRO_MS, leerRecienDentro, marcarRecienDentro } from "../../../src/lib/lo-que-sigue/recien-dentro";

(globalThis as any).React = React;
(require as any).extensions[".css"] = (m: any) => { m.exports = {}; };

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|escribí|pedí|usá|mandá|volvés|estabas vos|vos)(?![a-záéíóúñ])/i;
const INFORME_UUID = "/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1";

function archivos(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) out.push(...archivos(rel, ext));
    else if (ext.test(n)) out.push(relative(RAIZ, join(RAIZ, rel)).split(sep).join("/"));
  }
  return out;
}

/** Un almacén en memoria con la forma de sessionStorage. */
function almacen(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

/** Dibuja un componente cliente con un router de app falso (useRouter exige uno montado). */
function dibujarConRouter(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}

/** Los textos visibles de un HTML (sin etiquetas), para buscar frases. */
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Excepciones declaradas al saludo: archivos que el goal no pudo tocar, con su razón. */
// La del informe de una tarjeta de la guía se cerró en la integración (02-oct-2026): ya no queda ninguna.
const EXCEPCIONES_SALUDO: { archivo: string; razon: string }[] = [];

export function runEntradaCodigoTier(): { hard: number } {
  console.log("\n─── TIER ENTRADA-CÓDIGO (una sola entrada: el código · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · EL COPY, EXACTO POR CONTEXTO ───────────────────────────────────────
  const esperado: Record<ContextoEntrada, [string, string]> = {
    generico: ["Entra a Franco", "Te mandamos un código a tu correo. Sin contraseña."],
    pack: ["Entra con el correo con que pagaste", "Ahí están tus 3 análisis y los deptos que Franco revisó para ti. Te mandamos un código."],
    informe: ["Guarda este informe en tu cuenta.", "Te mandamos un código; el informe queda en tu cuenta."],
    semanal: ["Entra para analizarlo.", "El depto que elegiste te espera."],
  };
  for (const [ctx, [t, b]] of Object.entries(esperado) as [ContextoEntrada, [string, string]][]) {
    if (ENTRAR_CONTEXTO[ctx]?.titulo !== t || ENTRAR_CONTEXTO[ctx]?.bajada !== b) F(`1 · el copy del contexto «${ctx}» no es el aprobado`);
  }
  if (ENTRAR.mandarCodigo !== "Mandar el código" || ENTRAR.o !== "o" || ENTRAR.google !== "Seguir con Google") F("1 · el botón, el separador o Google no son los aprobados");
  if (`${ENTRAR.conContrasenaPregunta} ${ENTRAR.conContrasenaEnlace}` !== "¿Tu cuenta es de antes y tiene contraseña? Entra con contraseña") F("1 · la línea de las cuentas con contraseña no es la aprobada");
  if (ENTRAR.enviadoTitulo !== "Revisa tu correo" || ENTRAR.enviadoCuerpo("ana@correo.cl") !== "Mandamos un código de 6 dígitos a ana@correo.cl. Escríbelo acá y vuelves a donde estabas." || ENTRAR.entrar !== "Entrar") F("1 · después de mandar, el título, el cuerpo o «Entrar» no son los aprobados");
  if (`${ENTRAR.noLlego} ${ENTRAR.mandarDeNuevo} · ${ENTRAR.otroCorreo}` !== "¿No llegó? Revisa spam o mándalo de nuevo · Usar otro correo") F("1 · «¿No llegó?…» no es la línea aprobada");
  // Sin informe, nunca «este informe»: el contexto informe solo vale con un informe de destino.
  if (contextoEntrada("informe", "/dashboard") !== "generico" || contextoEntrada("informe", null) !== "generico" || contextoEntrada("informe", "/analisis/nuevo-v4") !== "generico") F("1 · «informe» sin un informe de destino no cae al genérico: diría «este informe» sin informe");
  if (contextoEntrada("informe", INFORME_UUID) !== "informe" || contextoEntrada("informe", `/analisis/renta-corta/${INFORME_UUID.slice(10)}`) !== "informe") F("1 · «informe» con un informe de destino no usa su copy");
  if (contextoEntrada("pack", "/dashboard") !== "pack" || contextoEntrada("semanal", "/x") !== "semanal" || contextoEntrada("cualquiera", "/x") !== "generico" || contextoEntrada(null, "/x") !== "generico") F("1 · los contextos pack / semanal / desconocido no se resuelven bien");
  const todos = [...Object.values(ENTRAR).map((v) => (typeof v === "function" ? v("a@b.cl") : v)), ...Object.values(ENTRAR_CONTEXTO).flatMap((c) => [c.titulo, c.bajada])];
  for (const t of todos) if (VOSEO.test(t)) F(`1 · voseo en el copy: «${t}»`);
  for (const [ctx, c] of Object.entries(ENTRAR_CONTEXTO)) {
    if (ctx !== "informe" && /este informe/i.test(`${c.titulo} ${c.bajada}`)) F(`1 · el contexto «${ctx}» dice «este informe»`);
  }
  if (Object.values(ENTRAR).some((v) => /este informe/i.test(typeof v === "function" ? v("a@b.cl") : v))) F("1 · el formulario dice «este informe» fuera del contexto del informe");

  // Lo que el formulario DIBUJA, en cada contexto (con un router falso).
  const { EntrarConCodigo } = require("../../../src/components/entrar/EntrarConCodigo");
  for (const ctx of Object.keys(esperado) as ContextoEntrada[]) {
    const next = ctx === "informe" ? INFORME_UUID : "/comunas";
    const html = dibujarConRouter(createElement(EntrarConCodigo, { next, ctx }));
    const t = texto(html);
    const [titulo, bajada] = esperado[ctx];
    if (!t.includes(titulo) || !t.includes(bajada)) F(`1 · el formulario «${ctx}» no dibuja su título y bajada`);
    if (!t.includes("Mandar el código") || !t.includes("Seguir con Google") || !t.includes("¿Tu cuenta es de antes y tiene contraseña? Entra con contraseña")) F(`1 · el formulario «${ctx}» no dibuja el botón, Google o la línea de la contraseña`);
    if (ctx !== "informe" && /este informe/i.test(t)) F(`1 · el formulario «${ctx}» dice «este informe» sin informe`);
    if (!html.includes(`href="/login?next=${encodeURIComponent(next)}"`)) F(`1 · «Entra con contraseña» no lleva a /login con el next (${ctx})`);
    if (/<h1[^>]*>/.test(html) && !/<h1 class="font-heading/.test(html)) F("1 · el título no va en Source Serif");
  }
  const comp = sinComentarios(leer("src/components/entrar/EntrarConCodigo.tsx"));
  if (/font-mono|--font-mono|JetBrains|monospace|uppercase/.test(comp)) F("1 · el formulario usa mono o mayúsculas");
  if (/#[0-9a-fA-F]{6}\b(?![\s\S]{0,40}<\/svg>)/.test(comp.replace(/<svg[\s\S]*?<\/svg>/g, ""))) F("1 · el formulario usa hexes en vez de los tokens --franco-*");
  if (!/var\(--font-ui\)/.test(comp) || !/var\(--franco-text\)/.test(comp) || !/var\(--franco-border\)/.test(comp)) F("1 · el formulario no usa Inter (--font-ui) ni los tokens --franco-*");
  if (!/verifyOtp\(\{ email: enviado, token: t, type: "email" \}\)/.test(comp) || !/maxLength=\{CODIGO_MAX\}/.test(comp) || !/codigoValido\(t\)/.test(comp)) F("1 · el código no se verifica con type «email» o no acepta de 6 a 8 dígitos (CODIGO_MAX / codigoValido)");
  // /registro sigue vivo: redirige a /entrar con TODA su query.
  const reg = sinComentarios(leer("src/app/registro/page.tsx"));
  if (/RegistroUnPaso/.test(reg)) F("1 · /registro vuelve a dibujar el registro del banner (dice «este informe» sin informe)");
  try {
    const RegistroPage = require("../../../src/app/registro/page").default;
    let destino = "";
    try { RegistroPage({ searchParams: { next: "/checkout?product=pack", ctx: "pack" } }); } catch (e: any) { destino = String(e?.digest ?? ""); }
    if (!destino.includes("/entrar?next=%2Fcheckout%3Fproduct%3Dpack&ctx=pack")) F(`1 · /registro no redirige a /entrar conservando next y ctx (${destino || "no redirigió"})`);
  } catch (e) {
    F(`1 · no pude cargar /registro (${(e as Error).message.slice(0, 80)})`);
  }
  const pagina = sinComentarios(leer("src/app/entrar/page.tsx"));
  if (!/const next = destinoTrasEntrar\(sp\.get\("next"\)\);/.test(pagina) || !/contextoEntrada\(sp\.get\("ctx"\), next\)/.test(pagina)) F("1 · /entrar no valida el next o no resuelve el contexto con él");
  const mw = sinComentarios(leer("src/lib/supabase/middleware.ts"));
  if (!/pathname === "\/entrar"/.test(mw) || !/"\/entrar"/.test(sinComentarios(leer("src/middleware.ts")))) F("1 · con sesión, /entrar no manda directo al next (middleware)");
  if (!/url\.pathname = "\/entrar";/.test(mw)) F("1 · las rutas protegidas sin sesión siguen mandando a /login (la entrada es el código)");
  const login = sinComentarios(leer("src/app/login/page.tsx"));
  if (!/router\.push\(esDestinoSeguro\(next\) \? next : "\/dashboard"\)/.test(login)) F("1 · /login (cuentas viejas) dejó de respetar el next validado");

  // ── 2 · «ENTRAR» DEL HEADER → /entrar CON NEXT; EL NEXT SE VALIDA ──────────
  for (const [entrada, salida] of [
    ["https://evil.cl/x", "/dashboard"], ["//evil.cl", "/dashboard"], ["/\\evil.cl", "/dashboard"], ["evil.cl", "/dashboard"],
    [null, "/dashboard"], ["", "/dashboard"], ["/entrar?next=/x", "/dashboard"], ["/login", "/dashboard"], ["/registro?next=/x", "/dashboard"],
    ["/analisis/abc?x=1", "/analisis/abc?x=1"], ["/comunas/nunoa", "/comunas/nunoa"], ["/", "/"],
  ] as const) {
    if (destinoTrasEntrar(entrada) !== salida) F(`2 · el next «${entrada}» da «${destinoTrasEntrar(entrada)}» (esperado «${salida}»)`);
  }
  if (hrefEntrar("//evil.cl") !== "/entrar?next=%2Fdashboard" || hrefEntrar("/comunas", "pack") !== "/entrar?next=%2Fcomunas&ctx=pack" || hrefEntrar("/comunas") !== "/entrar?next=%2Fcomunas") F("2 · hrefEntrar no arma /entrar con el next validado (y el ctx)");
  if (hrefConContrasena("https://evil.cl") !== "/login?next=%2Fdashboard") F("2 · el enlace a /login no valida el next");
  const { HeaderFranco } = require("../../../src/components/chrome/HeaderFranco");
  const dibujar = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(HeaderFranco, props));
  const estados: [string, string][] = [
    ["sin sesión", dibujar({ sesion: null })],
    ["wizard sin sesión", dibujar({ contexto: "wizard", sesion: null })],
    ["informe compartido", dibujar({ informe: { modo: "compartido", fecha: "1 de octubre" } })],
    ["informe anónimo", dibujar({ informe: { modo: "anonimo", registroNext: "/analisis/x" } })],
    ["demo", dibujar({ sesion: null, informe: { modo: "ejemplo" } })],
  ];
  for (const [nombre, html] of estados) {
    const entrar = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>Entrar<\/a>/g)].map((m) => m[1]);
    if (!entrar.length) F(`2 · ${nombre}: el header no lleva «Entrar»`);
    for (const h of entrar) if (!/^\/entrar\?next=%2F/.test(h)) F(`2 · ${nombre}: «Entrar» va a «${h}» (tiene que ser /entrar con next)`);
    if (/href="\/login/.test(html)) F(`2 · ${nombre}: el header lleva a /login`);
  }
  if (!/\/entrar\?next=[^"]*&amp;ctx=informe/.test(estados[3][1])) F("2 · desde el informe anónimo, «Entrar» no usa el copy del informe (ctx=informe)");
  const hdr = sinComentarios(leer("src/components/chrome/HeaderFranco.tsx"));
  if (/href="\/login"|href=\{"\/login"\}|assign\("\/login"\)/.test(hdr)) F("2 · el header vuelve a enlazar /login pelado");
  if (!/const hrefEntrada = hrefEntrar\(rutaActual, modo === "anonimo" \? "informe" : "generico"\);/.test(hdr)) F("2 · «Entrar» no arma su href con la ruta actual");
  const marca = sinComentarios(leer("src/components/landing-v14/Marca.tsx"));
  if (/href="\/login"/.test(marca)) F("2 · el pie de la landing lleva «Entrar» a /login");
  const dpp = sinComentarios(leer("src/components/lo-que-sigue/DespuesDePagar.tsx"));
  if (!/hrefEntrar\(destino, "pack"\)/.test(dpp)) F("2 · después de pagar sin sesión, el botón no entra por el código con el copy del pack");

  // ── 3 · EL AVATAR CON SESIÓN, TAMBIÉN EN LANDING Y WIZARD ──────────────────
  const conSesion: [string, string][] = [
    ["sitio", dibujar({ sesion: { email: "ana@correo.cl" } })],
    ["wizard / landing", dibujar({ contexto: "wizard", sesion: { email: "ana@correo.cl" } })],
    ["landing sobre el material", dibujar({ contexto: "wizard", sobreMaterial: true, sesion: { email: "ana@correo.cl" } })],
  ];
  for (const [nombre, html] of conSesion) {
    if (!/class="hf-av"[^>]*aria-label="Menú de cuenta"|aria-label="Menú de cuenta"[^>]*>AN</.test(html) || !/>AN<\/button>/.test(html)) F(`3 · ${nombre} con sesión: no está el avatar con el menú de cuenta`);
    if (/>Entrar</.test(html)) F(`3 · ${nombre} con sesión: sigue diciendo «Entrar»`);
    if (/aria-label="Cambiar a modo/.test(html)) F(`3 · ${nombre} con sesión: el tema queda en la barra (va al menú)`);
  }
  const menu = (hdr.match(/function MenuCuenta[\s\S]*?\n\}\n/) ?? [""])[0];
  for (const [que, re] of [["Mis análisis", /href="\/dashboard"[^\n]{0,90}?>Mis análisis</], ["Planes", /href="\/pricing"[^\n]{0,90}?>Planes</], ["Mi cuenta", /href="\/cuenta"[^\n]{0,90}?>Mi cuenta</], ["Perfil", /href="\/perfil"[^\n]{0,90}?>Perfil</], ["el tema", /<span>Tema<\/span>/], ["Cerrar sesión", />Cerrar sesión</]] as const) {
    if (!re.test(menu)) F(`3 · el menú del avatar no lleva ${que}`);
  }

  // ── 4 · TRAS EL CÓDIGO EN EL INFORME: REFRESCO, Y «ESTÁS DENTRO» SOBREVIVE ──
  const banner = sinComentarios(leer("src/components/lo-que-sigue/BannerRegistro.tsx"));
  const entrarBanner = (banner.match(/const entrar = \(correo: string\) => \{([\s\S]*?)\n  \};/) ?? [])[1] ?? "";
  if (!entrarBanner) F("4 · el banner no tiene su manejador al entrar con el código");
  const iMarca = entrarBanner.indexOf("marcarRecienDentro(");
  const iRefresh = entrarBanner.indexOf("router.refresh()");
  if (iRefresh < 0) F("4 · después del código el banner no refresca la página: header y ticket siguen como anónimo");
  if (iMarca < 0 || (iRefresh >= 0 && iMarca > iRefresh)) F("4 · la marca «recién dentro» no se escribe ANTES del refresco: «Estás dentro» desaparece");
  if (!/setPaso\("dentro"\)/.test(entrarBanner)) F("4 · al entrar, el banner no pasa a «Estás dentro»");
  if (!/<RegistroUnPaso next=\{next\} ctx=\{ctx\} alEntrar=\{entrar\} \/>/.test(banner)) F("4 · el registro del banner no usa el manejador que refresca");
  {
    const s = almacen();
    const t0 = 1_000_000;
    marcarRecienDentro(s, "a1", "ana@correo.cl", t0);
    if (leerRecienDentro(s, "a1", t0 + 1000) !== "ana@correo.cl") F("4 · la marca «recién dentro» no se lee en el mismo informe");
    if (leerRecienDentro(s, "otro", t0 + 1000) !== null) F("4 · la marca «recién dentro» vale para otro informe");
    if (leerRecienDentro(s, "a1", t0 + VIGENCIA_RECIEN_DENTRO_MS + 1) !== null) F("4 · la marca «recién dentro» no vence");
    s.setItem(CLAVE_RECIEN_DENTRO, "{roto");
    if (leerRecienDentro(s, "a1", t0) !== null) F("4 · una marca rota no se descarta");
    if (leerRecienDentro(null, "a1", t0) !== null) F("4 · sin almacén la marca no da null");
  }
  for (const [f, gate] of [
    ["src/app/analisis/[id]/results-client.tsx", /const recienDentro = useRecienDentro\(analysisId\);\s*const loQueSigue = \(\(isAnonOwner && !isLoggedIn\) \|\| \(!!recienDentro && !isSharedView\)\) && !!analysisId;/],
    ["src/app/analisis/renta-corta/[id]/results-client.tsx", /const recienDentro = useRecienDentro\(analysisId\);\s*const loQueSigue = \(\(isAnonOwner && !userId\) \|\| !!recienDentro\) && !demo;/],
  ] as const) {
    const s = sinComentarios(leer(f));
    if (!gate.test(s)) F(`4 · ${f}: el gate de «Lo que sigue» no suma a quien acaba de entrar (Estás dentro no sobrevive al refresco)`);
    if (!/<BannerRegistro [^>]*pasoInicial=\{recienDentro \? "dentro" : "oferta"\}/.test(s)) F(`4 · ${f}: tras el refresco el banner no vuelve en «Estás dentro»`);
    if (!/<TicketPack [^>]*correoSesion=\{recienDentro\}/.test(s)) F(`4 · ${f}: tras el refresco el ticket sigue pidiendo el correo`);
  }
  // Lo que se DIBUJA: «Estás dentro» desde el paso inicial, y el ticket sin el campo del correo con sesión.
  {
    const { BannerRegistro } = require("../../../src/components/lo-que-sigue/BannerRegistro");
    const { TicketPack } = require("../../../src/components/lo-que-sigue/TicketPack");
    const ctx = { analysisId: "a1", veredicto: "COMPRAR", modalidad: "ltr" };
    const perfil = { tipologia: "2D2B", comuna: "Ñuñoa", modalidad: "ltr" };
    const dentro = dibujarConRouter(createElement(BannerRegistro, { ctx, next: "/analisis/a1", perfil, pasoInicial: "dentro" }));
    if (!/data-lqs="dentro"/.test(dentro) || !texto(dentro).includes("¿Cuándo piensas comprar?")) F("4 · el banner en «dentro» no dibuja «Estás dentro» con su pregunta");
    const creado = new Date().toISOString();
    const anon = dibujarConRouter(createElement(TicketPack, { ctx, createdAt: creado, precioCierreUF: null }));
    const conCorreo = dibujarConRouter(createElement(TicketPack, { ctx, createdAt: creado, precioCierreUF: null, correoSesion: "ana@correo.cl" }));
    if (!/lqs-tk-correo/.test(anon)) F("4 · el ticket anónimo perdió el campo del correo (el extractor no corrió)");
    if (/lqs-tk-correo/.test(conCorreo)) F("4 · con sesión recién creada el ticket sigue pidiendo el correo");
    const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
    if (!/const c = \(correoSesion \?\? correo\)\.trim\(\)\.toLowerCase\(\);/.test(tk)) F("4 · el ticket con sesión no paga con el correo de la sesión");
  }

  // ── 5 · LA BIENVENIDA AL REGISTRARSE POR CÓDIGO ────────────────────────────
  const claim = sinComentarios(leer("src/app/api/analisis/claim/route.ts"));
  const iBienvenida = claim.search(/if \(cuerpo\?\.porCodigo === true && user\.email\) \{\s*waitUntil\(ensureWelcomeEmail\(user\.id, user\.email, user\.user_metadata \?\? null\)\);/);
  const iAtajo = claim.indexOf("if (!token) return");
  if (iBienvenida < 0) F("5 · el claim no manda la bienvenida al registrarse por código");
  if (iBienvenida >= 0 && iAtajo >= 0 && iBienvenida > iAtajo) F("5 · la bienvenida va después del atajo sin cookie: quien entra por código sin informe no la recibe");
  const aa = sinComentarios(leer("src/lib/auth-analytics.ts"));
  if (!/body: JSON\.stringify\(\{ porCodigo: true \}\)/.test(aa)) F("5 · reclamarAnalisisAnonimos no avisa que la entrada fue por código");
  for (const [f, re] of [
    ["src/components/entrar/EntrarConCodigo.tsx", /await reclamarAnalisisAnonimos\(posthog, nueva \? "register" : "login", \{ porCodigo: true \}\);/],
    ["src/components/lo-que-sigue/RegistroUnPaso.tsx", /await reclamarAnalisisAnonimos\(posthog, "register", \{ porCodigo: true \}\);/],
    ["src/components/guia/RegistroEnTarjeta.tsx", /await reclamarAnalisisAnonimos\(posthog, "register", \{ porCodigo: true \}\);/],
  ] as const) {
    const s = sinComentarios(leer(f));
    if (!re.test(s)) F(`5 · ${f}: al entrar por código no pide la bienvenida`);
    if (!/verifyOtp\(/.test(s)) F(`5 · ${f}: no entra por código (verifyOtp)`);
  }
  if (!/router\.push\(destino\);/.test(comp) || !/const destino = destinoTrasEntrar\(next\);/.test(comp)) F("5 · /entrar no vuelve al next validado");
  const cb = sinComentarios(leer("src/app/auth/callback/route.ts"));
  if (!/ensureWelcomeEmail\(user\.id, user\.email, user\.user_metadata \?\? null\)/.test(cb)) F("5 · /auth/callback (enlace del correo o Google) no manda la bienvenida");
  const wel = sinComentarios(leer("src/lib/welcome.ts"));
  if (!/\.eq\("welcome_email_sent", false\)/.test(wel)) F("5 · ensureWelcomeEmail perdió el claim atómico (saldría más de una vez)");

  // ── 6 · EL SALUDO CON EL NOMBRE REAL EN TODOS LOS CORREOS ──────────────────
  if (!/await sendWelcomeEmail\(email, nombreReal\(meta\) \?\? "", \{ userId \}\);/.test(wel)) F("6 · la bienvenida no saluda con nombreReal");
  if (/sendWelcomeEmail\(email, (name|metadata)\b/.test(wel)) F("6 · la bienvenida saluda con el nombre que le pasan (puede venir del correo)");
  const fuentes = archivos("src", /\.(ts|tsx)$/);
  const conCorreo: string[] = [];
  for (const f of fuentes) {
    if (f === "src/lib/email.ts" || f.startsWith("src/lib/email/")) continue;
    const s = sinComentarios(leer(f));
    if (!/\bsend[A-Z]\w*Email(OrThrow)?\(/.test(s)) continue;
    conCorreo.push(f);
    const exc = EXCEPCIONES_SALUDO.find((e) => e.archivo === f);
    if (/(?<!function )resolveDisplayName\(/.test(s) && !exc) F(`6 · ${f}: manda un correo y saluda con resolveDisplayName (la parte del correo antes de la @)`);
    if (/const (nombre|name)\s*=\s*[\w.?]*user_metadata\?\.(nombre|full_name)\s*\|\|/.test(s)) F(`6 · ${f}: arma el saludo a mano con user_metadata (usa nombreReal)`);
  }
  if (conCorreo.length < 8) F(`6 · el recorrido encontró ${conCorreo.length} llamadores de correos: no encontró el sitio`);
  for (const f of ["src/app/api/analisis/route.ts", "src/app/api/payments/confirm/route.ts", "src/app/api/subscriptions/register-callback/route.ts", "src/app/api/subscriptions/payment-callback/route.ts", "src/app/api/cron/abandoned-checkout/route.ts", "src/app/api/admin/reenviar-informe/route.ts", "src/app/api/account/request-deletion/route.ts"]) {
    if (!/nombreReal\(/.test(sinComentarios(leer(f)))) F(`6 · ${f}: no saluda con nombreReal`);
  }
  for (const e of EXCEPCIONES_SALUDO) {
    if (!/resolveDisplayName\(/.test(sinComentarios(leer(e.archivo)))) F(`6 · la excepción ${e.archivo} ya no hace falta: sácala de la lista`);
  }

  if (fallas.length) {
    console.log(`  ✗ ENTRADA-CÓDIGO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — /entrar con el copy exacto de cada contexto y sin «este informe» sin informe; «Entrar» del header va a /entrar con next validado; el avatar con sesión también en landing y wizard; tras el código el informe se refresca y «Estás dentro» sobrevive; la bienvenida sale al registrarse por código; ningún correo saluda con la parte del correo antes de la @");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runEntradaCodigoTier().hard ? 1 : 0);
}

// ACTA DE MUTACIÓN (01-oct-2026) — cada una aplicada sobre el código, corrida contra este tier y
// restaurada byte a byte (comparación de bytes antes y después). Las 23 en ROJO; restauradas, VERDE.
// M1 «Entrar» del header a /login (10 fallas) · M2 la píldora del wizard a /login (3) · M3 el wizard
// con sesión sin avatar, vuelve la píldora «Mis análisis» (2) · M4 el next sin validar (6: externo,
// «//», «/\», pelado) · M5 ctx=informe sin informe de destino · M6 otro título genérico (2) · M7 el
// cuerpo de «Revisa tu correo» dice «este informe» (2) · M8 el banner sin router.refresh() · M9 la
// marca «recién dentro» después del refresco · M10 el gate LTR vuelve a «anónimo sin sesión» (Estás
// dentro muere al refrescar) · M11 el claim sin la bienvenida · M12 /entrar reclama sin porCodigo ·
// M13 el pago confirmado vuelve a resolveDisplayName (2) · M14 el ticket pide el correo con sesión ·
// M15 /registro redirige sin la query · M16 la marca vale para cualquier informe · M17 la bienvenida
// saluda con resolveDisplayName (2) · M18 el pie de la landing a /login · M19 el ticket STR sin el
// correo de la sesión · M20 el cron de carrito arma el saludo a mano con user_metadata (2) · M21 el
// título del formulario en mayúsculas · M22 desde el informe anónimo, «Entrar» sin ctx=informe (2) ·
// M23 la bienvenida después del atajo sin cookie.
