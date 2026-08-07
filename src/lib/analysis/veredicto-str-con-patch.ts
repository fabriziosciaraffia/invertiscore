// Reevaluación del VEREDICTO STR sobre un input parchado — espejo de `veredictoConPatch`
// (LTR, analysis.ts). Es la ruta única que consumen los hallazgos que necesitan preguntarle
// al motor "¿y si esto fuera distinto?" (hoy: distancia al veredicto).
//
// SIN RECURSIÓN por construcción: corre calcShortTerm → calcFrancoScoreSTR y se detiene ahí.
// NO llama a buildStrHallazgos, que es donde se siembra el hallazgo que usa este closure
// (mismo criterio que LTR, donde la ruta parchada tampoco reconstruye hallazgos).
//
// DOS OBJETOS, no uno. A diferencia de LTR —donde el patch cae sobre un único
// `AnalisisInput`— acá el veredicto depende de `ShortTermInputs` (motor) Y de los extras de
// `ScoreSTRInputs` (dimensión factibilidad: tipología, regulación, atractores, revenue de
// mercado). El único campo que vive en los DOS y hay que patchear en ambos es
// `precioCompra`: el motor lo usa para pie/dividendo y el score para el cap rate implícito.
// Los demás extras (lat/lng, dormitorios, superficie, regulación, revenueP50,
// monthlyRevenue) son del mercado y de la propiedad física — ninguna palanca los mueve, y
// mantenerlos fijos es lo correcto: subir la tarifa propia no cambia la mediana de la zona.

import { calcShortTerm, type ShortTermInputs } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import type { Veredicto } from "@/lib/types";

/** Extras del score que NO dependen del patch — se congelan al construir el contexto. */
export type ScoreSTRExtras = Omit<ScoreSTRInputs, "results" | "precioCompra">;

/** Palancas patchables. `precioCompra` en CLP (unidad del motor STR, no UF). */
export interface StrPatch {
  precioCompra?: number;
  /** CLP/noche. Fuerza el ADR del escenario base (mismo camino que el override del wizard). */
  adrOverride?: number;
  modoGestion?: ShortTermInputs["modoGestion"];
  plazoCredito?: number;
  /** Decimal (0.20 = 20%), igual que `ShortTermInputs.piePercent`. */
  piePercent?: number;
}

export interface VeredictoStrCtx {
  inputs: ShortTermInputs;
  scoreExtras: ScoreSTRExtras;
  asOf: Date;
}

/**
 * Veredicto STR con el patch aplicado. Puro y barato (~0,2 ms medido), pensado para
 * bisección: se llama decenas de veces por análisis.
 */
export function veredictoStrConPatch(ctx: VeredictoStrCtx, patch: StrPatch): Veredicto {
  const inputs: ShortTermInputs = {
    ...ctx.inputs,
    ...(patch.precioCompra !== undefined ? { precioCompra: patch.precioCompra } : {}),
    ...(patch.adrOverride !== undefined ? { adrOverride: patch.adrOverride } : {}),
    ...(patch.modoGestion !== undefined ? { modoGestion: patch.modoGestion } : {}),
    ...(patch.plazoCredito !== undefined ? { plazoCredito: patch.plazoCredito } : {}),
    ...(patch.piePercent !== undefined ? { piePercent: patch.piePercent } : {}),
  };
  const result = calcShortTerm(inputs, ctx.asOf);
  return calcFrancoScoreSTR({
    ...ctx.scoreExtras,
    results: result,
    precioCompra: inputs.precioCompra,
  }).veredicto;
}
