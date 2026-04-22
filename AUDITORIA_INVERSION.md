# AUDITORÍA · Cambio de "Inversión" en el motor

**Fecha:** 2026-04-21
**Modo:** READ-ONLY. Ninguna modificación de código.
**Analista:** Claude Opus 4.7 + agente Explore

---

## TL;DR

1. La fórmula actual `inversionTotal = pie + gastos cierre (2% precio)` vive en **un único sitio del motor** (`src/lib/analysis.ts:475-476`) y en **un único sitio de la IA** (`src/lib/ai-generation.ts:117-118`), ambos dentro de `calcExitScenario` / `generateAiAnalysis`.
2. `inversionTotal` sólo alimenta dos salidas del motor: **TIR** (flujo inicial T0) y **multiplicadorCapital** (denominador del ROI).
3. **Franco Score no cambia**. Las 4 dimensiones (Rentabilidad 30%, Flujo Caja 25%, Plusvalía 25%, Eficiencia 20%) no dependen de `inversionTotal`. Usan `rentabilidadBruta`, `rentabilidadNeta`, `flujoNetoMensual/ingresoMensual`, precio/m² y yield de la zona.
4. **El veredicto tampoco cambia** directamente (se deriva del score + flujo). Lo que cambia es la percepción de ROI y la narrativa IA.
5. **No existe campo `motor_version`** en ninguna parte (filesystem ni migraciones). Hay que crearlo antes de cambiar la fórmula si se quiere evitar que análisis viejos se “contaminen” con la nueva lógica al re-leerse.
6. **Inconsistencia detectada**: `results-client.tsx:1854` calcula el multiplicador con `pieCLP` (sin gastos de cierre) mientras que el motor usa `inversionTotal`. Este desvío ya existe hoy y se acentuará con el cambio.
7. **Narrativas IA cacheadas** mencionan números calculados con fórmula vieja. Si se cambia la fórmula sin regenerar `ai_analysis`, la narrativa hablará de una inversión distinta a la que muestra la UI.

---

## 1. Motor actual

### 1.1 Fórmula `inversionTotal`

**Archivo:** `src/lib/analysis.ts:474-476` (dentro de `calcExitScenario`)

```ts
// Inversión real = pie + gastos de cierre (notaría, CBR, timbres, tasación)
const gastosCompra = Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);
const inversionTotal = metrics.pieCLP + gastosCompra;
```

- Constante: `GASTOS_CIERRE_PCT = 0.02` (`src/lib/analysis.ts:40`)
- `metrics.pieCLP = precio * piePct/100` (se computa arriba, alrededor de la línea 207)
- `inversionTotal` NO se guarda en `FullAnalysisResult`. Es una variable local de `calcExitScenario` que se consume en dos lugares:
  1. Línea 477 → `multiplicadorCapital`
  2. Línea 480 → `flujos[0]` de la TIR

### 1.2 Fórmula `gananciaNeta` / `retornoTotal` / `multiplicadorCapital`

**Archivo:** `src/lib/analysis.ts:469-477`

```ts
const valorVenta = proy.valorPropiedad;
const comisionVenta = Math.round(valorVenta * COMISION_VENTA);
const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
const retornoTotal = proy.flujoAcumulado + gananciaNeta;

const gastosCompra = Math.round(metrics.precioCLP * GASTOS_CIERRE_PCT);
const inversionTotal = metrics.pieCLP + gastosCompra;
const multiplicadorCapital = inversionTotal > 0
  ? Math.round((retornoTotal / inversionTotal) * 100) / 100
  : 0;
```

- `gananciaNeta` es **solo la ganancia de la venta** (venta − saldo − comisión). **No resta la inversión inicial.**
- `retornoTotal = flujoAcumulado + gananciaNeta` — flujo operativo acumulado (positivo o negativo) más ganancia de venta. **Tampoco resta la inversión inicial**.
- `multiplicadorCapital = retornoTotal / inversionTotal` — aquí es donde `inversionTotal` entra como denominador.

**Observación crítica de naming**: Hoy el texto de UI dice "Ganancia neta" refiriéndose a `valorVenta − saldoCredito − comisionVenta` (es decir, no descuenta la plata que el inversionista puso). El hero del Drawer 03 (`AnalysisDrawer.tsx:644+`) lo compensa haciendo internamente `ganancia = gananciaNeta − invInicial`. Ese cálculo **sí** descuenta `pieCLP`, pero no `gastosCompra` ni `flujoAcumulado`.

