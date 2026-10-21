// ─────────────────────────────────────────────────────────────────────────────
// Tier AGENTE-SERVIDOR (20-oct-2026, 0 tokens, sin red ni base: el fetch y el almacén son de mentira) — todo evento que
// refranco manda a PostHog desde el servidor lleva el agente del navegador de la persona. Sin él PostHog lo marca robot
// («Automation / no_user_agent»; medido en producción el 20-oct-2026) y quien filtre robots pierde el registro, el
// análisis, los correos y el pago. Pasa por un solo punto (posthog-captura.ts), no evento por evento.
//
//   1 · EL EVENTO DEL SERVIDOR SIN AGENTE: `cuenta_atribuida` sale dentro del pedido del navegador de la persona (el
//       `headers()` de Next, de verdad) y llega a PostHog con su agente; el agente queda recordado y sale, con él y su
//       hora, lo que esperaba en la cola.
//   2 · SIN NAVEGADOR DELANTE (el webhook de Resend o de Flow, el cron de Vercel, fuera de un pedido): el último agente
//       recordado de esa persona, nunca el de quien hace el pedido; y eso no se recuerda.
//   3 · EL QUE TRAE EL EVENTO (las vistas de entrada) manda; una visita no se recuerda.
//   4 · NUNCA SE VIO SU NAVEGADOR: el evento NO sale; espera en la cola con su hora. Cuando la persona navega con sesión
//       (el middleware), su cuenta y su correo quedan con su agente y el evento sale con él (agente_origen = cola), una
//       vez por navegador. Con la base caída tampoco sale sin agente.
//   5 · UN SOLO PUNTO: en src/ solo posthog-captura.ts le habla a `/capture/`; `capturarServidor` y `enviarVista` pasan
//       por él; `capturarServidor` lee el pedido de Next, encola, recuerda en la tabla y se anota en `waitUntil`; el
//       middleware anota el navegador de quien tiene sesión.
//   6 · QUÉ ES UN NAVEGADOR: «Mozilla/…», no un robot, con `Sec-Fetch-*`.
//   7 · LAS TABLAS: `agentes_navegador` y `eventos_sin_agente`, con RLS y sin políticas.
//   8 · EL INVARIANTE: todo lo que llegó a PostHog en este tier lleva agente; el núcleo no manda un evento sin él.
//   9 · LA REGLA DE SALIDA (21-oct-2026): un evento de 25 horas en la cola sale igual, con su hora, el agente genérico
//       de Franco y agente_origen = ninguno; uno de 23 horas espera. Lo vacía el resumen diario de las 00:45 UTC.
//
// ACTA DE MUTACIONES: en el cuerpo de cada sección.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/agente-servidor-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import "./als-de-next";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";
import { capturarServidor, distinctIdDeCorreo, type EventoServidor } from "../../../src/lib/posthog-servidor";
import { AGENTE_GENERICO, agenteDeNavegador, enviarCaptura, esRobot, idDeCorreo } from "../../../src/lib/posthog-captura";
import { ESPERA_MAXIMA_H, navegadorDeSesion, vaciarColaVencida, type AlmacenAgentes } from "../../../src/lib/agentes-navegador";
import { enviarVista } from "../../../src/lib/vista-entrada";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const CUENTA = "0f4d1489-0b03-406f-82bf-f74ec9c4af4e";
const NAVEGADOR = { "user-agent": IPHONE, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "accept-language": "es-CL" };
const ORIGENES = ["evento", "pedido", "recordado", "cola", "ninguno"];

type Cuerpo = { event: string; distinct_id: string; timestamp?: string; properties: Record<string, unknown> };

/** Todo lo que llegó a PostHog en el tier (el invariante del §8 lo recorre entero). */
const todo: Cuerpo[] = [];

