# Audit · Metodología veredictos + perfil usuario (Commit E)

**Fecha:** 2026-05-13
**Scope:** read-only · sin tocar código · doc audit completo
**Trigger:** caso Lastarria 200 expone inconsistencia entre score numérico, slider visual, badge veredicto y override IA.

---

## Skills aplicados

- `analysis-voice-franco` v1.0 — §1.5 financingHealth · §1.7 engineSignal vs francoVerdict · §1.8 tiers de usuario
- `brand-voice-franco` — veredicto sagrado (3 valores canónicos)
- `ux-cx-franco` — coherencia visual señal/contenido · tier Esencial default · empoderamiento usuario
- `franco-design-system` — Patrón 1 Hero Verdict Block · ScoreBarInline · 4 variantes visuales actuales
- `testing-patterns-franco` — validación post-Commit, immutable history

---

## 1 · Diagnóstico del bug (caso Lastarria 200)

**Analysis ID:** `d547e218-198d-439a-89fc-c66aa8bdef84`
**Observado en producción Commit C:** Score 50 · Slider en zona AJUSTA · Badge COMPRAR · Franco IA BUSCAR OTRA con rationale.

### 1.1 Las tres señales independientes que conviven hoy

| Señal | Origen | Valor Lastarria | Threshold lógica |
|---|---|---|---|
| **Score numérico** | `francoScore?.score` (FrancoScoreSTR) o fallback hardcoded `?? 50` | **50** (fallback) | Si `francoScore` null → 50 default |
| **Badge veredicto motor** | `francoScore?.veredicto ?? results.veredicto` | **COMPRAR** (engine.ts L898-905) | `sobreRentaPct >= 0.10 → COMPRAR` |
| **Franco IA verdict** | `ai.francoVerdict` (override IA) | **BUSCAR OTRA** | Doctrina: motor cierra pero CoC -3,7% + break-even 114% |

### 1.2 Cadena causal del mismatch

1. **`results-client.tsx:111-114` STR** lee `francoScore` del jsonb. Si el análisis es legacy (pre-FrancoScoreSTR implementado en Commit 2), `francoScore` es `undefined`.
2. **Fallback Score:** `const score = francoScore?.score ?? 50;` (L112) → **50 hardcoded** cuando no hay score real.
3. **Fallback Veredicto:** `const veredicto = (francoScore?.veredicto as STRVerdict) ?? results.veredicto;` (L113-114) → cae a `results.veredicto` del motor.
4. **engine.ts L898-905:** `if (sobreRentaPct >= 0.10) veredicto = 'COMPRAR';` — con 0.42 sobre-renta dispara COMPRAR sin segundo gate.
5. **Slider visual** consume `score=50` → ubica el dot en la zona media del bar (40-65). Visualmente coherente con AJUSTA, **no con COMPRAR**.
6. **Badge** consume `veredicto=COMPRAR` (motor) → label dinámico "CONSIDERA ANTES DE AVANZAR" + wash COMPRAR.
7. **Franco IA** evalúa contexto completo (CoC negativo, break-even imposible) → override `francoVerdict=BUSCAR OTRA` con rationale.

### 1.3 Causas raíz identificadas (4 simultáneas)

1. **Score default 50 cuando falta francoScore** — el Hero muestra una cifra inventada que el usuario lee como real.
2. **Threshold STR engine.veredicto demasiado permisivo** — `sobreRentaPct >= 0.10` ignora otros indicadores (CoC, break-even, flujo). Caso degenerado: depto que vende +42% sobre LTR pero pierde plata cada mes recibe COMPRAR del engine.
3. **Score y veredicto se calculan en paths independientes** — engine.veredicto vive en `short-term-engine.ts` (L898-905); FrancoScoreSTR vive en `short-term-score.ts` (L301-358). Pueden no estar de acuerdo.
4. **Divergencia francoVerdict ≠ engineSignal sin colapsar a una señal visual única** — el Hero renderiza estilo del motor (badge COMPRAR) y contenido del IA (frase BUSCAR OTRA). El usuario ve disonancia.

---

## 2 · Thresholds actuales LTR + STR

### 2.1 LTR (`analysis.ts`)

**Score 0-100 · 4 dimensiones:** Rentabilidad 30% · Flujo Caja 25% · Plusvalía 25% · Eficiencia 20%.

**Mapeo score → veredicto** (`analysis.ts:1170`):

| Score | engineSignal |
|---|---|
| 70+ | COMPRAR |
| 40-69 | AJUSTA SUPUESTOS |
| <40 | BUSCAR OTRA |

**Overrides** (L1177-1192):
- `cashOnCash < -30%` OR `breakEvenTasa = -1` OR flujo extremo negativo → fuerza BUSCAR OTRA
- `flujo >= 0 AND rentabilidadNeta >= 4% AND plusvalia >= 0%` → fuerza COMPRAR

