// ─────────────────────────────────────────────────────────────────────────────
// LA COMPRA DESDE UN DEPTO DE LA SELECCIÓN (21-oct-2026, recorrido real de Fabrizio por la puerta B). Sin saldo, el pop-up
// de «Analizar este» ofrece el pack de tres como principal y, debajo, «Comprar solo 1 · $9.990». Si la cuenta tiene menos
// de 24 horas, el pack va al precio del ticket —3 por $14.990— en vez de $19.990: EL TICKET ES DE TODA CUENTA NUEVA, por
// cualquier puerta, y su ventana es la de la cuenta (ticketDeCuenta). Los dos caen en la pantalla de compra con el depto
// puesto y, al pagar, vuelven al dashboard con ese depto arriba, que se analiza solo (`analizar=1`; decisión de Fabrizio).
// Puro: lo fija el tier PUERTA-B-RECORRIDO.
// ─────────────────────────────────────────────────────────────────────────────
import { fmtCLP } from "@/lib/pricing";
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { cuandoVenceCorto, ofertaPackVigente, PACK_PRECIO_CLP, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { rutaTres, TRES_PRECIO_CLP, volverSeguro } from "@/lib/tres-analisis";
import { urlCompra } from "@/lib/compra/compra";

const TOKEN = /^[0-9a-f]{20,80}$/i;
const AVISO = /^[A-Za-z0-9_-]{1,80}$/;

/** El ticket de la cuenta nueva: vigente mientras la cuenta tenga menos de 24 horas, la misma ventana del ticket del
 *  informe anónimo. Sin la fecha de la cuenta, no hay ticket. */
export function ticketDeCuenta(cuentaCreadaAt: string | null | undefined, ahora: Date = new Date()): boolean {
  return !!cuentaCreadaAt && ofertaPackVigente(cuentaCreadaAt, ahora);
}

/**
 * ¿El informe lleva el ticket de la cuenta? Nació en las primeras 24 horas de la cuenta y la cuenta no pagó el pack
 * todavía. EL TICKET NO SE PIERDE AL COMPRAR UN SUELTO (22-oct-2026, decisión de Fabrizio tras el recorrido real): dura 24
 * horas desde que nació la cuenta o hasta que compre el pack, lo que pase primero, y lo lleva TODO informe de la cuenta en
 * esa ventana, no solo el primero (hasta acá exigía «el primero», y tras pagar $9.990 el segundo informe se quedaba sin
 * él). La vigencia la mira el ticket, como en el anónimo: un informe que nació a tiempo y se abre vencido mide
 * `pack_vencido` y no sube.
 */
export function ticketEnElInforme(p: { cuentaCreadaAt: string | null | undefined; informeCreadoAt: string | null | undefined; packPagado: boolean }): boolean {
  if (!p.cuentaCreadaAt || !p.informeCreadoAt || p.packPagado) return false;
  const nacio = new Date(p.informeCreadoAt);
  return Number.isFinite(nacio.getTime()) && ofertaPackVigente(p.cuentaCreadaAt, nacio);
}

/** Con saldo y el ticket vivo (22-oct-2026): una sola línea, como enlace, sin frenar —en el dashboard y debajo del
 *  «Usa 1 de tus N análisis» del pop-up de «Analizar este»—. */
export const TICKET_CON_SALDO = {
  linea: (precio: string, vence: string) => `Hoy, 3 más por ${precio} · vence ${vence}`,
  /** El botón de la tarjeta del dashboard, con saldo. */
  boton: (precio: string) => `3 más por ${precio}`,
} as const;

/** La línea del ticket con saldo, con su vencimiento («mañana 11:17») y adónde compra. */
export function lineaTicketConSaldo(cuentaCreadaAt: string, href: string, ahora: Date = new Date()): { texto: string; href: string } {
  return { texto: TICKET_CON_SALDO.linea(fmtCLP(PACK_PRECIO_CLP), cuandoVenceCorto(cuentaCreadaAt, ahora)), href };
}

/** La misma línea desde un depto de la selección: compra el pack al precio del ticket y vuelve a ese depto. */
export function ticketConSaldoDelDepto(p: { token: string; avisoId: string; origen: "semanal" | "inmediato"; variante?: "banda" | "tarjetas" | null; cuentaCreadaAt: string | null | undefined; ahora?: Date }): { texto: string; href: string } | null {
  if (!p.cuentaCreadaAt) return null;
  const variante = p.origen === "semanal" ? p.variante ?? null : null;
  return lineaTicketConSaldo(p.cuentaCreadaAt, urlCompra({ product: PRODUCTO_PACK, origen: p.origen, variante, volver: volverAlDepto(p.token, p.avisoId) }), p.ahora);
}

/** Adónde vuelve la compra hecha desde un depto: el dashboard, en la selección, con ese depto arriba y analizándose solo. */
export function volverAlDepto(token: string, avisoId: string): string {
  return `/dashboard?t=${encodeURIComponent(token)}&a=${encodeURIComponent(avisoId)}&analizar=1`;
}

/** El depto de una vuelta (`volver`): su selección (`t`) y su aviso (`a`). null: la vuelta no es a un depto. */
export function deptoDeVolver(volver: string | null | undefined): { t: string; a: string } | null {
  const v = volverSeguro(volver);
  if (!v) return null;
  const q = new URLSearchParams(v.split("?")[1]?.split("#")[0] ?? "");
  const t = q.get("t"), a = q.get("a");
  return t && a && TOKEN.test(t) && AVISO.test(a) ? { t, a } : null;
}

/** ¿La vuelta pide analizar el depto solo, apenas llega? */
export const analizaAlVolver = (volver: string | null | undefined): boolean => deptoDeVolver(volver) != null && /[?&]analizar=1(?:&|#|$)/.test(volver ?? "");

/** El depto como lo nombran las tarjetas (22-oct-2026, decisión de Fabrizio): «Providencia · 2D2B · 59 m² · UF 3.500». */
export function nombreDelDepto(it: { comuna: string; tipologia: string | null; m2: number; precioUF: number }): string {
  const miles = (n: number) => Math.round(n).toLocaleString("es-CL");
  return [it.comuna, it.tipologia, `${miles(it.m2)} m²`, `UF ${miles(it.precioUF)}`].filter(Boolean).join(" · ");
}

/** Lo que /api/payments/status dice del depto de una compra pagada (la selección, el aviso y su origen), para que la
 *  vuelta de Flow genere el informe sola y diga de cuál. */
export interface DeptoDelPago {
  token: string;
  avisoId: string;
  origenId: string | null;
  nombre: string;
}

/** Saneado desde la red: lo que no tenga forma no se usa. */
export function leerDeptoDelPago(x: unknown): DeptoDelPago | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.token !== "string" || !TOKEN.test(r.token) || typeof r.avisoId !== "string" || !AVISO.test(r.avisoId) || typeof r.nombre !== "string") return null;
  return { token: r.token, avisoId: r.avisoId, origenId: typeof r.origenId === "string" ? r.origenId : null, nombre: r.nombre };
}

