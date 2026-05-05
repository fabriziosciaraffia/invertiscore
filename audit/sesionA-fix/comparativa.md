# Sesión A — Fix de coherencia: tabla comparativa

**Fecha:** 2026-05-05
**Caso canónico:** Providencia 7710a017 (`audit/raw-dump-7710a017-v5.json`)

**UF_CLP usado:** 38.800 (default módulo `analysis.ts:26`).

**Convenciones:** v_old = motor + sim PRE-fix (clon `dynamicProjections` divergente). v_new = motor + sim POST-fix (sim delega a `calcProjections` parametrizable). Sliders en defaults: plazo=10 años, plusvalía=4%/año.

## Caso A — Canónico Providencia (7710a017)

| Métrica | v_old principal | v_old sim | v_new principal | v_new sim | Δ principal (new−old) | Δ sim (new−old) |
|---|---|---|---|---|---|---|
| TIR @ 10A | 11,56% | 12,36% | 11,56% | 11,56% | 0 | -0.80pp |
| Flujo año 1 | $-3.012.828 | $-3.045.852 | $-3.012.828 | $-3.012.828 | 0 | +$33.024 |
| Flujo año 10 | $-4.715.022 | $-3.365.922 | $-4.715.022 | $-4.715.022 | 0 | −$1.349.100 |
| Cap rate | 4,40% | 4,40% | 4,40% | 4,40% | 0 | 0 |
| Payback (con venta) | Año 1 | Año 1 | Año 1 | Año 1 | — | — |
| Valor venta proyectado año 10 | $338.053.453 | $338.053.453 | $338.053.453 | $338.053.453 | 0 | 0 |
| Multiplicador capital @ 10A | 1.90x | 2.22x | 1.90x | 1.90x | 0 | -0.32 |

**Convergencia post-fix (sim ↔ principal en defaults):** ✅ OK — Δ TIR = 0.000 pp.
**Sin regresión motor (v_new principal ≈ v_old principal):** ✅ OK — Δ TIR = 0.000 pp, Δ flujo año 1 = 0.

## Caso B — Sintético sobreprecio (precio +20%, sin extras)

| Métrica | v_old principal | v_old sim | v_new principal | v_new sim | Δ principal (new−old) | Δ sim (new−old) |
|---|---|---|---|---|---|---|
| TIR @ 10A | 3,41% | 4,69% | 3,41% | 3,41% | 0 | -1.28pp |
| Flujo año 1 | $-5.503.632 | $-5.323.260 | $-5.503.632 | $-5.503.632 | 0 | −$180.372 |
| Flujo año 10 | $-8.243.418 | $-6.337.434 | $-8.243.418 | $-8.243.418 | 0 | −$1.905.984 |
| Cap rate | 3,67% | 3,67% | 3,67% | 3,67% | 0 | 0 |
| Payback (con venta) | Año 7 | Año 6 | Año 7 | Año 7 | — | — |
| Valor venta proyectado año 10 | $315.884.130 | $315.884.130 | $315.884.130 | $315.884.130 | 0 | 0 |
| Multiplicador capital @ 10A | 0.71x | 0.89x | 0.71x | 0.71x | 0 | -0.18 |

**Convergencia post-fix (sim ↔ principal en defaults):** ✅ OK — Δ TIR = 0.000 pp.
**Sin regresión motor (v_new principal ≈ v_old principal):** ✅ OK — Δ TIR = 0.000 pp, Δ flujo año 1 = 0.

## Caso C — Sintético ventaja de compra (precio −10%, +estacionamiento $80K)

| Métrica | v_old principal | v_old sim | v_new principal | v_new sim | Δ principal (new−old) | Δ sim (new−old) |
|---|---|---|---|---|---|---|
| TIR @ 10A | 14,88% | 14,28% | 14,88% | 14,88% | 0 | +0.60pp |
| Flujo año 1 | $-895.428 | $-1.907.148 | $-895.428 | $-895.428 | 0 | +$1.011.720 |
| Flujo año 10 | $-1.762.389 | $-1.880.178 | $-1.762.389 | $-1.762.389 | 0 | +$117.789 |
| Cap rate | 5,39% | 5,39% | 5,39% | 5,39% | 0 | 0 |
| Payback (con venta) | Año 1 | Año 1 | Año 1 | Año 1 | — | — |
| Valor venta proyectado año 10 | $315.884.130 | $315.884.130 | $315.884.130 | $315.884.130 | 0 | 0 |
| Multiplicador capital @ 10A | 3.18x | 2.92x | 3.18x | 3.18x | 0 | +0.26 |

**Convergencia post-fix (sim ↔ principal en defaults):** ✅ OK — Δ TIR = 0.000 pp.
**Sin regresión motor (v_new principal ≈ v_old principal):** ✅ OK — Δ TIR = 0.000 pp, Δ flujo año 1 = 0.

