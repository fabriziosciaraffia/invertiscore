// ============================================================================
// TIER CAMPANA-FASE0 — la medición de la campaña de noviembre antes de gastar en pauta (12-nov-2026, goal de Fabrizio: la verdad
// de la campaña sale de nuestra base, no del panel de Meta). Rojo con:
//   1 · UN REGISTRO SIN ORIGEN CUANDO LLEGÓ CON UTM: la cookie de la primera visita (franco_origen, 30 días, primer toque) guarda
//       los UTM, el fbclid y la página; al registrarse, por las cuatro altas del servidor, la cuenta los recibe (y una cuenta vieja
//       que entra desde un anuncio no). Las inscripciones de Invierte con Franco leen la misma cookie.
//   2 · UN CompleteRegistration O UN Lead SIN fbc CUANDO HUBO fbclid: el contexto del servidor arma el fbc desde el fbclid de la
//       cookie si el navegador no trae `_fbc`, y los dos eventos salen con él, con el correo, el fbp y el external_id, y el mismo
//       event_id que repite el pixel.
//   3 · EL PIXEL ESPERANDO EL CONSENTIMIENTO: carga y recibe sin el «si»; solo lo apaga una cuenta de prueba.
//   4 · UN EVENTO A META DESDE UNA CUENTA DE PRUEBA FUERA DEL CÓDIGO DE PRUEBA: se omite; en modo prueba sale con el código.
//   5 · EL PANEL CONTANDO CUENTAS DE PRUEBA: el panel por conjunto y semana de llegada sale solo de cuentas reales, con el gasto,
//       el costo por registro, el regalo en 24 horas, Invierte con Franco y las compras, y lo mismo a 30 días.
//   6 · /privacy Y EL FAQ dicen lo que hace el código.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base: 0 tokens.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/campana-fase0-catch-test.ts
// ============================================================================
import "./als-de-next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as oc from "../../../src/lib/origen-campana";
import { guardarAtribucion } from "../../../src/lib/attribution";
import { contextoDeRequest, emitirEventoMeta, envioMeta } from "../../../src/lib/meta/servidor";
import { emitirRegistroAlCrear } from "../../../src/lib/meta/registro";
import { idRegistro } from "../../../src/lib/meta/ids";
import { pixelPermitido } from "../../../src/lib/meta/pixel";
import { armarPanelCampana, horaDelClic, leerGasto, lunesDe, SIN_CONJUNTO, type DatosCampana } from "../../../src/lib/admin-campana";
import { getFAQItemsByIds } from "../../../src/lib/faq-data";
import type { MetaCapiEventInput } from "../../../src/lib/meta/capi";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const codigo = (p: string) => leer(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const T0 = Date.UTC(2026, 10, 10, 15, 0, 0); // martes 10-nov-2026, 12:00 en Chile
const FBCLID = "IwAR0campana123XYZ";
const URL_ANUNCIO = `?utm_source=facebook&utm_medium=paid&utm_campaign=noviembre&utm_content=conjunto-a&fbclid=${FBCLID}`;

/** La base: meta_eventos (la marca), meta_contexto, lo que lee el registro y la RPC de cuentas de prueba. */
function baseFalsa(pruebas: ReadonlySet<string> = new Set()) {
  const eventos = new Map<string, Record<string, unknown>>();
  const rpcs: Array<{ nombre: string; args: Record<string, unknown> }> = [];
  const nula = { eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  const sb = {
    async rpc(nombre: string, args: Record<string, unknown>) {
      rpcs.push({ nombre, args });
      if (nombre === "es_cuenta_de_prueba") return { data: pruebas.has(String(args.p_user_id)), error: null };
      return { data: null, error: null };
    },
    from(t: string) {
      if (t === "meta_eventos") return {
        upsert(row: Record<string, unknown>) {
          const k = `${row.evento}|${row.event_id}|${row.prueba}`;
          const nueva = !eventos.has(k);
          if (nueva) eventos.set(k, { ...row });
          return Object.assign(Promise.resolve({ error: null }), { select: () => Promise.resolve({ data: nueva ? [{ id: eventos.size }] : [], error: null }) });
        },
        update() { const b = { eq(): unknown { return Object.assign(Promise.resolve({ error: null }), b); } }; return b; },
      };
      if (t === "meta_contexto") return { upsert: () => Promise.resolve({ error: null }), select: () => nula };
      if (t === "user_attribution" || t === "perfil_busqueda") return { select: () => nula };
      throw new Error(`tabla inesperada: ${t}`);
    },
  };
  return { sb: sb as never, eventos, rpcs };
}

export async function runCampanaFase0Tier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CAMPANA-FASE0 (el origen de cada registro, Meta con fbc y sin esperar el aviso, sin cuentas de prueba, el panel · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const guardado = { enviar: envioMeta.enviar, env: { ...process.env } };
  for (const k of ["META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) delete process.env[k];
  const envios: MetaCapiEventInput[] = [];
  envioMeta.enviar = async (input) => { envios.push(input); return { ok: true, status: 200 }; };
  try {
    // ── 1 · EL ORIGEN DE CADA REGISTRO ──
    {
      const llegada = oc.origenDeLlegada({ pathname: "/explorar", search: URL_ANUNCIO, ahoraMs: T0 });
      if (llegada.utm_source !== "facebook" || llegada.utm_medium !== "paid" || llegada.utm_campaign !== "noviembre" || llegada.utm_content !== "conjunto-a" || llegada.fbclid !== FBCLID || llegada.landing !== "/explorar" || llegada.t !== T0) F(`1 · la llegada no guarda los UTM, el fbclid, la página y la hora (${JSON.stringify(llegada)})`);
      // La cookie va y vuelve: decodificada (Next) y codificada (la cabecera).
      const valor = oc.valorCookieOrigen(llegada);
      if (JSON.stringify(oc.leerCookieOrigen(valor)) !== JSON.stringify(llegada) || JSON.stringify(oc.origenDeCabecera(`otra=1; ${oc.COOKIE_ORIGEN}=${encodeURIComponent(valor)}`)) !== JSON.stringify(llegada)) F("1 · la cookie del origen no vuelve igual (decodificada o desde la cabecera)");
      if (oc.VIDA_ORIGEN_S !== 30 * 24 * 60 * 60) F("1 · la cookie del origen no dura 30 días");
      // Primer toque: no se pisa, salvo que la guardada no traiga campaña y la nueva sí.
      const directa = oc.origenDeLlegada({ pathname: "/", search: "", ahoraMs: T0 - 1000 });
      const otra = oc.origenDeLlegada({ pathname: "/", search: "?utm_source=google&utm_content=b", ahoraMs: T0 + 1000 });
      if (!oc.escribirOrigen(null, directa) || oc.escribirOrigen(llegada, otra) || !oc.escribirOrigen(directa, llegada) || oc.escribirOrigen(directa, directa)) F("1 · la cookie del origen no es de primer toque (o el anuncio no reemplaza a una visita directa)");
      // Basura en la URL no entra.
      const sucia = oc.origenDeLlegada({ pathname: "/", search: "?utm_source=%3Cscript%3E&fbclid=x", ahoraMs: T0 });
      if (sucia.utm_source || sucia.fbclid) F("1 · la cookie guarda valores que no son de una campaña (HTML, un fbclid corto)");
      // A la cuenta: la recién creada recibe el origen; la vieja no.
      const cookie = `${oc.COOKIE_ORIGEN}=${encodeURIComponent(valor)}`;
      const nueva = oc.origenParaLaCuenta(cookie, new Date(T0 + 5 * 60_000).toISOString(), T0 + 10 * 60_000);
      if (nueva.utm_content !== "conjunto-a" || nueva.utm_source !== "facebook" || nueva.landing_path !== "/explorar" || nueva.fbc !== `fb.1.${T0}.${FBCLID}`) F(`1 · la cuenta recién creada no recibe el origen (${JSON.stringify(nueva)})`);
      if (Object.keys(oc.origenParaLaCuenta(cookie, new Date(T0 - 3 * 24 * 3600_000).toISOString(), T0)).length) F("1 · una cuenta vieja que entra desde un anuncio se lleva el origen");
      // guardarAtribucion lleva todo a la RPC (utm_content y fbc incluidos).
      const { sb, rpcs } = baseFalsa();
      await guardarAtribucion(sb, "u1", nueva);
      const a = rpcs.find((r) => r.nombre === "upsert_user_attribution")?.args ?? {};
      if (a.p_utm_content !== "conjunto-a" || a.p_utm_campaign !== "noviembre" || a.p_landing_path !== "/explorar" || a.p_fbc !== `fb.1.${T0}.${FBCLID}`) F(`1 · la escritura de la cuenta no lleva el origen (${JSON.stringify(a)})`);
      // Las cuatro altas del servidor escriben el origen al crear la cuenta.
      const altas: Array<[string, RegExp]> = [
        ["src/lib/deptos/alta-servidor.ts", /const origen = origenParaLaCuenta\(request\.headers\.get\("cookie"\), user\.created_at\);\s*if \(puerta === "B"\) await guardarAtribucion\(admin, user\.id, \{ \.\.\.origen, puerta: "B"[\s\S]{0,200}else if \(puerta === "E"\) await guardarAtribucion\(admin, user\.id, \{ \.\.\.origen, puerta: "E"[\s\S]{0,120}else await guardarAtribucion\(admin, user\.id, origen\);/],
        ["src/app/api/analisis/claim/route.ts", /const origen = origenParaLaCuenta\(request\.headers\.get\("cookie"\), user\.created_at\);[\s\S]{0,250}guardarAtribucion\(createAdminServiceClient\(\), user\.id, \{ \.\.\.origen,/],
        ["src/app/auth/callback/route.ts", /const origen = origenParaLaCuenta\(request\.headers\.get\("cookie"\), user\.created_at\);\s*await guardarAtribucion\(createAdminServiceClient\(\), user\.id, \{\s*\.\.\.origen,/],
        ["src/app/api/lo-que-sigue/pack/route.ts", /const origen = origenParaLaCuenta\(request\.headers\.get\("cookie"\), user\.created_at\);\s*waitUntil\(guardarAtribucion\(admin, user\.id, \{ \.\.\.origen,/],
      ];
      for (const [f, re] of altas) if (!re.test(codigo(f))) F(`1 · ${f} no deja el origen de la campaña en la cuenta al registrarse`);
      // El middleware guarda la cookie en la llegada, de primer toque, y pasa por las puertas.
      const mw = codigo("src/middleware.ts");
      if (!/const llegada = origenDeLlegada\(\{ pathname: request\.nextUrl\.pathname, search: request\.nextUrl\.search, ahoraMs: Date\.now\(\) \}\);\s*if \(escribirOrigen\(leerCookieOrigen\(request\.cookies\.get\(COOKIE_ORIGEN\)\?\.value\), llegada\)\) \{\s*res\.cookies\.set\(COOKIE_ORIGEN, valorCookieOrigen\(llegada\), \{ path: "\/", maxAge: VIDA_ORIGEN_S,/.test(mw)) F("1 · el middleware no guarda el origen de la primera visita");
      const matcher = (/matcher: \[([^\]]*)\]/.exec(mw)?.[1] ?? "");
      for (const r of ['"/"', '"/explorar"', '"/deptos"', '"/i/:path*"', '"/register"', '"/login"', '"/entrar"']) if (!matcher.includes(r)) F(`1 · el middleware no pasa por ${r}: una llegada ahí no guardaría su origen`);
      // Invierte con Franco: el origen de la inscripción sale de la misma cookie, no de lo que mande el navegador.
      const inv = codigo("src/app/api/invierte/route.ts");
      if (!/const origen = origenDeCabecera\(request\.headers\.get\("cookie"\)\);/.test(inv) || /body\?\.utm/.test(inv)) F("1 · la inscripción de Invierte con Franco no lee el origen de la cookie (o acepta el del navegador)");
      if (/utm:/.test(codigo("src/components/invierte/HojaInvierte.tsx"))) F("1 · la hoja de Invierte con Franco sigue mandando un origen propio");
    }

    // ── 2 · CompleteRegistration Y Lead CON fbc CUANDO HUBO fbclid ──
    {
      const valor = encodeURIComponent(oc.valorCookieOrigen(oc.origenDeLlegada({ pathname: "/", search: URL_ANUNCIO, ahoraMs: T0 })));
      const req = new Request("https://refranco.ai/api/deptos/alta", { headers: { cookie: `_fbp=fb.1.9.999; ${oc.COOKIE_ORIGEN}=${valor}`, "user-agent": "Mozilla/5.0", "x-forwarded-for": "200.1.1.1" } });
      const ctx = contextoDeRequest(req);
      if (ctx.fbc !== `fb.1.${T0}.${FBCLID}`) F(`2 · sin \`_fbc\`, el contexto no arma el fbc desde el fbclid (${ctx.fbc})`);
      // CompleteRegistration de una cuenta real, sin el «si» del aviso.
      envios.length = 0;
      const { sb } = baseFalsa();
      const user = { id: "c0ffee00-0000-4000-8000-000000000001", email: "persona@correo.cl", created_at: new Date().toISOString() };
      const reg = await emitirRegistroAlCrear(sb, user, ctx, { origen: "alta", puerta: "E" });
      await reg?.envio;
      const e = envios[0];
      if (!e || e.eventName !== "CompleteRegistration" || e.eventId !== idRegistro(user.id) || e.fbc !== `fb.1.${T0}.${FBCLID}` || e.fbp !== "fb.1.9.999" || e.email !== "persona@correo.cl" || e.externalId !== user.id || e.testEventCode !== null) F(`2 · CompleteRegistration no sale con fbc, fbp, correo, external_id y su id (${JSON.stringify(e ?? null)})`);
      if (!reg?.espejo || reg.espejo.eventId !== idRegistro(user.id)) F("2 · el pixel no recibe el espejo de CompleteRegistration con el mismo event_id (Meta lo contaría dos veces)");
      // El Lead de Invierte con Franco pasa por el mismo camino (emitirEventoMeta con el contexto del pedido).
      const inv = codigo("src/app/api/invierte/route.ts");
      if (!/emitirEventoMeta\(admin, \{\s*evento: EVENTOS_META\.lead,[\s\S]{0,200}userId: user\.id,\s*email: user\.email \?\? null,[\s\S]{0,200}contexto: contextoDeRequest\(request\),/.test(inv)) F("2 · el Lead de Invierte con Franco no sale con el correo, el id y el contexto del pedido (fbc, fbp)");
      envios.length = 0;
      const { sb: sb2 } = baseFalsa();
      const lead = await emitirEventoMeta(sb2, { evento: "Lead", eventId: "inv-c0ffee00-0000-aviso", userId: user.id, email: user.email, contexto: ctx, origen: "lead:invierte" });
      await lead.envio;
      if (envios[0]?.fbc !== `fb.1.${T0}.${FBCLID}` || envios[0]?.email !== user.email || envios[0]?.externalId !== user.id) F("2 · el Lead no sale con el fbc del fbclid, el correo y el external_id");
    }

    // ── 3 · EL PIXEL NO ESPERA EL CONSENTIMIENTO ──
    {
      if (!pixelPermitido(null, false) || !pixelPermitido("no", false) || pixelPermitido("si", true)) F("3 · el pixel espera el consentimiento (o carga en una cuenta de prueba)");
      const px = codigo("src/components/analytics/MetaPixel.tsx");
      if (/conPermiso|leerConsentimiento\(\) === "no"|borrarCookiesMeta/.test(px)) F("3 · el componente del pixel vuelve a mirar el aviso de cookies");
      if (/conPermiso/.test(codigo("src/lib/meta/pixel.ts"))) F("3 · la regla del pixel vuelve a mirar el aviso de cookies");
    }

    // ── 4 · LAS CUENTAS DE PRUEBA NUNCA MANDAN EVENTOS A META (salvo con el código de prueba) ──
    {
      const prueba = "deadbeef-0000-4000-8000-000000000002";
      envios.length = 0;
      const { sb, eventos } = baseFalsa(new Set([prueba]));
      const ctxReal = { ip: "200.1.1.1", ua: "Mozilla/5.0", fbp: "fb.1.1.1", fbc: "fb.1.2.abc", url: "https://refranco.ai/", prueba: false, consentimiento: true };
      const r = await emitirRegistroAlCrear(sb, { id: prueba, email: "qa@refranco.ai", created_at: new Date().toISOString() }, ctxReal, { origen: "alta" });
      await r?.envio;
      if (envios.length || r?.estado !== "omitido_cuenta_prueba" || r?.espejo !== null || Array.from(eventos.values())[0]?.estado !== "omitido_cuenta_prueba") F(`4 · una cuenta de prueba le manda CompleteRegistration a Meta fuera del modo prueba (${r?.estado})`);
      // En modo prueba, sale con el código de prueba y sin espejo (no cuenta como real).
      process.env.META_TEST_EVENT_CODE = "TEST123";
      envios.length = 0;
      const { sb: sb2 } = baseFalsa(new Set([prueba]));
      const p = await emitirRegistroAlCrear(sb2, { id: prueba, email: "qa@refranco.ai", created_at: new Date().toISOString() }, { ...ctxReal, prueba: true }, { origen: "alta" });
      await p?.envio;
      if (envios[0]?.testEventCode !== "TEST123" || p?.espejo !== null) F("4 · en modo prueba el evento no sale con el código de prueba (o deja un espejo que contaría como real)");
      delete process.env.META_TEST_EVENT_CODE;
      // Sin código configurado, el modo prueba no manda nada.
      envios.length = 0;
      const { sb: sb3 } = baseFalsa(new Set([prueba]));
      const q = await emitirRegistroAlCrear(sb3, { id: prueba, email: "qa@refranco.ai", created_at: new Date().toISOString() }, { ...ctxReal, prueba: true }, { origen: "alta" });
      if (envios.length || q?.estado !== "prueba_sin_codigo") F("4 · en modo prueba sin código el evento sale igual");
      if (!/if \(!prueba && \(await esCuentaDePrueba\(admin, e\.userId, e\.email\)\)\) \{/.test(codigo("src/lib/meta/servidor.ts"))) F("4 · emitirEventoMeta no corta las cuentas de prueba antes de enviar");
    }

    // ── 5 · EL PANEL, SOLO CON CUENTAS REALES ──
    {
      const DIA = 24 * 3600_000;
      const iso = (ms: number) => new Date(ms).toISOString();
      const fbcDe = (ms: number) => `fb.1.${ms}.${FBCLID}`;
      const d: DatosCampana = {
        cuentas: [
          { userId: "a1", creadaAt: iso(T0 + 3600_000), utmSource: "facebook", utmCampaign: "nov", utmContent: "conjunto-a", fbc: fbcDe(T0) },
          { userId: "a2", creadaAt: iso(T0 + 2 * DIA), utmSource: "facebook", utmCampaign: "nov", utmContent: "conjunto-a", fbc: fbcDe(T0 + DIA) },
          { userId: "a3", creadaAt: iso(T0 + 3600_000), utmSource: "facebook", utmCampaign: "nov", utmContent: "conjunto-a", fbc: fbcDe(T0) },
          // Llegó por el anuncio el martes 10 y se registró el lunes 16: cuenta en la semana de la LLEGADA (la del 9), no la del 16.
          { userId: "a4", creadaAt: iso(T0 + 6 * DIA + 12 * 3600_000), utmSource: "facebook", utmCampaign: "nov", utmContent: "conjunto-a", fbc: fbcDe(T0) },
          { userId: "qa", creadaAt: iso(T0 + 3600_000), utmSource: "facebook", utmCampaign: "nov", utmContent: "conjunto-a", fbc: fbcDe(T0) },
          { userId: "b1", creadaAt: iso(T0 + 3600_000), utmSource: null, utmCampaign: null, utmContent: null, fbc: null },
        ],
        prueba: new Set(["qa"]),
        regaloGastado: new Set(["a1", "a2", "qa"]),
        analisis: new Map([["a1", [T0 + 2 * 3600_000]], ["a2", [T0 + 2 * DIA + 3 * DIA]], ["qa", [T0 + 2 * 3600_000]]]),
        inscripciones: new Map([["a1", [T0 + 5 * 3600_000]], ["a3", [T0 + 10 * DIA]], ["qa", [T0 + 2 * 3600_000]]]),
        compras: new Map([["a2", [T0 + 2 * DIA + 3600_000, T0 + 20 * DIA]], ["qa", [T0 + 2 * 3600_000]]]),
        gasto: { [`conjunto-a|${lunesDe(T0)}`]: 30000 },
      };
      const filas = armarPanelCampana(d, T0 + 60 * DIA);
      const a = filas.find((f) => f.conjunto === "conjunto-a");
      const sin = filas.find((f) => f.conjunto === SIN_CONJUNTO);
      if (!a || a.registros !== 4 || filas.filter((f) => f.conjunto === "conjunto-a").length !== 1) F(`5 · el panel cuenta cuentas de prueba, pierde reales o no agrupa por la semana de llegada: conjunto-a con ${a?.registros} registros en ${filas.filter((f) => f.conjunto === "conjunto-a").length} semanas, debían ser 4 en una`);
      if (a && (a.semana !== lunesDe(T0) || a.semana !== "2026-11-09" || a.gasto !== 30000 || a.costoPorRegistro !== 7500)) F(`5 · el panel no agrupa por la semana de llegada o no calcula el costo por registro (${JSON.stringify(a)})`);
      if (a && (a.h24.regalo !== 1 || a.h24.invierte !== 1 || a.h24.compras !== 1 || a.h24.regaloPct !== 25)) F(`5 · las primeras 24 horas no cuentan bien regalo, Invierte y compras (${JSON.stringify(a.h24)})`);
      if (a && (a.d30.regalo !== 2 || a.d30.invierte !== 2 || a.d30.compras !== 2 || a.enCurso)) F(`5 · los 30 días no cuentan bien la cohorte (${JSON.stringify(a.d30)}, en curso ${a?.enCurso})`);
      if (!sin || sin.registros !== 1) F("5 · las cuentas sin campaña no quedan aparte");
      if (!armarPanelCampana(d, T0 + 5 * DIA).find((f) => f.conjunto === "conjunto-a")?.enCurso) F("5 · una cohorte de menos de 30 días no queda «en curso»");
      if (horaDelClic(fbcDe(T0)) !== T0 || horaDelClic("fb.1.1794480000.x") !== 1794480000000 || horaDelClic(null) !== null) F("5 · la hora del clic no sale del fbc");
      if (JSON.stringify(leerGasto('{"a|2026-11-09":1000.4,"malo":5,"b|2026-11-09":-3}')) !== '{"a|2026-11-09":1000}') F("5 · el gasto guardado no se sanea");
      // La lectura excluye nada por su cuenta: el filtro de prueba es el de armarPanelCampana, con test_accounts.
      const lib = codigo("src/lib/admin-campana.ts");
      if (!/if \(d\.prueba\.has\(c\.userId\)\) continue;/.test(lib) || !/sb\.from\("test_accounts"\)\.select\("user_id"\)/.test(lib)) F("5 · el panel no saca las cuentas de prueba de test_accounts");
      if (!/armarPanelCampana\(await leerDatosCampana\(sb,/.test(codigo("src/app/admin/campana/page.tsx"))) F("5 · la página del panel no arma las filas con armarPanelCampana");
    }

    // ── 6 · /privacy Y EL FAQ ──
    {
      const faq = getFAQItemsByIds(["datos-seguros"])[0]?.a ?? "";
      // Ninguna oración que hable de Meta (sin PostHog) lo condiciona a aceptar las cookies o a dar permiso.
      const oracionesMeta = faq.split(/(?<=\.)\s+/).filter((o) => /Meta/.test(o) && !/PostHog/.test(o));
      const condicionaMeta = oracionesMeta.some((o) => /acept|permiso|cookies/i.test(o));
      if (!/Meta/.test(faq) || !/correo cifrado/.test(faq) || !/te registras/.test(faq) || !/solo si las aceptas/.test(faq) || /nunca tu correo/.test(faq) || condicionaMeta || !oracionesMeta.some((o) => /correo cifrado/.test(o))) F("6 · el FAQ de datos no dice lo que hace el código (Meta con el correo cifrado al registrarse, sin condición; PostHog con permiso)");
      const priv = leer("src/app/privacy/page.tsx").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      if (!/30 días de dónde llegaste/.test(priv) || !/Su pixel carga siempre/.test(priv) || !/correo cifrado/.test(priv) || !/no lo cuente dos veces/.test(priv)) F("6 · /privacy no dice que se guarda el origen 30 días, que el pixel carga siempre y que va el correo cifrado");
    }
  } finally {
    envioMeta.enviar = guardado.enviar;
    for (const k of ["META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) if (guardado.env[k] != null) process.env[k] = guardado.env[k]; else delete process.env[k];
  }
  for (const f of fallas) console.log(`  ✗ ${f}`);
  console.log(fallas.length ? `  ${fallas.length} falla(s)` : "  ✓ CAMPANA-FASE0 verde");
  return { hard: fallas.length };
}

if (require.main === module) {
  runCampanaFase0Tier().then((r) => process.exit(r.hard ? 1 : 0));
}

// ── ACTA DE MUTACIONES (12-nov-2026) ────────────────────────────────────────
// 22 de 22 en ROJO, una a la vez, con el archivo restaurado por copia después de cada una:
//   C1 la llegada sin utm_content · C2 sin fbclid · C3 la cookie se pisa en cada visita · C4 una cuenta vieja se lleva el origen ·
//   C5 /deptos-Explorar-invitación sin origen · C6 el callback sin origen · C7 el claim sin origen · C8 el pack sin origen · C9 el
//   middleware no guarda la cookie · C10 el contexto sin el fbc del fbclid · C11 el correo vuelve a pedir el «si» · C12 sin espejo
//   sin el «si» · C13 el pixel espera el aviso · C14 las cuentas de prueba mandan · C15 el panel cuenta cuentas de prueba · C16 el
//   panel por semana de registro (en la primera pasada quedó VERDE: el fixture no tenía una cuenta que llegara una semana y se
//   registrara la siguiente; se agregó) · C17 el regalo sin la ventana de 24 horas · C18 Invierte con el origen del navegador ·
//   C19 /privacy vieja · C20 el FAQ condiciona Meta a las cookies (en la primera pasada quedó VERDE: el predicado solo prohibía la
//   frase vieja literal; ahora ninguna oración sobre Meta puede condicionarla) · C21 la cohorte nunca «en curso» · C22 sin external_id.
// Y los predicados reescritos con su acta en CONSENTIMIENTO (§2, §4, §5), MEDICION-META (§2, §4) y ALTA-ORDEN (§6), 11 de 11 en ROJO:
//   K1 el pixel espera el aviso · K2 el `_fbc` con permiso · K3 el correo con permiso · K4 sin espejo sin permiso · K5 espejo en modo
//   prueba (en la primera pasada quedó VERDE: la prueba corría sin código y el evento salía antes; ahora con el código) · K6 /privacy
//   dice «nunca tu correo» · K7 el contexto sin el fbc del fbclid · K8 el pixel borra sus cookies al rechazar · A1 el espejo del
//   registro pide permiso · A2 el `_fbc` con permiso (MEDICION-META) · A3 el claim sin la puerta.
