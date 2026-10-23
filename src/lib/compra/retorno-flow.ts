// ─────────────────────────────────────────────────────────────────────────────
// LA DIRECCIÓN DE VUELTA QUE VIAJA A FLOW (22-oct-2026, recorrido real de Fabrizio por la puerta B).
//
// Flow corta el `urlReturn` a 200 caracteres sin avisar. La compra de un suelto desde un depto de la selección mandaba
// `…/payments/return?order=<43>&volver=<dashboard?t=<36>&a=<36>&analizar=1, codificado>`: 206 caracteres. Volvió como
// `&analiz`, la página no vio `analizar=1`, no siguió sola al dashboard y el depto no se analizó solo (medido en el
// $current_url de /payments/return: exactamente 200, terminado en `%26analiz`).
//
// Desde ahora lo que viaja a Flow es lo mínimo —la orden y, para el pack sin sesión, su marca y la firma— y queda bajo
// RETORNO_FLOW_MAX para todo producto. TODO LO DEMÁS SE LEE DEL PAGO GUARDADO (`payments.payment_data.volver`, el informe
// atado, su veredicto y su modalidad), que /api/payments/status devuelve. Puro: lo fija el tier VUELTA-FLOW, que arma la
// URL más larga posible y exige que quepa.
// ─────────────────────────────────────────────────────────────────────────────

/** Donde Flow corta (medido el 22-oct-2026). */
export const RETORNO_FLOW_TOPE = 200;
/** Nuestro techo, con aire: ninguna URL de vuelta pasa de acá. */
export const RETORNO_FLOW_MAX = 150;
/** Lo más largo que puede medir una orden: `franco-` + un uuid. */
export const LARGO_ORDEN_MAX = "franco-".length + 36;

/** La URL de vuelta de un pago: la orden y, si es el pack pagado desde el ticket, `lqs=pack` y la firma (firma-pago.ts). */
export function urlRetornoFlow(sitio: string, order: string, pack?: { firma: string | null } | null): string {
  const base = `${sitio}/payments/return?order=${encodeURIComponent(order)}`;
  if (!pack) return base;
  return `${base}&lqs=pack${pack.firma ? `&t=${encodeURIComponent(pack.firma)}` : ""}`;
}

/** La URL de vuelta más larga que este sitio puede mandar a Flow (el pack con una firma de 32). */
export function largoMaximoRetorno(sitio: string, largoFirma = 32): number {
  return urlRetornoFlow(sitio, "franco-".padEnd(LARGO_ORDEN_MAX, "0"), { firma: "x".repeat(largoFirma) }).length;
}
