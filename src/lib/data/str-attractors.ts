// Legacy entry point — keep until all callers migrate to "./attractors".
// Re-exports the original symbols (CLINICAS, ZONAS_NEGOCIOS, ZONAS_TURISTICAS,
// ACCESO_SKI, distanciaMetros, distanciaMinima) plus the Attractor type, so
// imports in `src/lib/engines/short-term-score.ts` and
// `src/app/api/analisis/short-term/ai/route.ts` keep working unchanged.

export type { Attractor } from "./attractors";
export {
  CLINICAS,
  ZONAS_NEGOCIOS,
  ZONAS_TURISTICAS,
  ACCESO_SKI,
  distanciaMetros,
  distanciaMinima,
} from "./attractors";
