# Golden Set LTR — eval de regresión

Fase 2.0 obligatoria del sistema. 7 casos canónicos (GS-*) + 3 borde (BE-*)
seedados como filas inmutables `GOLDEN::` (UF congelada 38800). Tres capas:
recompute determinístico → generación fresca AUTO → checklist semántico (juez).

Diseño aprobado: `of-golden-design.md` (raíz, untracked).

## Piezas

| archivo | qué hace | tokens |
|---|---|---|
| `seeds.ts` | inputs congelados + mediana + ejes + UUID fijo. **Inmutable.** | — |
| `baseline.json` | esperados clase (a) congelados. Re-baseline solo con OK de Fabrizio. | — |
| `extract.ts` | gather+dedup+orden (espejo de PiramideHallazgos) + parsing de cifras | — |
| `invariants.ts` | clase (a) vs baseline + clase (b) estructural (B1-B6) | — |
| `seed-db.ts` | upsert idempotente de las 10 filas a Supabase (§1) | — |
| `recompute.ts` | tier QUICK: carga fila persistida, recompute UF-congelada, clase a+b+B8 | 0 |
| `dispersion-comunal-catch-test.ts` | p25/p75 salen de la misma muestra que la mediana, se persisten en el snapshot y el motor deriva la posición del sujeto (21-sep-2026). Tier puro en el QUICK; standalone agrega sonda viva. | 0 |
| `strref-zona-catch-test.ts` | la referencia STR contra STR de la zona (21-sep-2026): celda comuna × dormitorios, cascada celda → comuna → sin referencia declarada en el dato, 15 por lado, sin punto extra, base del estimador de AirROI (nunca los listings realizados) con el modelo de costos del motor, snapshot persistido, y BDO fuera de STR por símbolo. | 0 |
| `refinanciamiento-catch-test.ts` | el refinanciamiento del capítulo «Tu resultado» es el del motor (22-sep-2026): LTR y STR lo emiten al año de salida con `REFI_LTV`, la razón cuota nueva ÷ actual viaja en el dato, los dos capítulos leen `results.refinanceScenario` sin calcular el suyo, y avisan sobre `REFI_AVISO_CUOTA_RATIO`. | 0 |
| `sobreprecio-venta-catch-test.ts` | el sobreprecio de hoy se descuenta PLANO en la venta al año de salida (variante B, 22-sep-2026): solo con mediana confiable y sobre ella, comisión y equity sobre lo que el mercado paga, la TIR lo hereda, STR espejo exacto con la mediana entrando al motor por el pipeline, el recompute, la metadata y la simulación, un solo patrimonio en la curva STR (`parteAlVender` ≡ equity en el año de venta), y la línea visible con la muestra chica dicha en la fuente. | 0 |
| `resultado-capitulo-catch-test.ts` | «Tu resultado a 10 años» según el mockup aprobado (22-sep-2026): un solo patrimonio (`parteAlVender` del motor ≡ equity, en los dos gráficos), la venta con la fila del sobreprecio, la barra apilada en forma B, el aviso de 1,5×, sin verde ni ocre (pie en claro #71717A), sin las piezas retiradas, y el cierre de dos oraciones con la rama sin crédito. | 0 |
| `plusvalia-capitulo-catch-test.ts` | «Plusvalía» según el mockup aprobado (22-sep-2026): la serie GfK más el 2025 llega entera y unida en el hallazgo LTR y STR (`resolveSeriePlusvalia`), el 3% una sola vez en la prosa del capítulo, la tercera frase solo con sobreprecio, sin verde ni ocre (capítulo, `SeriePlusvalia`, bloque `.sp-*`), STR monta el capítulo (VI, «Tu resultado» pasa a VII) sin la compra en verde, extremos siempre rotulados y el resto al tocar, cierre de una oración, fuente en una línea. | 0 |
| `ocupacion-str-catch-test.ts` | «Ocupación en renta corta» (III STR) según el mockup aprobado (22-sep-2026): la curva del año dibuja y colorea el flujo mensual (no el ingreso bruto), la rama «cerca» corta en 5 puntos, sin comparables no compara, el título es el nuevo, sin verde ni ocre (Thermo, Spark y CurvaAnual retirados con su CSS), sin dial ni comuna en el III, el ramp-up una vez, `ocupacionRealizadaComparables` llega por el recompute, cierre de una oración en las cuatro ramas. | 0 |
| `retiro-ventaja-ltr-catch-test.ts` | La ventaja sobre el arriendo largo salió de STR el 22-sep-2026 (vestigio de AMBAS): score sin la dimensión y pesos 18,75/25/25/18,75/12,5, sin los gates `g1_flujoSevero` y `g2_ltrGana`, sin el hallazgo `ventaja_vs_ltr` ni su knob, sin el capítulo V «Corto o largo», prompt v22 sin `vsLTR` (la acción en `conviene.estrategiaSugerida`), sin el guard de modalidad, sin la sección del PDF ni «Analízalo como renta larga»; AMBAS sigue leyendo `comparativa.ltr`, la banda y `recomendacionModalidad`. | 0 |
| `hoja-modal-catch-test.ts` | El `Modal` con dos formas por ancho (23-sep-2026, mockup `hoja-mobile.html`): bajo 768 es hoja desde abajo (velo de 56, radio arriba, asa, cabecera fija, cuerpo como único scroll con `overscroll-behavior:contain` y 20 px laterales) y sobre 768 el panel de 720 como estaba; el corte del CSS es el mismo número que lee `matchMedia`; body bloqueado y scroll restaurado al cerrar; el estado de historial se empuja solo en la hoja y se consume al cerrar; el arrastre decide con la función pura (cabecera siempre, cuerpo solo en el tope, umbral); los cuatro consumidores siguen montando la misma interfaz. | 0 |
| `mudanza-capitulos-catch-test.ts` | La mudanza de los once capítulos (5 LTR + 6 STR) del acordeón al pop-up (23-sep-2026): el cuerpo inline queda solo para la variante «hallazgo», el capítulo abierto se monta dentro del `Modal` con título, sub y cuerpo, sin «↑ Cerrar» ni giro del disco; el hash (`#cap-…`) abre al montar; `medir` dispara en el clic, en la apertura externa y en el hash; `useAncho` mide al montar y corrige; las dos carpetas `documento/` no importan de la superficie mudada; «A qué precio cerrar» en las dos modalidades y `.ca-pt.pos` en tinta. | 0 |
| `mudanza-capitulos-sonda.ts` | SONDA VIVA, standalone contra un dev server (`--base`, `--fotos`): abre las once filas con tap (390, esperando el scroll) y click (1100) en los dos temas, y mide que el `width` de cada SVG con `useAncho` dentro del pop-up sea el ancho de su contenedor (no 600), que la hoja esté en y=56 con overscroll contenido, que `informe_capitulo_abierto` dispare y que `#<anchorId>` en la URL abra el pop-up. | 0 |
| `cuanto-renta-catch-test.ts` | «Cuánto renta» habla al usuario (21-sep-2026): fuente en una línea por peldaño (sin peldaños, celdas, n, BDO ni UF; «muestra acotada» con una palabra), explicación de una frase, umbral STR = rentabilidad bruta de la comuna + 1 punto (5 solo sin referencia) usado por hallazgo, neutralización, cierres y guard, y el render de las dos modalidades con «Rentabilidad» y sin «cap rate». | 0 |
| `capref-comuna-catch-test.ts` | el benchmark de cap rate por comuna (21-sep-2026): celda del motor (comuna normalizada × condición × dormitorios, ±20% m²), cascada declarada en el dato (celda → comuna → BDO → nacional), n ≥ 15 por lado, bruto sin factor alguno, tabla BDO de 22 comunas confirmada a ojo, cableado hasta el hallazgo y la neutralización de la decisividad, y un solo mapa de alias de comunas. | 0 |
| `caprate-redondeo-catch-test.ts` | el cap rate se redondea UNA vez (`capRateDisplayPct`): el hero y el capítulo I muestran el mismo string; 55 filas decían «3,5%» y «3,4%» en la misma página (21-sep-2026). | 0 |
| `flujo-ltr-catch-test.ts` | el capítulo II de LTR como capítulo (21-sep-2026): rótulo «mes promedio del año 1», serie ÷ meses operativos a diez años (fixtures con año parcial y pre-entrega), pie del gráfico por datos, mes vacío como cierre con la fórmula a la vista, y que `DrawerCostoMensual` no vuelva. | 0 |
| `mantencion-una-sola-catch-test.ts` | la provisión de mantención es UNA función (`provisionMantencionAnio`): el mes de la tabla y el año 1 del loop coinciden, la declarada se respeta en los dos, legacy sin «+1», v3 con reset por CapEx también en metrics (21-sep-2026). Fixtures sintéticos sobre `runAnalysis`. | 0 |
| `como-lo-pagas-catch-test.ts` | «Cómo lo pagas» se ancla al precio recomendado leído de `mixAComprar` —sin caer al escalón—, los seis casos, la copia fijada, la frase del hallazgo por cuartil y el cableado en los dos capítulos (21-sep-2026). Tier puro en el QUICK; standalone agrega una fila STR real. | 0 |
| `generate.ts` | tier FULL AUTO: `generateAiAnalysis(persist:false)` ×K, checks AUTO | sí |
| `semantic.ts` | tier FULL semántico: juez Opus (reusa `../judge.ts`) | sí |
| `catch-test.ts` | meta-validación: rompe invariantes y verifica que el runner CAZA | 0 |
| `timeout.ts` | techo de 5 min por llamada al generador / juez en FULL: el seed cae como FALLA-TIMEOUT y la tanda sigue (una tanda quedó colgada 8 h el 06-sep) | — |
| `runner.ts` | CLI orquestador | — |
| `accept.ts` | re-baseline (regenera baseline.json) | 0 |
| `str-v16-dump/` | corpus: las 12 salidas STR de la tanda FULL parcial del prompt v16 (6 seeds × 2), prosa persistida. Alimenta catch-tests de 0 tokens; no son cifras congeladas. | — |
| ~~`guards-v16-dump-catch-test.ts`~~ | **RETIRADO 17-sep-2026** — ver el acta bajo la tabla | — |

### `guards-v16-dump-catch-test.ts` — retirado con acta (17-sep-2026)

Medía [STR-ENGINEISM] y [HERO-CLAIM] sobre el corpus congelado de la tanda v16. Quedó rojo
por **dos decisiones deliberadas distintas**, ninguna suya:

- la seed **GE-3 se retiró** de `STR_GE_SEEDS`, así que sus dos casos («GE-3: sin recompute»)
  piden una fila que el corpus ya no tiene;
- el **umbral de hero-claim cambió**, y el corpus v16 —congelado— trae 11 oraciones de la
  familia donde el test exige ≥ 20.

O sea que el test no vigilaba los guards: vigilaba una foto de los guards contra una foto
del corpus, y las dos se movieron por separado. Los dos guards siguen vivos y medidos sobre
prosa fresca en el tier STR de la FULL, que es donde corresponde.

Estuvo en rojo semanas sin que nadie lo supiera: no estaba cableado al runner. Es el mismo
caso que `zona-catch-test.ts` — ver la regla en `CLAUDE.md` § Testing.

## Uso

```bash
# QUICK (default) — recompute determinístico, 0 tokens, segundos
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --quick

# FULL — QUICK + generación fresca AUTO + semántico (cuesta tokens)
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --full --k=2

# FULL sin el juez Opus (solo AUTO, más barato)
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --full --no-semantic

# Meta-test: ¿el runner caza bugs?
node --env-file=.env.local --import tsx scripts/eval/golden/runner.ts --catch-test

# (Bootstrap / mantenimiento)
node --env-file=.env.local --import tsx scripts/eval/golden/seed-db.ts   # persiste filas
node --env-file=.env.local --import tsx scripts/eval/golden/accept.ts    # re-baseline (con OK de Fabrizio)
```

Exit 0 solo si no hay fallas duras. Drift de cifra clase (a) → warning (candidato
a re-baseline, no bloquea). Flags semánticos → reporte, no bloquean.

### AUTO (generación fresca): duro vs soft

- **Duros (bloquean)** — contratos ESTRUCTURALES que deben cumplirse en cada
  generación: `A1` apertura == fraseCanonica del #1 por decisividad (≠ corona de
  pirámide, que es adverso-first); `A2` fabricación de zona sobrevivió reintentos
  (`_catchRootAFlag`, solo GS-5); `A5` §9 presente en cajaAccionable; `A6`
  presupuesto Plan C (≤85 palabras); `A7·D2` no niega VM cuando VM es sólido;
  `A8·D1` largoPlazo compara con instrumentos.
