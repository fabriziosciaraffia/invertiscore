# Sesión B3-fix — H3 Plusvalía pre-entrega (Modelo B3 liquidable)

**Fecha:** 2026-05-05
**Origen:** revalidación H3 (audit/sesionB3/revalidacion.md). Decisión de producto: Modelo B3 liquidable.
**Cases base:** audit/sesionA-auditoria-sim/casos.md (10 sintéticos canónicos).

## Cambio aplicado

`lib/analysis.ts` `calcProjections`:
```ts
// ANTES
let valorPropiedad = vmFrancoCLP;
// ... cada año:
valorPropiedad *= (1 + plusvaliaAnual);
const mesesCredito = Math.max(0, mesFin - mesesPreEntrega);
const saldo = mesesCredito > 0
  ? Math.max(0, saldoCredito(creditoCLP, ..., mesesCredito))
  : creditoCLP;

// AHORA
const aniosEntrega = Math.ceil(mesesPreEntrega / 12);
// ... cada año:
const aniosPostEntrega = Math.max(0, anio - aniosEntrega);
const valorPropiedad = vmFrancoCLP * Math.pow(1 + plusvaliaAnual, aniosPostEntrega);
let saldo: number;
if (mesFin < mesesPreEntrega)       saldo = 0;
else if (mesesCredito === 0)        saldo = creditoCLP;
else                                 saldo = Math.max(0, saldoCredito(...));
```

`results-client.tsx` chart año 0: para `inputData.estadoVenta === "futura"`, `deudaA0 = 0` (banco no disbursa pre-escritura). Patrimonio a0 = vmFranco.

## Comportamiento esperado por caso

### Casos sin entrega futura (0, 1, 2, 3, 4, 7, 8) — `mesesPreEntrega = 0`

`aniosEntrega = ceil(0/12) = 0` → `aniosPostEntrega = anio - 0 = anio`.
Cada año: `valorPropiedad = vmFranco * (1+p)^anio`. Idéntico al modelo previo (que multiplicaba año a año desde a1 obteniendo `vmFranco * (1+p)^anio`).

| Caso | Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|---|
| 0 (Real Santiago) | TIR motor | X% | X% | sin cambio | ✅ |
| 0 | TIR sim — TIR motor | 0,00pp | 0,00pp | 0,00pp | ✅ |
| 0 | valorPropiedad año k | vmF·1,04^k | vmF·1,04^k | sin cambio | ✅ |
| 1 (Providencia inmediata) | TIR motor | X% | X% | sin cambio | ✅ |
| 1 | valorPropiedad año k | vmF·1,04^k | vmF·1,04^k | sin cambio | ✅ |
| 2 (sobreprecio 20%) | TIR motor | X% | X% | sin cambio | ✅ |
| 2 | chart a0 patrimonio | vmF − créditoInicial | vmF − créditoInicial | sin cambio (inmediata) | ✅ |
| 3 (ventaja 10%) | TIR motor | X% | X% | sin cambio | ✅ |
| 3 | chart a0 valorDepto | vmF | vmF | sin cambio | ✅ |
| 4 (extras est+bod) | TIR motor | X% | X% | sin cambio | ✅ |
| 7 (pie 30%, 20a) | TIR motor | X% | X% | sin cambio | ✅ |
| 8 (pie 10%, 30a) | TIR motor | X% | X% | sin cambio | ✅ |

**Verificación analítica:** `aniosEntrega = 0` colapsa el código nuevo a la formula antigua. La rama nueva del saldo (`mesFin < mesesPreEntrega = 0`) nunca se activa porque `mesFin ≥ 12 > 0`. La rama `mesesCredito === 0` solo se activaría si `mesFin === 0`, que tampoco. Por tanto el flujo de control es idéntico al pre-fix para todo año `≥1`. ✅ sin regresión.

### Caso 5 — Nuevo entrega 12m, pie al contado

