import type { EngineSignal, FrancoVerdict } from "./types";
import { normalizeLegacyVerdict } from "./types";

// Hasta que termine el refactor de prompts (Fase 3), análisis guardados en DB
// pueden tener la llave vieja `veredicto` en vez de `engineSignal/francoVerdict`.
// Estos helpers leen con fallback. Ver analysis-voice-franco/SKILL.md §1.7.
//
// Commit 1 · 2026-05-11 — vocabulario unificado de veredictos.
// Las lecturas pasan por `normalizeLegacyVerdict()` para mapear strings legacy:
//   LTR: "AJUSTA EL PRECIO" → "AJUSTA SUPUESTOS"
//   STR: "VIABLE" → "COMPRAR", "AJUSTA ESTRATEGIA" → "AJUSTA SUPUESTOS",
//        "NO RECOMENDADO" → "BUSCAR OTRA"
// El DB no se reescribe (immutable history); la coerción es solo en read path.

type ResultsLike = {
  engineSignal?: string;
  francoVerdict?: string;
  veredicto?: string;
} | null | undefined;

export function readEngineSignal(results: ResultsLike): EngineSignal | undefined {
  const raw = results?.engineSignal ?? results?.veredicto;
  const normalized = normalizeLegacyVerdict(raw);
  // EngineSignal no incluye RECONSIDERA LA ESTRUCTURA — eso es exclusivo de
  // francoVerdict (skill §1.7). Si normalize devolvió RECONSIDERA, lo
  // promovemos a undefined porque el motor nunca lo emite.
  if (normalized === "RECONSIDERA LA ESTRUCTURA") return undefined;
  return normalized ?? undefined;
}

export function readFrancoVerdict(results: ResultsLike): FrancoVerdict | undefined {
  const raw = results?.francoVerdict ?? results?.engineSignal ?? results?.veredicto;
  return normalizeLegacyVerdict(raw) ?? undefined;
}
