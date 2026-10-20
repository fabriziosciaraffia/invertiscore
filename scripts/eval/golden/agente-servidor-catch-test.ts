// ─────────────────────────────────────────────────────────────────────────────
// Tier AGENTE-SERVIDOR (20-oct-2026, 0 tokens, sin red ni base: el fetch y el almacén son de mentira) — todo evento que
// refranco manda a PostHog desde el servidor lleva el agente del navegador de la persona. Sin él PostHog lo marca robot
// («Automation / no_user_agent»; medido en producción el 20-oct-2026) y quien filtre robots pierde el registro, el
// análisis, los correos y el pago. Pasa por un solo punto (posthog-captura.ts), no evento por evento.
//
//   1 · EL EVENTO DEL SERVIDOR SIN AGENTE: `cuenta_atribuida` sale dentro del pedido del navegador de la persona (el
//       `headers()` de Next, de verdad) y llega a PostHog con su agente; y ese agente queda recordado para esa cuenta.
//   2 · SIN NAVEGADOR DELANTE (el webhook de Resend o de Flow, el cron de Vercel, fuera de un pedido): el último agente
//       recordado de esa persona, nunca el de quien hace el pedido; y eso no se recuerda.
//   3 · EL QUE TRAE EL EVENTO (las vistas de entrada) manda; una visita no se recuerda.
//   4 · NUNCA SE VIO SU NAVEGADOR: sale sin agente y lo dice (`agente_origen` = ninguno); un almacén caído no corta el envío.
//   5 · UN SOLO PUNTO: en src/ solo posthog-captura.ts le habla a `/capture/`; `capturarServidor` y `enviarVista` pasan
//       por él; `capturarServidor` lee el pedido de Next, recuerda en la tabla y se anota en `waitUntil`.
//   6 · QUÉ ES UN NAVEGADOR: «Mozilla/…», no un robot, con `Sec-Fetch-*`.
//   7 · LA TABLA: `agentes_navegador` con RLS y sin políticas.
//
// ACTA DE MUTACIONES: en el cuerpo de cada sección.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/agente-servidor-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import "./als-de-next";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";
import { capturarServidor, type AlmacenAgentes } from "../../../src/lib/posthog-servidor";
import { agenteDeNavegador } from "../../../src/lib/posthog-captura";
import { enviarVista } from "../../../src/lib/vista-entrada";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const CUENTA = "0f4d1489-0b03-406f-82bf-f74ec9c4af4e";
const NAVEGADOR = { "user-agent": IPHONE, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "accept-language": "es-CL" };

type Cuerpo = { event: string; distinct_id: string; properties: Record<string, unknown> };

function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  const guardados: Array<[string, string]> = [];
  const a: AlmacenAgentes = {
    async leer(id) { return datos.get(id) ?? null; },
    async guardar(id, agente) { guardados.push([id, agente]); datos.set(id, agente); },
  };
  return { a, guardados };
}

/** Manda un evento por el punto único con un PostHog de mentira; `pedido` corre dentro de un pedido de Next con esas
 *  cabeceras (el `headers()` de verdad), `null` fuera de todo pedido. */
