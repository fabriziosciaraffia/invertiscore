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
