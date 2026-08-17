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
import { metaPixelOperativo, metaTrack, metaTrackCustom } from "@/lib/meta/pixel";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Marca que deja el wizard cuando un ANÓNIMO crea su análisis (cap F2). El
 *  submit navega con window.location.href (unload completo) y un fbq disparado
 *  ahí puede perderse — la marca sobrevive en sessionStorage y este componente
 *  global la consume en la página destino. */
const ANON_CREATED_KEY = "meta_anon_created";

/** Cuántas veces se espera a que fbq quede operativo dentro de UNA carga. */
const ESPERAS_FBQ = 10;
/** Cada cuánto se reintenta esa espera. 10 × 300 ms = 3 s de margen. */
const ESPERA_MS = 300;
/** Navegaciones distintas en las que se reintenta antes de rendirse. */
const MAX_INTENTOS = 3;
/** Tope de tiempo, por si las navegaciones son pocas y espaciadas. */
const VENTANA_MS = 10 * 60_000;

interface MarcaAnon {
  /** Intentos ya consumidos (una carga que no logró disparar = uno). */
  n: number;
  /** Cuándo se sembró, para poder caducarla. */
  t: number;
}

/**
 * Lee la marca. Acepta el formato viejo (`"1"` pelado) porque puede haber
 * marcas sembradas por la versión anterior en pestañas todavía abiertas: se
 * tratan como recién nacidas en vez de descartarlas.
 */
function leerMarca(): MarcaAnon | null {
  try {
    const crudo = sessionStorage.getItem(ANON_CREATED_KEY);
    if (!crudo) return null;
    if (crudo === "1") return { n: 0, t: Date.now() };
    const m = JSON.parse(crudo) as Partial<MarcaAnon>;
    if (typeof m?.n !== "number" || typeof m?.t !== "number") return null;
    return { n: m.n, t: m.t };
  } catch {
    return null;
  }
}

function borrarMarca(): void {
  try {
    sessionStorage.removeItem(ANON_CREATED_KEY);
  } catch {
    /* sessionStorage no disponible — nada que borrar */
  }
}

function guardarMarca(m: MarcaAnon): void {
  try {
    sessionStorage.setItem(ANON_CREATED_KEY, JSON.stringify(m));
  } catch {
    /* sin storage no hay reintento; se pierde el evento, no la página */
  }
}

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

  // AnonAnalysisCreated (custom, medición post-F2): señal de optimización de
  // campaña mientras Lead escasea — el anónimo creó su análisis completo sin
  // registro. Sin PII: evento pelado, el match lo hacen las cookies del pixel.
  //
  // ── Por qué esto no es un simple leer-y-disparar ──
  // La versión anterior borraba la marca ANTES de llamar a fbq, para que un
  // fallo no re-emitiera en la próxima navegación. El costo era el opuesto y
  // peor: medido en producción el 17-ago, la marca se consumía en las cuatro
  // pruebas y el request a facebook.com/tr NUNCA salía. Con la marca ya
  // borrada, cada evento perdido lo estaba para siempre.
  //
  // La causa medida es de estado del pixel, no de la marca: los eventos que SÍ
  // llegan (PageView, StartFreeAnalysis) se disparan TARDE —el primero porque
  // su effect se re-ejecuta con la ruta, el segundo porque espera el fetch del
  // tier—, mientras que este disparaba una única vez en el primer commit,
  // cuando `fbq` puede ser todavía el stub que solo encola.
  //
  // Entonces: (1) se espera a que el pixel esté OPERATIVO de verdad, no apenas
  // definido; (2) la marca se borra solo tras un disparo confirmado.
  //
  // Y como una marca que sobrevive es una marca que reintenta, lleva tope
  // doble: MAX_INTENTOS navegaciones y VENTANA_MS de vida. Un evento perdido es
  // malo; uno duplicado en cada navegación, para siempre, es peor.
  useEffect(() => {
    if (!PIXEL_ID) return;
    const marca = leerMarca();
    if (!marca) return;

    // Caducó: se abandona en silencio. Que no haya evento es el mal menor.
    if (marca.n >= MAX_INTENTOS || Date.now() - marca.t > VENTANA_MS) {
      borrarMarca();
      return;
    }

    let cancelado = false;
    let esperas = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const intentar = () => {
      if (cancelado) return;
      if (metaPixelOperativo() && metaTrackCustom("AnonAnalysisCreated")) {
        borrarMarca();
        return;
      }
      esperas++;
      if (esperas <= ESPERAS_FBQ) {
        timer = setTimeout(intentar, ESPERA_MS);
        return;
      }
      // Se agotó la espera en ESTA carga. Se anota el intento y la marca queda
      // viva para la próxima navegación, hasta agotar el tope.
      guardarMarca({ n: marca.n + 1, t: marca.t });
    };
    intentar();

    // Si el componente se va antes de resolver, no se anota el intento: la
    // marca queda intacta y la próxima carga arranca con el mismo crédito.
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
