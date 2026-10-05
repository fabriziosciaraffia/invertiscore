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
 * UF/tasa y el pase diario de usados). Un scraper que deja de correr no rompe nada a la
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
   * Desde cuándo existe (ISO), para los crons nuevos (30-sep-2026). Sin corridas todavía y dentro de
   * `FACTOR_ATRASO` intervalos desde acá, NO está atrasado: aún no le toca. El 30-sep a las 00:45
   * vigilar-crons alertó «recordatorio-pack sin ninguna corrida» antes de su primera corrida de las 13:00.
   */
  desde?: string;
  /**
   * Cuándo entró a producción el ritmo vigente (ISO), para los crons que cambiaron de cadencia (02-oct-2026).
   * El atraso y la frescura se cuentan desde la última corrida o desde acá, lo que sea más reciente: la
   * corrida anterior al cambio se esperó con el ritmo viejo. El 01-oct backfill-toctoc pasó de semanal a
   * diario y evaluar-avisos de los martes a diario; esa tarde vigilar-crons avisó «no corre desde hace 88 h»
   * y «49 h» de dos crons que no se habían saltado ninguna corrida. Va la fecha del deploy, no la del commit.
   */
  cadenciaDesde?: string;
  /**
   * Cuándo entró a producción el código vigente del cron (ISO), para los que cambiaron de código (02-oct-2026).
   * Lo anterior a este instante no alerta: ni la falla de una corrida que corrió con el código viejo (ya
   * avisó desde cerrarCron), ni una corrida sin cierre de antes, y la frescura se cuenta desde acá. Se espera
   * a la primera corrida con el código nuevo. El 02-oct a las 18:45 la vigilancia avisó «la última corrida
   * falló entera» de scrape-unidades-nuevas: era la corrida de las 14:00 con el GraphQL ya retirado, y el
   * disparo fue la frescura de una marca que el pase nuevo todavía no había tenido ocasión de escribir.
   */
  codigoDesde?: string;
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
  { nombre: "recordatorio-pack", label: "Recordatorio del pack", intervaloHoras: 24, desde: "2026-09-29T13:00:00Z" },
  // Latían desde agosto pero no estaban acá: el panel no los veía (29-sep-2026).
  { nombre: "expire-anon", label: "Vencimiento de reclamos anónimos", intervaloHoras: 24 },
  { nombre: "meta-ads", label: "Métricas de Meta Ads", intervaloHoras: 24,
    frescura: { que: "métricas de Meta Ads", maxHoras: 48, leer: ultimo("metrics_daily", "medido_at", (q) => q.eq("fuente", "meta_ads")) } },
  // Corre a las 04:20 y 08:20 UTC cada día (01-oct-2026): el hueco más largo son 20 horas.
  { nombre: "evaluar-avisos", label: "Avisos evaluados con el motor", intervaloHoras: 24, desde: "2026-09-29T22:00:00Z",
    cadenciaDesde: "2026-10-01T14:27:00Z",
    frescura: { que: "avisos evaluados", maxHoras: 48, leer: ultimo("avisos_evaluados", "evaluado_at") } },
  { nombre: "sentry-metrics", label: "Métricas de Sentry", intervaloHoras: 24,
    frescura: { que: "errores de Sentry", maxHoras: 48, leer: ultimo("metrics_daily", "medido_at", (q) => q.eq("fuente", "sentry")) } },
  // El que vigila a los demás (cada 6 horas). Si se cae, el panel lo muestra atrasado.
  { nombre: "vigilar-crons", label: "Vigilancia de los crons", intervaloHoras: 6, desde: "2026-09-29T22:40:00Z" },
  // El correo semanal (02-oct-2026): se arma el domingo (cada hora, de 11 a 23 UTC) y sale el lunes.
  { nombre: "semanal-armar", label: "Correo semanal: la selección (domingo)", intervaloHoras: 168, desde: "2026-10-04T11:00:00Z" },
  // El prechequeo (05-oct-2026): de lunes a sábado, cada hora de 03:35 a 08:35 UTC. El hueco más largo es del
  // sábado 08:35 al lunes 03:35 (43 horas), dentro de dos intervalos de 24.
  { nombre: "semanal-prechequeo", label: "Correo semanal: el prechequeo de las fichas (noches)", intervaloHoras: 24, desde: "2026-10-06T03:35:00Z" },
  { nombre: "semanal-enviar", label: "Correo semanal: el envío (lunes)", intervaloHoras: 168, desde: "2026-10-05T12:00:00Z" },
  // Pases de datos (/api/data/*). Cadencias de vercel.json al 04-sep-2026.
  { nombre: "scrape-nuevos", label: "Obra nueva (diario)", intervaloHoras: 24,
    frescura: { que: "proyectos de obra nueva", maxHoras: 48, leer: async (sb) => fechaDe(await sb.from("scraped_properties").select("scraped_at").eq("type", "venta").eq("condicion", "nuevo").or("source_id.is.null,source_id.not.like.%#%").not("scraped_at", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(), "scraped_at") } },
  // Unidades de obra nueva (02-oct-2026): cruza los deptos disponibles de la ficha nueva, sin precio. Lo que
  // escribe en cada corrida es la marca de vista (seen_pass_id «unidades@<instante>», el mismo prefijo que
  // PREFIJO_VISTA_UNIDADES), no scraped_at: ese queda como la fecha del precio.
  { nombre: "scrape-unidades-nuevas", label: "Unidades de obra nueva: disponibles (diario)", intervaloHoras: 24, codigoDesde: "2026-10-02T18:26:40Z",
    frescura: { que: "unidades vistas", maxHoras: 48, leer: async (sb) => (fechaDe(await sb.from("scraped_properties").select("seen_pass_id").like("seen_pass_id", "unidades@%").order("seen_pass_id", { ascending: false }).limit(1).maybeSingle(), "seen_pass_id") ?? "").replace(/^unidades@/, "") || null } },
  { nombre: "update-market", label: "UF y tasa (diario)", intervaloHoras: 24,
    frescura: { que: "UF", maxHoras: 48, leer: ultimo("config", "updated_at", (q) => q.eq("key", "uf_value")) } },
  // El pase diario (01-oct-2026; antes semanal) además deja su checkpoint en `config`
  // (admin-backfill-toctoc): acá solo late, allá se lee QUÉ hizo. Los dos conviven.
  { nombre: "backfill-toctoc", label: "Pase diario TocToc", intervaloHoras: 24, cadenciaDesde: "2026-10-01T14:27:00Z",
    frescura: { que: "avisos usados", maxHoras: 48, leer: async (sb) => fechaDe(await sb.from("scraped_properties").select("scraped_at").eq("type", "venta").eq("condicion", "usado").not("scraped_at", "is", null).order("scraped_at", { ascending: false }).limit(1).maybeSingle(), "scraped_at") } },
];

