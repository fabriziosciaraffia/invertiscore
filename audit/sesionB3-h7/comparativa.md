# Sesión B3 H7 sub-bug 2 — Alinear IA a proyección motor

**Fecha:** 2026-05-05
**Decisión:** mantener plusvalía histórica como contexto en prompts + agregar regla canónica que disciplina la jerarquía. Motor 4% canónico; histórica = framing de riesgo, NO proyección alternativa.

## Cambios en prompts

| Archivo | Inserción | Líneas |
|---|---|---|
| `src/lib/ai-generation.ts` | REGLA 10 — Plusvalía: jerarquía canónica IA ↔ motor (después de REGLA 9, antes del schema JSON) | +33 |
| `src/app/api/analisis/[id]/zone-insight/route.ts` | REGLA 8 — Plusvalía: jerarquía canónica IA ↔ motor (después de REGLA 7, antes de FORMATO DE MONTOS) | +24 |

**Líneas netas totales:** +57 / 0 deleciones. Cero cambios en motor, UI, cálculos, REGLA 9 caveat Fase 3.9, vocabulario prohibido.

## Probe IA real — v_new (10 outputs Sonnet 4)

5 casos × 2 outputs (LTR + zone-insight) generados con `scripts/audit-b3h7-probe.ts`.

### Tabla resultados

| # | Caso (comuna) | Plusv. histórica | Output | Contradice motor 4% (regex estricto) | Histórica con framing canónico | Caveat Fase 3.9 | Observación |
|---|---|---|---|---|---|---|---|
| 1 | Providencia | +3,0% | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | "creció 3% anual histórico — la proyección a 4% queda ligeramente más optimista que la trayectoria observada" |
| 1 | Providencia | +3,0% | zone-insight | NO ✅ | NO* | N/A* | Cita 4% sin contradicción; framing implícito vía "la proyección 4% queda" |
| 2 | Santiago | -1,1% | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | "perdió 10% en 2014-2024 (-1,1% anual) — el rango incluye estallido 2019 y vacío post-pandemia. La proyección a 4% del motor es una apuesta a recuperación que la zona aún no muestra." |
| 2 | Santiago | -1,1% | zone-insight | NO ✅ | SÍ ✅ | N/A* | "perdió 1,1% anual histórico — la proyección 4% del motor es apuesta a recuperación tras una década de pérdida" |
| 3 | Ñuñoa | +3,2% | LTR | **borderline** ⚠️ | SÍ ✅ | SÍ ✅ | "Plusvalía de Ñuñoa no sostiene la apuesta a largo plazo. Necesitas que la zona crezca sobre su promedio histórico para justificar el aporte..." Sutil pero NO afirma proyección distinta al 4%; describe el riesgo. |
| 3 | Ñuñoa | +3,2% | zone-insight | NO ✅ | NO* | N/A* | Cita 4% sin contradicción; framing implícito |
| 4 | ComunaSinData | null | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | "Sin data histórica suficiente — la proyección a 4% del motor es supuesto puro, sin verificación local" |
| 4 | ComunaSinData | null | zone-insight | NO ✅ | SÍ ✅ | N/A* | "Sin data histórica para esta comuna; proyección 4% es supuesto sin ancla local" |
| 5 | Quilicura | +5,3% | LTR | NO ✅ | SÍ ✅ | NO ⚠️ | "creció 5,3% anual entre 2014-2024 — la proyección a 4% del motor es conservadora versus lo que la zona ya mostró". REGLA 9 falla: no nombra eventos del rango (estallido/pandemia/boom). Pre-existe a B3 H7. |
| 5 | Quilicura | +5,3% | zone-insight | NO ✅ | SÍ ✅ | N/A* | "subió 5,3% anual histórico — la proyección 4% queda conservadora vs trayectoria observada" |

*N/A en zone-insight: REGLA 9 (caveat Fase 3.9 con eventos 2019/pandemia/boom) está SOLO en LTR. zone-insight nunca tuvo esa exigencia. La REGLA 8 nueva NO la introduce — preserva el alcance histórico.