**Clasificación interpretativa paralela** (L867-873) — **NO se mapea a veredicto:**

| Score | Etiqueta interpretativa |
|---|---|
| 80+ | Excelente |
| 65-79 | Buena |
| 50-64 | Regular |
| 30-49 | Débil |
| 0-29 | Evitar |

**Disonancia interna LTR:** Score 65 = "Buena" pero veredicto = AJUSTA SUPUESTOS (porque <70). Score 50 = "Regular" pero AJUSTA. Score 40 = "Débil" pero AJUSTA. La etiqueta interpretativa y el badge dicen cosas distintas.

### 2.2 STR — dos sistemas no alineados

**Sistema A: FrancoScoreSTR** (`short-term-score.ts:301-358`) — 4 dimensiones igual peso (25% c/u): Rentabilidad · Sostenibilidad · Ventaja LTR · Factibilidad.

| Score | veredicto |
|---|---|
| 65+ | COMPRAR |
| 40-64 | AJUSTA SUPUESTOS |
| <40 | BUSCAR OTRA |

**Overrides** (L330-350) — solo DEGRADAN (nunca elevan):
- `sobreRentaPct < 0 AND COMPRAR` → AJUSTA
- `regulacion='no' AND COMPRAR` → AJUSTA
- `flujoCajaMensual < -250K AND sobreRentaPct < 0.10` → BUSCAR OTRA
- `capRate < 0.02` → BUSCAR OTRA

**Sistema B: engine.ts veredicto heuristic** (`short-term-engine.ts:898-905`):

```ts
if (sobreRentaPct >= 0.10) veredicto = 'COMPRAR';
else if (sobreRentaPct >= 0 && base.noiMensual > 0) veredicto = 'AJUSTA SUPUESTOS';
else veredicto = 'BUSCAR OTRA';
```

**Caller decide cuál usar** (`results-client renta-corta L113`): prefiere FrancoScoreSTR, fallback a engine. Lastarria cae a engine porque francoScore=null.

### 2.3 Inconsistencias detectadas

| # | Inconsistencia | Impacto |
|---|---|---|
| I1 | LTR threshold COMPRAR=70 vs STR FrancoScore COMPRAR=65 | Mismo perfil de depto puede dar veredictos distintos en LTR y STR (no necesariamente malo, pero arbitrario) |
| I2 | STR tiene 2 sistemas (engine vs FrancoScore) que pueden no coincidir | Lastarria: score 50→AJUSTA, engine→COMPRAR |
| I3 | LTR slider/clasificación interpretativa de 5 bandas no se mapea a 3 bandas de veredicto | Score 65 "Buena" pero AJUSTA |
| I4 | Score default fallback = 50 cuando falta | Usuario lee "50" como dato real, no como N/A |
| I5 | Override permisivo STR `sobreRentaPct >= 0.10` sin gate de Cash-on-Cash o break-even | Caso Lastarria: STR rinde +42% pero pierde plata → engine dice COMPRAR |

### 2.4 Propuesta de thresholds coherentes (recomendación)

**Principio:** una sola fuente de verdad. Score numérico determina veredicto. Bandas visuales del slider = bandas de veredicto.

**Bandas propuestas (LTR + STR · idénticas):**

| Score | Veredicto | Banda slider | Etiqueta interpretativa |
|---|---|---|---|
| 70-100 | COMPRAR | Verde-Ink alta (zona derecha) | Sólida / Excelente |
| 45-69 | AJUSTA SUPUESTOS | Centro (Ink medio) | Negociable / Mejorable |
| 0-44 | BUSCAR OTRA | Signal Red (zona izquierda) | Débil / Evitar |

**¿Mismos thresholds LTR + STR?** Sí. Justificación:
- Score normalizado a 0-100 en ambos sistemas. La semántica de "depto bueno" no cambia por modalidad — lo que cambia son los inputs (CAP rate STR vs rentabilidad bruta LTR).
- Un threshold compartido elimina arbitrariedad y simplifica la educación del usuario.
- Las particularidades de cada modalidad se reflejan en las DIMENSIONES del score (qué entra al 100), no en el threshold final.

**Overrides como gates de seguridad explícitos:**

| Override | LTR | STR |
|---|---|---|
| Cash-on-Cash < -10% | → max AJUSTA | → max AJUSTA |
| Cash-on-Cash < -30% | → BUSCAR OTRA | → BUSCAR OTRA |
| Break-even > 110% del mercado | n/a | → max AJUSTA |
| Break-even > 130% del mercado | n/a | → BUSCAR OTRA |
| Regulación edificio = no | n/a | → BUSCAR OTRA |
| sobreRentaPct < -10% (STR pierde fuerte vs LTR) | n/a | → max AJUSTA |
| Flujo neto mensual < −5% del ingreso AND CoC < 0 | → max AJUSTA | → max AJUSTA |

