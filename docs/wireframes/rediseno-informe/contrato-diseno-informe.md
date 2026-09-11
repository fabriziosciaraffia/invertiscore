# Contrato de diseño — informe LTR

Este archivo es la fuente de verdad del rediseño del informe. El HTML de al lado
(`informe-final.html`) muestra cómo se ve; este documento dice qué es cada cosa, qué token
usa y qué no se toca.

Cualquier goal del rediseño lee este archivo en FASE 0. Si algo del código contradice
este documento, gana este documento. Si algo no está acá, se pregunta antes de inventarlo.

**Caso de referencia del mockup:** 7710a017 · Av. Providencia · 2D2B 60 m² · AJUSTA · 66.
Las cifras del mix son ilustrativas; el resto es real.

---

## 0 · Lo que NO cambia

- La tríada Tinta del veredicto: rojo `#C8323C` / ciruela `#6E4560` / azul `#2B558F`,
  con sus tonos profundos `#7A1F27` / `#442B3B` / `#1B3559`.
- El plumón sobre el titular del hero.
- Las cuatro líneas de hallazgo: su contenido, su orden agrupado, sus flechas y su
  columna de cifras alineada a la derecha. Eso se cerró en un goal propio y no se re-litiga.
- La regla de que la cifra negativa lleva Signal Red y ninguna otra.
- Los drawers como capa de profundidad.

## 1 · Fundamentos

### Tipografía

| Uso | Familia | Tamaño | Peso |
|---|---|---|---|
| Titular del hero | Source Serif 4 | 30 px (25 en móvil) | 600 |
| Título de sección | Inter | 21 px (19 en móvil) | 700, `letter-spacing: -.02em` |
| Título de la recomendación | Inter | 22 px | 700 |
| Cuerpo | Inter | 13–14 px | 400–500 |
| Cifras | Inter | según pieza | 700, `letter-spacing` negativo |

**Source Serif 4 se reserva para el titular del hero.** Todo lo demás es Inter.
El mono se retira de cifras, referencias y rótulos.

**La columna de cifras de los hallazgos exige `font-variant-numeric: tabular-nums`**,
en la clase de la columna y no suelto. Medido: sin él la alineación se cae; con él Inter
alinea igual que el mono y además el caso ancho (`−$1.149.025`) pasa de 118,8 a 100,2 px,
que a 390 px es la diferencia entre apretar y no. El catch-test lo fija.
El signo menos queda más chico que en mono (5,74 contra 8,55 px) y **no se compensa con
CSS**: si se ve débil se resuelve con peso, nunca con `transform`.

### Superficies

**Tres niveles de superficie, más las líneas.** El mockup solo muestra dos porque no
incluye drawers, pop-ups ni el Dial; el tercero existe para lo que vive dentro de una
tarjeta o de un modal.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--page` | `#FFFFFF` | `#0C0C0E` | fondo de la página y de las secciones sueltas |
| `--card` | `#F4F4F6` | `#1A1A1E` | tarjetas de cifras, filas de capítulo, tarjetas de zona |
| `--sunk` | `#EBEBEE` | `#232328` | lo que va **dentro** de una tarjeta o de un modal |
| `--line` | `#E9E9EC` | `#232327` | separadores |
| `--line2` | `#D6D6DB` | `#37373D` | bordes de hover y controles |

Los `--doc-paper3` / `--doc-paper4` de hoy y el `--doc-inset-2` mapean a `--sunk`.
La regla de `--doc-inset` construida en `daedff8b` **se conserva**: cada sección declara
qué superficie va adentro suyo, en vez de que cada bloque adivine mirando el tono de su
contenedor. La escala nueva se apoya en ese andamio, no lo reemplaza.

Texto: `--tx` `#18181B` / `#FAFAFA` · `--tx2` `#3F3F46` / `#D4D4D8` ·
`--tx3` `#71717A` / `#A1A1AA` · `--tx4` `#A1A1AA` / `#71717A`.

### Los tres sistemas de color, y para qué es cada uno

