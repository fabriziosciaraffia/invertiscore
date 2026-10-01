// ─────────────────────────────────────────────────────────────────────────────
// La guía de búsqueda del lado del servidor (30-sep-2026): del informe de origen salen los números de
// la persona —pie, plazo, tasa— y el depto contra el que se buscan parecidos; los candidatos salen de
// `guia_candidatos` (avisos evaluados por el cron, sin sospechosos) y se RECALCULAN con esos números.
//
// SIN CONSULTAS EN VIVO por candidato: el arriendo, la venta, los gastos y la mediana comunal salen de la
// fila evaluada (`avisos_evaluados`). Y con la SONDA del motor (`sondaConPatch` sin parche: métricas, TIR,
// puntaje y gates), no con runAnalysis entero: la guía solo muestra lo que convienen, y un Comprar solo
// puede salir de un Comprar del puntaje —después vienen el rescate (Buscar → Ajustar) y el filtro del
// descuento (Ajustar → Buscar), que no tocan Comprar—. Medido el 30-sep-2026 en 450 pares candidato ×
// combinación: mismo Comprar, mismo puntaje y mismo flujo que runAnalysis, a 1,1 ms contra 96,5 ms.
//
// La guía se guarda por informe (`guias_calculadas`): se calcula al confirmarse el pago del pack y la
// pantalla la lee hecha; si todavía no está, la calcula ella.
//
// SOLO PUBLICADOS (01-oct-2026): al armarla se chequea la ficha de los mejores, de a uno, hasta juntar tres
// publicados (`MAX_LECTURAS_GUIA` GETs como mucho; un chequeo se recuerda 24 horas). Si ninguno se
// pudo chequear, no hay guía: la pantalla cae a la de siempre y no se guarda nada.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { sondaConPatch } from "@/lib/analysis";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import type { SubmitContext } from "@/components/formulario-v4/wizardV4Payload";
import { payloadDeAviso, respuestasDeAviso, type AvisoParaEvaluar, type FilaEvaluacion } from "@/lib/avisos/evaluar-aviso";
import type { RazonSinCapital } from "@/lib/types";
import {
  MAX_CANDIDATOS_GUIA, RADIOS_GUIA_M, VENTANA_GUIA_DIAS, combinacionesGuia, elegirGuia, rangoParecido, textoDistancia,
  type CandidatoBase, type Combinacion, type Evaluado, type ResultadoGuia,
} from "./seleccion";
import { MAX_LECTURAS_GUIA, chequearPublicacion, type EstadoPublicacion } from "./publicacion";
import { almacenPublicacion, bajarFicha } from "./ficha-servidor";
import { claveEdificio } from "./ficha-anio";

export interface OrigenGuia {
  analysisId: string;
  userId: string | null;
  comuna: string;
  lat: number;
  lng: number;
  m2: number;
  precioUF: number;
  dormitorios: number;
  piePct: number;
  plazoAnios: number;
  tasa: number;
  tasaMercado: number | null;
  razonSinPie: RazonSinCapital | null;
}

