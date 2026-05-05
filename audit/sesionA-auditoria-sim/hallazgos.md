# Sesión A auditoría sim — Hallazgos detallados

**Fecha:** 2026-05-05
**Total:** 8 hallazgos (2 P0 · 3 P1 · 3 P2)

---

## P0-H1 — Chart a0 usa `precioCLP`, motor a1+ usa `vmFrancoCLP × (1+plusv)` → salto/caída artificial

**Severidad:** P0 (afecta correctness visible)

**Casos afectados:** 2 (sobreprecio +20%) y 3 (ventaja −10%); cualquier análisis donde `valorMercadoFranco ≠ input.precio`.

**Evidencia:**

| Caso | a0.valorDepto | a1.valorDepto | Δ esperado (precio×plusv 4%) | Δ real (chart) |
|---|---|---|---|---|
| 2 sobreprecio | 265.234.200 | 229.869.640 | +10.609.368 | **−35.364.560** ❌ |
| 3 ventaja | 198.925.650 | 229.869.640 | +7.957.026 | **+30.943.990** ❌ |

Caso 2 (sobreprecio): el chart muestra al usuario que el valor de su depto **CAE $35M** entre a0 y a1, pese a aplicar plusvalía +4%. Razón:
- `a0.valorDepto = precioCLP = 265.234.200` (lo que pagó: 6600 UF)
- `a1.valorDepto = projections[0].valorPropiedad = vmFrancoCLP × 1.04 = 5500 × 40187 × 1.04 = 229.869.640`

Caso 3 (ventaja): inverso — el valor SALTA +$31M entre a0 y a1 sin razón explicable visualmente.

**Causa raíz:**
Inconsistencia conceptual entre `chart a0` y `calcProjections`. El chart toma a0 como "lo que pagaste" (precioCLP) y motor toma a1 como "valor real Franco proyectado" (vmFrancoCLP × plusv). Mezcla dos métricas distintas.

**Ubicación código:**
- `src/app/analisis/[id]/results-client.tsx:355` — chart push a0 con `valorDepto: precioCLP`.
- `src/lib/analysis.ts:418-419` — calcProjections inicia `valorPropiedad = vmFrancoCLP`.

**Impacto usuario:**
Para análisis con sobreprecio, la primera barra muestra el depto "valiendo lo que pagó" y la segunda lo "rejusta a precio Franco". Se interpreta como "perdí valor inmediatamente al comprar" — no es lo que el motor está modelando (plusvalía siempre positiva año a año). Confunde el mensaje del producto.

---

## P0-H6 — Comisión 2% aplicada en a0 desploma patrimonio bajo aporte

**Severidad:** P0 (probable origen del reporte original del usuario "Δ −$6.7M en 0c269222")

**Casos afectados:** Todos los casos con entrega inmediata. Visible especialmente cuando pieCLP ≈ 2%×precio (pies bajos).

**Evidencia (caso 0c269222):**

| Componente | Valor |
|---|---|
| pieCLP (lo que pone) | $30.100.063 |
| 2% precioCLP (gastos cierre) | $3.010.006 |
| `aporteAcum_a0` | $33.110.069 |
| 2% precioCLP (¿comisión venta?) | $3.010.006 |
| `patrimonioNeto_a0 = pieCLP − 2%×precio` | $27.090.057 |
| **Δ patrimonio − aporte en a0** | **−$6.020.012** |

**El usuario reportó "patrimonio cae a0→a1 en −$6.7M". Lo que en realidad ve es que en a0 el patrimonio aparece $6M POR DEBAJO del aporte acumulado** — interpretado naturalmente como "perdiste $6M al firmar".

Misma fórmula:
```ts
// chart a0 (línea 356)
patrimonioNeto: precioCLP - creditoInicial - Math.round(precioCLP * 0.02)
            = pieCLP - 2%×precioCLP
// chart ai (línea 371)
patrimonioNeto: p.valorPropiedad - p.saldoCredito - Math.round(p.valorPropiedad * 0.02)
```

**Razón:** la fórmula resta una "comisión 2%" de venta hipotética en CADA año, incluido a0. Conceptualmente el chart asume "si vendieras hoy a0, te queda esto", pero a0 es el día del cierre — el usuario no va a vender el mismo día que compró.

**Causa raíz:**
La fórmula proviene de `calcExitScenario` (`gananciaNeta = valorVenta − saldoCredito − 2%×valorVenta`). Aplicada al chart año a año genera una pérdida visual artificial en a0.

**Ubicación código:** `src/app/analisis/[id]/results-client.tsx:356`.

