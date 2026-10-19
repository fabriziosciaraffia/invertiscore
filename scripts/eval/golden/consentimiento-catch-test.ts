/**
 * TIER CONSENTIMIENTO — el aviso de cookies y lo que depende de él (19-oct-2026, decisión de Fabrizio; pensado para la
 * ley 21.719, que rige en diciembre). Reglas en `src/lib/consentimiento.ts`.
 *
 *   1 · LA ELECCIÓN: una cookie propia (`franco_consentimiento`, «si» o «no») que dura un año; sin elección vale «no».
 *   2 · EL PIXEL DE META: sin «si» no carga (ni su `_fbc`, ni la cola, ni el espejo), y al rechazar se borra lo suyo.
 *   3 · POSTHOG: sin «si» mide igual, pero sin cookies ni almacenamiento y sin grabar sesiones.
 *   4 · LA API DE CONVERSIONES: sin «si» no salen el correo hasheado, el id de la cuenta ni las cookies del pixel.
 *   5 · EL AVISO: honesto y breve, en tuteo, «Aceptar» y «Rechazar» al mismo nivel, y «Cookies» en todo pie.
 *
 * Lo que se puede, se prueba CORRIENDO el código (funciones puras, dobles de navegador y de base); lo que es cableado de
 * componentes, leyendo el fuente sin comentarios y con el ORDEN exigido, no la presencia. Verificado en rojo mutando
 * cada regla (ver el acta al pie). 0 tokens.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIE_CONSENTIMIENTO,
  COOKIES_COPY,
  EVENTO_CONSENTIMIENTO,
  EVENTO_ELECCION_COOKIES,
  eleccionDe,
  VIDA_CONSENTIMIENTO_S,
  alCambiarConsentimiento,
  conPermiso,
  consentimientoDeCookie,
  guardarConsentimiento,
  leerConsentimiento,
  type Consentimiento,
} from "../../../src/lib/consentimiento";
import { borrarCookiesMeta, colaMeta, encolarMeta, metaTrack, pixelPermitido, vaciarColaMeta, CLAVE_COLA } from "../../../src/lib/meta/pixel";
import { opcionesPostHog } from "../../../src/lib/posthog-cliente";
import { contextoDeRequest, datosParaMeta, emitirEventoMeta, envioMeta, guardarContextoMeta, leerContextoMeta, type ContextoMeta } from "../../../src/lib/meta/servidor";
import type { MetaCapiEventInput } from "../../../src/lib/meta/capi";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ── Dobles ──────────────────────────────────────────────────────────────────
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
 * Un navegador: un EventTarget como `window` (con storage, `location` y, si se pide, el pixel) y un `document.cookie`
 * que entiende Max-Age=0 y anota cada escritura cruda (para ver los atributos con que se guardó la elección).
 */
