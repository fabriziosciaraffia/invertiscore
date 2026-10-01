// ─────────────────────────────────────────────────────────────────────────────
// QUIÉN PUEDE LEER UN PAGO A LA VUELTA DE FLOW (02-oct-2026). Funciones puras: las usan
// /api/payments/status, la guía y el perfil, y las prueba el tier PAGO-SIN-SESION sin red ni base.
//
//   · con sesión y el pago es suyo ............ «propio»: el pago, su saldo.
//   · con sesión y el pago es de OTRA cuenta ... «otra_cuenta»: la pantalla lo dice (antes quedaba
//                                                «Confirmando pago...» para siempre).
//   · sin sesión, con la firma del pago ........ «firma»: el estado de ESE pago y el saldo de su dueño.
//   · sin sesión y sin firma válida ............ «sin_datos»: nada (401).
//
// La firma no le gana a una sesión de otra cuenta: si hay sesión, manda la sesión.
// ─────────────────────────────────────────────────────────────────────────────

export type AccesoPago = "propio" | "otra_cuenta" | "firma" | "sin_datos" | "no_existe";

export function accesoAlPago(p: { sesionUserId: string | null; duenoPago: string | null | undefined; firmaValida: boolean }): AccesoPago {
  if (p.duenoPago === undefined) return p.sesionUserId ? "no_existe" : "sin_datos";
  if (p.sesionUserId) return p.duenoPago === p.sesionUserId ? "propio" : "otra_cuenta";
  return p.firmaValida && !!p.duenoPago ? "firma" : "sin_datos";
}

/** Lo que la guía y el perfil aceptan como llave sin sesión: la firma de un pago PAGADO de ESE informe. */
export function pagoAbreElInforme(p: { firmaValida: boolean; pago: { status: string; analysis_id: string | null; user_id: string | null } | null; analysisId: string }): boolean {
  return p.firmaValida && !!p.pago && p.pago.status === "paid" && !!p.pago.user_id && p.pago.analysis_id === p.analysisId;
}

/** La llave del pago que viaja con la pantalla de después de pagar. */
export interface LlavePago {
  order: string;
  firma: string;
}

/** La URL de la guía: con la llave del pago cuando la pantalla la tiene (sin sesión). */
export function urlGuia(analysisId: string, pago?: LlavePago | null): string {
  const base = `/api/lo-que-sigue/guia?a=${encodeURIComponent(analysisId)}`;
  return pago ? `${base}&order=${encodeURIComponent(pago.order)}&t=${encodeURIComponent(pago.firma)}` : base;
}

/** El estado que la pantalla muestra, del `status` de la fila `payments`. */
export function estadoDelPago(status: string | null | undefined): "paid" | "error" | "pending" {
  if (status === "paid") return "paid";
  if (status === "rejected" || status === "cancelled") return "error";
  return "pending";
}
