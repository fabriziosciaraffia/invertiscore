# Sesión A auditoría sim — Tabla maestra

**Fecha:** 2026-05-05
**Sliders defaults:** plazo=10, plusvalía=4%
**Convención status:** ✅ OK · ⚠️ Anómalo (con explicación) · ❌ Bug (con prioridad)

---

## Card 07 ESCENARIOS — sliders

| Métrica | Esperado | Status |
|---|---|---|
| Default plazo | 10 años | ✅ — `useState(10)` en `results-client.tsx:2483` |
| Default plusvalía | 4% | ✅ — `useState(4.0)` en `results-client.tsx:2489` |
| Range plazo | 1-30 años, step 1 | ✅ — `SliderSimulacion.tsx:78` |
| Range plusvalía | 0-15%, step 0.1 | ✅ — `SliderSimulacion.tsx:124` |
| Plusvalía base UI | `PLUSVALIA_HISTORICA[comuna]?.anualizada` | ⚠️ — el slider arranca en 4% hardcoded, NO en plusvaliaBase. Para Santiago plusvaliaBase=−1.1%, divergente del default visual. |
| Mover plazo afecta sólo Cards 08-10 | El slider es local al SimulationProvider | ✅ |
| Mover plusvalía afecta dynamicProjections | OK post-fix | ✅ |

---

## Card 08 INDICADORES — KPIs

Todos los casos: TIR motor (snapshot exitScenario.tir) == TIR sim @ 10A. Δ = 0.00pp post-fix Sesión A. ✅

| Caso | TIR motor | TIR sim | Cap rate | Cash-on-Cash | Payback | Múltiplo | Status |
|---|---|---|---|---|---|---|---|
| 0 real 0c269222 | 6.95% | 6.95% | 2.87% | -15.06% | Año 2 | 0.99x | ✅ TIR coherente. ⚠️ Payback año 2 con TIR 7% es agresivo (ver hallazgo H2). |
| 1 canónico | 9.38% | 9.38% | 4.20% | -9.94% | Año 2 | 1.48x | ✅ |
| 2 sobreprecio +20% | 2.75% | 2.75% | 3.42% | -13.71% | Año 8 | 0.63x | ✅ |
| 3 ventaja −10% | 12.90% | 12.90% | 4.72% | -7.43% | Año 1 | 2.26x | ✅ |
| 4 con extras | 10.89% | 10.89% | 4.80% | -7.05% | Año 1 | 1.90x | ✅ |
| 5 nuevo 12m | 9.97% | 9.97% | 4.40% | -8.54% | Año 2 | 1.61x | ⚠️ Cash-on-Cash usa flujoAnualPromedio incluyendo año pre-entrega con flujo=0 → diluye. |
| 6 nuevo 18m + cuotas | 10.03% | 10.03% | 4.40% | -8.18% | Año 2 | 1.62x | ⚠️ inversionInicial NO incluye cuotas pie (ver H4). |
| 7 pie 30% / 20a | 8.33% | 8.33% | 4.20% | -6.76% | Año 1 | 1.51x | ✅ |
| 8 pie 10% / 30a | 11.17% | 11.17% | 4.20% | -19.53% | Año 2 | 1.40x | ✅ Pie bajo + plazo largo → CoC muy negativo, coherente. |
| 9 blanco 24m | 9.79% | 9.79% | 4.40% | -8.44% | Año 2 | 1.56x | ⚠️ Igual que casos 5/6: cuotas pie no contadas. |

### Detalle Cap Rate

`metrics.capRate = NOI_anual / precioCLP × 100` con NOI = (rentaAnual - gastosOperativos×12). NO depende del slider. Coherente entre casos. ✅

### Detalle Cash-on-Cash sim

`flujoAnualPromedio / inversionInicial × 100` con `inversionInicial = pieCLP + 2% precioCLP`.

**Hallazgo H4:** Para entrega futura con cuotas pie (casos 6, 9), `inversionInicial` no suma `cuotasPie × montoCuota`. Pero `metrics.cashOnCash` (snapshot motor) sí lo incluye (`calcMetrics:255`). Diferencia silenciosa entre lo que muestra Card 08 (sim) vs lo que el motor calculó al guardar.

### Detalle Payback (con venta)

Itera años buscando `flujoAcum + (valorPropiedad - saldoCredito - 2%×valorPropiedad) ≥ inversionInicial`.

**Hallazgo H2 (Payback agresivo):** Para 0c269222 reporta payback año 2. Computar: en año 2, valorVenta=$162.7M, deuda=$114.6M, comisión=$3.3M → cajaSiVendiera=$44.8M. flujoAcum 2 años=−$8.4M. Total=$36.4M. Inversión=$33.1M. ¿Recupera? Sí, $36.4M ≥ $33.1M. **Pero el usuario habría aportado $33M de pie, todavía debe $114M, y el cálculo asume que vendiendo en año 2 paga 2% comisión y recibe la diferencia.** Es matemáticamente correcto, semánticamente engañoso (no es "payback" en sentido tradicional de "recuperar el pie con flujos operativos"). El nombre del KPI sugiere lo segundo.

