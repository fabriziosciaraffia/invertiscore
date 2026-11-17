// ============================================================================
// TIER INVIERTE-V2 — Invierte con Franco, comprador · etapa 1 (18-nov-2026, encargo de Fabrizio): del botón a la orden firmada,
// detrás del interruptor. Rojo con:
//   1 · EL INTERRUPTOR: un modo ausente o raro que no cuente como apagado; «lista» que deje pasar a alguien fuera de la lista o
//       sin sesión; «todos» que no deje pasar a todos.
//   2 · EL BOTÓN: sin acceso, algo que no sea Pronto; con acceso, un depto nuevo que vaya al flujo nuevo. Las tres superficies
//       (el mapa, la selección y la portada del informe) deciden con `destinoBoton`, y la franja sin `flujoV2` se dibuja IGUAL que
//       la de Pronto (byte a byte contra la de siempre).
//   3 · EL CACHÉ: `accesoInvierteV2` llamado desde un archivo que usa `unstable_cache` o desde un llamador no declarado.
//   4 · LAS RUTAS Y PÁGINAS NUEVAS sin el 404: cada ruta /api/invierte-v2/* responde NO_EXISTE sin sesión o sin acceso (la de la
//       orden, sin una orden de la persona), y cada página /invierte/* llama notFound sin acceso.
//   5 · EL RUT: módulo 11 (uno inválido pasa, uno válido no), con puntos en la orden y sin puntos en la base.
//   6 · LA FIRMA: sin casilla, sin haber llegado al final, con un RUT inválido o con otra versión, aceptada; la ruta que no
//       valida antes de firmar; un contacto sin el permiso de WhatsApp aceptado.
//   7 · LA ORDEN: el texto de la versión 1 cambiado sin subir la versión (huella fijada); la razón social que no sale de la
//       constante; el texto guardado que no es el firmado o una huella que no es la suya; `es_prueba` que no sale de test_accounts;
//       quien ya firmó la versión vigente firmando otra vez; el PDF o la copia que no se completan, o una falla que deshace la firma.
//   8 · REINICIAR PRUEBA: borra algo de una cuenta con una orden REAL simulada o de una cuenta que no es de prueba; borra la orden
//       antes que su bitácora.
//   9 · LOS MENSAJES Y LA MEDICIÓN: la copia de la orden fuera de la excepción (otro tipo, otro motivo o fuera de la lista); la copia
//       con baja o frenada por la eliminación; un Lead a Meta desde el flujo nuevo; un evento que no empiece con inv2_ o que salga
//       del navegador.
//  10 · EL LENGUAJE frente a la persona: «informe» o «análisis», nombres de personas, o una mención a hasta cuánto ofrecer.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/invierte-v2-catch-test.ts
// ============================================================================
import "./als-de-next";
import "./sin-css";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerModo, tieneAcceso, correoDeLista } from "../../../src/lib/invierte-v2/acceso";
import { destinoBoton, urlContacto } from "../../../src/lib/invierte-v2/destino";
import { normalizarRut, formatearRut, dvRut } from "../../../src/lib/invierte-v2/rut";
import { ordenVigente, plantillaVigente, textoPlano, VERSION_ORDEN, RAZON_SOCIAL_FRANCO, RUT_FRANCO } from "../../../src/lib/invierte-v2/orden";
import { FLUJO_COPY, EVENTOS_INV2, validarContacto, validarFirma } from "../../../src/lib/invierte-v2/flujo";
import { firmar, reiniciarPrueba, guardarContacto, completarOrden, reintentarCopias, type DepsFirma, type OrdenInv } from "../../../src/lib/invierte-v2/servidor";
import { tocaReintentar, debeAvisar, pasoAislado, diarioYLuegoPaso, MAX_INTENTOS_COPIA } from "../../../src/lib/invierte-v2/copias";
import { puedeRecibirCopia } from "../../../src/lib/invierte-v2/copias-servidor";
import { htmlOrden } from "../../../src/lib/invierte-v2/orden-pdf";
import { excepcionCopiaOrden } from "../../../src/lib/correo-destino";
import { TIPOS_CON_BAJA, TIPOS_QUE_FRENA_LA_ELIMINACION } from "../../../src/lib/correo-baja";
import { TIPOS_CORREO } from "../../../src/lib/medicion-correo";
import { correoCopiaOrden } from "../../../src/lib/email/correos";
import { FranjaInvierte } from "../../../src/components/invierte/FranjaInvierte";
import type { DeptoInvierte } from "../../../src/lib/invierte/invierte";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** La huella de la plantilla de cada versión de la orden. Cambiar el texto obliga a subir VERSION_ORDEN y a agregar su huella acá. */
const HUELLAS_PLANTILLA: Record<number, string> = {
  1: "aea299d3a7f0e4371efb80405c7c9098c4a207186a050bb94327310920e7b4bf",
};

const AVISO = "9bfe6906-2222-4000-8000-000000000002";
const USER = { id: "0381a589-0000-4000-8000-00000000abcd", email: "persona@ejemplo.cl" };
const DE_LA_LISTA = "lista@ejemplo.cl";

