// ─────────────────────────────────────────────────────────────────────────────
// Tier MEDICION-META (15-oct-2026, 0 tokens, sin red ni base) — la medición para la campaña: que Meta y PostHog
// sepan qué pasó.
//
//   1 · DEDUPLICACIÓN: cada evento que el servidor manda a Meta le deja al navegador el MISMO evento con el MISMO id
//       (el espejo); el pixel repite solo eso. Una vez por id. Ninguna superficie del navegador inventa el id de un
//       Lead, un registro, una vista, una compra o un evento propio.
//   2 · LA COLA DEL PIXEL: un evento disparado antes de que el pixel cargue se guarda (sessionStorage), sobrevive a
//       una navegación y sale cuando fbevents.js opera; no sale dos veces. El fbclid queda en `_fbc` aunque el pixel
//       no alcance a cargar.
//   3 · LAS CUENTAS DE PRUEBA, FUERA: ni el servidor ni el pixel mandan nada suyo; el modo prueba manda los eventos
//       del servidor con el código de prueba y sin espejo.
//   4 · LA ATRIBUCIÓN POR PUERTA: A informe, B selección, C referido, D orgánico; la primera gana y D cede; cada lugar
//       donde se deja el correo marca su puerta; el servidor la fija donde la sabe.
//
// Nada sale de verdad: `envioMeta.enviar` se reemplaza por un contador, `fetch` también, y las variables de PostHog y
// de Meta se borran mientras corre.
//
// ACTA DE MUTACIONES (15-oct-2026): 25/25 en ROJO, restauradas byte a byte (scratchpad mutar-medicion.cjs).
//   Deduplicación: D1 el espejo con otro id · D2 sin la marca de «una vez» · D3 el retorno arma su Purchase · D4 el
//   Lead sin espejo · D5 el alta del plan con otro id.
//   Cola: C1 la cola no se guarda · C2 se entrega al stub · C3 sin memoria de enviados · C4 MetaPixel sin mirar la
//   cola · C5 la landing sin middleware (el fbclid).
//   Cuentas de prueba: P1 el servidor sin el filtro · P2 el admin no es de prueba · P3 el pixel carga · P4 la marca
//   del navegador nunca dice prueba · P5 la sincronización no marca · P6 el modo prueba sin código · P7 el retorno
//   del pago sin filtro.
//   Puertas: A1 D no cede · A2 la RPC sin la regla · A3 el banner sin puerta · A4 el ticket sin puerta · A5 la
//   sincronización sin puerta · A6 el referido no es C · A7 PostHog sin cuenta_atribuida única · A8 el reclamo no
//   guarda la puerta.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/medicion-meta-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import "./als-de-next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";
import { EVENTOS_META, EVENTOS_PROPIOS, idAnalizarEste, idCompra, idCompraPlan, idLead, idQuieroVerlo, idRegistro, idSemanalClic, idVistaInforme } from "../../../src/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta, envioMeta, type ContextoMeta } from "../../../src/lib/meta/servidor";
import type { MetaCapiEventInput } from "../../../src/lib/meta/capi";
import { COOKIE_ESPEJO, consumirCookieEspejo, espejarMeta, parsearEspejo } from "../../../src/lib/meta/espejo";
import { CLAVE_COLA, CLAVE_CUENTA_PRUEBA, VIDA_COLA_MS, colaMeta, marcarCuentaDePrueba, metaTrack, metaTrackCustom, vaciarColaMeta } from "../../../src/lib/meta/pixel";
import { cookiesDeLlegada, fbcDeFbclid } from "../../../src/lib/meta/cookies";
import { esAltaReciente } from "../../../src/lib/meta/registro";
import { fusionarPuerta, leerPuertaCandidata, marcarPuertaCandidata, puertaDeLlegada, puertaParaSincronizar, type Puerta } from "../../../src/lib/atribucion-puerta";
import { guardarAtribucion, sanearAtribucion } from "../../../src/lib/attribution";
import { diasDelRango } from "../../../src/lib/meta-ads-cron";
import { NextResponse } from "next/server";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ── Dobles ──────────────────────────────────────────────────────────────────
/** Un Storage en memoria. */
function almacen(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}

/**
 * Un navegador: storage, cookies y (si se pide) el pixel. ⚠ ACTA (19-oct-2026, consentimiento de cookies) · el pixel
 * opera SOLO con el «si» del aviso (lib/consentimiento.ts): este tier prueba el camino CON permiso, así que el navegador
 * nace con la cookie puesta. El camino SIN permiso lo fija el tier CONSENTIMIENTO.
 */
