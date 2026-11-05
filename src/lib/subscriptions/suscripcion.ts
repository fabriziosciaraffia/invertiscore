// ─────────────────────────────────────────────────────────────────────────────
// LA SUSCRIPCIÓN, DICHA COMO ES (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio). Módulo PURO: el estado
// que se le muestra a la persona, la fecha de Flow y el copy. Lo fija el tier SUSCRIPCION.
//
//   · Registrar la tarjeta NO es pagar. Flow cobra el primer mes horas después (≈5 h en el caso real del 10-ago). Hasta ese
//     cobro la pantalla y el correo dicen «Tarjeta registrada. Tu plan se activa con el primer cobro, en las próximas
//     horas.»; «Pago confirmado» y los 20 análisis llegan con el cobro (process-charge.ts).
//   · Esperando el primer cobro = la suscripción existe y todavía no tiene período pagado: el alta deja
//     `subscription_ends_at` en null y el primer cobro lo llena con la fecha de Flow.
//   · Flow no reanuda una suscripción cancelada (no hay endpoint): «Volver al Plan Franco» abre una nueva y lo dice.
// ─────────────────────────────────────────────────────────────────────────────
import type { SuscripcionFlow } from "@/lib/subscriptions/flow-vivas";

export const SUSCRIPCION_COPY = {
  tarjetaRegistrada: "Tarjeta registrada. Tu plan se activa con el primer cobro, en las próximas horas.",
  /** «Volver al Plan Franco»: Flow no reanuda la cancelada. */
  planNuevo: "Se abre un plan nuevo y se cobra hoy.",
} as const;

/** Cambiar la tarjeta de un plan en la gracia: adonde llevan «Ver cómo pagar», «Actualiza tu método de pago» y el correo. */
export const RUTA_CAMBIAR_TARJETA = "/cuenta/tarjeta";

export const CAMBIAR_TARJETA_COPY = {
  titulo: "Cambia la tarjeta de tu plan",
  cuerpo: (plan: string, precio: string) =>
    `Registras la tarjeta nueva en Flow. En el mismo paso se cancela allá tu plan con el cobro pendiente y se abre el ${plan} con la tarjeta nueva: ${precio} al mes, con el primer cobro en las próximas horas. No quedan dos planes cobrando.`,
  boton: "Registrar la tarjeta",
  yendo: "Llevándote a Flow…",
  sinPendiente: "Tu plan no tiene un cobro pendiente.",
  verCuenta: "Ver mi cuenta",
  error: "No pudimos abrir el registro de la tarjeta. Intenta de nuevo.",
} as const;

/**
 * ¿Se puede abrir una suscripción? «Contratar el plan» no abre otra si ya hay una, en cualquier estado que no sea cancelada.
 * En la gracia (past_due) solo se entra a cambiar la tarjeta, que cierra la anterior antes de abrir la nueva. null = sí.
 */
export function puedeAbrirPlan(estado: string | null | undefined, cambiarTarjeta: boolean): null | { codigo: "ya-plan" | "cambiar-tarjeta" | "sin-plan-que-cambiar"; error: string } {
  if (estado === "active") return { codigo: "ya-plan", error: "Ya tienes un plan vigente." };
  if (estado === "past_due") return cambiarTarjeta ? null : { codigo: "cambiar-tarjeta", error: "Tu plan tiene un cobro pendiente: cámbiale la tarjeta desde tu cuenta." };
  if (cambiarTarjeta) return { codigo: "sin-plan-que-cambiar", error: "No tienes un plan con un cobro pendiente." };
  return null;
}

