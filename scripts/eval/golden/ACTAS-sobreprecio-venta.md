# Actas del re-baseline · el sobreprecio de hoy se descuenta plano en la venta (22-sep-2026)

Decisión de producto (Fabrizio, variante B tras medir A, B y C sobre el parque): hasta el 22-sep la
venta al año diez se proyectaba desde tu precio al 3% anual, así que si pagaste 15% sobre la mediana
de la comuna el modelo asumía que al año diez el mercado también paga ese 15%. Ahora el exit
(`calcExitScenario` en LTR, `buildExitScenario` en STR) resta el sobreprecio NOMINAL de hoy al valor
proyectado: `sobreprecio = precio − precio ÷ (1 + desviación)`, con la desviación que ya es fuente
única del hallazgo y del gate de sobreprecio (`precioVsComuna`). Solo con mediana confiable y sobre
ella; bajo la mediana no se suma nada. Comisión y equity van sobre lo que el mercado paga; la TIR lo
hereda; el valor PROYECTADO no cambia (es una línea aparte del capítulo). Con muestra chica (n < 30)
la regla es la misma y la fuente lo dice. Gate: `sobreprecio-venta-catch-test.ts`, once mutaciones en
rojo. Refinanciamiento (mismo día, commit f6d41ea3): el capítulo lee `refinanceScenario` del motor, al
año de salida, 80% del valor; no mueve esperados del golden.

Parque del 22-sep (`scripts/of-sobreprecio-venta.ts`, antes de implementar): LTR 194 de 600 con
sobreprecio adverso (p50 +14%, p90 +45%), venta −9,1% p50, resultado −24 MM p50, TIR −2,5 pts p50,
1 veredicto cambia (8395ea55, COMPRAR → AJUSTA). STR 89 de 253, TIR −1,5 pts p50, 1 cambia.

**Las seeds son extremos sintéticos**: desviaciones de +33% a +91% que en el parque no pasan del p90
(+45%). Por eso acá el descuento se lleva entre la mitad y las tres cuartas partes del equity y deja
TIR negativas: no es un bug, es lo que B dice de un precio 70–90% sobre la mediana. Verificado seed
por seed con `scripts/of-seeds-sobreprecio.ts` (desviación, n, sobreprecio, venta, equity, TIR).

## LTR (`baseline.json`, 13 seeds) — 1 veredicto cambia, 8 seeds con drift clase (a)

| Seed | Desviación · n | Sobreprecio | Qué se mueve |
|---|---|---|---|
| GS-2 | +33% · 357 | $26 MM de $103 MM | **COMPRAR → AJUSTA SUPUESTOS** (score 72 → 69). TIR 11,84 → 7,09; ×3,01 → ×1,96. N 8 → 9 (entra `distancia_veredicto`, que solo existe fuera de COMPRAR); corona cap_rate → sobreprecio. |
| GS-3 | +70% · 118 | $42 MM de $101 MM | score 68 → 63; TIR 10,03 → −0,01; ×2,35 → ×1,00. Veredicto igual (AJUSTA). |
| GS-4 | +78% · 180 | $68 MM de $155 MM | score 39 → 34; TIR 4,66 → −8,72; ×1,38 → ×0,57. BUSCAR igual. |
| GS-6 | +90% · 540 | $101 MM de $213 MM | score 31 → 26; TIR 4,27 → −19,68; ×1,28 → ×0,38. BUSCAR igual. |
| GS-7 | +59% · 60 | $46 MM de $124 MM | score 33 → 27; TIR 6,97 → −10,19; ×1,47 → ×0,61. BUSCAR igual. |
| BE-caprate | +11% · 90 | $10 MM de $101 MM | TIR 23,89 → 22,87; ×3,26 → ×2,83. Score y veredicto iguales. |
| BE-patrimonio | +91% · 180 | $79 MM de $167 MM | score 33 → 29; TIR 3,84 → −12,54; ×1,29 → ×0,47. BUSCAR igual. |
| BE-sensibilidad | +67% · 118 | $42 MM de $105 MM | score 75 → 72; TIR 14,12 → 6,40; ×3,29 → ×1,53. COMPRAR igual. |

Sin cambio: GS-1 (bajo la mediana), GS-5, GS-PC1, GS-PC2 (sin mediana confiable), GS-PJ (en la mediana).
El score se mueve solo por la dimensión TIR; ningún gate nuevo dispara.

## STR (`str-baseline.json`)

Las seeds STR recomputan con la mediana que llega por `medianaComunaUfM2`/`medianaN`; el baseline STR
no lleva TIR/equity como esperados duros, así que no se re-baselinea acá. Si el tier STR reporta drift
en TIR o multiplicador, la causa es esta misma acta.
