# Deptos nuevos en el motor · medición 1 (noviembre 2026)

Goal de solo lectura, pegado por Fabrizio el 05-nov-2026. Nada de este documento toca el motor, los builders, los
prompts, el informe ni la base: todo recálculo corre en memoria con los scripts de `scripts/analisis/motor-nuevos/`,
que llaman al motor real (`runAnalysis`) con los insumos guardados en `avisos_evaluados`.

> **Estado: FASE 0 terminada, esperando el OK para la FASE 1.** El resumen de 10 líneas y las fases 1 a 4 se escriben
> al cierre.

---

## FASE 0 · Inventario e instrumento

### 0.1 Dónde se trabajó

| Qué | Valor |
| --- | --- |
| pwd | `C:\Users\fabri\invertiscore\.claude\worktrees\nuevos-deptos-medicion-6ec06b` |
| Rama | `claude/nuevos-deptos-medicion-6ec06b` (desde `origin/master`) |
| SHA base | `e0d230ac` |
| Versión del motor de la última pasada (`motor_version`) | `v3.r3+s4` en 24.329 de 24.360 filas activas (las otras 31: `v3.r3+s2` 25, `v3.r2+s2` 5, `v3+s2` 1) |
| Última evaluación | 05-nov-2026 08:20 UTC (1.461 filas en las últimas 24 horas) |
| Config de hoy | UF 41.274 · tasa 4,07 % · «convienen» del mapa guardado: 6.644 |

### 0.2 Mapa del motor para nuevos

- **Nuevo o usado.** Lo decide `scraped_properties.condicion` (proxy de la URL de la fuente: `/compranuevo/` → `nuevo`);
  `src/lib/avisos/depurar.ts › avisosEvaluables` lo pasa tal cual al aviso (`condicion: a.condicion === "nuevo" ? "nuevo" : "usado"`).
- **Antigüedad.** `src/lib/avisos/evaluar-aviso.ts`: nuevo → 0 años (`antiguedad_origen = "nuevo"`); usado → la banda
  «20+» = 25 años (`ANTIGUEDAD_SUPUESTA`, `ANIOS_ANTIGUEDAD_SUPUESTA`) salvo que llegue `antiguedadAnios`, que **la pasada
  nocturna nunca manda**: `depurar.ts` arma cada aviso con `antiguedadAnios: null`. Confirmado en la base: los 22.288
  usados activos tienen `antiguedad_origen = "supuesta"`, 0 «ficha». El año real solo lo usa el informe cuando lee la
  ficha («Analizar este»: `guia/guia-servidor.ts › avisoDeCandidato` con `antiguedadDelAviso`), y entra sin pasar por la
  banda (`helpers-wizard.ts › aniosDelUsado`, 03-nov-2026).
- **Columnas de pie 20 %, 30 años.** `veredicto_20`, `score_20`, `flujo_20` (`PLAZO_ESTANDAR = 30` en `evaluar-aviso.ts`);
  las `*_20_25` / `*_30_25` son el mismo aviso a 25 años (`avisos/estandar-deptos.ts`). Explorar las usa así:
  `explorar_mapa(comunas, desde, pie, plazo)` en la base elige `ae.veredicto_20` cuando `plazo = 30` y `pie = 20`
  (`supabase/migrations/20261102_planes_a_medida.sql`), con `desde` = hoy − 7 días sobre `sp.scraped_at`, sin
  despublicados, con arriendo y sin `arriendo_sospechoso`; `lib/explorar/guardados-servidor.ts` lee `veredicto_20` cuando
  `PLAZO_POR_DEFECTO === 30`. **Confirmado: «convienen» = `veredicto_20 = 'COMPRAR'`.**