export interface CandidatoGuia extends CandidatoBase {
  comuna: string;
  lat: number;
  lng: number;
  m2: number;
  dormitorios: number;
  banos: number;
  condicion: "usado" | "nuevo";
  direccion: string | null;
  fechaEntrega: string | null;
  url: string | null;
  precioUF: number;
  antiguedadAnios: number | null;
  antiguedadOrigen: string | null;
  arriendo: FilaEvaluacion["arriendo"];
  venta: FilaEvaluacion["venta"] | null;
  gastosComunes: number | null;
  /** La mediana comunal guardada en la evaluación; null en filas anteriores a la columna. */
  medianaComuna: unknown | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** El informe de origen, si es de renta larga y trae con qué buscar. */
export async function leerOrigenGuia(admin: SupabaseClient, analysisId: string): Promise<OrigenGuia | null> {
  const { data } = await admin.from("analisis").select("id, user_id, tipo_analisis, comuna, input_data").eq("id", analysisId).maybeSingle();
  if (!data || data.tipo_analisis !== "long-term") return null;
  const i = (data.input_data ?? {}) as Record<string, unknown> & { zonaRadio?: { lat?: unknown; lng?: unknown } };
  const lat = num(i.zonaRadio?.lat), lng = num(i.zonaRadio?.lng);
  const m2 = num(i.superficie), precioUF = num(i.precio), dormitorios = num(i.dormitorios);
  const piePct = num(i.piePct), plazo = num(i.plazoCredito), tasa = num(i.tasaInteres);
  if (lat == null || lng == null || !m2 || !precioUF || dormitorios == null || piePct == null || !plazo || !tasa) return null;
  return {
    analysisId: data.id as string,
    userId: (data.user_id as string | null) ?? null,
    comuna: String(i.comuna ?? data.comuna ?? ""),
    lat, lng, m2, precioUF, dormitorios, piePct,
    plazoAnios: plazo,
    tasa,
    tasaMercado: num(i.tasaMercado),
    razonSinPie: (i.razonSinPie as RazonSinCapital | undefined) ?? null,
  };
}

type FilaRpc = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  condicion: string; direccion: string | null; fecha_entrega: string | null; url: string | null; distance_meters: number;
  precio_uf: number; antiguedad_anios: number | null; antiguedad_origen: string | null;
  arriendo: FilaEvaluacion["arriendo"]; venta: FilaEvaluacion["venta"] | null; gastos_comunes: number | null;
  mediana_comuna: unknown | null;
};

/** Los parecidos del origen, los más cercanos primero, hasta el radio mayor. Sin el mismo depto. */
export async function candidatosGuia(admin: SupabaseClient, o: OrigenGuia): Promise<CandidatoGuia[]> {
  const r = rangoParecido(o);
  const desde = new Date(Date.now() - VENTANA_GUIA_DIAS * 864e5).toISOString().replace("Z", "");
  const { data, error } = await admin.rpc("guia_candidatos", {
    center_lat: o.lat, center_lng: o.lng, radius_meters: RADIOS_GUIA_M[RADIOS_GUIA_M.length - 1], prop_dorms: o.dormitorios,
    m2_min: r.m2Min, m2_max: r.m2Max, uf_min: r.ufMin, uf_max: r.ufMax, desde, max_filas: MAX_CANDIDATOS_GUIA,
  });
  if (error) throw new Error(`guia_candidatos: ${error.message}`);
  return ((data ?? []) as FilaRpc[])
    .map((f) => ({
      avisoId: f.id,
      distanciaM: Number(f.distance_meters),
      comuna: f.comuna,
      lat: Number(f.lat),
      lng: Number(f.lng),
      m2: Number(f.superficie_m2),
      dormitorios: Number(f.dormitorios),
      banos: Number(f.banos) || 1,
      condicion: (f.condicion === "nuevo" ? "nuevo" : "usado") as "usado" | "nuevo",
      direccion: f.direccion,
      fechaEntrega: f.fecha_entrega,
      url: f.url,
      precioUF: Number(f.precio_uf),
      antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
      antiguedadOrigen: f.antiguedad_origen,
      arriendo: f.arriendo,
      venta: f.venta,
      gastosComunes: f.gastos_comunes,
      medianaComuna: f.mediana_comuna ?? null,
    }))
    // El mismo depto que la persona analizó (mismo lugar, precio y m²) no es un parecido.
    .filter((c) => !(c.distanciaM < 25 && Math.abs(c.precioUF - o.precioUF) < 1 && Math.abs(c.m2 - o.m2) < 1));
}

