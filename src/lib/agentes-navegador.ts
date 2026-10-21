// ─────────────────────────────────────────────────────────────────────────────
// EL NAVEGADOR DE CADA PERSONA, Y LO QUE ESPERA POR ÉL (20-oct-2026, posthog-captura.ts). Sin módulos de Node: lo usan
// `capturarServidor` (Node) y el middleware (Edge).
//   · `agentes_navegador` — el último agente de navegador que Franco le vio a cada persona (la cuenta o `correo:…`).
//   · `eventos_sin_agente` — los eventos de una persona cuyo navegador Franco todavía no vio: no salen sin agente;
//     esperan acá, con su hora, y salen cuando lo ve (`verNavegador`), con `agente_origen` = cola.
// Franco ve el navegador de la persona cuando un evento sale de un pedido suyo (capturarServidor) y cuando navega con
// sesión por la app (el middleware, una vez por navegador).
// LA REGLA DE SALIDA (21-oct-2026, Fabrizio): lo que lleva más de 24 horas esperando sale igual, con su hora, el agente
// genérico de Franco y `agente_origen` = ninguno (`vaciarColaVencida`). Lo vacía el resumen diario de los crons, la
// vigilancia de las 00:45 UTC (api/cron/vigilar-crons).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTE_GENERICO, agenteDeNavegador, enviarCaptura, idDeCorreo, idRecordable, type DepsEnvio, type EventoServidor } from "@/lib/posthog-captura";

/** Cuánto espera un evento a que Franco vea el navegador de la persona antes de salir con el agente genérico. */
export const ESPERA_MAXIMA_H = 24;

export interface AlmacenAgentes {
  leer(distinctId: string): Promise<string | null>;
  guardar(distinctId: string, agente: string): Promise<void>;
  /** El evento espera a que Franco vea el navegador de la persona. */
  encolar(ev: EventoServidor): Promise<void>;
  pendientes(distinctId: string): Promise<Array<{ id: number; evento: EventoServidor }>>;
  /** Lo que entró a la cola antes de `antesDe` (ISO), de a `limite`. */
  vencidos(antesDe: string, limite: number): Promise<Array<{ id: number; evento: EventoServidor }>>;
  sacar(ids: number[]): Promise<void>;
}

/** Las tablas (RLS sin políticas: solo el service role). Lo ya leído o escrito en esta instancia no vuelve a la base. */
const enMemoria = new Map<string, string>();
export function almacenSupabase(cliente: () => SupabaseClient): AlmacenAgentes {
  return {
    async leer(distinctId) {
      const visto = enMemoria.get(distinctId);
      if (visto) return visto;
      const { data } = await cliente().from("agentes_navegador").select("agente").eq("distinct_id", distinctId).maybeSingle();
      const agente = (data as { agente?: string } | null)?.agente ?? null;
      if (agente) enMemoria.set(distinctId, agente);
      return agente;
    },
    async guardar(distinctId, agente) {
      if (enMemoria.get(distinctId) === agente) return;
      const { error } = await cliente().from("agentes_navegador").upsert({ distinct_id: distinctId, agente, actualizado_at: new Date().toISOString() });
      if (!error) enMemoria.set(distinctId, agente);
    },
    async encolar(ev) {
      const { error } = await cliente().from("eventos_sin_agente").insert({ distinct_id: ev.distinctId, evento: ev });
      if (error) throw error;
    },
    async pendientes(distinctId) {
      const { data } = await cliente().from("eventos_sin_agente").select("id, evento").eq("distinct_id", distinctId).order("id").limit(500);
      return ((data ?? []) as Array<{ id: number; evento: EventoServidor }>);
    },
    async vencidos(antesDe, limite) {
      const { data, error } = await cliente().from("eventos_sin_agente").select("id, evento").lt("creado_at", antesDe).order("id").limit(limite);
      if (error) throw error;
      return ((data ?? []) as Array<{ id: number; evento: EventoServidor }>);
    },
    async sacar(ids) {
      if (ids.length) await cliente().from("eventos_sin_agente").delete().in("id", ids);
    },
  };
}

