// ─────────────────────────────────────────────────────────────────────────────
// UNA SOLA SUSCRIPCIÓN VIVA EN FLOW (05-nov-2026, auditoría de promesas parte 2, decisión de Fabrizio).
//
// Hasta hoy «Ver cómo pagar» llevaba a /pricing → «Contratar el plan» → register-callback creaba OTRA suscripción en Flow
// y pisaba `subscription_id`: la vieja quedaba viva, y si cobraba, payment-callback no le encontraba dueño. Y expirar la
// gracia o cancelar sin `subscription_id` solo tocaba la base.
//
// Acá vive la regla, en un solo lugar y sin red: Flow entra como una PUERTA (PuertaFlow), así el tier SUSCRIPCION la ejercita
// con una puerta falsa que lleva la cuenta de qué quedó vivo. La puerta real está en flow-puerta.ts.
//
// Lo que dice la API de Flow (apiFlow.yaml 3.0.1, leído el 05-nov-2026):
//   · `customer/getSubscriptions` lista las suscripciones de un cliente: así se encuentran aunque falte `subscription_id`.
//   · el estado de una suscripción: 0 inactiva (no iniciada), 1 activa, 2 en trial, 4 cancelada. Viva = todo lo que no es 4.
//   · `subscription/cancel` con `at_period_end` 0 (ahora) o 1 (al fin del período). NO hay endpoint para reanudar una
//     suscripción cancelada: «Volver al Plan Franco» siempre abre una nueva (y lo dice).
//   · `next_invoice_date` es la fecha del siguiente cobro: de ahí sale «Se renueva el …».
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de una suscripción en Flow. */
export const ESTADO_FLOW = { inactiva: 0, activa: 1, trial: 2, cancelada: 4 } as const;

/** Lo que se usa del objeto Subscription de Flow. */
export interface SuscripcionFlow {
  subscriptionId: string;
  status?: number | string | null;
  customerId?: string | null;
  created?: string | null;
  next_invoice_date?: string | null;
  period_end?: string | null;
  subscription_end?: string | null;
  cancel_at_period_end?: number | string | null;
}

/** Flow por dentro: lo único que la regla necesita. */
export interface PuertaFlow {
  /** Todas las suscripciones del cliente (vivas y canceladas). */
  suscripcionesDe(customerId: string): Promise<SuscripcionFlow[]>;
  leer(subscriptionId: string): Promise<SuscripcionFlow>;
  cancelar(subscriptionId: string, inmediata: boolean): Promise<SuscripcionFlow>;
}

export interface PuertaFlowConAlta extends PuertaFlow {
  crear(p: { planId: string; customerId: string; urlCallback: string }): Promise<SuscripcionFlow>;
}

