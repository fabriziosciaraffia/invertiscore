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
import { ESPERA_REINTENTO_MS, GENERANDO_VENCE_MS, MIN_ARRIENDOS_COMPARABLES, TOPE_INTENTOS_LECTURA, TOPE_LECTURAS_POR_HORA, VERSION_LECTURA, sanearLectura, type LecturaFranco } from "./lectura-franco";
import { capRatePct, pctUno } from "@/lib/explorar/explorar";
import { textoAlMes } from "./opciones";
import { etiquetaVeredicto, signoVeredicto } from "@/lib/veredicto-etiqueta";
import { generarLecturaFranco, type EntradaLectura } from "./lectura-franco-ia";

const T = "lecturas_franco";

interface FilaLectura { aviso_id: string; estado: string; version: number; lectura: unknown; detalle_leido_at: string | null; updated_at: string; error: string | null }

/** El error guardado lleva su intento: «[intento 2] limite: 429 rate_limit_error: …» (20-nov-2026: el error real, nunca solo «error»). */
export const textoError = (intento: number, motivo: string, detalle: string) => `[intento ${intento}] ${motivo}: ${detalle}`.slice(0, 500);
export const intentosDe = (error: string | null | undefined) => Number(/^\[intento (\d+)\]/.exec(error ?? "")?.[1] ?? (error ? 1 : 0));

/** ¿Se vuelve a intentar una lectura en error? (20-nov-2026, Fabrizio: «no puede quedar en error para siempre, porque la lectura se
 *  guarda por depto y la ven todos».) Sí, cuando alguien vuelve a ver el depto, si no llegó al tope de intentos y ya pasó la espera,
 *  que crece con cada intento (2, 4, 6 minutos…). */
export function reintentable(f: Pick<FilaLectura, "estado" | "error" | "updated_at">, ahora: Date): boolean {
  if (f.estado !== "error") return false;
  const n = intentosDe(f.error);
  return n < TOPE_INTENTOS_LECTURA && ahora.getTime() - new Date(f.updated_at).getTime() >= ESPERA_REINTENTO_MS * Math.max(1, n);
}

export async function leerLecturas(admin: SupabaseClient, avisoIds: readonly string[]): Promise<Record<string, LecturaFranco>> {
  const ids = Array.from(new Set(avisoIds)).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!ids.length) return {};
  const { data } = await admin.from(T).select("aviso_id, estado, version, lectura").in("aviso_id", ids).eq("estado", "lista").eq("version", VERSION_LECTURA);
  const out: Record<string, LecturaFranco> = {};
  for (const f of (data ?? []) as FilaLectura[]) { const l = sanearLectura(f.lectura); if (l) out[f.aviso_id] = l; }
  return out;
}

export type EstadoLectura = { estado: "lista"; lectura: LecturaFranco } | { estado: "generando" | "sin-datos" | "tope" | "error" };

/** ¿Cuántos arriendos activos de su tamaño (±20 % m²) hay en el radio con que el motor midió su arriendo? El mismo criterio del filtro de
 *  alternativas (`invierte_alternativas`, p_min_comp): con menos de 6, el arriendo del motor no es confiable (20-nov-2026, Fabrizio). */
export async function arriendosDeSuTamano(admin: SupabaseClient, p: { lat: number; lng: number; radio: number; m2: number }, hasta = MIN_ARRIENDOS_COMPARABLES): Promise<number> {
  // Paginado con orden total (PostgREST corta cada respuesta en 1.000 filas sin avisar); se corta apenas hay `hasta` de su tamaño.
  const PAGINA = 1000;
  let n = 0;
  for (let off = 0; off < 20 * PAGINA; off += PAGINA) {
    const { data, error } = await admin.rpc("properties_within_radius", { center_lat: p.lat, center_lng: p.lng, radius_meters: p.radio, prop_type: "arriendo", prop_dorms: null, prop_comuna: null, prop_condicion: null })
      .order("distance_meters", { ascending: true }).order("id", { ascending: true }).range(off, off + PAGINA - 1);
    if (error) return n;
    const filas = (data ?? []) as { superficie_m2?: number | null }[];
    n += filas.filter((a) => a.superficie_m2 != null && Number(a.superficie_m2) >= p.m2 * 0.8 && Number(a.superficie_m2) <= p.m2 * 1.2).length;
    if (n >= hasta || filas.length < PAGINA) return n;
  }
  return n;
}