## Caso D — Override del usuario (Caso A canónico, plusvalía=8% en sim)

| Slider plusvalía | TIR @ 10A | Valor venta año 10 | Multiplicador 10A |
|---|---|---|---|
| 4% (default = motor) | 11,56% | $338.053.453 | 1.90x |
| 8% (override) | 18,90% | $493.048.382 | 3.64x |

**Override del usuario varía coherentemente:** ✅ OK — sim con plusvalía 8% sube TIR y valor venta proyectado vs 4%.

---

## Resumen de cambios aplicados

### Archivos tocados (solo del fix)

| Archivo | Insert | Delete | Qué cambió |
|---|---|---|---|
| `src/lib/analysis.ts` | +44 | −0 | `calcProjections` ahora exportada con firma `{input, metrics, plazoVenta?, plusvaliaAnual?}`. `calcMetrics` ya no muta `input.provisionMantencion`; en su lugar calcula `provisionMantencionAjustada` localmente y lo retorna en metrics. `calcCashflowYear1` y `calcRefinanceScenario` leen mantención desde metrics. |
| `src/lib/types.ts` | +6 | −0 | Nuevo campo `provisionMantencionAjustada: number` en `AnalysisMetrics`. |
| `src/app/analisis/[id]/results-client.tsx` | +1 (import) +14 (nuevo `dynamicProjections`) | −80 (clon inline) | Eliminado clon de `calcProjections` en línea 2754; ahora delega al motor con sliders del usuario. Migrado snapshot año-1 en `flujoBreakdown` y `waterfallData` a `m.provisionMantencionAjustada`. |
| `src/components/ui/AnalysisDrawer.tsx` | +1 | −1 | Drawer mantención lee de `results.metrics.provisionMantencionAjustada`. |
| `src/lib/ai-generation.ts` | +1 | −1 | Prompt IA preserva semántica del valor año-1 leyendo de `m.provisionMantencionAjustada`. |
| `src/app/demo/page.tsx` | +1 | −0 | Mock de demo agrega el campo nuevo para pasar el type-check. |

**Total fix:** 6 archivos, +57 / −97 líneas (net −40, simplificación).

### Casos de validación

| Caso | Convergencia sim↔principal post-fix | Sin regresión motor |
|---|---|---|
| A — Canónico Providencia 7710a017 | ✅ Δ TIR = 0,00 pp | ✅ Δ TIR = 0,00 pp |
| B — Sobreprecio +20% | ✅ Δ TIR = 0,00 pp | ✅ Δ TIR = 0,00 pp |
| C — Ventaja compra + estacionamiento $80K | ✅ Δ TIR = 0,00 pp | ✅ Δ TIR = 0,00 pp |
| D — Override slider plusvalía 4%→8% | ✅ TIR varía 11,56% → 18,90% (coherente) | n/a |

### Consumidores de `input.provisionMantencion` fuera del scope del fix

El plan acotó el fix a coherencia simulación↔principal (header + drawers 01-06). Estos otros consumidores tienen el mismo patrón estructural que tenía `dynamicProjections` (`inputData.provisionMantencion || formula(antig+año)`) y, por tanto, divergen del motor para análisis donde el usuario declaró `provisionMantencion`. Los dejé intactos pero los listo aquí porque comparten la raíz del bug que cerramos:

| Lugar | Línea aprox | Función / sección |
|---|---|---|
| `results-client.tsx` | 2812 | `sensScenarios` — escenarios pesimista/base/optimista en zona "Avanzado" |
| `results-client.tsx` | 2965 | `getMantencionForMonth` dentro de `cashflowData` — gráfico cashflow detallado |
| `results-client.tsx` | 3170 | `projData` — gráfico de patrimonio |

El header y los drawers 01-06 NO consumen estas funciones (usan `m`, `flujoBreakdown`, `waterfallData` ya migrados, o el `dynamicProjections` ahora-coherente). Para cerrar el ticket completamente, una segunda iteración sería migrar estos tres clones a `calcProjections` del motor (o eliminarlos si la información ya está en `dynamicProjections`).

### Hallazgos colaterales (mismos que el diagnóstico mencionó, ahora con código a la vista)

- `calcMetrics` ya no muta `input.provisionMantencion`, pero **sigue mutando** `input.contribuciones` y `input.gastos` cuando vienen falsy (líneas 213–214 de `analysis.ts`). Bajo el mismo patrón de side-effect. No los toqué porque fuera de scope; el plan dijo "no fixear sin avisar".
- Análisis viejos en DB conservan `input_data.provisionMantencion` con el valor mutado por el motor antiguo. Como el nuevo `calcMetrics` usa `input.provisionMantencion || formula`, el valor viejo (= el snapshot año-1 que el motor habría calculado igualmente) sigue produciendo resultados equivalentes. No hay backfill necesario, y los nuevos análisis ya guardan input limpio.