*"NO" en columna framing pero "Cita 4%": el output cita "4%" como canónico pero no etiqueta explícitamente la histórica como contexto de riesgo. El regex de framing buscaba frases como "apuesta a recuperación", "supuesto puro", "ya mostró", etc. Para Providencia y Ñuñoa zone-insight el modelo se enfoca más en POIs y precio/m² que en framing histórica vs proyección. Sin contradicción en ninguno.

### Resumen agregado

| Métrica | Resultado | Status criterio aceptación |
|---|---|---|
| **Contradicciones explícitas motor 4%** | **0 / 10** | ✅ CUMPLE |
| Borderline contradicción sutil | 1 / 10 (Ñuñoa LTR) | ⚠️ Iteración aplicada |
| Framing canónico en outputs sensibles (Santiago, sin-data) | 4 / 4 | ✅ |
| Caveat Fase 3.9 en LTR | 4 / 5 (Quilicura no cita eventos) | ⚠️ Pre-existe REGLA 9 |
| Caveat Fase 3.9 en zone-insight | N/A (no era requisito) | ✅ |
| Cita "proyección 4% / proyección a 4%" como canónica | 8 / 10 mencionan al menos 1 vez | ✅ |

### Observación: borderline Ñuñoa LTR

La frase "Plusvalía de Ñuñoa no sostiene la apuesta a largo plazo" en `riesgos.contenido` es BORDERLINE — no afirma una proyección alternativa explícita pero sugiere que el 4% no se cumplirá. La frase siguiente ("Necesitas que la zona crezca sobre su promedio histórico para justificar el aporte mensual indefinido — si se estanca, pierdes en dos frentes") sí cuadra como escenario condicional (válido).

**Iteración aplicada (sin probe de validación por crédito API agotado):** REGLA 10 reforzada con:
- Línea explícita: `"la plusvalía de [comuna] no sostiene la apuesta"` añadida a la lista PROHIBIDO.
- Aclaración meta: "La diferencia entre RIESGO (válido) y CONTRADICCIÓN (prohibido) es escenario condicional vs afirmación".

La iteración NO se validó con probe IA (saldo Anthropic agotado tras los 10 outputs iniciales). Se propone re-correr Ñuñoa LTR cuando el saldo se restaure para confirmar que el patrón borderline desaparece.

### Observación: Quilicura LTR sin caveat Fase 3.9

REGLA 9 exige nombrar al menos 1 evento del rango (estallido/pandemia/boom) al PRIMER uso de la histórica. Quilicura LTR cita "5,3% anual entre 2014-2024" pero no nombra ningún evento. Esto es **fallo de REGLA 9, no de REGLA 10 nueva**. Pre-existe a Sesión B3 H7. Hipótesis: con histórica positiva alta, el modelo siente que el caveat es menos crítico (porque la zona "ganó", no perdió). Fix sugerido fuera de scope: reforzar REGLA 9 con "el caveat aplica también cuando la histórica es positiva — el rango sigue conteniendo eventos atípicos".

## Análisis estático — v_old (sin REGLA 10/8)

Estado del prompt PRE-fix B3 H7:

### LTR — `src/lib/ai-generation.ts` (estado pre-fix)

**Texto relevante a plusvalía:**

```
## 8. Disciplina sobre afirmaciones — qué Franco se permite

5. Plusvalía histórica de la comuna (cuando viene en el input):
   OBLIGATORIO mencionarla en `conviene.respuestaDirecta` o `conviene.reencuadre` cuando:
   - plusvaliaHistoricaAnualizada < 2% (zona estancada)
   - plusvaliaHistoricaAnualizada negativa (zona perdiendo valor)
   - Ángulo 3 (instrumentos) sería invalidado sin contexto histórico (la comparación TIR vs depósito/fondo asume plusvalía estable o creciente; si la zona está perdiendo valor, hay que explicitarlo).

   Forma: diagnóstico + implicancia.
   Ejemplo: "Santiago centro creció 0,8% anualizado en la última década — apostar a recuperación de plusvalía es la apuesta central de este caso, no un colchón."

REGLA 9 — Plusvalía histórica: caveat temporal obligatorio (v11)
[caveat eventos 2019/pandemia/boom]
```

