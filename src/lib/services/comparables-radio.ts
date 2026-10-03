// ─────────────────────────────────────────────────────────────────────────────
// Comparables por radio — la parte PURA de market-suggestions.
//
// Lo que la RPC `properties_within_radius` devuelve entra acá como filas y sale
// como la sugerencia del wizard (arriendo, gastos comunes, contribuciones,
// precio/m²). Vive separado de la consulta para poder testearlo con un fixture:
// el 04-sep-2026 se descubrió que la función viva en la base no devolvía
// `gastos_comunes` —market-suggestions lo leía igual, siempre undefined— y el
// gasto común por radio nunca se estimó. Con la lógica pegada a la RPC nadie
// podía probar que el consumidor hacía algo con esa columna. Ahora sí:
// scripts/test-comparables-radio.ts le pasa filas con y sin gastos_comunes.
// ─────────────────────────────────────────────────────────────────────────────

import { estimarContribuciones } from "../contribuciones";
import type { MuestraArriendo } from "../arriendo-referencia";

/** Fila tal como la devuelve la RPC (migración 20260904). Los opcionales faltaban en la función vieja. */
export interface FilaRadio {
  /** id de scraped_properties (la RPC lo devuelve desde la migración 20260904). */
  id?: string;
  precio: number;
  /** "UF" o "CLP" (la RPC la devuelve desde la migración 20260904). Ver `aPesos`. */
  moneda?: string | null;
  superficie_m2: number | null;
  gastos_comunes?: number | null;
  dormitorios?: number | null;
  lat?: number | null;
  lng?: number | null;
  distance_meters?: number;
}

/**
 * Los precios del radio, todos en pesos (30-sep-2026). La obra nueva se publica en UF (9.112 de 9.213
 * activas) y los usados en pesos; la mediana trataba `precio` como pesos sin mirar `moneda`, así que
 * la venta nueva por radio salía en UF/m² —~180— y el consumidor, que espera pesos por m² y lo divide
 * por la UF, recibía ~0,004 UF/m²: el valor de mercado del depto quedaba en 0 y el motor lo descartaba.
 * En el radio sin condición ("mixto") mezclaba las dos monedas en la misma mediana. Sin UF válida, las
 * filas en UF se descartan antes que contarse como pesos.
 */
export function aPesos<T extends { precio: number; moneda?: string | null }>(filas: T[], ufCLP: number): T[] {
  const out: T[] = [];
  for (const f of filas) {
    if (f.moneda !== "UF") { out.push(f); continue; }
    if (ufCLP > 0) out.push({ ...f, precio: Number(f.precio) * ufCLP, moneda: "CLP" });
  }
  return out;
}

/** Mínimo de comparables limpios para proponer una mediana por radio. */
export const MIN_COMPARABLES_RADIO = 5;
/** Mínimo de gastos comunes conocidos para proponer uno. */
export const MIN_GGCC_RADIO = 3;

export interface ResumenRadio {
  /** Arriendo (o precio total) sugerido, CLP redondeado a miles. */
  arriendo: number;
  /** Mediana de gastos comunes de los comparables que lo publican, o null si son menos de MIN_GGCC_RADIO. */
  ggcc: number | null;
  contribTrim: number;
  /** Precio por m² (con factor de cierre aplicado). */
  precioM2?: number;
  sampleSize: number;
  /** Los avisos limpios detrás de la mediana, por distancia. El wizard la guarda en
   *  `zonaRadio.muestraArriendo` para que «Ver los comparables» muestre ESTA muestra. */
  muestra: MuestraArriendo;
  /** Las MISMAS filas de `muestra`, en el mismo orden, con coordenadas. El mapa del wizard dibuja
   *  esta lista y su leyenda cuenta su largo: leyenda, puntos y `sampleSize` salen de una sola lista
   *  (28-sep-2026: el mapa dibujaba los 125 arriendos del radio y la leyenda contaba los 22 de la muestra). */
  puntos: PuntoComparable[];
}

