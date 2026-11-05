# Deptos nuevos en el motor · medición 1 (noviembre 2026)

Goal de solo lectura, pegado por Fabrizio el 05-nov-2026. Nada de este documento toca el motor, los builders, los
prompts, el informe ni la base: todo recálculo corre en memoria con los scripts de `scripts/analisis/motor-nuevos/`,
que llaman al motor real (`runAnalysis`) con los insumos guardados en `avisos_evaluados`.

> **Estado: FASES 0 y 1 con OK (05-nov); FASE 2 terminada, esperando el OK.** El resumen de 10 líneas y las fases 3 y 4 se
> escriben al cierre.

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

---

## FASE 1 · Correcciones de datos, sobre la línea base corregida

Decisiones de Fabrizio al cerrar la FASE 0 (05-nov-2026): el escenario «superficie corregida» es la nueva línea base y las
tres correcciones se miden sobre ella; 1.3 se mide como mediana comunal del universo nuevo (lo que decide, GATE 1), y el cap
de referencia se cuenta solo para el hallazgo; los dos defectos de código quedan para un goal propio después de esta fase.

### Respuestas previas (puntos 4 y 5 de las decisiones)

**El lector de UF.** Esta rama no toca código compartido: el lector del SII vive solo en
`scripts/analisis/motor-nuevos/uf-historica.ts` (con caché local en `out/`), y ningún commit de la rama entra en `src/`.
Tres líneas sobre producción:
1. La pasada nocturna **no depende de mindicador**: lee `config.uf_value` y `config.tasa_hipotecaria`, que escribe
   `update-market` a las 10:00 UTC desde el Banco Central (`src/lib/bcch.ts`, series F073.UFF.PRE.Z.D y F022.VIV.TIP.MA03.UF.Z.M).
   El informe sí: `getUFValue` (`src/lib/uf.ts`) pide la UF a mindicador con 3 s de tope, cae a la última buena en memoria y
   después a `config.uf_value`; lo usan la creación, el recálculo, la guía y los documentos.
2. La pasada de anoche (05-nov, 04:20 y 08:20 UTC) corrió con **UF 41.269** (la del 04-nov redondeada, escrita a las 10:00 UTC
   del 04-nov) y **tasa 4,07 %**: lo prueban las 14 filas de ese día de la muestra, que calzan al peso solo con esa UF.
3. Respaldo: `update-market` pide la UF de hoy y, si no hay, la de ayer; si el BCCh falla en las dos, `config` conserva el valor
   anterior (no hay otra caché). El informe tiene además la caché de 24 h en memoria y el número fijo `UF_FALLBACK` como último
   recurso.

**Para el goal de los dos defectos.**
- Qué cambió el 02-oct: la fuente retiró el GraphQL de unidades (desde el proxy, 403 en los 137 proyectos) y el pase de
  unidades quedó **congelado** (`a6d5a937`); lo reemplazó el cruce con la ficha nueva (`2ae0c586`, `81757414`), que solo
  marca `seen_pass_id`, `is_active`, `fecha_entrega` y el precio estimado, nunca `scraped_at` ni filas nuevas. Las unidades
  quedaron con la fecha de la última escritura (29-sep al 01-oct).
- Sí se siguen verificando: 1.610 de las 2.072 unidades activas fueron vistas por el cruce del 04 o del 05-nov
  (`seen_pass_id = unidades@…`); 59 se vieron por última vez entre el 04 y el 27-oct (su proyecto dejó de leerse) y 403 nunca
  pasaron por el cruce (filas de proyecto y unidades sin ficha leída; 11 de ellas sí tienen `scraped_at` reciente, del listado).
- No se reevalúan: 2.015 de los 2.072 nuevos tienen `evaluado_at` del 02 al 07-oct (1.753 el 05-oct, 233 el 06-oct); 57 después.
  **La línea base de nuevos está hecha con tasa 4,04 % y UF 41.098 / 41.106 (05 y 06-oct)**; los usados, en su mayoría con
  4,07 % y la UF de los últimos 30 días (15.455 evaluados desde el 06-oct). Por eso la FASE 1 recalcula todo con la UF y la
  tasa de hoy (fila «0a») antes de corregir nada.

### 1.1 · Gastos comunes