async function mandar(ev: Parameters<typeof capturarServidor>[0], pedido: Record<string, string> | null, agentes: AlmacenAgentes | null): Promise<Cuerpo | null> {
  const cuerpos: Cuerpo[] = [];
  const f = (async (_u: unknown, init?: { body?: unknown }) => {
    cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const correr = () => capturarServidor(ev, { fetch: f, key: "phc_test", host: "https://ph.test", agentes });
  if (pedido) await requestAsyncStorage.run({ headers: new Headers(pedido) } as never, correr);
  else await correr();
  return cuerpos[0] ?? null;
}

export async function runAgenteServidorTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER AGENTE-SERVIDOR (todo evento del servidor lleva el agente del navegador de la persona, por un solo punto · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  try {
    // ── 1 · EL EVENTO DEL SERVIDOR SIN AGENTE ──
    // Mutaciones: A1 el núcleo no pone el agente · A2 capturarServidor no lee el pedido de Next · A3 no recuerda el agente.
    {
      const { a, guardados } = almacen();
      const b = await mandar({ event: "cuenta_atribuida", distinctId: CUENTA, properties: { puerta: "B" } }, NAVEGADOR, a);
      if (!b) F("1 · cuenta_atribuida no llegó a PostHog");
      else {
        if (b.properties.$raw_user_agent !== IPHONE) F(`1 · un evento del servidor sale sin el agente del navegador de la persona (${String(b.properties.$raw_user_agent)}): PostHog lo marca robot`);
        if (b.properties.agente_origen !== "pedido") F(`1 · el evento no dice que el agente salió del pedido (${String(b.properties.agente_origen)})`);
        if (b.properties.puerta !== "B" || b.properties.$lib !== "franco-servidor") F("1 · el evento pierde sus propiedades al ponerle el agente");
      }
      if (guardados.length !== 1 || guardados[0][0] !== CUENTA || guardados[0][1] !== IPHONE) F(`1 · el agente del navegador no queda recordado para esa cuenta (${JSON.stringify(guardados)})`);
    }

    // ── 2 · SIN NAVEGADOR DELANTE ──
    // Mutaciones: A4 sin el recordado · A5 usa el agente de quien hace el pedido · A6 recuerda el agente recordado (o el del webhook).
    {
      for (const [n, pedido] of [
        ["el webhook de Resend", { "user-agent": "Svix-Webhooks/1.24.0 (sender-1MUu7; +https://www.svix.com/http-sender/)" }],
        ["el cron de Vercel", { "user-agent": "vercel-cron/1.0" }],
        ["un fetch de Node", { "user-agent": "node", "sec-fetch-mode": "cors" }],
        ["fuera de un pedido", null],
      ] as const) {
        const { a, guardados } = almacen({ [CUENTA]: WINDOWS });
        const b = await mandar({ event: "correo_entregado", distinctId: CUENTA, properties: {} }, pedido, a);
        if (b?.properties.$raw_user_agent !== WINDOWS || b.properties.agente_origen !== "recordado") F(`2 · con ${n} el evento no lleva el último navegador de la persona (${String(b?.properties.$raw_user_agent)})`);
        if (guardados.length) F(`2 · con ${n} se recuerda un agente que no salió de un navegador (${JSON.stringify(guardados)})`);
      }
    }

    // ── 3 · EL QUE TRAE EL EVENTO ──
    // Mutaciones: A7 el pedido pisa al del evento · A8 se recuerda una visita.
    {
      const { a, guardados } = almacen();
      const b = await mandar({ event: "landing_viewed", distinctId: "visita:9b7c", properties: { $raw_user_agent: WINDOWS } }, NAVEGADOR, a);
      if (b?.properties.$raw_user_agent !== WINDOWS || b.properties.agente_origen !== "evento") F("3 · el agente que trae el evento no manda");
      if (guardados.length) F("3 · se recuerda el agente de una visita (dura una carga)");
      const cuerpos: Cuerpo[] = [];
      await enviarVista({ event: "deptos_vista", distinctId: "visita:1", properties: { $raw_user_agent: IPHONE } }, { key: "k", host: "https://ph.test", fetch: (async (_u: unknown, i?: { body?: unknown }) => { cuerpos.push(JSON.parse(String(i?.body)) as Cuerpo); return new Response("{}"); }) as typeof fetch });
      if (cuerpos[0]?.properties.$raw_user_agent !== IPHONE || cuerpos[0]?.properties.agente_origen !== "evento") F("3 · la vista del middleware no sale con su agente por el punto único");
    }

    // ── 4 · NUNCA SE VIO SU NAVEGADOR ──
    // Mutación: A9 un almacén caído corta el envío.
    {
      const b = await mandar({ event: "pack_vencido", distinctId: "correo:0123456789abcdef01234567", properties: {} }, null, almacen().a);
      if (!b || "$raw_user_agent" in b.properties || b.properties.agente_origen !== "ninguno") F("4 · sin navegador conocido el evento no lo dice (agente_origen = ninguno) o inventa un agente");
      const caido: AlmacenAgentes = { leer: async () => { throw new Error("sin base"); }, guardar: async () => { throw new Error("sin base"); } };
      const c = await mandar({ event: "correo_abierto", distinctId: CUENTA, properties: {} }, null, caido);
      if (!c) F("4 · con la tabla caída el evento no sale");
      const d = await mandar({ event: "analisis_creado", distinctId: CUENTA, properties: {} }, NAVEGADOR, caido);
      if (d?.properties.$raw_user_agent !== IPHONE) F("4 · con la tabla caída el evento del navegador pierde su agente");
    }

    // ── 5 · UN SOLO PUNTO ──
    // Mutaciones: A10 otro archivo le habla a /capture/ · A11 enviarVista con su propio fetch · A12 sin waitUntil · A13
    // capturarServidor sin el almacén por defecto.
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
      if (!/f\(`\$\{host\}\/capture\/`/.test(nucleo) || !/\.\.\.\(agente\.valor \? \{ \$raw_user_agent: agente\.valor \} : \{\}\)/.test(nucleo)) F("5 · el punto único no manda el agente");
      const srv = sinComentarios(leer("src/lib/posthog-servidor.ts"));
      if (!/enviarCaptura\(ev, agente, deps\)/.test(srv) || !/return headers\(\);/.test(srv) || !/waitUntil\(envio\);/.test(srv)) F("5 · capturarServidor no pasa por el punto único, no lee el pedido de Next o no se anota en waitUntil");
      if (!/const agentes = deps\.agentes !== undefined \? deps\.agentes : deps\.fetch \? null : almacenSupabase\(\);/.test(srv) || !/\.from\("agentes_navegador"\)\.upsert\(/.test(srv) || !/\.from\("agentes_navegador"\)\.select\("agente"\)/.test(srv)) F("5 · capturarServidor no recuerda ni lee el navegador en la tabla");
      if (!/return enviarCaptura\(ev, \{ valor: agenteDelEvento\(ev\), origen: "evento" \}, deps\);/.test(sinComentarios(leer("src/lib/vista-entrada.ts")))) F("5 · enviarVista no pasa por el punto único");
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

    // ── 7 · LA TABLA ──
    {
      const mig = leer("supabase/migrations/20261020_agentes_navegador.sql");
      if (!/create table if not exists public\.agentes_navegador \(\s*distinct_id text primary key/.test(mig) || !/alter table public\.agentes_navegador enable row level security;/.test(mig) || /create policy/i.test(mig)) F("7 · la tabla agentes_navegador no existe con RLS y sin políticas");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  if (fallas.length) {
    console.log(`  ✗ AGENTE-SERVIDOR · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — todo evento del servidor sale por un solo punto con el agente del navegador de la persona: el del pedido si viene de su navegador (y se recuerda), el último recordado si no (webhooks, crons), y sin agente solo si nunca se vio su navegador, diciéndolo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runAgenteServidorTier().then((r) => process.exit(r.hard ? 1 : 0));
}
