# Censo editorial LTR + STR — dimensiones extendidas (D9-D13) · 2026-08-13

> **LÍNEA BASE.** Esta corrida se repetirá después de los fixes de la doctrina de
> plausibilidad de palancas para medir delta (patrón AMBAS: 47→6 ALTAs). No se
> corrigió ningún informe ni código de producto: este censo solo mide.

**Corrida**: 174 informes (LTR 137 · STR 37), todos con prosa `promptVersion` vigente
(LTR=3, STR=3; 0 excluidos por versión), 0 errores de ensamblado, 0 informes saltados.
Juez `claude-opus-4-8` ×2 (doble voto) + merge `claude-sonnet-5`. Dimensiones 1-7 + 9-13
(D8 excluida: exclusiva del comparativo). Costo real USD 100,09 · 39,8 min.
Outputs por informe en `out-censo/` (untracked).

Nota de cohorte: el dry-run de dimensionamiento contó 171; al lanzar, la base viva
tenía 174 (3 análisis nuevos entre ambas lecturas). Se censó la cohorte completa.

## 1. Resumen ejecutivo

- **Cero informes limpios** (0 de 174 sin ninguna falla), igual que en los censos
  AMBAS y STR anteriores.
- **Severidad**: 46 de 137 LTR (34%) y 4 de 37 STR (11%) tienen al menos una ALTA
  confirmada por doble voto. LTR concentra el problema.
- **Patrón dominante severo (LTR): D3 coherencia transversal** — 46 ALTAs confirmadas,
  110/137 informes afectados. La figura repetida: *la misma cifra con dos lecturas*
  ("aporte acotado/sostenible" en el hero vs "sin tope, estructural" en los drawers)
  y cifras incompatibles del mismo concepto entre prosa persistida y pirámide.
- **Patrón dominante en volumen: D4 claridad** — 154 MEDIAs LTR y 81 STR (37/37 STR
  afectados): términos sin glosar al primer uso, frases kilométricas.
- **Las dimensiones nuevas muerden**: D10 (cifra sin ancla) afecta a 62/137 LTR;
  D11 (tensión numérica) a 33/137; su patrón dominante es exactamente el hueco que
  motivó la doctrina de palancas: **umbrales de precio conviviendo sin jerarquía**
  (break-even de caja vs umbral de veredicto vs techo de negociación vs referencia).
- **D12 confirma el hallazgo E.2 del audit**: en 13 LTR con veredicto degradado, la
  pirámide/índice empuja a favor sin que ninguna pieza glose qué retiene el veredicto
  — la huella de los gates que LTR no traduce a narrativa.

## 2. Tabla dimensión × modalidad

AC = ALTA confirmada (doble voto) · AD = ALTA débil (una corrida) · M = media · B = baja.
"Informes" = informes con ≥1 falla de esa dimensión.

| Dim | LTR (137) AC/AD/M/B | Informes LTR | STR (37) AC/AD/M/B | Informes STR |
|---|---|---|---|---|
| D1 progresión | 0/0/49/0 | — | 0/0/4/0 | — |
| D2 promesas | 1/4/18/1 | — | 0/0/6/0 | — |
| **D3 coherencia** | **46/71/92/8** | **110** | 2/4/13/2 | 15 |
| D4 claridad | 0/0/154/14 | 115 | 0/0/81/0 | 37 |
| D5 gramática/voz | 8/2/35/1 | — | 0/1/7/1 | — |
| D6 accionabilidad | 0/0/27/14 | — | 0/0/14/4 | — |
| D7 voz Franco | 0/0/2/3 | — | 0/0/3/4 | — |
| D9 lector-30% | 0/0/38/0 | — | 0/0/24/1 | — |
| **D10 cifra sin ancla** | **4/13/56/2** | **62** | 2/0/10/0 | 10 |
| **D11 tensión numérica** | **1/6/26/2** | **33** | 0/0/6/1 | 6 |
| **D12 veredicto↔pirámide** | 0/7/11/1 | 18 | 1/5/9/0 | 12 |
| D13 no-recitación | 0/0/28/3 | — | 0/0/8/1 | — |

## 3. D10 — Cifra sin ancla (desglose)