- **`mediana_comuna.capRefComuna`.** La celda es comuna × condición (nuevo | usado) × dormitorios × superficie ±20 %
  (`src/lib/capref-comuna.ts › construirCeldaCapRef`), cascada celda 90 d → celda 180 d → comuna 90 d → comuna 180 d con
  n ≥ 15 por lado → BDO (neto multifamily 4T-2025 por comuna, `src/lib/data/bdo-caprate-comuna.ts`, `bdoNeto`) → nacional.
  Obra nueva: venta nueva y **arriendo usado como proxy**. La resuelve `prefetchMedianaComunaVenta` junto con la mediana
  (`src/lib/api-helpers/analisis-pipeline.ts`) y la pasada la guarda en `mediana_comuna`. **No entra al puntaje ni al
  veredicto**: solo al hallazgo `cap_rate` (dirección, brecha, frase, decisividad; `capref-comuna.ts` líneas 11-12 y
  `analysis.ts:525`). Lo que sí entra al veredicto es la **mediana comunal** del mismo paquete: el brazo
  `sobreprecioComunalConFlujo` del GATE 1 (desviación > 10 % sobre la mediana del mismo universo con flujo negativo,
  `analysis.ts › evalGate1Brazos`).
  **Por qué el 71 % de los nuevos cae a «bdo»:** en 1.439 de las 1.459 filas la celda viene con `superficieM2: 0`,
  `nVenta: 0` y `nArriendo: 0`, y la mediana con `n: 0`. No es que la comuna no tenga avisos (La Florida: 858 nuevos y
  718 arriendos activos; 257 filas en bdo con ambos lados en 0): es que **la celda se construyó con superficie 0** (ver
  el hallazgo central más abajo). Lo mismo les pasa a 217 usados en bdo y a 76 de los 123 nuevos en «nacional».
- **Premio de arriendo del nuevo.** Es **3 %**, no 5 %: `src/lib/obra-nueva.ts › PREMIO_ARRIENDO_NUEVO = 0.03`
  («medido +3 %, IC +1 % a +5 %; el tope que fijó Fabrizio es 5 %»). Se aplica en `evaluar-aviso.ts › arriendoParaEvaluar`
  al arriendo SUGERIDO, solo con `condicion === "nuevo"`; a un usado de pocos años no (la pasada no sabe su edad).
  Comprobado en la base: `arriendo.monto = radioMonto × 1,03` (395.000 → 406.850).
- **Gastos comunes = 0.** La sugerencia de la zona viene siempre vacía (`market-suggestions.ts`: `ggcc: null` en todas
  las ramas), así que `wizardV4Payload.ts › ggccCLP` cae a `getGgccFallback(comuna, m²)`: 2.200 $/m² en Providencia, Las
  Condes, Vitacura y Lo Barnechea; 1.800 en Santiago, Ñuñoa y La Reina; 1.400 en el resto. El motor **no toma el 0 como
  0**: `analysis.ts:431` hace `input.gastos || superficie × 1.200`. Pero con superficie 0 las dos cuentas dan 0, y eso es
  lo que tienen los 1.515 nuevos y 217 usados con `gastos_comunes = 0`. En el flujo los gastos comunes solo pesan en la
  vacancia (`ggccVacancia = ggcc × mesesVacancia / 12`): el arrendatario los paga.
- **Plusvalía y TIR.** La proyección usa una tasa única, 3 % real anual (`src/lib/plusvalia-proyeccion.ts ›
  PLUSVALIA_PROYECCION_ANUAL`; `analysis.ts:961` `valorPropiedad = precioCLP × 1,03^año`, en pesos de hoy), sin distinción
  por comuna ni por nuevo/usado. La histórica por comuna (`src/lib/plusvalia-estimado.gen.ts`, GfK 2015-2025 o
  Arenas & Cayo 2014-2024) entra solo a la dimensión «plusvalía» del puntaje y a su hallazgo. **No hay TIR por aviso en la
  pasada nocturna**: `avisos_evaluados` no la guarda (`venta` trae precio/m², fuente, n, universo, radio); la TIR solo
  vive en `analisis.results`. Las tablas sí tienen filas: `plusvalia_estimado` 25 (cierre 2025 por comuna, UF/m²,
  GfK + INCOIN), `plusvalia_fuentes_raw` 464 (GfK 207, INCOIN 180, Arenas & Cayo 54, Colliers 22, CChC 1),
  `plusvalia_indices_raw` 680 (CLAPES RealData, 5 ámbitos, 2007-2023). De ahí sale el `.gen.ts`
  (`scripts/data/generar-plusvalia-estimado.ts`), que es lo que lee el motor.
