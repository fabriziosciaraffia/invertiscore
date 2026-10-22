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
import { ofertaPackVigente, PACK_PRECIO_CLP, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
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
 * ¿El informe lleva el ticket de la cuenta? Es el primero de la cuenta, nació en sus primeras 24 horas y la cuenta no
 * pagó el pack todavía. La vigencia la mira el ticket, como en el anónimo: un informe que nació a tiempo y se abre
 * vencido mide `pack_vencido` y no sube.
 */
export function ticketEnElInforme(p: { cuentaCreadaAt: string | null | undefined; informeCreadoAt: string | null | undefined; primerInforme: boolean; packPagado: boolean }): boolean {
  if (!p.cuentaCreadaAt || !p.informeCreadoAt || !p.primerInforme || p.packPagado) return false;
  const nacio = new Date(p.informeCreadoAt);
  return Number.isFinite(nacio.getTime()) && ofertaPackVigente(p.cuentaCreadaAt, nacio);
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
