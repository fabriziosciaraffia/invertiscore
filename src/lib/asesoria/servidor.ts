// ─────────────────────────────────────────────────────────────────────────────
// LA ASESORÍA EN EL SERVIDOR (27-nov-2026). Un solo universo para todos —los Comprar usados a 30 años con el flujo y el veredicto de
// los cuatro plazos (asesoria_candidatos)—, en caché 10 minutos: el aporte, el tope y las zonas se aplican acá encima, así que la
// caché no guarda nada de una persona. El tope de consultas del aporte (asesoria_consultas) cuenta la última hora por sesión
// (cuenta o dispositivo) y por IP, en hash; si el conteo falla, no se responde.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { candidatoDeFila, distribucion, type Candidato, type FilaCandidato, type PlazoMascara } from "./aporte";
import { capRate } from "./tres";

export const DIAS_UNIVERSO = 7;
/** Las consultas del aporte que una sesión, o una IP, puede hacer en una hora (el slider tiene 8 altos). */
export const TOPE_APORTE_SESION = 30;
export const TOPE_APORTE_IP = 60;

async function leerUniverso(): Promise<FilaCandidato[]> {
  const admin = createServiceClient();
  const desde = new Date(Date.now() - DIAS_UNIVERSO * 86_400_000).toISOString();
  const { data, error } = await admin.rpc("asesoria_candidatos", { p_comunas: null, p_desde: desde, p_tope: null });
  if (error) throw new Error(`asesoria_candidatos: ${error.message}`);
  return (Array.isArray(data) ? data : []) as FilaCandidato[];
}

const universoCacheado = unstable_cache(leerUniverso, ["asesoria-universo-v1"], { revalidate: 600 });

export async function universoAsesoria(): Promise<Candidato[]> {
  return (await universoCacheado()).map(candidatoDeFila);
}

/** Los agregados del anónimo: el cap rate medio de los Comprar por comuna (con al menos 20) y la distribución del slider. */
export async function agregadosAsesoria(uf: number): Promise<{ rinde: Array<{ comuna: string; cap: number; n: number }>; dist: Record<PlazoMascara, number[]>; total: number }> {
  const u = await universoAsesoria();
  const m = new Map<string, { s: number; k: number }>();
  for (const c of u) {
    const cap = capRate(c, uf);
    if (cap == null) continue;
    const a = m.get(c.comuna) ?? { s: 0, k: 0 };
    a.s += cap; a.k += 1; m.set(c.comuna, a);
  }
  const rinde = Array.from(m.entries()).filter(([, a]) => a.k >= 20).map(([comuna, a]) => ({ comuna, cap: Math.round((a.s / a.k) * 10_000) / 10_000, n: a.k }))
    .sort((a, b) => b.cap - a.cap);
  return { rinde, dist: distribucion(u), total: u.length };
}

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const sesionAsesoria = (userId: string | null, dispositivoHash: string | null): string | null =>
  userId ? hash(`cuenta:${userId}`) : dispositivoHash;

/** ¿Pasa el tope? Anota la consulta si pasa. Si el conteo falla, lanza (la ruta no responde). */
export async function topeAporte(admin: SupabaseClient, p: { sesion: string | null; ip: string | null; aporte: number; conCuenta: boolean }): Promise<boolean> {
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const contar = async (campo: "sesion_hash" | "ip_hash", valor: string) => {
    const { count, error } = await admin.from("asesoria_consultas").select("id", { count: "exact", head: true }).eq(campo, valor).gte("creada_at", desde);
    if (error || count == null) throw new Error(`asesoria_consultas: ${error?.message ?? "sin conteo"}`);
    return count;
  };
  const [s, i] = await Promise.all([p.sesion ? contar("sesion_hash", p.sesion) : 0, p.ip ? contar("ip_hash", p.ip) : 0]);
  if (s >= TOPE_APORTE_SESION || i >= TOPE_APORTE_IP) return false;
  const { error } = await admin.from("asesoria_consultas").insert({ sesion_hash: p.sesion, ip_hash: p.ip, aporte_clp: p.aporte, con_cuenta: p.conCuenta });
  if (error) throw new Error(`asesoria_consultas: ${error.message}`);
  return true;
}