/** Un comparable de la muestra con su ubicación: la misma fila que cuenta el n, para dibujarla. */
export interface PuntoComparable {
  id?: string;
  lat: number | null;
  lng: number | null;
  precio: number;
  superficie_m2: number | null;
  distance_meters: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** La muestra en la forma que se guarda (enteros, por distancia, el más cercano primero) y los mismos
 *  avisos con coordenadas para dibujarlos. Salen de UNA lista ordenada: largo, orden y filas coinciden. */
function muestraYPuntos(clean: FilaRadio[], modo: MuestraArriendo["modo"]): { muestra: MuestraArriendo; puntos: PuntoComparable[] } {
  const dist = (a: FilaRadio) => num(a.distance_meters);
  const orden = [...clean].sort((x, y) => (dist(x) ?? 1e9) - (dist(y) ?? 1e9));
  const avisos = orden.map((a) => {
    const d = dist(a);
    return {
      distanciaM: d === null ? null : Math.round(d),
      precio: Math.round(Number(a.precio)),
      m2: a.superficie_m2 && a.superficie_m2 > 0 ? Math.round(Number(a.superficie_m2) * 10) / 10 : null,
    };
  });
  const puntos = orden.map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    lat: num(a.lat),
    lng: num(a.lng),
    precio: Number(a.precio),
    superficie_m2: a.superficie_m2,
    distance_meters: dist(a),
  }));
  return { muestra: { modo, avisos }, puntos };
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Filtra por superficie ±30%; si quedan menos de 4, devuelve el conjunto sin filtrar. */
export function filterBySurface<T extends { superficie_m2: number | null }>(props: T[], targetSup: number): T[] {
  if (!targetSup || targetSup <= 0) return props;
  const minSup = targetSup * 0.7;
  const maxSup = targetSup * 1.3;
  const filtered = props.filter(
    (p) => p.superficie_m2 && p.superficie_m2 >= minSup && p.superficie_m2 <= maxSup
  );
  return filtered.length >= 4 ? filtered : props;
}