`scraped_properties.gastos_comunes` está **vacío en las 41.038 filas activas** (8.648 arriendos, 7.585 nuevos, 24.805
usados): el aviso nunca trae gastos comunes, ni en venta ni en arriendo. El estimador del enunciado (mediana de $/m² por comuna
y dormitorios entre avisos con gastos comunes > 0) no se puede construir: n = 0 en todas las celdas. Lo que la pasada usa es el
único estimador que hay, el de tres tramos por comuna (`getGgccFallback`: 2.200 / 1.800 / 1.400 $/m²), y con el m² corregido
lo aplica a todas las filas: **después de corregir la superficie quedan 0 filas con gastos comunes en 0** (0 nuevos, 0
usados; `3-escenarios.ts`). El escenario 1.1 es, por lo tanto, idéntico a la línea base corregida. El proxy más cercano para medir el estimador sería leer los gastos comunes de las fichas
de arriendo (la ficha HTML los trae; el listado no), y eso es una lectura de fichas que este goal no hace.

### 1.2 · El premio de arriendo del nuevo, medido

Hoy el motor sube 3 % el arriendo sugerido de un depto nuevo (`PREMIO_ARRIENDO_NUEVO`; el 5 % es el tope). Lo que la base
permite medir (`2-premio.ts`, arriendos activos sin amoblados, temporada, corporativos ni piezas: 7.870 de 8.324):

- **Año de edificio en arriendos: 81 de 7.870** (`anios_edificio` y `fichas_leidas` cruzados por comuna, lat y lng a 5
  decimales), ninguno de 0 a 3 años. La curva por tramo de edad **no sale de la base**:

| tramo de edad | n | con referencia (n ≥ 15) | $/m² mediano | premio sobre la celda |
| --- | --- | --- | --- | --- |
| 0-3 | 0 | 0 | — | — |
| 4-10 | 50 | 47 | 8.310 | −6,7 % |
| 11-20 | 25 | 23 | 9.342 | −1,9 % |
| 21-30 | 4 | 3 | 9.182 | −9,7 % |
| 31 o más | 3 | 2 | 10.625 | −20,4 % |

- **Proxy «edificio nuevo»:** el arriendo está en el mismo punto, o a 30 m, de una unidad de obra nueva activa con entrega
  inmediata: **673 arriendos** (31 en el punto exacto). Su arriendo por m² contra la mediana de los arriendos no nuevos de su
  comuna y dormitorios con superficie ±20 % (la celda del motor), y contra el radio de 500 m (lo que usa la sugerencia):

| comuna | n | con celda | premio mediano (celda) | p25 | p75 | con radio | premio (radio 500 m) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ñuñoa | 139 | 136 | −7,6 % | −15,3 % | 5,8 % | 94 | −2,4 % |
| Santiago | 119 | 119 | 7,0 % | −4,0 % | 15,3 % | 107 | 4,1 % |
| La Florida | 104 | 99 | 3,5 % | −1,6 % | 13,4 % | 58 | 8,4 % |
| Cerrillos | 66 | 66 | −1,7 % | −7,8 % | 6,1 % | 64 | −2,7 % |
| La Cisterna | 55 | 54 | 1,8 % | −8,3 % | 8,5 % | 40 | −0,8 % |
| Independencia | 48 | 48 | 8,9 % | 6,0 % | 11,4 % | 39 | 8,9 % |
| Macul | 40 | 40 | 4,5 % | −1,6 % | 16,0 % | 21 | 4,0 % |
| Estación Central | 19 | 19 | 8,0 % | −4,5 % | 13,0 % | 17 | 2,5 % |
| San Miguel | 15 | 15 | 8,5 % | −1,1 % | 17,1 % | 11 | 6,0 % |
| Recoleta | 12 | 9 | 7,4 % | 1,5 % | 16,4 % | 0 | — |
| Quinta Normal | 12 | 12 | 3,7 % | 0,8 % | 16,0 % | 8 | 8,1 % |
| otras 10 comunas (n ≤ 10) | 44 | 27 | — | — | — | 5 | — |
| **Gran Santiago** | **673** | **644** | **2,8 %** | −7,3 % | 11,6 % | 464 | **2,9 %** |