/**
 * ¿Atrasado? Pasó más de `FACTOR_ATRASO` intervalos desde la última corrida; o nunca corrió y ya tuvo
 * tiempo de hacerlo (un cron nuevo, con `desde`, no está atrasado antes de su primera corrida).
 */
export function estaAtrasado(cron: Pick<CronVigilado, "intervaloHoras" | "desde" | "cadenciaDesde" | "codigoDesde">, horasDesde: number | null, ahora: number = Date.now()): boolean {
  if (horasDesde !== null) return horasDelRitmo(cron, horasDesde, ahora) > cron.intervaloHoras * FACTOR_ATRASO;
  if (!cron.desde) return true;
  return ahora - new Date(cron.desde).getTime() > cron.intervaloHoras * FACTOR_ATRASO * 3600e3;
}

/** Las horas que cuentan para el ritmo: desde la última vez, o desde el cambio de cadencia o de código si es
 *  más reciente. */
export function horasDelRitmo(cron: Pick<CronVigilado, "cadenciaDesde" | "codigoDesde">, horas: number, ahora: number = Date.now()): number {
  const desde = Math.max(cron.cadenciaDesde ? new Date(cron.cadenciaDesde).getTime() : -Infinity, cron.codigoDesde ? new Date(cron.codigoDesde).getTime() : -Infinity);
  if (!Number.isFinite(desde)) return horas;
  return Math.min(horas, (ahora - desde) / 3600e3);
}

