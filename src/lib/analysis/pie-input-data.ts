// ─────────────────────────────────────────────────────────────────────────────
// Pie desde `input_data` persistido (STR) — normalización de las DOS claves
//
// En el corpus conviven dos convenciones para el mismo dato:
//   · `piePct`     — porcentaje 0-100. Es lo que persiste el pipeline actual
//                    (input_data = body crudo del wizard, analisis-pipeline.ts).
//   · `piePercent` — fracción 0-1. Filas legacy donde input_data guardó el
//                    input del MOTOR (`ShortTermInputs`) en vez del body.
//
// Quien lea el pie desde input_data tiene que aceptar ambas, con la unidad
// correcta. Leer una sola clave produce el bug en uno de los dos sentidos:
// DocumentoSTR leía solo `piePercent` e imprimía "Pie 0%" para TODA fila del
// pipeline actual; el recompute legacy leía solo `piePct` y recomputaba NaN
// para las filas viejas. `buildUserPromptSTR` (ai-generation-str.ts) ya
// normalizaba inline — este módulo es esa misma regla, como fuente única.
//
// `null` = el input_data no trae pie en ninguna convención (fila legacy sin
// dato). Qué hacer con eso lo decide el consumidor: el render muestra "—", el
// recompute declara la fila irreconstruible y cae al `results` persistido.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// ─── Precisión canónica del pie en % ─────────────────────────────────────────
//
// El pie como PORCENTAJE viaja y se persiste con 2 decimales máximo. La regla
// vive acá (lib compartida cliente/server) porque el valor se produce en más de
// un lugar: `piePct`/`derivePiePctLocal` en el wizard, y los bordes de API como
// defensa en profundidad. Sin esto, un pie tipeado en $ o convertido por el
// toggle persiste el float crudo — pasó en producción: `piePct:
// 19.999999875756398` en el chip del hero ($32.194.817 redondeado a peso y
// devuelto a %; el display mostraba "20,0" pero el payload nunca se limpió).

/** Redondea un pie en % a la precisión canónica (2 decimales). */
export function redondearPiePct(pct: number): number {
  return Math.round(pct * 100) / 100;
}

/** Pie como FRACCIÓN (0.2 = 20%), la unidad del motor STR (`piePercent`). */
export function piePercentDesdeInputData(
  inp: Record<string, unknown> | null | undefined,
): number | null {
  if (!inp) return null;
  const fraccion = num(inp.piePercent);
  if (fraccion != null) return fraccion;
  const pct = num(inp.piePct);
  return pct != null ? pct / 100 : null;
}

/** Pie como PORCENTAJE (20 = 20%), la unidad de captura y render. */
export function piePctDesdeInputData(
  inp: Record<string, unknown> | null | undefined,
): number | null {
  const fraccion = piePercentDesdeInputData(inp);
  return fraccion != null ? fraccion * 100 : null;
}
