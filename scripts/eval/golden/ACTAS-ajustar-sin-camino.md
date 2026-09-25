# ACTA · Un Ajustar sin camino realista a Comprar es un Buscar otro (25-sep-2026)

Decisión de Fabrizio. La regla, la evidencia del 20% y por qué no se toca la zona gris están en
`src/lib/ajustar-sin-camino.ts`. Esta acta registra qué le hizo el cambio al golden.

## La regla

Si el veredicto es AJUSTA SUPUESTOS y la combinación que pide menos descuento para llegar a Comprar
—pie hasta el nivel de 30%, plazo hasta 30 años, descuento hasta el tope de la palanca (30% LTR ·
25% STR)— pide **más de 20%**, o ninguna llega, el veredicto pasa a BUSCAR OTRA. Entre 10% y 20%
no se toca.

## Re-baseline: ninguna seed cambia

Medido con el motor del 25-sep-2026, el camino más fácil de cada seed en Ajustar:

| seed | veredicto | camino más fácil a Comprar | ¿cambia? |
|---|---|---|---|
| GS-2 | AJUSTA SUPUESTOS | 0% (pie y plazo solos) | no |
| GS-3 | AJUSTA SUPUESTOS | 0% | no |
| GS-5 | AJUSTA SUPUESTOS | 0% | no |
| GS-PJ | AJUSTA SUPUESTOS | 0% | no |
| GE-2 | AJUSTA SUPUESTOS | 4,9% | no |
| GE-5 | AJUSTA SUPUESTOS | 0% | no |
| GE-PC | AJUSTA SUPUESTOS | 8,2% | no |
| GE-PJ | AJUSTA SUPUESTOS | 4,9% | no |

Las seeds COMPRAR y BUSCAR OTRA no entran a la regla. **`baseline.json` y `str-baseline.json` no se
tocan**: ninguna cifra ni veredicto del golden se movió, y el QUICK sigue con el mismo drift de clase
(a) que antes del cambio (13, amarillo por diseño).

## Por qué el gate no se apoya en las seeds

Ninguna seed pide más de 20% ni cae en la zona gris (10%-20%), así que las seeds solas no
ejercitarían ninguna de las dos ramas. El tier AJUSTAR-SIN-CAMINO las prueba con filas reales
congeladas en `ajustar-sin-camino-fixtures.json`:

- las **52 filas** del parque que la regla cambia (34 LTR · 18 STR, medidas en la FASE 0): pasan a
  Buscar otro, y ni la card, ni el titular, ni el capítulo «A qué precio cerrar» dicen «más de 70%»;
- los seis designados: **borde** `3b8facde` (LTR, 20,1%) y `ee622897` (STR, 20,1%); **sin camino**
  `ec8fe771` (LTR) y `10ee505c` (STR); **zona gris** `2a8cca1d` (LTR, 20,0%) y `70cd1418` (STR,
  20,0%), que se quedan en Ajustar por estar justo en el borde de la regla.

Y la función pura sobre bordes sintéticos: 10,1 · 15 · 20,0 quedan; 20,1 y sin camino pasan.