---

## Card 09 PATRIMONIO — gráfico

### Tabla a0 vs a1 con plusvalía 4% (todos los casos)

| Caso | a0.valorDepto | a1.valorDepto | Δ valor | a0.patrimonio | a1.patrimonio | Δ patrimonio | Status |
|---|---|---|---|---|---|---|---|
| 0 real | 150.500.315 | 156.520.328 | +6.020.013 | 27.090.057 | 35.808.147 | +8.718.090 | ✅ |
| 1 canónico | 221.028.500 | 229.869.640 | +8.841.140 | 39.785.130 | 52.366.620 | +12.581.490 | ✅ |
| **2 sobreprecio** | **265.234.200** | **229.869.640** | **−35.364.560** | **47.742.156** | **17.785.495** | **−29.956.661** | ❌ **P0-H1** — chart a0 usa precioCLP, motor a1 usa vmFrancoCLP·(1+plusv). Sobreprecio crea caída artificial −$30M de a0 a a1. |
| **3 ventaja** | **198.925.650** | **229.869.640** | **+30.943.990** | **35.806.617** | **69.657.183** | **+33.850.566** | ❌ **P0-H1 inverso** — Ventaja crea salto artificial +$31M de a0 a a1. |
| 4 con extras | 221.028.500 | 229.869.640 | +8.841.140 | 39.785.130 | 52.366.620 | +12.581.490 | ✅ — extras NO suman a precioCLP (estacionamiento "incluido"). |
| 5 nuevo 12m | 221.028.500 | 229.869.640 | +8.841.140 | 39.785.130 | 48.449.447 | +8.664.317 | ⚠️ **P1-H3** — depto sube valor en a1 sin que el usuario haya tomado posesión. Saldo deuda no amortiza (correcto). |
| 6 nuevo 18m + cuotas | 221.028.500 | 229.869.640 | +8.841.140 | 39.785.130 | 48.449.447 | +8.664.317 | ⚠️ **P1-H5** — pie en cuotas durante 18m no aparece en aporteAcum. |
| 7 pie alto 30% | 221.028.500 | 229.869.640 | +8.841.140 | 61.887.980 | 75.435.823 | +13.547.843 | ✅ |
| 8 pie 10% | 221.028.500 | 229.869.640 | +8.841.140 | 17.682.280 | 29.555.719 | +11.873.439 | ✅ |
| 9 blanco 24m | 221.028.500 | 229.869.640 | +8.841.140 | 39.785.130 | 48.449.447 | +8.664.317 | ⚠️ **P1-H5** mismo. |

### Detalle composición patrimonio

| Componente | Fórmula chart | Validación |
|---|---|---|
| **a0.aporteAcum** | `pieCLP + round(precioCLP × 0.02)` | ⚠️ **H4** — no incluye `cuotasPie × montoCuota` cuando aplica. |
| **a0.valorDepto** | `precioCLP` | ❌ **H1** — debería ser `vmFrancoCLP` para coherencia con a1+. |
| **a0.patrimonioNeto** | `precioCLP − creditoInicial − 2%×precioCLP` = `pieCLP − 2%×precioCLP` | ❌ **H6** — la comisión 2% aplicada en a0 desploma patrimonio bajo el aporte. **Probablemente la "caída −$6.7M" reportada por el usuario en 0c269222: aporte $33.1M − patrimonio $27.1M = −$6.0M de "ganancia neta" en a0.** |
| **ai.aporteAcum (i≥1)** | `inversionInicial + abs(min(0, p.flujoAcumulado))` | ⚠️ — usa `inversionInicial` chart-side (sin cuotas pie). |
| **ai.valorDepto (i≥1)** | `projections[i-1].valorPropiedad` (vmFrancoCLP × (1+plusv)^i) | ✅ |
| **ai.patrimonioNeto (i≥1)** | `valorPropiedad − saldoCredito − 2%×valorPropiedad` | ⚠️ Comisión 2% sigue aplicada — coherente con escenario "vendes en año i". |
| **deudaPendiente** | `creditoInicial` (a0) o `projections[i-1].saldoCredito` (i≥1) | ✅ |

### Tooltip vs barras

Tooltip muestra los mismos valores que las barras (`valorDepto`, `deudaPendiente`, `aporteAcum`, `patrimonioNeto`). Coherente. ✅

### Footer "Patrimonio al año N"

