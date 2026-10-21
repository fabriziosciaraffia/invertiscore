// ─────────────────────────────────────────────────────────────────────────────
// El re-análisis al precio recomendado, en el servidor (21-oct-2026, lib/reanalisis.ts). Las rutas que crean un
// informe (/api/analisis, /api/analisis/short-term, /api/analisis/locked) guardan el marcador en `input_data` solo si
// es de la misma cuenta y si el informe se generó al precio recomendado; si no, lo descartan. `reanalisis_precio` sale
// al crear el informe con saldo, o al confirmarse el pago del suelto (payments/confirm): un informe, un evento.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { capturarServidor, uuidDeterminista, type EventoServidor } from "@/lib/posthog-servidor";
import { esAlPrecioRecomendado, leerReanalisis, type Reanalisis } from "@/lib/reanalisis";

export const EVENTO_REANALISIS = "reanalisis_precio";

/** El marcador del cuerpo, saneado, del informe de origen de esta cuenta y al precio recomendado; si no, null. */
export async function reanalisisDelCuerpo(sb: SupabaseClient, userId: string | null | undefined, marcador: unknown, precioUF: number): Promise<Reanalisis | null> {
  const r = leerReanalisis(marcador);
  if (!r || !userId || !esAlPrecioRecomendado(precioUF, r)) return null;
  const { data } = await sb.from("analisis").select("id").eq("id", r.origenId).eq("user_id", userId).maybeSingle();
  return data ? r : null;
}

/** Deja el marcador validado en el cuerpo (o lo saca) y lo devuelve. */
export async function sanearReanalisis(sb: SupabaseClient, userId: string | null | undefined, body: Record<string, unknown>, precioUF: number): Promise<Reanalisis | null> {
  const r = await reanalisisDelCuerpo(sb, userId, body.reanalisis, precioUF).catch(() => null);
  if (r) body.reanalisis = r;
  else delete body.reanalisis;
  return r;
}

export function eventoReanalisisPrecio(p: { userId: string; analysisId: string; r: Reanalisis; modalidad: "ltr" | "str"; conPago: boolean }): EventoServidor {
  return {
    event: EVENTO_REANALISIS,
    distinctId: p.userId,
    uuid: uuidDeterminista(`${EVENTO_REANALISIS}-${p.analysisId}`),
    properties: {
      informe_original: p.r.origenId,
      informe_nuevo: p.analysisId,
      precio_original_uf: p.r.precioOriginalUF,
      precio_recomendado_uf: p.r.precioRecomendadoUF,
      descuento_pct: Math.round((1 - p.r.precioRecomendadoUF / p.r.precioOriginalUF) * 1000) / 10,
      pie_pct: p.r.piePct,
      plazo_anios: p.r.plazoAnios,
      modalidad: p.modalidad,
      con_pago: p.conPago,
    },
  };
}

/** Nunca lanza. */
export async function capturarReanalisis(p: Parameters<typeof eventoReanalisisPrecio>[0]): Promise<void> {
  await capturarServidor(eventoReanalisisPrecio(p)).catch(() => false);
}