/** ¿Este instante es anterior al código vigente del cron? Lo que pasó antes no alerta (ver `codigoDesde`). */
export function anteriorAlCodigo(cron: Pick<CronVigilado, "codigoDesde">, instanteIso: string | null | undefined): boolean {
  return !!cron.codigoDesde && !!instanteIso && new Date(instanteIso).getTime() < new Date(cron.codigoDesde).getTime();
}

/** ¿El dato que el cron escribe pasó su plazo? Con el mismo arranque que el atraso (`horasDelRitmo`). */
export function escrituraVencida(cron: Pick<CronVigilado, "cadenciaDesde" | "codigoDesde">, ultimaEscritura: string | null, maxHoras: number, ahora: number = Date.now()): boolean {
  // Nunca escribió: vencida, salvo que el reloj haya partido hace poco (cambio de cadencia o de código).
  // El 02-oct a las 18:45 la marca del pase nuevo de unidades no existía porque el pase todavía no corría.
  if (ultimaEscritura === null) return horasDelRitmo(cron, Infinity, ahora) > maxHoras;
  return horasDelRitmo(cron, (ahora - new Date(ultimaEscritura).getTime()) / 3600e3, ahora) > maxHoras;
}

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
  /** La frase de CADA motivo encendido, por la clave con que alerta vigilar-crons: el correo dice el motivo
   *  que disparó la alerta, no el de mayor prioridad del panel. */
  motivos: Partial<Record<"atrasado" | "sin-cierre" | "falla" | "sin-escribir" | "frescura", string>>;
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
    const atrasado = estaAtrasado(cron, horas);

    // Un resultado de antes del código vigente no cuenta: corrió con el código viejo (ver `codigoDesde`).
    const rLeido = resultadoPorCron.get(cron.nombre) ?? null;
    const r = rLeido && anteriorAlCodigo(cron, rLeido.at) ? null : rLeido;
    const ultimoResultado: ResultadoCron | null = r === null ? null : r.valor === 0 ? "ok" : r.valor === 1 ? "parcial" : "fallo";
    // Solo se juzga el cierre de un cron que ya cerró alguna vez con cerrarCron: el día del deploy
    // ninguno tiene resultado y no por eso están colgados.
    const margen = MARGEN_CIERRE_MIN * 60 * 1000;
    const sinCierre = r !== null && ultimaCorrida !== null && !anteriorAlCodigo(cron, ultimaCorrida)
      && new Date(ultimaCorrida).getTime() > new Date(r.at).getTime() + 1000
      && Date.now() - new Date(ultimaCorrida).getTime() > margen;

    let ultimaEscritura: string | null = null;
    let sinEscribir = false;
    let errorFrescura: string | null = null;
    if (cron.frescura) {
      try {
        ultimaEscritura = await cron.frescura.leer(sb);
        sinEscribir = escrituraVencida(cron, ultimaEscritura, cron.frescura.maxHoras);
      } catch (e) {
        errorFrescura = String(e).slice(0, 120);
      }
    }

    const motivos: LatidoCron["motivos"] = {};
    if (atrasado) motivos.atrasado = ultimaCorrida ? `no corre desde hace ${Math.round(horas!)} h (se espera cada ${cron.intervaloHoras} h)` : "sin ninguna corrida registrada";
    if (sinCierre) motivos["sin-cierre"] = "la última corrida latió y no cerró: reventó antes de responder";
    if (ultimoResultado === "fallo" || ultimoResultado === "parcial") motivos.falla = ultimoResultado === "fallo" ? "la última corrida falló entera" : "la última corrida falló en parte";
    if (sinEscribir) motivos["sin-escribir"] = `no escribe ${cron.frescura!.que} desde ${ultimaEscritura ? ultimaEscritura.slice(0, 16).replace("T", " ") : "nunca"} (plazo ${cron.frescura!.maxHoras} h)`;
    if (errorFrescura) motivos.frescura = `no se pudo leer su frescura: ${errorFrescura}`;
    const motivo = motivos.atrasado ?? motivos["sin-cierre"] ?? motivos.falla ?? motivos["sin-escribir"] ?? motivos.frescura ?? null;

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
      motivos,
    };
  }));
}
