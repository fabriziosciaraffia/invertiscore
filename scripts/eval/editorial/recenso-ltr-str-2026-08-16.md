# Re-censo editorial LTR + STR — 2026-08-16 (el examen del ciclo §1.12)

> **NUEVA REFERENCIA.** Esta corrida reemplaza a la línea base del 2026-08-13
> (`censo-ltr-str-2026-08-13.md`). El roster completo con UUIDs y los scores por
> informe están committeados en `recenso-ltr-str-2026-08-16.censo.json` — el
> próximo delta puede ser 1:1 (lección del roster perdido de la línea base).

## 0. Corrida

- **Cohorte**: 177 informes (LTR 139 · STR 38) — reconstrucción de la línea base
  por corte de fecha (`created_at ≤ 2026-08-13`, con prosa IA). El roster exacto
  de los 174 originales se perdió (outputs untracked en un worktree removido);
  la reconstrucción sobreestima ~3 filas que el censo original excluyó por pv
  vieja. **El delta de este reporte es a nivel de distribución**, con
  spot-checks por ID sobre los ejemplos citados en el reporte base.
- **Prosa FRESCA** (`censo.ts --prosa-fresca`): generada con los prompts
  vigentes (LTR pv4 · STR pv4), `persist:false` — cero escrituras; mide el
  informe que el usuario ve tras el lazy-regen. Zona (`zone_insight`) y cards
  van persistidas/recomputadas como en el render real.
- Juez Opus ×2 + merge Sonnet, dimensiones 1-7 + 9-13. **USD 125,95**
  (presupuesto 125, freno 250 intacto) · 133,6 min · **0 errores**.
- Golden previo a la corrida: FULL VERDE (0 duras; 4 softs conocidos), con los
  seeds nuevos GS-PJ/GE-PJ congelados + checks duros B-PJ/BS-PJ de la detección.

## 1. Headline

| Métrica | Línea base (174) | Re-censo (177) | Δ |
|---|---|---|---|
| ALTAs confirmadas (fallas) | 65 (60 LTR · 5 STR) | **48** (44 LTR · 4 STR) | **−26%** |
| Informes con ≥1 AC | 50 (46 LTR 34% · 4 STR 11%) | **41** (39 LTR 28% · 2 STR 5%) | −18% |
| Informes limpios | 0 | 0 | = (D4-media es endémica de la rúbrica) |

## 2. Tabla lado a lado (AC/AD/M/B)

| Dim | LTR base (137) | LTR re-censo (139) | STR base (37) | STR re-censo (38) |
|---|---|---|---|---|
| D1 progresión | 0/0/49/0 | 0/0/41/0 | 0/0/4/0 | 0/0/5/0 |
| D2 promesas | 1/4/18/1 | 1/5/9/0 | 0/0/6/0 | 0/0/4/0 |
| **D3 coherencia** | **46/71/92/8** | **33/63/110/2** | 2/4/13/2 | **0**/1/15/0 |
| D4 claridad | 0/0/154/14 | 0/0/196/5 | 0/0/81/0 | 0/0/91/4 |
| D5 gramática/voz | 8/2/35/1 | 7/1/57/7 | 0/1/7/1 | 2/0/7/0 |
| D6 accionabilidad | 0/0/27/14 | 0/0/25/16 | 0/0/14/4 | 0/0/9/2 |
| D7 voz Franco | 0/0/2/3 | 0/0/2/7 | 0/0/3/4 | 0/0/2/4 |
| D9 lector-30% | 0/0/38/0 | 0/0/37/1 | 0/0/24/1 | 0/0/21/2 |
| **D10 cifra sin ancla** | **4**/13/56/2 | **0**/10/59/0 | **2**/0/10/0 | **0**/0/15/0 |
| **D11 tensión numérica** | 1/6/26/2 | 3/6/**12**/2 | 0/0/6/1 | 0/0/2/0 |
| **D12 veredicto↔pirámide** | 0/**7**/11/1 | 0/**4**/18/1 | 1/5/9/0 | 2/2/10/2 |
| D13 no-recitación | 0/0/28/3 | 0/0/34/0 | 0/0/8/1 | 0/0/12/4 |

Nota honesta sobre D3: parte de la caída 46→33 es mecánica — la prosa fresca
elimina por construcción las clases drift `IA-recalcula` (17) y `doble-redondeo`
(4) del diagnóstico D3. El residuo de 33 AC es coherencia editorial genuina del
prompt pv4, no drift. Y la frontera D3/D11 es fluida en el juez: la vista
combinada D3+D11 va de 47 AC → 36 AC.

## 3. Lo que la ola §1.12 sí movió (sus blancos directos)

1. **D10 — anclas de negociación sin origen: AC 6 → 0** (4 LTR + 2 STR → cero).
   La familia grande del censo base (primera oferta y techo sin narrativa de
   origen) desapareció del nivel confirmado; quedan 10 AD LTR (una corrida).
2. **Los 19 "destino-doctrina"** (cifras sanas + veredicto degradado): **15/19
   quedaron limpios en D11+D12**. Sobreviven: `04dafb00` (D12 AC ×2, ver §4),
   `71512dec` (D11 alta débil), `1b622c91` y `8bda5e13` (D11/D12 media).
