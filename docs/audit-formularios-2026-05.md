# Audit del flujo de creación de análisis — mayo 2026

**Fecha:** 2026-05-10
**Contexto:** post-commit `4af0116` (modelo STR v1 con 3 ejes operacionales). Antes de unificar formularios, mapeo del estado actual.

---

## TL;DR

El flujo actual tiene **3 caminos paralelos** de creación de análisis:

1. `/analisis/nuevo` — **legacy LTR**, no linkeado desde dashboard ni onboarding. Probablemente muerto.
2. `/analisis/nuevo-v2` — **wizard actual**, 3 pasos, despacha LTR/STR/Ambos en paso 3. Linkeado desde dashboard + onboarding.
3. `/analisis/renta-corta` — **form STR full-featured**, único lugar que hoy expone los 4 ejes del modelo v1 (`tipoEdificio`, `adminPro`, `habilitacion`, `operadorNombre`). Acceso solo por URL directa.

**Inconsistencia crítica:** el wizard `nuevo-v2` envía POST a `/api/analisis/short-term` sin los 4 ejes nuevos → el motor cae a defaults baseline (residencial puro + auto-gestión + básico) → banda `auto_gestion_residencial`, ocupación 55%. **Quien quiera marcar Andes-style debe entrar a `/renta-corta` por URL directa.**

**Diferenciación STR vs LTR en BD:** vía JSON-embedded `results.tipoAnalisis === "short-term"`, NO existe columna `tipo_analisis` en la tabla.

**Páginas de resultados:** separadas (`/analisis/[id]` LTR vs `/analisis/renta-corta/[id]` STR). El bloque pedagógico `EjesAplicadosSTR` solo renderiza en la STR.

---

## 1. Rutas activas

| Ruta | Tipo | Estado | Pasos | Endpoint POST | Acceso |
|---|---|---|---|---|---|
| `/analisis/nuevo` | LTR único | **Legacy** | Form mono-página (~2142 LOC) | `/api/analisis` | Solo URL directa |
| `/analisis/nuevo-v2` | LTR / STR / Ambos | **Activo** | Wizard 3 steps (~740 LOC + componentes en `formulario-v3/`) | `/api/analisis` o `/api/analisis/short-term` (o ambos en paralelo) | Dashboard + onboarding |
| `/analisis/renta-corta` | STR único | **Activo (paralelo)** | Form mono-página (~1750 LOC) | `/api/analisis/short-term` | Solo URL directa (no linkeado desde UI) |

**Evidencia de "actual" vs "legacy":**
- Dashboard linkea `/nuevo-v2` (línea ~193-195 de dashboard-client.tsx).
- Onboarding redirige a `/nuevo-v2`.
- `/nuevo` no aparece en grep de links desde dashboard / landing / onboarding.
- `/renta-corta` no aparece en links UI tampoco — pero sigue activa en routing y es la ÚNICA puerta al modelo STR v1 con los 4 ejes.

---

## 2. Wizard `/nuevo-v2` — paso a paso

**Total: 3 pasos.** Componentes en `src/components/formulario-v3/`:

| Paso | Componente | Pregunta | Campos | Validación |
|---|---|---|---|---|
| 1 | `Paso1Propiedad.tsx` | "Ingresa los datos de la propiedad" | direccion, comuna, ciudad, lat/lng, tipoPropiedad, superficieUtil, dormitorios, banos, estacionamientos, bodegas, antiguedad, estadoVenta, cuotasPie | dirección + comuna + tipo + superficie>0 |
| 2 | `Paso2Financiamiento.tsx` | "¿Cómo la compras?" | precio, piePct, tasaInteres, plazoCredito + sugerencias auto (arriendo, gastos, contribuciones) | precio>0 |
| 3 | `Paso3Modalidad.tsx` | "¿Cómo lo analizamos?" | **modalidad: `ltr` / `str` / `both`** + `ModalAjusteCondiciones` para tunear costos STR si modalidad ∈ {str, both} | modalidad obligatoria + crédito disponible |

