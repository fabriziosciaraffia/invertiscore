// Referencia STR contra STR de la zona — la parte PURA (21-sep-2026).
//
// El umbral de `rentabilidad_str` deja de ser el 5% fijo o el LTR de la comuna más un punto: es lo
// que RINDE, después de operar, un Airbnb típico de la misma comuna y tipología, calculado con la
// MISMA base que el motor usa para el usuario —el estimador de AirROI: el p50 de tarifa y
// ocupación que la estimación devuelve por dirección (`airbnb_estimates.raw_response.percentiles`),
// una fila por (dirección, dormitorios)— y con el mismo modelo de costos (comisión 3% de
// autogestión, costos directos y mantención por tipología, gastos comunes por m² y contribuciones
// de la comuna). SIN punto extra: cuando la referencia es el mismo negocio no se compensa; el
// riesgo de la renta corta ya lo cobra el score por sensibilidad y break-even.
//
// SIN DOBLE CONTEO: la referencia sale del ingreso proyectado del estimador (tarifa p50 × ocupación
// p50 × 365 de la MISMA respuesta), que ya trae su ocupación. Nunca de una tarifa de listing por
// la ocupación que el motor estima, y nunca de los listings realizados (`comparable_listings`),
// que son otra base (ocupación 25% contra 42–47% del estimador; medido el 21-sep).
//
// EL PRECIO ES UN PROXY DECLARADO: la venta usada de la misma tipología en la comuna (90 días),
// mediana del precio total. Los «1 dormitorio» del caché son unidades para 2 huéspedes en el
// 96–99% de los casos: calza con el 1D usado de Santiago (32 m²) y Estación Central (31 m²), y
// calza peor en Providencia (45 m²) y Las Condes (43 m²), donde el precio proxy es alto y el
// yield sale bajo. Los listings no traen m². Studio (0 dormitorios) usa la venta de 1D.
//
// CASCADA CORTA, declarada en el dato (`nivel`): celda (comuna × dormitorios, n ≥ 15 direcciones
// y n ≥ 15 ventas) → comuna (las estimaciones de TODAS las tipologías, pooled, sobre la venta de
// la tipología del sujeto: mezclar tipologías en la venta daba −0,3% en Vitacura, con ingreso de
// 2D contra un precio pooled de 148 m²; decisión de Fabrizio, 21-sep) → sin_referencia (el
// capítulo lo dice y no compara; el motor conserva el 5% para sus mecánicas internas). Sin BDO,
// sin LTR.
import { median, normalizeComuna } from "@/lib/comuna-stats";
import { getMarketData } from "@/lib/comunas";
import { COMISION_AIRBNB, COSTOS_DEFAULT } from "@/lib/engines/short-term-engine";
import { COMUNAS_ROSTER } from "@/lib/data/comunas-roster";

export type NivelStrRef = "celda" | "comuna" | "sin_referencia";

/** Mínimo por lado (direcciones estimadas y ventas usadas) para publicar un peldaño. */
export const MIN_STRREF = 15;

/** Peldaños de avisos, en orden. La resolución viva y el gate iteran ESTA lista. */
export const CASCADA_STRREF: ReadonlyArray<"celda" | "comuna"> = ["celda", "comuna"];

/** Una respuesta del estimador, una por (dirección, dormitorios): el ingreso ya trae su ocupación. */
export interface DireccionEstimada {
  comuna: string;
  dormitorios: number;
  /** adr p50 × occ p50 × 365 de la misma respuesta. */
  ingresoAnual: number;
}

/** La venta usada de la tipología del sujeto (en los dos peldaños). */
export interface VentaTipologia {
  n: number;
  precioP50: number;
  m2P50: number;
}

export interface CeldaStrRef {
  comuna: string;
  /** 0 = studio (la venta usa 1D como proxy), 1..3. */
  dormitorios: number;
}

