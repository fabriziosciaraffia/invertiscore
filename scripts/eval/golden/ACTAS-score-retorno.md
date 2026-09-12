# Actas del re-baseline · rentabilidad sobre lo puesto en el score (12-sep-2026)

Decisión de producto (Fabrizio): el score mira el retorno sobre lo que pone el comprador, no solo el
activo. Cash-on-cash y TIR entran como dimensiones ponderadas —esquema A, curva calibrada al parque—
en las dos modalidades (`src/lib/score-retorno.ts`). Las puertas del flujo no se tocan. Pie cero: el
cash-on-cash usa el rendimiento neto sobre el precio; la TIR no aplica y reparte su peso.

Todas las seeds mueven `score` (campo drift, tolerancia 0), porque cambian los pesos. Ningún veredicto
cambia. Dos coronas cambian (GS-6, GS-7), por las decisividades. Medido con `runner.ts --all` antes del
`accept.ts` / `str-accept.ts`; el parque completo, con el mismo motor: LTR 8 de 1.204 veredictos cambian
(3 AJUSTA → COMPRAR, 3 AJUSTA → BUSCAR, 2 COMPRAR → AJUSTA), STR 4 de 249 (3 BUSCAR → AJUSTA, 1 AJUSTA →
COMPRAR), ninguno baja en STR.

## LTR (`baseline.json`, 13 seeds)

| Seed | Veredicto | Score viejo → nuevo | CoC · TIR · flujo | Acta |
|---|---|---|---|---|
| GS-1 | COMPRAR | 81 → 87 | 11,4 % · 21,3 % · +$210k | Retorno alto sobre lo puesto: CoC 11,4 puntúa 99 y TIR 21,3 puntúa 100; suben las dos dimensiones nuevas y el score con ellas. |
| GS-2 | COMPRAR | 70 → 72 | −1,0 % · 12,8 % · −$18k | Estaba en el corte exacto. La TIR 12,8 (82 puntos) pesa más que el CoC apenas negativo (70). Con la curva absoluta caía a AJUSTA; con la calibrada se afirma. |
| GS-3 | AJUSTA | 69 → 68 | −3,5 % · 10,0 % · −$67k | CoC −3,5 puntúa 63, TIR 10 puntúa 73: ambas bajo lo que valían rentabilidad y plusvalía en esta fila. Un punto menos, mismo veredicto. |
| GS-4 | BUSCAR | 39 → 39 | −12,2 % · 4,7 % · −$361k | CoC muy negativo (35) y TIR baja (46) compensan exactamente lo que ceden rentabilidad y plusvalía: no se mueve. Su único drift es el sello del seed contra la base (pre-existente, `seed-db.ts` escribe en base y queda fuera de este goal). |
| GS-5 | AJUSTA | 58 → 59 | −4,8 % · 9,4 % · −$108k | TIR 9,4 (71) compensa el CoC −4,8 (58). Un punto más. |
| GS-6 | BUSCAR · **corona flujo_mensual (antes sobreprecio)** | 37 → 30 | −27,9 % · 4,3 % · −$626k | CoC −27,9 satura la curva en 5 y la TIR 4,3 da 43: siete puntos menos. La corona cambia porque neutralizar el flujo también neutraliza el cash-on-cash (la dimensión nueva): Δscore ≥ 25 → decisividad 1,00, igual que sobreprecio (1,00 / magnitud 1,00); el desempate lo da el orden de emisión. Es más honesto: el problema de esta fila es el flujo de −$626k, no el precio. |
| GS-7 | BUSCAR · **corona flujo_mensual (antes sobreprecio)** | 40 → 33 | −26,6 % · 7,9 % · −$329k | Mismo mecanismo que GS-6: CoC saturado en 5, flujo_mensual pasa de decisividad 0,85 a 1,00 y empata con sobreprecio. |
| GS-PC1 | BUSCAR · pie cero | 51 → 58 | no aplica · no aplica · −$392k | Sin pie: el CoC usa el rendimiento neto sobre el precio y la TIR reparte su peso. Sube siete puntos y sigue BUSCAR por G1 (flujo severo): la puerta del flujo decide, como se pidió. |
| GS-PC2 | COMPRAR · pie cero | 75 → 80 | no aplica · no aplica · +$89k | Ídem: rendimiento neto sobre el precio en vez de un neutro. Con el neutro 45 esta fila era una de las que caían a AJUSTA por no tener pie. |
| GS-PJ | AJUSTA | 68 → 69 | −2,0 % · 11,2 % · −$32k | TIR 11,2 (79) por encima de la media de sus dimensiones; CoC −2 (68) en línea. |
| BE-caprate | COMPRAR | 78 → 86 | 14,6 % · 23,9 % · +$278k | Retorno alto sobre lo puesto: las dos dimensiones nuevas saturan en 100. El filo del cap rate (5,0 / 4,9) no se toca. |
| BE-patrimonio | BUSCAR | 34 → 33 | −13,8 % · 3,8 % · −$429k | CoC 30, TIR 41. Un punto menos. |
| BE-sensibilidad | COMPRAR | 71 → 75 | 1,6 % · 14,1 % · +$31k | TIR 14,1 (89) y CoC positivo (78): sube cuatro. El filo de la sensibilidad no se toca. |

## STR (`str-baseline.json`, 7 seeds)

| Seed | Veredicto | Score viejo → nuevo | CoC · TIR · flujo | Acta |
|---|---|---|---|---|
| GE-1 | COMPRAR | 78 → 78 | 0,5 % · 11,2 % · +$15k | CoC 75 y TIR 77, en línea con sus otras dimensiones: el score no se mueve. |
| GE-2 | AJUSTA | 64 → 64 | −3,4 % · 7,6 % · −$99k | CoC 63, TIR 61: sin movimiento. |
| GE-4 | AJUSTA | 58 → 63 | 3,4 % · 14,0 % · +$97k | La fila con mejor retorno sobre lo puesto de las siete (CoC 83, TIR 90): cinco puntos más, sigue AJUSTA por el brazo g2_ltrGana (LTR gana). |
| GE-5 | AJUSTA | 57 → 58 | −3,9 % · 8,6 % · −$103k | Un punto más. |
| GE-6 | BUSCAR | 37 → 40 | −8,5 % · 4,4 % · −$286k | Tres puntos más, sigue BUSCAR por G1. |
| GE-PC | AJUSTA · pie cero · puro gate | 77 → 79 | no aplica · no aplica · −$44k | Sin pie: rendimiento neto sobre el precio (el cap rate) en la dimensión de CoC y la TIR reparte. Sigue AJUSTA por g2_flujoSinHorizonte, como antes: el horizonte no se puede medir sin capital propio. |
| GE-PJ | AJUSTA | 64 → 64 | −3,4 % · 7,6 % · −$99k | Sin movimiento (misma fila que GE-2 con la mediana alineada). |

## AMBAS (`ambas-baseline.json`)

Sin drift: las siete AG-* conservan veredicto comparativo, banda, fragilidad y flip. El comparativo lee
los scores de los hijos solo como número.

## Tiers que se ajustaron con acta

- `salida-str-copy-catch-test.ts` bloque 1: la seed `estructuralMixStr` pedía «un descuento de 17,5 %»
  hardcodeado; con el score nuevo la celda del mix cruza a COMPRAR con −15 % (con más pie el retorno
  cuenta antes). El tier pasa a leer el descuento del motor: lo que fija es que el cierre diga el mismo
  número que `descuentoQueAdemásPide`, no cuál es.
