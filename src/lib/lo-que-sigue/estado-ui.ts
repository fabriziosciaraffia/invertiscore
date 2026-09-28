// Un solo borde inferior en el teléfono: la barra del registro y el ticket del pack se turnan.
// Estado mínimo compartido (misma mecánica que carga-global.ts), sin React adentro.
import { useSyncExternalStore } from "react";

let ticketAbierto = false;
const oyentes = new Set<() => void>();

function avisar(): void {
  oyentes.forEach((cb) => cb());
}

export function abrirTicket(): void {
  if (ticketAbierto) return;
  ticketAbierto = true;
  avisar();
}

export function cerrarTicket(): void {
  if (!ticketAbierto) return;
  ticketAbierto = false;
  avisar();
}

export function hayTicketAbierto(): boolean {
  return ticketAbierto;
}

export function suscribirTicket(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function useTicketAbierto(): boolean {
  return useSyncExternalStore(suscribirTicket, hayTicketAbierto, () => false);
}
