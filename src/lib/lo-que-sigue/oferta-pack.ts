// ─────────────────────────────────────────────────────────────────────────────
// «Lo que sigue» · el pack (28-sep-2026; precio del 29-sep): 3 análisis por $14.990 —$5.000 cada uno
// en vez de $9.990—, solo para quien acaba de leer su
// primer informe anónimo, con vencimiento a 24 horas desde que se creó ese informe. La hora la fija
// el servidor (created_at del análisis) y vence de verdad: `payments/create` rechaza después.
// Funciones puras: las prueba el tier sin red.
// ─────────────────────────────────────────────────────────────────────────────

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

/** Lo que se ahorra en los tres análisis, redondeado al mil: 3 × $9.990 − $14.990 = $14.980 → «$15.000». */
export const PACK_AHORRO_CLP = Math.round((PACK_ANALISIS * PACK_UNITARIO_REFERENCIA_CLP - PACK_PRECIO_CLP) / 1000) * 1000;

/** El wizard con lo de la persona ya cargado desde el informe `analysisId` (30-sep-2026). */
export const rutaPrecarga = (analysisId: string) => `/analisis/nuevo-v4?precarga=${encodeURIComponent(analysisId)}`;

// El retorno de Flow después del pack lleva el informe de origen y su veredicto (30-sep-2026): el
// ticket paga SIN sesión y /payments/return no puede leer el pago sin ella. El veredicto va en una
// letra y el id del informe ya es de la persona (el claim lo adoptó al pagar). La modalidad también
// (`m`: l = renta larga, s = renta corta), leída de `tipo_analisis` del informe: el evento de después
// de pagar la registra de ahí, no la supone.
const COD_VEREDICTO = { COMPRAR: "c", "AJUSTA SUPUESTOS": "a", "BUSCAR OTRA": "b" } as const;

/** La modalidad del informe, de su `tipo_analisis`. */
export const modalidadDeTipo = (tipo: string | null | undefined): "ltr" | "str" => (tipo === "short-term" ? "str" : "ltr");

// La firma del pago (02-oct-2026, `firma-pago.ts`): `t` deja leer el estado del pago, el saldo y la guía sin
// sesión. La hace el servidor (`firmarPago`) y llega acá hecha; sin firma la URL sale como antes.
export function urlRetornoPack(sitio: string, order: string, analysisId: string, veredicto: string | null | undefined, modalidad: "ltr" | "str", firma?: string | null): string {
  const v = COD_VEREDICTO[(veredicto ?? "") as keyof typeof COD_VEREDICTO] ?? "a";
  const m = modalidad === "str" ? "s" : "l";
  const t = firma ? `&t=${encodeURIComponent(firma)}` : "";
  return `${sitio}/payments/return?order=${encodeURIComponent(order)}&lqs=pack&a=${encodeURIComponent(analysisId)}&v=${v}&m=${m}${t}`;
}

export function leerRetornoPack(sp: { get(k: string): string | null }): { analysisId: string; veredicto: "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA"; modalidad: "ltr" | "str"; order: string | null; firma: string | null } | null {
  if (sp.get("lqs") !== "pack") return null;
  const a = sp.get("a") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(a)) return null;
  const v = sp.get("v");
  const t = sp.get("t");
  return {
    analysisId: a,
    veredicto: v === "c" ? "COMPRAR" : v === "b" ? "BUSCAR OTRA" : "AJUSTA SUPUESTOS",
    modalidad: sp.get("m") === "s" ? "str" : "ltr",
    order: sp.get("order"),
    firma: t && /^[A-Za-z0-9_-]{32}$/.test(t) ? t : null,
  };
}

/** Los productos a los que el cron de carrito abandonado les escribe: todos menos el pack. El pack
 *  vence a las 24 horas y no vuelve; un «¿Quedó algo pendiente?» lo contradiría. */
export function productosRecuperables<K extends string>(productos: readonly K[]): K[] {
  return productos.filter((p) => p !== PRODUCTO_PACK);
}
