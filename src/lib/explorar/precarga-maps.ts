// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE MAPS SE PIDE DESDE EL HTML DE /explorar (27-nov-2026, diagnóstico de carga, opción A; aprobada por Fabrizio).
// La página le avisa al navegador, en el <head>, que va a hablar con Google (preconnect a maps.googleapis.com y maps.gstatic.com)
// y que baje ya el script de Maps (preload). El script NO se ejecuta acá: lo inserta el cargador de siempre (loadGoogleMaps) con
// la página quieta, y el navegador usa lo que ya bajó. La precarga va con prioridad BAJA para no quitarle ancho de banda a la
// imagen quieta, que es el LCP del teléfono. Bajar el script no crea un mapa: no consume la llave (Google cobra por mapa creado).
// ─────────────────────────────────────────────────────────────────────────────
import { preconnect, preload } from "react-dom";
import { urlGoogleMaps } from "@/lib/loadGoogleMaps";

export const ORIGENES_MAPS = ["https://maps.googleapis.com", "https://maps.gstatic.com"] as const;

/** Preconexión y precarga del script de Google Maps. Solo en el servidor de /explorar; sin llave, nada. */
export function precargarGoogleMaps(): void {
  const llave = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!llave) return;
  for (const o of ORIGENES_MAPS) preconnect(o);
  preload(urlGoogleMaps(llave), { as: "script", fetchPriority: "low" });
}