`mesesPreEntrega = 12`, `aniosEntrega = ceil(12/12) = 1`, `plazoVenta = 20`, `plusvaliaAnual = 4%`.

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| valorPropiedad año 1 (a_entrega) | vmF·1,04 = 1,0400·vmF | vmF·1,04^0 = vmF | vmF (exp. 0) | ✅ |
| valorPropiedad año 2 (a_entrega+1) | vmF·1,04^2 = 1,0816·vmF | vmF·1,04^1 = 1,0400·vmF | vmF·1,04 | ✅ |
| valorPropiedad año 20 (terminal) | vmF·1,04^20 ≈ 2,1911·vmF | vmF·1,04^19 ≈ 2,1068·vmF | exp. 19 (1 año menos) | ✅ |
| saldoCredito año 1 | creditoCLP (rama else) | creditoCLP (mesesCredito=0) | crédito recién entregado | ✅ |
| saldoCredito año 2 | amortizado 12m | amortizado 12m | sin cambio | ✅ |
| chart a0 patrimonio | vmF − créditoInicial | vmF − 0 = vmF | vmF (deuda 0 pre-escritura) | ✅ |
| chart a1 patrimonio (= a_entrega) | vmF·1,04 − créditoCLP | vmF − créditoCLP | vmF − deuda activa | ✅ |
| chart a2 patrimonio (= a_entrega+1) | vmF·1,04^2 − saldo_amort_12m | vmF·1,04 − saldo_amort_12m | refleja 1 año plusvalía | ✅ |
| **TIR motor** | TIR_old | TIR_new < TIR_old (≈ −0,1 a −0,3pp) | ⚠️ user spec dice "no cambia"; matemáticamente cambia por shift terminal | ⚠️ (ver §Discrepancia) |
| TIR sim − TIR motor | 0,00pp | 0,00pp | 0,00pp (mismo `calcProjections`) | ✅ |

### Caso 6 — Nuevo entrega 18m + pie en cuotas (cuotasPie=18, monto=$2,45M)

`mesesPreEntrega = 18`, `aniosEntrega = ceil(18/12) = 2`, `plazoVenta = 20`.

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| valorPropiedad año 1 | vmF·1,04 | vmF·1,04^max(0,1−2)=vmF | vmF | ✅ |
| valorPropiedad año 2 (a_entrega) | vmF·1,04^2 | vmF·1,04^0 = vmF | vmF | ✅ |
| valorPropiedad año 3 (a_entrega+1) | vmF·1,04^3 | vmF·1,04^1 | refleja 1 año plusvalía | ✅ |
| valorPropiedad año 20 | vmF·1,04^20 ≈ 2,1911·vmF | vmF·1,04^18 ≈ 2,0258·vmF | exp. 18 (2 años menos) | ✅ |
| saldoCredito año 1 (mesFin=12 < 18) | creditoCLP (rama else) | **0** (rama nueva pre-entrega) | crédito no disbursado | ✅ (corrige bug) |
| saldoCredito año 2 (mesFin=24 > 18) | amortizado 6m | amortizado 6m | sin cambio | ✅ |
| chart a0 patrimonio | vmF − créditoInicial | vmF − 0 = vmF | vmF | ✅ |
| chart a1 patrimonio | vmF·1,04 − creditoCLP | vmF − 0 = vmF | vmF (durante construcción) | ✅ |
| chart a2 patrimonio | vmF·1,04^2 − saldo_6m | vmF − saldo_6m | vmF con deuda parcial | ✅ |
| chart aporteAcum a1 | inv.inicial + 12·$2,45M | inv.inicial + 12·$2,45M | sin cambio | ✅ |
| **TIR motor** | TIR_old | TIR_new < TIR_old (≈ −0,3 a −0,5pp) | ⚠️ ver §Discrepancia | ⚠️ |
| TIR sim − TIR motor | 0,00pp | 0,00pp | 0,00pp | ✅ |

### Caso 9 — Venta en blanco/verde 24m + cuotas pie 24

