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

/** Nunca lanza; sin cuenta no hace nada. */
export async function capturarAnalisisCreado(p: { userId: string | null | undefined; analysisId: string | null | undefined; modalidad: string; via: string }): Promise<void> {
  if (!p.userId || !p.analysisId) return;
  await capturarServidor(eventoAnalisisCreado({ userId: p.userId, analysisId: p.analysisId, modalidad: p.modalidad, via: p.via })).catch(() => false);
}
