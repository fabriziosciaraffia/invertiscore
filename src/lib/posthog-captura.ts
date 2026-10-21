// ─────────────────────────────────────────────────────────────────────────────
// EL ÚNICO PUNTO QUE MANDA EVENTOS A POSTHOG DESDE EL SERVIDOR (20-oct-2026, Fabrizio). Todo evento del servidor sale
// por `enviarCaptura`: lo llaman `capturarServidor` (posthog-servidor.ts, Node) y `enviarVista` (vista-entrada.ts, el
// middleware en Edge). Por eso este archivo no importa módulos de Node.
//
// EL AGENTE: PostHog clasifica el tráfico por el agente (`$raw_user_agent`), y todo evento sin agente lo marca robot
// («Automation / no_user_agent», `$virt_is_bot` = true; medido en producción el 20-oct-2026). Quien filtre robots
// perdía el registro, el análisis, los correos y el pago. Cada evento lleva el del NAVEGADOR DE LA PERSONA, nunca el de
// quien hace el pedido cuando no es ella (el webhook de Flow o de Resend, el cron de Vercel), y `agente_origen` dice
// de dónde salió:
//   · `evento`    — el que el evento ya trae (las vistas de entrada lo ponen del pedido que las sirve);
//   · `pedido`    — el del pedido en curso, si viene de un navegador (`agenteDeNavegador`);
//   · `recordado` — el último que Franco le vio a esa persona (tabla `agentes_navegador`, agentes-navegador.ts);
//   · `cola`      — Franco todavía no había visto su navegador: el evento esperó en `eventos_sin_agente`, con su hora,
//                   y salió cuando lo vio;
//   · `ninguno`   — esperó más de 24 horas sin que Franco viera su navegador: sale igual, con su hora y el agente
//                   genérico de Franco (`AGENTE_GENERICO`), para que los paneles puedan separarlo (21-oct-2026).
// NINGÚN EVENTO SALE SIN AGENTE: `enviarCaptura` no manda uno que no lo traiga. Lo prueba el tier AGENTE-SERVIDOR.
//
// LA MARCA DE CUENTA DE PRUEBA (21-oct-2026, Fabrizio): todo evento de una cuenta de `test_accounts` —la misma regla
// que `es_test_account`— sale con `$set: { test_account: true }` y `prueba: true`, desde el primer evento. PostHog
// guarda las propiedades de la persona EN el evento (`person_id_override_properties_on_events`): la marca que el
// navegador ponía después, y solo con el consentimiento, no sacaba de las cohortes lo que ya había entrado. La lista
// sale de la RPC `cuentas_de_prueba` (las cuentas y el id de PostHog de su correo), con un minuto de caché; una vista
// de entrada la mira además por la cuenta con sesión (`cuentaDeSesion`). Si no se puede saber, el evento no sale.
// Lo prueba el tier PANEL-ACTIVACION.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventoServidor {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Determinista cuando el evento puede llegar dos veces. */
  uuid?: string;
  timestamp?: string;
  /** La cuenta con sesión en el pedido cuando no es `distinctId` (una vista de entrada sin consentimiento): también
   *  decide la marca de cuenta de prueba. No viaja a PostHog. */
  cuentaDeSesion?: string | null;
}

export type OrigenAgente = "evento" | "pedido" | "recordado" | "cola" | "ninguno";

/** El agente fijo de Franco para lo que esperó más de 24 horas sin que se viera el navegador de la persona
 *  (`agente_origen` = ninguno). PostHog lo clasifica `Regular`, no robot: medido el 21-oct-2026 con `isLikelyBot`,
 *  `getTrafficType` y `getTrafficCategory` en su HogQL. Sin «bot», «crawl», «http» ni el formato «compatible; …; +url»
 *  de los robots, por si PostHog los suma a su lista. No cambiarlo: los paneles lo separan por él y por el origen. */
export const AGENTE_GENERICO = "Mozilla/5.0 (Franco) AppleWebKit/537.36 (KHTML, like Gecko) Franco/1.0";