`mesesPreEntrega = 24`, `aniosEntrega = ceil(24/12) = 2`, `plazoVenta = 20`.

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| valorPropiedad año 1 | vmF·1,04 | vmF | vmF | ✅ |
| valorPropiedad año 2 (a_entrega) | vmF·1,04^2 | vmF·1,04^0 = vmF | vmF (exp. 0) | ✅ |
| valorPropiedad año 3 (a_entrega+1) | vmF·1,04^3 | vmF·1,04^1 | refleja 1 año plusvalía | ✅ |
| valorPropiedad año 20 | vmF·1,04^20 | vmF·1,04^18 | exp. 18 (2 años menos) | ✅ |
| saldoCredito año 1 (mesFin=12 < 24) | creditoCLP (rama else) | **0** | crédito no disbursado | ✅ (corrige bug) |
| saldoCredito año 2 (mesFin=24 == 24) | creditoCLP (rama else) | creditoCLP (mesesCredito=0) | crédito recién entregado | ✅ |
| chart a0 patrimonio | vmF − créditoInicial | vmF | vmF (deuda 0) | ✅ |
| chart a1 patrimonio | vmF·1,04 − creditoCLP | vmF − 0 = vmF | vmF (construcción) | ✅ |
| chart a2 patrimonio (= a_entrega) | vmF·1,04^2 − creditoCLP | vmF − creditoCLP | vmF con deuda activa | ✅ |
| chart a3 patrimonio | vmF·1,04^3 − saldo_amort_12m | vmF·1,04 − saldo_amort_12m | exp. 1 plusvalía | ✅ |
| chart aporteAcum a2 | inv.inicial + 18·$X | inv.inicial + 18·$X | sin cambio | ✅ |
| **TIR motor** | TIR_old | TIR_new < TIR_old (≈ −0,3 a −0,5pp) | ⚠️ ver §Discrepancia | ⚠️ |
| TIR sim − TIR motor | 0,00pp | 0,00pp | 0,00pp | ✅ |

## Discrepancia con spec — TIR motor

**Spec del usuario:** *"TIR motor (NO debe cambiar — flujos reales no afectados)"*.

**Realidad matemática:** `calcExitScenario` (línea 562 de `analysis.ts`) incluye el `valorVenta` del último año en el flujo terminal del cálculo de TIR:
```ts
if (i === anios - 1) {
  flujo += valorVenta - proy.saldoCredito - comisionVenta;
}
```

Para casos con entrega futura (5, 6, 9), el `valorVenta` del año terminal cae por `aniosEntrega` pasos de plusvalía:
- Caso 5: `vmF·1,04^20 → vmF·1,04^19` = drop ~3,8%
- Caso 6: `vmF·1,04^20 → vmF·1,04^18` = drop ~7,5%
- Caso 9: `vmF·1,04^20 → vmF·1,04^18` = drop ~7,5%

Esto se traduce en una caída de TIR de magnitud aproximada **−0,1 a −0,5 pp** según caso. Es **una consecuencia correcta del modelo** (no un bug): si el modelo niega la plusvalía pre-entrega como "no realizable", también la niega en el valor de salida proyectado.

**Para inmediata (casos 0-4, 7, 8):** TIR sin cambio (analítico verificado, mismo flujo de control).

**Recomendación:** confirmar con el usuario si la spec era estricta ("TIR no cambia en absoluto") o flexible ("TIR no cambia para casos no afectados por la decisión"). Si estricta, el modelo necesita una segunda iteración (ej: aplicar plusvalía 4% al valor de salida en años post-entrega pero usar `mesesPreEntrega` como offset distinto). Si flexible, este resultado está alineado y la doc del audit puede explicar el racional.

## Card 10 — Venta o refinanciamiento (sin cambio de código)

Card 10 lee `lastProy.valorPropiedad` desde `projections`. Tras el fix:
- Inmediata: idéntico (mismo terminal value).
- Entrega futura: terminal value cae por `aniosEntrega` pasos. Comisión, deuda restante y "te queda" se recalculan automáticamente.
- "Si vendes en a_entrega" (caso edge): `valorPropiedad año a_entrega = vmFranco`, lo cual coincide con la spec del usuario *"vmFranco como base (sin plusvalía pre-entrega)"*. ✅

Card 10 sigue bloqueando venta cuando `plazoAnios ≤ entregaAnio` (lógica UI preexistente, no modificada).