**Lectura:** el premio mediano de Gran Santiago (2,8 % contra la celda, 2,9 % contra el radio) coincide con el 3 % que
usa el motor. Por comuna, con n ≥ 15, va de −7,6 % (Ñuñoa) a +8,9 % (Independencia), con un rango entre cuartiles de ±10
puntos: el proxy es ruidoso (no distingue el edificio nuevo del vecino de 30 m, ni la unidad chica del proyecto). **Tope
propuesto: se mantiene el 5 %**, aplicado por comuna entre 0 y 5 %: deja en 5 % a Santiago, Independencia, Estación
Central, San Miguel y Recoleta, en su valor medido a La Florida, Macul, La Cisterna y Quinta Normal, y en 0 % a Ñuñoa y
Cerrillos (un premio negativo no se aplica: el motor no castiga por ser nuevo). Un tope de 8 % cubriría a 9 de las 11
comunas con n ≥ 15, pero con el p75 en 11,6 % el número no aguanta más que el 5 % vigente.

### 1.3 · La mediana comunal del universo nuevo (lo que decide: GATE 1)

Después de corregir el m² (`1-base-corregida.ts`, mediana y cap resueltos en vivo con `prefetchMedianaComunaVenta`, 1.107
celdas distintas), sobre los 2.016 nuevos del universo limpio:

| | n |
| --- | --- |
| Con mediana comunal del universo nuevo, n ≥ 15 (celda comuna × nuevo × dormitorios × m² ±20 %, ventanas 90/180/365 días) | 1.866 (92,6 %) |
| Sin celda (la mediana queda `null`) | 150 |
| Universo de la mediana guardada = «nuevo» | 2.016 (todos: la regla ya es nuevo contra nuevo) |
| Precio sobre su mediana en más de 10 % | 345 |
| De ellos, con flujo negativo → brazo `sobreprecioComunalConFlujo` del GATE 1 activo | 345 (todos) |
| Buscar otra en 0b donde ese brazo es el ÚNICO del GATE 1 activo | 94 |
| GATE 1 por otros brazos en 0b: break-even imposible / flujo severo / CoC severo | 553 / 210 / 0 |
| Desviación sobre la mediana (nuevos con celda): mediana · p25 · p75 | 0,0 % · −8,0 % · +7,0 % |

**Con la celda vacía el motor no hace nada:** `precioVsComuna.confiable = false`, el brazo de sobreprecio queda apagado, el
hallazgo de sobreprecio no se emite y el puntaje no cambia (la dimensión «precio» del puntaje compara contra la venta por
radio, `precioM2Radio`, no contra la mediana comunal). En la base guardada, con superficie 0, eso le pasaba a 1.515 nuevos;
corregida, a 150. **En otras palabras: el sobreprecio comunal hoy no frena a casi ningún nuevo** (94 Buscar otra solo por
ese brazo), porque un nuevo comparado con los nuevos de su comuna está, en mediana, en su mediana (0,0 %).

**El cap de referencia, solo para el hallazgo:** en 0b los nuevos quedan en celda 1.673 · comuna 169 · bdo 78 · nacional 96
(antes: bdo 1.459). De los 174 que siguen en bdo o nacional (90 celdas), con la celda combinada usado + nuevo (mismas
ventanas y mínimos, `resolverCapRefCascada`) pasan a celda 22 y a comuna 8; **144 siguen en bdo/nacional**: son comunas con
pocos arriendos del tamaño del depto (el lado del arriendo es el que no alcanza n ≥ 15), no el universo de venta.

### Tabla de salida de la fase

Pie 20 %, 30 años, universo limpio (sin sospechosos ni degradados, con arriendo): **nuevos 2.016, usados 21.191**. Las
filas 0a y 0b se recalculan con la UF y la tasa de hoy (41.274 · 4,07 %); «pierden / ganan» se mide contra 0b, la nueva línea
base. Control del instrumento: con el 3 % de hoy, el motor reproduce 0b en 199 de 200 nuevos (el que no, por un peso de
redondeo del arriendo).

