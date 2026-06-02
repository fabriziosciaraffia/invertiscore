/**
 * Fuente única de verdad de los 7 artefactos de pago hacia Flow.cl (Phase 2.39).
 * Consolida lo que antes vivía hardcodeado en payments/create (pro/pack3).
 *
 * - amount = lo que Flow cobra por transacción. Los planes ANUALES cobran el
 *   total del año up-front (annualPerMonth × 12), NO el precio mensual.
 * - planId de los 6 planes recurrentes se rellena en 2.5 al crearlos en Flow.
 * - interval anual = 4 es tentativo; se confirma contra plans/create en sandbox (2.5).
 * - capacity es por ciclo MENSUAL aun en planes anuales (el otorgamiento mensual
 *   lo maneja 2.6, no este archivo).
 */

export type FlowProductKey =
  | "single"
  | "plan10_mensual" | "plan10_annual"
  | "plan50_mensual" | "plan50_annual"
  | "unlimited_mensual" | "unlimited_annual";

export type FlowProduct = {
  kind: "one_time" | "recurring";
  amount: number;            // CLP cobrado por Flow en cada transacción
  subject: string;           // descripción visible en Flow
  // recurring only:
  planId?: string | null;    // se rellena en 2.5 al crear el plan en sandbox/prod
  interval?: 3 | 4;          // 3=mensual, 4=anual (CONFIRMAR valor anual en sandbox)
  // capacidad de créditos:
  plan?: "single" | "plan10" | "plan50" | "unlimited";  // active_plan en user_credits
  billing?: "monthly" | "annual" | null;
  capacity?: number | null;  // créditos por ciclo mensual; null si is_unlimited
  isUnlimited?: boolean;
};

export const FLOW_PRODUCTS: Record<FlowProductKey, FlowProduct> = {
  single: {
    kind: "one_time", amount: 9990, subject: "Franco — 1 análisis",
    plan: "single", billing: null, capacity: 1,
  },
  plan10_mensual: {
    kind: "recurring", amount: 39990, subject: "Franco Plan 10 — mensual",
    planId: "franco_plan10_mensual", interval: 3, plan: "plan10", billing: "monthly", capacity: 10,
  },
  plan10_annual: {
    kind: "recurring", amount: 395880, subject: "Franco Plan 10 — anual",
    planId: "franco_plan10_anual", interval: 4, plan: "plan10", billing: "annual", capacity: 10,
  },
  plan50_mensual: {
    kind: "recurring", amount: 149990, subject: "Franco Plan 50 — mensual",
    planId: "franco_plan50_mensual", interval: 3, plan: "plan50", billing: "monthly", capacity: 50,
  },
  plan50_annual: {
    kind: "recurring", amount: 1499880, subject: "Franco Plan 50 — anual",
    planId: "franco_plan50_anual", interval: 4, plan: "plan50", billing: "annual", capacity: 50,
  },
  unlimited_mensual: {
    kind: "recurring", amount: 399990, subject: "Franco Ilimitado — mensual",
    planId: "franco_unlimited_mensual", interval: 3, plan: "unlimited", billing: "monthly",
    capacity: null, isUnlimited: true,
  },
  unlimited_annual: {
    kind: "recurring", amount: 3959880, subject: "Franco Ilimitado — anual",
    planId: "franco_unlimited_anual", interval: 4, plan: "unlimited", billing: "annual",
    capacity: null, isUnlimited: true,
  },
};

/**
 * Resuelve el planId real a usar contra Flow según el entorno. Flow QUEMA el
 * planId para siempre (error 501 "planId already used": no se puede borrar y
 * recrear con el mismo string), así que QA y prod necesitan strings distintos.
 *
 * planId final = base + FLOW_PLAN_SUFFIX.
 *   prod → FLOW_PLAN_SUFFIX vacío → usa el base tal cual (franco_plan10_mensual)
 *   QA   → FLOW_PLAN_SUFFIX="_qa1" → franco_plan10_mensual_qa1
 *
 * El sufijo debe ser el MISMO al crear el plan (script) y al suscribir, o Flow
 * no encontrará el plan. El base SIN sufijo es el que vive en FLOW_PRODUCTS.
 */
export function resolvePlanId(basePlanId: string): string {
  return `${basePlanId}${process.env.FLOW_PLAN_SUFFIX ?? ""}`;
}
