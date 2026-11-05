// ─────────────────────────────────────────────────────────────────────────────
// Deptos nuevos en el motor · medición 1 (nov-2026). SOLO LECTURA: nada de esto escribe en la base.
//
// Lo común de los scripts de la carpeta: el cliente, la lectura paginada del universo (avisos activos en
// venta con su última evaluación), y la vuelta al motor REAL con los insumos guardados en la fila:
// la misma cadena que la pasada nocturna (evaluar-aviso.ts › evaluarAviso) —respuestasDeAviso →
// payloadDeAviso → runAnalysis— con el contexto que la fila ya resolvió (guia-servidor.ts › contextoDeFila,
// el mismo que usan la guía, el semanal y las columnas de 25 años), sin pedir sugerencias en vivo.
//
// Cómo se corre (cwd en el árbol de trabajo; los paquetes y el loader del repo principal, ver memoria
// «worktree-cwd-alias-mezcla-arboles»):
//   NODE_PATH="C:/Users/fabri/invertiscore/node_modules" node --env-file=.env.local \
//     --import "file:///C:/Users/fabri/invertiscore/node_modules/tsx/dist/loader.mjs" \
//     scripts/analisis/motor-nuevos/<script>.ts
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { payloadDeAviso, respuestasDeAviso, type AvisoParaEvaluar, type FilaEvaluacion } from "../../../src/lib/avisos/evaluar-aviso";
import { contextoDeFila, type CandidatoGuia } from "../../../src/lib/guia/guia-servidor";
import { runAnalysis } from "../../../src/lib/analysis";
import { readVeredicto } from "../../../src/lib/results-helpers";
import type { Entrega } from "../../../src/lib/avisos/fecha-entrega";
import { DEC } from "../../../src/components/formulario-v4/wizardV4Nodes";

export const PAGINA = 1000;

export function cliente(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  return createClient(url, key);
}