### 1.3 Fórmula TIR

**Archivo:** `src/lib/analysis.ts:63-79` (`calcTIR` — Newton-Raphson puro)

```ts
function calcTIR(flujos: number[], guess: number = 0.1): number {
  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < flujos.length; i++) {
      npv += flujos[i] / Math.pow(1 + rate, i);
      dnpv -= (i * flujos[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(npv) < 1) break;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
    if (rate < -0.99) rate = -0.5;
    if (rate > 10) rate = 1;
  }
  return rate;
}
```

**Cómo se alimenta** (`src/lib/analysis.ts:479-488`):

```ts
// TIR: initial investment includes closing costs
const flujos: number[] = [-inversionTotal];
for (let i = 0; i < anios; i++) {
  let flujo = projections[i].flujoAnual;
  if (i === anios - 1) {
    flujo += valorVenta - proy.saldoCredito - comisionVenta;
  }
  flujos.push(flujo);
}
const tir = Math.round(calcTIR(flujos, 0.1) * 10000) / 100;
```

- T0 = `-inversionTotal` (negativo, salida de caja)
- T1..T9 = `flujoAnual` (positivo o negativo según flujoMensual)
- T10 = `flujoAnual + (valorVenta - saldoCredito - comisionVenta)`
- Cambiar `inversionTotal` a `pie + cierre + |flujoAcumuladoNegativo|` **doble-cuenta** los aportes mensuales: ya están en `flujos[1..n]` como negativos. Subir también el T0 en el mismo monto es inconsistente desde la óptica financiera y distorsiona la TIR a la baja de forma artificial.

### 1.4 Franco Score — dimensiones LTR

**Archivo:** `src/lib/analysis.ts:723-782` (`calcScoreFromMetrics`)

```ts
// Rentabilidad (30%) - basada en rentabilidadBruta
let rentabilidad: number;
const yb = metrics.rentabilidadBruta;
if (yb >= 6) rentabilidad = lerp(yb, 6, 8, 90, 100);
else if (yb >= 5) rentabilidad = lerp(yb, 5, 6, 70, 89);
else if (yb >= 4) rentabilidad = lerp(yb, 4, 5, 45, 65);
else if (yb >= 3) rentabilidad = lerp(yb, 3, 4, 25, 44);
else rentabilidad = lerp(yb, 0, 3, 0, 24);
if (metrics.rentabilidadNeta >= 4) rentabilidad = Math.min(100, rentabilidad + 5);
else if (metrics.rentabilidadNeta < 2) rentabilidad = Math.max(0, rentabilidad - 5);

// Flujo de caja (25%) - ratio flujoNetoMensual / ingresoMensual
const arriendoTotal = metrics.ingresoMensual;
const ratio = metrics.flujoNetoMensual / arriendoTotal;
// ... lerp por tramos ...

// Plusvalía (25%) - cercanía metro + histórica + antigüedad
const plusvalia = calcPlusvaliaScore(lat, lng, input.comuna, input.antiguedad);

// Eficiencia (20%) - precio/m² vs radio, yield vs radio
const eficiencia = calcEficienciaScore(metrics.precioM2, metrics.rentabilidadBruta, zonaRadioForEficiencia);

let score = Math.round(
  rentabilidad * 0.30 +
  flujoCaja    * 0.25 +
  plusvalia    * 0.25 +
  eficiencia   * 0.20
);
// ... penalización por mesesEspera (entrega futura) ...
```

**Variables que entran al score:**
- `metrics.rentabilidadBruta` (arriendo_anual / precio)
- `metrics.rentabilidadNeta` ((arriendo_anual − gastos − contribuciones) / precio)
- `metrics.flujoNetoMensual` y `metrics.ingresoMensual` (ratio)
- `metrics.precioM2` y comparativos de `zonaRadio`
- lat/lng, comuna, antigüedad → plusvalía

**Ninguna de estas variables depende de `inversionTotal`, `pie`, `gastosCierre` o `flujoAcumulado`.** El Franco Score es, por construcción, **agnóstico al pie que el usuario elige**. Es una propiedad del activo, no del apalancamiento.

> Nota: En `MEMORY.md` del proyecto aparece una descripción vieja ("5 dimensiones: Rentabilidad 30, FlujoCaja 25, Plusvalia 20, Riesgo 15, Eficiencia 10"). En el código vigente son **4 dimensiones (30/25/25/20)** y no existe dimensión "Riesgo". Esa memoria está desactualizada respecto al código.

