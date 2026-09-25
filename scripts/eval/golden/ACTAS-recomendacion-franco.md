# Actas del re-baseline · la celda recomendada entra al golden (25-sep-2026)

**Qué se agrega.** `baseline.json` (LTR) y `str-baseline.json` (STR) guardan desde hoy
`celdaRecomendada`: la recomendación de Franco, la misma que leen la card, la celda «Franco» del
pop-up y «A qué precio cerrar» (`recomendacionFranco`, `mix-a-comprar.ts`). Por mix es la celda
con su pie, su plazo y su descuento; sin mix, el precio solo con su descuento; `null` cuando no
hay recomendación (Comprar, o Buscar otra sin camino). Es un chequeo **duro**
(`a.celdaRecomendada` / `aStr.celdaRecomendada`); si el baseline no la trae, falla, no pasa.

**Por qué.** El 24-sep la corona del mix pasó del mejor score a la banda de descuento más fácil
y, dentro de ella, el mejor score (acta en la cabecera de `mix-palancas.ts`). El QUICK salió sin
alertas, y se reportó como «ningún dato del baseline se movió». Era falso por construcción: el
baseline no guardaba la recomendación. Fabrizio lo detectó; la medición directa, contrastada contra
el motor de master (`4e2d8487`), dio 4 de 11 seeds con grilla cambiadas.

**Qué NO cambia.** Ningún otro campo de los dos baselines: el diff de este re-baseline solo agrega
`celdaRecomendada` (verificado). Veredictos, scores, N, coronas de hallazgos y cifras, idénticos.

## Las 4 seeds cuya recomendación cambió con el criterio del 24-sep

| Seed | Veredicto | Antes (mejor score) | Ahora (banda más fácil, luego score) | Por qué |
|---|---|---|---|---|
| GS-5 | Ajustar | pie 25% · 25 años · −11,5% (difícil) | pie 30% · 30 años · sin descuento | Hay celdas que llegan a Comprar sin pedirle nada al vendedor; antes ganaba una de mejor score que pedía 11,5%. |
| GE-2 | Ajustar | pie 20% · 25 años · −18,9% (difícil) | pie 30% · 30 años · −4,9% (factible) | La banda factible existe; la de mejor score pedía casi cuatro veces más descuento. |
| GE-5 | Ajustar | pie 25% · 25 años · −12,5% (difícil) | pie 30% · 30 años · sin descuento | Igual que GS-5. |
| GE-PJ | Ajustar | pie 20% · 25 años · −18,9% (difícil) | pie 30% · 30 años · −4,9% (factible) | Sintetizada sobre la fila de GE-2 (precio justo), hereda su grilla. |

Iguales antes y después: GS-2, GS-3, GS-PJ (pie 30% · 30 años · sin descuento) y GE-PC (pie 0% ·
30 años · −8,2%). Sin recomendación: las Comprar (GS-1, GS-PC2, BE-caprate, BE-sensibilidad, GE-1,
GE-4) y las Buscar otra sin grilla (GS-4, GS-6, GS-7, BE-patrimonio, GE-6). GS-PC1 (Buscar otra)
recomienda por precio solo (−21,5%; la card de Buscar otra no lo muestra, pero es el dato del motor).

**Gate en rojo.** Mutando el criterio de la recomendación en `calcularMixPalancas` —volviendo la
corona al mejor score— el QUICK con `--str` sale rojo en exactamente las 4 seeds de la tabla.
