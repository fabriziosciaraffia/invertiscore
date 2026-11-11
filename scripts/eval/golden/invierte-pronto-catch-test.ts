// ============================================================================
// TIER INVIERTE-PRONTO — «Pronto: Invierte con Franco» (11-nov-2026, goal de Fabrizio). Rojo con:
//   1 · EL BOTÓN EN UN DEPTO NUEVO O EN BUSCAR OTRO: la regla (puedeInvertir) y la tarjeta de Explorar dibujada —con y sin
//       cuenta— lo llevan solo en un usado que da ✓ Comprar o − Ajustar negociable; la selección y el informe usan la misma
//       regla; el servidor rechaza un nuevo aunque el navegador lo pida. «Analizar este» sigue siendo la acción principal (va antes).
//   2 · LA COMISIÓN, UNA LISTA DE SERVICIOS O UN PLAZO PROMETIDO en la franja, la hoja o la confirmación: el copy y el HTML
//       dibujado, sin «comisión», sin precio, sin lista (<ul>/<li>) y sin plazo (días, semanas, meses o una fecha) fuera de las
//       opciones de «¿Cuándo piensas comprar?», que son la respuesta de la persona y no una promesa. Los textos, los del goal.
//   3 · UNA INSCRIPCIÓN SIN DEPTO: la validación la rechaza, el servidor no inscribe un aviso que no existe y la tabla lo exige.
//   4 · UNA INSCRIPCIÓN QUE NO LLEGA POR CORREO: `inscribir` manda el correo a hola@ cada vez (también al repetir), con el asunto
//       marcado si es «este mes»; si el correo no sale, no hay inscripción confirmada (error «correo», la ruta 502 y la hoja no
//       confirma). Una por persona y depto: upsert por user_id + aviso_id.
//   5 · LA MEDICIÓN Y LO DEMÁS: invierte_ver / invierte_abrir / invierte_inscripcion (con urgencia y pie), el Lead por
//       emitirEventoMeta; el pie es el 20 % del depto; el anuncio a la base respeta bajas, eliminación y cuentas de prueba.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/invierte-pronto-catch-test.ts
// ============================================================================
import "./als-de-next";
import "./sin-css";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as inv from "../../../src/lib/invierte/invierte";
import { inscribir, type DepsInscribir } from "../../../src/lib/invierte/invierte-servidor";
import { audienciaAnuncio, type CuentaAnuncio } from "../../../src/lib/invierte/anuncio";
import { correoAnuncioInvierte, correoInscripcionInvierte } from "../../../src/lib/email/correos";
import { TIPOS_CON_BAJA, TIPOS_QUE_FRENA_LA_ELIMINACION } from "../../../src/lib/correo-baja";
import type { PinMapa } from "../../../src/lib/explorar/portal";
import type { PinNegociado } from "../../../src/lib/explorar/capa-negociar";
import { TarjetaPin } from "../../../src/app/explorar/tarjeta-pin";
import { HojaInvierte, ListoInvierte } from "../../../src/components/invierte/HojaInvierte";
import { FranjaInvierte } from "../../../src/components/invierte/FranjaInvierte";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
/** El código sin comentarios: un acta que nombra lo que el predicado busca no lo satisface. */
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const AVISO = "9bfe6906-1111-4000-8000-000000000001";
const pin = (id: string, x: Partial<PinMapa> = {}): PinMapa => ({
  avisoId: id, comuna: "Ñuñoa", lat: -33.45, lng: -70.6, m2: 58, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 3250, veredicto: "COMPRAR", score: 78, flujo: 42000, arriendo: 600000, alta: null, condicion: "usado", ...x,
});
const DEPTO: inv.DeptoInvierte = { avisoId: AVISO, linea: "Ñuñoa · 2D2B · 58 m² · Usado", precioUF: 3250, veredicto: "COMPRAR", score: 78 };

