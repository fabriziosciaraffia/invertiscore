// ─────────────────────────────────────────────────────────────────────────────
// EL FLUJO DE CADA DEPTO, EN EL SERVIDOR (etapa 3, parte B1, 21-nov-2026).
//   · La ubicación confirmada (decisión de Fabrizio, 20-nov-2026): la persona de Franco carga la dirección y marca el punto en un mapa
//     (sin geocodificar); con esas coordenadas se REHACE el análisis del depto —la misma evaluación de la noche, `evaluarAviso`, con
//     el punto real— y queda en `inv_ubicaciones`, por depto (lo ven todas las personas que lo tengan). Nada se escribe en
//     scraped_properties, scraped_properties_precios ni avisos_evaluados, y no se lee ninguna ficha.
//   · Una sola fuente de números por depto: con ubicación confirmada, los del análisis rehecho (`numerosDe`); si no, los de la noche.
//     Al confirmar, la lectura de Franco del depto se rehace (se borra la guardada: la próxima vista la escribe con los números nuevos).
//   · El acuerdo con quien vende, y el paso de etapa (depto-flujo.ts › etapaSiguiente). La base lo impone también (trigger).
// Lo que hace la persona de Franco queda en la bitácora con su correo; la IA no mueve ninguna etapa.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisosEvaluables, type FilaAviso } from "@/lib/avisos/depurar";
import { evaluarAviso, VERSION_EVALUACION } from "@/lib/avisos/evaluar-aviso";
import { candidatoDeEvaluacion } from "@/lib/avisos/estandar-deptos";
import { cuerpoDeCandidato, negociarCandidato } from "@/lib/avisos/negociar";
import { arriendosDeSuTamano } from "./lectura-franco-servidor";
import type { MotorFijo } from "./cifras-motor";
import { capRatePct } from "@/lib/explorar/explorar";
import { etapaConPreaprobacion, etapaDe, etapaSiguiente, ubicacionConviene, FUENTES_RESPUESTA, type Acuerdo, type Etapa, type FuenteRespuesta, type PreguntaDepto } from "./depto-flujo";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import { anotar, ultimaOrdenDe } from "./servidor";
import { UMBRAL_MES_CLP } from "./detalles-modo";

const T_DEPTOS = "inv_deptos";
const T_UBIC = "inv_ubicaciones";

/** ¿El cálculo con la ubicación confirmada cambió lo bastante para dejar una línea en «Cambios en la publicación»? (22-nov-2026,
 *  Fabrizio): si cambia el veredicto, o lo que deja al mes cambia más que el umbral de los indicadores (UMBRAL_MES_CLP, $20.000).
 *  Las diferencias menores por los datos del día actualizan el número sin dejar línea. */
export function cambioDeUbicacionRelevante(antes: { veredicto: string | null; flujoCLP: number | null } | null, despues: { veredicto: string | null; flujoCLP: number | null }): boolean {
  if (!antes) return false;
  if ((antes.veredicto ?? null) !== (despues.veredicto ?? null)) return true;
  if (antes.flujoCLP == null || despues.flujoCLP == null) return false;
  return Math.abs(despues.flujoCLP - antes.flujoCLP) > UMBRAL_MES_CLP;
}

export interface AnalisisUbicacion {
  veredicto: string | null; score: number | null; flujoCLP: number | null; arriendoCLP: number | null; capRatePct: number | null; precioUF: number; radio: number | null; n: number | null;
  /** Los datos fijos del motor (23-nov-2026): con ellos, las cifras a cualquier precio salen de la misma sonda (cifras-motor.ts). */
  motor?: MotorFijo | null;
  /** Arriendos activos de su tamaño en el radio del motor, contados hasta MIN_ARRIENDOS_COMPARABLES: con menos, la marca gris. */
  comparables?: number | null;
}
export interface Ubicacion { avisoId: string; direccion: string; numero: string | null; lat: number; lng: number; distanciaM: number | null; analisis: AnalisisUbicacion | null; precioComprarUF: number | null; cargadaAt: string }

const n = (v: unknown): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function aUbicacion(f: Record<string, unknown>): Ubicacion {
  return {
    avisoId: f.aviso_id as string, direccion: f.direccion as string, numero: (f.numero as string | null) ?? null, lat: Number(f.lat), lng: Number(f.lng),
    distanciaM: n(f.distancia_m), analisis: (f.analisis as AnalisisUbicacion | null) ?? null, precioComprarUF: n(f.precio_comprar_uf), cargadaAt: f.cargada_at as string,
  };
}