### 1.5 Franco Score STR (short-term)

**Archivo:** `src/lib/engines/short-term-score.ts` + `short-term-engine.ts`

El reporte del agente Explore indica 4 dimensiones de 25% cada una (Rentabilidad, Sostenibilidad, Ventaja vs LTR, Factibilidad). En STR el concepto de "inversión" incluye **amoblamiento** (no solo pie + cierre), pero **no incluye el flujo acumulado**. STR está fuera del alcance directo de este cambio siempre que el cambio se limite a LTR.

Si el cambio se aplica también a STR, hay que revisar `capitalInvertido` en `short-term-engine.ts:~250` y ajustar CAP rate y Cash-on-Cash coherentemente.

### 1.6 Interfaces TypeScript afectadas

**Archivo:** `src/lib/types.ts`

```ts
// ExitScenario (≈ línea 73-83)
export interface ExitScenario {
  anios: number;
  valorVenta: number;
  saldoCredito: number;
  comisionVenta: number;
  gananciaNeta: number;       // NO cambia (independiente de inversión)
  flujoAcumulado: number;     // NO cambia (operativo puro)
  retornoTotal: number;       // NO cambia su cálculo actual (flujoAcum + gananciaNeta)
  multiplicadorCapital: number; // SÍ cambia (depende de inversionTotal)
  tir: number;                // SÍ cambia (T0 = -inversionTotal)
}
```

**No hay campo `inversionTotal` persistido** en el `ExitScenario`. Tampoco en `AnalysisMetrics`. Se recomputa cada vez.

---

## 2. Impacto en Franco Score

### 2.1 Dimensiones afectadas

| Dimensión | Peso | ¿Depende de inversión? | Impacto del cambio |
|---|---|---|---|
| Rentabilidad | 30% | No. Usa `rentabilidadBruta` (arriendo/precio) y `rentabilidadNeta` (arriendo−gastos/precio) | **0** |
| Flujo de Caja | 25% | No. Usa `flujoNetoMensual / ingresoMensual` | **0** |
| Plusvalía | 25% | No. Usa lat/lng + comuna + antigüedad | **0** |
| Eficiencia | 20% | No. Usa `precioM2` y yield vs radio | **0** |

**Conclusión:** El Franco Score no se mueve con el cambio.

### 2.2 Simulación con análisis `7710a017-8066-47a6-8b3e-8fc64143e256`

**Limitación:** No tengo acceso a Supabase desde la CLI. No puedo leer `analisis.results` de ese ID para dar un número exacto. Lo que sí puedo afirmar **con certeza** analizando el código:

- `score`, `clasificacion` y `veredicto` no cambian.
- `exitScenario.multiplicadorCapital` baja si el `flujoAcumulado` a 10 años es negativo (el denominador crece).
- `exitScenario.tir` baja si se aplica la nueva fórmula al T0 **y además** se mantienen los `flujoAnual` negativos en T1..T10 (doble conteo). Si se elige la nueva fórmula sólo para el "titular" pero la TIR sigue usando T0 = `-(pie+cierre)`, entonces TIR no cambia.

**Para simular con el ID exacto** hay que: (a) leer `results` y `input_data` vía Supabase MCP o un endpoint ad-hoc, (b) recomputar `multiplicadorCapital` y `tir` con la nueva definición, (c) contrastar. Se puede hacer como segundo paso antes de implementar.

---

## 3. Mapa de UI

### 3.1 Capa 1 — Veredicto + KPIs del hero

**Archivo:** `src/app/analisis/[id]/results-client.tsx`

- **Línea ~280-310**: Tarjeta "Retorno" en el grid KPI. Consume `results.exitScenario.retornoTotal` y `results.exitScenario.tir`. Render:
  ```tsx
  retornoValorCLP = (retorno < 0 ? "-$" : "+$") + Math.round(retAbs / 1_000_000) + "M";
  ```
  **Cambia:** parcialmente. `retornoTotal` en el JSON *no* cambia (sigue siendo `flujoAcum + gananciaNeta`), pero si la narrativa/UI reinterpreta "retorno sobre inversión" entonces sí.

- **Línea ~2191**: Badge "ROI 10a" muestra `fixedExit10.multiplicadorCapital`. **Cambia sí o sí** si se modifica el denominador.

