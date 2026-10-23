// ─────────────────────────────────────────────────────────────────────────────
// EL BLOQUE DE ARRIBA DEL DASHBOARD (17-oct-2026, decisión de Fabrizio: el dashboard vende, no lista). Una sola
// jerarquía: arriba, en banner, lo más importante según el estado de la persona —un bloque, un botón—; debajo, en
// segundo nivel, «Invita a alguien»; después, plano, el saldo, el perfil y los informes. Puro: lo prueba el tier CASA.
//
// El orden manda: (1) si tiene selección de esta semana, «Tu selección de esta semana», con sus deptos resumidos y «Ver
// tu selección»; (2) si no le quedan análisis, el pack de tres —y MIENTRAS EL TICKET ESTÉ VIVO, con o sin saldo, la tarjeta
// de la oferta (22-oct-2026, decisión de Fabrizio: una compra suelta no apaga el ticket; con saldo dice «3 más por
// $14.990»)—; (3) si tiene un análisis de regalo sin usar, «Tienes un análisis de regalo» (con el plan no: analizar no
// descuenta). Sin nada de eso, el bloque lo lleva a analizar.
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { ResumenBloque } from "@/lib/guia/seleccion-casa";

export type BloqueArriba =
  | { tipo: "seleccion"; bloques: ResumenBloque[] }
  | { tipo: "pack" }
  | { tipo: "regalo"; vence: string | null }
  | { tipo: "analizar" };

export function bloqueDeArriba(p: {
  seleccion: ResumenBloque[] | null;
  saldo: EstadoSaldo;
  /** Análisis de regalo vivos (DatosSaldo.regaloRestante) y cuándo vence el primero. */
  regaloRestante: number;
  regaloVence: string | null;
  /** El ticket de la cuenta nueva, vivo (menos de 24 horas, sin el pack pagado). */
  ticket?: boolean;
}): BloqueArriba {
  if (p.seleccion && p.seleccion.length > 0) return { tipo: "seleccion", bloques: p.seleccion };
  if (p.saldo.tipo === "sin" || (p.ticket && p.saldo.tipo !== "plan")) return { tipo: "pack" };
  // Con el plan, analizar no descuenta: un regalo no cambia nada y no se anuncia.
  if (p.saldo.tipo === "plan") return { tipo: "analizar" };
  if (p.regaloRestante > 0) return { tipo: "regalo", vence: p.regaloVence };
  return { tipo: "analizar" };
}

export const CASA_ARRIBA = {
  /** «Tu selección de esta semana» y «Ver tu selección» son los de SELECCION_CASA (seleccion-casa.ts). */
  seleccionBajada: "Los deptos publicados que Franco revisó con tus números.",
  pack: {
    titulo: "Analiza tus próximos deptos.",
    // La bajada y el botón son los del saldo vacío (casa-copy.ts › CASA.sin), el pack de tres.
  },
  regalo: {
    // El título es el de CASA.regalo.titulo; la bajada, cuándo vence.
    bajada: "Úsalo en el depto que quieras.",
  },
  analizar: {
    titulo: "Analiza tu próximo depto.",
    bajada: "Franco te dice si conviene con tus números.",
    boton: "Analizar un depto",
  },
} as const;
