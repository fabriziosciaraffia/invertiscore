// Comparación determinística de precio/m² del sujeto vs mediana comunal de VENTA
// (LTR) — motor síncrono y puro. Espejo estructural de `cap-rate-hallazgo.ts`,
// pero en FASE A es SOLO el cómputo (sujeto UF/m² + desviación vs comuna): NO un
// hallazgo (sin fraseCanonica/decisividad/procedencia). FASE B construirá
// `buildHallazgoSobreprecio` encima de este builder.
//
// DOCTRINA DE BASE HOMOGÉNEA: la mediana comunal sale de precio_aviso/superficie
// SIN adición de estacionamiento (comuna-stats.ts:84,88-89). Por eso el sujeto
// entra SIN el estacionamiento opcional (input.precio/superficie), NO
// metrics.precioM2 (que suma precioEstacionamiento, analysis.ts:204-207).
// Comparar ambos lados en la misma base evita el sesgo "se ve más caro solo por
// tener parking".
//
// La mediana es ASYNC (scraped_properties): el caller la resuelve y la inyecta YA
// RESUELTA; este builder es síncrono y puro, no hace queries.

import type { PosicionEnComuna, PrecioVsComuna } from "./types";
import type { CondicionMercado } from "./comuna-stats";

/**
 * POSICIÓN DEL SUJETO POR CUARTILES (21-sep-2026). Devuelve null —no un cuartil
 * inventado— cuando falta alguno o cuando la terna no es coherente (p25 ≤ mediana ≤ p75):
 * un snapshot corrupto no puede producir «sobre_p75». Los bordes van con el cuartil de
 * abajo (≤), igual que `desviacionPct` trata «en la mediana» como no-adverso.
 */
export function posicionEnComuna(
  sujetoUfM2: number,
  mediana: number,
  p25: number | null | undefined,
  p75: number | null | undefined,
): PosicionEnComuna | null {
  if (typeof p25 !== "number" || typeof p75 !== "number") return null;
  if (!Number.isFinite(p25) || !Number.isFinite(p75) || !(p25 > 0) || !(p75 > 0)) return null;
  if (!(p25 <= mediana && mediana <= p75)) return null;
  if (!(sujetoUfM2 > 0)) return null;
  if (sujetoUfM2 <= p25) return "bajo_p25";
  if (sujetoUfM2 <= mediana) return "p25_mediana";
  if (sujetoUfM2 <= p75) return "mediana_p75";
  return "sobre_p75";
}

/**
 * Empaqueta la cifra UF/m² del sujeto (sin estacionamiento) + la desviación vs la
 * mediana comunal de venta. `desviacionPct` y `sobreprecioUfM2` solo se computan
 * cuando la mediana es confiable (>0) y el sujeto es finito (>0); si no, ambos
 * null y confiable=false. `sujetoUfM2` se devuelve siempre (redondeado a 1 dec),
 * para que los tres consumidores —narración, anomalías, hero— lean la misma cifra.
 *
 * Réplica exacta del cómputo que hoy vive inline en ai-generation.ts (:878, :1065),
 * solo que con base homogénea (sujeto sin estacionamiento) y en un único lugar.
 */
export function buildPrecioVsComuna(p: {
  /** Precio depto / superficie, SIN estacionamiento. = round(input.precio/input.superficie, 1 dec). */
  sujetoUfM2: number;
  /** Mediana comunal de venta UF/m² ya resuelta (null si no hay dato). */
  medianaComunaUfM2: number | null;
  /** true si la mediana es un dato confiable. */
  confiable: boolean;
  /** N de ventas válidas usadas para la mediana. */
  n: number;
  /** Universo de la muestra (nuevo|usado). Ausente ⇒ mediana mixta pre-segmentación. */
  universo?: CondicionMercado;
  /** Cuartiles UF/m² de la misma muestra. `undefined` = snapshot anterior al campo (no se
   *  emite nada); `null` = se midió y no alcanzó. */
  p25UfM2?: number | null;
  p75UfM2?: number | null;
}): PrecioVsComuna {
  const sujetoUfM2 = Math.round(p.sujetoUfM2 * 10) / 10;
  const mediana = p.medianaComunaUfM2;
  const universo = p.universo ? { universo: p.universo } : {};
  // Los cuartiles viajan solo si el caller los trae (aunque sean null): ausencia ≠ null.
  const traeCuartiles = p.p25UfM2 !== undefined || p.p75UfM2 !== undefined;
  const cuartiles = traeCuartiles ? { p25UfM2: p.p25UfM2 ?? null, p75UfM2: p.p75UfM2 ?? null } : {};

  const sujetoOk = Number.isFinite(sujetoUfM2) && sujetoUfM2 > 0;
  const medianaOk = typeof mediana === "number" && Number.isFinite(mediana) && mediana > 0;
  const confiable = p.confiable && sujetoOk && medianaOk;

  if (!confiable || mediana == null) {
    return {
      sujetoUfM2,
      medianaComunaUfM2: medianaOk ? mediana : null,
      desviacionPct: null,
      sobreprecioUfM2: null,
      confiable: false,
      n: p.n,
      ...universo,
      ...cuartiles,
      ...(traeCuartiles ? { posicion: null } : {}),
    };
  }

  // Misma fórmula que ai-generation.ts:1065 (%) y :878 (absoluto UF).
  const desviacionPct = Math.round(((sujetoUfM2 - mediana) / mediana) * 100);
  const sobreprecioUfM2 = Math.round((sujetoUfM2 - mediana) * 10) / 10;

  return {
    sujetoUfM2,
    medianaComunaUfM2: mediana,
    desviacionPct,
    sobreprecioUfM2,
    confiable: true,
    n: p.n,
    ...universo,
    ...cuartiles,
    ...(traeCuartiles ? { posicion: posicionEnComuna(sujetoUfM2, mediana, p.p25UfM2, p.p75UfM2) } : {}),
  };
}
