// Copy canónico del estado "no aplica" (pie cero · fase 3b) — contrato del
// mockup aprobado mockups/pie-cero-fase3.html (98e2319). Fuente ÚNICA de estos
// strings: toda superficie que renderice una métrica sobre capital en estado
// 'no_aplica' importa de acá (D1: decisión del análisis, no dato faltante).
//
// Reglas D1: valor "No aplica" en JetBrains Mono, peso 500, color secundario —
// NUNCA Signal Red (no es criticidad) — + sublabel mono uppercase (el casing lo
// pone el CSS; acá viaja en sentence case para reuso en texto plano).

import type { RazonSinCapital } from "./types";

export const NO_APLICA_VALOR = "No aplica";

export const NO_APLICA_SUBLABEL = "Sin capital propio (pie $0)";

export const NO_APLICA_TOOLTIP =
  "Compraste con financiamiento del 100%: sin pie, no existe una rentabilidad " +
  "sobre capital propio que medir. Este caso se evalúa por flujo mensual y plusvalía.";

// Footnote única de los documentos imprimibles (DocumentoLTR / DocumentoSTR):
// las celdas marcan "No aplica*" y esta nota aparece UNA vez al pie del bloque.
export const NO_APLICA_FOOTNOTE_DOC =
  "* Sin capital propio (pie $0): las métricas sobre tu capital no aplican. " +
  "Este caso se evalúa por flujo mensual y plusvalía.";

// Valor que reciben los PROMPTS IA (fase 4) en las líneas de métricas sobre
// capital cuando el estado es 'no_aplica' — derivado del sublabel canónico
// (fuente única). La doctrina pie-0 del system prompt (## 5.bis) referencia
// este string textual: si cambia acá, cambia allá.
export const NO_APLICA_PROMPT = `no aplica: ${NO_APLICA_SUBLABEL.toLowerCase()}`;

/**
 * Glosa de la razón para el PROMPT (fase 5b). Fuente única: acá se decide qué
 * sabe Franco del origen del pie 0 y, por lo tanto, cuánto puede afirmar.
 *
 * El eje que importa para la doctrina ## 5.bis.d (dureza con el precio) es
 * QUIÉN cubre el pie: si es la inmobiliaria (bono), el costo suele viajar en el
 * precio de lista y la comparación contra la zona se endurece; si lo cubre el
 * comprador con fondos propios, esa sospecha NO aplica. Sin declaración,
 * Franco no afirma el origen (§1.4 — no inventar lo que no está en el input).
 */
export function razonSinCapitalPrompt(razon: RazonSinCapital): string {
  switch (razon) {
    case "bono_pie":
      return (
        "bono_pie — el usuario declaró que la INMOBILIARIA cubre el pie (bono pie). " +
        "Nómbralo así, y aplica ## 5.bis.d en su forma FUERTE: ese bono suele estar " +
        "cargado en el precio de lista, así que el precio/m² contra la zona se compara " +
        "con dureza explícita"
      );
    case "otra_fuente":
      return (
        "otra_fuente — el usuario cubre el pie con fondos propios (ahorro, familia, otra " +
        "propiedad), NO la inmobiliaria. NO insinúes que el bono viaja en el precio: esa " +
        "advertencia de ## 5.bis.d no aplica acá. El riesgo estructural (## 5.bis.b) sí"
      );
    case "no_declarada":
      return (
        "no_declarada — se le preguntó y prefirió no decirlo. NO afirmes el origen ni lo " +
        "supongas; la cautela de precio de ## 5.bis.d se mantiene en su forma genérica"
      );
    case "sin_pie":
    default:
      return "sin_pie — compra sin pie declarado, financiamiento del 100%; el origen no se preguntó (no lo afirmes)";
  }
}
