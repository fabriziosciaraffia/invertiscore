/**
 * LA ACTIVACIÓN (15-oct-2026, medición para la campaña): `analisis_creado` desde el servidor, cada vez que una cuenta
 * crea un informe —el wizard (renta larga, corta o ambas), «Analizar este» de la guía y del semanal, el desbloqueo—.
 * Con uuid determinista por informe: un informe, un evento aunque el request se repita. Es el segundo paso del panel
 * «Activación por semana» en PostHog: de los registrados de cada semana (`cuenta_atribuida`), cuántos analizaron
 * algo en 30 días. Los anónimos no cuentan acá: el evento va solo con cuenta.
 */
import { capturarServidor, uuidDeterminista, type EventoServidor } from "@/lib/posthog-servidor";

export function eventoAnalisisCreado(p: { userId: string; analysisId: string; modalidad: string; via: string }): EventoServidor {
  return {
    event: "analisis_creado",
    distinctId: p.userId,
    uuid: uuidDeterminista(`analisis_creado-${p.analysisId}`),
    properties: { analysis_id: p.analysisId, modalidad: p.modalidad, via: p.via },
  };
}

/**
 * EL DESBLOQUEO POR PAGO (21-oct-2026, Fabrizio): el informe que abre un pago —la compra suelta atada a un informe
 * (`single`, o el `pro` de antes), incluida la del wizard sin saldo, que crea la fila bloqueada— cuenta como los hechos
 * con saldo, con via = pago, al desbloquearse. Hasta acá no emitía nada y el panel no contaba los análisis pagados. El
 * pack no abre informes (el primero ya era completo): los suyos se hacen con saldo y cuentan ahí.
 */
export const VIA_PAGO = "pago";

/** ¿Este pago abre el informe AHORA? Sí si estaba bloqueado (`pending_payment`) o no era completo. Un reenvío de Flow o
 *  la vuelta de /payments/return lo encuentran ya abierto: no cuenta dos veces (y el uuid es el mismo). */
export function seDesbloqueaConPago(antes: { is_premium?: boolean | null; pending_payment?: boolean | null } | null | undefined): boolean {
  return !!antes && (antes.pending_payment === true || antes.is_premium !== true);
}

/** La modalidad del informe para el evento, como la dicen la guía y el semanal. */
export function modalidadDelInforme(tipo: string | null | undefined): string {
  return tipo === "short-term" ? "str" : tipo === "long-term" || !tipo ? "ltr" : tipo;
}

/** Nunca lanza; sin cuenta no hace nada. */
export async function capturarAnalisisCreado(p: { userId: string | null | undefined; analysisId: string | null | undefined; modalidad: string; via: string }): Promise<void> {
  if (!p.userId || !p.analysisId) return;
  await capturarServidor(eventoAnalisisCreado({ userId: p.userId, analysisId: p.analysisId, modalidad: p.modalidad, via: p.via })).catch(() => false);
}
