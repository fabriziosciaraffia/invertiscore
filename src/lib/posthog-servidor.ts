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
//    robot, y ningún evento sale sin él. El del evento; si no, el del pedido si viene de su navegador
//    (y se recuerda, y sale lo que lo esperaba); si no —el webhook de Flow o de Resend, un cron—, el
//    último recordado; y si Franco todavía no vio su navegador, el evento espera en la cola, con su
//    hora, hasta que lo vea (agentes-navegador.ts).
//  · Se anota en `waitUntil`: los `void capturarServidor(...)` no se pierden cuando la función responde.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase/service";
import { agenteDeNavegador, agenteDelEvento, enviarCaptura, idRecordable, sinCorreo, type AgentePersona, type DepsEnvio, type EventoServidor } from "@/lib/posthog-captura";
import { almacenSupabase, verNavegador, type AlmacenAgentes } from "@/lib/agentes-navegador";

export type { EventoServidor } from "@/lib/posthog-captura";
export type { AlmacenAgentes } from "@/lib/agentes-navegador";

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

export interface DepsCaptura extends DepsEnvio {
  /** Las cabeceras del pedido en curso; por defecto, las de Next (`headers()`), o ninguna fuera de un pedido. */
  cabeceras?: { get(nombre: string): string | null } | null;
  /** Dónde se recuerda el navegador y esperan los eventos sin agente. Por defecto las tablas, solo en Vercel; con un
   *  `fetch` inyectado o fuera de Vercel (una prueba, local), ninguno salvo que se pase: una prueba no lee ni escribe la
   *  base. */
  agentes?: AlmacenAgentes | null;
}

function cabecerasDelPedido(): { get(nombre: string): string | null } | null {
  try {
    return headers();
  } catch {
    return null;
  }
}

/** El agente del navegador de la persona y de dónde salió (ver posthog-captura.ts); `valor` null si todavía no se
 *  conoce. */
export async function agenteDeLaPersona(ev: EventoServidor, cabeceras: { get(nombre: string): string | null } | null, agentes: AlmacenAgentes | null): Promise<AgentePersona> {
  const delEvento = agenteDelEvento(ev);
  if (delEvento) return { valor: delEvento, origen: "evento" };
  const delPedido = agenteDeNavegador(cabeceras);
  if (delPedido) return { valor: delPedido, origen: "pedido" };
  if (agentes && idRecordable(ev.distinctId)) {
    const recordado = await agentes.leer(ev.distinctId).catch(() => null);
    if (recordado) return { valor: recordado, origen: "recordado" };
  }
  return { valor: null, origen: "cola" };
}

/** Manda el evento con el agente de la persona; si todavía no se conoce, lo deja esperando en la cola. `true` si salió
 *  o quedó en la cola; `false` sin key, sin red o con error. */
export function capturarServidor(evento: EventoServidor, deps: DepsCaptura = {}): Promise<boolean> {
  // Sin la key de PostHog no se mide nada (local, pruebas): ni se lee ni se escribe la base.
  if (!(deps.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY)) return Promise.resolve(false);
  // Lo que decide el correo, decidido ya: el evento puede esperar en la cola sin llevarlo (29-oct-2026).
  const ev = sinCorreo(evento);
  // Las cabeceras se leen ya, en el contexto del pedido; lo demás puede correr después de responder.
  const cabeceras = deps.cabeceras !== undefined ? deps.cabeceras : cabecerasDelPedido();
  const agentes = deps.agentes !== undefined ? deps.agentes : deps.fetch || process.env.VERCEL !== "1" ? null : almacenSupabase(createServiceClient);
  const envio = (async () => {
    try {
      const agente = await agenteDeLaPersona(ev, cabeceras, agentes);
      if (!agente.valor) {
        // Sin agente no sale: espera, con su hora, a que Franco vea el navegador de la persona.
        if (!agentes) return false;
        await agentes.encolar({ ...ev, timestamp: ev.timestamp ?? new Date().toISOString() });
        return true;
      }
      const ok = await enviarCaptura(ev, agente, deps);
      // Se vio su navegador: se recuerda y sale lo que lo esperaba.
      if (agente.origen !== "recordado" && agentes && idRecordable(ev.distinctId)) await verNavegador([ev.distinctId], agente.valor, agentes, deps);
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
