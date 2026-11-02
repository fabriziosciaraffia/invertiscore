// ============================================================================
// TIER COMPARTIR-DEPTO — compartir un depto desde Explorar: el bucle de referidos con inventario (02-nov-2026, goal de
// Fabrizio).
//
//   1 · EL ENLACE ABRE EL PIN CORRECTO: el enlace que arma «Compartir» va y vuelve con el mismo aviso (y su modalidad y el
//       código); la página se lo pasa al navegador como el pin a abrir; con el universo, ese pin abre su tarjeta (con los
//       cercanos, él primero) y el mapa se centra en él, una vez; si ya no está, la tarjeta de «ya no está».
//   2 · LA VISTA PREVIA NO TRAE CIFRAS MÁS ALLÁ DEL CHIP: el título, la descripción y la imagen salen de
//       `contenidoVistaPrevia` —la línea, el precio y el chip ✓ Comprar—; ni el puntaje, ni el flujo, ni el cap rate. El chip,
//       solo si da Comprar hoy; los metadatos, solo para los robots de vista previa (las personas no esperan nada).
//   3 · EL REGISTRO DESDE UN ENLACE COMPARTIDO ACREDITA A LOS DOS: el middleware deja el código en la cookie marcada «depto»;
//       al registrarse, la cuenta queda con la puerta C y el detalle `depto:CÓDIGO`, recibe su regalo de alta, y quien
//       compartió recibe su análisis con las mismas reglas que la invitación de siempre (al contestar el «cuándo»).
//   4 · LA MEDICIÓN: `explorar_compartir` (origen tarjeta o lista, con o sin cuenta); `explorar_compartido_vista` del servidor
//       como vista de entrada, con robots marcados; el panel de referidos separa lo que viene de un depto compartido.
//   5 · SI YA NO ESTÁ PUBLICADO, la tarjeta lo dice y ofrece los parecidos que sí dan.
//   6 · EL BOTÓN Y EL TEXTO: «Compartir» en la tarjeta y en cada fila, con y sin cuenta; la hoja del sistema en el teléfono,
//       copiar en el PC; el texto exacto del goal, con el veredicto de por defecto aunque quien comparte mire con otro pie. Un
//       negociado de la capa «Si negocias» (Ajustar al precio publicado) se comparte sin «Comprar», también en esa vista.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/compartir-depto-catch-test.ts
// ============================================================================
import "./als-de-next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ec from "../../../src/lib/explorar/enlace-compartido";
import * as cp from "../../../src/lib/explorar/compartir";
import { estaPublicado, fichaCompartida } from "../../../src/lib/explorar/compartir-servidor";
import { cercanos, type PinMapa } from "../../../src/lib/explorar/portal";
import type { PinNegociado } from "../../../src/lib/explorar/capa-negociar";
import { AL_PRECIO_PUBLICADO } from "../../../src/lib/precio-publicado";
import { detalleDeOrigen, detalleExplorar, origenDeLlegada } from "../../../src/lib/explorar/abierto";
import { llegadaDeExplorar } from "../../../src/lib/explorar/puertas-landing";
import { leerCookieInvitacion, PREFIJO_DETALLE_DEPTO, PREFIJO_DETALLE_INVITACION, valorCookieInvitacion } from "../../../src/lib/referido";
import { pagarPremioReferido, vincularInvitacion } from "../../../src/lib/referido-servidor";
import { asegurarRegaloDeAlta } from "../../../src/lib/regalo-alta-servidor";
import { EVENTO_VISTA, eventoVistaCompartido, eventoVistaEntrada } from "../../../src/lib/vista-entrada";
import { TarjetaPin } from "../../../src/app/explorar/tarjeta-pin";
import { ListaPortal } from "../../../src/app/explorar/lista-portal";
import { CompartidoCaido } from "../../../src/app/explorar/compartido-caido";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ── Una base en memoria: lo justo de supabase-js que usan el referido, el regalo y la ficha ─────────────────────────
type Fila = Record<string, unknown>;
function baseFalsa(o: { claves?: Record<string, string>; unicos?: Record<string, string[][]> } = {}) {
  const tablas = new Map<string, Fila[]>();
  const tabla = (t: string) => { if (!tablas.has(t)) tablas.set(t, []); return tablas.get(t)!; };
  const rpcs: Array<{ nombre: string; args: Fila }> = [];
  let ids = 0;
  const choca = (t: string, v: Fila, yo?: Fila) => {
    const filas = tabla(t).filter((f) => f !== yo);
    const clave = o.claves?.[t];
    if (clave && filas.some((f) => f[clave] === v[clave])) return true;
    for (const cols of o.unicos?.[t] ?? []) {
      if (cols.some((c) => v[c] == null)) continue;
      if (filas.some((f) => cols.every((c) => f[c] === v[c]))) return true;
    }
    return false;
  };
  const from = (t: string) => {
    const filtros: Array<(f: Fila) => boolean> = [];
    let op: { tipo: "select" | "insert" | "update" | "upsert"; valor?: Fila; opts?: Record<string, unknown> } = { tipo: "select" };
    let cabeza = false, una = false, devolver = false;
    const b = {
      select(_c?: string, s?: { head?: boolean }) { if (op.tipo === "select") cabeza = !!s?.head; else devolver = true; return b; },
      insert(v: Fila) { op = { tipo: "insert", valor: v }; return b; },
      update(v: Fila) { op = { tipo: "update", valor: v }; return b; },
      upsert(v: Fila, s?: Record<string, unknown>) { op = { tipo: "upsert", valor: v, opts: s }; return b; },
      eq(c: string, v: unknown) { filtros.push((f) => f[c] === v); return b; },
      in(c: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[c])); return b; },
      gte(c: string, v: string) { filtros.push((f) => String(f[c]) >= v); return b; },
      order() { return b; },
      limit() { return b; },
      maybeSingle() { una = true; return b; },
      single() { una = true; return b; },
      then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) { return Promise.resolve(correr()).then(ok, ko); },
    };
    const duplicada = { data: null, error: { code: "23505", message: "duplicada" } };
    const correr = () => {
      const filas = tabla(t);
      if (op.tipo === "insert") {
        const v = { ...op.valor } as Fila;
        if (choca(t, v)) return duplicada;
        if (!("id" in v)) v.id = `id-${++ids}`;
        filas.push(v);
        return { data: devolver ? (una ? v : [v]) : null, error: null };
      }
      if (op.tipo === "upsert") {
        const v = op.valor!;
        const clave = o.claves?.[t];
        const i = clave ? filas.findIndex((f) => f[clave] === v[clave]) : -1;
        if (i >= 0) { if (!op.opts?.ignoreDuplicates) filas[i] = { ...filas[i], ...v }; } else filas.push({ ...v });
        return { data: null, error: null };
      }
      const elegidas = filas.filter((f) => filtros.every((p) => p(f)));
      if (op.tipo === "update") {
        if (elegidas.some((f) => choca(t, { ...f, ...op.valor }, f))) return duplicada;
        for (const f of elegidas) Object.assign(f, op.valor);
        return { data: devolver ? elegidas : null, error: null };
      }
      if (cabeza) return { data: null, count: elegidas.length, error: null };
      if (una) return { data: elegidas[0] ?? null, error: null };
      return { data: elegidas, error: null };
    };
    return b;
  };
  const rpc = async (nombre: string, args: Fila) => {
    rpcs.push({ nombre, args });
    if (nombre === "fijar_puerta_referido") {
      const ua = tabla("user_attribution");
      const f = ua.find((x) => x.user_id === args.p_user_id);
      if (f) Object.assign(f, { puerta: "C", puerta_detalle: args.p_detalle }); else ua.push({ user_id: args.p_user_id, puerta: "C", puerta_detalle: args.p_detalle });
    }
    return { data: null, error: null };
  };
  const auth = { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: `${id}@ejemplo.cl`, user_metadata: {} } }, error: null }) } };
  return { from, rpc, auth, tabla, rpcs };
}
const OPCIONES_BASE = {
  claves: { invitaciones: "codigo", referidos: "invitado_id", regalos_alta: "user_id", user_attribution: "user_id", test_accounts: "user_id", user_credits: "user_id" },
  unicos: { invitaciones: [["user_id", "con_nombre"]], referidos: [["invitador_id", "premio_n"]] },
};

