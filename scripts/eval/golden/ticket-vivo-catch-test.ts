// ============================================================================
// TIER TICKET-VIVO — el ticket de 24 horas no se pierde al comprar un suelto (22-oct-2026, decisión de Fabrizio)
//
// Lo que pasó: tras pagar $9.990 en el recorrido real del 22-oct, el segundo informe y el dashboard dejaron de ofrecer el
// ticket. La regla: dura 24 horas desde que nació la cuenta o hasta que compre el pack, lo que pase primero; una compra
// suelta no lo apaga. Vale para toda cuenta nueva, por cualquier puerta.
//
//   1 · EL INFORME: todo informe de la cuenta en esas 24 horas lleva el ticket (no solo el primero); con el pack pagado o
//       pasadas las 24 horas, no. EN ROJO CON EL CÓDIGO DE HOY: exigía «el primero».
//   2 · EL DASHBOARD: la tarjeta de la oferta se muestra mientras el ticket viva, con o sin saldo; con saldo dice «3 más
//       por $14.990» y hasta cuándo, y la línea del saldo lo repite como enlace cuando la tarjeta de arriba es otra.
//   3 · EL POP-UP de «Analizar este» con saldo: se usa el saldo como siempre y debajo una sola línea, «Hoy, 3 más por
//       $14.990 · vence mañana 11:17», como enlace, sin frenar.
//   4 · EL COPY del ticket para quien ya tiene cuenta: «Para tres deptos más de tu selección, o cualquier otro que te
//       interese.», sin «al comprar quedas registrado».
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/ticket-vivo-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement, type ReactNode, type ReactElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Los componentes se compilan con el JSX clásico fuera de Next: React tiene que estar en el global (como en PUERTA-B-RECORRIDO).
(globalThis as { React?: unknown }).React = React;
import { ofertaEnCasa } from "../../../src/lib/casa/reglas";
import { estadoSaldo } from "../../../src/lib/casa-saldo";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { hrefOfertaCasa } from "../../../src/app/dashboard/oferta-casa";
import { TICKET_PACK } from "../../../src/lib/lo-que-sigue/copy";
import { cuandoVenceCorto } from "../../../src/lib/lo-que-sigue/oferta-pack";
import * as compra from "../../../src/lib/guia/compra-desde-depto";

const RAIZ = join(__dirname, "..", "..", "..");
// Los componentes importan su CSS: en Node se ignora (como en PUERTA-B-RECORRIDO).
(require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions[".css"] = (m) => { m.exports = {}; };
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
const HORA = 3600_000;
/** Dibuja un componente cliente con un router de app falso; el pop-up se monta en un portal, que acá se dibuja en el lugar. */
function dibujarPopup(el: ReactElement): string {
  const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
  const rd = require("react-dom") as { createPortal: unknown };
  const g = globalThis as { document?: unknown };
  const portal = rd.createPortal, doc = g.document;
  rd.createPortal = (hijo: ReactNode) => hijo;
  g.document = { body: {} };
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  try { return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, el)); } finally { rd.createPortal = portal; if (doc === undefined) delete g.document; else g.document = doc; }
}
const textos = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const TOKEN = "c1f72c3abf34757d3dbae63c6ea112b6a88d";
const AVISO = "c1dfbdc9-01db-4d65-b3de-bdcac9bd9aa0";