**¿Hay opción explícita LTR/STR/Ambos?** SÍ — en paso 3, hardcoded como 3 opciones. Línea 76 de `nuevo-v2/page.tsx`:
```
enabled: state.modalidad === "str" || state.modalidad === "both",
```
Línea 506: comentario `// ─── Bifurcación por modalidad ──`. La elección dispara fetch a uno o ambos endpoints.

**Despacho según modalidad:**
- `ltr` → POST `/api/analisis` (sin crédito).
- `str` → POST `/api/analisis/short-term` (1 crédito).
- `both` → `Promise.allSettled` a ambos + cobro unificado vía `/api/credits/charge` (1 crédito total).

**¿`nuevo-v2` pregunta los 4 ejes STR v1 (`tipoEdificio`, `adminPro`, `habilitacion`, `operadorNombre`)?**
**NO.** Grep exhaustivo en `src/components/formulario-v3/*` y `src/app/analisis/nuevo-v2/page.tsx`:
```
$ grep -n "tipoEdificio|adminPro|habilitacion|operadorNombre" \
    src/components/formulario-v3/*.ts(x) src/app/analisis/nuevo-v2/page.tsx
(zero matches)
```
El `ModalAjusteCondiciones` SÍ permite tunear `modoGestion`, `comisionAdministrador`, `edificioPermiteAirbnb`, costos mensuales — pero no los 4 ejes nuevos.

**Implicación:** análisis STR creados desde el wizard reciben defaults del motor → banda `auto_gestion_residencial`, ocupación 55%, factor ADR 1.00. El bloque pedagógico `EjesAplicadosSTR` SÍ se renderiza en la results page (porque `results.ejesAplicados` se popula con los defaults), pero todos los ejes muestran "residencial puro / auto-gestión / básico" — independiente del caso real.

---

## 3. Cómo se invoca STR hoy

| Origen | Destino |
|---|---|
| Dashboard "Nuevo análisis" | `/analisis/nuevo-v2` (wizard, decide modalidad en paso 3) |
| Onboarding empty state | `/analisis/nuevo-v2` |
| Click en análisis STR existente del dashboard | `/analisis/renta-corta/[id]` (detección via `results.tipoAnalisis === "short-term"`) |
| URL directa `/analisis/renta-corta` | Form full-featured con 4 ejes STR v1 — **único acceso al modelo calibrado** |
| Landing page | (sin segmentación STR vs LTR) |

**Punto débil:** no hay link en la UI a `/analisis/renta-corta` (form full-featured). Solo se llega tipeando la URL. La calibración del modelo v1 está efectivamente oculta para usuarios del wizard.

---

## 4. Campos compartidos vs específicos

| Campo | `/nuevo` | `/nuevo-v2` | `/renta-corta` | Notas |
|---|---|---|---|---|
| `direccion`, `comuna`, `ciudad`, `lat`, `lng` | ✓ | ✓ | ✓ | Compartido |
| `dormitorios`, `banos`, `superficie` | ✓ | ✓ | ✓ | Compartido |
| `precio`, `piePct`, `tasaInteres`, `plazoCredito` | ✓ | ✓ | ✓ | Compartido |
| `arriendoLargoMensual`, `gastosComunes`, `contribuciones` | ✓ | ✓ | ✓ | Compartido |
| `capacidadHuespedes` | ✗ | ✓ (modal) | ✓ | STR-only |
| `tipoPropiedad`, `estadoVenta`, `cuotasPie`, `antiguedad`, `piso`, `estacionamientos`, `bodegas`, `vacanciaMeses` | ✓ | ✓ | ✗ | LTR-only en uso real |
| `modoGestion`, `comisionAdministrador`, `edificioPermiteAirbnb` | ✗ | ✓ (modal STR) | ✓ | STR operacional básico |
| `costoElectricidad`, `costoAgua`, `costoWifi`, `costoInsumos`, `mantencion`, `costoAmoblamiento`, `estaAmoblado` | ✗ | ✓ (modal STR) | ✓ | STR operacional |
| **`tipoEdificio`, `adminPro`, `habilitacion`, `operadorNombre`** (modelo v1) | ✗ | **✗** | **✓** | **Solo en `/renta-corta`** |

