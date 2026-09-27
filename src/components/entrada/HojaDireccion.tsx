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
  // Dentro de `.doc-dictamen`, como las hojas del informe: ahí vive la paleta actual (fría) y el
  // título en Inter. `.doc-tokens` solo conserva la paleta cálida vieja de los drawers de afuera.
  // El marco no dibuja nada (su borde, sombra y fondo se anulan): solo aporta los tokens.
  return createPortal(
    <div className="doc-dictamen he-hoja-marco" style={{ border: 0, boxShadow: "none", background: "none" }}>
      <DocTokens />
      <TokensHallazgos />
      <Modal abierto={abierto} onClose={onClose} titulo="La dirección del depto">
        {children}
      </Modal>
    </div>,
    document.body,
  );
}