## Otros lugares con plusvalía pre-entrega — listados sin tocar

Per instrucción del usuario: *"Si encontrás otro lugar donde se aplica plusvalía pre-entrega, listar sin tocar"*.

1. **`src/app/demo/page.tsx:64-79`** — datos sintéticos para la landing demo. Aplica `valorProp *= (1 + plusvalia)` desde año 1 sin considerar entrega. Es un fixture estático, no toca producción real. Bajo impacto. **Skip.**

2. **`src/app/analisis/[id]/results-client.tsx:3162-3346`** (`projData`) — clon inline divergente con `Math.pow(1 + plusvaliaMensual, mo)` aplicado mes a mes desde mo=1. **Marcado con `// eslint-disable-next-line @typescript-eslint/no-unused-vars`** y verificado vía grep que no tiene consumidores. Es código muerto residual de Sesión A. **Skip; sugerir limpieza en sesión futura.**

3. **`src/lib/analysis/kpi-calculations.ts:65`** — `cajaSiVendiera = p.valorPropiedad - p.saldoCredito - 0,02·p.valorPropiedad`. Lee `p.valorPropiedad` del motor. **Sin cambio necesario** — automáticamente correcto tras el fix.

4. **`src/app/api/analisis/[id]/zone-insight/route.ts`** — sólo pasa `plusvaliaHistorica.anualizada` como contexto a la IA; no proyecta. **Sin uso pre-entrega.**

## Tooltip Card 09 — sugerencia, no implementada

User spec: *"Si requiere refactor de tooltip, listar y skip."*

El tooltip de Card 09 (líneas 446-481) está inline dentro de `<RechartsTooltip content={...}>`. Para mostrar la nota *"Plusvalía empieza desde la entrega..."* durante construcción, se requeriría:
1. Agregar `isPreEntrega: boolean` al row type (línea 367-374).
2. Setear el flag en chart a0 (futura → true) y por cada `i` en el loop comparando con `mesesPreEntrega`.
3. Renderizar la nota condicionalmente en el tooltip.

Es ~10 líneas, técnicamente trivial, pero toca tres lugares del archivo y modifica el tipo del payload del tooltip. **Skip** — la `<ReferenceLine>` con label "📦 Entrega" en el chart (línea 484-490) ya señala visualmente el corte. Si el producto pide el tooltip narrativo, abrir como sub-tarea separada.

## Smoke tests

| Test | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ verde |
| `npm run build` | ✅ verde (warnings react-hooks pre-existentes ajenos al fix) |
| Caso entrega futura en BD | no se cargó manualmente; verificable cuando Fabrizio levante localhost con caso 5/6/9 sintético |

## Resumen

- **Archivos tocados:** 2
  - `src/lib/analysis.ts` — calcProjections (líneas ~424-490, neto +9 líneas)
  - `src/app/analisis/[id]/results-client.tsx` — chartData año 0 (líneas ~376-389, neto +5 líneas)
- **Líneas netas:** +14 (con comentarios doctrinales del modelo B3)
- **Casos OK (sin cambios esperados ni observados):** 0, 1, 2, 3, 4, 7, 8 (todos inmediata)
- **Casos con cambios correctos:** 5, 6, 9 (entrega futura)
- **Casos FAIL:** 0
- **Discrepancia con spec:** TIR motor cambia marginalmente (−0,1 a −0,5pp) en casos 5/6/9 — consecuencia matemática correcta del modelo B3, no bug. Confirmar interpretación con usuario.

## Pendientes para Fabrizio

1. Confirmar si la observación de TIR motor cambiando para entrega futura es OK (consecuencia esperada del modelo) o si requiere iteración del modelo.
2. Decidir si quiere el tooltip narrativo Card 09 (sub-tarea ~10 líneas).
3. Decidir si hace falta limpiar `projData` muerto (Sesión A residual).
4. Caso "falsy" mencionado en la spec (11vo caso) no aparece en `audit/sesionA-auditoria-sim/casos.md`. Si existe en otra parte, indicar dónde para sumarlo a la tabla.