No se mezclan. Cada uno responde una pregunta distinta:

| Sistema | Tokens | Para qué |
|---|---|---|
| **Tríada del veredicto** | `--verdict` / `--verdict-deep`, rojo · ciruela · azul | cuando la pieza **nombra un veredicto**: banda, botón, plumón, fondo de la recomendación |
| **Direccional** | `--signal` `#C8323C` baja · `--up` `#2B558F` / `#6C9BE0` sube | cuando algo **empeora o mejora** tu caso: flechas de hallazgo, cifra negativa, píldoras de zona |
| **Semáforo del dato** | `--doc-good` / `--doc-warn` / `--doc-neutral` | cuando se **mide un dato contra un umbral** sin nombrar el veredicto: Dial, matriz, celdas de los capítulos |

El semáforo del dato **se conserva tal como está** (57 usos). No se retira ni se
reapunta a la tríada: son cosas distintas y confundirlas fue el error que el goal de la
tríada vino a arreglar.

La cifra negativa lleva `--signal` y ninguna otra cifra lleva color por dirección.

### Radios y sombra

`--rad: 16px` cajas · `--rad-s: 12px` tarjetas y filas · `--rad-xs: 10px` chips.
Píldoras y botones en `99px`. Sombra solo en las dos cajas y en el hover de capítulos.

---

## 2 · Estructura de la página

Orden fijo:

1. **Hero** — con caja
2. **Hallazgos** — suelto
3. **La recomendación de Franco** — con caja
4. **Las cifras que tienes que ver** — suelto
5. **Detalle de la inversión** — suelto
6. **Ubicación · <comuna>** — suelto

**Solo el hero y la recomendación llevan caja** (borde redondo, sombra, fondo propio).
El resto va suelto sobre el papel, separado por espacio: `margin-bottom: 38px`.
Las dos cajas llevan `margin-bottom: 34px`.

Ancho máximo 700 px. Móvil se prueba a 390 px.

---

## 3 · Hero

- Fondo: gradiente del espectro, tonalidad 2 —
  `linear-gradient(135deg,#0F2440 0%,#2E1C28 50%,#4E1119 100%)` — con
  `filter: brightness(1.10) saturate(.90)` aplicado a **una capa de fondo aparte**,
  nunca al texto.
- Grano encima al **16%** con `mix-blend-mode: overlay` (medido: 1,94% de amplitud;
  el 12% del mockup daba 1,53%).
- El fondo del hero **no depende del veredicto**: es el mismo espectro siempre.
- Eyebrow: **solo dirección y comuna** a la izquierda («Merced 562 · Santiago»), opacidad
  .6. Tipología y superficie viven en la ficha, no acá. A la derecha la modalidad —«Renta
  larga» / «Renta corta»— en **negrita y un punto más grande**. En móvil se apila.
- **Botón de veredicto**: píldora del color del veredicto con anillo blanco de 2 px
  (`box-shadow: 0 0 0 2px rgba(255,255,255,.3)`). Orden: **signo · rótulo · punto** —
  `[✕ BUSCAR OTRO ●]`, `[− AJUSTAR ●]`, `[✓ COMPRAR ●]`. Los glifos son los de la landing
  (U+2715, U+2212, U+2713). El punto va a la derecha y late con **doble anillo**: dos
  anillos de 2 px, `scale(.9) → 3.4`, ciclo 1,6 s, el segundo con `animation-delay: .8s`,
  opacidad .95 sostenida en .55 hasta el 60% del ciclo. Siempre hay uno visible.
  **Obligatorio**: se desactiva con `@media (prefers-reduced-motion: reduce)`.
- Score en texto plano: «Franco Score 66 de 100».
- Titular en serif con el plumón blanco al 26%.
- Cifra clave y su caption.

---

## 4 · Hallazgos

Sin caja. Título de sección, y las cuatro filas como ya están en producción:
grid `22px 1fr auto`, flecha ↓ en `--signal` / ↑ en `--up` a 20 px, frase a 14 px en
`--tx2`, cifra a la derecha con ancho mínimo de 118 px (96 en móvil) y su referencia debajo.

