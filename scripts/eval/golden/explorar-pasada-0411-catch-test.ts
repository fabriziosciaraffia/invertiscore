// ============================================================================
// TIER EXPLORAR-PASADA-0411 — los ajustes de /explorar de la pasada del 04-nov-2026 (Fabrizio, en el teléfono y en el PC).
//
//   1 · RECALCULAR CON OTRA TASA, PIE O PLAZO: el avance va en un pop-up centrado, como el de «Analizar», con un spinner: «Franco
//       está recalculando con tu tasa de 5 %» y «9 de 25 comunas»; se cierra solo al terminar (sin X). Abajo ya no va la línea del
//       avance. Y con una combinación distinta de la noche también se calculan los − Ajustar (el descuento mínimo a Comprar, con el
//       mismo tope), por comuna, en el mismo pedido del universo calculado —o aparte, para pie 20 % o 30 % a 25 años—.
//   2 · LA BAJA Y EL PRECIO MOVIDO DICEN POR QUÉ: «Este depto ya no está publicado. Franco lo revisó anoche y hoy el vendedor lo sacó:
//       los que convienen se van rápido. No se usó ningún análisis. Lo quitamos del mapa; elige otro.» (en la selección y el
//       dashboard, «de tu selección»); «Desde anoche entraron avisos nuevos en la zona y el precio al que conviene cambió: hoy llega
//       a Comprar con UF 2.085 (−1,0 %), no con UF 2.089. No se usó ningún análisis.»
//   3 · EL CHIP EN EL POP-UP DE «ANALIZAR ESTE»: «[✓ Comprar · 84] al precio publicado · flujo +$261.383 te queda».
//   4 · VOLVER AL MAPA DESDE EL INFORME: arriba, «← Volver al mapa» a /explorar con los mismos filtros y el pin (`a=`); «atrás» vuelve
//       igual (la entrada del historial queda con el pin); al volver, el pin centrado y su tarjeta en «Ya lo analizaste».
//   5 · EL ENLACE COMPARTIDO ABRE EL DEPTO: una hoja como la de bienvenida, «Te compartieron este depto», con la tarjeta grande, el
//       botón de analizar o de registrarse y «Ver el mapa»; si ya no está, la misma hoja lo dice con los parecidos.
//   6 · LA VISTA SATELITAL: «Mapa | Satélite» junto al zoom, con el estilo de la casa; en satélite, la foto híbrida sin el estilo de
//       Franco, igual en los dos temas; la elección se recuerda en el navegador.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, 0 lecturas.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/explorar-pasada-0411-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as po from "../../../src/lib/explorar/portal";
import * as cn from "../../../src/lib/explorar/capa-negociar";
import * as ie from "../../../src/lib/guia/informe-en-camino";
import * as vm from "../../../src/lib/explorar/volver-al-mapa";
import * as cm from "../../../src/lib/explorar/capa-mapa";
import { NEGOCIADO_COPY } from "../../../src/lib/precio-publicado";
import { COMPARTIR_COPY } from "../../../src/lib/explorar/compartir";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const texto = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e).replace(/\s+/g, " ").trim();
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el));
}
/** El pop-up se monta en un portal sobre `document.body`: acá se dibuja en el lugar, con un `document` de mentira. */
function dibujarPopup(el: React.ReactElement): string {
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: React.ReactNode) => hijo;
  g.document = { body: {} };
  try { return dibujar(el); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
function cargar<T>(p: string, F: (m: string) => void): T | null {
  try { return require(join(RAIZ, p)) as T; } catch (e) { F(`0 · no carga ${p}: ${(e as Error).message}`); return null; }
}
/** Una base de mentira para el cálculo por comuna: lo que devuelven sus RPC y lo que se le pide. */
function baseFalsa(rpcRes: Record<string, (p: Record<string, unknown>) => unknown>) {
  const rpcs: Array<{ nombre: string; params: Record<string, unknown> }> = [];
  const rpc = (nombre: string, params: Record<string, unknown>) => { rpcs.push({ nombre, params }); return Promise.resolve(rpcRes[nombre] ? rpcRes[nombre](params) : { data: null, error: null }); };
  return { admin: { rpc, from: () => ({}) } as never, rpcs };
}
const NADA = () => {};
const almacenDeMentira = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, mapa: m }; };
const PIN: po.PinMapa = { avisoId: "a1111111-1111-4111-8111-111111111111", comuna: "Providencia", lat: -33.4263, lng: -70.617, m2: 79, dormitorios: 2, banos: 2, tipologia: "2D2B", precioUF: 4591, veredicto: "COMPRAR", score: 84, flujo: 261383, arriendo: 865_000, condicion: "usado", alta: null };
const NEG: cn.PinNegociado = { ...PIN, avisoId: "b2222222-2222-4222-8222-222222222222", veredicto: "AJUSTA SUPUESTOS", score: 66, precioUF: 3080, neg: { d: 4.2, p: 2950, s: 71, f: -12000 } };

