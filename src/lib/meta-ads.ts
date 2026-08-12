/**
 * Gasto de Meta Ads en `metrics_daily`, y su lectura para el panel.
 *
 * QUÉ SE TRAE Y QUÉ NO — la regla que sostiene la confianza del panel:
 * de Meta llega SOLO lo que Meta es la única fuente capaz de saber (cuánta plata
 * se gastó, cuántas impresiones, clics y personas alcanzadas). Las conversiones
 * NO se traen, aunque la API las ofrezca gratis en la misma respuesta.
 *
 * El motivo no es purismo: Meta atribuye con un modelo propio (ventanas de 7 días
 * post-clic y 1 día post-vista, con modelado estadístico encima), así que sus
 * "registros" jamás van a coincidir con los de `auth.users`. Un panel que muestra
 * dos cifras de registros que no cuadran no genera una discusión sobre atribución:
 * genera desconfianza sobre TODO lo demás que muestra. Las conversiones salen de
 * nuestra base, que es donde ocurren.
 *
 * Por eso el cruce se hace acá: gasto de Meta ÷ conversiones nuestras.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { leerSerie, type FilaMetrica } from "@/lib/metrics-daily";

export const FUENTE_META_ADS = "meta_ads";

/** El sufijo `_1d` declara la ventana: la fila cubre el día natural de `fecha`. */
export const METRICA_SPEND_1D = "spend_1d";
export const METRICA_IMPRESSIONS_1D = "impressions_1d";
export const METRICA_CLICKS_1D = "clicks_1d";
export const METRICA_REACH_1D = "reach_1d";

/** Las cuatro que el cron escribe, en el orden en que se leen. */
export const METRICAS_META = [
  METRICA_SPEND_1D,
  METRICA_IMPRESSIONS_1D,
  METRICA_CLICKS_1D,
  METRICA_REACH_1D,
] as const;

/**
 * Gasto acumulado de una ventana, con la calidad del dato a la vista.
 *
 * `dias` es el largo de la ventana pedida y `diasConDato` cuántos de esos días
 * tienen fila. La diferencia importa: 30 días pedidos con 3 medidos no es "gastamos
 * poco", es "medimos poco", y un CAC calculado sobre eso está inflado.
 */
export interface GastoMeta {
  /** Suma del gasto de los días medidos, en la moneda de la cuenta. */
  total: number;
  /** Días de la ventana con fila en metrics_daily. */
  diasConDato: number;
  /** Largo de la ventana pedida. */
  diasPedidos: number;
  /** Moneda que reportó Meta (viene en el jsonb `meta`). null si no se midió. */
  moneda: string | null;
  /** Fecha de la medición más reciente. null = nunca se midió. */
  ultimaFecha: string | null;
  /** true cuando NINGÚN día de la ventana tiene medición. */
  sinDato: boolean;
}

/**
 * Lee el gasto de la ventana. Nunca inventa ceros: los días sin fila
 * sencillamente no suman, y `diasConDato` deja ver cuántos faltaron.
 */
export async function leerGastoMeta(sb: SupabaseClient, dias: number): Promise<GastoMeta> {
  const filas = await leerSerie(sb, FUENTE_META_ADS, METRICA_SPEND_1D, dias);
  return resumirGasto(filas, dias);
}

/** La mitad pura de `leerGastoMeta`, para poder probarla sin base. */
export function resumirGasto(filas: FilaMetrica[], dias: number): GastoMeta {
  if (filas.length === 0) {
    return { total: 0, diasConDato: 0, diasPedidos: dias, moneda: null, ultimaFecha: null, sinDato: true };
  }
  const moneda = filas
    .map((f) => (f.meta as { moneda?: unknown } | null)?.moneda)
    .find((m): m is string => typeof m === "string" && m.length > 0);

  return {
    total: filas.reduce((s, f) => s + Number(f.valor), 0),
    diasConDato: filas.length,
    diasPedidos: dias,
    moneda: moneda ?? null,
    // leerSerie devuelve más reciente primero.
    ultimaFecha: filas[0].fecha,
    sinDato: false,
  };
}

/**
 * Costo por conversión.
 *
 * Devuelve `null` —no cero, no Infinity— cuando no se puede calcular: sin gasto
 * medido no hay numerador, y sin conversiones el cociente no existe. La UI
 * distingue los dos casos; lo que no puede hacer es mostrar "$0" o "∞" como si
 * fueran mediciones.
 */
export function costoPorConversion(gasto: GastoMeta, conversiones: number): number | null {
  if (gasto.sinDato) return null;
  if (conversiones <= 0) return null;
  return gasto.total / conversiones;
}