| escenario | nuevos Comprar | inmediata | futura | nuevos Ajustar | usados Comprar | usados −/+ Comprar vs 0b | nuevos −/+ Comprar vs 0b |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Línea base de hoy (lo guardado, con la UF y la tasa del día en que se evaluó) | 36 (1,8 %) | 28 | 3 | 989 | 6.702 (31,6 %) | — | — |
| 0a · lo guardado con la UF y la tasa de hoy | 33 (1,6 %) | 25 | 3 | 950 | 6.603 (31,2 %) | −0 / +8 | −0 / +4 |
| **0b · superficie corregida (nueva línea base)** | **29 (1,4 %)** | 21 | 3 | 887 | **6.595 (31,1 %)** | — | — |
| 1.1 · gastos comunes estimados (0 filas en 0) | = 0b | | | | = 0b | — | — |
| 1.2a · premio medido por comuna, sin tope (−7,6 % a +8,9 %) | 28 (1,4 %) | 24 | 1 | 856 | 6.595 | 0 / 0 | −4 / +3 |
| 1.2b · premio medido con tope 0–5 % | 28 (1,4 %) | 22 | 2 | 904 | 6.595 | 0 / 0 | −2 / +1 |
| 1.3 · mediana comunal de universo nuevo | = 0b (ya es la regla del motor) | | | | = 0b | — | — |
| **Juntas (0b + 1.2b; 1.1 y 1.3 no cambian filas)** | **28 (1,4 %)** | 22 | 2 | 904 | 6.595 (31,1 %) | 0 / 0 | −2 / +1 |

**Solo por la superficie (0a → 0b):** de los 36 nuevos Comprar de hoy, 3 ya dejan de serlo en 0a por la UF y la tasa de hoy
(estaban en 70–75 con la tasa 4,04 % de octubre) y **4 más dejan de serlo al corregir el m²** (todos con superficie 0: les
aparecen los gastos comunes, la mantención y el CapEx). De los 6.702 usados Comprar de hoy, 99 dejan de serlo en 0a (UF y
tasa) y **8 más al corregir el m²**; ninguno entra. Nada mejora al corregir: el error inflaba.

**Los 36 nuevos Comprar de hoy en juntas: siguen 26, salen 10.** Salen 3 por la UF y la tasa de hoy (283621bb y bd6b7ef9 en
La Florida, 9d1076aa en Las Condes; los tres con superficie 0 y puntaje 70–75), 4 por la superficie (0cb783ba La Florida,
4152b2b6 Las Condes, 7c0dcc32 La Cisterna, 6549eedd La Florida: entraban sin gastos comunes ni mantención, es justo que
salgan; 6549eedd vuelve a entrar con el premio de La Florida, 3,5 %) y 3 por el premio con tope (0dc76c6d en Cerrillos y
81afa555 en Ñuñoa salen; su comuna mide premio negativo, el tope lo deja en 0 % y pierden el 3 % de hoy; 8a87cf30, también
en Cerrillos, baja a 71 y sigue Comprar). 32 de los 36 tenían superficie 0; 25 de ellos siguen Comprar corregidos: el error
no los fabricó, los empujó uno o dos puntos.

**Juntas por comuna (nuevos Comprar):**

| comuna | nuevos | Comprar hoy | Comprar 0b | Comprar juntas | % juntas | premio usado |
| --- | --- | --- | --- | --- | --- | --- |
| La Florida | 313 | 11 | 7 | 8 | 2,6 % | 3,5 % |
| Santiago | 309 | 0 | 0 | 0 | 0,0 % | 5,0 % |
| Ñuñoa | 274 | 2 | 2 | 1 | 0,4 % | 0,0 % |
| Macul | 190 | 0 | 0 | 0 | 0,0 % | 4,5 % |
| Providencia | 162 | 0 | 0 | 0 | 0,0 % | 2,8 % |
| Independencia | 118 | 0 | 0 | 0 | 0,0 % | 5,0 % |
| Las Condes | 103 | 4 | 2 | 2 | 1,9 % | 2,8 % |
| Vitacura | 74 | 2 | 2 | 2 | 2,7 % | 2,8 % |
| Recoleta | 54 | 0 | 0 | 0 | 0,0 % | 2,8 % |
| Estación Central | 48 | 1 | 1 | 1 | 2,1 % | 5,0 % |
| La Cisterna | 46 | 1 | 0 | 0 | 0,0 % | 1,8 % |
| Quilicura | 35 | 3 | 3 | 3 | 8,6 % | 2,8 % |
| Puente Alto | 29 | 4 | 4 | 4 | 13,8 % | 2,8 % |
| Maipú | 22 | 2 | 2 | 2 | 9,1 % | 2,8 % |
| Cerrillos | 21 | 3 | 3 | 2 | 9,5 % | 0,0 % |
| El Bosque | 18 | 1 | 1 | 1 | 5,6 % | 2,8 % |
| Renca | 5 | 2 | 2 | 2 | 40,0 % | 2,8 % |
| otras 9 comunas (Pudahuel, San Miguel, Peñalolén, Lo Barnechea, Huechuraba, Conchalí, Quinta Normal, San Joaquín, La Reina) | 164 | 0 | 0 | 0 | 0,0 % | 2,8–5,0 % |

