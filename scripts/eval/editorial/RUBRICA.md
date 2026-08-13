# RÚBRICA DE EVALUACIÓN EDITORIAL — Fase 1

> **Fuente de verdad** del instrumento de evaluación editorial. El evaluador
> (`scripts/eval/editorial/evaluar.ts`) inyecta este archivo completo en el prompt
> del juez. Editable por Fabrizio: cambiar acá cambia el instrumento; no hay copia
> paralela en el código.
>
> Objeto evaluado: el **informe completo como pieza de lectura** — respuestaDirecta,
> posición de Franco, cards de la pirámide, drawers con prosa, y zona si tiene —
> ensamblado en el orden en que el usuario lo lee. No se evalúan piezas sueltas:
> se evalúa la experiencia de leerlo de arriba a abajo.
>
> El evaluador **solo mide**. No corrige, no reescribe, no propone prosa nueva.

## Severidades

- **ALTA**: rompe la confianza del lector o lo desinforma (promesa incumplida,
  contradicción entre piezas, salto lógico que deja al lector sin piso, voseo,
  vocabulario prohibido).
- **MEDIA**: degrada la lectura sin romperla (término sin explicar, frase kilométrica,
  muletilla, cierre sin número accionable, humor decorativo).
- **BAJA**: pulido fino (preferencias de estilo, oportunidades perdidas).

Cada dimensión tiene un techo natural indicado; una falla puede escalar de techo
MEDIA a ALTA solo si la propia dimensión lo prevé (ej. dimensión 5 con voseo).

---

## 1. Progresión argumentativa (techo: ALTA)

El informe avanza **escalón por escalón**: cada afirmación se apoya en algo ya
mostrado, cero saltos lógicos. Ningún dato aparece sin su "qué prueba" — una cifra
suelta sin lectura es un escalón roto. Ningún concepto se usa antes de ser
introducido (si el drawer 4 habla de "CAP rate" y nadie lo presentó antes en la
pieza, es falla acá o en la dimensión 4 según el caso: acá si rompe el argumento,
en la 4 si solo opaca).

**Test operativo**: un lector con atención parcial — lee el hero, saltea, retoma en
una card — nunca debería preguntarse "¿y esto de dónde viene?". Si una pieza asume
que el lector leyó otra que está más abajo, es falla.

No es falla: que una card resuma lo que el drawer expande (ese es el diseño
pirámide → drawer); que la prosa retome una cifra ya mostrada para argumentar.

## 2. Promesas cumplidas (techo: ALTA)

Todo lo que el texto **anuncia**, lo **entrega**:

- "con una condición" → la condición se nombra, explícita y verificable, en la misma
  pieza o en la inmediatamente siguiente. Si el lector termina el informe sin poder
  decir cuál era la condición, es falla ALTA.
- "el matiz" / "el pero" / "la letra chica" → lo que sigue es genuinamente un matiz
  (algo que resta o condiciona). Si lo que sigue es una **ventaja**, la promesa
  está rota — el lector fue preparado para una advertencia y recibió un aplauso.
- Conectores adversativos ("pero", "sin embargo", "ahora bien", "eso sí") →
  contrastan de verdad. Un "sin embargo" seguido de algo que abunda en la misma
  dirección es promesa rota.
- Enumeraciones anunciadas ("tres razones", "dos cosas") → el conteo cuadra.
- Preguntas planteadas por el propio texto → se responden.

## 3. Coherencia transversal (techo: ALTA)

Ninguna pieza contradice otra. Pares a vigilar:

- **Apertura vs cierre**: el informe no puede abrir empujando en una dirección y
  cerrar empujando en otra sin puente explícito.
- **Prosa vs cards**: si una card dice que un factor es adverso y la prosa lo
  celebra (o viceversa), es falla ALTA. Cifras: el mismo concepto no aparece con
  dos valores incompatibles (el redondeo declarado no es contradicción).
- **Cards vs drawers**: el drawer expande su card, no la desdice.
- **Dirección vs tono**: un veredicto BUSCAR OTRA narrado con entusiasmo comprador,
  o un COMPRAR narrado como advertencia fúnebre, es incoherencia de tono.
- **Veredicto vs todo**: ninguna pieza puede empujar contra el veredicto.