// ── Un Supabase de mentira, lo justo para `inscribir`: lecturas por tabla y lo que se escribió ──
interface Escrito { tabla: string; op: string; fila: Record<string, unknown>; onConflict?: string }
function falsoSupabase(t: { aviso?: Record<string, unknown> | null; evaluado?: Record<string, unknown> | null; previa?: boolean; fallaGuardar?: boolean }) {
  const escritos: Escrito[] = [];
  const cadena = (tabla: string) => {
    let op = "select";
    let fila: Record<string, unknown> = {};
    let onConflict: string | undefined;
    const resultado = () => {
      if (op === "upsert") {
        escritos.push({ tabla, op, fila, onConflict });
        return t.fallaGuardar ? { data: null, error: { message: "x" } } : { data: { id: "insc-1" }, error: null };
      }
      if (op === "update") { escritos.push({ tabla, op, fila }); return { data: null, error: null }; }
      if (tabla === "scraped_properties") return { data: t.aviso ? [t.aviso] : [], error: null };
      if (tabla === "avisos_evaluados") return { data: t.evaluado ?? null, error: null };
      if (tabla === "invierte_inscripciones") return { data: t.previa ? { id: "insc-1" } : null, error: null };
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "is", "in", "range", "or", "not"]) q[m] = () => q;
    q.upsert = (f: Record<string, unknown>, o?: { onConflict?: string }) => { op = "upsert"; fila = f; onConflict = o?.onConflict; return q; };
    q.update = (f: Record<string, unknown>) => { op = "update"; fila = f; return q; };
    q.maybeSingle = async () => resultado();
    q.single = async () => resultado();
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko);
    return q;
  };
  return { sb: { from: cadena } as unknown as SupabaseClient, escritos };
}
const AVISO_USADO = { id: AVISO, comuna: "Ñuñoa", superficie_m2: 58, dormitorios: 2, banos: 2, condicion: "usado", precio: 3250 };
const EVALUADO = { aviso_id: AVISO, precio_uf: 3250, condicion: "usado", veredicto_20: "COMPRAR", score_20: 78, negociar_20: null };
const PEDIDO: inv.PedidoInvierte = { avisoId: AVISO, origen: "explorar", urgencia: "este_mes", pie: "si", whatsapp: "+56972345678", analysisId: null };
const USUARIO = { id: "4b7c2a10-0000-4000-8000-0000000000aa", email: "camila@ejemplo.cl", nombre: "Camila" };

