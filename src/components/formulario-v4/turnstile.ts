"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Turnstile invisible — capa anti-bot del cap anónimo (F2-2).
//
// Cableado completo con kill-switch fail-open en AMBOS lados:
//  · Client (acá): sin NEXT_PUBLIC_TURNSTILE_SITE_KEY → devuelve null sin cargar
//    nada de Cloudflare.
//  · Server (anon-cap.ts): sin TURNSTILE_SECRET_KEY → no valida.
// Activarlo es subir las DOS keys al env de Vercel + redeploy. Cero código.
//
// Cualquier fallo acá devuelve null: el server decide (con secret seteada, un
// null se rechaza con mensaje de recarga; sin secret, pasa igual). Nunca se
// bloquea el submit por un error de red de Cloudflare en el client.
// ─────────────────────────────────────────────────────────────────────────────

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      size?: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TIMEOUT_MS = 12_000;

let scriptPromise: Promise<void> | null = null;

function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // permitir reintento en el próximo submit
      reject(new Error("turnstile script"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Obtiene un token Turnstile en modo invisible, o null (sin site key, error o
 * timeout). Renderiza el widget en un contenedor oculto efímero y lo destruye
 * al terminar — un token por llamada, que es lo que el submit necesita.
 */
export async function obtenerTokenTurnstile(): Promise<string | null> {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey || typeof window === "undefined") return null;
  try {
    await cargarScript();
    const turnstile = window.turnstile;
    if (!turnstile) return null;

    const holder = document.createElement("div");
    holder.style.display = "none";
    document.body.appendChild(holder);

    return await new Promise<string | null>((resolve) => {
      let widgetId: string | null = null;
      const done = (token: string | null) => {
        window.clearTimeout(timer);
        try {
          if (widgetId != null) turnstile.remove(widgetId);
        } catch {
          /* widget ya destruido */
        }
        holder.remove();
        resolve(token);
      };
      const timer = window.setTimeout(() => done(null), TIMEOUT_MS);
      try {
        widgetId = turnstile.render(holder, {
          sitekey,
          size: "invisible",
          callback: (token: string) => done(token),
          "error-callback": () => done(null),
        });
      } catch {
        done(null);
      }
    });
  } catch {
    return null;
  }
}
