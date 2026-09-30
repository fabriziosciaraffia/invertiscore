// ============================================================================
// VALOR ESTIMADO DE MERCADO — procedencia y resolución (Tramo A "una sola
// referencia de precio", 03-sep-2026)
// ============================================================================
// Hasta acá `input.valorMercadoFranco` era un número pelado que el wizard armaba
// con el UF/m² de la sugerencia de venta × superficie, sin decir de qué nivel
// salía (radio o comuna), de qué universo (nuevo, usado o mezcla) ni con cuánta
// muestra: `zonaRadio.sampleSizeVenta` iba hardcodeado en 0 en los dos wizards y
// el wizard v4 ni siquiera mandaba `condicion`, así que a un depto NUEVO le
// llegaba una mediana de usados con factor de cierre encima. Medido sobre el
// parque recomputado: 23 nuevos y 6 usados con |plusvalía inmediata| > 20% y la
// comuna diciendo "en línea" (|desviación| < 5) — el veredicto lo empujaba un
// valor de otro mercado (d3a6149a: VM 1.987 para un nuevo de 3.150 cuya mediana
// nueva es 91,7 UF/m²).
//
// Regla: el motor solo cree en un valor de mercado que trae procedencia
// (`valorMercadoRef`) con muestra y con el MISMO universo del depto. Sin
// procedencia, o con universo distinto, es como si no hubiera valor de mercado:
// vm = precio, plusvalía inmediata 0, sin gate de plusvalía, sin caso
// precio-justo, sin "alinear con comparables". El número legacy
// `valorMercadoFranco` se sigue escribiendo para los lectores viejos, pero ya
// no decide nada.
import type { AnalisisInput, UniversoDepto, UniversoVenta, ValorMercadoRef } from "./types";

/**
 * Universo de mercado del depto, con procedencia:
 *   · `declarado`: el wizard guardó `esNuevo` (true/false).
 *   · `inferidoDeSnapshot`: filas sin `esNuevo` — se toma el universo de la mediana que el
 *     pipeline consultó al crear (mediana_comuna_snapshot.universo): es lo que el wizard de
 *     entonces pidió para ese depto aunque no lo persistiera (50345272: mediana de nuevos).
 *   · `default`: sin `esNuevo` y sin snapshot con universo ⇒ usado (93% del inventario).
 */
export function resolverUniversoDepto(
  input: Pick<AnalisisInput, "esNuevo">,
  universoSnapshot?: "nuevo" | "usado" | null,
): UniversoDepto {
  if (input.esNuevo === true) return { valor: "nuevo", origen: "declarado" };
  if (input.esNuevo === false) return { valor: "usado", origen: "declarado" };
  if (universoSnapshot === "nuevo" || universoSnapshot === "usado") return { valor: universoSnapshot, origen: "inferidoDeSnapshot" };
  return { valor: "usado", origen: "default" };
}

/** Atajo sin snapshot (scripts y wizards): universo declarado o default. */
export function universoDelDepto(input: Pick<AnalisisInput, "esNuevo">): "nuevo" | "usado" {
  return resolverUniversoDepto(input).valor;
}

/**
 * Valor de mercado con procedencia válida para ESTE depto, o null.
 * Válido = valorUF > 0, n > 0 y universo igual al del depto ("mixto" nunca calza).
 * `universoDepto` es el resuelto por el motor (con snapshot); sin él se resuelve del input.
 */
export function resolverValorMercado(
  input: Pick<AnalisisInput, "esNuevo" | "valorMercadoRef">,
  universoDepto?: "nuevo" | "usado",
): ValorMercadoRef | null {
  const ref = input.valorMercadoRef;
  if (!ref || typeof ref !== "object") return null;
  if (!(ref.valorUF > 0) || !(ref.n > 0)) return null;
  if (ref.universo !== (universoDepto ?? universoDelDepto(input))) return null;
  return ref;
}

/** vm resuelto con el fallback al precio ya aplicado (lo que el motor consume). */
export function vmFrancoUFDe(
  input: Pick<AnalisisInput, "esNuevo" | "valorMercadoRef" | "precio">,
  universoDepto?: "nuevo" | "usado",
): number {
  return resolverValorMercado(input, universoDepto)?.valorUF ?? input.precio;
}

