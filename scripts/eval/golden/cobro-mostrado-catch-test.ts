// ============================================================================
// GOLDEN · COBRO-MOSTRADO (23-nov-2026) — catch-test
// ============================================================================
//   No cobrar cuando el informe contradice lo que mostramos (decisión de Fabrizio tras el caso e828d352: el semanal mostró
//   Comprar 80 con una evaluación de la noche desactualizada, la persona pagó y el informe dio Ajustar 63).
//   1 · LA REGLA (cobro-mostrado.ts): distinto = otro veredicto, en cualquier dirección; solo el puntaje no cuenta; lo mostrado
//       cuenta 14 días; con `aceptoCambio` se sigue; el respaldo devuelve si no hubo aviso y el cobro gastó algo.
//   2 · EL ORQUESTADOR (analizar-una-vez.ts, con piezas falsas que cuentan los cobros):
//       · el aviso: con otro veredicto y sin aceptar, NO se cobra, no se crea y la fila se suelta (estado «cambio»);
//       · la vuelta del pago (punto 7): el crédito comprado no se gasta si cambió;
//       · aceptado, se cobra una vez y no se devuelve;
//       · EL RESPALDO: un informe con otro veredicto que lo mostrado, sin aviso, NO puede quedar cobrado (devolverPorCambio);
//       · Invierte / ilimitado (devolución «nada»): no hay qué devolver.
//   3 · LA RUTA: lo mostrado se reconstruye en el servidor (el token del correo o la sonda de la pantalla), nunca del cuerpo
//       del pedido; el veredicto de hoy sale del MISMO cuerpo y la MISMA mediana que crea el informe; «cambio» responde 412 antes
//       de cualquier cobro; el respaldo deja el lote `devolucion_cobro` y la fila del admin.
//   4 · EL AVISO APARECE: el pop-up y la vuelta del pago lo dibujan (con «Analizarlo igual» / «Usarlo en este depto»), y las cinco
//       superficies que llaman a «Analizar este» lo manejan y mandan `aceptoCambio`.
//   5 · EL INFORME LO DICE: la portada lleva «No te cobramos este análisis…» o qué cambió.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. 0 tokens, 0 lecturas.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/cobro-mostrado-catch-test.ts
// ============================================================================
import "./als-de-next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as cm from "../../../src/lib/guia/cobro-mostrado";
import * as ie from "../../../src/lib/guia/informe-en-camino";
import { analizarUnaVez, type PiezasAnalizar, type Reclamo } from "../../../src/lib/guia/analizar-una-vez";
import type { Devolucion } from "../../../src/lib/access-devolucion";

(globalThis as { React?: unknown }).React = React;
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, (e) => ENTIDADES[e] ?? e).replace(/\s+/g, " ").trim();
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const sangria = i - (src.lastIndexOf("\n", i) + 1);
  const resto = src.slice(i + firma.length);
  const j = resto.search(new RegExp(`\\n {0,${sangria}}(?:export |async function |function |const [A-Za-z]+ = |let [A-Za-z]+ = )`));
  return src.slice(i, j < 0 ? undefined : i + firma.length + j);
}
function dibujar(el: React.ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el)).replace(/<!-- -->/g, "");
}

const AHORA = new Date("2026-11-23T19:00:00Z");
const M = (veredicto: string, diasAtras = 0, fuente: cm.Mostrado["fuente"] = "correo"): cm.Mostrado => ({ veredicto, score: 80, at: new Date(AHORA.getTime() - diasAtras * 86_400_000).toISOString(), fuente });
const H = (veredicto: string | null, score: number | null = 63): cm.VeredictoHoy => ({ veredicto, score });

