// ─────────────────────────────────────────────────────────────────────────────
// Evaluar un aviso de venta con el motor (30-sep-2026): la MISMA entrada que armaría el wizard si la
// persona lo cargara —sugerencias de arriendo y venta por radio (getSugerencias), buildLtrPayload,
// mediana comunal y runAnalysis— con un perfil estándar: pie 20% y 30%, 30 años, tasa de mercado.
// Lo usan el cron semanal (tabla avisos_evaluados) y el censo. No escribe nada: devuelve la fila.
//
// Lo que el aviso no trae:
//   · Antigüedad (usados): la fuente casi nunca la da. Sin año, 25 años (la banda «20+»): un Comprar
//     que aguanta 25 años es robusto; preferimos perder una oportunidad a mostrar una mala (Fabrizio,
//     30-sep-2026). Con año (cuando la ficha lo traiga, FASE 2), el real.
//   · Entrega (nuevos): de scraped_properties.fecha_entrega (GraphQL de la fuente). Sin dato, inmediata.
//   · Arriendo: el sugerido por radio. El del mismo segmento de precio (arriendo-segmentado.ts) queda
//     detrás de `segmentar` y el cron lo tiene apagado: el censo del 29-sep-2026 no lo vio desinflar
//     los bloques baratos.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/analysis";
import { getSugerencias, medianaArriendoZonaM2, SUGERENCIAS_VERSION, type Sugerencias } from "@/lib/services/market-suggestions";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";
import { buildLtrPayload, type SubmitContext } from "@/components/formulario-v4/wizardV4Payload";
import type { Antiguedad, WizardV4Answers } from "@/components/formulario-v4/wizardV4Nodes";
import { readVeredicto } from "@/lib/results-helpers";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";

/** La versión de una fila evaluada: la del motor y la de las sugerencias. Cambia una u otra → el cron la
 *  reevalúa de a poco (avisosDeOtraVersion). */
export const VERSION_EVALUACION = `${METHODOLOGY_VERSION_ACTUAL}+${SUGERENCIAS_VERSION}`;

/** Cuánto sobre la mediana de la zona un arriendo sugerido deja de ser creíble sin más. */
export const UMBRAL_SOSPECHOSO_ZONA = 1.25;

/**
 * ¿Arriendo sospechoso? (30-sep-2026) Contra la ZONA del depto, no contra la comuna: el arriendo sugerido
 * por m² sobre UMBRAL_SOSPECHOSO_ZONA × la mediana de la zona (arriendos sin amoblar de la misma tipología
 * en 2 km), o un arriendo que no sale de comparables sino del estimado comunal por m². Sin mediana de
 * zona no hay contra qué comparar: no se marca.
 */
export function arriendoSospechoso(arriendoMensual: number | null, m2: number, zonaM2: number | null, fuente: string | null): boolean {
  if (!arriendoMensual || !(m2 > 0)) return false;
  if (fuente === "comuna-m2") return true;
  if (!zonaM2 || !(zonaM2 > 0)) return false;
  return arriendoMensual / m2 > UMBRAL_SOSPECHOSO_ZONA * zonaM2;
}
import { parsearFechaEntrega, type Entrega } from "./fecha-entrega";
import { arriendoSegmentado } from "./arriendo-segmentado";

/** Años que se suponen para un usado sin año de construcción: la banda «20+» del wizard (25 años). */
export const ANTIGUEDAD_SUPUESTA: Antiguedad = "20+";
export const ANIOS_ANTIGUEDAD_SUPUESTA = 25;
export const PERFILES_ESTANDAR = [20, 30] as const;
export const PLAZO_ESTANDAR = 30;

export interface AvisoParaEvaluar {
  id: string;
  comuna: string;
  lat: number;
  lng: number;
  precioUF: number;
  m2: number;
  dormitorios: number;
  banos: number;
  condicion: "usado" | "nuevo";
  direccion: string | null;
  fechaEntrega: string | null;
  /** Años de construcción, si se conocen (ficha). null → ANTIGUEDAD_SUPUESTA. */
  antiguedadAnios: number | null;
}

