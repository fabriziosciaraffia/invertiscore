"use client";

import type { ReactNode } from "react";
import { Glosa } from "./Glosa";

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
  /** Glosa corta: qué es y de dónde sale. Abre con el ⓘ del informe (`Glosa`), que en el
   *  teléfono es la hoja chica: hasta el 23-sep-2026 era el `title` nativo, que no abría con
   *  un toque, no se alcanzaba con teclado y medía 11 × 13 px. */
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
        {tip && <Glosa titulo={typeof k === "string" ? k : "Qué es"} texto={tip} />}
        {sub && <small>{sub}</small>}
      </span>
      <span className="dv">
        {v}
        {unidad && <em>{unidad}</em>}
      </span>
    </div>
  );
}