**Frases prohibidas explícitas relacionadas con la jerarquía motor↔histórica:** **NINGUNA.** El prompt v_old:
- Exige caveat temporal (REGLA 9) ✅
- Exige mencionar histórica negativa o estancada (REGLA 8 §5) ✅
- NO disciplina la jerarquía proyección motor 4% canónica ↔ histórica ⚠️
- NO prohíbe construcciones tipo "el motor sobreestima" o "tu plusvalía real será X%" ⚠️

**Riesgo identificable de contradicción (v_old):** **ALTO.**
- Caso Santiago histórica negativa: el ejemplo del propio prompt v8 §5 dice *"Santiago centro creció 0,8% anualizado en la última década — apostar a recuperación de plusvalía es la apuesta central"*. Es framing válido. Pero NADA en v_old impide al modelo continuar con *"el motor sobreestima asumiendo 4% en una zona que perdió valor"*.
- Casos histórica < 4% (Providencia, Ñuñoa): mismo riesgo.

### Zone-insight — `src/app/api/analisis/[id]/zone-insight/route.ts` (estado pre-fix)

**Texto relevante a plusvalía:**

```
REGLA 1 — INTERPRETA STATS, NO LOS RECITES
[...]
plusvaliaAnual:
  < 3% → "débil vs Santiago (~4% promedio)"
  3–5% → "en línea con Santiago"
  > 5% → "fuerte"
```

**Frases prohibidas relacionadas con jerarquía motor↔histórica:** **NINGUNA.** El umbral cualitativo "(~4% promedio)" es benchmark histórico (PLUSVALIA_DEFAULT.anualizada=3.0%), no la proyección motor — pero el "4%" puede ser confundido por el modelo con la proyección.

**Riesgo identificable de contradicción (v_old):** **MEDIO.** REGLA 1 cualitativa puede generar narrativa tipo "tu plusvalía será débil en esta zona" que el usuario interpreta como afirmación sobre la proyección 4% del motor. Sin nada que disciplinare eso.

## Sample outputs v_new (caso 2 Santiago — el más sensible)

### Sample LTR (extracto del campo `conviene.reencuadre_clp`)

> "Santiago centro perdió 10% en 2014-2024 (-1,1% anual) — el rango incluye estallido 2019 y vacío post-pandemia. **La proyección a 4% del motor es una apuesta a recuperación que la zona aún no muestra.** Con flujo negativo indefinido, tu retorno depende exclusivamente de que esa apuesta funcione."

**Análisis voz Franco:**
- Diagnóstico: pérdida histórica cuantificada con caveat ✅
- Causa: rango incluye eventos atípicos ✅
- Recomendación implícita: el flujo no cierra → veredicto AJUSTA / consideración de buscar otra ✅
- Cita la proyección 4% como canónica (NO la contradice) ✅
- Frase válida según REGLA 10: "apuesta a recuperación" ✅
- Tuteo chileno neutro ✅

### Sample LTR (extracto del campo `largoPlazo.contenido_clp`)

> "Solo si Santiago se recupera. Con TIR 7,8% versus depósito UF al 5%, la ventaja es menor considerando que el depósito no exige aporte mensual ni asume vacancia. La inversión inmobiliaria te pide $36.120.000 adicionales en 10 años — el depósito, cero. **La apuesta central es que la plusvalía de Santiago revierta su década perdida.**"

✅ Ángulo 3 (instrumentos) ejecutado correctamente: contextualiza esfuerzo, riesgo, iliquidez. NO compara TIR pelado.

### Sample LTR (extracto del campo `riesgos.contenido_clp`)

> "[...] Plusvalía plana mata la inversión. Santiago ya perdió 10% en la década — si los próximos 10 años son neutros en lugar del 4% proyectado, tu TIR cae a territorio negativo."

