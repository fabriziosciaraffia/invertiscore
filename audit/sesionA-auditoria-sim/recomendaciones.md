# Sesión A auditoría sim — Recomendaciones de fix

**Fecha:** 2026-05-05
**Hallazgos:** ver `hallazgos.md` (8 totales: 2 P0 · 3 P1 · 3 P2)

Cada recomendación incluye: qué cambiar, ubicación, esfuerzo, riesgo, tests.

---

## P0-H6 (recomendado primero) — Quitar comisión 2% del cálculo de patrimonio en años intermedios

**Bug:** chart muestra patrimonio_a0 < aporteAcum_a0 por la fórmula `pieCLP − 2%×precioCLP`. El usuario percibe pérdida visual al firmar.

**Fix mínimo (recomendado):**

En `src/app/analisis/[id]/results-client.tsx`, cambiar la fórmula del chart Patrimonio para que la comisión 2% se aplique SÓLO en el último año del horizonte (donde la pregunta "si vendes" es relevante), no en cada año.

```diff
// chart a0 (línea 356)
- patrimonioNeto: precioCLP - creditoInicial - Math.round(precioCLP * 0.02),
+ patrimonioNeto: precioCLP - creditoInicial,

// chart ai (línea 371) — aplicar comisión sólo si i === plazoAnios
- const comision = Math.round(p.valorPropiedad * 0.02);
+ const esUltimoAnio = i === plazoAnios;
+ const comision = esUltimoAnio ? Math.round(p.valorPropiedad * 0.02) : 0;
  rows.push({
    ...
    patrimonioNeto: p.valorPropiedad - p.saldoCredito - comision,
  });
```

**Alternativa más conservadora (sólo a0):** quitar comisión en a0, mantener en años intermedios. Cubre el bug reportado pero deja la inconsistencia conceptual (el slider de plazo es horizonte, no año de venta).

**Esfuerzo:** 5 min. **Riesgo:** bajo. La línea visualmente sube. Footer "Patrimonio al año plazoAnios" se mantiene igual (por construcción: el último año sí descuenta comisión). 

**Tests:** validar que `chart.a0.patrimonioNeto = pieCLP` (sin restar 2%); que `chart[plazoAnios].patrimonioNeto = valorVenta − deudaPendiente − 2%×valorVenta` (= `teQueda` de Card 10).

---

## P0-H1 — Unificar base a0 con motor (`vmFrancoCLP` en a0)

**Bug:** chart a0 usa `precioCLP`, motor a1+ usa `vmFrancoCLP × (1+plusv)`. Cualquier `valorMercadoFranco ≠ precio` genera salto/caída artificial entre a0 y a1.

**Fix recomendado (alineado con el motor):**

Usar `vmFrancoCLP` en a0, igual al punto de partida del motor. Esto interpreta a0 como "valor de mercado al día 1" — coherente con cómo el motor proyecta a partir de a1.

```diff
// results-client.tsx:337-377 (chartData useMemo)
- const precioCLP = metrics.precioCLP ?? 0;
+ const precioCLP = metrics.precioCLP ?? 0;
+ const vmFrancoUF = metrics.valorMercadoFrancoUF ?? 0;
+ const vmFrancoCLP = vmFrancoUF > 0 ? vmFrancoUF * valorUF : precioCLP;

  rows.push({
    anio: 0,
-   valorDepto: precioCLP,
-   patrimonioNeto: precioCLP - creditoInicial - Math.round(precioCLP * 0.02),
+   valorDepto: vmFrancoCLP,
+   patrimonioNeto: vmFrancoCLP - creditoInicial,  // (combina con fix H6)
    ...
  });
```

**Implicación:** para sobreprecio, a0 muestra el valor real Franco (más bajo que precio pagado) — refleja "compraste sobre el valor real, ya partiste con ventaja negativa". Es honesto. Para ventaja, a0 muestra valor real (más alto que precio) — refleja "compraste con ventaja, partiste arriba".

**Alternativa (menos invasiva):** mostrar dos líneas/barras: "Lo que pagaste" (precioCLP, sólo a0) y "Valor proyectado" (vmFranco × plusv^i, todos los años). Más transparente pero requiere rediseño visual del componente.

