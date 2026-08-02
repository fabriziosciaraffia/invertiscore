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

## Formato de salida del evaluador

Por informe, un JSON:

```json
{
  "resumen": "2-3 frases: cómo se lee el informe como pieza, y si el problema dominante existe, cuál es",
  "fallas": [
    {
      "dimension": 1,
      "severidad": "alta | media | baja",
      "pieza": "respuestaDirecta | posicion | card:<id> | drawer:<id> | zona | transversal",
      "cita": "fragmento textual literal donde ocurre la falla",
      "explicacion": "1 línea: qué está roto y por qué"
    }
  ]
}
```

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
