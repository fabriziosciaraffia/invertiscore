# Sesión B-bug-nan FIX — Helper enrichMetricsLegacy

**Fecha:** 2026-05-07
**Causa raíz:** Sesión B1 (commit `8cb3d6a`) cambió fuente de gastos/contribuciones de `input.X` a `metrics.X` en `calcProjections`. 153/157 análisis productivos (97,5%) tenían `results.metrics` legacy sin esos campos → NaN cascade en Card 08 + Card 09.
**Decisión:** helper `enrichMetricsLegacy(metrics, input)` que aplica fallbacks B1+ al cargar results desde Supabase. Restaura producción + previene regresiones futuras al ampliar metrics.

## Archivos tocados

| Archivo | Acción | Líneas netas |
|---|---|---|
| `src/lib/analysis/enrich-metrics-legacy.ts` | **Nuevo** — helper canónico con fallbacks idénticos a `calcMetrics` | +43 |
| `src/app/analisis/[id]/page.tsx` | Import + wrap `rawResults` con `enrichMetricsLegacy` antes de pasar a `PremiumResults` | +9 / −1 |
| `src/lib/ai-generation.ts` | Import + aplicar enrich en `generateAiAnalysis` server-side; quita 2 fallbacks ad-hoc en bloque del prompt | +3 / −2 |
| `src/app/analisis/[id]/results-client.tsx` | Quita 5 grupos de fallbacks ad-hoc `m.gastos ?? inputData.gastos` (flujoBreakdown, sensScenarios, waterfallData, cashflowData, projData). Confía en metrics enriched. | −10 / +5 (≈ −5) |
| `src/components/ui/AnalysisDrawer.tsx` | Quita fallback `inputData.gastos`/`inputData.contribuciones`/`inputData.provisionMantencion` en DrawerCostoMensual. Mantiene `?? 0` defensivo para `results.metrics?` optional chain. | +3 / −3 |

**Totales:** 5 archivos, **+58 / −16 = net +42 líneas** (la mayoría del archivo nuevo). En consumidores existentes el fix simplifica código (−5 neto).

## Puntos de entrada con `enrichMetricsLegacy` aplicado

1. **`src/app/analisis/[id]/page.tsx:73-79`** (server, página principal LTR) — entry crítico que hidrata `results` para `PremiumResults` (Card 08 + Card 09 + drawers).
2. **`src/lib/ai-generation.ts:622-629`** (server, generación IA) — `generateAiAnalysis` enriquece metrics legacy antes de construir prompt LTR. Garantiza que el bloque de inputs del prompt nunca diga `$NaN/mes`.

### Entry points evaluados sin necesidad de enrich

| Archivo | Razón |
|---|---|
| `src/app/analisis/comparativa/page.tsx` | Lee solo campos individuales (`metrics.ingresoMensual`, `metrics.flujoNetoMensual`, etc.), NO recompute proyecciones. No dispara NaN cascade. |
| `src/app/comparar/comparar-client.tsx` | Igual: consume valores directos sin recompute. |

## Fallbacks ad-hoc eliminados

`m.gastos ?? inputData.gastos` y similares — pasan a usar `m.gastos` directo (post-enrich garantizado):

| Archivo | Lugares |
|---|---|
| `src/app/analisis/[id]/results-client.tsx` | `flujoBreakdown` (2806-2807), `sensScenarios` (2871-2872), `waterfallData` (2931-2932), `cashflowData` (3025-3026), `projData` (3217-3218) |
| `src/components/ui/AnalysisDrawer.tsx` | `DrawerCostoMensual` (107-109) — mantiene `?? 0` para guard de optional chain |
| `src/lib/ai-generation.ts` | Prompt LTR bloque inputs (995-996) |

## Validación

### Probe runtime — 4 casos productivos

`scripts/audit-bug-nan-fix-validate.ts` corre `calcProjections` + `calculateKPIs` con metrics legacy directo (v_old, simulando bug pre-fix) vs metrics enriched (v_new, post-fix). Casos: 1 reportado por usuario + 3 aleatorios pre-2026-05-05.

| Caso | legacy tiene gastos | NaN pre-fix | NaN post-fix | cashOnCash | múltiplo | TIR | aporteAcum a3 |
|---|---|---|---|---|---|---|---|
| `7a75e2d7` (real reportado, Santiago, 2026-05-04) | ❌ | ✅ todos NaN | ✅ todos válidos | NaN → **2,21%** | NaN → **8,53x** | NaN → **24,63%** | NaN → **$39.771.270** |
| Aleatorio 1 (Santiago, pre-05) | ❌ | ✅ todos NaN | ✅ todos válidos | NaN → **−13,36%** | NaN → **1,14x** | NaN → **7,8%** | NaN → **$38.199.893** |
| Aleatorio 2 (Santiago, pre-05) | ❌ | ✅ todos NaN | ✅ todos válidos | NaN → **−13,36%** | NaN → **1,14x** | NaN → **7,8%** | NaN → **$38.199.893** |
| Aleatorio 3 (Santiago, pre-05) | ❌ | ✅ todos NaN | ✅ todos válidos | NaN → **2,21%** | NaN → **8,53x** | NaN → **24,63%** | NaN → **$39.771.270** |

**Resultado:** 4/4 casos. Pre-fix → todos NaN (bug reproducido). Post-fix → todos números válidos.

### Casos sintéticos auditoría (10 casos `_runs.json`)

Los 10 casos sintéticos del set canónico tienen metrics fresh con `gastos`, `contribuciones`, `provisionMantencionAjustada` ya populados. `enrichMetricsLegacy` es **no-op** sobre ellos (los `??` no caen al fallback porque el valor primario está presente). Comportamiento idéntico al pre-fix garantizado por construcción.

### Build
✅ `npm run build` limpio. Sin errores TypeScript ni warnings de regresión.

## Resumen casos OK / FAIL

| Métrica | OK | FAIL |
|---|---|---|
| Caso real reportado (7a75e2d7) post-fix muestra números válidos | ✅ | — |
| 3 casos aleatorios pre-2026-05-05 post-fix muestran números válidos | ✅ | — |
| Casos sintéticos canónicos (metrics fresh) sin regresión | ✅ (no-op por construcción) | — |
| Build limpio | ✅ | — |
| Spot check Supabase localhost (visual) | ⚪ Pendiente del usuario | — |

**Total: 4 OK · 0 FAIL.**

## Hallazgos colaterales

- `normalizeMetrics` cliente (`results-client.tsx:75-103`) **no** rellena `gastos`/`contribuciones`/`provisionMantencionAjustada` con defaults. Hereda lo que viene del `metrics` por spread. Esto es coherente con el diseño post-enrich: la normalización maneja campos legacy renamed (`yieldBruto` → `rentabilidadBruta`); los defaults de B1+ los maneja `enrichMetricsLegacy`. **Sin ambigüedad de responsabilidad.**

- `selectMetrics` en `ai-generation.ts` ahora también pasa por enrich, garantizando que el prompt LTR siempre vea valores reales (vs $NaN en casos legacy regenerados).

- **Ningún otro consumidor pendiente:** revisado patrón `metrics.X ?? input.X` y `metrics.X ?? 0` en src/. Todos los matches están dentro de archivos enrichados o son guards defensivos (`results.metrics?` optional chain).

## Notas de operación

- El fix NO requiere migración Supabase. Análisis legacy permanecen tal cual; el enrich corre on-the-fly al cargar.
- Cuando el motor genera análisis nuevos, `metrics` ya viene completo. El enrich es no-op.
- Backfill opcional (Opción C del diagnóstico) sigue posible como cleanup futuro pero no es bloqueante.
