// ─────────────────────────────────────────────────────────────────────────────
// LA VISTA DE LA CALLE del lado del servidor (28-oct-2026; la regla vive en calle.ts). Por aviso: lo guardado en
// `calle_avisos` si vale (30 días y el mismo punto); si no, la metadata de Street View —gratis— y la decisión, que se
// guarda. Un rechazo de Google (la API apagada, la llave sin permiso) no se guarda y la tarjeta lleva el mapa chico.
// LAS LLAVES (29-oct-2026). La metadata y la foto se piden DESDE EL SERVIDOR, sin Referer, así que van con una llave de
// servidor solo para Street View Static (`GOOGLE_STREET_VIEW_API_KEY`, en Vercel, nunca en el navegador). Mientras no
// exista, la pública: Google la acepta sin Referer (medido en producción el 29-oct), pero la pública está en el HTML y
// cualquiera podría usarla para pedir fotos a cuenta de Franco; con la de servidor puesta, a la pública se le saca Street
// View. El mapa chico sigue con la pública (Static Maps ya la tiene para el navegador).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { calleVigente, decidirCalle, urlFotoCalle, urlMapaChico, urlMetadataCalle, type DecisionCalle, type MetadataCalle, type Punto } from "./calle";

const RUTA = "lib/explorar/calle";
/** Consultas de metadata a la vez. */
const A_LA_VEZ = 8;
/** Cuántos avisos se deciden por pedido (la tarjeta pide los cercanos; la lista, los que se ven). */
export const MAX_POR_PEDIDO = 40;

/** La de Street View (metadata y foto): la de servidor, o la pública mientras la de servidor no exista. */
export const llaveCalle = (): string | undefined => process.env.GOOGLE_STREET_VIEW_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
/** La del mapa chico (Static Maps). */
export const llaveMapaChico = (): string | undefined => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type FilaCalle = { aviso_id: string; lat: number; lng: number; estado: "foto" | "mapa"; pano_id: string | null; rumbo: number | null; consultado_at: string };

export interface DepsCalle {
  /** La consulta de metadata (se inyecta para probar sin Google). */
  metadata?: (punto: Punto) => Promise<MetadataCalle | null>;
  key?: string;
}

