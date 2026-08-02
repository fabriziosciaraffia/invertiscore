// Copy canónico del estado "no aplica" (pie cero · fase 3b) — contrato del
// mockup aprobado mockups/pie-cero-fase3.html (98e2319). Fuente ÚNICA de estos
// strings: toda superficie que renderice una métrica sobre capital en estado
// 'no_aplica' importa de acá (D1: decisión del análisis, no dato faltante).
//
// Reglas D1: valor "No aplica" en JetBrains Mono, peso 500, color secundario —
// NUNCA Signal Red (no es criticidad) — + sublabel mono uppercase (el casing lo
// pone el CSS; acá viaja en sentence case para reuso en texto plano).

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
