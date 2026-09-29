// ─────────────────────────────────────────────────────────────────────────────
// Los eventos de «Lo que sigue» (28-sep-2026), del lado del cliente. Todos llevan `oferta`,
// `veredicto` y `analysis_id`; `entrada` viaja como súper propiedad de sesión (la registra el
// wizard) y acá se refuerza si el navegador la tiene. `pack_pagado` y `pack_vencido` del lado del
// servidor salen de `eventos-servidor.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import type { PostHog } from "posthog-js";

export const EVENTOS_LQS = {
  bannerVisto: "banner_visto",
  registroIniciado: "registro_iniciado",
  registroCompletado: "registro_completado",
  ticketVisto: "ticket_visto",
  despedidaVista: "despedida_vista",
  packIniciado: "pack_iniciado",
  packVencido: "pack_vencido",
  packPagado: "pack_pagado",
  // 30-sep-2026 · el copy nuevo y lo que pasa después de pagar
  accesoClick: "acceso_click",
  dentroVisto: "dentro_visto",
  preferenciaEditada: "preferencia_editada",
  horizonteElegido: "horizonte_elegido",
  postPagoVisto: "post_pago_visto",
  precargaAbierta: "precarga_abierta",
  compararVisto: "comparar_visto",
  recordatorioEnviado: "recordatorio_pack_enviado",
} as const;

export type EventoLqs = (typeof EVENTOS_LQS)[keyof typeof EVENTOS_LQS];
export type ViaRegistro = "correo" | "google";

export interface ContextoLqs {
  analysisId: string;
  veredicto: string;
  modalidad: "ltr" | "str";
}

export function capturarLqs(posthog: PostHog | null | undefined, evento: EventoLqs, ctx: ContextoLqs, props: Record<string, unknown> = {}): void {
  try {
    let entrada: unknown;
    try {
      entrada = posthog?.get_property?.("entrada");
    } catch {
      entrada = undefined;
    }
    posthog?.capture(evento, {
      oferta: "lo_que_sigue",
      analysis_id: ctx.analysisId,
      veredicto: ctx.veredicto,
      modalidad: ctx.modalidad,
      ...(entrada !== undefined ? { entrada } : {}),
      ...props,
    });
  } catch {
    /* la medición jamás rompe el informe */
  }
}

// ── el registro completado se emite al VOLVER (el enlace del correo y Google navegan) ──
const CLAVE_PENDIENTE = "lqs_registro_pendiente";
const VENTANA_MS = 30 * 60 * 1000;

export function marcarRegistroPendiente(via: ViaRegistro, ctx: ContextoLqs): void {
  try {
    localStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ via, ctx, t: Date.now() }));
  } catch {
    /* sin storage se pierde el evento, no el registro */
  }
}

/** Lee y BORRA la marca. Solo vale dentro de la ventana. */
export function consumirRegistroPendiente(): { via: ViaRegistro; ctx: ContextoLqs } | null {
  try {
    const raw = localStorage.getItem(CLAVE_PENDIENTE);
    if (!raw) return null;
    localStorage.removeItem(CLAVE_PENDIENTE);
    const m = JSON.parse(raw) as { via?: ViaRegistro; ctx?: ContextoLqs; t?: number };
    if ((m.via !== "correo" && m.via !== "google") || !m.ctx || typeof m.t !== "number") return null;
    if (Date.now() - m.t > VENTANA_MS) return null;
    return { via: m.via, ctx: m.ctx };
  } catch {
    return null;
  }
}
