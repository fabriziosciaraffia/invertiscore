// Subsidio a la Tasa (Ley 21.748) — helpers v4. Reusa la fuente de verdad
// (lib/constants/subsidio). Nuevo ≤ UF 4.000, rebaja 0,6pp. El aviso anticipado
// usa un margen calibrable sobre la estimación interna de valor (NUNCA se muestra
// el número al usuario — regla de copy dura).

import {
  TECHO_UF_SUBSIDIO,
  calcTasaConSubsidio,
  calificaSubsidio,
  aplicaSubsidio,
} from "@/lib/constants/subsidio";
import { DEC } from "./wizardV4Nodes";
import { leerNum } from "./derive";
import type { WizardV4Answers } from "./wizardV4Nodes";

/** Margen del aviso anticipado sobre el techo (UF 4.400, calibrable). */
export const AVISO_MARGEN_UF = 4400;

export { TECHO_UF_SUBSIDIO, calcTasaConSubsidio };

/**
 * ¿Mostrar el aviso anticipado? tipo=nuevo y la estimación interna de valor
 * (UF/m² zona × superficie) bajo el margen. Solo decide visibilidad — el copy
 * jamás revela el número.
 */
export function avisoSubsidioAplica(a: WizardV4Answers, precioM2UF: number | null): boolean {
  if (a.tipoPropiedad !== "nuevo") return false;
  if (!precioM2UF || precioM2UF <= 0) return false;
  const sup = leerNum(a.superficieUtil, DEC.superficie);
  if (sup <= 0) return false;
  return precioM2UF * sup <= AVISO_MARGEN_UF;
}

/** ¿El precio real + tipo califican al subsidio? (nuevo ≤ UF 4.000). */
export function calificaSubsidioV4(a: WizardV4Answers): boolean {
  return calificaSubsidio(a.tipoPropiedad ?? "", leerNum(a.precio, DEC.precioUF));
}

/** Tasa con subsidio dada la tasa de mercado real (rebaja 0,6pp). */
export function tasaConSubsidioV4(tasaMercado: number): number {
  return calcTasaConSubsidio(tasaMercado);
}

/**
 * ¿La tasa elegida está en nivel subsidiado? Client-side con la tasa de mercado
 * REAL (esquiva el quirk del fallback 4.1 en results.subsidioTasa del motor).
 * Sirve para el rótulo "tasa con subsidio" del resumen.
 */
export function subsidioAplicadoV4(a: WizardV4Answers, tasaMercado: number): boolean {
  if (!calificaSubsidioV4(a)) return false;
  const tasa = leerNum(a.tasaInteres, DEC.tasa);
  if (tasa <= 0) return false;
  return aplicaSubsidio(tasa, calcTasaConSubsidio(tasaMercado));
}
