# Sesión A residual — Caso 0c269222

**Fecha:** 2026-05-05
**Análisis auditado:** `0c269222-3ccb-4cba-969c-cc86ab30982a` (Santiago)
**Reporte del usuario:** TIR card 04 = 7,0% vs TIR sim @ 10 años = 6,5%. Δ = 0,5 pp.
**Caso canónico Providencia daba 0,00 pp post-fix.**

---

## TL;DR (3 líneas)

El motor y la simulación, recalculados con el input guardado y los defaults declarados (plazo=10 años, plusvalía=4%), producen **exactamente el mismo TIR: 6,95%** que ambos formatean a **"7,0%"**. No hay divergencia residual entre motor y sim para este caso. El "6,5%" que aparece en pantalla NO sale de defaults: corresponde matemáticamente a **plazo=12 años con plusvalía=4%** (TIR=6,52% → "6,5%"). Hipótesis ganadora: **(b) plazo distinto al reportado** — el slider del plazo está en 12, no 10, aunque la lectura visual del label diga "TIR @ 10 AÑOS".

> **Nota importante:** la opción (a) JSON cacheado pre-fix queda descartada — el análisis fue creado el **2026-05-05 13:41 UTC**, ya con el motor post-fix (incluye `metrics.provisionMantencionAjustada` en el JSON). La opción (c) consumidor residual mutado también queda descartada — `input.provisionMantencion=60.544` y `metrics.provisionMantencionAjustada=60.544` coinciden, no hay mutación en el JSON.

---

## Datos del análisis 0c269222

### Trazabilidad

| Campo | Valor |
|---|---|
| `id` | `0c269222-3ccb-4cba-969c-cc86ab30982a` |
| `comuna` | Santiago |
| `created_at` | `2026-05-05T13:41:52` (post-fix Sesión A) |
| `updated_at` | (no presente) |

### Campos TIR en `results`

| Campo | Valor |
|---|---|
| `results.metrics.tir` | (no existe — el motor nunca expone TIR en metrics) |
| `results.metrics.tir5A` / `tir10A` / `tirVida` | (ningún campo TIR existe en metrics) |
| `results.exitScenario.tir` | **6,95** |
| `results.exitScenario.anios` | 10 |
| `results.exitScenario.multiplicadorCapital` | 0,99 |

### `provisionMantencionAjustada` en el JSON guardado

| Campo | Valor |
|---|---|
| `results.metrics.provisionMantencionAjustada` | **60.544** ✅ existe (post-fix activo) |
| `input_data.provisionMantencion` | 60.544 (declarado por el usuario, NO mutado por el motor) |

El campo nuevo del fix está presente. La mutación está eliminada — `input_data.provisionMantencion` quedó tal cual lo declaró el usuario.

### Inputs relevantes

| Campo | Valor |
|---|---|
| `precio` | UF 3.745 |
| `valorMercadoFranco` | UF 3.745 (sin descuento Franco) |
| `arriendo` | $460.000 |
| `arriendoEstacionamiento` | 0 |
| `arriendoBodega` | 0 |
| `piePct` | 20% |
| `tasaInteres` | 4,11% |
| `plazoCredito` | 25 años |
| `vacanciaMeses` | 0,6 |
| `gastos` | $90.000 |
| `contribuciones` | $104.296 |
| `antiguedad` | 4 años |
| `estadoVenta` | inmediata |
| `provisionMantencion` | $60.544 |

UF_CLP usado al guardar = `metrics.precioCLP / input.precio` = **40.187**.
UF actual hoy (`mindicador.cl`) = **40.186,79** → mismo valor (no hay drift).

---

## Mapa de qué lee qué

### Card 04 "Largo plazo" — TIR 7,0%

- **Ubicación:** `src/app/analisis/[id]/results-client.tsx`, MiniCard `numero="04"` (línea 2167), section `"largoPlazo"`.
- **Getter:** función `getPunchline` línea 1796–1811:
  ```ts
  if (section === "largoPlazo") {
    const tir = results?.exitScenario?.tir;
    const aniosPlazo = results?.exitScenario?.anios ?? 10;
    if (typeof tir === "number" && !isNaN(tir)) {
      const tirPct = tir.toFixed(1).replace(".", ",");
      ...
      return { value: `TIR ${tirPct}%`, ... };
    }
  ```
- **Variable leída:** `results.exitScenario.tir` → `6.95` → `(6.95).toFixed(1)` = `"7.0"` → display `"TIR 7,0%"`.
- **Plazo subyacente:** `results.exitScenario.anios` = 10 (snapshot del motor server-side).
- **Función origen:** `calcExitScenario(input, metrics, projections, 10)` ejecutada server-side al crear el análisis y persistida en `analisis.results.exitScenario`.

