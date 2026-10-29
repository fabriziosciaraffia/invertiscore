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
// navegador ponía después, y solo con el consentimiento, no sacaba de las cohortes lo que ya había entrado. Si no se
// puede saber, el evento no sale. Lo prueba el tier PANEL-ACTIVACION.
// SE DECIDE AL EMITIR, SIN CACHÉ PARA UNA CUENTA NUEVA (29-oct-2026, Fabrizio): antes era la lista entera de
// `test_accounts` guardada un minuto, y una cuenta de prueba creada dentro de ese minuto emitía sus primeros eventos sin
// la marca (en la semana del 19-oct, 8 de los 11 registros «B» del panel eran de prueba). Ahora cada evento pregunta por
// sus ids —la cuenta, el id de su correo, la cuenta con sesión de una vista— a la RPC `marca_de_prueba`: de prueba = en
// `test_accounts` o con un correo de Franco (fabriziosciaraffia+… y @refranco.ai, la regla del trigger
// `marcar_cuenta_interna`). Se recuerda un minuto solo lo que no cambia sin aviso: una cuenta de prueba, o una de más de
// una hora. Y si quien emite sabe el correo (`correo`), un correo de Franco marca sin preguntar.
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
  /** El correo de la persona, cuando quien emite lo sabe: un correo de Franco marca el evento sin preguntar a la base.
   *  No viaja a PostHog ni a la cola (`sinCorreo` lo cambia por `prueba` antes de guardar el evento). */
  correo?: string | null;
  /** Ya decidido al emitir: es de una cuenta de prueba (lo deja `sinCorreo`). No viaja a PostHog. */
  prueba?: boolean;
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
  /** Una lista fija de ids de cuentas de prueba, para las pruebas que la pasan; null = no se pudo saber, y el evento no
   *  sale. Sin ella, la marca se pregunta a la base (`marcaDePrueba`) dentro de Next —en Vercel, en el middleware (Edge)
   *  y en `next dev`—; con un `fetch` inyectado o fuera de Next (una prueba), ninguna: una prueba no lee la base, como el
   *  almacén de agentes. */
  cuentasDePrueba?: () => Promise<ReadonlySet<string> | null>;
}

/** ¿El evento es de una cuenta de prueba? (ver `DepsEnvio.cuentasDePrueba`). null = no se pudo saber. */
async function pruebaDe(ev: EventoServidor, deps: DepsEnvio): Promise<boolean | null> {
  if (ev.prueba === true || correoDePrueba(ev.correo)) return true;
  if (deps.cuentasDePrueba) {
    const lista = await deps.cuentasDePrueba();
    return lista ? esEventoDePrueba(ev, lista) : null;
  }
  if (deps.fetch || (!process.env.NEXT_RUNTIME && process.env.VERCEL !== "1")) return false;
  return marcaDePrueba(ev);
}

/** Una cuenta más nueva que esto se pregunta a la base en cada evento: nada guardado la deja fuera. */
export const CUENTA_NUEVA_MS = 3_600_000;
/** Cuánto se recuerda lo sabido de una cuenta de prueba, o de una de más de una hora. */
export const VIDA_MARCA_MS = 60_000;
const sabidos = new Map<string, { prueba: boolean; hasta: number }>();

/** Para las pruebas: lo sabido se olvida. */
export function olvidarMarcas(): void {
  sabidos.clear();
}

/** Los correos de Franco, de prueba por sí solos: la misma regla que el trigger `marcar_cuenta_interna` y que la RPC
 *  `marca_de_prueba` (`ilike 'fabriziosciaraffia+%@gmail.com'` o `'%@refranco.ai'`). */
export function correoDePrueba(correo: string | null | undefined): boolean {
  const c = (correo ?? "").trim().toLowerCase();
  return /^fabriziosciaraffia\+.*@gmail\.com$/.test(c) || /@refranco\.ai$/.test(c);
}

/** El evento listo para esperar en la cola o salir: lo que su correo decide queda en `prueba`, y el correo, fuera. */
export function sinCorreo(ev: EventoServidor): EventoServidor {
  if (ev.correo === undefined) return ev;
  const { correo, ...resto } = ev;
  return correoDePrueba(correo) ? { ...resto, prueba: true } : resto;
}

/** Lo que responde la RPC `marca_de_prueba` por cada id que conoce. */
interface FilaMarca {
  id: string;
  prueba: boolean;
  creada_at: string | null;
}

/** ¿Es de una cuenta de prueba? Por la cuenta, el id de su correo o la cuenta con sesión, preguntando a la base
 *  (RPC `marca_de_prueba`, solo el service role) lo que no se sabe. Se recuerda `VIDA_MARCA_MS` solo lo de una cuenta de
 *  prueba o de más de `CUENTA_NUEVA_MS`; lo demás se pregunta en cada evento. Sin base, lo último que se supo, aunque haya
 *  vencido; si nunca se supo, null. Sin módulos de Node: la usa también el middleware. */
export async function marcaDePrueba(
  ev: Pick<EventoServidor, "distinctId" | "cuentaDeSesion">,
  deps: { fetch?: typeof fetch; url?: string; key?: string; ahora?: number } = {},
): Promise<boolean | null> {
  const ahora = deps.ahora ?? Date.now();
  const ids = Array.from(new Set([ev.distinctId, ev.cuentaDeSesion].filter((x): x is string => !!x && idRecordable(x))));
  let prueba = false;
  const preguntar: string[] = [];
  for (const id of ids) {
    const s = sabidos.get(id);
    if (s && s.hasta > ahora) prueba ||= s.prueba;
    else preguntar.push(id);
  }
  if (!preguntar.length) return prueba;
  const filas = await consultarMarcas(preguntar, deps);
  for (const id of preguntar) {
    if (!filas) {
      const s = sabidos.get(id);
      if (!s) return null;
      prueba ||= s.prueba;
      continue;
    }
    const f = filas.find((x) => x?.id === id);
    const esPrueba = f?.prueba === true;
    const creada = f?.creada_at ? Date.parse(f.creada_at) : NaN;
    prueba ||= esPrueba;
    if (esPrueba || (Number.isFinite(creada) && ahora - creada >= CUENTA_NUEVA_MS)) sabidos.set(id, { prueba: esPrueba, hasta: ahora + VIDA_MARCA_MS });
    else sabidos.delete(id);
  }
  return prueba;
}

async function consultarMarcas(ids: string[], deps: { fetch?: typeof fetch; url?: string; key?: string }): Promise<FilaMarca[] | null> {
  const url = (deps.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = deps.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await (deps.fetch ?? globalThis.fetch)(`${url}/rest/v1/rpc/marca_de_prueba`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ids: ids }),
    });
    if (!res.ok) return null;
    const filas = (await res.json()) as FilaMarca[];
    return Array.isArray(filas) ? filas : null;
  } catch {
    return null;
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
    const prueba = await pruebaDe(ev, deps);
    // Sin saber si es una cuenta de prueba no sale: una prueba nuestra no puede contar en las cohortes.
    if (prueba === null) return false;
    const res = await f(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCaptura(ev, key, { valor, origen: agente.origen }, new Date(), prueba)),
    });
    return res.ok;
  } catch {
    return false;
  }
}