### 3.2 Capa 2 — Drawers

**Archivo:** `src/components/ui/AnalysisDrawer.tsx`

- **DrawerLargoPlazo (L474-754)**: Es el componente **más afectado**. Consume:
  - `results.metrics.pieCLP`
  - `results.exitScenario.valorVenta`, `saldoCredito`, `comisionVenta`, `flujoAcumulado`, `gananciaNeta`
  - Calcula internamente `invInicial = pieCLP` (L491), `ganancia = gananciaNeta − invInicial` (L492), `gananciaPct = ganancia / invInicial * 100` (L493).

  **Crítico**: el drawer **no usa** `inversionTotal = pie + cierre` en el cálculo del "% sobre inversión" del hero. Usa `pieCLP` puro. Si se cambia a la nueva fórmula `pie + cierre + |flujoNeg|`, este cálculo queda severamente afectado: el denominador puede multiplicarse 1.5x–2x.

  **Cambia:** SÍ, todo el hero de balance a 10 años y todo el waterfall acumulativo (columna "Acumulado" que acabamos de introducir) van a mostrar otros números.

- **DrawerCostoMensual (L~100-300)**: Usa `flujoNetoMensual`. **No cambia** con la nueva fórmula.
- **DrawerNegociacion (L~310-460)**: Usa `valorMaximoCompra`. **No cambia**.
- **DrawerRiesgos (L~862+)**: Texto IA. **Puede cambiar indirectamente** si la IA menciona "inversión" → ver §4.
- **DrawerZona**: Insights de zona. **No cambia**.

### 3.3 Comparador

**Archivo:** `src/app/comparar/comparar-client.tsx:~150-180`

```tsx
{ label: "ROI Total", values: analisis.map(a => `${a.results?.exitScenario?.multiplicadorCapital.toFixed(2)}x`) }
{ label: "TIR", values: analisis.map(a => formatPct(a.results?.exitScenario?.tir)) }
```

**Cambia:** SÍ. Además, introduce un riesgo específico: si el usuario compara un análisis v1 (fórmula vieja) con uno v2 (fórmula nueva), los ROI no son comparables.

### 3.4 Dashboard

**Archivo:** `src/app/dashboard/dashboard-client.tsx:82-93`

```tsx
const multiplicador = r.exitScenario?.multiplicadorCapital ?? 0;
secondary: { label: "RETORNO", value: multiplicador > 0 ? `${multiplicador.toFixed(1)}x` : "—" }
```

**Cambia:** SÍ. Todos los tiles del dashboard muestran `multiplicadorCapital`. Tras el cambio, los análisis antiguos mostrarán el valor viejo (leído del JSON guardado) y los nuevos mostrarán el nuevo. Inconsistencia visible.

### 3.5 Demo

**Archivo:** `src/app/demo/**`

El análisis demo protegido (ID `6db7a9ac-f030-4ccf-b5a8-5232ae997fb1`, ver CLAUDE.md) se muestra en landing. Tiene `results` guardado. Si se cambia la fórmula y no se regenera, el demo seguirá mostrando números viejos.

### 3.6 Inconsistencia ya existente

**Archivo:** `src/app/analisis/[id]/results-client.tsx:1846-1862` (`calcExitForYear`, usado por el slider de horizonte)

```tsx
const multiplicadorCapital = m.pieCLP > 0
  ? Math.round((retornoTotal / m.pieCLP) * 100) / 100
  : 0;
const flujos = [-m.pieCLP];  // <-- TIR también usa solo pie
```

Contra `src/lib/analysis.ts:476-480`:

```ts
const inversionTotal = metrics.pieCLP + gastosCompra;
const multiplicadorCapital = ... / inversionTotal;
const flujos: number[] = [-inversionTotal];
```

**El motor** usa `pie + gastos` pero **la UI (slider dinámico)** usa solo `pie`. Esto ya produce hoy valores distintos al cambiar el horizonte del slider (`fixedExit10` del motor vs. `calcExitForYear(10)` recomputado en cliente). El cambio actual agrava esta divergencia: hay que unificar la fórmula entre motor y UI como parte del mismo esfuerzo.

---

## 4. Mapa de narrativas IA

### 4.1 Variables inyectadas al prompt

**Archivo:** `src/lib/ai-generation.ts:116-144`