export interface ResultadoPerfil {
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
}

export interface FilaEvaluacion {
  aviso_id: string;
  evaluado_at: string;
  precio_uf: number;
  comuna: string;
  condicion: string;
  antiguedad_anios: number;
  antiguedad_origen: "ficha" | "supuesta" | "nuevo";
  entrega: Entrega | null;
  arriendo: {
    monto: number;
    fuente: "radio" | "comuna" | "comuna-m2" | "segmento";
    n: number;
    radio: number | null;
    radioMonto: number;
    radioFuente: string;
    segmento: { monto: number; n: number; percentil: number } | null;
  } | null;
  venta: { precioM2UF: number | null; fuente: string; n: number; universo: string | null; radio: number | null };
  gastos_comunes: number | null;
  contribuciones: number | null;
  veredicto_20: string | null;
  score_20: number | null;
  flujo_20: number | null;
  veredicto_30: string | null;
  score_30: number | null;
  flujo_30: number | null;
  motor_version: string;
  /** Lecturas del radio que fallaron tras reintentar, en las dos sugerencias (30-sep-2026). */
  lecturas_radio_fallidas: number;
  /** Alguna de las dos sugerencias cayó fuera del radio POR esa falla (market-suggestions, `degradada`). */
  radio_degradado: boolean;
  /** Mediana del arriendo por m² de la zona (sin amoblar, misma tipología, 2 km), o null. */
  arriendo_zona_m2: number | null;
  /** El arriendo con que se evaluó, sospechoso contra la zona (`arriendoSospechoso`). */
  arriendo_sospechoso: boolean;
  /** La mediana comunal de venta con que se evaluó (prefetchMedianaComunaVenta, con su capRef), guardada
   *  para que la guía de búsqueda recalcule sin consultas en vivo (30-sep-2026). */
  mediana_comuna: unknown | null;
}

/** Banda de antigüedad del wizard para unos años conocidos (la misma escala que antiguedadToNumber). */
export function bandaDeAnios(anios: number): Antiguedad {
  return anios <= 2 ? "0-2" : anios <= 5 ? "3-5" : anios <= 10 ? "6-10" : anios <= 20 ? "11-20" : "20+";
}

export async function sugerenciasDeAviso(a: AvisoParaEvaluar): Promise<{ arr: Sugerencias; vta: Sugerencias }> {
  const dorms = a.dormitorios || 2;
  const [arr, vta] = await Promise.all([
    getSugerencias(a.comuna, a.m2, dorms, a.precioUF, a.lat, a.lng, 800, "arriendo", null),
    getSugerencias(a.comuna, a.m2, dorms, a.precioUF, a.lat, a.lng, 800, "venta", a.condicion),
  ]);
  return { arr, vta };
}

/** El arriendo con que se evalúa: el del segmento si alcanza la muestra, si no el sugerido. */
export function arriendoParaEvaluar(a: AvisoParaEvaluar, arr: Sugerencias, vta: Sugerencias, uf: number, segmentar: boolean): FilaEvaluacion["arriendo"] {
  if (!arr.arriendo) return null;
  const seg = segmentar && arr.source === "radio" ? arriendoSegmentado(arr.comparables ?? [], vta.nearbyProperties ?? [], a.precioUF / a.m2, uf) : null;
  return {
    monto: seg ? seg.monto : arr.arriendo,
    fuente: seg ? "segmento" : arr.source === "sin-dato" ? "radio" : arr.source,
    n: seg ? seg.n : Number(arr.sampleSize) || 0,
    radio: typeof arr.radiusUsed === "number" ? arr.radiusUsed : null,
    radioMonto: arr.arriendo,
    radioFuente: arr.source,
    segmento: seg,
  };
}

/** La respuesta del wizard para este aviso y este perfil. `plazo` y `tasaMercado` los pone la guía de
 *  búsqueda con los números de la persona; sin ellos, el perfil estándar (30 años, tasa estimada). */