`{ganancia} = {last.patrimonioNeto} − {last.aporteAcum}`. Correcto matemáticamente. Si ganancia < 0 muestra en signal-red. ✅

---

## Card 10 VENTA / REFINANCIAMIENTO

### Si vendes (en año plazoAnios)

| Caso | valorDepto | deudaPendiente | comisionVenta | teQueda | aporteAcum | gananciaNeta | Status |
|---|---|---|---|---|---|---|---|
| 0 real | 222.777.231 | 86.264.321 | 4.455.545 | 132.057.365 | 83.029.621 | +49.077.238 | ✅ |
| 1 canónico | 327.176.174 | 128.476.755 | 6.543.523 | 192.155.896 | 96.969.248 | +95.186.648 | ✅ |
| 2 sobreprecio | 327.176.174 | 154.172.106 | 6.543.523 | 166.460.545 | 138.333.954 | +28.126.591 | ✅ |
| 3 ventaja | 327.176.174 | 115.629.079 | 6.543.523 | 205.003.572 | 76.286.901 | +128.716.671 | ✅ |
| 4 con extras | 327.176.174 | 128.476.755 | 6.543.523 | 192.155.896 | 82.903.325 | +109.252.571 | ✅ |
| 5 nuevo 12m | 327.176.174 | 134.345.335 | 6.543.523 | 186.287.316 | 90.163.346 | +96.123.970 | ⚠️ aporteAcum no incluye cuotas pie (no aplican aquí, pie al contado). |
| 6 nuevo 18m | 327.176.174 | 137.182.246 | 6.543.523 | 183.450.405 | 88.418.408 | +95.031.997 | ❌ **H5** — `aporteAcum` no incluye 18 cuotas × $2.45M = $44.2M. La gananciaNeta está sobreestimada en ~$44M. |
| 7 pie alto | 327.176.174 | 94.447.108 | 6.543.523 | 226.185.543 | 118.521.274 | +107.664.269 | ✅ |
| 8 pie mínimo | 327.176.174 | 159.318.429 | 6.543.523 | 161.314.222 | 78.317.682 | +82.996.540 | ✅ |
| 9 blanco 24m | 327.176.174 | 139.956.155 | 6.543.523 | 180.676.496 | 89.683.533 | +90.992.963 | ❌ **H5** — 24 cuotas × $1.84M = $44.2M no contadas en aporteAcum. |

### Si refinancias (LTV 70% default)

| Caso | valorDepto | nuevoCredito (70%) | deudaPendiente | liquidez | Status |
|---|---|---|---|---|---|
| 0 real | 222.777.231 | 155.944.062 | 86.264.321 | +69.679.741 | ✅ |
| 1 canónico | 327.176.174 | 229.023.322 | 128.476.755 | +100.546.567 | ✅ |
| 2 sobreprecio | 327.176.174 | 229.023.322 | 154.172.106 | +74.851.216 | ✅ |
| 3 ventaja | 327.176.174 | 229.023.322 | 115.629.079 | +113.394.243 | ✅ |
| 4 con extras | 327.176.174 | 229.023.322 | 128.476.755 | +100.546.567 | ✅ |
| 5 nuevo 12m | 327.176.174 | 229.023.322 | 134.345.335 | +94.677.987 | ✅ |
| 6 nuevo 18m | 327.176.174 | 229.023.322 | 137.182.246 | +91.841.076 | ✅ |
| 7 pie alto | 327.176.174 | 229.023.322 | 94.447.108 | +134.576.214 | ✅ |
| 8 pie mínimo | 327.176.174 | 229.023.322 | 159.318.429 | +69.704.893 | ✅ |
| 9 blanco 24m | 327.176.174 | 229.023.322 | 139.956.155 | +89.067.167 | ✅ |

### "Te queda" vs Patrimonio neto Card 09

| Caso | teQueda Card 10 | patrimonio_a10 Card 09 | Δ |
|---|---|---|---|
| 0 real | 132.057.365 | 132.057.365 | 0 ✅ |
| 1 canónico | 192.155.896 | 192.155.896 | 0 ✅ |

teQueda = valorDepto − deudaPendiente − 2%×valorDepto = patrimonioNeto Card 09. **Coherente.** ✅

### Pre-entrega bloquea Venta/Refi

Si `plazoAnios × 12 ≤ mesesPreEntrega`, muestra mensaje "No puedes vender ni refinanciar antes de la entrega". ✅ Implementado en `results-client.tsx:618`.

---

## Cross-section Sim vs Cards 02-06

