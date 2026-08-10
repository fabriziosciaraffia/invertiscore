/**
 * Lo que Flow retiene por transacción, leído del dato real.
 *
 * Flow SÍ devuelve la comisión: viene en `payment_data.paymentData` de la
 * respuesta de `payment/getStatus`, con este desglose exacto:
 *
 *     amount   bruto que pagó el usuario
 *     fee      comisión de Flow, sin IVA
 *     taxes    IVA sobre esa comisión (= round(fee × 0,19))
 *     balance  lo que Flow deposita  →  amount − fee − taxes
 *
 * La identidad cierra al peso en todas las filas que tienen el bloque. Por eso
 * acá NO se calcula el neto: se lee. El porcentaje se usa solo como último
 * recurso, para las filas viejas donde el bloque no quedó guardado.
 *
 * MISMA REGLA QUE `costo-ia.ts`: ausencia de dato no es cero, y un valor
 * estimado nunca se mezcla con uno medido sin decirlo. `ComisionFlow.fuente`
 * viaja con cada cifra justamente para que la UI pueda distinguirlas.
 */

/**
 * Tasa de respaldo, SOLO para filas sin el bloque de Flow.
 *
 * Es un fallback, no la fuente: la tarifa observada ya cambió una vez (3,19% →
 * 2,89% entre el 10 y el 12 de junio de 2026), así que congelarla como fuente
 * primaria haría mentir a todo el histórico anterior al cambio. Se sobreescribe
 * con `FLOW_FEE_PCT` en el entorno (en porcentaje: "2.89").
 *
 * No hay tabla de tarifas por producto a propósito: en los pagos observados
 * Webpay, OneClick y Cargo automático cobran exactamente lo mismo, y modelar una
 * diferencia que no existe es estructura que hay que mantener a cambio de nada.
 */
export const TASA_FLOW = (Number(process.env.FLOW_FEE_PCT) || 2.89) / 100;

/** IVA chileno, aplicado sobre la comisión (no sobre el bruto). */
export const IVA = 0.19;

/**
 * De dónde salió la cifra.
 *
 * - `medido`    — leído de `payment_data.paymentData`. Es el peso exacto.
 * - `estimado`  — la fila no trae el bloque; se aplicó TASA_FLOW.
 * - `sin-cobro` — la fila no representa un cobro propio (ver `esAltaSuscripcion`).
 */
export type FuenteComision = "medido" | "estimado" | "sin-cobro";

export interface ComisionFlow {
  /** Bruto cobrado al usuario, en CLP. */
  bruto: number;
  /** Comisión de Flow sin IVA. */
  fee: number;
  /** IVA sobre la comisión. */
  iva: number;
  /** Lo que Flow se queda: fee + iva. */
  retenido: number;
  /** Lo que Flow deposita. */
  neto: number;
  fuente: FuenteComision;
  /** Medio de pago que reporta Flow (Webpay, OneClick, Cargo automático). */
  medio: string | null;
}

/** Lo mínimo que hay que traer de `payments` para calcular la comisión. */
export interface PagoParaComision {
  amount: number | null;
  payment_data: unknown;
  commerce_order?: string | null;
}

/** Las columnas que hay que pedirle a `payments`. */
export const COLUMNAS_COMISION = "amount, payment_data, commerce_order";

/** Bloque que Flow entrega dentro de `payment_data`. Todos sus valores son strings. */
interface BloqueFlow {
  fee?: unknown;
  taxes?: unknown;
  amount?: unknown;
  balance?: unknown;
  media?: unknown;
}

/** Los montos de Flow llegan como `"289.00"`. Cualquier cosa no numérica → null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * ¿Es la fila del ALTA de una suscripción, y no un cobro?
 *
 * `subscriptions/register-callback` crea una fila `franco-sub-<subscriptionId>`
 * en el momento en que el usuario registra la tarjeta. Ahí todavía NO hubo
 * cobro: la primera invoice que devuelve Flow viene en `status: 1` (pendiente),
 * `attemped: 0` y sin `flowOrder`. El cobro llega después, por
 * `subscriptions/payment-callback`, y crea su PROPIA fila
 * `franco-sub-pay-<flowOrder>` — esa sí con el bloque de comisión.
 *
 * Estimarle comisión al alta sería inventar una retención que nunca ocurrió, y
 * además contaría el mismo dinero dos veces.
 */
