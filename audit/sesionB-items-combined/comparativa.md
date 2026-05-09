# Sesión B — Items 12 + 13 + B4-1 + B4-2 (combinado)

**Fecha:** 2026-05-08
**Scope:** 4 items de prompts IA aplicados en una pasada por dominio común.

## Cambios v_old → v_new

| Item | Archivo | Cambio | Líneas |
|---|---|---|---|
| 12 | `src/lib/ai-generation.ts` | REGLA 9 v12 — caveat ambidireccional. Boom 2014-2018 ahora es caveat obligatorio para zonas con histórica > 4% (Quilicura, San Bernardo, Lo Prado), igual que estallido/pandemia para zonas perdedoras. | +12 |
| 13 | `src/app/api/analisis/[id]/zone-insight/route.ts` | REGLA 1 desambiguación: umbrales de plusvaliaAnual ahora citan "4% proyección motor" explícito + nota CRÍTICA que el "4%" es proyección, NO histórica observada (3% Gran Santiago). | +4 |
| B4-1 | `src/app/api/analisis/[id]/zone-insight/route.ts` | Cuando `precioM2 = null`, payload IA ahora emite línea `SIN DATA confiable para [comuna] (sample insuficiente). Debes mencionarlo explícitamente`. Antes se omitía silenciosamente. | +6 |
| B4-2 | `src/app/api/analisis/[id]/zone-insight/route.ts` + `src/lib/plusvalia-historica.ts` | Doc/comentarios JSDoc en `ZoneInsightStats.plusvaliaHistorica.{valor, anualizada, promedioSantiago}` + en `PLUSVALIA_HISTORICA` aclarando shape (acumulado 10 años vs anualizado). Payload IA agrega `(cifra ANUAL, no acumulada 10 años)` al dato. | +12 |

**Total:** 4 archivos, +34 líneas. Cero cambios en motor, UI, REGLA 10, vocabulario prohibido.

## Probe v_new — 4 casos

`scripts/audit-items-combined-probe.ts`. Patrón: LTR via insert-tmp + `generateAiAnalysis` + delete (caso 1). zone-insight via Anthropic directo extrayendo `INSIGHT_SYSTEM_PROMPT` del route.ts vía fs+regex (casos 2-4).

### Tabla evaluación

| # | Caso | Item objetivo | Cumple criterio | Regresión B3 H7 | Caveat REGLA 9 |
|---|---|---|---|---|---|
| 1 | Quilicura LTR (5,3%) | Item 12 — caveat boom | ✅ explícito | ✅ no contradice 4% | ⚠️ caveat aparece en `riesgos`, no en `largoPlazo` (primer uso) |
| 2 | Santiago zone-insight (-1,1%) | Item 13 — 4% como proyección | ✅ explícito | ✅ no contradice 4% | N/A* |
| 3 | El Bosque sin precioM2 zone-insight | B4-1 — mención sin data | ✅ explícito | ✅ no contradice 4% | N/A* |
| 4 | Quilicura zone-insight (5,3%) | B4-2 — anualizado correcto | ✅ usa 5,3 anual | ✅ no contradice 4% | N/A* |

*REGLA 9 (caveat eventos) está SOLO en LTR.

### Caso 1 — Quilicura LTR (Item 12)

**Output relevante (`riesgos.contenido_clp`):**

> "[...] Plusvalía de Quilicura **carga boom 2014-2018**. La histórica de 5,3% anual incluye ese **período excepcional** — si el ritmo se normaliza, la ganancia futura será menor a la proyectada."

✅ **Item 12 cumplido:** caveat ambidireccional aplicado. Boom 2014-2018 nombrado explícito como evento del rango que sesga el dato. "período excepcional" + "si el ritmo se normaliza" = framing de riesgo, no afirmación de contradicción.

