# Sesión A fix P0+P1 — tabla comparativa

**Fecha:** 2026-05-05
**Fixes aplicados:** H6 (sin comisión 2% en chart Patrimonio) · H1 (a0 con vmFrancoCLP) · H5 (cuotas pie distribuidas año a año en aporteAcum) · H4 (sim inversionInicial suma cuotasPieTotal).


## 0-real-0c269222 — Caso real Santiago — 0c269222 (post-fix)

Cubre: vmFranco=precio, sin extras, entrega inmediata, pie 20%, plazo 25

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $150.500.315 | $150.500.315 | $150.500.315 (vmFranco) | ✅ |
| a0.patrimonioNeto | $27.090.057 | $30.100.063 | $30.100.063 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $35.808.147 | $38.938.554 | $38.938.554 (Valor − Deuda) | ✅ |
| TIR motor 10A | 6.95% | 6.95% | =6.95% (sin regresión) | ✅ |
| TIR sim 10A | 6.95% | 6.95% | = TIR motor | ✅ |
| Sim inversionInicial | $33.110.069 | $33.110.069 | $33.110.069 | ✅ |

_Caso reportado por el usuario._ a0 patrimonio antes era $27.090.057 (= pieCLP − 2%×precio = $30,1M − $3,0M = $27,1M, $6,0M bajo aporte). Ahora a0 = vmFranco − deuda = $30.100.063 (= pieCLP). El patrimonio NO arranca por debajo del aporte.


## 1-usado-canonico — Usado canónico Providencia

Cubre: vmFranco=precio, entrega inmediata, pie 20%, plazo 25

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $39.785.130 | $44.205.700 | $44.205.700 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $52.366.620 | $56.964.013 | $56.964.013 (Valor − Deuda) | ✅ |
| TIR motor 10A | 9.38% | 9.38% | =9.38% (sin regresión) | ✅ |
| TIR sim 10A | 9.38% | 9.38% | = TIR motor | ✅ |
| Sim inversionInicial | $48.626.270 | $48.626.270 | $48.626.270 | ✅ |

## 2-usado-sobreprecio — Usado con SOBREPRECIO 20% (precio>vmFranco)

Cubre: Caso adverso de chart a0=precio vs a1=vmFranco·(1+plusv)

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $265.234.200 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $47.742.156 | $8.841.140 | $8.841.140 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $17.785.495 | $22.382.888 | $22.382.888 (Valor − Deuda) | ✅ |
| TIR motor 10A | 2.75% | 2.75% | =2.75% (sin regresión) | ✅ |
| TIR sim 10A | 2.75% | 2.75% | = TIR motor | ✅ |
| Sim inversionInicial | $58.351.524 | $58.351.524 | $58.351.524 | ✅ |

_Sobreprecio +20%._ Antes Δ patrimonio a0→a1 = -29.956.661 (caída artificial $30M). Ahora Δ = 13.541.748 (refleja plusvalía sobre vmFranco).


## 3-usado-ventaja — Usado con VENTAJA compra 10% (precio<vmFranco)

Cubre: Caso favorable de chart a0=precio vs a1=vmFranco·(1+plusv)

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $198.925.650 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $35.806.617 | $61.887.980 | $61.887.980 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $69.657.183 | $74.254.576 | $74.254.576 (Valor − Deuda) | ✅ |
| TIR motor 10A | 12.9% | 12.9% | =12.9% (sin regresión) | ✅ |
| TIR sim 10A | 12.9% | 12.9% | = TIR motor | ✅ |
| Sim inversionInicial | $43.763.643 | $43.763.643 | $43.763.643 | ✅ |

_Ventaja −10%._ Antes a0→a1 saltaba +33.850.566 (salto artificial $34M). Ahora a0 ya refleja la ventaja en su patrimonio (vmFranco>precio); Δ a0→a1 = 12.366.596 (sólo plusvalía esperada).


## 4-usado-extras — Usado con estacionamiento + bodega

Cubre: arriendoEstacionamiento+bodega → metrics.ingresoMensual

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $39.785.130 | $44.205.700 | $44.205.700 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $52.366.620 | $56.964.013 | $56.964.013 (Valor − Deuda) | ✅ |
| TIR motor 10A | 10.89% | 10.89% | =10.89% (sin regresión) | ✅ |
| TIR sim 10A | 10.89% | 10.89% | = TIR motor | ✅ |
| Sim inversionInicial | $48.626.270 | $48.626.270 | $48.626.270 | ✅ |

## 5-nuevo-entrega-12m — Nuevo, entrega futura en 12 meses, pie al contado

Cubre: estadoVenta=futura sin cuotas pie, pre-entrega 12m

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $39.785.130 | $44.205.700 | $44.205.700 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $48.449.447 | $53.046.840 | $53.046.840 (Valor − Deuda) | ✅ |
| TIR motor 10A | 9.97% | 9.97% | =9.97% (sin regresión) | ✅ |
| TIR sim 10A | 9.97% | 9.97% | = TIR motor | ✅ |
| Sim inversionInicial | $48.626.270 | $92.831.970 | $92.831.970 (incluye cuotasPieTotal=$44.205.700) | ✅ |

