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

/** La pestaña del ticket cerrado (12-oct-2026): desde que se abre el informe, en toda la página, mientras la
 *  oferta viva, si el ticket ya subió —en esta visita o antes— y no está abierto. Hasta hoy solo se veía desde
 *  la marca del final hacia abajo, y quien volvía no la encontraba. */
export function pestanaVisible(p: { abierto: boolean; yaSubio: boolean; vigente: boolean }): boolean {
  return !p.abierto && p.yaSubio && p.vigente;
}
