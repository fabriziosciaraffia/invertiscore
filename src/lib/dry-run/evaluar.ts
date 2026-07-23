// ─────────────────────────────────────────────────────────────────────────────
// Dry-run del wizard v4 — lógica de "al filo" (FASE 5)
//
// Definición (opción B, aprobada): un análisis está AL FILO si una perturbación
// pequeña (±Δ) de una variable INLINE-CORREGIBLE por el usuario flipea el
// veredicto. `variablesSensibles` = las que flipean (la variable ES el criterio).
//
// Solo consume el motor determinístico (runAnalysis LTR / calcShortTerm+score STR),
// SIN IA, SIN persistir, SIN cobrar. Compartido por el endpoint y la calibración.
//
// Contrato hacia afuera: { alFilo, variablesSensibles } — el score/veredicto/Δ
// viven y mueren acá dentro.
// ─────────────────────────────────────────────────────────────────────────────

import { runAnalysis } from "@/lib/analysis";
import type { AnalisisInput } from "@/lib/types";
import { calcShortTerm, type ShortTermInputs } from "@/lib/engines/short-term-engine";
import { calcFrancoScoreSTR, type ScoreSTRInputs } from "@/lib/engines/short-term-score";

export interface AlFiloDetalle {
  /** Veredicto base (interno — NUNCA cruza el cable). */
  base: string;
  alFilo: boolean;
  /** Variables cuyo ±Δ flipeó el veredicto, en orden de prioridad. */
  variablesSensibles: string[];
}

/** Etiquetas de variable listas para la card. */
export const VAR_ARRIENDO = "el arriendo";
export const VAR_TASA = "la tasa";
export const VAR_TARIFA = "la tarifa";
export const VAR_OCUPACION = "la ocupación";

interface VarSpec {
  label: string;
  /** Sigue siendo estimación (no corregida por el usuario) → mayor prioridad en la card. */
  estimacion: boolean;
  mutate: (input: AnalisisInput, factor: number) => AnalisisInput;
}

/**
 * Evalúa "al filo" para un input LTR perturbando su set de variables corregibles.
 * `perturbarTasa`: solo cuando el usuario aceptó la tasa estimada (no si puso su
 * pre-aprobada — nombrarla sería inútil, no la corrige en el wizard).
 */
export function evaluarLtr(
  input: AnalisisInput,
  uf: number,
  mediana: { mediana: number | null; n: number } | undefined,
  asOf: Date,
  delta: number,
  opts: { perturbarTasa: boolean; arriendoEsEstimacion?: boolean; tasaEsEstimacion?: boolean },
): AlFiloDetalle {
  const veredictoDe = (i: AnalisisInput) => runAnalysis(i, uf, mediana, asOf).veredicto as string;
  const base = veredictoDe(input);

  const specs: VarSpec[] = [
    {
      label: VAR_ARRIENDO,
      estimacion: opts.arriendoEsEstimacion ?? true,
      mutate: (i, f) => ({ ...i, arriendo: Math.round((i.arriendo || 0) * f) }),
    },
  ];
  if (opts.perturbarTasa) {
    specs.push({
      label: VAR_TASA,
      estimacion: opts.tasaEsEstimacion ?? true,
      mutate: (i, f) => ({ ...i, tasaInteres: (i.tasaInteres || 4.72) * f }),
    });
  }

  return evaluarSpecs(base, specs, (spec, factor) => veredictoDe(spec.mutate(input, factor)), delta);
}

/** Núcleo común: perturba cada spec ±Δ; recoge las que flipean; prioriza estimación. */
function evaluarSpecs(
  base: string,
  specs: VarSpec[],
  veredictoTras: (spec: VarSpec, factor: number) => string,
  delta: number,
): AlFiloDetalle {
  const flip: VarSpec[] = [];
  for (const spec of specs) {
    const sube = veredictoTras(spec, 1 + delta);
    const baja = veredictoTras(spec, 1 - delta);
    if (sube !== base || baja !== base) flip.push(spec);
  }
  // Prioriza las que siguen siendo estimación (valor máximo de la card sobre lo
  // no revisado); las ya corregidas van después, pero igual se reportan.
  flip.sort((a, b) => Number(b.estimacion) - Number(a.estimacion));
  return { base, alFilo: flip.length > 0, variablesSensibles: flip.map((s) => s.label) };
}