- **Veredicto** (`analysis.ts › evalVeredicto`): bandas del puntaje (Comprar ≥ 70, Ajustar ≥ 45), GATE 1 fuerza
  Buscar otra (CoC < −30 %, break-even imposible, sobreprecio comunal con flujo negativo, flujo negativo > 50 % de la
  cuota), GATE 2 baja Comprar a Ajustar (CoC < −10 %, o flujo < −5 % del ingreso con CoC negativo), GATE 3 sube a Comprar
  (flujo ≥ 0, neta ≥ 4 %, plusvalía inmediata ≥ 0).

#### El hallazgo central de la FASE 0: 1.515 nuevos (73 %) y 217 usados se evaluaron con superficie 0

`evaluar-aviso.ts › respuestasDeAviso` escribe el m² como texto con dos decimales (`coma(a.m2)` → «51,46») y el campo de
superficie del wizard admite **un** decimal (`wizardV4Nodes.ts › DEC.superficie = 1`): `parseNumeroCL` devuelve null
(regla 4, «perder información») y `leerNum` lo convierte en **0**. Lo confirma la base: las filas con celda de 0 m² son
exactamente las que tienen `superficie_m2` con dos decimales, y ninguna con un decimal o entera.

| | nuevos | usados |
| --- | --- | --- |
| Activos con evaluación | 2.072 | 22.288 |
| Con m² de dos decimales → **superficie 0 en el motor** | 1.515 (73,1 %) | 217 (1,0 %) |
| De esas, gastos comunes 0 | 1.515 | 217 |
| De esas, mediana comunal n = 0 | 1.515 | 217 |
| De esas, cap de referencia «bdo» o «nacional» con celda de 0 m² | 1.439 + 76 | 217 |

Con superficie 0 el motor pierde: los gastos comunes, la mediana comunal (y con ella el brazo de sobreprecio del GATE 1),
el cap de referencia de avisos, lo que se calcula por m² (mantención, CapEx, el tramo DFL2 de las contribuciones) y el
precio por m² del propio depto. **Por eso los «gastos comunes en 0» y el «71 % en bdo» del enunciado son un solo error,
no dos**, y hoy no se puede medir el premio ni el cap de referencia de esos nuevos sin corregirlo primero. De los 40
nuevos Comprar de hoy, **32 son filas con superficie 0**.

Medido sobre la muestra del instrumento (113 nuevos y 3 usados con superficie 0, pie 20 %, 30 años, motor real;
`0b-superficie.ts`): (a) como está guardada; (b) con el m² redondeado a un decimal y la mediana guardada (vacía), gastos
comunes por el estimador de comuna; (c) además con la mediana comunal y el cap de referencia resueltos en vivo con la
misma función de la pasada (`prefetchMedianaComunaVenta`, datos de hoy).

| nuevos (n = 113) | Comprar | Ajustar | Buscar otra | flujo mediano | gastos comunes medianos | con mediana comunal | cap en celda/comuna |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a) como está guardada (m² = 0) | 3 | 58 | 52 | −$206.329 | $0 | 0 | 0 |
| b) m² correcto, mediana vacía | 2 | 57 | 54 | −$208.798 | $78.000 | 0 | 0 |
| c) m² correcto, mediana y cap en vivo | 2 | 56 | 55 | −$208.798 | $78.000 | 105 | 103 |

De (a) a (c): 5 pasan de Ajustar a Buscar otra, 2 de Buscar otra a Ajustar, 1 de Comprar a Ajustar; Δ puntaje mediano
−3 (de −9 a +1). **Corregir la superficie deja a los nuevos un poco peor, no mejor**: el error inflaba sus números. Los 3
usados: Δ puntaje −10 a −6, uno baja de Ajustar a Buscar otra.

#### Segundo hallazgo: las unidades de obra nueva no refrescan `scraped_at`, así que Explorar casi no las ve

