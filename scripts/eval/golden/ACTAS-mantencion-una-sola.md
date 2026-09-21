# Actas del re-baseline · la provisión de mantención es una (21-sep-2026)

Decisión de producto (Fabrizio): el mes de la tabla del capítulo II y el año 1 del loop de proyecciones
salen de LA MISMA función, `provisionMantencionAnio` (`src/lib/modelo-costos.ts`). Hasta acá había dos:
`calcMetrics` respetaba la provisión declarada y usaba la antigüedad real; el loop la ignoraba y usaba
otra antigüedad. Medido sobre 1.213 filas LTR: 328 con dos mantenciones distintas (p50 $16.813/mes).

Las tres reglas, y por qué mueven cifras:

1. **La provisión declarada se respeta y se reajusta con la inflación de costos**, en los dos lados. El
   número del usuario es el número: si declaró 30 mil para un depto nuevo, sabe algo que la fórmula no,
   y envejecerlo además es cobrarle dos veces. El loop antes la ignoraba y usaba la fórmula → mueve la
   TIR en las filas con declarada (683 en el parque; GS-2 y GS-7 acá, con declarada por sobre la fórmula:
   la TIR baja).
2. **El reset por CapEx (v3) también en metrics**: con puesta a punto pagada el día 1 el depto parte en
   antigüedad 0. Metrics cobraba la mantención de la edad real ADEMÁS del CapEx → el flujo del mes sube
   en las seeds v3 con CapEx (GS-3, GS-4, GS-5, GS-6, GS-PJ, BE-caprate, BE-patrimonio,
   BE-sensibilidad) y con él el cap rate y, en tres, el score (+1).
3. **`t = 0` es el primer año operativo en los dos modelos.** El «año 1 ⇒ antigüedad + 1» de legacy era
   un off-by-one conservado por byte-identidad con análisis viejos, y esa byte-identidad ya no existe:
   las filas se recomputan al cargar con el motor vigente. Ninguna seed es legacy, así que acá no mueve
   nada; en el parque mueve la TIR de 307 filas.

Parque completo con el mismo motor (`scripts/of-mantencion-dos-fuentes.ts`, foto antes/después): flujo
cambia en 30 filas (+$11.934 p50), score en 388 (+1), TIR en 992 (+0,68 pts p50; p10 +0,05), veredictos
3 suben y 0 bajan (4ceafe4c AJUSTA → COMPRAR; 0d058dc5 y 8cc9b9ac BUSCAR → AJUSTA). Ningún veredicto de
seed cambia. Gate: `mantencion-una-sola-catch-test.ts`, verificado en rojo con tres mutaciones.

## LTR (`baseline.json`, 13 seeds) — 17 drifts clase (a), 0 duros

| Seed | Veredicto | Qué cambió | Causa |
|---|---|---|---|
| GS-1 | COMPRAR | nada | v3 sin CapEx (2 años), sin declarada: mismo número. |
| GS-2 | COMPRAR | TIR 12,83 → 11,84 · patrimonio ×3,17 → ×3,01 | Declarada $30.260 para un depto nuevo; el loop antes usaba la fórmula ($3.557) y ahora la declarada, reajustada. Regla 1. |
| GS-3 | AJUSTA | flujo −$66.618 → −$62.932 · cap rate 6,34 → 6,39 | Reset por CapEx: mantención $6.143 → $2.457. Regla 2. |
| GS-4 | BUSCAR | flujo −$361.072 → −$349.755 · cap rate 2,98 → 3,07 | Reset: $14.550 → $3.233. Regla 2. |
| GS-5 | AJUSTA | score 59 → 60 · flujo −$107.628 → −$95.180 · cap rate 4,9 → 5,02 | Reset: $16.005 → $3.557. Regla 2. |
| GS-6 | BUSCAR | score 30 → 31 · flujo −$626.030 → −$614.713 · cap rate 2,92 → 2,98 | Reset: $14.550 → $3.233. Regla 2. |
| GS-7 | BUSCAR | TIR 7,86 → 6,97 · patrimonio ×1,57 → ×1,47 | Declarada $30.914 para un depto nuevo; antes el loop usaba la fórmula. Regla 1. |
| GS-PC1 | BUSCAR · pie cero | nada | Nuevo, sin CapEx ni declarada. |
| GS-PC2 | COMPRAR · pie cero | nada | Ídem. |
| GS-PJ | AJUSTA | score 69 → 70 · flujo −$31.677 → −$22.624 · cap rate 5,66 → 5,8 | Reset: $11.640 → $2.587. Regla 2. |
| BE-caprate | COMPRAR | flujo +$277.726 → +$282.091 · cap rate 9,92 → 9,97 | Reset: $7.275 → $2.910. Regla 2. El filo del cap rate no se toca. |
| BE-patrimonio | BUSCAR | flujo −$429.365 → −$424.515 · cap rate 2,63 → 2,67 | Reset: $8.083 → $3.233. Regla 2. |
| BE-sensibilidad | COMPRAR | flujo +$30.836 → +$34.716 · cap rate 6,55 → 6,59 | Reset: $6.467 → $2.587. Regla 2. |

`accept.ts` corrido el 21-sep-2026 con `GOLDEN_ASOF`; las 13 filas `GOLDEN::` se re-sembraron el mismo
día (cuartiles), así que el sello coincide.