const AVISO = "81be3033-ae0c-4566-bad3-7c33feabc33f";
const OTRO = "15c8b4b2-bfe3-480c-88f8-e4cd8ea800a9";
const pin = (id: string, x: Partial<PinMapa> = {}): PinMapa => ({
  avisoId: id, comuna: "Providencia", lat: -33.43, lng: -70.61, m2: 79, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 120000, arriendo: 650000, alta: null, ...x,
});
const DEPTO: cp.DeptoCompartido = { comuna: "Providencia", tipologia: "2D2B", m2: 79, precioUF: 4591, dormitorios: 2, lat: -33.43, lng: -70.61 };
const NAVEGADOR = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const cab = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

export async function runCompartirDeptoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER COMPARTIR-DEPTO (compartir un depto desde Explorar: el enlace, la vista previa, el referido, la medición · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try {
    const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
    const pagina = codigo("src/app/explorar/page.tsx");
    const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
    const mw = codigo("src/middleware.ts");

    // ── 1 · EL ENLACE ABRE EL PIN CORRECTO ──
    {
      const url = ec.enlaceCompartido("https://refranco.ai", { avisoId: AVISO, modalidad: "ltr", comuna: "Providencia", codigo: "k7m2qx" });
      const u = new URL(url);
      const ida = ec.compartidoDeUrl(u.searchParams);
      if (u.pathname !== "/explorar" || ida?.avisoId !== AVISO || ida.modalidad !== "ltr" || ida.codigo !== "K7M2QX") F(`1 · el enlace no va y vuelve con su aviso, su modalidad y el código (${url})`);
      if (u.searchParams.get("desde") !== "compartido" || ["p", "z", "ta"].some((k) => u.searchParams.has(k))) F("1 · el enlace no marca la llegada o arrastra el pie, el plazo o la tasa de quien comparte");
      const str = new URL(ec.enlaceCompartido("https://refranco.ai", { avisoId: AVISO, modalidad: "str", comuna: "Ñuñoa", codigo: null }));
      if (ec.compartidoDeUrl(str.searchParams)?.modalidad !== "str" || str.searchParams.get("c") !== "Ñuñoa" || str.searchParams.has("i")) F("1 · en renta corta el enlace no lleva la modalidad y la comuna (o lleva un código sin cuenta)");
      if (ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO}`)) !== null || ec.compartidoDeUrl(new URLSearchParams("a=no-es-un-aviso&desde=compartido")) !== null) F("1 · cualquier `a` se lee como enlace compartido");
      if (ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO.toUpperCase()}&desde=compartido`))?.avisoId !== AVISO) F("1 · el aviso en mayúsculas no abre el mismo pin");
      // La página: el pin a abrir ES el del enlace, con y sin cuenta.
      const abrirAbierto = /<ExplorarCliente inicial=\{\{ filtros, orden, n, cuenta: null, tasa, convienen \}\} abrir=\{compartido\?\.avisoId \?\? sp\.get\("a"\)\} compartido=\{compartido\}/.test(pagina);
      const abrirCuenta = /const a = compartido\?\.avisoId \?\? sp\.get\("a"\);[\s\S]{0,200}abrir=\{a\}\s*compartido=\{compartido\}/.test(pagina);
      if (!abrirAbierto || !abrirCuenta) F("1 · la página no le pasa al navegador el aviso del enlace como el pin a abrir (con o sin cuenta)");
      if ((pagina.match(/compartidoDe\(sp\),/g) ?? []).length !== 2) F("1 · la página no lee el enlace compartido en las dos ramas (con y sin cuenta)");
      // Con el universo: la tarjeta del pin, con los cercanos y él primero; o la de «ya no está».
      const vis = [pin(OTRO, { lat: -33.4301 }), pin(AVISO), pin("2a7d1c55-0000-4000-8000-000000000001", { lat: -33.5 })];
      const ap = cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: vis });
      if (ap.tipo !== "pin" || ap.avisoId !== AVISO) F("1 · un aviso que está entre los que convienen no abre su tarjeta");
      if (cercanos(vis, AVISO)[0]?.avisoId !== AVISO) F("1 · la tarjeta no abre con el pin del enlace primero");
      if (cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: vis.filter((p) => p.avisoId !== AVISO) }).tipo !== "caido") F("1 · un aviso que no está abre una tarjeta igual");
      if (!/const ap = aperturaCompartida\(\{ avisoId: compartido\.avisoId, estado: compartido\.estado, depto: compartido\.depto, visibles \}\);\s*if \(ap\.tipo === "pin"\) \{ setCarrusel\(cercanos\(visibles, ap\.avisoId\)\.map\(\(p\) => p\.avisoId\)\); setSel\(ap\.avisoId\); return; \}/.test(cliente)) F("1 · el navegador no abre la tarjeta del pin del enlace con sus cercanos");
      if (!/if \(compartidoResuelto\.current\) return;\s*compartidoResuelto\.current = true;/.test(cliente)) F("1 · el enlace compartido se resuelve más de una vez (cada universo nuevo volvería a abrir la tarjeta)");
      // El mapa: centrado en el pin, una vez.
      if (!/const p = porId\.get\(compartido\.avisoId\);\s*if \(p && visibles\.some\(\(x\) => x\.avisoId === p\.avisoId\)\) return \{ lat: p\.lat, lng: p\.lng \};/.test(cliente)) F("1 · el foco del mapa no es el pin del enlace");
      if (!/foco=\{foco\}\s*onFoco=\{\(\) => setFocoUsado\(true\)\}/.test(cliente) || !/if \(focoUsado \|\| !compartido \|\| !universo\) return null;/.test(cliente)) F("1 · el mapa no recibe el foco o lo recibe más de una vez");
      if (!/const f = focoRef\.current;\s*if \(f\) \{ map\.setCenter\(f\); map\.setZoom\(ZOOM_FOCO\); focoRef\.current = null; cb\.current\.onFoco\?\.\(\); return; \}\s*if \(ps\.length === 0\)/.test(mapa)) F("1 · el mapa no se centra en el foco antes de encuadrar los pines");
      if (!/useEffect\(\(\) => \{ if \(mapRef\.current && focoRef\.current\) \{ encuadrarRef\.current\(\); dibujarRef\.current\(\); \} \}, \[foco\]\);/.test(mapa)) F("1 · el foco que llega con el universo no centra el mapa (o lo centra dos veces)");
      // Lo que se usa una vez sale de la barra (la recarga no vuelve a contar la vista ni a repartir el código).
      if (ec.PARAMS_DE_UNA_VEZ.join() !== "desde,i" || !/for \(const k of PARAMS_DE_UNA_VEZ\) u\.searchParams\.delete\(k\);/.test(cliente)) F("1 · la llegada y el código se quedan en la barra");
      if (!/if \(!sinCuenta \|\| inicial\.n == null \|\| compartido\) return;/.test(cliente)) F("1 · la bienvenida tapa la tarjeta del depto compartido");
    }

    // ── 2 · LA VISTA PREVIA NO TRAE CIFRAS MÁS ALLÁ DEL CHIP ──
    {
      const ficha: cp.FichaCompartida = { avisoId: AVISO, modalidad: "ltr", estado: "comprar", depto: { ...DEPTO, condicion: "usado" }, score: 87 };
      const v = cp.contenidoVistaPrevia(ficha);
      if (Object.keys(v).sort().join() !== "chip,descripcion,linea,precio,titulo") F(`2 · la vista previa trae otros campos: ${Object.keys(v).join(", ")}`);
      if (v.linea !== "Providencia · 2D2B · 79 m² · Usado" || v.precio !== "UF 4.591" || v.titulo !== "Providencia · 2D2B · 79 m² · Usado · UF 4.591" || v.chip !== "COMPRAR") F(`2 · la vista previa no es la línea, el precio y el chip (${JSON.stringify(v)})`);
      const todo = Object.values(v).join(" | ");
      if (/87|\$|%|flujo|cap rate|puntaje|score|arriendo/i.test(todo)) F(`2 · la vista previa trae cifras más allá del chip: «${todo}»`);
      for (const estado of ["no-da", "despublicado"] as const) {
        const w = cp.contenidoVistaPrevia({ estado, depto: ficha.depto });
        if (w.chip !== null || /Comprar/.test(w.descripcion)) F(`2 · con «${estado}» la vista previa dice Comprar`);
      }
      // La imagen: todo lo que dibuja sale de contenidoVistaPrevia; nada del puntaje, el flujo, el arriendo ni el cap rate.
      const og = codigo("src/app/api/og/depto/[avisoId]/route.tsx");
      if (/score|flujo|arriendo|capRate|cap rate|puntaje/i.test(og)) F("2 · la imagen de la vista previa lee el puntaje, el flujo, el arriendo o el cap rate");
      if (!/const v = contenidoVistaPrevia\(ficha\);/.test(og) || !/\{v\.linea\}/.test(og) || !/\{v\.precio\}/.test(og) || !/\{v\.chip \? \(/.test(og)) F("2 · la imagen no dibuja la línea, el precio y el chip de contenidoVistaPrevia");
      // La caché se FIJA (set), no se suma a la de Next (medido en el preview: con `headers` quedaba «immutable, max-age=31536000» delante).
      if (!/respuesta\.headers\.set\("Cache-Control", CACHE\);\s*return respuesta;/.test(og) || !/const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";/.test(og)) F("2 · la imagen no queda en la caché del CDN (o hereda el «immutable» de un año)");
      // El peso (medido en el preview: 589 kB a 1200 × 630; WhatsApp se salta las de más de ~300 kB): sale a 800 × 420.
      if (!/const ESCALA = 2 \/ 3;/.test(og) || !/\{ width: ANCHO, height: ALTO, fonts \}/.test(og) || !/const ANCHO = e\(1200\);\s*const ALTO = e\(630\);/.test(og)) F("2 · la imagen de la vista previa no sale a 800 × 420 (pesa de más para WhatsApp)");
      if (!/fichaCompartidaCacheada\(params\.avisoId, modalidad\)/.test(og)) F("2 · la imagen no comprueba en el servidor cómo está el depto");
      // Los metadatos: los de contenidoVistaPrevia, solo para los robots de vista previa.
      const meta = pagina.slice(pagina.indexOf("export async function generateMetadata"), pagina.indexOf("const mapaQuieto"));
      if (!/if \(!c \|\| !esRobot\(headers\(\)\.get\("user-agent"\)\)\) return METADATOS;/.test(meta)) F("2 · los metadatos del depto se leen también para las personas (el primer byte esperaría la ficha)");
      if (/score|flujo|arriendo/.test(meta) || !/const v = contenidoVistaPrevia\(ficha\);/.test(meta) || !/openGraph: \{ title: v\.titulo, description: v\.descripcion,/.test(meta) || !/images: \[imagen\]/.test(meta)) F("2 · los metadatos no son los de contenidoVistaPrevia (o traen otra cifra)");
      if (cp.rutaVistaPrevia(AVISO, "ltr") !== `/api/og/depto/${AVISO}` || cp.rutaVistaPrevia(AVISO, "str") !== `/api/og/depto/${AVISO}?m=str`) F("2 · la imagen de la vista previa no es la del depto");
      // La ficha del servidor: el chip solo si el depto está en el universo de los que convienen.
      const base = baseFalsa(OPCIONES_BASE);
      const ahora = new Date("2026-11-02T15:00:00Z");
      await base.from("scraped_properties").insert({ id: AVISO, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 79.4, dormitorios: 2, banos: 2, condicion: "usado", is_active: true, type: "venta", scraped_at: "2026-11-02T03:01:14.901", titulo: "Depto 2D2B" });
      base.tabla("avisos_evaluados").push({ aviso_id: AVISO, precio_uf: 4590.6 });
      const conPin = await fichaCompartida(base as never, AVISO, "ltr", { veredicto: true, ahora, universo: async () => [pin(AVISO, { score: 84 })] });
      const sinPin = await fichaCompartida(base as never, AVISO, "ltr", { veredicto: true, ahora, universo: async () => [pin(OTRO)] });
      if (conPin?.estado !== "comprar" || conPin.score !== 84 || sinPin?.estado !== "no-da" || sinPin.score !== null) F(`2 · la ficha no dice «comprar» solo si está en el universo (${conPin?.estado}/${sinPin?.estado})`);
      if (sinPin?.depto.precioUF !== 4591 || sinPin.depto.m2 !== 79 || sinPin.depto.tipologia !== "2D2B") F("2 · la ficha no arma el depto de la fila");
    }

    // ── 3 · EL REGISTRO DESDE UN ENLACE COMPARTIDO ACREDITA A LOS DOS ──
    {
      const t0 = Date.parse("2026-11-02T15:00:00Z");
      const codigoEnlace = ec.codigoDeEnlaceCompartido("/explorar", `?a=${AVISO}&i=K7M2QX&desde=compartido`);
      if (codigoEnlace !== "K7M2QX" || ec.codigoDeEnlaceCompartido("/dashboard", `?a=${AVISO}&i=K7M2QX&desde=compartido`) !== null || ec.codigoDeEnlaceCompartido("/explorar", "?i=K7M2QX") !== null) F("3 · el código del enlace compartido no se lee (o se lee fuera de un enlace compartido)");
      const cookie = valorCookieInvitacion("K7M2QX", t0, "depto");
      const leida = leerCookieInvitacion(cookie);
      if (leida?.codigo !== "K7M2QX" || leida.via !== "depto" || leerCookieInvitacion(valorCookieInvitacion("K7M2QX", t0))?.via !== "enlace" || leerCookieInvitacion("K7M2QX.1793000000")?.via !== "enlace") F("3 · la cookie no recuerda que la invitación vino de un depto (o las de siempre dejan de leerse)");
      // El middleware: la misma cookie, marcada «depto», sin pisar una que ya esté.
      if (!/const deDepto = enlace \? null : codigoDeEnlaceCompartido\(request\.nextUrl\.pathname, request\.nextUrl\.search\);\s*const invitacion = enlace \?\? deDepto;\s*if \(invitacion && !request\.cookies\.has\(COOKIE_INVITACION\)\) \{\s*res\.cookies\.set\(COOKIE_INVITACION, valorCookieInvitacion\(invitacion, Date\.now\(\), deDepto \? "depto" : "enlace"\),/.test(mw)) F("3 · el middleware no deja el código del enlace compartido en la cookie marcada «depto» (o pisa la primera)");
      if (!/"\/explorar"/.test(mw.slice(mw.indexOf("export const config")))) F("3 · el middleware no corre en /explorar");

      const db = baseFalsa(OPCIONES_BASE);
      db.tabla("invitaciones").push({ codigo: "K7M2QX", user_id: "quien-comparte", con_nombre: false, nombre: null, dispositivos: ["dA"] });
      const creada = new Date(t0 + 5 * 60_000).toISOString();
      const ahora = new Date(t0 + 6 * 60_000);
      const vinculo = await vincularInvitacion(db as never, { userId: "invitado", creadaAt: creada, cookie, huella: { dispositivo: "dB", ip: null } as never }, ahora);
      const ua = db.tabla("user_attribution").find((f) => f.user_id === "invitado");
      if (vinculo !== "pendiente" || ua?.puerta !== "C" || ua.puerta_detalle !== `${PREFIJO_DETALLE_DEPTO}K7M2QX`) F(`3 · el registro desde un depto compartido no queda con la puerta C y el detalle «depto» (${vinculo}, ${String(ua?.puerta_detalle)})`);
      // El invitado: su regalo de alta, el de toda cuenta nueva.
      const regalo = await asegurarRegaloDeAlta(db as never, { userId: "invitado", creadaAt: creada, huella: { dispositivo: "dB", ip: null } as never, puerta: "C" }, ahora);
      // Quien compartió: su análisis, con las reglas de siempre (el invitado contesta el «cuándo»).
      const premio = await pagarPremioReferido(db as never, { invitadoId: "invitado", enviar: async () => true }, ahora);
      const grants = db.tabla("credit_grants");
      const delInvitado = grants.filter((g) => g.user_id === "invitado");
      const deQuienComparte = grants.filter((g) => g.user_id === "quien-comparte");
      if (regalo.estado !== "otorgar" || delInvitado.length !== 1 || delInvitado[0].source !== "regalo_alta") F(`3 · el invitado desde un depto compartido no recibe su análisis (${regalo.estado}, ${delInvitado.length})`);
      if (premio.estado !== "pagar" || deQuienComparte.length !== 1 || deQuienComparte[0].source !== "premio_referido") F(`3 · quien compartió el depto no recibe su análisis (${premio.estado}, ${deQuienComparte.length})`);
      // El enlace de siempre sigue con su detalle.
      const db2 = baseFalsa(OPCIONES_BASE);
      db2.tabla("invitaciones").push({ codigo: "K7M2QX", user_id: "quien-comparte", con_nombre: false, nombre: null, dispositivos: [] });
      await vincularInvitacion(db2 as never, { userId: "otro", creadaAt: creada, cookie: valorCookieInvitacion("K7M2QX", t0), huella: { dispositivo: "dC", ip: null } as never }, ahora);
      if (db2.tabla("user_attribution")[0]?.puerta_detalle !== `${PREFIJO_DETALLE_INVITACION}K7M2QX`) F("3 · el enlace de siempre dejó de quedar con «invitacion:CÓDIGO»");
      // Sin código (lo compartió alguien sin cuenta): la puerta E con su detalle.
      if (origenDeLlegada("compartido") !== "compartido" || detalleDeOrigen("compartido") !== "explorar:compartido" || detalleExplorar("explorar:compartido") !== "explorar:compartido" || detalleExplorar("explorar:otra") !== "explorar:directo") F("3 · sin código, el registro desde un depto compartido no queda con la E y su detalle");
      // El cliente: el código de quien tiene cuenta viaja en el enlace; sin cuenta, nunca.
      if (!/const url = enlaceCompartido\(window\.location\.origin, \{ avisoId: p\.avisoId, modalidad: filtros\.modalidad, comuna: p\.comuna, codigo: sinCuenta \? null : codigo\.current \}\);/.test(cliente)) F("3 · el enlace que se comparte no lleva el código de quien tiene cuenta");
      if (!/if \(sinCuenta \|\| pidiendoCodigo\.current \|\| \(!sel && vista !== "lista"\)\) return;\s*pidiendoCodigo\.current = true;\s*void fetch\("\/api\/invitacion"/.test(cliente) || !/codigo\.current = typeof d\?\.codigo === "string" \? d\.codigo : null;/.test(cliente)) F("3 · el código no se pide antes de tocar «Compartir» (la hoja tiene que abrirse en el mismo toque)");
    }

    // ── 4 · LA MEDICIÓN ──
    {
      const comp = { avisoId: AVISO, modalidad: "ltr" as const, codigo: "K7M2QX" };
      const base = { ruta: "/explorar", search: `?a=${AVISO}&i=K7M2QX&desde=compartido`, referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "5f0c6a8e-1111-4222-8333-944444444444", esCarga: true, cabeceras: cab({ "accept-language": "es-CL", "sec-fetch-mode": "navigate" }) };
      const ev = eventoVistaCompartido({ ...base, compartido: comp, uuidEvento: "9a1b2c3d-1111-4222-8333-944444444444", agente: NAVEGADOR });
      const principal = eventoVistaEntrada({ ...base, pagina: "explorar", agente: NAVEGADOR });
      const pr: Record<string, unknown> = ev?.properties ?? {};
      if (ev?.event !== "explorar_compartido_vista" || EVENTO_VISTA.compartido !== "explorar_compartido_vista") F("4 · la vista del enlace compartido no es «explorar_compartido_vista»");
      if (pr.aviso_id !== AVISO || pr.con_invitacion !== true || pr.codigo !== "K7M2QX" || pr.con_sesion !== false || pr.llegada_explorar !== "compartido" || pr.origen !== "servidor") F(`4 · la vista del enlace compartido no lleva el aviso, el código y la sesión (${JSON.stringify(pr)})`);
      if (ev?.distinctId !== principal?.distinctId || ev?.uuid === principal?.uuid) F("4 · la vista del enlace compartido no es de la misma persona que la del mapa, o lleva su mismo uuid (PostHog se quedaría con una)");
      if (eventoVistaCompartido({ ...base, compartido: comp, uuidEvento: "x", agente: "WhatsApp/2.23.20.0" }) !== null) F("4 · la vista previa de WhatsApp cuenta como visita del enlace");
      if (eventoVistaCompartido({ ...base, compartido: comp, uuidEvento: "x", agente: "Mozilla/5.0 zgrab/0.x" })?.properties?.robot !== true) F("4 · un escáner no sale marcado robot");
      const conSesion = eventoVistaCompartido({ ...base, userId: "cuenta-1", compartido: comp, uuidEvento: "x", agente: NAVEGADOR });
      if (conSesion?.distinctId !== "cuenta-1" || conSesion.properties?.con_sesion !== true) F("4 · con sesión, la vista del enlace no va a nombre de la cuenta");
      if (llegadaDeExplorar("compartido") !== "compartido") F("4 · la vista del mapa no llega «compartido»");
      // El middleware la emite con y sin sesión, antes de la salida de quien tiene sesión.
      const vistaMw = mw.slice(mw.indexOf("function conVista"), mw.indexOf("function conNavegador"));
      const iComp = vistaMw.indexOf("const ev = eventoVistaCompartido({"), iSalida = vistaMw.indexOf('if (pagina === "explorar" && persona) return res;');
      if (iComp < 0 || iSalida < 0 || iComp > iSalida || !/uuidEvento: crypto\.randomUUID\(\),/.test(vistaMw) || !/userId: persona\?\.id \?\? null,/.test(vistaMw) || !/if \(ev\) event\.waitUntil\(enviarVista\(ev\)\.catch\(\(\) => false\)\);\s*\}\s*\/?\/?[^\n]*\n?\s*if \(pagina === "explorar" && persona\) return res;/.test(vistaMw)) F("4 · el middleware no emite la vista del enlace compartido con y sin sesión");
      // «explorar_compartir»: origen tarjeta o lista, con o sin cuenta.
      if (cp.EVENTOS_COMPARTIR.compartir !== "explorar_compartir") F("4 · el evento de compartir no es «explorar_compartir»");
      if (!/posthog\?\.capture\(EVENTOS_COMPARTIR\.compartir, \{\s*origen: origenToque, sin_cuenta: sinCuenta, aviso_id: p\.avisoId, modalidad: filtros\.modalidad, metodo,/.test(cliente)) F("4 · «explorar_compartir» no lleva el origen y si tiene cuenta");
      if (!/alCompartir=\{\(p\) => void compartir\(p, "tarjeta"\)\}/.test(cliente) || !/alCompartir=\{\(p\) => void compartir\(p, "lista"\)\}/.test(cliente)) F("4 · la tarjeta y la lista no se distinguen en «explorar_compartir»");
      const rsrv = codigo("src/lib/referido-servidor.ts");
      if (!/properties: \{ estado, invitador: invitacion\.userId, codigo: invitacion\.codigo, con_nombre: invitacion\.conNombre, via: inv\.via \}/.test(rsrv)) F("4 · «referido_vinculado» no dice si vino de un depto compartido");
      const doc = leer("docs/posthog-activacion-por-puerta.md");
      if (!/startsWith\(detalle, 'depto:'\), 'C · depto compartido'/.test(doc)) F("4 · la tabla de activación no separa la C del depto compartido");
      // La tabla de referidos (el SQL del insight 7aJ56Uij): las visitas del depto compartido con código, los invitados por esa
      // vía y su tasa, unidos por semana. (Primera versión: «registro_por_depto|invitados_por_depto» en cualquier lado; E9 la
      // dejó verde borrando la tasa, y se reescribió así.)
      const refs = doc.slice(doc.indexOf("## La cohorte de la puerta C"));
      if (!/where event = 'explorar_compartido_vista'\s+and timestamp >= now\(\) - interval 30 week\s+and toString\(properties\.origen\) = 'servidor'\s+and toString\(properties\.con_invitacion\) = 'true'/.test(refs)
        || !/countIf\(v\.estado = 'pendiente' and v\.via = 'depto'\) as invitados_por_depto/.test(refs)
        || !/if\(visitas_depto = 0, null, round\(invitados_por_depto \/ visitas_depto, 3\)\) as registro_por_depto/.test(refs)
        || !/from base full outer join vd on base\.semana = vd\.semana/.test(refs)) F("4 · el panel de referidos no separa los registros que vienen de un depto compartido");
    }

    // ── 5 · SI YA NO ESTÁ PUBLICADO ──
    {
      const ahora = new Date("2026-11-02T15:00:00Z");
      const fresco = { is_active: true, type: "venta", scraped_at: "2026-11-02T03:00:00" };
      if (!estaPublicado(fresco, null, ahora) || estaPublicado({ ...fresco, is_active: false }, null, ahora) || estaPublicado({ ...fresco, scraped_at: "2026-10-20T03:00:00" }, null, ahora) || estaPublicado(fresco, "despublicado", ahora) || estaPublicado({ ...fresco, type: "arriendo" }, null, ahora)) F("5 · «publicado» no es la regla del mapa (activo, de venta, visto esta semana, no despublicado)");
      const db = baseFalsa(OPCIONES_BASE);
      await db.from("scraped_properties").insert({ id: AVISO, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 79, dormitorios: 2, banos: 2, condicion: null, is_active: false, type: "venta", scraped_at: "2026-11-02T03:00:00", titulo: "" });
      db.tabla("avisos_evaluados").push({ aviso_id: AVISO, precio_uf: 4591 });
      let llamado = false;
      const caida = await fichaCompartida(db as never, AVISO, "ltr", { veredicto: true, ahora, universo: async () => { llamado = true; return [pin(AVISO)]; } });
      if (caida?.estado !== "despublicado" || llamado) F("5 · un aviso despublicado no sale «despublicado» (o se busca en el universo igual)");
      const vecinos = [
        pin("00000000-0000-4000-8000-000000000001", { comuna: "Providencia", dormitorios: 2, precioUF: 4400, lat: -33.431 }),
        pin("00000000-0000-4000-8000-000000000002", { comuna: "Providencia", dormitorios: 3, precioUF: 4600, lat: -33.4302 }),
        pin("00000000-0000-4000-8000-000000000003", { comuna: "Ñuñoa", dormitorios: 2, precioUF: 4590, lat: -33.4301 }),
        pin("00000000-0000-4000-8000-000000000004", { comuna: "Providencia", dormitorios: 2, precioUF: 9000, lat: -33.4300 }),
        pin("00000000-0000-4000-8000-000000000005", { comuna: "Providencia", dormitorios: 2, precioUF: 4700, lat: -33.45 }),
        pin(AVISO),
      ];
      const ap = cp.aperturaCompartida({ avisoId: AVISO, estado: "despublicado", depto: DEPTO, visibles: vecinos.filter((p) => p.avisoId !== AVISO) });
      if (ap.tipo !== "caido" || ap.estado !== "despublicado") F("5 · el enlace a un aviso despublicado no abre la tarjeta de «ya no está»");
      const ids = ap.tipo === "caido" ? ap.parecidos.map((p) => p.avisoId.slice(-1)) : [];
      if (ids.join() !== "1,5,2") F(`5 · los parecidos no son los de su comuna, sus dormitorios y su precio primero (${ids.join()})`);
      if (cp.parecidosQueDan(DEPTO, vecinos, AVISO).some((p) => p.avisoId === AVISO) || cp.parecidosQueDan(DEPTO, vecinos, AVISO).length !== cp.MAX_PARECIDOS) F("5 · los parecidos traen el mismo aviso o no son tres");
      if (cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: [] }).tipo !== "caido" || (cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: [] }) as { estado?: string }).estado !== "no-da") F("5 · un aviso que sigue publicado pero ya no conviene no se lee «no-da»");
      // La tarjeta: lo dice y ofrece los parecidos; tocar uno abre su tarjeta.
      const html = renderToStaticMarkup(createElement(CompartidoCaido, { estado: "despublicado", depto: DEPTO, parecidos: ap.tipo === "caido" ? ap.parecidos : [], sinCuenta: true, alAbrir: () => {}, alCerrar: () => {} }));
      // El TÍTULO dice lo que pasó, no solo el aria-label de la tarjeta (D7 lo dejó verde en la primera versión: el texto
      // seguía en el aria-label con el título cambiado).
      const titulo = (h: string) => /data-explorar="caido-titulo">([^<]*)<\/b>/.exec(h)?.[1] ?? "";
      if (titulo(html) !== cp.COMPARTIR_COPY.caido.despublicado || !html.includes(cp.COMPARTIR_COPY.caido.parecidos) || (html.match(/data-explorar="parecido"/g) ?? []).length !== 3 || !html.includes("Providencia · 2D2B · 79 m² · UF 4.591")) F("5 · la tarjeta de «ya no está» no lo dice o no ofrece los parecidos");
      if (/\+\$120/.test(html)) F("5 · sin cuenta, los parecidos muestran el flujo");
      const vacia = renderToStaticMarkup(createElement(CompartidoCaido, { estado: "no-da", depto: DEPTO, parecidos: [], sinCuenta: false, alAbrir: () => {}, alCerrar: () => {} }));
      if (titulo(vacia) !== cp.COMPARTIR_COPY.caido.noDa || !vacia.includes(cp.COMPARTIR_COPY.caido.sinParecidos)) F("5 · sin parecidos (o si ya no conviene) la tarjeta no lo dice");
      // El de un negociado nunca estuvo entre los que convienen al precio publicado: la frase no dice «ya no», y dice a qué precio.
      if (/\bya no\b/i.test(cp.COMPARTIR_COPY.caido.noDa) || !cp.COMPARTIR_COPY.caido.noDa.includes(AL_PRECIO_PUBLICADO)) F(`5 · la tarjeta de «no conviene» afirma que convenía o no dice a qué precio: «${cp.COMPARTIR_COPY.caido.noDa}»`);
      if (!/alAbrir=\{tocarPin\}/.test(cliente) || !/setCaido\(\{ estado: ap\.estado, depto: ap\.depto, parecidos: ap\.parecidos \}\);/.test(cliente)) F("5 · el navegador no muestra la tarjeta de «ya no está» o tocar un parecido no abre su tarjeta");
      if (!/return \{ avisoId: c\.avisoId, estado: f \? \(f\.estado === "despublicado" \? "despublicado" : null\) : null, depto: f\?\.depto \?\? null \};/.test(pagina)) F("5 · la página no le dice al navegador que el aviso ya no está publicado");
    }

    // ── 6 · EL BOTÓN Y EL TEXTO ──
    {
      const texto = cp.textoCompartir(DEPTO, { comprar: true, score: 84 });
      if (texto !== "Providencia · 2D2B · 79 m² · UF 4.591 · ✓ Comprar 84 al precio publicado, según Franco") F(`6 · el texto que viaja no es el del goal: «${texto}»`);
      const sinVer = cp.textoCompartir(DEPTO, { comprar: false, score: 84 });
      if (/Comprar|84/.test(sinVer) || !sinVer.startsWith("Providencia · 2D2B · 79 m² · UF 4.591")) F(`6 · sin el Comprar de por defecto, el texto lo promete igual: «${sinVer}»`);
      if (!cp.esVistaEstandar({ pie: 20, plazo: 30, tasa: null }) || cp.esVistaEstandar({ pie: 30, plazo: 30, tasa: null }) || cp.esVistaEstandar({ pie: 20, plazo: 25, tasa: null }) || cp.esVistaEstandar({ pie: 20, plazo: 30, tasa: 4.5 })) F("6 · la vista de por defecto no es pie 20 %, 30 años y la tasa de hoy");
      if (!/const ver = estd \? veredictoDelPin\(p\) : resueltos\.current\.get\(`\$\{filtros\.modalidad\}\|\$\{p\.avisoId\}`\) \?\? await veredictoEstandar\(p\);/.test(cliente) || !/const texto = textoCompartir\(deptoDePin\(p\), ver\);/.test(cliente)) F("6 · con otro pie, el texto dice el veredicto de quien comparte y no el de por defecto");
      // EL NEGOCIADO (la capa «Si negocias»): en la vista de por defecto su veredicto es Ajustar al precio publicado; el texto no
      // puede decir «Comprar» (ni su puntaje), y el del pin que sí da, sí. El cliente lo lee del pin en los dos caminos.
      const negociado: PinNegociado = { ...pin(OTRO), veredicto: "AJUSTA SUPUESTOS", score: 61, neg: { d: 4.2, p: 4398, s: 71, f: 15000 } };
      const vNeg = cp.veredictoDelPin(negociado);
      const tNeg = cp.textoCompartir(DEPTO, vNeg);
      if (vNeg.comprar || vNeg.score != null || /Comprar|61|71/.test(tNeg)) F(`6 · un negociado se comparte como Comprar: «${tNeg}»`);
      const vPin = cp.veredictoDelPin(pin(AVISO));
      if (!vPin.comprar || vPin.score !== 84) F("6 · el pin que da Comprar se comparte sin su Comprar y su puntaje");
      if (!/if \(esVistaEstandar\(filtros\)\) return Promise\.resolve\(veredictoDelPin\(p\)\);/.test(cliente) || /comprar: true/.test(cliente)) F("6 · en la vista de por defecto el cliente supone Comprar sin mirar el pin");
      // El teléfono abre la hoja del sistema (sin ella, WhatsApp); el PC copia el enlace y lo dice.
      if (!/const telefono = typeof window\.matchMedia === "function" && window\.matchMedia\("\(pointer: coarse\)"\)\.matches;/.test(cliente) || !/const metodo: MetodoCompartir = telefono \? \(typeof navigator\.share === "function" \? "hoja" : "whatsapp"\) : "copiar";/.test(cliente)) F("6 · no se distingue el teléfono (la hoja) del PC (copiar)");
      if (!/await navigator\.share\(\{ title: ver\.comprar \? COMPARTIR_COPY\.tituloHoja : COMPARTIR_COPY\.tituloHojaSinVeredicto, text: texto, url \}\);/.test(cliente)) F("6 · la hoja del sistema no lleva el texto y el enlace, o titula «conviene» al que se comparte sin veredicto");
      if (/conviene/i.test(cp.COMPARTIR_COPY.tituloHojaSinVeredicto)) F("6 · el título de la hoja sin veredicto dice que conviene");
      if (!/window\.open\(`https:\/\/wa\.me\/\?text=\$\{encodeURIComponent\(mensajeCompartir\(texto, url\)\)\}`/.test(cliente)) F("6 · sin la hoja del sistema, el teléfono no abre WhatsApp");
      if (!/setToast\(\(await copiarAlPortapapeles\(url\)\) \? COMPARTIR_COPY\.copiado : COMPARTIR_COPY\.noCopiado\);\s*\}\s*$/m.test(cliente) || !/\{toast && <p className="ex-toast" role="status" data-explorar="toast">\{toast\}<\/p>\}/.test(cliente)) F("6 · en el PC no se copia el enlace o no se dice");
      // «Compartir» en la tarjeta y en cada fila, con y sin cuenta.
      const pines = [pin(AVISO), pin(OTRO)];
      for (const sinCuenta of [true, false]) {
        const t = renderToStaticMarkup(createElement(TarjetaPin, { pines, seleccionado: AVISO, uf: 39000, analizados: {}, guardados: new Set<string>(), generando: null, error: null, alCambiar: () => {}, alCerrar: () => {}, alGuardar: () => {}, alAnalizar: () => {}, alCompartir: () => {}, sinCuenta }));
        // La lista con la capa prendida: también la fila del negociado lleva «Compartir».
        const neg: PinNegociado = { ...pin("2f5e7c1a-0b6d-4e8f-9a3c-5d7e9f1b3c5e", { veredicto: "AJUSTA SUPUESTOS" }), neg: { d: 4.2, p: sinCuenta ? null : 4398, s: 71, f: null } };
        const l = renderToStaticMarkup(createElement(ListaPortal, { pines, negociados: [neg], tope: 5, total: 2, calculando: false, orden: "puntaje", uf: 39000, analizados: {}, guardados: new Set<string>(), alOrden: () => {}, alAbrir: () => {}, alGuardar: () => {}, alCompartir: () => {}, alAvisame: () => {}, alCerrar: () => {}, sinCuenta }));
        const n = (s: string) => (s.match(/data-explorar="compartir"[^>]*aria-label="Compartir"|aria-label="Compartir"[^>]*data-explorar="compartir"/g) ?? []).length;
        if (n(t) !== 2 || n(l) !== 3 || !l.includes('data-explorar="fila-negociada"')) F(`6 · «Compartir» no está en cada tarjeta y cada fila ${sinCuenta ? "sin" : "con"} cuenta (tarjeta ${n(t)}, lista ${n(l)} de 3 con el negociado)`);
      }
    }
  } catch (e) {
    F(`el tier se cayó: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  } finally {
    if (posthog != null) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }

  if (fallas.length) {
    console.log(`  ✗ ${fallas.length} falla(s) dura(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el enlace abre su pin (tarjeta y mapa centrado, una vez); la vista previa es la línea, el precio y el chip, solo para los robots; el registro queda C · depto y acredita a los dos; la vista y el botón se miden; el que ya no está ofrece parecidos; el texto es el del goal");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runCompartirDeptoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (02-nov-2026) ──
// 67 de 67 en ROJO (runner `mutar-compartir.cjs` en el scratchpad de la sesión 1243824f; cada archivo restaurado byte a byte y
// comparado contra el original). Dos quedaron VERDES en la primera corrida y se reescribieron sus predicados: E9 (el panel
// aceptaba «invitados_por_depto» en cualquier lado; ahora exige el CTE de las visitas del depto, la vía y la tasa) y D7 (el
// título de la tarjeta de «ya no está» se buscaba en todo el HTML y el aria-label lo repetía; ahora se lee el elemento).
//   §1 M1 el enlace lleva otro valor en `a` · M2 cualquier `a` es un enlace compartido · M3 sin cuenta la página no abre el pin ·
//      M4 con cuenta tampoco · M5 la apertura no reconoce el pin · M6 el navegador no lo elige · M7 se resuelve más de una vez ·
//      M8 el foco no es el pin · M9 el mapa encuadra sin el foco · M10 el efecto del foco centra dos veces · M11 la llegada y el
//      código se quedan en la barra · M12 la bienvenida tapa la tarjeta.
//   §2 V1 la vista previa trae el puntaje · V2 el chip aunque no dé Comprar · V3 la imagen dibuja el puntaje · V4 los metadatos
//      también para las personas · V5 el título con el puntaje · V6 la ficha dice comprar sin mirar el universo · V7 sin caché ·
//      V8 la caché sumada al «immutable» de Next · V9 la imagen a 1200 × 630 (589 kB en el preview: V8 y V9, después del preview).
//   §3 R1 la cookie siempre «enlace» · R2 el middleware no lee el código · R3 la cookie no recuerda la marca · R4 el cobro ignora
//      la vía · R5 los prefijos cruzados · R6 el enlace sin el código · R7 el código no se pide · R8 se lee fuera de /explorar ·
//      R9 sin código se pierde «explorar:compartido».
//   §4 E1 la vista con el nombre de otra · E2 con el uuid de la visita · E3 con sesión sale anónima · E4 con_sesion falso ·
//      E5 «explorar_compartir» sin origen · E6 la lista se mide como tarjeta · E7 «referido_vinculado» sin la vía · E8 la tabla de
//      activación sin la C del depto · E9 el panel de referidos sin la tasa del depto · E10 sin las visitas del depto · E11 los
//      invitados por depto sin la vía.
//   §5 D1 «publicado» ignora la ficha · D2 ignora la semana · D3 el despublicado se busca en el universo · D4 los parecidos sin
//      su comuna y dormitorios primero · D5 traen el mismo aviso · D6 la apertura ignora el despublicado · D7 la tarjeta dice
//      siempre lo mismo · D8 sin cuenta los parecidos con el flujo · D9 la página no dice despublicado · D10 tocar un parecido
//      no abre su tarjeta.
//   §6 T1 el texto sin el puntaje · T2 promete Comprar sin el de por defecto · T3 la vista de por defecto ignora la tasa · T4 con
//      otro pie, el veredicto de quien comparte · T5 el teléfono no se reconoce · T6 la hoja sin el texto · T7 sin hoja no va a
//      WhatsApp · T8 el PC no dice que copió · T9 la lista sin «Compartir» · T10 sin cuenta la tarjeta sin «Compartir» · T11 el
//      botón no se llama «Compartir».
// En el mismo runner, los predicados reescritos de PUERTA-C y PUERTA-E (cada uno con su acta en su archivo), contra su tier:
//   X1 el middleware pisa la primera cookie · X2 la invitada sin la puerta C · X3 la foto sin el mapa de respaldo · X4 la
//   bienvenida con cuenta · X5 el registro por visita cuenta los del depto · X6 (EXPLORAR-PORTAL) el mapa chico con la llave de
//   Street View · X7 (LECTURA-PAGINADA) la ficha lee scraped_properties sin orden ni tope. 7 de 7 en ROJO.
// TRAS EL REBASE SOBRE FILTROS V2 Y «SI NEGOCIAS» (02-nov-2026): el runner entero otra vez sobre el código rebasado, 76 de 76 en
// ROJO (los 62 del tier, X1–X7 y estos siete nuevos, que vigilan al negociado: Ajustar al precio publicado):
//   N1 el negociado se comparte como Comprar · N2 la vista de por defecto supone Comprar al preparar · N3 ídem al tocar ·
//   N4 la tarjeta de «no conviene» dice «ya no» · N5 la hoja titula «conviene» al que va sin veredicto · N6 el título sin
//   veredicto dice que conviene · N7 la fila del negociado sin «Compartir».