export function runTicketVivoTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER TICKET-VIVO (el ticket de 24 horas no se pierde al comprar un suelto: todo informe, la tarjeta y la línea del pop-up con saldo · 0 tokens) ───");
  const ahora = new Date("2026-10-22T15:00:00Z");
  const hace = (h: number) => new Date(ahora.getTime() - h * HORA).toISOString();

  // ── 1 · el informe ──
  try {
    const en = (p: Partial<Parameters<typeof compra.ticketEnElInforme>[0]>) => compra.ticketEnElInforme({ cuentaCreadaAt: hace(5), informeCreadoAt: hace(1), packPagado: false, ...p } as Parameters<typeof compra.ticketEnElInforme>[0]);
    // El segundo informe, hecho con el crédito del suelto: `primerInforme` ya no existe y si llegara en false no manda.
    if (!en({})) F("1 · el segundo informe de la cuenta (una hora después del primero) no lleva el ticket");
    if (!en({ primerInforme: false } as never)) F("1 · un «no es el primero» apaga el ticket (la regla vieja sigue viva)");
    if (en({ packPagado: true })) F("1 · con el pack pagado, el informe lleva el ticket");
    if (en({ cuentaCreadaAt: hace(25), informeCreadoAt: hace(0.5) })) F("1 · pasadas las 24 horas de la cuenta, el informe lleva el ticket");
    if (en({ cuentaCreadaAt: null })) F("1 · sin la fecha de la cuenta, lleva el ticket");
    if (/primerInforme/.test(codigo("src/lib/guia/compra-desde-depto.ts")) || /esPrimerInforme/.test(codigo("src/lib/lo-que-sigue/oferta-informe-servidor.ts") + codigo("src/lib/lo-que-sigue/ticket-cuenta-servidor.ts"))) F("1 · sobrevive la regla «solo el primer informe» (primerInforme / esPrimerInforme)");
    if (!/const packPagado = await packPagadoPorCuenta\(admin, p\.duenoId\);\s*if \(ticketEnElInforme\(\{ cuentaCreadaAt: c\.creadaAt, informeCreadoAt: c\.informeCreadoAt, packPagado \}\)\)/.test(codigo("src/lib/lo-que-sigue/oferta-informe-servidor.ts"))) F("1 · la oferta del informe no decide el ticket con la cuenta y el pack, solamente");
  } catch (e) {
    F(`1 · explotó: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2 · el dashboard ──
  try {
    const sin = estadoSaldo({ disponibles: 0, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false });
    const con = estadoSaldo({ disponibles: 1, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: true });
    const regalo = estadoSaldo({ disponibles: 1, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: "2026-11-16T12:00:00Z", todoSinCaducidad: false });
    const plan = estadoSaldo({ disponibles: 0, plan: true, suscripcion: true, regaloRestante: 0, regaloVence: null, todoSinCaducidad: true });
  // ⚠ ACTA (24-oct-2026, goal «Puerta B, parte 2», mockup 3b-dashboard.html) · el banner con «3 más por $14.990» y la línea del saldo se
    // retiraron: con el ticket vivo, la casa muestra la OFERTA ROJA de una fila —«Solo para cuentas nuevas · vence mañana
    // 11:17 · 3 análisis por $14.990 · Aprovechar»—, CON O SIN SALDO (lib/casa/reglas.ts › ofertaEnCasa; tier
    // PUERTA-B-DASHBOARD §1), nunca con el plan; «Aprovechar» compra el pack del ticket y vuelve al dashboard.
    const o = (saldo: typeof sin, ticket: boolean) => ofertaEnCasa({ ticket, saldo });
    if (!o(con, true)) F("2 · con saldo y el ticket vivo, no va la oferta");
    if (!o(regalo, true)) F("2 · con el regalo sin usar y el ticket vivo, no va la oferta");
    if (o(con, false) || o(regalo, false) || o(sin, false)) F("2 · sin ticket va la oferta");
    if (o(plan, true)) F("2 · con el plan va la oferta (analizar no descuenta)");
    if (!o(sin, true)) F("2 · sin saldo y con el ticket vivo, no va la oferta");
    if (CASA.oferta.titulo !== "3 análisis por $14.990" || CASA.oferta.boton !== "Aprovechar" || !CASA.oferta.kicker("mañana 11:17").endsWith("vence mañana 11:17")) F(`2 · la oferta no dice «3 análisis por $14.990 · Aprovechar» ni hasta cuándo: ${CASA.oferta.titulo}`);
    if (new URL(hrefOfertaCasa(), "https://x.cl").searchParams.get("product") !== "pack3" || new URL(hrefOfertaCasa(), "https://x.cl").searchParams.get("volver") !== "/dashboard") F("2 · «Aprovechar» no compra el pack del ticket de vuelta al dashboard");
    const pag = codigo("src/app/dashboard/page.tsx");
    if (!/const ticket = sel\?\.ticket \?\? await ticketDeCuentaDisponible\(admin, user\);/.test(pag) || /saldo\.tipo === "sin" \? \(sel\?\.ticket/.test(pag)) F("2 · la página decide el ticket solo sin saldo");
    if (!/\{ofertaEnCasa\(\{ ticket, saldo \}\) && user\.created_at && <OfertaCasa cuentaCreadaAt=\{user\.created_at\} \/>\}/.test(pag)) F("2 · la oferta no sale de ofertaEnCasa con la fecha de la cuenta");
    const oferta = codigo("src/app/dashboard/oferta-casa.tsx");
    if (!/\{CASA\.oferta\.kicker\(cuandoVenceCorto\(cuentaCreadaAt, ahora\)\)\}/.test(oferta) || !/<EnlaceCarga href=\{hrefOfertaCasa\(\)\} className="ca-oferta-btn" data-casa="aprovechar">\{CASA\.oferta\.boton\}<\/EnlaceCarga>/.test(oferta)) F("2 · la oferta no dice hasta cuándo o «Aprovechar» no es su botón");
  } catch (e) {
    F(`2 · explotó: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 3 · el pop-up con saldo ──
  try {
    const l = compra.lineaTicketConSaldo(hace(5), "/checkout?product=pack3", ahora);
    const vence = cuandoVenceCorto(hace(5), ahora);
    if (l.texto !== `Hoy, 3 más por $14.990 · vence ${vence}` || !/^(hoy|mañana) \d{2}:\d{2}$/.test(vence)) F(`3 · la línea del ticket con saldo no es «Hoy, 3 más por $14.990 · vence mañana 11:17»: ${l.texto}`);
    const d = compra.ticketConSaldoDelDepto({ token: TOKEN, avisoId: AVISO, origen: "semanal", variante: "tarjetas", cuentaCreadaAt: hace(5), ahora });
    const q = d ? new URL(d.href, "https://x.cl").searchParams : null;
    if (!d || !q || q.get("product") !== "pack3" || q.get("origen") !== "semanal" || q.get("variante") !== "tarjetas" || !compra.analizaAlVolver(q.get("volver")) || compra.deptoDeVolver(q.get("volver"))?.a !== AVISO) F(`3 · desde un depto, la línea no compra el pack del ticket de vuelta a ese depto: ${d?.href}`);
    if (compra.ticketConSaldoDelDepto({ token: TOKEN, avisoId: AVISO, origen: "semanal", cuentaCreadaAt: null }) !== null) F("3 · sin la fecha de la cuenta, la línea sale igual");
    const { AvisoAntesDeAnalizar } = require(join(RAIZ, "src/components/guia/AvisoAntesDeAnalizar")) as typeof import("../../../src/components/guia/AvisoAntesDeAnalizar");
    const aviso = (uso: unknown, extra: Record<string, unknown> = {}) => dibujarPopup(createElement(AvisoAntesDeAnalizar as unknown as FC<Record<string, unknown>>, {
      depto: { comuna: "Santiago", tipologia: "2D2B", m2: 59, precioUF: 1500 }, combinacion: { piePct: 20, plazoAnios: 25 }, finanzas: { tasa: 4.5, uf: 39000, arriendo: 450000 }, uso, rutaCompra: "/x", alAnalizar() {}, alCancelar() {}, ...extra,
    }));
    const html = aviso({ tipo: "con", n: 2, noVencen: true }, { ticketConSaldo: l });
    const t = textos(html);
    if (!t.includes("Usa 1 de tus 2 análisis.")) F("3 · con saldo, el pop-up dejó de decir que usa el saldo");
    if (!t.includes(l.texto) || !/<a [^>]*data-modal-ticket="true"[^>]*href="\/checkout\?product=pack3"/.test(html)) F("3 · con saldo y el ticket vivo, el pop-up no lleva la línea del ticket como enlace");
    if (!/<p class="wz-modal-nota" data-modal-nota="true">/.test(html) || html.indexOf("wz-modal-consumo") > html.indexOf("wz-modal-nota")) F("3 · la línea no va debajo de «Usa 1 de tus N análisis»");
    if (!/<button[^>]*class="wz-cta wz-cta-modal"[^>]*>Analizar/.test(html) || /disabled=""[^>]*class="wz-cta wz-cta-modal"/.test(html)) F("3 · la línea frena el botón de Analizar");
    if (textos(aviso({ tipo: "sin" }, { ticketConSaldo: l })).includes(l.texto)) F("3 · sin saldo (la compra manda), la línea sale igual");
    if (textos(aviso({ tipo: "con", n: 1, noVencen: true })).includes("3 más por")) F("3 · sin el ticket, el pop-up ofrece «3 más»");
    const sl = codigo("src/app/semanal/semanal-lista.tsx"), ps = codigo("src/components/deptos/PrimeraSeleccion.tsx");
    if (!/ticketConSaldo=\{ticket && !corta \? ticketConSaldoDelDepto\(\{ token, avisoId: confirmar\.it\.avisoId, origen: origenCompra, variante: varianteCompra, cuentaCreadaAt \}\) : null\}/.test(sl)) F("3 · la selección no le pasa la línea del ticket al pop-up");
    // ⚠ ACTA (28-oct-2026, RESPALDO-MAPA) · la línea del ticket sale de la tarjeta (con el token desde la selección; con la compra de Explorar desde el respaldo).
    if (!/ticketConSaldo=\{ticketConSaldoDeLaTarjeta\(confirmar\.it\)\}/.test(ps) || !/if \(!datos\?\.ticket\) return null;/.test(ps) || !/return ticketConSaldoDelDepto\(\{ token: datos\.token, avisoId: it\.avisoId, origen: "semanal", cuentaCreadaAt: datos\.cuentaCreadaAt \}\);/.test(ps)) F("3 · la primera selección no le pasa la línea del ticket al pop-up");
    if (!/cuentaCreadaAt: ticket \? \(user\.created_at \?\? null\) : null/.test(codigo("src/lib/guia/seleccion-pagina-servidor.ts")) || !/cuentaCreadaAt: ticket \? \(user\.created_at \?\? null\) : null/.test(codigo("src/app/api/deptos/primeros/route.ts"))) F("3 · el servidor no manda cuándo nació la cuenta junto con el ticket");
  } catch (e) {
    F(`3 · explotó: ${e instanceof Error ? `${e.message} ${(e.stack ?? "").split("\n").slice(0, 3).join(" | ")}` : String(e)}`);
  }

  // ── 4 · el copy para quien ya tiene cuenta ──
  try {
    if (TICKET_PACK.negritaConCuenta !== "Para tres deptos más de tu selección, o cualquier otro que te interese.") F("4 · el copy del ticket para quien ya tiene cuenta no es el aprobado");
    if (/quedas registrado/.test(TICKET_PACK.negritaConCuenta ?? "") || !/quedas registrado/.test(TICKET_PACK.negrita)) F("4 · el copy del anónimo y el de la cuenta se mezclaron");
    if (TICKET_PACK.vencimientoCuenta("mañana a las 11:17") !== "Solo para usuarios nuevos · hasta mañana a las 11:17") F("4 · el vencimiento del ticket de la cuenta dice «en este informe» o «guarda el enlace»");
    const tk = codigo("src/components/lo-que-sigue/TicketPack.tsx");
    if (!/<b>\{conCuenta \? TICKET_PACK\.negritaConCuenta : TICKET_PACK\.negrita\}<\/b>/.test(tk) || !/\{conCuenta \? TICKET_PACK\.vencimientoCuenta\(cuandoVence\(createdAt\)\) : TICKET_PACK\.vencimiento\(cuandoVence\(createdAt\)\)\}/.test(tk)) F("4 · el ticket no cambia el copy para quien ya tiene cuenta");
    for (const [p, re] of [
      ["src/app/analisis/[id]/results-client.tsx", /<TicketPack [^>]*conCuenta=\{isLoggedIn \|\| !!ticketDesde\} \/>/],
      ["src/app/analisis/renta-corta/[id]/results-client.tsx", /<TicketPack [^>]*conCuenta=\{!!userId \|\| !!ticketDesde\} \/>/],
    ] as const) if (!re.test(codigo(p))) F(`4 · ${p} no le dice al ticket que la persona ya tiene cuenta`);
  } catch (e) {
    F(`4 · explotó (falta el copy de la cuenta): ${e instanceof Error ? e.message : String(e)}`);
  }

  if (fallas.length) {
    console.log(`  ✗ TICKET-VIVO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el ticket vive 24 horas desde la cuenta o hasta el pack, en todo informe; el dashboard lo ofrece con o sin saldo («3 más por $14.990»); el pop-up con saldo lleva la línea como enlace sin frenar; con cuenta, el copy aprobado");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 752420df, `src/` del goal de vuelta a HEAD): 15 fallas —el
// segundo informe sin ticket, «solo el primero» viva, la tarjeta solo sin saldo, la página que decide el ticket solo sin
// saldo, sin la línea del saldo, sin la línea del pop-up (falta lineaTicketConSaldo) y sin el copy de la cuenta—. Y 10
// mutaciones, cada una restaurada byte a byte, todas ROJAS: T1 el pack pagado no apaga el ticket · T2 arriba sin la tarjeta
// con saldo · T3 la tarjeta con saldo dice «3 análisis · $14.990» · T4 la página decide el ticket solo sin saldo · T5 la
// línea del saldo sin el ticket · T6 el pop-up sin la línea · T7 el copy de la cuenta vuelve al del anónimo · T8 el ticket
// no cambia el copy · T9 la selección no le pasa la línea al pop-up · T10 la oferta del informe ignora el pack pagado.
// Los gates que fijaban «solo el primer informe» y «solo sin saldo» se reescribieron con su acta: PUERTA-B-RECORRIDO §5,
// CASA §4/§9, CORREOS-RECORRIDO §5 (el pop-up con la línea), OFERTA-TICKET §1, LO-QUE-SIGUE §1 y TICKET-REGRESO §2 (`conCuenta`).

if (require.main === module) {
  process.exit(runTicketVivoTier().hard ? 1 : 0);
}
