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
      // ⚠ ACTA (12-nov-2026, campaña de noviembre fase 0, decisión de Fabrizio) · EL PIXEL YA NO ESPERA EL CONSENTIMIENTO: carga y
      // recibe con cualquier elección (o sin ella); lo único que lo apaga es una cuenta de prueba. Hasta el 12-nov este bloque exigía
      // lo contrario (nada sin el «si»). El control ahora es la cuenta de prueba, que no recibe nada con ninguna elección.
      const tabla: Array<[Consentimiento | null, boolean, boolean]> = [[null, false, true], ["no", false, true], ["si", false, true], ["si", true, false], ["no", true, false], [null, true, false]];
      for (const [c, prueba, esperado] of tabla) if (pixelPermitido(c, prueba) !== esperado) F(`2 · pixelPermitido(${c}, prueba=${prueba}) da ${!esperado}`);
      // Sin elección, con «no» o con «si»: el pixel recibe igual.
      for (const cookies of [{}, { franco_consentimiento: "no" }, { franco_consentimiento: "si" }] as Array<Record<string, string>>) {
        const nav = navegador(cookies);
        nav.conPixel();
        metaTrack("ViewContent");
        if (nav.llamadas.join() !== "track:ViewContent") F(`2 · con ${JSON.stringify(cookies)} el pixel no recibe (llamadas ${nav.llamadas.join() || "ninguna"})`);
      }
      // El control: una cuenta de prueba no recibe nada, con ninguna elección, y su cola vieja se descarta.
      for (const cookies of [{}, { franco_consentimiento: "si" }] as Array<Record<string, string>>) {
        const nav = navegador(cookies);
        (nav.w.localStorage as Storage).setItem("franco_cuenta_prueba", "1");
        nav.conPixel();
        const entro = encolarMeta({ comando: "track", evento: "Lead" });
        metaTrack("ViewContent");
        (nav.w.sessionStorage as Storage).setItem(CLAVE_COLA, JSON.stringify([{ comando: "track", evento: "Lead", eventId: "x1", t: Date.now() }]));
        vaciarColaMeta();
        if (entro || nav.llamadas.length || colaMeta().length) F(`2 · una cuenta de prueba (${JSON.stringify(cookies)}) le manda eventos al pixel (llamadas ${nav.llamadas.join()})`);
      }
      if (!/export function pixelPermitido\(_c: Consentimiento \| null, esPrueba: boolean\): boolean \{\s*return !esPrueba;\s*\}/.test(sinComentarios(leer("src/lib/meta/pixel.ts")))) F("2 · pixelPermitido mira algo más que la cuenta de prueba (el pixel volvería a esperar el consentimiento)");
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
      // ⚠ ACTA (12-nov-2026) · sin permiso (= cuenta de prueba) revoca y sale; el «no» del aviso ya no borra las cookies de Meta.
      const iBorra = iRevoca >= 0 && !/borrarCookiesMeta/.test(init) ? iRevoca + 1 : -1;
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
      // El middleware: el `_fbc` del clic se guarda SIEMPRE (⚠ ACTA 12-nov-2026: hasta entonces solo con «si»), y es el único
      // lugar del servidor que lo pone.
      const mw = sinComentarios(leer("src/middleware.ts"));
      if (!/if \(c\.fbc\) res\.cookies\.set\(COOKIE_FBC,/.test(mw) || /conPermiso/.test(mw) || (mw.match(/cookies\.set\(COOKIE_FBC/g) ?? []).length !== 1) F("2 · el middleware no guarda el `_fbc` del anuncio en toda llegada (o lo condiciona al aviso)");
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
      // ⚠ ACTA (12-nov-2026, campaña de noviembre fase 0, decisión de Fabrizio) · LA API DE CONVERSIONES MANDA SIEMPRE el correo
      // (cifrado en capi.ts), el id de la cuenta, `_fbp` y `_fbc`, con cualquier elección. Las cuentas de prueba no llegan a
      // datosParaMeta (emitirEventoMeta las corta). Hasta el 12-nov este bloque exigía que sin el «si» no salieran.
      const e = { evento: "Purchase", eventId: "franco-c1", userId: "u1", email: "persona@correo.cl", valor: 9990 };
      for (const consentimiento of [false, true]) {
        const d = datosParaMeta(e, { ...NAVEGADOR, consentimiento }, null);
        if (d.email !== "persona@correo.cl" || d.externalId !== "u1" || d.fbp !== NAVEGADOR.fbp || d.fbc !== NAVEGADOR.fbc || d.value !== 9990 || d.eventId !== "franco-c1") F(`4 · con consentimiento ${consentimiento} no salen el correo, el id, las cookies del pixel, el valor o el id del evento`);
      }
      const sinCtx = datosParaMeta(e, null, null);
      if (sinCtx.email !== "persona@correo.cl" || sinCtx.externalId !== "u1" || sinCtx.fbp !== null || sinCtx.fbc !== null) F("4 · sin contexto no sale la persona (o se inventan cookies del pixel)");
      // El fbc armado desde el fbclid de la llegada (la cookie del origen) cuando el navegador no trae `_fbc`.
      {
        const origen = encodeURIComponent(JSON.stringify({ fbclid: "IwAR0abc123XYZ", landing: "/", t: 1794480000000 }));
        const r = (cookie: string) => new Request("https://refranco.ai/api/x", { headers: { cookie, "user-agent": "UA" } });
        if (contextoDeRequest(r(`franco_origen=${origen}`)).fbc !== "fb.1.1794480000000.IwAR0abc123XYZ") F("4 · sin `_fbc`, el contexto no arma el fbc desde el fbclid de la llegada");
        if (contextoDeRequest(r(`_fbc=fb.1.5.otro; franco_origen=${origen}`)).fbc !== "fb.1.5.otro") F("4 · con `_fbc` en el navegador, el contexto no lo usa");
      }
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
      // De punta a punta (⚠ ACTA 12-nov-2026): sin «si», lo que se manda lleva a la persona y queda el espejo para el pixel (que
      // ahora corre); en modo prueba no hay espejo (el pixel no lleva el código de prueba).
      {
        const { sb } = baseFalsa();
        envios.length = 0;
        const em = await emitirEventoMeta(sb, { evento: "Lead", eventId: "lead-c1", userId: "u7", email: "persona@correo.cl", contexto: { ...NAVEGADOR, consentimiento: false } });
        await em.envio;
        const env = envios[0];
        if (!env || env.email !== "persona@correo.cl" || env.fbp !== NAVEGADOR.fbp || env.fbc !== NAVEGADOR.fbc || env.externalId !== "u7") F(`4 · sin «si», emitirEventoMeta no manda a la persona (${JSON.stringify(env ?? null)})`);
        if (!em.espejo || em.espejo.eventId !== "lead-c1") F("4 · sin «si» no queda el espejo para el pixel (el pixel no repetiría el evento con el mismo id)");
        // Con el código de prueba configurado: sin él, el evento sale antes por «prueba sin código» y el espejo no se mediría.
        process.env.META_TEST_EVENT_CODE = "TEST1";
        envios.length = 0;
        const { sb: sbp } = baseFalsa();
        const ep = await emitirEventoMeta(sbp, { evento: "Lead", eventId: "lead-p1", userId: "u8", email: "p@correo.cl", contexto: { ...NAVEGADOR, consentimiento: true, prueba: true } });
        await ep.envio;
        delete process.env.META_TEST_EVENT_CODE;
        if (envios[0]?.testEventCode !== "TEST1" || ep.espejo !== null) F("4 · en modo prueba el evento no sale con el código, o queda un espejo para el pixel (contaría como real)");
        // Un webhook sin cookies usa el contexto guardado: con o sin «si» guardado, manda a la persona.
        const { sb: sb2, contexto } = baseFalsa();
        contexto.set("u3", { ...NAVEGADOR, user_id: "u3", consentimiento: false, updated_at: new Date().toISOString() });
        envios.length = 0;
        const wh = await emitirEventoMeta(sb2, { evento: "Purchase", eventId: "franco-w1", userId: "u3", email: "w@correo.cl", valor: 9990 });
        await wh.envio;
        if (!envios[0] || envios[0].email !== "w@correo.cl" || envios[0].externalId !== "u3") F("4 · el webhook no manda el correo y el id de la cuenta");
      }
      const srv = sinComentarios(leer("src/lib/meta/servidor.ts"));
      if (!/email: e\.email \?\? null,/.test(srv) || !/externalId: e\.userId \?\? null,/.test(srv) || /permiso \?/.test(srv)) F("4 · datosParaMeta vuelve a condicionar el correo o el id al aviso de cookies");
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
      if (!/const TAMANO_FRASE = "clamp\(10px, calc\(\(100vw - 32px\) \/ 28\.2\), 13px\)";/.test(av) || !/<p\s+data-cookies="texto"\s+className="[^"]*\bwhitespace-nowrap\b[^"]*"\s+style=\{\{ fontSize: TAMANO_FRASE \}\}/.test(av)) F("5 · la frase del aviso puede ocupar más de una línea en el teléfono");
      if (!/<span className="hidden sm:inline">\s*\{` \$\{COOKIES_COPY\.separador\} `\}\s*<a href="\/privacy" className=\{ENLACE\}>\{COOKIES_COPY\.privacidad\}<\/a>\s*<\/span>/.test(av)
        || !/<a href="\/privacy" className=\{`\$\{ENLACE\} mr-auto text-\[13px\] sm:hidden`\}>\{COOKIES_COPY\.privacidad\}<\/a>/.test(av)) F("5 · «Privacidad» no está en la línea en PC y con los botones en el teléfono");
      // ⚠ ACTA (20-oct-2026, QA de las páginas de comuna) · la barra tapaba el final de toda página (el aviso legal y
      // «Cookies» del pie en el teléfono, el cierre en PC). Ahora reserva su alto al final del contenido mientras se ve.
      if (!/<div aria-hidden="true" data-cookies="espacio" style=\{\{ height: alto \}\} \/>\s*<div\s+ref=\{barra\}/.test(av)
        || !/const ro = new ResizeObserver\(medir\);\s*ro\.observe\(el\);/.test(av)) F("5 · la barra de cookies vuelve a tapar el final de la página (sin el espacio de su alto)");
      // Sale mientras no haya elección; vuelve cuando el pie lo pide.
      if (!/if \(leerConsentimiento\(\) === null\) setVisible\(true\);/.test(av) || !/window\.addEventListener\(EVENTO_ABRIR_AVISO, abrir\);/.test(av)) F("5 · el aviso no sale sin elección (o el pie no lo vuelve a abrir)");
      // LA ELECCIÓN EN POSTHOG: `cookies_eleccion` con acepta / rechaza al elegir (antes de guardar), e «ignora» al irse de la
      // página sin elegir, una vez.
      if (EVENTO_ELECCION_COOKIES !== "cookies_eleccion" || eleccionDe("si") !== "acepta" || eleccionDe("no") !== "rechaza") F("5 · el evento de la elección cambió de nombre o de valores");
      if (!/posthogCliente\.capture\(EVENTO_ELECCION_COOKIES, \{ eleccion: eleccionDe\(c\), origen: origen\.current \}\);\s*guardarConsentimiento\(c\);/.test(av)) F("5 · aceptar o rechazar no queda en PostHog");
      // ⚠ ACTA (19-oct-2026, QA en producción + sandbox local con posthog-js 1.364.7) · el «ignora» iba con `send_instantly`
      // en un `pagehide` propio: en Chromium NO LLEGA. Lo que llega en Chromium y en WebKit es un capture A SECAS encolado
      // ANTES de que el SDK vacíe su cola en su propio `pagehide` (sale en el beacon de `$pageleave`), y eso exige que
      // nuestro oyente esté registrado ANTES que el del SDK — en Chromium el orden de registro manda, aun en fase de
      // captura. Por eso el oyente vive a nivel de módulo en posthog-cliente.ts, antes de `cargarPostHog`, y el aviso se
      // anota con `antesDeIrse`.
      const irse = (av.match(/return antesDeIrse\(\(\) => \{([\s\S]*?)\n {4}\}\);/) ?? [])[1] ?? "";
      if (!irse || !/if \(emitido \|\| leerConsentimiento\(\) !== null\) return;\s*emitido = true;\s*posthogCliente\.capture\(EVENTO_ELECCION_COOKIES, \{ eleccion: "ignora", origen: "aviso" \}\);/.test(irse)) F("5 · irse sin elegir no queda en PostHog como «ignora» (una vez, encolado)");
      if (/send_instantly|addEventListener\("pagehide"/.test(av)) F("5 · el aviso vuelve a mandar el «ignora» por su cuenta (send_instantly o un pagehide propio: en Chromium no llega)");
      const phc = sinComentarios(leer("src/lib/posthog-cliente.ts"));
      const iOyente = phc.search(/\nif \(typeof window !== "undefined" && typeof window\.addEventListener === "function"\) \{\s*window\.addEventListener\("pagehide", \(\) => \{\s*for \(const fn of Array\.from\(alIrse\)\)/);
      const iCarga = phc.indexOf("export function cargarPostHog(");
      if (iOyente < 0 || iCarga < 0 || iOyente > iCarga) F("5 · el oyente de salida no está a nivel de módulo antes de que se inicie PostHog (el «ignora» llegaría tarde a la cola)");
      if (!/origen\.current = leerConsentimiento\(\) === null \? "aviso" : "pie";/.test(av)) F("5 · el cambio desde el pie se cuenta como primera elección (ensucia la tasa)");
      if (!/<AvisoCookies \/>/.test(sinComentarios(leer("src/app/providers.tsx")))) F("5 · el aviso no se monta en el provider (no sale en todo el sitio)");
      // En tuteo, sin voseo: el aviso y la sección de cookies de la política.
      const priv = leer("src/app/privacy/page.tsx");
      const seccion = (priv.match(/4\. Cookies<\/h2>([\s\S]*?)<\/section>/) ?? [])[1] ?? "";
      if (!seccion) F("5 · no encuentro la sección de cookies de la política (el extractor no corrió)");
      const textos = Object.values(COOKIES_COPY).join(" ") + " " + seccion.replace(/<[^>]+>/g, " ");
      const vos = voseo(textos);
      if (vos.length) F(`5 · voseo en el aviso o la política: ${vos.join(", ")}`);
      // La política dice lo mismo que el código (⚠ ACTA 12-nov-2026, campaña de noviembre fase 0): Meta siempre —el pixel carga
      // siempre y le llega el correo cifrado al registrarse—, el origen de la primera visita por 30 días, PostHog y la grabación
      // con permiso, un año, «Cookies» al pie. Y ya no lo que dejó de ser cierto: «nunca tu correo», «el pixel de Meta no carga».
      const textoPol = seccion.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      if (/No usamos cookies de publicidad/.test(priv) || !/Meta/.test(textoPol) || !/pixel carga siempre/.test(textoPol) || !/correo cifrado/.test(textoPol) || !/30 días/.test(textoPol) || !/PostHog/.test(textoPol) || !/Con tu permiso/.test(textoPol) || !/un año/.test(textoPol) || !/«Cookies»/.test(textoPol) || /nunca tu correo|el pixel de Meta no carga/.test(textoPol)) F("5 · la política de privacidad no dice lo que hace el código (Meta siempre con el correo cifrado, el origen 30 días, PostHog con permiso, el año, «Cookies»)");
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
    console.log("  ✓ VERDE — el pixel y su `_fbc` cargan siempre (salvo una cuenta de prueba) y a Meta le llega la persona; sin «si» PostHog mide sin cookies ni grabación; la elección dura un año; el aviso, en una línea y sin nombrar terceros, pone Aceptar lleno y Rechazar de borde del mismo tamaño, la elección queda en PostHog (acepta, rechaza, e ignora encolado antes de que el SDK se vaya) y todo pie la deja cambiar");
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
