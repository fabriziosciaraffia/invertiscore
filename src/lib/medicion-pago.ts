// `pago_confirmado`: sale del servidor cuando Flow confirma, en el mismo bloque que el Purchase de
// Meta CAPI y con el MISMO id (`commerce_order`): un pago = un evento en PostHog y uno en Meta, y
// los reintentos de Flow no lo duplican (uuid determinista). Antes solo existía `pro_purchased`,
// que dependía de que el usuario volviera a /payments/return y viera «paid» en la primera consulta:
// 14 pagos en la base en 45 días, 0 eventos (auditoría 28-sep-2026).

import { uuidDeterminista, type EventoServidor } from "./posthog-servidor";

export interface PagoConfirmado {
  commerceOrder: string;
  userId: string;
  product: string;
  amount: number;
  analysisId?: string | null;
}

export function eventoPagoConfirmado(p: PagoConfirmado): EventoServidor {
  return {
    event: "pago_confirmado",
    distinctId: p.userId,
    uuid: uuidDeterminista(`pago_confirmado:${p.commerceOrder}`),
    properties: {
      commerce_order: p.commerceOrder,
      event_id: p.commerceOrder,
      producto: p.product,
      monto: p.amount,
      moneda: "CLP",
      analysis_id: p.analysisId ?? null,
    },
  };
}
