// ─────────────────────────────────────────────────────────────────────────────
// Veredicto de una fila de tipología: ¿el arriendo paga la cuota?
//
// Principio: un arriendo ESTIMADO (fuente comunalPorM2, ±6-16% de error
// residual) informa, pero no emite veredictos binarios. Una fila con mediana
// propia se decide como siempre (arriendo ≥ cuota). Una fila estimada se decide
// con su RANGO, no con el punto medio:
//   · se paga sola      solo si el PISO del rango cubre la cuota;
//   · no se paga sola   solo si el TECHO no la cubre;
//   · si el rango cruza la cuota, DEPENDE DEL ARRIENDO REAL — y esa fila no
//     cuenta en "N de M se pagan solas", no encabeza el hero, no entra al CTA.
//
// Antes el punto medio decidía: Pudahuel 3D salía "no se paga solo" por $4.268
// con un rango de ±$80.000 alrededor de la cuota. Un veredicto así es ruido con
// cara de dato.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReferenciaArriendo } from "@/lib/referencia-arriendo";

export type VeredictoFila = "sePagaSola" | "noSePagaSola" | "dependeDelArriendoReal";

/** Copy canónico de la fila sin veredicto. Lo usan tabla, FAQ y hero. */
export const COPY_DEPENDE =
  "Con el piso del rango no se paga; con el techo sí. Depende del arriendo real que consigas.";

export const ETIQUETA_VEREDICTO: Record<VeredictoFila, string> = {
  sePagaSola: "Se paga solo",
  noSePagaSola: "No se paga solo",
  dependeDelArriendoReal: "Depende del arriendo real",
};

export interface InsumosVeredictoFila {
  /** Cuota mensual del crédito, CLP. */
  dividendoCLP: number;
  /** Arriendo con que se calcula (mediana propia o punto medio del estimado), CLP. */
  arriendoCLP: number;
  referencia: ReferenciaArriendo;
}

/** Pura. El borde "cubre" es ≥, igual que `cubre` en comunas-seo. */
export function resolverVeredictoFila(ins: InsumosVeredictoFila): VeredictoFila {
  if (ins.referencia.fuente === "comunalPorM2") {
    const { min, max } = ins.referencia.rangoCLP;
    if (min >= ins.dividendoCLP) return "sePagaSola";
    if (max < ins.dividendoCLP) return "noSePagaSola";
    return "dependeDelArriendoReal";
  }
  return ins.arriendoCLP >= ins.dividendoCLP ? "sePagaSola" : "noSePagaSola";
}

/** Las dos que sí deciden. La tercera informa. */
export function esVeredictoBinario(v: VeredictoFila): boolean {
  return v !== "dependeDelArriendoReal";
}

/**
 * Diferencia arriendo − cuota en los dos extremos del rango de una fila
 * estimada (min negativo y max positivo cuando cruza). null para filas propias.
 */
export function brechaRango(ins: { dividendoCLP: number; referencia: ReferenciaArriendo }): { min: number; max: number } | null {
  if (ins.referencia.fuente !== "comunalPorM2") return null;
  return {
    min: Math.round(ins.referencia.rangoCLP.min - ins.dividendoCLP),
    max: Math.round(ins.referencia.rangoCLP.max - ins.dividendoCLP),
  };
}