**Esta sección es la única que usa la primitiva de fila-afirmación.** Ya no es el formato
de todo el informe.

---

## 5 · La recomendación de Franco

Aplica igual a LTR y STR. Lo único que cambia entre los dos es el nombre de la palanca
que pone el mercado: **arriendo** en LTR, **tarifa** en STR.

### Fondo

`linear-gradient(135deg, var(--verdict-deep) 0%, #18181B 100%)` — del tono profundo del
veredicto a tinta — con `brightness(1.30) saturate(.70)` en capa aparte y grano al 16%.
**Es la única pieza cuyo fondo depende del veredicto.**

### Contenido — con salida

```
La recomendación de Franco                          ← Inter 22 / 700
Para que el veredicto pase a  [✓ COMPRAR]           ← bajada + píldora neutra con ✓, sin color

┌ MODIFICACIONES QUE DEPENDEN DE TI ──────────────┐   ← caja rgba(255,255,255,.10)
│ [Pie 20% 30%] + [Plazo 25 30 años]              │   ← chips, tachado-transparente vs sólido
│ ────────────────────────────────────────────    │
│ → Negocias −9,4% dcto. en precio                │   ← 19 px / 700, entero
│ (−18% si solo modificas el precio)              │   ← 12,5 px, acotación
└─────────────────────────────────────────────────┘

RESULTADO
[− AJUSTAR] → [✓ COMPRAR]                           ← píldoras con signo; actual al 45%,
                                                       destino en blanco sólido

Alternativamente: +8% de tarifa o −18% de precio (c/u por separado)   ← 13,5 px
Pero eso no depende de ti: lo pone el mercado o el vendedor.          ← 12,5 px, acotación

Poner ese pie cuesta UF 230 más el día uno.        ← 12,5 px, acotación

[ ▶ Ver el detalle de cada cambio ]
```

Reglas:

- **Lo tuyo primero.** La recomendación ES lo que puedes hacer tú. Las palancas que no
  dependen de ti van después, en una sola oración, sin fila propia.
- La caja «Modificaciones que dependen de ti» contiene los chips del mix y, bajo una línea,
  el descuento que resulta: «→ Negocias −X% dcto. en precio». Flecha, verbo y cifra en el
  mismo formato. Debajo, entre paréntesis y como acotación, cuánto habría que pedir sin
  mover lo tuyo.
- **Lo que se cambia va tachado y transparente; lo nuevo, sólido.** Signo `+` entre chips.
- **Resultado va inmediatamente después de la caja**, no al final: píldoras con signo,
  la actual tenue y el destino en blanco.
- «Alternativamente» nombra las palancas solas que también cruzan —tarifa/arriendo y
  precio— con «(c/u por separado)», y la línea siguiente dice por qué no son la
  recomendación: no dependen de ti.
- Las tres acotaciones —el paréntesis del descuento, «Pero eso no depende de ti», y el
  costo del día uno— van al **mismo tamaño y opacidad** (12,5 px, .6). Ninguna destaca.
- El costo del día uno **siempre** acompaña al mix. Sin esa línea, el mix miente por omisión.
- Si el mix no pide descuento, la línea dice «→ Sin pedirle un peso al vendedor» y el
  paréntesis se omite.
- Si una palanca sola ya cruza y el mix es redundante con ella, no se dibuja el mix.
- CTA: botón blanco sólido con icono.
- Ninguna cifra de una tarjeta o fila lleva chip de «quién lo pone»: el grupo y la oración
  de «Alternativamente» ya lo dicen.

### Qué dice según veredicto

- **AJUSTA con mix a COMPRAR**: la forma completa de arriba.
- **AJUSTA sin mix, con palancas solas que cruzan**: sin la caja; «Alternativamente» pasa a
  ser la línea principal con sus dos acotaciones, y Resultado se conserva.
- **COMPRAR**: sin ecuación. Bajada «Cierra al precio pedido», y dos filas con rótulo de
  una palabra: **Aguanta** (cuánto antes de bajar) y **Verifica** (el arriendo o la tarifa
  declarada).