## 6-nuevo-entrega-18m-pie-cuotas — Nuevo, entrega 18m, pie en cuotas durante construcción

Cubre: Pie en cuotas + pre-entrega

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $39.785.130 | $44.205.700 | $44.205.700 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $48.449.447 | $53.046.840 | $53.046.840 (Valor − Deuda) | ✅ |
| a1.aporteAcum (cuotas pie) | $48.626.270 | $78.096.734 | $78.096.734 (incluye 29.470.464 cuotas en 12m) | ✅ |
| TIR motor 10A | 10.03% | 10.03% | =10.03% (sin regresión) | ✅ |
| TIR sim 10A | 10.03% | 10.03% | = TIR motor | ✅ |
| Sim inversionInicial | $48.626.270 | $92.831.966 | $92.831.966 (incluye cuotasPieTotal=$44.205.696) | ✅ |

_18 cuotas pie × $2.455.872._ a1 antes aporteAcum = 48.626.270 (subestimaba $30M). Ahora a1 = 78.096.734 (incluye 12 cuotas pagadas en año 1).


## 7-pie-alto-30 — Pie 30%, plazo 20 años

Cubre: Pie alto reduce dividendo y crédito

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $61.887.980 | $66.308.550 | $66.308.550 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $75.435.823 | $80.033.216 | $80.033.216 (Valor − Deuda) | ✅ |
| TIR motor 10A | 8.33% | 8.33% | =8.33% (sin regresión) | ✅ |
| TIR sim 10A | 8.33% | 8.33% | = TIR motor | ✅ |
| Sim inversionInicial | $70.729.120 | $70.729.120 | $70.729.120 | ✅ |

## 8-pie-minimo-10 — Pie 10%, plazo 30 años

Cubre: Pie mínimo + plazo máximo → dividendo alto

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $17.682.280 | $22.102.850 | $22.102.850 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $29.555.719 | $34.153.112 | $34.153.112 (Valor − Deuda) | ✅ |
| TIR motor 10A | 11.17% | 11.17% | =11.17% (sin regresión) | ✅ |
| TIR sim 10A | 11.17% | 11.17% | = TIR motor | ✅ |
| Sim inversionInicial | $26.523.420 | $26.523.420 | $26.523.420 | ✅ |

## 9-blanco-24m — Venta en blanco/verde — entrega 24m, antiguedad 0

Cubre: Pre-entrega largo, ningún flujo durante construcción

| Métrica | v_old | v_new | Esperado | Status |
|---|---|---|---|---|
| a0.valorDepto | $221.028.500 | $221.028.500 | $221.028.500 (vmFranco) | ✅ |
| a0.patrimonioNeto | $39.785.130 | $44.205.700 | $44.205.700 (Valor − Deuda, sin comisión) | ✅ |
| a1.patrimonioNeto | $48.449.447 | $53.046.840 | $53.046.840 (Valor − Deuda) | ✅ |
| a1.aporteAcum (cuotas pie) | $48.626.270 | $70.729.118 | $70.729.118 (incluye 22.102.848 cuotas en 12m) | ✅ |
| TIR motor 10A | 9.79% | 9.79% | =9.79% (sin regresión) | ✅ |
| TIR sim 10A | 9.79% | 9.79% | = TIR motor | ✅ |
| Sim inversionInicial | $48.626.270 | $92.831.966 | $92.831.966 (incluye cuotasPieTotal=$44.205.696) | ✅ |

_24 cuotas durante construcción._ a1 antes aporteAcum = 48.626.270. Ahora a1 = 70.729.118 (12 cuotas en año 1).


## Cross-section: Card 09 footer vs Card 10 'Te queda'

Por diseño post-fix: Card 09 "Patrimonio teórico al año N" = Valor − Deuda. Card 10 "Te queda" = Valor − Deuda − 2%×Valor. Diferencia esperada en cada caso = 2% × valorDepto_a10.

| Caso | Patrimonio_a10 (Card 09 nuevo) | TeQueda_a10 (Card 10) | Δ esperado (2% valor) |
|---|---|---|---|
| 0-real-0c269222 | $136.512.910 | $132.057.365 | $4.455.545 ✅ |
| 1-usado-canonico | $198.699.419 | $192.155.896 | $6.543.523 ✅ |
| 2-usado-sobreprecio | $173.004.068 | $166.460.545 | $6.543.523 ✅ |
| 3-usado-ventaja | $211.547.095 | $205.003.572 | $6.543.523 ✅ |
| 4-usado-extras | $198.699.419 | $192.155.896 | $6.543.523 ✅ |
| 5-nuevo-entrega-12m | $192.830.839 | $186.287.316 | $6.543.523 ✅ |
| 6-nuevo-entrega-18m-pie-cuotas | $189.993.928 | $183.450.405 | $6.543.523 ✅ |
| 7-pie-alto-30 | $232.729.066 | $226.185.543 | $6.543.523 ✅ |
| 8-pie-minimo-10 | $167.857.745 | $161.314.222 | $6.543.523 ✅ |
| 9-blanco-24m | $187.220.019 | $180.676.496 | $6.543.523 ✅ |
