// ─────────────────────────────────────────────────────────────────────────────
// El ticket del pack sube UNA vez por informe y, después de la despedida, no vuelve. El estado vive
// en el navegador (localStorage) por id de análisis. Puro: el tier lo prueba con un Map.
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoTicket = "nunca" | "visto" | "despedida";

export interface AlmacenTicket {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const claveTicket = (analysisId: string) => `lqs_ticket_${analysisId}`;

export function leerEstadoTicket(almacen: AlmacenTicket | null | undefined, analysisId: string): EstadoTicket {
  try {
    const v = almacen?.getItem(claveTicket(analysisId));
    return v === "visto" || v === "despedida" ? v : "nunca";
  } catch {
    return "nunca";
  }
}

export function marcarTicket(almacen: AlmacenTicket | null | undefined, analysisId: string, estado: Exclude<EstadoTicket, "nunca">): void {
  try {
    almacen?.setItem(claveTicket(analysisId), estado);
  } catch {
    /* sin storage: el ticket puede repetirse en la próxima carga; nunca rompe el informe */
  }
}

/** Sube solo si nunca subió. Un ticket «visto» que no llegó a la despedida (cerró la pestaña) tampoco vuelve. */
export function debeSubirTicket(estado: EstadoTicket): boolean {
  return estado === "nunca";
}

/**
 * EL QUE VUELVE (12-oct-2026). En este navegador el ticket ya se mostró, o entra con su sesión a un informe que
 * nació anónimo —lo reclamó, así que ya estuvo acá— y no es la misma visita en que se registró («recién
 * dentro»). No se abre solo otra vez: la pestaña lo espera desde que abre el informe. El «ya se mostró» vive en
 * el navegador; con sesión, el haber reclamado el informe es lo que dice que ya estuvo.
 */
export function esRegreso(p: { estadoLocal: EstadoTicket; conSesion: boolean; recienDentro: boolean }): boolean {
  return p.estadoLocal !== "nunca" || (p.conSesion && !p.recienDentro);
}

/** «Ya se mostró» se guarda cuando la hoja estuvo dentro de la pantalla este tiempo (12-oct-2026), no cuando el
 *  disparador decide abrirla: en iOS 26 la hoja podía abrirse fuera de la pantalla y el ticket quedaba «mostrado»
 *  sin que nadie lo viera. */
export const VISTO_TRAS_MS = 1_000;

/** El velo no cierra en este tiempo desde que se abrió (12-oct-2026). */
export const GRACIA_VELO_MS = 1_000;

/** ¿Un toque en el velo cierra? No en el primer segundo, ni cuando es el final de un gesto —un scroll— que empezó
 *  antes de que se abriera: el dedo que venía bajando la página no cuenta como «cerrar». */
export function veloCierra(p: { ahora: number; abiertoEn: number; ultimoToque: number }): boolean {
  return p.ahora - p.abiertoEn >= GRACIA_VELO_MS && p.ultimoToque >= p.abiertoEn;
}

/** La pestaña del ticket cerrado (12-oct-2026): desde que se abre el informe, en toda la página, mientras la
 *  oferta viva, si el ticket ya subió —en esta visita o antes— y no está abierto. Hasta hoy solo se veía desde
 *  la marca del final hacia abajo, y quien volvía no la encontraba. */
export function pestanaVisible(p: { abierto: boolean; yaSubio: boolean; vigente: boolean }): boolean {
  return !p.abierto && p.yaSubio && p.vigente;
}
