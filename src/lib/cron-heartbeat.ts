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
import { FUENTE_RESULTADO, type ResultadoCron } from "@/lib/cron-resultado";

export const FUENTE_CRON = "cron";

/**
 * Los crons instrumentados, con cada cuántas horas se espera que corran.
 *
 * ALCANCE: los de `/api/cron/*` —los que mueven créditos, plata y facturación—
 * y, desde el 04-sep-2026, los pases de datos de `/api/data/*` que sostienen
 * las páginas de comuna y la referencia del informe (obra nueva diaria, unidades,
 * UF/tasa y el pase semanal). Un scraper que deja de correr no rompe nada a la
 * vista: las medianas siguen saliendo de datos cada vez más viejos. El panel dice
 * cuántos vigila para que la ausencia de uno no se lea como "todo bien".
 *
 * ESTE REGISTRO DEBE SEGUIR A `vercel.json`. Si cambia un schedule allá y no acá,
 * el umbral queda mal calibrado: un cron que pasó a diario se reportaría atrasado
 * cada dos horas, o uno que pasó a horario tardaría dos días en delatarse.
 */
export interface CronVigilado {
  /** Sufijo de la ruta (bajo /api/cron/ o /api/data/) — es también la `metrica` en la tabla. */
  nombre: string;
  /** Etiqueta corta para el panel. */
  label: string;
  /** Cada cuántas horas se espera una corrida (según vercel.json). */
  intervaloHoras: number;
  /**
   * Lo que el cron escribe SIEMPRE que anda bien, y cuánto puede pasar sin que aparezca (29-sep-2026).
   * Es la pregunta que el latido no contesta: scrape-unidades-nuevas latió verde 57 días sin escribir una
   * unidad. Solo los crons que escriben en cada corrida; los que escriben cuando hay trabajo (lotes,
   * gracias, carritos) no tienen frescura fija y los cuida el resultado de la corrida.
   */
  frescura?: { que: string; maxHoras: number; leer: (sb: SupabaseClient) => Promise<string | null> };
}

/** La columna de fecha de la fila que devolvió una lectura de UNA fila. */
function fechaDe(res: { data: unknown; error: { message: string } | null }, columna: string): string | null {
  if (res.error) throw new Error(`${columna}: ${res.error.message}`);
  return res.data ? String((res.data as Record<string, unknown>)[columna]) : null;
}

/** El instante más reciente de una columna, o null. Lectura de UNA fila (orden + limit 1). Las de
 *  scraped_properties van escritas enteras abajo: el tier LECTURA-PAGINADA exige ver la cadena. */
