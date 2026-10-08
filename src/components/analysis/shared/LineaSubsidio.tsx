import type { ReactNode } from "react";
import { lineaInformeSubsidio } from "@/lib/constants/subsidio";

/**
 * El sub de la fila «Cuota del crédito» (LTR y STR), con la línea del subsidio debajo cuando el
 * análisis se hizo con la tasa del subsidio (08-oct-2026). La decisión es del motor
 * (`subsidioTasa.aplicado`, vía `lineaInformeSubsidio`); acá solo se pone junto a la tasa.
 */
export function conLineaSubsidio(base: string, subsidioTasa: { califica?: boolean; aplicado?: boolean } | null | undefined): ReactNode {
  const linea = lineaInformeSubsidio(subsidioTasa);
  if (!linea) return base;
  return (
    <>
      {base}
      <br />
      {linea}
    </>
  );
}