**Mapping en `short-term-engine.ts` debería desaparecer.** Solo FrancoScoreSTR emite veredicto. engine.ts persiste `score` y eso es todo.

---

## 3 · Eliminar divergencia `francoVerdict ≠ engineSignal`

### 3.1 Inventario código

| Lugar | Uso actual |
|---|---|
| `types.ts:184-189` | `EngineSignal` (3) y `FrancoVerdict` (4 con RECONSIDERA) — tipos distintos |
| `types.ts:230-233` | `FullAnalysisResult` tiene ambos campos |
| `types.ts:386-390` | `AIAnalysisV2.francoVerdict?` opcional (sin rationale) |
| `types.ts:435-440` | `AIAnalysisSTRv2.engineSignal` + `francoVerdict` + `francoVerdictRationale?` (con rationale) |
| `types.ts:468-470` | `AIAnalysisComparativa.engineRecommendation` + `recomendacionFranco` + `recomendacionRationale` |
| `lib/results-helpers.ts:21-34` | `readEngineSignal()` + `readFrancoVerdict()` con fallback legacy |
| `lib/ai-generation.ts:175-194` | REGLA DE DIVERGENCIA LTR explícita en el prompt (5 escenarios) |
| `lib/ai-generation-str.ts:228` | Similar regla STR |
| `lib/ai-generation-ambas.ts:128-130` | `recomendacionFranco` puede diverger de `engineRecommendation` |
| `components/analysis/HeroVerdictBlock.tsx` | Solo consume el veredicto final (resolvedVeredicto = francoVerdict) — no muestra divergencia visualmente |
| `components/analysis/str/HeroVerdictBlockSTR.tsx` (post-Commit C) | Muestra caja "Franco diverge del motor" explícita con rationale |
| `components/analysis/AIInsightSection.tsx:45` | Estilo para 4to veredicto RECONSIDERA |
| `components/analysis/AIInsightSection.tsx` (legacy) | Mostraba `francoVerdictRationale` (LTR no tiene campo, solo STR lo tiene) |
| `app/analisis/[id]/results-client.tsx:258` | PostHog tracking `francoOverridesEngine` flag |

### 3.2 Plan de eliminación

**Decisión:** colapsar a una sola señal. Eliminar `francoVerdict` como concepto separado. El motor emite veredicto; la IA NARRA matiz; la IA NO contradice.

**Cambios concretos:**

1. **types.ts:**
   - Eliminar `EngineSignal` y `FrancoVerdict` como tipos distintos. Definir un único `Veredicto = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA"` (3 valores, sin RECONSIDERA — ver §4).
   - Renombrar `AIAnalysisV2.francoVerdict?` → eliminar (no necesario en IA).
   - Renombrar `AIAnalysisSTRv2.engineSignal` + `francoVerdict` + `francoVerdictRationale?` → eliminar 2 últimos. La IA recibe el veredicto del motor en input y lo narra, no lo emite.
   - `FullAnalysisResult.engineSignal` + `francoVerdict` → unificar en `veredicto`.

2. **lib/ai-generation*.ts:**
   - Eliminar la REGLA DE DIVERGENCIA explícita.
   - Reemplazar por instrucción: "el veredicto del motor es la conclusión. Tu trabajo es narrar el matiz y los caveats, no contradecirlo. Si crees que el veredicto es incorrecto, eso significa que el motor está mal calibrado — repórtalo en un campo `francoCaveat?` opcional para auditoría, pero NUNCA al usuario."
   - `francoCaveat?` (opcional, audit-only) — guardar en jsonb para revisión humana, NO renderizar.

3. **lib/results-helpers.ts:**
   - `readEngineSignal` + `readFrancoVerdict` → reducir a una sola `readVeredicto()`.

4. **Componentes:**
   - HeroVerdictBlockSTR — eliminar caja "Franco diverge del motor" + rationale block.
   - HeroVerdictBlock LTR — sin cambios funcionales (ya usa resolvedVeredicto coherente).
   - AIInsightSection — eliminar lógica de divergencia.

5. **PostHog:**
   - `francoOverridesEngine` flag → deprecar.

### 3.3 Inventario divergencias actuales en DB

**SQL propuesto (NO ejecutar en este audit):**

```sql
-- Análisis LTR con divergencia activa
SELECT COUNT(*) FROM analisis
WHERE results->>'engineSignal' IS NOT NULL
  AND results->>'francoVerdict' IS NOT NULL
  AND results->>'engineSignal' != results->>'francoVerdict';

-- Análisis STR con divergencia activa
SELECT COUNT(*) FROM analisis
WHERE ai_analysis->>'engineSignal' IS NOT NULL
  AND ai_analysis->>'francoVerdict' IS NOT NULL
  AND ai_analysis->>'engineSignal' != ai_analysis->>'francoVerdict';
```

