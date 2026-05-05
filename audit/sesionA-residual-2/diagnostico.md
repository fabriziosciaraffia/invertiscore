# Sesión A residual #2 — Caso 0c269222 (UF_CLP no propagado al motor)

**Fecha:** 2026-05-05
**Análisis auditado:** `0c269222-3ccb-4cba-969c-cc86ab30982a` (Santiago)
**Reapertura del usuario:** slider plazo confirmado en 10. TIR sim sigue mostrando 6,5% mientras card 04 muestra 7,0%.

---

## TL;DR (3 líneas)

**Encontré el path divergente. Es un bug pre-existente al fix Sesión A: el cliente nunca propaga `UF_CLP` al motor.** El módulo `lib/analysis.ts` mantiene `let UF_CLP = 38800` mutado vía `setUFValue()`, pero esa función sólo se llama en API routes server-side. El cliente en `results-client.tsx` actualiza un `UF_CLP` LOCAL del propio TSX (línea 44) sin propagarlo al motor — entonces cuando `dynamicProjections` corre en el browser, `calcProjections` recomputa precioCLP, creditoCLP, valorPropiedad y mantención partiendo de UF=38800 (default) mientras los `metrics` que recibió son los del JSON, calculados server-side con UF=40187. Resultado: TIR sim = **6,51% → "6,5%"** exacto al reportado.

> **El fix Sesión A es correcto y completo para su scope (motor↔motor).** El bug residual no estaba en el motor ni en el clon que se eliminó: estaba en cómo el cliente inicializa el motor. Es un bug independiente, pre-existente, que el fix anterior expuso al hacer que la sim usara `calcProjections` del motor (antes el clon usaba un `UF_CLP` local del TSX que sí se actualizaba).

---

## Reproducción del valor exacto

Probe `audit/sesionA-residual-2/_probe.ts` (se elimina al cerrar sesión). Ejecuta exactamente la cadena del cliente y mide el efecto del UF_CLP del motor.

```
UF_CLP usado al guardar (derivado de metrics.precioCLP / input.precio): 40187
UF_CLP del módulo motor (default cuando no se llama setUFValue):       38800

--- Condición A: UF_CLP motor = 40187 (server-side equivalente) ---
  motor.exitScenario.tir fresh: 6.95
  sim TIR (calcProjections + calcExitScenario, plazo=10, plusv=4%): 6.95
  Δ vs saved: 0.00 pp                                                 ✅ coherente

--- Condición B: UF_CLP motor = 38800 (cliente, sin propagar UF) ---
  sim TIR (calcProjections con UF_CLP motor=38800, metrics saved con 40187):
    6.51  →  toFixed(1) = "6.5"                                       ❌ EXACTO al reportado
  Δ vs saved: -0.44 pp
```

El bucket de display "6,5%" cae en [6,45%, 6,55%). El probe da 6,51% — clavado en ese rango.

---

## El path completo (qué lee qué, dónde está la divergencia)

### Sim TIR @ 10 AÑOS — `IndicadoresRentabilidadContent`

1. **Render:** `results-client.tsx:268-275`
   ```tsx
   <KPICard label={`TIR @ ${plazoLabel}`} value={fmtPct(kpis.tir)} ... />
   ```
   - `fmtPct` = `(v) => v.toFixed(1) + "%"`. No transforma.
2. **`kpis.tir`:** `results-client.tsx:247-250`
   ```ts
   const kpis = useMemo(
     () => calculateKPIs({ projections, metrics, plazoAnios, plusvaliaAnual }),
     [projections, metrics, plazoAnios, plusvaliaAnual]
   );
   ```
   - `projections` prop = `dynamicProjections` (recomputado en cliente).
   - `metrics` prop = `m` = `normalizeMetrics(results?.metrics)` (snapshot server, intacto).
   - `plazoAnios` = `useSimulation().plazoAnios` = `horizonYears` (state inicial `useState(10)`, `results-client.tsx:2483`).
   - `plusvaliaAnual` = `plusvaliaRate` (state inicial `useState(4.0)`, `results-client.tsx:2489`).