/** La cookie con que el middleware recuerda que ya anotó este navegador para esta cuenta (no guarda ni el id ni el
 *  agente: una marca de los dos). */
export const COOKIE_NAVEGADOR = "franco_nav";
export const VIDA_COOKIE_NAVEGADOR_S = 60 * 60 * 24 * 365;

/** La marca de una cuenta en un navegador (FNV-1a de 32 bits): cambia si cambia la cuenta o el agente. */
export function marcaDeNavegador(cuenta: string, agente: string): string {
  let h = 0x811c9dc5;
  for (const c of `${cuenta}|${agente}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Franco vio el navegador de la persona (sus ids: la cuenta y su correo): lo recuerda y manda, con ese agente, lo que
 *  esperaba en la cola. Devuelve cuántos eventos salieron de la cola. Nunca lanza. */
export async function verNavegador(distinctIds: string[], agente: string, almacen: AlmacenAgentes, deps: DepsEnvio = {}): Promise<number> {
  let enviados = 0;
  for (const id of distinctIds.filter(idRecordable)) {
    try {
      await almacen.guardar(id, agente);
      const cola = await almacen.pendientes(id);
      const salieron: number[] = [];
      for (const p of cola) {
        if (await enviarCaptura(p.evento, { valor: agente, origen: "cola" }, deps)) salieron.push(p.id);
      }
      await almacen.sacar(salieron);
      enviados += salieron.length;
    } catch {
      // una falla de medición no rompe nada: lo que quedó en la cola sale la próxima vez
    }
  }
  return enviados;
}

/** La regla de salida: lo que lleva más de `ESPERA_MAXIMA_H` horas en la cola sale con su hora, el agente genérico de
 *  Franco y `agente_origen` = ninguno, y deja la cola. De a 200, mientras quede tiempo (`topeMs`: la vigilancia tiene
 *  60 s); lo que no alcance o PostHog no reciba queda para la próxima. Nunca lanza. */
export async function vaciarColaVencida(almacen: AlmacenAgentes, deps: DepsEnvio = {}, ahora: Date = new Date(), topeMs = 20_000): Promise<{ enviados: number; fallidos: number }> {
  const antesDe = new Date(ahora.getTime() - ESPERA_MAXIMA_H * 3600e3).toISOString();
  const hasta = Date.now() + topeMs;
  let enviados = 0;
  let fallidos = 0;
  try {
    while (Date.now() < hasta) {
      const vencidos = await almacen.vencidos(antesDe, 200);
      const salieron: number[] = [];
      for (const p of vencidos) {
        if (Date.now() >= hasta) break;
        if (await enviarCaptura(p.evento, { valor: AGENTE_GENERICO, origen: "ninguno" }, deps)) salieron.push(p.id);
        else fallidos++;
      }
      await almacen.sacar(salieron);
      enviados += salieron.length;
      if (vencidos.length < 200 || salieron.length === 0) break;
    }
  } catch {
    // lo que no salió queda en la cola para el resumen de mañana
  }
  return { enviados, fallidos };
}

/** El middleware vio a alguien con sesión navegando por la app. Si el pedido viene de un navegador y esta cuenta no
 *  estaba anotada en él (la cookie trae otra marca), devuelve la marca nueva para la cookie y el trabajo de anotarlo:
 *  su cuenta y su correo quedan con ese agente y sale lo que los esperaba. */
export function navegadorDeSesion(p: {
  persona: { id: string; email?: string | null } | null;
  cabeceras: { get(nombre: string): string | null };
  marcaActual: string | null | undefined;
}): { marca: string; anotar: (almacen: AlmacenAgentes, deps?: DepsEnvio) => Promise<number> } | null {
  const agente = agenteDeNavegador(p.cabeceras);
  if (!p.persona || !agente) return null;
  const marca = marcaDeNavegador(p.persona.id, agente);
  if (p.marcaActual === marca) return null;
  const { id, email } = p.persona;
  return {
    marca,
    anotar: async (almacen, deps) => verNavegador([id, ...(email ? [await idDeCorreo(email)] : [])], agente, almacen, deps),
  };
}
