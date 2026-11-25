// ─────────────────────────────────────────────────────────────────────────────
// EL LUGAR DE CADA AVISO, del lado del servidor (25-nov-2026; la regla vive en lugar.ts). Por aviso: lo guardado en `aviso_lugar`
// si está; si no, se calcula UNA VEZ con el extracto de OpenStreetMap (src/data/lugares-osm.json, 723 kB, cargado solo aquí y
// recién cuando hace falta) y se guarda. El metro se calcula cada vez desde la lista de estaciones. Si la tabla todavía no existe
// o la escritura falla, la tarjeta igual recibe el lugar calculado: lo único que se pierde es el guardado.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { lugarDePunto, metroCercano, textoLugar, type LugarGuardado, type LugaresOsm } from "./lugar";

const RUTA = "lib/explorar/lugar";
/** Cuántos avisos por pedido (la tarjeta pide los cercanos del carrusel). */
export const MAX_LUGARES_POR_PEDIDO = 40;
export const FUENTE_LUGAR = "osm-bbbike-2026-11-22";

let osmCache: LugaresOsm | null = null;
async function datosOsm(): Promise<LugaresOsm> {
  if (!osmCache) osmCache = (await import("@/data/lugares-osm.json")).default as unknown as LugaresOsm;
  return osmCache;
}

/** Lo que dice la tarjeta de cada aviso debajo de la comuna (null: sin lugar). */
export async function lugaresDeAvisos(admin: SupabaseClient, ids: string[]): Promise<Record<string, string | null>> {
  const unicos = Array.from(new Set(ids)).slice(0, MAX_LUGARES_POR_PEDIDO);
  if (!unicos.length) return {};
  const [puntos, guardados] = await Promise.all([
    admin.from("scraped_properties").select("id, lat, lng").in("id", unicos).order("id").limit(40),
    admin.from("aviso_lugar").select("aviso_id, barrio, avenida").in("aviso_id", unicos),
  ]);
  reportarFalloQuery(puntos.error, { ruta: RUTA, operacion: "puntos" });
  // Sin la tabla (aún no aplicada) se sigue calculando: el error no se reporta como falla de la tarjeta.
  const porId = new Map<string, LugarGuardado>(((guardados.data ?? []) as Array<{ aviso_id: string } & LugarGuardado>).map((r) => [r.aviso_id, { barrio: r.barrio, avenida: r.avenida }]));
  const nuevos: Array<{ aviso_id: string; fuente: string } & LugarGuardado> = [];
  const out: Record<string, string | null> = {};
  for (const p of (puntos.data ?? []) as Array<{ id: string; lat: number | null; lng: number | null }>) {
    if (p.lat == null || p.lng == null) { out[p.id] = null; continue; }
    const lat = Number(p.lat), lng = Number(p.lng);
    const metro = metroCercano(lat, lng);
    let g = porId.get(p.id) ?? null;
    // El barrio y la avenida solo hacen falta sin metro; pero se calculan y guardan igual, una vez, para no volver a pedirlos.
    if (!g) {
      g = lugarDePunto(lat, lng, await datosOsm());
      nuevos.push({ aviso_id: p.id, fuente: FUENTE_LUGAR, ...g });
    }
    out[p.id] = textoLugar(metro, g);
  }
  if (nuevos.length && !guardados.error) {
    const { error } = await admin.from("aviso_lugar").upsert(nuevos, { onConflict: "aviso_id", ignoreDuplicates: true });
    reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar" });
  }
  return out;
}
