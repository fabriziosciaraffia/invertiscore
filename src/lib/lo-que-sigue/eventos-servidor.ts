// Los dos eventos del pack que solo el servidor puede afirmar: se pagó (Flow confirmó) y venció
// (payments/create lo rechazó por hora). uuid determinista: los reintentos no duplican.
import { uuidDeterminista, type EventoServidor } from "@/lib/posthog-servidor";
import { EVENTOS_LQS } from "./eventos";

export function eventoPackPagado(p: { commerceOrder: string; userId: string; amount: number; analysisId: string | null; veredicto?: string | null }): EventoServidor {
  return {
    event: EVENTOS_LQS.packPagado,
    distinctId: p.userId,
    uuid: uuidDeterminista(`pack_pagado:${p.commerceOrder}`),
    properties: { oferta: "lo_que_sigue", commerce_order: p.commerceOrder, monto: p.amount, moneda: "CLP", analysis_id: p.analysisId, veredicto: p.veredicto ?? null, donde: "servidor" },
  };
}

export function eventoPackVencido(p: { userId: string; analysisId: string; veredicto?: string | null }): EventoServidor {
  return {
    event: EVENTOS_LQS.packVencido,
    distinctId: p.userId,
    uuid: uuidDeterminista(`pack_vencido:${p.analysisId}:${p.userId}`),
    properties: { oferta: "lo_que_sigue", analysis_id: p.analysisId, veredicto: p.veredicto ?? null, donde: "servidor" },
  };
}

/** El recordatorio del pack salió (30-sep-2026). Uno por pago: el uuid lo ata al payment. */
export function eventoRecordatorioPack(p: { userId: string; paymentId: string; analysisId: string | null }): EventoServidor {
  return {
    event: EVENTOS_LQS.recordatorioEnviado,
    distinctId: p.userId,
    uuid: uuidDeterminista(`recordatorio_pack:${p.paymentId}`),
    properties: { oferta: "lo_que_sigue", payment_id: p.paymentId, analysis_id: p.analysisId, donde: "servidor" },
  };
}
