// ─────────────────────────────────────────────────────────────────────────────
// LAS PÁGINAS DE ENTRADA SE MIDEN DESDE EL SERVIDOR (20-oct-2026, Fabrizio). PostHog carga en el navegador cuando la página
// queda quieta (hasta 4 s después) y quien rebota antes no deja rastro: con tráfico pagado, el escalón que más importa. La
// landing (`landing_viewed`), /deptos (`deptos_vista`) y /i/CÓDIGO (`invitacion_vista`) emiten su vista al servirse:
//   · con los UTM, `fbclid` (su presencia siempre; el valor, solo con «si») y el canal (`canalDeUtm`, la regla de la
//     atribución), el dominio que la refirió y el consentimiento;
//   · sin demorar la respuesta (`waitUntil`), sin contar robots ni vistas previas (WhatsApp, Telegram, el rastreador de
//     Meta…) ni lo que Next pide sin ser una carga (refresco, navegación, prefetch);
//   · y con el MISMO id que va a usar PostHog en el navegador: el servidor se lo pasa en `Server-Timing` (sin cookies) y el
//     navegador arranca con él (`bootstrap`, posthog-cliente.ts). Así la vista y lo que sigue son de la misma persona, y el
//     embudo cuenta a quien rebotó antes de que cargara PostHog.
// El evento del navegador se retiró en las tres (contaría dos veces). Sin «si»: un id de esa visita y sin perfil de persona;
// con «si», el id de su cookie de PostHog; con sesión, la cuenta. Sin IP ni geografía.
// Sin módulos de Node: lo usa el middleware, que corre en Edge. Lo prueba el tier VISTA-ENTRADA.
// ─────────────────────────────────────────────────────────────────────────────
import { canalDeUtm } from "@/lib/canal";
import { conPermiso, type Consentimiento } from "@/lib/consentimiento";
import type { EventoServidor } from "@/lib/posthog-servidor";

export type PaginaEntrada = "landing" | "deptos" | "invitacion";

/** El evento de vista de cada página: los nombres de siempre, para que los paneles sigan leyéndolos. */
export const EVENTO_VISTA: Record<PaginaEntrada, string> = {
  landing: "landing_viewed",
  deptos: "deptos_vista",
  invitacion: "invitacion_vista",
};

/** La cabecera con que el middleware le pasa el id de la visita a la página (la de /i/ emite su vista ella). */
export const CABECERA_VISITA = "x-franco-visita";
/** El nombre en `Server-Timing` con que el navegador recibe el id. */
export const NOMBRE_SERVER_TIMING = "franco-visita";

