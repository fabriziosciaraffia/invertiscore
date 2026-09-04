"use client";

import type { ReactNode } from "react";
import type { BarraDia1 } from "@/lib/plata-dia1";

/**
 * "Lo que pusiste · el día 1" (CONGELADO · VI, `.dia1`): la barra del capital
 * inicial a la MISMA escala que la de "tu parte" (ancho = inversión ÷ patrimonio),
 * con los cuatro tonos del helper `plata-dia1` (pie · gastos · amoblamiento · capex;
 * LTR pasa amoblamiento 0 y el tramo no se dibuja), la cifra total con su
 * equivalente en la otra moneda y el multiplicador sobre lo puesto.
 * Geometría del helper; acá solo se pinta.
 */
export function BloqueDia1({
  barra,
  total,
  totalAlt,
  multiplicador,
  nota = "Las dos barras están a la misma escala.",
  fmt,
}: {
  barra: BarraDia1;
  /** Inversión inicial formateada en la moneda activa. */
  total: string;
  /** La misma cifra en la otra moneda. */
  totalAlt?: string;
  /** "×2,20" ya formateado; null si no aplica (pie 0). */
  multiplicador: string | null;
  nota?: ReactNode;
  /** Para el tooltip de cada tramo. */
  fmt: (n: number) => string;
}) {
  const NOMBRE: Record<string, string> = { pie: "pie", gastos: "gastos de compra", amoblamiento: "amoblamiento", capex: "puesta a punto" };
  return (
    <div className="dia1">
      {nota && <p className="dia1-nota">{nota}</p>}
      <div className="dia1-head">
        <span className="k">Lo que pusiste · el día 1, de tu bolsillo</span>
        <span className="v">
          {total} {totalAlt && <small>{totalAlt}</small>}
        </span>
      </div>
      <div className="dia1-bar" style={{ width: `${Math.min(100, barra.anchoPct).toFixed(1)}%` }}>
        {barra.segmentos.map((s) => (
          <span key={s.tono} className={s.tono} style={{ width: `${s.pct.toFixed(1)}%` }} title={`${NOMBRE[s.tono] ?? s.tono}: ${fmt(s.montoCLP)}`} />
        ))}
      </div>
      {barra.desborda && <p className="dia1-nota" style={{ marginTop: 6 }}>Lo puesto supera a tu parte: la barra se corta en el 100%.</p>}
      {multiplicador && (
        <p className="dia1-mult">
          <b>{multiplicador}</b> por cada peso que pusiste
        </p>
      )}
    </div>
  );
}
