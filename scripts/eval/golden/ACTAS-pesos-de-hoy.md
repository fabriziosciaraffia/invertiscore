# Actas del re-baseline · todo en pesos de hoy, DFL2 y montos SII (29-sep-2026)

Decisiones de Fabrizio del 29-sep-2026, rama `claude/plusvalia-dfl2`:

- **Todo en pesos de hoy.** Todo monto futuro del informe va en pesos de hoy (equivalente a UF) y
  todo porcentaje de rentabilidad, tasa o crecimiento en términos reales («UF + %»). La proyección de
  los dos motores pasa entera a pesos de hoy: valor con la plusvalía real de 3%, saldo = la deuda en
  UF, cuota fija en UF, arriendo +0,49% real (3,5% nominal menos 3% de inflación), gastos planos. La
  TIR de esos flujos es real. Antes los flujos iban en pesos de cada año y el valor y el saldo en
  pesos de hoy: dos monedas en la misma proyección. Gate: `pesos-de-hoy-catch-test.ts`, 13 mutaciones.
- **DFL2 con la regla del SII.** 50% del avalúo exento, compite con la exención general (se aplica la
  mayor), 20/15/10 años por superficie desde la recepción; las filas guardadas se re-estiman si su
  contribución calza con la estimación anterior. Gate: `dfl2-catch-test.ts`, 13 mutaciones.
- **Montos SII del 2º semestre 2026.** Exención $61.711.570, cambio de tasa $220.398.431, tasas
  0,893% y 1,042%.

Los umbrales de TIR (curva del puntaje, 6% del precio límite, 10% de renta corta) NO se recalibran:
se calibraron sobre la TIR anterior, que en el parque queda ~1 punto bajo la real. Opcional.

Parque (1.227 LTR, 261 STR) contra master 6b84cc2f: LTR 17 veredictos suben un escalón (4 Ajustar →
Comprar, 13 Buscar → Ajustar), STR 3 (Buscar → Ajustar); puntaje +1 mediano; ninguno baja de veredicto.

Formato de cada cifra: **nuevo ← anterior**.

## LTR (`baseline.json`, 13 seeds, `accept.ts`; filas GOLDEN:: re-sembradas con `seed-db.ts`)

| Seed | Qué se mueve | Por qué |
|---|---|---|
| GS-2 | **AJUSTA SUPUESTOS → COMPRAR**, score 69 → 70; TIR 7,09 → 7,12; ×1,96 → ×1,97. N 9 → 8 (sale `distancia_veredicto`, que solo existe fuera de COMPRAR); corona sobreprecio → cap_rate; celda recomendada «pie 30 · 30a · −0%» → sin recomendación (un Comprar no la lleva). B8 persistido = recompute tras re-sembrar. | La TIR real sube la dimensión TIR lo justo para cruzar 70. |
| GS-1 | flujo neto mensual 210.102 → 214.062; TIR 21,26 → 20,61 | Contribución con los montos SII 2026 (baja); flujos en pesos de hoy. |
| GS-3 | flujo −62.932 → −58.972; TIR −0,01 → 0,53; multiplicador 1,00 → 1,05 | Ídem. |
| GS-4 | score 34 → 35; flujo −349.755 → −344.528; TIR −8,72 → −6,91; ×0,57 → ×0,62 | Ídem. BUSCAR igual. |
| GS-5 | score 60 → 61; flujo −95.180 → −90.858; TIR 9,41 → 9,81; ×2,17 → ×2,29 | Ídem. AJUSTA igual. |
| GS-6 | score 26 → 27; cap rate 2,98 → 3,10; flujo −614.713 → −593.848; TIR −19,68 → −15,32; ×0,38 → ×0,43 | Ídem; el cap rate neto sube porque la contribución baja. BUSCAR igual. |
| GS-7 | flujo −329.290 → −324.799; TIR −10,19 → −7,00; ×0,61 → ×0,68 | Ídem. BUSCAR igual. |
| GS-PC1 | multiplicador 1,62 → 1,85 | Flujos en pesos de hoy (la cuota fija en UF pesa menos que la inflada). |
| GS-PJ | multiplicador 2,76 → 2,80 | Ídem. |
| BE-caprate | flujo 282.091 → 286.051; TIR 22,87 → 21,92 | Contribución SII; TIR real. |
| BE-patrimonio | flujo −424.515 → −419.016; TIR −12,54 → −10,21; ×0,47 → ×0,51 | Ídem. |
| BE-sensibilidad | flujo 34.716 → 38.766 | Contribución SII. |

Sin cambio: GS-PC2.

## STR (`str-baseline.json`, `str-accept.ts`) — ningún veredicto cambia

| Seed | Qué se mueve |
|---|---|
| GE-2 | TIR 7,61 → 7,83; multiplicador 1,92 → 1,98 |
| GE-4 | TIR 13,98 → 13,67 |
| GE-5 | score 64 → 65; TIR 8,61 → 8,85; multiplicador 2,07 → 2,14 |
| GE-6 | TIR 4,41 → 5,06; multiplicador 1,38 → 1,47 |
| GE-PC | multiplicador de patrimonio 5,43 → 5,63 |
| GE-PJ | TIR 7,61 → 7,83; multiplicador 1,92 → 1,98 |

## AJUSTAR-SIN-CAMINO (`ajustar-sin-camino-fixtures.json`)

Tres filas del censo congelado del 25-sep pedían apenas sobre 20% de descuento; con el motor nuevo
quedan bajo el corte y vuelven a Ajustar (su camino más fácil ya es ≤ 20%, lo que el tier verifica):

| Fila | Modalidad | Camino en la FASE 0 | Esperado |
|---|---|---|---|
| 5e686d96 | LTR | 20,1% | BUSCAR OTRA → AJUSTA SUPUESTOS |
| adc56a80 | STR | 22,4% | BUSCAR OTRA → AJUSTA SUPUESTOS |
| ee622897 | STR | 20,1% | BUSCAR OTRA → AJUSTA SUPUESTOS |

- **Piso:** 52 → 49 filas en Buscar otro (48 por el filtro, 1 por el puntaje); grises 2 → 5.
- **Borde STR:** ee622897 era el fixture designado «borde» de renta corta. Pasa a ad47e9e7 (STR,
  21,0%, sigue en Buscar otro por el filtro). El borde LTR (3b8facde) no cambia.

## SALIDA-STR-COPY (`src/app/dev/drawers-pixel/fixtures.json`)

`estructuralMixStr` (761b08ad) lleva `contribucionesOrigen: "declarada"`. Su contribución ($251.312
trimestral) calzaba con la estimación anterior; con el DFL2 se re-estimaba, bajaba y el precio solo
alcanzaba: dejaba de ser estructural. El caso existe para el copy del estructural con mix, no para la
contribución, así que se fija la que tenía. Con eso vuelve a ser estructural con combinación a
Comprar (pie 30% + plazo 30 años + 18,7%).

## MANTENCIÓN-UNA-SOLA

La regla «el año 2 reajusta la declarada con el factor de los costos» sigue; el factor pasa de 1,03 a
1 + crecimientoReal(3%) = 1 (pesos de hoy). En rojo si la mantención vuelve a crecer 3% nominal.

## Resultado

QUICK: 0 fallas duras, 0 drift. `--all`: 0 fallas duras, 0 drift.
