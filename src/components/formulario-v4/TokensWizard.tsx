"use client";

// Los tokens y el CSS del informe que usa el interior del wizard (entrega 2, 27-sep-2026): los
// doce tokens de `.doc-dictamen` (DocTokens), el ⓘ y su popover (TokensShared) y la hoja del
// teléfono (TokensHallazgos, el `Modal` que abre el ⓘ). Se carga aparte (import dinámico desde
// WizardV4) para no meter los módulos del informe en el primer pintado del wizard: el ⓘ recién
// hace falta cuando alguien lo toca.

import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { TokensShared } from "@/components/analysis/shared/TokensShared";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";

export default function TokensWizard() {
  return (
    <>
      <DocTokens />
      <TokensShared />
      <TokensHallazgos />
    </>
  );
}
