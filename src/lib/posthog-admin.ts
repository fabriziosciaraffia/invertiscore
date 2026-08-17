// ─────────────────────────────────────────────────────────────────────────────
// PostHog server-side para el panel admin (Fase B, medición post-F2).
//
// Pasos 1-2 del funnel de 7: visitas (sesiones únicas con pageview) e
// "iniciaron análisis" (personas que vieron el primer paso del wizard v4).
// Decisión ratificada: HogQL vía API con key de SOLO LECTURA
// (POSTHOG_PERSONAL_API_KEY, sensitive en Vercel), proyecto 371128.
//
// Contratos duros:
//  · FAIL-SOFT TOTAL: sin key, timeout, 4xx/5xx o shape inesperado → null.
//    El panel muestra "sin datos" en 1-2 y el funnel 3-7 vive igual. Jamás
//    se propaga un error de PostHog a la página.
//  · CACHÉ DE 15 MIN vía unstable_cache, keyed por período+toggle. El fallo NO
//    se cachea: la función interna lanza y unstable_cache no guarda errores —
//    un hipo transitorio de PostHog no deja al panel pegado en "sin datos".
//    Era diario (86400 s) y el panel se veía muerto: con el funnel 3-7 en vivo
//    desde Supabase, un paso 1 congelado horas se lee como número roto, no como
//    número cacheado. 15 min protegen la API de PostHog de sobra para una
//    página que mira una persona.
//  · FRESCURA VISIBLE: la foto viaja con su `medidoEn` (ISO del instante en que
//    PostHog respondió), guardado DENTRO del payload cacheado. Es la única
//    manera de saber la edad del dato: unstable_cache no expone cuándo llenó la
//    entrada. El panel lo pinta como "hace X min" — un dato cacheado sin
//    etiqueta parece un dato roto.
//  · Anti-bot: properties.$virt_traffic_type = 'Regular'. Es una propiedad
//    VIRTUAL (no aparece en la taxonomía del proyecto pero se computa en
//    query) — verificada contra el proyecto real el 16-ago: 2.664/2.667
//    pageviews de 7 días son Regular, 0 NULL.
//  · Cuentas internas: person property `test_account` (la setea
//    useAttributionSync vía RPC es_test_account). Se excluye salvo que el
//    toggle del panel pida incluirlas — coherente con el resto de la página.
//
// Las queries son strings FIJOS con fechas ISO interpoladas desde constantes
// del server — nada del request del usuario entra al HogQL.
// ─────────────────────────────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";

const HOST = "https://us.posthog.com";
const PROJECT_ID = "371128";
const TIMEOUT_MS = 15_000;

export interface PasosPostHog {
  /** Sesiones únicas con pageview en el período. null = PostHog no respondió. */
  visitas: number | null;
  /** Personas únicas que vieron el primer paso del wizard (node 'mod'). */
  iniciaronWizard: number | null;
  /** Sesiones cuyo PRIMER pageview traía utm_medium='paid'. null = sin dato. */
  visitasPagada: number | null;
  /** Sesiones restantes (sin utm o con otro medium). null = sin dato. */
  visitasOrganico: number | null;
  /** Apertura del tráfico pagado por utm_source (ig, fb, …). [] = sin dato. */
  origenPorFuente: ItemApertura[];
  /** Apertura de quienes abren el wizard por tipo de dispositivo. */
  wizardPorDispositivo: ItemApertura[];
  /** ISO del instante en que PostHog respondió esta foto. null = fail-soft. */
  medidoEn: string | null;
}

/** Una fila del desglose de un nodo. */
export interface ItemApertura {
  etiqueta: string;
  valor: number;
}

const SIN_DATOS: PasosPostHog = {
  visitas: null,
  iniciaronWizard: null,
  visitasPagada: null,
  visitasOrganico: null,
  origenPorFuente: [],
  wizardPorDispositivo: [],
  medidoEn: null,
};

/** Un día de la serie de tasas. Los null son "PostHog mudo", no cero. */
export interface DiaPostHog {
  /** ISO corto YYYY-MM-DD (día UTC, como agrupa HogQL). */
  dia: string;
  visitas: number | null;
  iniciaronWizard: number | null;
}

/** Frescura del caché de los pasos 1-2. */
export const REVALIDATE_POSTHOG_S = 900;