Resultado esperado: minoría de análisis tienen divergencia activa (≤10%). Migrarlos: usar `francoVerdict` como valor final (era el "oficial" para la UI) y descartar `engineSignal`.

---

## 4 · Fundir RECONSIDERA LA ESTRUCTURA en AJUSTA SUPUESTOS

### 4.1 Inventario uso de RECONSIDERA

| Lugar | Uso |
|---|---|
| `types.ts:184-189` | `FrancoVerdict` incluye `"RECONSIDERA LA ESTRUCTURA"` (4to valor) |
| `lib/ai-generation.ts:143-194` | Reglas de activación (Nivel 3 financingHealth + override engineSignal=COMPRAR) |
| `lib/ai-generation.ts:367-376` | Schema `AIReestructuracionSection` (contenido + estructuraSugerida) |
| `lib/ai-generation.ts:481-578` | Prompt instrucciones para emitirlo |
| `lib/financing-health.ts:21-135` | Clasificador pie/tasa → activa RECONSIDERA en overall="problematico" |
| `components/analysis/HeroVerdictBlock.tsx` | 4to variant visual (badge Ink + icono Calculator + label "Ajusta el financiamiento") |
| `components/analysis/AIInsightSection.tsx:42-50` | Estilos VERDICT_STYLES[RECONSIDERA LA ESTRUCTURA] |
| `components/analysis/ReestructuracionMiniCard.tsx` | UI card opcional en grid |
| `components/analysis/SubjectCardGrid.tsx:180-186` | Render condicional de ReestructuracionMiniCard |
| `components/ui/AnalysisDrawer.tsx:22, 48, 1988-1993` | Drawer "03+ · Reestructuración" intercalado en nav |
| STR / Comparativa | No usa RECONSIDERA |

### 4.2 Plan de fusión

**Tesis:** RECONSIDERA es un sub-tipo de AJUSTA SUPUESTOS, no un veredicto propio. El usuario no necesita un 4to badge; necesita que el AJUSTA SUPUESTOS le diga *qué* ajustar. La estructura financiera ES una palanca de ajuste, igual que el precio o los supuestos operativos.

**Cambios:**

1. **types.ts:** eliminar `"RECONSIDERA LA ESTRUCTURA"` de `FrancoVerdict`. Si todo lo que veía RECONSIDERA antes ahora es AJUSTA SUPUESTOS + matiz textual.

2. **ai-generation.ts:**
   - Eliminar regla de activación de RECONSIDERA (§§ 7, 13.4).
   - Mantener `AIReestructuracionSection` opcional — la sección se renderiza cuando `financingHealth.overall == problematico`, pero como CONTENIDO dentro del veredicto AJUSTA SUPUESTOS, no como veredicto propio.
   - El prompt instruye: "si la palanca de ajuste es la estructura financiera, dilo explícitamente en `negociacion.contenido` o agrega la sección `reestructuracion`. Pero el veredicto sigue siendo AJUSTA SUPUESTOS."

3. **HeroVerdictBlock LTR:**
   - Eliminar variante RECONSIDERA. Renderizar como AJUSTA SUPUESTOS (badge Signal Red sobre fondo card · variante warn).
   - Si `aiAnalysis.reestructuracion` está presente, mostrar ReestructuracionMiniCard normalmente como sub-card.

4. **AnalysisDrawer:**
   - Drawer "03+ · Reestructuración" sigue existiendo como drawer adicional al de negociación, pero ya no se anuncia como veredicto distinto. Es una pestaña adicional dentro de AJUSTA SUPUESTOS.

5. **financing-health.ts:** sin cambios — el clasificador sigue corriendo y aporta señal a la IA.

### 4.3 Migración análisis legacy

**Per spec immutable history:** los análisis con `francoVerdict = "RECONSIDERA LA ESTRUCTURA"` se mantienen en DB intactos.

**Read-path:** `readVeredicto()` debe coercer "RECONSIDERA LA ESTRUCTURA" → "AJUSTA SUPUESTOS" al leer. La UI los ve como AJUSTA SUPUESTOS con la sección reestructuración presente.

**SQL count (NO ejecutar):**

```sql
SELECT COUNT(*) FROM analisis
WHERE results->>'francoVerdict' = 'RECONSIDERA LA ESTRUCTURA';
```

---

## 5 · Perfil del usuario

### 5.1 Estado actual — MÍNIMO

Hoy se persiste:
- `users` (Supabase Auth): email, nombre.
- `user_credits`: `credits`, `subscription_status`, `welcome_credit_used`, `onboarding_completed` (boolean flag, sin contenido).
- `/perfil`: muestra plan, créditos, historial.

