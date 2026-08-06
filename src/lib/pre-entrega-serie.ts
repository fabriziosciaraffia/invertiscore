// ─────────────────────────────────────────────────────────────────────────────
// Predicado de pre-entrega leído sobre la SERIE de proyecciones.
//
// Fuente única del "este depto todavía no se entrega" para los consumidores que
// tienen la serie a mano. Extraído verbatim de kpi-calculations.ts (donde nació
// con el fix del payback pre-entrega) para que la comparativa use exactamente el
// mismo criterio y no puedan divergir.
// ─────────────────────────────────────────────────────────────────────────────

import type { YearProjection, AnalysisMetrics } from "@/lib/types";

/**
 * Cantidad de años iniciales de la serie que caen antes de la escritura, leída
 * del PREFIJO de años con deuda 0. `calcProjections` deja `saldoCredito = 0`
 * mientras `mesFin < mesesPreEntrega` (el banco no cursa hasta escriturar), así
 * que ese prefijo ES la pre-entrega, medida sobre la misma serie que alimenta a
 * quien pregunta. Entrega inmediata ⇒ el año 1 ya trae deuda ⇒ 0.
 *
 * Por qué la serie y no `metrics.preEntrega.aniosEspera`, que es lo que usa
 * patrimonio-series: ese campo se empezó a persistir el 2026-06-29 y falta en 31
 * de los 47 análisis pre-entrega del parque, así que como predicado único dejaría
 * el bug vivo en dos tercios de los casos. Donde ambas fuentes existen marcan la
 * MISMA frontera: el prefijo mide `aniosEspera − 1`, y el primer año post-entrega
 * es `aniosEspera` en las dos (verificado en las 16 filas que traen el campo).
 * Y NUNCA `estadoVenta === "futura"`: deja fuera "blanco" y "verde", que son 15
 * de los 47.
 *
 * El guard de crédito descarta el falso positivo de una compra sin deuda (pie
 * 100%), donde la serie entera tendría saldo 0 sin haber pre-entrega alguna.
 * Barrido: 0 falsos positivos sobre los 658 análisis de entrega inmediata.
 */
export function contarAniosPreEntrega(
  projections: YearProjection[],
  metrics: Pick<AnalysisMetrics, "precioCLP" | "pieCLP">,
): number {
  if (!(metrics.precioCLP > (metrics.pieCLP ?? 0))) return 0;
  let n = 0;
  for (const p of projections) {
    if (p.saldoCredito > 0) break;
    n++;
  }
  return n >= projections.length ? 0 : n;
}

/**
 * Meses hasta la escritura, congelados contra el `asOf` del análisis.
 *
 * Espejo EXACTO de `calcMesesHastaEntrega` (analysis.ts:187), replicado acá y no
 * importado para no colgar el motor de renta corta del de renta larga. Si uno
 * cambia, el otro tiene que cambiar — misma aritmética, mismo redondeo de 30
 * días, mismo `Math.max(0, …)`.
 *
 * `estadoVenta !== "inmediata"` y NO `=== "futura"`: los estados "blanco" y
 * "verde" de las filas viejas también son pre-entrega cuando traen fecha.
 */
export function mesesHastaEntregaDesdeFecha(
  estadoVenta: string | undefined,
  fechaEntrega: string | undefined,
  asOf: Date,
): number {
  if (estadoVenta === "inmediata" || !fechaEntrega) return 0;
  const [anio, mes] = fechaEntrega.split("-").map(Number);
  if (!anio || !mes) return 0;
  const entrega = new Date(anio, mes - 1);
  return Math.max(0, Math.round((entrega.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24 * 30)));
}
