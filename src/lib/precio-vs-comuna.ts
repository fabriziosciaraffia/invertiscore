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

import type { PrecioVsComuna } from "./types";

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
}): PrecioVsComuna {
  const sujetoUfM2 = Math.round(p.sujetoUfM2 * 10) / 10;
  const mediana = p.medianaComunaUfM2;

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
  };
}
