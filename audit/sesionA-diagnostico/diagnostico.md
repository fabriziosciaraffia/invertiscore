# Sesión A — Diagnóstico de coherencia: Análisis principal vs Simulación

**Fecha:** 2026-05-05
**Caso canónico:** Providencia 7710a017-8066-47a6-8b3e-8fc64143e256 (`audit/raw-dump-7710a017-v5.json`)
**Estado:** sin tocar código de producción.

---

## TL;DR (5 líneas)

La TIR de la sección Simulación NO converge con la TIR principal incluso con sliders en defaults (plazo=10, plusvalía=4%). La causa es estructural: existe un **clon manual** de `calcProjections` dentro de `results-client.tsx` (función inline `dynamicProjections`, línea ~2754) que ha derivado del motor. Tres divergencias acumuladas: (1) el arriendo arranca de `inputData.arriendo` ignorando estacionamiento y bodega, mientras el motor parte de `metrics.ingresoMensual` que sí los suma; (2) la mantención usa `input.provisionMantencion` como base CONSTANTE, mientras el motor recalcula año a año con `getMantencionRate(antigüedad+año)` que escalona por brackets de antigüedad; (3) `calcMetrics` MUTA `input.provisionMantencion` con el valor año-1, así que aunque el front intente recomputar, ya recibe un input contaminado del motor. El bug no es un sync roto: es un fork de motor que envejeció. Hipótesis ganadora: **A + B combinadas**, con C como agravante.

---

## Paso 1 — Mapa de arquitectura

### Motor principal (server-side)

| Pieza | Path | Responsabilidad |
|---|---|---|
| `runAnalysis(input)` | `src/lib/analysis.ts:1048` | Orquesta el cálculo completo: metrics + projections + exitScenario + score |
| `calcMetrics(input)` | `src/lib/analysis.ts:201` | Calcula métricas base. **Muta `input.provisionMantencion`** en línea 211 si viene falsy |
| `calcProjections(input, metrics, 20)` | `src/lib/analysis.ts:386` | Proyecta 20 años con `PLUSVALIA_ANUAL=0.04` (constante hardcoded) |
| `calcExitScenario(input, metrics, projections, anios=10)` | `src/lib/analysis.ts:471` | Calcula TIR a 10 años usando los proyecciones recibidas |
| Persistencia | `analisis.results` (jsonb en Supabase) | El `exitScenario.tir` resultante queda congelado en DB |

### Simulación (client-side)

| Pieza | Path | Responsabilidad |
|---|---|---|
| `SimulationProvider` | `src/contexts/SimulationContext.tsx` | Context con `plazoAnios`, `plusvaliaAnual` y setters |
| `SliderSimulacion` | `src/components/analysis/SliderSimulacion.tsx` | Inputs editables: plazo (1–30 años) y plusvalía (0–15%) |
| `dynamicProjections` (inline) | `src/app/analisis/[id]/results-client.tsx:2754` | **Clon manual** de `calcProjections` con plusvalía paramétrica |
| `IndicadoresRentabilidadContent` | `results-client.tsx:239` | Renderiza KPIs invocando `calculateKPIs(...)` |
| `calculateKPIs` | `src/lib/analysis/kpi-calculations.ts:28` | Llama a `calcExitScenario` con `dynamicProjections` ya recomputadas |

### Endpoint de datos

- **Análisis principal** lee `results.exitScenario.tir` directo del JSON guardado en `analisis.results` (no recalcula en cliente).
- **Simulación** recibe `metrics`, `inputData` y reconstruye projections en `useMemo` cada vez que cambia `plusvaliaRate` (slider).

### Punch-line de la arquitectura

Dos motores. Uno autoritativo (`calcProjections` server-side, ejecutado al guardar). Otro inline en el cliente (`dynamicProjections`, ejecutado en cada render). La función final `calcExitScenario` SÍ se comparte — pero recibe inputs distintos.

---

## Paso 2 — Inventario de divergencia

