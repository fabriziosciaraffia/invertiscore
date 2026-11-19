// ─────────────────────────────────────────────────────────────────────────────
// «LO QUE VE FRANCO» EN EL SERVIDOR (entrega 4 de las láminas del 19-nov-2026). Una lectura por depto en `lecturas_franco` (uso
// interno: RLS sin políticas), de la versión vigente de la instrucción y de la última lectura de la publicación:
//   · leerLecturas: las listas de estos deptos, para que la pantalla las muestre de una vez.
//   · lecturaDe: la de un depto; si falta, está vieja (otra versión o una publicación releída después) o se cayó, la genera —con
//     las fotos y el texto guardados (publicacion_detalle) y nuestros datos sin precio—, con un tope por hora entre todas las
//     personas y una marca «generando» para que dos pantallas no la pidan dos veces.
// Nunca bloquea una pantalla: quien llama la pide aparte y la tarjeta se completa sola.
// ─────────────────────────────────────────────────────────────────────────────
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findNearestStation } from "@/lib/metro-stations";
import { GENERANDO_VENCE_MS, TOPE_LECTURAS_POR_HORA, VERSION_LECTURA, sanearLectura, type LecturaFranco } from "./lectura-franco";
import { generarLecturaFranco, type EntradaLectura } from "./lectura-franco-ia";

const T = "lecturas_franco";

interface FilaLectura { aviso_id: string; estado: string; version: number; lectura: unknown; detalle_leido_at: string | null; updated_at: string }

export async function leerLecturas(admin: SupabaseClient, avisoIds: readonly string[]): Promise<Record<string, LecturaFranco>> {
  const ids = Array.from(new Set(avisoIds)).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!ids.length) return {};
  const { data } = await admin.from(T).select("aviso_id, estado, version, lectura").in("aviso_id", ids).eq("estado", "lista").eq("version", VERSION_LECTURA);
  const out: Record<string, LecturaFranco> = {};
  for (const f of (data ?? []) as FilaLectura[]) { const l = sanearLectura(f.lectura); if (l) out[f.aviso_id] = l; }
  return out;
}

export type EstadoLectura = { estado: "lista"; lectura: LecturaFranco } | { estado: "generando" | "sin-datos" | "tope" | "error" };

async function entradaDe(admin: SupabaseClient, avisoId: string): Promise<{ entrada: EntradaLectura; leidoAt: string } | null> {
  const [{ data: d }, { data: sp }, { data: ae }] = await Promise.all([
    admin.from("publicacion_detalle").select("fotos, descripcion, leido_at").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("scraped_properties").select("titulo, comuna, dormitorios, banos, superficie_m2, lat, lng").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("antiguedad_anios, antiguedad_origen").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const fotos = ((d?.fotos as string[] | null) ?? []).filter((u) => /^https:\/\//.test(u));
  if (!d || (!fotos.length && !d.descripcion)) return null;
  const est = sp?.lat != null && sp?.lng != null ? findNearestStation(Number(sp.lat), Number(sp.lng), "active") : null;
  // La antigüedad, solo si viene informada (de la ficha o de otro aviso del edificio); la supuesta no se presenta como dato.
  const informada = ae?.antiguedad_origen === "ficha" || ae?.antiguedad_origen === "edificio";
  const anio = informada && typeof ae?.antiguedad_anios === "number" ? new Date().getFullYear() - (ae.antiguedad_anios as number) : null;
  return {
    leidoAt: d.leido_at as string,
    entrada: {
      fotos, titulo: (sp?.titulo as string | null) ?? null, descripcion: (d.descripcion as string | null) ?? null,
      datos: {
        comuna: (sp?.comuna as string | null) ?? null, dormitorios: (sp?.dormitorios as number | null) ?? null, banos: (sp?.banos as number | null) ?? null,
        superficie_m2: sp?.superficie_m2 == null ? null : Number(sp.superficie_m2), antiguedad: anio ? { anio } : "no informada",
        metro: est ? { estacion: est.station.name, a_pie: est.distance <= 1000 } : null,
      },
    },
  };
}

/** La lectura de un depto: la guardada si está vigente; si no, la genera (con su tope y su marca). */
export async function lecturaDe(admin: SupabaseClient, cliente: Anthropic, avisoId: string, ahora: Date = new Date()): Promise<EstadoLectura> {
  const [{ data: fila }, { data: det }] = await Promise.all([
    admin.from(T).select("aviso_id, estado, version, lectura, detalle_leido_at, updated_at").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("publicacion_detalle").select("leido_at").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = fila as FilaLectura | null;
  const vigente = f && f.estado === "lista" && f.version === VERSION_LECTURA && (!det?.leido_at || !f.detalle_leido_at || f.detalle_leido_at >= (det.leido_at as string));
  if (vigente) { const l = sanearLectura(f.lectura); if (l) return { estado: "lista", lectura: l }; }
  if (f?.estado === "generando" && ahora.getTime() - new Date(f.updated_at).getTime() < GENERANDO_VENCE_MS) return { estado: "generando" };
  const e = await entradaDe(admin, avisoId);
  if (!e) return { estado: "sin-datos" };
  const desde = new Date(ahora.getTime() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from(T).select("aviso_id", { count: "exact", head: true }).gte("generado_at", desde);
  if (count == null || count >= TOPE_LECTURAS_POR_HORA) return { estado: "tope" };
  const marca = await admin.from(T).upsert({ aviso_id: avisoId, estado: "generando", version: VERSION_LECTURA, updated_at: ahora.toISOString() }, { onConflict: "aviso_id" });
  if (marca.error) return { estado: "error" };
  const r = await generarLecturaFranco(cliente, e.entrada);
  const fin = new Date().toISOString();
  if (!r.ok) {
    await admin.from(T).update({ estado: "error", error: r.motivo, updated_at: fin }).eq("aviso_id", avisoId);
    return { estado: "error" };
  }
  const { error } = await admin.from(T).update({
    estado: "lista", version: VERSION_LECTURA, lectura: r.lectura, alerta_nivel: r.lectura.alerta.nivel, modelo: r.modelo, costo_usd: r.costoUsd,
    ms: r.ms, detalle_leido_at: e.leidoAt, error: null, generado_at: fin, updated_at: fin,
  }).eq("aviso_id", avisoId);
  if (error) return { estado: "error" };
  return { estado: "lista", lectura: r.lectura };
}