export function respuestasDeAviso(a: AvisoParaEvaluar, pie: number, tasa: number, arriendo: number, opts: { plazo?: number; tasaMercado?: number } = {}): WizardV4Answers {
  const nuevo = a.condicion === "nuevo";
  const entrega = nuevo ? parsearFechaEntrega(a.fechaEntrega) : null;
  const futura = !!entrega && !entrega.inmediata && entrega.anio != null && entrega.mes != null;
  const coma = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  return {
    tipoPropiedad: nuevo ? "nuevo" : "usado",
    modalidad: "ltr",
    arrModo: "estimacion",
    tasaModo: opts.tasaMercado != null && Math.abs(opts.tasaMercado - tasa) >= 0.005 ? "preaprobada" : "estimada",
    direccion: a.direccion ?? "",
    direccionConfirmada: a.direccion ?? "",
    lat: a.lat,
    lng: a.lng,
    comuna: a.comuna,
    ciudad: "Santiago",
    superficieUtil: coma(a.m2),
    dormitorios: String(a.dormitorios),
    banos: String(a.banos || 1),
    esStudio: a.dormitorios === 0,
    estacionamientos: "0",
    bodegas: "0",
    antiguedad: nuevo ? undefined : a.antiguedadAnios != null ? bandaDeAnios(a.antiguedadAnios) : ANTIGUEDAD_SUPUESTA,
    estadoVenta: nuevo ? (futura ? "futura" : "inmediata") : undefined,
    fechaEntregaMes: futura ? String(entrega!.mes).padStart(2, "0") : undefined,
    fechaEntregaAnio: futura ? String(entrega!.anio) : undefined,
    precio: coma(a.precioUF),
    pieUnidad: "pct",
    pieMonto: String(pie),
    plazoCredito: String(opts.plazo ?? PLAZO_ESTANDAR) as WizardV4Answers["plazoCredito"],
    tasaInteres: coma(tasa),
    arriendo: String(Math.round(arriendo)),
  } as WizardV4Answers;
}