export async function leerUbicaciones(admin: SupabaseClient, avisoIds: readonly string[]): Promise<Record<string, Ubicacion>> {
  const ids = Array.from(new Set(avisoIds)).slice(0, 100);
  if (!ids.length) return {};
  const { data } = await admin.from(T_UBIC).select("aviso_id, direccion, numero, lat, lng, distancia_m, analisis, precio_comprar_uf, cargada_at").in("aviso_id", ids);
  return Object.fromEntries(((data ?? []) as Record<string, unknown>[]).map((f) => [f.aviso_id as string, aUbicacion(f)]));
}

/** Los números de un depto: con ubicación confirmada, los del análisis rehecho; si no, los que ya traía. */
export function numerosDe<T extends { precioUF?: number; veredicto?: string | null; score?: number | null; flujoCLP?: number | null }>(d: T, u: Ubicacion | null | undefined): T {
  const a = u?.analisis;
  if (!a) return d;
  return { ...d, veredicto: a.veredicto ?? d.veredicto, score: a.score ?? d.score, flujoCLP: a.flujoCLP ?? d.flujoCLP };
}

async function leerConfig(admin: SupabaseClient): Promise<{ uf: number; tasa: number } | null> {
  const { data } = await admin.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, Number(r.value)]));
  const uf = m.get("uf_value"), tasa = m.get("tasa_hipotecaria");
  return uf && uf > 0 && tasa && tasa > 0 ? { uf, tasa } : null;
}

/** Distancia en metros entre dos puntos (haversine). */
export function metros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** EL ANÁLISIS REHECHO: la evaluación de la noche del depto, con las coordenadas confirmadas. Para un Ajusta supuestos, además el
 *  precio al que vuelve a Comprar (la misma regla de «Negociar»: pie 20 %, 30 años). */
export async function reanalizar(admin: SupabaseClient, avisoId: string, punto: { lat: number; lng: number }): Promise<{ ok: true; analisis: AnalisisUbicacion; precioComprarUF: number | null; pin: { lat: number; lng: number } | null } | { ok: false; error: "depto" | "config" | "arriendo" }> {
  const [{ data: sp }, { data: ae }, cfg] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at, seen_pass_id").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("avisos_evaluados").select("antiguedad_anios, antiguedad_origen").eq("aviso_id", avisoId).maybeSingle(),
    leerConfig(admin),
  ]);
  if (!cfg) return { ok: false, error: "config" };
  if (!sp) return { ok: false, error: "depto" };
  const [base] = avisosEvaluables([sp as FilaAviso], cfg.uf);
  if (!base) return { ok: false, error: "depto" };
  const conocida = ae?.antiguedad_origen === "ficha" || ae?.antiguedad_origen === "edificio";
  const aviso = { ...base, lat: punto.lat, lng: punto.lng, antiguedadAnios: conocida && typeof ae?.antiguedad_anios === "number" ? (ae.antiguedad_anios as number) : base.antiguedadAnios };
  const { sug: _sug, ...fila } = await evaluarAviso(admin, aviso, cfg, { segmentar: false });
  void _sug;
  if (!fila.arriendo) return { ok: false, error: "arriendo" };
  const candidato = candidatoDeEvaluacion(aviso, fila);
  const precioComprarUF = fila.veredicto_20 === "AJUSTA SUPUESTOS" ? negociarCandidato(candidato, 20, cfg)?.p ?? null : null;
  // Los datos fijos del motor (la misma cuenta que el precio a Comprar) y los arriendos de su tamaño, contados una vez.
  const cuerpo = cuerpoDeCandidato(candidato, 20, cfg);
  const motor: MotorFijo | null = cuerpo ? { v: 1, cuerpo, mediana: candidato.medianaComuna ?? null, uf: cfg.uf, asOf: new Date().toISOString(), arriendoCLP: fila.arriendo.monto } : null;
  const m2 = sp.superficie_m2 == null ? null : Number(sp.superficie_m2);
  const comparables = m2 ? await arriendosDeSuTamano(admin, { lat: punto.lat, lng: punto.lng, radio: fila.arriendo.radio ?? 1000, m2 }) : null;
  const analisis: AnalisisUbicacion = {
    veredicto: fila.veredicto_20, score: fila.score_20, flujoCLP: fila.flujo_20, arriendoCLP: fila.arriendo.monto,
    capRatePct: capRatePct(fila.arriendo.monto, fila.precio_uf, cfg.uf), precioUF: fila.precio_uf, radio: fila.arriendo.radio, n: fila.arriendo.n,
    motor, comparables,
  };
  const pin = sp.lat != null && sp.lng != null ? { lat: Number(sp.lat), lng: Number(sp.lng) } : null;
  return { ok: true, analisis, precioComprarUF, pin };
}