export const COMPRA_DEPTO = {
  /** El secundario del pop-up sin saldo. */
  suelto: `Comprar solo 1 · ${fmtCLP(FLOW_PRODUCTS.single.amount)}`,
  pack: (precio: number) => `3 análisis · ${fmtCLP(precio)}`,
  sin: (precio: number) => `Para analizar este depto: 3 análisis por ${fmtCLP(precio)}, sin caducidad.`,
  /** El estado de carga del pop-up (21-oct-2026): el mismo efecto que el wizard, hasta que abre el informe. */
  analizando: "Franco está analizando este depto…",
  /** La pantalla de compra, con el depto puesto. */
  paraDepto: "Para analizar",
} as const;

export interface ComprasDelDepto {
  /** El principal: el pack de tres (al precio del ticket si la cuenta es nueva). */
  pack: { href: string; label: string; ticket: boolean };
  /** El secundario: un análisis suelto. */
  suelto: { href: string; label: string };
  /** La línea de lo que se usa, sin saldo. */
  sin: string;
}

/**
 * LAS COMPRAS DESDE EXPLORAR (23-oct-2026): el aviso E al entrar sin saldo y el pop-up de «Analizar este» sin saldo
 * ofrecen el pack —al precio del ticket si la cuenta tiene menos de 24 horas— y «Comprar solo 1», de vuelta al mapa con
 * los mismos filtros y, si se compró desde un depto, con ese depto abierto y analizándose solo (`a` y `analizar=1`).
 */
