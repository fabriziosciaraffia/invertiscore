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
