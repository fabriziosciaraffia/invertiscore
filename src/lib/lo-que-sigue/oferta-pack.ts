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
/** Lo que se dice por análisis: $14.990 / 3 = $4.997, y se dice «$5.000». Fijo, no derivado. */
export const PACK_UNITARIO_CLP = 5000;
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
