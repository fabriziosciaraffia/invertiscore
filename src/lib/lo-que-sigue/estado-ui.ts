// ─────────────────────────────────────────────────────────────────────────────
// Un solo borde inferior, una sola cosa según la zona (28-sep-2026, ajuste 2 de Fabrizio):
//   · fuera del cierre → la barra del registro;
//   · en la zona del cierre → el ticket; cerrado, una pestaña chica para volver a él mientras la
//     oferta viva;
//   · al subir, vuelve la barra.
// Estado mínimo compartido entre BannerRegistro (la barra) y TicketPack (ticket, pestaña, zona),
// misma mecánica que carga-global.ts, sin React adentro.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";

export interface EstadoBordeInferior {
  ticketAbierto: boolean;
  zonaCierre: boolean;
}

let estado: EstadoBordeInferior = { ticketAbierto: false, zonaCierre: false };
const oyentes = new Set<() => void>();

function poner(parcial: Partial<EstadoBordeInferior>): void {
  const nuevo = { ...estado, ...parcial };
  if (nuevo.ticketAbierto === estado.ticketAbierto && nuevo.zonaCierre === estado.zonaCierre) return;
  estado = nuevo;
  oyentes.forEach((cb) => cb());
}

export const abrirTicket = () => poner({ ticketAbierto: true });
export const cerrarTicket = () => poner({ ticketAbierto: false });
export const entrarZonaCierre = () => poner({ zonaCierre: true });
export const salirZonaCierre = () => poner({ zonaCierre: false });

export function estadoBorde(): EstadoBordeInferior {
  return estado;
}

export function suscribirBorde(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

const enServidor: EstadoBordeInferior = { ticketAbierto: false, zonaCierre: false };

export function useEstadoBorde(): EstadoBordeInferior {
  return useSyncExternalStore(suscribirBorde, estadoBorde, () => enServidor);
}

/** Qué va abajo ahora mismo. Puro: lo prueba el tier. */
export function queVaAbajo(p: { bannerAtras: boolean; zonaCierre: boolean; ticketAbierto: boolean; ticketYaSubio: boolean; ofertaVigente: boolean }): "nada" | "barra" | "ticket" | "pestaña" {
  if (p.ticketAbierto) return "ticket";
  if (p.zonaCierre) return p.ticketYaSubio && p.ofertaVigente ? "pestaña" : "nada";
  return p.bannerAtras ? "barra" : "nada";
}
