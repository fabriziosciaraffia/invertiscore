// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME QUE ABRE UN PAGO (21-oct-2026, sacado de payments/confirm para probarlo con una base de mentira). La compra
// suelta atada a un informe —la del wizard sin saldo, que crea la fila bloqueada, o la de un informe que no era completo—
// consume el crédito recién otorgado, abre la fila y lo cuenta en la activación: `analisis_creado` con via = pago, como
// los hechos con saldo, solo si este pago lo abrió (un reenvío de Flow o la vuelta de /payments/return lo encuentran ya
// abierto, y el uuid es el mismo). Después, el re-análisis al precio recomendado y la fila STR de AMBAS. Lo prueba el
// tier PANEL-ACTIVACION (un pago, un evento; un reenvío, ninguno).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeCredit } from "@/lib/access";
import { capturarAnalisisCreado, modalidadDelInforme, seDesbloqueaConPago, VIA_PAGO } from "@/lib/medicion-activacion";
import { leerReanalisis } from "@/lib/reanalisis";
import { capturarReanalisis } from "@/lib/reanalisis-servidor";

export interface DepsDesbloqueo {
  /** Consume el crédito y marca el informe completo. Por defecto `consumeCredit` (access.ts). */
  consumir?: (userId: string, analysisId: string) => Promise<boolean>;
  /** Manda `analisis_creado`. Por defecto `capturarAnalisisCreado`. */
  contar?: typeof capturarAnalisisCreado;
  /** Manda `reanalisis_precio`. Por defecto `capturarReanalisis`. */
  contarReanalisis?: typeof capturarReanalisis;
}

/** Abre el informe que pagó la compra suelta y lo cuenta. `abierto` = este pago lo abrió (y salió `analisis_creado`). */
export async function abrirInformePagado(
  supabase: SupabaseClient,
  p: { userId: string; analysisId: string; companionStrId?: string | null },
  deps: DepsDesbloqueo = {},
): Promise<{ abierto: boolean }> {
  const { userId, analysisId } = p;
  // Cómo estaba el informe ANTES del pago: si este pago lo abre, cuenta.
  const { data: antesDelPago } = await supabase.from("analisis").select("is_premium, pending_payment, tipo_analisis").eq("id", analysisId).maybeSingle();

  // consumeCredit es idempotente (corta si ya está completo): un reenvío no consume dos veces.
  await (deps.consumir ?? consumeCredit)(userId, analysisId);

  // La fila bloqueada del wizard sin saldo (/api/analisis/locked) se abre. El flip CONDICIONAL es idempotente.
  await supabase.from("analisis").update({ pending_payment: false }).eq("id", analysisId).eq("pending_payment", true);

  const abierto = seDesbloqueaConPago(antesDelPago as { is_premium?: boolean | null; pending_payment?: boolean | null } | null);
  if (abierto) {
    await (deps.contar ?? capturarAnalisisCreado)({ userId, analysisId, modalidad: modalidadDelInforme((antesDelPago as { tipo_analisis?: string | null } | null)?.tipo_analisis), via: VIA_PAGO });
  }

  // El re-análisis al precio recomendado sin saldo (lib/reanalisis.ts): el informe sale recién ahora, así que
  // `reanalisis_precio` sale acá, solo cuando este pago lo abrió (y con uuid por informe).
  if (abierto) {
    try {
      const { data: fila } = await supabase.from("analisis").select("input_data, tipo_analisis").eq("id", analysisId).maybeSingle();
      const f = fila as { input_data?: Record<string, unknown> | null; tipo_analisis?: string | null } | null;
      const r = leerReanalisis(f?.input_data?.reanalisis);
      if (r) await (deps.contarReanalisis ?? capturarReanalisis)({ userId, analysisId, r, modalidad: f?.tipo_analisis === "short-term" ? "str" : "ltr", conPago: true });
    } catch (e) {
      console.error("[payments/confirm] reanalisis_precio:", e);
    }
  }

  // AMBAS pre-pago: la fila STR se abre DIRECTO, sin otro crédito (el único cobro cubrió las dos). Idempotente.
  if (p.companionStrId) {
    await supabase.from("analisis").update({ is_premium: true, pending_payment: false }).eq("id", p.companionStrId).eq("pending_payment", true);
  }
  return { abierto };
}