- **Sin salida** (nada llega a COMPRAR): bajada «No hay forma de que este departamento
  convenga». El número real de lo que haría falta. El puente: «Franco no encontró una
  combinación que lo haga convenir. Prueba con otro departamento.» Y la salida, cuando el
  motor la tiene:
  - **LTR**: «En X o Y un departamento como este sí convendría», calculado por
    `alternativa-comunas.ts`. Dos comunas máximo, sin cifras. Si el motor no encuentra
    ninguna, la línea no se dibuja.
  - **STR**: si el hallazgo «el arriendo largo te rendiría más» existe, la salida es
    **«Analízalo como renta larga»** —mismo depto, mismo precio, otra operación—. Solo
    cuando el motor lo dice; si no, cae al puente y a las comunas cuando el motor STR las
    calcule.

**Nunca se muestra un mix que solo llega al escalón intermedio.** Si el mix no alcanza
COMPRAR, no es una recomendación. El escalón a Ajustar vive en el pop-up. Y la bajada dice
«pase a Comprar» o no dice nada: nunca otro destino.

---

## 6 · Las cifras que tienes que ver

Sin caja. Seis en LTR y seis en STR, con la misma tarjeta.

**En STR las dos primeras son tarifa por noche y ocupación**, con un contorno de 1,5 px en
`--line2` y una línea encima: «Las dos primeras son el supuesto del que cuelga todo lo
demás». En renta corta el ingreso no es un dato, es una estimación, y eso se declara.
Después: ingreso mensual, flujo mensual, cap rate por día (referencia 5,0%), TIR a 10 años.

Sin caja. Grid de dos columnas (una en móvil), gap 11 px.
Cada tarjeta: fondo `--card`, radio 12 px, padding 17 px.

```
Cap rate neto        ← 13 px, --tx3
4,3%                 ← 29 px / 700 (25 en móvil)
Descontados los gastos. Referencia de mercado: 4,0%.
                     ← 13 px, --tx2, con lo importante en <b>
```

La cifra lleva `--signal` solo cuando es negativa. Las tarjetas **no reaccionan al hover**:
no se abren, y esa diferencia es información.

Cierra con el enlace «Ver cómo se calcula →».

---

## 7 · Detalle de la inversión

Sin caja. **Cinco filas en LTR, seis en STR**, navegables, **sin números romanos**.

STR: Cuánto renta (Cap rate) · Tu flujo mensual (Flujo) · Cuántas noches necesitas (Al año)
· Cómo lo pagas (Precio) · Cómo lo gestionas (vs arriendo largo) · Tu resultado a 10 años
(Resultado). Cada cifra con su apellido, porque el título es una pregunta y la cifra queda
al otro extremo de la fila.

```
[  Cuánto pones al principio          $53,9M   › ]
```

- Fondo `--card`, radio 12 px, grid `1fr auto auto`.
- Cada fila trae **su cifra**, para que la lista sirva sin abrir nada.
- Affordance: al hover la fila levanta 1 px, gana borde y sombra, y el disco del chevron
  se llena de `--tx` con el símbolo en `--page`.
- Cada fila abre su pop-up. El contenido de los pop-ups no está definido todavía.

---

## 8 · Ubicación · \<comuna\>

Sin caja. Va **al final**. Tres tarjetas, mismo estilo que las cifras.

```
Tu arriendo          ← qué es
$960.000             ← tu valor, 26 px / 700
mediana $896.000     ← la referencia
[ 7% sobre ]         ← la diferencia, píldora
10 publicaciones a menos de 800 m.   ← una línea, no más
```

- Orden: **el arriendo primero**, porque es el único dato tuyo que puede quedar peor que
  la referencia y es el número del que cuelga todo el análisis.
- Píldoras: `bien` en `--up`, `mal` en `--signal`, `neu` en gris, todas con fondo al 12%.
- El caveat del período de valorización va en un pie común debajo de las tres, no dentro
  de la tarjeta.
