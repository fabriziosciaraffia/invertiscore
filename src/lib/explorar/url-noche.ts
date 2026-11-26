// ─────────────────────────────────────────────────────────────────────────────
// LA DIRECCIÓN DEL PEDIDO DEL MAPA (26-nov-2026, entrega 2 › A). Una sola fuente para el navegador (explorar-cliente.tsx › asegurar) y
// para la página que la pide por adelantado (page.tsx › preload): si las dos no armaran EXACTAMENTE la misma dirección, el navegador
// no reconocería lo precargado y pediría dos veces.
// EL PEDIDO PARTIDO: sin `parte`, la noche trae los ✓ Comprar y los − Ajustar (se dibujan al tiro); con `parte=no`, los No conviene
// (el 60 % del JSON), que el navegador pide después de dibujar los primeros pines. Puro: sin red ni React.
// ─────────────────────────────────────────────────────────────────────────────
import type { FiltrosPortal } from "./portal";

/** El parámetro de la segunda parte del pedido de la noche. */
export const PARTE_NO = "no";

/** Le suma el sello de la noche (el de la página que pide): el CDN guarda cada sello aparte. */
export const conSello = (url: string, sello: string | null): string => (sello ? `${url}${url.includes("?") ? "&" : "?"}s=${encodeURIComponent(sello)}` : url);

/** La dirección del universo para unos filtros: sin cuenta, la ruta pública (sin cifras, en la caché del CDN); con cuenta, la privada. */
export function urlUniverso(f: Pick<FiltrosPortal, "modalidad" | "pie" | "plazo" | "tasa">, sinCuenta: boolean): string {
  return sinCuenta ? `/api/explorar/abierto?m=${f.modalidad}` : `/api/explorar?m=${f.modalidad}&p=${f.pie}&z=${f.plazo}${f.tasa != null ? `&ta=${f.tasa}` : ""}`;
}

/** La segunda parte (los No conviene) de un pedido de la noche. */
export const conParteNo = (url: string): string => `${url}${url.includes("?") ? "&" : "?"}parte=${PARTE_NO}`;

/** Qué parte pide una dirección: `no` con `parte=no`; si no, la base (✓ Comprar y − Ajustar). */
export const parteDelPedido = (sp: URLSearchParams): "base" | "no" => (sp.get("parte") === PARTE_NO ? "no" : "base");
