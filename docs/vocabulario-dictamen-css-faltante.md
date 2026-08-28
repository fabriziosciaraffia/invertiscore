# Vocabulario visual del rediseño Dictamen: el CSS nunca se escribió

**Estado**: diagnóstico cerrado, sin fix. Traspaso a quien retome el rediseño Dictamen.
**Fecha**: 28-ago-2026 · **Medido sobre**: `fed1442`

## El síntoma y su tamaño real

Los bloques del informe se renderizan **sin fondo, sin borde y sin tipografía propia**: el
navegador aplica el default porque las clases no existen en ninguna hoja de estilo.
Se detectó en el drawer de plusvalía (clase `v-cierre`) y se confirmó en producción,
pero **`v-cierre` es una de 96**.

`vocabulario.tsx` y `HallazgosAcordeon.tsx` aplican **96 clases CSS**. De esas:

| Estado | N | Qué significa |
|---|---|---|
| Definidas en un `.css` del repo | **5** | `k` `num` `total` `v` `val` — nombres genéricos que colisionan con reglas de otro contexto; **no** son las del vocabulario, aplican por accidente |
| Definidas solo en `mockup-v12-interior-CONGELADO.html` | **32** | Portables tal cual |
| Definidas en otro mockup | **22** | Repartidas en 6 archivos distintos |
| **Sin diseño de referencia en ningún mockup** | **37** | Hay que diseñarlas |

## Superficies afectadas

Los tres consumidores del vocabulario, con el número de usos de sus componentes
(`VProsa`, `VViz`, `VCierre`, `VFuente`, `Thermo`, `Fall`, `Bars`, `Tabla`,
`Palancas`, `Dial`, `Composicion`, `Cien`, `CmpPares`, `Escenarios`, `Escalera`,
`ParBarras`, `Spark`):

| Componente | Usos |
|---|---|
| `src/components/analysis/drawers/DrawersPropios.tsx` | **118** |
| `src/components/ui/AnalysisDrawer.tsx` | **59** |
| `src/components/analysis/str/DrawerContentSTR.tsx` | **36** |

Es decir: **todos los drawers del informe, LTR y STR**. No es un caso aislado del
drawer de plusvalía.

## El CSS nunca se escribió — no está en ninguna rama

Verificado con `git log --all -S ".v-cierre" -- "*.css"` → **cero commits**.
`v-cierre` aparece en exactamente dos: `d9c4dd7` (el componente, FASE 4) y
`faaac56` (el mockup congelado). `src/app/globals.css` no fue tocado por el
rediseño.

**Implicancia**: no hay merge que coordinar ni rama que esperar. El trabajo es
escribir el CSS. Se verificó explícitamente para descartar duplicar algo que ya
existiera en una rama en vuelo.

## Inventario por grupo

### Grupo A — 32 clases con CSS completo en `mockup-v12-interior-CONGELADO.html`

```
bar-fill bar-row bar-track bars bk bv chapters-eyebrow chev fall-row fall-visual
fk fv h hall-body hall-head q spark t tbl tbl-scrollcue tblwrap thermo
thermo-legend thermo-mark thermo-ref thermo-track v-cierre v-collapse v-fuente
v-prosa v-viz v-viz-t
```

Cubren el bloque de cierre, la prosa, la línea de fuente, el contenedor de
diagrama, el termómetro, la cascada, las barras, la tabla y el acordeón. Es el
grupo que resuelve el síntoma visible hoy. Ejemplo textual del mockup:

```css
.v-cierre{background:var(--paper2);border:1px solid var(--line);
          border-left:3px solid var(--signal);border-radius:3px;
          padding:16px 18px;margin-top:4px}
.v-prosa{font-size:14px;line-height:1.75;color:var(--tx2);
         margin-bottom:16px;max-width:60ch}
.v-fuente{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;
          color:var(--tx4);margin-top:12px}
```

### Grupo B — 22 clases repartidas en 6 mockups

| Clases | Mockup |
|---|---|
| `cmp-k` `cmp-lbl` `cmp-line` `cmp-row` `cmp-top` `cmp-track` `cmp-v` `par` | `docs/wireframes/rediseno-informe/propuesta-12-17-precio-reestructuracion.html` |
| `esc-foot` `esc-k` `esc-track` `esc-v` | `docs/wireframes/rediseno-informe/propuesta-15-pie-v3.html` |
| `d` `dial` `dial-track` | `docs/wireframes/rediseno-informe/propuesta-03-sensibilidad-LTR.html` |
| `pal` `pal-detail` `pal-name` | `docs/wireframes/rediseno-informe/propuesta-01-v2-distanciaVeredicto.html` |
| `cien` `cien-track` | `docs/wireframes/rediseno-informe/propuesta-07-estructuraCostos-STR.html` |
| `cmp` | `assets-export/mockup-hero-compacto-v2.html` |
| `hall-foot` | `assets-export/mockup-distancia-veredicto.html` |