| Métrica | Fuente análisis principal | Fuente simulación | ¿Misma función? | ¿Mismos inputs? |
|---|---|---|---|---|
| TIR @ plazo | `results.exitScenario.tir` (server, plazo=10 hardcoded) | `calcExitScenario(inputForSim, metrics, dynamicProjections, plazoAnios)` | ✅ misma (`calcExitScenario`) | ❌ projections distintas |
| Cap Rate | `metrics.capRate` (no depende del slider) | `metrics.capRate` (mismo) | ✅ | ✅ |
| Cash-on-Cash | `metrics.cashOnCash` (snapshot) | recomputado de `dynamicProjections.flujoAnual` promedio / inversionInicial | ❌ | ❌ |
| Payback | `metrics.mesesPaybackPie` (basado en flujoNetoMensual snapshot) | iterativo sobre `dynamicProjections` | ❌ | ❌ |
| Múltiplo @ plazo | `exitScenario.multiplicadorCapital` (server) | `calcExitScenario(...).multiplicadorCapital` (live) | ✅ | ❌ |
| Valor venta proy. | `exitScenario.valorVenta` (4% hardcoded en motor) | `calcExitScenario(...).valorVenta` (plusvalía slider) | ✅ | ❌ |
| Plusvalía constante | `PLUSVALIA_ANUAL = 0.04` en `analysis.ts:44` | `plusvaliaRate` (state, default 4.0) | — (constante vs reactiva) | ✅ en defaults |
| Plazo análisis | 10 años hardcoded en `runAnalysis:1052` | `horizonYears` (state, default 10) | — | ✅ en defaults |
| Inflación arriendo | `ARRIENDO_INFLACION = 0.035` | `arriendoGrowth = 3.5` (constante hardcoded en TSX:2493) | — | ✅ |
| Inflación gastos | `GGCC_INFLACION = 0.03` | `costGrowth = 3.0` (TSX:2494) | — | ✅ |
| Inflación dividendo CLP | `INFLACION_UF = 0.03` | `INFLACION_UF = 0.03` (redeclarado local) | — | ✅ |
| **Arriendo base año 1** | `metrics.ingresoMensual` = `arriendo + arriendoEstacionamiento + arriendoBodega` | `inputData.arriendo` (solo base, **ignora estacionamiento y bodega**) | ❌ | ❌ |
| **Mantención** | `(precioCLP × getMantencionRate(antig+año)) / 12` × inflación, **rate cambia con brackets cada año** | `input.provisionMantencion ‖ formula` × inflación, **base CONSTANTE entre años** | ❌ | ❌ |
| Vacancia | `input.vacanciaMeses` directo | `inputData.vacanciaMeses ?? 1` (default 1 si null) | ✅ (con fallback ligeramente distinto) | ✅ casi |
| Punto de partida valorPropiedad | `valorMercadoFranco × UF_CLP` | `valorMercadoFranco × UF_CLP` (TSX:2766–2767) | ✅ | ✅ |
| UF_CLP usado | server-side al guardar (snapshot) | client-side al renderizar (live) | ❌ misma constante, distinto momento | depende |

### Observación crítica: efecto colateral en `calcMetrics`

`src/lib/analysis.ts:211`:
```ts
if (!input.provisionMantencion) input.provisionMantencion = Math.round((precioCLP * getMantencionRate(input.antiguedad)) / 12);
```

Esta línea **muta el objeto `input`** (no es pura). El `input_data` guardado en DB queda con el valor año-1 escrito como si el usuario lo hubiera ingresado. Cuando `dynamicProjections` lee `inputData.provisionMantencion`, ya no encuentra `null` ni `0`: encuentra el snapshot del motor del año 1 → cae en la rama "el usuario sí declaró provisión" → usa esa cifra como CONSTANTE para los 30 años.

Esto convierte la sim en estructuralmente incapaz de replicar el motor mientras la línea de mutación siga viva.

---

## Paso 3 — Inspección UI Simulación

### Inputs editables por el usuario (vía `SliderSimulacion`)

| Campo | Tipo | Rango | Step |
|---|---|---|---|
| Plazo de análisis | range | 1–30 años | 1 |
| Plusvalía anual | range | 0–15% | 0.1 |

No hay otros sliders activos. El componente acepta un `legacy={true}` que deshabilita el slider de plusvalía para análisis viejos sin recompute reactivo (mantiene projections estáticas).

### Defaults al cargar