async function metadataReal(punto: Punto, key: string): Promise<MetadataCalle | null> {
  try {
    const r = await fetch(urlMetadataCalle(punto, key), { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return r.ok ? ((await r.json()) as MetadataCalle) : null;
  } catch {
    return null;
  }
}

/** Foto o mapa para cada aviso (los que no se encuentran, fuera). Lo nuevo se consulta y se guarda. */
export async function decisionesDeCalle(admin: SupabaseClient, ids: string[], ahora: Date = new Date(), deps: DepsCalle = {}): Promise<Record<string, "foto" | "mapa">> {
  const unicos = Array.from(new Set(ids)).slice(0, MAX_POR_PEDIDO);
  if (unicos.length === 0) return {};
  const [{ data: avisos, error: e1 }, { data: guardadas, error: e2 }] = await Promise.all([
    admin.from("scraped_properties").select("id, lat, lng").in("id", unicos).order("id").limit(40),
    admin.from("calle_avisos").select("aviso_id, lat, lng, estado, pano_id, rumbo, consultado_at").in("aviso_id", unicos),
  ]);
  reportarFalloQuery(e1, { ruta: RUTA, operacion: "avisos" });
  reportarFalloQuery(e2, { ruta: RUTA, operacion: "leer" });
  const porId = new Map(((guardadas ?? []) as FilaCalle[]).map((g) => [g.aviso_id, g]));
  const out: Record<string, "foto" | "mapa"> = {};
  const porConsultar: Array<{ id: string; punto: Punto }> = [];
  for (const a of (avisos ?? []) as Array<{ id: string; lat: number | null; lng: number | null }>) {
    if (a.lat == null || a.lng == null) continue;
    const punto = { lat: Number(a.lat), lng: Number(a.lng) };
    const g = porId.get(a.id);
    if (g && calleVigente(g, punto, ahora)) out[a.id] = g.estado;
    else porConsultar.push({ id: a.id, punto });
  }
  const key = deps.key ?? llaveCalle();
  const consultar = deps.metadata ?? (key ? (p: Punto) => metadataReal(p, key) : async () => null);
  const filas: Array<Record<string, unknown>> = [];
  for (let i = 0; i < porConsultar.length; i += A_LA_VEZ) {
    const tanda = porConsultar.slice(i, i + A_LA_VEZ);
    const respuestas = await Promise.all(tanda.map((t) => consultar(t.punto)));
    tanda.forEach((t, j) => {
      const d = decidirCalle(respuestas[j], t.punto);
      out[t.id] = d?.estado ?? "mapa";
      if (d) filas.push(filaDeDecision(t.id, t.punto, d, ahora));
    });
  }
  if (filas.length) {
    const { error } = await admin.from("calle_avisos").upsert(filas, { onConflict: "aviso_id" });
    reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar" });
  }
  return out;
}

function filaDeDecision(id: string, punto: Punto, d: DecisionCalle, ahora: Date): Record<string, unknown> {
  const base = { aviso_id: id, lat: punto.lat, lng: punto.lng, consultado_at: ahora.toISOString() };
  return d.estado === "foto"
    ? { ...base, estado: "foto", motivo: null, pano_id: d.panoId, pano_lat: d.pano.lat, pano_lng: d.pano.lng, distancia_m: d.distanciaM, rumbo: d.rumbo, fecha: d.fecha, copyright: d.copyright }
    : { ...base, estado: "mapa", motivo: d.motivo, pano_id: null, pano_lat: null, pano_lng: null, distancia_m: null, rumbo: null, fecha: null, copyright: null };
}

/** La imagen de un aviso en Google: la foto de la calle si lo guardado lo permite, si no el mapa chico. null si el aviso no
 *  existe o no hay llave. Decide en el momento si todavía no estaba decidido. `guardada` dice si sale de una decisión
 *  guardada: un mapa por un rechazo de Google (la API apagada, la llave sin permiso) no lo es, y no se puede quedar 30 días
 *  en la caché del CDN tapando la foto que vendrá cuando Google responda. */
export async function imagenDeCalle(admin: SupabaseClient, avisoId: string, estilo: readonly string[], ahora: Date = new Date(), deps: DepsCalle = {}): Promise<{ url: string; tipo: "foto" | "mapa"; guardada: boolean; respaldo?: string } | null> {
  const key = deps.key ?? llaveCalle();
  const keyMapa = deps.key ?? llaveMapaChico();
  if (!key || !keyMapa) return null;
  let { data: g } = await admin.from("calle_avisos").select("aviso_id, lat, lng, estado, pano_id, rumbo, consultado_at").eq("aviso_id", avisoId).maybeSingle();
  if (!g) {
    await decisionesDeCalle(admin, [avisoId], ahora, deps);
    ({ data: g } = await admin.from("calle_avisos").select("aviso_id, lat, lng, estado, pano_id, rumbo, consultado_at").eq("aviso_id", avisoId).maybeSingle());
  }
  const fila = g as FilaCalle | null;
  // Con la foto va el mapa chico de RESPALDO (29-oct-2026): si Google no la entrega (la llave sin permiso, un corte), la ruta
  // sirve el mapa en vez de una imagen rota.
  if (fila?.estado === "foto" && fila.pano_id && fila.rumbo != null) return { url: urlFotoCalle({ panoId: fila.pano_id, rumbo: Number(fila.rumbo) }, key), tipo: "foto", guardada: true, respaldo: urlMapaChico({ lat: Number(fila.lat), lng: Number(fila.lng) }, keyMapa, estilo) };
  // Sin foto (o sin decidir, si Google rechazó): el mapa chico con el punto del aviso.
  const punto = fila ? { lat: Number(fila.lat), lng: Number(fila.lng) } : await puntoDelAviso(admin, avisoId);
  return punto ? { url: urlMapaChico(punto, keyMapa, estilo), tipo: "mapa", guardada: fila != null } : null;
}

async function puntoDelAviso(admin: SupabaseClient, avisoId: string): Promise<Punto | null> {
  const { data } = await admin.from("scraped_properties").select("lat, lng").eq("id", avisoId).order("id").limit(1).maybeSingle();
  return data?.lat != null && data?.lng != null ? { lat: Number(data.lat), lng: Number(data.lng) } : null;
}