3. **`dynamicProjections`:** `results-client.tsx:2756-2764` (post-fix Sesión A)
   ```ts
   const dynamicProjections = useMemo(() => {
     if (!results || !m || !inputData) return results?.projections ?? [];
     return calcProjections({
       input: inputData,
       metrics: m,
       plazoVenta: 30,
       plusvaliaAnual: plusvaliaRate / 100,
     });
   }, [results, m, inputData, plusvaliaRate]);
   ```
4. **`calcProjections` (motor `lib/analysis.ts:401`)** — usa `UF_CLP` del módulo motor:
   ```ts
   const precioCLP = input.precio * UF_CLP;            // ← UF_CLP del motor
   const creditoCLP = precioCLP * (1 - input.piePct / 100);
   const vmFrancoCLP = (input.valorMercadoFranco || input.precio) * UF_CLP; // ← UF_CLP del motor
   ```
5. **`UF_CLP` motor** está declarado en `lib/analysis.ts:26`:
   ```ts
   let UF_CLP = 38800;
   export function setUFValue(value: number) { UF_CLP = value; }
   export function getUFCLP(): number { return UF_CLP; }
   ```
   - `setUFValue` se llama **únicamente** en server (`/api/analisis/route.ts:49`, `/api/analisis/recalculate/route.ts:90`).
   - **Nunca se llama desde el cliente**.

### `UF_CLP` del archivo TSX (no es el del motor)

`results-client.tsx:44`:
```ts
let UF_CLP = 38800;
```

Y en el componente cliente (línea ~2480):
```ts
if (ufValue) UF_CLP = ufValue;
```

Esa asignación actualiza la variable LOCAL del archivo TSX, no la del motor. La usan otros cálculos inline del archivo (gráficos, projData, etc.), pero `calcProjections` importa el `UF_CLP` del motor — son dos variables distintas con el mismo nombre.

### Card 04 "Largo plazo" — comparación

1. **Render:** `MiniCard` con `numero="04"` (línea 2167) → getter `getPunchline` (línea 1796–1811).
2. **Variable leída:** `results.exitScenario.tir` directo del JSON (no recompute).
3. **Plazo:** snapshot server con `anios=10`.
4. **Función origen:** `calcExitScenario` server-side al guardar, con UF_CLP=40187 propagado vía `setUFValue` en la API route. Resultado guardado en DB.

Como card 04 lee del JSON sin recomputar, **no le afecta el bug del UF_CLP cliente**. Por eso la divergencia es **asimétrica**: card 04 = 7,0% (correcto), sim = 6,5% (recompute con UF erróneo).

---

## Tabla solicitada

| Path | Valor mostrado | Plazo usado | Inputs usados | Función origen |
|---|---|---|---|---|
| **DOM "6,5%"** (sim KPICard hero "TIR @ 10 AÑOS") | 6,51% → "6,5%" | `plazoAnios=10` (de `useSimulation()` ← `horizonYears`) | `metrics` SAVED (UF=40187) + `dynamicProjections` recomputadas con UF_CLP motor=**38800** (default, nunca propagado en cliente) | `calculateKPIs` → `calcExitScenario(placeholderInput={}, metrics, projections, 10)` → `tir` |
| **`SimulationContext.kpis.tir`** (interno) | 6,51 | `plazoAnios=10` | mismo que arriba | mismo |
| **`calcExitScenario` fresh con state actual del context** (probe controlado, motor UF=38800) | 6,51 | 10 | `metrics` SAVED + `calcProjections({UF=38800})` | `calcExitScenario` runtime cliente |
| **`calcExitScenario` fresh con UF correcto** (probe condición A, motor UF=40187) | 6,95 | 10 | `metrics` SAVED + `calcProjections({UF=40187})` | `calcExitScenario` runtime cliente |
| **Card 04 "TIR 7,0%"** | 6,95 → "7,0%" | 10 (snapshot) | `results.exitScenario.tir` JSON, sin recompute | `calcExitScenario` server-side al guardar (UF=40187 vía `setUFValue` en API route) |