- `horizonYears = useState(10)` (TSX:2483) → `plazoAnios=10`.
- `plusvaliaRate = useState(4.0)` (TSX:2489) → `plusvaliaAnual=4.0`.
- En `SimulationProvider` (TSX:3491–3498) se pasan también `plazoBase=10` y `plusvaliaBase=PLUSVALIA_HISTORICA[comuna]?.anualizada ?? PLUSVALIA_DEFAULT.anualizada`.

### ¿Los defaults se derivan del motor?

**NO.** Son hardcoded:
- `plazoAnios=10` matchea con `runAnalysis:1052` (`calcExitScenario(..., 10)`) por convención manual, no por enlace.
- `plusvaliaAnual=4.0` matchea con `PLUSVALIA_ANUAL=0.04` en `analysis.ts:44` por convención manual, no por enlace.

El comentario en `results-client.tsx:2764-2765` lo dice explícitamente:
> *"Match motor: arranca desde valor de mercado Franco (si existe) para que Capa 3 con plazo=10 y plusvalía=4% coincida con la TIR de Capa 1."*

Es decir: el dev sabía que tenía que mantener manualmente la coincidencia. Y se le escapó: la mantención no la mantuvo, y el arriendo extra tampoco.

### `useEffect` o sync con análisis principal

**No hay sync.** El `SimulationProvider` solo distribuye estado local del `ResultsClient`. Las `projections` que llegan a `Capa3Unificado` son `dynamicProjections` (recomputadas localmente cada vez que cambia plusvalíaRate o derivados), nunca `results.projections` del server.

`plusvaliaBase` viene de `PLUSVALIA_HISTORICA[comuna]`, que es un dato distinto al `PLUSVALIA_ANUAL=0.04` del motor (¡otra divergencia conceptual: el "default base" de la UI ≠ el "default real" del motor!).

---

## Paso 4 — Casos de prueba

Ejecuté la prueba con un probe TS que invoca directamente `runAnalysis()` y una réplica fiel de `dynamicProjections` (mismo cuerpo, mismo orden, mismas constantes). Probe en `audit/sesionA-diagnostico/_probe.ts` (se borra al cerrar sesión).

UF_CLP usado en el probe = 38800 (default `analysis.ts:26`). Al instante de guardar el dump, el server usó UF_CLP=40001 — esto explica por qué los valores absolutos del probe difieren de los del JSON, pero NO afecta la comparación interna motor↔sim ya que ambos usan el mismo UF_CLP en runtime.

| Caso | Métrica | Valor principal | Valor simulación | Δ absoluto | Δ % | Hipótesis activada |
|---|---|---|---|---|---|---|
| **1.** Canónico Providencia 7710a017 (provisionMantencion=91.669, sin estacionamiento, sin bodega) | TIR @ 10A | 11,56% | 12,36% | +0,80 pp | +6,9% | A + B (mantención constante en sim) |
| | flujo año 10 | −$4.715.022 | −$3.365.922 | +$1.349.100 | −28,6% | mismo |
| | retornoTotal | $166,68M | $175,13M | +$8,45M | +5,1% | mismo |
| | multiplicador | 1,9× | 2,22× | +0,32 | +16,8% | mismo |
| **2.** Igual + arriendoEstacionamiento $80K | TIR @ 10A | 12,66% | 12,36% | −0,30 pp | −2,4% | B (sim ignora extras de arriendo) |
| | flujo año 1 | −$2.140.836 | −$3.045.852 | −$905.016 | +42,3% | mismo |
| **3.** Igual + arriendoBodega $30K | TIR @ 10A | 11,97% | 12,36% | +0,39 pp | +3,3% | A + B se cancelan parcialmente |
| **4.** Igual pero `provisionMantencion=0` (forzando misma fórmula motor↔sim) | TIR @ 10A | 11,56% | 11,56% | 0,00 pp | 0% | ninguna — convergencia exacta |
| | flujo año 10 | −$4.715.022 | −$4.715.022 | 0 | 0% | mismo |
| | retornoTotal | $166,68M | $166,68M | 0 | 0% | mismo |

> Para el Caso 4 cloné el `input` antes de pasarlo a `runAnalysis` y antes de pasarlo a `dynamicProjections` (con `JSON.parse(JSON.stringify(input))`) para evitar la mutación cruzada por `calcMetrics:211`. Sin ese clon, el valor mutado contamina la sim.