export function estaViva(s: SuscripcionFlow | null | undefined): boolean {
  return !!s?.subscriptionId && Number(s.status) !== ESTADO_FLOW.cancelada;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface Cierre {
  /** true si todo lo que estaba vivo quedó cancelado (o programado al fin del período, cuando se pidió así). */
  ok: boolean;
  /** Las que estaban vivas antes de cerrar. */
  vivas: string[];
  canceladas: string[];
  fallidas: Array<{ id: string; error: string }>;
  /** La lista del cliente no se pudo leer: no se sabe si había otras vivas. */
  lecturaFallida: string | null;
  /** Fin del período de la que se canceló al final del período (fecha de Flow, sin convertir). */
  finPeriodo: string | null;
}

/**
 * Cancela en Flow todo lo vivo de una persona: lo que lista su cliente y, además, la suscripción guardada (aunque la lista
 * falle). `alFinDelPeriodo` nombra la ÚNICA que se cancela al terminar su período (la pagada de quien cancela su plan);
 * todas las demás, ahora. `exigirLectura`: sin la lista del cliente no se da por cerrado (antes de abrir una nueva hace
 * falta saber que no queda otra viva).
 */
export async function cerrarVivas(
  flow: PuertaFlow,
  p: { customerId: string | null; subscriptionId: string | null; alFinDelPeriodo?: string | null; exigirLectura?: boolean },
): Promise<Cierre> {
  const candidatas = new Map<string, SuscripcionFlow>();
  let lecturaFallida: string | null = null;
  if (p.customerId) {
    try {
      for (const s of await flow.suscripcionesDe(p.customerId)) if (estaViva(s)) candidatas.set(s.subscriptionId, s);
    } catch (e) {
      lecturaFallida = mensaje(e);
    }
  } else if (p.exigirLectura) {
    lecturaFallida = "sin cliente en Flow";
  }
  // La guardada se mira aunque la lista haya fallado: si no se puede leer, se intenta cancelar igual (puede estar viva).
  if (p.subscriptionId && !candidatas.has(p.subscriptionId)) {
    try {
      const s = await flow.leer(p.subscriptionId);
      if (estaViva(s)) candidatas.set(p.subscriptionId, s);
    } catch {
      candidatas.set(p.subscriptionId, { subscriptionId: p.subscriptionId });
    }
  }

  const canceladas: string[] = [];
  const fallidas: Array<{ id: string; error: string }> = [];
  let finPeriodo: string | null = null;
  for (const s of Array.from(candidatas.values())) {
    const alFinal = !!p.alFinDelPeriodo && s.subscriptionId === p.alFinDelPeriodo;
    try {
      const r = await flow.cancelar(s.subscriptionId, !alFinal);
      // Flow devuelve el objeto Subscription; sin su id, la respuesta no confirma nada.
      if (!r?.subscriptionId) {
        fallidas.push({ id: s.subscriptionId, error: "Flow no confirmó la cancelación" });
        continue;
      }
      canceladas.push(s.subscriptionId);
      if (alFinal) finPeriodo = r.subscription_end || r.period_end || null;
    } catch (e) {
      fallidas.push({ id: s.subscriptionId, error: mensaje(e) });
    }
  }
  const ok = fallidas.length === 0 && !(p.exigirLectura && lecturaFallida);
  return { ok, vivas: Array.from(candidatas.keys()), canceladas, fallidas, lecturaFallida, finPeriodo };
}

export type Alta =
  | { ok: true; suscripcion: SuscripcionFlow; cierre: Cierre }
  /** `no-se-cerro-la-anterior` / `no-se-pudo-leer`: no se creó nada, no hay cargo nuevo. `sin-confirmar`: se pidió el alta
   *  y Flow no la confirmó (puede haberse creado). */
  | { ok: false; motivo: "no-se-cerro-la-anterior" | "no-se-pudo-leer" | "sin-confirmar"; cierre: Cierre; error?: string };

/**
 * Abre la suscripción nueva SOLO después de cerrar las vivas. Si alguna no se pudo cancelar —o no se pudo leer la lista
 * del cliente—, no crea: nunca quedan dos vivas. El orden importa: cerrar primero puede dejar a la persona sin plan un
 * momento si el alta falla, pero nunca con dos cobrando.
 */
export async function abrirPlanUnico(
  flow: PuertaFlowConAlta,
  p: { customerId: string; subscriptionId: string | null; planId: string; urlCallback: string },
): Promise<Alta> {
  const cierre = await cerrarVivas(flow, { customerId: p.customerId, subscriptionId: p.subscriptionId, exigirLectura: true });
  if (!cierre.ok) return { ok: false, motivo: cierre.lecturaFallida ? "no-se-pudo-leer" : "no-se-cerro-la-anterior", cierre };
  try {
    const suscripcion = await flow.crear({ planId: p.planId, customerId: p.customerId, urlCallback: p.urlCallback });
    if (!suscripcion?.subscriptionId) return { ok: false, motivo: "sin-confirmar", cierre, error: "Flow no devolvió subscriptionId" };
    return { ok: true, suscripcion, cierre };
  } catch (e) {
    return { ok: false, motivo: "sin-confirmar", cierre, error: mensaje(e) };
  }
}

/**
 * Cerrar TODO ahora: la gracia vencida (cron expire-grace) y la cuenta que pide eliminarse. Sin cliente ni suscripción en
 * Flow no hay nada allá. Sin `subscription_id`, la lista del cliente es la única forma de saber qué cerrar: si no se puede
 * leer, no se da por cerrado (el cron reintenta al día siguiente).
 */
export async function cerrarTodo(flow: PuertaFlow, p: { customerId: string | null; subscriptionId: string | null }): Promise<Cierre> {
  if (!p.customerId && !p.subscriptionId) {
    return { ok: true, vivas: [], canceladas: [], fallidas: [], lecturaFallida: null, finPeriodo: null };
  }
  return cerrarVivas(flow, { customerId: p.customerId, subscriptionId: p.subscriptionId, exigirLectura: !p.subscriptionId });
}

/**
 * «Cancelar el plan». La pagada y vigente se cancela al fin de su período (ya la pagó); en la gracia, o esperando el primer
 * cobro, ahora (si no, Flow seguiría intentando cobrarla). Sin `subscription_id` se busca por el cliente: si hay UNA viva,
 * esa es la del plan.
 */
export async function cancelarPlan(
  flow: PuertaFlow,
  p: { customerId: string | null; subscriptionId: string | null; alFinDelPeriodo: boolean },
): Promise<Cierre> {
  let principal = p.subscriptionId;
  if (!principal && p.alFinDelPeriodo && p.customerId) {
    try {
      const vivas = (await flow.suscripcionesDe(p.customerId)).filter(estaViva);
      if (vivas.length === 1) principal = vivas[0].subscriptionId;
    } catch {
      /* cerrarVivas vuelve a leer y lo informa */
    }
  }
  return cerrarVivas(flow, {
    customerId: p.customerId,
    subscriptionId: p.subscriptionId,
    alFinDelPeriodo: p.alFinDelPeriodo ? principal : null,
  });
}