// ─────────────────────────────────────────────────────────────────────────────
// STR — "al filo" perturbando tarifa y ocupación.
//
// Unidades (calibradas sobre GE-1..6 · decisión F5): TARIFA = ±% RELATIVO sobre
// el ADR efectivo; OCUPACIÓN = ±pp ABSOLUTOS sobre la ocupación efectiva. Ambos
// se aplican vía adrOverride/occOverride sobre `ejesAplicados.adrFinal` /
// `.ocupacionFinal` (NO sobre los top-level del input) — reconstrucción idéntica
// a la del motor. Al perturbar una, la otra queda intacta (override puntual).
// ─────────────────────────────────────────────────────────────────────────────

export const STR_DELTA_TARIFA = 0.1;   // % relativo sobre adrFinal
export const STR_DELTA_OCC_PP = 0.05;  // puntos porcentuales absolutos sobre ocupacionFinal

/** Contexto de score STR sin `results` (lo inyecta cada corrida del motor). */
export type StrScoreCtx = Omit<ScoreSTRInputs, "results">;

const clampOcc = (x: number) => Math.max(0.05, Math.min(0.98, x));

/**
 * Evalúa "al filo" para un input STR. Corre el motor base para leer el veredicto
 * y el ADR/ocupación EFECTIVOS (ejesAplicados), luego perturba cada uno ±Δ y
 * recoge los que flipean el veredicto.
 * `esEstimacion`: la tarifa/ocupación siguen siendo estimación (el usuario no las
 * corrigió) → mayor prioridad en la card. Ambas comparten el flag: el toggle del
 * Acto 3 corrige las dos a la vez.
 */
export function evaluarStr(
  inputs: ShortTermInputs,
  scoreCtx: StrScoreCtx,
  asOf: Date,
  deltaTarifa: number,
  deltaOccPp: number,
  opts: { esEstimacion: boolean },
): AlFiloDetalle {
  const correr = (i: ShortTermInputs): { veredicto: string; adrFinal: number; occFinal: number } => {
    const result = calcShortTerm(i, asOf);
    const score = calcFrancoScoreSTR({ ...scoreCtx, results: result });
    return {
      veredicto: score.veredicto as string,
      adrFinal: result.ejesAplicados?.adrFinal ?? NaN,
      occFinal: result.ejesAplicados?.ocupacionFinal ?? NaN,
    };
  };

  const b = correr(inputs);
  const base = b.veredicto;

  // Guard anti-NaN: sin ejes efectivos válidos no se puede perturbar → no al filo.
  if (!Number.isFinite(b.adrFinal) || b.adrFinal <= 0 || !Number.isFinite(b.occFinal)) {
    return { base, alFilo: false, variablesSensibles: [] };
  }

  const flip: { label: string; estimacion: boolean }[] = [];

  // Tarifa: ±Δ relativo sobre el ADR efectivo (override), ocupación intacta.
  const tarifaFlip = [1, -1].some((s) => {
    const adrOverride = Math.round(b.adrFinal * (1 + s * deltaTarifa));
    return correr({ ...inputs, adrOverride }).veredicto !== base;
  });
  if (tarifaFlip) flip.push({ label: VAR_TARIFA, estimacion: opts.esEstimacion });

  // Ocupación: ±Δ pp absolutos sobre la ocupación efectiva (override), ADR intacto.
  const occFlip = [1, -1].some((s) => {
    const occOverride = clampOcc(b.occFinal + s * deltaOccPp);
    return correr({ ...inputs, occOverride }).veredicto !== base;
  });
  if (occFlip) flip.push({ label: VAR_OCUPACION, estimacion: opts.esEstimacion });

  flip.sort((a, z) => Number(z.estimacion) - Number(a.estimacion));
  return { base, alFilo: flip.length > 0, variablesSensibles: flip.map((f) => f.label) };
}
