// ─────────────────────────────────────────────────────────────────────────────
// LA DIRECCIÓN DEL PEDIDO DEL MAPA (26-nov-2026, entrega 2 › A). Una sola fuente para el navegador (explorar-cliente.tsx › asegurar) y
// para la página que la pide por adelantado (page.tsx › preload): si las dos no armaran EXACTAMENTE la misma dirección, el navegador
// no reconocería lo precargado y pediría dos veces.
// EL PEDIDO PARTIDO: con `parte=base`, la noche trae los ✓ Comprar y los − Ajustar (se dibujan al tiro); con `parte=no`, los No
// conviene (el 60 % del JSON), que el navegador pide después de dibujar los primeros pines. SIN `parte`, la respuesta completa de
// siempre (26-nov-2026): una pestaña abierta desde antes del deploy, con el código viejo, sigue recibiendo las tres clases. Puro.
// ─────────────────────────────────────────────────────────────────────────────
import type { FiltrosPortal } from "./portal";

/** Los parámetros de las dos partes del pedido de la noche. */
export const PARTE_BASE = "base";
export const PARTE_NO = "no";

/** Le suma el sello de la noche (el de la página que pide): el CDN guarda cada sello aparte. */
export const conSello = (url: string, sello: string | null): string => (sello ? `${url}${url.includes("?") ? "&" : "?"}s=${encodeURIComponent(sello)}` : url);

/** La dirección del universo para unos filtros: sin cuenta, la ruta pública (sin cifras, en la caché del CDN); con cuenta, la privada. */
export function urlUniverso(f: Pick<FiltrosPortal, "modalidad" | "pie" | "plazo" | "tasa">, sinCuenta: boolean): string {
  return sinCuenta ? `/api/explorar/abierto?m=${f.modalidad}` : `/api/explorar?m=${f.modalidad}&p=${f.pie}&z=${f.plazo}${f.tasa != null ? `&ta=${f.tasa}` : ""}`;
}

/** La primera parte (✓ Comprar y − Ajustar) de un pedido de la noche: la que pide el navegador y precarga la página. */
export const conParteBase = (url: string): string => `${url}${url.includes("?") ? "&" : "?"}parte=${PARTE_BASE}`;
/** La segunda parte (los No conviene) de un pedido de la noche. */
export const conParteNo = (url: string): string => `${url}${url.includes("?") ? "&" : "?"}parte=${PARTE_NO}`;

/** Qué parte pide una dirección: `base` o `no` si lo dice; sin `parte` (el código de antes del pedido partido), `todo`. */
export const parteDelPedido = (sp: URLSearchParams): "todo" | "base" | "no" => {
  const p = sp.get("parte");
  return p === PARTE_NO ? "no" : p === PARTE_BASE ? "base" : "todo";
};
