// ─────────────────────────────────────────────────────────────────────────────
// Criterio ÚNICO del patrimonio comparado (finding · chart web · chart PDF ·
// documento). Antes cada superficie traía el suyo: el finding comparaba con una
// tolerancia de $1.000 absolutos y el chart y el PDF con 0,5% del valor. Medido
// sobre los 54 pares AMBAS del parque, los dos umbrales clasifican IDÉNTICO
// (0 divergencias), así que converger no mueve ninguna pantalla — solo deja de
// haber tres definiciones de la misma pregunta.
// ─────────────────────────────────────────────────────────────────────────────

import type { YearProjection, AnalysisMetrics } from "@/lib/types";
import { contarAniosPreEntrega } from "@/lib/pre-entrega-serie";

/**
 * Tolerancia para dar dos patrimonios por iguales. Absoluta y no relativa: lo
 * que separa a las modalidades cuando el modelo está homologado es redondeo,
 * no una fracción del precio.
 */
export const PATRIMONIO_TOLERANCIA_CLP = 1000;

/** ¿Los dos patrimonios a 10 años son el mismo número, salvo redondeo? */
export function patrimoniosIguales(ltrPat: number, strPat: number): boolean {
  return Math.abs(ltrPat - strPat) < PATRIMONIO_TOLERANCIA_CLP;
}

/**
 * ¿Los dos lados están medidos sobre puntos de partida distintos?
 *
 * Hoy la única causa es la entrega futura, y solo el lado LTR la conoce:
 * `buildStrPayload` no emite `estadoVenta`/`fechaEntrega` y `ShortTermInputs` no
 * tiene los campos, así que la proyección de renta corta arranca a operar en el
 * mes 1 aunque el depto se entregue en 2031. Con un lado esperando la escritura
 * y el otro amortizando desde el principio, los patrimonios a 10 años no miden
 * lo mismo y ninguna superficie puede afirmar equivalencia ni restarlos.
 *
 * Predicado compartido con el simulador y el payback (`pre-entrega-serie`): el
 * prefijo de la serie con deuda 0. NUNCA `estadoVenta === "futura"`, que deja
 * fuera "blanco" y "verde" — 15 de los 47 pre-entrega del parque.
 *
 * Se activa en 3 de los 8 pares con el lado LTR en pre-entrega. Los otros 5
 * tienen la entrega dentro del año 1: su serie no tiene ningún año completo sin
 * deuda, la amortización sí es equivalente, y la brecha que puedan mostrar viene
 * de otra causa (precio distinto entre lados, que es un problema aparte).
 */
export function hayAsimetriaDeEntrega(
  ltrProjections: YearProjection[] | undefined,
  ltrMetrics: Pick<AnalysisMetrics, "precioCLP" | "pieCLP"> | undefined,
): boolean {
  if (!ltrProjections?.length || !ltrMetrics) return false;
  return contarAniosPreEntrega(ltrProjections, {
    precioCLP: ltrMetrics.precioCLP ?? 0,
    pieCLP: ltrMetrics.pieCLP ?? 0,
  }) > 0;
}
