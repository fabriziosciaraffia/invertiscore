# Item 9 — Eliminar doble conteo cuotas pie en capitalInvertido

**Fecha:** 2026-05-05
**Decisión:** Modelo A — cuotas SON el pie. `capitalInvertido = pieCLP + gastosCompra` (sin sumar `cuotasPieTotal`).
**Probe:** `scripts/audit-item9-probe.ts` recompute cada caso con código actual (v_new) y replica la fórmula vieja (v_old).

## Archivos tocados

- `src/lib/analysis.ts` (calcMetrics): elimina cálculo y suma de `cuotasPieTotal` a `capitalInvertido`. Comentario actualizado.
- `src/lib/analysis/kpi-calculations.ts`: revierte fix H4 — sim `inversionInicial` ya no suma `metrics.cuotasPieTotal`.
- `src/lib/types.ts`: elimina campo `cuotasPieTotal` de `AnalysisMetrics` (sin consumidores reales tras el revert de H4).
- `src/app/demo/page.tsx`: elimina init `cuotasPieTotal: 0` (campo ya no existe).
- `src/app/analisis/[id]/results-client.tsx`: actualiza comentario de Card 09 (chart Patrimonio). Lógica de `aporteAcum` (fix H5) intacta.

**Líneas netas:** −19 / +14 (delta neto ≈ −5).

## Consumidores `cuotasPieTotal` antes del fix

| Lugar | Tipo | Acción tras fix |
|---|---|---|
| `analysis.ts:253-255, 289` (calcMetrics) | uso real (suma a capitalInvertido) | eliminado |
| `analysis/kpi-calculations.ts:47` (sim H4) | uso real (suma a inversionInicial sim) | revertido |
| `types.ts:131` | declaración interfaz | eliminado |
| `app/demo/page.tsx:127` | init literal `: 0` (no usa el valor) | eliminado |
| `app/analisis/[id]/results-client.tsx:363-364` | sólo comentario explicativo | reescrito |

`calcExitScenario` (analysis.ts:514) ya usaba `pieCLP + gastosCompra` sin cuotas → TIR motor estaba correcto pre-fix; sin cambios necesarios.

## Tabla v_old vs v_new — 10 casos

Métricas mostradas: capitalInvertido motor, cashOnCash motor, sim inversionInicial, sim cashOnCash, sim payback, sim múltiplo, TIR motor, TIR sim, aporteAcum chart año 10.

### Caso 0 — real Santiago 0c269222 (entrega inmediata, sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $33.110.069 | $33.110.069 | 0 | ✅ |
| cashOnCash motor | -11.77% | -11.77% | 0 | ✅ |
| mesesPaybackPie | 999 | 999 | 0 | ✅ |
| sim inversionInicial | $33.110.069 | $33.110.069 | 0 | ✅ |
| sim cashOnCash | -15.06% | -15.06% | 0 | ✅ |
| sim payback (años) | 2 | 2 | 0 | ✅ |
| sim múltiplo | 0.99 | 0.99 | 0 | ✅ |
| TIR motor | 6.95% | 6.95% | 0.00pp | ✅ |
| TIR sim | 6.95% | 6.95% | 0.00pp | ✅ |
| aporteAcum chart a10 | $82.980.127 | $82.980.127 | 0 | ✅ |

### Caso 1 — usado canónico Providencia (entrega inmediata, sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $48.626.270 | $48.626.270 | 0 | ✅ |
| cashOnCash motor | -7.32% | -7.32% | 0 | ✅ |
| sim inversionInicial | $48.626.270 | $48.626.270 | 0 | ✅ |
| sim cashOnCash | -9.94% | -9.94% | 0 | ✅ |
| sim payback (años) | 2 | 2 | 0 | ✅ |
| sim múltiplo | 1.48 | 1.48 | 0 | ✅ |
| TIR motor | 9.38% | 9.38% | 0.00pp | ✅ |
| TIR sim | 9.38% | 9.38% | 0.00pp | ✅ |
| aporteAcum chart a10 | $96.969.248 | $96.969.248 | 0 | ✅ |