export function esAltaSuscripcion(p: PagoParaComision): boolean {
  const pd = comoObjeto(p.payment_data);
  if (!pd) return false;
  // Tiene identidad de suscripción, no trae el bloque de pago, y su
  // commerce_order no es el del cobro (`franco-sub-pay-…`).
  if (!pd.subscriptionId || comoObjeto(pd.paymentData)) return false;
  return !(p.commerce_order ?? "").includes("-pay-");
}

/**
 * Comisión de UN pago.
 *
 * Se prefiere el `balance` de Flow como neto cuando está: es el número que Flow
 * declara que va a depositar. `fee`/`taxes` se leen aparte para poder mostrar el
 * desglose, pero si alguno faltara el neto no se recalcula a mano.
 */
export function leerComision(p: PagoParaComision): ComisionFlow {
  const bruto = p.amount ?? 0;

  if (esAltaSuscripcion(p)) {
    return { bruto, fee: 0, iva: 0, retenido: 0, neto: 0, fuente: "sin-cobro", medio: null };
  }

  const bloque = comoObjeto(comoObjeto(p.payment_data)?.paymentData) as BloqueFlow | null;
  const fee = bloque ? num(bloque.fee) : null;
  const taxes = bloque ? num(bloque.taxes) : null;

  if (bloque && fee != null && taxes != null) {
    const brutoFlow = num(bloque.amount) ?? bruto;
    const balance = num(bloque.balance);
    return {
      bruto: brutoFlow,
      fee,
      iva: taxes,
      retenido: fee + taxes,
      // El balance de Flow manda; la resta es solo el respaldo si no viniera.
      neto: balance ?? brutoFlow - fee - taxes,
      fuente: "medido",
      medio: typeof bloque.media === "string" ? bloque.media : null,
    };
  }

  // Sin bloque: se estima. El IVA va sobre la comisión, redondeado como lo
  // redondea Flow (el `taxes` observado es siempre round(fee × 0,19)).
  const feeEst = Math.round(bruto * TASA_FLOW);
  const ivaEst = Math.round(feeEst * IVA);
  return {
    bruto,
    fee: feeEst,
    iva: ivaEst,
    retenido: feeEst + ivaEst,
    neto: bruto - feeEst - ivaEst,
    fuente: "estimado",
    medio: null,
  };
}

/** Agregado de un conjunto de pagos, con la calidad del dato a la vista. */
export interface ResumenComision {
  /** Bruto de las filas que SÍ representan un cobro (excluye las altas). */
  bruto: number;
  /** Total retenido por Flow (comisión + IVA). */
  retenido: number;
  /** Total depositado. */
  neto: number;
  /** Filas con comisión leída del dato de Flow. */
  medidos: number;
  /** Filas donde la comisión se estimó con TASA_FLOW. */
  estimados: number;
  /** Altas de suscripción: no son cobros y no entran a ningún total. */
  sinCobro: number;
  /** Tasa efectiva sobre el bruto (retenido/bruto), o null sin bruto. */
  tasaEfectiva: number | null;
}

/**
 * Suma un conjunto de pagos separando medido de estimado.
 *
 * Las altas de suscripción quedan FUERA del bruto además de fuera de la
 * comisión: contarlas duplicaría el ingreso, porque el cobro que les
 * corresponde ya viene en su propia fila.
 */
export function resumirComisiones(pagos: PagoParaComision[]): ResumenComision {
  let bruto = 0;
  let retenido = 0;
  let neto = 0;
  let medidos = 0;
  let estimados = 0;
  let sinCobro = 0;

  for (const p of pagos) {
    const c = leerComision(p);
    if (c.fuente === "sin-cobro") {
      sinCobro++;
      continue;
    }
    bruto += c.bruto;
    retenido += c.retenido;
    neto += c.neto;
    if (c.fuente === "medido") medidos++;
    else estimados++;
  }

  return {
    bruto,
    retenido,
    neto,
    medidos,
    estimados,
    sinCobro,
    tasaEfectiva: bruto > 0 ? retenido / bruto : null,
  };
}
