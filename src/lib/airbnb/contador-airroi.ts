/**
 * Conteo diario de llamadas a AirROI, por origen.
 *
 * PARA QUÉ: AirROI cobra por llamada (USD 0,30 según el comentario histórico del
 * hook del wizard). Medido en 30 días: 1.000 llamadas para 52 análisis STR, o sea
 * 19,2 por informe. El grueso no venía de generar informes sino del wizard
 * consultando mientras el usuario exploraba, y no había forma de separarlos
 * porque nadie registraba de dónde salía cada llamada.
 *
 * El dato que hacía falta ya existía: `getAirbnbEstimate` devuelve `cached`
 * desde siempre y nadie lo leía. Lo único que se agrega es el ORIGEN y la
 * escritura del conteo.
 *
 * DÓNDE SE GUARDA: `metrics_daily`, la tabla genérica (fuente + métrica + valor)
 * que ya usa el cron de Sentry. Cero DDL — su comentario dice, textual, que "la
 * próxima métrica externa entra sin crear otra tabla".
 *
 * LÍMITE CONOCIDO — el conteo puede quedar corto bajo concurrencia.
 * `metrics_daily` se escribe con un upsert de valor ABSOLUTO, así que incrementar
 * exige leer-y-escribir y dos requests simultáneas pueden leer el mismo número y
 * pisarse: se cuenta una en vez de dos. El incremento atómico necesitaría una
 * función en la base, y esto es telemetría de costo, no facturación — vale más
 * tener la magnitud hoy sin tocar el esquema que el número exacto en un mes.
 * Cuando el volumen justifique un `increment_metrica(...)`, este módulo es el
 * único lugar que cambia. Mientras tanto: el número es un PISO, no un total.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarMetrica, leerSerie } from "@/lib/metrics-daily";

export const FUENTE_AIRROI = "airroi";

/** Quién pidió la estimación. Define qué contador se mueve. */
export type OrigenAirroi = "wizard" | "dry-run" | "informe";

const METRICA_POR_ORIGEN: Record<OrigenAirroi, string> = {
  wizard: "calls_wizard_1d",
  "dry-run": "calls_dryrun_1d",
  informe: "calls_informe_1d",
};

/** Los hits no cuestan plata, pero sin ellos no se sabe si el cache sirve. */
export const METRICA_CACHE_HITS = "cache_hits_1d";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Suma 1 al contador del día. Nunca lanza y nunca bloquea: si la métrica falla,
 * la estimación ya se resolvió y el usuario no tiene por qué enterarse.
 */
export async function contarLlamadaAirroi(
  sb: SupabaseClient,
  origen: OrigenAirroi,
  vinoDelCache: boolean,
): Promise<void> {
  try {
    const metrica = vinoDelCache ? METRICA_CACHE_HITS : METRICA_POR_ORIGEN[origen];
    const fecha = hoyISO();

    // Read-modify-write: ver el límite de concurrencia en la cabecera.
    const previas = await leerSerie(sb, FUENTE_AIRROI, metrica, 1);
    const actual = previas.find((f) => f.fecha === fecha)?.valor ?? 0;

    await guardarMetrica(sb, {
      fecha,
      fuente: FUENTE_AIRROI,
      metrica,
      valor: actual + 1,
      // El origen queda también en meta cuando es un hit: así se puede ver qué
      // flujo se está beneficiando del cache, que el nombre de la métrica no dice.
      meta: vinoDelCache ? { ultimo_origen_hit: origen } : { origen },
    });
  } catch {
    /* la telemetría nunca rompe el flujo que la llamó */
  }
}
