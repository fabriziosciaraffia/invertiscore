// ─────────────────────────────────────────────────────────────────────────────
// NO COBRAR CUANDO EL INFORME CONTRADICE LO QUE MOSTRAMOS (23-nov-2026, decisión de Fabrizio tras el caso e828d352: el correo
// semanal mostró un depto como Comprar 80 con una evaluación de la noche desactualizada, la persona pagó y el informe dio Ajustar 63).
//
// La regla, en dos tiempos:
//   · ANTES DE COBRAR (y antes de mandar a pagar): «Analizar este» ya arma el informe con los datos de hoy antes del cobro; con ese
//     mismo cuerpo se corre el motor. Si el veredicto de hoy es otro que el MOSTRADO, la ruta responde «cambio» sin reclamar, sin
//     cobrar y sin mandar a pagar: «Este depto cambió desde que te lo mostramos: ahora sale X. ¿Quieres analizarlo igual?». Si la
//     persona sigue, se cobra normal y el informe queda marcado con que se le avisó.
//   · EL RESPALDO: si por cualquier camino el informe se crea con un veredicto distinto al mostrado sin que la persona haya sido
//     avisada, el crédito vuelve solo (fuente `devolucion_cobro`), el informe lo dice arriba y queda una fila en el registro del admin.
//
// Qué cuenta (decisiones de Fabrizio, 23-nov-2026):
//   · DISTINTO es otro veredicto, en cualquier dirección. Otro puntaje con el mismo veredicto se cobra.
//   · LO MOSTRADO se reconstruye siempre en el servidor (mostrado-servidor.ts): el ítem del correo por su token, o la misma sonda que
//     dibujan el mapa, Explorar y el pop-up, con el mismo pie, plazo y tasa. Nunca lo que mande el navegador.
//   · VENTANA: cuenta lo mostrado en los últimos 14 días. Más viejo, se analiza y se cobra normal, sin aviso.
//   · Invierte no cobra, pero lleva el mismo aviso. Y si el pago ya se hizo (la vuelta del pago), el crédito comprado no se gasta:
//     queda en la cuenta y la persona decide si lo usa en ese depto o en otro.
// Puro: sin Supabase ni React. Lo prueba el tier COBRO-MOSTRADO.
// ─────────────────────────────────────────────────────────────────────────────
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";

export const VENTANA_MOSTRADO_DIAS = 14;
const DIA_MS = 86_400_000;

/** Lo que la persona vio de este depto, reconstruido en el servidor. */
export interface Mostrado {
  veredicto: string;
  score: number | null;
  /** Cuándo se le mostró (ISO): el envío del correo, o ahora para lo que dibuja la pantalla en el momento. */
  at: string;
  /** De dónde salió: el ítem del correo (semanal o inmediato) o la sonda de la pantalla (mapa, Explorar, pop-up, guía, Invierte). */
  fuente: "correo" | "pantalla";
}

export interface VeredictoHoy {
  veredicto: string | null;
  score: number | null;
}

const norm = (v: string | null | undefined) => (typeof v === "string" ? v.trim().toUpperCase() : "");

/** ¿Lo mostrado cuenta todavía? Dentro de los 14 días. Sin fecha legible, no cuenta. */
export function mostradoVigente(m: Mostrado | null | undefined, ahora: Date = new Date()): m is Mostrado {
  if (!m || !norm(m.veredicto)) return false;
  const t = Date.parse(m.at);
  if (!Number.isFinite(t)) return false;
  return ahora.getTime() - t <= VENTANA_MOSTRADO_DIAS * DIA_MS;
}

/** ¿Otro veredicto? Solo el veredicto, en cualquier dirección; sin veredicto de hoy, no hay con qué comparar. */
export function cambioDeVeredicto(mostrado: Mostrado | null | undefined, hoy: string | null | undefined): boolean {
  return !!mostrado && !!norm(hoy) && !!norm(mostrado.veredicto) && norm(hoy) !== norm(mostrado.veredicto);
}

/**
 * ANTES DE COBRAR: «avisar» si lo mostrado vigente tiene otro veredicto que el de hoy y la persona todavía no dijo que sigue.
 * Con `aceptoCambio`, sigue (y el informe queda marcado como avisado).
 */
