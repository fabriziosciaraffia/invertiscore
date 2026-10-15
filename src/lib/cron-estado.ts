/**
 * El estado de cada cron entre corridas (15-oct-2026): la tabla `cron_estado`, una fila por cron con su `EstadoCron`
 * (cron-alertas.ts) en jsonb. La mueven `latirCron` (abre la corrida), `cerrarCron` (la cierra) y la vigilancia (lo
 * resuelto, lo avisado). RLS sin políticas: solo el servidor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESTADO_INICIAL, type EstadoCron } from "@/lib/cron-alertas";

const TABLA = "cron_estado";

function normalizar(v: unknown): EstadoCron {
  const o = (v ?? {}) as Partial<EstadoCron>;
  return {
    ultimaBuena: typeof o.ultimaBuena === "string" ? o.ultimaBuena : null,
    fallasSeguidas: typeof o.fallasSeguidas === "number" && o.fallasSeguidas > 0 ? o.fallasSeguidas : 0,
    abiertaAt: typeof o.abiertaAt === "string" ? o.abiertaAt : null,
    causa: typeof o.causa === "string" ? o.causa : null,
    alertas: Array.isArray(o.alertas) ? o.alertas.filter((a): a is string => typeof a === "string") : [],
  };
}

/** El estado de un cron (el inicial si no tiene fila). Un error de lectura lanza: quien llama decide. */
export async function leerEstadoCron(sb: SupabaseClient, nombre: string): Promise<EstadoCron> {
  const { data, error } = await sb.from(TABLA).select("estado").eq("nombre", nombre).maybeSingle();
  if (error) throw new Error(`${TABLA}: ${error.message}`);
  return data ? normalizar(data.estado) : { ...ESTADO_INICIAL };
}

export async function leerEstadosCron(sb: SupabaseClient): Promise<Map<string, EstadoCron>> {
  const { data, error } = await sb.from(TABLA).select("nombre, estado");
  if (error) throw new Error(`${TABLA}: ${error.message}`);
  return new Map((data ?? []).map((f) => [f.nombre as string, normalizar(f.estado)]));
}

export async function guardarEstadoCron(sb: SupabaseClient, nombre: string, estado: EstadoCron): Promise<void> {
  const { error } = await sb.from(TABLA).upsert({ nombre, estado, updated_at: new Date().toISOString() }, { onConflict: "nombre" });
  if (error) throw new Error(`${TABLA}: ${error.message}`);
}
