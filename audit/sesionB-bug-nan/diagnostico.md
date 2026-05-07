# Diagnóstico bug NaN/undefined Card 08 + Card 09

**Fecha:** 2026-05-07
**Caso reportado:** `7a75e2d7-3024-4f26-8690-465ca49ba1a3` (modo `cerrar_actual`, único caso productivo en BD).
**Síntomas:**
- Card 08 sim: cashOnCash "—", múltiplo "—" (no convergen).
- Card 09 chart tooltip año N: `aporteAcum = "UF NaN,undefined"`. Patrimonio neto, valorDepto, deuda OK.
- Card 09 footer: `"vs UF NaN,undefined aportados"`.

## Causa raíz — H3 confirmada

**La migración Sesión B1 (commit `8cb3d6a`, 2026-05-05) introdujo dependencia en `metrics.gastos` y `metrics.contribuciones` dentro de `calcProjections`.** Análisis creados ANTES de ese commit tienen `results.metrics` persistido SIN esos campos. Cuando el cliente recompute `dynamicProjections` en runtime usando `metrics: m` (donde `m` es el persistido), `calcProjections` lee `metrics.gastos = undefined`, `metrics.contribuciones = undefined`, y el flujo se contamina con NaN.

### Cadena exacta del bug

1. `dynamicProjections` (results-client.tsx:2819) → `calcProjections({ input, metrics: m, ... })`.
2. `calcProjections` (analysis.ts:417-418): `let gastosActual = metrics.gastos; let contribucionesActual = metrics.contribuciones;`
   - Pre-B1 commit: `metrics` persistido NO tiene esos campos → `undefined`.
3. `calcFlujoDesglose({ ggcc: undefined, contribuciones: undefined, ... })` → propaga NaN.
4. `flujoMes.flujoNeto` = NaN → `flujoAnual` += NaN = NaN.
5. `flujoAcumulado` += NaN = NaN.
6. `projections[i].flujoAnual` = NaN, `projections[i].flujoAcumulado` = NaN para todos los años.
7. **Card 08:** `kpi-calculations.ts:51` `usable.reduce((s, p) => s + p.flujoAnual, 0)` = NaN → `cashOnCash` = NaN → `fmtPct(NaN)` retorna `"—"`. Idem múltiplo (vía `calcExitScenario.multiplicadorCapital`).
8. **Card 09 chart:** `aporteAcum = inversionInicial + cuotasPagadas + Math.abs(Math.min(0, p.flujoAcumulado))` con `flujoAcumulado=NaN` → `Math.min(0, NaN)=NaN`, `Math.abs(NaN)=NaN`, `aporteAcum=NaN`.
9. **Render formato extraño:** `fmtMoney(NaN, "UF", valorUF)` → `fmtUF(NaN/40187)` → `fmtUF(NaN)`:
   - `Math.round(NaN*10)/10` → NaN.
   - `Number.isInteger(NaN)` → false (cae al else).
   - `NaN.toFixed(1)` → `"NaN"`.
   - `"NaN".split(".")` → `["NaN"]`.
   - `[int, dec] = ["NaN"]` → `int="NaN"`, `dec=undefined`.
   - Resultado: `"UF " + "NaN" + "," + undefined` = `"UF NaN,undefined"`. ✅

### Verificación empírica

Probe (`scripts/audit-bug-nan-probe.ts`) sobre el caso 7a75e2d7:

| Métrica | metrics persistido | metrics runtime (recompute) |
|---|---|---|
| pieCLP | 36.155.700 | 36.155.700 |
| precioCLP | 180.778.500 | 180.778.500 |
| cashOnCash | 2.94 | 2.94 |
| **gastos** | **undefined** | 108.000 |
| **contribuciones** | **undefined** | 153.768 |
| **provisionMantencionAjustada** | **undefined** | 72.750 |
| capRate | 6.44 | 6.44 |

Reproducción del flow cliente con metrics persistido:

| Métrica | KPI runtime | KPI con metrics persistido (= cliente real) |
|---|---|---|
| projections[2].flujoAnual | 757.890 | **NaN** (serializado null) |
| projections[2].flujoAcumulado | 2.573.466 | **NaN** |
| cashOnCash | 2.21% | **NaN** ("—") |
| múltiplo | 8.53 | **NaN** ("—") |
| TIR | 17.78% | **NaN** ("—") |

## Alcance — escaneo Supabase

`scripts/audit-bug-nan-scan.ts` sobre los 2.000 análisis más recientes (sample limitado por la query):