- **Soft (reportan TASA, no bloquean)** — detectores de FRASEO estocásticos, igual
  que el producto los trata (detección no-bloqueante): `~engine-ism` (~1/6 runs),
  `~zona-drift` (el detector propio se confunde con el arriendo-en-UF),
  `~planc-stripped` (los strippers auto-corrigen). Una REGRESIÓN de código dispara
  la tasa (ej. 5/6) y se ve; una ocurrencia aislada no vuelve rojo el gate.

## Política (cuándo corre)

- **QUICK obligatorio** en todo goal que toque motor / builders / render de hallazgos.
- **FULL obligatorio** si el diff toca generación / prompts / builders-que-alimentan-generación.
  Opcional a pedido en el resto.
- Cuando un cambio **legítimo** del motor mueve un esperado clase (a): el runner
  imprime el drift `viejo→nuevo`; **Fabrizio aprueba**; `accept.ts` re-baselinea en
  un commit dedicado. Falla clase (b) → siempre regresión hasta prueba en contra.

## Invariantes clase (b) — nunca deben romperse

- **B1** cifra del body (fraseCanonica) refleja el `valor` del motor dentro de la precisión de display. Para `sobreprecio` el parser lee las dos redacciones (la desviación «N% sobre/bajo» y, desde el 21-sep-2026, la frase por cuartil, de la que deriva la desviación con sujeto y mediana), y **B1.legible** falla si el motor tiene cifra y el body no se deja leer: sin eso el hallazgo se saltaba en silencio. GS-1 (bajo_p25) y GS-3 (sobre_p75) llevan cuartiles en `seeds.ts` para que la frase nueva se pruebe contra prosa real.
- **B2** dirección del hallazgo coherente con su valor y su corte.
- **B4** dedup por id (titular gana) + corona == #1 adverso por decisividad.
- **B5** N de la pirámide ∈ [5,9].
- **B6** omisiones donde corresponde (sensibilidad si BUSCAR; patrimonio si totalAportado≤0; sobreprecio si mediana confiable).
- **B8** veredicto persistido == recompute.