**NO existe captura de perfil inversor.** El skill `analysis-voice-franco` §1.8 menciona tiers (esencial/estándar/experto/corredor) pero no hay implementación. El motor LTR/STR y el prompt IA reciben `userTier: "estandar"` hardcoded.

### 5.2 Set mínimo de campos propuesto

Captura post-signup o en primer análisis (3 preguntas, max 30 segundos):

| Campo | Pregunta | Valores | Impacto motor |
|---|---|---|---|
| `etapaInversion` | ¿En qué etapa estás? | `explorando` / `propiedad_en_mente` / `en_proceso` | Tono IA (más educativo si explorando) |
| `primeraInversion` | ¿Es tu primera propiedad de inversión? | `si` / `no` | Tier IA (esencial vs estándar) · ajusta thresholds (más conservador si primera) |
| `aprobacionBancaria` | ¿Tienes pre-aprobación bancaria? | `si` / `no` / `no_aplica` | Severidad de financingHealth (más estricto si "no") · IA matiza |
| `toleranciaOperativaSTR` | (Solo si analiza STR) ¿Cuántas horas/sem puedes dedicar a Airbnb? | `0-2` (admin obligatorio) / `2-8` (mixto) / `8+` (auto) | Override veredicto STR (si auto-gestión esperada pero capacidad <2h → degrada COMPRAR) |
| `capitalAdicional` | (Opcional, solo si quiere) ¿Tu capital disponible está ajustado o cómodo? | `ajustado` / `comodo` | IA matiza tolerancia a aporte mensual negativo · ajusta threshold COMPRAR |

**Tier derivado del perfil** (no se le pide al usuario):

| Perfil | Tier IA |
|---|---|
| primeraInversion=si + etapa=explorando | esencial |
| primeraInversion=si + etapa=propiedad_en_mente | esencial/estandar (depende experiencia previa declarada en cuenta) |
| primeraInversion=no | estandar |
| Manual override en `/perfil` (futuro) | experto |

### 5.3 Cómo se conecta al motor

**Patrón propuesto: profile shapes the verdict thresholds, not the score itself.**

| Capa | Qué hace |
|---|---|
| **Cálculo del score** | Mantiene fórmula objetiva (dimensiones LTR/STR sin tocar). El score 0-100 es OBJETIVO, no varía por perfil. |
| **Thresholds por veredicto** | SE AJUSTAN por perfil. Ejemplo: `primeraInversion=si` → threshold COMPRAR sube a 75 (más conservador); `experto` → threshold COMPRAR baja a 65 (tolera más riesgo). |
| **Overrides** | SE AJUSTAN por perfil. Ejemplo: `aprobacionBancaria=no` activa override más estricto en pie/tasa. |
| **Prompt IA** | Recibe perfil completo + veredicto. Narra el matiz adecuado al tier. Tier esencial: explica conceptos. Tier estándar: asume conocimiento. |

**Ventaja del patrón:** el score sigue siendo trazable y comparable entre análisis. Lo que ajusta por perfil es la INTERPRETACIÓN.

**Tabla de thresholds por perfil (propuesta):**

| Perfil | COMPRAR ≥ | AJUSTA ≥ |
|---|---|---|
| Primera inversión (default tier esencial) | 75 | 50 |
| No es primera (tier estándar — default actual) | 70 | 45 |
| Experto (futuro override) | 65 | 40 |

### 5.4 Persistencia

**Decisión:** doble persistencia.

1. **`users.profile`** (nuevo · jsonb columna o tabla `user_profiles`) — fuente mutable, actualizable desde `/perfil`. Refleja el estado actual del usuario.

2. **`analisis.user_profile_snapshot`** (nuevo · jsonb columna) — snapshot inmutable del perfil al momento de crear el análisis. Permite que análisis viejos sigan siendo coherentes con el perfil que tenía el usuario entonces.

**Edge case — usuario sin perfil completo:**
- Default a tier estándar (no es primera inversión, sin pre-aprobación, sin tolerancia STR declarada).
- Banner soft en UI: "¿Querés que Franco te asesore mejor? Completa tu perfil en 30 segundos." (link `/perfil`).
- Análisis funciona, pero IA no puede matizar tier esencial.

**Edge case — usuario cambia perfil entre análisis:**
- Análisis viejo conserva snapshot anterior (immutable). Visual: sub-texto en Hero "Análisis generado con perfil: primera inversión".
- Análisis nuevos usan el perfil actual.
- Re-cálculo manual desde el dashboard: opcional, regenera con perfil actual.

---

## 6 · Score numérico visible junto a veredicto

### 6.1 Estado actual

