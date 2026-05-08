# Sesión B3 H7 final — validación post-iteración REGLA 10

**Fecha:** 2026-05-08
**Objetivo:** validar empíricamente que la iteración aplicada en Sesión B3 H7 (saldo API agotado, sin probe de validación) cierra el borderline Ñuñoa LTR ("Plusvalía de Ñuñoa no sostiene la apuesta a largo plazo") sin introducir over-corrección en casos extremos.

## Cambios validados (v_new vs v_old)

REGLA 10 LTR (`src/lib/ai-generation.ts:435-463`) reforzada respecto a v_old con:
- Línea explícita prohibida: `"la plusvalía de [comuna] no sostiene la apuesta"` (afirma que la proyección no se cumplirá).
- Aclaración meta: *"La diferencia entre RIESGO (válido) y CONTRADICCIÓN (prohibido) es escenario condicional vs afirmación: 'si la zona se estanca, tu TIR cae' es válido (riesgo); 'la zona no sostiene la proyección 4%' es prohibido (afirmación)."*
- Nueva entrada en PROHIBIDO: `"la histórica no respalda la proyección" / "no apoya el 4%"`.

REGLA 8 zone-insight (`src/app/api/analisis/[id]/zone-insight/route.ts:417-439`) sin cambios desde Sesión B3 H7 (siempre fue v_new, sin iteración).

## Probe v_new — 3 casos críticos

`scripts/audit-b3h7-final-probe.ts` — inserta análisis sintético en Supabase (admin client), corre `runAnalysis` motor actual, llama `generateAiAnalysis` (LTR) + Anthropic directo (zone-insight con `INSIGHT_SYSTEM_PROMPT`), borra fila tmp. 3 casos × 2 outputs = 6 generaciones IA.

Input fijo (precio UF 5.000, arriendo $1.200.000, dormitorios 2, superficie 50m², 20% pie, tasa 4,11%, 25 años) — única variable: comuna + plusvalía histórica.

### Tabla evaluación

| # | Caso | Plusv. histórica | Output | Contradice motor 4% | Histórica con framing | Caveat Fase 3.9 | Over-corrección |
|---|---|---|---|---|---|---|---|
| 1 | Ñuñoa | +3,2% | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | Borderline cerrado ✅ |
| 1 | Ñuñoa | +3,2% | zone-insight | NO ✅ | SÍ ✅ | N/A* | — |
| 2 | Santiago | -1,1% | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | Sin over-corrección ✅ |
| 2 | Santiago | -1,1% | zone-insight | NO ✅ | SÍ ✅ | N/A* | — |
| 3 | Quilicura | +5,3% | LTR | NO ✅ | SÍ ✅ | SÍ ✅ | Sin over-corrección ✅ |
| 3 | Quilicura | +5,3% | zone-insight | NO ✅ | SÍ ✅ | N/A* | — |

*N/A: REGLA 9 (caveat eventos 2019/pandemia/boom) está SOLO en LTR — zone-insight nunca tuvo esa exigencia.

**6/6 OK · 0 contradicciones explícitas motor 4% · 0 over-corrección detectada.**

### Caso 1 — Ñuñoa (3,2%) — borderline original

**v_old (Sesión B3 H7) — `riesgos.contenido_clp` (PROBLEMÁTICO):**

> "[...] Plusvalía de Ñuñoa no sostiene la apuesta a largo plazo. Necesitas que la zona crezca sobre su promedio histórico para justificar el aporte mensual indefinido — si se estanca, pierdes en dos frentes."

La frase "Plusvalía de Ñuñoa no sostiene la apuesta a largo plazo" fue clasificada como BORDERLINE: no afirma proyección alternativa explícita pero sugiere que el 4% no se cumplirá.

**v_new — `riesgos.contenido_clp` (CERRADO):**

> "[...] Plusvalía 3,2% histórica no justifica precio premium. Ñuñoa creció 3,2% anual entre 2014-2024 — el rango incluye estallido 2019 y boom 2014-2018. Pagas como si fuera zona de alta plusvalía apostando a que supere su trayectoria."

