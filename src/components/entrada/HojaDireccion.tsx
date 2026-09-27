"use client";

// ─────────────────────────────────────────────────────────────────────────────
// La hoja del campo de dirección en el teléfono (27-sep-2026, segunda prueba de Fabrizio).
//
// Es el MISMO `Modal` de los capítulos y los pop-ups del informe —asa, velo de 56 px con el hero
// detrás, cierre con ✕, arrastre hacia abajo y atrás del navegador—, con sus tokens (`DocTokens`)
// y su CSS (`TokensHallazgos`). La primera versión iba a pantalla completa y se sentía como salir de
// Franco a un formulario.
//
// Se carga aparte (import dinámico desde HeroEntrada, apenas se sabe que es un teléfono) para no
// sumarle el CSS del informe al bundle de la portada. Va en portal al <body>: fuera de cualquier
// transformación del wizard, que dejaría al overlay fijo relativo a ella.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";

export default function HojaDireccion({
  abierto,
  onClose,
  children,
}: {
  abierto: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="doc-tokens he-hoja-tokens">
      <DocTokens />
      <TokensHallazgos />
      <Modal abierto={abierto} onClose={onClose} titulo="La dirección del depto">
        {children}
      </Modal>
    </div>,
    document.body,
  );
}
