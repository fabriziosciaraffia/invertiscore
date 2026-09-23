# Actas del re-baseline · retiro de la ventaja sobre el arriendo largo en STR (22-sep-2026)

Decisión de producto (Fabrizio): la ventaja sobre el largo sale de STR entera. Era un vestigio de AMBAS
(LTR no compara contra el corto y no le falta) y el usuario evalúa cada modalidad en su mérito, no
comparando. Salen la dimensión «ventaja vs LTR» del score (20 de 100, repartida a prorrata:
rentabilidad 18,75 · sostenibilidad 25 · factibilidad 25 · retorno sobre lo puesto 18,75 · TIR 12,5),
los gates `g1_flujoSevero` (flujo < −$250.000 Y sobre-renta < 10%) y `g2_ltrGana` (el largo rinde más
neto capa COMPRAR a AJUSTA), el hallazgo `ventaja_vs_ltr` y su knob de decisividad, el bloque «STR vs
LTR» del prompt y la sección `vsLTR` del schema (v22; la acción pasa a `conviene.estrategiaSugerida`),
el guard `[STR-MODALIDAD]`, la sección 05 del PDF y el capítulo V «Corto o largo». AMBAS conserva
`comparativa.ltr`, `recomendacionModalidad` y la banda de cuatro estados: el comparativo de los 107
pares las lee.

Medido en la FASE 0 (`scripts/of-vestigio-ambas.ts`, 255 filas STR): cambian 22 veredictos (10 AJUSTA →
COMPRAR, 6 COMPRAR → AJUSTA, 5 BUSCAR → AJUSTA, 1 VIABLE legacy → COMPRAR); Δscore p10 −8 · p50 +2 ·
p90 +9. Los 6 que bajan tenían la ventaja en 91–100 con flujo negativo o casi cero: el COMPRAR lo
sostenía «le gana mucho al largo declarado». Los 8 sostenidos solo por gates eran todos `g2_ltrGana`;
`g1_flujoSevero` nunca sostuvo solo un veredicto (en las 79 filas donde dispara, dispara otro gate de
fuerza) y la sostenibilidad ya puntúa el flujo de forma continua hasta −$350.000. LTR no se toca: sus
13 seeds quedan con drift 0.

Solo mueve la línea base STR (`str-baseline.json`, `str-accept.ts`). Todas las seeds STR mueven `score`
y `N` (una hallazgo menos: la ventaja). Un veredicto cambia (GE-4). Medido con `runner.ts --str` antes
del accept.

## STR (`str-baseline.json`, 7 seeds)

| Seed | Veredicto | Score viejo → nuevo | Sobre-renta · ventaja vieja · gates viejos | Acta |
|---|---|---|---|---|
| GE-1 | COMPRAR | 78 → 73 | +198 % · 100 · — | La ventaja saturada en 100 inflaba el score; sin ella pesan más sostenibilidad (57, flujo +$14.747) y rentabilidad (65). Sigue COMPRAR con tres puntos de holgura. |
| GE-2 | AJUSTA | 64 → 58 | +44 % · 88 · — | Ventaja 88 contra sostenibilidad 31 (flujo −$99.472): la comparación tapaba el flujo. Seis puntos menos, mismo veredicto. |
| GE-4 | **AJUSTA → COMPRAR** | 63 → 79 | −3.483 % (no confiable) · 0 · `g2_ltrGana` | La fila «LTR-negativo»: el NOI del largo es ≈ 0, el porcentaje explota y aun así la ventaja puntuaba 0 y el gate «el largo gana» leía el % crudo y capaba el COMPRAR. Sin ese artefacto la fila rinde 85 en rentabilidad, 83 en retorno y 88 en TIR con flujo +$96.783: COMPRAR por su mérito. Es el caso que la FASE 0 señaló (4ea0b582 en el parque). El eje «ventaja:KPI-CLP» de esta seed queda sin objeto; se conserva la seed por la rama LTR-negativo de la comparativa que AMBAS sigue usando. |
| GE-5 | AJUSTA | 58 → 62 | +8 % · 45 · — | Ventaja 45 (bajo la media de sus dimensiones) restaba; sin ella suben cuatro puntos. Mismo veredicto. |
| GE-6 | BUSCAR | 40 → 45 | −7 % · 19 · `g2_ltrGana` + `g1_flujoSevero` | Ventaja 19 hundía el score; sin ella sube cinco y queda en el corte exacto de AJUSTA por score, pero sigue BUSCAR por los gates que quedan (cash-on-cash severo y break-even inviable con flujo −$285.504): la puerta del flujo la deciden los otros brazos, como se midió. |
| GE-PC | AJUSTA · pie cero | 79 → 73 | +134 % · 100 · — | Ventaja saturada en 100; sin ella la sostenibilidad 44 (flujo −$43.543) pesa lo que tiene que pesar. Seis puntos menos, mismo veredicto. |
| GE-PJ | AJUSTA · precio justo | 64 → 58 | +44 % · 88 · — | Misma fila base que GE-2 con la mediana alineada: mismo mecanismo, mismos seis puntos. |

## El congelado STR (`str-congelado-catch-test.ts`, tres filas)

- **eb7b3a66 (Sta. Rosa, AJUSTA)**: sin la dimensión ni el gate, la frontera hacia COMPRAR se aleja de
  ×1,043 a ×1,101 del ingreso (tarifa $50.134, ocupación 47 %), el precio que sube a COMPRAR baja de
  UF 2.536 a 2.345, el ADR deja de cruzar y la única palanca que cruza es el precio; con pie 30 a 30
  años el flujo sigue en +$12.778 pero ya no cruza. El cierre I lo dice con las cifras nuevas. Los pins
  del cierre II (antes «V») y del VI estaban rojos en master desde el 17-sep y el 22-sep; se re-pinean
  con el texto vivo.
- **18f29784 (Providencia, estructural)**: sigue estructural; su frase perdió «ni con administrador»
  antes de este goal (rojo en master) y se re-pinea.
- **2ff73320 (Santiago)**: era COMPRAR 71 con la ventaja en 91 y la sostenibilidad en 47 (flujo
  −$51.120). Queda en 66, AJUSTA, y aparecen la frontera hacia arriba y las celdas que cruzan.

## Otros tiers que pinean estado del parque

- `salida-str-copy`: el fixture `maculStrSinSalida` deja de ser «sin salida» (el precio lo lleva a
  COMPRAR); ningún fixture STR queda estructural sin combinación. La regla que sobrevive es que sin mix
  ni escalón el hallazgo no prometa una combinación.
- `regulacion-no-pesa`: fija GE-1 contra `str-baseline.json`; vuelve a verde con el accept.
- `modalidad-str` se retiró con el guard; `card-str` pasa a seis apellidos y pierde la salida
  «Analízalo como renta larga»; `decisividad-str`, `mediacion-cards` y `titular-final` reemplazan el
  id `ventaja_vs_ltr` de sus fixtures por `plusvalia`.
