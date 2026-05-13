import type { Veredicto } from "./types";
import { normalizeLegacyVerdict } from "./types";

// Commit E.2 · 2026-05-13 — colapso a una sola señal de veredicto.
// Antes coexistían `readEngineSignal` (motor, sin RECONSIDERA) y
// `readFrancoVerdict` (UI-facing, prevalecía en render). Ese diseño habilitaba
// la caja "Franco diverge del motor" en STR Hero, que rompía la consistencia
// señal/contenido (ver audit-commit-e-metodologia §3).
//
// Post-E.2 la fuente de verdad es `results.veredicto`. Para back-compat con
// análisis legacy persistidos antes del rename, leemos en cascada:
//   1. `results.veredicto` (post-E.2 canónico)
//   2. `results.francoVerdict` (post-Commit-1 pre-E.2 — era el UI-facing)
//   3. `results.engineSignal` (post-skill §1.7 pre-Commit-1)
//   4. legacy "veredicto" string primitivo (pre-skill)
//
// Cada eslabón pasa por `normalizeLegacyVerdict()` para coercer strings
// legacy LTR/STR ("AJUSTA EL PRECIO", "VIABLE", etc.) al vocabulario canónico.
// El DB nunca se reescribe (immutable history); la coerción es read-only.

type ResultsLike = {
  veredicto?: string;
  engineSignal?: string;
  francoVerdict?: string;
} | null | undefined;

export function readVeredicto(results: ResultsLike): Veredicto | undefined {
  // El orden importa: `francoVerdict` antes que `engineSignal` para que
  // análisis legacy con divergencia (rare, ≤10% del set per audit §3.3)
  // muestren lo que la UI mostraba antes — francoVerdict prevalecía en render.
  const raw =
    results?.veredicto ??
    results?.francoVerdict ??
    results?.engineSignal;
  return normalizeLegacyVerdict(raw) ?? undefined;
}