(2,8 % = el premio de Gran Santiago, para las comunas sin n ≥ 15.)

### Lo que deja la FASE 1

1. **Las correcciones de datos no llevan a los nuevos del 1,8 % al 4–6 %: los llevan al 1,4 %.** La superficie perdida y la
   tasa de octubre inflaban la línea base; el premio medido coincide con el 3 % que ya usa el motor, y el sobreprecio comunal
   casi no frena nuevos. El 1,8 % no es un error de datos: es la aritmética (UF 86/m² contra un arriendo casi igual al del
   usado, flujo mediano −$234.000) más los gates de flujo (break-even imposible en 553, flujo severo en 210).
2. Lo que falta medir es la segunda mitad de la rentabilidad (FASES 3 y 4): la plusvalía de entrega y la TIR como segundo
   criterio. Es ahí donde un nuevo puede cruzar sin que se le regale flujo.
3. Para el goal de los defectos: el arreglo del m² mueve 4 nuevos y 8 usados de Comprar a Ajustar, y 1.515 nuevos recuperan
   mediana comunal y cap de referencia; el de `scraped_at` devuelve 2.061 unidades a Explorar, /deptos y el semanal (y al
   cron, que las reevaluaría con la tasa de hoy: −3 Comprar).

---

## Punto 0 · Confirmaciones antes de la FASE 2 (respuesta al STOP 1)

**a) Subsidio a la tasa.** Confirmado: la pasada evalúa nuevos y usados con la misma `config.tasa_hipotecaria`, sin
subsidio. `respuestasDeAviso` pone `tasaModo = "estimada"` y `tasaInteres = cfg.tasa`; el motor calcula igual
`subsidioTasa.califica` pero solo lo aplica si la tasa que entra es la rebajada (`aplicado = califica && tasaInteres ≤
tasaConSubsidio`), y en la pasada nunca lo es. Regla de elegibilidad del wizard (`src/lib/constants/subsidio.ts`,
`calificaSubsidio`): **vivienda nueva en primera venta (`tipoPropiedad = "nuevo"`) con precio ≤ UF 6.000**, Ley 21.836,
vigente hasta mayo de 2028; rebaja de referencia 0,6 puntos sobre la tasa de mercado. El wizard la ofrece como tasa
sugerida cuando califica; un usado recién estrenado no califica (la ley exige primera venta).

**b) Flujo y TIR del informe.** Todo en pesos de hoy (= UF): el dividendo es fijo en UF; el arriendo crece 3,5 % nominal, que
son **0,49 % real al año** (`ARRIENDO_REAL = crecimientoReal(0,035)`); gastos comunes y contribuciones 0 % real; el valor
del depto crece **3 % real desde el año 0** (`valorPropiedad = precio × 1,03^año`, también durante la construcción). La pasada
usa mes y año de entrega en tres cosas: `estadoVenta = "futura"` + `fechaEntrega` → meses sin arriendo ni dividendo
(`calcMesesHastaEntrega`), la edad para mantención cuenta desde la entrega, y las cuotas del pie por defecto (una por mes
hasta la entrega, `cuotasPorDefecto`). La TIR del informe es anual, a 10 años desde hoy (`HORIZONTE_SALIDA_ANIOS`), **con
fechas**: los años previos a la entrega llevan flujo operativo 0, crédito 0 y las cuotas del pie del año (`cuotasDelAnio`); la
primera cuota y los gastos de cierre van en t0; el crédito parte en la entrega y la venta es al año 10 contado desde hoy. Lo
que no hace: no descuenta el precio por esperar ni mete riesgo de tasa (desde r3, 02-oct, tampoco resta puntaje por la espera).

**c) `precio_estimado_uf`.** Lo escribe el cruce con la ficha nueva (`scrape-unidades-nuevas` › `estimarPrecioUnidadUF`):
**por unidad**, interpolando entre el «desde» y el «hasta» que publica hoy la ficha del proyecto según el **m² útil de la
unidad**, entre el m² más chico y el más grande de todas las unidades conocidas del proyecto (ensayo del 02-oct: p50 3,9 %,
p90 10,2 %; medido hoy sobre 7.020 unidades: |error| mediano 3,5 %, p90 14,2 %, 60 % dentro de ±5 %). La pasada usa **`precio`**
(el real por unidad que trajo el GraphQL viejo entre el 29-sep y el 01-oct); el estimado solo lo lee la mediana de venta nueva
cuando la fila pasa de 90 días (`precioVentaNueva`, se activa a fines de diciembre). **No hay unidades creadas después del
02-oct**: el cruce nunca crea filas ni escribe precios (decisión de Fabrizio, 02-oct); una unidad nueva que la ficha lista y
no tenemos se cuenta como «nueva sin precio» y no entra.

