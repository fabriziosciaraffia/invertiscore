/**
 * Lectura y escritura de `metrics_daily` — métricas diarias de fuentes externas.
 *
 * Regla de la arquitectura: el panel NUNCA llama en vivo a una API de terceros
 * al renderizar. Un timeout de Sentry no puede dejar /admin/operacion colgado.
 * El cron escribe una fila por día; el panel lee de la tabla.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const FUENTE_SENTRY = "sentry";
/** El sufijo declara la ventana: esta métrica cubre el día de `fecha`. */
export const METRICA_ERRORES_1D = "errors_1d";

export interface FilaMetrica {
  fecha: string;
  valor: number;
  meta: Record<string, unknown> | null;
  medido_at: string;
}

/**
 * Serie de los últimos `dias` días para una fuente+métrica, más reciente primero.
 *
 * Devuelve solo los días que EXISTEN. Un día sin fila es un día en que el cron
 * no corrió, y esa ausencia es información: no se rellena con cero, porque "no
 * medimos" y "medimos cero errores" son cosas distintas.
 */
export async function leerSerie(
  sb: SupabaseClient,
  fuente: string,
  metrica: string,
  dias: number
): Promise<FilaMetrica[]> {
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - (dias - 1));

  const { data, error } = await sb
    .from("metrics_daily")
    .select("fecha, valor, meta, medido_at")
    .eq("fuente", fuente)
    .eq("metrica", metrica)
    .gte("fecha", desde.toISOString().slice(0, 10))
    .order("fecha", { ascending: false });

  if (error) {
    // Tabla ausente (el SQL todavía no se corrió) = estado esperado, no error.
    if (!["PGRST205", "42P01"].includes(error.code)) {
      console.error("[metrics_daily] query error:", error);
    }
    return [];
  }
  return (data ?? []) as FilaMetrica[];
}

/** Lo que la pastilla necesita saber, ya resuelto. */
export interface ResumenMetrica {
  /** Valor del día más reciente medido. null = nunca se midió. */
  ultimoDia: number | null;
  /** Fecha de esa medición (YYYY-MM-DD). */
  ultimaFecha: string | null;
  /** Suma de los días medidos en la ventana. Derivada, no guardada. */
  suma7d: number;
  /** Cuántos de los últimos 7 días tienen medición. 7 = serie completa. */
  diasConDato: number;
  /** true si la última medición es de hoy o de ayer (el cron viene corriendo). */
  fresca: boolean;
}

/**
 * Resume la serie para mostrarla. La distinción que importa: `ultimoDia === null`
 * significa SIN DATO (nunca se midió o el cron no corre), y es un estado
 * distinto de `ultimoDia === 0` (se midió y hubo cero errores). Mostrar "0" en
 * ambos casos sería mentir sobre el más grave de los dos.
 */
export function resumirSerie(filas: FilaMetrica[]): ResumenMetrica {
  if (filas.length === 0) {
    return { ultimoDia: null, ultimaFecha: null, suma7d: 0, diasConDato: 0, fresca: false };
  }
  const ultima = filas[0];
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  const hoyStr = hoy.toISOString().slice(0, 10);
  const ayerStr = ayer.toISOString().slice(0, 10);

  return {
    ultimoDia: Number(ultima.valor),
    ultimaFecha: ultima.fecha,
    suma7d: filas.reduce((s, f) => s + Number(f.valor), 0),
    diasConDato: filas.length,
    // El cron corre a diario: si la última medición no es de hoy ni de ayer,
    // el dato está viejo y la pastilla no debe presentarlo como actual.
    fresca: ultima.fecha === hoyStr || ultima.fecha === ayerStr,
  };
}

/**
 * Escribe (o pisa) la métrica del día. Idempotente por la PK
 * (fecha, fuente, metrica): correr el cron dos veces el mismo día actualiza la
 * fila en vez de duplicarla.
 *
 * Devuelve false si la escritura falló — el caller decide si eso amerita
 * reportarlo. Nunca lanza.
 */
export async function guardarMetrica(
  sb: SupabaseClient,
  fila: { fecha: string; fuente: string; metrica: string; valor: number; meta?: Record<string, unknown> }
): Promise<boolean> {
  const { error } = await sb.from("metrics_daily").upsert(
    {
      fecha: fila.fecha,
      fuente: fila.fuente,
      metrica: fila.metrica,
      valor: fila.valor,
      meta: fila.meta ?? null,
      medido_at: new Date().toISOString(),
    },
    { onConflict: "fecha,fuente,metrica" }
  );

  if (error) {
    console.error("[metrics_daily] upsert error:", error);
    return false;
  }
  return true;
}
