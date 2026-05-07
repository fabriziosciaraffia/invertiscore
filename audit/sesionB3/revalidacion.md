# Sesión B3 — Re-validación de hallazgos diferidos

**Fecha:** 2026-05-05
**Origen:** auditoría amplia simulación cerró H1, H4, H5, H6 en commits P0+P1 (`db8d5e5`) e Item 9 (`f6f4066`). Quedaron diferidos H2, H3, H7, H8.

**Método:** inspección directa de código (sin probe), spot-check sobre los 10 casos sintéticos.

## Resumen

| Hallazgo | Status | Esfuerzo fix | Prioridad |
|---|---|---|---|
| H2 — "Payback (con venta)" engañoso | PARCIAL | S | P3 (cosmético, ya disambigua "(con venta)") |
| H3 — Plusvalía pre-entrega | VIVO | S | P1 |
| H7 — plusvalíaBase UI ≠ default motor | PARCIAL | M | P2 |
| H8 — Comisión 2% recurrente | MURIÓ | — | — |

## H2 — "Payback (con venta)" engañoso

**Status:** **PARCIAL.** El cálculo es correcto y el label hoy disambigua explícitamente.

**Evidencia:**
- Label en `results-client.tsx:301`: `"Payback (con venta)"` — el paréntesis "(con venta)" disambigua respecto al payback de cash-flow operativo.
- Subtítulo: `"Año en que recuperas toda la inversión"` (línea 303).
- Tooltip: `"Año desde la compra en que el patrimonio neto acumulado iguala lo que aportaste, contando la venta del depto."` (línea 306).
- Cálculo en `kpi-calculations.ts:62-71`: itera año a año sumando `flujoAcumIter + cajaSiVendiera` hasta superar `inversionInicial`. Coherente con el label.
- `metrics.mesesPaybackPie` (payback puro de flujo) existe en motor (`analysis.ts:262`) y en typesheet, pero **no se renderiza como KPI visible** — sólo aparece referenciado en `TOOLTIPS["Payback Pie"]` sin componente que lo use.

**Análisis:** la queja original era "el label engaña al usuario que asume payback tradicional". Hoy el paréntesis "(con venta)" + tooltip lo aclara. El bug semántico está mitigado por UX. La sugerencia original ("Cuándo te conviene vender", "Año en que recuperas pie + venta") sigue siendo más explícita pero el label actual no es incorrecto.

**Acción recomendada:** dejar como está. Si en una iteración futura se quisiera optimizar, considerar:
- Renombrar a `"Año de recuperación con venta"` (más explícito).
- Exponer `mesesPaybackPie` como segundo KPI complementario (`"Payback flujo"`) cuando flujo>0, para que el usuario vea ambas perspectivas.

**Esfuerzo:** S (1-2 strings + tooltip). **Prioridad:** P3.

## H3 — Plusvalía pre-entrega

**Status:** **VIVO.** El motor sigue aplicando plusvalía desde a1 sin esperar la entrega.

**Evidencia (`analysis.ts:466-467`):**
```ts
// Plusvalía always from purchase date
valorPropiedad *= (1 + plusvaliaAnual);
```

El comentario "always from purchase date" confirma la decisión de modelo actual (deliberada). En cambio:
- `flujoAnual` solo se acumula post-entrega (línea 458-462: `if (m <= mesesPreEntrega) /* sin flujo operativo */`).
- `saldoCredito` solo cuenta desde delivery (línea 469-472: `mesesCredito = max(0, mesFin - mesesPreEntrega)`).

**Casos afectados:** 5 (entrega 12m), 6 (entrega 18m + cuotas pie), 9 (entrega 24m). Para esos casos, el chart Card 09 muestra valorDepto y patrimonioNeto creciendo con plusvalía durante construcción cuando el usuario aún no ha firmado escritura.

**Spot-check caso 5** (entrega 12m, plusvalía 4%):
- a0: vmFranco × 1.0 = $221M (semilla del motor, post-fix H1).
- a1: vmFranco × 1.04 = $229.9M (chart muestra crecimiento $8.6M durante construcción).

**Decisión de modelo abierta:**
- Modelo A (actual): plusvalía desde firma de promesa, asumiendo el comprador "es dueño del derecho" desde día 1.
- Modelo B (alternativa): plusvalía solo post-entrega, refleja imposibilidad de liquidar antes de escriturar.
- Modelo C (compromiso): mostrar dos curvas — "plusvalía contractual" vs "plusvalía liquidable".

**Coherencia con UI:** Card 10 ya bloquea venta cuando `plazoAnios ≤ entregaAnio` con mensaje "no puedes vender antes de la entrega" — Card 09 dice "ganaste $8.6M" y Card 10 dice "no puedes liquidar". Inconsistencia narrativa.