**d) 7.585 unidades activas y 2.072 evaluadas.** Hoy son 7.693 filas activas (la base creció en el día). Las no evaluadas:
- **5.362 unidades de 334 proyectos, vistas por el cruce el 04 o el 05-nov, con precio estimado.** 4.593 están en
  `bajas_avisos` (baja entre el 06-oct y el 04-nov): en algún cruce no aparecieron en la lista de disponibles, quedaron
  `is_active = false`, `cerrar_bajas` las sacó de `avisos_evaluados`, y un cruce posterior las volvió a ver y las reactivó
  («vista hoy, y activa si había salido»). Como el cron solo evalúa lo visto en 7 días por `scraped_at`, nunca vuelven.
  **Son unidades disponibles hoy según la ficha y no están en Explorar ni en el semanal.**
- 118 unidades y 93 filas de proyecto sin marca (113 proyectos), creadas entre marzo y el 03-ago: lo que trajo el listado
  antes del pase de unidades, nunca cruzado; 50 unidades «fuera@» (la ficha nueva nunca las listó: salen por diseño).
- Y entre las evaluadas hay 392 unidades y 11 filas de proyecto sin marca (59 proyectos): el cruce nunca leyó esos
  proyectos (sin ficha legible o fuera de la lista del pase), así que no se sabe si siguen disponibles.

---

## FASE 2 · Proyectos, unidades y ficha

### 2.1 Proyectos detrás de los avisos nuevos

**La llave de proyecto es la URL de la ficha** (`url`; en las unidades `source_id = url#<número>`). Revisada a mano en 20
proyectos al azar con 3 o más unidades: en los 20, una sola comuna, un solo punto (lat, lng), una dirección, un título y una
entrega, con m² distintos por unidad (tabla en `out/4-proyectos.stdout`). Sobre los 536 proyectos activos, ninguno mezcla
comunas y 4 tienen dos puntos (una unidad geocodificada aparte: Sky Park, Vista Egaña, Edificio Angular, Hernán Cortés).
**Confiabilidad: alta.**

| universo | avisos | proyectos | unidades por proyecto (mediana / máx) | tipologías por proyecto (mediana / máx) | proyectos: inmediata / futura / sin dato |
| --- | --- | --- | --- | --- | --- |
| evaluados (2.072) | 2.070 | 448 | 2 / 87 | 1 / 4 | 327 / 77 / 44 |
| todos los nuevos activos | 7.693 | 536 | 5 / 210 | 2 / 4 | 347 / 87 / 102 |

Proyectos por comuna (evaluados · todos; unidades evaluadas · activas): Santiago 70 · 81 (309 · 1.779), Ñuñoa 70 · 80 (290 ·
1.111), Macul 26 · 28 (191 · 754), La Florida 56 · 65 (314 · 750), Providencia 42 · 48 (164 · 517), Independencia 16 · 19
(118 · 415), Peñalolén 8 · 8 (51 · 312), La Cisterna 16 · 19 (45 · 243), Las Condes 31 · 39 (106 · 238), Vitacura 28 · 29
(79 · 190), Recoleta 6 · 8 (55 · 182), Puente Alto 6 · 6 (32 · 163), Maipú 7 · 8 (23 · 139), Estación Central 14 · 15 (48 ·
136), Conchalí 4 · 5 (12 · 132), Pudahuel 3 · 3 (36 · 96), Lo Barnechea 10 · 17 (33 · 92), Quilicura 4 · 4 (35 · 87),
Huechuraba 2 · 11 (31 · 87), Cerrillos 8 · 10 (21 · 69), Quinta Normal 4 · 5 (10 · 65), San Miguel 7 · 12 (34 · 60), El
Bosque 1 · 1 (19 · 27), San Joaquín 4 · 6 (6 · 21), Renca 3 · 5 (5 · 18), La Reina 2 · 4 (3 · 10). La mitad de las unidades
activas está en Santiago, Ñuñoa, Macul y La Florida; **las evaluadas son el 27 % de las activas**, y en Santiago el 17 %.