### Caso 2 — usado SOBREPRECIO 20% (sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $58.351.524 | $58.351.524 | 0 | ✅ |
| cashOnCash motor | -10.52% | -10.52% | 0 | ✅ |
| sim inversionInicial | $58.351.524 | $58.351.524 | 0 | ✅ |
| sim cashOnCash | -13.71% | -13.71% | 0 | ✅ |
| sim payback (años) | 8 | 8 | 0 | ✅ |
| sim múltiplo | 0.63 | 0.63 | 0 | ✅ |
| TIR motor | 2.75% | 2.75% | 0.00pp | ✅ |
| TIR sim | 2.75% | 2.75% | 0.00pp | ✅ |
| aporteAcum chart a10 | $138.333.954 | $138.333.954 | 0 | ✅ |

### Caso 3 — usado VENTAJA −10% (sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $43.763.643 | $43.763.643 | 0 | ✅ |
| cashOnCash motor | -5.18% | -5.18% | 0 | ✅ |
| sim inversionInicial | $43.763.643 | $43.763.643 | 0 | ✅ |
| sim cashOnCash | -7.43% | -7.43% | 0 | ✅ |
| sim payback (años) | 1 | 1 | 0 | ✅ |
| sim múltiplo | 2.26 | 2.26 | 0 | ✅ |
| TIR motor | 12.90% | 12.90% | 0.00pp | ✅ |
| TIR sim | 12.90% | 12.90% | 0.00pp | ✅ |
| aporteAcum chart a10 | $76.286.901 | $76.286.901 | 0 | ✅ |

### Caso 4 — usado con extras (sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $48.626.270 | $48.626.270 | 0 | ✅ |
| cashOnCash motor | -4.85% | -4.85% | 0 | ✅ |
| sim inversionInicial | $48.626.270 | $48.626.270 | 0 | ✅ |
| sim cashOnCash | -7.05% | -7.05% | 0 | ✅ |
| sim payback (años) | 1 | 1 | 0 | ✅ |
| sim múltiplo | 1.90 | 1.90 | 0 | ✅ |
| TIR motor | 10.89% | 10.89% | 0.00pp | ✅ |
| TIR sim | 10.89% | 10.89% | 0.00pp | ✅ |
| aporteAcum chart a10 | $82.903.325 | $82.903.325 | 0 | ✅ |

### Caso 5 — nuevo entrega 12m, pie al contado (con cuotas implícitas pre-fix)

> Pre-fix la fórmula vieja calculaba `cuotasPieTotal=$44.205.700` aun con `cuotasPie=0`, asumiendo pie distribuido implícito en los 12 meses pre-entrega. Inflaba ~2× capitalInvertido y simInv.

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $92.831.970 | $48.626.270 | −47.6% | ✅ cae ~50% |
| cashOnCash motor | -3.36% | -6.41% | −3.05pp (más negativo) | ✅ |
| sim inversionInicial | $92.831.970 | $48.626.270 | −47.6% | ✅ |
| sim cashOnCash | -4.47% | -8.54% | −4.07pp | ✅ |
| sim payback (años) | 6 | 2 | −4 años | ✅ |
| sim múltiplo | 1.08 | 1.61 | +0.53 | ✅ |
| TIR motor | 9.97% | 9.97% | 0.00pp | ✅ sin cambio |
| TIR sim | 4.05% | 9.97% | +5.92pp (corrige) | ✅ ahora coincide con motor |
| aporteAcum chart a10 | $90.163.346 | $90.163.346 | 0 | ✅ semántica H5 intacta |

### Caso 6 — nuevo entrega 18m + pie en 18 cuotas

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $92.831.966 | $48.626.270 | −47.6% | ✅ |
| cashOnCash motor | -3.36% | -6.41% | −3.05pp | ✅ |
| sim inversionInicial | $92.831.966 | $48.626.270 | −47.6% | ✅ |
| sim cashOnCash | -4.29% | -8.18% | −3.89pp | ✅ |
| sim payback (años) | 6 | 2 | −4 años | ✅ |
| sim múltiplo | 1.08 | 1.62 | +0.54 | ✅ |
| TIR motor | 10.03% | 10.03% | 0.00pp | ✅ |
| TIR sim | 4.02% | 10.03% | +6.01pp (corrige) | ✅ |
| aporteAcum chart a10 | $132.624.104 | $132.624.104 | 0 | ✅ semántica H5 intacta |

