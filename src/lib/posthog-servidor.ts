// ─────────────────────────────────────────────────────────────────────────────
// PostHog desde el servidor (28-sep-2026, auditoría de la medición).
//
// Hasta acá todo evento salía del navegador, y lo que pasa en el servidor —un pago confirmado por
// Flow, un correo que sale, un correo que se abre— o no se medía o dependía de que el usuario
// volviera a una página. Este helper manda un evento al endpoint público de captura con la misma
// key del navegador. Reglas:
//  · `distinctId` es el `user.id` de Supabase cuando se sabe (el navegador hace `identify(user.id)`,
//    así que cae en la misma persona) o un id derivado del correo (`distinctIdDeCorreo`).
//  · `uuid` determinista cuando el evento puede repetirse (reintentos de Flow, reintentos del
//    webhook): PostHog descarta el duplicado por uuid.
//  · Nunca lanza: una falla de medición no rompe un cobro ni un correo.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

export interface EventoServidor {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Determinista cuando el evento puede llegar dos veces. */
  uuid?: string;
  timestamp?: string;
}

/** Un UUID estable a partir de una semilla (forma v5, sha1). */
export function uuidDeterminista(semilla: string): string {
  const h = crypto.createHash("sha1").update(semilla).digest("hex").slice(0, 32).split("");
  h[12] = "5";
  h[16] = "89ab"[parseInt(h[16], 16) % 4];
  const x = h.join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/** Identidad de PostHog para un correo sin usuario conocido (nunca el correo en claro). */
export function distinctIdDeCorreo(email: string): string {
  return "correo:" + crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);
}

export interface DepsCaptura {
  fetch?: typeof fetch;
  key?: string;
  host?: string;
}

/** Manda el evento. `true` si PostHog respondió 2xx; `false` sin key, sin red o con error. */
export async function capturarServidor(ev: EventoServidor, deps: DepsCaptura = {}): Promise<boolean> {
  const key = deps.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  const host = (deps.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const f = deps.fetch ?? globalThis.fetch;
  try {
    const res = await f(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: ev.event,
        distinct_id: ev.distinctId,
        ...(ev.uuid ? { uuid: ev.uuid } : {}),
        timestamp: ev.timestamp ?? new Date().toISOString(),
        properties: { ...(ev.properties ?? {}), $lib: "franco-servidor" },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
