// ─────────────────────────────────────────────────────────────────────────────
// La guía de búsqueda del lado del servidor (30-sep-2026): del informe de origen salen los números de
// la persona —pie, plazo, tasa— y el depto contra el que se buscan parecidos; los candidatos salen de
// `guia_candidatos` (avisos evaluados por el cron, sin sospechosos) y se RECALCULAN con el motor con
// esos números, usando lo que la fila evaluada ya resolvió (arriendo, venta, gastos) para no volver a
// pedir sugerencias por cada uno. Solo lectura: no escribe nada.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/analysis";
import { readVeredicto } from "@/lib/results-helpers";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { buildLtrPayload, type SubmitContext } from "@/components/formulario-v4/wizardV4Payload";
import { respuestasDeAviso, type AvisoParaEvaluar, type FilaEvaluacion } from "@/lib/avisos/evaluar-aviso";
import type { RazonSinCapital } from "@/lib/types";
import {
  MAX_CANDIDATOS_GUIA, RADIOS_GUIA_M, VENTANA_GUIA_DIAS, combinacionesGuia, elegirGuia, rangoParecido,
  type CandidatoBase, type Combinacion, type Evaluado, type ResultadoGuia,
} from "./seleccion";

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

/** La guía para un informe de origen. */
export async function guiaPara(admin: SupabaseClient, o: OrigenGuia, cfg: { uf: number; tasa: number }): Promise<ResultadoGuia<CandidatoGuia>> {
  const candidatos = await candidatosGuia(admin, o);
  const medianas = new Map<string, Promise<unknown>>();
  const evaluar = async (c: CandidatoGuia, combo: Combinacion): Promise<Evaluado | null> => {
    const ctx = contextoDeFila(c, cfg);
    if (!ctx || !c.arriendo) return null;
    const body = buildLtrPayload(
      respuestasDeAviso(avisoDeCandidato(c), combo.piePct, o.tasa, c.arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }),
      ctx,
    ) as Record<string, unknown>;
    if (!medianas.has(c.avisoId)) medianas.set(c.avisoId, prefetchMedianaComunaVenta(admin as never, body as never, cfg.uf).catch(() => undefined));
    const mediana = await medianas.get(c.avisoId);
    const r = runAnalysis(body as never, cfg.uf, mediana as never, new Date()) as { score?: number; metrics?: { flujoNetoMensual?: number } };
    return {
      veredicto: readVeredicto(r as never) ?? null,
      score: typeof r.score === "number" ? Math.round(r.score) : null,
      flujo: typeof r.metrics?.flujoNetoMensual === "number" ? Math.round(r.metrics.flujoNetoMensual) : null,
    };
  };
  return elegirGuia(candidatos, combinacionesGuia({ piePct: o.piePct, plazoAnios: o.plazoAnios, razonSinPie: o.razonSinPie }), evaluar);
}

/** La UF y la tasa de mercado del día (config). */
export async function leerConfigGuia(admin: SupabaseClient): Promise<{ uf: number; tasa: number }> {
  const { data } = await admin.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const uf = m.get("uf_value"), tasa = m.get("tasa_hipotecaria");
  if (!(uf && uf > 0) || !(tasa && tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");
  return { uf, tasa };
}
