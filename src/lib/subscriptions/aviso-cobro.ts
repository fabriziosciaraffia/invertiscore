// ─────────────────────────────────────────────────────────────────────────────
// EL AVISO DE COBRO DE FLOW (05-nov-2026, decisión de Fabrizio: «que el cobro se registre al momento»).
//
// Lo que pasaba (registros de Vercel del 9, 22 y 23 de octubre): Flow llama a /api/subscriptions/payment-callback ~4 s
// después del cobro, con la URL correcta (https://refranco.ai). La ruta pedía `payment/getStatus` por POST y el servicio
// es GET: Flow responde a ese POST 400 {"code":105,"message":"No services available"} (medido en el sandbox; por GET el
// mismo token se procesa). La ruta contestaba 503 y Flow NO vuelve a llamar: el cobro quedaba para el cron
// reconcile-subscriptions, a la hora siguiente (~50 min). La URL del plan está bien (y Flow no deja cambiarla por API en
// un plan con suscriptores: plans/edit solo cambia trial_period_days). El arreglo:
//   · la consulta va por GET (en la ruta);
//   · la ruta RESPONDE 200 SIEMPRE que recibe el aviso: lo toma a su cargo (responderAviso);
//   · en segundo plano consulta el pago con esperas crecientes durante ~2,5 min (getStatus y, si falla, getStatusExtended)
//     y lo aplica apenas Flow lo entrega (procesarAvisoDeCobro);
//   · si en esa ventana Flow no lo entrega, corre la conciliación (getPayments del día, el camino que sí funciona);
//   · el cron de cada hora sigue de respaldo.
// Módulo PURO (sin Next ni Supabase): Flow, la base y el reloj entran como piezas. Lo fija el tier AVISO-COBRO, que además
// llama a la ruta de producción con el token de sonda y exige 200.
// ─────────────────────────────────────────────────────────────────────────────

/** Token de sonda: la ruta responde 200 sin trabajo. Lo usa el gate para llamar a producción sin tocar nada. */
export const SONDA_AVISO = "sonda-franco-aviso";

/**
 * Las esperas antes de cada consulta del pago (ms). Suman 150 s. El peor caso cabe en el `maxDuration` de 300 s de la
 * ruta: 150 s de esperas + 7 consultas que agotan los 8 s de Flow dos veces (getStatus y getStatusExtended) = 262 s, más
 * la conciliación con su propio tope (TOPE_CONCILIAR_MS).
 */
export const ESPERAS_AVISO_MS = [0, 3_000, 7_000, 15_000, 25_000, 40_000, 60_000] as const;
/** Lo más que se espera la respuesta de la conciliación (el cron sigue aunque se corte la espera). */
export const TOPE_CONCILIAR_MS = 30_000;
/** El `maxDuration` de la ruta del aviso. */
export const DURACION_RUTA_AVISO_S = 300;

/** Lo que se usa de payment/getStatus. */
export type EstadoPagoFlow = {
  commerceOrder?: string;
  flowOrder?: number | string;
  status?: number | string;
  amount?: number | string;
  payer?: string;
  requestDate?: string;
  optional?: string;
};

export interface PiezasAviso {
  /** El estado del pago en Flow (lanza si Flow no lo entrega). */
  consultar(token: string): Promise<EstadoPagoFlow>;
  /** Aplica el cobro. `listo: false` = vale la pena volver a intentar (p. ej. el dueño todavía no se resuelve). */
  aplicar(estado: EstadoPagoFlow): Promise<{ listo: boolean; motivo?: string }>;
  /** Último recurso dentro de la ventana: la conciliación del día (getPayments). */
  reconciliar(): Promise<unknown>;
  esperar(ms: number): Promise<void>;
  /** Registro (consola y Sentry). */
  avisar(evento: "aplicado" | "sin-estado" | "reconciliar-fallo", datos: Record<string, unknown>): void;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Procesa un aviso de cobro: consulta el pago con esperas crecientes y lo aplica apenas Flow lo entrega. Si en la ventana
 * no lo entrega (o no se pudo aplicar), corre la conciliación. Nunca lanza.
 */
export async function procesarAvisoDeCobro(token: string, p: PiezasAviso): Promise<{ resultado: "aplicado" | "conciliado"; intentos: number; ultimoError?: string }> {
  let intentos = 0;
  let ultimoError: string | undefined;
  for (const espera of ESPERAS_AVISO_MS) {
    if (espera > 0) await p.esperar(espera);
    intentos++;
    let estado: EstadoPagoFlow;
    try {
      estado = await p.consultar(token);
    } catch (e) {
      ultimoError = mensaje(e);
      continue;
    }
    try {
      const r = await p.aplicar(estado);
      if (r.listo) {
        p.avisar("aplicado", { intentos });
        return { resultado: "aplicado", intentos };
      }
      ultimoError = r.motivo ?? "no aplicado";
    } catch (e) {
      ultimoError = mensaje(e);
    }
  }
  p.avisar("sin-estado", { intentos, ultimoError });
  try {
    await p.reconciliar();
  } catch (e) {
    p.avisar("reconciliar-fallo", { error: mensaje(e) });
  }
  return { resultado: "conciliado", intentos, ultimoError };
}

/**
 * La respuesta a Flow: SIEMPRE 200. Con token, programa el trabajo en segundo plano y responde; sin token (o con un cuerpo
 * que no se lee) también 200: no hay nada que Flow pueda reenviar distinto. Si no se pudo programar, el cron lo recoge.
 */
export async function responderAviso(request: Request, programar: (token: string) => void): Promise<{ status: 200; body: { status: string } }> {
  let token: string | null = null;
  try {
    const datos = await request.formData();
    const t = datos.get("token");
    token = typeof t === "string" && t.trim() ? t.trim() : null;
  } catch {
    token = null;
  }
  if (!token) return { status: 200, body: { status: "sin-token" } };
  if (token === SONDA_AVISO) return { status: 200, body: { status: "sonda" } };
  try {
    programar(token);
  } catch {
    return { status: 200, body: { status: "recibido-sin-programar" } };
  }
  return { status: 200, body: { status: "recibido" } };
}
