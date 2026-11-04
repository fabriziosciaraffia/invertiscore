// ─────────────────────────────────────────────────────────────────────────────
// ACREDITAR UN PAGO ÚNICO (04-nov-2026, auditoría de promesas parte 1, decisión de Fabrizio).
//
// Lo que un pago confirmado de Flow le da a la persona: el suelto (1 crédito sin vencimiento, y si venía atado a un
// informe, lo abre), el pack de 24 horas (3 sin vencimiento, y la guía del informe de origen) y el pack de tres (3 sin
// vencimiento). Vivía dentro de payments/confirm; sale acá para que el reconciliador diario (cron/reconciliar-pagos)
// acredite por el MISMO camino un pago que quedó sin crédito.
//
// Idempotente: el lote es único por `payment_id` (grantCredits devuelve null si ya estaba) y abrir el informe también.
// Si acreditar falla de verdad, grantCredits LANZA (ErrorAcreditar) y esto también: payments/confirm no manda «Pago
// confirmado» y le pide a Flow que reintente. Lo fija el tier DATOS-Y-PLATA.
// ─────────────────────────────────────────────────────────────────────────────
import { waitUntil } from "@vercel/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantCredits } from "@/lib/credits-grant";
import { abrirInformePagado } from "@/lib/desbloqueo-pago";
import { capturarServidor, uuidDeterminista } from "@/lib/posthog-servidor";
import { eventoPackPagado } from "@/lib/lo-que-sigue/eventos-servidor";
import { modalidadDeTipo, PACK_ANALISIS, PRODUCTO_PACK } from "@/lib/lo-que-sigue/oferta-pack";
import { PRODUCTO_TRES, TRES_CANTIDAD } from "@/lib/tres-analisis";
import { hayGuia } from "@/lib/guia/activa";
import { calcularYGuardarGuia } from "@/lib/guia/guia-servidor";
import { readVeredicto } from "@/lib/results-helpers";

/** Los productos de pago único que dan créditos (los que vigila el reconciliador). */
export const PRODUCTOS_CON_CREDITO = ["single", PRODUCTO_PACK, PRODUCTO_TRES] as const;

export interface PagoParaAcreditar {
  id: string;
  user_id: string | null;
  product: string | null;
  amount: number | null;
  commerce_order: string;
  quantity?: number | null;
  analysis_id?: string | null;
  payment_data?: unknown;
}

/**
 * Acredita un pago único ya confirmado. Devuelve `false` si el producto no es de los que dan créditos (o no hay dueño):
 * quien llama sigue con su camino de siempre. LANZA si el ledger no pudo acreditar.
 */
export async function acreditarPagoUnico(supabase: SupabaseClient, payment: PagoParaAcreditar, opts: { companionStrId?: string | null } = {}): Promise<boolean> {
  const { id: paymentId, user_id: userId, product, analysis_id: analysisId } = payment;
  if (!userId || !product) return false;

  if (product === "single") {
    // N créditos al ledger en UN lote (amount = quantity), sin vencimiento: el análisis comprado no caduca.
    await grantCredits(userId, "single", payment.quantity ?? 1, { paymentId, noExpire: true });
    // Atado a un informe: lo abre (consume el crédito recién otorgado; idempotente ante un reenvío).
    if (analysisId) await abrirInformePagado(supabase, { userId, analysisId, companionStrId: opts.companionStrId ?? null });
    return true;
  }

  if (product === PRODUCTO_PACK) {
    // «Lo que sigue» (28-sep-2026): 3 créditos sin vencimiento. No desbloquea nada: el primer informe ya era completo.
    await grantCredits(userId, PRODUCTO_PACK, PACK_ANALISIS, { paymentId, noExpire: true });
    try {
      let veredictoPack: string | null = null;
      if (analysisId) {
        const { data: filaPack } = await supabase.from("analisis").select("results, tipo_analisis").eq("id", analysisId).single();
        veredictoPack = readVeredicto(filaPack?.results as never) ?? null;
        // «Por dónde seguir buscando» (30-sep-2026): la guía se calcula ya y queda guardada por informe.
        if (hayGuia(modalidadDeTipo(filaPack?.tipo_analisis as string | null))) {
          waitUntil(calcularYGuardarGuia(supabase, analysisId).then(() => undefined, (e) => console.error("[acreditar-pago] guía:", e)));
        }
      }
      await capturarServidor(eventoPackPagado({ commerceOrder: payment.commerce_order, userId, amount: payment.amount ?? 0, analysisId: analysisId ?? null, veredicto: veredictoPack }));
    } catch (e) {
      console.error("[acreditar-pago] pack_pagado excepción:", e);
    }
    return true;
  }

  if (product === PRODUCTO_TRES) {
    // Tres análisis por $19.990 para quien tiene cuenta (13-oct-2026): 3 créditos sin vencimiento.
    await grantCredits(userId, PRODUCTO_TRES, TRES_CANTIDAD, { paymentId, noExpire: true });
    const deDonde = payment.payment_data as { origen?: string } | null;
    await capturarServidor({ event: "tres_analisis_pagado", distinctId: userId, uuid: uuidDeterminista(`tres_analisis_pagado:${payment.commerce_order}`), properties: { amount: payment.amount, origen: deDonde?.origen ?? null } }).catch(() => false);
    return true;
  }

  return false;
}