- LTR Hero: score grande visible en HeroTopStrip + ScoreBarInline (gradiente Signal Red→Ink + dot indicador). Skill design-system Patrón 1 ya lo prescribe.
- STR Hero: mismo patrón, score grande visible.
- **Problema:** la BANDA del score (5 buckets interpretativos LTR: Excelente/Buena/Regular/Débil/Evitar) NO coincide con la banda del veredicto (3 buckets).

### 6.2 Propuesta — unificar bandas + label tier

**Hero rediseño (propuesta para Commit E.1):**

```
┌────────────────────────────────────────────────────────┐
│ Depto 2D2B Las Condes · UF 5.500 · 75m²                │
│ ────────────────────────────────────────────────────── │
│   FRANCO SCORE                                          │
│   76 / 100   [████████████████░░░░░░░░] COMPRAR         │
│              zona "buena" · banda derecha               │
│                                                         │
│ 01 · VEREDICTO                                          │
│ ¿Por qué conviene?                                      │
│ [...]                                                   │
└────────────────────────────────────────────────────────┘
```

**Elementos visuales nuevos:**

- Score numérico: ya existía. Mantener tamaño grande (Mono Bold 32-44px).
- Barra horizontal con 3 segmentos coloreados (no gradiente continuo):
  - Izquierda (0-44): Signal Red — BUSCAR OTRA
  - Centro (45-69): Ink medio — AJUSTA SUPUESTOS
  - Derecha (70-100): Ink alto / Verde sutil — COMPRAR
- Dot indicador sobre la barra en la posición exacta del score.
- Sub-texto bajo barra: "zona <interpretativa> · banda <veredicto>". Ej: `zona "regular" · banda AJUSTA SUPUESTOS`.
- Badge a la derecha de la barra: el veredicto resultante (mismo del cuerpo).

**Beneficio:**
- El usuario lee: "Score 50, banda AJUSTA SUPUESTOS" — coherente.
- El slider visual y el badge dicen lo mismo.
- La etiqueta interpretativa (Buena/Regular/Débil) se mantiene como contexto secundario para auditoría/sesgo.

### 6.3 Diferencia LTR vs STR en el Hero

| Elemento | LTR | STR |
|---|---|---|
| Score | sí | sí |
| Barra 3 segmentos | sí | sí |
| Sub-texto banda | sí | sí |
| Dimensiones desglosadas (tooltip) | Rentabilidad/Flujo/Plusvalía/Eficiencia | Rentabilidad/Sostenibilidad/Ventaja LTR/Factibilidad |
| Tooltip de FrancoScoreSTR detail | Reuso del componente actual | Reuso |

---

## 7 · Análisis legacy (immutable history)

### 7.1 Decisión: methodology_version

**Agregar columna `analisis.methodology_version`** (text, default `"v1"`).

- Pre-Commit E: `methodology_version = null` o `"v1"`.
- Post-Commit E: análisis nuevos guardan `"v2"`.

### 7.2 Comportamiento UI con methodology_version

| Caso | Render |
|---|---|
| Análisis v2 (nuevo) | Hero con bandas unificadas (3 segmentos), badge consistente con score, sin caja "Franco diverge", sin RECONSIDERA. |
| Análisis v1 (legacy) | Render fallback: usar veredicto persistido en `results` sin recalcular bandas. Banner soft: "Análisis generado con metodología v1 — regenera para aplicar los nuevos thresholds." |
| Análisis v1 con `francoVerdict = "RECONSIDERA LA ESTRUCTURA"` | Read-path coerce a AJUSTA SUPUESTOS. Sub-card reestructuración sigue apareciendo. |
| Análisis v1 con divergencia francoVerdict ≠ engineSignal | Mostrar solo `francoVerdict` (era el que prevalecía). engineSignal queda enterrado en jsonb para audit. |

### 7.3 SQL migración (NO ejecutar)

```sql
ALTER TABLE analisis ADD COLUMN methodology_version text DEFAULT 'v1';
UPDATE analisis SET methodology_version = 'v1' WHERE methodology_version IS NULL;
-- Análisis nuevos post-Commit E: el motor escribe 'v2' explícito.
```

---

## 8 · Plan de sub-commits

### E.1 — Recalibración thresholds + score visible (alto impacto · bajo riesgo)

**Cambios:**
- Unificar thresholds LTR + STR a `COMPRAR ≥ 70 (o 75 si primera inv) · AJUSTA ≥ 45 (50) · BUSCAR < 45`.
- Eliminar el sistema engine.veredicto en STR. Solo FrancoScoreSTR emite veredicto.
- Hero LTR + STR: barra 3 segmentos coloreados + sub-texto banda explícita.
- Score default 50 — eliminar fallback hardcoded. Si `francoScore` null, mostrar "—" + "Análisis incompleto" banner.