/** Universo que declara una sugerencia de venta según cómo se consultó. */
export function universoDeSugerenciaVenta(nivel: "radio" | "comuna", condicion: string | null | undefined): UniversoVenta {
  if (condicion === "nuevo") return "nuevo";
  if (condicion === "usado") return "usado";
  // NIVEL 2 sin condición cae a usados (getComunaMedianaVentaUF); NIVEL 1 sin
  // condición mezcla los dos universos del radio.
  return nivel === "comuna" ? "usado" : "mixto";
}

/**
 * Repara un análisis que se armó con la venta nueva por radio en UF (30-sep-2026, ver `aPesos`).
 *
 * Con ese bug, `zonaRadio.precioM2VentaCLP` guardó la mediana del radio EN UF/m² (el consumidor la
 * multiplicaba por la UF después de haberla dividido por la UF): es exactamente la mediana de los
 * comparables del DÍA del análisis. La referencia (`valorMercadoRef.valorUF`) y `valorMercadoFranco`
 * quedaron en 0, y el motor los descartó; la eficiencia del score leyó el radio a ~0 UF/m².
 *
 * Devuelve el input reparado —referencia y valor de mercado desde esa mediana × superficie útil, y
 * `precioM2VentaCLP` en pesos de verdad— o null si el análisis no tiene la firma del bug (referencia
 * de radio en 0 con un precio por m² del radio entre el piso y 1.000, que en pesos es imposible).
 */
export function repararVentaRadioEnUF<T extends { valorMercadoRef?: ValorMercadoRef | null; valorMercadoFranco?: number; superficie?: number; zonaRadio?: unknown }>(
  input: T,
  ufCLP: number,
): T | null {
  const ref = input.valorMercadoRef;
  const zr = input.zonaRadio as { precioM2VentaCLP?: number } | undefined;
  const ufM2 = Number(zr?.precioM2VentaCLP);
  const sup = Number(input.superficie);
  if (!ref || ref.nivel !== "radio" || ref.valorUF > 0) return null;
  if (!(ufM2 >= PISO_UF_M2 && ufM2 < 1000) || !(sup > 0) || !(ufCLP > 0)) return null;
  const valorUF = Math.round(ufM2 * sup);
  return {
    ...input,
    valorMercadoRef: { ...ref, valorUF },
    valorMercadoFranco: valorUF,
    zonaRadio: { ...(zr as object), precioM2VentaCLP: Math.round(ufM2 * ufCLP) },
  };
}

/** Precio por m² bajo el cual una sugerencia de venta es un error, no un mercado. */
export const PISO_UF_M2 = 10;

/**
 * Arma la procedencia desde lo que devuelve /api/data/suggestions?type=venta.
 * null cuando la sugerencia no trae precio/m², ni muestra, ni nivel con nombre.
 */
export function valorMercadoRefDeSugerencia(p: {
  precioM2UF: number | null | undefined;
  superficieUtilM2: number;
  source: string | null | undefined;
  sampleSize: number | null | undefined;
  universoVenta: string | null | undefined;
  radiusUsed?: number | null;
}): ValorMercadoRef | null {
  const nivel = p.source === "radio" || p.source === "comuna" ? p.source : null;
  const n = Number(p.sampleSize) || 0;
  const u = p.universoVenta === "nuevo" || p.universoVenta === "usado" || p.universoVenta === "mixto" ? p.universoVenta : null;
  if (!nivel || n <= 0 || !u || !p.precioM2UF || !(p.precioM2UF > 0) || !(p.superficieUtilM2 > 0)) return null;
  // Resguardo (30-sep-2026): ningún depto del Gran Santiago vale menos de UF 10/m². Una cifra así es un
  // error de moneda (la venta nueva por radio salía en UF/m² dividido otra vez por la UF: ~0,004) y no
  // puede viajar al motor como valor de mercado.
  if (p.precioM2UF < PISO_UF_M2) return null;
  return {
    valorUF: Math.round(p.precioM2UF * p.superficieUtilM2),
    nivel,
    universo: u,
    n,
    radioMetros: nivel === "radio" ? (p.radiusUsed ?? null) : null,
  };
}