function navegador() {
  const jar = new Map<string, string>([["franco_consentimiento", "si"]]);
  const w = { sessionStorage: almacen(), localStorage: almacen() } as unknown as Record<string, unknown>;
  const doc = {
    get cookie() { return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(s: string) {
      const [par, ...attrs] = s.split(";").map((x) => x.trim());
      const i = par.indexOf("=");
      const k = par.slice(0, i), v = par.slice(i + 1);
      if (attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(k); else jar.set(k, v);
    },
  };
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = doc;
  const llamadas: Array<{ comando: string; evento: string; datos?: Record<string, unknown>; eventID?: string }> = [];
  const conPixel = (operativo: boolean) => {
    const fbq = ((comando: string, evento: string, datos?: Record<string, unknown>, o?: { eventID?: string }) => {
      llamadas.push({ comando, evento, datos, eventID: o?.eventID });
    }) as unknown as Record<string, unknown>;
    if (operativo) fbq.callMethod = () => {};
    w.fbq = fbq;
  };
  return { w, jar, llamadas, conPixel };
}

/** La base: meta_eventos (marca por evento + id + prueba), meta_contexto y la RPC de cuentas de prueba. */
function baseFalsa(esPrueba: (p: { p_user_id: string | null; p_email: string | null }) => boolean = () => false) {
  const eventos = new Map<string, Record<string, unknown>>();
  const contexto = new Map<string, Record<string, unknown>>();
  const llave = (r: Record<string, unknown>) => `${r.evento}|${r.event_id}|${r.prueba}`;
  const sb = {
    async rpc(fn: string, p: { p_user_id: string | null; p_email: string | null }) {
      return fn === "es_cuenta_de_prueba" ? { data: esPrueba(p), error: null } : { data: null, error: { message: "sin rpc" } };
    },
    from(t: string) {
      if (t === "meta_eventos") return {
        upsert(row: Record<string, unknown>) {
          const k = llave(row);
          const nueva = !eventos.has(k);
          if (nueva) eventos.set(k, { ...row });
          return Object.assign(Promise.resolve({ error: null }), { select: () => Promise.resolve({ data: nueva ? [{ id: eventos.size }] : [], error: null }) });
        },
        update(c: Record<string, unknown>) {
          const f: Record<string, unknown> = {};
          const b = {
            eq(k: string, v: unknown): unknown {
              f[k] = v;
              if (Object.keys(f).length < 3) return b;
              for (const [kk, r] of eventos) if (r.evento === f.evento && r.event_id === f.event_id && r.prueba === f.prueba) eventos.set(kk, { ...r, ...c });
              return Promise.resolve({ error: null });
            },
          };
          return b;
        },
      };
      if (t === "meta_contexto") return {
        upsert(row: Record<string, unknown>) { contexto.set(String(row.user_id), { ...row, updated_at: new Date().toISOString() }); return Promise.resolve({ error: null }); },
        select() { return { eq: (_k: string, v: string) => ({ maybeSingle: async () => ({ data: contexto.get(v) ?? null, error: null }) }) }; },
      };
      throw new Error(`tabla inesperada: ${t}`);
    },
  };
  return { sb: sb as never, eventos, contexto };
}

// Con el «si» del aviso de cookies (19-oct-2026): sin él no salen el correo, el id ni las cookies (tier CONSENTIMIENTO).
const NAVEGADOR: ContextoMeta = { ip: "200.1.1.1", ua: "Mozilla/5.0", fbp: "fb.1.1.111", fbc: "fb.1.2.abc", url: "https://refranco.ai/x", prueba: false, consentimiento: true };

export async function runMedicionMetaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER MEDICION-META (deduplicación, cola del pixel, cuentas de prueba, puertas · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // Nada sale: ni Meta ni PostHog.
  const guardado = { fetch: globalThis.fetch, enviar: envioMeta.enviar, env: { ...process.env } };
  for (const k of ["NEXT_PUBLIC_POSTHOG_KEY", "META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) delete process.env[k];
  const fetchs: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (u: string, init?: RequestInit) => { fetchs.push({ url: String(u), body: String(init?.body ?? "") }); return new Response("{}", { status: 200 }); }) as typeof fetch;
  const envios: MetaCapiEventInput[] = [];
  envioMeta.enviar = async (input) => { envios.push(input); return { ok: true, status: 200 }; };

  try {
    // ── 1 · DEDUPLICACIÓN ──────────────────────────────────────────────────────
    {
      const { sb, eventos } = baseFalsa();
      envios.length = 0;
      const id = await idLead("  Persona@Correo.CL ");
      if (id !== (await idLead("persona@correo.cl")) || !/^lead-[0-9a-f]{32}$/.test(id)) F("1 · el id del Lead no es uno por correo (normalizado)");
      const e = await emitirEventoMeta(sb, { evento: EVENTOS_META.lead, eventId: id, email: "persona@correo.cl", datos: { origen: "banner" }, contexto: NAVEGADOR });
      await e.envio;
      const enviado = envios[0];
      if (!e.espejo || !enviado || e.espejo.eventId !== enviado.eventId || e.espejo.evento !== enviado.eventName) F("1 · el espejo del navegador no lleva el mismo evento y el mismo id que la API de conversiones");
      if (enviado && (enviado.fbp !== NAVEGADOR.fbp || enviado.fbc !== NAVEGADOR.fbc || enviado.clientIp !== NAVEGADOR.ip || enviado.userAgent !== NAVEGADOR.ua || enviado.email !== "persona@correo.cl")) F("1 · el evento del servidor no lleva correo, fbp, fbc, IP y navegador");
      const otra = await emitirEventoMeta(sb, { evento: EVENTOS_META.lead, eventId: id, email: "persona@correo.cl", contexto: NAVEGADOR });
      await otra.envio;
      if (otra.estado !== "repetido" || otra.espejo || envios.length !== 1) F("1 · el mismo evento sale dos veces (o el navegador lo repite dos veces)");
      if ([...eventos.values()].some((r) => r.estado !== "enviado")) F("1 · la fila del evento no queda «enviado»");
      // La compra: el mismo id que /payments/return, con el valor en los dos lados; un webhook sin cookies usa el navegador guardado.
      const { sb: sb2, contexto } = baseFalsa();
      envios.length = 0;
      contexto.set("u1", { ...NAVEGADOR, user_id: "u1", updated_at: new Date().toISOString() });
      const c = await emitirEventoMeta(sb2, { evento: EVENTOS_META.compra, eventId: idCompra("franco-abc"), userId: "u1", email: "a@b.cl", valor: 14990 });
      await c.envio;
      if (envios[0]?.eventId !== "franco-abc" || c.espejo?.eventId !== "franco-abc" || envios[0]?.value !== 14990 || c.espejo?.datos?.value !== 14990) F("1 · la compra no lleva el commerce_order ni el valor en los dos lados");
      if (envios[0]?.fbp !== NAVEGADOR.fbp || envios[0]?.externalId !== "u1") F("1 · la compra del webhook no usa el navegador guardado de la cuenta ni el id externo");
      // Purchase y Subscribe del primer cobro comparten id: la marca es por evento.
      const { sb: sb3 } = baseFalsa();
      envios.length = 0;
      for (const ev of [EVENTOS_META.compra, EVENTOS_META.suscripcion]) await (await emitirEventoMeta(sb3, { evento: ev, eventId: idCompraPlan("s9"), userId: "u2", valor: 39990 })).envio;
      if (envios.length !== 2) F("1 · el primer cobro de un plan no manda Purchase y Subscribe (la marca de «una vez» no es por evento)");
      // Los ids son puros y estables.
      if (idRegistro("u") !== "reg-u" || idVistaInforme("a") !== "vc-a" || idQuieroVerlo("a") !== "qv-a" || idCompraPlan("s") !== "sub-s" || !idAnalizarEste("av", "t".repeat(40)).startsWith("ae-av-") || !idSemanalClic("t".repeat(40), "seleccion").startsWith("sc-")) F("1 · los ids de los eventos cambiaron de forma");
      // La cookie del espejo: la respuesta la deja (sumada a la que había) y el navegador la consume una vez.
      const res = conEspejo(NextResponse.json({ ok: true }), [{ evento: "Lead", eventId: "lead-1" }], new Request("https://refranco.ai/api/x", { headers: { cookie: `${COOKIE_ESPEJO}=${encodeURIComponent(JSON.stringify([{ evento: "QuieroVerlo", eventId: "qv-1" }]))}` } }));
      const puesta = parsearEspejo(res.cookies.get(COOKIE_ESPEJO)?.value ?? null);
      if (puesta.map((x) => x.eventId).join() !== "qv-1,lead-1") F(`1 · la cookie del espejo no suma lo que el navegador todavía no consumió (${puesta.map((x) => x.eventId).join()})`);
      const nav = navegador();
      nav.jar.set(COOKIE_ESPEJO, encodeURIComponent(JSON.stringify(puesta)));
      const consumidos = consumirCookieEspejo();
      if (consumidos.length !== 2 || nav.jar.has(COOKIE_ESPEJO)) F("1 · el navegador no consume la cookie del espejo (o la deja para consumirla otra vez)");
      nav.conPixel(true);
      espejarMeta(consumidos);
      const salieron = nav.llamadas.map((l) => `${l.comando}:${l.evento}:${l.eventID}`).join();
      if (salieron !== "trackCustom:QuieroVerlo:qv-1,track:Lead:lead-1") F(`1 · el pixel no repite el espejo con el mismo id (los propios con trackCustom): ${salieron}`);
      if (![EVENTOS_META.analizarEste, EVENTOS_META.quieroVerlo, EVENTOS_META.semanalClic, EVENTOS_META.intencion].every((n) => EVENTOS_PROPIOS.has(n))) F("1 · un evento propio no sale con trackCustom");

      // El cableado: cada ruta manda por emitirEventoMeta con el id de ids.ts y deja el espejo en su respuesta.
      const rutas: Array<[string, RegExp[]]> = [
        ["src/app/api/meta/lead/route.ts", [/eventId: await idLead\(email\),/, /return conEspejo\(NextResponse\.json\(\{ ok: true \}\), \[emision\.espejo\], request\);/]],
        ["src/app/api/lo-que-sigue/pack/route.ts", [/evento: EVENTOS_META\.lead,\s*eventId: await idLead\(email\),/, /return conEspejo\(NextResponse\.json\(\{ url: [^;]*\[lead\.espejo\], request\);/]],
        // ⚠ ACTA (22-oct-2026, decisión de Fabrizio) · el «cuándo» ya no es CompleteRegistration: es IntencionCompra (propio), y CompleteRegistration
        // sale al crear la cuenta (o acá, si nació sin él). Los dos espejos van en la misma respuesta (tier REGISTRO-META).
        ["src/app/api/lo-que-sigue/perfil/route.ts", [/const ic = await emitirIntencionCompra\(admin, user, cambios\.horizonte_compra, ctx\);/, /return conEspejo\(NextResponse\.json\(\{ ok: true \}\), \[reg\?\.espejo, ic\?\.espejo\], request\);/]],
        ["src/app/api/perfil-busqueda/route.ts", [/const ic = await emitirIntencionCompra\(admin, user, cuando, ctx\);/, /return conEspejo\(NextResponse\.json\(\{ ok: true \}\), \[reg\?\.espejo, ic\?\.espejo\], request\);/]],
        // ⚠ ACTA (16-oct-2026, goal «la puerta B») · el origen puede ser el sintético (sin informe): sin semanal, siempre hay
        // informe de origen, así que el id es el del informe.
        // ⚠ ACTA (23-oct-2026, goal Explorar) · desde el mapa el id es por aviso y «explorar» (no hay selección ni informe de origen).
        ["src/app/api/lo-que-sigue/guia/analizar/route.ts", [/eventId: idAnalizarEste\(b\.avisoId, desdeExplorar \? "explorar" : desdeRespaldo \? "respaldo" : desdeSemanal \? b\.semanal! : origen\.analysisId!\),/, /espejoAE = ae\.espejo;/, /return salir\(NextResponse\.json\(\{ id: r\.id, estado: r\.estado \}\)\);/]],
        // ⚠ ACTA (28-oct-2026, Explorar como portal) · desde Explorar (sin token) el id lleva «explorar», como en renta larga.
        ["src/app/api/semanal/analizar-str/route.ts", [/eventId: idAnalizarEste\(avisoId, desdeExplorar \? "explorar" : b\.token!\),/, /espejoAE = ae\.espejo;/, /return salir\(NextResponse\.json\(\{ id: r\.id, estado: r\.estado \}\)\);/]],
        // ⚠ ACTA (19-oct-2026) · la respuesta buena suma la fecha y el asunto del toque repetido (GUIA-BUSQUEDA §15 fija la
        // línea entera); acá basta que salga por `salir`, con el espejo.
        ["src/app/api/lo-que-sigue/quiero-verlo/route.ts", [/eventId: idQuieroVerlo\(analysisId\),/, /espejoQV = qv\.espejo;/, /return salir\(NextResponse\.json\(\{ ok: true, ya: r === "ya-enviado", correo: user\.email \?\? null[ ,]/]],
        ["src/app/api/semanal/clic/route.ts", [/eventId: idSemanalClic\(t, avisoId \?\? destino\),/, /espejoSC = sc\.espejo;/, /const volver = \(ruta: string\) => conEspejo\(NextResponse\.redirect\(/]],
        ["src/app/api/payments/confirm/route.ts", [/evento: EVENTOS_META\.compra,\s*eventId: idCompra\(payment\.commerce_order\),/]],
        ["src/lib/subscriptions/subscribe-event.ts", [/for \(const evento of \[EVENTOS_META\.compra, EVENTOS_META\.suscripcion\]\) \{\s*const e = await emitirEventoMeta\(supabase, \{\s*evento,\s*eventId: idCompraPlan\(subId\),/]],
        ["src/lib/meta/vista-informe.ts", [/evento: EVENTOS_META\.vistaInforme,\s*eventId: idVistaInforme\(p\.analysisId\),/, /return e\.espejo;/]],
        ["src/app/api/payments/status/route.ts", [/return \{ evento: EVENTOS_META\.compra, eventId: idCompra\(f\.commerce_order\),/]],
      ];
      for (const [f, res2] of rutas) {
        const s = sinComentarios(leer(f));
        for (const re of res2) if (!re.test(s)) F(`1 · ${f}: no manda con el id de ids.ts o no deja el espejo (${re.source.slice(0, 60)}…)`);
      }
      // El navegador repite y no inventa: el retorno del pago repite el espejo; el alta de un plan, el id del servidor.
      const retorno = sinComentarios(leer("src/app/payments/return/page.tsx"));
      if (!/espejarMeta\(data\.metaCompra \? \[data\.metaCompra as EventoEspejo\] : \[\]\);/.test(retorno) || /metaTrack\(\s*['"]Purchase['"]/.test(retorno)) F("1 · /payments/return arma su propio Purchase en vez de repetir el del servidor");
      if (!/metaTrack\(evento, Number\.isFinite\(value\) \? \{ value, currency: "CLP" \} : undefined, idCompraPlan\(sub\)\);/.test(retorno)) F("1 · el alta de un plan no repite Purchase y Subscribe con el id del servidor");
      for (const f of ["src/app/analisis/[id]/results-client.tsx", "src/app/analisis/renta-corta/[id]/results-client.tsx"]) {
        if (!/if \(metaVista\) espejarMeta\(\[metaVista\]\);/.test(sinComentarios(leer(f)))) F(`1 · ${f} no repite el ViewContent del servidor`);
      }
      for (const [f, re] of [["src/app/analisis/[id]/informe-ltr.tsx", /const metaVista = quienMira\s*\? await emitirVistaInforme\(/], ["src/app/analisis/renta-corta/[id]/informe-str.tsx", /const metaVista = quienMira\s*\? await emitirVistaInforme\(/]] as const) {
        if (!re.test(sinComentarios(leer(f)))) F(`1 · ${f}: el ViewContent no sale solo para el dueño (quienMira)`);
      }
      // Ninguna superficie del navegador dispara estos eventos con un id propio: solo el espejo.
      const { execSync } = await import("node:child_process");
      const archivos = execSync("git ls-files src", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx)$/.test(f));
      const prohibidos = /metaTrack(Custom)?\(\s*["'`](Lead|CompleteRegistration|ViewContent|AnalizarEste|QuieroVerlo|SemanalClic)["'`]/;
      const sueltos = archivos.filter((f) => prohibidos.test(sinComentarios(leer(f))));
      if (sueltos.length) F(`1 · el navegador dispara un evento del servidor con un id propio: ${sueltos.join(", ")}`);
      const fbqDirecto = archivos.filter((f) => !["src/lib/meta/pixel.ts", "src/components/analytics/MetaPixel.tsx"].includes(f) && /\bfbq\(/.test(sinComentarios(leer(f))));
      if (fbqDirecto.length) F(`1 · alguien llama a fbq sin la cola: ${fbqDirecto.join(", ")}`);
      const capiSuelto = archivos.filter((f) => !["src/lib/meta/servidor.ts", "src/lib/meta/capi.ts"].includes(f) && /sendMetaCapiEvent\(/.test(sinComentarios(leer(f))));
      if (capiSuelto.length) F(`1 · alguien manda a la API de conversiones sin emitirEventoMeta (sin marca, sin filtro de prueba): ${capiSuelto.join(", ")}`);
    }

    // ── 2 · LA COLA DEL PIXEL ──────────────────────────────────────────────────
    {
      const nav = navegador();
      metaTrack("Purchase", { value: 9990, currency: "CLP" }, "franco-o1");
      metaTrackCustom("AnalizarEste", { aviso_id: "a" }, "ae-1");
      if (colaMeta().length !== 2 || nav.llamadas.length) F("2 · un evento antes de que el pixel cargue no queda guardado en la cola");
      // La página navega: la cola vive en sessionStorage, no en memoria.
      const guardada = (nav.w.sessionStorage as Storage).getItem(CLAVE_COLA);
      if (!guardada || JSON.parse(guardada).length !== 2) F("2 · la cola no sobrevive a una navegación (no está en sessionStorage)");
      // El stub del snippet todavía no opera: la cola espera.
      nav.conPixel(false);
      if (vaciarColaMeta() !== 0 || nav.llamadas.length || colaMeta().length !== 2) F("2 · la cola se entrega al stub del snippet antes de que fbevents.js opere (se puede perder)");
      nav.conPixel(true);
      const n = vaciarColaMeta();
      const sal = nav.llamadas.map((l) => `${l.comando}:${l.evento}:${l.eventID}`).join();
      if (n !== 2 || sal !== "track:Purchase:franco-o1,trackCustom:AnalizarEste:ae-1" || colaMeta().length) F(`2 · cuando el pixel opera la cola no sale entera, en orden y con sus ids (${sal})`);
      metaTrack("Purchase", { value: 9990, currency: "CLP" }, "franco-o1");
      if (nav.llamadas.length !== 2) F("2 · el mismo evento (mismo id) sale dos veces desde la cola");
      // Lo que esperó demasiado ya no describe lo que pasó.
      const nav2 = navegador();
      (nav2.w.sessionStorage as Storage).setItem(CLAVE_COLA, JSON.stringify([{ comando: "track", evento: "Lead", eventId: "viejo", t: Date.now() - VIDA_COLA_MS - 1 }]));
      nav2.conPixel(true);
      if (vaciarColaMeta() !== 0) F("2 · un evento vencido sale igual");
      // PageView no se guarda: describe la página de ahora.
      const nav3 = navegador();
      metaTrack("PageView");
      if (colaMeta().length) F("2 · PageView entra a la cola (saldría con la página equivocada)");
      void nav3;
      // El componente: mira la cola y el espejo desde la primera carga, y vacía al cargar y en cada navegación.
      const px = sinComentarios(leer("src/components/analytics/MetaPixel.tsx"));
      if (!/const mirar = \(\) => \{\s*espejarMeta\(consumirCookieEspejo\(\)\);\s*vaciarColaMeta\(\);\s*\};\s*mirar\(\);\s*const id = setInterval\(mirar, CADA_MS\);/.test(px)) F("2 · MetaPixel no mira la cola y el espejo cada poco rato desde la primera carga");
      if (!/if \(!PIXEL_ID \|\| !listo\) return;\s*vaciarColaMeta\(\);\s*\}, \[listo, pathname\]\);/.test(px)) F("2 · MetaPixel no vacía la cola al cargar el pixel y en cada navegación");
      // El fbclid queda en _fbc en la llegada, con el formato del pixel, aunque el pixel no cargue.
      const c = cookiesDeLlegada({ search: "?fbclid=IwAR1abcDEF_ghi-123&utm_source=ig", host: "refranco.ai", fbcActual: null, ahoraMs: 1000 });
      if (c.fbc?.valor !== fbcDeFbclid("IwAR1abcDEF_ghi-123", 1000) || c.fbc.valor !== "fb.1.1000.IwAR1abcDEF_ghi-123" || c.fbc.dominio !== ".refranco.ai") F("2 · el fbclid de la llegada no queda en _fbc con el formato del pixel");
      if (cookiesDeLlegada({ search: "?fbclid=IwAR1abcDEF_ghi-123", host: "refranco.ai", fbcActual: "fb.1.5.IwAR1abcDEF_ghi-123", ahoraMs: 9 }).fbc) F("2 · el mismo clic pisa el _fbc que ya estaba");
      if (cookiesDeLlegada({ search: "?fbclid=<script>", host: "refranco.ai", fbcActual: null, ahoraMs: 9 }).fbc) F("2 · un fbclid con forma rara entra a la cookie");
      // ACTA 20-oct-2026 (VISTA-ENTRADA): la respuesta de la landing además pasa por `conVista` —la vista del servidor y su id
      // en `Server-Timing`—, y el pedido es `req` (el mismo, salvo en /i/, que lleva el id de la visita en una cabecera). La
      // regla no cambia: en la landing el middleware responde con `conMedicion` sobre la respuesta de siempre.
      const mw = sinComentarios(leer("src/middleware.ts"));
      if (!/matcher: \["\/", /.test(mw) || !/if \(c\.fbc && conPermiso\(consentimientoDeCookie\(request\.headers\.get\("cookie"\)\)\)\) res\.cookies\.set\(COOKIE_FBC, c\.fbc\.valor,/.test(mw) || !/if \(SOLO_MEDICION\.has\(req\.nextUrl\.pathname\)\) return conVista\(req, conMedicion\(req, NextResponse\.next\(\)\), event, visita\);/.test(mw)) F("2 · el middleware no guarda el clic del anuncio en la llegada a la landing");
    }

    // ── 3 · LAS CUENTAS DE PRUEBA, FUERA ──────────────────────────────────────
    {
      const { sb, eventos } = baseFalsa((p) => p.p_user_id === "prueba" || p.p_email === "qa@franco.cl");
      envios.length = 0;
      const a = await emitirEventoMeta(sb, { evento: EVENTOS_META.compra, eventId: "franco-t1", userId: "prueba", valor: 9990, contexto: NAVEGADOR });
      const b = await emitirEventoMeta(sb, { evento: EVENTOS_META.lead, eventId: await idLead("qa@franco.cl"), email: "qa@franco.cl", contexto: NAVEGADOR });
      const c = await emitirEventoMeta(sb, { evento: EVENTOS_META.registro, eventId: "reg-x", userId: "x", email: "fabriziosciaraffia@gmail.com", contexto: NAVEGADOR });
      await Promise.all([a.envio, b.envio, c.envio]);
      if (envios.length || a.espejo || b.espejo || c.espejo) F("3 · una cuenta de prueba (por id, por correo o el admin) llega a Meta o al pixel");
      if (![...eventos.values()].every((r) => r.estado === "omitido_cuenta_prueba")) F("3 · lo omitido no queda anotado como «omitido_cuenta_prueba»");
      // El modo prueba: sale con el código, no cuenta en producción y el pixel no lo repite.
      process.env.META_TEST_EVENT_CODE = "TEST123";
      const { sb: sbp } = baseFalsa(() => true);
      envios.length = 0;
      const p = await emitirEventoMeta(sbp, { evento: EVENTOS_META.lead, eventId: "lead-p", email: "qa@franco.cl", contexto: { ...NAVEGADOR, prueba: true } });
      await p.envio;
      if (envios[0]?.testEventCode !== "TEST123" || p.espejo) F("3 · en modo prueba el evento no sale con el código de prueba (o el pixel lo repite)");
      delete process.env.META_TEST_EVENT_CODE;
      envios.length = 0;
      const sinCodigo = await emitirEventoMeta(baseFalsa().sb, { evento: EVENTOS_META.lead, eventId: "lead-q", email: "x@y.cl", contexto: { ...NAVEGADOR, prueba: true } });
      if (sinCodigo.estado !== "prueba_sin_codigo" || envios.length) F("3 · en modo prueba sin código el evento sale igual (ensuciaría producción)");
      // La API de conversiones manda el código en el cuerpo.
      process.env.META_TRACKING_ENABLED = "true"; process.env.META_CAPI_TOKEN = "tk"; process.env.NEXT_PUBLIC_META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "123";
      fetchs.length = 0;
      const { sendMetaCapiEvent } = await import("../../../src/lib/meta/capi");
      await sendMetaCapiEvent({ eventName: "Lead", eventId: "l", email: "a@b.cl", testEventCode: "TEST9", externalId: "u1" });
      const cuerpo = JSON.parse(fetchs[0]?.body || "{}") as { test_event_code?: string; data?: Array<{ user_data?: { external_id?: string[] } }> };
      if (cuerpo.test_event_code !== "TEST9" || !/^[0-9a-f]{64}$/.test(cuerpo.data?.[0]?.user_data?.external_id?.[0] ?? "")) F("3 · la API de conversiones no lleva el código de prueba (o el id externo hasheado)");
      delete process.env.META_TRACKING_ENABLED; delete process.env.META_CAPI_TOKEN;
      // El navegador de una cuenta de prueba: la cola no recibe nada y el pixel no carga.
      const nav = navegador();
      marcarCuentaDePrueba(true);
      metaTrack("Purchase", { value: 1 }, "franco-z");
      nav.conPixel(true);
      if ((nav.w.localStorage as Storage).getItem(CLAVE_CUENTA_PRUEBA) !== "1" || colaMeta().length || vaciarColaMeta() || nav.llamadas.length) F("3 · el navegador de una cuenta de prueba manda eventos al pixel");
      const px = sinComentarios(leer("src/components/analytics/MetaPixel.tsx"));
      // ⚠ ACTA (19-oct-2026) · la condición es ahora `pixelPermitido`: el consentimiento Y no ser cuenta de prueba.
      if (!/return cuandoLaPaginaEsteQuieta\(\(\) => \{\s*if \(!pixelPermitido\(leerConsentimiento\(\), esCuentaDePruebaNavegador\(\)\)\) return;/.test(px)) F("3 · el pixel carga para una cuenta de prueba");
      if (!/marcarCuentaDePrueba\(esTest\);/.test(sinComentarios(leer("src/hooks/useAttributionSync.ts")))) F("3 · el navegador no queda marcado como de cuenta de prueba al entrar");
      if (!/if \(await esCuentaDePrueba\(admin, typeof f\.user_id === "string" \? f\.user_id : null\)\) return null;/.test(sinComentarios(leer("src/app/api/payments/status/route.ts")))) F("3 · el retorno del pago le pasa la compra de una cuenta de prueba al pixel");
      // El modo prueba se prende y se apaga en la llegada.
      if (cookiesDeLlegada({ search: "?meta_prueba=1", host: null, fbcActual: null, ahoraMs: 0 }).prueba !== "prender" || cookiesDeLlegada({ search: "?meta_prueba=0", host: null, fbcActual: null, ahoraMs: 0 }).prueba !== "apagar") F("3 · el modo prueba no se prende ni se apaga con ?meta_prueba");
      const ctx = contextoDeRequest(new Request("https://refranco.ai/x", { headers: { cookie: "franco_meta_prueba=1; _fbp=fb.1.1.2; _fbc=fb.1.2.c", "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "UA" } }));
      if (!ctx.prueba || ctx.fbp !== "fb.1.1.2" || ctx.fbc !== "fb.1.2.c" || ctx.ip !== "1.2.3.4" || ctx.ua !== "UA") F("3 · el contexto del request no lee el modo prueba, las cookies del pixel o la IP");
    }

    // ── 4 · LA ATRIBUCIÓN POR PUERTA ─────────────────────────────────────────
    {
      const casos: Array<[Puerta | null, Puerta | null, Puerta | null]> = [[null, "A", "A"], ["D", "A", "A"], ["D", "C", "C"], ["A", "D", "A"], ["A", "C", "A"], ["C", "B", "C"], ["D", "D", "D"], ["B", null, "B"], [null, null, null]];
      for (const [actual, nueva, esperada] of casos) if (fusionarPuerta(actual, nueva) !== esperada) F(`4 · la regla de la puerta: ${actual} + ${nueva} debería quedar ${esperada} y queda ${fusionarPuerta(actual, nueva)}`);
      // La RPC aplica la misma regla.
      const mig = leer("supabase/migrations/20261015_medicion_campana.sql");
      const regla = /when excluded\.puerta is not null and \(ua\.puerta is null or \(ua\.puerta = 'D' and excluded\.puerta <> 'D'\)\) then excluded\.puerta\s*\n\s*else ua\.puerta end,/;
      if (!regla.test(mig) || !/check \(puerta is null or puerta in \('A', 'B', 'C', 'D'\)\)/.test(mig)) F("4 · la RPC no aplica la regla de la puerta (la primera gana, D cede)");
      // La llegada por un enlace que le pasaron es C.
      if (puertaDeLlegada({ pathname: "/", search: "?ref=fsm" })?.puerta !== "C" || puertaDeLlegada({ pathname: "/share/comparativa/abc", search: "" })?.puerta !== "C" || puertaDeLlegada({ pathname: "/", search: "?utm_source=ig" })) F("4 · un referido (?ref= o un enlace compartido) no marca la puerta C (o lo orgánico la marca)");
      // La candidata del navegador sigue la misma regla, y sin candidata se sincroniza D.
      navegador();
      if (puertaParaSincronizar().puerta !== "D") F("4 · sin puerta candidata el navegador no manda D");
      marcarPuertaCandidata("D", "x"); marcarPuertaCandidata("A", "banner"); marcarPuertaCandidata("C", "ref");
      if (leerPuertaCandidata()?.puerta !== "A" || leerPuertaCandidata()?.detalle !== "banner" || puertaParaSincronizar().puerta !== "A") F("4 · la candidata del navegador no sigue la regla (la primera gana, D cede)");
      if (sanearAtribucion({ puerta: "Z" }).puerta !== null || sanearAtribucion({ puerta: "B", puerta_detalle: "seleccion" }).puerta !== "B") F("4 · el servidor acepta una puerta que no es A, B, C o D");
      // Cada lugar donde se deja el correo marca su puerta; el servidor la fija donde la sabe.
      const lugares: Array<[string, RegExp, string]> = [
        ["src/components/lo-que-sigue/RegistroUnPaso.tsx", /marcarPuertaCandidata\("A", "banner"\);\s*void avisarLead\(c, "banner", "A"\);/, "el banner no marca la puerta A ni manda el Lead"],
        ["src/components/lo-que-sigue/RegistroUnPaso.tsx", /reclamarAnalisisAnonimos\(posthog, "register", \{ porCodigo: true, puerta: \{ puerta: "A", detalle: "banner" \} \}\);/, "el reclamo del banner no fija la puerta A"],
        ["src/components/lo-que-sigue/TicketPack.tsx", /marcarPuertaCandidata\("A", "ticket"\);/, "el ticket no marca la puerta A"],
        ["src/components/guia/RegistroEnTarjeta.tsx", /puerta: \{ puerta: "A", detalle: "guia" \}/, "la tarjeta de la guía no fija la puerta A"],
        ["src/components/chrome/HeaderFranco.tsx", /if \(modo === "compartido"\) marcarPuertaCandidata\("C", "informe_compartido"\);/, "el informe compartido no marca la puerta C"],
        ["src/app/api/lo-que-sigue/pack/route.ts", /guardarAtribucion\(admin, user\.id, \{ puerta: "A", puerta_detalle: "ticket", fbp: contexto\.fbp, fbc: contexto\.fbc \}\)/, "la cuenta del ticket no queda con la puerta A"],
        ["src/app/api/analisis/claim/route.ts", /if \(esPuerta\(puerta\)\) \{[\s\S]{0,200}guardarAtribucion\(createAdminServiceClient\(\), user\.id, \{ puerta, puerta_detalle: detalle \}\)/, "el reclamo no guarda la puerta que trae"],
        ["src/hooks/useAttributionSync.ts", /\.\.\.puertaParaSincronizar\(\),/, "la sincronización no manda la puerta"],
        ["src/hooks/useAttributionSync.ts", /if \(llegada\) marcarPuertaCandidata\(llegada\.puerta, llegada\.detalle\);/, "la llegada por un referido no marca la candidata"],
        ["src/lib/attribution.ts", /p_puerta: datos\.puerta \?\? null,\s*p_puerta_detalle: datos\.puerta_detalle \?\? null,/, "la RPC no recibe la puerta"],
      ];
      for (const [f, re, m] of lugares) if (!re.test(sinComentarios(leer(f)))) F(`4 · ${m} (${f})`);
      // PostHog la sabe: la primera vez, `cuenta_atribuida` con la puerta y la campaña; después, solo $set.
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_prueba";
      fetchs.length = 0;
      let fila: Record<string, unknown> | null = null;
      const sbA = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }) }),
        rpc: async (_fn: string, p: Record<string, unknown>) => {
          const antes = fila?.puerta as Puerta | null ?? null;
          fila = { puerta: fusionarPuerta(antes, (p.p_puerta as Puerta | null) ?? null), puerta_detalle: p.p_puerta_detalle, utm_source: "ig", utm_medium: "paid", utm_campaign: "120259591270350456" };
          return { error: null };
        },
      } as never;
      // ACTA 20-oct-2026 (AGENTE-SERVIDOR): ningún evento del servidor sale sin el agente del navegador de la persona. La
      // atribución se guarda en un pedido de su navegador (el registro, el reclamo): corre dentro de uno, con el
      // `headers()` de Next, y cada evento sale con ese agente.
      const NAV = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
      await requestAsyncStorage.run({ headers: new Headers({ "user-agent": NAV, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" }) } as never, async () => {
        await guardarAtribucion(sbA, "u-p", { puerta: "D", puerta_detalle: "sin_puerta" });
        await guardarAtribucion(sbA, "u-p", { puerta: "A", puerta_detalle: "banner" });
        await guardarAtribucion(sbA, "u-p", { puerta: "C", puerta_detalle: "ref" });
      });
      const ph = fetchs.filter((x) => x.url.includes("/capture/")).map((x) => JSON.parse(x.body) as { event: string; uuid?: string; properties: Record<string, unknown> });
      if (ph.length !== 2 || ph[0].event !== "cuenta_atribuida" || !ph[0].uuid || ph[1].event !== "$set" || (ph[1].properties.$set as Record<string, unknown>)?.puerta !== "A" || (ph[0].properties.$set as Record<string, unknown>)?.canal !== "pagado" || (ph[0].properties.$set as Record<string, unknown>)?.campana !== "120259591270350456") F(`4 · PostHog no recibe la puerta y la campaña (cuenta_atribuida una vez, $set al corregir D): ${ph.map((x) => x.event).join(",")}`);
      if (ph.some((x) => x.properties.$raw_user_agent !== NAV)) F("4 · la atribución sale sin el agente del navegador de la persona (PostHog la marca robot)");
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    }

    // ── 5 · El resto del goal: registro, cron de gasto ──────────────────────
    {
      const ahora = Date.parse("2026-10-15T12:00:00Z");
      if (!esAltaReciente("2026-10-14T12:00:00Z", ahora) || esAltaReciente("2026-08-01T00:00:00Z", ahora) || esAltaReciente(null, ahora)) F("5 · CompleteRegistration no se limita a las altas de los últimos 30 días");
      const perfil = sinComentarios(leer("src/app/api/lo-que-sigue/perfil/route.ts"));
      if (!/if \(user && cambios\.horizonte_compra\) \{/.test(perfil)) F("5 · CompleteRegistration sale sin sesión (sin código validado)");
      if (/CompleteRegistration/.test(sinComentarios(leer("src/app/auth/callback/route.ts"))) || /enviarLeadClaim|"Lead"/.test(sinComentarios(leer("src/lib/anon-claim.ts")))) F("5 · quedan los eventos viejos (CompleteRegistration en el callback, Lead al reclamar)");
      const dias = diasDelRango("2026-07-28", "2026-08-10");
      if (dias?.length !== 14 || dias[0] !== "2026-07-28" || dias[13] !== "2026-08-10" || diasDelRango("2026-08-10", "2026-07-28") || diasDelRango("2026-01-01", "2026-12-31")) F("5 · el relleno del gasto no arma bien el rango (o pasa del tope)");
      if (!/fields: "spend,impressions,clicks,inline_link_clicks,reach,account_currency",/.test(leer("src/lib/meta-ads-cron.ts"))) F("5 · el cron de gasto no pide los clics al enlace");
    }
  } finally {
    globalThis.fetch = guardado.fetch;
    envioMeta.enviar = guardado.enviar;
    for (const k of ["NEXT_PUBLIC_POSTHOG_KEY", "META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE", "NEXT_PUBLIC_META_PIXEL_ID"]) {
      if (guardado.env[k] === undefined) delete process.env[k]; else process.env[k] = guardado.env[k];
    }
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
  }

  if (fallas.length) {
    console.log(`  ✗ MEDICION-META · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — cada evento sale una vez desde el servidor y el pixel lo repite con el mismo id; la cola del pixel guarda lo anterior a la carga y no lo duplica; el fbclid queda en _fbc; las cuentas de prueba no llegan a Meta y el modo prueba usa el código; la puerta sigue la regla y la marca cada lugar donde se deja el correo");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runMedicionMetaTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