### Detalle año por año (Caso 4, una vez normalizada la mantención)

```
y |  arriendo (motor=sim)  |  div (motor=sim)  |  mant (motor=sim)  | flujoAnual (motor=sim)
1 |   960.000              |    948.917        |       88.917       |   −3.012.828
2 |   993.600              |    977.385        |      146.535       |   −3.710.304
3 | 1.028.376              |  1.006.706        |      150.931       |   −3.767.448
…
10| 1.308.381              |  1.238.121        |      232.032       |   −4.715.022
```

Con la fórmula de motor real (rate ascendente con antigüedad), la mantención salta de $88K a $232K en 10 años. La simulación, leyendo `provisionMantencion` mutada, la mantiene plana en $88K × inflación 3% → $116K en año 10. La brecha en el flujo anual es de **~$1,4M/año** y se acumula.

---

## Paso 5 — Diagnóstico final

### Hipótesis ganadora

**Hipótesis A (función distinta)** — confirmada como causa primaria.
**Hipótesis B (defaults distintos)** — confirmada como causa secundaria, en dos vectores.
**Hipótesis C (bug sync)** — descartada como causa principal, pero sí hay un agravante: la mutación de `input.provisionMantencion` en `calcMetrics`.

Es una **combinación A + B**, no un solo culpable. Por métrica:

| Métrica | Hipótesis dominante | Por qué |
|---|---|---|
| TIR @ 10A en deptos sin estacionamiento/bodega y con `provisionMantencion` declarada | A — modelo de mantención divergente | Sim usa base constante; motor usa rate por brackets de antigüedad |
| TIR @ 10A en deptos con arriendoEstacionamiento o arriendoBodega > 0 | B — fuente de arriendo distinta | Sim usa `input.arriendo`, motor usa `metrics.ingresoMensual` |
| Cash-on-Cash | A — fórmula distinta | Sim promedia flujos anuales sobre inversión inicial; motor usa flujoNetoMensual del snapshot año-1 anualizado |
| Payback | A — algoritmo distinto | Sim itera con projections + venta; motor calcula como capital/flujoMensualSnap |
| Múltiplo, retornoTotal, valorVenta @ 10A con plazo=10, plusv=4% en deptos sin extras | A | Hereda la divergencia de mantención |
| Cualquier métrica con sliders movidos (plazo ≠ 10 o plusv ≠ 4%) | A — esperado divergir, pero base sigue contaminada | El usuario espera que diverja al mover sliders, pero NO espera que la base inicial esté off |

### Recomendación de fix (a alto nivel — sin código)

Tres opciones, ordenadas por costo y robustez. Mi recomendación es **Opción 2**, no Opción 1.

#### Opción 1 — Pasar `dynamicProjections` a `lib/analysis.ts` y reusar `calcProjections` con plusvalía paramétrica

- **Qué:** modificar la firma de `calcProjections` a `calcProjections(input, metrics, maxYears, plusvaliaAnual = 0.04)`. Eliminar la inline `dynamicProjections` en TSX y reemplazar por `calcProjections(input, metrics, 30, plusvaliaRate/100)`.
- **Pro:** una sola fuente de verdad. Mantener invariantes en un solo lugar. Permite también compartir el cálculo de mantención por brackets.
- **Contra:** requiere también arreglar la mutación de `provisionMantencion` (hacer la función pura) o documentar que el caller debe clonar. Y requiere validar que ningún otro consumidor server-side dependía del 4% hardcoded.
- **Esfuerzo:** medio (~1 día con tests).

#### Opción 2 (recomendada) — Mismo Opción 1, además de eliminar la mutación de `input.provisionMantencion`

- **Qué:** sumar a Opción 1 el refactor de `calcMetrics:211`. Reemplazar la mutación por una variable local `provisionMantencionUsada` que se use internamente sin escribir en `input`. La UI ya tiene cómo derivar el valor para mostrarlo (lo guardamos en metrics si hace falta).
- **Pro:** elimina el efecto colateral que hoy hace que `input_data` quede contaminado para siempre en DB. Análisis nuevos quedan limpios; análisis viejos se pueden migrar o quedan tolerables porque ahora la sim también usa rate por brackets.
- **Contra:** análisis ya guardados con `input_data.provisionMantencion` mutado seguirán teniendo ese valor — pero como ahora la sim también usa la formula del motor cuando es 0, el valor ya escrito sigue siendo válido (es la year-1 mantencion real). Así que no se rompe nada en histórico.
- **Esfuerzo:** medio-alto (~1 día). Requiere tests sobre el cálculo de score que toca metrics.