- Cierra con «Ver los comparables →».

**En STR las tres tarjetas son otras**: **ocupación primero** (tu 47% contra lo típico de la
comuna 46%) —es el único dato tuyo que puede quedar peor que la referencia—, después
**tarifa por noche** (tú contra la mediana; sin ajuste propio la píldora es neutra), y la
tercera son **los comparables** (25 avisos, cuántos superhost, radio), no valorización. El
pie común dice la fecha de las estimaciones.

---

## 9 · Affordance

Tres niveles, y la diferencia entre ellos es información:

| Pieza | Tratamiento |
|---|---|
| Botón (CTA de la recomendación) | fondo sólido, icono circular, sombra, `translateY(1px)` al presionar |
| Fila navegable (capítulos) | levanta al hover, borde, sombra, disco que se llena |
| Enlace («Ver cómo se calcula», «Ver los comparables») | subrayado al 35% que se satura al hover, con flecha |
| Tarjeta de cifra, tarjeta de zona, fila de hallazgo | **sin reacción**: no se abren |

---

## 10 · Copy

- **Nada de vocabulario interno en texto visible**: ni «palanca», ni «vía», ni «brecha»,
  ni «hallazgo», ni «cruza», ni «el motor». Se retiraron en un goal propio y no vuelven.
- Los rótulos dicen hacia dónde mueve algo, no solo qué es.
- Títulos de sección fijados: «Las cifras que tienes que ver», «Detalle de la inversión»,
  «Ubicación · \<comuna\>».
- El título de los hallazgos sigue siendo la línea que declara el veredicto
  («Ajusta los números. Esto es lo que pesa:»), que vive en `veredicto-etiqueta.ts`.
- **Quién pone cada palanca** se dice con la forma «Lo pone el mercado, no tú» / «Lo pone
  el vendedor, no tú»: nombra quién y descarta que seas tú en el mismo gesto. En la card no
  va como chip por fila —el grupo y la oración lo dicen—; en el pop-up de palancas sí.
- Los **números llevan apellido** cuando el contexto no está pegado: «Cap rate 4,3%»,
  «Flujo −$283.194», «Al año 171 noches». En una tarjeta con el rótulo a 9 px no hace falta;
  en una fila de 700 px de ancho, sí.

---

## 11 · STR: qué es distinto y qué se hereda

Todo el sistema —paleta, tipografía, radios, primitivas, affordance, hero, la card— se
hereda tal cual. Lo que es propio de STR:

| Pieza | LTR | STR |
|---|---|---|
| Modalidad en el eyebrow | Renta larga | Renta corta |
| Cifras | cap rate bruto/neto, retorno, flujo, cobertura, TIR | **tarifa, ocupación** primero; ingreso, flujo, cap rate por día, TIR |
| Capítulos | 5 | 6 (entran «Cuántas noches necesitas» y «Cómo lo gestionas») |
| Palanca del mercado | arriendo | tarifa |
| Zona | arriendo, precio/m², valorización | **ocupación**, tarifa, comparables |
| Salida sin mix | comunas (motor) | «Analízalo como renta larga» si el hallazgo existe; comunas cuando el motor STR las calcule |
| Regulación del edificio | — | **retirada**: no se pregunta, no se muestra, no pesa |

El interruptor es por modalidad: STR se enciende cuando su pasada esté completa, con su
propio commit de encendido y su revert.

---

## 12 · Lo que falta definir

No está en este contrato y **no se inventa**:

- El contenido de los pop-ups (capítulos, palancas, matriz, comparables). Los capítulos
  siguen siendo acordeón inline hasta que se rediseñen.
- El contrafactual de comunas para STR: `alternativa-comunas.ts` corre `runAnalysis` LTR;
  STR necesita el suyo con tarifa y ocupación por comuna.
- El CTA de re-analizar con los cambios sugeridos: depende de una decisión de producto
  sobre créditos que no está tomada.
- El refactor de la recomendación como sección hermana del hero (hoy `HeroLTR` emite las
  tres secciones).