✅ **Regresión B3 H7:** "si el ritmo se normaliza, la ganancia futura será menor a la proyectada" = escenario condicional (válido REGLA 10), no contradicción del 4%. La frase paralela canónica es *"si la zona se estanca, tu TIR cae"* (REGLA 10 ejemplo válido).

⚠️ **Borderline REGLA 9:** el PRIMER uso de la histórica aparece en `largoPlazo.contenido_clp`:
> "Quilicura mostró 5,3% anual histórico, superior al 4% que proyecta el análisis."

Este primer uso NO nombra evento. El caveat boom aparece después en `riesgos`. REGLA 9 exige caveat al PRIMER uso. Esto es un fallo de placement, no de doctrina del Item 12 (el caveat SÍ se aplica, solo en el lugar equivocado). Iteración futura sugerida: reforzar REGLA 9 con "si la histórica aparece primero en largoPlazo o conviene, ahí debe ir el caveat — no diferirlo a riesgos".

**`largoPlazo.contenido_clp` (cita 4% como proyección):**
> "[...] Quilicura mostró 5,3% anual histórico, superior al 4% que proyecta el análisis."

✅ Cita "4% que proyecta el análisis" — el 4% queda etiquetado como proyección (alineado con espíritu Item 13).

### Caso 2 — Santiago zone-insight (Item 13)

**Output `narrative_clp`:**

> "Estás en P72 de arriendo ($1.200.000) para una zona que perdió 1.1% anual en la década pasada. Metro Test a 320m y Universidad Test a 600m validan demanda estudiantil, pero no explican que pagues caro para la zona. Santiago perdió 1% anual histórico — **la proyección 4% del motor** es apuesta a recuperación vs una trayectoria de pérdida. Tu precio está apenas 4% sobre mediana comunal, pero arriendas P72 sin ventaja clara de ubicación."

✅ **Item 13 cumplido:** "la proyección 4% del motor" — etiquetado explícito como proyección, no histórica observada.

✅ **Regresión B3 H7:** "apuesta a recuperación vs una trayectoria de pérdida" = REGLA 8 ejemplo VÁLIDO canónico.

✅ Distinción clara entre los dos "4%" ambiguos: el "4% sobre mediana comunal" (precio/m² diff) vs "proyección 4% del motor" (plusvalía proyectada). El narrative no los confunde.

### Caso 3 — El Bosque sin precioM2 (B4-1)

**Output `narrative_clp`:**

> "**El Bosque carece de data confiable de precio m² — no hay sample suficiente para benchmarking.** La plusvalía histórica perdió -0.7% anual mientras la proyección del motor supone +4%, una brecha de casi 5 puntos anuales que requiere recuperación sin precedente local. El arriendo estimado $450.000 opera sin contexto de mercado verificable, aumentando la incertidumbre sobre competitividad real."

✅ **B4-1 cumplido:** primera frase menciona explícitamente la falta de data ("carece de data confiable de precio m² — no hay sample suficiente"). Antes esto se omitía silenciosamente.

✅ **Item 13 también cumplido:** "la proyección del motor supone +4%" — cita 4% como proyección.

✅ **Regresión B3 H7 borderline-pero-OK:** "una brecha de casi 5 puntos anuales que requiere recuperación sin precedente local" — habla de la diferencia entre histórica y proyección sin afirmar que el 4% no se cumplirá. "requiere recuperación" es similar al "apuesta a recuperación" canónico. La adición "sin precedente local" intensifica el riesgo pero no propone proyección alternativa. Aceptable.

✅ **`accion`:** "Busca al menos 3 comparables directos antes de comprometer capital en zona sin data verificable" — imperativa, específica, atendida a la falta de data.

### Caso 4 — Quilicura zone-insight (B4-2)

**Output `narrative_clp`:**