3. **Los 13 del hallazgo E.2** (gates LTR sin glosa): **12/13 sin ninguna falla
   D12**. El puerto de `hero:motivos` a LTR + las glosas de gate funcionaron.
   Spot-checks: `4daf13eb` (el misfire que motivó la pata vm) limpio en D11+D12;
   `7710a017` limpio en D10/D11/D12 (su única AC ahora es voseo, ver §4.5).
4. **STR D3: AC 2 → 0** y D11 STR bajó a 0/0/2/0.

## 4. Lo que sobrevive — 5 fallas clasificadas

1. **`51acbc01` / `6c7b3cd8` / `bbcb0448` — D3 AC: N descuentos conviviendo sin
   jerarquía.** *"El concepto de 'descuento que resuelve el problema' aparece
   con al menos cuatro cifras distintas (27%, 23,6%, 31,4%, 54,6%) … sin que
   ninguna explique cuál manda"* (51acbc01). Es el patrón dominante de las 33 AC
   D3: el orden único C-umbral y la REGLA 8 ("un precio protagonista") existen
   en el prompt pero **no se enforcan** — la IA sigue sembrando break-even de
   caja, umbral de veredicto y techo como si fueran intercambiables.
   **Clase: enforcement, no doctrina.** Candidato: colapso pre-digerido (el
   builder entrega UN precio protagonista y rotula los demás como subordinados
   con su glosa) o guard determinístico de conteo, según la lección
   "presupuesto de palabras: enforcement o relajar".
2. **`05462488` — referencias de valor en pugna (7 AD: D3×3, D11×2, D12, D10).**
   El mismo depto es "entras barato" (−7% vs mediana) y "107% sobre el valor de
   la zona" en el mismo informe, con prosa fresca pv4. La detección precio-justo
   §1.12 correctamente NO dispara (vm diverge del precio), pero el informe queda
   esquizofrénico. **Clase: motor-side — dos referencias de valor sin árbitro.**
   Destino: el goal aparte (b) zona↔prosa / referencia única de valor.
3. **`e42f9e9f` — D3 AC: mediana con dos lecturas.** Respuesta y card dicen "25%
   bajo mediana"; la zona dice "en línea con la mediana". **Clase: cachés-zona**
   (la clase de 5 casos del diagnóstico D3 que la prosa fresca no elimina:
   `zone_insight` persistido convive con prosa regenerada — y es lo que el
   usuario ve de verdad). Destino: mismo goal (b).
4. **`04dafb00` — D12 AC ×2 (STR, BUSCAR por gate legal).** El índice y las ~10
   cards "A favor" empujan contra el veredicto; la card de sensibilidad titula
   "el veredicto aguanta" celebrando robustez que no decide. Segunda corrida que
   lo confirma: **la glosa del gate es necesaria pero no suficiente — la
   pirámide/cards no median.** Clase: motor/cards, fuera del alcance del prompt.
5. **Voseo argentino en la prosa fresca — 8 de 10 ALTAs D5, ~30 menciones en
   todas las severidades.** "Comprometés" (`7710a017`), "cerrás" (`d2a5b32e`),
   "descartás/eliminás" (`de1f3e8d` STR), "comprometieras" (×4). **Clase:
   registro de generación.** Candidato: guard determinístico code-side con retry
   (patrón drift-guard/engine-isms) — NO una NOT-list en el prompt (enumerar
   tokens prohibidos los prima).

Menor pero registrado: D11 LTR subió 1→3 en AC (con las medias a la mitad,
26→12) — los tres casos son puentes aritméticos ausentes con arriendo declarado
sobre mercado (`bc1017b7`, `6c9e672e`, `66250396`), pariente de la clase 3.
D4-media subió (154→196 LTR): prosa fresca más densa; sin acción, es el ruido
de fondo de la rúbrica.

## 5. Seeds y flags del FULL

- GS-PJ (LTR) y GE-PJ (STR) quedaron congelados con checks duros de la
  detección (`B-PJ`/`BS-PJ`). Ambos calibran **recuperables** (AJUSTA): fijan la
  detección y el bloque, **no** la variante estructural del cierre ("la zona no
  rinde"). El re-censo no muestra fragilidad en esa variante (0 fallas la
  mencionan), así que el seed irrecuperable queda como candidato futuro, sin
  urgencia.
- Flags semánticos de GS-PJ en el FULL (report-only, coinciden con patrones del
  parque): "un vendedor con **urgencia real**" endurece la banda canónica
  ("vendedor motivado") e invoca una señal que el bloque-caso prohíbe; comunas
  alternativas afirmadas con "plusvalía histórica positiva" **sin fuente** en el
  bloque-caso. Ambos son alimentos para el goal de enforcement (§4.1).

## 6. Veredicto del ciclo §1.12

**La ola movió exactamente lo que apuntó y no movió lo que no apuntó.** Anclas
con origen (D10 AC → 0), gates glosados (12/13 E.2 limpios), el subconjunto
destino-doctrina desarmado (15/19). Lo que queda confirmado NO pide más
doctrina: pide (a) **enforcement del precio protagonista** (la falla dominante
residual, 33 AC D3), (b) el goal **referencia única de valor / zona↔prosa**
(clases 2-3), (c) un **guard de registro** (voseo), y (d) un goal motor-side de
**mediación de cards** (clase 4, dos veces confirmada).

**Pregunta abierta A (escenario combinado): el parque no la pide.** Ninguna
falla residual reclama combinar palancas; reclaman jerarquía entre los números
que ya existen. Recomendación: mantenerla DESPUÉS, sin goal propio todavía.
