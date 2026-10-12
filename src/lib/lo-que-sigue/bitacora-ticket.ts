// ─────────────────────────────────────────────────────────────────────────────
// LA BITÁCORA DEL TICKET (12-oct-2026). Los últimos eventos del ticket del pack, con hora, en el navegador
// (localStorage, por informe): abierto y con qué disparador; medido al segundo —si la hoja estaba dentro de la
// pantalla, con posición y tamaño—; a la despedida o cerrado, y por dónde (el velo, la X, «Seguir leyendo»,
// Escape, «Sí, seguir leyendo»); y un toque en el velo que no cerró. La lee el recuadro de `?lqs=1` para probar
// en el teléfono sin adivinar. Se guarda siempre —el problema pasa antes de que alguien pida el recuadro— y nunca
// va a PostHog. Puro: el tier la prueba con un Map.
// ─────────────────────────────────────────────────────────────────────────────

export type PorDondeTicket = "velo" | "x" | "seguir" | "escape" | "si-seguir";

export interface EventoTicket {
  /** Epoch ms. */
  t: number;
  tipo: "abierto" | "medido" | "despedida" | "cerrado" | "ignorado";
  /** Para «abierto»: el disparador (final, lectura, salida) o «pestaña». */
  motivo?: string;
  /** Para «despedida», «cerrado» e «ignorado». */
  por?: PorDondeTicket;
  /** Para «medido»: la hoja dentro de la pantalla, su borde de arriba, su alto y el alto de la pantalla. */
  dentro?: boolean;
  top?: number;
  alto?: number;
  pantalla?: number;
}

interface Almacen {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const claveBitacora = (analysisId: string) => `lqs_bitacora_${analysisId}`;
export const MAX_EVENTOS_TICKET = 8;

export function leerBitacora(almacen: Almacen | null | undefined, analysisId: string): EventoTicket[] {
  try {
    const v = JSON.parse(almacen?.getItem(claveBitacora(analysisId)) ?? "[]");
    return Array.isArray(v) ? (v as EventoTicket[]) : [];
  } catch {
    return [];
  }
}

export function anotarEvento(almacen: Almacen | null | undefined, analysisId: string, ev: EventoTicket): void {
  try {
    const sig = [...leerBitacora(almacen, analysisId), ev].slice(-MAX_EVENTOS_TICKET);
    almacen?.setItem(claveBitacora(analysisId), JSON.stringify(sig));
  } catch {
    /* sin storage: el recuadro no tendrá historia; el ticket sigue igual */
  }
}

const POR: Record<PorDondeTicket, string> = { velo: "el velo", x: "la X", seguir: "«Seguir leyendo»", escape: "Escape", "si-seguir": "«Sí, seguir leyendo»" };

/** «14:03:27 · abierto (final)», en la hora de Chile. */
export function lineaEvento(ev: EventoTicket, zona = "America/Santiago"): string {
  let hora = "";
  try {
    hora = new Intl.DateTimeFormat("es-CL", { timeZone: zona, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ev.t));
  } catch {
    hora = new Date(ev.t).toISOString().slice(11, 19);
  }
  const que =
    ev.tipo === "abierto" ? `abierto (${ev.motivo ?? "?"})` :
    ev.tipo === "medido" ? `al segundo, ${ev.dentro ? "dentro" : "FUERA"} de la pantalla: arriba ${ev.top} · alto ${ev.alto} de ${ev.pantalla}` :
    ev.tipo === "despedida" ? `a la despedida por ${POR[ev.por ?? "x"]}` :
    ev.tipo === "cerrado" ? `cerrado por ${POR[ev.por ?? "x"]}` :
    `toque en ${POR[ev.por ?? "velo"]} ignorado (recién abierto, o un gesto que empezó antes)`;
  return `${hora} · ${que}`;
}

/** ¿La hoja está dentro de la pantalla? Con un píxel de holgura y alto real. */
export function hojaDentro(r: { top: number; bottom: number; height: number }, pantalla: number): boolean {
  return r.height > 0 && r.top >= -1 && r.bottom <= pantalla + 1;
}
