// La copy del capítulo I «Cuánto renta» sobre la referencia de la comuna (21-sep-2026).
//
// EL CAPÍTULO HABLA AL USUARIO, NO DEL CÁLCULO (decisión de Fabrizio, 21-sep): un solo número —el
// cap rate BRUTO, que es lo que se compara—, sin peldaños, celdas, ventanas, n por lado ni BDO.
// EL NOMBRE (decisión de Fabrizio, 23-sep-2026, da vuelta a propósito la del 21-sep): el
// indicador va con su nombre de mercado —«cap rate bruto», «cap rate neto», «cap rate» en STR—,
// sin cursiva y con su ⓘ, que es quien explica qué es. Por eso la explicación visible ya no
// define la cifra (lo hacía porque el ⓘ no abría en el teléfono): solo dice de dónde sale la
// referencia. Todo eso sigue en el dato (`capref_comuna_snapshot`, `valor` del hallazgo)
// y en el acta: es lo que defiende el número, no lo que se muestra. La UF del análisis tampoco
// va en la fuente: es trazabilidad, y vive en el dato.
import type { HallazgoCapRate } from "./types";
import { AVISOS_CAPREF_CONFIANZA_ALTA } from "./capref-comuna";
import type { NivelStrRef } from "./strref-zona";
import { GLOSAS } from "./glosas-indicadores";

type ValorCapRef = HallazgoCapRate["valor"];

/** Nombre del número que compara el capítulo, por modalidad: el de mercado, el mismo del ⓘ. En LTR
 *  es siempre el bruto (23-sep-2026: el capítulo ya no compara neto contra neto). */
export const NOMBRE_RENTABILIDAD = { ltr: GLOSAS.capRateBruto.nombre, str: GLOSAS.capRateStr.nombre } as const;

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

/** La frase visible bajo el título: de dónde sale la referencia de la comuna, en una frase. Qué es
 *  el cap rate lo dice su ⓘ (23-sep-2026); nombre en minúscula dentro de la frase (§5.7). */
export function explicacionCapRef(v: Pick<ValorCapRef, "nivel" | "comuna">): string {
  const nombre = NOMBRE_RENTABILIDAD.ltr.toLowerCase();
  if (v.nivel === "celda" || v.nivel === "comuna") return `El ${nombre} de ${v.comuna} sale de los avisos publicados de deptos parecidos.`;
  if (v.nivel === "bdo") return `El ${nombre} de ${v.comuna} sale de lo que rinden los edificios de renta de la comuna.`;
  return "La referencia es el promedio de Santiago: la comuna no tiene avisos suficientes.";
}

/** La referencia STR contra STR de la zona, como la ve el capítulo (strref-zona.ts). */
export interface RefStrCopy {
  nivel: NivelStrRef;
  comuna: string;
  celdaDormitorios: number | null;
}

const airbnbDe = (v: RefStrCopy) => {
  const d = v.celdaDormitorios;
  const tip = v.nivel === "celda" && d !== null ? (d === 0 ? "los Airbnb studio" : `los Airbnb de ${d} dormitorio${d === 1 ? "" : "s"}`) : "los Airbnb";
  return `${tip} ${v.nivel === "celda" && d !== null ? "en" : "de"} ${v.comuna}`;
};

/**
 * La fuente del umbral STR, en una línea (decisión de Fabrizio, 21-sep-2026):
 *   celda          → «Referencia: lo que proyectan los Airbnb de 1 dormitorio en Providencia.»
 *   comuna         → «Referencia: lo que proyectan los Airbnb de Providencia.»
 *   sin referencia → «Sin referencia: no hay Airbnb suficientes de esta zona para comparar.»
 */
export function fuenteUmbralStr(v: RefStrCopy): string {
  if (v.nivel === "sin_referencia") return "Sin referencia: no hay Airbnb suficientes de esta zona para comparar.";
  return `Referencia: lo que proyectan ${airbnbDe(v)}.`;
}

/** La frase visible bajo el título, en STR: de dónde sale la referencia. Qué es el cap rate lo dice su ⓘ. */
export function explicacionUmbralStr(v: RefStrCopy): string {
  if (v.nivel === "sin_referencia") return `No hay Airbnb suficientes de ${v.comuna} para compararlo.`;
  return `La referencia es lo que proyectan ${airbnbDe(v)}, con los mismos costos.`;
}

/** Cómo se llama la referencia en el capítulo («la comuna» / «Santiago»). */
export function nombreReferenciaCapRef(v: Pick<ValorCapRef, "nivel">): string {
  return v.nivel === "nacional" ? "Santiago" : "la comuna";
}