**Esfuerzo:** 15 min (fix simple) o 1-2h (rediseño dual). **Riesgo:** medio. Cambia visualmente la primera barra. Requiere validar contra los casos de sobreprecio/ventaja en producción.

**Tests:** caso 2 (sobreprecio) post-fix → a0.valorDepto = $221M (vmFranco), a1 = $229M (vmFranco × 1.04). Δ = +$8.8M coherente con plusvalía. ✅

**Riesgo asociado a H8 (comisión cada año):** si se aplica fix H6 (sólo último año), entonces patrimonio_a0 = vmFrancoCLP − creditoCLP. Para sobreprecio: $221M − $212M = $9M (vs aporteAcum $58M = perdida visual −$49M). Es coherente con la pérdida real de ventaja negativa. Para ventaja: $229M − $159M = $70M (vs aporte $44M = ganancia +$26M ya en a0). También coherente.

---

## P1-H5 — Distribuir cuotas pie como flujo mensual durante pre-entrega

**Bug:** chart subestima aporteAcum por ~$30-44M para deptos en blanco con cuotas pie.

**Fix recomendado:**

Modelar las cuotas pie como flujo negativo mensual durante pre-entrega en `calcProjections`. Esto las hace aparecer en `flujoAnual` y por tanto en `flujoAcumulado` → `aporteAcum` chart sí las suma.

```diff
// lib/analysis.ts:425-456 (loop calcProjections)
  for (let anio = 1; anio <= plazoVenta; anio++) {
    const mesInicio = (anio - 1) * 12 + 1;
    const mesFin = anio * 12;
    ...
    let flujoAnual = 0;
    for (let m = mesInicio; m <= mesFin; m++) {
      if (m <= mesesPreEntrega) {
-       // Pre-delivery: sin flujo operativo
+       // Pre-delivery: cuota pie es aporte de capital — la modelamos como flujo
+       // negativo para que aparezca en aporteAcum del chart de patrimonio.
+       if (input.cuotasPie > 0 && m <= input.cuotasPie) {
+         flujoAnual -= input.montoCuota;
+       }
      } else {
        flujoAnual += flujoMes.flujoNeto;
      }
    }
```

**Implicación:** `metrics.cashOnCash` y `mesesPaybackPie` deben revisarse; ya cuentan cuotas pie en `capitalInvertido` — para evitar doble cuenta, también ajustar `flujoAcumuladoPlazo` en kpi-calculations o cambiar el cálculo de `inversionInicial` chart-side.

**Alternativa más limpia:** sumar `cuotasPie × montoCuota` directamente en `inversionInicial` (chart, sim KPIs y motor) sin tocar projections. Una sola línea por consumidor.

```diff
// kpi-calculations.ts:42 + results-client.tsx:341 + venta-refi:573
- const inversionInicial = pieCLP + Math.round(precioCLP * 0.02);
+ const cuotasPieTotal = input.cuotasPie > 0 ? input.cuotasPie * input.montoCuota : 0;
+ const inversionInicial = pieCLP + Math.round(precioCLP * 0.02) + cuotasPieTotal;
```

(Requiere pasar `input` al chart; hoy lo tiene.)

**Esfuerzo:** 30 min (alternativa más limpia). **Riesgo:** medio. Hay que validar contra el snapshot motor (`metrics.cashOnCash` que ya cuenta `cuotasPieTotal`).

**Tests:** caso 6 → aporteAcum_a0 chart = $48.6M + $44.2M = $92.8M. Card 10 gananciaNeta correctamente reducida. metrics.cashOnCash igual al snapshot motor.

---

## P1-H4 — Sim `inversionInicial` debe sumar cuotas pie (consecuencia de H5)

**Resuelto por H5 alternativa más limpia.** Si se aplica el fix de sumar `cuotasPieTotal` en `inversionInicial` consistente entre chart, kpi-calculations y venta-refi, este hallazgo desaparece.

---

## P1-H3 — Plusvalía durante pre-entrega

