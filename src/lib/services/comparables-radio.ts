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

/** Fila tal como la devuelve la RPC (migración 20260904). Los opcionales faltaban en la función vieja. */
export interface FilaRadio {
  precio: number;
  superficie_m2: number | null;
  gastos_comunes?: number | null;
  dormitorios?: number | null;
  lat?: number | null;
  lng?: number | null;
  distance_meters?: number;
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
export function resumirComparablesRadio(
  filas: FilaRadio[],
  superficie: number,
  opts: { modo: "conDorms" | "sinDorms"; factorCierre: number },
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
    };
  }

  const precios = clean.map((a) => a.precio);
  return {
    arriendo: Math.round(median(precios) / 1000) * 1000,
    ggcc: ggccDe(clean),
    contribTrim: preciosM2.length > 0
      ? estimarContribuciones(Math.round(median(preciosM2) * superficie))
      : estimarContribuciones(superficie * 2_000_000),
    precioM2: preciosM2.length > 0 ? Math.round(median(preciosM2) * opts.factorCierre) : undefined,
    sampleSize: clean.length,
  };
}
