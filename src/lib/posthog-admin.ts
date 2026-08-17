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
  /** ISO del instante en que PostHog respondió esta foto. null = fail-soft. */
  medidoEn: string | null;
}

const SIN_DATOS: PasosPostHog = { visitas: null, iniciaronWizard: null, medidoEn: null };

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
  const [visitas, iniciaronWizard] = await Promise.all([
    queryHogqlNumero(
      `SELECT uniq(properties.$session_id) FROM events WHERE event = '$pageview' AND ${where}`,
    ),
    queryHogqlNumero(
      `SELECT uniq(person_id) FROM events WHERE event = 'wizard4_step_viewed' AND properties.node = 'mod' AND ${where}`,
    ),
  ]);
  // Si AMBAS vinieron null se lanza para que unstable_cache NO persista el
  // fallo (los errores no se cachean). Un null parcial sí se cachea: es un
  // resultado legítimo de una query que devolvió shape raro, y el otro número
  // sigue siendo útil.
  if (visitas === null && iniciaronWizard === null) {
    throw new Error("posthog sin respuesta");
  }
  return { visitas, iniciaronWizard, medidoEn: new Date().toISOString() };
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