| Métrica | Card 02 (motor snapshot) | Card 08 (sim) | Validación |
|---|---|---|---|
| TIR | `results.exitScenario.tir` (10A fijo) | `kpis.tir` (sliders del usuario) | ✅ Coinciden cuando slider en defaults (0.00 pp en 10/10 casos). Divergen al mover slider — esperado y correcto. |
| Aporte mensual / Flujo neto | `metrics.flujoNetoMensual` | sim flujoYr1/12 ≈ promedio | ⚠️ El flujo año 1 sim (vía calcProjections) puede diferir levemente del motor.flujoNetoMensual×12 por inflación de mantención/contribuciones. Δ ≤ $30K para 0c269222. Aceptable. |
| Cap rate | `metrics.capRate` | mismo | ✅ Sim importa directo del snapshot. |
| Inversión inicial | `metrics.pieCLP + cuotasPieTotal + 2%×precioCLP` (motor) | `pieCLP + 2%×precioCLP` (sim chart, sim KPIs) | ❌ **H4** — sim no suma cuotasPie. Para entrega futura con cuotas pie, sim subestima inversión y sobreestima múltiplo/CoC. |

---

## Casos especiales

### Entrega futura — modelado del motor

`calcProjections` (lib/analysis.ts:412-484):
- `mesesPreEntrega = calcMesesHastaEntrega(input)` calcula desde fecha actual.
- En cada año, los meses ≤ mesesPreEntrega NO suman flujo (pre-delivery).
- Saldo crédito: `mesesCredito = max(0, mesFin − mesesPreEntrega)`. Si pre-entrega completa, saldo = creditoCLP (no amortiza).
- **valorPropiedad SÍ crece año a año desde a1 con plusvalía** — incluso pre-entrega. Decisión de motor: el depto ya tiene plusvalía aunque el usuario no haya firmado. ⚠️ debate semántico.

### Pie en cuotas — NO modelado en projections

El motor en `calcMetrics:255` calcula `cuotasPieTotal = cuotasPie × montoCuota` y lo suma en `capitalInvertido`. Esto afecta `cashOnCash` y `mesesPaybackPie` del snapshot.

**PERO** `calcProjections` no las reparte año por año. El chart de Patrimonio asume aporteAcum_a0 = pieCLP + 2%×precio, sin cuotas pie. Para casos 6 y 9, esto significa:

- Caso 6 (18m, $2.45M/mes = $44.2M total): en a1 el chart muestra aporteAcum=$48.6M (= pieCLP+2%). Pero el usuario ha pagado $48.6M (pie+2%) AL COMIENZO + $32.5M en cuotas durante 12 meses (año 1). Total real ≈ $81M. Chart subestima en ~$32M.
- Caso 9 (24m, $1.84M/mes = $44.2M total): mismo problema, 24 meses.

---

## Resumen de hallazgos

| ID | Prioridad | Card | Casos afectados | Resumen |
|---|---|---|---|---|
| **H1** | **P0** | 09 Patrimonio | 2, 3 (cualquier vmFranco≠precio) | Chart a0 usa precioCLP; motor a1 usa vmFrancoCLP·(1+plusv). Salto/caída artificial entre a0 y a1. |
| **H6** | **P0** | 09 Patrimonio | 0, 1, 2, 4, 7 (cualquier inmediata) | a0.patrimonioNeto = pieCLP − 2%×precio. Comisión 2% aplicada al cierre desploma patrimonio bajo aporte. Probable origen del "−$6.7M" reportado por el usuario en 0c269222. |
| **H5** | **P1** | 09 + 10 | 6, 9 (cuotas pie) | aporteAcum no incluye cuotas pie. Chart subestima aporte real durante construcción. Card 10 gananciaNeta sobreestimada. |
| **H4** | **P1** | 08 + 09 | 5, 6, 9 (entrega futura) | Sim inversionInicial = pieCLP + 2%×precio, ignora cuotasPieTotal que el motor sí cuenta. CoC sim ≠ motor.cashOnCash. |
| **H3** | **P1** | 09 | 5, 6, 9 (entrega futura) | Depto crece valor con plusvalía en a1 pese a que el usuario no ha tomado posesión. |
| **H2** | **P2** | 08 | 0, 1, 4, 5-9 | Payback nombre engañoso: KPI cuenta venta hipotética cada año, no payback operativo del pie. |
| **H7** | **P2** | 07 | Todos | plusvaliaBase del SimulationProvider (PLUSVALIA_HISTORICA[comuna]) ≠ default slider 4%. Inconsistencia visual: el "base" expuesto difiere del default que usa motor. |
| **H8** | **P2** | 09 | Todos | Comisión 2% aplicada uniformemente a todos los años en cálculo patrimonio neto. Sugerente: "vendes en año i". Pero el slider plazo es "horizonte de proyección", no "año de venta". |

**Total: 8 hallazgos.**
- P0: 2 (H1, H6)
- P1: 3 (H5, H4, H3)
- P2: 3 (H2, H7, H8)
