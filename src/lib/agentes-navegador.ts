// ─────────────────────────────────────────────────────────────────────────────
// EL NAVEGADOR DE CADA PERSONA, Y LO QUE ESPERA POR ÉL (20-oct-2026, posthog-captura.ts). Sin módulos de Node: lo usan
// `capturarServidor` (Node) y el middleware (Edge).
//   · `agentes_navegador` — el último agente de navegador que Franco le vio a cada persona (la cuenta o `correo:…`).
//   · `eventos_sin_agente` — los eventos de una persona cuyo navegador Franco todavía no vio: no salen sin agente;
//     esperan acá, con su hora, y salen cuando lo ve (`verNavegador`), con `agente_origen` = cola.
// Franco ve el navegador de la persona cuando un evento sale de un pedido suyo (capturarServidor) y cuando navega con
// sesión por la app (el middleware, una vez por navegador).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { agenteDeNavegador, enviarCaptura, idDeCorreo, idRecordable, type DepsEnvio, type EventoServidor } from "@/lib/posthog-captura";

export interface AlmacenAgentes {
  leer(distinctId: string): Promise<string | null>;
  guardar(distinctId: string, agente: string): Promise<void>;
  /** El evento espera a que Franco vea el navegador de la persona. */
  encolar(ev: EventoServidor): Promise<void>;
  pendientes(distinctId: string): Promise<Array<{ id: number; evento: EventoServidor }>>;
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