---

## 5. Endpoints API

| Endpoint | Tipo | Diferenciación | Comparte con LTR |
|---|---|---|---|
| `POST /api/analisis` | LTR | No lee `tipoAnalisis`; insert sin flag | — |
| `POST /api/analisis/short-term` | STR | Embedea `results.tipoAnalisis = "short-term"` y `input_data.tipoAnalisis = "short-term"` (JSON, no columna SQL) | Auth + `chargeAnalysisCredit` + `getUFValue` + insert en `analisis` table |

**Duplicación:** los dos endpoints duplican: validación de auth, lógica de prepaid charge (flujo AMBAS), claim de prepaid post-insert, mark `is_premium=true`, generación de score. La parte específica STR es:
- `getAirbnbEstimate` (call directo al lib, no sub-fetch).
- `buildAirbnbData` (transformación de schema AirROI → `AirbnbData` para el motor).
- `aplicarEjesSTR` indirectamente vía `calcShortTerm`.

---

## 6. Schema Supabase tabla `analisis`

**No existe columna `tipo_analisis`.** Diferenciación 100% via JSON:

| Análisis | `results.tipoAnalisis` | `input_data.tipoAnalisis` | `desglose` |
|---|---|---|---|
| LTR | (ausente o `undefined`) | (ausente) | LTR breakdown |
| STR | `"short-term"` | `"short-term"` | STR FrancoScore breakdown |

**Detección en cliente** (dashboard-client.tsx ~línea 46):
```ts
const isShortTerm = (item) => item?.results?.tipoAnalisis === "short-term";
```

**Migrations recientes que tocan `analisis`:**
- `20260306_add_is_premium.sql` — agrega `is_premium boolean`.
- `20260306_analisis_public_read.sql` — RLS policy.
- Otras alteraciones puntuales (creator_name, antigüedad numérica).

**Ningún ALTER TABLE para `tipo_analisis` o equivalente.**

---

## 7. Páginas de resultados

| Path | Renderiza | Detección | Redirects |
|---|---|---|---|
| `/analisis/[id]/page.tsx` | LTR | (asume LTR) | Ninguno |
| `/analisis/renta-corta/[id]/page.tsx` | STR | Verifica `results.tipoAnalisis === "short-term"`; si no, redirect a `/analisis/[id]` (línea 73-75) | LTR → `/analisis/[id]` |
| `/analisis/comparativa` | Side-by-side LTR vs STR | Query params `?ltr=id1&str=id2` | Usado por flujo "ambos" |

**Asimetría:** la STR results page redirige LTR-mismatched a `/analisis/[id]`. La LTR results page **no** verifica si por accidente le mandaron un STR — asume LTR. Si algún día un STR cae a `/analisis/[id]` el render falla silente o renderiza basura.

---

## 8. Bloque "Perfil operacional" / `EjesAplicadosSTR`

| Componente | Ubicación | ¿Renderiza? |
|---|---|---|
| Sección "Perfil operacional" del form | `/analisis/renta-corta/page.tsx` (inline) | Sí — único lugar |
| `EjesAplicadosSTR.tsx` componente results | `/analisis/renta-corta/[id]/results-client.tsx` (línea 174) | Sí, condicional en `results.ejesAplicados` |
| Cualquier referencia desde `/nuevo-v2` o `/nuevo` | — | **Cero** |

Confirmado por grep: ninguna mención de `tipoEdificio`, `adminPro`, `habilitacion`, `operadorNombre`, `EjesAplicadosSTR` en `nuevo-v2/page.tsx` ni en `formulario-v3/*`.

---

## Recomendación de approach mínimo invasivo