Cambio doctrinal limpio: la frase ahora habla de **precio**, no de **proyección**. "no justifica precio premium" critica el precio que el comprador pagaría versus la trayectoria de la zona, no la cifra del motor. La construcción "apostando a que supere su trayectoria" es escenario condicional (válido REGLA 10).

**LTR `largoPlazo.contenido_clp`:** sin mención de plusvalía. Focus en TIR vs alternativas.

**LTR `conviene.reencuadre_clp`:** sin mención de plusvalía. Focus en verificación de arriendo.

**zone-insight `narrative_clp`:**

> "[...] La plusvalía histórica de 3,2% queda en línea con Santiago, pero no compensa pagar sobreprecio por ubicación sin diferenciadores fuertes."

Cita 3,2% con framing "no compensa pagar sobreprecio" — habla del precio, no de la proyección. ✅

### Caso 2 — Santiago (-1,1%) — caso más sensible

**LTR `conviene.reencuadre_clp`:**

> "Este caso tiene matemática sólida pero contexto complejo. Santiago centro es zona castigada: perdió valor real en la década 2014-2024, cargando estallido social y éxodo post-pandemia. Tu ventaja: comprando a precio que ya genera flujo positivo, no dependes de plusvalía para cerrar los números. El arriendo de $1.200.000 cubre dividendo y gastos con $30K de sobra — eso es colchón operacional inmediato."

- Histórica con framing: "zona castigada", "perdió valor real" ✅
- Caveat Fase 3.9: "estallido social y éxodo post-pandemia" ✅
- Contradice 4%: NO. Inversamente, dice "no dependes de plusvalía" (positiva, descarga de riesgo).

**LTR `largoPlazo.contenido_clp` (FRAMING NOTABLE):**

> "[...] La plusvalía proyectada a 4% anual es optimista para una zona que perdió 1.1% anual histórico."

Análisis: la frase usa el verbo "es optimista" sobre la proyección 4%. Comparada con los ejemplos VÁLIDOS de REGLA 10:
- "la proyección a 4% queda ligeramente más optimista que la trayectoria observada" (Providencia +3%, ejemplo canónico válido)
- "es una apuesta a recuperación que la zona aún no muestra" (Santiago, ejemplo canónico válido)

La construcción "es optimista para una zona que perdió X%" cae dentro del registro válido — describe la posición de la cifra del motor relativa a la observación histórica sin proponer alternativa numérica ni afirmar que no se cumplirá. **No contradice REGLA 10** pero es la frase más cercana al borde de los 6 outputs. Aceptable.

**LTR `riesgos.contenido_clp`:**

> "Plusvalía negativa desploma el retorno. Santiago centro perdió 10% en 2014-2024 — si esa tendencia continúa, tu ganancia viene solo del flujo operacional, no de la venta. [...]"

"si esa tendencia continúa" = escenario condicional. ✅

**zone-insight `narrative_clp`:**

> "Tu arriendo de $1.200.000 cae en percentil 72 — caro para la zona — pero solo pagas 4% sobre la mediana del metro cuadrado. El mix Metro Test + Universidad Test genera demanda estudiantil estable, lo que explica arriendos sostenidos. Santiago perdió 1,1% anual histórico — la proyección 4% del motor es apuesta a recuperación tras una década de caída. El riesgo está en si el centro logra revertir la tendencia de pérdida de valor."

Cita 4% como canónica, frame "apuesta a recuperación" idéntico al ejemplo VÁLIDO en REGLA 8. ✅

### Caso 3 — Quilicura (+5,3%) — control over-corrección al alza

**LTR `conviene.reencuadre_clp`:**

> "Este es el caso atípico donde no aportas mensualmente — el arriendo de $1.200.000 cubre el dividendo de $858.836 y deja utilidad. La comuna tiene trayectoria: Quilicura subió 68% en la década 2014-2024 (5,3% anual histórico), aunque el rango incluye boom 2014-2018 y posterior desaceleración. La proyección a 4% del motor es conservadora versus lo que la zona ya mostró. Tu estructura financiera está calibrada [...]"