**Acción recomendada:** decisión de producto requerida. Si Modelo B → cambiar 1 línea en `calcProjections` (plusvalía aplica solo cuando `mesFin > mesesPreEntrega`) + validar coherencia chart + Card 10. Si Modelo A → documentar explícitamente en tooltip Card 09.

**Esfuerzo:** S (1 línea código + decisión de producto). **Prioridad:** P1 (afecta semántica visible para casos 5, 6, 9).

## H7 — plusvalíaBase UI ≠ default motor

**Status:** **PARCIAL.** El bug semántico sigue (3 sources of truth), pero hoy no se manifiesta visualmente al usuario.

**Evidencia:**
- Motor (`analysis.ts:41`): `const PLUSVALIA_ANUAL = 0.04` → 4% flat para todos los análisis.
- Slider sim (`results-client.tsx:2521`): `useState(4.0)` → arranca en 4.0% para todos los análisis.
- Context (`results-client.tsx:3466`): `plusvaliaBase = PLUSVALIA_HISTORICA[comuna]?.anualizada ?? PLUSVALIA_DEFAULT.anualizada`.
  - Santiago: -1.1%, Providencia: 3.0%, Maipú: 4.1%, Vitacura: 2.7%, etc.
- IA / zone-insight (`zone-insight/route.ts:619-664`): pasa `plusvaliaAnual: plusvaliaHistorica.anualizada` al modelo IA — distinto del 4% que usa el motor.

**Lo que CAMBIÓ desde la auditoría original:**
- `plusvaliaBase` se pasa al `SimulationProvider` pero `SliderSimulacion.tsx` **no la renderiza** (sin `plusvaliaBase` referenciado en el componente). Por tanto el usuario hoy NO ve un "valor base distinto del slider" — la trampa visual original no se ha materializado.

**Lo que sigue VIVO:**
- IA recibe plusvalía histórica (3.0% Providencia, -1.1% Santiago, etc.) en su prompt, mientras el motor proyectó con 4%. La narrativa IA puede contradecir la proyección.
- Si en el futuro se expone `plusvaliaBase` como "reset al base" o "ancla histórica" en el slider, la confusión renacería.

**Acción recomendada:** decisión de producto. Opciones:
1. **Unificar a 4% flat** (eliminar `plusvaliaBase` del context, IA recibe 4%).
2. **Unificar a histórica** (motor `PLUSVALIA_ANUAL` se reemplaza por `PLUSVALIA_HISTORICA[comuna]?.anualizada ?? PLUSVALIA_DEFAULT.anualizada`, slider arranca igual).
3. **Mantener divergencia** — documentar en CLAUDE.md que la IA usa histórica (descripción de zona) y el motor usa 4% flat (proyección base optimista).

**Esfuerzo:** M (depende de la opción; 2 toca varios sitios + validar regresión). **Prioridad:** P2.

## H8 — Comisión 2% en cada año

**Status:** **MURIÓ con fix H6** (commit `db8d5e5`).

**Evidencia post-fix:**
- Card 09 chart Patrimonio (`results-client.tsx:381, 400`): `patrimonioNeto = valorDepto - saldoCredito` — **sin** comisión 2% año a año. ✅
- Card 09 chart a0 (línea 381): `vmFrancoCLP - creditoInicial` — sin comisión. ✅
- Card 10 Venta (`results-client.tsx:614-615`): `comisionVenta = valorDepto * 0.02; teQueda = valorDepto - deudaPendiente - comisionVenta` — comisión aplicada UNA sola vez en `lastProy` (año `plazoAnios`). ✅
- `sensScenarios` (línea 2870): `comision = valorVenta * 0.02` — UNA sola vez en horizonte `h`. ✅
- `projData` chart (línea 3179): `gastosCierre = precioCLP * 0.02` — son gastos de COMPRA (notaría, CBR), no comisión venta; aplicado UNA vez al inicio. ✅
- `kpi-calculations.ts:65` (cálculo payback): itera `cajaSiVendiera = valorPropiedad - saldoCredito - 2%×valorPropiedad` para cada año del payback. Esto **es correcto** — cada iteración representa un escenario hipotético "si vendieras ESTE año" (no es comisión recurrente, es escenario condicional por iteración).

**Conclusión:** ningún consumidor aplica comisión 2% recurrente. La sospecha del plan se confirma: H8 murió en P0+P1 fix de Card 09.

**Acción recomendada:** ninguna. Cerrado.

## Cierre

**Vivos pendientes:** H3 (P1, S), H7 (P2, M).
**Parciales (mitigado pero no perfecto):** H2 (P3, S).
**Muertos:** H8.

Recomendación priorización siguiente sesión: H3 primero (P1 + decisión simple de modelo + S esfuerzo). H7 puede esperar hasta que producto decida la convención canónica de plusvalía.