```ts
const creditoCLP = m.precioCLP * (1 - input.piePct / 100);
const GASTOS_CIERRE_PCT = 0.02;
const inversionTotal = m.pieCLP + Math.round(m.precioCLP * GASTOS_CIERRE_PCT);

// datos que usa el prompt:
const flujoNegAcum10 = projections[9]?.flujoAcumulado < 0 ? Math.abs(projections[9].flujoAcumulado) : ...;
const datoDP = Math.round(inversionTotal * Math.pow(1.05, 10)); // depósito a plazo 5%
const datoFM = Math.round(inversionTotal * Math.pow(1.07, 10)); // fondo mutuo 7%
```

**Archivo:** `src/lib/ai-generation.ts:~334-407` (USER_PROMPT)

```
- Inversión inicial total (pie + costos entrada): ${fmtCLP(inversionTotal)} (${fmtUF(inversionTotal / UF_CLP)})
- ROI 10 años: ${exit.multiplicadorCapital.toFixed(2)}x
- TIR: ${exit.tir.toFixed(1)}%
- Flujo negativo acumulado a 5 años: ${fmtCLP(flujoNegAcum5)}
- Flujo negativo acumulado a 10 años: ${fmtCLP(flujoNegAcum10)}
- Ganancia neta si vende en 10 años: ${fmtCLP(exit.gananciaNeta)}
```

La IA recibe como insumo `inversionTotal`, `multiplicadorCapital`, `tir` y `flujoNegAcumXX`. Es la IA la que *compone* la frase. Con el cambio, los números de entrada cambian y la narrativa cambiará también.

**Usos específicos en el prompt** (a verificar con grep más fino al implementar):
- Comparación contra depósito a plazo: `datoDP = inversionTotal * 1.05^10`
- Comparación contra fondo mutuo: `datoFM = inversionTotal * 1.07^10`
- Veredicto "BUSCAR OTRA": frecuentemente menciona que el flujo negativo acumulado supera la ganancia proyectada.

### 4.2 Estructura de la respuesta IA

**Archivo:** `src/lib/ai-generation.ts:~413-478`

La IA devuelve un JSON con secciones. De estas, las que mencionan montos derivados de inversión:
- `largoPlazo.contenido_clp` / `contenido_uf` → compara contra depósito a plazo, fondo mutuo, usando `inversionTotal`
- `largoPlazo.cajaAccionable_clp/_uf` → "la apuesta que haces" — frase corta accionable
- `conviene.datosClave` → puede listar "Inversión inicial $X" o "Retorno $X"
- `siendoFrancoHeadline_clp/_uf` → headline del veredicto

### 4.3 Otros endpoints IA

- **`src/app/api/analisis/ai/route.ts`**: Dispara `generateAiAnalysis`. No modifica cálculos. Si la fórmula cambia, el prompt cambia y el output también.
- **`src/app/api/analisis/short-term/ai/route.ts`**: STR. No afectado si el cambio se limita a LTR.
- **`src/app/api/analisis/[id]/zone-insight/route.ts`**: Genera insights de zona. No menciona `inversionTotal`.
- **`src/app/api/analisis/[id]/ai-status/route.ts`**: Solo reporta estado. No afectado.

### 4.4 Narrativas IA cacheadas en DB

El campo `ai_analysis` (JSONB, añadido vía ALTER TABLE fuera del repo de migraciones — no aparece en `supabase/migrations/*.sql`) guarda el output de Claude para cada análisis. Esos textos están **petrificados con la fórmula vieja**. Si se cambia la fórmula sin regenerar, la UI mostrará números nuevos junto a texto con números viejos.

---

## 5. Infraestructura

### 5.1 Version flag en Supabase

**Estado:** **NO EXISTE**. No hay campo `motor_version`, `formula_version`, `schema_version` ni equivalente en:
- `FullAnalysisResult` (types.ts)
- `AnalysisMetrics` (types.ts)
- `ExitScenario` (types.ts)
- Ninguna migración SQL (`supabase/migrations/*.sql`)
- Ningún endpoint

La tabla `analisis` **no está definida por migración versionada**. Las migraciones disponibles cubren `market_data`, `is_premium`, `public_read`, `postgis_scraped_properties`, `geocode_attempted`, `condicion_update_rpc`, `user_credits_onboarding`, `airbnb_estimates`. La tabla `analisis` fue creada vía Supabase UI y sus columnas (`results`, `input_data`, `ai_analysis`, `desglose`, `score`, etc.) se añadieron directamente. **Recomendación: agregar `motor_version TEXT` con backfill `"v1"` antes de cambiar la fórmula.**