export function avisoDeCandidato(c: CandidatoGuia, antiguedadAnios: number | null = c.antiguedadAnios): AvisoParaEvaluar {
  return {
    id: c.avisoId, comuna: c.comuna, lat: c.lat, lng: c.lng, precioUF: c.precioUF, m2: c.m2, dormitorios: c.dormitorios,
    banos: c.banos, condicion: c.condicion, direccion: c.direccion, fechaEntrega: c.fechaEntrega, antiguedadAnios,
  };
}

/** El contexto del wizard desde lo que la fila evaluada ya resolvió (sin volver a pedir sugerencias). */
export function contextoDeFila(c: CandidatoGuia, cfg: { uf: number; tasa: number }): SubmitContext | null {
  const a = c.arriendo;
  if (!a) return null;
  const fuenteArr = a.radioFuente === "radio" || a.radioFuente === "comuna" || a.radioFuente === "comuna-m2" ? a.radioFuente : "sin-dato";
  const v = c.venta;
  return {
    ufCLP: cfg.uf,
    tasaMercado: cfg.tasa,
    arriendoSugerido: a.monto,
    arriendoN: a.n,
    arriendoFuente: fuenteArr,
    arriendoRango: null,
    muestraArriendo: null,
    precioM2UF: v?.precioM2UF ?? null,
    radiusUsed: a.radio,
    ggccSugerido: c.gastosComunes,
    ventaN: v?.n ?? 0,
    ventaFuente: v?.fuente === "radio" || v?.fuente === "comuna" ? v.fuente : "sin-dato",
    ventaUniverso: (v?.universo as SubmitContext["ventaUniverso"]) ?? null,
    ventaRadio: v?.radio ?? null,
  };
}

/** La guía para un informe de origen. `enVivo` cuenta los candidatos sin mediana guardada (filas viejas). */
export async function guiaPara(admin: SupabaseClient, o: OrigenGuia, cfg: { uf: number; tasa: number }): Promise<ResultadoGuia<CandidatoGuia> & { enVivo: number; lecturas: number }> {
  const candidatos = await candidatosGuia(admin, o);
  const asOf = new Date();
  const enVivo = new Map<string, Promise<unknown>>();
  const evaluar = async (c: CandidatoGuia, combo: Combinacion): Promise<Evaluado | null> => {
    const ctx = contextoDeFila(c, cfg);
    if (!ctx || !c.arriendo) return null;
    const body = payloadDeAviso(
      respuestasDeAviso(avisoDeCandidato(c), combo.piePct, o.tasa, c.arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }),
      ctx,
    );
    // La mediana guardada en la evaluación; solo una fila anterior a la columna la pide en vivo, una vez.
    let mediana = c.medianaComuna;
    if (mediana == null) {
      if (!enVivo.has(c.avisoId)) enVivo.set(c.avisoId, prefetchMedianaComunaVenta(admin as never, body as never, cfg.uf).catch(() => undefined));
      mediana = await enVivo.get(c.avisoId);
    }
    const s = sondaConPatch(body as never, cfg.uf, mediana as never, asOf, {});
    return {
      veredicto: s.veredicto,
      score: s.score != null ? Math.round(s.score) : null,
      flujo: s.metricas?.flujoMensual != null ? Math.round(s.metricas.flujoMensual) : null,
    };
  };
  // La ficha, de a uno y solo para los que la guía mostraría; con presupuesto de lecturas por guía.
  const almacen = almacenPublicacion(admin);
  let lecturas = 0, bloqueada = false;
  const publicado = async (c: CandidatoGuia): Promise<EstadoPublicacion> => {
    const r = await chequearPublicacion(
      { id: c.avisoId, url: c.url, edificio: claveEdificio(c) }, "guia", almacen, bajarFicha,
      { sinLeer: bloqueada || lecturas >= MAX_LECTURAS_GUIA },
    );
    lecturas += r.lectura?.gets ?? 0;
    if (r.lectura?.leida && r.lectura.motivo === "bloqueo") bloqueada = true;
    return r.estado;
  };
  const g = await elegirGuia(candidatos, combinacionesGuia({ piePct: o.piePct, plazoAnios: o.plazoAnios, razonSinPie: o.razonSinPie }), evaluar, publicado);
  return { ...g, enVivo: enVivo.size, lecturas };
}

