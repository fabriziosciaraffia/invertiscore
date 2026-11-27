// ─────────────────────────────────────────────────────────────────────────────
// LA CONEXIÓN CON GOOGLE MAPS SE ABRE DESDE EL HTML DE /explorar (27-nov-2026, diagnóstico de carga, opción A sin precarga).
// La página le avisa al navegador, en el <head>, que va a hablar con Google (preconnect a maps.googleapis.com y maps.gstatic.com):
// el navegador resuelve el nombre y abre la conexión mientras baja la página, sin bajar nada. El script lo pide el cargador de
// siempre (loadGoogleMaps) con la página quieta.
// SIN PRECARGA DEL SCRIPT: se probó (7a2f85ba) y empeoró. Sus 407 kB bajaban junto con los datos de la noche: el LCP subió ~50 ms
// y los primeros pines ~500 ms en 4G. No volver a ponerla sin medir.
// ─────────────────────────────────────────────────────────────────────────────
import { preconnect } from "react-dom";

export const ORIGENES_MAPS = ["https://maps.googleapis.com", "https://maps.gstatic.com"] as const;

/** Las preconexiones con Google Maps. Solo en el servidor de /explorar; sin llave, nada. */
export function precargarGoogleMaps(): void {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;
  for (const o of ORIGENES_MAPS) preconnect(o);
}