/** El agente de la persona y de dónde salió; `valor` null = todavía no se conoce (el evento espera en la cola). */
export interface AgentePersona {
  valor: string | null;
  origen: OrigenAgente;
}

export interface DepsEnvio {
  fetch?: typeof fetch;
  key?: string;
  host?: string;
  /** Los ids de las cuentas de prueba (y de sus correos); null = no se pudo saber, y el evento no sale. Por defecto la
   *  lista de `test_accounts` (`listaDePrueba`) dentro de Next —en Vercel, en el middleware (Edge) y en `next dev`—; con
   *  un `fetch` inyectado o fuera de Next (una prueba), ninguna salvo que se pase: una prueba no lee la base, como el
   *  almacén de agentes. */
  cuentasDePrueba?: () => Promise<ReadonlySet<string> | null>;
}

/** La lista de cuentas de prueba que usa `enviarCaptura` (ver `DepsEnvio.cuentasDePrueba`). */
function cuentasDePruebaDe(deps: DepsEnvio): Promise<ReadonlySet<string> | null> {
  if (deps.cuentasDePrueba) return deps.cuentasDePrueba();
  if (deps.fetch || (!process.env.NEXT_RUNTIME && process.env.VERCEL !== "1")) return Promise.resolve(new Set<string>());
  return listaDePrueba();
}

/** Cuánto vale la lista de cuentas de prueba antes de volver a pedirla. */
export const VIDA_LISTA_PRUEBA_MS = 60_000;
let listaGuardada: { ids: Set<string>; hasta: number } | null = null;

/** Para las pruebas: la próxima `listaDePrueba` la vuelve a pedir. */
export function olvidarListaDePrueba(): void {
  listaGuardada = null;
}

/** Las cuentas de `test_accounts` y el id de PostHog de su correo (RPC `cuentas_de_prueba`, solo el service role), con
 *  `VIDA_LISTA_PRUEBA_MS` de caché. Si la RPC falla, la última que se tuvo; si nunca se tuvo, null. Sin módulos de Node:
 *  la usa también el middleware. */
