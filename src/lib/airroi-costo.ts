/**
 * Costo de AirROI — INFERIDO, no medido.
 *
 * A diferencia de la IA (tokens reales devueltos por la API) y de la comisión de
 * Flow (fee real devuelto en el webhook), acá no hay ningún dato de plata que
 * venga de la fuente. Lo único medido es el CONTEO de llamadas, que escribe
 * `contador-airroi.ts` en metrics_daily. El costo sale de multiplicar ese conteo
 * por una tarifa que salió de un comentario del código, no de una factura.
 *
 * Por eso todo lo que devuelve este módulo viaja marcado como estimado y la UI
 * no lo suma en silencio con los costos medidos. El día que llegue una factura
 * de AirROI, esto se reemplaza por el número real y la constante muere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { leerSerie, type FilaMetrica } from "@/lib/metrics-daily";
import { USD_CLP } from "@/lib/costo-ia";

export const FUENTE_AIRROI = "airroi";

/**
 * Tarifa por llamada, en USD.
 *
 * PROCEDENCIA HONESTA: sale de un comentario en el código de la integración
 * ("USD 0,30 por llamada"), no de una factura ni de un contrato verificado.
 * Se puede sobreescribir con `AIRROI_USD_CALL` en el entorno. Mientras no haya
 * factura, cualquier cifra de gasto de AirROI es un orden de magnitud, no una
 * medición — y la UI lo dice.
 */
export const AIRROI_USD_CALL = Number(process.env.AIRROI_USD_CALL) || 0.3;

/** Las métricas que escribe el contador, con su etiqueta para la UI. */
export const METRICAS_AIRROI = [
  { metrica: "calls_wizard_1d", label: "Wizard", detalle: "sugerencias mientras el usuario arma el análisis" },
  { metrica: "calls_dryrun_1d", label: "Dry-run", detalle: "previsualización sin persistir" },
  { metrica: "calls_informe_1d", label: "Informe", detalle: "la llamada que arma el análisis vendido" },
] as const;

/** Hits de caché: llamadas que NO se pagaron. Se cuentan aparte, no suman costo. */
export const METRICA_CACHE_HITS = "cache_hits_1d";

export interface LineaAirroi {
  metrica: string;
  label: string;
  detalle: string;
  /** Llamadas sumadas en la ventana. */
  llamadas: number;
  /** Días de la ventana con medición. */
  diasConDato: number;
  costoUsd: number;
  costoClp: number;
  /** true cuando no hay ni una fila: "sin dato", distinto de "cero llamadas". */
  sinDato: boolean;
}

export interface ResumenAirroi {
  lineas: LineaAirroi[];
  totalUsd: number;
  totalClp: number;
  /** Hits de caché de la ventana (llamadas ahorradas). */
  cacheHits: number;
  /** Máximo de días con dato entre las métricas — la cobertura de la ventana. */
  diasConDato: number;
  diasPedidos: number;
  /** true si ninguna métrica tiene una sola fila. */
  sinDato: boolean;
}

function sumar(filas: FilaMetrica[]): { total: number; dias: number } {
  return { total: filas.reduce((s, f) => s + Number(f.valor), 0), dias: filas.length };
}

/**
 * Lee el consumo de AirROI de la ventana y lo convierte a plata estimada.
 *
 * Las tres métricas se leen por separado a propósito: saber si el gasto viene de
 * gente explorando en el wizard o de informes vendidos cambia por completo qué
 * hacer al respecto. Un gasto de wizard alto sin ventas es fuga; el mismo gasto
 * en informes es costo de producción.
 */
export async function leerCostoAirroi(sb: SupabaseClient, dias: number): Promise<ResumenAirroi> {
  const series = await Promise.all(
    METRICAS_AIRROI.map((m) => leerSerie(sb, FUENTE_AIRROI, m.metrica, dias)),
  );
  const cache = await leerSerie(sb, FUENTE_AIRROI, METRICA_CACHE_HITS, dias);

  const lineas: LineaAirroi[] = METRICAS_AIRROI.map((m, i) => {
    const { total, dias: d } = sumar(series[i]);
    const costoUsd = total * AIRROI_USD_CALL;
    return {
      metrica: m.metrica,
      label: m.label,
      detalle: m.detalle,
      llamadas: total,
      diasConDato: d,
      costoUsd,
      costoClp: Math.round(costoUsd * USD_CLP),
      sinDato: d === 0,
    };
  });

  const totalUsd = lineas.reduce((s, l) => s + l.costoUsd, 0);

  return {
    lineas,
    totalUsd,
    totalClp: Math.round(totalUsd * USD_CLP),
    cacheHits: sumar(cache).total,
    diasConDato: Math.max(0, ...lineas.map((l) => l.diasConDato)),
    diasPedidos: dias,
    sinDato: lineas.every((l) => l.sinDato),
  };
}
