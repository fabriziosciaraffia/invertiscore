"use client";

import type { ReactNode } from "react";

/**
 * Planilla (contrato `mockup-tablas.html`, `.pl`): tabla numérica con encabezado y
 * filas ya formateadas. La usa la tabla de avisos de la zona STR. «Cómo se calcula»
 * dejó de usarla el 23-sep-2026 (ahora `PlanillaCalculo`), y con eso salió la
 * variante `ind` de indicadores.
 */
export type CeldaPlanilla = { v: ReactNode; neg?: boolean };
export type FilaPlanilla = {
  th: ReactNode;
  celdas: CeldaPlanilla[];
  /** "pre" (año sin operación) · "ent" (año de entrega) · "tot" (total). */
  clase?: "pre" | "ent" | "tot";
};

export function Planilla({ columnas, filas }: { columnas: ReactNode[]; filas: FilaPlanilla[] }) {
  return (
    <div className="pl-wrap">
      <table className="pl">
        {columnas.length > 0 && (
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={f.clase ?? ""}>
              <th>{f.th}</th>
              {f.celdas.map((c, j) => (
                <td key={j} className={c.neg ? "neg" : ""}>
                  {c.v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