export async function runInviertePronto(): Promise<{ hard: number }> {
  console.log("\n─── TIER INVIERTE-PRONTO (Pronto: Invierte con Franco — dónde va el botón, el copy sin promesas, la inscripción con depto y con correo · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  try {
    // ── 1 · DÓNDE VA EL BOTÓN ──
    {
      const casos: Array<[Parameters<typeof inv.puedeInvertir>[0], boolean, string]> = [
        [{ condicion: "usado", veredicto: "COMPRAR" }, true, "usado ✓ Comprar"],
        [{ condicion: "usado", veredicto: "AJUSTA SUPUESTOS", negociable: true }, true, "usado − Ajustar negociable"],
        [{ condicion: "usado", veredicto: "AJUSTA SUPUESTOS", negociable: false }, false, "usado − Ajustar sin negociar"],
        [{ condicion: "usado", veredicto: "BUSCAR OTRA" }, false, "usado Buscar otro"],
        [{ condicion: "usado", veredicto: "BUSCAR OTRA", negociable: true }, false, "usado Buscar otro aunque diga negociable"],
        [{ condicion: "nuevo", veredicto: "COMPRAR" }, false, "nuevo ✓ Comprar"],
        [{ condicion: "nuevo", veredicto: "AJUSTA SUPUESTOS", negociable: true }, false, "nuevo − Ajustar negociable"],
        [{ condicion: undefined, veredicto: "COMPRAR" }, false, "sin condición ✓ Comprar"],
      ];
      for (const [d, esperado, nombre] of casos) if (inv.puedeInvertir(d) !== esperado) F(`1 · puedeInvertir(${nombre}) debería ser ${esperado}`);

      // La tarjeta de Explorar, dibujada, con y sin cuenta.
      const NEG: PinNegociado = { ...pin("9bfe6906-1111-4000-8000-000000000005", { veredicto: "AJUSTA SUPUESTOS" }), neg: { d: 4, p: 3120, s: 71, f: 10000 } };
      const pines: PinMapa[] = [
        pin(AVISO),
        pin("9bfe6906-1111-4000-8000-000000000002", { condicion: "nuevo" }),
        pin("9bfe6906-1111-4000-8000-000000000003", { veredicto: "BUSCAR OTRA", score: 30 }),
        pin("9bfe6906-1111-4000-8000-000000000004", { condicion: undefined }),
        NEG,
        pin("9bfe6906-1111-4000-8000-000000000006", { veredicto: "AJUSTA SUPUESTOS", score: 55 }),
      ];
      for (const sinCuenta of [false, true]) {
        const html = renderToStaticMarkup(createElement(TarjetaPin, {
          pines, seleccionado: AVISO, uf: 39000, analizados: {}, guardados: new Set<string>(), generando: null, error: null,
          alCambiar: () => {}, alCerrar: () => {}, alGuardar: () => {}, alAnalizar: () => {}, alCompartir: () => {}, sinCuenta,
          inscritos: new Set<string>(), alInvertir: () => {},
        }));
        const tarjetas = html.split('data-explorar="tarjeta"').slice(1);
        const con = tarjetas.map((t) => t.includes('data-invierte="boton"'));
        const esperado = [true, false, false, false, true, false];
        if (tarjetas.length !== 6 || con.some((c, i) => c !== esperado[i])) F(`1 · ${sinCuenta ? "sin" : "con"} cuenta, el botón está en ${JSON.stringify(con)} y debería estar en ${JSON.stringify(esperado)} (usado Comprar, nuevo, Buscar otro, sin condición, negociado, Ajustar sin negociar)`);
        // Secundario: va DESPUÉS del botón principal de la tarjeta.
        const primera = tarjetas[0] ?? "";
        const iPrincipal = primera.search(sinCuenta ? /data-explorar="registrate"/ : /data-explorar="analizar"/);
        const iInvierte = primera.indexOf('data-invierte="boton"');
        if (iPrincipal < 0 || iInvierte < iPrincipal) F(`1 · ${sinCuenta ? "sin" : "con"} cuenta, «Invierte con Franco» no va debajo de la acción principal de la tarjeta`);
        if (!/class="inv-boton"[^>]*>Invierte con Franco</.test(primera)) F("1 · el botón de la tarjeta no es el secundario «Invierte con Franco»");
        // La tarjeta no promete nada más: ninguna línea al lado del botón.
        if (/informe va incluido|incluido/i.test(primera)) F("1 · la tarjeta promete algo junto al botón");
      }
      // Inscrito: la etiqueta en lugar del botón.
      const inscrito = renderToStaticMarkup(createElement(TarjetaPin, {
        pines: [pin(AVISO)], seleccionado: AVISO, uf: 39000, analizados: {}, guardados: new Set<string>(), generando: null, error: null,
        alCambiar: () => {}, alCerrar: () => {}, alGuardar: () => {}, alAnalizar: () => {}, alCompartir: () => {}, inscritos: new Set([AVISO]), alInvertir: () => {},
      }));
      if (inscrito.includes('data-invierte="boton"') || !inscrito.includes(">Inscrito en Invierte con Franco<")) F("1 · inscrito, la tarjeta no cambia el botón por «Inscrito en Invierte con Franco»");

      // Explorar le pasa a la tarjeta qué hacer (con y sin cuenta): sin eso, el botón no aparece en producción.
      const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
      const elTarjeta = cliente.slice(cliente.indexOf("<TarjetaPin"), cliente.indexOf("/>", cliente.indexOf("<TarjetaPin")));
      if (!/inscritos=\{inscritos\}/.test(elTarjeta) || !/alInvertir=\{\(p\) => \{[^}]*setInvierte\(\{ pin: p, retomar: false \}\)/.test(elTarjeta)) F("1 · Explorar no le pasa a la tarjeta los inscritos y la hoja de «Invierte con Franco»");
      // La selección del dashboard usa la misma regla, con el `tramo` «negociar» como negociable.
      const sel = codigo("src/app/semanal/semanal-lista.tsx");
      if (!/puedeInvertir\(\{ condicion: it\.condicion, veredicto: it\.veredicto, negociable: it\.tramo === "negociar" \}\) && \(\s*<BotonInvierte avisoId=\{it\.avisoId\} origen="seleccion"/.test(sel)) F("1 · la tarjeta de la selección no decide el botón con puedeInvertir (usado + Comprar o negociar)");
      const iAcc = sel.indexOf("{acciones(it)}");
      const iBot = sel.indexOf("<BotonInvierte avisoId={it.avisoId}");
      if (iAcc < 0 || iBot < iAcc) F("1 · en la selección, el botón no va debajo de «Analizar este»");
      // El informe: el servidor decide con puedeInvertir y el veredicto DEL INFORME, solo al dueño.
      const srv = codigo("src/lib/invierte/invierte-servidor.ts");
      if (!/if \(!aviso \|\| !puedeInvertir\(\{ condicion: aviso\.condicion, veredicto: p\.veredicto, negociable: aviso\.negociable \}\)\) return null;/.test(srv)) F("1 · la portada del informe no decide la franja con puedeInvertir y el veredicto del informe");
      for (const [archivo, nombre] of [["src/app/analisis/[id]/informe-ltr.tsx", "LTR"], ["src/app/analisis/renta-corta/[id]/informe-str.tsx", "STR"]] as const) {
        if (!/const invierte = isOwner && [^;]{0,160}?\? await invierteDelInforme\(/.test(codigo(archivo))) F(`1 · el informe ${nombre} no pregunta la franja solo para el dueño`);
      }
      // Y el servidor rechaza un nuevo aunque el navegador lo pida.
      const nuevo = falsoSupabase({ aviso: { ...AVISO_USADO, condicion: "nuevo" }, evaluado: { ...EVALUADO, condicion: "nuevo" } });
      const rNuevo = await inscribir(nuevo.sb, USUARIO, PEDIDO, null, { enviarCorreo: async () => true, esPrueba: async () => false });
      if (rNuevo.ok || rNuevo.error !== "nuevo" || nuevo.escritos.length) F("1 · el servidor inscribe un depto nuevo de inmobiliaria");
      const sinCond = falsoSupabase({ aviso: { ...AVISO_USADO, condicion: null }, evaluado: { ...EVALUADO, condicion: null } });
      if ((await inscribir(sinCond.sb, USUARIO, PEDIDO, null, { enviarCorreo: async () => true, esPrueba: async () => false })).ok) F("1 · el servidor inscribe un depto sin condición");
    }

    // ── 2 · SIN COMISIÓN, SIN LISTA DE SERVICIOS, SIN PLAZO PROMETIDO ──
    {
      const H = inv.INVIERTE_COPY.hoja;
      const L = inv.INVIERTE_COPY.listo;
      const Fr = inv.INVIERTE_COPY.franja;
      // Los textos, los del goal (tal cual).
      const exactos: Array<[string, string]> = [
        [inv.INVIERTE_COPY.boton, "Invierte con Franco"],
        [inv.INVIERTE_COPY.pronto, "PRONTO"],
        [Fr.titulo, "¿Quieres invertir? Pronto Franco te acompaña."],
        [Fr.texto, "Todo lo que Franco sabe de este depto, puesto a trabajar en tu inversión. Inscríbete y te avisamos."],
        [H.titulo, "Invierte en este depto con Franco"],
        [H.parrafo, "Estamos preparando una forma nueva de invertir: todo lo que Franco sabe de este depto, puesto a trabajar en tu inversión, hasta el final. Inscríbete y sé de los primeros."],
        [H.cuando, "¿Cuándo piensas comprar?"],
        [H.urgencias.este_mes, "Este mes"], [H.urgencias.uno_a_tres, "En 1 a 3 meses"], [H.urgencias.mas_adelante, "Más adelante"],
        [H.pie(650), "¿Tienes el pie de UF 650?"], [H.pieAclaracion, "20 % de este depto"],
        [H.pies.si, "Sí"], [H.pies.parte, "Una parte"], [H.pies.no, "Todavía no"],
        [H.enviar, "Avísenme cuando pueda invertir en este depto"],
        [L.titulo, "Listo, quedaste inscrito."], [L.texto, "Te avisamos apenas puedas invertir en este depto con Franco."], [L.sub, "Vas a ser de los primeros en saberlo."],
        [inv.INVIERTE_COPY.inscrito, "Inscrito en Invierte con Franco"],
      ];
      for (const [real, goal] of exactos) if (real !== goal) F(`2 · el texto «${real}» no es el del goal («${goal}»)`);

      // Lo dibujado: la hoja (con y sin cuenta), la confirmación y la franja (sin inscribir e inscrita).
      const piezas: Array<[string, string]> = [
        ["la hoja", renderToStaticMarkup(createElement(HojaInvierte, { depto: DEPTO, origen: "explorar", alCerrar: () => {} }))],
        ["la hoja sin cuenta", renderToStaticMarkup(createElement(HojaInvierte, { depto: DEPTO, origen: "explorar", sinCuenta: true, alPedirRegistro: () => {}, alCerrar: () => {} }))],
        ["la confirmación", renderToStaticMarkup(createElement(ListoInvierte, { depto: DEPTO, volver: L.volverMapa, alVolver: () => {} }))],
        ["la franja", renderToStaticMarkup(createElement(FranjaInvierte, { depto: DEPTO, inscrito: false, publicacion: { url: "https://ejemplo.cl/aviso", despublicado: false } }))],
        ["la franja inscrita", renderToStaticMarkup(createElement(FranjaInvierte, { depto: DEPTO, inscrito: true, publicacion: null }))],
      ];
      const sinOpciones = (html: string) => Object.values(H.urgencias).reduce((s, u) => s.split(`>${u}<`).join("><"), html);
      const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&quot;|&amp;/g, " ");
      for (const [nombre, html] of piezas) {
        const t = texto(sinOpciones(html));
        if (/comisi[oó]n|honorario/i.test(t)) F(`2 · ${nombre} menciona la comisión`);
        if (/<ul|<ol|<li/i.test(html)) F(`2 · ${nombre} trae una lista`);
        if (/servicio/i.test(t)) F(`2 · ${nombre} habla de servicios`);
        if (/\$\s?\d|\bCLP\b|gratis|sin costo|precio del servicio/i.test(t)) F(`2 · ${nombre} pone un precio`);
        if (/\b\d+\s*(d[ií]as?|semanas?|meses|mes|a[nñ]os?|horas?)\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|en (las )?pr[oó]ximas?|esta semana|este a[nñ]o|antes del|a partir del/i.test(t)) F(`2 · ${nombre} promete un plazo («${(/\b\d+\s*(d[ií]as?|semanas?|meses|mes|a[nñ]os?|horas?)\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|en (las )?pr[oó]ximas?|esta semana|este a[nñ]o|antes del|a partir del/i.exec(t) ?? [""])[0]}»)`);
      }
      const hoja = piezas[0][1];
      for (const t of [H.titulo, H.parrafo, H.cuando, H.pie(650), H.pieAclaracion, H.whatsapp, H.enviar, "PRONTO", "Ñuñoa · 2D2B · 58 m² · Usado · UF 3.250"]) if (!hoja.includes(t)) F(`2 · la hoja no dice «${t}»`);
      if ((hoja.match(/<p class="inv-parrafo"/g) ?? []).length !== 1) F("2 · la hoja no tiene un solo párrafo");
      if (!/data-veredicto="COMPRAR"[^>]*>✓ Comprar · 78</.test(hoja)) F("2 · la hoja no lleva el chip del depto");
      if (!piezas[2][1].includes(L.titulo) || !piezas[2][1].includes(L.texto) || !piezas[2][1].includes(L.sub) || !piezas[2][1].includes(inv.INVIERTE_COPY.inscrito)) F("2 · la confirmación no dice sus tres frases y la etiqueta");
      const franja = piezas[3][1];
      if (!franja.includes(Fr.titulo) || !franja.includes(Fr.texto) || !/data-invierte="boton"[^>]*>Invierte con Franco</.test(franja)) F("2 · la franja no dice su título, su texto y su botón");
      if (franja.indexOf('data-invierte="boton"') > franja.indexOf('data-publicacion="enlace"') || !/Ver la publicación ↗/.test(franja)) F("2 · «Ver la publicación ↗» no va debajo del botón de la franja");
      // «Ver la publicación» sale de la tarjeta oscura cuando la franja la lleva; la franja de antes ya no está con «Invierte».
      if (!/\{publicacion && !publicacion\.enFranja && \(publicacion\.despublicado \?/.test(codigo("src/components/analysis/portada/PortadaInforme.tsx"))) F("2 · la portada sigue mostrando «Ver la publicación» cuando la franja la lleva");
      const ida = codigo("src/components/guia/InformeDeAviso.tsx");
      if (!/\{esDueno && invierte && \(\s*<FranjaInvierte/.test(ida) || !/\{esDueno && !invierte && \(\s*<div className="qv-banda"/.test(ida)) F("2 · con «Invierte con Franco», la portada sigue con «Mandármelo por correo» (o lo pierde sin ella)");
      // El pie es el 20 % de ESTE depto.
      if (inv.pieDelDepto(3250) !== 650 || inv.pieDelDepto(5701) !== 1140 || inv.pieDelDepto(null) !== null) F("2 · el pie preguntado no es el 20 % del precio del depto");
    }

    // ── 3 · SIN DEPTO NO HAY INSCRIPCIÓN ──
    {
      const base = { origen: "explorar", urgencia: "este_mes", pie: "si", whatsapp: "+56 9 7234 5678" };
      for (const avisoId of [undefined, "", "   ", "no válido!"]) {
        const v = inv.validarInscripcion({ ...base, avisoId });
        if (v.ok || v.error !== "depto") F(`3 · una inscripción sin depto (${JSON.stringify(avisoId)}) pasa la validación`);
      }
      const ok = inv.validarInscripcion({ ...base, avisoId: AVISO });
      if (!ok.ok || ok.pedido.whatsapp !== "+56972345678") F("3 · una inscripción con depto y WhatsApp válido no pasa (o no normaliza el WhatsApp)");
      if (inv.validarInscripcion({ ...base, avisoId: AVISO, whatsapp: "123" }).ok) F("3 · pasa un WhatsApp que no es un móvil chileno");
      if (inv.validarInscripcion({ ...base, avisoId: AVISO, urgencia: "ya" }).ok || inv.validarInscripcion({ ...base, avisoId: AVISO, pie: "quizas" }).ok) F("3 · pasa una respuesta que no es de las opciones");
      const fantasma = falsoSupabase({ aviso: null });
      const r = await inscribir(fantasma.sb, USUARIO, PEDIDO, null, { enviarCorreo: async () => true, esPrueba: async () => false });
      if (r.ok || r.error !== "depto" || fantasma.escritos.length) F("3 · el servidor inscribe un aviso que no existe");
      const sql = leer("supabase/migrations/20261111_invierte_inscripciones.sql");
      if (!/aviso_id text not null check \(length\(trim\(aviso_id\)\) > 0\)/.test(sql) || !/unique \(user_id, aviso_id\)/.test(sql)) F("3 · la tabla no exige el depto (o no es una por persona y depto)");
      const ruta = codigo("src/app/api/invierte/route.ts");
      if (!/const v = validarInscripcion\(body\);\s*if \(!v\.ok\) return NextResponse\.json\(\{ error: v\.error \}, \{ status: 400 \}\);/.test(ruta)) F("3 · la ruta no valida antes de inscribir");
    }

    // ── 4 · CADA INSCRIPCIÓN LLEGA POR CORREO ──
    {
      const llamadas: Array<{ p: Parameters<DepsInscribir["enviarCorreo"]>[0]; llave: string }> = [];
      const deps = (sale: boolean): DepsInscribir => ({ enviarCorreo: async (p, llave) => { llamadas.push({ p, llave }); return sale; }, esPrueba: async () => false });
      const a = falsoSupabase({ aviso: AVISO_USADO, evaluado: EVALUADO });
      const r1 = await inscribir(a.sb, USUARIO, PEDIDO, { utm_source: "facebook", utm_campaign: "invierte" }, deps(true));
      if (!r1.ok || llamadas.length !== 1) F("4 · una inscripción no manda el correo a hola@ (o lo manda más de una vez)");
      const c = llamadas[0]?.p;
      if (!c || !c.asunto.startsWith("[ESTE MES] ") || c.whatsapp !== "+56972345678" || c.urgencia !== "Este mes" || c.pie !== "Sí" || c.pieUF !== 650 || !c.campana.includes("facebook")) F("4 · el correo de «este mes» no va con el asunto marcado, las respuestas, el pie y la campaña");
      const up = a.escritos.find((e) => e.op === "upsert");
      if (!up || up.tabla !== "invierte_inscripciones" || up.onConflict !== "user_id,aviso_id" || up.fila.aviso_id !== AVISO || "estado" in up.fila) F("4 · no es una por persona y depto (upsert por user_id + aviso_id, sin pisar el estado)");
      if (!a.escritos.some((e) => e.op === "update" && e.fila.correo_enviado_at)) F("4 · la inscripción no queda marcada con el correo enviado");
      // Otras urgencias: sin marca.
      const b = falsoSupabase({ aviso: AVISO_USADO, evaluado: EVALUADO, previa: true });
      await inscribir(b.sb, USUARIO, { ...PEDIDO, urgencia: "mas_adelante", pie: "no" }, null, deps(true));
      const c2 = llamadas[1]?.p;
      if (!c2 || c2.asunto.includes("ESTE MES") || !c2.repetida) F("4 · al repetir no vuelve a llegar (o una de «más adelante» va marcada)");
      if (llamadas[0]?.llave === llamadas[1]?.llave) F("4 · la respuesta nueva usa la misma llave de idempotencia (Resend no la mandaría)");
      // Si el correo no sale, no hay inscripción confirmada.
      const d = falsoSupabase({ aviso: AVISO_USADO, evaluado: EVALUADO });
      const r3 = await inscribir(d.sb, USUARIO, PEDIDO, null, deps(false));
      if (r3.ok || r3.error !== "correo" || d.escritos.some((e) => e.op === "update" && e.fila.correo_enviado_at)) F("4 · una inscripción cuyo correo no salió se da por buena");
      const ruta = codigo("src/app/api/invierte/route.ts");
      if (!/r\.error === "correo" \? 502/.test(ruta) || !/enviarCorreo: sendInscripcionInvierteInterna/.test(ruta)) F("4 · la ruta no responde error cuando el correo a hola@ no sale");
      const hoja = codigo("src/components/invierte/HojaInvierte.tsx");
      const iNoOk = hoja.indexOf("if (!res.ok) { setError(textoError(\"red\")); setEstado(\"form\"); return; }");
      if (iNoOk < 0 || hoja.indexOf('setEstado("listo")') < iNoOk) F("4 · la hoja confirma sin que la ruta haya respondido bien");
      const email = codigo("src/lib/email.ts");
      if (!/enviarCorreo\("invierte_inscripcion", null, \{ from: FROM_EMAIL, to: "hola@refranco\.ai"/.test(email)) F("4 · el correo de la inscripción no va a hola@ (o lo frena la baja de la persona)");
      const html = correoInscripcionInvierte({ ...c!, sitio: "https://refranco.ai" }).html;
      if (!html.includes("wa.me/56972345678") || !html.includes("Este mes") || !html.includes("/admin/invierte")) F("4 · el correo a hola@ no trae el WhatsApp, la respuesta y el enlace al panel");
      // Error al guardar: tampoco sale el correo.
      const e = falsoSupabase({ aviso: AVISO_USADO, evaluado: EVALUADO, fallaGuardar: true });
      const n0 = llamadas.length;
      const r4 = await inscribir(e.sb, USUARIO, PEDIDO, null, deps(true));
      if (r4.ok || r4.error !== "guardar" || llamadas.length !== n0) F("4 · sin poder guardar la inscripción, igual se confirma o se avisa");
    }

    // ── 5 · LA MEDICIÓN, EL REGISTRO SIN CUENTA Y EL ANUNCIO ──
    {
      if (inv.EVENTOS_INVIERTE.ver !== "invierte_ver" || inv.EVENTOS_INVIERTE.abrir !== "invierte_abrir" || inv.EVENTOS_INVIERTE.inscripcion !== "invierte_inscripcion") F("5 · los eventos no se llaman invierte_ver / invierte_abrir / invierte_inscripcion");
      const ruta = codigo("src/app/api/invierte/route.ts");
      if (!/event: EVENTOS_INVIERTE\.inscripcion,[\s\S]{0,200}urgencia: v\.pedido\.urgencia, pie: v\.pedido\.pie/.test(ruta)) F("5 · invierte_inscripcion no lleva la urgencia y el pie");
      if (!/emitirEventoMeta\(admin, \{\s*evento: EVENTOS_META\.lead,\s*eventId: idInvierte\(user\.id, r\.depto\.avisoId\)/.test(ruta) || !/conEspejo\(/.test(ruta)) F("5 · el Lead no sale por emitirEventoMeta con el espejo");
      const boton = codigo("src/components/invierte/BotonInvierte.tsx");
      if (!/capture\(EVENTOS_INVIERTE\.ver,/.test(boton) || !/capture\(EVENTOS_INVIERTE\.abrir,/.test(boton)) F("5 · el botón no mide invierte_ver / invierte_abrir");
      // Sin cuenta: la hoja guarda lo contestado y pide el registro; al volver, retoma.
      const hoja = codigo("src/components/invierte/HojaInvierte.tsx");
      if (!/if \(sinCuenta\) \{\s*guardarPendiente\(almacen\(\), \{ pedido: v\.pedido, depto \}\);\s*alPedirRegistro\?\.\(\);\s*return;\s*\}/.test(hoja)) F("5 · sin cuenta, la hoja no guarda lo contestado antes de pasar al registro");
      const iMarca = hoja.indexOf("borrarPendiente(almacen());");
      if (iMarca < 0 || iMarca < hoja.indexOf("if (!res.ok)")) F("5 · lo pendiente se borra antes de que la ruta responda bien");
      const cliente = codigo("src/app/explorar/explorar-cliente.tsx");
      if (!/if \(it && v\.motivo === "invierte"\) setInvierte\(\{ pin: it, retomar: true \}\);/.test(cliente) || !/pedirRegistro\("invierte", pin\)/.test(cliente)) F("5 · Explorar no pasa por el registro (o no retoma la inscripción al volver)");
      const mem = new Map<string, string>();
      const alm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
      const t0 = Date.UTC(2026, 10, 11, 12);
      inv.guardarPendiente(alm, { pedido: { ...PEDIDO }, depto: DEPTO }, t0);
      if (inv.leerPendiente(alm, AVISO, t0 + 1000)?.pedido.urgencia !== "este_mes" || inv.leerPendiente(alm, "otro", t0) !== null || inv.leerPendiente(alm, AVISO, t0 + inv.VIDA_PENDIENTE_MS + 1) !== null) F("5 · lo pendiente no vuelve para su depto, o vuelve para otro, o no vence");
      // El anuncio a la base: respeta bajas, eliminación y prueba; no sale sin --enviar.
      const ahora = new Date("2026-11-11T12:00:00Z");
      const cuenta = (id: string, x: Partial<CuentaAnuncio> = {}): CuentaAnuncio => ({ id, email: `${id}@ejemplo.cl`, createdAt: "2026-10-01T00:00:00Z", lastSignInAt: "2026-11-01T00:00:00Z", appMetadata: {}, nombre: null, ...x });
      const aud = audienciaAnuncio([cuenta("a"), cuenta("b"), cuenta("c"), cuenta("d", { appMetadata: { eliminacion_solicitada_at: "2026-11-02" } }), cuenta("e", { createdAt: "2026-01-01T00:00:00Z", lastSignInAt: "2026-02-01T00:00:00Z" }), cuenta("f", { email: null })], { bajas: new Set(["b"]), prueba: new Set(["c"]), ahora });
      if (aud.van.map((c) => c.id).join() !== "a" || aud.fuera.baja !== 1 || aud.fuera.prueba !== 1 || aud.fuera.eliminacion !== 1 || aud.fuera.inactiva !== 1 || aud.fuera.sin_correo !== 1) F(`5 · el anuncio no respeta las bajas, la eliminación, las cuentas de prueba o la actividad (${JSON.stringify(aud.fuera)})`);
      if (!TIPOS_CON_BAJA.has("invierte_anuncio") || !TIPOS_QUE_FRENA_LA_ELIMINACION.has("invierte_anuncio")) F("5 · el punto de envío no frena el anuncio por la baja o la eliminación");
      const script = codigo("scripts/invierte-anuncio.ts");
      const iEnviar = script.indexOf("if (!ENVIAR) {");
      if (!/const ENVIAR = args\.includes\("--enviar"\);/.test(script) || iEnviar < 0 || iEnviar > script.indexOf("sendAnuncioInvierte(c.email!")) F("5 · el anuncio puede salir sin --enviar");
      const anuncio = correoAnuncioInvierte({ nombre: "Camila", urlSeleccion: "https://refranco.ai/dashboard#seleccion", urlBaja: "https://refranco.ai/api/semanal/baja?t=x" }).html;
      if (!anuncio.includes("/dashboard#seleccion") || !anuncio.includes("/api/semanal/baja?t=x") || /comisi[oó]n|\b\d+\s*(d[ií]as|semanas|meses)\b/i.test(anuncio.replace(/<[^>]+>/g, " "))) F("5 · el anuncio no lleva a la selección y a la baja (o promete comisión o plazo)");
    }
  } finally {
    if (posthog) process.env.NEXT_PUBLIC_POSTHOG_KEY = posthog;
  }
  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ INVIERTE-PRONTO verde");
  return { hard: fallas.length };
}

if (require.main === module) {
  runInviertePronto().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (11-nov-2026) ────────────────────────────────────────
// 21 de 21 en ROJO, una a la vez, con el archivo restaurado por copia después de cada una:
//   M1 un nuevo pasa la regla · M2 un Buscar otro «negociable» pasa · M3 la tarjeta dibuja el botón sin la regla · M4 «Sin comisión»
//   en la franja · M5 «en 30 días» en la confirmación · M6 la validación acepta sin depto · M7 un correo que no salió se da por
//   bueno · M8 el asunto de «este mes» sin marca · M9 la hoja confirma sin res.ok · M10 la selección toma todo Ajustar como
//   negociable · M11 la portada repite «Ver la publicación» · M12 el servidor inscribe un nuevo · M13 el anuncio ignora las bajas ·
//   M14 sin cuenta no guarda lo contestado · M15 invierte_inscripcion sin la urgencia · M16 el upsert pisa el estado del panel ·
//   M17 con «Invierte» vuelve «Mandármelo por correo» · M18 una lista en la hoja · M19 el pie al 30 % · M20 Explorar no le pasa
//   alInvertir a la tarjeta · M21 lo pendiente se borra antes de la respuesta.
