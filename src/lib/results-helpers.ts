import type { EngineSignal, FrancoVerdict } from "./types";

// Hasta que termine el refactor de prompts (Fase 3), análisis guardados en DB
// pueden tener la llave vieja `veredicto` en vez de `engineSignal/francoVerdict`.
// Estos helpers leen con fallback. Ver analysis-voice-franco/SKILL.md §1.7.

type ResultsLike = {
  engineSignal?: string;
  francoVerdict?: string;
  veredicto?: string;
} | null | undefined;

export function readEngineSignal(results: ResultsLike): EngineSignal | undefined {
  const raw = results?.engineSignal ?? results?.veredicto;
  return raw as EngineSignal | undefined;
}

export function readFrancoVerdict(results: ResultsLike): FrancoVerdict | undefined {
  const raw = results?.francoVerdict ?? results?.engineSignal ?? results?.veredicto;
  return raw as FrancoVerdict | undefined;
}
