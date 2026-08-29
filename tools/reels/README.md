# Reels de refranco.ai (Remotion)

Proyecto **aislado** del app Next. Tiene su propio `package.json`, su propio `tsconfig`
y sus propias dependencias: `tools/**` está excluido del `tsconfig.json` de la raíz para
que estos archivos no entren al `next build`.

## Reel 1 — carrera de plusvalía por comuna

Composición `BarRacePlusvalia`: 1080×1920, 30fps, 480 frames (16 s).

### Instalación (una vez)

```bash
cd tools/reels && npm install
```

### Previsualizar en el navegador

```bash
cd tools/reels && npm run dev
```

Abre el Studio de Remotion con la línea de tiempo, para revisar cuadro a cuadro.

### Renderizar el MP4

```bash
cd tools/reels && npm run render
```

Deja `tools/reels/out/reel-plusvalia.mp4`. Remotion levanta un Chrome headless propio
(lo descarga solo la primera vez, ~150 MB). El render completo toma unos minutos.

Un cuadro suelto, para revisar composición sin esperar el video entero:

```bash
cd tools/reels && node_modules/.bin/remotion still BarRacePlusvalia out/f300.png --frame=300
```

La carpeta `out/` y los `.mp4` están en el `.gitignore`: el video es un entregable, no
un archivo del repo.

## Doctrina de dirección de arte

- **Fondo PLANO, sin degradés, desde el próximo reel.** Decisión post-test en celular
  (28-ago-2026): los degradés oscuros sufren banding con la compresión de Instagram.
  El reel de líneas salió con el degradé neón porque se aprobó antes de la regla; no
  sienta precedente. Ya está parametrizado: el campo `fondo` del tema acepta un color
  plano (`"#16161E"`) igual que un `linear-gradient(...)` — aplanar un tema nuevo es
  escribir un hex, sin tocar componentes.

## De dónde salen los números

De ningún lado que se pueda editar a mano. El dataset se genera:

```bash
node --import tsx scripts/data/generar-dataset-reel.ts
```

Lee `src/lib/plusvalia-estimado.gen.ts` —el mismo módulo que alimenta `/comunas` y el
Franco Score— y escribe `data/dataset-plusvalia-2015-2025.json`. El generador lleva tres
guardas que revientan en vez de dejar publicar algo falso:

1. **Coherencia con el producto**: el acumulado final de cada comuna tiene que coincidir
   con el `plusvalia10a` que ya publica la página.
2. **Guarda del titular**: las comunas más caras tienen que seguir cayendo al fondo del
   ranking. Si el dato cambia y el titular deja de ser cierto, el dataset no se genera.
3. **Eventos de pista**: las entradas, salidas y llegadas al podio se calculan desde la
   serie. El reel marca con un pulso solo cuatro de esos momentos y verifica que existan
   en la lista — no puede destacar un adelantamiento que nunca ocurrió.

Los textos (titular, payoff, rótulo del pie) se **arman** desde el dataset en
`src/Root.tsx`. Para la carrera del mes siguiente se cambia el JSON y las cifras se
recalculan solas.

## Notas de diseño

- Geometría tomada del prototipo `ref/carrera-comunas-v2.html`, escalada ×2,667 desde su
  preview de 405×720. Los detalles y las dos desviaciones deliberadas (dirección light y
  zonas seguras de Instagram) están comentados en `src/canon.ts`.
- Zonas seguras: riel derecho 128 px y franja inferior 400 px sin contenido legible.
- Cromática de marca: Ink y Signal Red, jerarquía por escala de grises. La protagonista
  va en rojo, las comunas caras del titular en gris medio, el resto en Ink.
- Tipografías: Source Serif 4, IBM Plex Sans y JetBrains Mono, las tres bajo SIL OFL 1.1
  — uso comercial en video permitido, sin atribución en pantalla.
- Ninguna animación usa transiciones CSS: Remotion renderiza cada cuadro por separado y
  una transición temporal saldría congelada. Todo es función pura del frame
  (`src/carrera.ts`).

## Reel 2 — "Diez años de plusvalía" (líneas top-5)

Composición `LineasTop5`: 1080×1920, 30fps, 720 frames (24 s) — 20 s de gráfico más un
acto CTA de 4 s. Layout y timing de `ref/lineas-top5-SAFEZONE-t25.html`.

El color vive aparte, como TEMA (`TEMAS` en `src/lineas.ts`): `neon`
(`ref/color-A-neon.html`) y `light` (`ref/color-C-light.html`). Tras el test en celular
**ganó neón** — es `TEMA_POR_DEFECTO` y el default de las props; light sigue
renderizable por su composición, pero no es default. Cada variante es una composición
con nombre propio:

```bash
cd tools/reels && npm run render:lineas:neon     # out/reel-lineas-neon.mp4
cd tools/reels && npm run render:lineas:light    # out/reel-lineas-light.mp4
cd tools/reels && npm run still:lineas:neon      # frame final (719) de cada una
cd tools/reels && npm run still:lineas:light
cd tools/reels && npm run render:portada:neon    # out/portada-neon.png
cd tools/reels && npm run render:portada:light   # out/portada-light.png
```

La portada es la composición `PortadaLineas` y HEREDA el tema del video — no hay HTML de
portada por variante. Es estática: se exporta con `remotion still`, no se renderiza a
video.

Su dataset se genera aparte del de la carrera:

