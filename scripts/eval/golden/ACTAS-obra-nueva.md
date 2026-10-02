# Acta · obra nueva en el motor (02-oct-2026)

Decisiones de Fabrizio tras la FASE 0 (medida sobre 266 informes de obra nueva y 1.986 avisos con entrega
futura):

1. **Sin castigo por esperar.** La entrega futura ya no resta puntaje (antes −1 cada 6 meses, tope 5). Todo
   informe con entrega futura dice, después de la portada: «Tu crédito se firma en la entrega: si la tasa
   sube en la espera, estos números cambian.» Sin escenarios ni cálculo de tasa.
2. **TIR anual, con cada cuota del pie en el año en que se paga.** La primera cuota se paga al firmar (con
   los gastos de cierre); las demás mes a mes.
3. **Cuotas del pie con entrega futura o inmediata**, de 1 («al contado») a 60. Por defecto: hasta la
   entrega (tope 60) si es futura, al contado si es inmediata. Las cuotas que caen después de la entrega se
   pagan junto al dividendo y el flujo lo dice: «Durante N meses pagas también $X de cuota.»
4. **Arriendo sugerido de obra nueva +3%** (medido +3%, IC +1% a +5%; tope de Fabrizio 5%). Solo el
   sugerido de los comparables, nunca el que escribe la persona.

La versión de evaluación de los avisos pasa de `r2` a `r3`: el cron reevalúa la tabla de a poco.

## Re-baseline del golden, por seed

Ninguna seed del golden es obra nueva con pie en cuotas (todas `cuotasPie` 0), así que las cuotas y el
+3% no mueven ninguna. El castigo por esperar solo pesaba en GS-7, la única seed con la entrega todavía
futura respecto de `GOLDEN_ASOF`.

| seed | entrega | antes | después | qué cambió |
|---|---|---|---|---|
| GS-1 | inmediata | COMPRAR 87 | COMPRAR 87 | nada |
| GS-2 | futura 2026-04 (ya pasada al asOf) | COMPRAR 70 | COMPRAR 70 | nada: sin meses de espera, no había castigo |
| GS-3 | inmediata | AJUSTA 63 | AJUSTA 63 | nada |
| GS-4 | inmediata | BUSCAR 35 | BUSCAR 35 | nada |
| GS-5 | inmediata | AJUSTA 61 | AJUSTA 61 | nada |
| GS-6 | inmediata | BUSCAR 27 | BUSCAR 27 | nada |
| **GS-7** | **futura 2028-05** | **BUSCAR 27** | **BUSCAR 31** | **sale el castigo (−4); mismo veredicto; ahora lleva la línea del riesgo** |
| GS-PC1 | inmediata | BUSCAR 44 | BUSCAR 44 | nada |
| GS-PC2 | inmediata | COMPRAR 78 | COMPRAR 78 | nada |
| GS-PJ | inmediata | AJUSTA 70 | AJUSTA 70 | nada |
| BE-caprate | inmediata | COMPRAR 86 | COMPRAR 86 | nada |
| BE-patrimonio | inmediata | BUSCAR 29 | BUSCAR 29 | nada |
| BE-sensibilidad | inmediata | COMPRAR 72 | COMPRAR 72 | nada |

Las seeds STR no se tocan: el motor STR no tenía castigo por esperar ni lee las cuotas del pie.

## Filas congeladas de AJUSTAR-SIN-CAMINO

Seis filas LTR de obra nueva con entrega futura y pie en cuotas pedían entre 20,4% y 24,1% de descuento
para llegar a Comprar y el filtro las mandaba a Buscar otro. Sin el castigo y con las cuotas en la TIR
quedan bajo 20% y vuelven a Ajustar: `0d058dc5`, `5113f1c4`, `8005e03d`, `a8bf8779`, `e65c0e6b`,
`eb205e0c` (`actaObraNueva` en el fixture). El piso pasa de 49 a 43 filas en Buscar otro.

## Lo que el golden no cubre y cubre el tier OBRA-NUEVA

Cuotas con entrega futura e inmediata, el reparto de las cuotas por año, la línea del flujo, el +3% solo en
el sugerido, la frase del riesgo, el paso del wizard y la versión de evaluación.