**Archivos:**
- `src/lib/analysis.ts` (L1170, L1177-1192)
- `src/lib/engines/short-term-engine.ts` (L898-905 eliminar)
- `src/lib/engines/short-term-score.ts` (L323-326 unificar)
- `src/components/analysis/HeroTopStrip.tsx` (ScoreBarInline · barra 3 segmentos)
- `src/components/analysis/HeroVerdictBlock.tsx` + `HeroVerdictBlockSTR.tsx` (sub-texto banda)
- `src/app/analisis/[id]/results-client.tsx` + `renta-corta/[id]/results-client.tsx` (eliminar fallback 50)

**Esfuerzo:** M (~5-6h).
**Riesgo:** medio — análisis legacy se ven distinto. Mitigación: `methodology_version` columna + banner.
**Validación:** Playwright comparando análisis pre/post + casos sintéticos (score=44, 45, 69, 70 — confirmar bandas).

### E.2 — Eliminar divergencia `francoVerdict` (cambio medio · medio riesgo)

**Cambios:**
- `types.ts` unificar `Veredicto` (3 valores).
- `results-helpers.ts` reducir a `readVeredicto()`.
- Prompts IA: eliminar REGLA DE DIVERGENCIA. Instruir: "narra, no contradigas".
- HeroVerdictBlockSTR: eliminar caja "Franco diverge del motor".
- PostHog: deprecar `francoOverridesEngine`.

**Archivos:**
- `src/lib/types.ts`
- `src/lib/results-helpers.ts`
- `src/lib/ai-generation.ts` · `ai-generation-str.ts` · `ai-generation-ambas.ts`
- `src/components/analysis/str/HeroVerdictBlockSTR.tsx`
- `src/components/analysis/AIInsightSection.tsx`
- `src/app/analisis/[id]/results-client.tsx` (PostHog)

**Esfuerzo:** M (~4-5h).
**Riesgo:** bajo si E.1 está hecho (los thresholds nuevos eliminan la mayoría de divergencias naturales).
**Validación:** sweep DB de divergencias activas + sanity prompt + Playwright.

### E.3 — Fundir RECONSIDERA en AJUSTA (cambio medio · medio riesgo)

**Cambios:**
- Eliminar `"RECONSIDERA LA ESTRUCTURA"` de `FrancoVerdict`.
- HeroVerdictBlock LTR: eliminar variant RECONSIDERA. Render como AJUSTA + sub-card reestructuración cuando aplique.
- Prompts IA: ajustar la regla de Nivel 3 financingHealth → emite AJUSTA SUPUESTOS + sección reestructuración (no cambia veredicto).
- `readVeredicto()` coerce legacy "RECONSIDERA LA ESTRUCTURA" → "AJUSTA SUPUESTOS".
- AnalysisDrawer: drawer "03+ · Reestructuración" sigue existiendo pero sin badge especial.

**Archivos:**
- `src/lib/types.ts`
- `src/lib/ai-generation.ts` (L143-194, L367-376, L481-578)
- `src/components/analysis/HeroVerdictBlock.tsx`
- `src/components/analysis/AIInsightSection.tsx`
- `src/components/analysis/ReestructuracionMiniCard.tsx` (sin cambios estructurales, sí context)
- `src/components/ui/AnalysisDrawer.tsx` (L22, L48-51, L1988-1993)

**Esfuerzo:** M (~4h).
**Riesgo:** medio — análisis LTR con RECONSIDERA activo se rebanderan a AJUSTA. Pierden el veredicto distinto pero el contenido reestructuración persiste.
**Validación:** count DB de RECONSIDERA + Playwright en análisis legacy.

### E.4 — Perfil usuario al motor + prompt (cambio mayor · medio riesgo)

**Cambios:**
- Migration `user_profiles` table + columna `analisis.user_profile_snapshot`.
- Formulario onboarding (modal post-signup o en primer análisis): 3-4 preguntas.
- UI `/perfil` para editar perfil.
- Motor LTR/STR recibe `userProfile` y ajusta thresholds.
- Prompts IA reciben `userProfile` y matizan narrativa.
- Banner soft "Completa tu perfil" cuando análisis se ve sin perfil completo.

**Archivos:**
- Migration Supabase (nueva)
- `src/app/perfil/page.tsx` (formulario)
- `src/app/onboarding/...` (nueva ruta, modal o page)
- `src/lib/analysis.ts` (params + thresholds dinámicos)
- `src/lib/engines/short-term-score.ts` (params + thresholds dinámicos)
- `src/lib/ai-generation*.ts` (3 prompts reciben perfil)
- `src/lib/api-helpers/analisis-pipeline.ts` (lee perfil + snapshot)

**Esfuerzo:** L (~10-14h).
**Riesgo:** medio — UX onboarding nuevo, posible fricción. Mitigación: opcional, default tier estándar.
**Validación:** flow completo signup → onboarding → primer análisis con perfil aplicado. Edge cases: usuario salta onboarding, edita perfil, regenera análisis.