### Sim "TIR @ 10 AÑOS 6,5%"

- **Ubicación:** `IndicadoresRentabilidadContent` (línea 239), KPICard hero "TIR @ X AÑOS" (líneas 268–275).
- **Getter:**
  ```ts
  const { plazoAnios, plusvaliaAnual } = useSimulation();
  const kpis = useMemo(
    () => calculateKPIs({ projections, metrics, plazoAnios, plusvaliaAnual }),
    [projections, metrics, plazoAnios, plusvaliaAnual]
  );
  // ...
  <KPICard label={`TIR @ ${plazoLabel}`} value={fmtPct(kpis.tir)} ... />
  ```
- **Variable leída:** `kpis.tir` (de `lib/analysis/kpi-calculations.ts:71`).
- **`fmtPct`:** `(v) => v.toFixed(1) + "%"`.
- **Cadena de cálculo:**
  1. `dynamicProjections` (`results-client.tsx:2756`, post-fix) llama a `calcProjections({input: inputData, metrics: m, plazoVenta: 30, plusvaliaAnual: plusvaliaRate / 100})`.
  2. `IndicadoresRentabilidadContent` recibe esas projections.
  3. `calculateKPIs` (`kpi-calculations.ts:39`) llama a `calcExitScenario(placeholderInput, metrics, projections, effectivePlazo)` donde `effectivePlazo = min(plazoAnios, projections.length)`.
- **Plazo subyacente:** `plazoAnios` viene del `SimulationContext` que envuelve a `horizonYears` (state inicial `useState(10)`, results-client.tsx:2483).
- **Función origen:** `calcExitScenario` con projections recomputadas en runtime.

---

## Recálculo fresh con motor nuevo

Probe: `audit/sesionA-residual/_probe.ts` (se elimina al cierre de sesión).

```
UF_CLP usado: 40.187 (mismo que server al guardar y mismo de hoy)

metrics SAVED (JSON):     metrics FRESH (recalc):
  precioCLP   150.500.315   150.500.315
  pieCLP       30.100.063    30.100.063
  dividendo       642.852       642.852
  ingresoMensual  460.000       460.000
  provisionMantencionAjustada  60.544  60.544

--- TIRs ---
  TIR SAVED  (results.exitScenario.tir)        = 6,95 % → "7,0"
  TIR FRESH  (runAnalysis nuevo)                = 6,95 % → "7,0"
  TIR SIM    (calcProjections + calcExitScenario, plazo=10, plusv=4%) saved-metrics = 6,95 % → "7,0"
  TIR SIM    (mismo, fresh-metrics)            = 6,95 % → "7,0"

Diff TIR SAVED vs SIM: 0,00 pp
Diff TIR FRESH vs SIM: 0,00 pp
```

Las projections coinciden año a año. Year 10:
```
saved: {flujoAnual:-5.810.223, valorPropiedad:222.777.231, saldoCredito:86.264.321}
fresh: {flujoAnual:-5.810.223, valorPropiedad:222.777.231, saldoCredito:86.264.321}
sim  : {flujoAnual:-5.810.223, valorPropiedad:222.777.231, saldoCredito:86.264.321}
```

---

## Tabla de fuentes

| Fuente | Valor mostrado | Campo leído | Plazo | Función origen | TIR real recalculada |
|---|---|---|---|---|---|
| Card 04 "Largo plazo" | **7,0%** | `results.exitScenario.tir` | 10 (snapshot server) | `calcExitScenario` server-side al guardar | 6,95% |
| Sim "TIR @ 10 AÑOS" | **6,5%** (reportado por user) | `kpis.tir` ← `calcExitScenario(metrics, projections, effectivePlazo).tir` | `plazoAnios` del `SimulationContext` (= `horizonYears`, state inicial 10) | `calcExitScenario` runtime sobre `dynamicProjections` (= `calcProjections` motor unificado) | **6,95%** si plazo=10, plusvalía=4% — NO 6,5% |
| Recálculo fresh (probe) | 6,95% → "7,0" | `runAnalysis(input).exitScenario.tir` | 10 | `calcExitScenario` motor nuevo | 6,95% |

---

## Sweep paramétrico — qué plazo / plusvalía produciría "6,5%"

Sobre el mismo input, con projections de 30 años y `calcExitScenario(plazo)`:

