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
