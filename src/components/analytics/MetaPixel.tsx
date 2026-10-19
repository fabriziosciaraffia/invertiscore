"use client";

/**
 * Carga e inicializa el Meta Pixel (browser) y dispara PageView en cada
 * navegación. App Router es SPA: sin un effect de ruta propio, el Pixel solo
 * vería la carga inicial. PostHog autocaptura sus pageviews aparte; este effect
 * es exclusivo del Pixel (no hay tracker de rutas reusable donde engancharse).
 *
 * Gate: sin NEXT_PUBLIC_META_PIXEL_ID no se inyecta nada (retorna null). El
 * init NO dispara PageView — lo dispara el effect de ruta (mount + cada cambio),
 * así no se duplica el primer PageView.
 *
 * LA COLA Y EL ESPEJO (15-oct-2026, medición para la campaña): todo evento entra a la cola de pixel.ts y sale cuando
 * fbevents.js terminó de cargar —acá se vacía al cargar, en cada navegación y cada 1,5 s—. Los eventos que decide el
 * servidor (Lead, CompleteRegistration, Purchase, los propios) llegan como espejo en una cookie corta: se consumen
 * acá y entran a la cola con el mismo id que mandó el servidor. Las CUENTAS DE PRUEBA no cargan el pixel. Y el
 * `fbclid` de la URL queda en `_fbc` desde la primera carga (el middleware lo pone; esto es la red si la ruta no
 * pasa por el middleware).
 *
 * useSearchParams exige un Suspense boundary — se monta envuelto en providers.tsx.
 */
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { borrarCookiesMeta, esCuentaDePruebaNavegador, metaTrack, metaTrackCustom, pixelPermitido, vaciarColaMeta } from "@/lib/meta/pixel";
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import { COOKIE_FBC, VIDA_FBC_S, cookiesDeLlegada } from "@/lib/meta/cookies";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";
import { alCambiarConsentimiento, leerConsentimiento } from "@/lib/consentimiento";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Marca que deja el wizard cuando un ANÓNIMO crea su análisis (cap F2). El
 *  submit navega con window.location.href (unload completo) y un fbq disparado
 *  ahí puede perderse — la marca sobrevive en sessionStorage y este componente
 *  global la consume en la página destino. */
const ANON_CREATED_KEY = "meta_anon_created";

/** Cada cuánto se mira la cola y el espejo mientras la página está abierta. */
const CADA_MS = 1500;

/** Lee la marca del anónimo (el formato viejo, `"1"` pelado, vale como recién nacida). */
function leerMarca(): { t: number } | null {
  try {
    const crudo = sessionStorage.getItem(ANON_CREATED_KEY);
    if (!crudo) return null;
    if (crudo === "1") return { t: Date.now() };
    const m = JSON.parse(crudo) as { t?: unknown };
    return typeof m?.t === "number" ? { t: m.t } : null;
  } catch {
    return null;
  }
}