/** Piezas falsas: cuentan cobros, creaciones, devoluciones por cambio y si la fila quedó tomada. */
function banco(o: { veredictoInforme: string; devolucion?: Devolucion; cotejo?: PiezasAnalizar["cotejo"]; sinCredito?: boolean; conRespaldo?: boolean }) {
  const c = { cobros: 0, creados: 0, devPorCambio: 0, soltadas: 0, marca: null as cm.MarcaCambio | null, fila: false };
  const piezas: PiezasAnalizar = {
    async reclamar(): Promise<Reclamo> { c.fila = true; return { nueva: true }; },
    async retomar() { return false; },
    async cobrar() { if (o.sinCredito) return { ok: false, status: 402, error: "sin-creditos" }; c.cobros++; return { ok: true, mode: "paid", devolucion: o.devolucion ?? { tipo: "lote", loteId: "L1" } }; },
    async devolver() {},
    async marcarCobrado() {},
    async crear() { c.creados++; return { id: "inf-1", veredicto: o.veredictoInforme }; },
    async marcarCreado() {},
    async soltar() { c.soltadas++; c.fila = false; },
    cotejo: o.cotejo ?? null,
    ...(o.conRespaldo === false ? {} : { async devolverPorCambio(_id: string, _d: Devolucion, marca: cm.MarcaCambio) { c.devPorCambio++; c.marca = marca; return true; } }),
  };
  return { piezas, c };
}