62/137 LTR y 10/37 STR. Tres familias:

**a. Anclas de negociación sin origen narrado** (la familia grande — insumo directo
de la doctrina de palancas). La primera oferta y el techo llegan del motor, pero la
prosa no dice qué los produce:
- `7710a017` (LTR AJUSTA): *"Abre en UF 4.738 … sube hasta UF 4.987, tu techo duro"* —
  la primera oferta no tiene explicación de qué se rompe o cambia a ese precio; solo
  el techo quedó anclado a la TIR.
- `cfaf10e8` (LTR BUSCAR): el ancla "6% sobre mediana" justifica bajar, pero no explica
  por qué **UF 1.259** exactamente.
- `6c7b3cd8` (LTR BUSCAR): techo UF 2.103 presentado como "límite económico" sin que
  ninguna pieza diga qué se rompe ahí (no coincide con break-even UF 2.642,9).

**b. Valores de referencia fantasma** (contradicen la mediana de la pirámide):
- `05462488` (LTR AJUSTA): drawer cita *"valor de referencia estimado de la zona
  UF 1.256 … el precio pedido más que dobla los comparables"* mientras `card:sobreprecio`
  del mismo informe dice que el m² está **7% BAJO** la mediana comunal.
- `596200aa` (LTR BUSCAR, AC): *"valor estimado de mercado UF 2.965 frente a UF 4.500"*
  — cifras que no existen en ninguna otra pieza; el hero maneja sobreprecio de 4%.
- `c87e002b` (LTR AJUSTA, en D12): el drawer revela *"brecha de 75,9%"* que ni las
  cards ni la respuestaDirecta mencionan.

**c. Cifras imposibles / escala rota** (no-editorial, escaló del censo):
- `1ad769d4` (LTR COMPRAR, AC): *"si el precio bajara a UF 2.767, un 113% menos"* —
  aritméticamente imposible, y UF 2.767 > precio pedido UF 1.300.
- `f9e2662e` (LTR BUSCAR): dividendo de **$837.440.563/mes** contra arriendo de
  $673.000 + mantención $163M/mes — input de escala rota sirviendo prosa en prod
  (misma familia del outlier CoC −73.890%).
- `7a224dfd` (STR BUSCAR, AC): *"Capital de $9,5M comprometido"* sin desglose posible
  y contradiciendo el aporte de $47,9M declarado en otra pieza.

## 4. D11 — Tensión numérica sin resolver (desglose)

42 fallas (LTR 33 informes, STR 6). **Patrón dominante (14 fallas): convivencia de
umbrales de precio/palancas sin jerarquía** — el multi-precio del motor llega a la
prosa sin un orden que diga cuál pelear:

- `e42f9e9f` (LTR AJUSTA): umbral de veredicto **UF 4.019 (−20%)** y break-even de
  caja **UF 4.069 (−19,3%)** a 50 UF de distancia, sin puente sobre cuál priorizar.
- `b40404a0` (LTR AJUSTA): break-even −28,7% vs cambio de veredicto −29,9% "sin que
  ninguna pieza explique por qué son distintos".
- `f5fe1780` (LTR AJUSTA): conviven UF 10.697 (break-even), UF 10.474 (oferta),
  UF 11.025 (techo) y −$285.720 de cuota por pie, sin ordenamiento.
- `3ee1e9b6` (LTR AJUSTA): **tres palancas** a COMPRAR (arriendo $319.446 / pie 17-25% /
  precio UF 1.528) "sin que ninguna pieza jerarquice cuál es la vía recomendada".
- `05462488` (D12, LTR AJUSTA): el cambio a Comprar se ofrece vía precio −10,8%, vía
  pie 25% Y vía pie 20% (drawer distancia) — las palancas no cuadran entre piezas.
- `8d02902b` (STR AJUSTA): el hero fija la **tarifa** como vía a COMPRAR y el drawer
  declara que la palanca "real" es el **precio** −10% — dos vías sin árbitro.
- `9fbb414a` / `ee410ddd` (LTR BUSCAR): "ningún ajuste cambia el veredicto" convive
  con "a UF X la TIR sube a 8,3%/15,6%" sin puente que explique por qué una TIR sana
  no salva el caso.