/** El clic del anuncio, si la ruta no pasó por el middleware: `_fbc` con el `fbclid` de la URL. */
function guardarClicDelAnuncio(): void {
  try {
    const actual = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_FBC}=`))?.slice(COOKIE_FBC.length + 1) ?? null;
    const c = cookiesDeLlegada({ search: window.location.search, host: window.location.host, fbcActual: actual, ahoraMs: Date.now() });
    if (!c.fbc) return;
    document.cookie = `${COOKIE_FBC}=${c.fbc.valor}; Max-Age=${VIDA_FBC_S}; Path=/; SameSite=Lax${c.fbc.dominio ? `; Domain=${c.fbc.dominio}` : ""}`;
  } catch {
    /* sin cookies no hay clic guardado */
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** El snippet ya corrió (con la página quieta): desde acá se puede disparar. */
  const [listo, setListo] = useState(false);
  /**
   * EL CONSENTIMIENTO (19-oct-2026, lib/consentimiento.ts): el pixel —su script, su `_fbp`, el `_fbc` del clic y la
   * cola— corre SOLO con el «si» del aviso de cookies. Sin elección todavía, no carga; si la persona acepta con la
   * página abierta, carga en ese momento; si revoca, Meta deja de recibir (`fbq('consent', 'revoke')`).
   */
  const [permiso, setPermiso] = useState(false);
  useEffect(() => {
    setPermiso(pixelPermitido(leerConsentimiento(), esCuentaDePruebaNavegador()));
    return alCambiarConsentimiento((c) => setPermiso(pixelPermitido(c, esCuentaDePruebaNavegador())));
  }, []);

  // Con permiso: el clic del anuncio queda guardado (lo que traiga la URL de ahora), y la cola y el espejo del
  // servidor se miran cada poco rato (salen apenas el pixel opera).
  useEffect(() => {
    if (!PIXEL_ID || !permiso) return;
    guardarClicDelAnuncio();
    const mirar = () => {
      espejarMeta(consumirCookieEspejo());
      vaciarColaMeta();
    };
    mirar();
    const id = setInterval(mirar, CADA_MS);
    return () => clearInterval(id);
  }, [permiso]);

  // Init (una vez), CUANDO LA PÁGINA ESTÁ QUIETA (28-sep-2026): fbevents.js más su config pesan
  // 197 kB y bloqueaban 470 ms antes del titular. Snippet estándar de fbevents SIN el
  // track('PageView') final: el PageView lo maneja el effect de ruta de abajo, que espera a `listo`.
  // Una CUENTA DE PRUEBA (15-oct-2026) no carga el pixel: nada suyo va a Meta. Y sin consentimiento, tampoco.
  useEffect(() => {
    const w0 = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (!permiso) {
      // Revocó con el pixel ya cargado en esta página: Meta deja de recibir.
      if (typeof w0.fbq === "function") w0.fbq("consent", "revoke");
      // Y lo que el pixel ya dejó en este navegador se borra (con «no» explícito; sin elección no hay nada suyo).
      // Antes de mirar PIXEL_ID: el `_fbc` lo pone el middleware aunque el pixel no esté configurado (preview).
      if (leerConsentimiento() === "no") borrarCookiesMeta();
      setListo(false);
      return;
    }
    if (!PIXEL_ID) return;
    return cuandoLaPaginaEsteQuieta(() => {
    if (!pixelPermitido(leerConsentimiento(), esCuentaDePruebaNavegador())) return;
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; _fbq?: unknown };
    if (w.fbq) { w.fbq("consent", "grant"); setListo(true); return; } // ya inicializado (aceptó de nuevo)

    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    (window as unknown as { fbq: (c: string, id: string) => void }).fbq(
      "init",
      PIXEL_ID
    );
    setListo(true);
    });
  }, [permiso]);

  // PageView cuando el pixel quedó listo + cada cambio de ruta/query (navegación SPA cliente).
  // Antes de `listo` no hay `fbq`: el PageView de la carga sale apenas el snippet corre.
  useEffect(() => {
    if (!PIXEL_ID || !listo) return;
    metaTrack("PageView");
  }, [listo, pathname, searchParams]);

  // Cada navegación, lo que haya en la cola sale (si el pixel ya opera).
  useEffect(() => {
    if (!PIXEL_ID || !listo) return;
    vaciarColaMeta();
  }, [listo, pathname]);

  // AnonAnalysisCreated (custom, medición post-F2): el anónimo creó su análisis completo sin registro. Con la cola
  // (15-oct-2026) ya no hace falta esperar a que fbq opere: entra a la cola con un id propio y sale cuando el pixel
  // carga, aunque la página navegue antes. La marca se borra al encolar.
  //
  // Si algún día vuelve a "desaparecer" del Administrador de eventos: el 17-ago el nombre exacto estaba BLOQUEADO en
  // Meta (la config que baja de connect.facebook.net lo suprimía); Fabrizio lo desbloqueó allá, sin tocar código.
  // Mirar ahí ANTES que acá.
  useEffect(() => {
    if (!PIXEL_ID) return;
    const marca = leerMarca();
    if (!marca) return;
    metaTrackCustom("AnonAnalysisCreated", undefined, `anon-${marca.t}`);
    try { sessionStorage.removeItem(ANON_CREATED_KEY); } catch { /* nada que borrar */ }
  }, [pathname]);

  return null;
}