**Impacto usuario:**
La línea de patrimonio neto en el gráfico arranca POR DEBAJO de la barra de aporte acumulado. Visualmente sugiere que el usuario "ya empezó perdiendo" desde el día 1. Es matemáticamente coherente con el escenario "si vendes inmediato", pero no es la pregunta que el chart contesta (el chart muestra evolución de patrimonio en el tiempo).

---

## P1-H5 — Pie en cuotas no aparece en `aporteAcum`

**Severidad:** P1 (afecta correctness en entrega futura con financiamiento de cuotas pie)

**Casos afectados:** 6 (entrega 18m + cuotas $2.45M/mes), 9 (entrega 24m + cuotas $1.84M/mes).

**Evidencia (caso 6, 18m × $2.45M ≈ $44.2M total cuotas pie):**

| Año | Aporte real esperado | Aporte chart | Subestimación |
|---|---|---|---|
| a0 | pie+2% = $48.6M | $48.6M | ✅ |
| a1 (12m construcción) | $48.6M + $29.5M cuotas = $78.1M | $48.6M | **−$29.5M** |
| a2 (entrega + 6m construcción + 6m operación) | ~$78.1M + flujo neg | $51.6M | **−$26.5M** |

**Causa raíz:** `calcProjections` no modela `cuotasPie × montoCuota` como flujo durante construcción. Sólo modela el flujo operativo post-entrega.

`metrics.cashOnCash` (snapshot motor) sí incluye `cuotasPieTotal` en `capitalInvertido`. Pero el chart usa `inversionInicial = pieCLP + 2%×precio` directamente en el componente, sin llamar al motor.

**Ubicación código:**
- Chart: `src/app/analisis/[id]/results-client.tsx:341` — `inversionInicial` no suma cuotasPie.
- Card 10 venta: `src/app/analisis/[id]/results-client.tsx:573` — mismo problema.
- Sim KPIs: `src/lib/analysis/kpi-calculations.ts:42` — mismo.

**Impacto usuario:**
Para deptos en blanco/verde con pie en cuotas, el chart sugiere que el aporte total queda en $48M cuando en realidad el usuario está pagando ~$80M (pie + cuotas en cuotas). La gananciaNeta de Card 10 está sobreestimada en ~$30-44M.

---

## P1-H4 — Sim `inversionInicial` ignora `cuotasPieTotal` que el motor sí cuenta

**Severidad:** P1

**Casos afectados:** 5, 6, 9 (cualquier estadoVenta="futura" con cuotasPie>0).

**Evidencia:**

```ts
// kpi-calculations.ts:42 (sim)
const inversionInicial = metrics.pieCLP + Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);

// analysis.ts:255 (motor en calcMetrics)
const cuotasPieTotal = mesesPreEntrega > 0 ? (input.cuotasPie > 0 ? input.cuotasPie : mesesPreEntrega) * (input.montoCuota > 0 ? input.montoCuota : (pieCLP / (input.cuotasPie || mesesPreEntrega))) : 0;
const capitalInvertido = pieCLP + cuotasPieTotal + gastosCompra;
const cashOnCash = capitalInvertido > 0 ? ((flujoNetoMensual * 12) / capitalInvertido) * 100 : 0;
```

Motor cuenta cuotas pie en `capitalInvertido` (que se usa para `cashOnCash` snapshot y `mesesPaybackPie`). Sim no las cuenta. Discrepancia silenciosa.

**Impacto usuario:**
Para casos 5/6/9, el `Cash-on-Cash @ 10A` Card 08 (sim) puede divergir del cashOnCash que el motor reportó. Para 0c269222 no aplica (entrega inmediata).

---

## P1-H3 — Patrimonio crece pre-entrega pese a no tener posesión

**Severidad:** P1 (semántico)

**Casos afectados:** 5, 6, 9 (entrega futura).

**Evidencia (caso 5, entrega 12m con plusvalía 4%):**

| Año | valorDepto chart | saldoCredito | patrimonioNeto |
|---|---|---|---|
| a0 | 221.028.500 | 176.822.800 | 39.785.130 |
| a1 (mid-construcción) | 229.869.640 | 176.822.800 (sin amortizar) | 48.449.447 |
| a2 (post-entrega) | 239.064.426 | 172.905.627 | 61.377.510 |

En a1 el usuario no ha firmado escritura (entrega aún a la mitad). Sin embargo el chart muestra el depto valiendo $229M y patrimonio creciendo $8.6M — implica plusvalía sobre activo no poseído.

**Causa raíz:** `calcProjections:460` aplica plusvalía cada año desde a1, sin considerar fecha de entrega. La línea de tiempo de plusvalía empieza siempre desde día 1 del análisis, no desde entrega.

**Decisión de modelo:** debate. Si el contrato de promesa de compra fija el precio hoy, la plusvalía hasta la entrega "se gana" para el comprador (revende la promesa antes de escriturar). Pero típicamente el usuario no puede liquidar esa plusvalía hasta tener escritura.

