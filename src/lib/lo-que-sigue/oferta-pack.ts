// ─────────────────────────────────────────────────────────────────────────────
// «Lo que sigue» · el pack (28-sep-2026; precio del 29-sep): 3 análisis por $14.990 —$5.000 cada uno
// en vez de $9.990—, solo para quien acaba de leer su
// primer informe anónimo, con vencimiento a 24 horas desde que se creó ese informe. La hora la fija
// el servidor (created_at del análisis) y vence de verdad: `payments/create` rechaza después.
// Funciones puras: las prueba el tier sin red.
// ─────────────────────────────────────────────────────────────────────────────
import { urlRetornoFlow } from "@/lib/compra/retorno-flow";

export const PRODUCTO_PACK = "pack3" as const;
export const PACK_ANALISIS = 3;
export const PACK_PRECIO_CLP = 14990;
/** Lo que cuesta un análisis suelto hoy (`FLOW_PRODUCTS.single.amount`), para decir el ahorro. */
export const PACK_UNITARIO_REFERENCIA_CLP = 9990;
/** Lo que se dice por análisis: $14.990 / 3 = $4.997 (08-oct-2026; hasta esa fecha se decía «$5.000»). */
export const PACK_UNITARIO_CLP = Math.round(PACK_PRECIO_CLP / PACK_ANALISIS);
export const VENTANA_PACK_MS = 24 * 60 * 60 * 1000;

/** Cuándo vence la oferta del pack de un informe creado en `createdAt`. */
export function venceEl(createdAt: string | Date): Date {
  const t = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  return new Date(t + VENTANA_PACK_MS);
}

/** ¿Sigue vigente? Vence de verdad: en el segundo exacto, ya no. */
export function ofertaPackVigente(createdAt: string | Date, ahora: Date = new Date()): boolean {
  const t = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  if (!Number.isFinite(t)) return false;
  return ahora.getTime() < t + VENTANA_PACK_MS;
}

/** «21:04», en la hora de Chile. */
export function horaVencimiento(createdAt: string | Date, zona = "America/Santiago"): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(venceEl(createdAt));
}

/** «hoy» o «mañana» según el día de vencimiento contra `ahora`, en la hora de Chile. */
export function diaVencimiento(createdAt: string | Date, ahora: Date = new Date(), zona = "America/Santiago"): "hoy" | "mañana" | "otro" {
  const f = new Intl.DateTimeFormat("es-CL", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" });
  const vence = f.format(venceEl(createdAt));
  if (vence === f.format(ahora)) return "hoy";
  if (vence === f.format(new Date(ahora.getTime() + 24 * 60 * 60 * 1000))) return "mañana";
  return "otro";
}

/** «hoy a las 21:04», «mañana a las 21:04» o «el 9 de octubre a las 21:04», en la hora de Chile. */
export function cuandoVence(createdAt: string | Date, ahora: Date = new Date(), zona = "America/Santiago"): string {
  const hora = horaVencimiento(createdAt, zona);
  const dia = diaVencimiento(createdAt, ahora, zona);
  if (dia !== "otro") return `${dia} a las ${hora}`;
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: zona, day: "numeric", month: "long" }).format(venceEl(createdAt));
  return `el ${fecha} a las ${hora}`;
}

/** La forma corta, para una línea (22-oct-2026): «hoy 21:04», «mañana 21:04» o «el 9 de octubre 21:04». */
export function cuandoVenceCorto(createdAt: string | Date, ahora: Date = new Date(), zona = "America/Santiago"): string {
  const hora = horaVencimiento(createdAt, zona);
  const dia = diaVencimiento(createdAt, ahora, zona);
  if (dia !== "otro") return `${dia} ${hora}`;
  const fecha = new Intl.DateTimeFormat("es-CL", { timeZone: zona, day: "numeric", month: "long" }).format(venceEl(createdAt));
  return `el ${fecha} ${hora}`;
}

/** Lo que se ahorra en los tres análisis, redondeado al mil: 3 × $9.990 − $14.990 = $14.980 → «$15.000». */
export const PACK_AHORRO_CLP = Math.round((PACK_ANALISIS * PACK_UNITARIO_REFERENCIA_CLP - PACK_PRECIO_CLP) / 1000) * 1000;

/** El wizard con lo de la persona ya cargado desde el informe `analysisId` (30-sep-2026). */
export const rutaPrecarga = (analysisId: string) => `/analisis/nuevo-v4?precarga=${encodeURIComponent(analysisId)}`;

// El retorno de Flow después del pack (30-sep-2026): el ticket paga SIN sesión y /payments/return no puede leer el pago
// sin ella; la firma (`t`, firma-pago.ts, 02-oct-2026) se lo permite. Hasta el 22-oct-2026 la URL llevaba además el
// informe de origen, su veredicto y su modalidad (`a`, `v`, `m`): 175 caracteres, y Flow corta a 200 (lib/compra/
// retorno-flow.ts). Ahora viaja lo mínimo —la orden, `lqs=pack` y la firma— y el informe, el veredicto y la modalidad
// los devuelve /api/payments/status leyéndolos del pago (`retornoPack`): el evento de después de pagar los registra de
// ahí, no los supone.

/** La modalidad del informe, de su `tipo_analisis`. */
export const modalidadDeTipo = (tipo: string | null | undefined): "ltr" | "str" => (tipo === "short-term" ? "str" : "ltr");

/** Lo que /api/payments/status devuelve del pack: el informe que lo pagó, su veredicto y su modalidad. */
export interface RetornoPack {
  analysisId: string;
  veredicto: "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
  modalidad: "ltr" | "str";
}

export function urlRetornoPack(sitio: string, order: string, firma?: string | null): string {
  return urlRetornoFlow(sitio, order, { firma: firma ?? null });
}

/** La vuelta del pack: su marca y la firma (con forma, o nada). El resto lo trae el estado del pago. */
export function leerRetornoPack(sp: { get(k: string): string | null }): { order: string | null; firma: string | null } | null {
  if (sp.get("lqs") !== "pack") return null;
  const t = sp.get("t");
  return { order: sp.get("order"), firma: t && /^[A-Za-z0-9_-]{32}$/.test(t) ? t : null };
}

/** Lo que el estado del pago dice del pack, saneado (lo que llegue por la red no se usa tal cual). */
export function leerRetornoPackDelPago(x: unknown): RetornoPack | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.analysisId !== "string" || !/^[0-9a-f-]{36}$/i.test(r.analysisId)) return null;
  const v = r.veredicto;
  return {
    analysisId: r.analysisId,
    veredicto: v === "COMPRAR" || v === "BUSCAR OTRA" ? v : "AJUSTA SUPUESTOS",
    modalidad: r.modalidad === "str" ? "str" : "ltr",
  };
}

/** Los productos a los que el cron de carrito abandonado les escribe: todos menos el pack. El pack
 *  vence a las 24 horas y no vuelve; un «¿Quedó algo pendiente?» lo contradiría. */
export function productosRecuperables<K extends string>(productos: readonly K[]): K[] {
  return productos.filter((p) => p !== PRODUCTO_PACK);
}
