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
- Grano encima al 12% con `mix-blend-mode: overlay`.
- El fondo del hero **no depende del veredicto**: es el mismo espectro siempre.
- Eyebrow (dirección · tipología · superficie a la izquierda, modalidad a la derecha),
  opacidad .6. En móvil se apila.
- **Botón de veredicto**: píldora del color del veredicto, con anillo blanco de 2 px
  (`box-shadow: 0 0 0 2px rgba(255,255,255,.3)`) y un punto blanco que late —
  `scale(.6) → scale(2.1)`, opacidad .6 → 0, 1.8 s, infinito.
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

### Fondo

`linear-gradient(135deg, var(--verdict-deep) 0%, #18181B 100%)` — del tono profundo del
veredicto a tinta — con `brightness(1.30) saturate(.70)` en capa aparte y grano al 10%.
**Es la única pieza cuyo fondo depende del veredicto.**

### Contenido

```
La recomendación de Franco          ← Inter 22 / 700
Para que el veredicto pase a X      ← bajada, opacidad .62

Cambias    [Pie 20% 30%] + [Plazo 25 30 años]
──────────────────────────────────────────────
Negocias   −3,8% dcto.
           UF 5.502 → UF 5.293
──────────────────────────────────────────────
Resultado  AJUSTAR → COMPRAR

Poner ese pie cuesta $22.000.000 más el día uno.

[ ▶ Ver el detalle de cada cambio ]
```

Reglas:

- Grid de dos columnas: rótulo de **96 px fijos** (78 en móvil) pegado al margen izquierdo,
  y el valor. Separador de 1 px entre filas.
- Los rótulos son **Cambias / Negocias / Resultado**, en mayúsculas, 11,5 px, opacidad .5.
- **Lo que se cambia va tachado y transparente; lo nuevo, sólido.** Aplica a los chips y
  al precio.
- Signo `+` entre los dos chips de cambio.
- El descuento va a 30 px (26 en móvil). No más grande: compite con la cifra del hero.
- La transición de veredicto: píldora del actual al 45% de opacidad, flecha, píldora del
  destino en blanco sólido.
- El costo del día uno **siempre** acompaña al mix. Sin esa línea, el mix miente por omisión.
- CTA: botón blanco sólido con icono, no un enlace.

### Qué dice según veredicto

- **AJUSTA / BUSCAR OTRO con salida**: la ecuación completa, apuntando a COMPRAR.
- **COMPRAR**: sin ecuación. Bajada «Cierra al precio pedido», y dos datos — cuánto aguanta
  antes de bajar, y qué verificar antes de firmar.
- **Sin salida**: sin ecuación. Bajada «No hay forma de que este departamento convenga»,
  el número real de lo que haría falta, y la alternativa de comunas.

**Nunca se muestra un mix que solo llega al escalón intermedio.** Si el mix no alcanza
COMPRAR, no es una recomendación. El escalón a Ajustar vive en el pop-up.

---

## 6 · Las cifras que tienes que ver

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

Sin caja. Cinco filas navegables, **sin números romanos**.

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

---

## 11 · Lo que falta definir

No está en este contrato y **no se inventa**:

- El contenido de los pop-ups (capítulos, palancas, matriz, comparables).
- STR. El sistema visual sirve, pero su contenido no calza: seis capítulos, otras cifras
  clave, y el bloque de regulación del edificio que LTR no tiene. Necesita su propia pasada.
- El CTA de re-analizar con los cambios sugeridos: depende de una decisión de producto
  sobre créditos que no está tomada.