export async function runCobroMostradoTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER COBRO-MOSTRADO (no se cobra cuando el informe contradice lo mostrado: el aviso antes de cobrar, el respaldo que devuelve, lo mostrado desde el servidor · 0 tokens) ───");

  // ══ §1 · LA REGLA ═══════════════════════════════════════════════════════════
  {
    if (cm.VENTANA_MOSTRADO_DIAS !== 14) F("1 · la ventana de lo mostrado no es de 14 días");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR"), hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: false, ahora: AHORA }) !== "avisar") F("1 · Comprar mostrado y Ajustar hoy no avisa antes de cobrar");
    if (cm.decidirAntesDeCobrar({ mostrado: M("BUSCAR OTRA"), hoy: H("COMPRAR"), aceptoCambio: false, ahora: AHORA }) !== "avisar") F("1 · el cambio hacia arriba (Buscar otro → Comprar) no avisa: distinto es en cualquier dirección");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR"), hoy: H("COMPRAR", 71), aceptoCambio: false, ahora: AHORA }) !== "seguir") F("1 · solo otro puntaje, con el mismo veredicto, frena el cobro");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR"), hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: true, ahora: AHORA }) !== "seguir") F("1 · con «Analizarlo igual», sigue avisando en vez de cobrar");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR", 14.5), hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: false, ahora: AHORA }) !== "seguir") F("1 · lo mostrado hace más de 14 días todavía frena el cobro");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR", 13.9), hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: false, ahora: AHORA }) !== "avisar") F("1 · lo mostrado dentro de los 14 días no cuenta");
    if (cm.decidirAntesDeCobrar({ mostrado: M("COMPRAR"), hoy: H(null), aceptoCambio: false, ahora: AHORA }) !== "seguir") F("1 · sin veredicto de hoy, inventa un cambio");
    if (cm.decidirAntesDeCobrar({ mostrado: null, hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: false, ahora: AHORA }) !== "seguir") F("1 · sin nada mostrado, frena el cobro");
    if (!cm.avisadoDelCambio({ mostrado: M("COMPRAR"), hoy: H("AJUSTA SUPUESTOS"), aceptoCambio: true, ahora: AHORA }) || cm.avisadoDelCambio({ mostrado: M("COMPRAR"), hoy: H("COMPRAR"), aceptoCambio: true, ahora: AHORA })) F("1 · «avisado» no es exactamente: aceptó y el veredicto cambió");
    const tras = (informe: string, avisado: boolean, cobroGasto: boolean, mostrado = M("COMPRAR")) => cm.decidirTrasCrear({ mostrado, informe, avisado, cobroGasto, ahora: AHORA });
    if (tras("AJUSTA SUPUESTOS", false, true) !== "devolver") F("1 · el respaldo no devuelve un informe distinto sin aviso");
    if (tras("AJUSTA SUPUESTOS", true, true) !== "cobrado") F("1 · el respaldo devuelve aunque la persona fue avisada");
    if (tras("COMPRAR", false, true) !== "cobrado") F("1 · el respaldo devuelve un informe con el mismo veredicto");
    if (tras("AJUSTA SUPUESTOS", false, false) !== "nada") F("1 · el respaldo «devuelve» un cobro que no gastó nada (Invierte, ilimitado)");
    if (tras("AJUSTA SUPUESTOS", false, true, M("COMPRAR", 20)) !== "cobrado") F("1 · el respaldo devuelve por algo mostrado hace más de 14 días");
    if (cm.COBRO_MOSTRADO_COPY.cambio("AJUSTA SUPUESTOS") !== "Este depto cambió desde que te lo mostramos: ahora sale Ajustar. ¿Quieres analizarlo igual?") F(`1 · el aviso no dice el texto de Fabrizio: «${cm.COBRO_MOSTRADO_COPY.cambio("AJUSTA SUPUESTOS")}»`);
    if (cm.COBRO_MOSTRADO_COPY.devuelto !== "No te cobramos este análisis: salió distinto a lo que te mostramos.") F("1 · la línea del respaldo no dice el texto de Fabrizio");
  }

  // ══ §2 · EL ORQUESTADOR ═════════════════════════════════════════════════════
  {
    const cot = (mostrado: string, hoy: string, aceptoCambio = false) => ({ mostrado: M(mostrado, 0.5), hoy: H(hoy), aceptoCambio });
    // El aviso: sin cobrar, sin crear, fila suelta.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", cotejo: cot("COMPRAR", "AJUSTA SUPUESTOS") });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "cambio" || c.cobros !== 0 || c.creados !== 0 || c.fila) F(`2 · con otro veredicto y sin aviso aceptado, igual cobra o crea (${r.estado}, ${c.cobros} cobros, ${c.creados} creados, fila ${c.fila ? "tomada" : "suelta"})`);
      if (r.estado === "cambio" && r.hoy.veredicto !== "AJUSTA SUPUESTOS") F("2 · el aviso no lleva el veredicto de hoy");
    }
    // Punto 7 — la vuelta del pago: el crédito recién comprado no se gasta si cambió.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", cotejo: cot("COMPRAR", "AJUSTA SUPUESTOS") });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "cambio" || c.cobros !== 0) F("2 · punto 7: con el pago hecho y el veredicto cambiado, el crédito comprado se gasta igual");
    }
    // Sin crédito y con cambio: el aviso va ANTES de mandar a pagar.
    {
      const { piezas } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", cotejo: cot("COMPRAR", "AJUSTA SUPUESTOS"), sinCredito: true });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "cambio") F(`2 · sin crédito y con el veredicto cambiado, la manda a pagar antes de avisar (${r.estado})`);
    }
    // Aceptado: cobra una vez, crea, no devuelve.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", cotejo: cot("COMPRAR", "AJUSTA SUPUESTOS", true) });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "creado" || c.cobros !== 1 || c.devPorCambio !== 0) F(`2 · tras «Analizarlo igual» no cobra normal o devuelve igual (${r.estado}, ${c.cobros} cobros, ${c.devPorCambio} devoluciones)`);
    }
    // EL RESPALDO — un análisis con veredicto distinto que igual gasta el crédito: hoy dio igual que lo mostrado (pasó el aviso), pero el
    // informe salió distinto. No puede quedar cobrado.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", cotejo: cot("COMPRAR", "COMPRAR") });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "creado" || c.devPorCambio !== 1 || r.devuelto !== true) F(`2 · un análisis con veredicto distinto al mostrado, sin aviso, queda cobrado (${c.devPorCambio} devoluciones, devuelto=${r.estado === "creado" ? r.devuelto : "—"})`);
      if (c.marca?.mostrado.veredicto !== "COMPRAR" || c.marca?.hoy.veredicto !== "AJUSTA SUPUESTOS") F("2 · la marca del respaldo no guarda lo mostrado y lo que salió");
    }
    // Mismo veredicto, otro puntaje: cobra normal.
    {
      const { piezas, c } = banco({ veredictoInforme: "COMPRAR", cotejo: { mostrado: M("COMPRAR"), hoy: H("COMPRAR", 71), aceptoCambio: false } });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "creado" || c.cobros !== 1 || c.devPorCambio !== 0) F("2 · solo otro puntaje frena o devuelve el cobro");
    }
    // Invierte / ilimitado: nada que devolver.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS", devolucion: { tipo: "nada" }, cotejo: cot("COMPRAR", "COMPRAR") });
      await analizarUnaVez(piezas);
      if (c.devPorCambio !== 0) F("2 · «devuelve» un cobro que no gastó nada");
    }
    // Sin cotejo (renta corta, precio negociado): nada cambia.
    {
      const { piezas, c } = banco({ veredictoInforme: "AJUSTA SUPUESTOS" });
      const r = await analizarUnaVez(piezas);
      if (r.estado !== "creado" || c.cobros !== 1) F("2 · sin cotejo, el orquestador ya no cobra y crea como antes");
    }
    // El orden en el código: el aviso va antes de `cobrar`, y el respaldo después de `marcarCreado`.
    const orq = codigo("src/lib/guia/analizar-una-vez.ts");
    const una = cuerpo(orq, "export async function analizarUnaVez(");
    const iAviso = una.indexOf('decidirAntesDeCobrar(p.cotejo) === "avisar"'), iCobrar = una.indexOf("await p.cobrar()"), iCreado = una.indexOf("await p.marcarCreado(id)"), iResp = una.indexOf("p.devolverPorCambio(");
    if (iAviso < 0 || iCobrar < 0 || iAviso > iCobrar) F("2 · en el código, el aviso no va antes del cobro");
    if (iResp < 0 || iCreado < 0 || iResp < iCreado) F("2 · en el código, el respaldo no va después de crear el informe");
  }

  // ══ §3 · LA RUTA ════════════════════════════════════════════════════════════
  {
    const ruta = codigo("src/app/api/lo-que-sigue/guia/analizar/route.ts");
    // Lo mostrado, nunca del pedido: ningún veredicto ni puntaje leído del cuerpo.
    // Positivo (un guard solo negativo se evade con otra grafía, p. ej. `(b as …).mostrado`): lo mostrado es EXACTAMENTE el correo o
    // la sonda, sin nada antes; y negativo, ninguna lectura de esos campos sobre el cuerpo, con cualquier forma.
    if (!/const mostrado = desdeCorreo\s*\?\s*mostradoCorreo\s*:\s*mostradoDePantalla\(/.test(ruta) || /\bb\b[^;\n]{0,40}\.(?:mostrado|veredicto|score|vista|esperado)\b/.test(ruta)) F("3 · la ruta lee lo mostrado desde el cuerpo del pedido (el navegador)");
    if (!/mostradoDelCorreo\(admin, b\.semanal!, user\.id, b\.avisoId\)/.test(ruta) || !/mostradoDePantalla\(aviso, \{ piePct: combinacion\.piePct, plazoAnios: combinacion\.plazoAnios, tasa: tasaElegida \?\? \(desde === "guia" \? origen\.tasa : null\) \}, \{ uf: ufValue, tasa: cfg\.tasa \}\)/.test(ruta)) F("3 · la ruta no reconstruye lo mostrado desde el correo o la sonda de la pantalla con la misma combinación y tasa");
    if (!/const desdeCorreo = typeof b\.semanal === "string" && !elegida && negociadoUF == null;/.test(ruta)) F("3 · el correo cuenta como lo mostrado aunque la persona eligió otra combinación (o con el precio negociado)");
    // El veredicto de hoy: del mismo cuerpo y la misma mediana que usa `crear`.
    if (!/medianaDeHoy = medianaDeHoy \?\? await prefetchMedianaComunaVenta\(admin, body, ufValue\);\s*const r0 = runAnalysis\(body, ufValue, medianaDeHoy\);/.test(ruta) || !/const medianaComuna = medianaDeHoy \?\? await prefetchMedianaComunaVenta\(admin, body, ufValue\);\s*const result = runAnalysis\(body, ufValue, medianaComuna\);/.test(ruta)) F("3 · el veredicto de hoy no sale del mismo cuerpo y la misma mediana que el informe");
    if (!/cotejo = \{ mostrado, hoy, aceptoCambio: b\.aceptoCambio === true \|\| modoInvierte \};/.test(ruta)) F("3 · «aceptoCambio» no viene de la persona (o Invierte, que prepara en segundo plano, se frena)");
    if (!/return \{ ok: true, piezas: \{\s*async reclamar\(\)[\s\S]*?\n {10}cotejo,\n[\s\S]*?\n {8}\} \};/.test(ruta) ||!/async devolverPorCambio\(id: string, _d, marca: MarcaCambio\) \{\s*const grantId = await devolverCobroPorCambio\(admin,/.test(ruta)) F("3 · las piezas de la ruta no llevan el cotejo o el respaldo");
    if (!/return \{ id, veredicto: veredictoInforme \};/.test(ruta)) F("3 · `crear` no devuelve el veredicto del informe (el respaldo no tiene con qué comparar)");
    if (!/if \(r\.estado === "cambio"\) return salir\(NextResponse\.json\(\{ error: "cambio", mostrado: \{ veredicto: r\.mostrado\.veredicto, score: r\.mostrado\.score \}, ahora: r\.hoy \}, \{ status: 412 \}\)\);/.test(ruta)) F("3 · el cambio no responde 412 «cambio» con lo de hoy");
    const srv = codigo("src/lib/guia/cobro-mostrado-servidor.ts");
    if (!/grantCredits\(p\.userId, FUENTE_DEVOLUCION_COBRO, 1, \{ noExpire: true \}\)/.test(srv) || !/from\("admin_audit_log"\)\.insert\(/.test(srv) || !/automatica: true/.test(srv)) F("3 · el respaldo no deja el lote `devolucion_cobro` sin vencimiento y la fila del admin");
    const mos = codigo("src/lib/guia/mostrado-servidor.ts");
    // La sonda de la pantalla es la MISMA del mapa y del pop-up.
    if (!/sondaDeCandidato\(c, \{ piePct: combo\.piePct, plazoAnios: combo\.plazoAnios, tasa: combo\.tasa \}, cfg, ahora\)/.test(mos) || !/sondaDeCandidato\(c, \{ piePct: Number\(b\.piePct\), plazoAnios: Number\(b\.plazoAnios\), tasa \}, cfg\)/.test(codigo("src/app/api/explorar/recalcular/route.ts"))) F("3 · lo mostrado de la pantalla no es la misma sonda que dibuja el pop-up");
    if (!/if \(!sel \|\| sel\.user_id !== userId \|\| !sel\.enviadaAt\) return null;/.test(mos) || !/at: sel\.enviadaAt, fuente: "correo"/.test(mos)) F("3 · lo mostrado del correo no valida a la persona o no fecha con el envío");
  }

  // ══ §4 · EL AVISO APARECE ═══════════════════════════════════════════════════
  {
    let modPop: { PopupInforme: FC<Record<string, unknown>>; VueltaInforme: FC<Record<string, unknown>> } | null = null;
    try { modPop = require(join(RAIZ, "src/components/guia/InformeEnCamino")); } catch (e) { F(`4 · no carga InformeEnCamino: ${(e as Error).message}`); }
    const gen = ie.informeGenerando("Las Condes · 2D1B · 52 m²", { veredicto: "COMPRAR", score: 80 });
    const cam = ie.informeCambio(gen, { veredicto: "AJUSTA SUPUESTOS", score: 63 });
    if (cam.paso !== "cambio" || !ie.cerrable(cam) || ie.alCerrarQueda(cam)) F("4 · el paso «cambio» no se puede cerrar o deja un informe que no existe");
    if (modPop) {
      const h = dibujar(createElement(modPop.PopupInforme, { paso: cam, ahora: Date.now(), alCerrar: () => {}, alAnalizarIgual: () => {} }));
      if (!texto(h).includes("Este depto cambió desde que te lo mostramos: ahora sale Ajustar. ¿Quieres analizarlo igual?") || !/data-informe="analizar-igual"[^>]*>Analizarlo igual</.test(h) || !/data-informe="cambio-volver"[^>]*>Volver</.test(h)) F(`4 · el pop-up no dice el aviso con «Analizarlo igual» y «Volver»: «${texto(h)}»`);
      const pag = dibujar(createElement(modPop.PopupInforme, { paso: ie.informeCambio(gen, { veredicto: "AJUSTA SUPUESTOS", score: 63 }, true), ahora: Date.now(), alCerrar: () => {}, alAnalizarIgual: () => {} }));
      if (!texto(pag).includes(cm.COBRO_MOSTRADO_COPY.pagadoQueda)) F("4 · recién pagado, el pop-up no dice que el análisis queda en la cuenta");
      const v = dibujar(createElement(modPop.VueltaInforme, { paso: ie.informeCambio(gen, { veredicto: "AJUSTA SUPUESTOS", score: 63 }, true), ahora: Date.now(), saldo: 1, alAnalizarIgual: () => {} }));
      if (!texto(v).includes("ahora sale Ajustar") || !texto(v).includes(cm.COBRO_MOSTRADO_COPY.pagadoQueda) || !/data-informe="analizar-igual"[^>]*>Usarlo en este depto</.test(v) || !/<a [^>]*href="\/dashboard"[^>]*>Elegir otro depto<\/a>/.test(v)) F(`4 · la vuelta del pago no dice el aviso con «Usarlo en este depto» y «Elegir otro depto»: «${texto(v)}»`);
    }
    // Las cinco superficies que llaman a «Analizar este» manejan el 412 «cambio» y mandan `aceptoCambio` al seguir.
    const SUPERFICIES: Array<[string, string]> = [
      ["Explorar", "src/app/explorar/explorar-cliente.tsx"],
      ["la selección del dashboard", "src/app/semanal/semanal-lista.tsx"],
      ["/deptos (primera selección)", "src/components/deptos/PrimeraSeleccion.tsx"],
      ["la guía de búsqueda", "src/components/guia/GuiaBusqueda.tsx"],
      ["la vuelta del pago", "src/app/payments/return/page.tsx"],
    ];
    for (const [nombre, f] of SUPERFICIES) {
      const src = codigo(f);
      if (!/if \(res\.status === 412 && d\.error === "cambio" && d\.ahora\?\.veredicto\) \{[^\n]*setInforme\(informeCambio\(paso0, \{ veredicto: d\.ahora\.veredicto, score: d\.ahora\.score \?\? null \}/.test(src)) F(`4 · ${nombre}: el aviso de cambio no aparece (no maneja el 412 «cambio»)`);
      if (!/\.\.\.\(aceptoCambio \? \{ aceptoCambio: true \} : \{\}\)/.test(src)) F(`4 · ${nombre}: «Analizarlo igual» no manda aceptoCambio`);
      if (!/devuelto: d\.devuelto \?\? null/.test(src)) F(`4 · ${nombre}: no le pasa al pop-up si el cobro se devolvió`);
    }
    if (!/informeCambio\(paso0, \{ veredicto: d\.ahora\.veredicto, score: d\.ahora\.score \?\? null \}, true\)/.test(codigo("src/app/payments/return/page.tsx")) || !/informeCambio\(paso0, \{ veredicto: d\.ahora\.veredicto, score: d\.ahora\.score \?\? null \}, recienPagado\)/.test(codigo("src/app/semanal/semanal-lista.tsx"))) F("4 · punto 7: la vuelta del pago no dice que el crédito comprado queda en la cuenta");
  }

  // ══ §5 · EL INFORME LO DICE ═════════════════════════════════════════════════
  {
    const marca: cm.MarcaCambio = { mostrado: { veredicto: "COMPRAR", score: 80, at: AHORA.toISOString(), fuente: "correo" }, hoy: { veredicto: "AJUSTA SUPUESTOS", score: 63 } };
    if (cm.lineaCambioPortada({ origenAviso: { cobroDevuelto: { ...marca, grantId: "g", at: "x" } } }) !== cm.COBRO_MOSTRADO_COPY.devuelto) F("5 · el informe del respaldo no dice «No te cobramos este análisis…»");
    if (cm.lineaCambioPortada({ origenAviso: { cambioAvisado: marca } }) !== "Este depto cambió desde que te lo mostramos: salía Comprar, ahora sale Ajustar.") F("5 · el informe avisado no dice qué cambió");
    if (cm.lineaCambioPortada({ origenAviso: { avisoId: "a" } }) !== null || cm.lineaCambioPortada(null) !== null) F("5 · un informe sin marca dice algo");
    if (!/lineaCambio=\{lineaCambioPortada\(inputData\)\}/.test(codigo("src/components/analysis/SubjectCardGrid.tsx")) || !/\{lineaCambio && <p className="doc-hero-tasa" data-portada="cambio-mostrado"/.test(codigo("src/components/analysis/portada/PortadaInforme.tsx"))) F("5 · la portada no dibuja la línea del cambio");
  }

  if (fallas.length === 0) console.log("  ✓ COBRO-MOSTRADO: todo en orden");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  if (fallas.length) console.log(`  ${fallas.length} falla(s) dura(s)`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runCobroMostradoTier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ============================================================================
// ACTA DE VERIFICACIÓN EN ROJO (23-nov-2026) — cada mutación, revertida después, puso el tier en rojo:
//   M1 el aviso antes de cobrar apagado (analizar-una-vez.ts) ............. §2 «igual cobra o crea (1 cobros, 1 creados)»
//   M2 el respaldo apagado ................................................. §2 «queda cobrado (0 devoluciones)»
//   M3 aceptoCambio ignorado (cobro-mostrado.ts) ............................ §1 «con «Analizarlo igual», sigue avisando»
//   M4 el puntaje solo cuenta como cambio ................................... §1 «solo otro puntaje… frena el cobro»
//   M5 ventana de 30 días ................................................... §1 «no es de 14 días»
//   M6 la ruta no responde 412 «cambio» ..................................... §3
//   M7 lo mostrado leído del pedido con `(b as …).mostrado` .................. §3 — la primera versión del guard, solo negativa
//      (`/b\.mostrado/`), quedó VERDE con esta grafía: se agregó la afirmación positiva de la asignación exacta.
//   M8 Explorar sin el manejo del 412 (el aviso que no aparece) .............. §4
//   M9 el pop-up sin la rama «cambio» ........................................ §4 «no dice el aviso…»
//   M10 punto 7: la vuelta del pago sin `pagado` ............................. §4 «punto 7…»
//   M11 la portada sin la línea ............................................... §5
//   M12 `crear` sin el veredicto del informe .................................. §3
//   12/12 en rojo (runner local: scripts/of-mutar-cobro-mostrado.mjs, untracked; restaura cada archivo desde su copia).
// ============================================================================