export async function evaluarAviso(
  sb: SupabaseClient,
  a: AvisoParaEvaluar,
  cfg: { uf: number; tasa: number },
  opts: { segmentar: boolean; sug?: { arr: Sugerencias; vta: Sugerencias } } = { segmentar: true },
): Promise<FilaEvaluacion & { sug: { arr: Sugerencias; vta: Sugerencias } }> {
  const sug = opts.sug ?? (await sugerenciasDeAviso(a));
  const { arr, vta } = sug;
  const arriendo = arriendoParaEvaluar(a, arr, vta, cfg.uf, opts.segmentar);
  // La zona del depto, para la marca de sospechoso (los avisos de venta son sin amoblar).
  const zonaM2 = await medianaArriendoZonaM2(a.lat, a.lng, a.dormitorios || null).catch(() => null);
  const base = {
    aviso_id: a.id,
    evaluado_at: new Date().toISOString(),
    precio_uf: Math.round(a.precioUF * 100) / 100,
    comuna: a.comuna,
    condicion: a.condicion,
    antiguedad_anios: a.condicion === "nuevo" ? 0 : a.antiguedadAnios ?? ANIOS_ANTIGUEDAD_SUPUESTA,
    antiguedad_origen: (a.condicion === "nuevo" ? "nuevo" : a.antiguedadAnios != null ? "ficha" : "supuesta") as FilaEvaluacion["antiguedad_origen"],
    entrega: a.condicion === "nuevo" ? parsearFechaEntrega(a.fechaEntrega) : null,
    arriendo,
    venta: {
      precioM2UF: typeof vta.precioM2 === "number" ? Math.round((vta.precioM2 / cfg.uf) * 100) / 100 : null,
      fuente: vta.source,
      n: Number(vta.sampleSize) || 0,
      universo: vta.universoVenta ?? null,
      radio: typeof vta.radiusUsed === "number" ? vta.radiusUsed : null,
    },
    motor_version: VERSION_EVALUACION,
    arriendo_zona_m2: zonaM2,
    arriendo_sospechoso: arriendoSospechoso(arriendo?.monto ?? null, a.m2, zonaM2, arriendo?.fuente ?? null),
    lecturas_radio_fallidas: (arr.lecturasRadioFallidas ?? 0) + (vta.lecturasRadioFallidas ?? 0),
    radio_degradado: !!arr.degradada || !!vta.degradada,
    sug,
  };
  const vacio = { veredicto_20: null, score_20: null, flujo_20: null, veredicto_30: null, score_30: null, flujo_30: null, gastos_comunes: null, contribuciones: null, mediana_comuna: null };
  if (!arriendo) return { ...base, ...vacio };

  const ctx = contextoDeSugerencias(arriendo, arr, vta, cfg);
  const out: Record<string, unknown> = {};
  // La mediana comunal depende del depto (comuna, m², dormitorios, nuevo o usado), no del pie: una vez.
  let mediana: Awaited<ReturnType<typeof prefetchMedianaComunaVenta>> | undefined;
  for (const pie of PERFILES_ESTANDAR) {
    const body = buildLtrPayload(respuestasDeAviso(a, pie, cfg.tasa, arriendo.monto), ctx) as Record<string, unknown> & { gastos?: number; contribuciones?: number };
    if (!mediana) mediana = await prefetchMedianaComunaVenta(sb as never, body as never, cfg.uf).catch(() => undefined);
    out.mediana_comuna = mediana ?? null;
    const r = runAnalysis(body as never, cfg.uf, mediana as never, new Date()) as { score?: number; metrics?: { flujoNetoMensual?: number } };
    out[`veredicto_${pie}`] = readVeredicto(r as never) ?? null;
    out[`score_${pie}`] = typeof r.score === "number" ? Math.round(r.score) : null;
    out[`flujo_${pie}`] = typeof r.metrics?.flujoNetoMensual === "number" ? Math.round(r.metrics.flujoNetoMensual) : null;
    out.gastos_comunes = typeof body.gastos === "number" ? Math.round(body.gastos) : null;
    out.contribuciones = typeof body.contribuciones === "number" ? Math.round(body.contribuciones) : null;
  }
  return { ...base, ...(out as typeof vacio) };
}

/** El contexto del wizard que arman las dos sugerencias del aviso (lo usa también «Analizar este»). */
export function contextoDeSugerencias(arriendo: NonNullable<FilaEvaluacion["arriendo"]>, arr: Sugerencias, vta: Sugerencias, cfg: { uf: number; tasa: number }): SubmitContext {
  return {
    ufCLP: cfg.uf,
    tasaMercado: cfg.tasa,
    arriendoSugerido: arriendo.monto,
    arriendoN: arriendo.n,
    arriendoFuente: arr.source === "radio" || arr.source === "comuna" || arr.source === "comuna-m2" ? arr.source : "sin-dato",
    arriendoRango: arr.rangoArriendo ? { min: Number(arr.rangoArriendo.min), max: Number(arr.rangoArriendo.max) } : null,
    // La muestra guardada solo vale si es la de la mediana: con el arriendo del segmento no lo es.
    muestraArriendo: arriendo.fuente === "radio" ? arr.muestraArriendo ?? null : null,
    precioM2UF: typeof vta.precioM2 === "number" ? vta.precioM2 / cfg.uf : null,
    radiusUsed: arriendo.radio,
    ggccSugerido: typeof arr.ggcc === "number" ? arr.ggcc : null,
    ventaN: Number(vta.sampleSize) || 0,
    ventaFuente: vta.source === "radio" || vta.source === "comuna" ? vta.source : "sin-dato",
    ventaUniverso: vta.universoVenta ?? null,
    ventaRadio: typeof vta.radiusUsed === "number" ? vta.radiusUsed : null,
  };
}
