"use client";

import type { ReactNode } from "react";

/**
 * "Los números" como lista (CONGELADO · seis cifras). Reusa el grid `.nums` /
 * `.num-cell` de la portada; la diferencia con `LosNumeros` (LTR) es que las celdas
 * llegan como datos y no como JSX fijo, así cada modalidad decide cuáles y en qué
 * orden. El toggle CLP/UF lo resuelve el caller al formatear `v`: las cifras que no
 * cambian con la moneda (cap rate, TIR, ocupación) se formatean igual en las dos.
 */
export type CifraInforme = {
  k: string;
  v: ReactNode;
  neg?: boolean;
  /** Traducción de una línea (con `<b>` para lo que pesa). */
  tr: ReactNode;
};

export function SeisCifras({ cifras, onCalculo }: { cifras: CifraInforme[]; onCalculo?: () => void }) {
  return (
    <div className="nums-wrap">
      <div className="nums">
        {cifras.map((c, i) => (
          <div key={i} className="num-cell">
            <div className="k">{c.k}</div>
            <div className={`v${c.neg ? " neg" : ""}`}>{c.v}</div>
            <div className="tr">{c.tr}</div>
          </div>
        ))}
      </div>
      {onCalculo && (
        <div className="nums-foot">
          <button type="button" className="doc-lnk" onClick={onCalculo}>
            Ver cómo se calcula →
          </button>
        </div>
      )}
    </div>
  );
}