// ── Un Supabase de mentira: tablas en memoria, lo que se ejecutó (en orden) y el bucket ──
interface Paso { tabla: string; op: string; filtros: Array<[string, string, unknown]>; fila: unknown }
function falso(datos: Record<string, Record<string, unknown>[]>) {
  const pasos: Paso[] = [];
  const bucket = { subidos: [] as string[], borrados: [] as string[] };
  let n = 0;
  const q = (tabla: string) => {
    let op = "select";
    let fila: unknown = null;
    let uno = false;
    const filtros: Array<[string, string, unknown]> = [];
    const pasa = (r: Record<string, unknown>) => filtros.every(([k, t, v]) => (t === "eq" ? r[k] === v : t === "in" ? (v as unknown[]).includes(r[k]) : t === "is" ? (r[k] ?? null) === v : t === "gte" ? String(r[k]) >= String(v) : true));
    const correr = () => {
      pasos.push({ tabla, op, filtros: [...filtros], fila });
      const filas = (datos[tabla] ??= []);
      if (op === "select") { const rs = filas.filter(pasa); return { data: uno ? rs[0] ?? null : rs, error: null }; }
      if (op === "insert") {
        const r = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, firmado_at: "2026-11-18T15:00:00.000Z", pdf_path: null, pdf_sha256: null, copia_enviada_at: null, ...(fila as object) };
        filas.push(r);
        return { data: uno ? r : [r], error: null };
      }
      if (op === "upsert") { const r = fila as Record<string, unknown>; const i = filas.findIndex((x) => x.user_id === r.user_id); if (i >= 0) filas[i] = { ...filas[i], ...r }; else filas.push(r); return { data: null, error: null }; }
      if (op === "update") { for (const r of filas.filter(pasa)) Object.assign(r, fila); return { data: null, error: null }; }
      if (op === "delete") { const rs = filas.filter(pasa); datos[tabla] = filas.filter((r) => !rs.includes(r)); return { data: null, error: null, count: rs.length }; }
      return { data: null, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b, order: () => b, limit: () => b, range: () => b,
      insert: (f: unknown) => { op = "insert"; fila = f; return b; },
      upsert: (f: unknown) => { op = "upsert"; fila = f; return b; },
      update: (f: unknown) => { op = "update"; fila = f; return b; },
      delete: () => { op = "delete"; return b; },
      eq: (k: string, v: unknown) => { filtros.push([k, "eq", v]); return b; },
      in: (k: string, v: unknown) => { filtros.push([k, "in", v]); return b; },
      is: (k: string, v: unknown) => { filtros.push([k, "is", v]); return b; },
      gte: (k: string, v: unknown) => { filtros.push([k, "gte", v]); return b; },
      maybeSingle: () => { uno = true; return Promise.resolve(correr()); },
      single: () => { uno = true; return Promise.resolve(correr()); },
      then: (res: (x: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(correr()).then(res, rej),
    };
    return b;
  };
  const sb = {
    from: q,
    storage: {
      from: () => ({
        upload: async (ruta: string) => { bucket.subidos.push(ruta); return { error: null }; },
        remove: async (rutas: string[]) => { bucket.borrados.push(...rutas); return { error: null }; },
        download: async () => ({ data: new Blob([new Uint8Array([37, 80, 68, 70])]), error: null }),
        createSignedUrl: async (ruta: string) => ({ data: { signedUrl: `https://firmada/${ruta}` }, error: null }),
      }),
    },
  };
  return { sb: sb as unknown as SupabaseClient, pasos, bucket, datos };
}

const avisoUsado = () => ({
  scraped_properties: [{ id: AVISO, comuna: "Ñuñoa", superficie_m2: 58, dormitorios: 2, banos: 2, condicion: "usado", precio: 3250 }] as Record<string, unknown>[],
  avisos_evaluados: [{ aviso_id: AVISO, precio_uf: 3250, condicion: "usado", veredicto_20: "COMPRAR", score_20: 78, negociar_20: null }] as Record<string, unknown>[],
});
const persona = () => ({ user_id: USER.id, email: USER.email, aviso_origen: AVISO, origen: "explorar", urgencia: "este_mes", pie: "si", pie_uf: 650, whatsapp: "+56912345678", permiso_whatsapp_at: "2026-11-18T14:00:00Z", estado: "contacto", created_at: "x", updated_at: "x" });
const PEDIDO_FIRMA = { avisoId: AVISO, nombre: "Camila Rojas Pérez", rut: "12345678-5", version: VERSION_ORDEN, acepto: true as const, leyoHastaElFinal: true as const };
const depsOk = (o: { copia?: boolean; pdf?: boolean; motivo?: string } = {}) => {
  const llamadas = { pdf: 0, copia: 0, a: [] as string[] };
  const deps: DepsFirma = {
    generarPdf: async () => { llamadas.pdf++; if (o.pdf === false) throw new Error("sin chromium"); return new Uint8Array([37, 80, 68, 70, 45]); },
    enviarCopia: async (p) => { llamadas.copia++; llamadas.a.push(p.to); return o.copia === false ? { ok: false as const, motivo: o.motivo ?? "sin-llave" } : { ok: true as const }; },
  };
  return { deps, llamadas };
};

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(RAIZ, p)).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

export async function runInvierteV2(): Promise<{ hard: number }> {
  console.log("\n─── TIER INVIERTE-V2 (Invierte con Franco, comprador · etapa 1 — el interruptor, el botón, la firma y la orden · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try {
    // ── 1 · EL INTERRUPTOR ──
    {
      for (const raro of [null, undefined, "", "Lista", "TODOS", "encendido", "true", 1, '"otra"']) if (leerModo(raro) !== "apagado") F(`1 · el modo ${JSON.stringify(raro)} no cuenta como apagado`);
      if (leerModo("lista") !== "lista" || leerModo('"lista"') !== "lista" || leerModo(" todos ") !== "todos") F("1 · el modo válido no se lee");
      const lista = new Set([DE_LA_LISTA]);
      const caso = (modo: "apagado" | "lista" | "todos", email: string | null) => tieneAcceso({ modo, email, lista });
      if (caso("apagado", DE_LA_LISTA)) F("1 · apagado deja pasar a la lista");
      if (!caso("lista", " Lista@Ejemplo.cl ")) F("1 · lista no reconoce el correo de la lista (mayúsculas o espacios)");
      if (caso("lista", "otra@ejemplo.cl")) F("1 · lista deja pasar a alguien fuera de la lista");
      if (caso("lista", null)) F("1 · lista deja pasar a alguien sin sesión");
      if (!caso("todos", null) || !caso("todos", "otra@ejemplo.cl")) F("1 · todos no deja pasar a todos");
      if (correoDeLista("no-es-correo") !== null) F("1 · la lista acepta algo que no es correo");
    }

    // ── 2 · EL BOTÓN ──
    {
      for (const c of ["usado", "nuevo", undefined, null, "Usado"]) if (destinoBoton({ acceso: false, condicion: c }) !== "pronto") F(`2 · sin acceso, un ${String(c)} no va a Pronto`);
      if (destinoBoton({ acceso: true, condicion: "nuevo" }) !== "pronto") F("2 · con acceso, un depto nuevo no va a Pronto");
      if (destinoBoton({ acceso: true, condicion: undefined }) !== "pronto") F("2 · con acceso, un depto sin condición no va a Pronto");
      if (destinoBoton({ acceso: true, condicion: "usado" }) !== "v2") F("2 · con acceso, un usado no va al flujo nuevo");
      if (urlContacto(AVISO, "explorar") !== `/invierte/${AVISO}?desde=explorar`) F("2 · la URL del contacto cambió");

      const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
      if (!/if \(destinoBoton\(\{ acceso: invierteV2, condicion: p\.condicion \}\) === "v2"\) \{ setContactoV2\(p\); return; \}\s*if \(sinCuenta\) void import\("\.\/hoja-registro"\);\s*setInvierte\(\{ pin: p, retomar: false \}\);/.test(cliente)) F("2 · el mapa no decide con destinoBoton antes de abrir la hoja de Pronto");
      // La hoja de contacto: solo se monta con el estado que pone la rama v2 (nadie más lo pone), sobre el mapa, sin navegar.
      if ((cliente.match(/setContactoV2\(/g) ?? []).length !== 2 || !/\{contactoV2 && \(\s*<HojaContacto depto=\{deptoInvierteDePin\(contactoV2\)\} origen="explorar" sinSesion=\{sinCuenta\} alCerrar=\{\(\) => setContactoV2\(null\)\} \/>/.test(cliente)) F("2 · el mapa abre la hoja de contacto sin la rama v2 (o no la abre encima)");
      if (!/invierteV2 = false/.test(cliente)) F("2 · el mapa no arranca en Pronto sin el booleano");
      const sel = codigo("src/app/semanal/semanal-lista.tsx");
      if (!/destinoBoton\(\{ acceso: invierteV2, condicion: it\.condicion \}\) === "v2" \? setContactoV2\(it\) : setInvierte\(it\)/.test(sel) || !/invierteV2 = false/.test(sel) || (sel.match(/setContactoV2\(/g) ?? []).length !== 2 || !/\{contactoV2 && \(\s*<HojaContacto /.test(sel)) F("2 · la selección no decide con destinoBoton (o no arranca en Pronto)");
      const inf = codigo("src/lib/invierte-v2/informe.ts");
      if (!/destinoBoton\(\{ acceso, condicion: condicionDeLinea\(invierte\.depto\.linea\) \}\) !== "v2"\) return invierte;/.test(inf)) F("2 · la portada del informe no decide con destinoBoton");
      for (const a of ["src/app/analisis/[id]/informe-ltr.tsx", "src/app/analisis/renta-corta/[id]/informe-str.tsx"]) if (!/await conFlujoV2\(await invierteDelInforme\(/.test(codigo(a))) F(`2 · ${a} no pasa la franja por conFlujoV2`);
      // La franja sin flujoV2 es la de Pronto, byte a byte.
      const D: DeptoInvierte = { avisoId: AVISO, linea: "Ñuñoa · 2D2B · 58 m² · Usado", precioUF: 3250, veredicto: "COMPRAR", score: 78 };
      for (const inscrito of [false, true]) {
        const antes = renderToStaticMarkup(createElement(FranjaInvierte, { depto: D, inscrito, publicacion: { url: "https://x", despublicado: false } }));
        const conNull = renderToStaticMarkup(createElement(FranjaInvierte, { depto: D, inscrito, publicacion: { url: "https://x", despublicado: false }, flujoV2: null }));
        if (antes !== conNull) F(`2 · la franja con flujoV2 vacío no es la de Pronto (inscrito ${inscrito})`);
        if (!antes.includes(">PRONTO<")) F("2 · la franja de Pronto perdió PRONTO");
      }
      const v2 = renderToStaticMarkup(createElement(FranjaInvierte, { depto: D, inscrito: true, publicacion: null, flujoV2: urlContacto(AVISO, "informe") }));
      if (v2.includes(">PRONTO<") || v2.includes("Inscrito en Invierte con Franco") || !v2.includes('data-invierte="boton"')) F("2 · la franja del flujo nuevo muestra PRONTO o la etiqueta de inscrito");
      const franja = codigo("src/components/invierte/FranjaInvierte.tsx");
      if (!/if \(flujoV2 && !demo\) \{ setContactoV2\(true\); return; \}/.test(franja) || !/\{contactoV2 && flujoV2 && !demo && \(\s*<HojaContacto depto=\{depto\} origen="informe"/.test(franja)) F("2 · la franja del flujo nuevo no abre la hoja de contacto");
      // Ningún botón lleva a la página de respaldo del contacto (/invierte/[avisoId]).
      for (const f of ["src/app/explorar/explorar-cliente.tsx", "src/app/semanal/semanal-lista.tsx", "src/components/invierte/FranjaInvierte.tsx", "src/app/invierte/[avisoId]/firma/page.tsx", "src/components/invierte-v2/HojaContacto.tsx"]) if (/urlContacto\(/.test(codigo(f))) F(`2 · ${f} lleva a la página de respaldo del contacto`);
      // La hoja: el patrón de Pronto (sus clases) sin tocar a Pronto; cerrar no navega; quien ya firmó va a Partimos.
      const hoja = codigo("src/components/invierte-v2/HojaContacto.tsx");
      if (!/className="inv-velo iv2-velo"/.test(hoja) || !/className="inv-hoja iv2-hoja"/.test(hoja) || !/onClick=\{alCerrar\} aria-label="Cerrar"/.test(hoja) || /router\.(push|replace|back)\([^)]*\)[^;]*;\s*\}\s*\}\s*>/.test(hoja)) F("2 · la hoja de contacto no usa el patrón de la hoja de Pronto o cerrar navega");
      if (!/if \(d\?\.firmo\) \{ router\.push\(URL_PARTIMOS\); return; \}/.test(hoja)) F("2 · la hoja no manda a Partimos a quien ya firmó");
      if (!/max-height: calc\(100dvh - 88px\)/.test(leer("src/components/invierte-v2/invierte-v2.css"))) F("2 · en el celular la hoja no deja asomar el mapa");
    }

    // ── 3 · EL CACHÉ ──
    {
      const LLAMADORES = new Set(["src/app/explorar/page.tsx", "src/app/dashboard/page.tsx", "src/lib/invierte-v2/informe.ts", "src/lib/invierte-v2/paginas.ts", "src/lib/invierte-v2/rutas.ts", "src/lib/invierte-v2/acceso-servidor.ts"]);
      for (const f of archivos("src")) {
        const c = codigo(f);
        if (!/accesoInvierteV2\(/.test(c)) continue;
        if (!LLAMADORES.has(f)) F(`3 · ${f} llama a accesoInvierteV2 sin estar declarado`);
        if (/unstable_cache|"use cache"/.test(c)) F(`3 · ${f} llama a accesoInvierteV2 y usa un caché compartido`);
      }
      const ex = codigo("src/app/explorar/page.tsx");
      if ((ex.match(/accesoInvierteV2\(/g) ?? []).length !== 2 || !/accesoInvierteV2\(user\)/.test(ex) || !/accesoInvierteV2\(null\)/.test(ex)) F("3 · Explorar no pide el interruptor una vez por vista (con y sin sesión)");
    }

    // ── 4 · LAS RUTAS Y PÁGINAS NUEVAS: 404 sin acceso ──
    {
      for (const r of ["contacto", "firma"]) {
        const c = codigo(`src/app/api/invierte-v2/${r}/route.ts`);
        if (!/const user = await personaConAcceso\(\);\s*if \(!user\) return NO_EXISTE\(\);/.test(c)) F(`4 · /api/invierte-v2/${r} no responde 404 sin acceso`);
      }
      const orden = codigo("src/app/api/invierte-v2/orden/route.ts");
      if (!/if \(!user\) return NO_EXISTE\(\);/.test(orden) || !/if \(!orden\) return NO_EXISTE\(\);/.test(orden)) F("4 · /api/invierte-v2/orden no responde 404 sin sesión o sin orden");
      const rutas = codigo("src/lib/invierte-v2/rutas.ts");
      if (!/status: 404/.test(rutas) || !/return \(await accesoInvierteV2\(user\)\) \? user : null;/.test(rutas)) F("4 · NO_EXISTE no es 404 o personaConAcceso no mira el interruptor");
      for (const p of ["src/app/invierte/[avisoId]/page.tsx", "src/app/invierte/[avisoId]/firma/page.tsx"]) {
        const c = codigo(p);
        if (!/if \(!acceso\) notFound\(\);/.test(c) || !/if \(!depto\) notFound\(\);/.test(c) || !/force-dynamic/.test(c)) F(`4 · ${p} no da 404 sin acceso o con un depto que no es usado`);
      }
      if (!/if \(!user \|\| !acceso\) notFound\(\);/.test(codigo("src/app/invierte/perfil/page.tsx"))) F("4 · /invierte/perfil no da 404 sin acceso");
      const part = codigo("src/app/invierte/partimos/page.tsx");
      if (!/if \(!user\) notFound\(\);/.test(part) || !/if \(!orden\) notFound\(\);/.test(part)) F("4 · /invierte/partimos no da 404 sin sesión o sin orden");
      if (!/return aviso && aviso\.condicion === "usado" \? aviso : null;/.test(codigo("src/lib/invierte-v2/servidor.ts"))) F("4 · el depto del flujo no exige usado");
      const adm = codigo("src/app/api/admin/invierte-v2/route.ts");
      if ((adm.match(/const gate = await requireAdmin\(\);\s*if \(!gate\.ok\) return gate\.response;/g) ?? []).length !== 2) F("4 · /api/admin/invierte-v2 no pide admin en sus dos métodos");
    }

    // ── 5 · EL RUT ──
    {
      for (const [r, n] of [["12.345.678-5", "12345678-5"], ["11.111.111-1", "11111111-1"], ["9876543-3", "9876543-3"], [" 76086428-5 ", "76086428-5"]] as const) if (normalizarRut(r) !== n) F(`5 · ${r} no se normaliza a ${n}`);
      for (const r of ["12.345.678-9", "16.482.317-5", "1-9", "abc", "123456789-0", ""]) if (normalizarRut(r) !== null) F(`5 · el RUT inválido ${r} pasa`);
      if (dvRut("10000013") !== "K" || normalizarRut("10000013-k") !== "10000013-K") F("5 · el dígito K no se calcula o no se acepta en minúscula");
      if (formatearRut("12345678-5") !== "12.345.678-5" || formatearRut("9876543-3") !== "9.876.543-3") F("5 · el RUT de la orden no lleva puntos");
    }

    // ── 6 · LA FIRMA Y EL CONTACTO ──
    {
      const v = (x: Record<string, unknown>) => validarFirma({ ...PEDIDO_FIRMA, ...x });
      if (!v({}).ok) F("6 · una firma completa se rechaza");
      if (v({ acepto: false }).ok) F("6 · una firma sin casilla se acepta");
      if (v({ leyoHastaElFinal: false }).ok) F("6 · una firma sin llegar al final se acepta");
      if (v({ leyoHastaElFinal: "true" }).ok) F("6 · «leyó hasta el final» como texto se acepta");
      if (v({ rut: "12.345.678-9" }).ok) F("6 · una firma con RUT inválido se acepta");
      if (v({ nombre: "  " }).ok || v({ nombre: "12" }).ok) F("6 · una firma sin nombre se acepta");
      if (v({ version: VERSION_ORDEN + 1 }).ok) F("6 · una firma de otra versión se acepta");
      const okRut = v({ rut: "12.345.678-5" });
      if (!okRut.ok || okRut.pedido.rut !== "12345678-5") F("6 · el RUT no llega sin puntos al servidor");
      const ruta = codigo("src/app/api/invierte-v2/firma/route.ts");
      if (!/const v = validarFirma\([^;]*\);\s*if \(!v\.ok\) return NextResponse\.json\(\{ error: v\.error \}, \{ status: 400 \}\);\s*const admin/.test(ruta)) F("6 · la ruta de la firma no valida antes de firmar");
      const c = { avisoId: AVISO, origen: "explorar", urgencia: "este_mes", pie: "si", whatsapp: "+56 9 1234 5678", permiso: true };
      if (!validarContacto(c).ok) F("6 · un contacto completo se rechaza");
      if (validarContacto({ ...c, permiso: false }).ok || validarContacto({ ...c, permiso: undefined }).ok || validarContacto({ ...c, permiso: "si" }).ok) F("6 · un contacto sin el permiso de WhatsApp se acepta");
      if (!/const \[permiso, setPermiso\] = useState\(false\);/.test(codigo("src/components/invierte-v2/ContactoForm.tsx"))) F("6 · la casilla de WhatsApp viene marcada");
      const form = codigo("src/components/invierte-v2/FirmaForm.tsx");
      if (!/disabled=\{!leyo \|\| enviando \|\| sinContacto\}/.test(form) || !/el\.scrollTop \+ el\.clientHeight >= el\.scrollHeight - 4\) setLeyo\(true\)/.test(form)) F("6 · «Firmar y partir» se habilita sin llegar al final del texto");
      // El contacto guarda el permiso con su hora y la persona en estado «contacto».
      const db = falso({ ...avisoUsado(), inv_personas: [], inv_ordenes: [], test_accounts: [] });
      const vc = validarContacto(c);
      if (vc.ok) {
        const r = await guardarContacto(db.sb, USER, vc.pedido, { ip: "1.2.3.4", ua: "UA" }, null);
        const p = db.datos.inv_personas[0];
        if (!r.ok || !p || p.estado !== "contacto" || typeof p.permiso_whatsapp_at !== "string" || p.whatsapp !== "+56912345678") F("6 · el contacto no guarda la persona en «contacto» con el permiso");
      }
    }

    // ── 7 · LA ORDEN ──
    {
      if (!HUELLAS_PLANTILLA[VERSION_ORDEN]) F(`7 · la versión ${VERSION_ORDEN} de la orden no tiene su huella fijada en el tier`);
      else if (sha(plantillaVigente()) !== HUELLAS_PLANTILLA[VERSION_ORDEN]) F("7 · el texto de la orden cambió sin subir VERSION_ORDEN");
      const o = ordenVigente({ nombre: "Camila Rojas Pérez", rut: "12.345.678-5", depto: "Ñuñoa · 2D2B · 58 m²" });
      if (!o.encabezado.startsWith("Camila Rojas Pérez, RUT 12.345.678-5, encarga a ") || !o.encabezado.includes(`${RAZON_SOCIAL_FRANCO}, RUT ${RUT_FRANCO}`)) F("7 · el encabezado no lleva el nombre, el RUT con puntos y la razón social de la constante");
      if (o.clausulas.length !== 6 || !o.clausulas[0].texto.includes("Ñuñoa · 2D2B · 58 m²")) F("7 · la orden no tiene sus seis cláusulas o no nombra el depto");
      if (!/Firma electrónica simple \(Ley 19\.799\)/.test(o.pie)) F("7 · la orden no dice que es firma electrónica simple");

      // Firmar: guarda el texto firmado con SU huella, la hora de la base, la IP y el navegador; es_prueba de test_accounts.
      for (const deprueba of [false, true]) {
        const db = falso({ ...avisoUsado(), inv_personas: [persona()], inv_ordenes: [], inv_bitacora: [], test_accounts: deprueba ? [{ user_id: USER.id }] : [] });
        const { deps, llamadas } = depsOk();
        const r = await firmar(db.sb, USER, PEDIDO_FIRMA, { ip: "1.2.3.4", ua: "Mozilla/5.0" }, deps);
        const fila = db.datos.inv_ordenes[0];
        if (!r.ok || !fila) { F("7 · la firma no se guarda"); continue; }
        const esperado = textoPlano(ordenVigente({ nombre: "Camila Rojas Pérez", rut: "12.345.678-5", depto: "Ñuñoa · 2D2B · 58 m²" }));
        if (fila.texto !== esperado) F("7 · el texto guardado no es el que se firmó");
        if (fila.texto_sha256 !== sha(String(fila.texto))) F("7 · la huella guardada no es la del texto");
        if (fila.rut !== "12345678-5" || fila.ip !== "1.2.3.4" || fila.user_agent !== "Mozilla/5.0" || fila.texto_version !== VERSION_ORDEN) F("7 · la orden no guarda el RUT sin puntos, la IP, el navegador o la versión");
        if ("firmado_at" in (db.pasos.find((p) => p.op === "insert" && p.tabla === "inv_ordenes")?.fila as object)) F("7 · la hora de la firma la pone la ruta, no la base");
        if (fila.es_prueba !== deprueba) F(`7 · es_prueba no sale de test_accounts (${deprueba})`);
        if (db.datos.inv_personas[0].estado !== "firmo") F("7 · la persona no pasa a «firmó»");
        if (llamadas.pdf !== 1 || db.bucket.subidos[0] !== `ordenes/${fila.id}.pdf` || typeof fila.pdf_sha256 !== "string" || llamadas.copia !== 1 || llamadas.a[0] !== USER.email || !fila.copia_enviada_at) F("7 · el PDF no se guarda con su huella o la copia no sale a quien firmó");
        if (!db.datos.inv_bitacora.some((b) => b.accion === "firma" && b.es_prueba === deprueba)) F("7 · la bitácora no anota la firma con su es_prueba");
        const otra = await firmar(db.sb, USER, { ...PEDIDO_FIRMA, nombre: "Otra Persona" }, { ip: null, ua: null }, deps);
        if (!otra.ok || !otra.yaFirmada || db.datos.inv_ordenes.length !== 1) F("7 · quien ya firmó la versión vigente firma otra vez");
      }
      {
        const db = falso({ ...avisoUsado(), inv_personas: [], inv_ordenes: [], test_accounts: [] });
        const r = await firmar(db.sb, USER, PEDIDO_FIRMA, { ip: null, ua: null }, depsOk().deps);
        if (r.ok || r.error !== "sin-contacto" || db.datos.inv_ordenes.length) F("7 · se firma sin haber dejado el contacto");
      }
      {
        const db = falso({ ...avisoUsado(), inv_personas: [persona()], inv_ordenes: [], inv_bitacora: [], test_accounts: [] });
        const r = await firmar(db.sb, USER, PEDIDO_FIRMA, { ip: null, ua: null }, depsOk({ pdf: false }).deps);
        if (!r.ok || r.pdf || r.copia || db.datos.inv_ordenes.length !== 1) F("7 · una falla del PDF deshace la firma o se da por hecha");
        const db2 = falso({ ...avisoUsado(), inv_personas: [persona()], inv_ordenes: [], inv_bitacora: [], test_accounts: [] });
        const r2 = await firmar(db2.sb, USER, PEDIDO_FIRMA, { ip: null, ua: null }, depsOk({ copia: false }).deps);
        if (!r2.ok || !r2.pdf || r2.copia || db2.datos.inv_ordenes[0].copia_enviada_at) F("7 · una copia que no salió se marca como enviada");
      }
      {
        const nuevo = avisoUsado();
        nuevo.scraped_properties[0].condicion = "nuevo";
        nuevo.avisos_evaluados[0].condicion = "nuevo";
        const db = falso({ ...nuevo, inv_personas: [persona()], inv_ordenes: [], test_accounts: [] });
        const r = await firmar(db.sb, USER, PEDIDO_FIRMA, { ip: null, ua: null }, depsOk().deps);
        if (r.ok || db.datos.inv_ordenes.length) F("7 · se firma un depto nuevo");
      }
      const html = htmlOrden({ id: "o-1", nombre: "Camila", rut: "12345678-5", email: "c@x.cl", texto: textoPlano(o), textoVersion: 1, textoSha256: "a".repeat(64), firmadoAt: "2026-11-18T15:00:00.000Z", ip: "1.2.3.4", userAgent: "UA<script>" });
      if (!html.includes("12.345.678-5") || !html.includes("1.2.3.4") || !html.includes("a".repeat(64)) || !html.includes("<b>2. Comisión en deptos usados.</b>") || html.includes("UA<script>") || !/hora de Chile/.test(html)) F("7 · el PDF no lleva el texto y el registro de la firma (o no escapa)");
    }

    // ── 8 · REINICIAR PRUEBA ──
    {
      const conOrdenes = (ordenes: Record<string, unknown>[], esTest = true) => falso({
        inv_personas: [persona()],
        inv_ordenes: ordenes,
        inv_bitacora: [{ id: 1, user_id: USER.id, es_prueba: true, orden_id: null }, { id: 2, user_id: USER.id, es_prueba: false, orden_id: "o-real" }],
        test_accounts: esTest ? [{ user_id: USER.id }] : [],
      });
      // Una orden REAL simulada: no se toca nada.
      const real = conOrdenes([{ id: "o-real", user_id: USER.id, es_prueba: false, pdf_path: "ordenes/o-real.pdf" }, { id: "o-prueba", user_id: USER.id, es_prueba: true, pdf_path: "ordenes/o-prueba.pdf" }]);
      const r1 = await reiniciarPrueba(real.sb, USER.id, "admin@x");
      if (r1.ok || r1.error !== "orden-real" || real.pasos.some((p) => p.op === "delete" || p.op === "insert") || real.bucket.borrados.length) F("8 · «Reiniciar prueba» borra algo de una cuenta con una orden real");
      // Una cuenta que no es de prueba: tampoco.
      const noTest = conOrdenes([{ id: "o-p", user_id: USER.id, es_prueba: true, pdf_path: null }], false);
      const r2 = await reiniciarPrueba(noTest.sb, USER.id, "admin@x");
      if (r2.ok || r2.error !== "no-es-prueba" || noTest.pasos.some((p) => p.op === "delete")) F("8 · «Reiniciar prueba» borra algo de una cuenta que no es de prueba");
      // Una de prueba: la bitácora de prueba ANTES que la orden; el PDF; la persona; la bitácora real se queda.
      const prueba = conOrdenes([{ id: "o-p", user_id: USER.id, es_prueba: true, pdf_path: "ordenes/o-p.pdf" }]);
      const r3 = await reiniciarPrueba(prueba.sb, USER.id, "admin@x");
      const borrados = prueba.pasos.filter((p) => p.op === "delete").map((p) => p.tabla);
      const iBit = borrados.indexOf("inv_bitacora"), iOrd = borrados.indexOf("inv_ordenes");
      if (!r3.ok || iBit < 0 || iOrd < 0 || iBit > iOrd || !borrados.includes("inv_personas") || prueba.bucket.borrados[0] !== "ordenes/o-p.pdf") F("8 · «Reiniciar prueba» no borra la bitácora antes que la orden, el PDF y la persona");
      if (prueba.datos.inv_ordenes.length || prueba.datos.inv_personas.length) F("8 · «Reiniciar prueba» deja la orden o la persona");
      if (!prueba.datos.inv_bitacora.some((b) => b.id === 2)) F("8 · «Reiniciar prueba» borra bitácora real");
      if (prueba.pasos.filter((p) => p.op === "delete" && (p.tabla === "inv_bitacora" || p.tabla === "inv_ordenes")).some((p) => !p.filtros.some(([k, , val]) => k === "es_prueba" && val === true))) F("8 · «Reiniciar prueba» borra sin filtrar es_prueba");
    }

    // ── 9 · LOS MENSAJES Y LA MEDICIÓN ──
    {
      if (!excepcionCopiaOrden("invierte_orden_copia", "cuenta-de-prueba", true)) F("9 · la copia no sale a una cuenta de prueba de la lista");
      if (excepcionCopiaOrden("invierte_orden_copia", "cuenta-de-prueba", false)) F("9 · la copia sale a una cuenta de prueba fuera de la lista");
      if (excepcionCopiaOrden("invierte_orden_copia", "dominio-propio", true)) F("9 · la copia sale a una dirección de @refranco.ai que no existe");
      if (excepcionCopiaOrden("semanal", "cuenta-de-prueba", true) || excepcionCopiaOrden("bienvenida", "cuenta-de-prueba", true)) F("9 · la excepción vale para otro tipo de correo");
      const email = codigo("src/lib/email.ts");
      if (!/if \(bloqueo\) \{\s*if \(!\(await exceptuadoDelBloqueo\(tipo, bloqueo, String\(to \?\? ""\)\)\)\) \{/.test(email) || !/if \(tipo !== TIPO_COPIA_ORDEN\) return false;[\s\S]{0,200}return excepcionCopiaOrden\(tipo, motivo, enLista\);/.test(email)) F("9 · el único punto de envío no aplica la excepción solo a la copia");
      if (!/enviarCorreo\("invierte_orden_copia", p\.userId, \{[\s\S]{0,200}attachments: \[\{ filename: "orden-de-visita-franco\.pdf"/.test(email)) F("9 · la copia no sale con su tipo y el PDF adjunto");
      if (!(TIPOS_CORREO as readonly string[]).includes("invierte_orden_copia")) F("9 · invierte_orden_copia no está en TIPOS_CORREO");
      if (TIPOS_CON_BAJA.has("invierte_orden_copia" as never) || TIPOS_QUE_FRENA_LA_ELIMINACION.has("invierte_orden_copia" as never)) F("9 · la copia de la orden la frena la baja o la eliminación (es un comprobante)");
      const copia = correoCopiaOrden({ nombre: "Camila", depto: "Ñuñoa · 2D2B · 58 m²", fecha: "18-11-2026" });
      if (!/orden/i.test(copia.subject) || !copia.html.includes("Ñuñoa · 2D2B · 58 m²")) F("9 · la copia no dice que es la orden ni el depto");
      for (const e of Object.values(EVENTOS_INV2)) if (!e.startsWith("inv2_")) F(`9 · el evento ${e} no empieza con inv2_`);
      for (const f of [...archivos("src/lib/invierte-v2"), ...archivos("src/app/api/invierte-v2"), ...archivos("src/app/invierte"), ...archivos("src/components/invierte-v2")]) {
        const c = codigo(f);
        if (/emitirEventoMeta|EVENTOS_META|lib\/meta\//.test(c)) F(`9 · ${f} manda algo a Meta`);
        if (/posthog\?\.capture|usePostHog/.test(c)) F(`9 · ${f} mide desde el navegador`);
      }
    }

    // ── 11 · LA COPIA QUE NO SALIÓ: el motivo, el reintento aislado y el aviso ──
    {
      const ahora = new Date("2026-11-18T15:00:00.000Z");
      const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString();
      if (!tocaReintentar({ firmadoAt: hace(5), intentos: 0, ultimoIntentoAt: null }, ahora)) F("11 · sin intentos no toca reintentar");
      if (tocaReintentar({ firmadoAt: hace(30), intentos: 1, ultimoIntentoAt: hace(5) }, ahora) || !tocaReintentar({ firmadoAt: hace(30), intentos: 1, ultimoIntentoAt: hace(11) }, ahora)) F("11 · el segundo intento no espera 10 minutos");
      if (tocaReintentar({ firmadoAt: hace(600), intentos: MAX_INTENTOS_COPIA, ultimoIntentoAt: hace(500) }, ahora)) F("11 · se reintenta pasados los 5 intentos");
      if (tocaReintentar({ firmadoAt: hace(8 * 1440), intentos: 1, ultimoIntentoAt: hace(8 * 1440) }, ahora)) F("11 · se reintenta pasados los 7 días");
      if (debeAvisar({ firmadoAt: hace(59), yaAvisada: false }, ahora) || !debeAvisar({ firmadoAt: hace(61), yaAvisada: false }, ahora) || debeAvisar({ firmadoAt: hace(500), yaAvisada: true }, ahora)) F("11 · el aviso no es a la hora y una sola vez");
      if (!puedeRecibirCopia("lista", new Set([DE_LA_LISTA]), " Lista@Ejemplo.cl") || puedeRecibirCopia("lista", new Set([DE_LA_LISTA]), "otra@ejemplo.cl") || puedeRecibirCopia("apagado", new Set([DE_LA_LISTA]), "otra@ejemplo.cl") || !puedeRecibirCopia("todos", new Set(), "otra@ejemplo.cl")) F("11 · el reintento con el modo en lista llega a alguien fuera de la lista");

      // EL PASO AISLADO nunca lanza y respeta su tope.
      let avisos = 0;
      const lanza = await pasoAislado(async () => { throw new Error("se cayó"); }, 1000, () => { avisos++; });
      if (lanza.ok || lanza.motivo !== "error" || avisos !== 1) F("11 · el paso que lanza no se contiene (o no se avisa)");
      const t0 = Date.now();
      // Una demora FINITA (1,2 s) y no una promesa eterna: una eterna deja a Node sin nada pendiente y el proceso sale con 0 sin
      // terminar el tier (lo mostró la mutación C3).
      const cuelga = await pasoAislado(() => new Promise((r) => setTimeout(r, 1200)), 60, () => { avisos++; });
      if (cuelga.ok || cuelga.motivo !== "tope" || Date.now() - t0 > 1000) F("11 · el paso que no termina no se corta en su tope");

      // LA PRUEBA DEL CORREO DIARIO: corre entero ANTES del paso, y su respuesta sale igual con el reintento fallando o colgado.
      for (const [nombre, paso] of [
        ["lanza", async () => { throw new Error("reintento caído"); }],
        ["cuelga", () => new Promise((r) => setTimeout(r, 1200))],
        ["no carga", () => Promise.reject(new Error("no se pudo importar copias-servidor"))],
      ] as Array<[string, () => Promise<unknown>]>) {
        const orden: string[] = [];
        const t = Date.now();
        const r = await diarioYLuegoPaso(async () => { orden.push("diario: envíos"); orden.push("diario: cierre"); return "respuesta-del-diario"; }, async () => { orden.push("paso"); return paso(); }, () => 80, () => { orden.push("paso: falla anotada"); });
        if (r !== "respuesta-del-diario") F(`11 · con el reintento que ${nombre}, el correo diario no devuelve su respuesta`);
        if (orden.indexOf("diario: cierre") < 0 || orden.indexOf("paso") < orden.indexOf("diario: cierre")) F(`11 · con el reintento que ${nombre}, el paso corre antes de que cierre el correo diario`);
        if (Date.now() - t > 1000) F(`11 · con el reintento que ${nombre}, el correo diario se demora`);
      }
      const cron = codigo("src/app/api/cron/correo-del-dia/route.ts");
      if (!/return diarioYLuegoPaso\(\s*async \(\) => \{[\s\S]*?procesarDelDia\([\s\S]*?return await cerrarCron\(admin, NOMBRE, conteo,[\s\S]*?\},\s*\(\) => import\("@\/lib\/invierte-v2\/copias-servidor"\)\.then\(\(m\) => m\.reintentarCopiasDelCron\(admin\)\),\s*\(\) => Math\.min\(TOPE_PASO_COPIAS_MS, PRESUPUESTO_MS \+ 30_000 - \(Date\.now\(\) - t0\)\),/.test(cron)) F("11 · el cron no corre el reintento DESPUÉS del correo diario, aislado y con su tope");
      if (/reintentarCopias/.test(cron.slice(0, cron.indexOf("return diarioYLuegoPaso(")))) F("11 · el cron llama al reintento antes del correo diario");

      // EL MOTIVO llega a la bitácora y al error.
      const orden = (x: Partial<OrdenInv>): Record<string, unknown> => ({ id: x.id, user_id: USER.id, email: x.email ?? DE_LA_LISTA, nombre: "Camila", rut: "12345678-5", aviso_id: AVISO, depto_linea: "Ñuñoa · 2D2B · 58 m² · Usado", texto_version: 1, texto_sha256: "a".repeat(64), texto: "t", es_prueba: true, firmado_at: x.firmadoAt ?? hace(120), ip: null, user_agent: null, pdf_path: `ordenes/${x.id}.pdf`, pdf_sha256: "b".repeat(64), copia_enviada_at: null });
      {
        const db = falso({ inv_ordenes: [orden({ id: "o-1" })], inv_bitacora: [] });
        const c = await completarOrden(db.sb, { id: "o-1", userId: USER.id, email: DE_LA_LISTA, nombre: "Camila", rut: "12345678-5", avisoId: AVISO, deptoLinea: "Ñuñoa · 2D2B · 58 m² · Usado", textoVersion: 1, textoSha256: "a".repeat(64), texto: "t", esPrueba: true, firmadoAt: hace(1), ip: null, userAgent: null, pdfPath: "ordenes/o-1.pdf", pdfSha256: "b".repeat(64), copiaEnviadaAt: null }, depsOk({ copia: false, motivo: "sin-llave" }).deps, "firma");
        const b = db.datos.inv_bitacora.find((x) => x.accion === "copia_fallida") as { detalle?: Record<string, unknown> } | undefined;
        if (c.copia || c.motivoCopia !== "sin-llave" || b?.detalle?.motivo !== "sin-llave" || b?.detalle?.intento !== 1 || b?.detalle?.origen !== "firma") F("11 · el motivo de la copia no llega a la bitácora (con el intento y el origen)");
      }
      for (const r of ["src/app/api/invierte-v2/firma/route.ts", "src/app/api/invierte-v2/orden/route.ts"]) {
        if (!/copia \$\{[rc]\.copia\}\$\{[rc]\.motivoCopia \? `: \$\{[rc]\.motivoCopia\}` : ""\}\)`\)/.test(codigo(r)) || !/motivoCopia: [rc]\.motivoCopia/.test(codigo(r))) F(`11 · ${r} manda a Sentry «copia false» sin el motivo`);
      }
      const email = codigo("src/lib/email.ts");
      const envio = email.slice(email.indexOf("async function enviarCorreo("), email.indexOf("const distinctId = identidadCorreo("));
      for (const m of ['omitido\\(opciones, tipo, "sin-llave"\\); return \\{ data: null', 'omitido\\(opciones, tipo, `bloqueo:\\$\\{bloqueo\\}`\\);\\s*return \\{ data: null', 'omitido\\(opciones, tipo, "baja"\\);\\s*return \\{ data: null', 'omitido\\(opciones, tipo, "eliminacion"\\);\\s*return \\{ data: null']) if (!new RegExp(m).test(envio)) F(`11 · enviarCorreo no dice por qué no salió (${m.slice(26, 46)})`);
      if (!/alOmitir: \(m\) => \{ motivoOmitido = m; \}/.test(email) || !/return \{ ok: false, motivo: motivoOmitido \?\? "sin-respuesta" \};/.test(email)) F("11 · la copia no recoge el motivo de enviarCorreo");

      // EL REINTENTO: solo la lista, el tope de intentos y un solo aviso.
      {
        const fallidas = (id: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, orden_id: id, accion: "copia_fallida", detalle: { motivo: "sin-llave" }, created_at: hace(300 - i), es_prueba: true }));
        const db = falso({
          inv_ordenes: [orden({ id: "a" }), orden({ id: "b", email: "otra@ejemplo.cl" }), orden({ id: "c" }), orden({ id: "d", firmadoAt: hace(30) })],
          inv_bitacora: [...fallidas("c", MAX_INTENTOS_COPIA)],
        });
        const avisados: string[] = [];
        const enviadas: string[] = [];
        const deps = {
          firma: { generarPdf: async () => new Uint8Array([1]), enviarCopia: async (p: { ordenId: string }) => { enviadas.push(p.ordenId); return p.ordenId === "a" ? { ok: true as const } : { ok: false as const, motivo: "resend:caído" }; } },
          puedeRecibir: (e: string) => puedeRecibirCopia("lista", new Set([DE_LA_LISTA]), e),
          avisar: async (p: { ordenId: string }) => { avisados.push(p.ordenId); },
          ahora: () => ahora,
        };
        const r = await reintentarCopias(db.sb, deps);
        if (enviadas.includes("b") || r.fuera !== 1) F("11 · el reintento le escribe a alguien fuera de la lista");
        if (enviadas.includes("c")) F("11 · el reintento pasa de 5 intentos");
        if (!enviadas.includes("a") || !enviadas.includes("d") || r.enviadas !== 1) F("11 · el reintento no intenta las pendientes que tocan");
        if (avisados.includes("a") || !avisados.includes("c") || avisados.includes("d") || avisados.includes("b")) F("11 · el aviso a hola@ no es el de las de más de una hora sin copia");
        const r2 = await reintentarCopias(db.sb, deps);
        if (r2.avisadas !== 0 || avisados.filter((x) => x === "c").length !== 1) F("11 · el aviso a hola@ se repite");
      }

      // EL ADMIN Y LA PERSONA.
      const pag = codigo("src/app/admin/invierte-v2/page.tsx");
      if (!/data-admin="inv2-sin-copia"/.test(pag) || !/<ReenviarCopia ordenId=\{f\.orden\.id\} \/>/.test(pag) || !/f\.orden\.copiaMotivo/.test(pag) || !/f\.orden\.copiaIntentos/.test(pag)) F("11 · el admin no muestra la pastilla, el motivo, los intentos o «Reenviar copia»");
      if (!/if \(accion === "reenviar"\) \{[\s\S]{0,400}completarOrden\(sb, orden, DEPS_FIRMA, "admin"\)/.test(codigo("src/app/api/admin/invierte-v2/route.ts"))) F("11 · «Reenviar copia» no completa la orden");
      if (!/orden\.copiaEnviadaAt \? \([\s\S]{0,200}\) : \([\s\S]{0,120}\{P\.copiaPendiente\}/.test(codigo("src/app/invierte/partimos/page.tsx"))) F("11 · Partimos no dice cuando la copia no ha salido");
    }

    // ── 12 · EL FORMATO: la hoja, la firma y Partimos en el PC, y el modo «todos» sin sesión (18-nov-2026) ──
    {
      const marco = codigo("src/components/invierte-v2/MarcoInvierte.tsx");
      if (!/\{pc && \(\s*<div className="iv2-solo-pc" data-inv2="header-pc">\s*<HeaderFranco /.test(marco)) F("12 · el PC no lleva el HeaderFranco real (o se ve en el celular)");
      const firmaPag = codigo("src/app/invierte/[avisoId]/firma/page.tsx");
      if (!/layout="firma" pc=\{\{ sesionEmail: user\.email \?\? null, rotulo: FLUJO_COPY\.rotuloFirma \}\}/.test(firmaPag) || !/volver=\{volverAlOrigen\(depto\.avisoId, origen, analysisId\)\}/.test(firmaPag)) F("12 · la firma no va en dos columnas con el header (o «Volver» no vuelve a la superficie)");
      if (!/layout="partimos" pc=\{\{ sesionEmail: user\.email \?\? null, rotulo: FLUJO_COPY\.rotuloPartimos \}\}/.test(codigo("src/app/invierte/partimos/page.tsx"))) F("12 · Partimos no va en dos columnas con el header");
      const { volverAlOrigen } = await import("../../../src/lib/invierte-v2/paginas");
      for (const [o, a] of [["explorar", null], ["seleccion", null], ["informe", "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1"], ["informe", null]] as const) if (/^\/invierte\//.test(volverAlOrigen(AVISO, o, a))) F(`12 · «Volver» desde ${o} lleva a la página de respaldo del contacto`);
      if (volverAlOrigen(AVISO, "explorar", null) !== `/explorar?a=${AVISO}`) F("12 · «Volver» al mapa no abre el mismo depto");
      const css = leer("src/components/invierte-v2/invierte-v2.css");
      if (!/\.iv2-firma \{ display: grid; grid-template-columns: 420px minmax\(0, 1fr\);/.test(css) || !/\.iv2-firma \.iv2-bloque-orden \{ grid-column: 2;[^}]*position: sticky;/.test(css) || !/\.iv2-firma \.iv2-orden \{ height: 480px; \}/.test(css)) F("12 · la orden del PC no va a la derecha, fija y con alto fijo");
      if (!/\.iv2-partimos \{ display: grid; grid-template-columns: 460px minmax\(0, 1fr\);/.test(css)) F("12 · Partimos del PC no va en dos columnas");
      const form = codigo("src/components/invierte-v2/FirmaForm.tsx");
      if (!/className="inv-pregunta iv2-bloque-orden"/.test(form) || !/<span className="iv2-solo-movil">\{F\.desliza\}<\/span><span className="iv2-solo-pc">\{F\.deslizaPc\}<\/span>/.test(form)) F("12 · la firma no dice «Lee hasta el final…» en el PC y «Desliza…» en el celular");
      if (FLUJO_COPY.firma.deslizaPc !== "Lee hasta el final para poder firmar. El botón se activa cuando llegas al último párrafo.") F("12 · el texto de la firma del PC no es el de la lámina");
      if (!/te llegó una copia por correo/.test(FLUJO_COPY.partimos.guardada)) F("12 · Partimos no dice que la copia llegó (cuando llegó)");
      // El estado de la hoja: 404 sin acceso.
      const ruta = codigo("src/app/api/invierte-v2/contacto/route.ts");
      if (!/export async function GET\(\) \{\s*const user = await personaConAcceso\(\);\s*if \(!user\) return NO_EXISTE\(\);/.test(ruta)) F("12 · el estado de la hoja responde sin acceso");
      // El modo «todos» sin sesión: la hoja no pregunta el estado, el contacto queda en el navegador y la firma pide la cuenta.
      const hoja = codigo("src/components/invierte-v2/HojaContacto.tsx");
      if (!/useEffect\(\(\) => \{\s*if \(sinSesion\) return;/.test(hoja)) F("12 · sin sesión, la hoja pregunta el estado");
      const contacto = codigo("src/components/invierte-v2/ContactoForm.tsx");
      if (!/if \(sinSesion\) \{[\s\S]{0,200}window\.localStorage\.setItem\(CLAVE_PENDIENTE_V2,[\s\S]{0,120}router\.push\(urlFirma\(depto\.avisoId, origen, analysisId\)\);/.test(contacto)) F("12 · sin sesión, el contacto no queda en el navegador antes de ir a la firma");
      if (!/if \(!user\) redirect\(`\/register\?next=\$\{encodeURIComponent\(urlFirma\(depto\.avisoId, origen, analysisId\)\)\}`\);/.test(firmaPag)) F("12 · sin sesión, la firma no pide la cuenta (con vuelta a la firma)");
    }

    // ── 10 · EL LENGUAJE frente a la persona ──
    {
      const o = ordenVigente({ nombre: "", rut: "", depto: "Ñuñoa" });
      const textos = [JSON.stringify(FLUJO_COPY, (_k, val) => (typeof val === "function" ? val("Camila") : val)), textoPlano(o), correoCopiaOrden({ nombre: "Camila", depto: "Ñuñoa", fecha: "x" }).html.replace(/<[^>]+>/g, " ")].join("\n");
      if (/\binforme\b|an[aá]lisis/i.test(textos)) F("10 · el flujo nuevo habla de «informe» o «análisis»");
      if (/\b(fabrizio|flavio)\b/i.test(textos)) F("10 · el flujo nuevo nombra a una persona de Franco");
      if (/hasta cu[aá]nto (ofrecer|ofreces|puedes ofrecer)|precio m[aá]ximo|ofrecer hasta/i.test(textos)) F("10 · el flujo nuevo menciona hasta cuánto ofrecer");
    }
  } finally {
    if (posthog) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }
  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ INVIERTE-V2 verde");
  return { hard: fallas.length };
}

if (require.main === module) {
  runInvierteV2().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (18-nov-2026) ────────────────────────────────────────
// 37 de 37 en ROJO, una a la vez, con el archivo restaurado por copia después de cada una:
//   M1 «lista» deja pasar a cualquiera · M2 el modo sin distinguir mayúsculas · M3 un nuevo va al flujo nuevo · M4 sin acceso va al
//   flujo nuevo · M5 el mapa desvía sin destinoBoton · M6 la selección también · M7 la franja nueva muestra PRONTO · M8 la franja
//   nueva muestra el inscrito de Pronto · M9 el interruptor junto a un caché compartido · M10 la ruta no mira el interruptor · M11 el
//   contacto sin 404 · M12 la firma abre sin acceso con sesión · M13 el RUT acepta cualquier dígito · M14 el K mal calculado · M15
//   «leyó» como texto pasa · M16 firma sin casilla · M17 contacto sin permiso · M18 la casilla de WhatsApp marcada · M19 firmar sin
//   llegar al final · M20 el texto cambia sin subir la versión · M21 la huella no es la del texto · M22 es_prueba fijo · M23 firma dos
//   veces la vigente · M24 reiniciar con una orden REAL simulada · M25 reiniciar una cuenta real · M26 reiniciar borra bitácora real ·
//   M27 la excepción vale para todo correo · M28 la eliminación frena la copia · M29 «informe» frente a la persona · M30 un Lead a
//   Meta desde el flujo · M31 la copia fallida se marca enviada · M32 el envío ignora la excepción · M33 el PDF sin escapar · M34 el
//   flujo acepta un nuevo · M35 la hora la pone la ruta · M36 un evento sin prefijo inv2_ · M37 medir desde el navegador.
// Tras el golden QUICK del 18-nov (otros cuatro tiers leían la forma de enviarCorreo, del dashboard, de config y de la barra):
// la excepción pasó a `exceptuadoDelBloqueo` dentro de `if (bloqueo)` y la selección enciende la barra antes de navegar. 3 de 3
// en ROJO: M6b la selección desvía sin destinoBoton · M32b el envío ignora la excepción · M38 la excepción vale para todo tipo.
// §11 (18-nov-2026, la copia que no salió en el preview: el motivo, el reintento aislado en correo-del-dia y el aviso). 15 de 15 en ROJO:
//   C1 el paso corre antes del diario · C2 el paso que falla lanza · C3 el paso sin tope · C4 el tope del cron sin techo · C5 el
//   reintento no espera · C6 sin tope de intentos · C7 ignora la lista · C8 apagado reintenta a todos · C9 el aviso se repite · C10
//   Sentry sin el motivo · C11 la bitácora sin el motivo · C12 la baja sin motivo · C13 la copia no recoge el motivo · C14 el admin
//   sin la pastilla · C15 Partimos no lo dice. La C3 salió VERDE la primera vez por el arnés —una promesa eterna dejó a Node sin nada
//   pendiente y el proceso salió con 0 sin terminar—: los casos «cuelga» van con una demora finita y el runner exige la línea final.
// §2 y §12 (18-nov-2026, el contacto pasa a ser HOJA y la firma y Partimos tienen su PC). 14 de 14 en ROJO: B1 el mapa abre la hoja
//   sin destinoBoton · B2 vuelve a navegar a la página · B3 la selección sin destinoBoton · B4 la franja navega · B5 la hoja no manda a
//   Partimos al que firmó · B6 la hoja tapa el mapa en el celular · B7 el PC sin el header · B8 la firma sin dos columnas · B9 «Volver» a
//   la página de respaldo · B10 la orden del PC sin alto fijo · B11 «Desliza» en el PC · B12 el estado de la hoja sin acceso · B13 sin
//   sesión la firma no pide cuenta · B14 sin sesión no guarda lo contestado.