export async function listaDePrueba(deps: { fetch?: typeof fetch; url?: string; key?: string; ahora?: number } = {}): Promise<ReadonlySet<string> | null> {
  const ahora = deps.ahora ?? Date.now();
  if (listaGuardada && listaGuardada.hasta > ahora) return listaGuardada.ids;
  const url = (deps.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = deps.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return listaGuardada?.ids ?? null;
  try {
    const res = await (deps.fetch ?? globalThis.fetch)(`${url}/rest/v1/rpc/cuentas_de_prueba`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return listaGuardada?.ids ?? null;
    const filas = (await res.json()) as Array<{ user_id?: string | null; id_correo?: string | null }>;
    if (!Array.isArray(filas)) return listaGuardada?.ids ?? null;
    const ids = new Set<string>();
    for (const f of filas) {
      if (f?.user_id) ids.add(f.user_id);
      if (f?.id_correo) ids.add(f.id_correo);
    }
    listaGuardada = { ids, hasta: ahora + VIDA_LISTA_PRUEBA_MS };
    return ids;
  } catch {
    return listaGuardada?.ids ?? null;
  }
}

/** ¿El evento es de una cuenta de prueba? Por su id (la cuenta o su correo) o por la cuenta con sesión. */
export function esEventoDePrueba(ev: Pick<EventoServidor, "distinctId" | "cuentaDeSesion">, lista: ReadonlySet<string>): boolean {
  return lista.has(ev.distinctId) || (!!ev.cuentaDeSesion && lista.has(ev.cuentaDeSesion));
}

/** Robots de vistas previas, buscadores y clientes sin navegador. Sin agente, también. «…bot/», «…bot;» o «bot» suelto,
 *  no «bot» dentro de un modelo de teléfono (CUBOT). */
const ROBOT = /[a-z]bot[/;]|\bbot\b|adsbot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|slack|linkedin|skype|embedly|pinterest|vkshare|quora link preview|bitly|headless|lighthouse|pagespeed|inspectiontool|curl\/|wget|python|go-http-client|node-fetch|axios|okhttp|java\//i;

export function esRobot(agente: string | null | undefined): boolean {
  return !agente || ROBOT.test(agente);
}

/** El agente del pedido, solo si el pedido viene del navegador de una persona: «Mozilla/…», no un robot, y con las
 *  cabeceras `Sec-Fetch-*` que mandan los navegadores (no las manda el webhook de Flow, el de Resend ni el cron). */
export function agenteDeNavegador(h: { get(nombre: string): string | null } | null | undefined): string | null {
  const agente = h?.get("user-agent")?.trim() ?? "";
  if (!/^Mozilla\//.test(agente) || esRobot(agente)) return null;
  if (h?.get("sec-fetch-site") == null && h?.get("sec-fetch-mode") == null) return null;
  return agente.slice(0, 512);
}

/** El agente que el evento ya trae (`$raw_user_agent`), si no es de un robot (las vistas ya lo filtraron). */
export function agenteDelEvento(ev: EventoServidor): string | null {
  const a = ev.properties?.$raw_user_agent;
  return typeof a === "string" && !esRobot(a) ? a.slice(0, 512) : null;
}

/** El id de PostHog de un correo sin cuenta (el mismo que `distinctIdDeCorreo`, que usa el `crypto` de Node), con el
 *  `crypto.subtle` que hay en Edge y en Node. */
export async function idDeCorreo(email: string): Promise<string> {
  const datos = new TextEncoder().encode(email.trim().toLowerCase());
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", datos));
  return "correo:" + Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

/** Los ids que tienen un navegador que recordar: la cuenta (uuid de Supabase) o el correo de quien todavía no tiene
 *  cuenta. No `visita:…`, que dura una carga. */
export function idRecordable(distinctId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(distinctId) || /^correo:[0-9a-f]{24}$/.test(distinctId);
}

/** Lo que se manda: el evento con el agente de la persona (`$raw_user_agent`) y de dónde salió (`agente_origen`); si es
 *  de una cuenta de prueba, con la marca (`$set.test_account` en la persona y `prueba` en el evento). */
export function cuerpoDeCaptura(ev: EventoServidor, key: string, agente: { valor: string; origen: OrigenAgente }, ahora: Date = new Date(), prueba = false) {
  const props: Record<string, unknown> = { ...(ev.properties ?? {}) };
  delete props.$raw_user_agent;
  const marca = prueba
    ? { prueba: true, $set: { ...(typeof props.$set === "object" && props.$set ? (props.$set as Record<string, unknown>) : {}), test_account: true } }
    : {};
  return {
    api_key: key,
    event: ev.event,
    distinct_id: ev.distinctId,
    ...(ev.uuid ? { uuid: ev.uuid } : {}),
    timestamp: ev.timestamp ?? ahora.toISOString(),
    properties: { ...props, ...marca, $raw_user_agent: agente.valor, agente_origen: agente.origen, $lib: "franco-servidor" },
  };
}

/** Manda el evento. `true` si PostHog respondió 2xx; `false` sin agente (no sale: lo encola quien llama), sin key, sin
 *  saber si es de una cuenta de prueba, sin red o con error. Nunca lanza. */
export async function enviarCaptura(ev: EventoServidor, agente: AgentePersona, deps: DepsEnvio = {}): Promise<boolean> {
  const valor = agente.valor?.trim();
  if (!valor) return false;
  const key = deps.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  const host = (deps.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const f = deps.fetch ?? globalThis.fetch;
  try {
    const lista = await cuentasDePruebaDe(deps);
    // Sin saber si es una cuenta de prueba no sale: una prueba nuestra no puede contar en las cohortes.
    if (!lista) return false;
    const res = await f(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCaptura(ev, key, { valor, origen: agente.origen }, new Date(), esEventoDePrueba(ev, lista))),
    });
    return res.ok;
  } catch {
    return false;
  }
}