| plazo (años) | TIR real | toFixed(1) |
|---|---|---|
| 9 | 7,16% | 7,2 |
| 10 (default) | **6,95%** | **7,0** |
| 11 | 6,75% | 6,8 |
| **12** | **6,52%** | **6,5** ← coincide con lo reportado |
| 15 | 5,94% | 5,9 |

| plusvalía (%, plazo=10) | TIR real | toFixed(1) |
|---|---|---|
| 3,0% | 4,52% | 4,5 |
| 3,5% | 5,76% | 5,8 |
| 4,0% (default) | **6,95%** | **7,0** |
| 4,5% | 8,09% | 8,1 |

El único combo que da "6,5%" en el formato `toFixed(1)` es **plazo=12 + plusvalía=4%**. Ningún ajuste de plusvalía con plazo=10 cae en el bucket [6,45%, 6,55%): el siguiente debajo de 6,95% es 5,76% (plusv=3,5%).

> Nota colateral: para Santiago, `PLUSVALIA_HISTORICA["Santiago"].anualizada = -1,1` (negativa real histórica 2014–2024). El slider expone esto como `plusvaliaBase`, pero el state inicial del slider está hardcoded en `useState(4.0)` (results-client.tsx:2489), así que no se aplica automáticamente.

---

## Conclusión

**Hipótesis ganadora: (b) plazo distinto al reportado verbalmente.**

El slider de plazo está, en el estado actual de la UI del usuario, posicionado en **12 años** (no 10). El label de la KPICard mostraría "TIR @ 12 AÑOS", pero el reporte verbal del usuario lo describió como "10 años (defaults)". Toda la matemática del fix Sesión A funciona correctamente para este caso.

Hipótesis descartadas:

| # | Hipótesis | Estado | Por qué se descarta |
|---|---|---|---|
| (a) | JSON cacheado pre-fix | ❌ Descartada | El análisis fue creado el 2026-05-05, ya post-fix. `provisionMantencionAjustada` está presente en el JSON. `input_data.provisionMantencion=60544` no coincide con el snapshot año-1 que la mutación habría escrito; está como el usuario lo declaró. |
| (c) | Consumidor residual mutado | ❌ Descartada | El motor nuevo no muta y el JSON no tiene rastro de mutación. Recalcular fresh produce los mismos números que el JSON. |
| (d) | UF_CLP cambiante entre save y view | ❌ Descartada | UF al guardar = 40.187. UF actual = 40.187. Mismo valor. |
| (d′) | Defaults distintos en sim vs motor | ❌ Descartada | Sim defaults `plazoAnios=10, plusvaliaAnual=4` matchean motor `calcExitScenario(...,10)` y `PLUSVALIA_ANUAL=0.04`. Mi probe ejecuta esos defaults y obtiene exactamente 6,95%. |
| **(b)** | **Plazo distinto al reportado** | **✅ Ganadora** | **Único combo que produce display "6,5%" es plazo=12, plusvalía=4%. La sim es matemáticamente coherente con el motor para cada plazo dado.** |

### Verificación operativa sugerida (sin código)

Pedirle al usuario:

1. Abrir el análisis 0c269222 en `/analisis/0c269222-3ccb-4cba-969c-cc86ab30982a`.
2. Mirar el slider "Plazo de análisis" en la sub-sección 07 · Escenarios. Reportar el valor exacto (debería decir N años con N visible).
3. Mirar el label completo de la KPICard en sub-sección 08 · Indicadores. ¿Dice "TIR @ 10 AÑOS" o "TIR @ 12 AÑOS"?
4. Si dice "12 AÑOS" y el slider está en 12 → caso cerrado, no hay bug.
5. Si dice "10 AÑOS" y el slider está en 10 pero la TIR en pantalla es 6,5% → entonces sí habría un bug residual, y necesitaríamos un screenshot para reabrir.

### Hallazgo colateral (fuera de scope)

`PLUSVALIA_HISTORICA["Santiago"].anualizada = -1,1` (Santiago perdió 10% de valor real entre 2014–2024 según `plusvalia-historica.ts:32`). El motor usa siempre `PLUSVALIA_ANUAL=0,04` (4%) como default — independiente de la comuna. Para Santiago esto sobreestima la plusvalía proyectada. La sim expone `plusvaliaBase` (la histórica de la comuna) como dato informativo en `SimulationProvider`, pero el state inicial del slider arranca en 4% hardcoded, no en `plusvaliaBase`. Esto NO causa el "6,5%" de este caso, pero es una incoherencia conceptual entre lo que la UI sugiere como "base" y lo que el motor usa por default.