function ultimo(tabla: string, columna: string, filtro?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return async (sb: SupabaseClient): Promise<string | null> => {
    let q = sb.from(tabla).select(columna);
    if (filtro) q = filtro(q);
    const { data, error } = await q.not(columna, "is", null).order(columna, { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`${tabla}.${columna}: ${error.message}`);
    return data ? String((data as unknown as Record<string, unknown>)[columna]) : null;
  };
}

export const CRONS_VIGILADOS: CronVigilado[] = [
  { nombre: "reconcile-subscriptions", label: "Reconciliación de cobros", intervaloHoras: 1 },
  { nombre: "monthly-grants", label: "Lotes mensuales", intervaloHoras: 24 },
  { nombre: "expire-grace", label: "Vencimiento de gracia", intervaloHoras: 24 },
  { nombre: "abandoned-checkout", label: "Carritos abandonados", intervaloHoras: 24 },
  { nombre: "recordatorio-pack", label: "Recordatorio del pack", intervaloHoras: 24 },
  // Latían desde agosto pero no estaban acá: el panel no los veía (29-sep-2026).
  { nombre: "expire-anon", label: "Vencimiento de reclamos anónimos", intervaloHoras: 24 },
  { nombre: "meta-ads", label: "Métricas de Meta Ads", intervaloHoras: 24,
    frescura: { que: "métricas de Meta Ads", maxHoras: 48, leer: ultimo("metrics_daily", "medido_at", (q) => q.eq("fuente", "meta_ads")) } },
  // Corre cada hora los martes: entre martes y martes pasan 7 días.
  { nombre: "evaluar-avisos", label: "Avisos evaluados con el motor", intervaloHoras: 170,
    frescura: { que: "avisos evaluados", maxHoras: 24 * 8, leer: ultimo("avisos_evaluados", "evaluado_at") } },
  { nombre: "sentry-metrics", label: "Métricas de Sentry", intervaloHoras: 24,
    frescura: { que: "errores de Sentry", maxHoras: 48, leer: ultimo("metrics_daily", "medido_at", (q) => q.eq("fuente", "sentry")) } },
  // El que vigila a los demás (cada 6 horas). Si se cae, el panel lo muestra atrasado.
  { nombre: "vigilar-crons", label: "Vigilancia de los crons", intervaloHoras: 6 },
  // Pases de datos (/api/data/*). Cadencias de vercel.json al 04-sep-2026.
  { nombre: "scrape-nuevos", label: "Obra nueva (diario)", intervaloHoras: 24,
    frescura: { que: "proyectos de obra nueva", maxHoras: 48, leer: async (sb) => fechaDe(await sb.from("scraped_properties").select("scraped_at").eq("type", "venta").eq("condicion", "nuevo").or("source_id.is.null,source_id.not.like.%#%").not("scraped_at", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(), "scraped_at") } },
  { nombre: "scrape-unidades-nuevas", label: "Unidades de obra nueva (diario)", intervaloHoras: 24,
    frescura: { que: "unidades de obra nueva", maxHoras: 48, leer: async (sb) => fechaDe(await sb.from("scraped_properties").select("scraped_at").like("source_id", "%#%").not("scraped_at", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(), "scraped_at") } },
  { nombre: "update-market", label: "UF y tasa (diario)", intervaloHoras: 24,
    frescura: { que: "UF", maxHoras: 48, leer: ultimo("config", "updated_at", (q) => q.eq("key", "uf_value")) } },
  // El pase semanal además deja su checkpoint en `config` (admin-backfill-toctoc):
  // acá solo late, allá se lee QUÉ hizo. Los dos conviven.
  { nombre: "backfill-toctoc", label: "Pase semanal TocToc", intervaloHoras: 24 * 7,
    frescura: { que: "avisos usados", maxHoras: 24 * 8, leer: async (sb) => fechaDe(await sb.from("scraped_properties").select("scraped_at").eq("type", "venta").eq("condicion", "usado").not("scraped_at", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(), "scraped_at") } },
];

/** Margen para dar por colgada una corrida que latió y no cerró: el maxDuration más largo es 800 s. */
const MARGEN_CIERRE_MIN = 20;

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
  /** Cómo cerró la última corrida (cerrarCron). null = aún no cierra ninguna con el cierre común. */
  ultimoResultado: ResultadoCron | null;
  /** Latió y no cerró: reventó antes de responder (o sigue colgada pasado el margen). */
  sinCierre: boolean;
  /** Lo último que escribió, si tiene frescura fija; y si ya pasó su plazo. */
  ultimaEscritura: string | null;
  sinEscribir: boolean;
  /** Algo de lo anterior: el panel lo pinta en rojo y vigilar-crons avisa. */
  enRojo: boolean;
  /** Por qué, en una frase (null si está sano). */
  motivo: string | null;
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

  // El resultado de la última corrida de cada cron (cerrarCron, fuente cron-resultado).
  const { data: resultados } = await sb
    .from("metrics_daily")
    .select("metrica, valor, medido_at")
    .eq("fuente", FUENTE_RESULTADO)
    .order("medido_at", { ascending: false });
  const resultadoPorCron = new Map<string, { valor: number; at: string }>();
  for (const f of resultados ?? []) {
    const m = String((f as { metrica: string }).metrica);
    if (!resultadoPorCron.has(m)) resultadoPorCron.set(m, { valor: Number((f as { valor: number }).valor), at: String((f as { medido_at: string }).medido_at) });
  }

  return Promise.all(CRONS_VIGILADOS.map(async (cron) => {
    const ultimaCorrida = ultimaPorCron.get(cron.nombre) ?? null;
    const horas = ultimaCorrida
      ? (Date.now() - new Date(ultimaCorrida).getTime()) / (1000 * 60 * 60)
      : null;
    const atrasado = horas === null || horas > cron.intervaloHoras * FACTOR_ATRASO;

    const r = resultadoPorCron.get(cron.nombre) ?? null;
    const ultimoResultado: ResultadoCron | null = r === null ? null : r.valor === 0 ? "ok" : r.valor === 1 ? "parcial" : "fallo";
    // Solo se juzga el cierre de un cron que ya cerró alguna vez con cerrarCron: el día del deploy
    // ninguno tiene resultado y no por eso están colgados.
    const margen = MARGEN_CIERRE_MIN * 60 * 1000;
    const sinCierre = r !== null && ultimaCorrida !== null
      && new Date(ultimaCorrida).getTime() > new Date(r.at).getTime() + 1000
      && Date.now() - new Date(ultimaCorrida).getTime() > margen;

    let ultimaEscritura: string | null = null;
    let sinEscribir = false;
    let errorFrescura: string | null = null;
    if (cron.frescura) {
      try {
        ultimaEscritura = await cron.frescura.leer(sb);
        sinEscribir = ultimaEscritura === null || Date.now() - new Date(ultimaEscritura).getTime() > cron.frescura.maxHoras * 3600 * 1000;
      } catch (e) {
        errorFrescura = String(e).slice(0, 120);
      }
    }

    const motivo = atrasado
      ? (ultimaCorrida ? `no corre desde hace ${Math.round(horas!)} h (se espera cada ${cron.intervaloHoras} h)` : "sin ninguna corrida registrada")
      : sinCierre ? "la última corrida latió y no cerró: reventó antes de responder"
      : ultimoResultado === "fallo" ? "la última corrida falló entera"
      : ultimoResultado === "parcial" ? "la última corrida falló en parte"
      : sinEscribir ? `no escribe ${cron.frescura!.que} desde ${ultimaEscritura ? ultimaEscritura.slice(0, 16).replace("T", " ") : "nunca"} (plazo ${cron.frescura!.maxHoras} h)`
      : errorFrescura ? `no se pudo leer su frescura: ${errorFrescura}`
      : null;

    return {
      ...cron,
      ultimaCorrida,
      horasDesde: horas,
      atrasado,
      ultimoResultado,
      sinCierre,
      ultimaEscritura,
      sinEscribir,
      enRojo: motivo !== null,
      motivo,
    };
  }));
}
