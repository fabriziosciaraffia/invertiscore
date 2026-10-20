// ─────────────────────────────────────────────────────────────────────────────
// EL ÚNICO PUNTO QUE MANDA EVENTOS A POSTHOG DESDE EL SERVIDOR (20-oct-2026, Fabrizio). Todo evento del servidor sale
// por `enviarCaptura`: lo llaman `capturarServidor` (posthog-servidor.ts, Node) y `enviarVista` (vista-entrada.ts, el
// middleware en Edge). Por eso este archivo no importa módulos de Node.
//
// EL AGENTE: PostHog clasifica el tráfico por el agente (`$raw_user_agent`), y todo evento sin agente lo marca robot
// («Automation / no_user_agent», `$virt_is_bot` = true; medido en producción el 20-oct-2026). Quien filtre robots
// perdía el registro, el análisis, los correos y el pago. Cada evento lleva el del NAVEGADOR DE LA PERSONA, nunca el de
// quien hace el pedido cuando no es ella (el webhook de Flow o de Resend, el cron de Vercel):
//   · `evento`    — el que el evento ya trae (las vistas de entrada lo ponen del pedido que las sirve);
//   · `pedido`    — el del pedido en curso, si viene de un navegador (`agenteDeNavegador`);
//   · `recordado` — el último que Franco le vio a esa persona (tabla `agentes_navegador`, posthog-servidor.ts);
//   · `ninguno`   — Franco nunca vio su navegador: sale sin agente y lo dice (`agente_origen`).
// Lo prueba el tier AGENTE-SERVIDOR.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventoServidor {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Determinista cuando el evento puede llegar dos veces. */
  uuid?: string;
  timestamp?: string;
}

export type OrigenAgente = "evento" | "pedido" | "recordado" | "ninguno";

export interface DepsEnvio {
  fetch?: typeof fetch;
  key?: string;
  host?: string;
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

/** El agente que el evento ya trae (`$raw_user_agent`), si es de un navegador. */
export function agenteDelEvento(ev: EventoServidor): string | null {
  const a = ev.properties?.$raw_user_agent;
  return typeof a === "string" && /^Mozilla\//.test(a) && !esRobot(a) ? a.slice(0, 512) : null;
}

/** Los ids que tienen un navegador que recordar: la cuenta (uuid de Supabase) o el correo de quien todavía no tiene
 *  cuenta. No `visita:…`, que dura una carga. */
export function idRecordable(distinctId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(distinctId) || /^correo:[0-9a-f]{24}$/.test(distinctId);
}

/** Lo que se manda: el evento con el agente de la persona (`$raw_user_agent`) y de dónde salió (`agente_origen`). */
export function cuerpoDeCaptura(ev: EventoServidor, key: string, agente: { valor: string | null; origen: OrigenAgente }, ahora: Date = new Date()) {
  const props: Record<string, unknown> = { ...(ev.properties ?? {}) };
  delete props.$raw_user_agent;
  return {
    api_key: key,
    event: ev.event,
    distinct_id: ev.distinctId,
    ...(ev.uuid ? { uuid: ev.uuid } : {}),
    timestamp: ev.timestamp ?? ahora.toISOString(),
    properties: {
      ...props,
      ...(agente.valor ? { $raw_user_agent: agente.valor } : {}),
      agente_origen: agente.valor ? agente.origen : "ninguno",
      $lib: "franco-servidor",
    },
  };
}

/** Manda el evento. `true` si PostHog respondió 2xx; `false` sin key, sin red o con error. Nunca lanza. */
export async function enviarCaptura(ev: EventoServidor, agente: { valor: string | null; origen: OrigenAgente }, deps: DepsEnvio = {}): Promise<boolean> {
  const key = deps.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  const host = (deps.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const f = deps.fetch ?? globalThis.fetch;
  try {
    const res = await f(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCaptura(ev, key, agente)),
    });
    return res.ok;
  } catch {
    return false;
  }
}