**Bug:** chart muestra valorDepto creciendo año a año durante pre-entrega aunque el usuario no posee el activo.

**Decisión de modelo (no hay fix puro, requiere decisión):**

**Opción A — Mantener (status quo):** asumir que la promesa fija el precio y la plusvalía hasta entrega es del comprador. Justificación: en el mercado chileno los compradores sí pueden ceder la promesa con utilidad. Documentar y dejar.

**Opción B — Aplazar plusvalía hasta entrega:** valorPropiedad permanece en `vmFrancoCLP` durante pre-entrega; plusvalía empieza desde el año post-entrega.

```diff
// lib/analysis.ts:460
-   valorPropiedad *= (1 + plusvaliaAnual);
+   if (mesFin > mesesPreEntrega) {
+     valorPropiedad *= (1 + plusvaliaAnual);
+   }
```

**Esfuerzo:** 5 min B. **Riesgo:** bajo, pero CAMBIA el motor — re-validar todas las TIRs de análisis con entrega futura.

**Recomendación:** discutir con el equipo de producto antes de aplicar. La opción A está OK si se acompaña con una nota visual ("plusvalía durante construcción").

---

## P2-H2 — Renombrar "Payback (con venta)"

**Fix:** cambiar el label en results-client.tsx:298.

```diff
- label="Payback (con venta)"
+ label="Año óptimo de venta"
```

O mejor: documentar tooltip como "Año en que vender te deja en ganancia neta (recuperaste pie + flujo aportado)". El KPI tal cual es útil; el nombre confunde.

**Esfuerzo:** 2 min. **Riesgo:** nulo.

---

## P2-H7 — `plusvaliaBase` ≠ default slider

**Fix:** alinear o eliminar inconsistencia.

**Opción A:** eliminar `plazoBase` y `plusvaliaBase` del `SimulationProvider` (no se usan). Hoy son referencia muerta en context.

**Opción B:** usar `plusvaliaBase` como state inicial del slider (=`useState(plusvaliaBase ?? 4.0)`). Implica que análisis de Santiago arrancan con plusvalía −1.1% por default. Cambia el "default" del producto — discutible.

**Recomendación:** Opción A (eliminar referencia muerta). El default del producto es 4% por motor (`PLUSVALIA_ANUAL`), debe matchear el slider.

**Esfuerzo:** 5 min. **Riesgo:** nulo (es código no consumido).

---

## P2-H8 — Comisión 2% cada año en chart

**Resuelto por H6** (aplicar comisión sólo en el último año).

---

## Orden de fix sugerido

1. **H6 + H1 juntos** (P0, mismo lugar — `chartData` useMemo). 20 min.
2. **H5 alternativa limpia** (P1, suma cuotasPieTotal en inversionInicial). 30 min.
3. **H7** (cleanup, eliminar plazoBase/plusvaliaBase muertos). 5 min.
4. **H2** (renombrar Payback). 2 min.
5. **H3** (decisión de producto, no fix técnico inmediato).
6. **H4** queda resuelto por H5.
7. **H8** queda resuelto por H6.

**Total esfuerzo P0+P1:** ~55 min código + tests/validación con probe.

---

## Validación post-fix sugerida

Re-ejecutar `audit/sesionA-auditoria-sim/_probe.ts` con el código fixeado. Casos esperados:

| Caso | a0 patrimonio (post H6+H1) | a1 patrimonio | Δ a0→a1 | aporteAcum a1 (post H5) |
|---|---|---|---|---|
| 0 real | $30.1M (= pie) | $39.0M | +$8.9M (= plusvalía sobre vmFranco) | $33.1M (sin cambios — sin cuotas pie) |
| 2 sobreprecio | $9.0M (vmFranco − creditoInicial) | $22.4M | +$13.4M | $58.4M sin cambios |
| 6 cuotas pie | $44.2M | $52.9M | +$8.7M | $48.6M + $29.5M = $78.1M post-H5 |

Convergencia esperada: TIR motor == TIR sim sigue 0.00pp en los 10 casos (post-H5 NO debería romperlo si se elige alternativa limpia).
