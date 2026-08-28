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
acto CTA de 4 s. Réplica de `ref/lineas-top5-SAFEZONE-t25.html`.

```bash
cd tools/reels && npm run render:lineas    # MP4 del reel
cd tools/reels && npm run still:lineas     # PNG del frame final (719)
cd tools/reels && npm run render:portada   # PNG de la portada
```

La portada es la composición `PortadaLineas`, réplica de `ref/portada-reel-SAFEZONE.html`. Es
estática: se exporta con `remotion still`, no se renderiza a video.

Su dataset se genera aparte del de la carrera:

```bash
node --import tsx scripts/data/generar-dataset-lineas.ts
node --import tsx scripts/data/generar-dataset-lineas.ts "Recoleta,Macul,Renca,Buin,Colina"
```

Sin argumento usa el top-5 del mes. Con lista propia, el reel del mes siguiente no toca
código: los colores se asignan por posición y los emojis por nombre, ambos como props.

### Notas de réplica

- Layout de zonas seguras: el bloque entero baja (hook en 100, gráfico en 206/118) y el
  pie sube a 48, para despejar las franjas donde Instagram monta su interfaz.
- Paleta viva (blanco puro, rojo `#FF4D5A`, neutros más claros): el reel compite con el
  resto del feed en un celular a brillo alto, donde los tonos de papel se apagan.
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