/** El id de la visita de la cabecera del middleware, solo si tiene forma de uuid (si no, la página genera uno). */
export function visitaDeCabecera(v: string | null | undefined): string | null {
  return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

export function paginaDeEntrada(pathname: string): PaginaEntrada | null {
  if (pathname === "/") return "landing";
  if (pathname === "/deptos" || pathname === "/deptos/") return "deptos";
  if (pathname.startsWith("/i/")) return "invitacion";
  return null;
}

/** Robots de vistas previas, buscadores y clientes sin navegador. Sin agente, también. «…bot/», «…bot;» o «bot» suelto,
 *  no «bot» dentro de un modelo de teléfono (CUBOT). */
const ROBOT = /[a-z]bot[/;]|\bbot\b|adsbot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|slack|linkedin|skype|embedly|pinterest|vkshare|quora link preview|bitly|headless|lighthouse|pagespeed|inspectiontool|curl\/|wget|python|go-http-client|node-fetch|axios|okhttp|java\//i;

export function esRobot(agente: string | null | undefined): boolean {
  return !agente || ROBOT.test(agente);
}

/** ¿Es la carga de la página? No el refresco ni la navegación de Next (cabecera RSC), ni un prefetch. */
export function esCargaDePagina(h: { get(nombre: string): string | null }): boolean {
  if (h.get("rsc") !== null || h.get("next-router-prefetch") !== null) return false;
  if (h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) return false;
  const destino = h.get("sec-fetch-dest");
  return destino === null || destino === "document";
}

/** El id de PostHog que guarda su cookie (`ph_<key>_posthog`), si la hay. */
export function idPostHogDeCookies(cookies: ReadonlyArray<{ name: string; value: string }>, key: string | null | undefined): string | null {
  if (!key) return null;
  const c = cookies.find((x) => x.name === `ph_${key}_posthog`);
  if (!c) return null;
  try {
    const id = (JSON.parse(decodeURIComponent(c.value)) as { distinct_id?: unknown }).distinct_id;
    return typeof id === "string" && id.length > 0 && id.length <= 200 ? id : null;
  } catch {
    return null;
  }
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** La consulta de la URL a partir de los `searchParams` de una página de Next. */
export function consultaDeParametros(sp: Record<string, string | string[] | undefined> | null | undefined): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (Array.isArray(v)) for (const x of v) q.append(k, x);
    else if (v != null) q.append(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Lo que dice la URL de la llegada: los UTM, el clic del anuncio (`fbclid`: su presencia; el valor, solo con permiso), el
 *  canal y el dominio que la refirió. */
export function datosDeLlegada(search: string, referer: string | null, permiso: boolean): Record<string, unknown> {
  const q = new URLSearchParams(search);
  const out: Record<string, unknown> = {};
  for (const k of UTM) {
    const v = q.get(k)?.trim();
    if (v) out[k] = v.slice(0, 120);
  }
  const fbclid = q.get("fbclid")?.trim() ?? "";
  out.con_fbclid = fbclid.length > 0;
  if (fbclid && permiso) out.fbclid = fbclid.slice(0, 500);
  out.con_gclid = !!q.get("gclid");
  out.canal = canalDeUtm({ utm_source: q.get("utm_source"), utm_medium: q.get("utm_medium") });
  let referente: string | null = null;
  try {
    referente = referer ? new URL(referer).hostname : null;
  } catch {
    referente = null;
  }
  out.referente = referente;
  return out;
}

/** ¿Es una visita de prueba? El modo prueba de la medición (`?meta_prueba=1`, que deja la cookie un día; `?meta_prueba=0`
 *  lo apaga): las visitas de QA quedan marcadas y el panel las saca. */
export function esVisitaDePrueba(search: string, cookiePrueba: string | null | undefined): boolean {
  const mp = new URLSearchParams(search).get("meta_prueba");
  if (mp === "1") return true;
  if (mp === "0") return false;
  return cookiePrueba === "1";
}

/** El id con que la visita queda en PostHog: la cuenta; con «si», el de su cookie de PostHog; si no, uno de esta visita. */
export function idDeLaVisita(p: { userId: string | null; consentimiento: Consentimiento | null; idPostHog: string | null; visita: string }): { id: string; conocida: boolean } {
  const conocida = p.userId ?? (conPermiso(p.consentimiento) ? p.idPostHog : null);
  return { id: conocida ?? `visita:${p.visita}`, conocida: !!conocida };
}

/** El evento de la vista, o null si no es una visita (un robot, un refresco de Next). */
export function eventoVistaEntrada(p: {
  pagina: PaginaEntrada;
  /** La ruta tal como llegó, sin la consulta. */
  ruta: string;
  /** La consulta de la URL (`?utm_source=…`), de donde salen los UTM y el `fbclid`. */
  search: string;
  referer: string | null;
  userId: string | null;
  consentimiento: Consentimiento | null;
  idPostHog: string | null;
  /** Un uuid por visita: su id cuando no se sabe quién es, y el del evento. */
  visita: string;
  esCarga: boolean;
  agente: string | null;
  /** Una visita de QA (`esVisitaDePrueba`): queda marcada y el panel la saca. */
  prueba?: boolean;
  /** Lo propio de la página (la invitación: su código, el modo…). */
  extra?: Record<string, unknown>;
}): EventoServidor | null {
  if (!p.esCarga || esRobot(p.agente)) return null;
  const permiso = conPermiso(p.consentimiento);
  const { id, conocida } = idDeLaVisita(p);
  return {
    event: EVENTO_VISTA[p.pagina],
    distinctId: id,
    uuid: p.visita,
    properties: {
      pagina: p.pagina,
      ...p.extra,
      ...datosDeLlegada(p.search, p.referer, permiso),
      consentimiento: permiso ? "si" : "no",
      prueba: !!p.prueba,
      origen: "servidor",
      $pathname: p.ruta,
      // El agente de la persona, como lo manda el navegador con o sin consentimiento: sin él PostHog clasifica todo evento
      // del servidor como «Automation / no_user_agent» y quien filtre robots perdería todas las llegadas (medido el
      // 20-oct-2026). Los robots ya se descartaron arriba.
      $raw_user_agent: (p.agente ?? "").slice(0, 512),
      $process_person_profile: conocida,
      $geoip_disable: true,
    },
  };
}

/** La cabecera que le pasa el id al navegador: `franco-visita;desc="<id>"` (se agrega a `Server-Timing`). */
export function serverTimingDeVisita(id: string): string {
  return `${NOMBRE_SERVER_TIMING};desc="${id.replace(/["\\]/g, "")}"`;
}

/** El id que dejó el servidor, de las entradas de `Server-Timing` de la carga (en el navegador:
 *  `performance.getEntriesByType("navigation")[0].serverTiming`). */
export function idDeServerTiming(entradas: ReadonlyArray<{ name: string; description: string }> | null | undefined): string | null {
  const e = (entradas ?? []).find((x) => x.name === NOMBRE_SERVER_TIMING);
  const id = e?.description?.trim() ?? "";
  return id.length > 0 && id.length <= 200 ? id : null;
}

/** Manda el evento a PostHog con `fetch` (sirve en Edge, a diferencia de `capturarServidor`). Nunca lanza. */
export async function enviarVista(ev: EventoServidor, deps: { fetch?: typeof fetch; key?: string; host?: string } = {}): Promise<boolean> {
  const key = deps.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  const host = (deps.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const f = deps.fetch ?? globalThis.fetch;
  try {
    const res = await f(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: ev.event,
        distinct_id: ev.distinctId,
        ...(ev.uuid ? { uuid: ev.uuid } : {}),
        timestamp: ev.timestamp ?? new Date().toISOString(),
        properties: { ...(ev.properties ?? {}), $lib: "franco-servidor" },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