**Objetivo asumido:** unificar para que `/nuevo-v2` sea el único punto de entrada y exponga el modelo STR v1 completo (4 ejes operacionales).

### Opción A — Extender `nuevo-v2` paso 3 (recomendada)

Agregar al `ModalAjusteCondiciones` (que ya existe y se abre en paso 3 cuando modalidad ∈ {str, both}) los 4 campos del modelo v1: `tipoEdificio`, `adminPro`, `habilitacion`, `operadorNombre` (último condicional al primero).

**Cambios:**
- `src/components/formulario-v3/ModalAjusteCondiciones.tsx`: agregar 3 toggles + 1 input.
- `src/components/formulario-v3/wizardV3State.ts`: agregar 4 campos al state con defaults `residencial_puro / false / basico / ""`.
- `src/app/analisis/nuevo-v2/page.tsx` línea ~478: incluir los 4 campos en el body POST a `/api/analisis/short-term`.
- (Sin cambios) endpoint y motor ya aceptan los campos opcionales.

**Riesgo:** bajo. El modal STR ya existe y captura otros campos similares. Cambio aditivo, no romper.

**Beneficio:** un solo flujo activo (`/nuevo-v2`). El form `/renta-corta` puede deprecar gradualmente o quedar como "modo experto".

### Opción B — Redirect `/renta-corta` → `/nuevo-v2?modalidad=str`

Borrar el form `/renta-corta` y reemplazarlo con un redirect que abre el wizard en paso 1 con modalidad pre-seleccionada para paso 3.

**Riesgo:** medio. El wizard pide más pasos secuenciales (lat/lng → financiamiento → modalidad), mientras `/renta-corta` tiene todo en una página. UX-wise es regresión para usuarios que conocen `/renta-corta`.

**Beneficio:** elimina un form. Pero pierde el modo experto.

### Opción C — Status quo + linkear `/renta-corta` desde dashboard como "modo experto"

Dejar el wizard como está (sin los 4 ejes) y agregar en dashboard un link secundario "¿Operador profesional o edificio dedicado? Usa el form completo →" que apunta a `/renta-corta`.

**Riesgo:** mínimo, no se toca código del wizard.

**Beneficio:** chico. Sigue habiendo 2 forms paralelos. El usuario tiene que descubrir el link.

### Migration sugerida (independiente de A/B/C)

Considerar agregar columna `tipo_analisis text` con check constraint `IN ('long-term', 'short-term', 'both')` a la tabla `analisis`. Migrar datos existentes leyendo `results.tipoAnalisis`. Beneficios: queries SQL filtradas (dashboard, analytics) sin parsear JSON, índices sobre la columna, RLS policies más simples.

**Riesgo:** medio si hay rows ambiguas. Bajo si hay backfill cuidadoso.

---

## Recomendación final

**A + migration `tipo_analisis`** — extender `nuevo-v2` con los 4 ejes en el modal de paso 3, marcar `/renta-corta` como deprecated (conservarla 30 días como fallback), agregar columna `tipo_analisis` para query optimization.

Estimación: 4-6 horas de implementación + smoke test E2E ambos casos. Cero AirROI calls necesarios para validar (los E2E sintéticos de `scripts/e2e-str-cases.ts` siguen sirviendo).

---

## Archivos relevantes para futura implementación

- `src/components/formulario-v3/Paso3Modalidad.tsx` — selector LTR/STR/Ambos.
- `src/components/formulario-v3/ModalAjusteCondiciones.tsx` — donde agregar los 4 ejes.
- `src/components/formulario-v3/wizardV3State.ts` — state shape del wizard.
- `src/app/analisis/nuevo-v2/page.tsx` — orchestrator + bifurcación de POST.
- `src/lib/engines/short-term-engine.ts` — motor (ya acepta los 3 ejes opcionales).
- `src/app/api/analisis/short-term/route.ts` — endpoint (ya pasa los 3 ejes al motor).