Ojo con `cmp`: su definición está en un mockup de hero, distinto del que trae el
resto de la familia `cmp-*`. Conviene confirmar que es el mismo componente y no
una colisión de nombre.

### Grupo C — 37 clases sin diseño de referencia

```
cien-banda cien-corte cien-corte-lbl cien-desborde cmp-pie compo-bracket
compo-brackets compo-k compo-leg compo-leg-row compo-total compo-track compo-v
compo-wrap dial-edges dial-mark dial-marklbl esc esca esca-foot esca-head
esca-pie esca-v hall-list pal-arrow pal-glosa pal-pie pal-why par-bar par-cap
par-cons par-k par-row par-top par-track par-v tbl-crucelbl
```

No aparecen en ningún mockup del repo. Son en su mayoría los sub-elementos de los
diagramas de FASE 4.1/4.2 (`compo-*` de patrimonio, `par-*` de reestructuración,
`esca-*` de la escalera del pie, `cien-*` de estructura de costos). Para estas
hay que **diseñar**, no portar — o encontrar el mockup fuente si existe fuera del
repo.

## Decisiones abiertas (bloquean la implementación)

### 1. Mapeo de tokens mockup → design system

Los mockups usan su propio set y el producto usa `--franco-*`. El mapeo no es
mecánico: hay que decidirlo contra la paleta Galería. Tokens del mockup, con sus
dos valores (light / dark):

| Token mockup | Light | Dark | Candidato en Franco |
|---|---|---|---|
| `--paper` | `#FAF8F3` | `#141414` | `--franco-bg` |
| `--paper2` | `#F1EEE7` | `#1B1B1B` | `--franco-card` o `--franco-sunken` — **a decidir** |
| `--line` | `#DAD6CC` | `#282828` | `--franco-border` |
| `--line2` | `#C4BFB2` | `#3A3A3A` | `--franco-border-strong` |
| `--signal` | `#C8323C` | `#C8323C` | Signal Red, invariante ✓ |
| `--tx` `--tx2` `--tx3` `--tx4` | escala | escala | `--franco-text` / `-secondary` / `-tertiary` / `-muted` — **verificar que la escala de 4 calce con la de Franco** |
| `--hl` `--hl-tx` | `rgba(224,67,80,.26)` | `rgba(216,67,77,.38)` | **sin token equivalente** — es el resaltado tipo plumón |
| `--good` | `#2F7D55` | `#57B98A` | ⚠️ **verde: el design system lo prohíbe** |
| `--warn` | `#A96F1B` | `#DFA34F` | ⚠️ **ámbar: prohibido** salvo la excepción documentada del gauge de score |

Los dos últimos son los que exigen decisión de producto, no de implementación:
el vocabulario del mockup asume una paleta con verde/ámbar y un color de
resaltado que la doctrina cromática de Franco no contempla.

### 2. `.esca` no tiene diseño en ninguna parte

La familia `esca-*` (escalera del pie, FASE 4.2) se usa en el código pero no
existe en ningún mockup del repo. O aparece en un archivo fuera del repo, o hay
que diseñarla.

## Por qué este diagnóstico no vino con su fix

Se evaluó tomarlo y se descartó por tres razones, en orden de peso:

1. **Riesgo de colisión**: el rediseño Dictamen está activo con gente pusheando.
   Escribir 96 reglas en paralelo produce un conflicto mucho peor que el problema.
2. **El mapeo de tokens es una decisión de diseño**, y equivocarse contamina las
   96 reglas de una vez.
3. **37 clases requieren diseñar**, no portar — eso pertenece a quien tiene el
   criterio del rediseño.

## Cómo reproducir el síntoma

```
/dev/drawers-pixel?row=santiagoLtr&key=plusvalia
```

El contenedor de "DE DÓNDE SALE" tiene `class="v-cierre"` y `computed style`
`background: rgba(0,0,0,0)`, `border-left-width: 0px`, `padding: 0px`. No es
artefacto de worktree ni de Tailwind: la regla no existe.