export type ErrorUbicacion = "direccion" | "punto" | "depto" | "config" | "arriendo" | "guardar";

/** Valida lo que carga el admin: la dirección (sin número) y el punto dentro de Gran Santiago (la misma caja del check de la tabla). */
export function validarUbicacion(b: { direccion?: unknown; numero?: unknown; lat?: unknown; lng?: unknown }): { ok: true; direccion: string; numero: string | null; lat: number; lng: number } | { ok: false; error: "direccion" | "punto" } {
  const direccion = typeof b.direccion === "string" ? b.direccion.replace(/\s+/g, " ").trim() : "";
  if (direccion.length < 3 || direccion.length > 120) return { ok: false, error: "direccion" };
  const numero = typeof b.numero === "string" && b.numero.trim() ? b.numero.trim().slice(0, 20) : null;
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!(lat >= -34.2 && lat <= -33.0 && lng >= -71.2 && lng <= -70.3)) return { ok: false, error: "punto" };
  return { ok: true, direccion, numero, lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

/** CONFIRMAR LA UBICACIÓN (admin): guarda la dirección y el punto, rehace el análisis, deja la línea en «Cambios en la publicación» de
 *  quien lo tenga si los números cambiaron, rehace la lectura de Franco y avanza a cada persona que lo tiene en confirmando. */
export async function confirmarUbicacion(admin: SupabaseClient, quien: { id: string; email: string | null }, avisoId: string, pedido: unknown): Promise<{ ok: true; ubicacion: Ubicacion } | { ok: false; error: ErrorUbicacion }> {
  const v = validarUbicacion((pedido ?? {}) as Record<string, unknown>);
  if (!v.ok) return v;
  const r = await reanalizar(admin, avisoId, v);
  if (!r.ok) return r;
  const [{ data: noche }, { data: tienen }] = await Promise.all([
    admin.from("avisos_evaluados").select("veredicto_20, flujo_20").eq("aviso_id", avisoId).maybeSingle(),
    admin.from(T_DEPTOS).select("user_id, estado, es_prueba").eq("aviso_id", avisoId).in("estado", ["elegido", "opcion"]),
  ]);
  const ahora = new Date().toISOString();
  const esPrueba = (tienen ?? []).length > 0 && (tienen ?? []).every((t) => t.es_prueba === true);
  const fila = {
    aviso_id: avisoId, direccion: v.direccion, numero: v.numero, lat: v.lat, lng: v.lng, pin_lat: r.pin?.lat ?? null, pin_lng: r.pin?.lng ?? null,
    distancia_m: r.pin ? metros(r.pin, v) : null, cargada_por: quien.id, cargada_at: ahora, analisis: r.analisis, analisis_veredicto: r.analisis.veredicto,
    analisis_precio_uf: r.analisis.precioUF, precio_comprar_uf: r.precioComprarUF, analisis_motor_version: VERSION_EVALUACION, analisis_at: ahora, analisis_error: null, es_prueba: esPrueba,
  };
  const up = await admin.from(T_UBIC).upsert(fila, { onConflict: "aviso_id" });
  if (up.error) return { ok: false, error: "guardar" };
  // La lectura del depto se rehace con los números nuevos (se escribe sola la próxima vez que alguien la vea).
  await admin.from("lecturas_franco").delete().eq("aviso_id", avisoId);
  const cambio = cambioDeUbicacionRelevante(noche ? { veredicto: (noche.veredicto_20 as string | null) ?? null, flujoCLP: noche.flujo_20 == null ? null : Number(noche.flujo_20) } : null, r.analisis);
  for (const t of tienen ?? []) {
    if (cambio) {
      await admin.from("inv_cambios").insert({
        user_id: t.user_id, aviso_id: avisoId, tipo: "ubicacion", antes: { veredicto: noche?.veredicto_20 ?? null, flujoCLP: noche?.flujo_20 ?? null },
        despues: { veredicto: r.analisis.veredicto, flujoCLP: r.analisis.flujoCLP }, fecha: ahora.slice(0, 10), en_base: true, relevante: false, es_prueba: t.es_prueba === true,
      });
    }
    if (t.estado === "elegido") await avanzarDepto(admin, t.user_id as string, avisoId, quien);
  }
  await anotar(admin, { userId: null, email: null, actor: "admin", actorEmail: quien.email, accion: "ubicacion_confirmada", detalle: { aviso_id: avisoId, distancia_m: fila.distancia_m, veredicto: r.analisis.veredicto, precio_comprar_uf: r.precioComprarUF }, esPrueba });
  return { ok: true, ubicacion: aUbicacion(fila as unknown as Record<string, unknown>) };
}

/** EL ACUERDO CON QUIEN VENDE (admin). Sin acuerdo, el depto no avanza (con la alternativa que elija la persona de Franco, si hay). */
export async function registrarAcuerdo(admin: SupabaseClient, quien: { id: string; email: string | null }, userId: string, avisoId: string, acuerdo: unknown, alternativa: unknown): Promise<{ ok: true; etapa: Etapa | null } | { ok: false; error: "acuerdo" | "depto" | "guardar" }> {
  if (acuerdo !== "con_acuerdo" && acuerdo !== "sin_acuerdo" && acuerdo !== "pendiente") return { ok: false, error: "acuerdo" };
  const { data: d } = await admin.from(T_DEPTOS).select("estado, etapa, es_prueba").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  if (!d || d.estado !== "elegido") return { ok: false, error: "depto" };
  const alt = typeof alternativa === "string" && /^[0-9a-f-]{36}$/i.test(alternativa.trim()) ? alternativa.trim() : null;
  const ahora = new Date().toISOString();
  const r = await admin.from(T_DEPTOS).update({ acuerdo, acuerdo_at: ahora, acuerdo_por: quien.id, alternativa_aviso_id: alt, updated_at: ahora }).eq("user_id", userId).eq("aviso_id", avisoId);
  if (r.error) return { ok: false, error: "guardar" };
  const orden = await ultimaOrdenDe(admin, userId);
  await anotar(admin, { userId, email: orden?.email ?? null, ordenId: orden?.id ?? null, actor: "admin", actorEmail: quien.email, accion: "acuerdo_registrado", detalle: { aviso_id: avisoId, acuerdo, alternativa: alt }, esPrueba: d.es_prueba === true });
  return { ok: true, etapa: await avanzarDepto(admin, userId, avisoId, quien) };
}

/** Pasa de etapa un depto en confirmando si ya se sabe adónde (depto-flujo.ts › etapaSiguiente). Devuelve la etapa que queda. */
export async function avanzarDepto(admin: SupabaseClient, userId: string, avisoId: string, quien: { email: string | null } | null = null): Promise<Etapa | null> {
  const [{ data: d }, ubic, pre] = await Promise.all([
    admin.from(T_DEPTOS).select("estado, etapa, acuerdo, es_prueba").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle(),
    leerUbicaciones(admin, [avisoId]),
    leerPreaprobacion(admin, userId),
  ]);
  if (!d) return null;
  const actual = etapaDe({ estado: d.estado as string, etapa: (d.etapa as string | null) ?? null });
  if (actual !== "confirmando") return actual;
  const u = ubic[avisoId] ?? null;
  const sig = etapaSiguiente({ acuerdo: (d.acuerdo as Acuerdo | null) ?? null, ubicacion: u?.analisis ? { veredicto: u.analisis.veredicto, precioComprarUF: u.precioComprarUF } : null, preaprobacion: pre.estado });
  if (!sig) return actual;
  const ahora = new Date().toISOString();
  const r = await admin.from(T_DEPTOS).update({ etapa: sig.etapa, etapa_at: ahora, no_avanza_motivo: sig.motivo ?? null, updated_at: ahora }).eq("user_id", userId).eq("aviso_id", avisoId);
  if (r.error) { console.error("[inv2] avanzar depto:", r.error.message); return actual; }
  await anotar(admin, { userId, email: null, actor: quien ? "admin" : "sistema", actorEmail: quien?.email ?? null, accion: "depto_etapa", detalle: { aviso_id: avisoId, de: actual, a: sig.etapa, motivo: sig.motivo ?? null }, esPrueba: d.es_prueba === true });
  return sig.etapa;
}

/** Cuando cambia la preaprobación de una persona: sus deptos que esperaban pasan a listo (y al revés si dejó de servir). */
export async function ajustarPorPreaprobacion(admin: SupabaseClient, userId: string): Promise<number> {
  const [{ data }, pre] = await Promise.all([
    admin.from(T_DEPTOS).select("aviso_id, etapa, es_prueba").eq("user_id", userId).eq("estado", "elegido").in("etapa", ["sin_preaprobacion", "listo"]),
    leerPreaprobacion(admin, userId),
  ]);
  let movidos = 0;
  const ahora = new Date().toISOString();
  for (const d of data ?? []) {
    const nueva = etapaConPreaprobacion(d.etapa as Etapa, pre.estado);
    if (nueva === d.etapa) continue;
    const r = await admin.from(T_DEPTOS).update({ etapa: nueva, etapa_at: ahora, updated_at: ahora }).eq("user_id", userId).eq("aviso_id", d.aviso_id as string);
    if (!r.error) movidos++;
  }
  return movidos;
}

/** Cada cuánto se rehace el análisis aunque nada cambie (config `invierte_reanalisis_dias`, 7 por defecto). */
export const REANALISIS_DIAS = 7;
/** Cuántos se rehacen por corrida de la vigilancia (cada uno lee el radio: unos segundos). */
export const MAX_REANALISIS_POR_CORRIDA = 10;

/** ¿Toca rehacer el análisis? Si cambió el precio publicado (más de UF 0,5), la versión del motor, o pasó la semana. */
export function reanalisisVencido(u: { analisis_precio_uf: number | null; analisis_motor_version: string | null; analisis_at: string | null }, precioUF: number | null, ahora: Date, dias = REANALISIS_DIAS): boolean {
  if (!u.analisis_at) return true;
  if (precioUF != null && (u.analisis_precio_uf == null || Math.abs(precioUF - u.analisis_precio_uf) > 0.5)) return true;
  if (u.analisis_motor_version !== VERSION_EVALUACION) return true;
  return ahora.getTime() - new Date(u.analisis_at).getTime() >= dias * 864e5;
}

/** LA MAÑANA (cron invierte-vigilar): rehace los análisis con ubicación confirmada que vencieron. Si los números cambian, deja la línea en
 *  «Cambios en la publicación» de quien lo tiene; si el depto dejó de convenir y esperaba (sin preaprobación o listo), no avanza. */
export async function reanalizarVencidas(admin: SupabaseClient, ahora: Date = new Date()): Promise<{ revisados: number; rehechos: number; fallidos: number }> {
  const { data } = await admin.from(T_UBIC).select("aviso_id, lat, lng, analisis, analisis_precio_uf, analisis_motor_version, analisis_at").order("analisis_at", { ascending: true, nullsFirst: true }).limit(200);
  const filas = (data ?? []) as { aviso_id: string; lat: number; lng: number; analisis: AnalisisUbicacion | null; analisis_precio_uf: number | null; analisis_motor_version: string | null; analisis_at: string | null }[];
  if (!filas.length) return { revisados: 0, rehechos: 0, fallidos: 0 };
  const { data: ev } = await admin.from("avisos_evaluados").select("aviso_id, precio_uf").in("aviso_id", filas.map((f) => f.aviso_id));
  const precio = new Map(((ev ?? []) as { aviso_id: string; precio_uf: number | null }[]).map((e) => [e.aviso_id, e.precio_uf == null ? null : Number(e.precio_uf)]));
  let rehechos = 0, fallidos = 0;
  for (const f of filas.filter((x) => reanalisisVencido(x, precio.get(x.aviso_id) ?? null, ahora)).slice(0, MAX_REANALISIS_POR_CORRIDA)) {
    const r = await reanalizar(admin, f.aviso_id, { lat: Number(f.lat), lng: Number(f.lng) }).catch(() => null);
    const fin = new Date().toISOString();
    if (!r || !r.ok) {
      fallidos++;
      await admin.from(T_UBIC).update({ analisis_error: r && !r.ok ? r.error : "error", analisis_at: fin }).eq("aviso_id", f.aviso_id);
      continue;
    }
    await admin.from(T_UBIC).update({ analisis: r.analisis, analisis_veredicto: r.analisis.veredicto, analisis_precio_uf: r.analisis.precioUF, precio_comprar_uf: r.precioComprarUF, analisis_motor_version: VERSION_EVALUACION, analisis_at: fin, analisis_error: null }).eq("aviso_id", f.aviso_id);
    rehechos++;
    const antes = f.analisis;
    const cambio = cambioDeUbicacionRelevante(antes, r.analisis);
    const { data: tienen } = await admin.from(T_DEPTOS).select("user_id, estado, etapa, es_prueba").eq("aviso_id", f.aviso_id).in("estado", ["elegido", "opcion"]);
    for (const t of tienen ?? []) {
      if (cambio) await admin.from("inv_cambios").insert({ user_id: t.user_id, aviso_id: f.aviso_id, tipo: "ubicacion", antes: { veredicto: antes?.veredicto ?? null, flujoCLP: antes?.flujoCLP ?? null }, despues: { veredicto: r.analisis.veredicto, flujoCLP: r.analisis.flujoCLP }, fecha: fin.slice(0, 10), en_base: true, relevante: false, es_prueba: t.es_prueba === true });
      if (t.estado === "elegido" && (t.etapa === "listo" || t.etapa === "sin_preaprobacion") && !ubicacionConviene({ veredicto: r.analisis.veredicto, precioComprarUF: r.precioComprarUF })) {
        await admin.from(T_DEPTOS).update({ etapa: "no_avanza", no_avanza_motivo: "dejo_de_convenir", etapa_at: fin, updated_at: fin }).eq("user_id", t.user_id as string).eq("aviso_id", f.aviso_id);
        await anotar(admin, { userId: t.user_id as string, email: null, actor: "sistema", accion: "depto_etapa", detalle: { aviso_id: f.aviso_id, de: t.etapa, a: "no_avanza", motivo: "dejo_de_convenir" }, esPrueba: t.es_prueba === true });
      }
    }
  }
  return { revisados: filas.length, rehechos, fallidos };
}

// ── LO QUE FRANCO AVERIGUÓ (B2, 22-nov-2026): las preguntas de la lectura (y las del admin), POR DEPTO ─────────
const T_PREG = "inv_preguntas";

function aPregunta(f: Record<string, unknown>): PreguntaDepto {
  return { id: f.id as string, pregunta: f.pregunta as string, enviadaAt: (f.enviada_at as string | null) ?? null, respuesta: (f.respuesta as string | null) ?? null, fuente: (f.respuesta_fuente as FuenteRespuesta | null) ?? null, respondidaAt: (f.respondida_at as string | null) ?? null };
}

/** Las preguntas de un depto (las que valen para todas las personas), en su orden. */
export async function leerPreguntas(admin: SupabaseClient, avisoId: string): Promise<PreguntaDepto[]> {
  const { data } = await admin.from(T_PREG).select("id, pregunta, enviada_at, respuesta, respuesta_fuente, respondida_at, orden, created_at").eq("aviso_id", avisoId).is("user_id", null).eq("visible", true).order("orden").order("created_at").limit(20);
  return ((data ?? []) as Record<string, unknown>[]).map(aPregunta);
}

/** Las preguntas que dejó la lectura se copian una vez por depto (el índice único las protege de un doble alta). */
export async function asegurarPreguntasDeLectura(admin: SupabaseClient, avisoId: string, preguntas: readonly string[], esPrueba: boolean): Promise<void> {
  if (!preguntas.length) return;
  const { count } = await admin.from(T_PREG).select("id", { count: "exact", head: true }).eq("aviso_id", avisoId).eq("origen", "lectura");
  if ((count ?? 0) > 0) return;
  const { error } = await admin.from(T_PREG).insert(preguntas.map((pregunta, orden) => ({ aviso_id: avisoId, user_id: null, origen: "lectura", pregunta, orden, es_prueba: esPrueba })));
  if (error && !/duplicate|unique/i.test(error.message)) console.error("[inv2] preguntas de la lectura:", error.message);
}

/** Admin: las pendientes de un depto quedan «preguntadas» hoy (Franco se las hizo a quien vende). */
export async function marcarPreguntasEnviadas(admin: SupabaseClient, quien: { email: string | null }, avisoId: string): Promise<{ ok: boolean; n: number }> {
  const { data, error } = await admin.from(T_PREG).update({ enviada_at: new Date().toISOString() }).eq("aviso_id", avisoId).is("enviada_at", null).is("respuesta", null).select("id");
  if (error) return { ok: false, n: 0 };
  await anotar(admin, { userId: null, email: null, actor: "admin", actorEmail: quien.email, accion: "preguntas_enviadas", detalle: { aviso_id: avisoId, n: (data ?? []).length }, esPrueba: false });
  return { ok: true, n: (data ?? []).length };
}

/** Admin: la respuesta de una pregunta, con su fuente. La carga una persona de Franco (queda su id). */
export async function responderPregunta(admin: SupabaseClient, quien: { id: string; email: string | null }, id: string, respuesta: unknown, fuente: unknown): Promise<{ ok: true } | { ok: false; error: "respuesta" | "fuente" | "guardar" }> {
  const r = typeof respuesta === "string" ? respuesta.replace(/\s+/g, " ").trim() : "";
  if (r.length < 2 || r.length > 300) return { ok: false, error: "respuesta" };
  if (!(FUENTES_RESPUESTA as readonly unknown[]).includes(fuente)) return { ok: false, error: "fuente" };
  const ahora = new Date().toISOString();
  const { data: previa } = await admin.from(T_PREG).select("enviada_at, aviso_id").eq("id", id).maybeSingle();
  const { error } = await admin.from(T_PREG).update({ respuesta: r, respuesta_fuente: fuente, respondida_at: ahora, respondida_por: quien.id, enviada_at: previa?.enviada_at ?? ahora }).eq("id", id);
  if (error) return { ok: false, error: "guardar" };
  await anotar(admin, { userId: null, email: null, actor: "admin", actorEmail: quien.email, accion: "pregunta_respondida", detalle: { aviso_id: previa?.aviso_id ?? null, id, fuente }, esPrueba: false });
  return { ok: true };
}

/** Admin: una pregunta más para quien vende (por depto). */
export async function agregarPregunta(admin: SupabaseClient, quien: { email: string | null }, avisoId: string, pregunta: unknown): Promise<{ ok: true } | { ok: false; error: "pregunta" | "guardar" }> {
  const t = typeof pregunta === "string" ? pregunta.replace(/\s+/g, " ").trim() : "";
  if (!/^¿[^¿?]{3,150}\?$/.test(t)) return { ok: false, error: "pregunta" };
  const { count } = await admin.from(T_PREG).select("id", { count: "exact", head: true }).eq("aviso_id", avisoId);
  const { error } = await admin.from(T_PREG).insert({ aviso_id: avisoId, user_id: null, origen: "admin", pregunta: t, orden: 100 + (count ?? 0) });
  if (error) return { ok: false, error: "guardar" };
  await anotar(admin, { userId: null, email: null, actor: "admin", actorEmail: quien.email, accion: "pregunta_agregada", detalle: { aviso_id: avisoId }, esPrueba: false });
  return { ok: true };
}

/** La mañana: un depto que sigue confirmando después de CONFIRMAR_DIAS_TAREA días deja una tarea interna (una sola por depto;
 *  lámina 4.1-confirmando: «si pasan 3 días sin confirmar, entra una tarea al CRM»). */
export const CONFIRMAR_DIAS_TAREA = 3;
export async function tareasConfirmacionAtrasada(admin: SupabaseClient, ahora: Date = new Date()): Promise<number> {
  const limite = new Date(ahora.getTime() - CONFIRMAR_DIAS_TAREA * 864e5).toISOString();
  const { data } = await admin.from(T_DEPTOS).select("user_id, aviso_id, etapa, es_prueba, elegido_at").eq("estado", "elegido").or("etapa.is.null,etapa.eq.confirmando").lt("elegido_at", limite).limit(200);
  let n = 0;
  for (const d of data ?? []) {
    const { count } = await admin.from("inv_tareas").select("id", { count: "exact", head: true }).eq("user_id", d.user_id as string).eq("aviso_id", d.aviso_id as string).eq("tipo", "confirmar_depto_atrasado");
    if ((count ?? 0) > 0) continue;
    const { error } = await admin.from("inv_tareas").insert({ user_id: d.user_id, tipo: "confirmar_depto_atrasado", aviso_id: d.aviso_id, estado: "pendiente", detalle: { elegido_at: d.elegido_at, dias: CONFIRMAR_DIAS_TAREA }, es_prueba: d.es_prueba === true });
    if (!error) n++;
  }
  return n;
}
