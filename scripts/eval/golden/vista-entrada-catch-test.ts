// ─────────────────────────────────────────────────────────────────────────────
// Tier VISTA-ENTRADA (20-oct-2026, 0 tokens, sin red: el fetch es de mentira) — las páginas de entrada de la campaña se
// miden desde el servidor. PostHog carga en el navegador cuando la página queda quieta (hasta 4 s) y quien rebota antes no
// deja rastro: con tráfico pagado, el escalón que más importa.
//
//   1 · LA VISITA QUE SE VA ANTES DE QUE CARGUE POSTHOG: el middleware de verdad recibe la carga de la landing desde un
//       anuncio (UTM y fbclid) y sin consentimiento; el navegador nunca carga PostHog. Igual queda `landing_viewed` en
//       PostHog, con los UTM, el canal, la presencia del fbclid (sin su valor), el consentimiento, un id de esa visita y
//       sin perfil; y el navegador recibe ese id en `Server-Timing` para arrancar PostHog con el mismo.
//   2 · /deptos igual (`deptos_vista`); /i/CÓDIGO la emite su página (sabe el modo) con el id que le pasa el middleware.
//   3 · NO CUENTAN los robots ni las vistas previas (WhatsApp, Meta, Telegram…) ni el refresco o el prefetch de Next.
//   4 · CON «SI», la persona de su cookie de PostHog y el fbclid con su valor; el modo prueba queda marcado.
//   5 · SIN DEMORAR LA RESPUESTA: con PostHog colgado, el middleware responde igual (waitUntil).
//   6 · EL NAVEGADOR arranca PostHog con el id del servidor, salvo que con «si» ya tenga el suyo guardado.
//   7 · SIN DUPLICAR: ninguna página manda su vista desde el navegador.
//   8 · EL PANEL: el embudo pagado contra orgánico arranca en la vista del servidor y mide el rebote antes de cargar.
//
// ACTA DE MUTACIONES: en el cuerpo de cada sección.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/vista-entrada-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../../../src/middleware";
import {
  CABECERA_VISITA, datosDeLlegada, esRobot, idDeServerTiming, NOMBRE_SERVER_TIMING, paginaDeEntrada, serverTimingDeVisita,
} from "../../../src/lib/vista-entrada";
import { bootstrapDeLaVisita } from "../../../src/lib/posthog-cliente";
import { canalDeUtm } from "../../../src/lib/attribution";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const KEY = "phc_prueba_vista";
const HOST = "https://ph.test";

interface Captura { event: string; distinct_id: string; uuid?: string; properties: Record<string, unknown> }