#### Opción 3 — Eliminar defaults hardcoded de simulación y pasar projections del motor como prop

- **Qué:** la simulación inicial muestra exactamente `results.projections` y `results.exitScenario` cuando `plazoAnios===10 && plusvaliaAnual===PLUSVALIA_ANUAL`. Solo cuando el usuario mueve un slider, recompute con `dynamicProjections`.
- **Pro:** garantiza coincidencia perfecta en defaults. Visualmente deshabilita la sospecha del usuario.
- **Contra:** no resuelve la divergencia: cualquier movimiento del slider vuelve a meter ruido. Es un parche, no un fix.
- **Esfuerzo:** bajo (~2 horas). No la recomiendo como solución definitiva, sí como mitigación temporal mientras se ejecuta Opción 2.

### Sugerencia operativa

Si hay otra fase de auditoría/refactor en agenda inmediata, hacer Opción 2. Si no, Opción 3 ahora + ticket trazable para Opción 2.

---

## Hallazgos colaterales (fuera de scope)

1. **`PLUSVALIA_HISTORICA` en UI ≠ `PLUSVALIA_ANUAL` en motor.** El componente `SimulationProvider` define `plusvaliaBase = PLUSVALIA_HISTORICA[comuna]?.anualizada` como ancla, pero el motor usa `0.04` flat. Si el usuario "resetea al base", el slider salta a un valor distinto del que el motor realmente usó al calcular la TIR principal. Esto es un anti-pattern: dos sources of truth diciendo cosas distintas para el mismo concepto de "default".

2. **Cap Rate hereda del motor; el resto recomputa.** En `kpi-calculations.ts:45` el cap rate viene de `metrics.capRate` (snapshot), pero TIR/payback/cash-on-cash recomputan. Esto significa que si el usuario mueve el slider de plusvalía a 10%, todos los KPIs cambian excepto Cap Rate, lo cual es correcto financieramente (cap rate no depende de plusvalía) pero potencialmente confuso visualmente.

3. **Sliders huérfanos comentados en TSX:2490–2494.** Los valores `arriendoGrowth=3.5` y `costGrowth=3.0` están hardcoded como constantes que el usuario no puede cambiar. El comentario dice "si se expone en el futuro, rehacer limpio en SliderSimulacion bajo Avanzado". Mientras tanto, son fuente potencial de divergencia silenciosa si en algún momento se cambian las constantes del motor sin actualizar las del cliente.

4. **`vacanciaMeses ?? 1` vs `input.vacanciaMeses` directo.** En analyses sin `vacanciaMeses` declarado (legacy), motor pasa `undefined` (calcFlujoDesglose lo trata como 0), sim pasa `1`. Análisis muy viejos sin este campo divergerán por 1 mes adicional de vacancia en sim. Bajo prioridad: probablemente no hay analyses así en producción.

5. **El probe del Sesión A reveló que `runAnalysis(input)` no es pura.** Esta es una propiedad sorpresa para cualquier consumidor: si llamas dos veces con el mismo objeto, la segunda llamada ve un input "ya tocado". Si en algún momento se cachea el resultado de `runAnalysis` sin clonar input, podríamos pisar también `contribuciones` y `gastos` (línea 212–213, mismo patrón).

---

## Pregunta abierta

El comentario en `results-client.tsx:2764-2765` indica que el dev original **sí intentó alinear motor↔sim** (al menos en el punto de partida `valorMercadoFranco`). Sospecho que el cuerpo de `dynamicProjections` se copió de `calcProjections` en un punto donde ambos coincidían, y luego `calcProjections` evolucionó (probablemente cuando se agregó el sistema de mantención por brackets de antigüedad) sin actualizar el clon. ¿Se quiere que verifique en `git log` cuándo divergieron las dos funciones para tener un timeline preciso? No es necesario para hacer el fix, pero sí para entender si esto fue un descuido aislado o un patrón.