export interface StrRefZonaSnapshot {
  nivel: NivelStrRef;
  /** Yield DESPUÉS DE OPERAR, en %: el que se compara con el cap rate STR del usuario. null sin referencia. */
  neto: number | null;
  /** Ingreso anual proyectado ÷ precio típico, en %. */
  bruto: number | null;
  ingresoAnual: number | null;
  precio: number | null;
  m2: number | null;
  costosMes: number | null;
  nDirecciones: number;
  nVenta: number;
  celda: { comuna: string; dormitorios: number | null };
  fuente: string;
  resolvedAt: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Dormitorios de la venta que hace de proxy: studio → 1D; tope 3. */
export function dormitoriosVentaProxy(dormitorios: number): number {
  return Math.min(Math.max(dormitorios, 1), 3);
}

/**
 * Yield de un Airbnb típico con el modelo de costos del motor STR (calcEscenario): NOI = ingreso
 * × (1 − comisión) − 12 × (costos directos + mantención por tipología + gastos comunes por m² +
 * contribuciones). Sin punto extra, sin factor.
 */
export function yieldStrZona(p: { ingresoAnual: number; precio: number; m2: number; comuna: string; dormitorios: number }): { bruto: number; neto: number; costosMes: number } {
  const cd = COSTOS_DEFAULT[String(Math.min(Math.max(p.dormitorios, 0), 3))] ?? COSTOS_DEFAULT["1"];
  const directos = cd[0] + cd[1] + cd[2] + cd[3];
  const mantencion = cd[4];
  const md = getMarketData(p.comuna);
  const gastosComunes = md.gastosComunesPorM2 * p.m2;
  const contribucionesMes = (p.precio * md.contribucionesPctAnual) / 100 / 12;
  const costosMes = directos + mantencion + gastosComunes + contribucionesMes;
  const noiAnual = p.ingresoAnual * (1 - COMISION_AIRBNB) - costosMes * 12;
  return { bruto: r2((p.ingresoAnual / p.precio) * 100), neto: r2((noiAnual / p.precio) * 100), costosMes: Math.round(costosMes) };
}

const rotuloDorms = (d: number | null) => (d === null ? "todas las tipologías" : d === 0 ? "studio" : `${d}D`);

/** Evalúa UN peldaño: publica si los dos lados alcanzan MIN_STRREF. Puro. */
export function evaluarPeldanoStrRef(
  nivel: "celda" | "comuna",
  direcciones: DireccionEstimada[],
  venta: VentaTipologia | null,
  celda: CeldaStrRef,
  resolvedAt: string,
): StrRefZonaSnapshot | null {
  const ingresos = direcciones.map((d) => d.ingresoAnual).filter((x) => x > 0);
  if (ingresos.length < MIN_STRREF || !venta || venta.n < MIN_STRREF || !(venta.precioP50 > 0) || !(venta.m2P50 > 0)) return null;
  const ingresoAnual = Math.round(median(ingresos));
  // En «comuna» las estimaciones son pooled (todas las tipologías) pero la venta y los costos son
  // los de la tipología del sujeto; `celda.dormitorios` queda null para declarar el peldaño.
  const dormitorios = nivel === "celda" ? celda.dormitorios : null;
  const y = yieldStrZona({ ingresoAnual, precio: venta.precioP50, m2: venta.m2P50, comuna: celda.comuna, dormitorios: celda.dormitorios });
  const fuente =
    `${ingresos.length} estimaciones de Airbnb (${rotuloDorms(dormitorios)}) en ${celda.comuna} ` +
    `sobre ${venta.n} avisos de venta usados (${rotuloDorms(dormitoriosVentaProxy(celda.dormitorios))}, 90 días); ` +
    `ingreso proyectado por el estimador, precio típico de la tipología del sujeto, costos del motor`;
  return {
    nivel,
    neto: y.neto,
    bruto: y.bruto,
    ingresoAnual,
    precio: Math.round(venta.precioP50),
    m2: Math.round(venta.m2P50),
    costosMes: y.costosMes,
    nDirecciones: ingresos.length,
    nVenta: venta.n,
    celda: { comuna: celda.comuna, dormitorios },
    fuente,
    resolvedAt,
  };
}

/** El último peldaño: sin referencia, y se dice. Puro. */
export function strRefSinReferencia(celda: CeldaStrRef, resolvedAt: string, nMax: { nDirecciones: number; nVenta: number }): StrRefZonaSnapshot {
  return {
    nivel: "sin_referencia",
    neto: null, bruto: null, ingresoAnual: null, precio: null, m2: null, costosMes: null,
    nDirecciones: nMax.nDirecciones, nVenta: nMax.nVenta,
    celda: { comuna: celda.comuna, dormitorios: null },
    fuente: `sin referencia de Airbnb para ${celda.comuna}: no hay ${MIN_STRREF} estimaciones y ${MIN_STRREF} ventas en la comuna`,
    resolvedAt,
  };
}

/** La cascada completa sobre un muestreador síncrono: la que corre el gate. La viva
 *  (strref-zona-query.ts) itera la misma `CASCADA_STRREF` con las mismas dos funciones. */
export function resolverStrRefCascada(
  celda: CeldaStrRef,
  muestrear: (nivel: "celda" | "comuna") => { direcciones: DireccionEstimada[]; venta: VentaTipologia | null },
  resolvedAt: string = new Date().toISOString(),
): StrRefZonaSnapshot {
  let nD = 0, nV = 0;
  for (const nivel of CASCADA_STRREF) {
    const m = muestrear(nivel);
    nD = Math.max(nD, m.direcciones.length); nV = Math.max(nV, m.venta?.n ?? 0);
    const r = evaluarPeldanoStrRef(nivel, m.direcciones, m.venta, celda, resolvedAt);
    if (r) return r;
  }
  return strRefSinReferencia(celda, resolvedAt, { nDirecciones: nD, nVenta: nV });
}

// ─── La comuna de una dirección del caché ─────────────────────────────────
// Las respuestas del estimador se guardan por dirección (la del wizard, formateada por Google):
// la comuna es el segmento antes de «Región Metropolitana» (sin código postal), o un nombre del
// roster presente en la dirección. Misma regla que scripts/data/generar-str-universo.ts.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const EXTRA = ["La Granja", "San Bernardo", "Colina", "Lo Prado", "Cerro Navia", "El Bosque", "San Ramón", "Lo Espejo", "Pedro Aguirre Cerda", "La Pintana", "Padre Hurtado", "Santiago Centro"];
const NOMBRES: string[] = [...COMUNAS_ROSTER.map((c) => c.nombre as string), ...EXTRA];
const POR_NORM = new Map<string, string>(NOMBRES.map((c) => [norm(c), c]));

export function comunaDeDireccionAirroi(address: string): string | null {
  const m = address.match(/([^,]+),\s*Regi[oó]n Metropolitana/i);
  if (m) {
    const seg = norm(m[1].replace(/^\s*\d{7}\s*/, "").replace(/^\d+\s+/, ""));
    if (POR_NORM.has(seg)) return normalizeComuna(POR_NORM.get(seg)!);
    for (const [k, v] of Array.from(POR_NORM.entries())) if (seg.endsWith(" " + k) || seg === k) return normalizeComuna(v);
  }
  const a = norm(address);
  let mejor: { c: string; pos: number } | null = null;
  for (const [k, v] of Array.from(POR_NORM.entries())) {
    const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
    const mm = re.exec(a);
    if (mm && (v !== "Santiago" || !mejor) && (!mejor || mm.index > mejor.pos || mejor.c === "Santiago")) mejor = { c: v, pos: mm.index };
  }
  return mejor ? normalizeComuna(mejor.c) : null;
}