async function queryHogqlNumero(sql: string): Promise<number | null> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[posthog-admin] HTTP ${res.status} en query HogQL`);
      return null;
    }
    const data = (await res.json()) as { results?: unknown[][] };
    const valor = data.results?.[0]?.[0];
    return typeof valor === "number" ? valor : null;
  } catch (e) {
    console.error("[posthog-admin] query HogQL falló:", e);
    return null;
  }
}

/**
 * Igual que `queryHogqlNumero` pero devuelve la grilla completa. Mismo
 * fail-soft: cualquier problema → null, jamás una excepción hacia arriba.
 */
async function queryHogqlFilas(sql: string): Promise<unknown[][] | null> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[posthog-admin] HTTP ${res.status} en query HogQL (filas)`);
      return null;
    }
    const data = (await res.json()) as { results?: unknown[][] };
    return Array.isArray(data.results) ? data.results : null;
  } catch (e) {
    console.error("[posthog-admin] query HogQL (filas) falló:", e);
    return null;
  }
}

/** Cláusulas compartidas del período y los filtros. `hastaIso` null = sin tope. */
function clausulas(desdeIso: string, hastaIso: string | null, includeTest: boolean): string {
  const partes = [
    `timestamp >= toDateTime('${desdeIso}')`,
    ...(hastaIso ? [`timestamp < toDateTime('${hastaIso}')`] : []),
    `properties.$virt_traffic_type = 'Regular'`,
    ...(includeTest
      ? []
      : [`(person.properties.test_account IS NULL OR person.properties.test_account != true)`]),
  ];
  return partes.join(" AND ");
}

async function pasosSinCache(
  desdeIso: string,
  hastaIso: string | null,
  includeTest: boolean,
): Promise<PasosPostHog> {
  const where = clausulas(desdeIso, hastaIso, includeTest);
  const [visitas, iniciaronWizard, origen, porFuente, porDispositivo] = await Promise.all([
    queryHogqlNumero(
      `SELECT uniq(properties.$session_id) FROM events WHERE event = '$pageview' AND ${where}`,
    ),
    queryHogqlNumero(
      `SELECT uniq(person_id) FROM events WHERE event = 'wizard4_step_viewed' AND properties.node = 'mod' AND ${where}`,
    ),
    // Origen por sesión: se clasifica por el utm_medium del PRIMER pageview
    // (argMin por timestamp), no por el de cada evento. `utm_medium` viaja solo
    // en el pageview de entrada — mirarlo evento a evento contaría la misma
    // sesión como pagada y orgánica a la vez. Verificado 17-ago: paid llega de
    // ig/fb/an/th; todo lo demás (incluido sin-utm) cae en orgánico.
    queryHogqlFilas(
      `SELECT countIf(origen = 'paid') AS pagada, countIf(origen != 'paid') AS organico FROM (` +
        `SELECT properties.$session_id AS sid, ` +
        `argMin(coalesce(nullIf(properties.utm_medium, ''), ''), timestamp) AS origen ` +
        `FROM events WHERE event = '$pageview' AND ${where} GROUP BY sid)`,
    ),
    // Apertura del pagado por utm_source. Mismo criterio: la fuente sale del
    // PRIMER pageview de la sesión, así una sesión pertenece a una sola fuente.
    queryHogqlFilas(
      `SELECT fuente, count() AS sesiones FROM (` +
        `SELECT properties.$session_id AS sid, ` +
        `argMin(coalesce(nullIf(properties.utm_medium, ''), ''), timestamp) AS medio, ` +
        `argMin(coalesce(nullIf(properties.utm_source, ''), 'sin fuente'), timestamp) AS fuente ` +
        `FROM events WHERE event = '$pageview' AND ${where} GROUP BY sid) ` +
        `WHERE medio = 'paid' GROUP BY fuente ORDER BY sesiones DESC`,
    ),
    // Apertura del wizard por dispositivo.
    queryHogqlFilas(
      `SELECT coalesce(nullIf(properties.$device_type, ''), 'sin dato') AS disp, uniq(person_id) AS personas ` +
        `FROM events WHERE event = 'wizard4_step_viewed' AND properties.node = 'mod' AND ${where} ` +
        `GROUP BY disp ORDER BY personas DESC`,
    ),
  ]);
  const fila = origen?.[0];
  const pagada = typeof fila?.[0] === "number" ? (fila[0] as number) : null;
  const organico = typeof fila?.[1] === "number" ? (fila[1] as number) : null;
  // Si TODAS vinieron null se lanza para que unstable_cache NO persista el
  // fallo (los errores no se cachean). Un null parcial sí se cachea: es un
  // resultado legítimo de una query que devolvió shape raro, y el otro número
  // sigue siendo útil.
  if (visitas === null && iniciaronWizard === null && pagada === null) {
    throw new Error("posthog sin respuesta");
  }
  return {
    visitas,
    iniciaronWizard,
    visitasPagada: pagada,
    visitasOrganico: organico,
    origenPorFuente: aItems(porFuente),
    wizardPorDispositivo: aItems(porDispositivo),
    medidoEn: new Date().toISOString(),
  };
}