---

## 9 · Riesgos identificados

### 9.1 Visuales / UX

| Riesgo | Mitigación |
|---|---|
| Análisis legacy con score viejo se ven distinto post-E.1 (banda cambia) | `methodology_version` + banner "Análisis v1 — regenera para nuevos thresholds" |
| Análisis con RECONSIDERA legacy pierden el badge especial post-E.3 | Sub-card reestructuración persiste — la narrativa se preserva, solo el badge cambia |
| Usuario que ya vio "BUSCAR OTRA" en Lastarria ahora vea "AJUSTA SUPUESTOS" post-E.1 (depende de recalibración) | Banner explicativo + posibilidad de re-generar |

### 9.2 Cache IA

| Riesgo | Mitigación |
|---|---|
| Análisis con IA cacheada que dice "Mi veredicto es BUSCAR OTRA" pero badge ahora dice "AJUSTA SUPUESTOS" | Re-generar IA al regenerar análisis. O coerce read-path: si caché IA dice X y motor dice Y, mostrar motor. La IA sigue narrando matiz. |
| Cache "revenue" residual + cache RECONSIDERA + cache divergencia | Drive-by en E.2/E.3: regen IA para análisis afectados o coerce a nuevo schema en read |

### 9.3 Lógica de motor

| Riesgo | Mitigación |
|---|---|
| Eliminar `engine.veredicto` STR (E.1) puede afectar pipeline batch existente que lo lea | Mantener campo en results jsonb como `legacyEngineVeredicto` para audit, no leer en UI |
| Thresholds más estrictos para "primera inversión" (E.4) generan más AJUSTA que antes | Esperado y deseado — primera inversión es contexto de mayor cuidado |
| Override `breakEven > 110%` activa BUSCAR donde antes era AJUSTA (E.1) | Test sintético + revisión casos representativos antes de merge |

### 9.4 Privacidad / DB

| Riesgo | Mitigación |
|---|---|
| Snapshot `user_profile_snapshot` persiste datos personales en cada análisis | RLS Supabase + GDPR: usuario puede solicitar borrado · snapshot se anonimiza |
| `methodology_version` requiere migration coordinada con deploy | Migración aditiva (nueva columna, default v1) — sin downtime |

---

## 10 · Recomendación de orden

**Orden propuesto:** E.1 → E.2 → E.3 → E.4.

**Justificación:**

1. **E.1 primero** porque resuelve el bug central (Lastarria) que motivó el audit. Unificar thresholds + score visible elimina la disonancia visual sin tocar prompts ni schemas. ROI alto, riesgo bajo. Es la base sobre la que se construyen las demás.

2. **E.2 segundo** porque al unificar thresholds (E.1) la mayoría de divergencias naturales desaparecen. La IA ya no necesita contradecir al motor — el motor ya emite el veredicto razonable. Eliminar la divergencia es un cleanup de bajo costo después de E.1.

3. **E.3 tercero** porque RECONSIDERA es funcionalmente una sub-clase de AJUSTA. Una vez que la divergencia se eliminó (E.2), RECONSIDERA queda como caso edge solitario. Fundirlo en AJUSTA es coherente con el principio "una sola fuente de verdad".

4. **E.4 último** porque introduce un cambio de UX (onboarding) + migration DB nuevos. Es el más invasivo. Hacerlo después de los 3 anteriores asegura que la base metodológica esté limpia antes de agregar el perfil — el perfil ajusta thresholds que ya están unificados.

**Alternativa: E.1 + E.4 en paralelo si quieres avanzar más rápido.** E.4 requiere E.1 para que los thresholds-por-perfil tengan sentido, pero E.2 y E.3 pueden esperar.

**Quick-win opcional antes de todo:** un Commit E.0 mínimo que solo:
- Elimine el fallback `score ?? 50` (mostrar "—" + banner "Análisis sin score completo").
- Documente methodology_version preparando el terreno.

Esto cierra el bug visual inmediato sin requerir el refactor completo. ~1h de trabajo.

---

## 11 · Lo que NO está en scope de este audit

- **Cleanup cache "revenue"** — pendiente lateral (regen batch ai_analysis).
- **Componente `comparativa-client` ambas modalidades** — usa su propio `recomendacionFranco` que ya está alineado; no requiere cambios E.
- **Wizard v3 / onboarding existente** — E.4 lo extiende pero no lo reemplaza.
- **Métricas internas (PostHog, Sentry)** — se mencionan colateral pero no son scope.
- **Pricing/billing impact del nuevo perfil** — sin cambios; perfil es gratis.

---

**Fin del audit. Sin cambios aplicados. Doc generado para informar Commits E.1 → E.4.**