✅ Replica casi literal el ejemplo VÁLIDO de REGLA 10: *"Quilicura subió 5,3% anual histórico — la proyección a 4% es conservadora versus lo que la zona ya mostró."*

**LTR `riesgos.contenido_clp`:**

> "[...] Quilicura depende de densificación futura. La plusvalía histórica de 5,3% anual incluye boom 2014-2018 — la proyección a 4% descansa en que la comuna mantenga tracción sin garantía de conectividad premium como otras zonas."

"descansa en que..." = escenario condicional sobre tracción futura. ✅

**LTR `largoPlazo.contenido_clp`:** sin mención de plusvalía. Focus en TIR vs depósito UF / fondo mutuo.

**zone-insight `narrative_clp`:**

> "[...] Quilicura subió 5,3% anual histórico, fuerte vs Santiago, pero desde una base baja que no justifica arriendos premium. [...] La plusvalía histórica sólida no garantiza que puedas sostener este nivel de renta."

"no justifica arriendos premium" / "no garantiza que puedas sostener este nivel de renta" — habla de **arriendos**, no de la proyección 4%. Frame de riesgo correcto sobre la operación, no sobre el motor. ✅

## Resumen agregado

| Métrica | v_old (B3 H7) | v_new (final) | Status |
|---|---|---|---|
| Contradicciones explícitas motor 4% | 0/10 | **0/6** | ✅ Mantenida |
| Borderline (Ñuñoa "no sostiene la apuesta") | 1/10 | **0/6** | ✅ Cerrado |
| Histórica con framing canónico | 8/10 | **6/6** | ✅ Mejor |
| Caveat Fase 3.9 (LTR cuando cita histórica) | 4/5 | **3/3** | ✅ Mantenida (Quilicura ahora SÍ cita evento) |
| Over-corrección al alza (Quilicura) | N/A | **0/2** | ✅ Sin regresión |
| Cita "proyección 4%" como canónica | 8/10 | **6/6** | ✅ Mejor |

## Hallazgo colateral

**Quilicura LTR ahora SÍ nombra evento:** v_old `reencuadre` Quilicura no nombró eventos del rango (fallo REGLA 9 pre-existente). v_new cita "boom 2014-2018 y posterior desaceleración" en `reencuadre_clp` Y en `riesgos.contenido_clp`. Posible que la iteración haya reforzado la cohesión REGLA 9 ↔ REGLA 10 en histórica positiva alta. Aún así, el efecto colateral observado sugiere que el problema pre-existente puede haberse mitigado parcialmente.

## Decisión

**Criterio aceptación principal (0 contradicciones explícitas motor 4% en los 3 casos):** ✅ CUMPLIDO 6/6.
**Criterio borderline (cierre de "no sostiene la apuesta" en Ñuñoa):** ✅ CUMPLIDO.
**Criterio over-corrección (Quilicura no degenera):** ✅ CUMPLIDO 2/2.

**Recomendación:** push autorizado. Iteración valida empíricamente. Limitación honesta: 1 corrida de Sonnet 4 por caso = sample size pequeño; los outputs son no-determinísticos. La doctrina del prompt (REGLA 10 LTR + REGLA 8 zone-insight) muestra adherencia consistente al patrón canónico.

## Archivos del fix

| Archivo | Estado | Líneas (vs B3 H7) |
|---|---|---|
| `src/lib/ai-generation.ts` | Sin cambios desde B3 H7 (REGLA 10 ya iterada) | — |
| `src/app/api/analisis/[id]/zone-insight/route.ts` | Sin cambios funcionales (sólo `export` agregado a `INSIGHT_SYSTEM_PROMPT` para el probe) | +1 token |
| `audit/sesionB3-h7-final/comparativa.md` | Nuevo | este archivo |
| `audit/sesionB3-h7-final/_outputs.json` | Nuevo (3 outputs LTR + 3 outputs zone-insight raw) | — |
| `scripts/audit-b3h7-final-probe.ts` | Probe (eliminable post-validación) | — |

NO push hasta confirmación.