/** La vuelta de registrar la tarjeta (register-callback → /payments/return?type=subscription&status=…). */
export const RETORNO_SUSCRIPCION = {
  registrada: { titulo: "Tarjeta registrada.", cuerpo: "Tu plan se activa con el primer cobro, en las próximas horas. Te avisamos por correo cuando se cobre." },
  /** Comprobado: la tarjeta no quedó registrada y no se abrió nada. */
  noRegistrada: { titulo: "La tarjeta no se registró.", cuerpo: "No se hizo ningún cargo." },
  /** Comprobado: no se abrió el plan nuevo porque el anterior no se pudo cerrar (nunca dos vivas). */
  noAbierto: { titulo: "No abrimos tu plan.", cuerpo: "No pudimos cerrar tu plan anterior en Flow, y no abrimos otro para que no te cobren dos. No se hizo ningún cargo nuevo. Intenta de nuevo en unos minutos." },
  /** Comprobado: no se llegó a pedir el alta (sin plan elegido, plan retirado o un error antes de Flow). */
  sinPlan: { titulo: "No abrimos tu plan.", cuerpo: "No se hizo ningún cargo. Intenta de nuevo desde Planes." },
  /** Se pidió el alta y Flow no la confirmó: puede haberse abierto. */
  sinConfirmar: { titulo: "No pudimos confirmar tu plan.", cuerpo: "Si Flow lo cobra, te avisamos por correo." },
  boton: "Ver mi cuenta",
} as const;

export type EstadoRetornoSuscripcion = keyof Omit<typeof RETORNO_SUSCRIPCION, "boton">;

/** El `status` de la URL de vuelta → qué se dice. `success` es el nombre viejo de `registrada` (redirects en vuelo). */
export function estadoRetornoSuscripcion(status: string | null | undefined): EstadoRetornoSuscripcion {
  if (status === "registrada" || status === "success") return "registrada";
  if (status === "error") return "noRegistrada";
  if (status === "no-abierto") return "noAbierto";
  if (status === "sin-plan") return "sinPlan";
  return "sinConfirmar";
}

/** La suscripción existe y todavía no tiene un período pagado: el primer cobro no llegó. */
export function esperaPrimerCobro(fila: { subscription_status?: string | null; subscription_ends_at?: string | null } | null | undefined): boolean {
  if (!fila) return false;
  return (fila.subscription_status === "active" || fila.subscription_status === "past_due") && !fila.subscription_ends_at;
}

/** Desfase de Santiago (minutos, p. ej. −180) en un instante dado. */
function desfaseSantiago(t: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(t));
  const v = (k: string) => Number(partes.find((p) => p.type === k)?.value ?? 0);
  return Math.round((Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - t) / 60000);
}

/**
 * Una fecha de Flow («2026-12-08 00:00:00», hora de Chile) a ISO. Leída como UTC, la medianoche de Chile caía en el día
 * anterior al mostrarla en Chile. null si no parsea.
 */
export function fechaFlowAIso(s: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  let t = comoUtc - desfaseSantiago(comoUtc) * 60000;
  const otra = desfaseSantiago(t); // en el cambio de horario, el desfase del instante resultante manda
  t = comoUtc - otra * 60000;
  return new Date(t).toISOString();
}

/** «Se renueva el …»: la fecha del siguiente cobro según Flow (o el fin del período, si no la trae). */
export function fechaDeRenovacion(s: SuscripcionFlow | null | undefined): string | null {
  if (!s) return null;
  return fechaFlowAIso(s.next_invoice_date) ?? fechaFlowAIso(s.period_end);
}

/** El tope de «Confirmando tu pago…»: a los 90 segundos la pantalla dice qué pasa y ofrece volver. */
export const CONFIRMANDO_TOPE_MS = 90_000;

export const DEMORA_PAGO = {
  titulo: "Flow todavía no confirma tu pago.",
  cuerpo: "Si se cobró, te avisamos por correo. Puedes cerrar esta página.",
  volver: "Volver",
} as const;

/** La consulta del pago falló: no se sabe si se cobró. */
export const PAGO_SIN_CONFIRMAR = {
  titulo: "No pudimos confirmar el pago.",
  cuerpo: "Si se cobró, te avisamos por correo.",
  volver: "Volver",
} as const;
