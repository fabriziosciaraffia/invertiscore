"use client";

import type { ReactNode } from "react";

/**
 * Fila de dato compartida (contrato `mockup-tablas.html`, `.drow`): etiqueta con
 * glosa ⓘ y subtítulo, valor mono con unidad. Tonos: `in` (la fila de entrada),
 * `neg` (Signal Red por signo), `cruza` (verde), `tot` (total sobre regla gruesa).
 * Vive en el Fall del II, en crédito y cuota del IV, en "de dónde sale tu parte",
 * venta/refi y "la misma plata en otro lado" del VI, y en el modal de vías.
 */
export function FilasDato({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="drows" style={style}>
      {children}
    </div>
  );
}

export function FilaDato({
  k,
  sub,
  tip,
  v,
  unidad,
  tono,
}: {
  k: ReactNode;
  sub?: ReactNode;
  /** Glosa corta (tooltip nativo): qué es y de dónde sale. */
  tip?: string;
  v: ReactNode;
  /** Unidad pegada al valor ("/mes", "/año"). */
  unidad?: string;
  tono?: "in" | "neg" | "cruza" | "tot";
}) {
  return (
    <div className={`drow${tono ? ` ${tono}` : ""}`}>
      <span className="dk">
        {k}
        {tip && (
          <i className="tip" title={tip} aria-label={tip}>
            ⓘ
          </i>
        )}
        {sub && <small>{sub}</small>}
      </span>
      <span className="dv">
        {v}
        {unidad && <em>{unidad}</em>}
      </span>
    </div>
  );
}
