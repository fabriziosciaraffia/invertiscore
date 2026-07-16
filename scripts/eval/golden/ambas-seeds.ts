// ============================================================================
// GOLDEN SET COMPARATIVO (AMBAS · D1+D2) — SEEDS
// ============================================================================
// Congela 7 pares reales del corpus de calibración (uno por banda del veredicto
// comparativo) en ambas-seeds-frozen.json. El veredicto comparativo (recomendacion +
// banda + flip de gestión) vive self-contained en el motor STR: calcShortTerm deriva
// ltr_noiMensual de input.arriendoLargoMensual y emite `veredictoComparativo`. Por eso el
// golden es un recompute del lado STR + extracción del veredicto — determinista congelando
// el airbnbRaw (no re-pega a AirROI), igual que el tier STR. UF congelada (el veredicto es
// UF-invariante: sobre-renta y break-even son ratios/CLP que no dependen de la UF).
//
// Freeze (out-of-band, lee DB): scripts/of-ambas-golden-freeze.ts.
// Baseline (0 tokens): ambas-accept.ts → ambas-baseline.json.
// Verificación (0 tokens): ambas-recompute.ts → runAmbasTier(), la corre el runner con --ambas.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";

export interface AmbasSeed {
  key: string;
  label: string;
  banda: string;   // banda esperada (documental; la autoritativa es ambas-baseline.json)
  nota: string;
}

// Metadata de los 7 seeds (los datos frozen viven en ambas-seeds-frozen.json, key idéntica).
export const AMBAS_SEEDS: AmbasSeed[] = [
  { key: "AG-1-fragil-flip", label: "STR_FRAGIL (be 99,8%) + flip de gestión", banda: "STR_FRAGIL",
    nota: "sobre-renta 20,4% ≥15% PERO break-even 99,8% (90-110) → degrada a INDIFERENTE. Flip auto↔admin cambia el veredicto (D2)." },
  { key: "AG-2-fragil-borde", label: "STR_FRAGIL en el borde de 90% (be 91,6%)", banda: "STR_FRAGIL",
    nota: "sobre-renta 47% ≥15%, break-even 91,6% apenas sobre el corte 90 → STR_FRAGIL. Guarda la frontera BREAK_EVEN_VENTAJA_MAX." },
  { key: "AG-3-conflictiva-moneda", label: "Conflictiva >110 · el caso Moneda (be 131%)", banda: "INDIFERENTE",
    nota: "sobre-renta 26,6% ≥15% pero break-even 131% (>110): STR ni al precio de mercado cubre → INDIFERENTE (sin sello frágil). El caso que motivó la doble condición." },
  { key: "AG-4-nd-degenerado-clara", label: "N/D degenerado — break-even NO lo toca (be 113%)", banda: "STR_VENTAJA_CLARA",
    nota: "sobre-renta 321% (ratio explotado, NOI-LTR≈0) → ruta por absoluto. STR>LTR y NOI STR>0 → STR_VENTAJA_CLARA. Guarda que D1 NO degrada la ruta N/D pese a break-even 113%." },
  { key: "AG-5-nd-degenerado-4ea0", label: "N/D degenerado −3483% (bug P3 4ea0b582)", banda: "STR_VENTAJA_CLARA",
    nota: "el par histórico del bug 4ea0b582: −3483% caía en LTR_PREFERIDO por el ratio; la ruta por absoluto lo clasifica STR_VENTAJA_CLARA. porAbsoluto=true." },
  { key: "AG-6-ltr-preferido", label: "LTR_PREFERIDO (sobre-renta negativa)", banda: "LTR_PREFERIDO",
    nota: "STR rinde MENOS que LTR (sobre-renta <5%): renta larga preferida. No entra la segunda condición." },
  { key: "AG-7-indiferente-5-15", label: "INDIFERENTE banda 5-15% (be irrelevante)", banda: "INDIFERENTE",
    nota: "sobre-renta 12,2% (5-15): INDIFERENTE por sobre-renta, sin llegar a la segunda condición aunque el break-even sea alto." },
];

export interface FrozenFixtureAmbas {
  srcId: string;
  comuna: string;
  uf: number;
  input_data: Record<string, any>;
  airbnbRaw: Record<string, any>;
}

export function loadFrozenAmbas(): Record<string, FrozenFixtureAmbas> {
  const p = path.resolve(process.cwd(), "scripts/eval/golden/ambas-seeds-frozen.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