## Meta-validación: qué cubre y qué no

`catch-test.ts` muta invariantes y exige que el checker falle. **Cubre `checkClassA` y
`checkClassB` (`invariants.ts`) y nada más**: las otras 44 tiers del runner no tienen
meta-validación de ninguna clase. Hasta el 17-sep-2026 su cabecera decía lo contrario.

Por qué importa: en el arco del pop-up (13-17 sep) **cuatro catch-tests estuvieron verdes
sobre código roto**, y una auditoría adversaria confirmó **102 predicados más que no miden
lo que dicen — 94 en tiers que sí corren acá**. La regla y los seis modos de falla están en
`CLAUDE.md` § Testing.

### El tamaño del problema

| | |
|---|---|
| tiers cableados | 36 archivos · 44 tiers |
| bloques de invariante | **234** |
| llamadas de aserción | 1.183 |
| tiers que ninguna costura puede alcanzar | **0** |
| tiers que entran en una costura compartida | **35 de 36** |

Por tipo: 12 leen fuente con regex (**texto**), 11 llaman funciones del motor con fixtures
(**dato**), 13 hacen las dos cosas (**mixto**). Por esfuerzo: 6 triviales, 16 bajos, 11
medios, 3 altos — y de los tres altos, dos son volumen y no dificultad.