**Impacto usuario:**
La línea de patrimonio durante pre-entrega muestra un crecimiento que el usuario no puede materializar. Si el plazo del slider es ≤ pre-entrega, Card 10 (Venta/Refi) bloquea con mensaje "no puedes vender antes de la entrega" — la coherencia entre chart y card 10 es parcial: 09 dice "ganaste" y 10 dice "no puedes vender".

---

## P2-H2 — "Payback (con venta)" engañoso

**Severidad:** P2 (UX/naming)

**Casos afectados:** Todos.

**Evidencia (0c269222):**
- Payback Card 08 reporta "Año 2".
- Cálculo año 2: flujoAcumIter = −$8.4M, valorVenta = $162.7M, deuda = $114.6M, comisión = $3.3M → cajaSiVendiera = $44.8M. Total = $44.8M − $8.4M = $36.4M ≥ inversionInicial $33.1M ✅.
- **Pero** el "payback" tradicional es "años hasta que el FLUJO operativo cumulado iguale la inversión". Aquí flujoAcum es negativo durante todos los años — nunca paga el pie con flujo. El KPI cuenta venta hipotética = inversión recuperada vendiendo, no por flujos.

**Recomendación:** renombrar el KPI a algo como "Cuándo te conviene vender" o "Año en que recuperas pie + venta". El nombre actual implica un sentido financiero que el cálculo no respeta.

---

## P2-H7 — `plusvaliaBase` UI ≠ default slider 4%

**Severidad:** P2 (cosmético / inconsistencia conceptual)

**Casos afectados:** Todos los análisis con comuna en `PLUSVALIA_HISTORICA`. Para Santiago: anualizada=−1.1%, slider arranca en 4.0%.

**Evidencia:**
- `SimulationProvider` (results-client.tsx:3497) recibe `plusvaliaBase = PLUSVALIA_HISTORICA[comuna]?.anualizada ?? PLUSVALIA_DEFAULT.anualizada`.
- State del slider: `useState(4.0)` (results-client.tsx:2489).
- Motor `calcProjections` default: `PLUSVALIA_ANUAL = 0.04` (analysis.ts:44).

Tres valores diferentes para "default plusvalía":
- UI muestra `plusvaliaBase` como referencia (no se usa hoy en ningún componente, está en context pero sin lectura).
- Slider arranca en `4.0`.
- Motor usa `0.04` (mismo que slider).

**Impacto:** confusión conceptual. Si en el futuro se expone `plusvaliaBase` como "reset al base" en el slider, el usuario vería un valor distinto al default.

---

## P2-H8 — Comisión 2% en cada año del chart Patrimonio

**Severidad:** P2 (semántico)

**Casos afectados:** Todos.

**Evidencia:** `chart.ai.patrimonioNeto = valorDepto − saldoCredito − 2%×valorDepto` para todo i ≥ 0.

El slider de plazo es **horizonte de proyección**, no **año de venta**. Sin embargo, el cálculo asume que en cada año hay una venta hipotética (con su comisión 2%). Coherente con el escenario de Card 10, pero la línea de patrimonio NO debería restar comisión en años intermedios — sólo en el año final (donde se pregunta "qué te queda si vendes").

**Sugerencia:** restar comisión sólo en el año plazoAnios, o crear una segunda línea "Patrimonio si vendes" que sí incluya comisión año a año. La línea principal "Patrimonio neto" debería ser `valorDepto − saldoCredito` (sin comisión).

---

## Resumen ejecutivo

**Top 3 críticos (P0/P1):**

1. **P0-H6 — Comisión en a0 desploma patrimonio.** Probable origen del reporte original del usuario "Δ −$6.7M en 0c269222". Fix: NO aplicar comisión 2% en a0; opcionalmente sólo aplicarla en el año de venta (plazoAnios).

2. **P0-H1 — `precioCLP` (a0) vs `vmFrancoCLP` (a1+) inconsistente.** Para deptos con sobreprecio o ventaja, el chart muestra saltos/caídas artificiales entre a0 y a1. Fix: usar la misma base en a0 y a1+ (recomendado: `vmFrancoCLP`, alineado con el motor).

3. **P1-H5 — Cuotas pie ausentes del aporteAcum.** Para entrega futura con financiamiento del pie, el chart subestima ~$30-44M. Fix: distribuir cuotasPie × montoCuota como flujo mensual durante pre-entrega; o sumarlas a aporteAcum incrementalmente cada año pre-entrega.

**No críticos:** H4, H3, H2, H7, H8.

**No detectados:** ningún bug de TIR, cap rate, sliders rangos, refi LTV. Esos están todos correctos post-fix Sesión A.