async function entradaDe(admin: SupabaseClient, avisoId: string): Promise<{ entrada: EntradaLectura; leidoAt: string } | null> {
  const [{ data: d }, { data: sp }, { data: ae }, { data: cfg }] = await Promise.all([
    admin.from("publicacion_detalle").select("fotos, descripcion, leido_at").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("scraped_properties").select("titulo, comuna, dormitorios, banos, superficie_m2, lat, lng").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("antiguedad_anios, antiguedad_origen, precio_uf, arriendo, flujo_20, veredicto_20, score_20").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("config").select("value").eq("key", "uf_value").maybeSingle(),
  ]);
  const fotos = ((d?.fotos as string[] | null) ?? []).filter((u) => /^https:\/\//.test(u));
  if (!d || (!fotos.length && !d.descripcion)) return null;
  const est = sp?.lat != null && sp?.lng != null ? findNearestStation(Number(sp.lat), Number(sp.lng), "active") : null;
  // La antigüedad, solo si viene informada (de la ficha o de otro aviso del edificio); la supuesta no se presenta como dato.
  const informada = ae?.antiguedad_origen === "ficha" || ae?.antiguedad_origen === "edificio";
  const anio = informada && typeof ae?.antiguedad_anios === "number" ? new Date().getFullYear() - (ae.antiguedad_anios as number) : null;
  // Lo que muestra la tarjeta (20-nov-2026): el veredicto siempre; el cap rate y lo que deja al mes, solo si el arriendo es confiable.
  const veredicto = typeof ae?.veredicto_20 === "string" ? `${signoVeredicto(ae.veredicto_20 as never)} ${etiquetaVeredicto(ae.veredicto_20 as never, "frase")}${ae.veredicto_20 === "COMPRAR" && typeof ae.score_20 === "number" ? ` · ${ae.score_20}` : ""}` : null;
  const arr = (ae?.arriendo ?? null) as { monto?: number; radio?: number } | null;
  const m2 = sp?.superficie_m2 == null ? null : Number(sp.superficie_m2);
  const n = sp?.lat != null && sp?.lng != null && m2 ? await arriendosDeSuTamano(admin, { lat: Number(sp.lat), lng: Number(sp.lng), radio: arr?.radio ?? 1000, m2 }) : 0;
  const confiable = n >= MIN_ARRIENDOS_COMPARABLES;
  const uf = Number(cfg?.value);
  const cap = confiable ? capRatePct(arr?.monto ?? null, Number(ae?.precio_uf ?? 0), Number.isFinite(uf) && uf > 0 ? uf : null) : null;
  const flujo = confiable && typeof ae?.flujo_20 === "number" ? (ae.flujo_20 as number) : null;
  return {
    leidoAt: d.leido_at as string,
    entrada: {
      fotos, titulo: (sp?.titulo as string | null) ?? null, descripcion: (d.descripcion as string | null) ?? null,
      datos: {
        comuna: (sp?.comuna as string | null) ?? null, dormitorios: (sp?.dormitorios as number | null) ?? null, banos: (sp?.banos as number | null) ?? null,
        superficie_m2: sp?.superficie_m2 == null ? null : Number(sp.superficie_m2), antiguedad: anio ? { anio } : "no informada",
        metro: est ? { estacion: est.station.name, a_pie: est.distance <= 1000 } : null,
      },
      tarjeta: { veredicto, cap_rate_bruto: cap != null ? pctUno(cap) : null, al_mes: flujo != null ? textoAlMes({ flujoCLP: flujo }).t : null },
      cifras: confiable ? { capRatePct: cap, flujoCLP: flujo } : null,
    },
  };
}

/** La lectura de un depto: la guardada si está vigente; si no, la genera (con su tope y su marca). `leerSiFalta`: si la publicación
 *  todavía no se leyó, quien llama la lee (por el carril de Invierte, 20-nov-2026) antes de escribir la lectura. */
export async function lecturaDe(admin: SupabaseClient, cliente: Anthropic, avisoId: string, ahora: Date = new Date(), leerSiFalta?: () => Promise<void>): Promise<EstadoLectura> {
  const [{ data: fila }, { data: det }] = await Promise.all([
    admin.from(T).select("aviso_id, estado, version, lectura, detalle_leido_at, updated_at, error").eq("aviso_id", avisoId).maybeSingle(),
    admin.from("publicacion_detalle").select("leido_at").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = fila as FilaLectura | null;
  const vigente = f && f.estado === "lista" && f.version === VERSION_LECTURA && (!det?.leido_at || !f.detalle_leido_at || f.detalle_leido_at >= (det.leido_at as string));
  if (vigente) { const l = sanearLectura(f.lectura); if (l) return { estado: "lista", lectura: l }; }
  if (f?.estado === "generando" && ahora.getTime() - new Date(f.updated_at).getTime() < GENERANDO_VENCE_MS) return { estado: "generando" };
  // En error (de la versión vigente y de esta lectura de la publicación): se reintenta solo con espera y tope; si no, sigue en error.
  const errorVigente = f?.estado === "error" && f.version === VERSION_LECTURA && (!det?.leido_at || !f.detalle_leido_at || f.detalle_leido_at >= (det.leido_at as string));
  if (errorVigente && !reintentable(f, ahora)) return { estado: "error" };
  const intento = errorVigente ? intentosDe(f.error) + 1 : 1;
  if (!det && !leerSiFalta) return { estado: "sin-datos" };
  const desde = new Date(ahora.getTime() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from(T).select("aviso_id", { count: "exact", head: true }).gte("generado_at", desde);
  if (count == null || count >= TOPE_LECTURAS_POR_HORA) return { estado: "tope" };
  // La marca va antes de leer la publicación: otra pantalla que pida este depto espera («generando») en vez de leerlo de nuevo.
  const marca = await admin.from(T).upsert({ aviso_id: avisoId, estado: "generando", version: VERSION_LECTURA, updated_at: ahora.toISOString() }, { onConflict: "aviso_id" });
  if (marca.error) return { estado: "error" };
  if (!det && leerSiFalta) await leerSiFalta().catch(() => undefined);
  const e = await entradaDe(admin, avisoId);
  if (!e) {
    await admin.from(T).update({ estado: "error", error: textoError(intento, "sin-datos", "la publicación no tiene fotos ni texto guardados"), updated_at: new Date().toISOString() }).eq("aviso_id", avisoId);
    return { estado: "sin-datos" };
  }
  const r = await generarLecturaFranco(cliente, e.entrada);
  const fin = new Date().toISOString();
  if (!r.ok) {
    await admin.from(T).update({ estado: "error", error: textoError(intento, r.motivo, r.detalle), detalle_leido_at: e.leidoAt, updated_at: fin }).eq("aviso_id", avisoId);
    return { estado: "error" };
  }
  const { error } = await admin.from(T).update({
    estado: "lista", version: VERSION_LECTURA, lectura: r.lectura, alerta_nivel: r.lectura.alerta.nivel, modelo: r.modelo, costo_usd: r.costoUsd,
    ms: r.ms, detalle_leido_at: e.leidoAt, error: null, generado_at: fin, updated_at: fin,
  }).eq("aviso_id", avisoId);
  if (error) return { estado: "error" };
  // Las líneas que el saneado borró (20-nov-2026), aparte: si la columna todavía no existe (20261126_lecturas_franco_descartes),
  // la lectura ya quedó guardada y no se pierde; el log igual las tiene.
  await admin.from(T).update({ descartes: r.descartes }).eq("aviso_id", avisoId).then(() => undefined, () => undefined);
  return { estado: "lista", lectura: r.lectura };
}
