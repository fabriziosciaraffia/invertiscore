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
import { rindePorComuna } from "./tres";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";

/** Las consultas del aporte que una sesión, o una IP, puede hacer en una hora (el slider tiene 8 altos). */
export const TOPE_APORTE_SESION = 30;
export const TOPE_APORTE_IP = 60;
/** Los m² se leen por id en tandas de 200: bajo el corte de 1.000 filas de PostgREST. */
export const TANDA_M2 = 200;

async function leerUniverso(): Promise<FilaCandidato[]> {
  const admin = createServiceClient();
  // EL MISMO UNIVERSO QUE EL MAPA (paseo del 27-nov-2026: la fórmula decía 4.512 y 4.553 en la misma pantalla): las comunas
  // disponibles y la misma ventana que explorar_mapa_todos (portal-servidor.ts › todosDeLaNoche).
  const comunas = [...(COMUNAS_DISPONIBLES as readonly string[])].map(comunaDeAviso);
  const desde = new Date(Date.now() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");
  const { data, error } = await admin.rpc("asesoria_candidatos", { p_comunas: comunas, p_desde: desde, p_tope: null });
  if (error) throw new Error(`asesoria_candidatos: ${error.message}`);
  const filas = (Array.isArray(data) ? data : []) as FilaCandidato[];
  // LOS m² Y LOS COMPARABLES DEL ARRIENDO (tercera y cuarta vuelta, 27-nov-2026): la función no los trae y las reglas de confianza del
  // perfil los necesitan (tres.ts). Se completan acá, dentro de la caché de 10 minutos, en tandas bajo el corte de 1.000 filas.
  const ids = filas.map((f) => f[0]);
  const m2De = new Map<string, number>(), nDe = new Map<string, number>();
  for (let i = 0; i < ids.length; i += TANDA_M2) {
    const tanda = ids.slice(i, i + TANDA_M2);
    const [r, a] = await Promise.all([
      admin.from("scraped_properties").select("id, superficie_m2").in("id", tanda).order("id").limit(200),
      admin.from("avisos_evaluados").select("aviso_id, arriendo").in("aviso_id", tanda).order("aviso_id").limit(200),
    ]);
    if (r.error) throw new Error(`m² del universo: ${r.error.message}`);
    if (a.error) throw new Error(`comparables del universo: ${a.error.message}`);
    for (const x of r.data ?? []) if (x.superficie_m2 != null) m2De.set(String(x.id), Number(x.superficie_m2));
    for (const x of a.data ?? []) { const n = (x.arriendo as { n?: unknown } | null)?.n; if (n != null && Number.isFinite(Number(n))) nDe.set(String(x.aviso_id), Number(n)); }
  }
  return filas.map((f) => [...f.slice(0, 15), m2De.get(f[0]) ?? null, nDe.get(f[0]) ?? null] as unknown as FilaCandidato);
}

const universoCacheado = unstable_cache(leerUniverso, ["asesoria-universo-v4"], { revalidate: 600 });

export async function universoAsesoria(): Promise<Candidato[]> {
  return (await universoCacheado()).map(candidatoDeFila);
}

/** Los agregados del anónimo: el cap rate medio de los Comprar por comuna (con al menos 20) y la distribución del slider. */
export async function agregadosAsesoria(uf: number): Promise<{ rinde: Array<{ comuna: string; cap: number; n: number }>; santiago: number | null; dist: Record<PlazoMascara, number[]>; total: number }> {
  const u = await universoAsesoria();
  // La mediana por comuna, sin los cap rate sobre 12 % y con mínimo de deptos (tres.ts › rindePorComuna).
  const { rinde, santiago } = rindePorComuna(u, uf);
  return { rinde, santiago, dist: distribucion(u), total: u.length };
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
