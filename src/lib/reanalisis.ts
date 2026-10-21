// ─────────────────────────────────────────────────────────────────────────────
// EL RE-ANÁLISIS AL PRECIO RECOMENDADO (21-oct-2026, Fabrizio). En el pop-up Ajustar del informe, el botón de la
// recomendación de Franco —la celda elegida del mix: su pie, su plazo y su descuento— dice «Ver el informe completo a
// UF X» y lleva al wizard con todo el informe de origen cargado y ese precio, ese pie y ese plazo puestos, en el
// resumen, para que la persona solo confirme. Gasta un análisis como cualquier otro, con el aviso del semanal antes
// («Usa tu análisis de regalo.» / «Usa 1 de tus N análisis.»); sin saldo, la compra del suelto con el depto y el
// precio a la vista, y al pagar sigue sola al informe. El informe nuevo dice arriba «Analizado a UF X, el precio que
// Franco recomendó negociar» y enlaza al original. En PostHog: `reanalisis_precio` (reanalisis-servidor.ts).
// Hasta acá el botón era un <span aria-disabled> desde el 13-sep-2026 (PopupAjustes.tsx, d7bf2004): inerte por
// decisión, a la espera de esta.
// Puro, sin módulos de Node: lo usan el pop-up, el wizard, la compra y las rutas.
// ─────────────────────────────────────────────────────────────────────────────
import { RUTA_WIZARD } from "@/lib/cta-analizar";
import type { UsoAnalisis } from "@/lib/guia/aviso-analizar";

const miles = (n: number) => Math.round(n).toLocaleString("es-CL");

export const REANALISIS_COPY = {
  boton: (precioUF: number) => `Ver el informe completo a UF ${miles(precioUF)}`,
  linea: (precioUF: number) => `Analizado a UF ${miles(precioUF)}, el precio que Franco recomendó negociar`,
  original: "Ver el informe original",
  compraIncluye: (precioUF: number) => `El informe completo de este depto a UF ${miles(precioUF)}, el precio que Franco recomendó negociar.`,
} as const;

/** El marcador que viaja en el cuerpo del análisis y queda en `input_data.reanalisis`. */
export interface Reanalisis {
  /** El informe desde el que se pidió (del mismo dueño). */
  origenId: string;
  precioOriginalUF: number;
  precioRecomendadoUF: number;
  /** El pie y el plazo de la recomendación. */
  piePct: number;
  plazoAnios: number;
}

/** Lo que el botón le pasa al wizard por la URL. */
export interface PedidoReanalisis {
  origenId: string;
  precioUF: number;
  piePct: number;
  plazoAnios: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** El precio del botón, en UF enteras: el de la recomendación (el pedido con el descuento de la celda de Franco). */
export function precioRecomendadoUF(precioUF: number, descuentoPct: number): number {
  return Math.round(precioUF * (1 - descuentoPct / 100));
}

/** El destino del botón: el wizard con el informe de origen y la recomendación. */
export function urlReanalisis(p: PedidoReanalisis): string {
  const q = new URLSearchParams({ reanalisis: p.origenId, precio: String(Math.round(p.precioUF)), pie: String(p.piePct), plazo: String(p.plazoAnios) });
  return `${RUTA_WIZARD}?${q.toString()}`;
}

/** Lo que el wizard lee de la URL, o null si no es un re-análisis válido. */
export function leerPedidoReanalisis(sp: { get(k: string): string | null }): PedidoReanalisis | null {
  const origenId = sp.get("reanalisis") ?? "";
  const precioUF = num(sp.get("precio"));
  const piePct = num(sp.get("pie"));
  const plazoAnios = num(sp.get("plazo"));
  if (!UUID.test(origenId) || precioUF === null || !(precioUF > 0) || precioUF > 1e6) return null;
  if (piePct === null || piePct < 0 || piePct > 100 || plazoAnios === null || ![20, 25, 30].includes(plazoAnios)) return null;
  return { origenId, precioUF: Math.round(precioUF), piePct, plazoAnios };
}

/** El marcador del cuerpo, saneado (lo que mande el cliente no se guarda tal cual). */
export function leerReanalisis(x: unknown): Reanalisis | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const origenId = typeof r.origenId === "string" ? r.origenId : "";
  const precioOriginalUF = num(r.precioOriginalUF);
  const precioRecomendadoUF = num(r.precioRecomendadoUF);
  const piePct = num(r.piePct);
  const plazoAnios = num(r.plazoAnios);
  if (!UUID.test(origenId) || precioOriginalUF === null || precioRecomendadoUF === null || piePct === null || plazoAnios === null) return null;
  if (!(precioOriginalUF > 0) || !(precioRecomendadoUF > 0) || precioRecomendadoUF > precioOriginalUF) return null;
  return { origenId, precioOriginalUF, precioRecomendadoUF, piePct, plazoAnios };
}

/** ¿El informe se generó al precio recomendado? Si la persona cambió el precio en el resumen, ya no es este re-análisis:
 *  el informe no puede decir «el precio que Franco recomendó». */
export function esAlPrecioRecomendado(precioUF: number, r: Pick<Reanalisis, "precioRecomendadoUF">): boolean {
  return Math.abs(precioUF - r.precioRecomendadoUF) < 0.5;
}

/** El aviso antes de gastar, desde lo que el wizard sabe del saldo (`/api/me/tier`): el mismo `textoUso` del semanal. */
export function usoDesdeTier(t: { isAdmin?: boolean; isUnlimited?: boolean; credits?: number; welcomeAvailable?: boolean; proximoRegalo?: boolean } | null): UsoAnalisis {
  if (!t) return { tipo: "desconocido" };
  if (t.isAdmin || t.isUnlimited) return { tipo: "plan" };
  const n = Math.max(0, t.credits ?? 0);
  if (n > 0) return { tipo: "con", n, noVencen: false, proximoRegalo: t.proximoRegalo === true };
  if (t.welcomeAvailable) return { tipo: "regalo", vence: null };
  return { tipo: "sin" };
}
