// ─────────────────────────────────────────────────────────────────────────────
// «POR QUÉ NO SALE» (12-oct-2026). Con `?lqs=1` en la dirección del informe, un recuadro chico abajo dice el
// estado del ticket del pack, para probar en el teléfono sin adivinar: si la oferta está vigente o por qué no,
// si ya se mostró en este navegador, si el banner está en uso, y qué disparador está contando y cuánto le
// falta. Sin el parámetro no se muestra, y nada de esto va a PostHog. Al que no es el dueño solo le dice eso.
// El ticket registra acá cómo leer su estado vivo; el recuadro lo lee cada medio segundo. Puro salvo el registro.
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoTicket } from "./estado-ticket";
import type { MotivoSubida } from "./disparo-ticket";
import { lineaEvento, type EventoTicket } from "./bitacora-ticket";

/** Por qué hay o no hay oferta, según el servidor (`leerOfertaPack`). La vigencia (24 h) la mira el cliente. */
export type MotivoOferta = "ofrecida" | "no-dueno" | "no-nacio-anonimo" | "pack-pagado" | "demo";

/** Lo que el ticket sabe mientras corre. */
export interface EstadoTicketVivo {
  abierto: boolean;
  pestana: boolean;
  disparo: {
    hecho: boolean;
    motivo: MotivoSubida | null;
    pendiente: MotivoSubida | null;
    finalFaltaMs: number | null;
    lecturaMs: number;
    lecturaActiva: boolean;
    pasoLaRecomendacion: boolean;
  } | null;
}

let lector: (() => EstadoTicketVivo) | null = null;

export const diagnosticoTicket = {
  /** El ticket se registra al montar; devuelve con qué soltarse. */
  registrar(fn: () => EstadoTicketVivo): () => void {
    lector = fn;
    return () => {
      if (lector === fn) lector = null;
    };
  },
  leer(): EstadoTicketVivo | null {
    return lector ? lector() : null;
  },
};

/** ¿Lo pidió la dirección? Solo `?lqs=1`. */
export function pideDiagnostico(search: string): boolean {
  try {
    return new URLSearchParams(search).get("lqs") === "1";
  } catch {
    return false;
  }
}

const seg = (ms: number) => `${Math.ceil(ms / 1000)} s`;
const minSeg = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Las líneas del recuadro. Al que el servidor no reconoce como dueño, solo eso. */
export function lineasDiagnostico(p: {
  motivo: MotivoOferta;
  vigente: boolean;
  venceHora: string;
  estadoLocal: EstadoTicket;
  regreso: boolean;
  bannerMontado: boolean;
  bannerLibreEnMs: number;
  /** La hoja con la primera selección abierta: el ticket espera a que se cierre (20-oct-2026). */
  hojaAbierta?: boolean;
  vivo: EstadoTicketVivo | null;
  /** La bitácora del ticket en este navegador (12-oct-2026). */
  eventos?: EventoTicket[];
}): string[] {
  if (p.motivo === "no-dueno") return ["Ticket: no te reconoce como dueño de este informe (sin la cookie de tu navegador o sin tu sesión)."];
  const l: string[] = [];
  if (p.motivo === "demo") l.push("Oferta: no, es el informe de ejemplo.");
  else if (p.motivo === "no-nacio-anonimo") l.push("Oferta: no, este informe no nació anónimo.");
  else if (p.motivo === "pack-pagado") l.push("Oferta: no, el pack de este informe ya está pagado.");
  else l.push(p.vigente ? `Oferta: vigente hasta las ${p.venceHora}.` : `Oferta: vencida a las ${p.venceHora}.`);
  // Los últimos eventos, del más nuevo al más viejo (12-oct-2026): con eso se ve si se abrió, si estuvo en pantalla y
  // por dónde se cerró, aunque la oferta ya no esté.
  const historia = (p.eventos ?? []).slice(-6).reverse().map((e) => `  ${lineaEvento(e)}`);
  const conHistoria = () => (historia.length ? [...l, "Últimos eventos:", ...historia] : l);
  if (p.motivo !== "ofrecida" || !p.vigente) return conHistoria();
  l.push(`En este navegador: ${p.estadoLocal === "nunca" ? "nunca se mostró" : p.estadoLocal === "visto" ? "ya se mostró" : "se mostró y se cerró"}${p.regreso ? " · vuelve: no se abre solo" : ""}.`);
  l.push(p.bannerMontado ? (p.hojaAbierta ? "Banner: la hoja con tus primeros deptos está abierta; el ticket espera a que se cierre." : p.bannerLibreEnMs > 0 ? `Banner: en uso, se libera en ${seg(p.bannerLibreEnMs)}.` : "Banner: libre.") : "Banner: no está en este informe.");
  const v = p.vivo;
  if (!v) {
    l.push("Ticket: no está montado.");
    return conHistoria();
  }
  l.push(`Ticket: ${v.abierto ? "abierto" : "cerrado"} · pestaña ${v.pestana ? "visible" : "oculta"}.`);
  const d = v.disparo;
  if (p.regreso) l.push("Disparadores: no abren nada, ya se mostró (o vuelves con tu sesión); la pestaña lo abre.");
  else if (!d) l.push("Disparadores: sin marca en la página.");
  else if (d.hecho) l.push(`Disparadores: ya subió (${d.motivo ?? "regreso"}).`);
  else {
    if (d.pendiente) l.push(`Disparador «${d.pendiente}» esperando a que se libere el banner.`);
    l.push(d.finalFaltaMs !== null ? `Final: pasó la marca, faltan ${seg(d.finalFaltaMs)}.` : "Final: todavía no pasa la marca de «Tu resultado a 10 años».");
    l.push(`Lectura: ${minSeg(d.lecturaMs)} de 4:00${d.lecturaActiva ? "" : " (en pausa: sin actividad en 30 s)"}.`);
    l.push(`Salida por arriba (solo PC): ${d.pasoLaRecomendacion || d.lecturaMs >= 60_000 ? "habilitada" : "todavía no"}.`);
  }
  return conHistoria();
}
