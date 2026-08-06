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
  // Serie del lado STR. REQUERIDA a propósito: mientras el predicado miraba un
  // solo lado, un análisis donde LAS DOS modalidades esperan —que es lo que
  // produce el motor desde el paso 3— se marcaba como asimétrico y la
  // comparativa se negaba a comparar algo perfectamente comparable. Que el tipo
  // la exija obliga a cada superficie a decidirlo con los dos lados a la vista.
  strProjections: Array<{ saldoCredito: number }> | undefined,
): boolean {
  if (!ltrProjections?.length || !ltrMetrics) return false;
  const ltrEspera = contarAniosPreEntrega(ltrProjections, {
    precioCLP: ltrMetrics.precioCLP ?? 0,
    pieCLP: ltrMetrics.pieCLP ?? 0,
  }) > 0;
  if (!ltrEspera) return false;
  // Asimetría = uno espera y el otro no. Si los dos esperan, los patrimonios
  // vuelven a estar medidos sobre el mismo punto de partida y la comparación es
  // legítima: medido sobre los 3 pares afectados, inyectarle al STR la fecha
  // que ya tenía el LTR lleva la brecha a $0 EXACTO en los tres.
  return !esperaSegunSerie(strProjections);
}

/**
 * ¿Esta serie arranca con años sin deuda? Mismo criterio que
 * `contarAniosPreEntrega` pero sobre cualquier serie que exponga `saldoCredito`
 * —la de renta corta lo hace— y sin el guard de crédito, que acá es redundante:
 * una compra sin deuda tiene la serie ENTERA en 0 y el `n >= length` la
 * descarta igual.
 */
function esperaSegunSerie(serie: Array<{ saldoCredito: number }> | undefined): boolean {
  if (!serie?.length) return false;
  let n = 0;
  for (const p of serie) {
    if (p.saldoCredito > 0) break;
    n++;
  }
  return n > 0 && n < serie.length;
}