| | nuevos | usados |
| --- | --- | --- |
| `scraped_at` en los últimos 7 días (la ventana de Explorar, /deptos, el semanal y el cron) | **11** | 22.288 |
| `scraped_at` en los últimos 30 días | 11 | 22.288 |
| `scraped_at` en los últimos 90 días | 2.072 | 22.288 |
| `precio_estimado_at` en los últimos 7 días | 1.610 | 0 |
| Evaluados en los últimos 30 días | 287 | 15.455 |
| Unidades (`source_id` con `#`) | 2.061 | 0 |

La pasada diaria de unidades (`/api/data/scrape-unidades-nuevas`) marca la unidad vista en `seen_pass_id` y escribe
`precio_estimado_uf/_at`, pero no toca `scraped_at`, que quedó en la pasada del 29-sep al 05-oct. Como todas las lecturas
filtran `sp.scraped_at >= hoy − 7 días`, **el mapa de «convienen» (6.644) tiene 1 nuevo adentro de 2.072** y el cron no
vuelve a evaluar las unidades (la ventana de `avisosEvaluables` es la misma). La mediana comunal de obra nueva sí las ve
(filtra `scraped_at` o `precio_estimado_at`); el cap de referencia no (solo `scraped_at`, 90 y 180 días).

### 0.3 Línea base reproducida desde la base (05-nov-2026)

Universo: avisos activos en venta (`scraped_properties.is_active`, `type = 'venta'`) con su última evaluación en
`avisos_evaluados`. Pie 20 %, 30 años, precio publicado, la tasa de cada pasada. «Todos» incluye sospechosos y degradados;
«limpio» los excluye (regla 5) y los cuenta aparte.

| | usados · todos | usados · limpio | nuevos · todos | nuevos · limpio |
| --- | --- | --- | --- | --- |
| Avisos | 22.288 | 21.191 | 2.072 | 2.016 |
| Con `arriendo_sospechoso` o `radio_degradado` (fuera de «limpio») | 853 | — | 55 | — |
| Entrega inmediata / futura / sin dato | — | — | 1.538 / 399 / 135 | — |
| Comprar | 7.101 (31,9 %) | 6.702 (31,6 %) | 40 (1,9 %) | **36 (1,8 %)** |
| Comprar: inmediata / futura / sin dato | — | — | 28 / 5 / 7 | 28 / 3 / 5 |
| Ajusta supuestos | 5.839 | — | 1.013 | — |
| Buscar otra | 9.103 | — | 1.018 | — |
| Sin veredicto (sin arriendo) | 245 | 0 | 1 | 0 |
| Precio mediano, UF/m² | 63,3 | 63,3 | 85,6 | 85,8 |
| Arriendo mediano, $/m² | 9.902 | 9.882 | 10.420 | 10.417 |
| Cap rate bruto mediano | 4,74 % | 4,73 % | 3,64 % | 3,64 % |
| Puntaje mediano | 61 | 61 | 53 | 53 |
| Flujo mensual mediano | −$66.763 | −$67.137 | −$235.682 | −$234.247 |
| m² mediano · precio mediano UF | — | 53,0 · 3.060 | — | 51,9 · 4.125 |
| Gastos comunes = 0 | 217 (1,0 %) | — | 1.515 (73,1 %) | — |
| Cap de referencia: bdo / celda / comuna / nacional / sin mediana | 1.385 (6,2 %) / 17.689 / 2.688 / 281 / 245 | — | 1.459 (70,4 %) / 433 / 56 / 123 / 1 | — |

La tabla del 5-nov del enunciado (21.403 usados, 2.025 nuevos, 36 Comprar: 28 inmediata, 3 futura) es la columna
«limpio» de la mañana del 5-nov; la pasada de las 08:20 UTC sumó 1.458 usados y las cifras de nuevos calzan exactas.

**Cobertura de año real en usados activos (22.288):** 0 con `antiguedad` en texto (la columna está vacía en toda la
tabla), 242 con año en `fichas_leidas` (de 1.192 fichas leídas, 272 con año), 273 con año por edificio en
`anios_edificio` (264 filas; 226 directos por aviso), **22.015 (98,8 %) sin año en ninguna parte**.

### 0.4 El instrumento, validado