Precio en moneda distinta de UF o con estimado: 7.474 de 7.585 unidades están en UF (111 en pesos); 7.029 traen
`precio_estimado_uf` (todas las vistas por el cruce); ninguna evaluada usa el estimado (ver 0.c).

### 2.2 El «desde» contra la unidad mediana y la más cara (sin lecturas)

Con los precios reales por unidad del GraphQL de septiembre, por proyecto y tipología con 3 o más unidades (543 celdas, 343
proyectos, 6.992 unidades): la unidad **mediana** está **6,1 % sobre el desde** (p25 3,0 %, p75 11,8 %) y la **más cara 15,9 %**.

| grupo | celdas | unidades | mediana / desde | p25 | p75 | máxima / desde |
| --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 543 | 6.992 | 6,1 % | 3,0 % | 11,8 % | 15,9 % |
| 1D | 152 | 2.303 | 5,0 % | 2,6 % | 11,9 % | 12,8 % |
| 2D | 251 | 3.205 | 7,5 % | 3,8 % | 12,4 % | 17,5 % |
| 3D | 90 | 942 | 5,7 % | 2,7 % | 10,6 % | 14,4 % |
| 4D | 14 | 118 | 7,0 % | 4,2 % | 10,4 % | 20,0 % |
| Ñuñoa | 99 | 1.019 | 6,9 % | 3,8 % | 12,0 % | 16,2 % |
| Santiago | 91 | 1.674 | 5,3 % | 2,7 % | 9,6 % | 13,8 % |
| La Florida | 67 | 674 | 5,1 % | 2,5 % | 9,9 % | 12,7 % |
| Providencia | 46 | 439 | 9,5 % | 4,9 % | 19,2 % | 23,8 % |
| Macul | 42 | 718 | 6,4 % | 2,8 % | 18,0 % | 15,2 % |
| Las Condes | 29 | 191 | 7,2 % | 3,4 % | 11,4 % | 22,4 % |
| Vitacura | 24 | 141 | 11,4 % | 4,9 % | 18,8 % | 22,5 % |
| Independencia | 23 | 391 | 7,8 % | 4,1 % | 14,6 % | 19,9 % |
| La Cisterna | 20 | 222 | 4,5 % | 2,5 % | 9,8 % | 10,1 % |
| Peñalolén | 15 | 309 | 7,4 % | 5,3 % | 9,2 % | 26,1 % |
| Estación Central | 13 | 120 | 3,9 % | 1,7 % | 6,6 % | 6,6 % |
| Recoleta | 11 | 175 | 3,5 % | 1,0 % | 8,1 % | 7,1 % |
| otras 9 comunas (5 a 10 celdas) | 57 | 657 | 2,6–8,8 % | | | 5,9–23,9 % |

**Ojo con la lectura:** como la pasada evalúa cada unidad con su precio real, el «desde» no la sesga; sesga a la mediana
comunal de venta nueva solo cuando use el estimado (desde los 90 días) y a cualquier lectura que tome el «desde» del
proyecto como precio del aviso. La celda proyecto × tipología es también la que un comprador ve en la cotización: la unidad
mediana cuesta 6 % más que el precio del anuncio.

### 2.3 Lo que trae la ficha nueva (12 proyectos, por el camino del cruce)

El cruce nocturno ya baja, por proyecto, dos JSON de `api-ficha` (`/property/<id>` y `/property/<id>/floors-units`): el rango
«desde/hasta» en UF, el estado y la fecha de entrega, y los disponibles con número, dormitorios, baños, piso y m² útiles y
totales. Se leyeron esos mismos dos JSON para 12 proyectos (2 de los 29 Comprar, 3 con break-even imposible, 2 de entrega
futura, 5 diversos en comuna y tipología; 1 GET de prueba + 24, de a uno con 4 s de pausa, sin HTML; crudos en
`out/fichas/`, no se commitean). Inventario de campos (sí / no, con ejemplo):

