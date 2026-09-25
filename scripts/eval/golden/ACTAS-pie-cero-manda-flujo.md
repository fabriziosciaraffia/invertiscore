# Actas — pie cero: manda el flujo, y el rescate por pie y plazo (25-sep-2026)

Decisión de Fabrizio. Dos partes en la misma rama:

1. **Pie cero, manda el flujo.** Sin capital propio el cash-on-cash es `no_aplica`. Desde el 12-sep
   (`cf5264d7`) la dimensión de capital del puntaje se rellenaba con el rendimiento neto sobre el
   precio —el depto como comprado al contado— y el gate 2 LTR se saltaba entero. Resultado: COMPRAR
   con −$371 mil al mes (a31c27b9) y −$83 mil (5044e019). Ahora la dimensión toma el **puntaje del
   flujo** (LTR `desglose.flujoCaja`; STR la escala del flujo de la sostenibilidad) y el gate 2 LTR
   aplica su **brazo de flujo** (flujo bajo −5% del ingreso). Bono pie, otra fuente y sin declarar,
   igual. En STR el gate 2 ya degradaba con pie cero (rama B: el horizonte no se puede medir).
2. **Rescate por pie y plazo.** Un BUSCAR OTRA que llega a COMPRAR con más pie o más plazo, sin
   descuento, dentro de los topes de la grilla (pie hasta 30%, plazo hasta 30), pasa a AJUSTA
   SUPUESTOS (`src/lib/rescate-pie-plazo.ts`).

Solo la parte 1 mueve seeds del golden. La parte 2 no mueve ninguna.

| Seed | Antes | Después | Por qué |
|---|---|---|---|
| GS-PC1 | BUSCAR · score 58 · recomendación «precio solo −21,5%» | BUSCAR · score 44 · sin recomendación | Pie cero con flujo −$392 mil: la dimensión de capital pasa de la curva del rendimiento neto (≈85) al puntaje del flujo. El veredicto no cambia (sigue BUSCAR por G1 flujo severo). La recomendación desaparece porque ahora el pie solo (+7 pts) ya la lleva a Ajustar: la grilla tiene celdas a 0% y el mix queda redundante con la palanca sola. |
| GS-PC2 | COMPRAR · score 80 | COMPRAR · score 78 | Pie cero con flujo +$89 mil: el puntaje del flujo (≈83) queda un poco bajo el rendimiento neto. Sigue COMPRAR; el gate 2 no dispara porque el flujo es positivo. |
| GE-PC (STR) | AJUSTA · score 70 | AJUSTA · score 62 | Pie cero con flujo negativo: la dimensión CoC pasa del cap rate al puntaje del flujo. Sigue AJUSTA por `g2_flujoSinHorizonte`, como antes. |

Tiers tocados con acta en el propio archivo: `score-retorno` (el chequeo del relleno pasa a exigir el
puntaje del flujo; el ancla del G2 incluye la rama sin pie) y `ajustar-sin-camino` (b4bb8a67 llega a
Buscar otro por el puntaje, no por el filtro).
