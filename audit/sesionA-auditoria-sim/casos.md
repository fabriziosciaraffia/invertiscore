# Sesión A auditoría sim — Casos sintéticos

**Fecha:** 2026-05-05
**UF_CLP usado:** 40.187 (UF actual, mismo en todos los casos sintéticos)
**Caso real:** 0c269222 usa su UF de guardado (40.187, mismo valor)

10 casos en total: 1 real + 9 sintéticos. La matriz cubre tipo × modalidad pago × plazo × extras.

| ID | Descripción | Cubre matriz | precio UF | piePct | plazoCredito | estadoVenta | extras |
|---|---|---|---|---|---|---|---|
| 0 | Real Santiago 0c269222 | vmFranco=precio, sin extras, inmediata, pie 20%, plazo 25 | 3745 | 20 | 25 | inmediata | — |
| 1 | Usado canónico Providencia | vmFranco=precio, inmediata, pie 20%, plazo 25 | 5500 | 20 | 25 | inmediata | — |
| 2 | Usado SOBREPRECIO 20% | precio>vmFranco; expone bug a0 vs a1 valor | 6600 (vmFranco=5500) | 20 | 25 | inmediata | — |
| 3 | Usado VENTAJA compra 10% | precio<vmFranco; expone bug a0 vs a1 valor (caso favorable) | 4950 (vmFranco=5500) | 20 | 25 | inmediata | — |
| 4 | Usado con estacionamiento + bodega | extras de arriendo → metrics.ingresoMensual | 5500 | 20 | 25 | inmediata | est $300UF, arrEst $80K, arrBod $30K |
| 5 | Nuevo entrega 12m, pie al contado | estadoVenta=futura sin cuotas pie, pre-entrega 12m | 5500 | 20 | 25 | futura (12m) | antig=0 |
| 6 | Nuevo entrega 18m + pie en cuotas | Pie en cuotas durante construcción | 5500 | 20 | 25 | futura (18m) | cuotasPie=18, monto=$2.45M |
| 7 | Pie alto 30%, plazo 20 | Pie alto reduce dividendo | 5500 | 30 | 20 | inmediata | — |
| 8 | Pie mínimo 10%, plazo 30 | Pie mínimo + plazo máx → dividendo alto | 5500 | 10 | 30 | inmediata | — |
| 9 | Venta en blanco/verde 24m | Pre-entrega largo + pie en cuotas 24m | 5500 | 20 | 25 | futura (24m) | cuotasPie=24, antig=0 |

## Cobertura por dimensión

| Dimensión | Valores cubiertos |
|---|---|
| Tipo propiedad | Usado entrega inmediata (0,1,2,3,4,7,8); Nuevo entrega futura (5,6,9) |
| vmFranco vs precio | precio=vmFranco (0,1,4,5,6,7,8,9); precio>vmFranco (2); precio<vmFranco (3) |
| Pie | 10% (8); 20% (0,1,2,3,4,5,6,9); 30% (7) |
| Plazo crédito | 20a (7); 25a (todos los demás); 30a (8) |
| Pre-entrega | 0m (0,1,2,3,4,7,8); 12m (5); 18m (6); 24m (9) |
| Pie en cuotas | sí (6, 9); no (resto) |
| Extras arriendo | sí (4); no (resto) |

## Datos del probe

`audit/sesionA-auditoria-sim/_runs.json` contiene el snapshot completo de cada caso:
metrics + exitScenario motor + chartData (Card 09) + KPIs (Card 08) + venta/refi (Card 10) + hallazgos automáticos.

`_probe.ts` se elimina al cerrar la sesión. Se puede regenerar `_runs.json` re-corriendo el probe.
