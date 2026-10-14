// ─────────────────────────────────────────────────────────────────────────────
// El semanal de RENTA CORTA del lado del servidor (14-oct-2026). Las reglas viven en semanal-str.ts (puro).
//
// ESTIMADO POR ZONA, SIN CONSULTAS AL PROVEEDOR: la tarifa y la ocupación de un depto salen de la respuesta de mercado
// TÍPICA de su celda comuna × dormitorios —la de ingreso mediano entre las guardadas en `airbnb_estimates`, leídas con
// la misma lectura que la referencia STR del informe (strref-zona-query.ts › direccionesDeComuna)—, convertida con la
// misma función que el caché (get-estimate.ts › estimacionDesdeCache). Este archivo NO importa `getAirbnbEstimate`:
// el semanal no puede gastar una consulta (lo fija el tier SEMANAL-STR). Una celda sin respuestas suficientes no
// estima: sus deptos no entran.
//
// EL MISMO CÁLCULO QUE EL INFORME: el cuerpo del depto es el del wizard (buildStrPayload sobre las respuestas del
// aviso, como payloadDeAviso en renta larga), y el motor y el puntaje corren por `evaluarCuerpoStr`, la función que
// usa el informe. Entre la zona y la medición fina de «Analizar este» lo único que cambia es la estimación.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { direccionesDeComuna } from "@/lib/strref-zona-query";
import { estimacionDesdeCache } from "@/lib/airbnb/get-estimate";
import { evaluarCuerpoStr, type ShortTermAnalysisBody } from "@/lib/api-helpers/analisis-pipeline";
import { buildStrPayload } from "@/components/formulario-v4/wizardV4Payload";
import type { WizardV4Answers } from "@/components/formulario-v4/wizardV4Nodes";
import { respuestasDeAviso } from "@/lib/avisos/evaluar-aviso";
import { comunasVecinas } from "@/lib/comunas-vecinas";
import type { MedianaComunaInyectada } from "@/lib/comuna-stats";
import type { PerfilDeLaPersona } from "@/lib/perfil-busqueda-servidor";
import type { PerfilBusqueda } from "@/lib/perfil-busqueda";
import type { AirbnbEstimateResponse } from "@/lib/airbnb/types";
import { avisoDeCandidato, contextoDeFila, leerOrigenGuia, type CandidatoGuia, type OrigenGuia } from "./guia-servidor";
import { leerAvisoGuia } from "./analizar-servidor";
import { candidatoDeFila, comunaDeAviso, type Candidato, type FilaRpc } from "./semanal-candidatos";
import { MIN_RESPUESTAS_ZONA, respuestaTipica, type LadoMedicion } from "./semanal-str";
import { VENTANA_SEMANAL_DIAS, rangoSemanal, type RespaldoSemanal } from "./semanal";
import type { Combinacion, Evaluado } from "./seleccion";

/** Cuántos de cada celda (los más baratos) trae la RPC: en una celda la tarifa típica es una, y el más barato rinde más. */
export const POR_CELDA_STR = 20;

// ── La zona: la respuesta típica guardada de cada celda ─────────────────────────

export interface ZonaStr {
  estimacion: Extract<AirbnbEstimateResponse, { success: true }>;
  /** Ingreso de mercado por año de la respuesta típica (tarifa p50 × ocupación p50 × 365). */
  ingresoAnual: number;
  /** Respuestas guardadas en la celda. */
  n: number;
  estimateId: string;
}

/** Las zonas se leen una vez por comuna y por corrida (un cron recorre a muchas personas con las mismas comunas). */
const ZONAS_TTL_MS = 30 * 60_000;
const memoZonas = new Map<string, { at: number; p: Promise<Map<number, ZonaStr>> }>();

/** La celda de un depto: los de 3 dormitorios o más van con los de 3, como en la referencia STR. */
export const celdaDormitorios = (d: number) => Math.min(Math.max(Math.round(Number(d) || 0), 0), 3);

