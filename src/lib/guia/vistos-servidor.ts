// ─────────────────────────────────────────────────────────────────────────────
// Lo que una persona ya vio (19-oct-2026, «lo ya visto no ocupa lugar»; la regla, pura, en semanal.ts): los deptos de sus
// correos enviados en las últimas DIAS_VISTO días (el semanal y el correo del día, los dos bloques) y los que analizó desde
// un aviso, con su informe de renta larga si lo hay. Lo usan los dos bloques del semanal, el armado, el prechequeo y la
// página viva. Si una lectura falla, no hay vistos: la selección sale como antes (mejor un repetido que un correo vacío).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { DIAS_VISTO, vistosDeFilas, type Visto } from "./semanal";

export type Vistos = Map<string, { visto: Visto; informeLargo?: string }>;

export async function vistosDePersona(admin: SupabaseClient, userId: string, ahora: Date = new Date()): Promise<Vistos> {
  const desde = new Date(ahora.getTime() - DIAS_VISTO * 864e5).toISOString();
  const [env, inf] = await Promise.all([
    admin.from("semanal_selecciones").select("items, items_str").eq("user_id", userId).not("enviada_at", "is", null).gte("enviada_at", desde).limit(60),
    admin.from("analisis").select("id, tipo_analisis, aviso:input_data->origenAviso->>avisoId").eq("user_id", userId)
      .not("input_data->origenAviso->>avisoId", "is", null).order("created_at", { ascending: false }).limit(500),
  ]);
  reportarFalloQuery(env.error, { ruta: "lib/guia/vistos", operacion: "leer-mandados", userId });
  reportarFalloQuery(inf.error, { ruta: "lib/guia/vistos", operacion: "leer-analizados", userId });
  if (env.error || inf.error) return new Map();
  const informes = ((inf.data ?? []) as Array<{ id: string; tipo_analisis: string | null; aviso: string | null }>)
    .filter((a) => typeof a.aviso === "string" && a.aviso)
    .map((a) => ({ id: a.id, avisoId: a.aviso as string, largo: a.tipo_analisis !== "short-term" }));
  return vistosDeFilas({ enviadas: (env.data ?? []) as Array<{ items?: Array<{ avisoId: string }> | null; items_str?: Array<{ avisoId: string }> | null }>, informes });
}
