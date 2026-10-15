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
import { esCuentaDePruebaNavegador, metaTrack, metaTrackCustom, vaciarColaMeta } from "@/lib/meta/pixel";
import { consumirCookieEspejo, espejarMeta } from "@/lib/meta/espejo";
import { COOKIE_FBC, VIDA_FBC_S, cookiesDeLlegada } from "@/lib/meta/cookies";
import { cuandoLaPaginaEsteQuieta } from "@/lib/pagina-quieta";

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

  // Desde la primera carga, aunque el pixel todavía no cargue: el clic del anuncio queda guardado, y la cola y el
  // espejo del servidor se miran cada poco rato (salen apenas el pixel opera).
  useEffect(() => {
    if (!PIXEL_ID) return;
    guardarClicDelAnuncio();
    const mirar = () => {
      espejarMeta(consumirCookieEspejo());
      vaciarColaMeta();
    };
    mirar();
    const id = setInterval(mirar, CADA_MS);
    return () => clearInterval(id);
  }, []);

  // Init (una vez), CUANDO LA PÁGINA ESTÁ QUIETA (28-sep-2026): fbevents.js más su config pesan
  // 197 kB y bloqueaban 470 ms antes del titular. Snippet estándar de fbevents SIN el
  // track('PageView') final: el PageView lo maneja el effect de ruta de abajo, que espera a `listo`.
  // Una CUENTA DE PRUEBA (15-oct-2026) no carga el pixel: nada suyo va a Meta.
  useEffect(() => {
    if (!PIXEL_ID) return;
    return cuandoLaPaginaEsteQuieta(() => {
    if (esCuentaDePruebaNavegador()) return;
    const w = window as unknown as { fbq?: unknown; _fbq?: unknown };
    if (w.fbq) { setListo(true); return; } // ya inicializado

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
  }, []);

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