### Caso 7 — pie alto 30%, plazo 20 (sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $70.729.120 | $70.729.120 | 0 | ✅ |
| cashOnCash motor | -4.96% | -4.96% | 0 | ✅ |
| sim inversionInicial | $70.729.120 | $70.729.120 | 0 | ✅ |
| sim cashOnCash | -6.76% | -6.76% | 0 | ✅ |
| sim payback (años) | 1 | 1 | 0 | ✅ |
| sim múltiplo | 1.51 | 1.51 | 0 | ✅ |
| TIR motor | 8.33% | 8.33% | 0.00pp | ✅ |
| TIR sim | 8.33% | 8.33% | 0.00pp | ✅ |
| aporteAcum chart a10 | $118.521.274 | $118.521.274 | 0 | ✅ |

### Caso 8 — pie mínimo 10%, plazo 30 (sin cuotas)

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $26.523.420 | $26.523.420 | 0 | ✅ |
| cashOnCash motor | -14.55% | -14.55% | 0 | ✅ |
| sim inversionInicial | $26.523.420 | $26.523.420 | 0 | ✅ |
| sim cashOnCash | -19.53% | -19.53% | 0 | ✅ |
| sim payback (años) | 2 | 2 | 0 | ✅ |
| sim múltiplo | 1.40 | 1.40 | 0 | ✅ |
| TIR motor | 11.17% | 11.17% | 0.00pp | ✅ |
| TIR sim | 11.17% | 11.17% | 0.00pp | ✅ |
| aporteAcum chart a10 | $78.317.682 | $78.317.682 | 0 | ✅ |

### Caso 9 — venta en blanco/verde 24m + 24 cuotas

| Métrica | v_old | v_new | Δ | Status |
|---|---|---|---|---|
| capitalInvertido motor | $92.831.966 | $48.626.270 | −47.6% | ✅ |
| cashOnCash motor | -3.36% | -6.41% | −3.05pp | ✅ |
| sim inversionInicial | $92.831.966 | $48.626.270 | −47.6% | ✅ |
| sim cashOnCash | -4.42% | -8.44% | −4.02pp | ✅ |
| sim payback (años) | 6 | 2 | −4 años | ✅ |
| sim múltiplo | 1.04 | 1.56 | +0.52 | ✅ |
| TIR motor | 9.79% | 9.79% | 0.00pp | ✅ |
| TIR sim | 3.75% | 9.79% | +6.04pp (corrige) | ✅ |
| aporteAcum chart a10 | $133.889.229 | $133.889.229 | 0 | ✅ semántica H5 intacta |

## Cumplimiento criterio aceptación

| Criterio | Estado |
|---|---|
| Casos sin cuotas pie (0,1,2,3,4,7,8): sin cambios en ninguna métrica | ✅ |
| Casos con cuotas pie (5,6,9): `capitalInvertido` y derivados caen ~50%; TIR motor sin cambio; `aporteAcum` chart sin cambio | ✅ |
| Δ TIR motor↔sim = 0.00pp en los 10 casos | ✅ (post-fix coincide en todos) |
| `npm run build` limpio | ✅ |

## Observación adicional — fórmula vieja en caso 5

El probe descubre que para `entrega futura + cuotasPie=0` la fórmula vieja AÚN inflaba `cuotasPieTotal` (por la rama `else mesesPreEntrega`). Es decir, el bug afectaba más casos de los previstos: cualquier operación con `mesesPreEntrega > 0`, no sólo las que declaraban cuotas explícitas. Modelo A elimina ambos sub-bugs (cuotas declaradas e implícitas).

## Casos OK / FAIL

10 OK · 0 FAIL.