**Subconjunto "cifras a mercado / sanas + veredicto degradado" (destino conocido:
doctrina de plausibilidad)** — 19 informes marcados entre D11 y D12:
`04dafb00 · 15e071c7 · 1b622c91 · 4daf13eb · 51acbc01 · 596200aa · 6755ab88 · 6cdb703f ·
71512dec · 7710a017 · 8738de22 · 8bda5e13 · a5179ba2 · a86f1dec · ab7d865d · ae7143a8 ·
b826223b · c87e002b · d45a7b55`.
Caso testigo del matiz: en `7710a017` (precio 0% vs mediana, cards casi todas A favor,
veredicto AJUSTA) el juez **reconoció el puente** (arriendo +65,5% sobre referencia,
colchón −11,5%) y lo dejó en tensión menor — cuando el puente existe y está junto,
la dimensión no dispara. `6755ab88` es el contraejemplo: mismas cards sanas, contrapeso
nombrado pero *"el puente que explica por qué números tan sanos no dan Comprar queda
repartido"* → falla.

## 5. D12 en LTR × hallazgo E.2 (gates sin glosa)

El audit de palancas (E.2) mostró que **LTR no glosa los motivos de gate a la
narrativa** (STR sí: `GLOSA_MOTIVO` + caso puro-gate). El censo lo confirma en la
página: **13 informes LTR con veredicto degradado** donde la pirámide o el índice
empujan a favor sin que ninguna pieza diga qué retiene el veredicto:
`05462488 · 15e071c7 · 3970143f · 3eb441ae · 4daf13eb · 596200aa · 6c9e672e · 71512dec ·
860f5607 · 8bda5e13 · c87e002b · dab58f76 · eaaf513d`.

- `4daf13eb` (BUSCAR): 4 de 6 cards "A favor"; *"ninguna card media explica por qué el
  veredicto se sostiene igual — el puente vive solo en la prosa"*.
- `8bda5e13` (BUSCAR): TIR 10,8% "muy sobre el mínimo" en card A favor; *"ninguna card
  media por qué el flujo negativo pesa más que una TIR sana"*.
- `15e071c7` (AJUSTA): el índice del hero destaca "rinde a mercado" y "sin sobreprecio"
  y omite el hallazgo que sostiene el AJUSTA.

Contraste STR que calibra la solución: `04dafb00` (BUSCAR por regulación) tiene la
glosa del gate en el hero (`hero:motivos`) y AUN ASÍ juntó 4 ALTAs débiles porque el
**índice y las 10 cards** siguen celebrando — la glosa sola no basta si la pirámide
no media. Dato para la doctrina: glosar el gate es necesario pero no suficiente.

## 6. Hallazgos sobre el instrumento

1. **El ensamblador no requirió correcciones**: 174/174 ensamblan; validado contra las
   superficies vigentes (hero → índice top-3 → posición → drawer distancia → cards por
   orden de pirámide del render → drawers de prosa → zona). Los cambios LTR/STR del
   ciclo AMBAS (ej. puente de plusvalía en la card) entran solos porque importa los
   mismos builders que la página.
2. **Cambios hechos** (commit f1687cd): RUBRICA.md re-scopeada (D8 solo AMBAS; D9-D13
   generalizadas con ejemplo canónico LTR/STR en D11); `censo.ts` filtra por
   `promptVersion` vigente importada de la fuente, pasa dimensiones 1-7+9-13 al juez,
   y gana `--dry`, `--tipo`, `--presupuesto`.
3. **Caveat de fidelidad**: la página sirve prosa persistida junto a hallazgos
   recomputados; parte de las D3 numéricas (ej. `bbcb0448`: CAP 2,9% en prosa vs 2,8%
   en card) es drift prosa-vieja-vs-recompute. No es artefacto del instrumento — es lo
   que el usuario ve — pero al diseñar fixes conviene separar "la IA escribió mal" de
   "el dato envejeció bajo la prosa".
4. **Escalados no-editoriales** (no tocados, reportados): `f9e2662e` (escala rota,
   dividendo $837M/mes) y `1ad769d4` ("113% menos" imposible + break-even mayor al
   precio pedido) ameritan revisión de motor/datos en un goal aparte.