```bash
node --import tsx scripts/data/generar-dataset-lineas.ts
node --import tsx scripts/data/generar-dataset-lineas.ts "Recoleta,Macul,Renca,Buin,Colina"
```

Sin argumento usa el top-5 del mes. Con lista propia, el reel del mes siguiente no toca
código: los colores se asignan por posición y los emojis por nombre, ambos como props.

## Reel 2 final — "El efecto amplificador del crédito"

Composición `Reel2Palanca`: 1080×1920, 30fps, 720 frames (24 s). Réplica de
`ref/reel2-prototipo-v8.html` con los cambios de alcance decididos: Fondo A y depósito
salen del cuadro (sus series siguen en el JSON para el Reel 3), hook con la ganancia
neta, título sobrio y eje X con años seleccionados. Fondo PLANO `#0C0C12` (doctrina),
tema propio `TEMA_REEL2` en `src/reel2.ts` — el neón del reel 1 queda intacto.

```bash
cd tools/reels && npm run render:reel2    # out/reel2-palanca.mp4 (por render-limpio)
cd tools/reels && npm run still:reel2     # un frame de control
node --import tsx scripts/data/backtest-reel2.ts   # regenera el dataset (motor real)
```

Todas las cifras salen de `data/dataset-backtest-2015-2025.json`: las series de las
tres líneas, el aporte inicial (496,82 UF), el capital redondo del hook (500), la
ganancia neta (1.219,7 → "UF 1.220") y los % de las etiquetas (`meta.tir`, TIR anual
exacta con aportes en sus fechas) — nada se recalcula en componentes. La serie
"depto sin crédito" es un CONTRAFACTUAL ILUSTRATIVO declarado en meta: las mismas UF
compran al contado una fracción del mismo inmueble, para aislar el efecto del crédito.

Paridad editorial con el reel 1 (sus constantes mandan sobre la v8, que fue hecha a
ojo): hook chico = titular del reel 1 (px(25), lh 1.16, 700, top px(100)); título del
gráfico en el slot del ANTETÍTULO (sans 600 px(11.5), mayúsculas, tracking 0.2em);
etiquetas de línea escaladas por px(9.5)/29; marca de agua del año a ~91 px / 0,15
anclada a la derecha dentro del gráfico; pie de fuentes izquierdo (px(7.2), bottom
px(48)); CTA completo del reel 1 (cascada izquierda, rojos en Franco/gratis/.ai,
delays 0,5/1,05/1,6 y subida px(26)). Sin equivalente y derivados por proporción:
corchete (v8 tal cual) y rótulo "la palanca" (48 ≈ titular×0,72). El hook queda
CENTRADO en ambos estados (cambiar la alineación a mitad del vuelo saltaría) y ocupa
pantalla completa 3,5 s con subida de 0,5 s. El rótulo del contrafactual es
"Sin crédito (misma plata)": la línea es la fracción comprada al contado, no un
departamento entero sin deuda.

Desviaciones de la v8, cazadas por los stills de verificación:
- Los pares de años adyacentes del eje X (2015/2016 y 2024/2025) se separan con
  anclas end/start — a fuente 28 se montaban.
- Los nombres de las etiquetas envuelven a dos líneas: la v8 los dejaba en `nowrap`
  y el lienzo cortaba "Depto con crédito" en el freeze.
- Los %/año son estáticos (meta.tir); la v8 los recalculaba cuadro a cuadro contra
  la plata aportada.

### Notas de réplica

- Layout de zonas seguras: el bloque entero baja (hook en 100, gráfico en 206/118) y el
  pie sube a 48, para despejar las franjas donde Instagram monta su interfaz.
- En el tema `neon` el prototipo usa DOS grises secundarios: uno en el CSS (antetítulo,
  "re" del wordmark) y otro dentro del SVG (eje, años, referencia). Por eso el tema
  tiene `tx3` y `tx3Grafico`. Lo detectó el gate de valores contra el HTML, no el ojo.
- En `light` la marca de agua del año va en tinta, no en el `INK='#FFFFFF'` que el HTML
  dejó de resto del tema oscuro (blanco al 15% sobre crema sería invisible).
- El tamaño del titular vive en `TITULO_FS` (`src/LineasTop5.tsx`); a 33 ocupaba tres
  líneas, a 25 entra en dos.
- El acto CTA replica transiciones CSS en frames: fundido de 0,7 s sobre gráfico y hook,
  y dos líneas que entran desde abajo con 0,5 s y 1,05 s de retardo, con la curva `ease`
  de CSS (`Easing.bezier(0.25, 0.1, 0.25, 1)`). El pie NO se desvanece: en el prototipo
  el `.dim` solo alcanza a `.stage` y `.hook`.
- El CTA cierra con una cascada de tres escalones (0,5 s / 1,05 s / 1,6 s), el último de
  los cuales es el wordmark. El wordmark del pie se desvanece con el gráfico para no
  duplicarlo — desviación deliberada del prototipo, que los mostraba a los dos. La línea
  de fuente NO se desvanece: la atribución del dato queda en pantalla todo el cierre.
- Los emojis (los de comuna y el 🚀 del CTA) salen de la fuente de emoji del sistema, no
  de Remotion. Verificado en el entorno de render.
- Color: `Config.setColorSpace("bt709")` NO alcanza — deja `color_primaries` y
  `color_trc` sin especificar. El paso de limpieza los completa con el filtro de
  bitstream `h264_metadata`, sin recomprimir, y verifica los tres campos antes de
  escribir el archivo final. Ver `scripts/render-limpio.mjs`.
