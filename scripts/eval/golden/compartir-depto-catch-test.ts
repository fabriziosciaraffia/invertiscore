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
//       negociado de la capa «Si negocias» (Ajustar al precio publicado) nunca se comparte como «Comprar».
//   7 · EL NEGOCIADO SE COMPARTE CON SU VERDAD COMPLETA (03-nov-2026, goal de Fabrizio): el texto «… · UF 3.080 · Conviene si
//       lo negocias a UF 2.950 (−4,2 %), según Franco»; el enlace lleva el tope de la capa y abre con «Si negocias» prendido, en
//       ese pin (el navegador espera la capa y toma el precio de hoy); la vista previa, el chip Ajustar al precio publicado y
//       «Conviene si lo negocias a UF 2.950», sin otro número; si con los datos de hoy ya no llega dentro del tope (la ficha
//       verifica como antes de cobrar, sin leer la ficha del aviso), la tarjeta lo dice y ofrece parecidos.
//   8 · LOS ENLACES LLEVAN UNA FIRMA (03-nov-2026, goal de Fabrizio): la firma del servidor para el aviso y el código de quien
//       comparte; lo nítido sin cuenta, la vista previa con cifras y su imagen, solo con ella. Un enlace armado a mano sin
//       firma o con la de otro aviso abre el pin borroso y sin vista previa con cifras. 60 firmas por hora por sesión y por IP.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/compartir-depto-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ec from "../../../src/lib/explorar/enlace-compartido";
import * as cp from "../../../src/lib/explorar/compartir";
import { estaPublicado, fichaCompartida } from "../../../src/lib/explorar/compartir-servidor";
import { cercanos, portalDeUrl, type PinMapa } from "../../../src/lib/explorar/portal";
import type { VerificacionNegociado } from "../../../src/lib/avisos/negociar";
import * as fc from "../../../src/lib/explorar/firma-compartido";
import { emitirFirma, sesionDe, TOPE_FIRMAS_POR_HORA, type AlmacenFirmas } from "../../../src/lib/explorar/firmas-servidor";
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
      // ⚠ ACTA (03-nov-2026, el negociado): compartidoDe recibe el tope de la capa y si hay cuenta (el precio de hoy solo viaja con ella).
      if (!/compartidoDe\(sp, filtros\.negociar, false\),/.test(pagina) || !/compartidoDe\(sp, filtros\.negociar, true\),/.test(pagina)) F("1 · la página no lee el enlace compartido en las dos ramas (con y sin cuenta), con el tope de la capa");
      // Con el universo: la tarjeta del pin, con los cercanos y él primero; o la de «ya no está».
      const vis = [pin(OTRO, { lat: -33.4301 }), pin(AVISO), pin("2a7d1c55-0000-4000-8000-000000000001", { lat: -33.5 })];
      const ap = cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: vis });
      if (ap.tipo !== "pin" || ap.avisoId !== AVISO) F("1 · un aviso que está entre los que convienen no abre su tarjeta");
      if (cercanos(vis, AVISO)[0]?.avisoId !== AVISO) F("1 · la tarjeta no abre con el pin del enlace primero");
      if (cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: DEPTO, visibles: vis.filter((p) => p.avisoId !== AVISO) }).tipo !== "caido") F("1 · un aviso que no está abre una tarjeta igual");
      // ⚠ ACTA (03-nov-2026): la apertura mira también la capa «Si negocias» (los cercanos salen de los dos) y, si el servidor
      // trae el precio de hoy de un negociado, lo pone antes de abrir.
      if (!/const ap = aperturaCompartida\(\{ avisoId: compartido\.avisoId, estado: compartido\.estado, depto: compartido\.depto, visibles, negociados: visiblesNeg \}\);\s*if \(ap\.tipo === "pin"\) \{\s*const hoy = compartido\.neg;\s*if \(hoy && visiblesNeg\.some\(\(p\) => p\.avisoId === ap\.avisoId && p\.neg\.p !== hoy\.p\)\) setMovidos\(\(m\) => \(\{ \.\.\.m, \[ap\.avisoId\]: hoy \}\)\);\s*setCarrusel\(cercanos\(todos, ap\.avisoId\)\.map\(\(p\) => p\.avisoId\)\);\s*setSel\(ap\.avisoId\);\s*return;\s*\}/.test(cliente)) F("1 · el navegador no abre la tarjeta del pin del enlace con sus cercanos (o no toma el precio de hoy de un negociado)");
      if (!/if \(compartidoResuelto\.current \|\| esperaCapa\) return;\s*compartidoResuelto\.current = true;/.test(cliente)) F("1 · el enlace compartido se resuelve más de una vez (cada universo nuevo volvería a abrir la tarjeta)");
      // El mapa: centrado en el pin (entre los que convienen o en la capa), una vez.
      if (!/const p = porId\.get\(compartido\.avisoId\);\s*if \(p\) return \{ lat: p\.lat, lng: p\.lng \};/.test(cliente) || !/const porId = useMemo\(\(\) => new Map<string, PinMapa>\(todos\.map\(\(p\) => \[p\.avisoId, p\]\)\), \[todos\]\);/.test(cliente)) F("1 · el foco del mapa no es el pin del enlace");
      if (!/foco=\{foco\}\s*onFoco=\{\(\) => setFocoUsado\(true\)\}/.test(cliente) || !/if \(focoUsado \|\| !compartido \|\| !universo\) return null;/.test(cliente)) F("1 · el mapa no recibe el foco o lo recibe más de una vez");
      if (!/const f = focoRef\.current;\s*if \(f\) \{ map\.setCenter\(f\); map\.setZoom\(ZOOM_FOCO\); focoRef\.current = null; cb\.current\.onFoco\?\.\(\); return; \}\s*if \(ps\.length === 0\)/.test(mapa)) F("1 · el mapa no se centra en el foco antes de encuadrar los pines");
      if (!/useEffect\(\(\) => \{ if \(mapRef\.current && focoRef\.current\) \{ encuadrarRef\.current\(\); dibujarRef\.current\(\); \} \}, \[foco\]\);/.test(mapa)) F("1 · el foco que llega con el universo no centra el mapa (o lo centra dos veces)");
      // Lo que se usa una vez sale de la barra (la recarga no vuelve a contar la vista ni a repartir el código).
      // ⚠ ACTA (03-nov-2026): la firma también sale de la barra (quien la copie no reparte la firma ni el código de otro).
      if (ec.PARAMS_DE_UNA_VEZ.join() !== "desde,i,f" || !/for \(const k of PARAMS_DE_UNA_VEZ\) u\.searchParams\.delete\(k\);/.test(cliente)) F("1 · la llegada, el código o la firma se quedan en la barra");
      if (!/if \(!sinCuenta \|\| inicial\.n == null \|\| compartido\) return;/.test(cliente)) F("1 · la bienvenida tapa la tarjeta del depto compartido");
    }

    // ── 2 · LA VISTA PREVIA NO TRAE CIFRAS MÁS ALLÁ DEL CHIP ──
    {
      const ficha: cp.FichaCompartida = { avisoId: AVISO, modalidad: "ltr", estado: "comprar", depto: { ...DEPTO, condicion: "usado" }, score: 87 };
      const v = cp.contenidoVistaPrevia(ficha);
      if (Object.keys(v).sort().join() !== "chip,descripcion,linea,negociado,precio,titulo" || v.negociado !== null) F(`2 · la vista previa trae otros campos: ${Object.keys(v).join(", ")}`);
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
      if (!/const v = contenidoVistaPrevia\(ficha\);/.test(og) || !/\{v\.linea\}/.test(og) || !/\{v\.precio\}/.test(og) || !/\{v\.chip === "COMPRAR" \? \(/.test(og)) F("2 · la imagen no dibuja la línea, el precio y el chip de contenidoVistaPrevia");
      // La caché es la PROPIA, en la respuesta que sale, no sumada a la de Next (medido en el preview: con `headers` en las
      // opciones de ImageResponse quedaba «immutable, max-age=31536000» delante).
      if (!/return new Response\(new Uint8Array\(jpeg \?\? png\), \{ headers: \{ "Content-Type": jpeg \? "image\/jpeg" : "image\/png", "Cache-Control": CACHE \} \}\);/.test(og) || !/const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";/.test(og)) F("2 · la imagen no queda en la caché del CDN (o hereda el «immutable» de un año)");
      // El peso (medido en el preview: 589 kB a 1200 × 630; a 800 × 420, de 308 a 530 kB en PNG y 44 kB en JPEG; WhatsApp se
      // salta las de más de ~300 kB): sale a 800 × 420 y en JPEG, con una calidad que no la infla.
      if (!/const ESCALA = 2 \/ 3;/.test(og) || !/\{ width: ANCHO, height: ALTO, fonts \}/.test(og) || !/const ANCHO = e\(1200\);\s*const ALTO = e\(630\);/.test(og)) F("2 · la imagen de la vista previa no sale a 800 × 420 (pesa de más para WhatsApp)");
      const calidad = Number(/const CALIDAD_JPEG = (\d+);/.exec(og)?.[1] ?? NaN);
      if (!/const png = Buffer\.from\(await respuesta\.arrayBuffer\(\)\);\s*const jpeg = await aJpeg\(png\);/.test(og) || !/return await sharp\(png\)\.jpeg\(\{ quality: CALIDAD_JPEG, mozjpeg: true \}\)\.toBuffer\(\);/.test(og) || !(calidad >= 60 && calidad <= 85)) F(`2 · la imagen no sale en JPEG (o con una calidad que la infla: ${calidad})`);
      if (!/fichaCompartidaCacheada\(params\.avisoId, modalidad, tope\)/.test(og)) F("2 · la imagen no comprueba en el servidor cómo está el depto");
      // LAS FUENTES (02-nov-2026, Fabrizio: «habíamos simplificado»): la de Explorar, Inter —la línea en 400, el precio y el chip
      // en 600, como la tarjeta del pin—, nunca las del informe; en TTF estático que la función lee de public/fonts.
      const familias = [...og.matchAll(/fontFamily: ([^,}]+)/g)].map((m) => m[1].trim());
      if (familias.length < 5 || familias.some((x) => x !== "INTER") || !/const INTER = "Inter";/.test(og) || /JetBrains|Source Serif|Plex/i.test(og)
        || !/const FUENTES = \{ regular: "Inter-Regular-es\.ttf", semibold: "Inter-SemiBold-es\.ttf" \} as const;/.test(og)
        || !/\{ name: INTER, data: f\.regular, weight: 400 as const, style: "normal" as const \}/.test(og) || !/\{ name: INTER, data: f\.semibold, weight: 600 as const, style: "normal" as const \}/.test(og)
        || !existsSync(join(RAIZ, "public", "fonts", "Inter-Regular-es.ttf")) || !existsSync(join(RAIZ, "public", "fonts", "Inter-SemiBold-es.ttf"))) F(`2 · la imagen no va en Inter, la fuente de Explorar (familias: ${familias.join(", ")})`);
      if (!/fontFamily: INTER, fontWeight: 600, fontSize: e\(\d+\)[^}]*\}\}>\{v\.precio\}<\/div>/.test(og) || !/fontFamily: INTER, fontWeight: 600, fontSize: e\(\d+\) \}\}>\s*<Check/.test(og) || !/fontFamily: INTER, fontWeight: 400, fontSize: e\(\d+\)[^}]*\}\}>\{v\.linea\}<\/div>/.test(og)) F("2 · el precio y el chip no van en Inter 600 y la línea en 400, como la tarjeta del pin");
      // Los metadatos: los de contenidoVistaPrevia, solo para los robots de vista previa.
      const meta = pagina.slice(pagina.indexOf("export async function generateMetadata"), pagina.indexOf("const mapaQuieto"));
      // Los metadatos declaran el tamaño con que sale (WhatsApp y las redes reservan el lugar con él).
      if (cp.VISTA_PREVIA_PX.ancho !== Math.round(1200 * 2 / 3) || cp.VISTA_PREVIA_PX.alto !== Math.round(630 * 2 / 3) || !/width: VISTA_PREVIA_PX\.ancho, height: VISTA_PREVIA_PX\.alto, alt: v\.titulo/.test(meta)) F("2 · los metadatos declaran otro tamaño que el de la imagen");
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
      // ⚠ ACTA (03-nov-2026, la firma): el código de quien comparte ya no lo pide el navegador aparte: lo pone el servidor en el
      // mismo pedido que firma (la firma lo incluye), y el enlace lleva el que vino con ella.
      if (!/const url = enlaceCompartido\(window\.location\.origin, \{ avisoId: p\.avisoId, modalidad: filtros\.modalidad, comuna: p\.comuna, codigo: prep\.codigo, tope, firma: prep\.firma \}\);/.test(cliente)) F("3 · el enlace que se comparte no lleva el código de quien tiene cuenta");
      if (!/const codigo = user \? \(await asegurarInvitacion\(admin, \{ userId: user\.id, conNombre: false, dispositivo: huella\.dispositivo \}\)\)\?\.codigo \?\? null : null;/.test(codigo("src/app/api/explorar/compartido/route.ts")) || !/return \{ firma: d\.firma, codigo: d\.codigo \?\? null, ver \};/.test(cliente)) F("3 · el código de quien tiene cuenta no viene del servidor con la firma");
    }

    // ── 4 · LA MEDICIÓN ──
    {
      const comp = { avisoId: AVISO, modalidad: "ltr" as const, codigo: "K7M2QX", firma: null };
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
      // ⚠ ACTA (03-nov-2026): lo que se comparte sale del pin salvo que lo diga el servidor (otro pie, o un negociado sin cuenta).
      // ⚠ ACTA (03-nov-2026, la firma): lo del servidor llega en el pedido firmado (`prep`), que se pide siempre.
      if (!/const prep = resueltos\.current\.get\(claveServidor\(p\)\) \?\? await prepararEnlace\(p\);/.test(cliente) || !/const ver = !pideAlServidor\(p, filtros\) \? veredictoDelPin\(p\) : prep\.ver;/.test(cliente) || !/const texto = textoCompartir\(deptoDePin\(p\), ver\);/.test(cliente)
        || !/const claveServidor = \(p: PinMapa\) => `\$\{filtros\.modalidad\}\|\$\{filtros\.negociar \?\? TOPE_DE_LA_NOCHE\}\|\$\{p\.avisoId\}`;/.test(cliente)) F("6 · con otro pie, el texto dice el veredicto de quien comparte y no el de por defecto");
      // EL NEGOCIADO (la capa «Si negocias»): en la vista de por defecto su veredicto es Ajustar al precio publicado; el texto
      // nunca dice «Comprar» ni su puntaje (dice el precio al que conviene: §7), y el del pin que sí da, sí.
      const negociado: PinNegociado = { ...pin(OTRO), veredicto: "AJUSTA SUPUESTOS", score: 61, neg: { d: 4.2, p: 4398, s: 71, f: 15000 } };
      const vNeg = cp.veredictoDelPin(negociado);
      const tNeg = cp.textoCompartir(DEPTO, vNeg);
      if (vNeg.comprar || vNeg.score != null || /Comprar|61|71/.test(tNeg)) F(`6 · un negociado se comparte como Comprar: «${tNeg}»`);
      const vPin = cp.veredictoDelPin(pin(AVISO));
      if (!vPin.comprar || vPin.score !== 84) F("6 · el pin que da Comprar se comparte sin su Comprar y su puntaje");
      if (cp.veredictoDelPin(pin(OTRO, { veredicto: "AJUSTA SUPUESTOS", score: 66 })).comprar) F("6 · un pin que no da Comprar (sin negociación) se comparte como Comprar");
      if (!/const ver = !pideAlServidor\(p, filtros\) \? veredictoDelPin\(p\) : prep\.ver;/.test(cliente) || /comprar: true, score: p\.score/.test(cliente) || !/const ver: VeredictoCompartido = d\.estado === "comprar" \? \{ comprar: true, score: d\.score \?\? null \}/.test(cliente)) F("6 · en la vista de por defecto el cliente supone Comprar sin mirar el pin");
      // El teléfono abre la hoja del sistema (sin ella, WhatsApp); el PC copia el enlace y lo dice.
      if (!/const telefono = typeof window\.matchMedia === "function" && window\.matchMedia\("\(pointer: coarse\)"\)\.matches;/.test(cliente) || !/const metodo: MetodoCompartir = telefono \? \(typeof navigator\.share === "function" \? "hoja" : "whatsapp"\) : "copiar";/.test(cliente)) F("6 · no se distingue el teléfono (la hoja) del PC (copiar)");
      if (!/await navigator\.share\(\{ title: ver\.comprar \? COMPARTIR_COPY\.tituloHoja : ver\.negociado \? COMPARTIR_COPY\.negociado\.tituloHoja : COMPARTIR_COPY\.tituloHojaSinVeredicto, text: texto, url \}\);/.test(cliente)) F("6 · la hoja del sistema no lleva el texto y el enlace, o titula «conviene» al que se comparte sin veredicto");
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

    // ── 7 · EL NEGOCIADO SE COMPARTE CON SU VERDAD COMPLETA (03-nov-2026) ──
    {
      const NUNOA: cp.DeptoCompartido = { comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, condicion: "usado", precioUF: 3080, dormitorios: 2, lat: -33.456, lng: -70.6 };
      const NOCHE = { d: 4.2, p: 2950, s: 71, f: -35000 };
      const negP: PinNegociado = { ...pin(AVISO, { comuna: "Ñuñoa", m2: 58, precioUF: 3080, condicion: "usado", lat: -33.456, lng: -70.6 }), veredicto: "AJUSTA SUPUESTOS", score: 62, neg: NOCHE };
      const ESTD = { pie: 20, plazo: 30, tasa: null } as const;
      // El texto del goal.
      const texto = cp.textoCompartir(cp.deptoDePin(negP), cp.veredictoDelPin(negP));
      if (texto !== "Ñuñoa · 2D2B · 58 m² · Usado · UF 3.080 · Conviene si lo negocias a UF 2.950 (−4,2 %), según Franco") F(`7 · el texto del negociado no es el del goal: «${texto}»`);
      // Sin cuenta su precio no viajó: lo dice el servidor (y con otro pie, también); con cuenta en la vista de por defecto, el pin.
      const sinCifras: PinNegociado = { ...negP, neg: { d: 5, p: null, s: 71, f: null } };
      if (!cp.pideAlServidor(sinCifras, ESTD) || cp.pideAlServidor(negP, ESTD) || !cp.pideAlServidor(negP, { ...ESTD, pie: 30 as const }) || cp.pideAlServidor(pin(OTRO), ESTD)) F("7 · el negociado sin cuenta no pide su precio al servidor (o lo pide el que ya lo tiene)");
      // ⚠ ACTA (03-nov-2026, la firma): el pedido es POST, firmado, con el tope en el cuerpo; se pide al apoyar el dedo, no al abrir.
      if (!/d\.estado === "negociado" && d\.neg \? \{ comprar: false, score: null, negociado: d\.neg \}/.test(cliente) || !/body: JSON\.stringify\(\{ a: p\.avisoId, m: filtros\.modalidad, \.\.\.\(filtros\.modalidad === "str" \? \{\} : \{ n: filtros\.negociar \?\? TOPE_DE_LA_NOCHE \}\) \}\),/.test(cliente)) F("7 · el navegador no trae del servidor (con el tope) lo que se comparte de un negociado");
      // El enlace: el tope de la capa, que abre /explorar con «Si negocias» prendido.
      const u = new URL(ec.enlaceCompartido("https://refranco.ai", { avisoId: AVISO, modalidad: "ltr", comuna: "Ñuñoa", codigo: "k7m2qx", tope: cp.topeDelEnlace(5, 4.2) }));
      if (u.searchParams.get("n") !== "5" || portalDeUrl(u.searchParams).filtros.negociar !== 5 || ec.compartidoDeUrl(u.searchParams)?.avisoId !== AVISO) F(`7 · el enlace del negociado no lleva el tope de la capa (${u.toString()})`);
      if (cp.topeDelEnlace(null, 4.2) !== 5 || cp.topeDelEnlace(10, 4.2) !== 10 || cp.topeDelEnlace(5, 7.5) !== 10) F("7 · el tope del enlace no es el de la capa o no alcanza el descuento");
      if (new URL(ec.enlaceCompartido("https://refranco.ai", { avisoId: AVISO, modalidad: "str", comuna: "Ñuñoa", codigo: null, tope: 5 })).searchParams.has("n")) F("7 · en renta corta el enlace lleva el tope de una capa que no existe");
      if (!/const tope = ver\.negociado \? topeDelEnlace\(filtros\.negociar, ver\.negociado\.d\) : null;/.test(cliente)) F("7 · el navegador no pone el tope en el enlace de un negociado");
      // La vista previa: el chip Ajustar al precio publicado y «Conviene si lo negocias a UF 2.950»; ningún otro número.
      const fichaNeg: cp.FichaCompartida = { avisoId: AVISO, modalidad: "ltr", estado: "negociado", depto: NUNOA, score: null, neg: NOCHE, tope: 5 };
      const v = cp.contenidoVistaPrevia(fichaNeg);
      if (v.chip !== "AJUSTA SUPUESTOS" || v.negociado !== "Conviene si lo negocias a UF 2.950" || v.precio !== "UF 3.080" || v.descripcion !== "Conviene si lo negocias a UF 2.950, según Franco.") F(`7 · la vista previa del negociado no es el chip Ajustar y su línea (${JSON.stringify(v)})`);
      const numeros = Object.values(v).join(" | ").match(/\d+(?:[.,]\d+)*/g) ?? [];
      const permitidos = new Set(["2", "58", "3.080", "2.950"]);
      if (numeros.some((x) => !permitidos.has(x)) || /%|−/.test(Object.values(v).join(" "))) F(`7 · la vista previa del negociado trae otro número: ${numeros.join(", ")}`);
      if (cp.rutaVistaPrevia(AVISO, "ltr", 5) !== `/api/og/depto/${AVISO}?n=5` || cp.rutaVistaPrevia(AVISO, "str", 5) !== `/api/og/depto/${AVISO}?m=str`) F("7 · la imagen del negociado no lleva el tope (o la de renta corta lo lleva)");
      const og = codigo("src/app/api/og/depto/[avisoId]/route.tsx");
      if (!/const CHIP_AJUSTAR = \{ fondo: "#F1E4EC", texto: "#6E4560", borde: "#DCC6D4" \};/.test(og) || !/\{v\.chip === "AJUSTA SUPUESTOS" && v\.negociado \? \(/.test(og) || !/\{NEGOCIADO_COPY\.alPublicado\}/.test(og) || !/const corte = v\.negociado \? v\.negociado\.lastIndexOf\(" a UF "\) : -1;/.test(og) || !/\{piezasNegociado\.map\(\(t, i\) => <span key=\{i\}/.test(og)
        || !/const tope = esTopeNegociar\(sp\.get\("n"\)\) \? Number\(sp\.get\("n"\)\) : null;/.test(og)) F("7 · la imagen no dibuja «Al precio publicado» con el chip Ajustar de la casa y la línea del negociado (o no lee el tope)");
      const meta = pagina.slice(pagina.indexOf("export async function generateMetadata"), pagina.indexOf("const mapaQuieto"));
      if (!/const tope = portalDeUrl\(sp\)\.filtros\.negociar;\s*const ficha = await fichaCompartidaCacheada\(c\.avisoId, c\.modalidad, tope\)/.test(meta) || !/url: rutaVistaPrevia\(c\.avisoId, c\.modalidad, ficha\.tope \?\? null, \{ f: c\.firma!, i: c\.codigo \}\)/.test(meta)) F("7 · los metadatos del enlace de un negociado no son los del negociado");
      const api = codigo("src/app/api/explorar/compartido/route.ts");
      // El texto dice el precio de la noche (como el de quien tiene cuenta): la API no verifica, que haría esperar a la hoja.
      if (!/const tope = esTopeNegociar\(b\.n\) \? Number\(b\.n\) : null;/.test(api) || !/await fichaCompartida\(admin, a, "ltr", \{ veredicto: true, tope, verificar: segunLaNoche \}\)/.test(api) || !/const neg = f\.estado === "negociado" && f\.neg \? \{ p: f\.neg\.p, d: f\.neg\.d \} : null;/.test(api)
        || !/export const segunLaNoche: VerificarNegociado = async \(\) => \(\{ estado: "sigue" \}\);/.test(codigo("src/lib/explorar/negociado-hoy.ts"))) F("7 · la API del texto no dice el negociado de la noche con el tope (o lo verifica y hace esperar a la hoja)");
      // La ficha del servidor: lo de la noche si cabe en el tope, verificado con los datos de hoy.
      const ahora = new Date("2026-11-02T15:00:00Z");
      const sembrada = async (negociar: unknown) => {
        const b = baseFalsa(OPCIONES_BASE);
        await b.from("scraped_properties").insert({ id: AVISO, comuna: "Ñuñoa", lat: -33.456, lng: -70.6, superficie_m2: 58.2, dormitorios: 2, banos: 2, condicion: "usado", is_active: true, type: "venta", scraped_at: "2026-11-02T03:01:14.901", titulo: "Depto 2D2B" });
        b.tabla("avisos_evaluados").push({ aviso_id: AVISO, precio_uf: 3080.4, negociar_20: negociar });
        return b;
      };
      const llamadas: Array<[number, number]> = [];
      const verificar = (r: VerificacionNegociado | Error) => async (_a: string, precio: number, tope: number): Promise<VerificacionNegociado> => {
        llamadas.push([precio, tope]);
        if (r instanceof Error) throw r;
        return r;
      };
      const vacio = async () => [] as PinMapa[];
      const ficha = (b: unknown, o: { tope: number | null; verificar?: ReturnType<typeof verificar>; universo?: () => Promise<PinMapa[]> }) =>
        fichaCompartida(b as never, AVISO, "ltr", { veredicto: true, ahora, tope: o.tope, universo: o.universo ?? vacio, verificar: o.verificar });
      const sigue = await ficha(await sembrada(NOCHE), { tope: 5, verificar: verificar({ estado: "sigue" }) });
      if (sigue?.estado !== "negociado" || sigue.neg?.p !== 2950 || sigue.tope !== 5 || llamadas.length !== 1 || llamadas[0][0] !== 2950 || llamadas[0][1] !== 5) F(`7 · la ficha no da el negociado verificado (${sigue?.estado}, ${JSON.stringify(llamadas)})`);
      const movido = await ficha(await sembrada(NOCHE), { tope: 5, verificar: verificar({ estado: "movido", negociado: { d: 4.6, p: 2938, s: 70, f: -40000 } }) });
      if (movido?.estado !== "negociado" || movido.neg?.p !== 2938) F("7 · si con los datos de hoy el precio se movió, la ficha no dice el de hoy");
      const noLlega = await ficha(await sembrada(NOCHE), { tope: 5, verificar: verificar({ estado: "no-llega" }) });
      if (noLlega?.estado !== "no-llega") F("7 · si con los datos de hoy ya no llega, la ficha no lo dice");
      const antes = llamadas.length;
      const fuera = await ficha(await sembrada({ d: 7.5, p: 2849, s: 70, f: -30000 }), { tope: 5, verificar: verificar({ estado: "sigue" }) });
      if (fuera?.estado !== "no-llega" || llamadas.length !== antes) F("7 · un descuento sobre el tope del enlace no sale «no-llega» sin verificar");
      const sinTope = await ficha(await sembrada(NOCHE), { tope: null, verificar: verificar({ estado: "sigue" }) });
      if (sinTope?.estado !== "no-da" || llamadas.length !== antes) F("7 · sin el tope de la capa, la ficha verifica un negociado");
      const comprar = await ficha(await sembrada(NOCHE), { tope: 5, verificar: verificar({ estado: "sigue" }), universo: async () => [pin(AVISO, { score: 80 })] });
      if (comprar?.estado !== "comprar" || llamadas.length !== antes) F("7 · uno que ya da Comprar al precio publicado se verifica como negociado");
      const falla = await ficha(await sembrada(NOCHE), { tope: 5, verificar: verificar(new Error("comparables")) });
      if (falla?.estado !== "negociado" || falla.neg?.p !== 2950) F("7 · si la verificación falla, la ficha no vale lo de la noche");
      const nh = codigo("src/lib/explorar/negociado-hoy.ts");
      if (!/return verificarNegociado\(\{ publicadoUF: aviso\.precioUF, negociadoUF, tope,/.test(nh) || !/antiguedadDelAviso\(admin, aviso, \{ leida: false, anio: null \}\)/.test(nh) || /bajarFicha|chequearPublicacion|fichaDelAviso|ensureCreditCharged|insert\(|update\(/.test(nh)) F("7 · la verificación de hoy no es la de antes de cobrar (o lee la ficha del aviso, o escribe)");
      // La página: con el tope, la ficha verificada. ⚠ ACTA (03-nov-2026, decisión de Fabrizio: «sí, sin borroso») · el precio
      // negociado de hoy viaja también SIN CUENTA —el depto del enlace se ve nítido—, pero sin el flujo a ese precio.
      // ⚠ ACTA (03-nov-2026, la firma): la regla de qué negociado viaja vive en negDelEnlace (compartir.ts), con la firma (§8).
      if (!/if \(tope != null && c\.modalidad === "ltr" && \(conCuenta \|\| firmado\)\) \{\s*const f = await fichaCompartidaCacheada\(c\.avisoId, "ltr", tope\)/.test(pagina) || !/neg: negDelEnlace\(f, \{ conCuenta, firmado \}\)/.test(pagina)
        || JSON.stringify(cp.negDelEnlace({ estado: "negociado", neg: NOCHE }, { conCuenta: false, firmado: true })) !== JSON.stringify({ ...NOCHE, f: null }) || cp.negDelEnlace({ estado: "negociado", neg: NOCHE }, { conCuenta: true, firmado: false })?.f !== NOCHE.f) F("7 · la página no le dice al navegador cómo está hoy el negociado del enlace (o sin cuenta manda el flujo, o no manda el precio)");
      // La tarjeta sin cuenta, con el negociado del enlace: el precio negociado nítido, sin borroso en su veredicto.
      const delEnlace: PinNegociado = { ...negP, neg: { d: 4.2, p: 2950, s: 71, f: null } };
      const tSin = renderToStaticMarkup(createElement(TarjetaPin, { pines: [delEnlace], seleccionado: AVISO, uf: 39000, analizados: {}, guardados: new Set<string>(), generando: null, error: null, alCambiar: () => {}, alCerrar: () => {}, alGuardar: () => {}, alAnalizar: () => {}, alCompartir: () => {}, sinCuenta: true }));
      const vNegHtml = /data-explorar="veredicto-negociado">([\s\S]*?)<\/span><\/span>|data-explorar="veredicto-negociado">([\s\S]*?)$/.exec(tSin)?.[0] ?? "";
      if (!vNegHtml.includes("UF 2.950") || /data-explorar="borroso"/.test(vNegHtml)) F("7 · sin cuenta, la tarjeta del negociado del enlace no muestra su precio nítido");
      if (!/if \(hoy && visiblesNeg\.some\(\(p\) => p\.avisoId === ap\.avisoId && p\.neg\.p !== hoy\.p\)\)/.test(cliente)) F("7 · el negociado de hoy no reemplaza al de la capa (sin cuenta, el borroso)");
      // La apertura: con la capa, el pin del negociado; «no-llega», la tarjeta que lo dice aunque la capa de la noche lo traiga.
      const ap1 = cp.aperturaCompartida({ avisoId: AVISO, estado: null, depto: NUNOA, visibles: [pin(OTRO)], negociados: [negP] });
      const ap2 = cp.aperturaCompartida({ avisoId: AVISO, estado: "no-llega", depto: NUNOA, visibles: [pin(OTRO)], negociados: [negP] });
      if (ap1.tipo !== "pin" || ap2.tipo !== "caido" || ap2.estado !== "no-llega" || ap2.parecidos.length !== 1) F("7 · la apertura no abre el pin del negociado (o abre uno que ya no llega)");
      if (!/const esperaCapa = !!compartido && compartido\.tope != null && compartido\.estado == null && !negociadosDelPie && !capaFallo;/.test(cliente) || !/\}, \[universo, esperaCapa\]\);/.test(cliente) || !/if \(vivo\.current\) setCapaFallo\(true\);/.test(cliente)) F("7 · el navegador abre el enlace de un negociado sin esperar la capa (o la espera para siempre si falla)");
      if (!/if \(compartido\.estado === "no-llega"\) setNoLlegan\(\(xs\) => \[\.\.\.xs, compartido\.avisoId\]\);/.test(cliente)) F("7 · el que ya no llega sigue en la capa");
      const caidoHtml = renderToStaticMarkup(createElement(CompartidoCaido, { estado: "no-llega", tope: 5, depto: NUNOA, parecidos: [pin(OTRO)], sinCuenta: true, alAbrir: () => {}, alCerrar: () => {} }));
      const tituloCaido = /data-explorar="caido-titulo">([^<]*)<\/b>/.exec(caidoHtml)?.[1] ?? "";
      if (tituloCaido !== "Este depto ya no llega a Comprar con un descuento de hasta 5 %." || (caidoHtml.match(/data-explorar="parecido"/g) ?? []).length !== 1) F(`7 · la tarjeta de «ya no llega» no lo dice con el tope o no ofrece parecidos («${tituloCaido}»)`);
      if (!/tope=\{compartido\?\.tope \?\? null\}/.test(cliente)) F("7 · la tarjeta de «ya no llega» no recibe el tope del enlace");
    }

    // ── 8 · LOS ENLACES COMPARTIDOS LLEVAN UNA FIRMA (03-nov-2026) ──
    {
      const SECRETO = "secreto-de-prueba-de-la-firma-0123456789";
      const vale = (a: string, c: string | null, f: string | null) => fc.firmaCompartidoValida(a, c, f, SECRETO);
      const fA = fc.firmaCompartido(AVISO, "K7M2QX", SECRETO);
      if (fc.LARGO_FIRMA_COMPARTIDO !== 16 || !/^[A-Za-z0-9_-]{16}$/.test(fA)) F(`8 · la firma no es corta (16 caracteres base64url): «${fA}»`);
      if (!vale(AVISO, "K7M2QX", fA) || !vale(AVISO.toUpperCase(), "K7M2QX", fA)) F("8 · la firma no vale para su aviso");
      const fOtro = fc.firmaCompartido(OTRO, "K7M2QX", SECRETO);
      const fSin = fc.firmaCompartido(AVISO, null, SECRETO);
      if (vale(AVISO, "K7M2QX", fOtro) || vale(AVISO, "K7M2QX", null) || vale(AVISO, null, fA) || vale(AVISO, "ZZZZZZ", fA) || vale(AVISO, "K7M2QX", fA.slice(0, 15)) || vale(AVISO, "K7M2QX", fSin) || fc.firmaCompartidoValida(AVISO, "K7M2QX", fA, null)) F("8 · una firma vale sin firma, con la de otro aviso, con otro código (o sin él) o sin secreto");
      if (!vale(AVISO, null, fSin)) F("8 · la firma de quien comparte sin cuenta no vale");
      // El enlace la lleva y se lee; una que no tiene la forma de una firma no se lee.
      const u = new URL(ec.enlaceCompartido("https://refranco.ai", { avisoId: AVISO, modalidad: "ltr", comuna: "Ñuñoa", codigo: "K7M2QX", tope: 5, firma: fA }));
      const ida = ec.compartidoDeUrl(u.searchParams);
      if (u.searchParams.get("f") !== fA || ida?.firma !== fA || ida.codigo !== "K7M2QX") F(`8 · el enlace no va y vuelve con su firma (${u.toString()})`);
      if (ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO}&f=no-es-una-firma&desde=compartido`))?.firma !== null) F("8 · algo que no es una firma se lee como firma");
      // EL ENLACE ARMADO A MANO: sin firma, o con la firma de otro aviso, sin cuenta no destapa nada.
      const fichaNeg = { estado: "negociado" as const, neg: { d: 4.2, p: 2950, s: 71, f: -35000 } };
      const aMano = ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO}&n=5&desde=compartido`))!;
      const conOtra = ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO}&n=5&i=K7M2QX&f=${fOtro}&desde=compartido`))!;
      for (const [que, c] of [["sin firma", aMano], ["con la firma de otro aviso", conOtra]] as const) {
        const firmado = vale(c.avisoId, c.codigo, c.firma);
        if (firmado || cp.negDelEnlace(fichaNeg, { conCuenta: false, firmado }) !== null) F(`8 · un enlace armado a mano ${que} destapa el precio negociado sin cuenta`);
      }
      const bien = ec.compartidoDeUrl(new URLSearchParams(`a=${AVISO}&n=5&i=K7M2QX&f=${fA}&desde=compartido`))!;
      const nBien = cp.negDelEnlace(fichaNeg, { conCuenta: false, firmado: vale(bien.avisoId, bien.codigo, bien.firma) });
      if (nBien?.p !== 2950 || nBien.f !== null) F("8 · con la firma, sin cuenta, el precio negociado no se ve nítido (o viaja el flujo)");
      if (cp.negDelEnlace(fichaNeg, { conCuenta: true, firmado: false })?.f !== -35000) F("8 · con cuenta, la falta de firma le quita las cifras");
      // La página: la firma decide lo nítido y la verificación de hoy; la vista previa con cifras, solo firmada.
      if (!/const firmado = firmaCompartidoValida\(c\.avisoId, c\.codigo, c\.firma\);/.test(pagina) || !/if \(tope != null && c\.modalidad === "ltr" && \(conCuenta \|\| firmado\)\) \{/.test(pagina) || !/neg: negDelEnlace\(f, \{ conCuenta, firmado \}\)/.test(pagina)) F("8 · la página destapa el negociado sin mirar la firma");
      const meta8 = pagina.slice(pagina.indexOf("export async function generateMetadata"), pagina.indexOf("const mapaQuieto"));
      if (!/if \(!firmaCompartidoValida\(c\.avisoId, c\.codigo, c\.firma\)\) return METADATOS;/.test(meta8) || meta8.indexOf("firmaCompartidoValida(") > meta8.indexOf("fichaCompartidaCacheada(")) F("8 · la vista previa con cifras sale sin la firma (o lee la ficha antes de mirarla)");
      // La imagen: sin la firma de ese aviso y ese código, 404, antes de leer nada.
      const og8 = codigo("src/app/api/og/depto/[avisoId]/route.tsx");
      if (!/if \(!firmaCompartidoValida\(params\.avisoId, normalizarCodigo\(sp\.get\("i"\)\), sp\.get\("f"\)\)\) return new Response\(null, \{ status: 404/.test(og8) || og8.indexOf("firmaCompartidoValida(params.avisoId") > og8.indexOf("fichaCompartidaCacheada(params.avisoId")) F("8 · la imagen con cifras sale sin la firma (o lee la ficha antes de mirarla)");
      if (cp.rutaVistaPrevia(AVISO, "ltr", 5, { f: fA, i: "K7M2QX" }) !== `/api/og/depto/${AVISO}?n=5&f=${fA}&i=K7M2QX`) F("8 · la imagen de la vista previa no lleva la firma y el código");
      // La API: POST, firma con el código de quien comparte (el del servidor), y pasado el tope no firma.
      const api8 = codigo("src/app/api/explorar/compartido/route.ts");
      if (/export async function GET/.test(api8) || !/export async function POST\(request: Request\)/.test(api8) || !/emitirFirma\(almacenFirmas\(admin\), \{ avisoId: a, codigo, sesion: sesionDe\(user\?\.id \?\? null, huella\.dispositivo\), ip: huella\.ip, conCuenta: !!user \}\)/.test(api8) || /public, max-age/.test(api8)) F("8 · la API sigue abierta por GET o en la caché, o firma sin el tope");
      if (!/if \("error" in firma\) return NextResponse\.json\(\{ error: firma\.error \}, \{ status: firma\.error === "tope" \? 429 : 503/.test(api8) || api8.indexOf("emitirFirma(") > api8.indexOf("fichaCompartida(admin")) F("8 · pasado el tope la API da lo del aviso igual");
      // EL TOPE: 60 por hora por sesión y por IP.
      const almacen = () => {
        const filas: Array<{ sesion_hash: string | null; ip_hash: string | null; t: number }> = [];
        let ahora = Date.parse("2026-11-03T15:00:00Z");
        const a: AlmacenFirmas & { ir: (ms: number) => void; ahora: () => Date } = {
          async contar(campo, valor, desde) { return filas.filter((f) => f[campo] === valor && f.t >= desde.getTime()).length; },
          async anotar(fila) { filas.push({ sesion_hash: fila.sesion_hash, ip_hash: fila.ip_hash, t: ahora }); },
          ir: (ms) => { ahora += ms; },
          ahora: () => new Date(ahora),
        };
        return a;
      };
      const firmar = (aviso: string) => `${aviso.slice(0, 8)}xxxxxxxx`;
      const pedir = (al: ReturnType<typeof almacen>, sesion: string | null, ip: string | null) => emitirFirma(al, { avisoId: AVISO, codigo: null, sesion, ip, conCuenta: false }, al.ahora(), firmar);
      if (TOPE_FIRMAS_POR_HORA !== 60) F(`8 · el tope no es 60 por hora (${TOPE_FIRMAS_POR_HORA})`);
      const a1 = almacen();
      let ok1 = 0;
      for (let i = 0; i < 60; i++) if ("firma" in (await pedir(a1, "S1", "IP1"))) ok1++;
      const r61 = await pedir(a1, "S1", "IP1");
      if (ok1 !== 60 || !("error" in r61) || r61.error !== "tope") F(`8 · la misma sesión y la misma IP firman más de 60 por hora (${ok1} y la 61: ${JSON.stringify(r61)})`);
      a1.ir(61 * 60_000);
      if (!("firma" in (await pedir(a1, "S1", "IP1")))) F("8 · pasada la hora, la sesión no vuelve a firmar");
      const a2 = almacen();
      for (let i = 0; i < 60; i++) await pedir(a2, `S${i}`, "IP2");
      const rIp = await pedir(a2, "S-nueva", "IP2");
      if (!("error" in rIp) || rIp.error !== "tope") F("8 · cambiando de sesión, la misma IP firma más de 60 por hora");
      const a3 = almacen();
      for (let i = 0; i < 60; i++) await pedir(a3, "S3", `IP${i}`);
      const rSes = await pedir(a3, "S3", "IP-nueva");
      if (!("error" in rSes) || rSes.error !== "tope") F("8 · cambiando de IP, la misma sesión firma más de 60 por hora");
      const sinHuella = await pedir(almacen(), null, null);
      if (!("error" in sinHuella) || sinHuella.error !== "sin-huella") F("8 · sin sesión ni IP se firma igual (no hay cómo contar)");
      if (sesionDe("u-1", "disp") === "disp" || sesionDe(null, "disp") !== "disp") F("8 · la sesión no es la cuenta (o, sin cuenta, el dispositivo)");
      const fs8 = codigo("src/lib/explorar/firmas-servidor.ts");
      if (!/\.select\("id", \{ count: "exact", head: true \}\)\.eq\(campo, valor\)\.gte\("creada_at", desde\.toISOString\(\)\);\s*if \(error \|\| count == null\) throw/.test(fs8)) F("8 · el tope no cuenta la última hora en la base (o un conteo que falla deja firmar)");
      const mig = leer("supabase/migrations/20261103_firmas_compartido.sql");
      if (!/create table if not exists public\.firmas_compartido/.test(mig) || !/alter table public\.firmas_compartido enable row level security;/.test(mig) || !/sesion_hash text,/.test(mig) || !/ip_hash text,/.test(mig)) F("8 · la tabla del tope no está en su migración (o sin RLS)");
      // El navegador: firma al tocar, no al abrir; sin firma no comparte (y lo dice); una falla no queda guardada.
      if (!/if \("error" in prep\) \{[\s\S]{0,320}?setToast\(prep\.error === "tope" \? COMPARTIR_COPY\.tope : COMPARTIR_COPY\.sinFirma\);\s*return;\s*\}/.test(cliente)) F("8 · sin firma el navegador comparte igual (o no lo dice)");
      if (/fetch\("\/api\/invitacion"/.test(cliente) || /prepararCompartir\(p\);\s*\}, \[sel/.test(cliente) || !/fetch\("\/api\/explorar\/compartido", \{\s*method: "POST",/.test(cliente)) F("8 · el navegador pide firmas al abrir la tarjeta (gastaría el tope) o sin POST");
      if (!/if \("error" in x\) estandar\.current\.delete\(clave\);/.test(cliente)) F("8 · una firma que falló queda guardada y no se puede reintentar");
      if (!/con_firma: !!compartido\.firma/.test(codigo("src/lib/vista-entrada.ts"))) F("8 · la vista del enlace no dice si venía firmado");
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
// LA IMAGEN EN JPEG Y EN INTER (02-nov-2026, medido en el preview tras el rebase: doce avisos a 800 × 420 pesaron de 308 a
// 530 kB en PNG; y Fabrizio: «ojo con las fuentes… habíamos simplificado»): V7 reescrita (la caché en la respuesta nueva) y
// 11 nuevas, 13 de 13 en ROJO con V3, V8 y V9: V10 sale en PNG · V11 el JPEG con calidad 100 · V12 los metadatos declaran
// 1200 × 630 · V13 la constante del tamaño con otro · V14 la línea en JetBrains Mono · V15 el precio en 400 · V16 el chip
// en Source Serif · V17 Inter 600 sin registrar · V18 las TTF del informe.
// EL NEGOCIADO SE COMPARTE CON SU VERDAD COMPLETA (03-nov-2026, §7 y los predicados al día de §1, §2, §3 y §6, cada uno con su
// acta): el runner entero, 112 de 112 en ROJO (Y1 e Y2 no aplicaban por la línea nueva de compartidoDe: ajustadas, 3 de 3), y
// después G22 y G27 con la API del texto, 2 de 2. M6, M8, V1, V2, R6, D6, D7, T4, N2, N3 y N5 reescritas para el código nuevo.
//   G1 el negociado se comparte sin su precio · G2 sin el descuento · G3 el enlace sin el tope · G4 el tope no alcanza el
//   descuento · G5 el navegador no pone el tope · G6 sin cuenta no pide su precio · G7 la vista previa con el descuento · G8
//   sin el chip Ajustar · G9 la imagen no lee el tope · G10 la ficha no verifica con los datos de hoy · G11 ignora el tope ·
//   G12 sin tope busca el negociado · G13 la apertura ignora «no-llega» · G14 no mira la capa · G15 el navegador no espera la
//   capa · G16 la espera para siempre si falla · G17 el precio de hoy no reemplaza al de la noche · G18 la tarjeta de «ya no
//   llega» dice otra cosa · G19 la página no verifica · G20 sin cuenta viaja el precio de hoy · G21 los metadatos sin el tope ·
//   G22 la API ignora el tope · G23 la verificación lee la ficha del aviso · G24 la imagen sin el chip Ajustar · G25 el que no
//   llega sigue en la capa · G26 si la verificación falla, no llega · G27 la API del texto verifica (la hoja esperaría).
// Y lo que el QUICK cazó en otros tiers con la verificación de hoy, 3 de 3 en ROJO: Z1 y Z2 (GUIA-BUSQUEDA §3, reescrito con
// su acta: la antigüedad de UNA LECTURA de la ficha solo en «Analizar este») · Z3 (CONFIG-PUBLICA §6: la ficha del enlace lee
// `config` con el cliente de service role de quien la llama; la verificación es una `function` para que el censo la siga).
// G28 (la línea del negociado en la imagen cortaba entre «UF» y el número, medido en el preview): entera, ROJO.
// SIN BORROSO (03-nov-2026, decisión de Fabrizio): el negociado del enlace se ve nítido sin cuenta, sin el flujo. G20 reescrita
// (sin cuenta viaja el flujo), G29 (sigue borroso), G30 (la tarjeta dibuja borroso con precio) y G17 de nuevo: 4 de 4 en ROJO.
// LA FIRMA (03-nov-2026, §8 y los predicados al día de §1, §3, §6 y §7, cada uno con su acta): el runner entero, 147 de 147 en
// ROJO (E5 se hizo única: su texto aparecía también en el evento nuevo de «sin firma»). R6, R7, T4, N2, N3, G19, G20 y G29
// reescritas para el código nuevo, y 26 nuevas:
//   F1 la firma sin el código · F2 sin el aviso · F3 cualquier firma con forma vale · F4 larga · F5 la página verifica y destapa
//   sin firma · F6 cree firmado cualquier enlace · F7 negDelEnlace ignora la firma · F8 la vista previa con cifras sin firma ·
//   F9 la imagen sin firma · F10 la API sigue por GET · F11 el tope no frena · F12 solo por sesión · F13 solo por IP · F14 de
//   600 · F15 la ventana es un día · F16 la firma no se anota · F17 sin firma se comparte igual · F18 el enlace sin la firma ·
//   F19 firma al abrir la tarjeta · F20 la barra deja la firma · F21 el enlace no la lleva · F22 cualquier cosa se lee como
//   firma · F23 una falla queda guardada · F24 pasado el tope la API responde igual · F25 un conteo que falla deja firmar ·
//   F26 la vista del enlace no dice si venía firmado.
