/**
 * Latido de los crons: cada corrida deja su marca, y el panel avisa cuando un
 * cron dejó de correr.
 *
 * EL AGUJERO QUE TAPA. Los crons de Vercel se registran contra el deployment de
 * producción vigente, así que cada deploy a producción reemplaza el registro. El
 * 10-ago-2026 hubo deploys a las 13:05 y 13:35 UTC —justo alrededor de la ventana
 * de disparo del reconciliador, que venía corriendo entre 13:06 y 13:45— y ese día
 * el cron simplemente no se ejecutó. No falló: no corrió. Y una corrida que no
 * ocurre no deja rastro en ningún lado: ni log, ni error, ni fila. El cobro de
 * suscripción que el webhook había perdido esa madrugada se quedó sin su red de
 * seguridad y nadie se enteró hasta el post-mortem.
 *
 * Un cron que no corre es indistinguible de un cron que corrió y no tuvo trabajo.
 * Esta es la pieza que los separa.
 *
 * DÓNDE VIVE EL DATO. En `metrics_daily` (fuente 'cron'), la misma tabla genérica
 * que ya usa sentry-metrics: cero DDL nuevo. La PK (fecha, fuente, metrica) hace
 * el upsert idempotente por día y `medido_at` guarda el instante de la última
 * corrida, que es lo que mira la detección de atraso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarMetrica } from "@/lib/metrics-daily";

export const FUENTE_CRON = "cron";

/**
 * Los crons instrumentados, con cada cuántas horas se espera que corran.
 *
 * ALCANCE DECLARADO: solo los de `/api/cron/*` —los que mueven créditos, plata y
 * facturación—. Los scrapers de `/api/data/*` también son crons y NO están acá;
 * si mañana importan, se agregan. El panel dice explícitamente cuántos vigila
 * para que la ausencia de un scraper no se lea como "todo bien".
 *
 * ESTE REGISTRO DEBE SEGUIR A `vercel.json`. Si cambia un schedule allá y no acá,
 * el umbral queda mal calibrado: un cron que pasó a diario se reportaría atrasado
 * cada dos horas, o uno que pasó a horario tardaría dos días en delatarse.
 */
export interface CronVigilado {
  /** Sufijo de la ruta bajo /api/cron/ — es también la `metrica` en la tabla. */
  nombre: string;
  /** Etiqueta corta para el panel. */
  label: string;
  /** Cada cuántas horas se espera una corrida (según vercel.json). */
  intervaloHoras: number;
}

export const CRONS_VIGILADOS: CronVigilado[] = [
  { nombre: "reconcile-subscriptions", label: "Reconciliación de cobros", intervaloHoras: 1 },
  { nombre: "monthly-grants", label: "Lotes mensuales", intervaloHoras: 24 },
  { nombre: "expire-grace", label: "Vencimiento de gracia", intervaloHoras: 24 },
  { nombre: "abandoned-checkout", label: "Carritos abandonados", intervaloHoras: 24 },
  { nombre: "sentry-metrics", label: "Métricas de Sentry", intervaloHoras: 24 },
];

/**
 * Cuántos intervalos de atraso hacen falta para declarar atrasado un cron.
 *
 * 2× y no 1×: Vercel dispara los crons con jitter (el reconciliador diario venía
 * corriendo entre :06 y :45 pasada su hora), así que un umbral pegado al intervalo
 * daría rojo por ruido de scheduling. Con 2× hace falta perder una corrida ENTERA
 * —exactamente el modo de falla del 10-ago— para que se encienda.
 */
const FACTOR_ATRASO = 2;

/**
 * Deja el latido de esta corrida. Llamar al PRINCIPIO del handler, después del
 * chequeo de auth y antes del trabajo: lo que se registra es "el cron se ejecutó",
 * no "el cron terminó bien". Si terminó mal, eso ya lo cuentan el status y Sentry;
 * lo que acá no se puede perder es la señal de que corrió.
 *
 * Nunca lanza ni interrumpe: un fallo del latido no puede voltear un cron que
 * mueve créditos. Devuelve false si no pudo escribir.
 */
export async function latirCron(sb: SupabaseClient, nombre: string): Promise<boolean> {
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    // Contador de corridas del día. Es un PISO, no un total: el incremento es
    // leer-y-escribir, así que dos corridas simultáneas pueden pisarse (misma
    // limitación declarada del contador de AirROI). No importa — el dato que
    // sostiene la detección de atraso es `medido_at`, que la última escritura
    // deja correcto igual.
    const { data: previo } = await sb
      .from("metrics_daily")
      .select("valor")
      .eq("fecha", hoy)
      .eq("fuente", FUENTE_CRON)
      .eq("metrica", nombre)
      .maybeSingle();

    return await guardarMetrica(sb, {
      fecha: hoy,
      fuente: FUENTE_CRON,
      metrica: nombre,
      valor: Number(previo?.valor ?? 0) + 1,
    });
  } catch (e) {
    console.error("[cron-heartbeat] latido falló para", nombre, e);
    return false;
  }
}

export interface LatidoCron extends CronVigilado {
  /** Instante de la última corrida registrada, o null si no hay ninguna. */
  ultimaCorrida: string | null;
  /** Horas transcurridas desde esa corrida. null = nunca corrió (o sin dato). */
  horasDesde: number | null;
  /** true si supera el umbral de atraso (o si nunca se registró una corrida). */
  atrasado: boolean;
}

/**
 * Estado de los crons vigilados, listo para pintar.
 *
 * `ultimaCorrida === null` se trata como ATRASADO a propósito. Es el estado del
 * cron que nunca escribió un latido, y ese es justamente el caso que no queremos
 * que pase por sano: mientras la tabla no tenga filas —o si la ruta dejó de
 * llamar a `latirCron`— el panel tiene que decirlo, no callar.
 *
 * CAVEAT DEL DESPLIEGUE: hasta que cada cron corra una vez con esta versión
 * desplegada, TODOS figuran atrasados. Es correcto —no tenemos evidencia de que
 * hayan corrido— y se resuelve solo dentro de un ciclo de cada uno.
 */
export async function leerLatidos(sb: SupabaseClient): Promise<LatidoCron[]> {
  const { data, error } = await sb
    .from("metrics_daily")
    .select("metrica, medido_at")
    .eq("fuente", FUENTE_CRON)
    .order("medido_at", { ascending: false });

  if (error) {
    // Tabla ausente = estado esperado (mismo criterio que leerSerie).
    if (!["PGRST205", "42P01"].includes(error.code)) {
      console.error("[cron-heartbeat] query error:", error);
    }
  }

  // Orden descendente por medido_at → la primera aparición de cada métrica es la
  // más reciente.
  const ultimaPorCron = new Map<string, string>();
  for (const fila of data ?? []) {
    const m = String((fila as { metrica: string }).metrica);
    if (!ultimaPorCron.has(m)) {
      ultimaPorCron.set(m, String((fila as { medido_at: string }).medido_at));
    }
  }

  return CRONS_VIGILADOS.map((cron) => {
    const ultimaCorrida = ultimaPorCron.get(cron.nombre) ?? null;
    const horas = ultimaCorrida
      ? (Date.now() - new Date(ultimaCorrida).getTime()) / (1000 * 60 * 60)
      : null;
    return {
      ...cron,
      ultimaCorrida,
      horasDesde: horas,
      atrasado: horas === null || horas > cron.intervaloHoras * FACTOR_ATRASO,
    };
  });
}