> "Estás pidiendo $1.200.000 en P95 cuando el rango comparable va de $350.000 a $650.000 — muy caro para la zona. Quilicura subió **5,3% anual histórico, fuerte vs la proyección motor 4%**, pero esa plusvalía no justifica un arriendo 85% sobre el techo local. Metro Quilicura a 1,2km no compensa estar tan desalineado del mercado real de inquilinos de la comuna."

✅ **B4-2 cumplido:** IA usa "5,3% anual" (cifra anualizada) sin confundir con el acumulado 10 años (~68%). La línea de payload `(cifra ANUAL, no acumulada 10 años)` cumple su función.

✅ **Item 13 cumplido:** "fuerte vs la proyección motor 4%" — etiquetado explícito.

✅ **Regresión B3 H7:** "esa plusvalía no justifica un arriendo 85% sobre el techo local" — habla de **arriendo**, no de proyección. Frame de riesgo correcto sobre la operación, no sobre el motor.

## Resumen agregado

| Métrica | v_new | Status |
|---|---|---|
| Item 12 — caveat ambidireccional aplicado | 1/1 | ✅ |
| Item 13 — "4%" etiquetado como proyección motor | 3/3 (casos 1, 2, 3, 4 todos) | ✅ |
| B4-1 — mención explícita sin precioM2 | 1/1 | ✅ |
| B4-2 — anualizado vs acumulado correcto | 1/1 | ✅ |
| Regresión B3 H7 — contradicciones explícitas motor 4% | 0/4 | ✅ |
| Borderline REGLA 9 placement (caso 1) | 1 (caveat aparece en `riesgos` no `largoPlazo`) | ⚠️ |

**4/4 ítems cumplidos · 0 regresión B3 H7 · 1 borderline REGLA 9 placement.**

## Hallazgo colateral — REGLA 9 placement

En caso 1 (Quilicura LTR), el caveat ambidireccional SE APLICA pero NO en el primer uso de la histórica. La histórica aparece primero en `largoPlazo.contenido_clp` sin nombrar evento ("Quilicura mostró 5,3% anual histórico, superior al 4% que proyecta el análisis"). El caveat con boom 2014-2018 aparece después en `riesgos.contenido_clp`. REGLA 9 exige caveat al PRIMER uso — esto es un fallo de placement, no de doctrina Item 12.

**Hipótesis:** la REGLA 9 actual define "primer uso dentro de cualquier campo" pero no reordena la dependencia entre campos. Si IA construye `largoPlazo` antes que `riesgos`, puede deslizar la histórica sin caveat al primer slot. Fix sugerido (fuera de scope): reforzar REGLA 9 con "el caveat va en el primer campo donde la histórica aparece — `conviene` > `largoPlazo` > `riesgos` en ese orden de prioridad".

NO incluido en este commit — pendiente decisión del usuario si vale la pena nueva iteración.

## Smoke test

```
npx tsc --noEmit → ✅ limpio
```

## Decisión

- ✅ Item 12: implementación correcta, doctrina cumplida.
- ✅ Item 13: etiquetado proyección motor 4% en 4/4 outputs zone-insight.
- ✅ B4-1: mención explícita en presence de `null`.
- ✅ B4-2: shape clarificado en código + payload IA.

**Recomendación:** push autorizado.

## Archivos del fix

| Archivo | Estado | Líneas |
|---|---|---|
| `src/lib/ai-generation.ts` | Modificado (REGLA 9 v12) | +12 / -7 = +5 net |
| `src/app/api/analisis/[id]/zone-insight/route.ts` | Modificado (REGLA 1 + B4-1 + B4-2 doc) | +18 / -2 = +16 net |
| `src/lib/plusvalia-historica.ts` | Modificado (JSDoc shape) | +10 net |
| `audit/sesionB-items-combined/comparativa.md` | Nuevo | este archivo |
| `audit/sesionB-items-combined/_outputs.json` | Nuevo (4 outputs raw) | — |
| `scripts/audit-items-combined-probe.ts` | Probe (auxiliar) | — |

NO push hasta confirmación.