/** Grilla [etiqueta, valor] → items tipados, descartando filas de shape raro. */
function aItems(filas: unknown[][] | null): ItemApertura[] {
  if (!filas) return [];
  return filas.flatMap((f) =>
    typeof f[0] === "string" && typeof f[1] === "number"
      ? [{ etiqueta: f[0], valor: f[1] }]
      : [],
  );
}

/**
 * Serie diaria para el gráfico de tasas. Ventana propia (últimos N días), NO el
 * período del panel: la evolución se lee sobre una ventana móvil corta, y el
 * filtro de período ya manda en el Sankey.
 *
 * Una sola pasada sobre `events` con uniqIf — dos queries separadas leerían el
 * mismo rango dos veces para juntar las columnas después por fecha.
 *
 * OJO con la suma: una sesión que cruza medianoche UTC cuenta en los dos días,
 * así que la suma de la serie es ligeramente mayor que el uniq del período. Es
 * correcto para una serie diaria y no se debe usar para totales.
 */
async function serieSinCache(desdeIso: string, includeTest: boolean): Promise<DiaPostHog[]> {
  const where = clausulas(desdeIso, null, includeTest);
  const filas = await queryHogqlFilas(
    `SELECT toStartOfDay(timestamp) AS dia, ` +
      `uniqIf(properties.$session_id, event = '$pageview') AS visitas, ` +
      `uniqIf(person_id, event = 'wizard4_step_viewed' AND properties.node = 'mod') AS wiz ` +
      `FROM events WHERE ${where} AND event IN ('$pageview', 'wizard4_step_viewed') ` +
      `GROUP BY dia ORDER BY dia`,
  );
  if (filas === null) throw new Error("posthog sin respuesta (serie)");
  return filas.flatMap((f) => {
    const dia = typeof f[0] === "string" ? f[0].slice(0, 10) : null;
    if (!dia) return [];
    return [
      {
        dia,
        visitas: typeof f[1] === "number" ? f[1] : null,
        iniciaronWizard: typeof f[2] === "number" ? f[2] : null,
      },
    ];
  });
}

const serieCacheada = unstable_cache(serieSinCache, ["admin-funnel-posthog-serie"], {
  revalidate: REVALIDATE_POSTHOG_S,
});

/**
 * Serie diaria de visitas y aperturas de wizard. Nunca lanza: con PostHog mudo
 * devuelve [] y el gráfico omite sus dos tramos, dejando vivo el resto.
 */
export async function seriePostHog(desdeIso: string, includeTest: boolean): Promise<DiaPostHog[]> {
  try {
    return await serieCacheada(desdeIso, includeTest);
  } catch {
    return [];
  }
}

const pasosCacheados = unstable_cache(pasosSinCache, ["admin-funnel-posthog"], {
  revalidate: REVALIDATE_POSTHOG_S,
});

/**
 * Pasos 1-2 del funnel, cacheados 15 min por (período × toggle). Nunca lanza:
 * el fallo degrada a { null, null } y el caller pinta "sin datos".
 */
export async function pasosPostHog(
  desdeIso: string,
  hastaIso: string | null,
  includeTest: boolean,
): Promise<PasosPostHog> {
  try {
    return await pasosCacheados(desdeIso, hastaIso, includeTest);
  } catch {
    return SIN_DATOS;
  }
}
