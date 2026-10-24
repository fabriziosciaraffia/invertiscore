// ─────────────────────────────────────────────────────────────────────────────
// LAS REGLAS DEL DASHBOARD (24-oct-2026, mockup docs/puerta-b-mockups/3b-dashboard.html): la parte pura, sin servidor ni
// navegador (la prueba el tier PUERTA-B-DASHBOARD).
//   · LA OFERTA ROJA de una fila («Solo para cuentas nuevas · vence mañana 11:17 · 3 análisis por $14.990 · Aprovechar»)
//     va mientras el ticket esté vivo —la cuenta tiene menos de 24 horas y no pagó el pack—, CON O SIN SALDO (22-oct-2026,
//     decisión de Fabrizio: una compra suelta no lo apaga). Con el plan no: analizar no descuenta.
//   · LAS DOS PREGUNTAS PENDIENTES del perfil («¿Cómo lo arriendas?» y «¿Cuándo piensas comprar?») se le hacen solo a
//     quien entró por /deptos (la puerta B) o por una invitación (la C): a quien entró con su informe (la A) ya se las
//     sabemos, y al orgánico (la D) también le salió un informe. Y solo las que no contestó.
//   · «SE RENUEVA…»: con «Quiero comprar ya» la selección es diaria (lib/guia/inmediato.ts › frecuenciaSeleccion); con las
//     otras respuestas, el lunes.
// ─────────────────────────────────────────────────────────────────────────────
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { Puerta } from "@/lib/atribucion-puerta";
import type { Horizonte, Modalidad } from "@/lib/perfil-busqueda";
import { FRECUENCIA_COPY, frecuenciaSeleccion } from "@/lib/guia/inmediato";
import { textoRenueva } from "@/lib/guia/renovacion";

/** ¿Va la oferta roja? Mientras el ticket viva, con o sin saldo; con el plan, nunca. */
export function ofertaEnCasa(p: { ticket: boolean; saldo: EstadoSaldo }): boolean {
  return p.ticket && p.saldo.tipo !== "plan";
}

export type PreguntaPendiente = "modalidad" | "cuando";

/** Las preguntas que el perfil le debe hacer a esta cuenta: ninguna a quien entró con su informe. */
export function preguntasPendientes(p: { puerta: Puerta | null; modalidad: Modalidad | null; horizonte: Horizonte | null }): PreguntaPendiente[] {
  if (p.puerta !== "B" && p.puerta !== "C") return [];
  const out: PreguntaPendiente[] = [];
  if (p.modalidad == null) out.push("modalidad");
  if (p.horizonte == null) out.push("cuando");
  return out;
}

/** La etiqueta de la fila plegada: «2 preguntas pendientes» / «1 pregunta pendiente»; null sin pendientes. */
export function etiquetaPendientes(n: number): string | null {
  return n <= 0 ? null : n === 1 ? "1 pregunta pendiente" : `${n} preguntas pendientes`;
}

/** «Se renueva el lunes 27.» o, con «Quiero comprar ya», «Se renueva todos los días.» */
export function lineaRenueva(horizonte: Horizonte | null, ahora: Date = new Date()): string {
  return frecuenciaSeleccion(horizonte) === "diaria" ? FRECUENCIA_COPY.renuevaDiaria : textoRenueva(ahora);
}

/** La píldora del saldo, arriba a la derecha: qué dice y si lleva el enlace a los planes. */
export function pildoraSaldo(s: EstadoSaldo): { texto: string; planes: boolean } {
  switch (s.tipo) {
    case "plan": return { texto: "Plan activo", planes: false };
    case "regalo": return { texto: "1 análisis de regalo", planes: false };
    case "con": return { texto: s.n === 1 ? "Te queda 1" : `Te quedan ${s.n}`, planes: false };
    default: return { texto: "Sin análisis", planes: true };
  }
}
