// La copy del capítulo I «Cuánto renta» sobre la referencia de la comuna (21-sep-2026).
//
// EL CAPÍTULO HABLA AL USUARIO, NO DEL CÁLCULO (decisión de Fabrizio, 21-sep): un solo número —la
// rentabilidad BRUTA, que es lo que se compara—, sin «cap rate», sin peldaños, celdas, ventanas,
// n por lado ni BDO. Todo eso sigue en el dato (`capref_comuna_snapshot`, `valor` del hallazgo)
// y en el acta: es lo que defiende el número, no lo que se muestra. La UF del análisis tampoco
// va en la fuente: es trazabilidad, y vive en el dato.
import type { HallazgoCapRate } from "./types";
import { AVISOS_CAPREF_CONFIANZA_ALTA } from "./capref-comuna";

type ValorCapRef = HallazgoCapRate["valor"];

/** Nombre del número que compara el capítulo, por modalidad. Nunca «cap rate». */
export const NOMBRE_RENTABILIDAD = { ltr: "Rentabilidad bruta", str: "Rentabilidad" } as const;

/**
 * La fuente, en UNA línea. Por peldaño:
 *   celda    → «Referencia: avisos de arriendo y venta de deptos de 1 dormitorio en Providencia, últimos 90 días.»
 *   comuna   → «Referencia: avisos de arriendo y venta de deptos en Las Condes, últimos 90 días.»
 *   bdo      → «Referencia: edificios de renta en Ñuñoa.»
 *   nacional → «Referencia: promedio de Santiago.»
 * La muestra débil (menos de 30 avisos en un lado) se dice con una palabra, no con la cifra.
 */
export function fuenteCapRef(v: Pick<ValorCapRef, "nivel" | "comuna" | "celdaDormitorios" | "ventanaDias" | "nArriendo" | "nVenta">): string {
  const debil = Math.min(v.nArriendo, v.nVenta) < AVISOS_CAPREF_CONFIANZA_ALTA ? " (muestra acotada)" : "";
  const dias = v.ventanaDias ? `, últimos ${v.ventanaDias} días` : "";
  if (v.nivel === "celda") {
    const d = v.celdaDormitorios;
    const tipo = d === null ? "deptos parecidos" : `deptos de ${d} dormitorio${d === 1 ? "" : "s"}`;
    return `Referencia: avisos de arriendo y venta de ${tipo} en ${v.comuna}${dias}${debil}.`;
  }
  if (v.nivel === "comuna") return `Referencia: avisos de arriendo y venta de deptos en ${v.comuna}${dias}${debil}.`;
  if (v.nivel === "bdo") return `Referencia: edificios de renta en ${v.comuna}.`;
  return "Referencia: promedio de Santiago.";
}

/** La frase visible bajo el título (los ⓘ no se abren en mobile): qué es la rentabilidad bruta y de
 *  dónde sale la de la comuna. Una cosa, en una o dos frases. */
export function explicacionCapRef(v: Pick<ValorCapRef, "nivel" | "comuna" | "base">): string {
  const que = v.base === "bruta"
    ? "La rentabilidad bruta es el arriendo de un año sobre el precio."
    : "La rentabilidad es lo que el arriendo de un año deja sobre el precio, descontados los gastos.";
  if (v.nivel === "celda" || v.nivel === "comuna") return `${que} La de ${v.comuna} sale de los avisos publicados de deptos parecidos.`;
  if (v.nivel === "bdo") return `${que} La de ${v.comuna} sale de lo que rinden los edificios de renta de la comuna.`;
  return `${que} La referencia es el promedio de Santiago: la comuna no tiene avisos suficientes.`;
}

/** La fuente del umbral STR, en una línea: la misma referencia de LTR, «un punto sobre». */
export function fuenteUmbralStr(v: Pick<ValorCapRef, "nivel" | "comuna" | "celdaDormitorios" | "ventanaDias" | "nArriendo" | "nVenta">, umbralPct: number): string {
  if (v.nivel === "nacional") return `Referencia: piso de renta corta de Franco para Santiago (${umbralPct.toFixed(1).replace(".", ",").replace(",0", "")}%).`;
  const base = fuenteCapRef(v).replace(/^Referencia: /, "");
  return `Referencia: un punto sobre lo que rinden los ${base}`;
}

/** La frase visible bajo el título, en STR: qué es la rentabilidad del corto y qué se le pide. */
export function explicacionUmbralStr(v: Pick<ValorCapRef, "nivel" | "comuna">): string {
  const que = "La rentabilidad es lo que el ingreso de un año deja sobre el precio, descontados comisión y costos.";
  if (v.nivel === "celda" || v.nivel === "comuna") return `${que} A una renta corta en ${v.comuna} se le pide un punto más que lo que rinden los avisos de arriendo de la comuna.`;
  if (v.nivel === "bdo") return `${que} A una renta corta en ${v.comuna} se le pide un punto más que lo que rinden los edificios de renta de la comuna.`;
  return `${que} Es el piso que Franco pide a una renta corta en Santiago: más que un arriendo largo, porque operarla cuesta más.`;
}

/** Cómo se llama la referencia en el capítulo («la comuna» / «Santiago»). */
export function nombreReferenciaCapRef(v: Pick<ValorCapRef, "nivel">): string {
  return v.nivel === "nacional" ? "Santiago" : "la comuna";
}