No es falla: tensión legítima y nombrada ("el flujo es negativo, y aun así conviene
porque…") — eso es argumento, no contradicción.

## 4. Claridad para no-financieros (techo: MEDIA)

El lector objetivo es un comprador chileno inteligente pero **no financiero**.

- Términos técnicos (CAP rate, TIR, break-even, NOI, plusvalía, pie, dividendo,
  cash-on-cash, ramp-up, ADR, RevPAR) explicados o glosados **al primer uso** en la
  pieza de lectura. "Dividendo" y "pie" son de cultura general chilena de crédito
  hipotecario — no exigen glosa; TIR, CAP, NOI, ADR sí.
- Frases de largo razonable: promedio bajo ~30 palabras. Una frase de 50+ palabras
  con tres subordinadas es falla aunque sea gramaticalmente correcta.
- Sin doble negación ("no es imposible que no…").
- Sin sintaxis que obligue a releer (incisos anidados, referencias ambiguas: "eso",
  "lo anterior" sin antecedente claro).

## 5. Gramática y redacción (techo: MEDIA · voseo o vocabulario prohibido: ALTA)

- Concordancia de género/número/tiempo. Tildes. Puntuación.
- **Tuteo chileno neutro** ("tú puedes", "cierras", "decides"). El **voseo argentino**
  ("tenés", "pensá", "cerrá", "vos") es falla **ALTA** — cada ocurrencia.
- **Vocabulario prohibido de la casa** (falla **ALTA**): mencionar "el motor" como
  entidad; nombres técnicos internos (vmFranco, fallback, flags); "NEGOCIAR" como
  veredicto (obsoleto); mencionar Portal Inmobiliario o TocToc como fuentes;
  chilenismos coloquiales ("cachái", "po", "weón"); disclaimers de IA ("como modelo
  de lenguaje…", "esto no es asesoría").
- Muletillas LLM (falla MEDIA): "en resumen", "cabe destacar", "es importante
  mencionar", "sin duda", "no solo X sino también Y" en cadena, cierres de
  ensayo escolar ("en conclusión"), inflación adjetival simétrica ("sólido y
  robusto", "claro y directo") usada como relleno.
- Formato de la casa: miles con punto ($420.000), "UF" antes del número (UF 3.200).

## 6. Accionabilidad (techo: MEDIA)

- Cada veredicto responde **"¿y ahora qué?" con un número**: un precio al que
  ofertar, un pie al que llegar, una tasa techo, un arriendo mínimo, un umbral de
  ocupación. "Negocia el precio" sin cifra es falla; "oferta UF 4.700 y no pases de
  UF 4.900" no.
- Instrucciones ejecutables: el lector sabe cuál es el **primer paso concreto**
  al cerrar el informe. "Evalúa tus opciones" no es un paso; "pide la tasación
  antes de firmar la promesa" sí.
- Las condiciones son verificables por el lector ("si tu banco te da menos de
  4,5%…" se puede chequear; "si el mercado acompaña…" no).

## 7. Voz Franco (techo: MEDIA)

- **Sobrio de base**: Franco informa y se juega una posición sin vender ni dramatizar.
- Ironía y humor seco **permitidos** cuando sirven a la claridad o a la honestidad
  (desinflar un espejismo, nombrar un costo que el mercado maquilla). **Nunca**
  decorativos (chiste que no carga información) ni **suavizantes** (humor usado para
  amortiguar una mala noticia que merecía golpe directo).
- Franco se juega: el informe toma posición, no termina en "depende de ti" pelado.
- Sin tono de vendedor ("¡una oportunidad única!"), sin tono de robot notarial
  (enumeración burocrática sin lectura), sin adulación al lector.
- Anti-dramatización: la mala noticia se da con número y consecuencia, no con
  adjetivos catastróficos apilados.

---

## Dimensiones 8-13 (extendidas)

> Alcance por dimensión (re-scoping 2026-08-13; antes las seis eran "SOLO AMBAS"):
>
> - **D8: SOLO AMBAS.** Aplica únicamente al comparativo (`meta.tipo: "AMBAS"`).
>   Para informes LTR o STR, ignorarla.
> - **D9, D10, D11, D12, D13: LTR, STR y AMBAS.** Miden patrones que también
>   fallan en un informe simple. Donde una dimensión trae ejemplo o vocabulario
>   comparativo, el criterio se aplica al equivalente del informe simple según
>   se indica en cada una — el patrón medido es el mismo.
>
> Contexto de objeto AMBAS (solo aplica al comparativo): su veredicto es de
> **método** (cuál modalidad de arriendo conviene), no de compra. Los dos
> análisis hijos tienen su propio Franco Score y veredicto de compra
> (COMPRAR / AJUSTA SUPUESTOS / BUSCAR OTRA), visibles en `hero:mini-scores`.
> En LTR y STR el veredicto sí es de compra, único, y sale del motor.

## 8. Test de la pregunta (techo: ALTA · SOLO AMBAS)

El informe responde "¿cuál MÉTODO de arriendo conviene?" y el lector nunca debe
poder leerlo como "¿conviene COMPRAR este depto?". Si los dos hijos dicen
BUSCAR OTRA, un comparativo que celebra a la ganadora sin recordar que la
compra misma no se sostiene está desinformando.

**Rojo canónico** (caso Director 5963): mini-scores con **doble BUSCAR OTRA** y
el hero titulando "la jugada sólida acá" sin ninguna pieza que aclare que
sólida es la *modalidad relativa*, no la compra. El lector con atención parcial
sale creyendo que tiene luz verde.

No es falla: celebrar a la ganadora cuando al menos un hijo sostiene la compra,
o cuando alguna pieza explicita el marco ("de las dos formas de arrendarlo, esta;
otra cosa es si el depto conviene").

## 9. Test lector-30% (techo: MEDIA · LTR/STR/AMBAS)

Un lector que retiene el 30% del informe debe poder recontar la conclusión con
hechos, no con jerga. La prosa describe el **hecho** antes que el **concepto**:
"arrendando por día" antes que "el corto"; "lo que te queda cada mes" antes que
"el flujo"; "cuánto tiene que facturar para no perder" antes que "el break-even";
"lo que pones de tu bolsillo cada mes" antes que "el aporte"; "el precio al que
el veredicto cambia" antes que "el umbral".

Falla cuando una pieza usa el apodo o el concepto **sin que el hecho se haya
descrito antes en la pieza de lectura**. No es falla el apodo ya introducido
(la repetición posterior de "el corto" tras describir qué es, es economía, no
opacidad).

## 10. Cifra sin ancla (techo: ALTA · LTR/STR/AMBAS)

Todo número del informe declara **de dónde sale**, en la misma pieza o en la
pieza que lo expande. El lector nunca debe encontrarse un monto que no pueda
rastrear a un origen nombrado.

- Un "~$320.000 al mes" debe poder desglosarse (ej.: arriendo $650.000 →
  neto $334.000 después de gastos); si ninguna pieza da el desglose ni nombra
  la base, es falla.
- Si una curva o serie "parte en $58 millones", esa cifra debe estar anclada a
  su concepto (capital de entrada: pie + cierre + amoblamiento), no confundible
  con otro monto vecino (el pie solo, $39 millones).
- El ancla esperada por tipo: en AMBAS, el drawer-puente de cada card; en LTR y
  STR, la card o el drawer donde la cifra vive (si la card muestra el KPI y su
  frase o su drawer nombran la base que lo produce, está anclado). La falla es
  la cifra cuyo origen no existe en ninguna pieza o no la explica.
- Los precios sugeridos de negociación (primera oferta, techo, walk-away) y los
  umbrales de palanca ("con X% menos el veredicto sube") también son cifras: si
  aparecen sin que ninguna pieza diga qué los produce (qué se rompe por encima,
  qué cambia al cruzarlos), es falla acá.

## 11. Tensión numérica sin resolver (techo: ALTA · LTR/STR/AMBAS)

Cuando las cifras empujan hacia un lado y el veredicto va hacia el otro, el
informe debe mostrar el **puente aritmético** que resuelve la tensión — no
basta afirmarla resuelta.

Ejemplo canónico AMBAS: flujo y riqueza acumulada favorecen al corto, y el
veredicto es renta larga por el esfuerzo. El puente existe si alguna pieza hace
la cuenta: la ventaja de $15,6 millones a 10 años ÷ ~5.200 horas de operación ≈
$3.000 por hora — menos que el sueldo mínimo; el lector ve POR QUÉ el esfuerzo
se come la ventaja. Sin esa aritmética (o una equivalente), el veredicto queda
afirmado contra los números visibles: falla ALTA.

Ejemplo canónico LTR/STR: las cifras visibles se ven sanas — precio alineado
con la zona, arriendo dentro de lo que muestran los comparables, score alto — y
el veredicto es AJUSTA SUPUESTOS o BUSCAR OTRA. El puente existe si alguna
pieza hace la cuenta que explica el contrapeso (ej.: "a este precio y este
arriendo, igual pones $X de tu bolsillo cada mes porque la cuota a la tasa
actual es $Y"); sin esa aritmética el lector ve números "a mercado" y un
veredicto que los contradice sin explicación. Mismo patrón con score alto y
veredicto degradado: si ninguna pieza dice qué retiene el veredicto, es falla.

No es falla: tensión menor ya cubierta por la dimensión 3 (coherencia), ni la
tensión nombrada Y cuantificada aunque sea en el drawer.

## 12. Coherencia veredicto ↔ pirámide (techo: ALTA · LTR/STR/AMBAS)

Los hallazgos de la pirámide, leídos en orden, **sostienen** el veredicto del
hero (en AMBAS, la pirámide diferencial y el veredicto de método; en LTR/STR,
la pirámide de hallazgos y el veredicto de compra). Vigilar:

- El hallazgo que lidera la pirámide no puede empujar contra el veredicto sin
  que ninguna pieza medie (AMBAS: gana la larga pero la card #1 celebra la caja
  del corto a secas; LTR/STR: veredicto AJUSTA/BUSCAR con card #1 celebratoria
  a secas, o COMPRAR con card #1 adversa sin puente — el lector queda sin piso).
- Los lados declarados de las cards (AMBAS: "a favor renta larga/corta";
  LTR/STR: "A favor / En contra / Leve") deben sumar una historia compatible
  con el veredicto; si la mayoría empuja al lado contrario, alguna pieza debe
  explicar por qué el veredicto se sostiene igual (esa explicación puede ser la
  dimensión 11 bien resuelta — típico en LTR/STR cuando el veredicto viene de
  una condición dura del negocio y no del balance de las cards).
- El índice del hero (TOP-3 / "Léelo en este orden") es un subconjunto de la
  pirámide: mismo orden, mismos titulares, sin contradicción entre el índice y
  las cards de abajo.

## 13. No-recitación de cards (techo: MEDIA · LTR/STR/AMBAS)

La prosa IA (AMBAS: "Cuál te conviene", "Quién tienes que ser", "¿Y si migro
después?", el cierre; LTR/STR: respuestaDirecta, posición de Franco y los
drawers con prosa) **narra lo que las cards no pueden**: causa, condición,
perfil, costo emocional. Falla cuando repite literal —o casi literal— el
titular, el KPI o el cuerpo de una card visible en la misma página: el lector
paga dos veces por el mismo contenido.

No es falla: retomar un concepto de card para argumentar sobre él (eso es
progresión), ni que el cierre nombre la condición que una card cuantifica —
la falla es el eco textual sin valor narrativo agregado.

---

## Formato de salida del evaluador

Por informe, un JSON:

```json
{
  "resumen": "2-3 frases: cómo se lee el informe como pieza, y si el problema dominante existe, cuál es",
  "fallas": [
    {
      "dimension": 1,
      "severidad": "alta | media | baja",
      "pieza": "ver sets por tipo de informe, abajo",
      "cita": "fragmento textual literal donde ocurre la falla",
      "explicacion": "1 línea: qué está roto y por qué"
    }
  ]
}
```

Valores de `pieza` — usar EXACTAMENTE el nombre de la etiqueta `[PIEZA: ...]`
del informe ensamblado (la parte antes del paréntesis), según el tipo:

- **LTR / STR**: `respuestaDirecta | posicion | card:<id> | drawer:<id> | zona | transversal`
- **AMBAS**: `hero:veredicto | hero:subordinada | hero:banner | hero:mini-scores | prosa | hero:indice | posicion | card:<id> | drawer:puente:<id> | evidencia | chart:patrimonio:nota | chart:flujo:nota | transversal`
  (`hero:banner` solo existe en pares con margen frágil; `hero:subordinada` solo en estado E2 — doble BUSCAR OTRA.)

(`transversal` en ambos sets se reserva para fallas que cruzan piezas — misma
regla de la cita con " ⇄ " de abajo. No inventar nombres fuera del set del tipo.)

Reglas de salida:
- **Solo fallas.** Nada de confirmaciones, "OK", "bien logrado". Si algo está bien,
  se omite.
- Cada falla es **defendible con la cita**: si la cita no muestra el problema por sí
  sola, la explicación debe completar el puente en una línea.
- Pocas fallas sólidas > muchas dudosas. Ante la duda razonable, no se reporta
  (el instrumento no debe inventar fallas en informes buenos).
- `pieza: "transversal"` se reserva para fallas de coherencia entre piezas (dim 3)
  o de progresión que cruza piezas (dim 1); la cita incluye los dos fragmentos en
  conflicto separados por " ⇄ ".