---

## Conclusión

**Hipótesis ganadora:** path divergente `(e) UF_CLP del motor no propagado en el cliente`. La hipótesis (b) plazo distinto fue correcta sólo en magnitud aritmética accidental — confundió porque "plazo=12 con UF correcto" da el mismo display que "plazo=10 con UF=38800".

**Por qué no se manifestó en Caso A (Providencia 7710a017) durante Sesión A:**

El probe de `sesionA-fix/_probe.ts` invocaba `runAnalysis` y `calcProjections` con el motor en su default UF_CLP=38800 (ambos lados consistentes), y comparaba motor↔sim. Como ambos lados tomaban metrics de la **misma** ejecución fresh con UF=38800, no había mismatch entre metrics y projections. La condición que dispara el bug es: **metrics persistidas con UF_servidor + projections recomputadas con UF_default-cliente**. Eso sólo se da al consumir un análisis ya guardado, en el browser, sin que el cliente propague la UF al motor.

Una verificación rápida: el caso 7710a017 guardó con UF≈40001 (`220.005.500 / 5500`). Si abres ese análisis en el browser hoy con UF actual también propagado al motor, debería mostrar diferencia similar. La razón por la que el user previamente reportó 0,00pp en Providencia probablemente fue porque ese caso lo evaluó con probe sintético, no abriéndolo en el browser.

**Por qué la diferencia es 0,44pp y no más:**

UF saved 40187 vs UF motor cliente 38800 → ratio 1,0357 (~3,57% sobreestimación de precioCLP server).
- valorPropiedad año 10: $222M (server) vs $215M (cliente) → −3,5%
- saldoCredito año 10: $86,3M vs $83,3M → −3,4%
- Mantención y dividendo recompute con precioCLP/creditoCLP más bajos → cuotas anuales menos negativas

Las dos fuerzas se compensan parcialmente: valorVenta más bajo baja TIR; saldoCredito más bajo y dividendo menor suben TIR. Net: −0,44 pp. La magnitud variará por caso pero será proporcional al gap entre UF actual (cliente sin propagar = 38.800 fijo) y UF de guardado.

---

## Path divergente identificado, NO se fixea (per instrucción)

**Archivo:** `src/app/analisis/[id]/results-client.tsx`
**Línea aprox:** 2480-2481
**Lo que falta:**
```ts
if (ufValue) UF_CLP = ufValue;            // actualiza el UF local del TSX (✓)
// FALTA: setUFValue(ufValue);             // propagar al motor para que
                                          // calcProjections / calcExitScenario
                                          // computen con la UF correcta.
```

`setUFValue` ya está exportada desde `@/lib/analysis`. Bastaría importarla y llamarla en el mismo bloque donde se actualiza `UF_CLP` local.

**Riesgo del fix:** mínimo. `setUFValue` es la API pública diseñada exactamente para esto, ya usada por las API routes. No introduce nueva superficie. El motor ya manejaba la mutación antes; el cliente simplemente no la estaba activando.

**Efecto colateral esperado del fix:** todos los análisis abiertos en el browser después de este fix mostrarán números de simulación coherentes con el snapshot server, en lugar del −0,44 pp residual. Ningún backfill necesario.

**Hallazgo colateral fuera de scope:**

La duplicación de `let UF_CLP = 38800` con el mismo nombre en dos archivos (`lib/analysis.ts:26` y `results-client.tsx:44`) es la raíz conceptual del bug — dos sources of truth con el mismo nombre. El fix mínimo es propagar; el refactor de fondo sería eliminar el `UF_CLP` local del TSX y siempre leer del motor. Ese refactor está fuera de scope.

---

## Pregunta abierta

¿Procedo con el fix de 1 línea (`setUFValue(ufValue)` en results-client.tsx después del `UF_CLP = ufValue;`)? O ¿preferís el refactor de fondo que elimina el `UF_CLP` duplicado del TSX?
