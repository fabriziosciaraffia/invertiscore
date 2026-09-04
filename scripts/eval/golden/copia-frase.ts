// ============================================================================
// GOLDEN · copia de fraseCanonica — helpers compartidos LTR (A1) y STR (AS5)
// ============================================================================
// Una oración de la prosa COPIA una fraseCanonica cuando el run común de palabras
// cubre ≥ 60% de la frase, con un mínimo de 8 palabras. A 8 palabras secas el check
// castigaba la reformulación fiel del sobreprecio (GS-7: "está 59% sobre la mediana de
// la comuna" comparte 8-10 palabras con la card porque la cláusula métrica con cifra
// exacta y ámbito es la que exige la doctrina); las copias reales del parque
// reproducían la frase entera. Vivía en generate.ts (LTR, v18); se extrajo el
// 03-sep-2026 para que la tanda STR mida con la misma regla.

export const norm = (s: string) => s.replace(/\s+/g, " ").trim();
export const wordsOf = (s: string) => s.toLowerCase().replace(/\*\*/g, "").split(/\s+/).filter(Boolean);
export const sentencesOf = (s: string) =>
  s.replace(/\*\*/g, "").split(/(?<=[.!?;])\s+/).map((x) => x.trim()).filter(Boolean);

/** Largo del run común más largo entre dos secuencias de palabras. */
export function runComun(a: string[], b: string[]): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    let k = 0; while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
    if (k > best) best = k;
  }
  return best;
}

export const REPITE_FRASE = 8;
export const REPITE_FRACCION = 0.6;

export const esCopia = (oracion: string[], frase: string[]): boolean =>
  runComun(oracion, frase) >= Math.max(REPITE_FRASE, Math.ceil(frase.length * REPITE_FRACCION));

/** Frases canónicas de una lista de hallazgos, ya tokenizadas y con largo mínimo. */
export const frasesCanonicasDe = (hallazgos: Array<{ fraseCanonica?: string | null }>): string[][] =>
  hallazgos.map((h) => wordsOf(norm(String(h.fraseCanonica ?? "")))).filter((w) => w.length >= REPITE_FRASE);

/** ¿Alguna oración del texto copia alguna fraseCanonica? Devuelve la oración culpable o null. */
export function oracionQueCopia(texto: string, frases: string[][]): string | null {
  for (const o of sentencesOf(norm(texto))) {
    const w = wordsOf(o);
    if (frases.some((f) => esCopia(w, f))) return o;
  }
  return null;
}