/** Las zonas de una comuna, por dormitorios (0 = studio … 3 = tres o más). Sin respuestas suficientes, no hay entrada. */
export function zonasDeComuna(admin: SupabaseClient, comuna: string): Promise<Map<number, ZonaStr>> {
  const ya = memoZonas.get(comuna);
  if (ya && Date.now() - ya.at < ZONAS_TTL_MS) return ya.p;
  const p = (async () => {
    const dirs = await direccionesDeComuna(comuna);
    const porCelda = new Map<number, typeof dirs>();
    for (const d of dirs) {
      if (!d.estimateId) continue;
      const k = celdaDormitorios(d.dormitorios);
      porCelda.set(k, [...(porCelda.get(k) ?? []), d]);
    }
    const tipicas = new Map<number, { id: string; ingresoAnual: number; n: number }>();
    for (const [k, ds] of Array.from(porCelda)) {
      const t = respuestaTipica(ds, MIN_RESPUESTAS_ZONA);
      if (t?.estimateId) tipicas.set(k, { id: t.estimateId, ingresoAnual: t.ingresoAnual, n: ds.length });
    }
    const zonas = new Map<number, ZonaStr>();
    if (tipicas.size === 0) return zonas;
    const { data, error } = await admin.from("airbnb_estimates").select("*").in("id", Array.from(tipicas.values()).map((t) => t.id));
    if (error) throw new Error(`zonas de ${comuna}: ${error.message}`);
    const filas = new Map(((data ?? []) as Array<Record<string, unknown>>).map((f) => [String(f.id), f]));
    for (const [k, t] of Array.from(tipicas)) {
      const fila = filas.get(t.id);
      if (fila) zonas.set(k, { estimacion: estimacionDesdeCache(fila), ingresoAnual: t.ingresoAnual, n: t.n, estimateId: t.id });
    }
    return zonas;
  })();
  memoZonas.set(comuna, { at: Date.now(), p });
  p.catch(() => memoZonas.delete(comuna));
  return p;
}

// ── El origen de renta corta: con qué números se evalúa ─────────────────────────

/** El origen de la guía más lo que el informe de renta corta dice de la gestión. */
export interface OrigenStr extends OrigenGuia {
  modoGestion: "auto" | "administrador";
  comisionAdministrador: number;
}

/** Un informe como origen de renta corta: su pie, su plazo y su tasa (leerOrigenGuia) y, si es de renta corta, su
 *  gestión. Un informe de renta larga sirve (quien eligió renta corta a mano sin informes de renta corta) con la
 *  gestión por defecto del wizard. */
export async function leerOrigenStr(admin: SupabaseClient, analysisId: string): Promise<OrigenStr | null> {
  const o = await leerOrigenGuia(admin, analysisId, { rentaCorta: true });
  if (!o) return null;
  const { data } = await admin.from("analisis").select("tipo_analisis, input_data").eq("id", analysisId).maybeSingle();
  const i = ((data?.input_data ?? {}) as Record<string, unknown>);
  const corta = data?.tipo_analisis === "short-term";
  const comision = Number(i.comisionAdministrador);
  return {
    ...o,
    modoGestion: corta && i.modoGestion === "administrador" ? "administrador" : "auto",
    comisionAdministrador: corta && comision > 0 && comision < 1 ? comision : 0.2,
  };
}

/** El informe de renta corta más reciente que trae con qué buscar; si no tiene, el de renta larga. */
export async function origenStrDePersona(admin: SupabaseClient, userId: string): Promise<OrigenStr | null> {
  for (const tipo of ["short-term", "long-term"]) {
    const { data } = await admin.from("analisis").select("id").eq("user_id", userId).eq("tipo_analisis", tipo)
      .order("created_at", { ascending: false }).limit(5);
    for (const f of data ?? []) {
      const o = await leerOrigenStr(admin, f.id as string);
      if (o) return o;
    }
  }
  return null;
}

// ── El cuerpo y la evaluación ───────────────────────────────────────────────────

const comaPct = (x: number) => String(Math.round(x * 1000) / 10).replace(".", ",");