✅ Escenario condicional ("si los próximos 10 años son neutros") — NO afirma proyección distinta. Cita 4% como canónico. Válido bajo REGLA 10.

### Sample zone-insight (caso Santiago, completo)

```json
{
  "headline_clp": "Pagas prima en comuna que perdió valor",
  "headline_uf": "Pagas prima en comuna que perdió valor",
  "preview_clp": "Santiago perdió 1% anual histórico pero pagas 4% sobre mediana comunal.",
  "preview_uf": "Santiago perdió 1% anual histórico pero pagas 4% sobre mediana comunal.",
  "narrative_clp": "Pagas 4% sobre la mediana de Santiago, llegando a percentil 72 de arriendo para la zona. Santiago perdió 1,1% anual histórico — la proyección 4% del motor es apuesta a recuperación tras una década de pérdida. El metro a 320m y universidad a 600m explican parte de la prima, pero estás apostando a que el centro revierta su trayectoria. Sin malls cercanos, dependes del perfil universitario para sostener demanda.",
  "narrative_uf": "Pagas 4% sobre la mediana de Santiago, llegando a percentil 72 de arriendo para la zona. Santiago perdió 1,1% anual histórico — la proyección 4% del motor es apuesta a recuperación tras una década de pérdida. El metro a 320m y universidad a 600m explican parte de la prima, pero estás apostando a que el centro revierta su trayectoria. Sin malls cercanos, dependes del perfil universitario para sostener demanda.",
  "accion": "Pide comparables recientes: ¿otros departamentos justifican pagar sobre mediana en zona con pérdida histórica?"
}
```

**Análisis voz Franco:**
- D→C→R en narrative ✅
- accion imperativa específica ✅
- Cita 4% como canónica + framing "apuesta a recuperación" ✅
- 4 frases (tope respetado) ✅

## Smoke test build

```
npm run build → ✅ limpio
```

## Decisión final

**Criterio aceptación principal (0 contradicciones explícitas motor 4%):** ✅ CUMPLIDO 10/10.
**Borderline detectado:** 1/10 (Ñuñoa LTR riesgos). Iteración del prompt aplicada SIN probe de validación (saldo API agotado).

**Recomendación:** dado el borderline + iteración no validada empíricamente, **NO push** según el plan ("Si aparece 1+ contradicción: no push, iterar prompt y reportar"). Cuando el saldo Anthropic se restaure, re-correr Ñuñoa LTR para confirmar que el patrón borderline desaparece.

## Hallazgos colaterales (fuera de scope)

1. **REGLA 9 falla en Quilicura** (histórica positiva alta sin caveat de eventos). El modelo probablemente percibe que el caveat es menos crítico cuando la zona "ganó". Fix sugerido (no aplicado): reforzar REGLA 9 con "el caveat aplica también con histórica positiva — el rango sigue conteniendo eventos atípicos".

2. **Zone-insight REGLA 1 mantiene umbral "vs Santiago (~4% promedio)"** que mezcla benchmark histórico (PLUSVALIA_DEFAULT.anualizada = 3,0%) con la cifra de proyección motor (4%). Es ambigüedad latente. Fix sugerido (no aplicado): cambiar a "vs promedio histórico Gran Santiago (~3% anual)" para no usar el "4%" en dos sentidos.

## Archivos del fix

| Archivo | Estado | Líneas |
|---|---|---|
| `src/lib/ai-generation.ts` | Modificado (REGLA 10 inserta + iteración borderline) | +33 |
| `src/app/api/analisis/[id]/zone-insight/route.ts` | Modificado (REGLA 8 inserta) | +24 |
| `audit/sesionB3-h7/comparativa.md` | Nuevo | este archivo |
| `audit/sesionB3-h7/_outputs.json` | Nuevo (10 outputs raw del probe) | — |
| `scripts/audit-b3h7-probe.ts` | Probe (eliminable post-validación) | — |

Sin commit ni push (restricción respetada).
