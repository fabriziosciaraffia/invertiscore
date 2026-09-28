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

import type { PostHog } from "posthog-js";

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