/**
 * El cuerpo de renta corta de un aviso, el MISMO que armaría el wizard: las respuestas del aviso (respuestasDeAviso,
 * como en renta larga) con la modalidad y la gestión de la persona, por buildStrPayload, con el contexto que la fila
 * evaluada ya resolvió (contextoDeFila: sin consultas en vivo). `direccion`: la de «Analizar este», para el proveedor.
 * null si el aviso no tiene arriendo evaluado.
 */
export function cuerpoStrDeAviso(
  c: CandidatoGuia,
  o: OrigenStr,
  combo: Combinacion,
  cfg: { uf: number; tasa: number },
  opts: { antiguedadAnios?: number | null; direccion?: string } = {},
): ShortTermAnalysisBody | null {
  const ctx = contextoDeFila(c, cfg);
  if (!ctx || !c.arriendo) return null;
  const a = avisoDeCandidato(c, opts.antiguedadAnios === undefined ? c.antiguedadAnios : opts.antiguedadAnios);
  const r = respuestasDeAviso(opts.direccion ? { ...a, direccion: opts.direccion } : a, combo.piePct, o.tasa, c.arriendo.monto, {
    plazo: combo.plazoAnios, tasaMercado: cfg.tasa,
  });
  const answers = { ...r, modalidad: "str", modoGestion: o.modoGestion, comisionStrPct: comaPct(o.comisionAdministrador) } as WizardV4Answers;
  return buildStrPayload(answers, ctx) as unknown as ShortTermAnalysisBody;
}

/** Lo que el semanal guarda de un depto evaluado en renta corta: el veredicto, su puntaje y el flujo con los números de
 *  la persona, más la tarifa y la ocupación con que se calculó y el ingreso de la zona. */
export interface EvaluadoStr extends Evaluado, LadoMedicion {
  ingresoMensual: number | null;
}

/** El motor de renta corta sobre un cuerpo, con una estimación de mercado (la de la zona o la fina). */
export function evaluarStrCon(
  body: ShortTermAnalysisBody,
  estimacion: Extract<AirbnbEstimateResponse, { success: true }>,
  cfg: { uf: number },
  mediana: unknown,
  asOf: Date,
): EvaluadoStr {
  const ev = evaluarCuerpoStr(body, cfg.uf, (mediana ?? undefined) as MedianaComunaInyectada | undefined, estimacion, asOf);
  const base = ev.result.escenarios.base;
  return {
    veredicto: ev.francoScore.veredicto,
    score: Number.isFinite(ev.francoScore.score) ? Math.round(ev.francoScore.score) : null,
    flujo: Number.isFinite(base.flujoCajaMensual) ? Math.round(base.flujoCajaMensual) : null,
    adr: Number.isFinite(base.adrReferencia) ? Math.round(base.adrReferencia) : null,
    ocupacion: Number.isFinite(base.ocupacionReferencia) ? Math.round(base.ocupacionReferencia * 1000) / 1000 : null,
    ingresoMensual: Number.isFinite(base.ingresoBrutoMensual) ? Math.round(base.ingresoBrutoMensual) : null,
  };
}

/**
 * LOS PARECIDOS, REEVALUADOS CON LA MEDICIÓN FINA (14-oct-2026, decisión de Fabrizio): cuando «Analizar este» mide fino
 * y no da, los parecidos se reevalúan con la tarifa y la ocupación recién medidas —la respuesta del proveedor de ese
 * análisis— en lugar de la zona, con el MISMO cuerpo que su estimación por zona y sin consultar al proveedor. Devuelve
 * el veredicto de cada uno (null si no se puede armar); la ruta se queda con los que siguen dando Comprar
 * (semanal-str.ts › parecidosQueSobreviven).
 */
export function reevaluadorConMedicion(
  admin: SupabaseClient,
  o: OrigenStr,
  combo: Combinacion,
  medida: { estimacion: Extract<AirbnbEstimateResponse, { success: true }>; cfg: { uf: number; tasa: number } },
  asOf: Date = new Date(),
): (it: { avisoId: string }) => Promise<string | null> {
  return async (it) => {
    const c = await leerAvisoGuia(admin, it.avisoId, o);
    const body = c ? cuerpoStrDeAviso(c, o, combo, medida.cfg) : null;
    return c && body ? evaluarStrCon(body, medida.estimacion, medida.cfg, c.medianaComuna, asOf).veredicto : null;
  };
}