| Categoría | Count |
|---|---|
| Total con `results.metrics` | 157 |
| Sin `metrics.gastos` | 153 |
| Sin `metrics.contribuciones` | 153 |
| Sin `metrics.provisionMantencionAjustada` | 147 |
| **Afectados (NaN bug)** | **153 / 157 = 97,5%** |
| Sanos (todos los campos B1) | 4 / 157 |

### Distribución temporal

| Mes | Afectados | Sanos |
|---|---|---|
| 2026-03 | 95 | 0 |
| 2026-04 | 37 | 0 |
| 2026-05 | 21 | 4 |

Los 4 sanos son exclusivamente posteriores al commit B1 (2026-05-05). El caso 7a75e2d7 es del 2026-05-04 — **un día antes** del commit B1, por eso está afectado pese a ser reciente.

## Hipótesis evaluadas

| # | Hipótesis | Status |
|---|---|---|
| H1 | Análisis viejo pre-Sesión A — JSON huérfano | ❌ Descartada (los análisis pre-A también funcionaban hasta B1) |
| H2 | capitalInvertido = 0 (división por cero) | ❌ Descartada (inversionInicial=39.771.270 OK) |
| **H3** | **Item 9 / B1 dejó consumidor desactualizado** | ✅ **Confirmada — causa raíz** |
| H4 | fmtUF rompe con 0/undefined | ❌ Es efecto secundario, no causa |
| H5 | Otro | N/A |

## Archivos involucrados en el fix

### Opción A — Fix defensivo en motor (recomendada)

**Archivo:** `src/lib/analysis.ts:417-418`

`calcProjections` debe caer a un fallback equivalente al que usa `calcMetrics` cuando `metrics.gastos` o `metrics.contribuciones` están undefined.

Diff conceptual (~3-5 líneas):
```ts
// ANTES (B1)
let arriendoActual = metrics.ingresoMensual;
let gastosActual = metrics.gastos;
let contribucionesActual = metrics.contribuciones;

// DESPUÉS (fallback)
let arriendoActual = metrics.ingresoMensual;
let gastosActual = metrics.gastos ?? input.gastos ?? Math.round(input.superficie * 1200);
let contribucionesActual = metrics.contribuciones
  ?? input.contribuciones
  ?? estimarContribuciones(precioCLP, input.enConstruccion || input.antiguedad <= 2);
```

Impacto: rescata 97,5% de la BD sin migración. Análisis pre-B1 muestran KPIs y chart correctamente con el cálculo del input original.

### Opción B — Fix en cliente

`results-client.tsx:2819` `dynamicProjections` recompute `m` via `calcMetrics(input, ufClp)` antes de pasarlo al motor. Más quirúrgico pero pone responsabilidad en el cliente.

### Opción C — Backfill BD

Migración one-time que recalcula metrics para los 153 análisis afectados y los persiste con los campos nuevos. Más limpio long-term pero requiere job migración + validación visual masiva.

### Recomendación

**Opción A**, sola. Justificación:
- 3-5 líneas de código, esfuerzo S.
- Restaura la BD productiva inmediatamente sin migración.
- Patrón de fallback equivalente al que `calcMetrics` ya usa para los mismos campos.
- Cero riesgo de regresión en análisis sanos: el fallback solo se activa cuando `metrics.gastos` es undefined.
- Backfill (Opción C) opcional como cleanup posterior, no urgente.

## Esfuerzo y prioridad

- **Esfuerzo:** S (3-5 líneas en `lib/analysis.ts`).
- **Prioridad:** **P0**. 97,5% de la BD productiva está rota visualmente HOY en Card 08 + Card 09. Cualquier usuario que cargue su análisis antiguo ve "—" y "UF NaN,undefined".
- **Validación post-fix:** re-ejecutar el probe `audit-bug-nan-probe.ts` sobre 7a75e2d7. Confirmar que `projections_with_persisted_metrics_year3.flujoAnual` es número (no null/NaN) y `kpi_cliente_simulated.cashOnCash` también.

## Notas colaterales

- El bug es estrictamente VISUAL/RUNTIME: el motor server-side (`runFullAnalysis`) sigue funcionando correctamente. El crash ocurre solo cuando el cliente recompute `dynamicProjections` con `metrics` persistido pre-B1.
- La regresión NO se detectó en Sesión B1 porque el probe de validación corrió `calcMetrics` runtime ANTES de `calcProjections`, generando metrics frescos con todos los campos. La validación no simuló la persistencia + recarga de metrics legacy.
- **Lección:** futuras migraciones que agreguen dependencia en `metrics.X` deben validar contra metrics persistidos legacy (no solo metrics runtime fresh).