export function decidirAntesDeCobrar(p: { mostrado: Mostrado | null; hoy: VeredictoHoy | null; aceptoCambio: boolean; ahora?: Date }): "seguir" | "avisar" {
  if (!mostradoVigente(p.mostrado, p.ahora)) return "seguir";
  if (!cambioDeVeredicto(p.mostrado, p.hoy?.veredicto)) return "seguir";
  return p.aceptoCambio ? "seguir" : "avisar";
}

/** ¿Se le avisó? Lo que queda en el informe cuando la persona siguió tras el aviso. */
export function avisadoDelCambio(p: { mostrado: Mostrado | null; hoy: VeredictoHoy | null; aceptoCambio: boolean; ahora?: Date }): boolean {
  return p.aceptoCambio && mostradoVigente(p.mostrado, p.ahora) && cambioDeVeredicto(p.mostrado, p.hoy?.veredicto);
}

/**
 * EL RESPALDO, con el informe ya creado: «devolver» si su veredicto es otro que lo mostrado vigente y no hubo aviso. Si el cobro no
 * gastó nada (Invierte, ilimitado), no hay qué devolver: «nada».
 */
export function decidirTrasCrear(p: { mostrado: Mostrado | null; informe: string | null; avisado: boolean; cobroGasto: boolean; ahora?: Date }): "cobrado" | "devolver" | "nada" {
  if (p.avisado || !mostradoVigente(p.mostrado, p.ahora) || !cambioDeVeredicto(p.mostrado, p.informe)) return "cobrado";
  return p.cobroGasto ? "devolver" : "nada";
}

export const COBRO_MOSTRADO_COPY = {
  /** «Este depto cambió desde que te lo mostramos: ahora sale Ajustar. ¿Quieres analizarlo igual?» */
  cambio: (hoy: string) => `Este depto cambió desde que te lo mostramos: ahora sale ${etiquetaVeredicto(hoy, "nombre")}. ¿Quieres analizarlo igual?`,
  /** Con el pago ya hecho (la vuelta del pago): el análisis comprado queda en la cuenta. */
  pagadoQueda: "Tu análisis queda en tu cuenta: úsalo en este depto o en otro.",
  analizarIgual: "Analizarlo igual",
  usarAca: "Usarlo en este depto",
  volver: "Volver",
  elegirOtro: "Elegir otro depto",
  /** La línea de arriba del informe del respaldo. */
  devuelto: "No te cobramos este análisis: salió distinto a lo que te mostramos.",
} as const;

/** Lo que guarda el informe (`input_data.origenAviso`) para decirlo y para auditarlo. */
export interface MarcaCambio {
  mostrado: { veredicto: string; score: number | null; at: string; fuente: Mostrado["fuente"] };
  hoy: { veredicto: string | null; score: number | null };
}

/** «Este depto cambió desde que te lo mostramos: salía Comprar, ahora sale Ajustar.» */
export const lineaCambioAvisado = (m: MarcaCambio) =>
  `Este depto cambió desde que te lo mostramos: salía ${etiquetaVeredicto(m.mostrado.veredicto, "nombre")}, ahora sale ${etiquetaVeredicto(m.hoy.veredicto, "nombre")}.`;

/**
 * La línea de arriba del informe: si el cobro se devolvió, «No te cobramos este análisis…»; si la persona siguió tras el aviso (o
 * en el flujo de Invierte, que no cobra y prepara en segundo plano), qué cambió. Sin marca, nada.
 */
export function lineaCambioPortada(inputData: unknown): string | null {
  const o = (inputData as { origenAviso?: { cobroDevuelto?: unknown; cambioAvisado?: unknown } } | null | undefined)?.origenAviso;
  if (!o) return null;
  if (o.cobroDevuelto && typeof o.cobroDevuelto === "object") return COBRO_MOSTRADO_COPY.devuelto;
  const a = o.cambioAvisado as MarcaCambio | undefined;
  if (a && typeof a === "object" && a.mostrado?.veredicto && a.hoy?.veredicto) return lineaCambioAvisado(a);
  return null;
}
