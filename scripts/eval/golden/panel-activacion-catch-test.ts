// ============================================================================
// TIER PANEL-ACTIVACION — los dos huecos del panel de activación (21-oct-2026, decisión de Fabrizio)
//
//   1 · TODO EVENTO DEL SERVIDOR DE UNA CUENTA DE PRUEBA LLEVA LA MARCA DESDE EL PRIMER EVENTO, con la misma regla que
//       `es_test_account` (la cuenta está en `test_accounts`): `$set: { test_account: true }` y `prueba: true`, en el
//       punto único (`enviarCaptura`). PostHog guarda las propiedades de la persona en el evento, así que la marca que
//       ponía el navegador después —y solo con el consentimiento— no sacaba de las cohortes lo ya ingerido. Vale para el
//       id de la cuenta, el de su correo y, en una vista de entrada, la cuenta con sesión; la cola también. Si no se
//       puede saber si es de prueba, no sale. EN ROJO CON EL CÓDIGO DE HOY: el evento de una cuenta de prueba salía sin
//       marca.
//   2 · UN INFORME QUE UN PAGO DESBLOQUEA emite `analisis_creado` con via = pago al desbloquearse, como los hechos con
//       saldo, una vez. EN ROJO CON EL CÓDIGO DE HOY: `payments/confirm` no lo emitía.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/panel-activacion-catch-test.ts
// ============================================================================
import "./als-de-next";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";
import { capturarServidor, distinctIdDeCorreo, type EventoServidor } from "../../../src/lib/posthog-servidor";
import * as captura from "../../../src/lib/posthog-captura";
import * as vista from "../../../src/lib/vista-entrada";
import * as activacion from "../../../src/lib/medicion-activacion";
import * as pago from "../../../src/lib/desbloqueo-pago";
import * as correoMed from "../../../src/lib/medicion-correo";
import { vaciarColaVencida, type AlmacenAgentes } from "../../../src/lib/agentes-navegador";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
/** El trozo de `s` entre dos marcas (la primera aparición de cada una, en orden). Vacío si falta alguna. */
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const NAVEGADOR = { "user-agent": IPHONE, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" };
const PRUEBA = "4b74f725-cced-42a2-aaaa-42df8c534a8a";
const REAL = "0f4d1489-0b03-406f-82bf-f74ec9c4af4e";
const CORREO_PRUEBA = distinctIdDeCorreo("qa-primera-1020-a1-4@refranco.ai");
const LISTA: ReadonlySet<string> = new Set([PRUEBA, CORREO_PRUEBA]);

const BLOQUEADO = "a0d99eb1-9330-4740-bce3-3a0b08fc96a6";
const ABIERTO = "f63a640c-d99d-4c16-8375-a177023140ad";
const STR_AMBAS = "ab2634dc-e48b-4354-a11f-60949101cc30";

/** Una base de mentira con lo que usa `abrirInformePagado`: `from("analisis")` con select/update, `.eq` encadenado y
 *  `maybeSingle`. Anota el orden de lecturas y escrituras por fila. */
function baseDeMentira(inicial: Record<string, Record<string, unknown>>) {
  const filas: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(inicial));
  const log: Array<{ op: "leer" | "escribir"; id: string }> = [];
  const consulta = (op: { tipo: "select" } | { tipo: "update"; valores: Record<string, unknown> }) => {
    const filtros: Array<[string, unknown]> = [];
    const coincide = (id: string) => filtros.every(([k, v]) => (k === "id" ? id === v : filas[id]?.[k] === v));
    const q = {
      eq(k: string, v: unknown) { filtros.push([k, v]); return q; },
      async maybeSingle() {
        const id = Object.keys(filas).find(coincide);
        if (id) log.push({ op: "leer", id });
        return { data: id ? { ...filas[id] } : null, error: null };
      },
      then(res: (v: { data: null; error: null }) => unknown, rej?: (e: unknown) => unknown) {
        try {
          if (op.tipo === "update") for (const id of Object.keys(filas).filter(coincide)) { Object.assign(filas[id], op.valores); log.push({ op: "escribir", id }); }
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        } catch (e) { return Promise.reject(e).then(res, rej); }
      },
    };
    return q;
  };
  return {
    filas,
    from(tabla: string) {
      if (tabla !== "analisis") throw new Error(`tabla ${tabla}`);
      return { select: () => consulta({ tipo: "select" }), update: (valores: Record<string, unknown>) => consulta({ tipo: "update", valores }) };
    },
    lecturasAntes: (id: string) => log.filter((x) => x.id === id && x.op === "leer").length,
    primeraLectura: (id: string) => log.findIndex((x) => x.id === id && x.op === "leer"),
    primerUpdate: (id: string) => { const i = log.findIndex((x) => x.id === id && x.op === "escribir"); return i < 0 ? Infinity : i; },
  };
}

