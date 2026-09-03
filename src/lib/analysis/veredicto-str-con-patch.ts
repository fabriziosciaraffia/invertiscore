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

import { calcShortTerm, type ShortTermInputs, type ShortTermResult } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type FrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";
import type { Veredicto } from "@/lib/types";

/** Extras del score que NO dependen del patch — se congelan al construir el contexto. */
export type ScoreSTRExtras = Omit<ScoreSTRInputs, "results" | "precioCompra">;

/** Palancas patchables. `precioCompra` en CLP (unidad del motor STR, no UF).
 *  Las cinco primeras las usa la distancia al veredicto; el resto entró el 03-sep-2026
 *  con la decisividad real (calcDecisividadesSTR): son los knobs que llevan cada
 *  hallazgo a su neutro. `undefined` = no tocar; `null` donde el motor lo admite. */
export interface StrPatch {
  precioCompra?: number;
  /** CLP/noche. Fuerza el ADR del escenario base (mismo camino que el override del wizard). */
  adrOverride?: number;
  modoGestion?: ShortTermInputs["modoGestion"];
  plazoCredito?: number;
  /** Decimal (0.20 = 20%), igual que `ShortTermInputs.piePercent`. */
  piePercent?: number;
  /** Decimal (0.045 = 4,5%), igual que `ShortTermInputs.tasaCredito`. */
  tasaCredito?: number;
  /** Decimal 0-1. Fuerza la ocupación del escenario base (mismo camino que el override). */
  occOverride?: number | null;
  /** CLP/mes del arriendo largo de la comparativa. */
  arriendoLargoMensual?: number;
  /** Años. Con 0 y sin override el CapEx de puesta a punto cae a 0. */
  antiguedad?: number;
  costoPuestaAPuntoCLP?: number | null;
}

export interface VeredictoStrCtx {
  inputs: ShortTermInputs;
  scoreExtras: ScoreSTRExtras;
  asOf: Date;
}

/** Inputs del motor con el patch aplicado: solo las claves presentes (`undefined` = no tocar). */
function inputsConPatch(ctx: VeredictoStrCtx, patch: StrPatch): ShortTermInputs {
  const out: ShortTermInputs = { ...ctx.inputs };
  for (const k of Object.keys(patch) as (keyof StrPatch)[]) {
    const v = patch[k];
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Score STR completo sobre un resultado ya computado (o parchado a nivel resultado —
 *  así neutraliza `flujo_str`, sin motor). `precioCompra` es el del ctx salvo que el
 *  caller lo pase: el score lo usa para el cap rate implícito. */
export function francoScoreStrDeResultado(
  ctx: VeredictoStrCtx,
  result: ShortTermResult,
  precioCompra: number = ctx.inputs.precioCompra,
): FrancoScoreSTR {
  return calcFrancoScoreSTR({ ...ctx.scoreExtras, results: result, precioCompra });
}

/**
 * Recompute STR completo con el patch: motor + score. Puro y barato (0,04 a 0,14 ms
 * medido sobre filas reales), pensado para bisección: se llama decenas de veces por
 * análisis. Es la ruta única de la distancia al veredicto y de la decisividad real.
 */
export function recomputeStrConPatch(
  ctx: VeredictoStrCtx,
  patch: StrPatch,
): { inputs: ShortTermInputs; result: ShortTermResult; francoScore: FrancoScoreSTR } {
  const inputs = inputsConPatch(ctx, patch);
  const result = calcShortTerm(inputs, ctx.asOf);
  return { inputs, result, francoScore: francoScoreStrDeResultado(ctx, result, inputs.precioCompra) };
}

/** Score STR completo (score, veredicto, gates, desglose) con el patch aplicado. */
export function francoScoreStrConPatch(ctx: VeredictoStrCtx, patch: StrPatch): FrancoScoreSTR {
  return recomputeStrConPatch(ctx, patch).francoScore;
}

/** Veredicto STR con el patch aplicado (lo que consume la distancia al veredicto). */
export function veredictoStrConPatch(ctx: VeredictoStrCtx, patch: StrPatch): Veredicto {
  return francoScoreStrConPatch(ctx, patch).veredicto;
}
