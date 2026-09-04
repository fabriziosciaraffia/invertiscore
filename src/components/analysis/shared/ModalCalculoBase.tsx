"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";

/**
 * "Cómo se calcula" — cáscara compartida LTR/STR (T1 · 04-sep-2026). El modal con
 * bloques apilados (letra · título · bajada · cuerpo); cada modalidad arma sus
 * bloques con la `Planilla` (flujo año a año, indicadores) y sus supuestos. Antes
 * las columnas LTR vivían literales dentro del modal.
 */
export type BloqueCalculo = {
  letra: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  children: ReactNode;
};

export function ModalCalculoBase({
  abierto,
  onClose,
  sub = "La planilla detrás de cada cifra: el flujo año a año, los indicadores con sus valores sustituidos y el escenario de salida.",
  pie,
  bloques,
}: {
  abierto: boolean;
  onClose: () => void;
  sub?: ReactNode;
  pie?: ReactNode;
  bloques: BloqueCalculo[];
}) {
  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Cómo se calcula" sub={sub} pie={pie}>
      {bloques.map((b) => (
        <div key={b.letra} className="m-block">
          <div className="bt">
            {b.letra} · {b.titulo}
          </div>
          {b.bajada && <div className="bq">{b.bajada}</div>}
          {b.children}
        </div>
      ))}
    </Modal>
  );
}
