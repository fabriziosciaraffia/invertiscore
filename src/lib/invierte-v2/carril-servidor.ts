// ─────────────────────────────────────────────────────────────────────────────
// El carril de Invierte contra la base y la fuente (etapa 2, entrega 2, 18-nov-2026). Las reglas, en carril.ts.
//   · La bajada es la misma de las lecturas de las personas (ficha-servidor.ts › bajarFicha, por el proxy), pero el tope y la
//     bitácora son del carril (`lecturas_invierte`): el tope de 30 por hora del mapa no lo ve ni lo gasta.
//   · El fusible vive en `config` (`invierte_carril_fusible`).
//   · Sin la migración de la entrega 2 aplicada, `lecturas_invierte` no existe: el conteo falla, el tope se da por lleno y el
//     carril no lee nada (vale lo que se sabe). Nunca cae al tope de las personas.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { almacenPublicacion, bajarFicha } from "@/lib/guia/ficha-servidor";
import { leerFicha, type AlmacenPublicacion } from "@/lib/guia/publicacion";
import { fichaDelAviso } from "@/lib/guia/analizar-servidor";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { CLAVE_FUSIBLE_CARRIL, PAUSA_FUSIBLE_CARRIL_MS, TOPE_CARRIL_POR_HORA, chequearPorCarril, type OrigenLectura } from "./carril";

const RUTA = "lib/invierte-v2/carril";

/** El almacén del carril: el de la guía para lo que se sabe del aviso, con SU bitácora y SU tope (pedidos por hora). */
export function almacenCarril(admin: SupabaseClient, quien: { userId: string | null; origen: OrigenLectura }): AlmacenPublicacion {
  const base = almacenPublicacion(admin);
  return {
    ...base,
    async lecturasUltimaHora() {
      const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await admin.from("lecturas_invierte").select("id", { count: "exact", head: true }).gte("leido_at", desde);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "contar-hora" });
      // Sin conteo no hay cómo respetar el tope: se da por lleno (y nunca se cae al tope de las personas).
      return error || count == null ? Number.POSITIVE_INFINITY : count;
    },
    async anotar(l) {
      const { error } = await admin.from("lecturas_invierte").insert({ aviso_id: l.avisoId, user_id: quien.userId, origen: quien.origen, codigo: l.codigo, motivo: l.motivo, destino: l.destino });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "anotar-lectura" });
    },
    // El bloqueo del carril lo maneja su fusible: no entra a la vigilancia de las lecturas de las personas.
    async alertarBloqueo(l) {
      console.warn(`[invierte-carril] la fuente bloquea: aviso ${l.avisoId} · ${l.codigo ?? "-"} ${l.destino ?? ""}`.trim());
    },
  };
}

export async function fusibleCarril(admin: SupabaseClient, ahora: Date = new Date()): Promise<{ hasta: Date; motivo: string } | null> {
  const { data, error } = await admin.from("config").select("value").eq("key", CLAVE_FUSIBLE_CARRIL).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-fusible" });
  const v = (data as { value?: string } | null)?.value;
  if (!v) return null;
  try {
    const o = JSON.parse(v) as { hasta?: string; motivo?: string };
    const hasta = new Date(String(o.hasta));
    return hasta.getTime() > ahora.getTime() ? { hasta, motivo: String(o.motivo ?? "") } : null;
  } catch {
    return null;
  }
}

/** ¿Está publicado? Por el carril: con su memoria de 24 horas, su fusible y su tope. Anota la lectura en el depto de cada persona. */
export async function chequearPublicacionInvierte(admin: SupabaseClient, p: { avisoId: string; userId: string | null; origen: OrigenLectura; forzar?: boolean }) {
  const ficha = await fichaDelAviso(admin, p.avisoId);
  if (!ficha) return { estado: "sin-chequeo" as const, lectura: null, sinLeer: "sin-url" as const };
  const almacen = almacenCarril(admin, { userId: p.userId, origen: p.origen });
  const r = await chequearPorCarril({
    async memoria() {
      const [pub, dep] = await Promise.all([
        almacen.publicacion(p.avisoId),
        admin.from("inv_deptos").select("publicacion_leida_at").eq("aviso_id", p.avisoId).not("publicacion_leida_at", "is", null).order("publicacion_leida_at", { ascending: false }).limit(1),
      ]);
      const at = (dep.data?.[0] as { publicacion_leida_at?: string } | undefined)?.publicacion_leida_at;
      return { estado: pub?.estado ?? null, leidaAt: at ? new Date(at) : null };
    },
    async fusible() {
      return !!(await fusibleCarril(admin));
    },
    async saltarFusible(motivo, detalle) {
      const at = new Date();
      const { error } = await admin.from("config").upsert({ key: CLAVE_FUSIBLE_CARRIL, value: JSON.stringify({ hasta: new Date(at.getTime() + PAUSA_FUSIBLE_CARRIL_MS).toISOString(), motivo, detalle, at: at.toISOString() }), updated_at: at.toISOString() }, { onConflict: "key" });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "saltar-fusible" });
      console.warn(`[invierte-carril] saltó el fusible (${motivo}): ${detalle}`);
    },
    leer() {
      return leerFicha(ficha, "clic", almacen, bajarFicha, new Date(), { tope: TOPE_CARRIL_POR_HORA });
    },
  }, new Date(), { forzar: p.forzar });
  // La lectura vale para todas las personas que eligieron este depto (la relectura es por depto, no por persona).
  if (r.lectura?.leida && (r.estado === "publicado" || r.estado === "despublicado")) {
    const { error } = await admin.from("inv_deptos").update({ publicacion_leida_at: new Date().toISOString() }).eq("aviso_id", p.avisoId);
    reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-leida" });
  }
  return r;
}

/** ¿Ya están preparados los detalles de este depto para esta persona? Abrirlos no lee nada ni prepara de nuevo. */
export async function detallesPreparados(admin: SupabaseClient, userId: string, avisoId: string): Promise<string | null> {
  const { data } = await admin.from("guia_analisis").select("analysis_id").eq("user_id", userId).eq("aviso_id", avisoId).not("analysis_id", "is", null).limit(1);
  return ((data?.[0] as { analysis_id?: string } | undefined)?.analysis_id) ?? null;
}
