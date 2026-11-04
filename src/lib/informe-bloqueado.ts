// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME BLOQUEADO NO SE VE SIN PAGAR (04-nov-2026, auditoría de promesas parte 1, decisión de Fabrizio).
//
// El wizard sin saldo crea la fila con `pending_payment = true` (/api/analisis/locked) y manda a pagar: «El primero, para
// X, se genera al pagar». La fila de renta larga ya nace con los resultados, y hasta ahora las páginas del informe no
// miraban `pending_payment`: con el id que viaja en la URL del checkout se veía entero. Desde acá, mientras la fila esté
// pendiente, toda superficie del informe (LTR, STR, el comparativo, los documentos, los PDF, la zona, el compartido y la
// vista previa) muestra solo la portada bloqueada: el nombre del depto y, a su dueño, el botón de pagar. El veredicto,
// el puntaje y las cifras no salen. El pago la abre (payments/confirm → desbloqueo-pago.ts apaga `pending_payment`).
//
// Módulo PURO (sin React ni Supabase): la regla, el texto y adónde paga. Lo fija el tier DATOS-Y-PLATA.
// ─────────────────────────────────────────────────────────────────────────────
import { FLOW_PRODUCTS } from "@/lib/flow-products";
import { fmtCLP } from "@/lib/pricing";
import { urlCompra } from "@/lib/compra/compra";

/** ¿Esta fila se muestra bloqueada? Pendiente de pago y quien mira no es admin (soporte ve todo). */
export function informeBloqueado(fila: { pending_payment?: boolean | null } | null | undefined, esAdmin: boolean): boolean {
  return fila?.pending_payment === true && !esAdmin;
}

/** ¿Alguna de las filas del informe está bloqueada? (el comparativo y el compartido muestran dos). */
export function algunoBloqueado(filas: ReadonlyArray<{ pending_payment?: boolean | null } | null | undefined>, esAdmin: boolean): boolean {
  return filas.some((f) => informeBloqueado(f, esAdmin));
}

/** Adónde paga el dueño: la misma compra suelta que abrió el wizard, con el informe atado (y la renta corta de AMBAS). */
export function rutaPagoBloqueado(p: { analysisId: string; companionStrId?: string | null }): string {
  return urlCompra({ product: "single", analysisId: p.analysisId, companionStrId: p.companionStrId ?? null });
}

export const INFORME_BLOQUEADO_COPY = {
  dueno: {
    bajada: "Tu informe está listo y se abre al pagar.",
    boton: `Pagar ${fmtCLP(FLOW_PRODUCTS.single.amount)} y abrir el informe`,
  },
  ajeno: {
    bajada: "Este informe todavía no está disponible.",
    boton: "Ir a Franco",
  },
  /** La vista previa al compartir una fila pendiente: sin puntaje ni veredicto. */
  metaDescripcion: "Análisis de inversión inmobiliaria de Franco.",
} as const;
