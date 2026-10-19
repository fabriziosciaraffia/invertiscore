// ─────────────────────────────────────────────────────────────────────────────
// PostHog, cargado cuando la página está quieta (28-sep-2026, rendimiento de la landing).
//
// `posthog-js` pesa 57 kB gz y su grabación de sesión otros 115 kB de scripts propios; iban en el
// primer paquete de JavaScript de todas las páginas, antes del titular. Ahora el SDK entra por
// `import()` desde `cargarPostHog()`, que el provider dispara con `cuandoLaPaginaEsteQuieta`.
//
// Mientras tanto, `posthogCliente` es una FACHADA: cualquier método que se le llame antes de que el
// SDK cargue —capture, register, identify, reset…— se encola, y al cargar se reproduce en el mismo
// orden. Así los eventos del hero (`landing_viewed`, `landing_cta_focus`…) que se disparan en el
// primer segundo no se pierden: llegan con unos segundos de retraso, no se pierden. Después de la
// carga, la fachada delega directo en el SDK real.
// ─────────────────────────────────────────────────────────────────────────────

import type { PostHog, PostHogConfig } from "posthog-js";
import { conPermiso, leerConsentimiento, type Consentimiento } from "@/lib/consentimiento";

/**
 * LO QUE CAMBIA CON EL CONSENTIMIENTO (19-oct-2026, lib/consentimiento.ts). Con «si», PostHog guarda su id en cookie y
 * localStorage y la grabación de sesiones queda prendida (la activa la configuración remota del proyecto). Sin «si» —sin
 * elección todavía, o con «no»— mide igual, pero SIN cookies ni almacenamiento (`memory`: el id vive solo en esta
 * página) y SIN grabación. Lo fija el tier CONSENTIMIENTO.
 */
export function opcionesPostHog(c: Consentimiento | null): Pick<PostHogConfig, "persistence" | "disable_session_recording"> {
  return conPermiso(c)
    ? { persistence: "localStorage+cookie", disable_session_recording: false }
    : { persistence: "memory", disable_session_recording: true };
}

/**
 * LO QUE SALE AL IRSE DE LA PÁGINA (19-oct-2026, el «ignora» del aviso de cookies). Un capture en `pagehide` llega solo
 * si se ENCOLA ANTES de que el SDK vacíe su cola en su propio `pagehide` (lo manda en el mismo beacon que `$pageleave`).
 * Medido en un sandbox local con posthog-js 1.364.7, Chromium y WebKit, saliendo por clic y por navegación:
 *   · oyente propio registrado ANTES que el del SDK + capture a secas → llega en los dos;
 *   · el mismo con `send_instantly` → en Chromium NO llega;
 *   · registrado DESPUÉS que el del SDK (aunque sea en fase de captura) + capture a secas → en Chromium NO llega.
 * Por eso el oyente vive acá, a nivel de módulo: este módulo es el único que inicia el SDK, y lo hace después de
 * evaluarse, así que este `pagehide` siempre va primero. Quien necesite capturar al irse se anota con `antesDeIrse`.
 */
const alIrse = new Set<() => void>();
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", () => {
    for (const fn of Array.from(alIrse)) {
      try { fn(); } catch { /* una tarea rota no frena las demás */ }
    }
  });
}
/** Corre `fn` al irse de la página, antes de que PostHog vacíe su cola. Devuelve la función que la quita. */
export function antesDeIrse(fn: () => void): () => void {
  alIrse.add(fn);
  return () => { alIrse.delete(fn); };
}

interface Llamada { metodo: string; args: unknown[] }

let real: PostHog | null = null;
let cargando: Promise<PostHog | null> | null = null;
const cola: Llamada[] = [];

const fachada = new Proxy({} as Record<string | symbol, unknown>, {
  get(_objetivo, prop) {
    if (prop === "__fachadaPostHog") return true;
    if (prop === "__loaded") return !!real;
    if (real) {
      const v = (real as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
    }
    if (typeof prop !== "string" || prop === "then") return undefined;
    return (...args: unknown[]) => { cola.push({ metodo: prop, args }); return undefined; };
  },
});

/** El cliente que usan los componentes (`usePostHog`) y los hooks: fachada hasta que carga, SDK después. */
export const posthogCliente = fachada as unknown as PostHog;

/** Cuántas llamadas esperan al SDK (para los tests). */
export function pendientesPostHog(): number { return cola.length; }

/** Carga e inicializa el SDK una sola vez y reproduce la cola. `null` sin key o en el servidor. */
export function cargarPostHog(): Promise<PostHog | null> {
  if (real) return Promise.resolve(real);
  if (cargando) return cargando;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (typeof window === "undefined" || !key) return Promise.resolve(null);
  cargando = import("posthog-js")
    .then((m) => {
      const ph = m.default;
      ph.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        // 'history_change': con `true` solo se capturaba la carga completa de página — toda
        // navegación client-side (Link/router.push) quedaba sin $pageview y los paths de sesión
        // salían truncados.
        capture_pageview: "history_change",
        capture_pageleave: true,
        // Session Replay: el masking vive acá; la ACTIVACIÓN de la grabación es remote config
        // (settings del proyecto PostHog, sampling 100%). Inputs enmascarados (precio, dirección,
        // email); el texto de la página —el informe que el usuario lee— queda visible.
        session_recording: { maskAllInputs: true },
        // Sin consentimiento: sin cookies ni grabación (ver arriba).
        ...opcionesPostHog(leerConsentimiento()),
      });
      real = ph;
      for (const { metodo, args } of cola.splice(0)) {
        try {
          const fn = (ph as unknown as Record<string, unknown>)[metodo];
          if (typeof fn === "function") (fn as (...a: unknown[]) => unknown).apply(ph, args);
        } catch { /* una llamada rota no frena las demás */ }
      }
      return ph;
    })
    .catch(() => null);
  return cargando;
}

/** La elección cambió con la página abierta: PostHog pasa a guardar (y graba) o deja de hacerlo y borra lo suyo. */
export function aplicarConsentimientoPostHog(c: Consentimiento): void {
  if (!real) return; // todavía no cargó: al cargar lee la cookie
  try {
    real.set_config(opcionesPostHog(c));
    if (conPermiso(c)) {
      real.startSessionRecording();
    } else {
      real.stopSessionRecording();
      borrarRastroPostHog();
    }
  } catch { /* un SDK a medio cargar no rompe la página */ }
}

/** Lo que PostHog dejó guardado en este navegador (cookies y almacenamiento con prefijo ph_ o __ph). */
function borrarRastroPostHog(): void {
  try {
    for (const c of document.cookie.split("; ")) {
      const nombre = c.split("=")[0];
      if (/^(ph_|__ph)/.test(nombre)) document.cookie = `${nombre}=; Max-Age=0; Path=/`;
    }
    for (const almacen of [localStorage, sessionStorage]) {
      for (const k of Object.keys(almacen)) if (/^(ph_|__ph)/.test(k)) almacen.removeItem(k);
    }
  } catch { /* sin acceso al almacenamiento, nada que borrar */ }
}
