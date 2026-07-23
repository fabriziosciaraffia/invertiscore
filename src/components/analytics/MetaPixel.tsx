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
 * useSearchParams exige un Suspense boundary — se monta envuelto en providers.tsx.
 */
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { metaTrack } from "@/lib/meta/pixel";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Init (una vez). Snippet estándar de fbevents SIN el track('PageView') final:
  // el PageView lo maneja el effect de ruta de abajo.
  useEffect(() => {
    if (!PIXEL_ID) return;
    const w = window as unknown as { fbq?: unknown; _fbq?: unknown };
    if (w.fbq) return; // ya inicializado

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
  }, []);

  // PageView en mount + cada cambio de ruta/query (navegación SPA cliente).
  useEffect(() => {
    if (!PIXEL_ID) return;
    metaTrack("PageView");
  }, [pathname, searchParams]);

  return null;
}