function almacen(inicial: Record<string, string> = {}, cola: Array<EventoServidor | { evento: EventoServidor; creado: string }> = []) {
  const datos = new Map(Object.entries(inicial));
  const guardados: Array<[string, string]> = [];
  let n = 0;
  const filas = cola.map((c) => ("creado" in c ? { id: ++n, evento: c.evento, creado: c.creado } : { id: ++n, evento: c, creado: new Date().toISOString() }));
  const a: AlmacenAgentes = {
    async leer(id) { return datos.get(id) ?? null; },
    async guardar(id, agente) { guardados.push([id, agente]); datos.set(id, agente); },
    async encolar(ev) { filas.push({ id: ++n, evento: ev, creado: new Date().toISOString() }); },
    async pendientes(id) { return filas.filter((f) => f.evento.distinctId === id); },
    async vencidos(antesDe, limite) { return filas.filter((f) => f.creado < antesDe).slice(0, limite); },
    async sacar(ids) { for (const id of ids) filas.splice(filas.findIndex((f) => f.id === id), 1); },
  };
  return { a, guardados, filas };
}

function posthogDeMentira() {
  const cuerpos: Cuerpo[] = [];
  const f = (async (_u: unknown, init?: { body?: unknown }) => {
    const c = JSON.parse(String(init?.body)) as Cuerpo;
    cuerpos.push(c);
    todo.push(c);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { cuerpos, deps: { fetch: f, key: "phc_test", host: "https://ph.test" } };
}

/** Manda un evento por el punto único; `pedido` corre dentro de un pedido de Next con esas cabeceras (el `headers()`
 *  de verdad), `null` fuera de todo pedido. Devuelve todo lo que llegó a PostHog. */
async function mandar(ev: EventoServidor, pedido: Record<string, string> | null, agentes: AlmacenAgentes | null): Promise<{ cuerpos: Cuerpo[]; ok: boolean }> {
  const ph = posthogDeMentira();
  const correr = () => capturarServidor(ev, { ...ph.deps, agentes });
  const ok = pedido ? await requestAsyncStorage.run({ headers: new Headers(pedido) } as never, correr) : await correr();
  return { cuerpos: ph.cuerpos, ok };
}

export async function runAgenteServidorTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER AGENTE-SERVIDOR (todo evento del servidor lleva el agente del navegador de la persona, por un solo punto · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  todo.length = 0;
  try {
    // ── 1 · EL EVENTO DEL SERVIDOR SIN AGENTE ──
    // Mutaciones: A1 el núcleo no pone el agente · A2 capturarServidor no lee el pedido de Next · A3 no recuerda el
    // agente · A17 no vacía la cola al ver el navegador · A18 la cola sale sin su hora.
    {
      const esperando: EventoServidor = { event: "correo_entregado", distinctId: CUENTA, properties: { tipo: "semanal" }, timestamp: "2026-10-18T12:00:00.000Z" };
      const { a, guardados, filas } = almacen({}, [esperando]);
      const { cuerpos } = await mandar({ event: "cuenta_atribuida", distinctId: CUENTA, properties: { puerta: "B" } }, NAVEGADOR, a);
      const b = cuerpos.find((c) => c.event === "cuenta_atribuida");
      if (!b) F("1 · cuenta_atribuida no llegó a PostHog");
      else {
        if (b.properties.$raw_user_agent !== IPHONE) F(`1 · un evento del servidor sale sin el agente del navegador de la persona (${String(b.properties.$raw_user_agent)}): PostHog lo marca robot`);
        if (b.properties.agente_origen !== "pedido") F(`1 · el evento no dice que el agente salió del pedido (${String(b.properties.agente_origen)})`);
        if (b.properties.puerta !== "B" || b.properties.$lib !== "franco-servidor") F("1 · el evento pierde sus propiedades al ponerle el agente");
      }
      if (!guardados.some(([id, ag]) => id === CUENTA && ag === IPHONE)) F(`1 · el agente del navegador no queda recordado para esa cuenta (${JSON.stringify(guardados)})`);
      const c = cuerpos.find((x) => x.event === "correo_entregado");
      if (!c || c.properties.$raw_user_agent !== IPHONE || c.properties.agente_origen !== "cola" || filas.length) F("1 · al ver el navegador no sale, con su agente, lo que esperaba en la cola");
      else if (c.timestamp !== esperando.timestamp) F(`1 · lo que esperaba en la cola sale con otra hora (${c.timestamp})`);
    }

    // ── 2 · SIN NAVEGADOR DELANTE ──
    // Mutaciones: A4 sin el recordado · A5 usa el agente de quien hace el pedido · A6 recuerda el agente recordado.
    {
      for (const [n, pedido] of [
        ["el webhook de Resend", { "user-agent": "Svix-Webhooks/1.24.0 (sender-1MUu7; +https://www.svix.com/http-sender/)" }],
        ["el cron de Vercel", { "user-agent": "vercel-cron/1.0" }],
        ["un fetch de Node", { "user-agent": "node", "sec-fetch-mode": "cors" }],
        ["fuera de un pedido", null],
      ] as const) {
        const { a, guardados } = almacen({ [CUENTA]: WINDOWS });
        const { cuerpos } = await mandar({ event: "correo_entregado", distinctId: CUENTA, properties: {} }, pedido, a);
        const b = cuerpos[0];
        if (b?.properties.$raw_user_agent !== WINDOWS || b.properties.agente_origen !== "recordado") F(`2 · con ${n} el evento no lleva el último navegador de la persona (${String(b?.properties.$raw_user_agent)})`);
        if (guardados.length) F(`2 · con ${n} se recuerda un agente que no salió de un navegador (${JSON.stringify(guardados)})`);
      }
    }

    // ── 3 · EL QUE TRAE EL EVENTO ──
    // Mutaciones: A7 el pedido pisa al del evento · A8 se recuerda una visita.
    {
      const { a, guardados } = almacen();
      const { cuerpos } = await mandar({ event: "landing_viewed", distinctId: "visita:9b7c", properties: { $raw_user_agent: WINDOWS } }, NAVEGADOR, a);
      if (cuerpos[0]?.properties.$raw_user_agent !== WINDOWS || cuerpos[0]?.properties.agente_origen !== "evento") F("3 · el agente que trae el evento no manda");
      if (guardados.length) F("3 · se recuerda el agente de una visita (dura una carga)");
      const ph = posthogDeMentira();
      await enviarVista({ event: "deptos_vista", distinctId: "visita:1", properties: { $raw_user_agent: IPHONE } }, ph.deps);
      if (ph.cuerpos[0]?.properties.$raw_user_agent !== IPHONE || ph.cuerpos[0]?.properties.agente_origen !== "evento") F("3 · la vista del middleware no sale con su agente por el punto único");
    }

    // ── 4 · NUNCA SE VIO SU NAVEGADOR ──
    // Mutaciones: A9 sale sin agente en vez de esperar · A19 encola sin la hora · A20 el middleware no anota (o no vacía
    // la cola) · A21 el correo de la cuenta no queda anotado · A22 se anota en cada pedido (sin la marca) · A23 con la
    // base caída sale sin agente.
    {
      const correo = "nunca.visto@ejemplo.cl";
      const idCorreo = distinctIdDeCorreo(correo);
      if (await idDeCorreo(correo) !== idCorreo || await idDeCorreo("  Nunca.Visto@Ejemplo.CL ") !== idCorreo) F("4 · el id del correo en Edge no es el mismo que el del servidor");
      const { a, guardados, filas } = almacen();
      const r1 = await mandar({ event: "semanal_enviado", distinctId: CUENTA, properties: { semana: "2026-10-19" } }, null, a);
      const r2 = await mandar({ event: "correo_enviado", distinctId: idCorreo, properties: {} }, { "user-agent": "vercel-cron/1.0" }, a);
      if (r1.cuerpos.length || r2.cuerpos.length) F("4 · el evento de quien Franco nunca vio sale sin agente (PostHog lo marca robot)");
      if (filas.length !== 2 || !r1.ok) F(`4 · el evento sin agente no queda esperando en la cola (${filas.length})`);
      if (filas.some((f) => !f.evento.timestamp)) F("4 · el evento en la cola no guarda su hora");
      const horas = filas.map((f) => f.evento.timestamp);
      // La persona navega con sesión por la app: el middleware la ve.
      const nav = navegadorDeSesion({ persona: { id: CUENTA, email: correo }, cabeceras: new Headers({ ...NAVEGADOR, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }), marcaActual: undefined });
      if (!nav) F("4 · el middleware no anota el navegador de quien navega con sesión");
      else {
        const ph = posthogDeMentira();
        const salieron = await nav.anotar(a, ph.deps);
        if (salieron !== 2 || filas.length || ph.cuerpos.some((c) => c.properties.$raw_user_agent !== IPHONE || c.properties.agente_origen !== "cola")) F(`4 · al verse su navegador no sale, con su agente, lo que esperaba (${salieron}; quedan ${filas.length})`);
        if (ph.cuerpos.map((c) => c.timestamp).sort().join() !== [...horas].sort().join()) F("4 · lo que esperaba sale con otra hora");
        if (!guardados.some(([id]) => id === CUENTA) || !guardados.some(([id]) => id === idCorreo)) F("4 · la cuenta y su correo no quedan con el agente de su navegador");
        if (navegadorDeSesion({ persona: { id: CUENTA, email: correo }, cabeceras: new Headers(NAVEGADOR), marcaActual: nav.marca })) F("4 · el middleware vuelve a anotar el mismo navegador en cada pedido (la marca no sirve)");
        if (!navegadorDeSesion({ persona: { id: CUENTA }, cabeceras: new Headers({ ...NAVEGADOR, "user-agent": WINDOWS }), marcaActual: nav.marca })) F("4 · un navegador nuevo de la misma cuenta no se anota");
      }
      if (navegadorDeSesion({ persona: null, cabeceras: new Headers(NAVEGADOR), marcaActual: undefined })) F("4 · se anota un navegador sin sesión");
      if (navegadorDeSesion({ persona: { id: CUENTA }, cabeceras: new Headers({ "user-agent": "vercel-cron/1.0" }), marcaActual: undefined })) F("4 · se anota algo que no es un navegador");
      const caido: AlmacenAgentes = { leer: async () => { throw new Error("sin base"); }, guardar: async () => { throw new Error("sin base"); }, encolar: async () => { throw new Error("sin base"); }, pendientes: async () => { throw new Error("sin base"); }, vencidos: async () => { throw new Error("sin base"); }, sacar: async () => { throw new Error("sin base"); } };
      const c = await mandar({ event: "correo_abierto", distinctId: CUENTA, properties: {} }, null, caido);
      if (c.cuerpos.length) F("4 · con la base caída el evento sale sin agente");
      const d = await mandar({ event: "analisis_creado", distinctId: CUENTA, properties: {} }, NAVEGADOR, caido);
      if (d.cuerpos[0]?.properties.$raw_user_agent !== IPHONE) F("4 · con la base caída el evento del navegador pierde su agente");
    }

    // ── 5 · UN SOLO PUNTO ──
    // Mutaciones: A10 otro archivo le habla a /capture/ · A11 enviarVista con su propio fetch · A12 sin waitUntil · A13
    // capturarServidor sin el almacén por defecto · A24 el middleware no anota el navegador · A25 updateSession no avisa
    // quién tiene sesión.
    {
      const archivos = readdirSync(join(RAIZ, "src"), { recursive: true, encoding: "utf8" }).filter((f) => /\.(ts|tsx)$/.test(f));
      if (archivos.length < 100) F(`5 · el barrido de src/ no corrió (${archivos.length} archivos)`);
      for (const f of archivos) {
        const ruta = f.replace(/\\/g, "/");
        const s = sinComentarios(leer(join("src", f)));
        if (ruta !== "lib/posthog-captura.ts" && /\/capture\/|\/i\/v0\/e|\/batch\//.test(s)) F(`5 · src/${ruta} le habla a PostHog por su cuenta, sin el punto único (sin agente)`);
        if (/from ["']posthog-node["']/.test(s)) F(`5 · src/${ruta} usa posthog-node, fuera del punto único`);
      }
      const nucleo = sinComentarios(leer("src/lib/posthog-captura.ts"));
      // ⛔ ACTA 21-oct-2026 · el cuerpo suma `...marca` (la marca de cuenta de prueba, tier PANEL-ACTIVACION) ANTES del
      // agente: la regla de acá no cambia, el agente y su origen siguen pisando lo que traiga el evento.
      if (!/f\(`\$\{host\}\/capture\/`/.test(nucleo) || !/properties: \{ \.\.\.props, \.\.\.marca, \$raw_user_agent: agente\.valor, agente_origen: agente\.origen, \$lib: "franco-servidor" \}/.test(nucleo)) F("5 · el punto único no manda el agente");
      const srv = sinComentarios(leer("src/lib/posthog-servidor.ts"));
      if (!/enviarCaptura\(ev, agente, deps\)/.test(srv) || !/return headers\(\);/.test(srv) || !/waitUntil\(envio\);/.test(srv)) F("5 · capturarServidor no pasa por el punto único, no lee el pedido de Next o no se anota en waitUntil");
      if (!/const agentes = deps\.agentes !== undefined \? deps\.agentes : deps\.fetch \|\| process\.env\.VERCEL !== "1" \? null : almacenSupabase\(createServiceClient\);/.test(srv) || !/if \(!\(deps\.key \?\? process\.env\.NEXT_PUBLIC_POSTHOG_KEY\)\) return Promise\.resolve\(false\);/.test(srv)) F("5 · capturarServidor no usa las tablas por defecto en Vercel (o las toca sin key, en una prueba)");
      const alm = sinComentarios(leer("src/lib/agentes-navegador.ts"));
      if (!/\.from\("agentes_navegador"\)\.upsert\(/.test(alm) || !/\.from\("eventos_sin_agente"\)\.insert\(/.test(alm) || !/\.from\("eventos_sin_agente"\)\.delete\(\)/.test(alm)) F("5 · el almacén no recuerda el navegador o no encola y vacía en las tablas");
      if (!/return enviarCaptura\(ev, \{ valor: agenteDelEvento\(ev\), origen: "evento" \}, deps\);/.test(sinComentarios(leer("src/lib/vista-entrada.ts")))) F("5 · enviarVista no pasa por el punto único");
      const mw = sinComentarios(leer("src/middleware.ts"));
      // ⛔ ACTA 21-oct-2026 · `conVista` recibe además `persona` (la cuenta con sesión marca la vista de una cuenta de prueba,
      // tier PANEL-ACTIVACION); el navegador se sigue anotando igual.
      if (!/const res = await Promise\.race\(\[updateSession\(req, \(u\) => \{ persona = u; \}\), timeout\]\);\s*return conVista\(req, conMedicion\(req, conNavegador\(req, res, event, persona\)\), event, visita, persona\);/.test(mw) || !/event\.waitUntil\(nav\.anotar\(almacenSupabase\(createServiceClient\)\)/.test(mw)) F("5 · el middleware no anota el navegador de quien tiene sesión");
      if (!/\} = await supabase\.auth\.getUser\(\);\s*alUsuario\?\.\(user \? \{ id: user\.id, email: user\.email \?\? null \} : null\);/.test(sinComentarios(leer("src/lib/supabase/middleware.ts")))) F("5 · updateSession no avisa quién tiene sesión");
    }

    // ── 6 · QUÉ ES UN NAVEGADOR ──
    // Mutación: A14 cualquier «Mozilla» cuenta · A15 sin Sec-Fetch cuenta.
    {
      const h = (o: Record<string, string>) => new Headers(o);
      if (agenteDeNavegador(h(NAVEGADOR)) !== IPHONE) F("6 · el navegador de la persona no cuenta como navegador");
      if (agenteDeNavegador(h({ ...NAVEGADOR, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36" }))) F("6 · Chrome sin ventana cuenta como navegador");
      if (agenteDeNavegador(h({ ...NAVEGADOR, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }))) F("6 · un robot que dice «Mozilla» cuenta como navegador");
      if (agenteDeNavegador(h({ "user-agent": IPHONE }))) F("6 · un pedido sin Sec-Fetch (un servidor que se hace pasar) cuenta como navegador");
    }

    // ── 7 · LAS TABLAS ──
    // Mutación: A16 sin RLS.
    {
      const mig = leer("supabase/migrations/20261020_agentes_navegador.sql");
      if (!/create table if not exists public\.agentes_navegador \(\s*distinct_id text primary key/.test(mig) || !/alter table public\.agentes_navegador enable row level security;/.test(mig) || /create policy/i.test(mig)) F("7 · la tabla agentes_navegador no existe con RLS y sin políticas");
      const cola = leer("supabase/migrations/20261020_eventos_sin_agente.sql");
      if (!/create table if not exists public\.eventos_sin_agente \(/.test(cola) || !/alter table public\.eventos_sin_agente enable row level security;/.test(cola) || /create policy/i.test(cola)) F("7 · la cola eventos_sin_agente no existe con RLS y sin políticas");
    }

    // ── 9 · LA REGLA DE SALIDA (21-oct-2026): lo que lleva más de 24 horas esperando sale igual ──
    // Mutaciones: B1 el resumen no vacía la cola · B2 la espera no es de 24 horas · B3 sale sin su hora · B4 sale como
    // `cola` y no `ninguno` · B5 el agente genérico es de robot · B6 no deja la cola · B7 la vacía cada vigilancia y no
    // solo la del resumen.
    {
      const ahora = new Date("2026-10-21T00:45:00.000Z");
      const hace = (h: number) => new Date(ahora.getTime() - h * 3600e3).toISOString();
      const viejo: EventoServidor = { event: "correo_entregado", distinctId: CUENTA, properties: { tipo: "semanal" }, timestamp: hace(25) };
      const reciente: EventoServidor = { event: "correo_abierto", distinctId: CUENTA, properties: {}, timestamp: hace(23) };
      const { a, filas } = almacen({}, [{ evento: viejo, creado: hace(25) }, { evento: reciente, creado: hace(23) }]);
      const ph = posthogDeMentira();
      const r = await vaciarColaVencida(a, ph.deps, ahora);
      const b = ph.cuerpos.find((c) => c.event === "correo_entregado");
      if (!b) F("9 · un evento de 25 horas en la cola no sale");
      else {
        if (b.properties.$raw_user_agent !== AGENTE_GENERICO || b.properties.agente_origen !== "ninguno") F(`9 · el evento de 25 horas no sale con el agente genérico de Franco y agente_origen = ninguno (${String(b.properties.agente_origen)})`);
        if (b.timestamp !== viejo.timestamp) F(`9 · el evento de 25 horas sale con otra hora (${b.timestamp})`);
        if (b.properties.tipo !== "semanal") F("9 · el evento de 25 horas pierde sus propiedades");
      }
      if (ph.cuerpos.some((c) => c.event === "correo_abierto") || filas.length !== 1 || filas[0].evento.event !== "correo_abierto") F("9 · un evento de 23 horas sale (o el de 25 no deja la cola)");
      if (r.enviados !== 1) F(`9 · el vaciado no cuenta lo que mandó (${r.enviados})`);
      if (ESPERA_MAXIMA_H !== 24) F(`9 · la espera máxima no es de 24 horas (${ESPERA_MAXIMA_H})`);
      if (AGENTE_GENERICO !== "Mozilla/5.0 (Franco) AppleWebKit/537.36 (KHTML, like Gecko) Franco/1.0" || esRobot(AGENTE_GENERICO) || /bot|crawl|spider|http|compatible;/i.test(AGENTE_GENERICO)) F("9 · el agente genérico de Franco cambió o tiene forma de robot (PostHog lo clasificaría robot)");
      const vig = sinComentarios(leer("src/app/api/cron/vigilar-crons/route.ts"));
      // Dentro del bloque del resumen (la primera vigilancia del día) y después del correo: la vigilancia tiene 60 s.
      const bloque = (vig.match(/if \(esResumen\) \{[\s\S]*?\n {4}\}/) ?? [""])[0];
      if (!/sendResumenCronsInterno\([\s\S]*?colaSinAgente = await vaciarColaVencida\(almacenSupabase\(\(\) => sb\)\);\s*\}$/.test(bloque) || (vig.match(/vaciarColaVencida\(/g) ?? []).length !== 1) F("9 · el resumen diario de los crons no vacía la cola (o la vacía fuera del resumen, o antes del correo)");
      // Con tope de tiempo: una cola grande no se come la vigilancia.
      // Diez eventos que PostHog tarda 300 ms en recibir: sin tope son 3 s; con un tope de 100 ms, uno y se corta.
      const lenta = almacen({}, Array.from({ length: 10 }, () => ({ evento: viejo, creado: hace(30) })));
      const t0 = Date.now();
      const rl = await vaciarColaVencida(lenta.a, { ...posthogDeMentira().deps, fetch: (async () => { await new Promise((r) => setTimeout(r, 300)); return new Response("{}"); }) as typeof fetch }, ahora, 100);
      if (Date.now() - t0 > 1000 || rl.enviados >= 10 || lenta.filas.length === 0) F(`9 · el vaciado no respeta su tope de tiempo (${Date.now() - t0} ms, ${rl.enviados} enviados)`);
      if (!/"path": "\/api\/cron\/vigilar-crons",\s*"schedule": "45 \*\/6 \* \* \*"/.test(leer("vercel.json"))) F("9 · la vigilancia ya no corre a las 00:45 UTC (el resumen del día)");
    }

    // ── 8 · EL INVARIANTE ──
    // Mutación: A26 el núcleo manda sin agente.
    {
      if (todo.length < 10) F(`8 · el tier no mandó lo suficiente para medir el invariante (${todo.length})`);
      const sin = todo.filter((c) => typeof c.properties.$raw_user_agent !== "string" || !String(c.properties.$raw_user_agent).trim() || !ORIGENES.includes(String(c.properties.agente_origen)));
      if (sin.length) F(`8 · ${sin.length} evento(s) llegaron a PostHog sin el agente de la persona: ${sin.map((c) => c.event).join(", ")}`);
      const ph = posthogDeMentira();
      if (await enviarCaptura({ event: "x", distinctId: CUENTA }, { valor: null, origen: "cola" }, ph.deps) !== false || ph.cuerpos.length) F("8 · el punto único manda un evento sin agente");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  if (fallas.length) {
    console.log(`  ✗ AGENTE-SERVIDOR · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — ningún evento del servidor sale sin el agente del navegador de la persona, por un solo punto: el del pedido si viene de su navegador (y se recuerda), el último recordado si no (webhooks, crons), y si Franco no lo vio todavía el evento espera en la cola, con su hora, hasta que lo ve (el middleware, con sesión); a las 24 horas sale con el agente genérico de Franco (ninguno), en el resumen de las 00:45");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runAgenteServidorTier().then((r) => process.exit(r.hard ? 1 : 0));
}