export async function runExplorarPasada0411Tier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER EXPLORAR-PASADA-0411 (el pop-up del recálculo y los − Ajustar con otra tasa, la baja y el precio con su porqué, el chip del pop-up, volver al mapa, la hoja del compartido, el satélite · 0 tokens) ───");
  const cli = codigo("src/app/explorar/explorar-cliente.tsx");

  // ══ §1 · RECALCULAR: EL POP-UP Y LOS − AJUSTAR ═════════════════════════════
  {
    const base = { modalidad: "ltr" as const, pie: 20, plazo: 30, tasa: null as number | null };
    const casos: Array<[typeof base, string]> = [
      [{ ...base, tasa: 5 }, "Franco está recalculando con tu tasa de 5 %"],
      [{ ...base, pie: 30, plazo: 25 }, "Franco está recalculando con pie de 30 % y 25 años"],
      [{ ...base, pie: 10, plazo: 20, tasa: 4.75 }, "Franco está recalculando con tu tasa de 4,75 %, pie de 10 % y 20 años"],
      [{ ...base, modalidad: "str" as never }, "Franco está recalculando para renta corta"],
    ];
    for (const [f, esperado] of casos) if (po.textoRecalculo(f as never) !== esperado) F(`1 · el pop-up dice «${po.textoRecalculo(f as never)}», no «${esperado}»`);
    if (po.PORTAL_COPY.avanceComunas(9, 25) !== "9 de 25 comunas") F("1 · el avance no dice «9 de 25 comunas»");
    const modRec = cargar<{ PopupRecalculo: FC<Record<string, unknown>> }>("src/app/explorar/recalculo", F);
    if (modRec) {
      const h = dibujar(createElement(modRec.PopupRecalculo, { texto: "Franco está recalculando con tu tasa de 5 %", hechas: 9, total: 25 }));
      if (!/class="wz4 wz-modal-velo[^"]*"[^>]*role="dialog"/.test(h) || !/class="wz-modal wz-modal-compacto ex-recalculo"/.test(h) || !/data-explorar="recalculo-spinner"/.test(h)
        || texto(h) !== "Franco está recalculando con tu tasa de 5 % 9 de 25 comunas" || !/role="status"[^>]*data-explorar="recalculo-avance">9 de 25 comunas</.test(h) || /<button/.test(h)) F(`1 · el pop-up del recálculo no es el centrado con spinner, texto y avance (o trae cómo cerrarlo): «${texto(h)}»`);
    }
    const css = leer("src/app/explorar/explorar.css");
    if (!/\.ex-recalculo-gira \{[^}]*animation: franco-gira/.test(css)) F("1 · el spinner del pop-up no gira");
    // ⚠ ACTA (04-nov-2026, después de la caída de la base; tier EXPLORAR-TURNOS) · el pop-up recibe además el estado de la cola.
    if (!/\{progreso && \(\s*<PopupRecalculo texto=\{textoRecalculo\(filtros\)\} hechas=\{progreso\.hechas\} total=\{progreso\.total\} estado=\{progreso\.estado\}/.test(cli)) F("1 · Explorar no muestra el pop-up mientras recalcula por comunas");
    if (!/const enCalculoAbajo = progreso == null && \(calculando \|\| total == null \|\| nAjustar == null\) \? enCalculo : null;/.test(cli) || /calculandoTasaComunas|calculandoComunas/.test(cli + codigo("src/lib/explorar/portal.ts"))) F("1 · abajo sigue la línea «Calculando con tu tasa… 9 de 25 comunas»");

    // La capa con cualquier combinación de arriendo tradicional; la de la noche, solo con la suya.
    const ltr5 = { modalidad: "ltr" as const, pie: 20, plazo: 30, tasa: 5 };
    if (!cn.capaNegociarDisponible((ltr5) as never) || !cn.capaNegociarDisponible(({ ...ltr5, pie: 10, plazo: 20, tasa: null }) as never) || cn.capaNegociarDisponible(({ ...ltr5, modalidad: "str" as never }) as never)) F("1 · con otra tasa, pie o plazo no hay − Ajustar (o hay en renta corta)");
    if (!cn.capaDeLaNoche(({ ...ltr5, tasa: null }) as never) || cn.capaDeLaNoche((ltr5) as never) || cn.capaDeLaNoche(({ ...ltr5, tasa: null, plazo: 25 }) as never)) F("1 · la capa de la noche no es la de pie 20 % o 30 % a 30 años con la tasa del motor");
    if (!cn.capaVisible(({ ...ltr5, soloComprar: false }) as never) || cn.capaVisible(({ ...ltr5, soloComprar: true }) as never)) F("1 · con tasa elegida, «Ver solo ✓ Comprar» no gobierna la capa");

    // El servidor: con la capa, los Ajustar calculan su descuento con ESA combinación; lo guardado sin descuento se recalcula.
    const srv = cargar<typeof import("../../../src/lib/explorar/portal-servidor")>("src/lib/explorar/portal-servidor", F);
    if (srv) {
      const ahora = new Date("2026-11-04T15:00:00Z");
      const at = "2026-11-04T12:00:00Z";
      const fila = (id: string, combo: unknown) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 60, dormitorios: 2, banos: 2, precio_uf: 3100, arriendo_monto: 650000, evaluado_at: "2026-11-04T03:00:00Z", combo, pub_estado: null, pub_at: null, condicion: "usado", alta: null });
      const guardados: Array<{ aviso_id?: string; avisoId?: string; combo: Record<string, Record<string, unknown>> }> = [];
      const { admin, rpcs } = baseFalsa({
        explorar_universo_liviano: (p) => ({ data: p.clave === "20-30-t5" ? [fila("A", null), fila("B", null), fila("C", null), fila("D", { v: "AJUSTA SUPUESTOS", s: 64, f: -1, at, n: { d: 3, p: 3000, s: 70, f: 2 } }), fila("E", { v: "AJUSTA SUPUESTOS", s: 65, f: -2, at })] : [], error: null }),
        explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map((id) => ({ id, comuna: "Providencia", lat: -33.43, lng: -70.61, superficie_m2: 60, dormitorios: 2, banos: 2, condicion: "usado", precio_uf: 3100 })), error: null }),
        explorar_guardar_combos: (p) => { guardados.push(...(p.filas as never[])); return { data: 1, error: null }; },
      });
      const llamadas: Array<{ id: string; pie: number; combo: Record<string, unknown> }> = [];
      const r = await srv.universoYCapaCalculados(admin, { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, {
        cfg: { uf: 39600, tasa: 4.1 }, conCapa: true,
        sondaLtr: (c) => ({ veredicto: (c as { id?: string; avisoId?: string }).avisoId === "A" || (c as { id?: string }).id === "A" ? "COMPRAR" : "AJUSTA SUPUESTOS", score: 66, flujo: -3, cuota: 1 }),
        negociarLtr: (c, pie, _cfg, _a, _t, combo) => { const id = String((c as { avisoId?: string; id?: string }).avisoId ?? (c as { id?: string }).id); llamadas.push({ id, pie, combo: combo as Record<string, unknown> }); return id === "B" || id === "E" ? { d: 4.2, p: 2970, s: 71, f: -5 } : null; },
      });
      const idsNeg = r.negociados.map((p) => p.avisoId).sort().join();
      if (r.pines.map((p) => p.avisoId).join() !== "A" || idsNeg !== "B,D,E") F(`1 · con tasa elegida, el cálculo no devuelve los ✓ Comprar y los − Ajustar que llegan: ${r.pines.map((p) => p.avisoId)} / ${idsNeg}`);
      const b = r.negociados.find((p) => p.avisoId === "B");
      if (!b || b.veredicto !== "AJUSTA SUPUESTOS" || b.neg.d !== 4.2 || b.neg.p !== 2970 || b.neg.s !== 71) F("1 · el − Ajustar calculado no trae su descuento, su precio y su puntaje negociados");
      if (llamadas.map((l) => l.id).sort().join() !== "B,C,E" || !llamadas.every((l) => l.pie === 20 && l.combo.plazo === 30 && l.combo.tasa === 5 && l.combo.alPublicado === "AJUSTA SUPUESTOS")) F(`1 · el descuento no se busca con la combinación elegida (o se busca para lo guardado con su descuento): ${JSON.stringify(llamadas)}`);
      const gC = guardados.find((g) => (g.aviso_id ?? g.avisoId) === "C");
      const comboC = gC ? (Object.values(gC.combo)[0] ?? gC.combo) as Record<string, unknown> : null;
      if (!comboC || !("n" in comboC) || comboC.n !== null) F(`1 · el Ajustar que no llega no queda guardado con su «no llega» (n: null): ${JSON.stringify(gC)}`);
      if (!rpcs.some((x) => x.nombre === "explorar_universo_liviano" && x.params.clave === "20-30-t5")) F("1 · lo calculado con tasa no usa su propia clave");
      // Sin la capa (renta corta, o sin pedirla), ningún − Ajustar.
      const sin = await srv.universoYCapaCalculados(baseFalsa({ explorar_universo_liviano: () => ({ data: [fila("B", null)], error: null }), explorar_filas_para_sonda: (p) => ({ data: (p.ids as string[]).map((id) => ({ id })), error: null }), explorar_guardar_combos: () => ({ data: 1, error: null }) }).admin,
        { comunas: ["Providencia"], modalidad: "ltr", pie: 20, plazo: 30, tasa: 5 }, ahora, undefined, { cfg: { uf: 39600, tasa: 4.1 }, sondaLtr: () => ({ veredicto: "AJUSTA SUPUESTOS", score: 60, flujo: -1, cuota: 1 }), negociarLtr: () => ({ d: 1, p: 1, s: 70, f: 1 }) });
      if (sin.negociados.length) F("1 · sin pedir la capa, el cálculo igual busca descuentos");
    }
    const ruta = codigo("src/app/api/explorar/route.ts");
    // ⚠ ACTA (04-nov-2026, después de la caída de la base; tier EXPLORAR-TURNOS) · sin `diferir`: la ruta pasa los turnos del sitio.
    if (!/const conCapa = modalidad === "ltr";\s*const turnos = new TurnosRecalculo\(almacenDeConfig\(admin\)\);\s*const \{ pines, negociados \} = await universoYCapaCalculados\(admin, \{ \.\.\.q, comunas \}, new Date\(\), cuenta, \{ conCapa, turnos, quien: user\.id \}\);\s*return NextResponse\.json\(respuestaUniverso\(pines, \{ \.\.\.q, comunas \}, cuenta, conCapa \? negociados : null\)/.test(ruta)) F("1 · GET /api/explorar no devuelve los − Ajustar de la comuna calculada");
    const rutaNeg = codigo("src/app/api/explorar/negociar/route.ts");
    if (!/if \(plazo !== PLAZO_POR_DEFECTO \|\| tasa != null \|\| !\(PIES_NEGOCIAR as readonly number\[\]\)\.includes\(pie\)\) \{/.test(rutaNeg) || !/universoYCapaCalculados\(admin, \{ modalidad: "ltr", pie, plazo, tasa, comunas \}, new Date\(\), cuenta, \{ conCapa: true, turnos, quien: user\.id \}\)/.test(rutaNeg)) F("1 · la capa de pie 20 % o 30 % a 25 años (o con tasa) no se calcula por comuna");
    // El navegador: la junta por comuna, la elige con otra combinación y la pide aparte para la noche a 25 años.
    if (!/if \(vivo\.current && negs\) setCapasCalc\(\(cs\) => agregarCapa\(cs, clave, comuna, negs\)\);/.test(cli) || (cli.match(/setCapasCalc\(\(cs\) => agregarCapa\(cs, clave, comuna, negs\)\)/g) ?? []).length !== 2) F("1 · el navegador no junta los − Ajustar que llegan por comuna");
    if (!/: capaDeLaNoche\(filtros\) \? negociados\[filtros\.pie\]\s*: capaCalculadaPara\(filtros, capasCalc\)/.test(cli)) F("1 · con otra combinación el mapa no usa la capa calculada");
    if (!/if \(capaVisible\(f\) && !capaDeLaNoche\(f\)\) void asegurarCapaCalculada\(f\);/.test(cli)) F("1 · con pie 20 % o 30 % a 25 años no se piden los − Ajustar");
    const neg = codigo("src/lib/avisos/negociar.ts");
    if (!/respuestasDeAviso\(avisoDeCandidato\(c\), piePct, combo\.tasa \?\? cfg\.tasa, c\.arriendo\.monto, \{ plazo: combo\.plazo \?\? PLAZO_NEGOCIAR, tasaMercado: cfg\.tasa \}\)/.test(neg) || !/negociar_20: veredictos\.veredicto_20 === "AJUSTA SUPUESTOS" \? negociarCandidato\(c, 20, cfg, asOf\) : null,/.test(neg)) F("1 · el descuento no usa el plazo y la tasa elegidos (o la noche dejó de usar los suyos)");
  }

  // ══ §2 · LA BAJA Y EL PRECIO MOVIDO DICEN POR QUÉ ═════════════════════════
  {
    const baja = (l: ie.LugarInforme) => { const t = ie.textoFallo("despublicado", l); return `${t.titulo} ${t.que}`; };
    const goal = "Este depto ya no está publicado. Franco lo revisó anoche y hoy el vendedor lo sacó: los que convienen se van rápido. No se usó ningún análisis. Lo quitamos del mapa; elige otro.";
    if (baja("mapa") !== goal) F(`2 · la baja en el mapa dice «${baja("mapa")}»`);
    if (baja("seleccion") !== goal.replace("del mapa", "de tu selección")) F(`2 · la baja en la selección y el dashboard dice «${baja("seleccion")}»`);
    if (!baja("lista").includes("Franco lo revisó al armar tu guía y hoy el vendedor lo sacó") || !baja("lista").endsWith("Lo quitamos de la lista; elige otro.")) F(`2 · la baja en la guía dice «${baja("lista")}»`);
    if (ie.lugarDeDesde("explorar") !== "mapa" || ie.lugarDeDesde("dashboard") !== "seleccion" || ie.lugarDeDesde("seleccion") !== "seleccion" || ie.lugarDeDesde("semanal") !== "seleccion" || ie.lugarDeDesde("pago") !== "seleccion" || ie.lugarDeDesde("guia") !== "lista") F("2 · el lugar de la baja no sale de dónde se analizó");
    const pop = codigo("src/components/guia/InformeEnCamino.tsx");
    if (!/lugar=\{lugarDeDesde\(desdeDeRuta\(window\.location\.pathname\)\)\}/.test(pop) || !/\{textoFallo\(paso\.motivo, lugar\)\.que\}/.test(pop)) F("2 · el pop-up no dice de dónde se saca el depto (el mapa o la selección)");
    const modPop = cargar<{ PopupInforme: FC<Record<string, unknown>> }>("src/components/guia/InformeEnCamino", F);
    if (modPop) {
      const paso = ie.informeFallo(ie.informeGenerando("Providencia · 2D2B · 80 m² · UF 4.991", null, 0), "despublicado");
      const h = texto(dibujar(createElement(modPop.PopupInforme, { paso, ahora: 1000, lugar: "seleccion", alCerrar: NADA })));
      if (!h.includes(goal.replace("del mapa", "de tu selección"))) F(`2 · el pop-up dibujado no dice la baja con su porqué: «${h}»`);
    }
    const movido = "Desde anoche entraron avisos nuevos en la zona y el precio al que conviene cambió: hoy llega a Comprar con UF 2.085 (−1,0 %), no con UF 2.089. No se usó ningún análisis.";
    if (NEGOCIADO_COPY.movido(2085, 1.0, 2089) !== movido) F(`2 · el precio movido dice «${NEGOCIADO_COPY.movido(2085, 1.0, 2089)}»`);
    if (!NEGOCIADO_COPY.noLlega(10).startsWith("Desde anoche entraron avisos nuevos en la zona y el precio al que conviene cambió:")) F("2 · el que ya no llega no dice el porqué");
  }

  // ══ §3 · EL CHIP EN EL POP-UP DE «ANALIZAR ESTE» ═══════════════════════════
  {
    const modAv = cargar<{ AvisoAntesDeAnalizar: FC<Record<string, unknown>> }>("src/components/guia/AvisoAntesDeAnalizar", F);
    if (modAv) {
      const h = dibujarPopup(createElement(modAv.AvisoAntesDeAnalizar, {
        depto: { comuna: "Providencia", tipologia: "2D2B", m2: 79, precioUF: 4591, condicion: "usado" }, modalidad: "ltr", combinacion: { piePct: 20, plazoAnios: 30, tasaPct: null },
        finanzas: { tasa: 4.07, uf: 39000, arriendo: 865000 }, uso: { tipo: "con", n: 2, noVencen: false }, rutaCompra: "/x", alAnalizar() {}, alCancelar() {}, avisoId: PIN.avisoId,
        cambio: { recalcular: async () => null, base: { veredicto: "COMPRAR", score: 84, flujo: 261383 } },
      }));
      const linea = /<span class="av-linea" data-aviso="veredicto"[^>]*>([\s\S]*?)<\/span>\s*<span class="av-incluye/.exec(h)?.[1] ?? "";
      if (!/<span class="chip-v c" data-veredicto="COMPRAR" data-puntaje="84">✓ Comprar · 84<\/span>/.test(linea.replace(/<!-- -->/g, "")) || texto(linea) !== "✓ Comprar · 84 al precio publicado · flujo +$261.383 te queda") F(`3 · el pop-up no dice el veredicto con el chip de la casa: «${texto(linea)}»`);
      if (!/aria-label="Comprar 84 al precio publicado · flujo \+\$261\.383 te queda"/.test(h)) F("3 · la línea del chip no tiene su nombre accesible");
      if (!/<style[^>]*>[\s\S]*\.chip-v\{/.test(h)) F("3 · el CSS del chip no viaja con el pop-up (en la selección o el dashboard se vería sin color)");
    }
  }

  // ══ §4 · VOLVER AL MAPA DESDE EL INFORME ═══════════════════════════════════
  {
    if (vm.hrefDelMapa("/explorar", "?c=Providencia&ta=5&analizar=1&desde=correo&a=viejo", "X1") !== "/explorar?c=Providencia&ta=5&a=X1") F(`4 · el enlace de vuelta no es el mismo mapa con el pin: ${vm.hrefDelMapa("/explorar", "?c=Providencia&ta=5&analizar=1&desde=correo&a=viejo", "X1")}`);
    const alm = almacenDeMentira();
    const INF = "c3333333-3333-4333-8333-333333333333", OTRO = "d4444444-4444-4444-8444-444444444444";
    vm.anotarVolver(alm, { informeId: INF, avisoId: "aviso-1", href: "/explorar?c=Providencia&a=aviso-1" });
    vm.anotarVolver(alm, { informeId: "no-es-uuid", avisoId: "x", href: "/explorar" });
    vm.anotarVolver(alm, { informeId: OTRO, avisoId: "aviso-2", href: "/dashboard" });
    if (vm.tomarNotaDelInforme(alm, OTRO) !== null || vm.tomarNotaDelInforme(alm, "c5555555-5555-4555-8555-555555555555") !== null || vm.tomarNotaDelInforme(alm, INF)?.href !== "/explorar?c=Providencia&a=aviso-1") F("4 · la nota de la vuelta no es la de ese informe (o acepta una que no vuelve a Explorar)");
    // ⚠ ACTA (04-nov-2026, QA del preview) · la nota se gasta al mostrarse: el mismo informe abierto después desde el dashboard no ofrecía
    // el mapa… pero lo ofrecía. Los analizados de la pestaña quedan.
    if (vm.tomarNotaDelInforme(alm, INF) !== null) F("4 · la nota de la vuelta no se gasta: el informe abierto después desde otro lado igual ofrece el mapa");
    const an = vm.analizadosDeLaPestana(alm);
    if (Object.keys(an).join() !== "aviso-1" || an["aviso-1"] !== INF) F(`4 · los analizados de la pestaña no son los anotados (o se fueron con la nota): ${JSON.stringify(an)}`);
    for (let i = 0; i < 25; i++) vm.anotarVolver(alm, { informeId: `e${String(i).padStart(7, "0")}-1111-4111-8111-111111111111`, avisoId: `v${i}`, href: "/explorar" });
    if (Object.keys(vm.analizadosDeLaPestana(alm)).length !== 20) F("4 · las notas de la pestaña crecen sin tope");
    // Explorar: antes de ir al informe, su entrada del historial queda con el pin y se anota; al volver, lo lee.
    if (!/const href = hrefDelMapa\(window\.location\.pathname, window\.location\.search, avisoId\);\s*window\.history\.replaceState\(window\.history\.state, "", href\);\s*anotarVolver\(window\.sessionStorage, \{ informeId, avisoId, href \}\);/.test(cli)) F("4 · antes de ir al informe la entrada del historial no queda con el pin (o no se anota)");
    const iOk = cli.indexOf("if (res.ok && d.id) {");
    const exito = iOk < 0 ? "" : cli.slice(iOk, cli.indexOf("return;", iOk));
    if (!/recordarVuelta\(it\.avisoId, d\.id\);[\s\S]*setInforme\(listo\);/.test(exito)) F("4 · al llegar el informe no se anota la vuelta antes de abrirlo");
    if (!/alVerInforme=\{recordarVuelta\}/.test(cli) || !/onClick=\{\(\) => alVerInforme\?\.\(p\.avisoId, informe\)\}/.test(codigo("src/app/explorar/tarjeta-pin.tsx"))) F("4 · «Ver informe» de la tarjeta no anota la vuelta");
    if (!/const deLaPestana = analizadosDeLaPestana\(almacen\);\s*if \(Object\.keys\(deLaPestana\)\.length\) setAnalizadosAqui\(\(m\) => \(\{ \.\.\.deLaPestana, \.\.\.m \}\)\);/.test(cli) || !/const a = new URLSearchParams\(window\.location\.search\)\.get\("a"\);\s*if \(a\) \{ setAbrir\(a\); setSel\(a\); setFocoUsado\(false\); \}/.test(cli)) F("4 · al volver, Explorar no marca el analizado ni abre el pin de la barra");
    if (!/const id = compartido\?\.avisoId \?\? abrir;\s*if \(focoUsado \|\| !id \|\| !universo\) return null;/.test(cli) || !/const \[focoUsado, setFocoUsado\] = useState\(!compartido && !abrirProp\);/.test(cli)) F("4 · al volver, el mapa no se centra en el pin");
    if (!/if \(todos\.some\(\(p\) => p\.avisoId === abrir\)\) setCarrusel\(cercanos\(todos, abrir\)\.map\(\(p\) => p\.avisoId\)\);/.test(cli)) F("4 · el pin abierto de un − Ajustar no abre su tarjeta");
    // Los informes: arriba, «← Volver al mapa» con la nota de ese informe.
    for (const f of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) if (!/<VolverAlMapa analysisId=\{analysisId\} \/>/.test(codigo(f))) F(`4 · ${f}: el informe no ofrece «← Volver al mapa»`);
    const vol = codigo("src/components/explorar/VolverAlMapa.tsx");
    if (!/const nota = tomarNotaDelInforme\(almacen, analysisId\);\s*if \(nota\) setHref\(nota\.href\);/.test(vol) || !/if \(!href\) return null;/.test(vol) || !/<span aria-hidden="true">←<\/span> \{VOLVER_AL_MAPA\}/.test(vol) || vm.VOLVER_AL_MAPA !== "Volver al mapa") F("4 · «← Volver al mapa» no sale de la nota del informe (o aparece sin ella)");
  }

  // ══ §5 · EL ENLACE COMPARTIDO ABRE EL DEPTO ═════════════════════════════════
  {
    const modHoja = cargar<{ HojaCompartida: FC<Record<string, unknown>> }>("src/app/explorar/compartido-hoja", F);
    if (COMPARTIR_COPY.hoja.titulo !== "Te compartieron este depto" || COMPARTIR_COPY.hoja.verMapa !== "Ver el mapa") F("5 · la hoja no se titula «Te compartieron este depto» (o no ofrece «Ver el mapa»)");
    if (modHoja) {
      const hoja = (caso: unknown, extra: Record<string, unknown> = {}) => dibujar(createElement(modHoja.HojaCompartida, { caso, sinCuenta: false, alAnalizar: NADA, alAbrirParecido: NADA, alCerrar: NADA, ...extra })).replace(/<!-- -->/g, "");
      const con = hoja({ tipo: "pin", pin: PIN });
      if (!/class="ex-bienvenida-velo ex-comp-velo"/.test(con) || !/role="dialog"/.test(con) || !/data-explorar="compartido-titulo">Te compartieron este depto</.test(con)) F("5 · la hoja no es la de bienvenida con «Te compartieron este depto»");
      const tarjeta = /data-explorar="compartido-tarjeta"[\s\S]*?<\/article>/.exec(con)?.[0] ?? "";
      if (!/data-explorar="imagen"/.test(tarjeta) || !texto(tarjeta).includes("Providencia · 2D2B · 79 m² · Usado") || !texto(tarjeta).includes("UF 4.591") || !/class="chip-v c"[^>]*>✓ Comprar · 84</.test(tarjeta) || !texto(tarjeta).includes("+$261.383")) F(`5 · la tarjeta grande no trae la foto, la línea, el precio, el chip y el flujo: «${texto(tarjeta)}»`);
      if (!/data-explorar="compartido-analizar">Analizar este</.test(con) || !/data-explorar="compartido-ver-mapa">Ver el mapa</.test(con)) F("5 · con cuenta, la hoja no ofrece «Analizar este» y «Ver el mapa»");
      const sin = hoja({ tipo: "pin", pin: PIN }, { sinCuenta: true });
      if (!/data-explorar="compartido-registrate"/.test(sin) || /\+\$261\.383/.test(sin) || !/data-explorar="borroso"/.test(sin)) F("5 · sin cuenta, la hoja no pide registrarse (o muestra el flujo)");
      const n = hoja({ tipo: "pin", pin: NEG });
      if (!/data-explorar="veredicto-publicado"/.test(n) || !/data-explorar="veredicto-negociado"/.test(n) || !/data-explorar="compartido-analizar">Analizar a UF 2\.950</.test(n)) F("5 · el negociado no muestra los dos veredictos y «Analizar a UF 2.950»");
      const ya = hoja({ tipo: "pin", pin: PIN }, { informe: "c3333333-3333-4333-8333-333333333333" });
      if (!/href="\/analisis\/c3333333-3333-4333-8333-333333333333"[^>]*>Ya lo analizaste · Ver informe</.test(ya.replace(/ data-explorar="[^"]*"/g, "").replace(/ class="[^"]*"/g, "")) && !/>Ya lo analizaste · Ver informe</.test(ya)) F("5 · el ya analizado no ofrece «Ya lo analizaste · Ver informe»");
      const caido = hoja({ tipo: "caido", estado: "despublicado", depto: { avisoId: "x", comuna: "Providencia", tipologia: "2D2B", m2: 79, precioUF: 4591, lat: null, lng: null, condicion: "usado" }, parecidos: [PIN] });
      if (!/data-explorar="compartido-titulo">Te compartieron este depto</.test(caido) || !/data-explorar="caido-titulo">Este depto ya no está publicado\.</.test(caido) || (caido.match(/data-explorar="parecido"/g) ?? []).length !== 1 || /compartido-analizar|compartido-registrate/.test(caido)) F("5 · si ya no está, la hoja no lo dice con los parecidos (o igual ofrece analizarlo)");
    }
    // Explorar: el enlace abre la hoja (sin la tarjeta del carrusel); la bienvenida no va encima; la tarjeta suelta de «ya no está» se retiró.
    if (!/setSel\(ap\.avisoId\);\s*setHojaComp\(\{ tipo: "pin", avisoId: ap\.avisoId \}\);\s*return;/.test(cli) || !/setHojaComp\(\{ tipo: "caido", estado: ap\.estado, depto: ap\.depto, parecidos: ap\.parecidos \}\);/.test(cli)) F("5 · el enlace compartido no abre la hoja");
    if (/setCarrusel\(cercanos\(todos, ap\.avisoId\)/.test(cli) || /<CompartidoCaido\b/.test(cli)) F("5 · el enlace compartido sigue abriendo la tarjeta del carrusel (o la tarjeta suelta de «ya no está»)");
    if (!/\{casoComp && \(\s*<HojaCompartida\s+caso=\{casoComp\}/.test(cli) || !/if \(!sinCuenta \|\| inicial\.n == null \|\| compartido\) return;/.test(cli)) F("5 · la hoja no se monta (o la bienvenida va encima)");
  }

  // ══ §6 · LA VISTA SATELITAL ═════════════════════════════════════════════════
  {
    const alm = almacenDeMentira();
    if (cm.leerCapaMapa(alm) !== "mapa" || cm.leerCapaMapa(null) !== "mapa") F("6 · sin nada guardado, la vista no es el mapa");
    cm.guardarCapaMapa(alm, "satelite");
    if (cm.leerCapaMapa(alm) !== "satelite" || alm.mapa.get(cm.CLAVE_CAPA_MAPA) !== "satelite") F("6 · la vista elegida no se recuerda");
    alm.setItem(cm.CLAVE_CAPA_MAPA, "otra");
    if (cm.leerCapaMapa(alm) !== "mapa") F("6 · un valor raro no vuelve al mapa");
    const sc = cm.opcionesDeCapa("satelite", true), so = cm.opcionesDeCapa("satelite", false);
    if (sc.mapTypeId !== "hybrid" || sc.styles !== null || JSON.stringify(sc) !== JSON.stringify(so)) F("6 · el satélite no es la foto híbrida sin estilo, igual en los dos temas");
    const mc = cm.opcionesDeCapa("mapa", true), mo = cm.opcionesDeCapa("mapa", false);
    if (mc.mapTypeId !== "roadmap" || !Array.isArray(mc.styles) || JSON.stringify(mc.styles) === JSON.stringify(mo.styles)) F("6 · el mapa perdió el estilo de Franco de cada tema");
    if (cm.CAPA_MAPA_COPY.mapa !== "Mapa" || cm.CAPA_MAPA_COPY.satelite !== "Satélite") F("6 · el botón no dice «Mapa | Satélite»");
    const modMapa = cargar<{ ConmutadorCapa: FC<Record<string, unknown>> }>("src/app/explorar/mapa-explorar", F);
    if (modMapa) {
      const h = dibujar(createElement(modMapa.ConmutadorCapa, { capa: "satelite", alCambiar: NADA }));
      if (!/role="radiogroup"/.test(h) || !/aria-checked="false"[^>]*data-capa="mapa">Mapa</.test(h) || !/aria-checked="true"[^>]*data-capa="satelite">Satélite</.test(h)) F(`6 · el botón de dos posiciones no marca la elegida: ${h}`);
    }
    const mapa = codigo("src/app/explorar/mapa-explorar.tsx");
    if (!/map\.controls\[g\.maps\.ControlPosition\.RIGHT_CENTER\]\.push\(ctl\);/.test(mapa) || !/zoomControlOptions: \{ position: g\.maps\.ControlPosition\.RIGHT_CENTER \}/.test(mapa)) F("6 · «Mapa | Satélite» no va junto al zoom");
    if (!/useEffect\(\(\) => \{ const map = mapRef\.current; if \(map\) \{ map\.setOptions\(opcionesDe\(capa\)\); dibujarRef\.current\(\); \} \}, \[capa\]\);/.test(mapa) || !/map\.setOptions\(opcionesDe\(capaRef\.current\)\);/.test(mapa) || /opcionesDeTema/.test(mapa)) F("6 · cambiar la vista o el tema no respeta la vista elegida (o vuelve a cargar el mapa)");
    if (!/useEffect\(\(\) => \{ const c = leerCapaMapa\(almacenLocal\(\)\); if \(c !== "mapa"\) setCapa\(c\); \}, \[\]\);/.test(mapa) || !/guardarCapaMapa\(almacenLocal\(\), c\)/.test(mapa)) F("6 · la vista no se lee ni se guarda en el navegador");
    const css = leer("src/app/explorar/explorar.css");
    if (!/\.ex-capa-op\[aria-checked="true"\] \{ background: var\(--franco-text\); color: var\(--franco-card\); \}/.test(css)) F("6 · la vista elegida no va en tinta, como las opciones de la casa");
  }

  for (const m of fallas) console.log(`  ✗ ${m}`);
  console.log(fallas.length === 0 ? "  ✓ EXPLORAR-PASADA-0411: todo en orden" : `  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runExplorarPasada0411Tier().then((r) => process.exit(r.hard > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTA DE MUTACIONES (04-nov-2026, meta-runner `mutar-gen.cjs` con `mutaciones-0411.cjs` del scratchpad de la sesión 087cc148, que
// restaura byte a byte con hash y exige que el texto mutado aparezca UNA vez): 68 de 68 en ROJO, cada una por su invariante.
//   En este tier, 51: §1 P1-P16 (el pop-up sin la tasa, sin spinner, con X o sin montarse; la línea de abajo de vuelta; la capa solo
//      de la noche; el servidor sin descuentos, con la combinación de la noche, reusando lo guardado sin descuento o sin guardar el
//      «no llega»; las dos rutas sin la capa; el navegador sin juntarla, con la de la noche o sin pedirla a 25 años; el descuento con
//      la tasa del motor); §2 P17-P21 (la baja con otro texto, siempre «del mapa», el pop-up sin el lugar, la guía como selección, el
//      precio movido sin porqué); §3 P22-P24 (el veredicto en texto, sin el CSS del chip, sin nombre accesible); §4 P25-P35 (la vuelta
//      que analiza de nuevo, la nota que acepta otro destino, sin tope, sin el pin en el historial, sin anotar al llegar el informe
//      ni en «Ver informe», sin abrir el pin de la barra, sin centrarlo, solo los ✓ Comprar, el informe STR sin el enlace, el enlace
//      sin la nota); §5 P36-P42 (otro título, la tarjeta sin el chip, sin cuenta igual analiza, el que no está no lo dice, el
//      carrusel, la hoja sin montarse, la bienvenida encima); §6 P43-P51 (no se recuerda, estilo en oscuro, satélite sin nombres, el
//      botón lejos del zoom, la vista o el tema que no cambian el mapa, sin guardar, sin marcar la elegida, la elegida en rojo).
//   Predicados reescritos en otros tiers, con su acta, 17: EXPLORAR §10 (dos), TASA-EDITABLE §2, EXPLORAR-RECORRIDO §9 (dos),
//      PUERTA-B-MOCKUPS §3, EXPLORAR-NEGOCIAR §1 (la excepción del precio movido y el chip del pop-up), §6 y §9, EXPLORAR-PASADA §3
//      (dos; R10 es el error que cazó este mismo tier: la noche habría servido su capa de 30 años a 25), COMPARTIR-DEPTO §1 (dos), §5
//      y §7, INFORME-EN-CAMINO §4 y §7.
//   Tras el QA del preview (04-nov-2026): la nota de «Volver al mapa» se gasta al mostrarse —el mismo informe abierto después desde el
//      dashboard seguía ofreciendo el mapa— y los analizados de la pestaña quedan aparte. 3 de 3 en ROJO (`mutaciones-0411b.cjs`):
//      P52 la nota no se gasta, P53 los analizados se van con ella, P54 el informe la lee sin gastarla.
// ─────────────────────────────────────────────────────────────────────────────