function navegador(cookies: Record<string, string> = {}, host = "refranco.ai") {
  const jar = new Map<string, string>(Object.entries(cookies));
  const escrituras: string[] = [];
  const w = Object.assign(new EventTarget(), {
    sessionStorage: almacen(),
    localStorage: almacen(),
    location: { protocol: "https:", host, search: "" },
  }) as unknown as Record<string, unknown>;
  const doc = {
    get cookie() { return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(s: string) {
      escrituras.push(s);
      const [par, ...attrs] = s.split(";").map((x) => x.trim());
      const i = par.indexOf("=");
      const k = par.slice(0, i), v = par.slice(i + 1);
      if (attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(k); else jar.set(k, v);
    },
  };
  (globalThis as Record<string, unknown>).window = w;
  (globalThis as Record<string, unknown>).document = doc;
  const llamadas: string[] = [];
  const conPixel = () => {
    const fbq = ((comando: string, evento: string) => { llamadas.push(`${comando}:${evento}`); }) as unknown as Record<string, unknown>;
    fbq.callMethod = () => {};
    w.fbq = fbq;
  };
  return { w, jar, escrituras, llamadas, conPixel };
}

/** La base: meta_eventos (marca por evento + id + prueba), meta_contexto y la RPC de cuentas de prueba (nadie lo es). */
function baseFalsa() {
  const eventos = new Map<string, Record<string, unknown>>();
  const contexto = new Map<string, Record<string, unknown>>();
  const sb = {
    async rpc() { return { data: false, error: null }; },
    from(t: string) {
      if (t === "meta_eventos") return {
        upsert(row: Record<string, unknown>) {
          const k = `${row.evento}|${row.event_id}|${row.prueba}`;
          const nueva = !eventos.has(k);
          if (nueva) eventos.set(k, { ...row });
          return Object.assign(Promise.resolve({ error: null }), { select: () => Promise.resolve({ data: nueva ? [{ id: eventos.size }] : [], error: null }) });
        },
        update() {
          const b = { eq(): unknown { return Object.assign(Promise.resolve({ error: null }), b); } };
          return b;
        },
      };
      if (t === "meta_contexto") return {
        upsert(row: Record<string, unknown>) { contexto.set(String(row.user_id), { ...row }); return Promise.resolve({ error: null }); },
        select() { return { eq: (_k: string, v: string) => ({ maybeSingle: async () => ({ data: contexto.get(v) ?? null, error: null }) }) }; },
      };
      throw new Error(`tabla inesperada: ${t}`);
    },
  };
  return { sb: sb as never, contexto };
}

const NAVEGADOR: Omit<ContextoMeta, "consentimiento"> = { ip: "200.1.1.1", ua: "Mozilla/5.0", fbp: "fb.1.1.111", fbc: "fb.1.2.abc", url: "https://refranco.ai/x", prueba: false };

/** Voseo en un texto para el usuario: formas verbales del voseo, sin las palabras legítimas que terminan igual. */
function voseo(t: string): string[] {
  const legitimas = new Set(["más", "después", "través", "inglés", "país", "jamás", "atrás", "además", "demás", "quizás", "cortés", "interés", "estés", "estás"]);
  return (t.match(/\b[a-záéíóúñ]+(?:ás|és|ís)\b/gi) ?? []).filter((p) => !legitimas.has(p.toLowerCase()))
    .concat(t.match(/\b(?:aceptá|rechazá|elegí|mirá|revisá|tocá|cambiá|escribí|tenés|querés|podés|sabés)\b/gi) ?? []);
}

/** Todos los .tsx bajo `src`. */
function tsxDe(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`;
    if (statSync(join(RAIZ, p)).isDirectory()) out.push(...tsxDe(p));
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

export async function runConsentimientoTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER CONSENTIMIENTO (el aviso de cookies, el pixel, PostHog y la API de conversiones · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const guardado = { window: (globalThis as Record<string, unknown>).window, document: (globalThis as Record<string, unknown>).document, enviar: envioMeta.enviar, env: { ...process.env } };
  for (const k of ["META_TRACKING_ENABLED", "META_CAPI_TOKEN", "META_TEST_EVENT_CODE"]) delete process.env[k];
  const envios: MetaCapiEventInput[] = [];
  envioMeta.enviar = async (input) => { envios.push(input); return { ok: true, status: 200 }; };

  try {
    // ── 1 · LA ELECCIÓN ────────────────────────────────────────────────────────
    {
      if (COOKIE_CONSENTIMIENTO !== "franco_consentimiento") F(`1 · la cookie cambió de nombre (${COOKIE_CONSENTIMIENTO}): las elecciones guardadas se pierden`);
      if (VIDA_CONSENTIMIENTO_S !== 365 * 24 * 60 * 60) F(`1 · la elección no dura un año (${VIDA_CONSENTIMIENTO_S} s)`);
      const casos: Array<[string | null, Consentimiento | null]> = [
        [null, null], ["", null], ["otra=1", null],
        ["franco_consentimiento=si", "si"], ["a=1; franco_consentimiento=no; b=2", "no"],
        ["franco_consentimiento=yes", null], ["franco_consentimiento=", null], ["xfranco_consentimiento=si", null],
      ];
      for (const [cabecera, esperado] of casos) if (consentimientoDeCookie(cabecera) !== esperado) F(`1 · «${cabecera}» se lee como ${consentimientoDeCookie(cabecera)}, no ${esperado}`);
      // Sin elección vale «no»: el permiso es SOLO un «si» explícito.
      if (conPermiso(null) || conPermiso(undefined) || conPermiso("no") || !conPermiso("si")) F("1 · el permiso no es solo un «si» explícito (sin elección tiene que valer «no»)");
      // Guardar: la cookie con un año, en todo el sitio, Lax y Secure en https; avisa a quien escucha.
      const nav = navegador();
      const oidos: Consentimiento[] = [];
      const soltar = alCambiarConsentimiento((c) => oidos.push(c));
      if (leerConsentimiento() !== null) F("1 · un navegador sin la cookie no lee «sin elección»");
      guardarConsentimiento("si");
      const escrita = nav.escrituras.at(-1) ?? "";
      if (!/^franco_consentimiento=si; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/.test(escrita)) F(`1 · la elección no se guarda un año en todo el sitio (${escrita})`);
      if (leerConsentimiento() !== "si") F("1 · después de aceptar, la elección leída no es «si»");
      guardarConsentimiento("no");
      if (leerConsentimiento() !== "no") F("1 · después de rechazar, la elección leída no es «no»");
      if (oidos.join() !== "si,no") F(`1 · el cambio de elección no avisa a quien escucha (${oidos.join()})`);
      soltar();
      guardarConsentimiento("si");
      if (oidos.length !== 2) F("1 · dejar de escuchar no deja de escuchar");
      // El evento lleva la elección en `detail` (lo escuchan el pixel y PostHog).
      let detalle: unknown = null;
      (nav.w as unknown as EventTarget).addEventListener(EVENTO_CONSENTIMIENTO, (e) => { detalle = (e as CustomEvent).detail; });
      guardarConsentimiento("no");
      if (detalle !== "no") F("1 · el evento de la elección no lleva la elección");
    }

    // ── 2 · EL PIXEL DE META ───────────────────────────────────────────────────
    {
      const tabla: Array<[Consentimiento | null, boolean, boolean]> = [[null, false, false], ["no", false, false], ["si", false, true], ["si", true, false], ["no", true, false]];
      for (const [c, prueba, esperado] of tabla) if (pixelPermitido(c, prueba) !== esperado) F(`2 · pixelPermitido(${c}, prueba=${prueba}) da ${!esperado}`);
      // Sin elección: nada entra a la cola ni sale al pixel, aunque el pixel esté.
      for (const cookies of [{}, { franco_consentimiento: "no" }] as Array<Record<string, string>>) {
        const nav = navegador(cookies);
        nav.conPixel();
        const entro = encolarMeta({ comando: "track", evento: "Lead" });
        metaTrack("ViewContent");
        if (entro || colaMeta().length || nav.llamadas.length) F(`2 · con ${JSON.stringify(cookies)} el pixel recibe eventos (cola ${colaMeta().length}, llamadas ${nav.llamadas.join()})`);
        // Una cola que quedó de antes (aceptó, encoló, revocó) se descarta, no sale.
        (nav.w.sessionStorage as Storage).setItem(CLAVE_COLA, JSON.stringify([{ comando: "track", evento: "Lead", eventId: "x1", t: Date.now() }]));
        vaciarColaMeta();
        if (nav.llamadas.length || colaMeta().length) F("2 · sin permiso, la cola que quedó de antes sale al pixel (o queda guardada)");
      }
      // Con «si», sale (el control: si esto fallara, lo de arriba no probaría nada).
      {
        const nav = navegador({ franco_consentimiento: "si" });
        nav.conPixel();
        metaTrack("ViewContent");
        if (nav.llamadas.join() !== "track:ViewContent") F(`2 · con «si» el pixel no recibe (el control falló: ${nav.llamadas.join()})`);
      }
      // Al rechazar se borra lo que el pixel dejó: `_fbp` y `_fbc`, en el host y en el dominio del sitio.
      {
        const nav = navegador({ franco_consentimiento: "no", _fbp: "fb.1.1.1", _fbc: "fb.1.2.abc", otra: "1" });
        borrarCookiesMeta();
        if (nav.jar.has("_fbp") || nav.jar.has("_fbc") || !nav.jar.has("otra")) F("2 · al rechazar no se borran `_fbp` y `_fbc` (o se borra algo que no es de Meta)");
        if (!nav.escrituras.some((e) => /^_fbp=; Max-Age=0; Path=\/; Domain=\.refranco\.ai$/.test(e))) F("2 · `_fbp` no se borra en el dominio del sitio (el pixel la pone en .refranco.ai)");
      }
      // El cableado del componente, en ORDEN: el script de Meta solo se inyecta después de mirar el permiso, dentro de
      // la espera de la página quieta; sin permiso, revoca y borra; y el clic del anuncio y la cola, solo con permiso.
      const px = sinComentarios(leer("src/components/analytics/MetaPixel.tsx"));
      // El efecto se ancla en lo suyo (el `w0` que revoca), no en su primera línea: el del clic empieza casi igual.
      const ancla = px.indexOf("const w0 = window as unknown as { fbq?:");
      const ini = ancla >= 0 ? px.lastIndexOf("useEffect(() => {", ancla) : -1;
      const fin = px.indexOf("}, [permiso]);", ancla);
      const init = ini >= 0 && fin > ini ? px.slice(ini, fin) : "";
      if (!init) F("2 · no encuentro el efecto que carga el pixel (el extractor no corrió)");
      const pos = (re: RegExp) => { const m = re.exec(init); return m ? m.index : -1; };
      const iSinPermiso = pos(/if \(!permiso\) \{/);
      const iRevoca = pos(/w0\.fbq\("consent", "revoke"\)/);
      const iBorra = pos(/if \(leerConsentimiento\(\) === "no"\) borrarCookiesMeta\(\);/);
      const iReturn = pos(/setListo\(false\);\s*return;\s*\}/);
      // El borrado va ANTES de mirar PIXEL_ID: el `_fbc` lo pone el middleware aunque el pixel no esté configurado (en el
      // preview no lo está, y ahí la QA lo vio sobrevivir al rechazo, 19-oct-2026).
      const iPixel = pos(/if \(!PIXEL_ID\) return;/);
      const iQuieta = pos(/return cuandoLaPaginaEsteQuieta\(\(\) => \{/);
      const iMira = pos(/if \(!pixelPermitido\(leerConsentimiento\(\), esCuentaDePruebaNavegador\(\)\)\) return;/);
      const iScript = init.indexOf("https://connect.facebook.net/en_US/fbevents.js");
      if (!(iSinPermiso >= 0 && iSinPermiso < iRevoca && iRevoca < iBorra && iBorra < iReturn && iReturn < iPixel && iPixel < iQuieta && iQuieta < iMira && iMira < iScript))
        F(`2 · el pixel no mira el permiso antes de inyectar su script, o el rechazo no borra sin pixel configurado (orden: sin-permiso ${iSinPermiso}, revoca ${iRevoca}, borra ${iBorra}, return ${iReturn}, pixel ${iPixel}, quieta ${iQuieta}, mira ${iMira}, script ${iScript})`);
      if (!/useEffect\(\(\) => \{\s*if \(!PIXEL_ID \|\| !permiso\) return;\s*guardarClicDelAnuncio\(\);/.test(px)) F("2 · el clic del anuncio (`_fbc`) o la cola corren sin permiso");
      if (!/setPermiso\(pixelPermitido\(leerConsentimiento\(\), esCuentaDePruebaNavegador\(\)\)\);\s*return alCambiarConsentimiento\(\(c\) => setPermiso\(pixelPermitido\(c, esCuentaDePruebaNavegador\(\)\)\)\);/.test(px)) F("2 · el permiso del pixel no sale de la elección (o no se actualiza cuando cambia)");
      // Nadie más inyecta el script de Meta.
      const conScript = tsxDe("src").filter((f) => /connect\.facebook\.net/.test(sinComentarios(leer(f))));
      if (conScript.join() !== "src/components/analytics/MetaPixel.tsx") F(`2 · el script de Meta se inyecta fuera de MetaPixel.tsx (${conScript.join(", ")})`);
      // El middleware: el `_fbc` del clic se guarda solo con «si», y es el único lugar del servidor que lo pone.
      const mw = sinComentarios(leer("src/middleware.ts"));
      if (!/if \(c\.fbc && conPermiso\(consentimientoDeCookie\(request\.headers\.get\("cookie"\)\)\)\) res\.cookies\.set\(COOKIE_FBC,/.test(mw) || (mw.match(/cookies\.set\(COOKIE_FBC/g) ?? []).length !== 1) F("2 · el middleware guarda el `_fbc` del anuncio sin el «si»");
    }

    // ── 3 · POSTHOG ────────────────────────────────────────────────────────────
    {
      for (const c of [null, "no"] as const) {
        const o = opcionesPostHog(c);
        if (o.persistence !== "memory" || o.disable_session_recording !== true) F(`3 · con ${c} PostHog guarda en el navegador o graba (${JSON.stringify(o)})`);
      }
      const si = opcionesPostHog("si");
      if (si.persistence !== "localStorage+cookie" || si.disable_session_recording !== false) F(`3 · con «si» PostHog no guarda ni graba (${JSON.stringify(si)})`);
      const ph = sinComentarios(leer("src/lib/posthog-cliente.ts"));
      const initPh = (ph.match(/ph\.init\(key, \{([\s\S]*?)\n {6}\}\);/) ?? [])[1] ?? "";
      if (!initPh) F("3 · no encuentro el init de PostHog (el extractor no corrió)");
      // La elección es lo ÚLTIMO del init: nada la pisa después.
      if (!/\.\.\.opcionesPostHog\(leerConsentimiento\(\)\),\s*$/.test(initPh) || /persistence|disable_session_recording/.test(initPh)) F("3 · el init de PostHog no toma la persistencia y la grabación de la elección (o algo la pisa)");
      if (!/real\.set_config\(opcionesPostHog\(c\)\);\s*if \(conPermiso\(c\)\) \{\s*real\.startSessionRecording\(\);\s*\} else \{\s*real\.stopSessionRecording\(\);\s*borrarRastroPostHog\(\);/.test(ph)) F("3 · cambiar la elección con la página abierta no prende/apaga la grabación ni borra lo de PostHog");
      if (!/useEffect\(\(\) => alCambiarConsentimiento\(aplicarConsentimientoPostHog\), \[\]\)/.test(sinComentarios(leer("src/app/providers.tsx")))) F("3 · el provider no le avisa a PostHog cuando cambia la elección");
      // Un `import type` no carga nada; un import de valor (o `posthog-js/react`, que lo importa entero) sí.
      const otrosInit = tsxDe("src").filter((f) => f !== "src/lib/posthog-cliente.ts" && /posthog[\w.]*\.init\(|^import (?!type\b)[^;]*from ["']posthog-js(?:\/react)?["']|import\(["']posthog-js["']\)/m.test(sinComentarios(leer(f))));
      if (otrosInit.length) F(`3 · PostHog se inicializa (o se importa entero) fuera de posthog-cliente.ts: ${otrosInit.join(", ")}`);
    }

    // ── 4 · LA API DE CONVERSIONES ─────────────────────────────────────────────
    {
      const e = { evento: "Purchase", eventId: "franco-c1", userId: "u1", email: "persona@correo.cl", valor: 9990 };
      for (const ctx of [{ ...NAVEGADOR, consentimiento: false }, null]) {
        const d = datosParaMeta(e, ctx, null);
        if (d.email !== null || d.externalId !== null || d.fbp !== null || d.fbc !== null) F(`4 · sin «si» (${ctx ? "contexto sin permiso" : "sin contexto"}) salen el correo, el id o las cookies del pixel`);
        if (d.value !== 9990 || d.eventId !== "franco-c1") F("4 · sin «si» el evento pierde el valor o el id (la compra se cuenta igual, sin la persona)");
      }
      const con = datosParaMeta(e, { ...NAVEGADOR, consentimiento: true }, null);
      if (con.email !== "persona@correo.cl" || con.externalId !== "u1" || con.fbp !== NAVEGADOR.fbp || con.fbc !== NAVEGADOR.fbc) F("4 · con «si» no salen el correo, el id y las cookies del pixel (el control falló)");
      // El contexto sale de la cookie del request, y viaja guardado para los webhooks.
      const req = (cookie: string) => new Request("https://refranco.ai/api/x", { headers: { cookie, "user-agent": "UA" } });
      if (contextoDeRequest(req("_fbp=fb.1.1.1")).consentimiento !== false || contextoDeRequest(req("_fbp=fb.1.1.1; franco_consentimiento=si")).consentimiento !== true) F("4 · el contexto del request no lee la elección de la cookie");
      {
        const { sb } = baseFalsa();
        await guardarContextoMeta(sb, "u9", { ...NAVEGADOR, consentimiento: false });
        const leido = await leerContextoMeta(sb, "u9");
        if (leido?.consentimiento !== false) F("4 · el contexto guardado de una cuenta pierde la elección");
        await guardarContextoMeta(sb, "u9", { ...NAVEGADOR, consentimiento: true });
        if ((await leerContextoMeta(sb, "u9"))?.consentimiento !== true) F("4 · el contexto guardado no guarda el «si»");
      }
      // De punta a punta: sin «si», lo que se manda no lleva a la persona y no hay espejo para el pixel.
      {
        const { sb } = baseFalsa();
        envios.length = 0;
        const em = await emitirEventoMeta(sb, { evento: "Lead", eventId: "lead-c1", email: "persona@correo.cl", contexto: { ...NAVEGADOR, consentimiento: false } });
        await em.envio;
        const env = envios[0];
        if (!env || env.email !== null || env.fbp !== null || env.fbc !== null || env.externalId !== null) F(`4 · sin «si», emitirEventoMeta manda a la persona (${JSON.stringify(env ?? null)})`);
        if (em.espejo !== null) F("4 · sin «si» queda un espejo para el pixel (que no corre)");
        // Un webhook sin cookies usa el contexto guardado: sin «si» guardado, tampoco.
        const { sb: sb2, contexto } = baseFalsa();
        contexto.set("u3", { ...NAVEGADOR, user_id: "u3", consentimiento: false, updated_at: new Date().toISOString() });
        envios.length = 0;
        const wh = await emitirEventoMeta(sb2, { evento: "Purchase", eventId: "franco-w1", userId: "u3", email: "w@correo.cl", valor: 9990 });
        await wh.envio;
        if (!envios[0] || envios[0].email !== null || envios[0].externalId !== null || wh.espejo !== null) F("4 · el webhook manda el correo de una cuenta que no dio el «si»");
      }
      if (!/permiso \? e\.email \?\? null : null/.test(sinComentarios(leer("src/lib/meta/servidor.ts")))) F("4 · el correo no pasa por el permiso en datosParaMeta");
      const mig = leer("supabase/migrations/20261019_consentimiento_meta.sql");
      if (!/alter table public\.meta_contexto add column if not exists consentimiento boolean not null default false;/.test(mig)) F("4 · la migración de meta_contexto.consentimiento no está (o no nace en «no»)");
    }

    // ── 5 · EL AVISO ───────────────────────────────────────────────────────────
    {
      // ⚠ ACTA (19-oct-2026, ajuste de Fabrizio) · el aviso pasó a UNA línea, «Usamos cookies para medir qué funciona y
      // mejorar Franco · Privacidad», sin nombrar a Meta ni a PostHog (eso lo dice la política), y «Aceptar» lleno con
      // «Rechazar» de borde, los dos del mismo tamaño y a un clic. Antes: el texto largo con Meta y PostHog y la misma clase.
      if (COOKIES_COPY.texto !== "Usamos cookies para medir qué funciona y mejorar Franco" || COOKIES_COPY.separador !== "·" || COOKIES_COPY.privacidad !== "Privacidad") F(`5 · el texto del aviso cambió: «${COOKIES_COPY.texto} ${COOKIES_COPY.separador} ${COOKIES_COPY.privacidad}»`);
      if (COOKIES_COPY.aceptar !== "Aceptar" || COOKIES_COPY.rechazar !== "Rechazar" || COOKIES_COPY.pie !== "Cookies") F("5 · los botones del aviso o el «Cookies» del pie cambiaron de nombre");
      if (Object.values(COOKIES_COPY).some((t) => /Meta|PostHog|Facebook|Google/i.test(t))) F("5 · el aviso nombra a un tercero (eso va en la política, no en la barra)");
      const av = sinComentarios(leer("src/components/consentimiento/AvisoCookies.tsx"));
      // Ningún texto suelto en el JSX: todo lo que se lee sale de COOKIES_COPY (lo que fija este gate).
      const sueltos = (av.match(/>[^<>{}]*[A-Za-zÁÉÍÓÚáéíóúñ]{2,}[^<>{}]*</g) ?? []).filter((s) => !/=>/.test(s));
      if (sueltos.length) F(`5 · el aviso tiene texto escrito a mano fuera de COOKIES_COPY: ${sueltos.join(" | ").slice(0, 120)}`);
      // «Aceptar» lleno y «Rechazar» de borde, cada uno con su elección y su texto.
      const botones = Array.from(av.matchAll(/<button type="button" className=\{`\$\{BOTON\} \$\{(LLENO|BORDE)\}`\} onClick=\{\(\) => elegir\("(si|no)"\)\} data-cookies="(aceptar|rechazar)">\{COOKIES_COPY\.(aceptar|rechazar)\}<\/button>/g));
      const pares = botones.map((m) => `${m[1]}/${m[2]}/${m[3]}/${m[4]}`).sort().join();
      if (pares !== "BORDE/no/rechazar/rechazar,LLENO/si/aceptar/aceptar") F(`5 · «Aceptar» no es el lleno y «Rechazar» el de borde (cada uno con su elección): ${pares || "no los encuentro"}`);
      if ((av.match(/<button\b/g) ?? []).length !== 3) F("5 · el aviso tiene otro botón además de Aceptar y Rechazar (y el «Cookies» del pie): no es «a un clic»");
      // DEL MISMO TAMAÑO: alto y ancho fijos en BOTON, que comparten; LLENO y BORDE solo cambian color (ninguna clase de
      // tamaño, relleno ni letra).
      const clase = (n: string) => (av.match(new RegExp(`const ${n} =\\s*"([^"]*)";`)) ?? [])[1] ?? null;
      const [boton, lleno, borde] = [clase("BOTON"), clase("LLENO"), clase("BORDE")];
      if (!boton || !lleno || !borde) F("5 · no encuentro las clases de los botones (el extractor no corrió)");
      else {
        if (!/\bh-\d+\b/.test(boton) || !/\bw-\d+\b/.test(boton) || !/\bborder\b/.test(boton)) F("5 · los botones no tienen alto y ancho fijos compartidos");
        // Token entero: `hover:opacity-85` no es un `h-`.
        const tamano = /^(?:(?:sm|md|lg|hover):)?(?:(?:h|w|min-w|max-w|p|px|py|pl|pr|basis)-|flex-1$|grow$|border-\d|text-\[\d)/;
        if ([lleno, borde].some((c) => c.split(/\s+/).some((t) => tamano.test(t)))) F("5 · «Aceptar» y «Rechazar» no son del mismo tamaño (una clase de color trae tamaño)");
        if (!/bg-\[var\(--franco-text\)\]/.test(lleno) || !/bg-transparent/.test(borde) || !/border-\[var\(--franco-text\)\]/.test(borde)) F("5 · «Aceptar» no es lleno o «Rechazar» no es de borde");
      }
      // UNA LÍNEA DE TEXTO: la frase sin cortar, a un tamaño que la hace caber en el ancho útil del teléfono (27,9 em
      // medidos en Inter); en PC «· Privacidad» va en la misma línea, en el teléfono con los botones.
      if (!/const TAMANO_FRASE = "clamp\(11px, calc\(\(100vw - 32px\) \/ 28\.2\), 13px\)";/.test(av) || !/<p\s+data-cookies="texto"\s+className="[^"]*\bwhitespace-nowrap\b[^"]*"\s+style=\{\{ fontSize: TAMANO_FRASE \}\}/.test(av)) F("5 · la frase del aviso puede ocupar más de una línea en el teléfono");
      if (!/<span className="hidden sm:inline">\s*\{` \$\{COOKIES_COPY\.separador\} `\}\s*<a href="\/privacy" className=\{ENLACE\}>\{COOKIES_COPY\.privacidad\}<\/a>\s*<\/span>/.test(av)
        || !/<a href="\/privacy" className=\{`\$\{ENLACE\} mr-auto text-\[13px\] sm:hidden`\}>\{COOKIES_COPY\.privacidad\}<\/a>/.test(av)) F("5 · «Privacidad» no está en la línea en PC y con los botones en el teléfono");
      // Sale mientras no haya elección; vuelve cuando el pie lo pide.
      if (!/if \(leerConsentimiento\(\) === null\) setVisible\(true\);/.test(av) || !/window\.addEventListener\(EVENTO_ABRIR_AVISO, abrir\);/.test(av)) F("5 · el aviso no sale sin elección (o el pie no lo vuelve a abrir)");
      // LA ELECCIÓN EN POSTHOG: `cookies_eleccion` con acepta / rechaza al elegir (antes de guardar), e «ignora» al irse de la
      // página sin elegir — una vez, con send_instantly (un capture a secas en pagehide se pierde).
      if (EVENTO_ELECCION_COOKIES !== "cookies_eleccion" || eleccionDe("si") !== "acepta" || eleccionDe("no") !== "rechaza") F("5 · el evento de la elección cambió de nombre o de valores");
      if (!/posthogCliente\.capture\(EVENTO_ELECCION_COOKIES, \{ eleccion: eleccionDe\(c\), origen: origen\.current \}\);\s*guardarConsentimiento\(c\);/.test(av)) F("5 · aceptar o rechazar no queda en PostHog");
      const irse = (av.match(/const alIrse = \(\) => \{([\s\S]*?)\n {4}\};/) ?? [])[1] ?? "";
      if (!irse || !/if \(leerConsentimiento\(\) !== null\) return;\s*window\.removeEventListener\("pagehide", alIrse\);\s*posthogCliente\.capture\(EVENTO_ELECCION_COOKIES, \{ eleccion: "ignora", origen: "aviso" \}, \{ send_instantly: true \}\);/.test(irse)
        || !/window\.addEventListener\("pagehide", alIrse\);/.test(av)) F("5 · irse sin elegir no queda en PostHog como «ignora» (una vez, con send_instantly)");
      if (!/origen\.current = leerConsentimiento\(\) === null \? "aviso" : "pie";/.test(av)) F("5 · el cambio desde el pie se cuenta como primera elección (ensucia la tasa)");
      if (!/<AvisoCookies \/>/.test(sinComentarios(leer("src/app/providers.tsx")))) F("5 · el aviso no se monta en el provider (no sale en todo el sitio)");
      // En tuteo, sin voseo: el aviso y la sección de cookies de la política.
      const priv = leer("src/app/privacy/page.tsx");
      const seccion = (priv.match(/4\. Cookies<\/h2>([\s\S]*?)<\/section>/) ?? [])[1] ?? "";
      if (!seccion) F("5 · no encuentro la sección de cookies de la política (el extractor no corrió)");
      const textos = Object.values(COOKIES_COPY).join(" ") + " " + seccion.replace(/<[^>]+>/g, " ");
      const vos = voseo(textos);
      if (vos.length) F(`5 · voseo en el aviso o la política: ${vos.join(", ")}`);
      // La política dice lo mismo que el código: Meta y PostHog con permiso, un año, «Cookies» al pie, y ya no
      // «No usamos cookies de publicidad».
      if (/No usamos cookies de publicidad/.test(priv) || !/Meta/.test(seccion) || !/PostHog/.test(seccion) || !/un año/.test(seccion) || !/«Cookies»/.test(seccion) || !/nunca tu correo/.test(seccion)) F("5 · la política de privacidad no dice lo que hace el código (Meta, PostHog, el año, «Cookies», el correo)");
      // «Cookies» en TODO pie del sitio.
      const pies = tsxDe("src").filter((f) => /<footer\b/.test(sinComentarios(leer(f))));
      const sinCambiar = pies.filter((f) => !/<CambiarCookies\b/.test(sinComentarios(leer(f))));
      if (pies.length < 2 || sinCambiar.length) F(`5 · un pie no deja cambiar la elección: ${sinCambiar.join(", ") || `solo ${pies.length} pies encontrados`}`);
    }
  } finally {
    (globalThis as Record<string, unknown>).window = guardado.window;
    (globalThis as Record<string, unknown>).document = guardado.document;
    envioMeta.enviar = guardado.enviar;
    for (const [k, v] of Object.entries(guardado.env)) process.env[k] = v;
  }

  if (fallas.length) {
    console.log(`  ✗ CONSENTIMIENTO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — sin «si» no carga el pixel ni su `_fbc`, PostHog mide sin cookies ni grabación y a Meta no le llega la persona; la elección dura un año; el aviso, en una línea y sin nombrar terceros, pone Aceptar lleno y Rechazar de borde del mismo tamaño, la elección queda en PostHog (acepta, rechaza, ignora) y todo pie la deja cambiar");
  }
  return { hard: fallas.length };
}

/*
 * ⚠ ACTA (19-oct-2026) · verificado EN ROJO mutando el código que vigila, una regla por vez y restaurando por sha1:
 * el permiso que acepta «sin elección», el pixel que no mira el permiso, el middleware sin el gate del `_fbc`, el correo
 * sin pasar por el permiso, el espejo sin el permiso, PostHog con cookies sin «si», un botón con otra clase, un pie sin
 * «Cookies», la cookie de menos de un año y el rechazo que no borra `_fbp` (22 mutaciones, todas rojas).
 * ⚠ ACTA (19-oct-2026, QA del preview) · dos reglas salieron de la QA, no de leer el código: el rechazo no borraba
 * `_fbp`/`_fbc` donde el pixel no está configurado (el borrado estaba detrás de `if (!PIXEL_ID) return;`), y en PC
 * «Rechazar» quedaba 10 px más ancho que «Aceptar» con la misma clase. Las dos, fijadas y verificadas en rojo.
 */

if (require.main === module) {
  runConsentimientoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
