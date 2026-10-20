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
//  · EL AGENTE DE LA PERSONA (20-oct-2026, posthog-captura.ts): sin él PostHog marca el evento como
//    robot. El del evento; si no, el del pedido si viene de su navegador (y se recuerda en
//    `agentes_navegador`); si no —el webhook de Flow o de Resend, un cron—, el último recordado.
//  · Se anota en `waitUntil`: los `void capturarServidor(...)` no se pierden cuando la función responde.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase/service";
import { agenteDeNavegador, agenteDelEvento, enviarCaptura, idRecordable, type DepsEnvio, type EventoServidor, type OrigenAgente } from "@/lib/posthog-captura";

export type { EventoServidor } from "@/lib/posthog-captura";

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

/** Dónde se recuerda el último navegador de cada persona. */
export interface AlmacenAgentes {
  leer(distinctId: string): Promise<string | null>;
  guardar(distinctId: string, agente: string): Promise<void>;
}

/** La tabla `agentes_navegador` (RLS sin políticas: solo el service role). Lo ya leído o escrito en esta instancia no
 *  vuelve a la base. */
const enMemoria = new Map<string, string>();
export function almacenSupabase(): AlmacenAgentes {
  return {
    async leer(distinctId) {
      const visto = enMemoria.get(distinctId);
      if (visto) return visto;
      const { data } = await createServiceClient().from("agentes_navegador").select("agente").eq("distinct_id", distinctId).maybeSingle();
      const agente = (data as { agente?: string } | null)?.agente ?? null;
      if (agente) enMemoria.set(distinctId, agente);
      return agente;
    },
    async guardar(distinctId, agente) {
      if (enMemoria.get(distinctId) === agente) return;
      const { error } = await createServiceClient().from("agentes_navegador").upsert({ distinct_id: distinctId, agente, actualizado_at: new Date().toISOString() });
      if (!error) enMemoria.set(distinctId, agente);
    },
  };
}

export interface DepsCaptura extends DepsEnvio {
  /** Las cabeceras del pedido en curso; por defecto, las de Next (`headers()`), o ninguna fuera de un pedido. */
  cabeceras?: { get(nombre: string): string | null } | null;
  /** Dónde se recuerda el navegador. Por defecto la tabla; con un `fetch` inyectado (una prueba), ninguno salvo que
   *  se pase: una prueba no escribe en la base. */
  agentes?: AlmacenAgentes | null;
}

function cabecerasDelPedido(): { get(nombre: string): string | null } | null {
  try {
    return headers();
  } catch {
    return null;
  }
}

/** El agente del navegador de la persona y de dónde salió (ver posthog-captura.ts). */
export async function agenteDeLaPersona(ev: EventoServidor, cabeceras: { get(nombre: string): string | null } | null, agentes: AlmacenAgentes | null): Promise<{ valor: string | null; origen: OrigenAgente }> {
  const delEvento = agenteDelEvento(ev);
  if (delEvento) return { valor: delEvento, origen: "evento" };
  const delPedido = agenteDeNavegador(cabeceras);
  if (delPedido) return { valor: delPedido, origen: "pedido" };
  if (agentes && idRecordable(ev.distinctId)) {
    const recordado = await agentes.leer(ev.distinctId).catch(() => null);
    if (recordado) return { valor: recordado, origen: "recordado" };
  }
  return { valor: null, origen: "ninguno" };
}

/** Manda el evento con el agente de la persona. `true` si PostHog respondió 2xx; `false` sin key, sin red o con error. */
export function capturarServidor(ev: EventoServidor, deps: DepsCaptura = {}): Promise<boolean> {
  // Las cabeceras se leen ya, en el contexto del pedido; lo demás puede correr después de responder.
  const cabeceras = deps.cabeceras !== undefined ? deps.cabeceras : cabecerasDelPedido();
  const agentes = deps.agentes !== undefined ? deps.agentes : deps.fetch ? null : almacenSupabase();
  const envio = (async () => {
    try {
      const agente = await agenteDeLaPersona(ev, cabeceras, agentes);
      const recordar = agente.origen !== "recordado" && agente.valor && agentes && idRecordable(ev.distinctId)
        ? agentes.guardar(ev.distinctId, agente.valor).catch(() => undefined)
        : undefined;
      const [ok] = await Promise.all([enviarCaptura(ev, agente, deps), recordar]);
      return ok;
    } catch {
      return false;
    }
  })();
  try {
    waitUntil(envio);
  } catch {
    // fuera de Vercel no hay a quién avisar
  }
  return envio;
}