/** Descarta superficies absurdas y outliers de precio/m² por IQR. */
export function filterOutliers<T extends { precio: number; superficie_m2: number | null }>(props: T[]): T[] {
  // 1. Superficies absurdas fuera.
  const valid = props.filter(
    (p) => !p.superficie_m2 || (p.superficie_m2 >= 15 && p.superficie_m2 <= 300)
  );

  // 2. IQR sobre precio/m² (solo las que traen superficie).
  const withM2 = valid.filter((p) => p.superficie_m2 && p.superficie_m2 > 0);
  const withoutM2 = valid.filter((p) => !p.superficie_m2 || p.superficie_m2 <= 0);

  if (withM2.length < 4) return valid; // sin masa para un IQR

  const ppm2 = withM2.map((p) => p.precio / p.superficie_m2!).sort((a, b) => a - b);
  const q1 = percentile(ppm2, 25);
  const q3 = percentile(ppm2, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;

  const filtered = withM2.filter((p) => {
    const pm2 = p.precio / p.superficie_m2!;
    return pm2 >= lo && pm2 <= hi;
  });

  return [...filtered, ...withoutM2];
}

/** Mediana de gastos comunes de las filas que lo publican, a miles; null si son pocas. */
function ggccDe(filas: FilaRadio[]): number | null {
  const ggccs = filas
    .map((a) => Number(a.gastos_comunes))
    .filter((g) => Number.isFinite(g) && g > 0);
  return ggccs.length >= MIN_GGCC_RADIO ? Math.round(median(ggccs) / 1000) * 1000 : null;
}

/**
 * Resume los comparables de un radio en la sugerencia del wizard.
 *
 * Dos modos, que son los dos pasos del loop de market-suggestions:
 *  · "conDorms": las filas ya vienen filtradas por dormitorios; el arriendo es
 *    la mediana de los precios.
 *  · "sinDorms": segundo intento sin filtro de dormitorios; el arriendo se
 *    escala desde la mediana de precio/m² a la superficie del sujeto, porque
 *    las filas mezclan tipologías.
 *
 * `null` = no hay muestra suficiente (menos de MIN_COMPARABLES_RADIO tras
 * limpiar; en "sinDorms", además, menos de 3 con superficie).
 */
/**
 * Cuánto crece el arriendo con el tamaño, por tipología (03-oct-2026, decisión de Fabrizio): el arriendo
 * mensual de un depto escala como (m²)^e frente a comparables de su misma tipología, en su radio.
 * Sin esta escala, la mediana del arriendo MENSUAL de la banda le daba a un 2D de 35 m² el arriendo de sus
 * comparables, ~10% más grandes (Ñuñoa: 284 Comprar/Ajustar marcados sobre su zona).
 *
 * Los valores salen de un backtest con 1.371 arriendos reales de Gran Santiago, cada uno predicho con sus
 * vecinos a 1 km (misma comuna y dormitorios, sin él): son los que minimizan el error dentro del radio.
 * Un 0,8 fijo (medido en Ñuñoa 2D) no mejoraba nada (8,7% contra 8,6% de hoy) porque subía 12,5% a los 1D
 * grandes; dentro de comuna se mide 0,43 / 0,55 / 0,83, pero dentro del radio pesa todavía menos el tamaño.
 * Un estudio (0 dormitorios) usa el valor del 1D.
 */
export const ELASTICIDADES_ARRIENDO: Readonly<Record<number, number>> = { 1: 0.2, 2: 0.4, 3: 0.8 };
export const ELASTICIDAD_ARRIENDO_4D_O_MAS = 0.8;
export function elasticidadArriendo(dormitorios: number | null | undefined): number {
  const d = Number(dormitorios);
  if (!(d >= 1)) return ELASTICIDADES_ARRIENDO[1];
  return d >= 4 ? ELASTICIDAD_ARRIENDO_4D_O_MAS : ELASTICIDADES_ARRIENDO[Math.round(d)];
}

/** Un arriendo mensual llevado al tamaño del depto: × (m² del depto / m² mediano de los comparables)^e.
 *  Sin superficie del depto o sin m² en los comparables, queda como está. */
export function escalarPorTamano(monto: number, superficie: number, m2Comparables: number[], elasticidad: number): number {
  const m2s = m2Comparables.filter((m) => Number.isFinite(m) && m > 0);
  if (!(superficie > 0) || m2s.length === 0) return monto;
  return monto * Math.pow(superficie / median(m2s), elasticidad);
}

/**
 * La referencia de la ZONA para la marca de arriendo sospechoso, en $/m² del depto (03-oct-2026): los
 * comparables de tamaño parecido (±30% de m²), cada uno llevado al tamaño del depto con la misma
 * elasticidad, y su mediana dividida por los m² del depto. Antes era la mediana del $/m² de TODOS los
 * tamaños × m²: castigaba a los chicos, que arriendan más caro por m². null si la banda no junta `min`.
 */
export function referenciaZonaPorTamano<T extends { precio: number; superficie_m2: number | null }>(filas: T[], superficie: number, min: number, elasticidad: number): number | null {
  if (!(superficie > 0)) return null;
  const banda = filas.filter((f) => f.superficie_m2 && f.superficie_m2 >= superficie * 0.7 && f.superficie_m2 <= superficie * 1.3);
  if (banda.length < min) return null;
  const llevados = banda.map((f) => f.precio * Math.pow(superficie / Number(f.superficie_m2), elasticidad));
  return Math.round(median(llevados) / superficie);
}

export function resumirComparablesRadio(
  filas: FilaRadio[],
  superficie: number,
  opts: { modo: "conDorms" | "sinDorms"; factorCierre: number; dormitorios?: number | null },
): ResumenRadio | null {
  const clean = filterBySurface(filterOutliers(filas), superficie);
  if (clean.length < MIN_COMPARABLES_RADIO) return null;

  const preciosM2 = clean
    .filter((a) => a.superficie_m2 && a.superficie_m2 > 0)
    .map((a) => a.precio / a.superficie_m2!)
    .sort((a, b) => a - b);

  if (opts.modo === "sinDorms") {
    if (preciosM2.length < 3) return null;
    const medianaM2 = preciosM2[Math.floor(preciosM2.length / 2)];
    return {
      arriendo: Math.round((medianaM2 * superficie) / 1000) * 1000,
      ggcc: ggccDe(clean),
      contribTrim: estimarContribuciones(Math.round(medianaM2 * superficie)),
      precioM2: Math.round(medianaM2 * opts.factorCierre),
      sampleSize: clean.length,
      ...muestraYPuntos(clean, "sinDorms"),
    };
  }

  const precios = clean.map((a) => a.precio);
  // La mediana mensual, llevada al tamaño del depto con la elasticidad de su tipología (03-oct-2026). Sin
  // dormitorios declarados, la tipología de la muestra (con el filtro de dormitorios es una sola). La
  // muestra guarda las cifras del ajuste —también la elasticidad— para que la ficha lo cuente igual.
  const m2s = clean.map((a) => Number(a.superficie_m2)).filter((m) => m > 0);
  const medianaMensual = median(precios);
  const dorms = opts.dormitorios ?? median(clean.map((a) => Number(a.dormitorios)).filter((d) => Number.isFinite(d)));
  const elasticidad = elasticidadArriendo(dorms);
  const mp = muestraYPuntos(clean, "conDorms");
  const ajuste = superficie > 0 && m2s.length > 0 ? { medianaMensual: Math.round(medianaMensual), m2Mediano: Math.round(median(m2s) * 10) / 10, elasticidad } : null;
  return {
    arriendo: Math.round(escalarPorTamano(medianaMensual, superficie, m2s, elasticidad) / 1000) * 1000,
    ggcc: ggccDe(clean),
    contribTrim: preciosM2.length > 0
      ? estimarContribuciones(Math.round(median(preciosM2) * superficie))
      : estimarContribuciones(superficie * 2_000_000),
    precioM2: preciosM2.length > 0 ? Math.round(median(preciosM2) * opts.factorCierre) : undefined,
    sampleSize: clean.length,
    ...mp,
    muestra: ajuste ? { ...mp.muestra, ajuste } : mp.muestra,
  };
}