type Cuerpo = { event: string; distinct_id: string; timestamp?: string; properties: Record<string, unknown> };
const marcada = (c: Cuerpo | undefined) => (c?.properties.$set as Record<string, unknown> | undefined)?.test_account === true && c?.properties.prueba === true;
const sinMarca = (c: Cuerpo | undefined) => !!c && (c.properties.$set as Record<string, unknown> | undefined)?.test_account === undefined && c.properties.prueba !== true;

function posthogDeMentira() {
  const cuerpos: Cuerpo[] = [];
  const f = (async (_u: unknown, init?: { body?: unknown }) => {
    cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { cuerpos, deps: { fetch: f, key: "phc_test", host: "https://ph.test" } };
}

/** Un evento por `capturarServidor`, dentro de un pedido del navegador, con la lista de prueba que se le pase. */
async function mandar(ev: EventoServidor, lista: ReadonlySet<string> | null): Promise<{ cuerpos: Cuerpo[]; ok: boolean }> {
  const ph = posthogDeMentira();
  const ok = await requestAsyncStorage.run({ headers: new Headers(NAVEGADOR) } as never, () =>
    capturarServidor(ev, { ...ph.deps, agentes: null, cuentasDePrueba: async () => lista } as never),
  );
  return { cuerpos: ph.cuerpos, ok };
}

export async function runPanelActivacionTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PANEL-ACTIVACION (la marca de cuenta de prueba en todo evento del servidor; el desbloqueo por pago cuenta · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · LA MARCA DE CUENTA DE PRUEBA ──
  try {
    // El caso central: un evento del servidor de una cuenta de prueba.
    const p = await mandar({ event: "analisis_creado", distinctId: PRUEBA, properties: { via: "wizard" } }, LISTA);
    if (!marcada(p.cuerpos[0])) F(`1 · un evento del servidor de una cuenta de prueba sale sin la marca ($set.test_account y prueba): ${JSON.stringify(p.cuerpos[0]?.properties ?? null).slice(0, 160)}`);
    const r = await mandar({ event: "analisis_creado", distinctId: REAL, properties: { via: "wizard" } }, LISTA);
    if (!sinMarca(r.cuerpos[0])) F("1 · el evento de una cuenta real sale marcado como prueba (o no sale)");
    const c = await mandar({ event: "lead_correo", distinctId: CORREO_PRUEBA, properties: {} }, LISTA);
    if (!marcada(c.cuerpos[0])) F("1 · el evento con el id del correo de una cuenta de prueba sale sin la marca");
    const s = await mandar({ event: "cuenta_atribuida", distinctId: PRUEBA, properties: { $set: { puerta: "B" } } }, LISTA);
    const set = s.cuerpos[0]?.properties.$set as Record<string, unknown> | undefined;
    if (set?.puerta !== "B" || set?.test_account !== true) F("1 · la marca pisa el $set que el evento ya traía");
    const n = await mandar({ event: "analisis_creado", distinctId: PRUEBA, properties: {} }, null);
    if (n.cuerpos.length || n.ok) F("1 · sin saber si es una cuenta de prueba el evento sale igual");
    // La vista de entrada: va a nombre de la visita, y la cuenta con sesión decide.
    const ev = vista.eventoVistaEntrada({ pagina: "landing", ruta: "/", search: "", referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", esCarga: true, agente: IPHONE, cuentaDeSesion: PRUEBA });
    const ph = posthogDeMentira();
    await vista.enviarVista(ev!, { ...ph.deps, cuentasDePrueba: async () => LISTA } as never);
    if (!ev || !String(ph.cuerpos[0]?.distinct_id ?? "").startsWith("visita:") || ph.cuerpos[0]?.properties.prueba !== true) F("1 · la vista de la landing de una cuenta de prueba con sesión sale sin `prueba`");
    if (JSON.stringify(ph.cuerpos[0] ?? {}).includes(PRUEBA)) F("1 · la vista anónima lleva el id de la cuenta con sesión a PostHog");
    // La cola: lo que esperó sale marcado.
    const filas = [{ id: 1, evento: { event: "correo_entregado", distinctId: PRUEBA, timestamp: "2026-10-01T10:00:00.000Z", properties: {} }, creado: "2026-10-01T10:00:00.000Z" }];
    const a: AlmacenAgentes = {
      async leer() { return null; }, async guardar() {}, async encolar() {},
      async pendientes() { return []; },
      async vencidos() { return filas; },
      async sacar(ids) { for (const id of ids) filas.splice(filas.findIndex((f) => f.id === id), 1); },
    };
    const phCola = posthogDeMentira();
    await vaciarColaVencida(a, { ...phCola.deps, cuentasDePrueba: async () => LISTA } as never, new Date("2026-10-03T00:45:00Z"));
    if (!marcada(phCola.cuerpos[0])) F("1 · un evento de una cuenta de prueba que esperó en la cola sale sin la marca");
    // La cookie de sesión de Supabase, entera y en trozos.
    const sesion = "base64-" + Buffer.from(JSON.stringify({ access_token: "x".repeat(5000), user: { id: PRUEBA } })).toString("base64url");
    const trozos = [{ name: "sb-mxcdyfslbgbipdistmhq-auth-token.1", value: sesion.slice(3180) }, { name: "otra", value: "1" }, { name: "sb-mxcdyfslbgbipdistmhq-auth-token.0", value: sesion.slice(0, 3180) }];
    if (vista.cuentaDeCookieDeSesion(trozos) !== PRUEBA) F("1 · la cuenta con sesión no se lee de la cookie de Supabase en trozos");
    if (vista.cuentaDeCookieDeSesion([{ name: "sb-x-auth-token", value: "base64-basura" }]) !== null || vista.cuentaDeCookieDeSesion([]) !== null) F("1 · una cookie ilegible da una cuenta");
    // La marca por defecto (29-oct-2026): la RPC `marca_de_prueba` por los ids del evento, con el service role; lo de una
    // cuenta vieja o de prueba se recuerda un minuto; sin base, lo último que se supo; si nunca se supo, no se sabe.
    captura.olvidarMarcas();
    const pedidos: Array<{ url: string; init?: RequestInit }> = [];
    let falla = false;
    const VIEJA = new Date("2026-09-01T00:00:00Z").toISOString();
    const rpc = (async (url: unknown, init?: RequestInit) => {
      pedidos.push({ url: String(url), init });
      if (falla) return new Response("x", { status: 500 });
      const ids = (JSON.parse(String(init?.body ?? "{}")) as { p_ids?: string[] }).p_ids ?? [];
      return new Response(JSON.stringify(ids.filter((id) => id === PRUEBA || id === CORREO_PRUEBA || id === REAL).map((id) => ({ id, prueba: id !== REAL, creada_at: VIEJA }))), { status: 200 });
    }) as typeof fetch;
    const t0 = Date.parse("2026-10-21T12:00:00Z");
    const d = { fetch: rpc, url: "https://sb.test", key: "k" };
    const m1 = await captura.marcaDePrueba({ distinctId: PRUEBA }, { ...d, ahora: t0 });
    const m2 = await captura.marcaDePrueba({ distinctId: CORREO_PRUEBA }, { ...d, ahora: t0 });
    const m3 = await captura.marcaDePrueba({ distinctId: "visita:6b1f2c3d", cuentaDeSesion: PRUEBA }, { ...d, ahora: t0 + 30_000 });
    const m4 = await captura.marcaDePrueba({ distinctId: REAL }, { ...d, ahora: t0 });
    const pedidosAntes = pedidos.length;
    falla = true;
    const m5 = await captura.marcaDePrueba({ distinctId: PRUEBA }, { ...d, ahora: t0 + captura.VIDA_MARCA_MS + 1 });
    captura.olvidarMarcas();
    const m6 = await captura.marcaDePrueba({ distinctId: PRUEBA }, { ...d, ahora: t0 });
    if (m1 !== true || m2 !== true || m4 !== false) F("1 · la marca no reconoce la cuenta, el id de su correo o una cuenta real");
    if (m3 !== true) F("1 · la vista con sesión no se marca por la cuenta con sesión");
    const cuerpo0 = JSON.parse(String(pedidos[0]?.init?.body ?? "{}")) as { p_ids?: string[] };
    if (pedidos[0]?.url !== "https://sb.test/rest/v1/rpc/marca_de_prueba" || pedidos[0]?.init?.method !== "POST" || !(pedidos[0]?.init?.headers as Record<string, string>)?.Authorization?.startsWith("Bearer ") || cuerpo0.p_ids?.[0] !== PRUEBA) F("1 · la marca no sale de la RPC `marca_de_prueba` con el service role y los ids del evento");
    if (pedidosAntes !== 3) F(`1 · lo de una cuenta vieja o de prueba no se recuerda un minuto (${pedidosAntes} consultas para cuatro marcas)`);
    if (m5 !== true) F("1 · si la base falla se pierde lo último que se supo");
    if (m6 !== null) F("1 · sin base y sin nada sabido se da por sabido que no es de prueba");
    captura.olvidarMarcas();
  } catch (e) {
    F(`1 · la marca de cuenta de prueba no corre: ${(e as Error).message}`);
  }
  // ── 1b · LA CUENTA DE PRUEBA RECIÉN CREADA (29-oct-2026, goal de Fabrizio) ──
  // La lista se guardaba un minuto, y una cuenta de prueba creada dentro de ese minuto emitía sus primeros eventos sin la
  // marca (medido en producción: las cuentas del QA de la puerta E; y en la semana del 19-oct, 8 de los 11 registros «B»
  // del panel eran de prueba). La marca se decide al emitir: una cuenta de menos de una hora se pregunta en cada evento,
  // por `test_accounts` y por su correo; lo de más de una hora (o ya de prueba) se recuerda un minuto. Corre por el camino
  // por defecto dentro de Next, con la base y PostHog de mentira.
  {
    const guardado = { rt: process.env.NEXT_RUNTIME, fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    const olvidar = () => { for (const k of ["olvidarListaDePrueba", "olvidarMarcas"]) (captura as unknown as Record<string, (() => void) | undefined>)[k]?.(); };
    try {
      const DIA = 86_400_000;
      const VIEJA = "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
      const NUEVA = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
      const NUEVA_REAL = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
      const base = new Map<string, { prueba: boolean; creada: number }>([[VIEJA, { prueba: false, creada: Date.now() - 30 * DIA }], [PRUEBA, { prueba: true, creada: Date.now() - 9 * DIA }]]);
      const rpc: string[] = [];
      const cuerpos: Cuerpo[] = [];
      let caida = false;
      globalThis.fetch = (async (u: unknown, init?: { body?: unknown }) => {
        const url = String(u);
        if (url.includes("/rest/v1/rpc/")) {
          rpc.push(url.split("/rpc/")[1]);
          if (caida) return new Response("caída", { status: 500 });
          if (url.endsWith("/rpc/cuentas_de_prueba")) return new Response(JSON.stringify(Array.from(base).filter(([, c]) => c.prueba).map(([id]) => ({ user_id: id, id_correo: null }))), { status: 200 });
          if (url.endsWith("/rpc/marca_de_prueba")) {
            const ids = (JSON.parse(String(init?.body ?? "{}")) as { p_ids?: string[] }).p_ids ?? [];
            return new Response(JSON.stringify(ids.filter((id) => base.has(id)).map((id) => ({ id, prueba: base.get(id)!.prueba, creada_at: new Date(base.get(id)!.creada).toISOString() }))), { status: 200 });
          }
          return new Response("[]", { status: 404 });
        }
        cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
        return new Response("{}", { status: 200 });
      }) as typeof fetch;
      process.env.NEXT_RUNTIME = "nodejs";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sb.test";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
      olvidar();
      const enviar = (ev: Record<string, unknown>) => captura.enviarCaptura({ event: "cuenta_atribuida", properties: {}, ...ev } as EventoServidor, { valor: IPHONE, origen: "pedido" }, { key: "phc_test", host: "https://ph.test" });
      const ultimo = (id: string) => cuerpos.filter((c) => c.distinct_id === id).pop();
      // Una cuenta vieja emite primero (lo que se guarde, se guarda acá); después nace una cuenta de prueba.
      await enviar({ distinctId: VIEJA });
      base.set(NUEVA, { prueba: true, creada: Date.now() - 5_000 });
      await enviar({ distinctId: NUEVA });
      if (!marcada(ultimo(NUEVA))) F("1b · el primer evento de una cuenta de prueba recién creada sale sin la marca (lo guardado no la conocía)");
      // Una cuenta real de menos de una hora: se pregunta en cada evento y sale sin marca; si a los minutos la anotan como
      // de prueba (un QA que la inserta después), el siguiente evento ya sale marcado.
      base.set(NUEVA_REAL, { prueba: false, creada: Date.now() - 60_000 });
      const antesNueva = rpc.length;
      await enviar({ distinctId: NUEVA_REAL });
      await enviar({ distinctId: NUEVA_REAL });
      if (rpc.length - antesNueva !== 2) F(`1b · una cuenta de menos de una hora se responde desde lo guardado (${rpc.length - antesNueva} consultas para dos eventos)`);
      if (!sinMarca(ultimo(NUEVA_REAL))) F("1b · el evento de una cuenta real nueva sale marcado como prueba");
      base.set(NUEVA_REAL, { prueba: true, creada: Date.now() - 120_000 });
      await enviar({ distinctId: NUEVA_REAL });
      if (!marcada(ultimo(NUEVA_REAL))) F("1b · una cuenta nueva que se anota como de prueba después sigue saliendo sin la marca");
      // Una cuenta de más de una hora se recuerda: no una consulta por evento.
      const antesVieja = rpc.length;
      await enviar({ distinctId: VIEJA });
      await enviar({ distinctId: VIEJA });
      if (rpc.length !== antesVieja) F(`1b · una cuenta de más de una hora se pregunta en cada evento (${rpc.length - antesVieja} consultas)`);
      if (!sinMarca(ultimo(VIEJA))) F("1b · la cuenta vieja real sale marcada");
      // Por correo: los de Franco son de prueba en el mismo punto, aunque no haya cuenta.
      for (const correo of ["qa-sin-cuenta-1029@refranco.ai", "fabriziosciaraffia+qa1029@gmail.com"]) {
        const id = distinctIdDeCorreo(correo);
        await enviar({ event: "correo_enviado", distinctId: id, correo });
        if (!marcada(ultimo(id))) F(`1b · un evento con el correo ${correo.replace(/^[^@+]+/, "…")} sale sin la marca`);
        if (JSON.stringify(ultimo(id) ?? {}).includes(correo)) F("1b · el correo viaja a PostHog");
      }
      // Sin base: una cuenta que nunca se supo no sale (no se puede saber); la vieja sale con lo último que se supo.
      caida = true;
      const n0 = cuerpos.length;
      await enviar({ distinctId: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f" });
      if (cuerpos.length !== n0) F("1b · sin poder preguntar, el evento de una cuenta desconocida sale igual");
    } catch (e) {
      F(`1b · la marca de la cuenta recién creada no corre: ${(e as Error).message}`);
    } finally {
      globalThis.fetch = guardado.fetch;
      if (guardado.rt === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = guardado.rt;
      if (guardado.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = guardado.url;
      if (guardado.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = guardado.key;
      olvidar();
    }
  }
  // El cableado: el punto único usa la lista por defecto, el middleware pasa la sesión, la RPC es la regla de test_accounts.
  const nucleo = sinComentarios(leer("src/lib/posthog-captura.ts"));
  // Por defecto, la marca de la base DENTRO DE NEXT (Vercel, el middleware en Edge, `next dev`); en una prueba, ninguna
  // salvo que se pase (los tiers que reemplazan el `fetch` global ejercitan rutas reales sin tocar la base). Y antes que
  // todo, lo que el evento ya trae decidido o su correo.
  if (!/const prueba = await pruebaDe\(ev, deps\);\s*if \(prueba === null\) return false;/.test(nucleo) || !/cuerpoDeCaptura\(ev, key, \{ valor, origen: agente\.origen \}, new Date\(\), prueba\)/.test(nucleo)
    || !/if \(ev\.prueba === true \|\| correoDePrueba\(ev\.correo\)\) return true;\s*if \(deps\.cuentasDePrueba\) \{/.test(nucleo)
    || !/if \(deps\.fetch \|\| \(!process\.env\.NEXT_RUNTIME && process\.env\.VERCEL !== "1"\)\) return false;\s*return marcaDePrueba\(ev\);/.test(nucleo)) F("1 · `enviarCaptura` no pregunta la marca por defecto (dentro de Next), no mira el correo o no marca con lo que sabe");
  // Los emisores que saben el correo y van a nombre del correo lo pasan: el webhook de Resend, el correo enviado, el pack
  // vencido y el alta perdida.
  const deResend = correoMed.eventoDeResend({ type: "email.delivered", created_at: "2026-10-29T12:00:00Z", data: { to: ["qa-1029@refranco.ai"], email_id: "e1" } }, "svix-1");
  if (deResend?.correo !== "qa-1029@refranco.ai") F("1 · el evento del webhook de Resend no lleva el correo a la marca");
  if (correoMed.eventoCorreoEnviado({ tipo: "semanal", distinctId: CORREO_PRUEBA, resendId: "r1", correo: "qa@refranco.ai" }).correo !== "qa@refranco.ai") F("1 · `correo_enviado` no lleva el correo a la marca");
  if (!/correo: String\(to \?\? ""\) \|\| null/.test(sinComentarios(leer("src/lib/email.ts"))) || !/\.\.\.eventoPackVencido\(\{[^}]*\}\), correo: email \}/.test(sinComentarios(leer("src/app/api/lo-que-sigue/pack/route.ts"))) || !/distinctId: f\.user_id \?\? distinctIdDeCorreo\(f\.correo\),\s*correo: f\.correo,/.test(sinComentarios(leer("src/lib/deptos/entrada-servidor.ts")))) F("1 · un emisor a nombre del correo no le pasa el correo a la marca (correo enviado, pack vencido o alta perdida)");
  // La cola guarda el evento sin el correo, con lo que el correo decidió.
  if (!/const ev = sinCorreo\(evento\);/.test(sinComentarios(leer("src/lib/posthog-servidor.ts")))) F("1 · `capturarServidor` guarda el correo en la cola (o pierde lo que decidía)");
  const sc = captura.sinCorreo({ event: "x", distinctId: CORREO_PRUEBA, correo: "QA-1029@Refranco.ai", properties: {} });
  if (sc.prueba !== true || "correo" in sc || "prueba" in captura.sinCorreo({ event: "x", distinctId: REAL, correo: "persona@gmail.com" })) F("1 · `sinCorreo` no deja la marca del correo o no saca el correo");
  // Y que «dentro de Next» se cumpla de verdad: el default de una ruta de Node y del middleware de Edge.
  try {
    const guardado = { rt: process.env.NEXT_RUNTIME, fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    const pedidosRpc: string[] = [];
    const cuerpos: Cuerpo[] = [];
    globalThis.fetch = (async (u: unknown, init?: { body?: unknown }) => {
      if (String(u).includes("/rest/v1/rpc/marca_de_prueba")) { pedidosRpc.push(String(u)); return new Response(JSON.stringify([{ id: PRUEBA, prueba: true, creada_at: "2026-09-01T00:00:00Z" }]), { status: 200 }); }
      cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sb.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    try {
      for (const rt of ["edge", "nodejs"]) {
        process.env.NEXT_RUNTIME = rt;
        captura.olvidarMarcas();
        await captura.enviarCaptura({ event: "x", distinctId: PRUEBA, properties: {} }, { valor: IPHONE, origen: "pedido" }, { key: "phc_test", host: "https://ph.test" });
      }
    } finally {
      globalThis.fetch = guardado.fetch;
      if (guardado.rt === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = guardado.rt;
      if (guardado.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = guardado.url;
      if (guardado.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = guardado.key;
      captura.olvidarMarcas();
    }
    if (pedidosRpc.length !== 2 || cuerpos.length !== 2 || !cuerpos.every((c) => marcada(c))) F(`1 · dentro de Next (Edge y Node) la marca por defecto no se pregunta o el evento no sale marcado (${pedidosRpc.length} pedidos, ${cuerpos.length} eventos)`);
  } catch (e) {
    F(`1 · la marca por defecto dentro de Next no corre: ${(e as Error).message}`);
  }
  const mw = sinComentarios(leer("src/middleware.ts"));
  if (!/cuentaDeSesion: persona\?\.id \?\? cuentaDeCookieDeSesion\(request\.cookies\.getAll\(\)\)/.test(mw) || !/conVista\(req, conMedicion\(req, conNavegador\(req, res, event, persona\)\), event, visita, persona\)/.test(mw)) F("1 · el middleware no le pasa a la vista la cuenta con sesión");
  // La RPC de la marca (29-oct-2026): `test_accounts` O el correo de Franco (la regla del trigger y de `correoDePrueba`),
  // la fecha de la cuenta, el id del correo como `distinctIdDeCorreo`, y solo para el service role.
  const mig = existsSync(join(RAIZ, "supabase/migrations/20261029_marca_de_prueba.sql")) ? sinComentarios(leer("supabase/migrations/20261029_marca_de_prueba.sql")) : "";
  if (!/returns table \(id text, prueba boolean, creada_at timestamptz\)/.test(mig)
    || !/\(exists \(select 1 from public\.test_accounts t where t\.user_id = u\.id\)\s*or coalesce\(u\.email, ''\) ilike 'fabriziosciaraffia\+%@gmail\.com'\s*or coalesce\(u\.email, ''\) ilike '%@refranco\.ai'\) as prueba/.test(mig)
    || !/select p\.id, c\.prueba, c\.created_at\s*from pedidos p\s*join cuentas c on c\.uid::text = lower\(p\.id\)/.test(mig)
    || !/'correo:' \|\| substr\(encode\(sha256\(convert_to\(lower\(trim\(c\.email\)\), 'UTF8'\)\), 'hex'\), 1, 24\) = p\.id/.test(mig)
    || !/security definer/.test(mig) || !/set search_path = public, pg_temp/.test(mig)
    || !/revoke all on function public\.marca_de_prueba\(text\[\]\) from public, anon, authenticated;/.test(mig) || !/grant execute on function public\.marca_de_prueba\(text\[\]\) to service_role;/.test(mig)) F("1 · la RPC de la marca no es test_accounts o el correo de Franco, no da la fecha de la cuenta, no calcula el id del correo como `distinctIdDeCorreo` o la puede leer alguien más que el service role");
  // Y el correo de Franco es el mismo en las tres partes: el trigger, la RPC y `correoDePrueba`.
  for (const [c, esperado] of [["fabriziosciaraffia+qa@gmail.com", true], ["FabrizioSciaraffia+x@Gmail.com", true], ["qa@refranco.ai", true], ["fabriziosciaraffia@gmail.com", false], ["alguien@refranco.ai.cl", false], ["persona@gmail.com", false]] as const) {
    if (captura.correoDePrueba(c) !== esperado) F(`1 · \`correoDePrueba\` se equivoca con ${c.replace(/^[^@+]+/, "…")}`);
  }
  if (distinctIdDeCorreo(" QA@Refranco.ai ") !== "correo:" + createHash("sha256").update("qa@refranco.ai").digest("hex").slice(0, 24)) F("1 · `distinctIdDeCorreo` dejó de ser sha256 del correo en minúsculas (la RPC calcula ese)");

  // ── 2 · EL DESBLOQUEO POR PAGO ──
  try {
    const casos: Array<[Parameters<typeof activacion.seDesbloqueaConPago>[0], boolean]> = [
      [{ is_premium: false, pending_payment: true }, true],
      [{ is_premium: false, pending_payment: false }, true],
      [{ is_premium: true, pending_payment: true }, true],
      [{ is_premium: true, pending_payment: false }, false],
      [null, false],
    ];
    for (const [antes, esperado] of casos) if (activacion.seDesbloqueaConPago(antes) !== esperado) F(`2 · con ${JSON.stringify(antes)} el pago ${esperado ? "no cuenta el desbloqueo" : "cuenta un informe que ya estaba abierto"}`);
    if (activacion.VIA_PAGO !== "pago") F("2 · la vía del desbloqueo por pago no es «pago»");
    if (activacion.modalidadDelInforme("short-term") !== "str" || activacion.modalidadDelInforme("long-term") !== "ltr" || activacion.modalidadDelInforme(null) !== "ltr") F("2 · la modalidad del informe pagado no es ltr / str");
    const e = activacion.eventoAnalisisCreado({ userId: REAL, analysisId: "a0d99eb1-9330-4740-bce3-3a0b08fc96a6", modalidad: "ltr", via: activacion.VIA_PAGO });
    if (e.event !== "analisis_creado" || (e.properties as Record<string, unknown>).via !== "pago" || e.uuid !== activacion.eventoAnalisisCreado({ userId: REAL, analysisId: "a0d99eb1-9330-4740-bce3-3a0b08fc96a6", modalidad: "ltr", via: "wizard" }).uuid) F("2 · el evento del desbloqueo por pago no es `analisis_creado` con via = pago y el uuid del informe");
  } catch (e) {
    F(`2 · el desbloqueo por pago no tiene con qué contarse: ${(e as Error).message}`);
  }
  // EL DESBLOQUEO DE VERDAD (`abrirInformePagado`, lo que corre payments/confirm), contra una base de mentira: la fila
  // bloqueada del wizard sin saldo se abre con un pago y sale UN `analisis_creado` via = pago; el reenvío de Flow, ninguno.
  try {
    const marcaReanalisis = { origenId: ABIERTO, precioOriginalUF: 3400, precioRecomendadoUF: 3220, piePct: 30, plazoAnios: 30 };
    const base = baseDeMentira({
      [BLOQUEADO]: { is_premium: false, pending_payment: true, tipo_analisis: "short-term", input_data: { reanalisis: marcaReanalisis } },
      [ABIERTO]: { is_premium: true, pending_payment: false, tipo_analisis: "long-term", input_data: {} },
      [STR_AMBAS]: { is_premium: false, pending_payment: true, tipo_analisis: "short-term", input_data: {} },
    });
    const contados: Array<{ analysisId: string; via: string; modalidad: string; userId: string }> = [];
    const consumidos: string[] = [];
    const reanalisisContados: string[] = [];
    const deps = {
      consumir: async (_u: string, id: string) => { consumidos.push(id); base.filas[id].is_premium = true; return true; },
      contar: async (a: { userId: string | null | undefined; analysisId: string | null | undefined; modalidad: string; via: string }) => { contados.push({ analysisId: a.analysisId!, via: a.via, modalidad: a.modalidad, userId: a.userId! }); },
      contarReanalisis: async (p: { analysisId: string; conPago: boolean }) => { reanalisisContados.push(`${p.analysisId}:${p.conPago}`); },
    };
    const r1 = await pago.abrirInformePagado(base as never, { userId: REAL, analysisId: BLOQUEADO, companionStrId: STR_AMBAS }, deps);
    const r2 = await pago.abrirInformePagado(base as never, { userId: REAL, analysisId: BLOQUEADO, companionStrId: STR_AMBAS }, deps);
    const r3 = await pago.abrirInformePagado(base as never, { userId: REAL, analysisId: ABIERTO }, deps);
    const deBloqueado = contados.filter((c) => c.analysisId === BLOQUEADO);
    if (!r1.abierto || deBloqueado.length !== 1 || deBloqueado[0].via !== "pago" || deBloqueado[0].modalidad !== "str" || deBloqueado[0].userId !== REAL) F(`2 · un pago que desbloquea un informe no emite UN \`analisis_creado\` con via = pago (${JSON.stringify(contados)})`);
    if (r2.abierto) F("2 · el reenvío de Flow cuenta el informe otra vez");
    if (reanalisisContados.join(",") !== `${BLOQUEADO}:true`) F(`2 · el re-análisis pagado no sale una vez con con_pago al abrirse (${reanalisisContados.join(",") || "nada"})`);
    if (r3.abierto || contados.some((c) => c.analysisId === ABIERTO)) F("2 · un pago sobre un informe ya completo lo cuenta como desbloqueado");
    if (base.filas[BLOQUEADO].pending_payment !== false || base.filas[BLOQUEADO].is_premium !== true || base.filas[STR_AMBAS].pending_payment !== false || base.filas[STR_AMBAS].is_premium !== true) F("2 · el pago no abre el informe bloqueado o su fila STR de AMBAS");
    if (consumidos.filter((x) => x === BLOQUEADO).length < 1) F("2 · el desbloqueo no consume el crédito del pago");
    if (base.lecturasAntes(BLOQUEADO) < 1 || base.primerUpdate(BLOQUEADO) < base.primeraLectura(BLOQUEADO)) F("2 · el informe se lee después de abrirlo (el pago no sabría que lo abrió)");
  } catch (e) {
    F(`2 · el desbloqueo por pago no corre: ${(e as Error).message}`);
  }
  const cf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  const suelto = entre(cf, 'if (userId && product === "single") {', "} else if (userId && product === PRODUCTO_PACK) {");
  const emite = /if \(seDesbloqueaConPago\(antesDelPago\)\) \{\s*await capturarAnalisisCreado\(\{ userId, analysisId, modalidad: modalidadDelInforme\(antesDelPago\?\.tipo_analisis as string \| null\), via: VIA_PAGO \}\);\s*\}/;
  if (!/if \(analysisId\) \{\s*await abrirInformePagado\(supabase, \{ userId, analysisId, companionStrId \}\);\s*\}/.test(suelto) || /consumeCredit\(/.test(suelto)) F("2 · la compra suelta atada a un informe no lo abre con `abrirInformePagado` (el que cuenta el desbloqueo)");
  const pro = entre(cf, 'if (product === "pro" && analysisId) {', 'if (premiumError)');
  if (!emite.test(pro) || pro.indexOf("antesDelPago") > pro.indexOf('.update({ is_premium: true })')) F("2 · el desbloqueo `pro` no emite `analisis_creado` con via = pago");
  const doc = leer("docs/posthog-activacion-por-puerta.md");
  if (!/via = pago/.test(doc) || !/\$set: \{ test_account: true \}/.test(doc)) F("3 · el doc del panel no dice que los pagos cuentan (via = pago) ni que el servidor marca las cuentas de prueba");

  if (fallas.length) {
    console.log(`  ✗ PANEL-ACTIVACION · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — todo evento del servidor de una cuenta de prueba sale marcado desde el primero (cuenta, correo, vista con sesión, cola), sin lista no sale; el informe que un pago desbloquea cuenta con via = pago, una vez");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (21-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD f3855b48, los archivos del goal de vuelta): 14 fallas,
// entre ellas «un evento del servidor de una cuenta de prueba sale sin la marca» y «la compra suelta atada a un informe
// no emite `analisis_creado` con via = pago». Y 24 mutaciones, cada una restaurada byte a byte, todas ROJAS:
//   P1 sin marca en el cuerpo · P2 la lista no decide · P3 sin lista sale igual · P4 la vista ignora la sesión · P5 la
//   marca pisa el $set · P6 la vista pierde la sesión · P7 el middleware no la pasa · P8 los trozos de la cookie en otro
//   orden · P9 sin caché · P10 la RPC falla y se pierde la lista buena · P11 sin el id del correo · P12 sin lista por
//   defecto · P16 la lista por defecto solo en Vercel (el middleware en Edge quedaría sin marca) · P13 la RPC la lee
//   cualquiera · P14 la vista anónima lleva la cuenta · P15 la lista no reconoce el id
// El desbloqueo por pago se prueba POR COMPORTAMIENTO (`abrirInformePagado`, el que llama payments/confirm, contra una
// base de mentira), no solo por el texto de la ruta: D1 no cuenta · D2 cuenta lo ya abierto (y el reenvío) · D3 lee el
// informe después de abrirlo · D4 otra vía · D5 el re-análisis sale en el reenvío · D6 no abre la fila STR de AMBAS ·
// D7 no consume el crédito · D8 confirm no lo llama: todas ROJAS. Con la base REAL (21-oct-2026, la fila bloqueada
// a0d99eb1 de la cuenta de prueba qa-primera-1020-a2-2, sin Flow): un pago la abrió y salió UN `analisis_creado`
// via = pago, marcado; el reenvío no contó.
// La primera versión pedía la lista por defecto siempre que no hubiera `fetch` inyectado, y el QUICK salió con 8 fallas
// en VISTA-ENTRADA, AGENTE-SERVIDOR y MEDICION-META: esos tiers reemplazan el `fetch` global y la RPC le llegaba al
// falso. Por eso el default es «dentro de Next», como el almacén de agentes, y este tier lo prueba en Edge y en Node.
//   Q1 un informe no premium sin bloqueo no cuenta · Q2 el suelto no emite · Q3 lee el informe después de abrirlo ·
//   Q4 otra vía · Q5 el `pro` no emite · Q6 la vía no es «pago» · Q7 la modalidad · Q8 el doc
// ACTA (29-oct-2026, goal «cuentas de prueba marcadas desde el primer evento»). CONTRA EL CÓDIGO DE ESE DÍA (83803e32, la
// lista de `test_accounts` guardada un minuto): el bloque 1b salió con 6 fallas, la primera «el primer evento de una cuenta
// de prueba recién creada sale sin la marca». P2, P9, P10, P12, P15 y P16 probaban la lista y se reescribieron para la marca
// por evento. Y 17 mutaciones, cada una restaurada byte a byte (runner `mutar-marca.cjs` del scratchpad), todas ROJAS:
//   K1 se recuerda la cuenta nueva · K2 la cuenta nueva dura cero · K3 lo viejo no se recuerda · K4 el correo de Franco no
//   marca · K5 sin fabriziosciaraffia+ · K6 sin base una cuenta desconocida pasa por real · K7 sin base se pierde lo sabido ·
//   K8 la cola guarda el correo · K9 `enviarCaptura` ignora el correo · K10 el default no pregunta · K11 la RPC sin el
//   correo de Franco · K12 sin la fecha de la cuenta · K13 la RPC para cualquiera · K14 Resend sin el correo · K15 el alta
//   perdida sin el correo · K16 el correo enviado sin el correo (tier MEDICIÓN) · K17 la vista no pregunta por la sesión

if (require.main === module) {
  runPanelActivacionTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
