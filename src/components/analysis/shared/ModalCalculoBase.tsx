"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/analysis/hallazgos/vocabulario";

/**
 * "Cómo se calcula" — cáscara compartida LTR/STR (T1 · 04-sep-2026). El modal con
 * bloques apilados (título · bajada · cuerpo); cada modalidad arma los suyos con las
 * piezas de `PlanillaCalculo`. Desde el 23-sep-2026 son dos bloques (flujo e indicadores),
 * sin letra —con dos no ordena nada—, con el título en tinta y la bajada en sans.
 */
export type BloqueCalculo = {
  titulo: ReactNode;
  bajada?: ReactNode;
  children: ReactNode;
};

export function ModalCalculoBase({
  abierto,
  onClose,
  sub = "La planilla detrás de cada cifra: el flujo año a año y los indicadores con sus valores sustituidos.",
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
      {bloques.map((b, i) => (
        <div key={i} className="m-block">
          <div className="bt">{b.titulo}</div>
          {b.bajada && <div className="bq">{b.bajada}</div>}
          {b.children}
        </div>
      ))}
    </Modal>
  );
}