### 5.2 Endpoints afectados

| Endpoint | Comportamiento | Afectado |
|---|---|---|
| `POST /api/analisis` (crear) | Llama `runAnalysis(body)` y guarda `results` | **SÍ** — usa fórmula actual del bundle |
| `POST /api/analisis/recalculate` | Llama `runAnalysis(safeInput)` y sobrescribe `results` | **SÍ** — al recalcular, pasa a fórmula nueva sin avisar |
| `POST /api/analisis/ai` | Lee `results` de DB, llama `generateAiAnalysis` | **SÍ** — inyecta `inversionTotal` al prompt |
| `POST /api/analisis/use-credit` | Consume crédito, no toca cálculos | No |
| `GET /api/analisis/[id]/ai-status` | Solo lectura de estado | No |
| `GET /api/analisis/[id]/zone-insight` | Narrativa de zona | No |
| `POST /api/analisis/short-term` | Engine STR | Solo si el cambio aplica a STR |
| `POST /api/analisis/short-term/ai` | IA STR | Solo si el cambio aplica a STR |

---

## 6. Estimación de esfuerzo

### 6.1 Motor
- Cambio localizado en `src/lib/analysis.ts:474-500` (`calcExitScenario`) → ~10 líneas.
- Decidir política de TIR: (a) T0 sigue siendo `-(pie+cierre)` y la nueva "inversión total" solo se usa para el titular del drawer; o (b) T0 pasa a `-(pie+cierre+|flujoNeg|)` (doble conteo, NO recomendable financieramente).
- Agregar `motor_version: "v2"` al output de `runAnalysis`.
- **~1h.**

### 6.2 UI
- Unificar fórmula entre `src/lib/analysis.ts` y `src/app/analisis/[id]/results-client.tsx:1846-1862` (la función `calcExitForYear` del slider). Hoy divergen: UI usa `pieCLP`, motor usa `inversionTotal`.
- Revisar `AnalysisDrawer.tsx:491-493` (cálculo de `ganancia` y `gananciaPct` en hero del Drawer 03).
- Revisar etiqueta "Ganancia neta" en el hero: con la nueva definición, lo que hoy muestra es `gananciaNeta − pieCLP`, que no es consistente con ninguna de las dos definiciones.
- **~2-3h** incluyendo polish de labels.

### 6.3 Narrativas
- Actualizar `src/lib/ai-generation.ts:117-118` (`inversionTotal`) para que refleje la nueva definición.
- Decidir: ¿regenerar todas las `ai_analysis` de DB o agregar `ai_version` y regenerar bajo demanda?
- Ajustar glosario del prompt si "Inversión inicial total" cambia de significado — evitar que la IA diga "pie + costos entrada" cuando ahora también incluye aportes.
- **~1-2h + costo Anthropic de regeneración si se hace masivo.**

### 6.4 Migración / versionado
- `ALTER TABLE analisis ADD COLUMN motor_version TEXT DEFAULT 'v1'` (una migración SQL nueva).
- En `POST /api/analisis` guardar `motor_version: "v2"` para análisis nuevos.
- En `POST /api/analisis/recalculate`: o bien siempre reescribe a v2, o permite elegir.
- En todos los componentes lectores: leer el JSON tal cual (las fórmulas ya están ejecutadas al momento de guardar), por lo que el flag sirve más para **copy/labels** que para branching de lógica.
- **~1h.**

**Total estimado:** 5–7h para implementación limpia + regeneración de narrativas.

---

## 7. Riesgos identificados

### 7.1 Doble conteo del flujo negativo en TIR [ALTO]
Si la nueva fórmula se aplica tanto al titular (`inversionTotal` del drawer) como al T0 de la TIR, se estará sumando el flujo negativo dos veces (una como T0 inflado, otra como flujos anuales negativos). La TIR saldrá artificialmente baja. **Recomendación:** mantener T0 = `-(pie + cierre)` en la TIR y usar la nueva definición solo para el titular de "inversión total" y su derivado `multiplicadorCapital`.