/** Una visita por el middleware de verdad, con un PostHog de mentira. Devuelve lo que llegó a PostHog y la respuesta. */
async function visitar(url: string, cabeceras: Record<string, string>, o: { colgado?: boolean } = {}) {
  const capturas: Captura[] = [];
  const pendientes: Promise<unknown>[] = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (u: unknown, init?: { body?: unknown }) => {
    const s = String(u);
    if (s.startsWith(HOST)) {
      capturas.push(JSON.parse(String(init?.body)) as Captura);
      if (o.colgado) return new Promise<Response>(() => {});
      return new Response("{}", { status: 200 });
    }
    return new Response(JSON.stringify({ error: "sin red en el tier" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const req = new NextRequest(url, { headers: cabeceras });
    const res = await middleware(req, { waitUntil: (p: Promise<unknown>) => { pendientes.push(p); } } as never);
    if (!o.colgado) await Promise.all(pendientes);
    return { capturas, res, pendientes };
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

export async function runVistaEntradaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER VISTA-ENTRADA (la landing, /deptos e /i/ se miden desde el servidor: quien rebota antes de que cargue PostHog cuenta · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const env = { key: process.env.NEXT_PUBLIC_POSTHOG_KEY, host: process.env.NEXT_PUBLIC_POSTHOG_HOST };
  process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = HOST;
  try {
    // ── 1 · LA VISITA QUE SE VA ANTES DE QUE CARGUE POSTHOG ──
    // Mutaciones: V1 el middleware no la emite · V2 sin los UTM · V3 sin el canal · V4 el fbclid sin consentimiento · V5 sin
    // la presencia del fbclid · V6 sin consentimiento usa la cookie de PostHog · V7 crea perfil · V8 sin Server-Timing · V9
    // el Server-Timing con otro id que el del evento.
    {
      const { capturas, res } = await visitar("https://refranco.ai/?utm_source=ig&utm_medium=paid&utm_campaign=lanzamiento&utm_content=reel1&fbclid=IwAR0abc", {
        "user-agent": IPHONE, "sec-fetch-dest": "document", cookie: `ph_${KEY}_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "id-de-otra-visita" }))}`,
        referer: "https://l.instagram.com/",
      });
      const ev = capturas.find((c) => c.event === "landing_viewed");
      if (capturas.length !== 1 || !ev) F(`1 · una visita a la landing que se va antes de que cargue PostHog no deja landing_viewed (${capturas.length} eventos: ${capturas.map((c) => c.event).join(", ")})`);
      else {
        const p = ev.properties;
        if (p.utm_source !== "ig" || p.utm_medium !== "paid" || p.utm_campaign !== "lanzamiento" || p.utm_content !== "reel1") F("1 · la vista no lleva los UTM del anuncio");
        if (p.canal !== "pagado") F(`1 · la vista del anuncio no es «pagado»: ${p.canal}`);
        if (p.con_fbclid !== true) F("1 · la vista no dice que vino con fbclid");
        if ("fbclid" in p) F("1 · sin consentimiento la vista manda el valor del fbclid");
        if (!/^visita:[0-9a-f-]{36}$/.test(ev.distinct_id) || ev.uuid !== ev.distinct_id.slice(7)) F(`1 · sin consentimiento la vista no usa un id de esa visita: ${ev.distinct_id}`);
        if (p.$process_person_profile !== false) F("1 · sin consentimiento la vista crea un perfil de persona");
        if (p.consentimiento !== "no" || p.origen !== "servidor" || p.pagina !== "landing" || p.prueba !== false || p.$pathname !== "/") F("1 · la vista no dice su consentimiento, su origen, su página, si es de prueba o su ruta");
        if (p.referente !== "l.instagram.com") F(`1 · la vista no dice quién la refirió: ${p.referente}`);
        if ("$ip" in p || p.$geoip_disable !== true) F("1 · la vista manda la IP o la geografía");
        const st = res.headers.get("server-timing") ?? "";
        const id = idDeServerTiming(st.split(",").map((x) => { const m = /^\s*([^;]+);desc="([^"]*)"/.exec(x); return m ? { name: m[1], description: m[2] } : { name: "", description: "" }; }));
        if (!st.includes(`${NOMBRE_SERVER_TIMING};desc=`)) F("1 · el navegador no recibe el id de la visita (Server-Timing)");
        else if (id !== ev.distinct_id) F(`1 · el navegador recibe otro id que el de la vista (${id} ≠ ${ev.distinct_id}): la vista y lo que sigue no serían de la misma persona`);
      }
    }

    // ── 2 · /deptos, Y /i/ CON SU PÁGINA ──
    // Mutaciones: V10 /deptos no la emite · V11 el middleware emite también la de /i/ (doble) · V12 /i/ sin el id para la
    // página · V13 la página de /i/ no usa el id del middleware.
    {
      const d = await visitar("https://refranco.ai/deptos?comuna=%C3%91u%C3%B1oa", { "user-agent": IPHONE, "sec-fetch-dest": "document" });
      const ev = d.capturas.find((c) => c.event === "deptos_vista");
      if (d.capturas.length !== 1 || !ev) F(`2 · una visita a /deptos no deja deptos_vista (${d.capturas.map((c) => c.event).join(", ") || "nada"})`);
      else if (ev.properties.pagina !== "deptos" || ev.properties.canal !== "organico" || ev.properties.con_fbclid !== false) F("2 · la vista de /deptos no dice su página o su canal");
      const i = await visitar("https://refranco.ai/i/K7M2QX?utm_source=whatsapp", { "user-agent": IPHONE, "sec-fetch-dest": "document" });
      if (i.capturas.length !== 0) F("2 · el middleware también emite la vista de /i/ (la emite su página: contaría dos veces)");
      const reenviada = i.res.headers.get(`x-middleware-request-${CABECERA_VISITA}`);
      const st = i.res.headers.get("server-timing") ?? "";
      if (!reenviada || !st.includes(`desc="visita:${reenviada}"`)) F("2 · /i/ no recibe el id de la visita (o no es el mismo que el del navegador)");
      const pag = sinComentarios(leer("src/app/i/[codigo]/page.tsx"));
      if (!/visita: visitaDeCabecera\(cabeceras\.get\(CABECERA_VISITA\)\) \?\? crypto\.randomUUID\(\),/.test(pag) || !/search: consultaDeParametros\(searchParams\),/.test(pag)) F("2 · la página de /i/ no usa el id del middleware o no manda los UTM");
      if (paginaDeEntrada("/") !== "landing" || paginaDeEntrada("/deptos") !== "deptos" || paginaDeEntrada("/i/ABC") !== "invitacion" || paginaDeEntrada("/pricing") !== null) F("2 · las páginas de entrada no son la landing, /deptos e /i/");
    }

    // ── 3 · ROBOTS Y LO QUE NO ES UNA CARGA ──
    // Mutaciones: V14 los robots cuentan · V15 el refresco o el prefetch de Next cuentan.
    {
      for (const ua of ["WhatsApp/2.24.20.79 A", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"]) {
        const r = await visitar("https://refranco.ai/?utm_source=ig&utm_medium=paid", { "user-agent": ua });
        if (r.capturas.length) F(`3 · una vista previa o un robot (${ua.slice(0, 30)}) cuenta como visita`);
      }
      if (esRobot("Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")) F("3 · un teléfono CUBOT cuenta como robot");
      for (const [n, h] of [["el refresco de Next", { rsc: "1" }], ["un prefetch", { "next-router-prefetch": "1", rsc: "1" }], ["un fetch de la página", { "sec-fetch-dest": "empty" }]] as const) {
        const r = await visitar("https://refranco.ai/", { "user-agent": IPHONE, ...h });
        if (r.capturas.length) F(`3 · ${n} cuenta como otra visita`);
      }
    }

    // ── 4 · CON «SI», Y EL MODO PRUEBA ──
    // Mutaciones: V16 con «si» no usa la persona de su cookie · V17 con «si» sin el valor del fbclid · V18 el modo prueba no
    // se marca.
    {
      const r = await visitar("https://refranco.ai/?utm_source=fb&fbclid=IwAR0xyz", {
        "user-agent": IPHONE, "sec-fetch-dest": "document", cookie: `franco_consentimiento=si; ph_${KEY}_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "persona-de-este-navegador" }))}`,
      });
      const ev = r.capturas[0];
      if (!ev || ev.distinct_id !== "persona-de-este-navegador" || ev.properties.$process_person_profile !== true || ev.properties.consentimiento !== "si") F("4 · con «si» la vista no cae en la persona de su navegador");
      else if (ev.properties.fbclid !== "IwAR0xyz") F("4 · con «si» la vista no lleva el fbclid");
      const q = await visitar("https://refranco.ai/?meta_prueba=1", { "user-agent": IPHONE, "sec-fetch-dest": "document" });
      if (q.capturas[0]?.properties.prueba !== true) F("4 · una visita en modo prueba no queda marcada (el panel no la podría sacar)");
    }

    // ── 5 · SIN DEMORAR LA RESPUESTA ──
    // Mutación: V19 el middleware espera a PostHog.
    {
      const t0 = Date.now();
      const r = await Promise.race([
        visitar("https://refranco.ai/?utm_source=ig&utm_medium=paid", { "user-agent": IPHONE, "sec-fetch-dest": "document" }, { colgado: true }),
        new Promise<null>((ok) => setTimeout(() => ok(null), 1500)),
      ]);
      if (!r) F("5 · con PostHog colgado el middleware no responde: la página espera a la medición");
      else if (r.capturas.length !== 1 || r.pendientes.length !== 1 || Date.now() - t0 > 1500) F("5 · la vista no sale en segundo plano (waitUntil)");
    }

    // ── 6 · EL NAVEGADOR ARRANCA CON EL ID DEL SERVIDOR ──
    // Mutaciones: V20 sin bootstrap · V21 pisa el id guardado con «si» · V22 no lee el Server-Timing.
    {
      const entradas = [{ name: "cdn-cache", description: "HIT" }, { name: NOMBRE_SERVER_TIMING, description: "visita:abc" }];
      const sinPermiso = bootstrapDeLaVisita({ entradas, permiso: false, guardado: true });
      if (sinPermiso?.distinctID !== "visita:abc" || sinPermiso.isIdentifiedID !== false) F("6 · sin consentimiento el navegador no arranca PostHog con el id de la vista");
      if (bootstrapDeLaVisita({ entradas, permiso: true, guardado: true }) !== undefined) F("6 · con «si» y su id guardado, el navegador lo pisa con el de la vista");
      if (bootstrapDeLaVisita({ entradas, permiso: true, guardado: false })?.distinctID !== "visita:abc") F("6 · con «si» y sin id guardado, no arranca con el de la vista");
      if (bootstrapDeLaVisita({ entradas: [], permiso: false, guardado: false }) !== undefined || idDeServerTiming(null) !== null) F("6 · sin Server-Timing inventa un id");
      if (serverTimingDeVisita('vi"sita') !== `${NOMBRE_SERVER_TIMING};desc="visita"`) F("6 · el Server-Timing no escapa el id");
      const cli = sinComentarios(leer("src/lib/posthog-cliente.ts"));
      if (!/const bootstrap = bootstrapDeLaVisita\(\{ entradas: entradasDeLaCarga\(\), permiso: conPermiso\(consentimiento\), guardado: idGuardado\(key\) \}\);\s*ph\.init\(key, \{[\s\S]{0,120}\.\.\.\(bootstrap \? \{ bootstrap \} : \{\}\),/.test(cli) || !/performance\.getEntriesByType\("navigation"\)\[0\]/.test(cli))
        F("6 · el navegador no arranca PostHog con el id de la vista (bootstrap desde Server-Timing)");
    }

    // ── 7 · SIN DUPLICAR: ninguna página manda su vista desde el navegador ──
    // Mutaciones: V23 vuelve LandingViewed · V24 vuelve deptos_vista del navegador · V25 vuelve invitacion_vista del navegador.
    {
      const archivos = readdirSync(join(RAIZ, "src"), { recursive: true, encoding: "utf8" }).filter((f) => /\.(ts|tsx)$/.test(f));
      if (archivos.length < 100) F(`7 · el barrido de src/ no corrió (${archivos.length} archivos)`);
      for (const f of archivos) {
        const s = sinComentarios(leer(join("src", f)));
        if (/capture\(\s*["'`](landing_viewed|deptos_vista|invitacion_vista)["'`]/.test(s) || /capture\(\s*EV\.viewed\b/.test(s)) F(`7 · src/${f.replace(/\\/g, "/")} manda una vista desde el navegador: contaría dos veces`);
      }
      if (/<LandingViewed\b/.test(sinComentarios(leer("src/app/page.tsx")))) F("7 · la landing vuelve a montar LandingViewed");
    }

    // ── 8 · EL PANEL Y LA REGLA DEL CANAL ──
    // Mutaciones: V26 el embudo vuelve al $pageview · V27 sin el rebote antes de cargar · V28 sin sacar las visitas de
    // prueba · V29 el canal con otra regla que la atribución.
    {
      const doc = leer("docs/posthog-activacion-por-puerta.md");
      const sec = doc.slice(doc.indexOf("## El embudo pagado contra orgánico"));
      if (!/where event in \('landing_viewed', 'deptos_vista', 'invitacion_vista'\)[\s\S]{0,120}toString\(properties\.origen\) = 'servidor'/.test(sec) || !/argMin\(toString\(properties\.canal\), timestamp\) as canal/.test(sec))
        F("8 · el embudo pagado contra orgánico no arranca en la vista del servidor");
      if (!/round\(1 - cargaron_la_pagina \/ llegaron, 3\) as rebote_antes_de_cargar/.test(sec) || !/countIf\(event = '\$pageview'\) > 0 as cargo/.test(sec)) F("8 · el embudo no mide el rebote antes de que cargue PostHog");
      if (!/toString\(properties\.prueba\) != 'true'/.test(sec)) F("8 · el embudo cuenta las visitas de prueba");
      for (const [s, m, esperado] of [["ig", null, "pagado"], ["x", "paid", "pagado"], ["google", "organic", "organico"], [null, null, "organico"]] as const) {
        if (datosDeLlegada(`?${s ? `utm_source=${s}` : ""}${m ? `&utm_medium=${m}` : ""}`, null, false).canal !== esperado || canalDeUtm({ utm_source: s, utm_medium: m }) !== esperado) F(`8 · el canal de ${s}/${m} no es ${esperado} con la regla de la atribución`);
      }
      if (!/import \{ canalDeUtm \} from "@\/lib\/canal";/.test(leer("src/lib/attribution.ts")) || !/import \{ canalDeUtm \} from "@\/lib\/canal";/.test(leer("src/lib/vista-entrada.ts"))) F("8 · la regla del canal no es una sola (canal.ts)");
    }
  } catch (e) {
    F(`excepción: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  } finally {
    if (env.key === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY; else process.env.NEXT_PUBLIC_POSTHOG_KEY = env.key;
    if (env.host === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST; else process.env.NEXT_PUBLIC_POSTHOG_HOST = env.host;
  }
  if (fallas.length) {
    console.log(`  ✗ VISTA-ENTRADA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la landing, /deptos e /i/ dejan su vista desde el servidor aunque la persona se vaya antes de que cargue PostHog, con los UTM, el canal y el fbclid; sin robots ni refrescos; sin demorar la respuesta; el navegador sigue con el mismo id; nadie la manda dos veces; el embudo arranca ahí");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runVistaEntradaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