### Las dos costuras

1. **TEXTO** — `leer(ruta)` con un mapa de overrides. Hoy cada tier define su propia copia
   (21 comparten la función byte por byte) y llama a `readFileSync` directo. La mutación es
   inyectar un texto fuente modificado y exigir rojo. Probada sobre `popup-ajustes` mutando
   `esActual` en `PopupAjustes.tsx`: 0 fallas → 3.
2. **DATO/MOTOR** — reemplazo del módulo en `require.cache` antes de requerir el tier.
   Probada de punta a punta sobre `titular-final`.

⛔ **Dos trampas del arnés, las dos medidas.** Asignarle a un export para mutarlo
**se ignora en silencio**: tsx/esbuild los emite como getters sin setter, así que un
meta-runner escrito así da verde sin haber mutado nada — el punto ciego exacto que esto
viene a cerrar. Y varios tiers corren todo en top-level, así que no se los puede re-ejecutar
con otra entrada sin sacarlos de ahí primero.

### Etapas

- **Etapa 0 — que la frase no mienta.** Declarar el alcance real en `catch-test.ts`. Hecho.
- **Etapa 1 — la costura compartida + sanity.** Las dos costuras y una pasada que corre cada
  tier SIN mutar exigiendo `hard === 0`. Cubre las 44 de una sola vez y ordena el resto.
  Incluye sacar de top-level los tiers que no se pueden re-ejecutar.
- **Etapa 2 — el catálogo, tier por tier.** Una mutación declarada por bloque de invariante.
  Es el volumen: 234 mutaciones, y **no se derivan solas** — cada bloque pincha otra cosa.
  No hay bloqueo entre tiers, así que entra por lotes y se prioriza por lo que vigila.
- **Etapa 3 — identidad del caso.** Hoy un tier devuelve `{hard: number}` y el nombre del
  invariante roto solo existe en stdout. Una meta-validación honesta afirma «esta mutación
  mata ESTE invariante», y con un contador no se puede.

## Alcance

Nace LTR. STR se suma en su migración. La paridad exacta del KPI del render con el
body (findingDisplay) es tier **pixel** (futuro), fuera del recompute.