/** Lo que la pantalla muestra y nada más: sin enlace al aviso ni textos del aviso. */
export function respuestaGuia(o: OrigenGuia, g: ResultadoGuia<CandidatoGuia>) {
  return {
    disponible: true as const,
    estado: g.estado,
    origen: { tipologia: tipologiaDe(o.dormitorios, null), m2: Math.round(o.m2), precioUF: Math.round(o.precioUF) },
    combinacion: g.combinacion,
    radioM: g.radioM,
    items: g.items.map(({ c, ev }) => ({
      avisoId: c.avisoId,
      comuna: c.comuna,
      tipologia: tipologiaDe(c.dormitorios, c.banos),
      m2: Math.round(c.m2),
      precioUF: Math.round(c.precioUF),
      distancia: textoDistancia(c.distanciaM),
      veredicto: ev.veredicto,
      score: ev.score,
      flujo: ev.flujo,
    })),
  };
}
export type RespuestaGuiaServidor = ReturnType<typeof respuestaGuia> | { disponible: false };

/** Cuánto vale una guía guardada: los avisos se refrescan por semana, los precios cambian por día. */
export const VIGENCIA_GUIA_MS = 12 * 60 * 60 * 1000;

/** Calcula la guía del informe y la guarda (`guias_calculadas`). La llaman la confirmación del pago del
 *  pack —para que esté lista cuando la persona llega— y la pantalla si todavía no está. */
export async function calcularYGuardarGuia(admin: SupabaseClient, analysisId: string): Promise<RespuestaGuiaServidor> {
  const t0 = Date.now();
  const o = await leerOrigenGuia(admin, analysisId);
  if (!o) return { disponible: false };
  const cfg = await leerConfigGuia(admin);
  const g = await guiaPara(admin, o, cfg);
  // Sin ningún publicado y con avisos que no se pudieron chequear, no se sabe: sin guía, y sin guardar.
  if (g.estado === "ninguno" && g.sinChequeo > 0) return { disponible: false };
  const resultado = respuestaGuia(o, g);
  const { error } = await admin.from("guias_calculadas").upsert({ analysis_id: analysisId, resultado, calculada_at: new Date().toISOString(), ms: Date.now() - t0 }, { onConflict: "analysis_id" });
  if (error) console.error("[guia] no se guardó:", error.message);
  return resultado;
}

/** La guía guardada del informe, si está vigente. */
export async function guiaGuardada(admin: SupabaseClient, analysisId: string): Promise<RespuestaGuiaServidor | null> {
  const { data } = await admin.from("guias_calculadas").select("resultado, calculada_at").eq("analysis_id", analysisId).maybeSingle();
  if (!data || Date.now() - new Date(data.calculada_at as string).getTime() > VIGENCIA_GUIA_MS) return null;
  const resultado = data.resultado as RespuestaGuiaServidor;
  // Si uno de sus avisos se despublicó después (lo vio otra guía o un clic), se arma de nuevo.
  const ids = resultado.disponible ? resultado.items.map((it) => it.avisoId) : [];
  if (ids.length > 0) {
    const { data: idas, error } = await admin.from("publicacion_avisos").select("aviso_id").in("aviso_id", ids).eq("estado", "despublicado");
    if (error || (idas?.length ?? 0) > 0) return null;
  }
  return resultado;
}

/** La UF y la tasa de mercado del día (config). */
export async function leerConfigGuia(admin: SupabaseClient): Promise<{ uf: number; tasa: number }> {
  const { data } = await admin.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const uf = m.get("uf_value"), tasa = m.get("tasa_hipotecaria");
  if (!(uf && uf > 0) || !(tasa && tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");
  return { uf, tasa };
}