// ── La selección ───────────────────────────────────────────────────────────────

/** Todo lo que hace falta para elegir el bloque de renta corta de una persona (la forma de la de renta larga). */
export interface PreparacionStr {
  perfil: PerfilBusqueda;
  origen: OrigenStr;
  combo: Combinacion;
  candidatos: Candidato[];
  evaluar: (c: Candidato) => Promise<EvaluadoStr | null>;
  respaldo: RespaldoSemanal<Candidato>;
}

export type PreparadaStr = { tipo: "sin-perfil"; perfil: PerfilBusqueda } | { tipo: "lista"; p: PreparacionStr };

/**
 * Prepara el bloque de renta corta de una persona sin chequear ninguna ficha (la usan el armado, el prechequeo y la
 * página viva). null: no tiene perfil de renta corta. Los candidatos traen como `scoreCron` su rendimiento por zona
 * (ingreso típico de la celda ÷ precio): así `elegirSemanal` recalcula primero los que más prometen.
 */
export async function prepararSeleccionStr(
  admin: SupabaseClient,
  userId: string,
  cfg: { uf: number; tasa: number },
  pp: Pick<PerfilDeLaPersona, "perfilStr">,
): Promise<PreparadaStr | null> {
  const perfil = pp.perfilStr;
  if (!perfil) return null;
  const rango = rangoSemanal(perfil);
  const o = perfil.completo && rango ? await origenStrDePersona(admin, userId) : null;
  if (!o || !rango) return { tipo: "sin-perfil", perfil };
  const combo: Combinacion = { piePct: perfil.piePct ?? o.piePct, plazoAnios: perfil.plazoAnios ?? o.plazoAnios };
  const desde = new Date(Date.now() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

  const leerCandidatos = async (comunas: string[]): Promise<Candidato[]> => {
    if (comunas.length === 0) return [];
    const { data, error } = await admin.rpc("semanal_candidatos_str", {
      comunas, dorms: perfil.dormitorios, uf_min: rango.ufMin, uf_max: rango.ufMax, desde, por_celda: POR_CELDA_STR,
    });
    if (error) throw new Error(`semanal_candidatos_str: ${error.message}`);
    const out: Candidato[] = [];
    for (const c of ((data ?? []) as FilaRpc[]).map(candidatoDeFila)) {
      const zona = (await zonasDeComuna(admin, c.comuna)).get(celdaDormitorios(c.dormitorios));
      if (!zona || !(c.precioUF > 0)) continue;
      out.push({ ...c, scoreCron: Math.round((zona.ingresoAnual / (c.precioUF * cfg.uf)) * 10_000) });
    }
    return out;
  };
  const propias = perfil.comunas.map(comunaDeAviso);
  const candidatos = await leerCandidatos(propias);

  const asOf = new Date();
  const memo = new Map<string, Promise<EvaluadoStr | null>>();
  const evaluar = (c: Candidato): Promise<EvaluadoStr | null> => {
    const ya = memo.get(c.avisoId);
    if (ya) return ya;
    const r = (async () => {
      const zona = (await zonasDeComuna(admin, c.comuna)).get(celdaDormitorios(c.dormitorios));
      if (!zona) return null;
      const body = cuerpoStrDeAviso(c, o, combo, cfg);
      if (!body) return null;
      return evaluarStrCon(body, zona.estimacion, cfg, c.medianaComuna, asOf);
    })();
    memo.set(c.avisoId, r);
    return r;
  };
  let vecinas: Promise<Candidato[]> | null = null;
  return {
    tipo: "lista",
    p: {
      perfil, origen: o, combo, candidatos,
      evaluar,
      respaldo: {
        // Solo Comprar (14-oct-2026): las vecinas sí; el negociable no (REGLA_CORTA, sin evaluarConDescuento).
        vecinas: () => (vecinas ??= leerCandidatos(comunasVecinas(propias))),
      },
    },
  };
}