`scripts/analisis/motor-nuevos/0-instrumento.ts` toma la fila guardada y la vuelve a pasar por la cadena de la pasada
—`contextoDeFila` (el contexto que la fila ya resolvió, el mismo de la guía y del semanal) → `respuestasDeAviso` →
`payloadDeAviso` → `runAnalysis`— sin pedir sugerencias en vivo. Para que calce **al peso** hubo que devolverle a cada
fila tres cosas que la tabla no guarda:

1. **La UF del día** (`uf-historica.ts`). `update-market` escribe `uf_value` a las 10:00 UTC con la UF de ese día,
   redondeada; el cron corre a las 04:20 y 08:20 UTC, o sea con la UF del día anterior; la carga por script del 02 al 06-oct
   corrió a otras horas. El 06-oct la escritura llegó tarde (las filas de 11:39 a 12:35 UTC calzan con la UF del 05-oct y
   una del 07-oct 04:25 UTC ya calza con la del 06-oct). La UF por día sale de la tabla pública del SII
   (`sii.cl/valores_y_fechas/uf/uf2026.htm`; mindicador.cl se cayó a mitad de la medición y, en los días que alcanzó a dar,
   coincide al centavo).
2. **La tasa del día**: 4,04 % hasta el 07-oct y 4,07 % desde el 08-oct (lo dice `analisis.input_data.tasaMercado` de
   los informes de cada día).
3. **«Hoy» congelado en `evaluado_at`**: las cuotas del pie por defecto de una entrega futura se cuentan desde hoy
   (`helpers-wizard.ts › mesesHastaEntrega`), y eso mueve la TIR un punto de puntaje.

Con la UF y la tasa de hoy (lo primero que se probó), el veredicto calzaba en 591 de 600 y el flujo en 0: la UF sube
todos los días y el flujo en pesos se corre con ella. Con lo de arriba:

| Muestra (semilla fija, 150 usados + 150 nuevos al azar, pie 20 % y 30 %) | comparaciones | veredicto | puntaje | flujo | las tres |
| --- | --- | --- | --- | --- | --- |
| Semilla 20261105 | 600 | 600 | 600 | 600 | **600** |
| Semilla 7 (contraprueba) | 600 | 600 | 600 | 600 | **600** |

El instrumento reproduce también el error de la superficie (116 de las 300 filas llegan al motor con m² = 0, como la
pasada), y por eso sirve para medir lo que la pasada hizo y lo que haría corregida.

### Preguntas abiertas al cierre de la FASE 0

1. **La FASE 1 necesita un escenario que el enunciado no tiene: «superficie corregida».** Sin él, «gastos comunes
   estimados» y «sin respaldo BDO» miden el mismo error dos veces. Propuesta: escenario 0-bis = m² legible + mediana
   comunal y cap de referencia resueltos en vivo con la función de la pasada (son ~2.000 nuevos y 217 usados; 6 a 8
   consultas livianas por aviso, de a una y con pausa). Las demás correcciones se miden sobre ese escenario. ¿OK?
2. **El cap de referencia no entra al veredicto.** «Sin respaldo BDO» (1.3) cambia el hallazgo y su frase, no el
   Comprar. Lo que sí mueve el veredicto es la mediana comunal (brazo de sobreprecio del GATE 1), que el mismo error
   dejó vacía. ¿Se mide 1.3 como «celda del cap» (lo que dice el informe) o como «mediana comunal» (lo que decide)?
3. **El premio hoy es 3 %, no 5 %** (el 5 % es el tope). 1.2 lo mide igual; solo cambia el punto de partida.
4. **Los nuevos están fuera de Explorar por `scraped_at`**, no por el motor: 11 de 2.072 dentro de la ventana de 7
   días, 1 Comprar en el mapa. Es un arreglo del scraper, no del motor; queda anotado y no se toca en este goal.
5. Los dos defectos van juntos en el arreglo de código (fuera de este goal): el m² a un decimal en `respuestasDeAviso`
   (o `DEC.superficie = 2`), y `scraped_at` en la pasada de unidades. Al corregirlos hay que reevaluar los 1.732 avisos
   (el cron los toma solos si cambia `VERSION_EVALUACION`, pero solo dentro de la ventana de 7 días).