| campo | proyectos con el dato | ejemplo |
| --- | --- | --- |
| unidades disponibles por tipología | **12 de 12** | 1526403 Macul: 34 (1D, 2D y 3D) |
| precio por unidad | **0 de 12** | la lista solo tiene número, piso, dormitorios, baños y m²; el precio aparece tras la precotización (pide lead) |
| precio desde / hasta del proyecto | 9 de 12 | 1186728 Puente Alto: UF 2.670–3.135 |
| fecha de entrega real | 9 de 12 | «2do Semestre 2027», «Inmediata», «Disponible» (3 fichas sin características) |
| pie en cuotas / bono pie | 0 de 12 | — |
| gastos comunes estimados | 0 de 12 | — |
| año de recepción o permiso | 0 de 12 (1 falso positivo: «recepción» en la descripción, es la recepción del edificio) | — |
| estacionamiento / bodega | 4 de 12 (solo como texto de descripción) | 4376614 Estación Central |
| descuento / promoción | 0 de 12 | — |
| subsidio | 0 de 12 | — |

Tres fichas (3886983 Providencia, 1721526 San Miguel, 2004251 La Florida) responden sin `characteristics` ni rango: traen
disponibles, pero ni precio ni entrega. **Conclusión:** las lecturas no agregan ningún campo al cruce; todo lo que la ficha
sabe ya se guarda, salvo el m² total por unidad. Lo que falta (precio por unidad, pie, bono, gastos comunes, año) no está en
la fuente pública.

Precio «desde» contra la unidad mediana en la muestra (precios reales de nuestras unidades; el «desde» de la ficha coincide
con la unidad más barata en los 9 casos con rango):

| proyecto | disponibles hoy | unidades activas en la base | desde (ficha) | mediana (base) | mediana / desde |
| --- | --- | --- | --- | --- | --- |
| 1186728 Puente Alto (Comprar) | 21 | 21 | 2.670 | 2.911 | 9,0 % |
| 4376614 Estación Central (Comprar) | 306 | 0 | 1.447 | — | el aviso evaluado es la fila del proyecto, al «desde» |
| 3971670 Santiago (break-even) | 4 | 4 | 3.379 | 3.840 | 13,6 % |
| 3734878 Ñuñoa (break-even) | 3 | 3 | 3.548 | 4.250 | 19,8 % |
| 1526403 Macul (break-even) | 34 | 34 | 3.464 | 5.119 | 47,8 % |
| 4027541 Estación Central (futura) | 10 | 12 | 2.182 | 2.268 | 3,9 % |
| 3886983 Providencia (futura) | 10 | 10 | — | 7.240 | — |
| 3325926 Huechuraba | 47 | 67 | 4.690 | 5.180 | 10,4 % |
| 1721526 San Miguel | 2 | 2 | — | 2.600 | — |
| 2004251 La Florida | 88 | 88 | — | 3.313 | — |
| 1552423 Pudahuel | 32 | 31 | 2.907 | 4.068 | 39,9 % |
| 1723740 Las Condes | 6 | 6 | 17.966 | 18.573 | 3,4 % |

El estimado por unidad contra el precio real no se pudo medir contra la ficha (no trae precio por unidad); contra el precio
real que ya tenemos: |error| mediano 3,5 %, p90 14,2 %, 60,1 % dentro de ±5 % y 81,8 % dentro de ±10 % (7.020 unidades).

### 2.4 Unidades detrás de los avisos nuevos activos

En la muestra, **disponibles de la ficha / unidades activas en la base = 1,00 en mediana** (0,70 a 1,03, n 11): el cruce
mantiene la base igual a la ficha, salvo un proyecto que lista 306 unidades donde la base solo tiene la fila del proyecto
(4376614). Con eso:

| | unidades |
| --- | --- |
| Unidades activas conocidas (vistas por el cruce el 04 o 05-nov) | 7.029 |
| Unidades activas sin cruce (nunca leídas) | 510 |
| Filas de proyecto sin unidades (60 proyectos) × 6 a 17 unidades (mediana y p75 por proyecto) | 360 a 1.020 |
| Proyectos como 4376614 (306 unidades detrás de una fila): no se puede acotar sin leer las 60 fichas | +0 a +2.000 |
| **Estimación** | **7.900 a 10.500 unidades en 536 proyectos de 26 comunas** |

Contra las 70.000 a 80.000 unidades nuevas que Fabrizio estima para Santiago: **cobertura de 10 a 15 %**, con dos
incertidumbres que la base no resuelve: cuántas unidades hay detrás de los 60 proyectos sin unidades (una lectura de 60
fichas lo cierra, a 2 GET cada una) y qué parte del stock está en comunas o portales que Franco no lee (la base cubre 26
comunas del Gran Santiago, una sola fuente).