export async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += PAGINA) {
    const { data, error } = await consulta(off, off + PAGINA - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return out;
}

export interface Config { uf: number; tasa: number }

export async function leerConfig(sb: SupabaseClient): Promise<Config> {
  const { data, error } = await sb.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  if (error) throw new Error(error.message);
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const uf = m.get("uf_value"), tasa = m.get("tasa_hipotecaria");
  if (!(uf && uf > 0) || !(tasa && tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");
  return { uf, tasa };
}

/** Una fila del universo: la evaluación guardada más lo que el aviso tiene en scraped_properties. */
export interface FilaUniverso {
  aviso_id: string;
  evaluado_at: string;
  precio_uf: number;
  comuna: string;
  condicion: "usado" | "nuevo";
  antiguedad_anios: number;
  antiguedad_origen: "ficha" | "supuesta" | "nuevo";
  entrega: Entrega | null;
  arriendo: FilaEvaluacion["arriendo"];
  venta: FilaEvaluacion["venta"] | null;
  gastos_comunes: number | null;
  contribuciones: number | null;
  veredicto_20: string | null; score_20: number | null; flujo_20: number | null;
  veredicto_30: string | null; score_30: number | null; flujo_30: number | null;
  motor_version: string;
  arriendo_sospechoso: boolean | null;
  radio_degradado: boolean | null;
  arriendo_zona_m2: number | null;
  mediana_comuna: unknown | null;
  sp: {
    id: string; comuna: string | null; lat: number | string | null; lng: number | string | null; precio: number | string | null; moneda: string | null;
    superficie_m2: number | string | null; dormitorios: number | null; banos: number | null; condicion: string | null; direccion: string | null;
    fecha_entrega: string | null; titulo: string | null; url: string | null; source_id: string | null; gastos_comunes: number | string | null;
    antiguedad: string | null; scraped_at: string; created_at: string | null; precio_estimado_uf: number | string | null;
  };
}

const COLS_AE = "aviso_id, evaluado_at, precio_uf, comuna, condicion, antiguedad_anios, antiguedad_origen, entrega, arriendo, venta, gastos_comunes, contribuciones, veredicto_20, score_20, flujo_20, veredicto_30, score_30, flujo_30, motor_version, arriendo_sospechoso, radio_degradado, arriendo_zona_m2, mediana_comuna";
const COLS_SP = "id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, titulo, url, source_id, gastos_comunes, antiguedad, scraped_at, created_at, precio_estimado_uf";

/** Avisos activos en venta con su última evaluación. Paginado por aviso_id (PostgREST capa en 1.000). */
export async function universoActivo(sb: SupabaseClient, filtro?: { condicion?: "usado" | "nuevo" }): Promise<FilaUniverso[]> {
  type Cruda = Omit<FilaUniverso, "sp" | "precio_uf"> & { precio_uf: number | string; scraped_properties: FilaUniverso["sp"] };
  const filas = await paginar<Cruda>((a, b) => {
    let q = sb.from("avisos_evaluados").select(`${COLS_AE}, scraped_properties!inner(${COLS_SP})`)
      .eq("scraped_properties.is_active", true).eq("scraped_properties.type", "venta");
    if (filtro?.condicion) q = q.eq("condicion", filtro.condicion);
    // PostgREST tipa la relación embebida como lista; con `!inner` por la llave es una fila (lo confirma el runtime).
    return q.order("aviso_id", { ascending: true }).range(a, b) as unknown as PromiseLike<{ data: Cruda[] | null; error: { message: string } | null }>;
  });
  return filas.map((f) => {
    const { scraped_properties, ...resto } = f;
    return { ...resto, precio_uf: Number(f.precio_uf), sp: scraped_properties } as FilaUniverso;
  });
}

/** El aviso tal como lo arma el cron (depurar.ts › avisosEvaluables), con el precio en UF de la fila evaluada. */
export function avisoDeFila(f: FilaUniverso): AvisoParaEvaluar {
  return {
    id: f.aviso_id,
    comuna: f.sp.comuna ?? f.comuna,
    lat: Number(f.sp.lat),
    lng: Number(f.sp.lng),
    precioUF: f.precio_uf,
    m2: Number(f.sp.superficie_m2),
    dormitorios: Number(f.sp.dormitorios),
    banos: Number(f.sp.banos),
    condicion: f.condicion,
    direccion: f.sp.direccion ?? null,
    fechaEntrega: f.sp.fecha_entrega ?? null,
    antiguedadAnios: f.antiguedad_origen === "ficha" ? f.antiguedad_anios : null,
  };
}

/** La fila como candidato de la guía: lo que `candidatoDeEvaluacion` (estandar-deptos.ts) arma en el cron. */
export function candidatoDeFila(f: FilaUniverso): CandidatoGuia {
  const a = avisoDeFila(f);
  return {
    avisoId: a.id, distanciaM: 0, comuna: a.comuna, lat: a.lat, lng: a.lng, m2: a.m2, dormitorios: a.dormitorios,
    banos: a.banos || 1, condicion: a.condicion, direccion: a.direccion, fechaEntrega: a.fechaEntrega, url: f.sp.url,
    precioUF: a.precioUF, antiguedadAnios: a.antiguedadAnios, antiguedadOrigen: f.antiguedad_origen,
    arriendo: f.arriendo, venta: f.venta, gastosComunes: f.gastos_comunes, medianaComuna: f.mediana_comuna ?? null,
  };
}

export interface ResultadoMotor {
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
  /** Lo que el motor devolvió entero, por si un script quiere más (TIR, métricas). */
  resultado: ReturnType<typeof runAnalysis>;
  body: Record<string, unknown>;
}

export interface OpcionesMotor {
  /** Fecha de análisis; la pasada usa `new Date()` al evaluar. Por defecto, `evaluado_at` de la fila. */
  asOf?: Date;
  /** Plazo del crédito; la pasada evalúa a 30 (PLAZO_ESTANDAR). */
  plazo?: number;
  /** Sobrescrituras del contexto (p. ej. `ggccSugerido`) y del body (p. ej. `gastos`), para los escenarios. */
  ctxPatch?: Partial<ReturnType<typeof contextoDeFila>>;
  bodyPatch?: Record<string, unknown>;
  /** Otra mediana comunal (escenarios sin BDO); por defecto, la guardada en la fila. */
  medianaComuna?: unknown;
  /** Otro arriendo mensual con que evaluar (escenarios del premio); por defecto, el guardado. */
  arriendo?: number;
  /** Congela «hoy» (`new Date()` sin argumentos y `Date.now`) en `asOf` mientras se arma el body y corre el motor: las
   *  cuotas del pie por defecto de una entrega futura se cuentan desde hoy (helpers-wizard.ts › mesesHastaEntrega), y
   *  la pasada las contó desde el día en que evaluó. Solo para reproducir filas viejas; los escenarios van sin esto. */
  congelarHoy?: boolean;
}

/**
 * LA SUPERFICIE LEGIBLE CON DOS DECIMALES (decisión de Fabrizio, FASE 1): `respuestasDeAviso` escribe el m² con dos
 * decimales y `DEC.superficie` admite uno, así que `leerNum` lo lee como 0. Acá, y solo mientras corre `fn`, el campo
 * admite dos: la misma cadena de la pasada con el m² entero. En memoria; el repo no cambia.
 */
export function conSuperficieDosDecimales<T>(fn: () => T): T {
  const dec = DEC as unknown as { superficie: number };
  const antes = dec.superficie;
  dec.superficie = 2;
  try { return fn(); } finally { dec.superficie = antes; }
}

/** Corre `fn` con `Date` apuntando a `instante` como «ahora» (los `new Date(x)` con argumento no cambian). */
export function conHoyCongelado<T>(instante: Date, fn: () => T): T {
  const DateReal = Date;
  const fijo = instante.getTime();
  class DateCongelada extends DateReal {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fijo);
      else super(...(args as [number]));
    }
    static now() { return fijo; }
  }
  (globalThis as { Date: DateConstructor }).Date = DateCongelada as unknown as DateConstructor;
  try { return fn(); } finally { (globalThis as { Date: DateConstructor }).Date = DateReal; }
}

/**
 * El motor real sobre una fila, con sus insumos guardados: la misma cadena que la pasada nocturna.
 * Devuelve null si la fila no tiene arriendo (la pasada tampoco evalúa esas).
 */
export function evaluarConMotor(f: FilaUniverso, cfg: Config, pie: number, opts: OpcionesMotor = {}): ResultadoMotor | null {
  const asOf = opts.asOf ?? new Date(f.evaluado_at);
  if (opts.congelarHoy) return conHoyCongelado(asOf, () => evaluarConMotor(f, cfg, pie, { ...opts, congelarHoy: false, asOf }));
  const c = candidatoDeFila(f);
  const ctx = contextoDeFila(c, cfg);
  if (!ctx || !f.arriendo) return null;
  const arriendo = opts.arriendo ?? f.arriendo.monto;
  const extra = opts.plazo != null ? { plazo: opts.plazo, tasaMercado: cfg.tasa } : {};
  const respuestas = respuestasDeAviso(avisoDeFila(f), pie, cfg.tasa, arriendo, extra);
  const body = payloadDeAviso(respuestas, { ...ctx, ...(opts.ctxPatch ?? {}) } as typeof ctx);
  Object.assign(body, opts.bodyPatch ?? {});
  const mediana = opts.medianaComuna !== undefined ? opts.medianaComuna : f.mediana_comuna;
  const r = runAnalysis(body as never, cfg.uf, (mediana ?? undefined) as never, asOf) as ReturnType<typeof runAnalysis> & { score?: number; metrics?: { flujoNetoMensual?: number } };
  return {
    veredicto: readVeredicto(r as never) ?? null,
    score: typeof r.score === "number" ? Math.round(r.score) : null,
    flujo: typeof r.metrics?.flujoNetoMensual === "number" ? Math.round(r.metrics.flujoNetoMensual) : null,
    resultado: r,
    body,
  };
}

// ─── Azar con semilla, estadística y tablas ──────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n elementos al azar con semilla fija (barajado de Fisher–Yates sobre una copia). */
export function muestraConSemilla<T>(xs: readonly T[], n: number, seed: number): T[] {
  const rnd = mulberry32(seed);
  const copia = xs.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, n);
}

export function cuantil(xs: readonly number[], q: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
export const mediana = (xs: readonly number[]) => cuantil(xs, 0.5);

export function fmt(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const pct = (a: number, b: number, dec = 1) => (b > 0 ? fmt((a / b) * 100, dec) + " %" : "—");

/** Una tabla en markdown, para pegar en el documento. */
export function tablaMd(cabecera: string[], filas: (string | number | null | undefined)[][]): string {
  const celda = (v: string | number | null | undefined) => (v == null ? "—" : typeof v === "number" ? fmt(v) : v);
  return [
    `| ${cabecera.join(" | ")} |`,
    `| ${cabecera.map(() => "---").join(" | ")} |`,
    ...filas.map((f) => `| ${f.map(celda).join(" | ")} |`),
  ].join("\n");
}

/** Clasificación de la entrega guardada: inmediata, futura o sin dato (la misma lectura que la línea base). */
export function tipoEntrega(e: Entrega | null | undefined): "inmediata" | "futura" | "sin dato" {
  if (!e) return "sin dato";
  if (e.inmediata) return "inmediata";
  return e.anio != null ? "futura" : "sin dato";
}
