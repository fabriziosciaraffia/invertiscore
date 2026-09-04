"use client";

import type { ReactNode } from "react";

/**
 * Planilla (contrato `mockup-tablas.html`, `.pl`): la tabla del modal "Cómo se
 * calcula". Dos variantes: `flujo` (año a año, columnas numéricas con total) e `ind`
 * (indicadores: nombre · fórmula en palabras · valores sustituidos · resultado).
 * Render puro: columnas, filas y total llegan ya formateados desde un adaptador por
 * modalidad (LTR: arriendo · gastos · NOI · vacancia · dividendo; STR: ingreso ·
 * comisión y costos · ingreso neto · cuota · estabilización).
 */
export type CeldaPlanilla = { v: ReactNode; neg?: boolean };
export type FilaPlanilla = {
  th: ReactNode;
  celdas: CeldaPlanilla[];
  /** "pre" (año sin operación) · "ent" (año de entrega) · "tot" (total). */
  clase?: "pre" | "ent" | "tot";
};

export function Planilla({ columnas, filas, variante = "flujo" }: { columnas: ReactNode[]; filas: FilaPlanilla[]; variante?: "flujo" | "ind" }) {
  return (
    <div className="pl-wrap">
      <table className={`pl${variante === "ind" ? " ind" : ""}`}>
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