export function comprasDeExplorar(p: { filtros: string; avisoId?: string | null; ticket: boolean }): ComprasDelDepto {
  const volver = `/explorar?${p.filtros}${p.avisoId ? `&a=${encodeURIComponent(p.avisoId)}&analizar=1` : ""}`;
  const precio = p.ticket ? PACK_PRECIO_CLP : TRES_PRECIO_CLP;
  return {
    pack: {
      href: p.ticket ? urlCompra({ product: PRODUCTO_PACK, origen: "explorar", volver }) : rutaTres("explorar", { volver }),
      label: COMPRA_DEPTO.pack(precio),
      ticket: p.ticket,
    },
    suelto: { href: urlCompra({ product: "single", origen: "explorar", volver }), label: COMPRA_DEPTO.suelto },
    sin: COMPRA_DEPTO.sin(precio),
  };
}

/** ¿La vuelta pide abrir un depto del mapa? El aviso (`a`) de `/explorar?…&a=<id>&analizar=1`. */
export function deptoDeVolverExplorar(volver: string | null | undefined): string | null {
  const v = volverSeguro(volver);
  if (!v || !(v === "/explorar" || v.startsWith("/explorar?"))) return null;
  const a = new URLSearchParams(v.split("?")[1]?.split("#")[0] ?? "").get("a");
  return a && AVISO.test(a) ? a : null;
}

/** El botón rojo del final de la selección, sin saldo: el pack —al precio del ticket si corresponde—, de vuelta a la
 *  selección en el dashboard. */
export function compraDeLaSeleccion(p: { token: string; origen: "semanal" | "inmediato"; variante?: "banda" | "tarjetas" | null; ticket: boolean }): { href: string; label: string } {
  const volver = `/dashboard?t=${encodeURIComponent(p.token)}`;
  const variante = p.origen === "semanal" ? p.variante ?? null : null;
  return p.ticket
    ? { href: urlCompra({ product: PRODUCTO_PACK, origen: p.origen, variante, volver }), label: COMPRA_DEPTO.pack(PACK_PRECIO_CLP) }
    : { href: rutaTres(p.origen, { variante, volver }), label: COMPRA_DEPTO.pack(TRES_PRECIO_CLP) };
}

/** Las dos compras del pop-up sin saldo, con la vuelta a este depto. */
export function comprasDelDepto(p: { token: string; avisoId: string; origen: "semanal" | "inmediato"; variante?: "banda" | "tarjetas" | null; ticket: boolean }): ComprasDelDepto {
  const volver = volverAlDepto(p.token, p.avisoId);
  const precio = p.ticket ? PACK_PRECIO_CLP : TRES_PRECIO_CLP;
  const variante = p.origen === "semanal" ? p.variante ?? null : null;
  return {
    pack: {
      href: p.ticket ? urlCompra({ product: PRODUCTO_PACK, origen: p.origen, variante, volver }) : rutaTres(p.origen, { variante, volver }),
      label: COMPRA_DEPTO.pack(precio),
      ticket: p.ticket,
    },
    suelto: { href: urlCompra({ product: "single", origen: p.origen, variante, volver }), label: COMPRA_DEPTO.suelto },
    sin: COMPRA_DEPTO.sin(precio),
  };
}
