# Sesión B1 — Eliminar mutaciones residuales en calcMetrics

**Fecha:** 2026-05-05
**Decisión:** calcMetrics se vuelve función pura. Los valores derivados de defaults (`contribuciones`, `gastos`, `provisionMantencionAjustada`) se exponen en `metrics`, sin mutar `input`. 3 consumidores residuales del cliente (`sensScenarios`, `cashflowData`, `projData`) migran a leer canónicamente del motor (fórmula año-a-año), eliminando la rama `inputData.provisionMantencion ||` que dependía del input mutado pre-Sesión A.

**Probe:** `scripts/audit-b1-vold.ts` y `scripts/audit-b1-vnew.ts` (idénticos salvo path output). v_old corrió contra commit `f6f4066` (post-Item 9, pre-B1); v_new contra el código tras los cambios B1.

## Tabla v_old vs v_new — 11 casos

10 casos del set canónico de auditoría + 1 caso adicional (`11-fields-falsy`) con `contribuciones=0`, `gastos=0`, `provisionMantencion=0` para forzar el camino que disparaba las mutaciones pre-B1.

### Resumen agregado

| Casos | Δ métricas numéricas | inputMutated v_old | inputMutated v_new |
|---|---|---|---|
| 0 — 9 (set canónico) | 0 (idéntico en todas las métricas) | false (los inputs ya tenían valores positivos) | false |
| 11 — fields-falsy | 0 (idéntico en todas las métricas) | **true** (mutaba contribuciones y gastos) | **false** |

### Tabla detallada — caso 11 (único que dispara la mutación)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| `inputMutated` | true | false | — | ✅ pureza ganada |
| TIR motor 10A | 9.37% | 9.37% | 0.00pp | ✅ |
| TIR sim 10A | 9.37% | 9.37% | 0.00pp | ✅ |
| cashOnCash motor | -7.35% | -7.35% | 0 | ✅ |
| mesesPaybackPie | 999 | 999 | 0 | ✅ |
| aporteAcum chart a10 | 96.969.248 | 96.969.248 | 0 | ✅ |
| patrimonio neto chart a10 | 198.699.419 | 198.699.419 | 0 | ✅ |
| valor venta a10 | 327.176.174 | 327.176.174 | 0 | ✅ |
| sim inversionInicial | 48.626.270 | 48.626.270 | 0 | ✅ |
| sim cashOnCash | -9.97% | -9.97% | 0 | ✅ |
| sim payback (años) | 2 | 2 | 0 | ✅ |
| sim múltiplo | 1.48 | 1.48 | 0 | ✅ |

### Casos 0–9 (set canónico)

Para los 10 casos del snapshot `audit/sesionA-auditoria-sim/_runs.json`, las 11 métricas validadas son **idénticas bit-a-bit entre v_old y v_new**. Todos los inputs traían `contribuciones>0` y `gastos>0`, por lo que pre-B1 no entraba a la rama de mutación; post-B1 calcula los mismos valores localmente y los expone en `metrics.*`.

| Caso | Δ TIR motor | Δ TIR sim | Δ cashOnCash motor | Δ aporteAcum a10 | Δ patrimonio a10 | Δ valorVenta a10 |
|---|---|---|---|---|---|---|
| 0-real-0c269222 | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 1-usado-canonico | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 2-usado-sobreprecio | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 3-usado-ventaja | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 4-usado-extras | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 5-nuevo-entrega-12m | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 6-nuevo-entrega-18m-pie-cuotas | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 7-pie-alto-30 | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 8-pie-minimo-10 | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |
| 9-blanco-24m | 0.00pp | 0.00pp | 0 | 0 | 0 | 0 |

## Cumplimiento criterio aceptación

| Criterio | Estado |
|---|---|
| Cero cambios en TODAS las métricas | ✅ 11/11 casos |
| Δ TIR motor↔sim = 0.00pp en los 10 casos | ✅ idéntico (motor=sim) |
| `npm run build` limpio | ✅ |
| `inputMutated=false` post-B1 (incluso con campos falsy) | ✅ caso 11 confirma pureza |

## Hallazgo de validación

Los 10 casos del set canónico de auditoría no triggerean la mutación: todos vienen con `contribuciones>0`, `gastos>0`. El caso 11 sintético (campos falsy) es el que captura el efecto real del fix. Reportar implícitamente: **mutaciones tenían cero efecto numérico observable en los 10 casos** porque ningún consumidor leía pre-mutación; el bug latente era estrictamente sobre la pureza/persistencia de input, no sobre la matemática.

## Archivos tocados

| Archivo | Cambios |
|---|---|
| `src/lib/types.ts` | `AnalysisMetrics`: agrega `contribuciones`, `gastos`. Comentario `provisionMantencionAjustada` actualizado a triada (mantención + contribuciones + gastos). |
| `src/lib/analysis.ts` | `calcMetrics`: variables locales `contribucionesValor`, `gastosValor` (sin mutar `input`); ambas se retornan en `metrics`. `calcCashflowYear1`, `calcProjections`, `calcRefinanceScenario`, `generateContras`: leen `metrics.gastos` / `metrics.contribuciones`. |
| `src/lib/ai-generation.ts` | Prompt IA lee `m.gastos ?? input.gastos` / `m.contribuciones ?? input.contribuciones` (preserva valor visible). Anomalías intactas (chequean lo declarado por usuario). |
| `src/components/ui/AnalysisDrawer.tsx` | Drawer Costo Mensual lee `metrics.gastos` / `metrics.contribuciones` con fallback al input. |
| `src/app/analisis/[id]/results-client.tsx` | 5 consumidores migrados: `flujoBreakdown`, `sensScenarios`, `waterfallData`, `cashflowData`, `projData`. Eliminada la rama `inputData.provisionMantencion ||`: la base de mantención ahora sigue siempre la fórmula del motor (precio × `getMantencionRate(antig+año)` / 12). Eliminada variable obsoleta `precioCLPBase`. |
| `src/app/demo/page.tsx` | Mock `metrics` agrega `contribuciones`, `gastos` para satisfacer el tipo. |

**Líneas netas:** 6 archivos, ≈ +30 / −18.

## Casos OK / FAIL

11 OK · 0 FAIL.
