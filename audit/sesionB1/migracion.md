# Sesión B1 — Migración de consumidores

Lista de todos los consumidores de `input.contribuciones`, `input.gastos`, `input.provisionMantencion` mapeados antes del refactor, con la decisión de migración.

## Server-side

### `src/lib/analysis.ts`

| Línea | Símbolo / función | Lectura previa | Migración |
|---|---|---|---|
| 212-213 | `calcMetrics` mutaba `input.contribuciones` e `input.gastos` | `if (!input.X) input.X = ...` | **Eliminado**. Variables locales `contribucionesValor`, `gastosValor`. |
| 227-228 | `calcMetrics` interno → `calcFlujoDesglose` | `input.gastos`, `input.contribuciones` | Variables locales `gastosValor`, `contribucionesValor`. |
| 272-273 | `calcMetrics` → `calcPrecioParaFlujo` (precio neutro/positivo) | `input.gastos`, `input.contribuciones` | Variables locales. |
| 335-336 | `calcCashflowYear1` → `calcFlujoDesglose` | `input.gastos`, `input.contribuciones` | `metrics.gastos`, `metrics.contribuciones`. |
| 417-418 | `calcProjections` (variables iniciales) | `input.gastos`, `input.contribuciones` | `metrics.gastos`, `metrics.contribuciones`. |
| 579-580 | `calcRefinanceScenario` → `calcFlujoDesglose` | `input.gastos`, `input.contribuciones` | `metrics.gastos`, `metrics.contribuciones`. |
| 916 | `generateContras` (chequeo GGCC alto) | `input.gastos > metrics.ingresoMensual * 0.25` | `metrics.gastos > metrics.ingresoMensual * 0.25`. |

### `src/lib/ai-generation.ts`

| Línea | Símbolo / sección | Lectura previa | Migración |
|---|---|---|---|
| 686-689 | Anomalía GGCC | `input.gastos > 0 && ...` | **Sin cambio** (chequeo intencional sobre lo declarado por usuario). |
| 695 | Anomalía contribuciones | `input.contribuciones \|\| 0` | **Sin cambio** (chequeo sobre lo declarado por usuario). |
| 965-967 | Bloque inputs del prompt LTR | `input.gastos`, `input.contribuciones`, `m.provisionMantencionAjustada ?? input.provisionMantencion` | `m.gastos ?? input.gastos`, `m.contribuciones ?? input.contribuciones` (preserva el valor que el modelo IA veía con la mutación previa). |

### `src/lib/engines/short-term-engine.ts`

| Línea | Comentario |
|---|---|
| 256, 258, 284 | `input` aquí es `STRInput` (struct distinta), no `AnalisisInput`. Fuera del scope B1. **No tocado.** |

## Cliente

### `src/components/ui/AnalysisDrawer.tsx`

| Línea | Símbolo | Lectura previa | Migración |
|---|---|---|---|
| 107-109 | `DrawerCostoMensual` → `calcFlujoDesglose` | `inputData.gastos ?? 0`, `inputData.contribuciones ?? 0`, `metrics?.provisionMantencionAjustada ?? inputData.provisionMantencion ?? 0` | `metrics?.gastos ?? inputData.gastos ?? 0`, `metrics?.contribuciones ?? inputData.contribuciones ?? 0` (mantención sin cambio, ya usaba metrics). |

### `src/app/analisis/[id]/results-client.tsx`

| Línea | Símbolo | Lectura previa | Migración |
|---|---|---|---|
| 2775-2776 | `flujoBreakdown` (header KPI flujo) | `inputData.gastos`, `inputData.contribuciones` | `m.gastos ?? inputData.gastos`, `m.contribuciones ?? inputData.contribuciones`. |
| 2840-2841 | `sensScenarios` (vars iniciales) | `inputData.gastos`, `inputData.contribuciones` | `m.gastos ?? inputData.gastos`, `m.contribuciones ?? inputData.contribuciones`. |
| 2846 | `sensScenarios` mantención año-a-año | `inputData.provisionMantencion \|\| Math.round((precioCLP × rate(antig+año)) / 12)` | **Sin rama `inputData.provisionMantencion`** — siempre fórmula del motor. |
| 2897-2898 | `waterfallData` | `inputData.gastos`, `inputData.contribuciones` | `m.gastos ?? inputData.gastos`, `m.contribuciones ?? inputData.contribuciones`. |
| 2980 | `cashflowData` (var `precioCLPBase` ternario por mutación) | `inputData.provisionMantencion ? 0 : m.precioCLP` | **Eliminada** la variable, fórmula simplificada. |
| 2992-2993 | `cashflowData` (vars iniciales) | `inputData.gastos ?? 0`, `inputData.contribuciones` | `m.gastos ?? inputData.gastos ?? 0`, `m.contribuciones ?? inputData.contribuciones`. |
| 2999 | `cashflowData` → `getMantencionForMonth` | `inputData.provisionMantencion \|\| Math.round((precioCLPBase × rate(antig+año)) / 12)` | **Sin rama `inputData.provisionMantencion`**, usa `m.precioCLP` directo. |
| 3181-3182 | `projData` (vars iniciales) | `inputData.gastos ?? 0`, `inputData.contribuciones` | `m.gastos ?? inputData.gastos ?? 0`, `m.contribuciones ?? inputData.contribuciones`. |
| 3204 | `projData` mantención año-a-año | `inputData.provisionMantencion \|\| Math.round((precioCLP × rate(antig+año)) / 12)` | **Sin rama `inputData.provisionMantencion`**, fórmula motor. |

### `src/app/demo/page.tsx`

| Línea | Cambio |
|---|---|
| ~127 | Mock `metrics` agrega `contribuciones: CONTRIBUCIONES_TRIM`, `gastos: GGCC` para satisfacer el tipo. |

## Total

- 7 sitios server-side (analysis.ts) refactorizados a leer canónicamente vía `metrics` o variables locales.
- 1 sitio prompt IA (ai-generation.ts) migrado a `m.X ?? input.X`.
- 2 sitios anomalías IA preservados (chequean explícitamente lo declarado por el usuario; semántica sigue siendo correcta post-B1).
- 1 sitio drawer migrado.
- 5 sitios en results-client.tsx migrados (3 son los consumidores residuales pendientes de Sesión A: `sensScenarios`, `cashflowData`, `projData`).
- 1 sitio mock demo actualizado.