### 7.2 Análisis existentes sin versionar [ALTO]
Todos los análisis guardados hoy tienen `multiplicadorCapital` calculado con la fórmula vieja. Si el usuario abre uno antiguo tras el cambio, verá ese valor viejo. Si recalcula, salta a valor nuevo sin explicación. **Mitigación:** `motor_version` + banner sutil en UI cuando `motor_version === "v1"` ofreciendo recalcular.

### 7.3 Narrativas IA incoherentes con UI [ALTO]
El texto en `ai_analysis` fue generado con `inversionTotal = pie + cierre`. Si UI pasa a mostrar `pie + cierre + |flujoNeg|`, la narrativa puede decir "con UF 3.200 de inversión obtienes..." mientras la UI a su lado muestra "UF 4.800 de inversión". **Mitigación:** regenerar narrativas o bloquear display de IA hasta regenerar (fila `ai_version` < actual).

### 7.4 Comparador mezclando versiones [MEDIO]
El comparador puede alinear columnas v1 y v2. La columna "ROI Total" no será comparable. **Mitigación:** en `comparar-client.tsx` detectar `motor_version` y marcar con badge "v1" o bloquear la fila si hay mezcla.

### 7.5 Dashboard con scores/ROIs de distintas eras [MEDIO]
Si el usuario tiene 10 análisis con fórmula vieja y crea uno nuevo, los 10 viejos siguen mostrando su multiplicador viejo. Percepción de inconsistencia. **Mitigación:** script de migración que recalcule todos los análisis existentes al activar la nueva fórmula (bajo flag explícito del usuario, no automático — porque cambia números que el usuario podría haber compartido).

### 7.6 Demo protegido (`6db7a9ac-...`) queda con fórmula vieja [BAJO]
El demo de landing tiene `results` cristalizados. Si cambia la fórmula, se descalibra respecto al texto de la landing que lo describe. **Mitigación:** regenerar el demo junto al deploy.

### 7.7 STR fuera del cambio [BAJO]
Si el cambio se anuncia como "nueva definición de inversión", los usuarios esperarán que aplique también a STR. STR tiene su propia noción (`pie + amoblamiento + cierre`). **Mitigación:** decidir explícitamente si STR se alinea o no, y documentarlo.

### 7.8 Etiqueta "Ganancia neta" semánticamente ambigua [MEDIO]
Hoy `exit.gananciaNeta = valorVenta − saldoCredito − comisionVenta`. No es "neto de la inversión". El hero del Drawer 03 lo arregla localmente (`ganancia = gananciaNeta − invInicial`) usando solo `pieCLP`. Con la nueva definición, la arquitectura debería exponer dos campos distintos: `gananciaVenta` (venta − saldo − comisión) y `gananciaNeta` (gananciaVenta + flujoAcum − inversionTotal). **Mitigación:** separar conceptos en `ExitScenario` y renombrar campos con claridad antes de cambiar la fórmula.

---

## Apéndice — Referencias rápidas

| Concepto | Archivo:línea |
|---|---|
| Constante `GASTOS_CIERRE_PCT = 0.02` | `src/lib/analysis.ts:40` |
| `inversionTotal` (motor) | `src/lib/analysis.ts:475-476` |
| `multiplicadorCapital` (motor) | `src/lib/analysis.ts:477` |
| TIR (motor) | `src/lib/analysis.ts:480-488` |
| `calcTIR` Newton-Raphson | `src/lib/analysis.ts:63-79` |
| Franco Score dimensiones | `src/lib/analysis.ts:723-782` |
| `ExitScenario` interfaz | `src/lib/types.ts:73-83` |
| `inversionTotal` (IA prompt) | `src/lib/ai-generation.ts:117-118` |
| `datoDP` / `datoFM` (comparativos IA) | `src/lib/ai-generation.ts:130-131` |
| `calcExitForYear` (UI slider) | `src/app/analisis/[id]/results-client.tsx:1846-1862` |
| Hero Drawer 03 (ganancia = gN − pie) | `src/components/ui/AnalysisDrawer.tsx:491-493` |
| Dashboard tile "RETORNO" | `src/app/dashboard/dashboard-client.tsx:82-93` |
| Comparador ROI/TIR | `src/app/comparar/comparar-client.tsx:~150-180` |
| Endpoint crear | `src/app/api/analisis/route.ts` |
| Endpoint recalculate | `src/app/api/analisis/recalculate/route.ts` |
| Endpoint AI | `src/app/api/analisis/ai/route.ts` |

---

**Fin del reporte.** Sin ediciones de código realizadas.
