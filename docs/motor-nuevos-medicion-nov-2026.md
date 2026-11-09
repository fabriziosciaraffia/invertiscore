# Deptos nuevos en el motor · medición 1 (noviembre 2026)

Goal de solo lectura, pegado por Fabrizio el 05-nov-2026. Nada de este documento toca el motor, los builders, los
prompts, el informe ni la base: todo recálculo corre en memoria con los scripts de `scripts/analisis/motor-nuevos/`,
que llaman al motor real (`runAnalysis`) con los insumos guardados en `avisos_evaluados`.

> **Estado: las cuatro fases y el anexo 1 completo en master (aa8f311d, 06-nov-2026); el anexo 2 «salida por ingreso»
> (07-nov-2026), con la tabla por comuna y las ocho fichas (09-nov-2026), en la rama, a la espera del OK para el push.** Orden del documento: resumen, FASE 0, FASE 1, punto 0, FASE 2, punto 2, FASE 3, defectos,
> punto 1 (edad), FASE 4 (supuestos y resultados), lo que la base no puede responder, preguntas.

## Resumen (10 líneas): qué parte del 1,8 % explica cada cosa

1. **Los errores de datos no explican el 1,8 %: lo inflaban.** Con la UF y la tasa de hoy los nuevos pasan de 36 a 33 Comprar (1,6 %); con la superficie corregida (1.515 nuevos evaluados con m² = 0 por el parser de un decimal), a 29 (1,4 %); el premio medido del nuevo es 2,8 % (el motor ya usa 3 %); gastos comunes no existen en la tabla; el cap de referencia no entra al veredicto.
2. **El universo completo no cambia la tasa, cambia el tamaño:** 5.599 nuevos limpios (3.513 reactivadas por el cruce estaban fuera de `avisos_evaluados` por `scraped_at`), 79 Comprar (1,4 %); Puente Alto 29 de 90.
3. **Lo que sí explica el 1,4 % es la aritmética y los gates de flujo:** UF 86/m² contra 63 del usado con arriendo casi igual, flujo mediano −$238.000 contra −$70.000; break-even imposible en 1.639 de 5.599 (29 %), flujo severo 568, sobreprecio comunal con flujo 901.
4. **La TIR del motor de hoy iguala a nuevos y usados (7,4 % contra 7,5 %):** el 3 % de plusvalía sobre un precio 36 % más alto compensa el flujo. Con TIR ≥ 5 % y flujo ≥ −$200.000 como regla, el motor de hoy daría 2.054 nuevos Comprar (36,7 %) y 10.710 usados (50 %).
5. **La g lo decide todo:** con g = 1 % (lo que dicen los últimos 5 años de lista) la celda central da 337 nuevos (6,0 %) y 6.851 usados; con g = 0 % (el último año), 27 nuevos (0,5 %) y 2.565 usados; la tolerancia de flujo casi no pesa de 5 % para arriba.
6. **El precio de salida es el supuesto que separa un nuevo de un usado:** la salida del motor al año 10 está 47 % sobre lo que hoy vale un usado equivalente × m²; vendido a valor usado, el nuevo da TIR −18 % (g 0 %) o −12 % (g 1 %) y solo 38 a 97 cruzan.
7. **Plusvalía de entrega y edad no salen de la base:** el corte transversal da 0 % de descuento por esperar (−0,4 a −1,5 %, sin pendiente); 98,8 % de los usados sin año; la única curva que aguanta (Santiago: −15 % de 6-10 a 11-20 años) como sensibilidad deja 3 nuevos Comprar. Las fuentes sostienen g de 0, 1 y 3 % (INCOIN, GfK 5 años, CLAPES/GfK 10 años).
8. **Palancas:** Negociar 10 % lleva a 305 Comprar del motor (5,4 %) y 130 con g = 0 %; el subsidio (3.723 elegibles) a 149 y 88; juntos, 456 (8,1 %) y 290 (5,2 %); con g = 1 %, 2.007 (36 %).
9. **El Golden no se mueve:** 17b4e10d sigue Comprar en todas las versiones (hasta a valor usado), 7710a017 Ajustar, f3522eac Buscar otra.
10. **Para arreglar antes que el motor:** el m² a un decimal, el `scraped_at` de las unidades, las 5.362 reactivadas fuera de Explorar, los 2.015 nuevos sin reevaluar desde octubre, los 60 proyectos evaluados al «desde» y el Golden sin Buscar otra de renta larga (sección «Para el goal de los defectos»).


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

---

## Punto 2 del STOP 2 · La base de referencia sobre el universo completo de nuevos

Las unidades activas sin evaluación pasaron por la misma función de la pasada nocturna, `evaluarAviso` (sugerencias de
arriendo y venta por radio, mediana comunal y cap de referencia en vivo, `runAnalysis`), con la base de referencia: m²
legible con dos decimales, premio 3 % parejo, UF 41.274 y tasa 4,07 % (`6-universo-completo.ts`, concurrencia 3, 1,4 s por
aviso, 84 minutos, 0 fallas, nada escrito). De las 5.623 sin evaluación, **3.732 son evaluables** con el filtro de la pasada
(`avisosEvaluables`: completas, plausibles, sin duplicado exacto ni «fuera»); las 1.891 que no pasan son en su mayoría
duplicados exactos (misma comuna, m², dormitorios, baños, precio y punto: unidades iguales del mismo proyecto) y filas de
proyecto sin dormitorios o baños. Control: la cadena de la fila (`contextoDeFila`) reproduce `evaluarAviso` en 3.730 de
3.732 (las dos que no, por un peso de redondeo del arriendo).

| universo (nuevos limpios: sin sospechosos ni degradados, con arriendo) | n | Comprar | inmediata | futura | sin dato | Ajustar | Buscar otra | break-even imposible | flujo severo | sobreprecio con flujo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.072 evaluadas (0b) | 2.016 | 29 (1,4 %) | 21 | 3 | 5 | 887 | 1.100 | 553 | 210 | 345 |
| reactivadas por el cruce | 3.513 | 46 (1,3 %) | 30 | 0 | 16 | 1.299 | 2.168 | 1.073 | 351 | 546 |
| viejas sin cruce | 70 | 4 (5,7 %) | 1 | 0 | 3 | 35 | 31 | 13 | 7 | 10 |
| **universo completo (base de referencia de las FASES 3 y 4)** | **5.599** | **79 (1,4 %)** | 52 | 3 | 24 | 2.221 | 3.299 | 1.639 | 568 | 901 |

Usados: sin cambio, 21.191 limpios y 6.595 Comprar (0b). **El universo completo no cambia la tasa de Comprar de los nuevos
(1,4 % en los dos), pero casi triplica el número (29 → 79)**, y mueve el mapa: Puente Alto pasa de 4 a 29 Comprar (de 90),
Renca de 2 a 5 (de 14), La Cisterna de 0 a 4, Macul de 0 a 3, Ñuñoa de 2 a 5. Santiago sigue en 0 de 1.206, Providencia en 0
de 481, Independencia en 0 de 342.

| comuna | n 2.072 | Comprar 2.072 | n completo | Comprar completo | % completo | inmediata / futura (completo) |
| --- | --- | --- | --- | --- | --- | --- |
| Santiago | 309 | 0 | 1.206 | 0 | 0,0 % | 0 / 0 |
| Ñuñoa | 274 | 2 | 896 | 5 | 0,6 % | 2 / 0 |
| La Florida | 313 | 7 | 584 | 11 | 1,9 % | 11 / 0 |
| Macul | 190 | 0 | 522 | 3 | 0,6 % | 3 / 0 |
| Providencia | 162 | 0 | 481 | 0 | 0,0 % | 0 / 0 |
| Independencia | 118 | 0 | 342 | 0 | 0,0 % | 0 / 0 |
| Las Condes | 103 | 2 | 217 | 2 | 0,9 % | 2 / 0 |
| La Cisterna | 46 | 0 | 173 | 4 | 2,3 % | 3 / 0 |
| Vitacura | 74 | 2 | 162 | 2 | 1,2 % | 1 / 1 |
| Recoleta | 54 | 0 | 116 | 1 | 0,9 % | 1 / 0 |
| Maipú | 22 | 2 | 116 | 2 | 1,7 % | 2 / 0 |
| Pudahuel | 35 | 0 | 93 | 0 | 0,0 % | 0 / 0 |
| Puente Alto | 29 | 4 | 90 | 29 | 32,2 % | 18 / 0 |
| Estación Central | 48 | 1 | 85 | 3 | 3,5 % | 0 / 0 |
| Lo Barnechea | 32 | 0 | 74 | 0 | 0,0 % | 0 / 0 |
| Quilicura | 35 | 3 | 65 | 4 | 6,2 % | 4 / 0 |
| Peñalolén | 32 | 0 | 63 | 1 | 1,6 % | 1 / 0 |
| Cerrillos | 21 | 3 | 61 | 3 | 4,9 % | 0 / 2 |
| Conchalí | 12 | 0 | 59 | 1 | 1,7 % | 0 / 0 |
| Huechuraba | 31 | 0 | 58 | 1 | 1,7 % | 0 / 0 |
| San Miguel | 34 | 0 | 53 | 0 | 0,0 % | 0 / 0 |
| Quinta Normal | 10 | 0 | 26 | 0 | 0,0 % | 0 / 0 |
| El Bosque | 18 | 1 | 19 | 2 | 10,5 % | 0 / 0 |
| San Joaquín | 6 | 0 | 17 | 0 | 0,0 % | 0 / 0 |
| Renca | 5 | 2 | 14 | 5 | 35,7 % | 4 / 0 |
| La Reina | 3 | 0 | 7 | 0 | 0,0 % | 0 / 0 |

(«inmediata / futura» no suma el total de Comprar donde hay «sin dato»: 16 de los 46 Comprar reactivados vienen de fichas
sin características, sin fecha de entrega.)

---

## FASE 3 · Plusvalía de entrega y edad

### 3.1 La curva de precio por edad: no medible desde la base

De los 22.288 usados activos con evaluación, **22.015 (98,8 %) no tienen año en ninguna parte**: la columna `antiguedad` está
vacía en toda la tabla, 242 tienen año en `fichas_leidas` y 273 por edificio en `anios_edificio`. No se fuerza la medición.

Para tener **n ≥ 30 con año por comuna** en las 8 comunas con más usados, con el lector del informe (que ya saca el año de la
ficha; 271 de las 918 lecturas con código 200 trajeron año: **29,5 %**):

| comuna | usados activos | fichas leídas | con año hoy | lecturas buenas que faltan | GET (hasta 2 por chequeo) |
| --- | --- | --- | --- | --- | --- |
| Santiago | 5.915 | 222 | 50 | 0 | 0 |
| Las Condes | 2.615 | 103 | 33 | 0 | 0 |
| Ñuñoa | 2.122 | 96 | 18 | 41 | 82 |
| Estación Central | 1.610 | 26 | 7 | 78 | 156 |
| San Miguel | 1.282 | 36 | 11 | 65 | 130 |
| Providencia | 1.245 | 88 | 26 | 14 | 28 |
| Vitacura | 1.189 | 41 | 17 | 44 | 88 |
| La Florida | 957 | 24 | 10 | 68 | 136 |
| **total** | | | | **310** | **620** |

Con el tope de 30 fichas por hora, son unas 21 horas de lectura (tres noches). Y n ≥ 30 por comuna da una mediana por comuna,
no una curva: para 5 tramos de edad con n ≥ 15 cada uno harían falta unas 75 lecturas buenas por comuna, 2.000 GET en total.
Lo que la base sí sabe de la edad en arriendo (FASE 1.2, 81 arriendos con año): los edificios de 4 a 10 años arriendan 6,7 %
bajo su celda y los de 11 a 20, 1,9 % bajo; n chico y sin tramo 0-3.

### 3.2 Plusvalía de entrega

**a) Corte transversal, entrega futura contra inmediata** (`7-plusvalia.ts`; 7.579 unidades activas con precio real
plausible: 4.837 inmediata, 2.414 futura, 328 sin dato; celdas comuna × tipología con n ≥ 10 por lado):

| comuna | tipología | n inmediata | UF/m² inmediata | n futura | UF/m² futura | futura / inmediata | meses a la entrega (mediana) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Santiago | 1D | 553 | 96,5 | 332 | 93,5 | −3,2 % | 19 |
| Santiago | 2D | 346 | 81,3 | 273 | 76,3 | −6,1 % | 19 |
| Santiago | studio | 85 | 111,2 | 153 | 104,3 | −6,2 % | 7 |
| Ñuñoa | 2D | 372 | 94,6 | 161 | 94,3 | −0,3 % | 7 |
| Ñuñoa | 1D | 237 | 109,0 | 135 | 100,3 | −8,0 % | 7 |
| Macul | 2D | 289 | 82,7 | 143 | 73,9 | −10,6 % | 13 |
| Macul | 1D | 127 | 104,8 | 83 | 89,2 | −14,9 % | 25 |
| Macul | 3D | 75 | 75,1 | 21 | 70,0 | −6,8 % | 13 |
| La Florida | 2D | 284 | 78,0 | 49 | 76,3 | −2,2 % | 13 |
| La Florida | 1D | 183 | 91,9 | 31 | 91,0 | −0,9 % | 13 |
| Providencia | 2D | 128 | 122,8 | 140 | 124,5 | +1,4 % | 19 |
| Providencia | 3D | 77 | 113,5 | 43 | 115,5 | +1,7 % | 19 |
| Providencia | 1D | 52 | 138,6 | 49 | 143,3 | +3,3 % | 25 |
| Independencia | 2D | 167 | 69,3 | 51 | 75,2 | +8,5 % | 19 |
| Independencia | 1D | 100 | 83,0 | 33 | 92,5 | +11,4 % | 19 |
| Independencia | 3D | 31 | 63,7 | 26 | 73,7 | +15,8 % | 19 |
| Las Condes | 2D | 35 | 129,1 | 24 | 152,0 | +17,7 % | 7 |
| Las Condes | 3D | 55 | 122,7 | 12 | 117,7 | −4,0 % | 7 |
| Las Condes | 1D | 11 | 123,2 | 39 | 158,6 | +28,7 % | 1 |
| Vitacura | 2D | 57 | 145,4 | 28 | 148,5 | +2,2 % | 37 |
| Vitacura | 3D | 46 | 144,7 | 10 | 124,6 | −13,9 % | 7 |
| Peñalolén | 3D | 50 | 76,7 | 93 | 93,7 | +22,1 % | 7 |
| Estación Central | 2D | 61 | 61,9 | 11 | 59,0 | −4,6 % | 13 |
| Estación Central | 1D | 35 | 71,3 | 13 | 69,6 | −2,5 % | 13 |
| Pudahuel | 2D / 3D | 12 / 12 | 73,9 / 68,4 | 37 / 26 | 77,7 / 72,9 | +5,3 % / +6,6 % | 1 |

Cada unidad futura contra la mediana inmediata de su comuna y tipología, por meses hasta la entrega:

| meses a la entrega | n futuras | descuento mediano | p25 | p75 |
| --- | --- | --- | --- | --- |
| 1 a 6 | 358 | −0,4 % | −10,1 % | +6,4 % |
| 7 a 12 | 420 | +0,5 % | −5,2 % | +11,4 % |
| 13 a 24 | 705 | −1,5 % | −11,5 % | +10,3 % |
| 25 o más | 563 | −0,6 % | −16,4 % | +8,8 % |

**Lectura:** el mercado no pone, en el precio de lista, un descuento medible por esperar. La mediana está en 0 (−0,4 % a −1,5 %
según el tramo, sin pendiente con los meses) y el rango entre cuartiles es de ±10 puntos: lo que separa a una celda de otra
es el proyecto (Macul −11 %, Independencia +11 %, Las Condes +18 %), no la fecha de entrega. **Plusvalía de entrega
implícita en el corte transversal: 0 %, confianza baja** (es un corte entre proyectos distintos, no el mismo depto antes y
después).

**b) Serie de precios.** `scraped_properties_precios` tiene 27.138 filas de 10.423 propiedades nuevas (activas o en
bajas), pero **ninguna propiedad nueva tiene 90 días de historia, y menos 180**: las unidades se escribieron entre el 03-ago y
el 01-oct (largo máximo de la serie: 59 días; mediana 0) y desde el 02-oct nadie les escribe precio (0.c). Las 337 unidades
con más de una vista bajaron **3,2 % en mediana** en esas semanas (p25 −3,9 %, p75 +3,5 %): es un ajuste de lista de agosto a
septiembre, no plusvalía. Las 10 filas de proyecto con cambio («desde»): +0,3 %. El sesgo del «desde» (sube cuando se venden
las baratas) no alcanza a pesar porque no hay serie. **No medible.**

**c) Mismo proyecto antes y después de la entrega.** La base guarda solo la `fecha_entrega` vigente (la escribe el cruce
cada noche) y la serie de precios no lleva la entrega: no hay forma de ver un proyecto que pasó de futura a inmediata con
precios de los dos lados. **No medible.** Lo que haría falta: guardar la fecha de entrega con cada vista de precio.

### 3.3 Qué tienen las tablas de plusvalía y qué g sostienen

| tabla | fuente | qué mide | cobertura | sirve para g |
| --- | --- | --- | --- | --- |
| `plusvalia_fuentes_raw` (207 filas) | GfK / NielsenIQ | precio de oferta de deptos nuevos, UF/m², promedio anual o trimestral, por comuna | 31 comunas; 15 con serie 2015→2025-Q1, el resto solo 2024 y 2025-Q1; más «PROMEDIO GS» 2015→2025-Q4 | sí: crecimiento real (UF) de 10 y de 5 años por comuna, con sesgo de mezcla (cambia qué se vende) |
| `plusvalia_fuentes_raw` (180 filas) | INCOIN (Tinsa) | UF/m² trimestral 2024-Q4→2025-Q4 por comuna; en oriente y periferia mezcla casas y deptos | 36 comunas | solo el último año |
| `plusvalia_fuentes_raw` (77 filas) | Arenas & Cayo, Colliers, CChC | UF por depto 2014-2024 (27 comunas), oficinas y resúmenes | referencia | no (unidad depto, no m²) |
| `plusvalia_indices_raw` (680 filas) | CLAPES UC – RealData | índice hedónico de transacciones del CBR en UF (variación real), trimestral 2007-Q1→2023-Q4, deptos y casas, RM y 4 zonas | zonas, no comunas | sí: la tasa real larga de transacciones (no de lista) |
| `plusvalia_estimado` (25 filas) | GfK + INCOIN | nivel UF/m² de cierre 2025 por comuna (no una tasa) | 25 comunas | no, es nivel |

Crecimiento real anual del precio (UF): GfK precio de oferta deptos nuevos, INCOIN último año, CLAPES por zona (zona
asignada en este goal: CLAPES publica RM y cuatro zonas sin lista de comunas).

| comuna | GfK 10 años (2015→2025-Q1) | GfK 5 años (2020→2025-Q1) | INCOIN 2024-Q4→2025-Q4 | CLAPES zona 2007→2023 |
| --- | --- | --- | --- | --- |
| Santiago | 4,3 % | 2,2 % | −1,9 % | Centro-Norte 3,9 % |
| Ñuñoa | 3,0 % | 0,9 % | −4,5 % (mezcla casas) | Oriente 4,8 % |
| Macul | 4,3 % | 3,7 % | −0,2 % (mezcla) | Sur-Oriente 4,0 % |
| La Florida | 5,0 % | 3,5 % | +2,9 % (mezcla) | Sur-Oriente 4,0 % |
| Providencia | 2,5 % | 1,5 % | +0,8 % (mezcla) | Oriente 4,8 % |
| Las Condes | 3,0 % | 1,6 % | +1,3 % (mezcla) | Oriente 4,8 % |
| Vitacura | 3,3 % | 2,1 % | +2,7 % (mezcla) | Oriente 4,8 % |
| Lo Barnechea | 2,1 % | 0,4 % | 0,0 % (mezcla) | Oriente 4,8 % |
| La Reina | 2,8 % | 1,3 % | +5,6 % (mezcla) | Oriente 4,8 % |
| Estación Central | 2,8 % | 1,0 % | −2,3 % | Centro-Norte 3,9 % |
| San Miguel | 4,3 % | 3,5 % | −2,8 % | Sur-Poniente 3,9 % |
| Maipú | 3,2 % | 0,6 % | +0,7 % (mezcla) | Sur-Poniente 3,9 % |
| Puente Alto | 4,3 % | 2,1 % | −7,3 % (mezcla) | Sur-Oriente 4,0 % |
| Quilicura | 6,0 % | 1,7 % | +0,9 % (mezcla) | Centro-Norte 3,9 % |
| Conchalí | 8,9 % | 4,9 % | +1,7 % | Centro-Norte 3,9 % |
| Independencia, Recoleta, La Cisterna, Cerrillos, Pudahuel, Peñalolén, Quinta Normal, Huechuraba, Renca, San Joaquín | sin serie larga (GfK solo 2024-2025) | — | −2,2 % a +17,6 % | zona 3,9–4,8 % |
| **Gran Santiago** | **2,8 % (GfK, 2015→2025-Q4)** | | | **RM deptos 4,4 %** |

**Lectura para la g de la FASE 4:** la tasa larga de transacciones (CLAPES, 2007-2023) es 4,4 % real al año en la RM y 3,9 a
4,8 % por zona; la de precios de lista de obra nueva (GfK) es 2,8 % en 10 años y cae a 0,4–3,7 % en los últimos 5; el último
año (INCOIN) está en torno a 0. **El 3 % del motor es defendible como tasa larga; g = 1 % es lo que dicen los últimos 5 años de
lista, y g = 0 % el último año.** Ninguna fuente da plusvalía de entrega ni descuento por edad.

### 3.4 Tabla por comuna

Plusvalía de entrega implícita (corte transversal, mediana de las celdas de la comuna con n ≥ 10 por lado), serie de
precios, mismo proyecto, y crecimiento histórico; confianza por n (alta: ≥ 500 unidades y ≥ 3 celdas; media: ≥ 150 y 2
celdas; baja: menos, o un solo camino).

| comuna | corte transversal (n unidades, celdas) | serie de precios | mismo proyecto | GfK 10 / 5 años | CLAPES zona | confianza |
| --- | --- | --- | --- | --- | --- | --- |
| Santiago | −6,1 % (1.742, 3) | no medible | no medible | 4,3 % / 2,2 % | 3,9 % | media (el corte es entre proyectos) |
| Ñuñoa | −1,9 % (996, 3) | no medible | no medible | 3,0 % / 0,9 % | 4,8 % | media |
| Macul | −10,6 % (738, 3) | no medible | no medible | 4,3 % / 3,7 % | 4,0 % | media |
| La Florida | −0,9 % (614, 3) | no medible | no medible | 5,0 % / 3,5 % | 4,0 % | media |
| Providencia | +1,7 % (489, 3) | no medible | no medible | 2,5 % / 1,5 % | 4,8 % | media |
| Independencia | +11,4 % (408, 3) | no medible | no medible | — | 3,9 % | baja (futura más cara: proyectos distintos) |
| Las Condes | +17,7 % (176, 3) | no medible | no medible | 3,0 % / 1,6 % | 4,8 % | baja |
| Peñalolén | +22,1 % (143, 1) | no medible | no medible | — | 4,8 % | baja |
| Vitacura | −5,8 % (141, 2) | no medible | no medible | 3,3 % / 2,1 % | 4,8 % | baja |
| Estación Central | −3,5 % (120, 2) | no medible | no medible | 2,8 % / 1,0 % | 3,9 % | baja |
| Pudahuel | +5,9 % (87, 2) | no medible | no medible | — | 3,9 % | baja |
| resto (15 comunas) | sin celda con n ≥ 10 por lado | no medible | no medible | tabla 3.3 | 3,9–4,8 % | sin número |
| **Gran Santiago** | **−0,6 % (2.046 futuras contra su celda)** | −3,2 % en 2 meses (n 337, no es plusvalía) | no medible | 2,8 % / — | 4,4 % | **plusvalía de entrega: 0 %, baja** |

**Lo que entra a la FASE 4 desde acá:** plusvalía de entrega 0 % (se corre sin ese efecto y queda marcado); descuento por edad
en arriendo y precio: sin número (se corre sin ese efecto y queda marcado); g: 3 % (motor), 1 % y 0 %, las tres sostenidas por
las fuentes de 3.3.

---

## Para el goal de los defectos (fuera de este goal; se arreglan juntos, en este orden)

1. **El m² con dos decimales.** `respuestasDeAviso` escribe el m² con dos decimales y `DEC.superficie` admite uno: 1.515
   nuevos y 217 usados activos se evaluaron con superficie 0 (sin gastos comunes, mediana, cap, mantención ni CapEx). El
   arreglo (m² a un decimal en `respuestasDeAviso`, o `DEC.superficie = 2`) mueve 4 nuevos y 8 usados de Comprar a Ajustar.
2. **El `scraped_at` que el cruce no marca.** La pasada de unidades quedó congelada el 02-oct y el cruce con la ficha nueva
   solo escribe `seen_pass_id`, `is_active`, entrega y precio estimado: 2.061 unidades tienen `scraped_at` del 29-sep al 01-oct
   y toda lectura filtra 7 días. Marcar `scraped_at` (o filtrar por `seen_pass_id`) devuelve las unidades a Explorar, /deptos,
   el semanal y el cron.
3. **Los 2.015 nuevos sin reevaluar desde octubre.** `avisosEvaluables` solo toma lo visto en 7 días por `scraped_at`, así que
   la evaluación de los nuevos quedó con la tasa 4,04 % y la UF del 05 y 06-oct. Con el punto 2 el cron los retoma solo
   (`avisosDeOtraVersion` al cambiar `VERSION_EVALUACION`, o por precio); hoy daría 3 Comprar menos.
4. **Los 403 nunca cruzados (392 unidades y 11 filas de proyecto de 59 proyectos, evaluados).** El cruce no leyó esos
   proyectos (sin ficha legible o fuera de la lista del pase): están activos y evaluados sin que nadie confirme que siguen
   disponibles. Hay que cruzarlos o darlos de baja por edad de `seen_pass_id`.
5. **Las 5.362 unidades reactivadas sin `scraped_at`.** En algún cruce no aparecieron en la lista, quedaron inactivas,
   `cerrar_bajas` las sacó de `avisos_evaluados` y un cruce posterior las volvió a activar: hoy son unidades disponibles según
   la ficha, fuera de Explorar y del semanal (el universo de nuevos evaluado es el 27 % del activo). El cruce que reactiva
   tiene que marcar `scraped_at` y el cron tiene que retomarlas (una baja no debería ser permanente si la unidad vuelve).
6. **Las 211 unidades y filas viejas que siguen activas** (113 proyectos, creadas entre marzo y agosto, nunca cruzadas, sin
   precio estimado): o se recruzan o se dan de baja; hoy la referencia de la zona y la mediana nueva las cuentan.
7. **Los 99 usados que cambian solo por UF y tasa.** 6.702 usados Comprar hoy son 6.603 con la UF y la tasa de hoy; si la pasada
   reevaluara todo cuando cambia la tasa del mes (hoy solo cambia por precio o por versión del motor), el número de
   «convienen» se movería cada mes con la tasa, que es lo que la persona ve en el banco. Costo: ~24 mil evaluaciones a 0,9 s
   con concurrencia 3 (dos horas), una vez al mes.
8. **El cruce no crea filas de unidades ni de proyectos nuevos desde el 02-oct.** Una unidad que la ficha lista y la base no
   tiene se cuenta como «nueva sin precio» y no entra; un proyecto nuevo entra solo como fila del listado. El stock evaluado
   envejece: todas las unidades conocidas son anteriores al 29-sep.
9. **La pasada evalúa con el precio real de septiembre, no con el rango de hoy.** `precio` es el del GraphQL viejo (29-sep al
   01-oct); el cruce actualiza `precio_estimado_uf` cada noche (|error| mediano 3,5 %) pero la pasada no lo lee hasta los 90
   días, y solo para la mediana. Decidir qué precio manda cuando el real tiene más de N días.
10. **Los 60 proyectos sin unidades, evaluados al «desde».** La fila del proyecto se evalúa con el precio «desde» y la
    tipología del listado; detrás puede haber de 6 a 300 unidades (4376614 en Estación Central lista 306). Cerrarlo cuesta
    120 GET (2 por proyecto) y que el cruce cree las unidades.
11. **Los 102 proyectos sin dato de entrega** (de 536): la pasada los trata como entrega inmediata (sin cuotas, arriendo desde
    el mes 1). La ficha sí trae «Estado del proyecto» y «Fecha de entrega» en 9 de 12 leídas: el cruce ya escribe
    `fecha_entrega` cuando la trae; los 102 son fichas sin características o proyectos nunca cruzados.

12. **El Golden Set no tiene un caso Buscar otra de renta larga.** 5dc42a82 es de renta corta; para la sanidad de la FASE 4
    se usó f3522eac (Santiago, usado de 15 años, 12-oct-2026, Buscar otra por sobreprecio comunal con flujo negativo). Agregar
    un Buscar otra de renta larga al Golden (o fijar f3522eac) cuando se toque el runner.

---

## Punto 1 del STOP 3 · La curva por edad, con lecturas de fichas de usados

### 1.1 Las lecturas

Por el mismo camino del lector del informe (`leerFicha` + `bajarFicha`: la ficha vieja y, si redirige, la nueva; sin
reintentos; 8 s de tope), con almacén local (nada en `fichas_leidas`, `anios_edificio` ni `publicacion_avisos`; los años en
`out/9-fichas-usados.json`), de a una con pausa al azar de 5 a 10 s, y la regla de corte de tres respuestas finales seguidas
que no sean 200 (`9-fichas-usados.ts`).

Antes de leer, con la regla del informe (año de la ficha del aviso o compartido por el edificio en `anios_edificio`), cuatro
de las seis comunas ya pasaban de 30: Ñuñoa 36, Estación Central 30, San Miguel 48, Vitacura 36; faltaban Providencia (28)
y La Florida (22). Se priorizaron edificios sin año conocido.

| | n |
| --- | --- |
| Chequeos | 100 (el corte saltó en el 100: tres despublicados seguidos, 404) |
| GET | 200 |
| 200 (publicado) | 71 |
| Con año en la ficha | 20 (28 % de los 200; la tasa histórica es 29,5 %) |
| Despublicados (404) | 29 |
| Bloqueos (403/429) | **0** |
| Error o tiempo | 0 |
| Ritmo | 17 s por chequeo (100 en 28 min, 200 GET en la hora sin bloqueo) |

| comuna | usados activos | con año antes | chequeos | 200 | con año leído | con año ahora |
| --- | --- | --- | --- | --- | --- | --- |
| Ñuñoa | 2.122 | 36 | 10 | 7 | 0 | 36 |
| Estación Central | 1.610 | 30 | 10 | 7 | 3 | 41 |
| San Miguel | 1.282 | 48 | 10 | 6 | 5 | 58 |
| Providencia | 1.245 | 29 | 15 | 12 | 4 | 36 |
| Vitacura | 1.189 | 36 | 9 | 6 | 0 | 36 |
| La Florida | 957 | 22 | 46 | 33 | 8 | 44 |

Las seis comunas quedaron con n ≥ 30 (por ficha o edificio). El corte llegó por tres 404 seguidos, no por bloqueo: con 200
GET en una hora desde esta IP la fuente no bloqueó (el tope de producción es 30 por hora). Para el goal de arreglos: los 20
años leídos y los 29 despublicados detectados no están en la base.

### 1.2 La curva por comuna y tramo de edad

Usados activos limpios con año: **587 de 22.288** (238 por ficha, 328 por edificio, 21 por lectura local). UF/m² es el
precio publicado; el arriendo por m² es el **sugerido por radio** con que se evaluó el aviso, no el del edificio (la base no
lo tiene), así que mide lo que el motor le pone y sale plano (9.500 a 10.600 $/m² en todos los tramos): **no sirve para un
descuento de arriendo por edad.** Celdas con n < 15 marcadas ⚠.

| comuna | tramo | n | UF/m² mediana | p25 | p75 |
| --- | --- | --- | --- | --- | --- |
| Gran Santiago (mezcla comunas) | 0-2 | 6 ⚠ | 105,8 | 95,9 | 116,8 |
| | 3-5 | 38 | 79,8 | 65,4 | 93,4 |
| | 6-10 | 210 | 52,4 | 44,1 | 63,3 |
| | 11-20 | 167 | 50,2 | 42,3 | 58,7 |
| | 21-30 | 59 | 56,3 | 43,2 | 65,3 |
| | 31+ | 107 | 59,1 | 48,1 | 71,2 |
| Santiago | 3-5 | 3 ⚠ | 73,4 | 67,6 | 76,5 |
| | 6-10 | 38 | 57,2 | 47,5 | 61,7 |
| | 11-20 | 85 | 48,6 | 42,6 | 56,3 |
| | 21-30 | 23 | 44,4 | 39,6 | 53,8 |
| | 31+ | 10 ⚠ | 34,6 | 32,4 | 36,6 |
| San Miguel | 6-10 | 44 | 47,6 | 41,2 | 57,1 |
| | 11-20 | 9 ⚠ | 53,3 | 50,2 | 56,1 |
| Las Condes | 21-30 | 9 ⚠ | 66,7 | 65,3 | 78,6 |
| | 31+ | 32 | 67,1 | 58,4 | 78,3 |
| La Florida | 3-5 | 15 | 74,3 | 67,8 | 83,2 |
| | 6-10 | 26 | 57,9 | 51,1 | 73,1 |
| Estación Central | 6-10 | 32 | 45,2 | 39,8 | 51,4 |
| | 11-20 | 9 ⚠ | 47,4 | 39,3 | 52,8 |
| Providencia | 3-5 | 4 ⚠ | 106,3 | 98,5 | 116,0 |
| | 31+ | 27 | 61,7 | 55,2 | 71,9 |
| Ñuñoa | 6-10 | 21 | 87,9 | 68,8 | 93,6 |
| | 31+ | 7 ⚠ | 55,0 | 45,5 | 58,6 |
| Vitacura | 0-2 | 6 ⚠ | 105,8 | 95,9 | 116,8 |
| | 3-5 | 5 ⚠ | 97,1 | 80,4 | 110,4 |
| | 31+ | 14 ⚠ | 73,6 | 65,7 | 84,9 |
| Independencia | 6-10 | 25 | 47,0 | 42,7 | 51,5 |
| Lo Barnechea | 11-20 | 11 ⚠ | 72,6 | 67,6 | 84,6 |
| La Cisterna | 6-10 | 16 | 51,8 | 47,3 | 60,1 |
| Recoleta | 11-20 | 19 | 50,0 | 41,3 | 53,8 |

(Las celdas que no aparecen tienen n = 0; la tabla entera, con las 13 comunas y los 6 tramos, está en `out/10-curva-edad.stdout`.)

**0-2 contra 3-5 y contra 21-30:** en ninguna comuna hay 0-2 con n ≥ 15 (los 6 de 0-2 son de Vitacura). La única comuna con
tres tramos de n ≥ 15 es **Santiago**: 6-10 años 57,2 UF/m², 11-20 años 48,6 (**−15 %**), 21-30 años 44,4 (**−22 %**). La Florida
tiene 3-5 (74,3, n 15) contra 6-10 (57,9, n 26): −22 %. La curva de Gran Santiago no es una curva: el 31+ (59,1) está sobre
el 11-20 (50,2) porque los edificios viejos están en Providencia, Las Condes y Vitacura y los de 6 a 20 años en Santiago,
Estación Central e Independencia (composición, no edad).

**Lo que se puede llevar a la FASE 4 (fila opcional):** un descuento por edad en el PRECIO, solo de Santiago (n 38 / 85 / 23):
−15 % al pasar de 6-10 a 11-20 años y −22 % de 6-10 a 21-30. No hay número para 0-2 ni para el arriendo. Si entra, lo honesto
es una sensibilidad única para todos, marcada, y no un parámetro por comuna.

---

## FASE 4 · STOP 4a: la tabla de supuestos (antes de correr nada)

La TIR es la del informe: `runAnalysis` → `calcProjections` (20 años, en pesos de hoy) → `calcExitScenario` a 10 años
(`HORIZONTE_SALIDA_ANIOS`), con `calcIRRPct` del motor sobre el vector anual. No se construye otra TIR: a cada versión se le
cambian los supuestos de entrada (g, tasa, precio, cuotas) y lo que la función ya expone (`plusvaliaAnual`).

### Qué hace hoy esa función (sin tocar)

| supuesto | valor hoy | de dónde sale |
| --- | --- | --- |
| Horizonte | 10 años desde hoy, para todos (entrega futura incluida) | `HORIZONTE_SALIDA_ANIOS = 10`, `calcExitScenario` |
| Momento cero | pie (o su primera cuota) + escrituración + puesta a punto + corretaje del comprador | `calcInversionInicialCLP`; `flujos[0] = −(inversiónInicial − (pie − cuota))` |
| Entrega futura: meses sin arriendo ni dividendo | desde hoy hasta `fechaEntrega` (mes y año de la ficha) | `calcMesesHastaEntrega`; en esos meses flujo 0 y saldo del crédito 0 |
| Entrega futura: cuotas del pie | una por mes desde la promesa hasta la entrega, la primera al firmar; cada cuota se descuenta en el año en que se paga | `cuotasPorDefecto`, `cuotasDelAnio` (obra-nueva.ts), `calcExitScenario:1121` |
| Crédito | parte en la entrega por el saldo (precio − pie), cuota fija en UF, 30 años, tasa de config | `saldoCredito(creditoCLP, tasa, plazo, mesesCredito)` |
| Arriendo | +3,5 % nominal = **+0,49 % real** al año, desde el año 1 (también durante la construcción) | `ARRIENDO_REAL = crecimientoReal(0,035)` |
| Precio del depto | **+3 % real** al año desde el año 0, también durante la construcción | `PLUSVALIA_PROYECCION_ANUAL`, `valorPropiedad = precio × 1,03^año` |
| Gastos comunes y contribuciones | 0 % real (planos en UF) | `GGCC_REAL = crecimientoReal(0,03) = 0` |
| Mantención | UF/m² útil/año por edad: 0,02 (≤ 2 años), 0,05 (≤ 7), 0,09 (≤ 15), 0,14 (≤ 25), 0,18 (26+), con techo del 6 % del arriendo; la edad corre desde la entrega (nuevo) o desde la puesta a punto (usado) | `MANTENCION_UF_M2_ANIO`, `MANTENCION_TECHO_ARRIENDO_PCT` (modelo-costos.ts v3) |
| Venta al año 10 | valor del año 10 menos el sobreprecio de hoy (plano, si la mediana lo marca) menos 2 % de comisión, menos el saldo del crédito | `COMISION_VENTA = 0,02`, `sobreprecioDeHoy` |
| TIR | anual, sobre [momento cero, flujo año 1 − cuotas, …, flujo año 10 − cuotas + lo que queda al vender] | `calcIRRPct(flujos)` |
| Ganancia y múltiplo (4.1) | ganancia = lo que queda al vender − todo lo puesto (inversión inicial + flujos mensuales negativos acumulados); múltiplo = recibido ÷ puesto | `gananciaSobreTotal`, `multiplicadorCapital` (ya los emite el motor) |

### Los costos que ya usa el motor (sin tocar)

| costo | valor | de dónde sale |
| --- | --- | --- |
| Escrituración (notaría, CBR, timbres, tasación) | 2 % del precio, al momento cero | `GASTOS_CIERRE_PCT = 0,02` |
| Corretaje del comprador | 2 % del precio en usados; 0 en nuevos (va en el precio) | `CORRETAJE_COMPRA_PCT = 0,02`, `incluyeCorretajeInicial = usado` |
| Puesta a punto (CapEx del día 1) | UF/m² útil por edad: 0 (≤ 2 años), 0,2–0,4 (≤ 7), 0,5–0,9 (≤ 15), 1,0–1,6 (≤ 25), 1,8–2,6 (26+); el punto medio, redondeado a 5 UF; nuevo 0 | `PUESTA_A_PUNTO_UF_M2` (capex-puesta-a-punto.ts v3) |
| Contribuciones | avalúo fiscal = 70 % del precio; exención general $61,7 M; 0,893 % anual hasta $220,4 M de avalúo y 1,042 % (+0,025 %) sobre eso; **DFL2**: exime el 50 % del avalúo durante 20 años (≤ 70 m²), 15 (≤ 100) o 10 (≤ 140), contados desde la recepción (nuevo: desde la entrega; usado: su edad) | `estimarContribuciones`, `duracionDfl2` (contribuciones.ts) |
| Vacancia | 5 % = 0,6 meses al año, constante: arriendo y gastos comunes prorrateados | `vacanciaMeses = 5 % × 12 / 100` (wizard por defecto), `calcFlujoDesglose` |
| Corretaje de arriendo y recambio | medio mes de arriendo cada 2 años, cada uno (1/24 del arriendo al mes) | `corretajeProrrata`, `recambio` |
| Administración | 0 (sin administrador) | `usaAdministrador = false` |
| Gastos comunes | el estimador por comuna: 2.200 / 1.800 / 1.400 $/m²; planos en UF; solo pesan en la vacancia | `getGgccFallback`, `ggccVacancia` |

### Lo que cambia en cada versión

| versión | precio del depto (g) | arriendo | respaldo (FASE 3.3) | cómo se corre |
| --- | --- | --- | --- | --- |
| **motor de hoy** | +3 % real | +0,49 % real | CLAPES RM deptos 4,4 % (2007–2023) y GfK 10 años 2,8 % | `runAnalysis` tal cual |
| **g = 1 %** | +1 % real | **+1 % real** | GfK últimos 5 años (0,4 a 3,7 % por comuna; Gran Santiago ~1,5 %) | `calcProjections({plusvaliaAnual: 0,01})` + arriendo reescalado + `calcExitScenario` |
| **g = 0 %** | 0 % | **0 %** | INCOIN último año (−2 a +3 %, cerca de 0) | `calcProjections({plusvaliaAnual: 0})` + arriendo reescalado + `calcExitScenario` |

El reescalado del arriendo: `calcProjections` tiene el +0,49 % como constante del módulo, no como parámetro. En las dos
versiones nuevas se toma la proyección del motor y se corrige el arriendo de cada año por ((1 + g) / (1 + 0,49 %))^(año − 1),
y el flujo anual por la diferencia de arriendo × (1 − vacancia/12 − 1/24 − 1/24): los costos que van con el arriendo
(vacancia, corretaje, recambio) se mueven con él; dividendo, gastos comunes, contribuciones y mantención quedan. Lo demás
(venta, saldo, cuotas, TIR) lo calcula `calcExitScenario` del motor sobre esa proyección. Es cambiar un supuesto, no otra TIR.

### Lo que entra desde las fases anteriores

| supuesto | valor | de dónde sale / marca |
| --- | --- | --- |
| Universo | 5.599 nuevos limpios (base de referencia del universo completo, 79 Comprar) y 21.191 usados limpios (0b, 6.595 Comprar); pie 20 %, 30 años; UF 41.274; tasa 4,07 % | punto 2 del STOP 2; 0b |
| Los 16 Comprar reactivados sin fecha de entrega | inmediata, marcados y reportados aparte en la celda central | punto 2 del STOP 3 |
| Descuento de preventa | **0 %**, marcado «foto del mercado actual» (corte transversal: −0,4 a −1,5 % sin pendiente) | FASE 3.2a |
| Plusvalía durante la construcción (4.1, solo entrega futura, informativa) | precio congelado hoy × ((1 + g)^(meses/12) − 1), en UF, con g = 1 % y 3 % | FASE 3.3; la TIR del motor ya la incluye (precio crece desde el año 0) |
| **Edad (fila opcional, tú decides si entra)** | el precio de venta al año 10 con un descuento por edad: **−15 %** (el depto cumple 10 años: de 6-10 a 11-20, Santiago, n 38 / 85); sensibilidad única para todos, marcada. En arriendo no hay número (la base trae el arriendo sugerido, no el del edificio). Sin 0-2 ni 3-5 con n ≥ 15 en ninguna comuna | punto 1.2: la única comuna con tres tramos de n ≥ 15 |
| Premio del nuevo | 3 % parejo sobre el arriendo sugerido | FASE 1 (decisión) |

### Palancas y sensibilidades (4.2 a 4.4)

| palanca | cómo se corre | elegibilidad |
| --- | --- | --- |
| Negociar 5 % / 10 % | precio × 0,95 / 0,90 en la fila, misma mediana comunal, todo lo demás igual (`evaluarConMotor`) | todos los nuevos |
| Subsidio Ley 21.836 | tasa del crédito = tasa de mercado − 0,6 puntos (`tasaModo = "preaprobada"`, `tasaMercado` queda en 4,07): el motor marca `subsidioTasa.aplicado` | nuevo (primera venta) **y** precio ≤ UF 6.000 **y** entrega inmediata o fecha de entrega antes de mayo de 2028 (el crédito se firma en la entrega); el motor hoy no mira la entrega, se agrega acá |
| Subsidio + Negociar 10 % | las dos juntas | la del subsidio, sobre el precio negociado |
| Todo el pie a la entrega (sensibilidad) | el mismo vector de flujos del motor con la cuota única del pie movida del momento cero al año de la entrega; `calcIRRPct` del motor sobre ese vector | solo entrega futura |

### La grilla (4.3)

| regla | definición |
| --- | --- |
| Flujo de operación | `metrics.flujoNetoMensual` del motor: el mes con arrendatario después de la entrega (sin las cuotas del pie) |
| TIR | la de la versión g = 0 % en la grilla; en la celda central también g = 1 % y la del motor |
| Comprar | GATE 1 del motor apagado (sin CoC severo, break-even imposible, sobreprecio con flujo ni flujo severo) **y** flujo ≥ tolerancia **y** TIR ≥ mínima |
| Ajusta supuestos | lo demás sin GATE 1 (un Comprar del motor que no pasa la regla baja a Ajustar) |
| Buscar otra | GATE 1 activo (igual que hoy) |
| Celdas | TIR mínima 4, 5, 6 y 7 % × flujo mínimo 0, −100.000, −200.000 y −300.000; celda central 5 % y −200.000 |

### Sanidad con el Golden Set (4.5)

| análisis | qué es | cómo se corre |
| --- | --- | --- |
| 7710a017 | renta larga, Providencia, 2D 60 m², UF 5.500, 4 años, pie 20 %, 25 años, tasa 4,5 % (abril-2026), Ajustar 66, TIR 6,88 | `runAnalysis` con su `input_data` y su mediana guardada; las tres g; regla de la celda central |
| 17b4e10d | renta larga, Ñuñoa, nuevo 2D 80 m², UF 4.000, pie 20 %, 30 años, tasa 3,4 % (sept-2026), Comprar 79, TIR 13,36 | igual |
| 5dc42a82 | **renta corta** (short-term), Santiago, 1D, pie 10 %, 25 años, tasa 3,4 %, Buscar otra | no tiene arriendo mensual ni TIR de renta larga: se corre con la ocupación y tarifa de su `input_data` por el motor STR, o se cambia por otro Buscar otra de renta larga; **pregunta** |

**Preguntas antes de correr:**
1. ¿La fila de edad entra? La única cifra que aguanta es la de Santiago (−15 % en el precio de venta al año 10); no hay número para el arriendo ni por comuna.
2. 5dc42a82 es un análisis de renta corta: ¿lo corro con el motor STR (otra TIR) o lo reemplazas por un Buscar otra de renta larga?
3. En la grilla, un Comprar del motor que no pasa la regla baja a Ajustar (no a Buscar otra). ¿Correcto?

---

## FASE 4 · La TIR en UF a 10 años como segundo criterio (resultados)

Corrida (`11-fase4.ts`, 37 minutos, 2.481 celdas de usados consultadas en vivo, nada escrito): 26.788 filas con corrida
completa, **5.597 nuevos limpios y 21.191 usados**, UF 41.274, tasa 4,07 %, pie 20 %, 30 años. Control: el vector anual
reconstruido reproduce la TIR del motor en las 1.246 unidades con cuotas (1.246 de 1.246). Sin celda de usados para la salida a
valor usado: 203 nuevos y 636 usados (m² o tipología sin 15 usados en la comuna). Los Comprar reactivados sin fecha de
entrega son 19 en esta corrida (16 en la del punto 2: tres cambian con la evaluación de hoy); van aparte en la celda central.

Gates en la base: nuevos con sobreprecio comunal con flujo 901, break-even imposible 1.639, flujo severo 568, CoC severo 0;
usados 8.486 / 1.558 / 690 / 0. **En la grilla siguen** CoC severo y sobreprecio comunal con flujo (las señales graves);
**la tolerancia de flujo reemplaza** a break-even imposible, flujo severo y al GATE 2; el GATE 3 tampoco corre.

### 4.1 TIR, ganancia y múltiplo por versión

| universo | versión | n con TIR | TIR mediana | p25 | p75 | ganancia UF mediana | múltiplo mediano | flujo de operación mediano |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| nuevos | motor de hoy (3 % precio, 0,49 % arriendo) | 5.597 | 7,4 % | 5,8 | 8,5 | 1.062 | 1,75 | −$238.266 |
| nuevos inmediata | motor | 4.019 | 7,3 % | 5,7 | 8,4 | 1.062 | 1,76 | −$224.612 |
| nuevos futura | motor | 1.578 | 7,6 % | 6,1 | 9,0 | 1.062 | 1,73 | −$269.334 |
| usados | motor | 21.185 | 7,5 % | 3,9 | 10,2 | 747 | 1,93 | −$69.733 |
| nuevos | g = 1 % | 5.595 | 2,0 % | −0,5 | 3,2 | 230 | 1,16 | |
| usados | g = 1 % | 20.924 | 2,6 % | −2,7 | 6,1 | 215 | 1,24 | |
| nuevos | g = 0 % | 5.577 | −2,1 % | −5,4 | −0,7 | −232 | 0,86 | |
| usados | g = 0 % | 20.082 | −1,0 % | −7,6 | 2,9 | −153 | 0,87 | |
| nuevos | salida a valor usado, g = 0 % | 3.181 | −17,6 % | −31,0 | −8,1 | −1.427 | 0,11 | |
| usados | salida a valor usado, g = 0 % | 19.449 | −0,9 % | −8,0 | 4,8 | −136 | 0,87 | |
| nuevos | salida a valor usado, g = 1 % | 4.171 | −12,0 % | −20,8 | −4,4 | −1.068 | 0,31 | |
| usados | salida a valor usado, g = 1 % | 20.084 | 2,6 % | −3,5 | 7,6 | 207 | 1,23 | |
| nuevos | edad: g = 0 %, venta × 0,85 | 5.301 | −10,3 % | −15,5 | −8,0 | −863 | 0,48 | |
| usados | edad: g = 0 %, venta × 0,85 | 16.548 | −6,1 % | −13,6 | −1,7 | −723 | 0,44 | |

(«n con TIR» baja cuando el vector no tiene raíz: con salida a valor usado y g = 0 %, 2.416 nuevos pierden plata en todos los
años y la TIR no existe.)

**Lectura:** con el motor de hoy la TIR de un nuevo (7,4 %) es igual a la de un usado (7,5 %), porque el 3 % de plusvalía se
compone sobre un precio 36 % más alto por m² y compensa el flujo: el caso del nuevo es entero la plusvalía. Con g = 1 % la TIR
mediana cae a 2 % y con g = 0 % a −2 %; y si el nuevo se vende al año 10 a lo que vale hoy un usado de su comuna y tipología,
la TIR es −18 % (g 0 %) o −12 % (g 1 %): el precio de salida del motor (precio nuevo × 1,03^10 − sobreprecio) está **47 % por
encima** de la mediana del usado de hoy × m² (Gran Santiago, mediana de 5.394 nuevos; de −33 % en Cerrillos a −61 % en
Pudahuel), es decir, **el motor supone que un nuevo a los 10 años vale 1,9 veces lo que hoy vale un usado equivalente**.
Para los usados tampoco coincide (salida del motor UF 3.651 contra valor usado UF 2.726, −27 %): la regla de salida a valor
usado se aplicó a todos por igual.

**Entrega futura (1.246 unidades con cuotas):** cuota mensual mediana $1.798.243, 19 meses de cuotas en mediana (máximo
43), máximo acumulado antes de la entrega UF 881 en mediana; plusvalía durante la construcción, informativa, UF 64 (g 1 %) y
UF 194 (g 3 %) en mediana; con todo el pie a la entrega la TIR g 0 % pasa de −3,6 % a −3,9 % (mediana): mover el pie no cambia
el veredicto de casi nadie (28 contra 27 Comprar en la celda central).

### 4.3 La grilla (g = 0 %, salida del motor)

Cada celda: nuevos Comprar (inmediata / futura / sin dato) · usados Comprar · Comprar del motor que dejarían de serlo (de
ellos nuevos) / Ajustar del motor que pasarían a Comprar (de ellos nuevos). Base: 79 nuevos y 6.595 usados Comprar del motor.

| TIR mínima \ flujo mínimo | ≥ $0 | ≥ −$100.000 | ≥ −$200.000 | ≥ −$300.000 |
| --- | --- | --- | --- | --- |
| 4 % | nuevos 41 (33/1/7) · usados 3.630 · −3.005 (38) / +2 (0) | nuevos 62 (44/3/15) · usados 3.630 · −2.986 (19) / +4 (2) | nuevos 63 (45/3/15) · usados 3.630 · −2.985 (18) / +4 (2) | nuevos 63 (45/3/15) · usados 3.630 · −2.985 (18) / +4 (2) |
| 5 % | nuevos 27 (22/0/5) · usados 2.565 · −4.082 (52) / +0 | nuevos 27 · usados 2.565 · −4.082 (52) / +0 | **nuevos 27 (22/0/5) · usados 2.565 · −4.082 (52) / +0** | nuevos 27 · usados 2.565 · −4.082 (52) / +0 |
| 6 % | nuevos 11 (7/0/4) · usados 1.794 · −4.869 (68) / +0 | nuevos 11 · usados 1.794 | nuevos 11 · usados 1.794 | nuevos 11 · usados 1.794 |
| 7 % | nuevos 7 (4/0/3) · usados 1.226 · −5.441 (72) / +0 | nuevos 7 · usados 1.226 | nuevos 7 · usados 1.226 | nuevos 7 · usados 1.226 |

Con g = 0 % la TIR manda y la tolerancia de flujo casi no mueve nada: de 5 % para arriba las columnas son iguales. Los usados
caen de 6.595 Comprar a 2.565 con TIR ≥ 5 % y a 1.226 con 7 %.

### 4.4 La celda central (TIR ≥ 5 %, flujo ≥ −$200.000)

| versión | nuevos Comprar | inmediata | futura | sin dato | de ellos reactivados sin fecha (19) | usados Comprar | −/+ vs motor (todos) | −/+ vs motor (nuevos) | Buscar otra del motor que pasan a Comprar | Comprar que hoy son break-even imposible (nuevos / usados) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| g = 0 % (la de la grilla) | 27 (0,5 %) | 22 | 0 | 5 | 3 | 2.565 | −4.082 / +0 | −52 / +0 | 0 | 0 / 0 |
| g = 1 % | 337 (6,0 %) | 220 | 19 | 98 | 19 | 6.851 | −385 / +899 | −0 / +258 | 0 | 0 / 0 |
| motor de hoy (3 % / 0,49 %) | **2.054 (36,7 %)** | 1.429 | 439 | 186 | 19 | 10.710 | −6 / +5.614 | −0 / +1.559 | 482 | 13 / 0 |
| salida a valor usado, g = 0 % | 38 (0,7 %) | 28 | 1 | 9 | 2 | 4.641 | −2.295 / +300 | −66 / +25 | 0 | 0 / 0 |
| salida a valor usado, g = 1 % | 97 (1,7 %) | 81 | 2 | 14 | 2 | 7.233 | −717 / +1.371 | −54 / +72 | 2 | 0 / 0 |
| edad: g = 0 %, venta × 0,85 (Santiago) | 3 (0,1 %) | 3 | 0 | 0 | 0 | 608 | −6.063 / +0 | −76 / +0 | 0 | 0 / 0 |
| g = 0 %, todo el pie a la entrega | 28 (0,5 %) | 22 | 1 | 5 | 3 | 2.565 | −4.081 / +0 | −51 / +0 | 0 | 0 / 0 |

**Punto 5 (Comprar que hoy caen en break-even imposible):** con g = 0 % y g = 1 %, **ninguno** (nuevos 0, usados 0): un depto
que no se paga solo con la tasa a 0 % tampoco llega a TIR 5 % sin plusvalía. Con el motor de hoy (3 %) entran 13 nuevos y 0
usados por ese camino (y 482 Buscar otra del motor pasan a Comprar, todos por break-even imposible o flujo severo que la
tolerancia ya no castiga). Por comuna no hay tabla porque no hay casos.

**Palancas (nuevos; elegibles al subsidio 3.723 de 5.597: precio ≤ UF 6.000 y entrega inmediata o antes de mayo de 2028):**

| palanca | Comprar del motor | inmediata / futura | regla central g 0 % | inmediata / futura | regla central g 1 % | regla central motor | regla central valor usado g 0 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| base | 79 | 52 / 3 | 27 | 22 / 0 | 337 | 2.054 | 38 |
| Negociar 5 % | 166 | 97 / 6 | 61 | 43 / 3 | 627 | 2.711 | 73 |
| Negociar 10 % | 305 | 190 / 14 | 130 | 85 / 5 | 1.129 | 3.525 | 156 |
| Subsidio 0,6 pp | 149 | 100 / 5 | 88 | 61 / 2 | 816 | 2.677 | 59 |
| Subsidio + Negociar 10 % | 456 | 316 / 21 | 290 | 177 / 9 | 2.007 | 3.595 | 213 |

Negociar 10 % multiplica por 4 los Comprar del motor (79 → 305) y por 5 los de la regla con g = 0 % (27 → 130); el subsidio,
por 2 y por 3; juntos, 456 del motor (8,1 %) y 290 con g = 0 % (5,2 %). Con g = 1 %, subsidio + Negociar 10 % llega a 2.007
(36 %).

**Por comuna, nuevos, celda central:**

| comuna | nuevos | Comprar motor | regla g 0 % | g 1 % | valor usado g 0 % | edad | Negociar 10 % | subsidio | subsidio + Neg. 10 % | usados Comprar regla g 0 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Santiago | 1.206 | 0 | 0 | 12 | 0 | 0 | 0 | 0 | 7 | 840 |
| Ñuñoa | 896 | 5 | 2 | 31 | 25 | 1 | 6 | 6 | 22 | 71 |
| La Florida | 584 | 11 | 3 | 65 | 2 | 0 | 19 | 13 | 53 | 112 |
| Macul | 522 | 3 | 0 | 18 | 1 | 0 | 8 | 4 | 17 | 52 |
| Providencia | 481 | 0 | 0 | 4 | 0 | 0 | 1 | 0 | 1 | 61 |
| Independencia | 342 | 0 | 0 | 9 | 0 | 0 | 1 | 0 | 8 | 215 |
| Las Condes | 217 | 2 | 0 | 9 | 2 | 0 | 9 | 5 | 5 | 185 |
| La Cisterna | 171 | 4 | 1 | 15 | 2 | 0 | 6 | 6 | 14 | 70 |
| Vitacura | 162 | 2 | 1 | 2 | 1 | 0 | 2 | 1 | 1 | 82 |
| Recoleta | 116 | 1 | 0 | 1 | 0 | 0 | 1 | 1 | 1 | 73 |
| Maipú | 116 | 2 | 0 | 25 | 0 | 0 | 4 | 3 | 24 | 104 |
| Pudahuel | 93 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 |
| Puente Alto | 90 | 29 | 10 | 80 | 0 | 0 | 41 | 27 | 87 | 28 |
| Estación Central | 85 | 3 | 1 | 12 | 1 | 0 | 3 | 3 | 9 | 304 |
| Lo Barnechea | 74 | 0 | 0 | 9 | 2 | 0 | 5 | 0 | 0 | 76 |
| Quilicura | 65 | 4 | 2 | 7 | 1 | 1 | 5 | 4 | 7 | 15 |
| Peñalolén | 63 | 1 | 1 | 3 | 1 | 1 | 3 | 1 | 1 | 16 |
| Cerrillos | 61 | 3 | 0 | 12 | 0 | 0 | 3 | 3 | 11 | 9 |
| Conchalí | 59 | 1 | 0 | 1 | 0 | 0 | 1 | 1 | 1 | 22 |
| otras 7 comunas (Huechuraba, San Miguel, Quinta Normal, El Bosque, San Joaquín, Renca, La Reina) | 194 | 8 | 6 | 22 | 0 | 0 | 12 | 10 | 21 | 176 |

Puente Alto es el único lugar donde el nuevo cruza con g = 0 % (10 de 90) y casi entero con g = 1 % (80 de 90): precio UF
37/m² de usado contra UF 47 de nuevo, arriendo parejo. Santiago (1.206 nuevos), Providencia e Independencia no cruzan con
ninguna g ni palanca, salvo subsidio + Negociar 10 % con g = 1 %.

### 4.5 Sanidad con el Golden Set

| análisis | guardado | reproducido hoy (motor) | TIR g 1 % / g 0 % / valor usado g 0 % / edad | regla central |
| --- | --- | --- | --- | --- |
| 7710a017 · Providencia · usado 4 años · pie 20 % · 25 años · 4,5 % (abril-2026) | Ajustar 66 · TIR 6,88 · flujo −$283.194 | Ajustar 64 · TIR 8,58 · flujo −$259.761 (el motor de hoy, pesos de hoy y r3, sobre un informe de abril) | 4,1 / 0,7 / — (sin mediana en el snapshot de abril) / −5,2 | Ajustar en las tres g |
| 17b4e10d · Ñuñoa · nuevo 2D 80 m² · pie 20 % · 30 años · 3,4 % (sept-2026) | Comprar 79 · TIR 13,36 · flujo +$46.295 | Comprar 80 · TIR 13,43 · flujo +$49.232 | 9,5 / 6,3 / 15,8 / 1,2 | Comprar en todas, también a valor usado (su precio UF 50/m² está bajo la mediana del usado, 76) |
| f3522eac · Santiago · usado 15 años · pie 20 % · 25 años · 4,07 % (oct-2026; reemplaza a 5dc42a82, de renta corta) | Buscar otra 59 · TIR 5,74 · flujo −$110.844 | idéntico | −0,2 / −5,2 / −5,1 / −17,8 | Buscar otra en todas: sobreprecio comunal con flujo negativo, señal grave que sigue |

Ninguno cambia de veredicto en la celda central; el nuevo de Ñuñoa es el único que cruza también vendiéndolo a valor de usado.

---

## Lo que la base no puede responder hoy, y qué habría que leer o guardar

| pregunta | por qué no sale | qué haría falta |
| --- | --- | --- |
| Gastos comunes reales (de un aviso o de un edificio) | `scraped_properties.gastos_comunes` está vacío en las 41.038 filas activas; el listado y la ficha pública de obra nueva no los traen | leer la ficha HTML de arriendo (la trae) por el lector actual, con tope; guardar por edificio |
| Premio de arriendo del nuevo por edad real | 81 arriendos con año de edificio; ninguno de 0 a 3 años | el año del edificio en los avisos de arriendo (misma lectura de ficha, compartida por edificio) |
| Curva de precio por edad por comuna | 587 usados con año de 22.288 (2,6 %); solo Santiago tiene tres tramos con n ≥ 15 | guardar los años leídos (hoy 20 quedaron en un archivo local) y seguir leyendo: ~75 lecturas buenas por comuna (2.000 GET) para cinco tramos |
| Plusvalía de entrega del mismo proyecto | la base guarda solo la `fecha_entrega` vigente; la serie de precios no la lleva y no tiene 90 días de historia en nuevos | guardar la fecha de entrega con cada vista de precio y escribir el precio de las unidades cada noche (hoy el cruce no escribe precios) |
| Precio real por unidad de obra nueva, hoy | el precio por unidad quedó congelado el 01-oct (GraphQL retirado); la ficha pública da solo desde/hasta y el estimado tiene |error| mediano 3,5 % | decidir si manda el estimado por m² (el que ya se calcula) y cada cuántos días vence el real |
| Pie en cuotas, bono pie, descuentos, subsidio por proyecto | no están en la ficha pública (0 de 12) | solo con cotización (pide lead) o con otra fuente |
| Cuántas unidades hay detrás de los 60 proyectos sin unidades | la base solo tiene la fila del proyecto (4376614 esconde 306) | 120 GET a `api-ficha` y que el cruce cree filas de unidades |
| Arriendo del edificio (no el sugerido por radio) para un nuevo | los arriendos de la base no saben en qué edificio están (105 de 8.648 con dirección) | geocodificación de arriendos y llave de edificio compartida con las unidades |
| Cap de referencia de celda en comunas con pocos arriendos | 144 nuevos siguen en BDO o nacional por el lado del arriendo (n < 15) | más arriendos (otra fuente) o aceptar el peldaño comuna para el hallazgo |
| Si la pasada reevaluara con la tasa del mes | la evaluación guarda `motor_version` y precio, no la UF ni la tasa (hoy se reconstruyen por la fecha) | guardar UF y tasa en cada fila de `avisos_evaluados` |

---

## Preguntas para Fabrizio antes de diseñar el motor

1. **La g.** El 3 % del motor es defendible como tasa larga (CLAPES 4,4 % real en transacciones 2007-2023), pero con 3 %
   un nuevo y un usado rinden igual (7,4 % contra 7,5 %) y la regla de TIR abriría 2.054 nuevos y 10.710 usados. Con 1 % abre
   337 y 6.851; con 0 %, 27 y 2.565. ¿Qué g (o qué banda, con cuál manda) va al segundo criterio, y es la misma para precio y
   arriendo?
2. **El precio de salida.** El motor vende el nuevo al año 10 a precio nuevo × 1,03^10, que está 47 % sobre el usado
   equivalente de hoy. ¿Un nuevo a los 10 años vale como un usado de su comuna (y entonces el nuevo casi nunca cruza), o
   conserva parte del premio (cuánto)? Es el supuesto que decide el veredicto del nuevo.
3. **La tolerancia de flujo.** De 5 % de TIR para arriba la tolerancia no mueve nada; a 4 % sí (41 contra 63 nuevos). ¿La
   regla es «TIR mínima con un piso de flujo» o «flujo mínimo con una TIR que lo justifique»? Y los gates que hoy
   reemplaza (break-even imposible, flujo severo, GATE 2): ¿salen del todo o quedan como aviso?
4. **El subsidio en la pasada.** Hoy la noche evalúa sin subsidio; 3.723 nuevos son elegibles y con él los Comprar del
   motor pasan de 79 a 149. ¿«Convienen» se cuenta con o sin subsidio para quien califica?
5. **Negociar.** Con 10 % de descuento los nuevos Comprar del motor se multiplican por 4 (79 → 305). ¿El «− Ajustar» de
   Explorar debería mostrar el descuento a Comprar también para nuevos (hoy lo calcula para todos los Ajustar: ya está)?
6. **Los 19 reactivados sin fecha de entrega** que hoy son Comprar como inmediata: ¿se evalúan como inmediata (como hoy) o
   quedan fuera hasta tener entrega?
7. **El descuento por edad** (−15 % en Santiago) deja 3 nuevos Comprar: ¿entra como supuesto del motor, como sensibilidad
   del informe, o se espera a tener la curva (2.000 GET)?
8. **El orden de los arreglos.** ¿Primero los defectos (m², `scraped_at`, reactivadas, reevaluación mensual con la tasa) y
   después el motor, o las dos cosas en un goal?

---

## Anexo: salida y escalón (respuesta al STOP 4, 06-nov-2026)

**Resumen (5 líneas)**
1. Vendido al año 10 como un usado de su radio (el mismo método de comparables del motor, universo usado), un nuevo vale en mediana el **73 % de lo que el motor supone** (p25 64 %, p75 81 %): el escalón por unidad es **UF 1.245 y 29 % del precio pagado** en mediana; el 48 % de los nuevos está más de 30 % sobre su valor como usado (Santiago 38 %, Independencia 38 %, Quilicura 55 %, Ñuñoa 19 %).
2. Con g = 3 % recuperan el precio pagado al año 10 solo **41 %** de los nuevos (Santiago 7,5 %, Ñuñoa 84 %, Puente Alto 67 %); el **g de empate** mediano es **3,5 %** (Santiago 5,0 %, Ñuñoa 2,2 %): 3.306 de 5.587 necesitan más de 3 % real al año solo para no perder.
3. Con esa salida y g = 1 %, la celda central (TIR ≥ 5 %, flujo ≥ −200.000) da **100 nuevos (1,8 %)** y 7.229 usados (contra 337 y 6.851 con la salida del motor); con g = 3 %, **621 nuevos (11,1 %)** y 10.481 usados (contra 2.054 y 10.710). Ninguno viene de break-even imposible. Ninguna TIR mínima de 4 a 8 % deja a los usados donde están (§ 5): la más cercana, g 1 %, flujo ≥ −200.000 y TIR ≥ 6 %, da 6.360 usados (−207, pero cambiando 990 por 783) y 76 nuevos (1,4 %).
4. Para los usados el método coincide con la salida del motor en mediana (cociente 100 %; 67 % de las unidades dentro de ±10 %) pero no unidad por unidad: se aplicó la misma regla a todos. Con g = 1 % se caen 534 de los 6.567 usados Comprar de hoy, casi todos por TIR baja (406 con flujo positivo, 126 con flujo negativo dentro de la tolerancia).
5. La prueba histórica, comuna contra comuna (GfK lista de nuevos 2016-2020 contra reventa de hoy de los edificios de 6 a 10 años), dice lo mismo desde atrás: Santiago −7 %, Estación Central −10 % en UF.

Corrida (`14-anexo-salida.ts`, 84 minutos, 2.604 consultas de comparables usados de a una con pausa, nada escrito): 26.721
filas, **5.587 nuevos** (5.572 con valor por el radio, 15 por la celda usado de comuna y dormitorios, marcados) y **21.134
usados** (21.075 por su propia sugerencia de venta guardada, universo usado). UF del día 41.280 (la FASE 4 corrió con 41.274:
por eso los Comprar del motor son 79 nuevos y 6.567 usados, no 6.595).

**El método.** Valor hoy como usado = `getSugerencias(…, "venta", "usado")`: la mediana de precio por m² de los avisos de
venta usados del radio (dormitorios iguales, m² ±20 %, radio hasta 800 m, factor publicado→cierre del motor) × m² de la
unidad; salida al año 10 = ese valor × (1+g)^10, con g para precio y arriendo; la TIR con `calcExitScenario` del motor con
ese precio de venta reemplazado (valor de mercado: sin descontar sobreprecio). Reemplaza por completo a la salida del motor
(precio × 1,03^10 − sobreprecio de hoy). Donde el radio no juntó comparables usados (15 nuevos, 57 usados), la celda usado
de comuna y dormitorios; 2 usados sin valor.

**Los usados: ¿coincide con la salida de hoy?** En mediana sí (salida como usado del radio con g 3 % ÷ salida del motor =
100,0 %; p25 94 %, p75 108 %; 67 % dentro de ±10 %): para un usado el radio vale lo que se pagó, en promedio. Por unidad
no coincide (un usado caro frente a su radio sale menos; uno barato, más), así que la misma regla se aplicó a todos.

### 2.1 El escalón, por comuna y por unidad (nuevos)

Salida como usado del radio ÷ salida del motor (g 3 % en las dos: aísla el nivel), y precio pagado − valor hoy como usado.

| comuna | nuevos | escalón mediana | p25 | p75 | precio − valor usado, UF mediana | % mediana | < 10 % | 10–20 % | 20–30 % | > 30 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Gran Santiago** | 5.587 | **73,1 %** | 63,7 % | 80,8 % | **1.245** | **29,2 %** | 387 | 883 | 1.623 | 2.694 |
| Santiago | 1.206 | 62,1 % | 57,6 % | 67,7 % | 1.337 | 38,5 % | 2 | 18 | 163 | 1.023 |
| Ñuñoa | 896 | 83,3 % | 79,9 % | 88,2 % | 800 | 19,3 % | 125 | 368 | 302 | 101 |
| La Florida | 583 | 73,5 % | 66,2 % | 81,5 % | 1.043 | 28,7 % | 55 | 103 | 162 | 263 |
| Macul | 522 | 71,7 % | 65,7 % | 75,4 % | 1.294 | 31,2 % | 22 | 28 | 192 | 280 |
| Providencia | 480 | 74,0 % | 70,0 % | 78,7 % | 2.343 | 27,9 % | 14 | 78 | 191 | 197 |
| Independencia | 342 | 63,7 % | 60,8 % | 72,3 % | 1.352 | 37,6 % | 5 | 18 | 70 | 249 |
| Las Condes | 217 | 74,9 % | 68,5 % | 79,5 % | 2.952 | 26,0 % | 9 | 38 | 87 | 83 |
| La Cisterna | 170 | 79,5 % | 76,5 % | 88,7 % | 667 | 21,9 % | 21 | 43 | 81 | 25 |
| Vitacura | 159 | 80,6 % | 76,6 % | 87,4 % | 2.602 | 21,0 % | 30 | 42 | 41 | 46 |
| Recoleta | 116 | 73,4 % | 60,3 % | 77,9 % | 1.005 | 27,6 % | 6 | 14 | 42 | 54 |
| Maipú | 116 | 77,3 % | 66,5 % | 80,2 % | 1.013 | 24,2 % | 0 | 25 | 51 | 40 |
| Pudahuel | 93 | 62,0 % | 52,1 % | 62,5 % | 1.603 | 38,9 % | 0 | 0 | 2 | 91 |
| Puente Alto | 90 | 75,4 % | 74,6 % | 76,9 % | 842 | 24,6 % | 0 | 2 | 86 | 2 |
| Estación Central | 85 | 70,6 % | 67,2 % | 74,4 % | 751 | 30,3 % | 3 | 9 | 29 | 44 |
| Lo Barnechea | 74 | 85,2 % | 80,8 % | 94,1 % | 1.614 | 15,4 % | 27 | 20 | 14 | 13 |
| Quilicura | 65 | 45,2 % | 44,6 % | 47,0 % | 2.390 | 54,8 % | 1 | 0 | 4 | 60 |
| Peñalolén | 63 | 76,7 % | 71,8 % | 84,8 % | 2.301 | 25,5 % | 8 | 11 | 27 | 17 |
| Cerrillos | 61 | 88,4 % | 84,8 % | 98,9 % | 373 | 14,0 % | 20 | 28 | 10 | 3 |
| Conchalí | 59 | 75,8 % | 53,9 % | 80,9 % | 998 | 32,1 % | 3 | 16 | 9 | 31 |
| Huechuraba | 58 | 91,3 % | 74,3 % | 93,4 % | 601 | 10,5 % | 27 | 6 | 23 | 2 |
| San Miguel | 53 | 75,8 % | 71,6 % | 79,1 % | 926 | 26,3 % | 3 | 7 | 25 | 18 |
| Quinta Normal · El Bosque · San Joaquín · Renca · La Reina | 22 · 19 · 17 · 14 · 7 | 58,8 · 51,0 · 66,8 · 85,2 · 65,9 % | | | 1.345 · 1.310 · 1.052 · 374 · 3.369 | 47,4 · 49,8 · 33,2 · 14,8 · 34,1 % | 6 | 9 | 12 | 52 |

(Todas las comunas con valor por el radio en 5.572 de 5.587; la tabla entera, con p25 y p75 de las cinco chicas, en
`out/15-anexo-tablas.stdout`.)

### 2.2 La prueba del piso (g = 3 %)

Salida como usado del radio al año 10 ÷ precio pagado: ¿recupera lo pagado?

| comuna | nuevos | cociente mediana | p25 | p75 | recuperan el precio | % |
| --- | --- | --- | --- | --- | --- | --- |
| **Gran Santiago** | 5.587 | **95,1 %** | 82,4 % | 106,5 % | 2.283 | **40,9 %** |
| Santiago | 1.206 | 82,7 % | 73,4 % | 89,3 % | 91 | 7,5 % |
| Ñuñoa | 896 | 108,5 % | 103,0 % | 115,6 % | 750 | 83,7 % |
| La Florida | 583 | 95,9 % | 84,6 % | 109,3 % | 246 | 42,2 % |
| Macul | 522 | 92,5 % | 82,9 % | 100,7 % | 152 | 29,1 % |
| Providencia | 480 | 96,9 % | 87,5 % | 105,8 % | 199 | 41,5 % |
| Independencia | 342 | 83,9 % | 78,8 % | 96,0 % | 63 | 18,4 % |
| Las Condes | 217 | 99,5 % | 88,9 % | 106,8 % | 103 | 47,5 % |
| La Cisterna | 170 | 104,9 % | 98,2 % | 112,9 % | 118 | 69,4 % |
| Vitacura | 159 | 106,2 % | 92,2 % | 117,3 % | 101 | 63,5 % |
| Recoleta | 116 | 97,3 % | 81,0 % | 103,1 % | 51 | 44,0 % |
| Maipú | 116 | 101,9 % | 89,4 % | 106,6 % | 68 | 58,6 % |
| Pudahuel | 93 | 82,1 % | 69,9 % | 83,9 % | 0 | 0,0 % |
| Puente Alto | 90 | 101,4 % | 98,2 % | 103,3 % | 60 | 66,7 % |
| Estación Central | 85 | 93,7 % | 89,0 % | 99,9 % | 21 | 24,7 % |
| Lo Barnechea | 74 | 113,7 % | 98,4 % | 126,5 % | 51 | 68,9 % |
| Quilicura | 65 | 60,8 % | 59,3 % | 63,2 % | 4 | 6,2 % |
| Peñalolén · Cerrillos · Conchalí · Huechuraba · San Miguel | 63 · 61 · 59 · 58 · 53 | 100,1 · 115,6 · 91,2 · 120,3 · 99,1 % | | | 34 · 58 · 23 · 43 · 26 | 54 · 95 · 39 · 74 · 49 % |
| Quinta Normal · El Bosque · San Joaquín · Renca · La Reina | 22 · 19 · 17 · 14 · 7 | 70,7 · 67,5 · 89,8 · 114,5 · 88,6 % | | | 3 · 2 · 3 · 11 · 2 | 14 · 11 · 18 · 79 · 29 % |

### 2.3 El g de empate

La tasa real anual que necesitan los usados comparables para que la venta al año 10 iguale el precio pagado: (precio ÷ valor
hoy como usado)^(1/10) − 1.

| comuna | nuevos | g de empate mediana | p25 | p75 | bajo 1 % | 1 a 3 % | sobre 3 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Gran Santiago** | 5.587 | **3,52 %** | 2,35 % | 5,01 % | 358 | 1.923 | **3.306** |
| Santiago | 1.206 | 4,98 % | 4,17 % | 6,24 % | 2 | 89 | 1.115 |
| Ñuñoa | 896 | 2,17 % | 1,51 % | 2,70 % | 116 | 634 | 146 |
| La Florida | 583 | 3,43 % | 2,09 % | 4,74 % | 50 | 196 | 337 |
| Macul | 522 | 3,80 % | 2,93 % | 4,95 % | 21 | 129 | 372 |
| Providencia | 480 | 3,32 % | 2,42 % | 4,39 % | 12 | 187 | 281 |
| Independencia | 342 | 4,82 % | 3,42 % | 5,48 % | 5 | 58 | 279 |
| Las Condes | 217 | 3,05 % | 2,32 % | 4,22 % | 9 | 94 | 114 |
| La Cisterna | 170 | 2,50 % | 1,76 % | 3,19 % | 20 | 98 | 52 |
| Vitacura | 159 | 2,39 % | 1,37 % | 3,84 % | 26 | 75 | 58 |
| Recoleta | 116 | 3,28 % | 2,69 % | 5,19 % | 5 | 46 | 65 |
| Maipú | 116 | 2,80 % | 2,34 % | 4,16 % | 0 | 68 | 48 |
| Pudahuel | 93 | 5,05 % | 4,82 % | 6,76 % | 0 | 0 | 93 |
| Puente Alto | 90 | 2,86 % | 2,67 % | 3,19 % | 0 | 60 | 30 |
| Estación Central | 85 | 3,67 % | 3,01 % | 4,21 % | 2 | 19 | 64 |
| Lo Barnechea | 74 | 1,69 % | 0,61 % | 3,17 % | 25 | 26 | 23 |
| Quilicura | 65 | 8,26 % | 7,85 % | 8,53 % | 1 | 3 | 61 |
| Peñalolén · Cerrillos · Conchalí · Huechuraba · San Miguel | 63 · 61 · 59 · 58 · 53 | 2,99 · 1,52 · 3,95 · 1,12 · 3,10 % | | | 8 · 19 · 3 · 25 · 3 | 26 · 39 · 20 · 18 · 23 | 29 · 3 · 36 · 15 · 27 |
| Quinta Normal · El Bosque · San Joaquín · Renca · La Reina | 22 · 19 · 17 · 14 · 7 | 6,63 · 7,12 · 4,11 · 1,61 · 4,25 % | | | 2 · 0 · 0 · 3 · 1 | 1 · 2 · 3 · 8 · 1 | 19 · 17 · 14 · 3 · 5 |

**Lectura de 2.1 a 2.3:** el escalón entre el precio del nuevo y lo que vale hoy un usado de su radio es de un tercio del
precio en Santiago, Independencia, Pudahuel y Quilicura, y de un quinto en Ñuñoa, Vitacura, La Cisterna y Lo Barnechea.
Para que la venta al año 10 devuelva lo pagado, el usado tiene que subir 3,5 % real al año en mediana, 5 % en Santiago,
2,2 % en Ñuñoa; la tasa larga de transacciones (CLAPES, 4,4 %) alcanza en el oriente y no en Santiago, y la de los últimos
cinco años (0,4 a 3,7 % de lista) no alcanza en ninguna comuna grande salvo Ñuñoa.

### 3 Dos grillas con la salida como usado del radio

Regla: Buscar otra solo por las señales graves que siguen (CoC severo y sobreprecio comunal con flujo negativo); Comprar si
flujo de operación ≥ tolerancia y TIR ≥ mínima; lo demás Ajustar. Cada celda: nuevos Comprar (inmediata / futura / sin dato)
· usados Comprar · Comprar del motor que dejarían de serlo (de ellos nuevos) / Ajustar del motor que pasarían a Comprar (de
ellos nuevos). Base: 79 nuevos y 6.567 usados Comprar del motor.

**g = 1 % (precio y arriendo):**

| TIR mínima \ flujo mínimo | ≥ $0 | ≥ −$100.000 | ≥ −$200.000 | ≥ −$300.000 |
| --- | --- | --- | --- | --- |
| 4 % | nuevos 16 (9/1/6) · usados 5.716 · −968 (63) / +54 (0) | nuevos 109 (80/7/22) · usados 7.567 · −301 (46) / +1.331 (76) | nuevos 138 (103/9/26) · usados 8.089 · −298 (46) / +1.877 (105) | nuevos 150 (113/11/26) · usados 8.307 · −297 (46) / +2.103 (117) |
| 5 % | nuevos 15 (8/1/6) · usados 5.474 · −1.184 (64) / +27 (0) | nuevos 85 (61/6/18) · usados 6.851 · −585 (49) / +875 (55) | **nuevos 100 (74/8/18) · usados 7.229 · −583 (49) / +1.265 (70)** | nuevos 110 (82/10/18) · usados 7.370 · −582 (49) / +1.412 (80) |
| 6 % | nuevos 15 (8/1/6) · usados 5.126 · −1.517 (64) / +12 (0) | nuevos 64 (41/5/18) · usados 6.104 · −1.041 (50) / +563 (35) | nuevos 76 (51/7/18) · usados 6.360 · −1.040 (50) / +830 (47) | nuevos 85 (58/9/18) · usados 6.451 · −1.039 (50) / +926 (56) |
| 7 % | nuevos 15 (8/1/6) · usados 4.685 · −1.946 (64) / +0 | nuevos 51 (31/5/15) · usados 5.308 · −1.610 (50) / +323 (22) | nuevos 57 (35/7/15) · usados 5.462 · −1.609 (50) / +482 (28) | nuevos 63 (39/9/15) · usados 5.517 · −1.608 (50) / +540 (34) |

**g = 3 % (precio y arriendo):**

| TIR mínima \ flujo mínimo | ≥ $0 | ≥ −$100.000 | ≥ −$200.000 | ≥ −$300.000 |
| --- | --- | --- | --- | --- |
| 4 % | nuevos 38 (30/1/7) · usados 6.031 · −758 (41) / +181 (0) | nuevos 300 (194/12/94) · usados 9.354 · −12 (4) / +3.019 (225) | nuevos 771 (574/77/120) · usados 10.538 · −8 (3) / +4.639 (684) | nuevos 958 (713/119/126) · usados 11.150 · −7 (3) / +5.343 (818) |
| 5 % | nuevos 38 (30/1/7) · usados 6.024 · −760 (41) / +176 (0) | nuevos 262 (179/12/71) · usados 9.323 · −15 (5) / +2.953 (188) | **nuevos 621 (479/47/95) · usados 10.481 · −11 (4) / +4.448 (544)** | nuevos 733 (561/71/101) · usados 11.066 · −10 (4) / +5.100 (637) |
| 6 % | nuevos 38 (30/1/7) · usados 6.016 · −762 (41) / +170 (0) | nuevos 222 (166/10/46) · usados 9.252 · −20 (8) / +2.847 (151) | nuevos 510 (411/32/67) · usados 10.355 · −16 (7) / +4.226 (438) | nuevos 592 (469/50/73) · usados 10.904 · −15 (7) / +4.832 (513) |
| 7 % | nuevos 38 (30/1/7) · usados 5.992 · −773 (41) / +157 (0) | nuevos 199 (154/10/35) · usados 9.070 · −37 (14) / +2.660 (134) | nuevos 392 (316/26/50) · usados 10.068 · −33 (13) / +3.842 (326) | nuevos 454 (363/37/54) · usados 10.552 · −32 (13) / +4.376 (384) |

Con la salida como usado, la tolerancia de flujo vuelve a pesar: con flujo ≥ 0 casi ningún nuevo cruza (15 a 38), y de
−100.000 a −300.000 los nuevos Comprar se duplican o triplican. Con la salida del motor (FASE 4) la tolerancia no movía nada.

**Celda central (TIR ≥ 5 %, flujo ≥ −$200.000), las dos g contra la salida del motor:**

| salida | g | nuevos Comprar | inmediata / futura / sin dato | usados Comprar | Comprar que hoy son break-even imposible (nuevos / usados) |
| --- | --- | --- | --- | --- | --- |
| como usado del radio | 1 % | **100 (1,8 %)** | 74 / 8 / 18 | 7.229 (34,2 %) | 0 / 0 |
| del motor (FASE 4) | 1 % | 337 (6,0 %) | 220 / 19 / 98 | 6.851 | 0 / 0 |
| como usado del radio | 3 % | **621 (11,1 %)** | 479 / 47 / 95 | 10.481 (49,6 %) | 0 / 0 |
| del motor (FASE 4) | 3 % | 2.054 (36,7 %) | 1.429 / 439 / 186 | 10.710 | 13 / 0 |

Los nuevos que hoy caen en break-even imposible (1.639 de 5.587) no cruzan con ninguna de las dos g: sin plusvalía sobre
el precio nuevo, un depto que no se paga solo con la tasa a 0 % no llega a TIR 5 % vendido como usado.

**Por comuna, nuevos Comprar en la celda central:**

| comuna | nuevos | Comprar motor | salida usado g 1 % (inm. / fut.) | salida usado g 3 % (inm. / fut.) | usados Comprar motor | usados g 1 % | usados g 3 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Santiago | 1.206 | 0 | 0 | 12 (9 / 2) | 2.502 | 2.357 | 3.309 |
| Ñuñoa | 896 | 5 | 24 (16 / 0) | 220 (177 / 26) | 179 | 405 | 785 |
| La Florida | 583 | 11 | 19 (18 / 1) | 121 (111 / 6) | 271 | 320 | 515 |
| Macul | 522 | 3 | 11 (9 / 0) | 41 (31 / 4) | 153 | 183 | 347 |
| Providencia | 480 | 0 | 1 (1 / 0) | 4 (4 / 0) | 188 | 311 | 420 |
| Independencia | 342 | 0 | 4 (4 / 0) | 12 (10 / 0) | 413 | 408 | 555 |
| Las Condes | 217 | 2 | 5 (5 / 0) | 10 (8 / 2) | 517 | 699 | 900 |
| La Cisterna | 170 | 4 | 5 (4 / 0) | 40 (37 / 0) | 151 | 182 | 318 |
| Vitacura | 159 | 2 | 1 (0 / 1) | 2 (1 / 1) | 202 | 264 | 301 |
| Recoleta | 116 | 1 | 0 | 5 (5 / 0) | 134 | 126 | 176 |
| Maipú | 116 | 2 | 0 | 0 | 137 | 135 | 156 |
| Pudahuel | 93 | 0 | 0 | 0 | 20 | 15 | 21 |
| Puente Alto | 90 | 29 | 0 | 54 (20 / 0) | 47 | 42 | 56 |
| Estación Central | 85 | 3 | 1 (0 / 0) | 13 (6 / 0) | 698 | 704 | 943 |
| Lo Barnechea | 74 | 0 | 5 (5 / 0) | 8 (8 / 0) | 123 | 193 | 223 |
| Quilicura | 65 | 4 | 2 (2 / 0) | 3 (3 / 0) | 28 | 20 | 28 |
| Peñalolén | 63 | 1 | 3 (1 / 2) | 3 (1 / 2) | 21 | 22 | 27 |
| Cerrillos | 61 | 3 | 11 (6 / 4) | 31 (21 / 4) | 14 | 16 | 35 |
| Conchalí | 59 | 1 | 1 (0 / 0) | 4 (2 / 0) | 29 | 26 | 36 |
| Huechuraba | 58 | 1 | 2 (1 / 0) | 17 (15 / 0) | 13 | 30 | 84 |
| San Miguel | 53 | 0 | 1 (0 / 0) | 3 (0 / 0) | 332 | 373 | 692 |
| Quinta Normal · El Bosque · San Joaquín · Renca · La Reina | 22 · 19 · 17 · 14 · 7 | 0 · 2 · 0 · 5 · 0 | 0 · 2 · 0 · 2 · 0 | 2 · 2 · 1 · 12 · 1 | 219 · 5 · 73 · 12 · 28 | 202 · 3 · 84 · 14 · 38 | 270 · 6 · 134 · 18 · 53 |

(Las columnas de usados incluyen San Bernardo, Padre Hurtado y La Granja, que no tienen nuevos: 52 / 5 / 1 con el motor, 64 /
8 / 1 con g 3 %.)

**Los usados Comprar de hoy que se caen en la celda central y por qué:**

| salida | se caen | TIR baja con flujo positivo | TIR baja con flujo negativo (dentro de la tolerancia) | flujo bajo la tolerancia | señal grave | sin TIR | TIR mediana de los que caen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| como usado del radio, g 1 % | **534 de 6.567** | 406 | 126 | 1 | 0 | 1 | 4,1 % |
| como usado del radio, g 3 % | 7 de 6.567 | 6 | 0 | 1 | 0 | 0 | 2,8 % |

Con g = 1 % se caen los usados Comprar que viven del flujo chico y de la plusvalía: TIR mediana 4,1 % (bajo el 5 %), tres
cuartos con flujo positivo. Con g = 3 % casi ninguno.

### 4 · Prueba histórica: precio de lista cuando eran nuevos contra reventa de hoy

La base no tiene el precio de lista por edificio (las unidades nuevas que conocemos son de 2026). Lo más cercano es la
serie de GfK / NielsenIQ en `plusvalia_fuentes_raw`: precio de oferta de deptos nuevos por comuna y año (UF/m², promedio
anual), contra la reventa de hoy de los usados con año conocido de la curva del punto 1.2 (precio publicado UF/m²). Es
comuna contra comuna, no edificio por edificio, y compara un promedio de lista de obra nueva con una mediana de avisos de
reventa.

| comuna | edificios de 6 a 10 años (construidos 2016-2020): reventa hoy, UF/m² mediana (n) | GfK, lista de deptos nuevos 2016 → 2020, UF/m² | reventa hoy ÷ lista del año de construcción (mediana 2016-2020) |
| --- | --- | --- | --- |
| Santiago | 57,2 (n 38; p25 47,5 · p75 61,7) | 55,3 · 57,1 · 61,6 · 69,2 · 72,3 (mediana 61,6) | **−7 %** (de +3 % contra 2016 a −21 % contra 2020) |
| Estación Central | 45,2 (n 32; p25 39,8 · p75 51,4) | 46,8 · 48,2 · 50,5 · 54,8 · 57,3 (mediana 50,5) | **−10 %** (de −3 % contra 2016 a −21 % contra 2020) |
| Santiago, 11 a 20 años (2006-2015) | 48,6 (n 85) | 2015: 52,8 (la serie parte en 2015) | −8 % contra 2015 |

**Lectura:** en las dos comunas la reventa de hoy de un edificio de 6 a 10 años está, en UF, **por debajo de lo que costaba
nuevo en su año** (−7 % y −10 % contra la mediana del quinquenio; solo contra 2016 empata): es el mismo escalón del punto 2
visto desde atrás, y dice que en estas comunas el premio del nuevo no se conservó en la reventa. Con el sesgo a favor del
nuevo: la serie de GfK es de lista (no de cierre) y de todo el stock nuevo de la comuna; la reventa es de avisos publicados
(también de lista) de los edificios que hoy tienen año, 70 avisos en total.

**Qué fuente lo tendría por edificio y cuánto costaría:** (a) las transacciones del Conservador de Bienes Raíces por rol,
que es lo que usan CLAPES RealData y Tinsa: precio de la primera venta (la escritura con la inmobiliaria) y de la reventa
del mismo rol; se compra como base de datos (Tinsa/INCOIN, Real Data, Colliers) o se levanta del CBR por rol, con un costo de
semanas de trabajo o de un contrato de datos; (b) los archivos históricos del portal (precios de lista de los proyectos
2016-2020), que no son públicos; (c) hacia adelante, guardar cada noche el precio de las unidades nuevas con su proyecto y
fecha (lo que el cruce hoy no escribe) para tener la serie propia en dos o tres años.

### 5 · La celda de continuidad: qué TIR mínima deja a los usados donde están

Con los resultados del punto 3, sin recalcular (`16-anexo-continuidad.ts` sobre `out/14-anexo-salida.json`): salida como
usado del radio, la regla del anexo (Buscar otra solo por CoC severo o sobreprecio comunal con flujo; Comprar si flujo ≥
tolerancia y TIR ≥ mínima; el resto Ajustar), TIR mínima de 4 a 8 % de a uno, para flujo ≥ 0 y flujo ≥ −$200.000, con g =
3 % y g = 1 %. Los usados Comprar se comparan con los **6.567** Comprar de hoy (motor, UF 41.280): «se caen» son Comprar de
hoy que la regla no deja en Comprar, «entran» son Ajustar o Buscar otra de hoy que la regla sube, y el neto es la diferencia
contra 6.567. Los nuevos Comprar van en total y por entrega (inmediata / futura / sin fecha: los 16 sin fecha del punto 2 se
contaron como inmediata en la FASE 4, pero acá se muestran aparte). Universo: 5.587 nuevos, 21.134 usados.

**g = 3 %, flujo ≥ 0** — la más cercana: TIR ≥ 4 % (neto −536)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **4 %** | 6.031 | 717 | 181 | −536 | 38 | 30 / 1 / 7 | 0,7 % |
| 5 % | 6.024 | 719 | 176 | −543 | 38 | 30 / 1 / 7 | 0,7 % |
| 6 % | 6.016 | 721 | 170 | −551 | 38 | 30 / 1 / 7 | 0,7 % |
| 7 % | 5.992 | 732 | 157 | −575 | 38 | 30 / 1 / 7 | 0,7 % |
| 8 % | 5.942 | 753 | 128 | −625 | 35 | 27 / 1 / 7 | 0,6 % |

**g = 3 %, flujo ≥ −200.000** — la más cercana: TIR ≥ 8 % (neto +2.995)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 10.538 | 5 | 3.976 | +3.971 | 771 | 574 / 77 / 120 | 13,8 % |
| 5 % | 10.481 | 7 | 3.921 | +3.914 | 621 | 479 / 47 / 95 | 11,1 % |
| 6 % | 10.355 | 9 | 3.797 | +3.788 | 510 | 411 / 32 / 67 | 9,1 % |
| 7 % | 10.068 | 20 | 3.521 | +3.501 | 392 | 316 / 26 / 50 | 7,0 % |
| **8 %** | 9.562 | 44 | 3.039 | +2.995 | 292 | 229 / 20 / 43 | 5,2 % |

**g = 1 %, flujo ≥ 0** — la más cercana: TIR ≥ 4 % (neto −851)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **4 %** | 5.716 | 905 | 54 | −851 | 16 | 9 / 1 / 6 | 0,3 % |
| 5 % | 5.474 | 1.120 | 27 | −1.093 | 15 | 8 / 1 / 6 | 0,3 % |
| 6 % | 5.126 | 1.453 | 12 | −1.441 | 15 | 8 / 1 / 6 | 0,3 % |
| 7 % | 4.685 | 1.882 | 0 | −1.882 | 15 | 8 / 1 / 6 | 0,3 % |
| 8 % | 4.145 | 2.422 | 0 | −2.422 | 15 | 8 / 1 / 6 | 0,3 % |

**g = 1 %, flujo ≥ −200.000** — la más cercana: TIR ≥ 6 % (neto −207)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 8.089 | 252 | 1.774 | +1.522 | 138 | 103 / 9 / 26 | 2,5 % |
| 5 % | 7.229 | 534 | 1.196 | +662 | 100 | 74 / 8 / 18 | 1,8 % |
| **6 %** | 6.360 | 990 | 783 | −207 | 76 | 51 / 7 / 18 | 1,4 % |
| 7 % | 5.462 | 1.559 | 454 | −1.105 | 57 | 35 / 7 / 15 | 1,0 % |
| 8 % | 4.610 | 2.201 | 244 | −1.957 | 38 | 20 / 7 / 11 | 0,7 % |

**Lectura.**
- **Con flujo ≥ 0 ninguna TIR mínima alcanza a los 6.567**: el tope es 4 % y aun ahí faltan 536 (g 3 %) u 851 (g 1 %). Los
  Comprar de hoy ya tienen flujo ≥ 0 (lo pide el gate 3), así que los que se caen con flujo ≥ 0 se caen solo por la TIR
  con salida como usado del radio: 717 con g 3 % y 905 con g 1 % no llegan ni a 4 %. Y la TIR mínima casi no mueve a los
  nuevos con flujo ≥ 0 (38 de 4 % a 7 %, 15 o 16 con g 1 %): el flujo positivo es la puerta que los nuevos no pasan, no la TIR.
- **Con flujo ≥ −200.000 y g 3 %, todas dan más usados que hoy** (de +3.971 a +2.995): la tolerancia de flujo deja entrar
  de 3.039 a 3.976 usados Ajustar de hoy con flujo negativo chico y TIR alta, y ninguna TIR mínima hasta 8 % los frena. La
  más cercana es 8 % (9.562 usados), con 292 nuevos (229 inmediata, 20 futura): 5,2 %.
- **La única celda que deja a los usados casi donde están es g 1 %, flujo ≥ −200.000, TIR ≥ 6 %**: 6.360 usados (−207),
  con 76 nuevos Comprar (1,4 %; 51 inmediata, 7 futura). Pero la cercanía es de número, no de conjunto: en esa celda **se
  caen 990 y entran 783** (el 15 % de los Comprar de hoy cambia), y el nuevo que pasa casi no se mueve respecto de la celda
  central del punto 3 (100 con TIR ≥ 5 %). Para que el conjunto de usados no cambie, el criterio tiene que ser el de hoy.
- Por comuna, los nuevos Comprar de esa celda (g 1 %, −200.000, TIR ≥ 6 %) son Ñuñoa 19, La Florida 10, Macul 10, Cerrillos
  9, Las Condes 5, La Cisterna 5, Lo Barnechea 4, Peñalolén 3 y nueve comunas con 1 o 2; Santiago 0 de 1.206, Providencia 0
  de 480, Independencia 1 de 342. Con g 3 % y TIR ≥ 8 % (la más cercana de esa tolerancia): Ñuñoa 76, La Florida 61,
  Macul 24, La Cisterna 20, Cerrillos 17, Huechuraba 17, Puente Alto 15, Renca 9, Las Condes 8, Estación Central 7,
  Santiago 4, Providencia 4. Las tablas por comuna y TIR mínima, las cuatro, están en `out/16-anexo-continuidad.stdout`.

### 6 · Los 717 que se caen con flujo ≥ 0: es el flujo del motor, y son Comprar con flujo negativo

Los 717 usados Comprar de hoy que se caen con g = 3 %, flujo ≥ 0 y TIR ≥ 4 % (§ 5), contra los 7 que se caen con flujo ≥
−200.000 y TIR ≥ 5 % (`17-anexo-mixta.ts`, sin recalcular):

| grupo (g = 3 %) | n | flujo < 0 | flujo < −200.000 | TIR < 4 % | sin TIR | flujo < 0 y TIR ≥ 5 % | flujo ≥ 0 y TIR < 4 % | señal grave | flujo mediana | p25 | p75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| se caen con flujo ≥ 0 y TIR ≥ 4 % | 717 | 713 | 1 | 4 | 0 | 713 | 4 | 0 | −$9.397 | −$21.517 | −$4.026 |
| se caen con flujo ≥ −200.000 y TIR ≥ 5 % | 7 | 1 | 1 | 4 | 0 | 1 | 4 | 0 | $28.603 | $21.344 | $32.553 |
| se caen con la primera y no con la segunda | 712 | 712 | 0 | 0 | 0 | 712 | 0 | 0 | −$9.431 | −$21.564 | −$4.046 |

**Es el mismo número.** El `flujo` de la grilla es `metrics.flujoNetoMensual` del motor (`evaluarConMotor` en `comun.ts`
lo copia tal cual): arriendo − dividendo − gastos comunes − contribuciones − mantención − prorrata de vacancia y corretaje −
administración − cuota del pie (`calcFlujoDesglose`, `analysis.ts`). Es el número que lee el gate 3 (`flujoNetoMensual
≥ 0`), el que el resumen del informe traduce como «se paga sola» (`> 0`) y el que la noche guarda en `flujo_30`. No hay
otra definición de flujo en el motor, así que la celda de continuidad no se rehace.

**Lo que explica a los 717** es que un Comprar de hoy no necesita flujo ≥ 0: el gate 3 solo **sube** a Comprar (flujo ≥ 0,
neta ≥ 4, plusvalía inmediata ≥ 0), pero la banda de score (≥ 70) da Comprar sola, y el gate 2 solo baja al Comprar de banda
con CoC < −10 % o con flujo bajo −5 % del ingreso y CoC negativo. Entre medio quedan **713 de los 6.567 usados Comprar de hoy
con flujo negativo** (mediana −$9.400 al mes, p25 −$21.500; uno solo bajo −$200.000), que la regla con flujo ≥ 0 no deja
en Comprar aunque su TIR con salida del radio sea ≥ 5 % (los 712). Los otros 4 tienen flujo positivo y TIR < 4 %, y uno
flujo bajo −$200.000: esos 5 se caen en las dos celdas (los 7 de la segunda son esos 5 más 2 con flujo ≥ 0 y TIR entre 4 y
5 %). En los nuevos pasa lo mismo: 38 de los 79 Comprar de hoy tienen flujo negativo.

### 7 · Continuidad con salida mixta: usados con la salida del motor, nuevos con la salida como usado del radio

Misma regla y mismas celdas que § 5, pero la TIR de los usados es la del motor (precio × (1+g)^10 − sobreprecio de hoy): con
g = 3 % la `tirMotor` de la corrida del anexo (UF 41.280) y con g = 1 % la versión g1 de la FASE 4 (UF 41.274; 171 usados
de la corrida del anexo no están en la de la FASE 4 y 265 no tienen TIR con raíz: los 436 cuentan como «sin TIR» y, si son
Comprar de hoy, como «se caen»: son 81). Los nuevos llevan la salida como usado del radio (r3 / r1), así que sus columnas
son las mismas de § 5, también por comuna (las cuatro tablas por comuna están en `out/17-anexo-mixta.stdout`). La fila
marcada es TIR ≥ 6 %.

**g = 3 %, flujo ≥ 0** — la más cercana: TIR ≥ 4 % (neto −535)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 6.032 | 715 | 180 | −535 | 38 | 30 / 1 / 7 | 0,7 % |
| 5 % | 6.025 | 719 | 177 | −542 | 38 | 30 / 1 / 7 | 0,7 % |
| **6 % ◀** | 6.019 | 720 | 172 | −548 | 38 | 30 / 1 / 7 | 0,7 % |
| 7 % | 6.000 | 726 | 159 | −567 | 38 | 30 / 1 / 7 | 0,7 % |
| 8 % | 5.941 | 747 | 121 | −626 | 35 | 27 / 1 / 7 | 0,6 % |

**g = 3 %, flujo ≥ −200.000** — la más cercana: TIR ≥ 8 % (neto +2.569)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 10.666 | 3 | 4.102 | +4.099 | 771 | 574 / 77 / 120 | 13,8 % |
| 5 % | 10.654 | 7 | 4.094 | +4.087 | 621 | 479 / 47 / 95 | 11,1 % |
| **6 % ◀** | 10.563 | 8 | 4.004 | +3.996 | 510 | 411 / 32 / 67 | 9,1 % |
| 7 % | 10.144 | 14 | 3.591 | +3.577 | 392 | 316 / 26 / 50 | 7,0 % |
| 8 % | 9.136 | 35 | 2.604 | +2.569 | 292 | 229 / 20 / 43 | 5,2 % |

**g = 1 %, flujo ≥ 0** — la más cercana: TIR ≥ 4 % (neto −816)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 5.751 | 896 | 80 | −816 | 16 | 9 / 1 / 6 | 0,3 % |
| 5 % | 5.555 | 1.060 | 48 | −1.012 | 15 | 8 / 1 / 6 | 0,3 % |
| **6 % ◀** | 5.099 | 1.491 | 23 | −1.468 | 15 | 8 / 1 / 6 | 0,3 % |
| 7 % | 3.804 | 2.771 | 8 | −2.763 | 15 | 8 / 1 / 6 | 0,3 % |
| 8 % | 2.611 | 3.957 | 1 | −3.956 | 15 | 8 / 1 / 6 | 0,3 % |

**g = 1 %, flujo ≥ −200.000** — la más cercana: TIR ≥ 5 % (neto +160)

| TIR mínima | usados Comprar | se caen | entran | neto contra hoy | nuevos Comprar | inmediata / futura / sin fecha | nuevos Comprar (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 % | 8.115 | 211 | 1.759 | +1.548 | 138 | 103 / 9 / 26 | 2,5 % |
| 5 % | 6.727 | 470 | 630 | +160 | 100 | 74 / 8 / 18 | 1,8 % |
| **6 % ◀** | 5.211 | 1.406 | 50 | −1.356 | 76 | 51 / 7 / 18 | 1,4 % |
| 7 % | 3.810 | 2.767 | 10 | −2.757 | 57 | 35 / 7 / 15 | 1,0 % |
| 8 % | 2.615 | 3.954 | 2 | −3.952 | 38 | 20 / 7 / 11 | 0,7 % |

**Lectura.**
- Con g = 3 % la salida mixta casi no cambia nada respecto de § 5 (los usados con el radio ya coincidían con el motor en
  mediana): con flujo ≥ 0 sigue faltando medio millar (los 713 con flujo negativo), y con flujo ≥ −200.000 sobran más de
  2.500 a cualquier TIR mínima.
- Con g = 1 % la salida del motor es más dura que la del radio para los usados: a TIR ≥ 6 % y flujo ≥ −200.000 quedan 5.211
  (−1.356; en § 5, con el radio, 6.360), y la más cercana baja a TIR ≥ 5 % (6.727, +160, cambiando 470 por 630). La fila
  TIR ≥ 6 % con flujo ≥ 0 deja 5.099 usados (−1.468) y 15 nuevos.
- Los nuevos no se mueven con la salida mixta: a TIR ≥ 6 % son 38 (g 3 %, flujo ≥ 0), 510 (g 3 %, −200.000), 15 (g 1 %,
  flujo ≥ 0) y 76 (g 1 %, −200.000), los mismos de § 5.

## Anexo 2: salida por ingreso (corrida de confirmación del método, 07-nov-2026)

**Resumen (5 líneas)**
1. Vendido al año 10 por su ingreso (arriendo bruto del año 11 ÷ cap bruto usado de su celda; cap mediano **4,71 %** para los nuevos y **4,92 %** para los usados), un nuevo vale hoy el **75,9 %** de lo que se pagó (Santiago 65,6 %, Independencia 60,2 %, Ñuñoa 92,4 %) y un usado el **98,5 %**: el **premio de estreno por ingreso** es **UF 964 y 24,1 %** del precio en mediana (Santiago 34,4 %, Las Condes 28,3 %, Independencia 39,8 %, Ñuñoa 7,6 %); en los usados, 1,5 %. Es el mismo escalón del anexo 1 medido con otra regla (radio: 73 % y 29 %).
2. TIR a 10 años en el escenario base (g 3 %, cap de hoy): **nuevos 1,2 %** de mediana (el motor les da 7,4 %), **usados 9,5 %** (motor 7,5 %); con g 1 %, −7,0 % y 4,0 %; con g 0 %, −11,0 % y 0,8 %. Los 50 puntos base de cap restan 3 a 4 puntos de TIR en todos los escenarios.
3. En la base pasan TIR ≥ 5 % **1.614 nuevos (29 %)**, pero **5.480 de los 5.564 nuevos tienen flujo bajo −5 % del ingreso** (la vara del gate 2): de los que pasan, 38 tienen flujo ≥ 0 y 44 están entre 0 y −5 %. Usados: 15.373 pasan 5 %, 5.987 de ellos con flujo ≥ 0.
4. Celda TIR ≥ 5 %, flujo ≥ −200.000, las tres salidas lado a lado (26.293 avisos presentes en las tres corridas): ingreso g 3 % **987 nuevos (17,7 %) y 10.217 usados**; motor 2.036 / 10.408; radio 616 / 10.240. Con g 1 %: ingreso 289 / 8.313, motor 337 / 6.643, radio 100 / 7.053. De los 6.540 usados Comprar de hoy quedan con TIR ≥ 5 %: 99,6 % (g 3 %), 99,0 % (g 1 %), 84,4 % (g 0 %) y 63,2 % (g 0 %, cap + 50 pb).
5. Golden: 17b4e10d (Comprar, nuevo, Ñuñoa) 20,2 % en la base, con valor por ingreso UF 5.436 sobre un precio de 4.000; 7710a017 (Ajustar, Providencia) 13,7 %; f3522eac (Buscar otra, Santiago) 9,0 %, que cae a 3,5 % con g 1 %: con la salida por ingreso los tres pasan 5 % en la base, porque los tres están pagados a su valor por ingreso o por debajo.

**El método.** `18-salida-ingreso.ts` (12,6 minutos, solo lectura): para cada aviso de la base de referencia de la FASE 4 (26.655 avisos · nuevos 5.564 (Comprar del motor 79) · usados 21.091 (Comprar 6.540); se leyeron 27.947 avisos, 24.215 activos con evaluación y 3.732 reactivados, y quedaron 26.655 limpios), el motor real sobre sus insumos guardados (`runAnalysis`, pie 20 %, 30 años, UF 41.285, tasa 4,07 %), la proyección del motor con g para precio y arriendo (como en la FASE 4), y el **precio de venta al año 10 = arriendo bruto anual del año 11 ÷ cap de salida**, con `calcExitScenario` del motor (comisión de venta y saldo del crédito como siempre; precio de venta reemplazado y, como es valor de mercado, sin descontar el sobreprecio de hoy, igual que la salida como usado del radio). **Cap de salida** = el cap bruto que calcula la pasada (`brutoDeMuestra`: mediana del arriendo UF/m²/mes × 12 sobre la mediana del precio UF/m², avisos publicados sin factor), en la celda **comuna × dormitorios con universo usado** para nuevos y usados por igual, con la cascada de la pasada (celda 90 días, celda 180, comuna 90, comuna 180; n ≥ 15 por lado) y, donde la celda cae al respaldo, el cap de la comuna (todas las tipologías), marcado. Dos diferencias con la pasada, declaradas: la celda no lleva la banda de ±20 % de m² del sujeto (haría una celda por aviso; la mediana por m² ya normaliza el tamaño) y las lecturas fueron una por comuna y lado (45 comunas, 8.292 arriendos y 23.838 ventas usadas), con la cascada en memoria; las ventanas de 90 y 180 días coinciden porque todo lo activo tiene `scraped_at` dentro de 90 días. Dos caps (el de hoy y el de hoy + 50 puntos base) × tres g (3 %, 1 %, 0 %) = seis TIR por aviso. Cobertura del cap: celda comuna × dormitorios (usado) en 25.255 avisos · respaldo de la comuna en 1.231 (nuevos 237) · sin cap 169 · cap mediano de los avisos: nuevos 4,71 %, usados 4,92 %.

**El cap por celda** (usado; mediana arriendo UF/m²/mes × 12 ÷ mediana venta UF/m²; n arriendo/n venta; «comuna» = respaldo de la comuna):

| comuna | avisos | 1D | 2D | 3D | 4D |
| --- | --- | --- | --- | --- | --- |
| Santiago | 7.039 | 5,02 · 1318/2898 | 4,92 · 724/2491 | 5,17 · 96/742 | 5,16 (comuna) · 2182/6270 |
| Ñuñoa | 2.845 | 4,00 · 346/596 | 4,05 · 249/1002 | 4,36 · 34/564 | 4,26 (comuna) · 641/2239 |
| Las Condes | 2.735 | 4,49 · 191/264 | 5,31 · 186/601 | 4,95 · 130/1099 | 5,03 · 73/701 |
| Estación Central | 1.686 | 4,92 · 460/936 | 5,00 · 277/707 | 5,59 · 20/107 | 5,02 (comuna) · 770/1778 |
| Providencia | 1.650 | 4,82 · 91/205 | 4,29 · 88/436 | 4,35 · 53/500 | 4,52 · 16/157 |
| La Florida | 1.530 | 4,23 · 285/251 | 4,56 · 335/449 | 5,25 · 62/295 | 4,82 (comuna) · 687/1009 |
| San Miguel | 1.286 | 4,62 · 177/344 | 4,63 · 208/615 | 4,49 · 106/365 | 4,77 (comuna) · 497/1362 |
| Independencia | 1.274 | 5,42 · 260/384 | 5,16 · 203/463 | 5,09 · 56/148 | — |
| Vitacura | 1.254 | 4,96 (comuna) · 161/1268 | 4,82 · 60/247 | 4,75 · 59/586 | 4,87 · 29/322 |
| Macul | 1.139 | 4,69 · 151/142 | 4,65 · 176/328 | 4,71 · 24/176 | 4,92 (comuna) · 351/658 |
| La Cisterna | 725 | 4,32 · 167/168 | 4,42 · 232/268 | 5,33 · 50/153 | 4,62 (comuna) · 451/593 |
| Lo Barnechea | 717 | 4,57 · 23/17 | 5,04 · 40/172 | 4,66 · 22/337 | 4,79 · 17/223 |
| Quinta Normal | 469 | 5,14 · 58/97 | 5,28 · 77/181 | 5,42 · 87/207 | — |
| Recoleta | 421 | 5,48 · 37/69 | 4,93 · 29/139 | 5,25 · 19/117 | 5,24 (comuna) · 85/335 |
| Maipú | 345 | 6,07 (comuna) · 56/259 | 5,76 · 23/95 | 6,28 · 29/144 | 6,07 (comuna) · 56/259 |
| San Joaquín | 241 | 4,32 · 39/57 | 4,71 · 78/108 | 5,55 · 29/77 | 4,75 (comuna) · 147/243 |
| Huechuraba | 230 | 4,64 (comuna) · 39/191 | 4,40 · 19/57 | 4,64 (comuna) · 39/191 | 4,64 (comuna) · 39/191 |
| Puente Alto | 163 | 6,51 (comuna) · 47/114 | 6,51 (comuna) · 47/114 | 5,85 · 33/66 | 6,51 (comuna) · 47/114 |
| La Reina | 154 | 4,62 (comuna) · 27/172 | 4,62 (comuna) · 27/172 | 4,62 (comuna) · 27/172 | 4,62 (comuna) · 27/172 |
| Pudahuel | 127 | — | — | — | — |
| Cerrillos | 114 | 4,07 · 134/20 | 4,87 · 83/15 | 5,58 (comuna) · 226/65 | — |
| Peñalolén | 111 | — | 4,32 (comuna) · 21/156 | 4,32 (comuna) · 21/156 | 4,32 (comuna) · 21/156 |
| Conchalí | 110 | 6,86 (comuna) · 56/74 | 6,86 (comuna) · 56/74 | 6,86 (comuna) · 56/74 | 6,86 (comuna) · 56/74 |
| San Bernardo | 107 | 5,89 (comuna) · 36/128 | 6,35 · 20/59 | 5,89 (comuna) · 36/128 | 5,89 (comuna) · 36/128 |
| Quilicura | 105 | 6,77 (comuna) · 24/68 | 6,77 (comuna) · 24/68 | 6,55 · 15/36 | — |
| Renca | 36 | 6,25 (comuna) · 17/44 | 6,25 (comuna) · 17/44 | 6,25 (comuna) · 17/44 | — |
| El Bosque | 29 | — | — | — | — |
| Padre Hurtado | 9 | — | — | — | — |
| Lampa | 3 | — | — | — | — |
| La Granja | 1 | — | — | — | — |

### 3 · Reporte, nuevos y usados por separado

**3a · TIR a 10 años por escenario** (mediana · p25 · p75; n con TIR; la TIR del motor como referencia):

| universo | escenario | n con TIR | TIR mediana | p25 | p75 | valor de salida UF mediana | TIR del motor (mediana) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| nuevos | g 3 %, cap de hoy | 5.280 | 1,2 | -5,9 | 6,1 | 4.000 | 7,4 |
| nuevos | g 3 %, cap + 50 pb | 5.070 | -2,2 | -10,1 | 3,3 | 3.605 | 7,4 |
| nuevos | g 1 %, cap de hoy | 4.618 | -7,0 | -16,4 | -0,2 | 3.288 | 7,4 |
| nuevos | g 1 %, cap + 50 pb | 3.883 | -10,5 | -20,8 | -3,5 | 2.963 | 7,4 |
| nuevos | g 0 %, cap de hoy | 3.845 | -11,0 | -21,9 | -3,9 | 2.977 | 7,4 |
| nuevos | g 0 %, cap + 50 pb | 2.940 | -15,0 | -27,8 | -7,4 | 2.683 | 7,4 |
| usados | g 3 %, cap de hoy | 20.890 | 9,5 | 4,6 | 13,8 | 3.890 | 7,5 |
| usados | g 3 %, cap + 50 pb | 20.746 | 7,3 | 2,1 | 12,0 | 3.526 | 7,5 |
| usados | g 1 %, cap de hoy | 20.518 | 4,0 | -1,9 | 9,1 | 3.198 | 7,5 |
| usados | g 1 %, cap + 50 pb | 20.055 | 1,4 | -5,3 | 7,0 | 2.898 | 7,5 |
| usados | g 0 %, cap de hoy | 20.009 | 0,8 | -6,0 | 6,4 | 2.895 | 7,5 |
| usados | g 0 %, cap + 50 pb | 19.079 | -2,1 | -9,9 | 4,2 | 2.623 | 7,5 |

**3b · Cuántos pasan la TIR mínima, con el desglose en tres tramos de flujo** (flujo ≥ 0 / entre 0 y −5 % del ingreso, la vara del gate 2 / bajo −5 % del ingreso). Nuevos (5.564; flujo ≥ 0: 40 · entre 0 y −5 % del ingreso: 44 · bajo −5 %: 5.480): cuántos pasan la TIR mínima, en total y por tramo de flujo (≥ 0 / 0 a −5 % / bajo −5 %):

| escenario | TIR ≥ 4 % | TIR ≥ 5 % | TIR ≥ 6 % | TIR ≥ 7 % | TIR ≥ 8 % |
| --- | --- | --- | --- | --- | --- |
| g 3 %, cap de hoy | 1.863 (38 / 44 / 1.781) | 1.614 (38 / 44 / 1.532) | 1.357 (38 / 43 / 1.276) | 1.096 (38 / 43 / 1.015) | 851 (38 / 43 / 770) |
| g 3 %, cap + 50 pb | 1.115 (38 / 43 / 1.034) | 896 (38 / 43 / 815) | 694 (38 / 43 / 613) | 515 (38 / 41 / 436) | 376 (36 / 38 / 302) |
| g 1 %, cap de hoy | 441 (36 / 34 / 371) | 329 (35 / 28 / 266) | 234 (34 / 26 / 174) | 158 (25 / 25 / 108) | 93 (16 / 23 / 54) |
| g 1 %, cap + 50 pb | 159 (33 / 25 / 101) | 103 (24 / 24 / 55) | 64 (15 / 21 / 28) | 45 (13 / 17 / 15) | 29 (12 / 11 / 6) |
| g 0 %, cap de hoy | 133 (22 / 23 / 88) | 85 (15 / 22 / 48) | 56 (13 / 18 / 25) | 39 (12 / 15 / 12) | 23 (11 / 8 / 4) |
| g 0 %, cap + 50 pb | 39 (13 / 15 / 11) | 24 (11 / 9 / 4) | 18 (11 / 4 / 3) | 13 (10 / 3 / 0) | 10 (9 / 1 / 0) |

Usados (21.091; flujo ≥ 0: 6.020 · entre 0 y −5 % del ingreso: 1.616 · bajo −5 %: 13.455): cuántos pasan la TIR mínima, en total y por tramo de flujo (≥ 0 / 0 a −5 % / bajo −5 %):

| escenario | TIR ≥ 4 % | TIR ≥ 5 % | TIR ≥ 6 % | TIR ≥ 7 % | TIR ≥ 8 % |
| --- | --- | --- | --- | --- | --- |
| g 3 %, cap de hoy | 16.166 (5.987 / 1.610 / 8.569) | 15.373 (5.987 / 1.610 / 7.776) | 14.460 (5.986 / 1.605 / 6.869) | 13.349 (5.983 / 1.596 / 5.770) | 12.274 (5.977 / 1.588 / 4.709) |
| g 3 %, cap + 50 pb | 13.885 (5.987 / 1.605 / 6.293) | 12.916 (5.983 / 1.597 / 5.336) | 11.894 (5.978 / 1.589 / 4.327) | 10.784 (5.974 / 1.563 / 3.247) | 9.580 (5.965 / 1.496 / 2.119) |
| g 1 %, cap de hoy | 10.275 (5.961 / 1.518 / 2.796) | 9.182 (5.926 / 1.390 / 1.866) | 8.162 (5.867 / 1.050 / 1.245) | 7.152 (5.714 / 694 / 744) | 6.110 (5.294 / 465 / 351) |
| g 1 %, cap + 50 pb | 7.631 (5.844 / 872 / 915) | 6.711 (5.615 / 611 / 485) | 5.808 (5.176 / 404 / 228) | 4.995 (4.676 / 245 / 74) | 4.228 (4.093 / 124 / 11) |
| g 0 %, cap de hoy | 7.086 (5.678 / 676 / 732) | 6.147 (5.301 / 473 / 373) | 5.338 (4.839 / 317 / 182) | 4.542 (4.304 / 180 / 58) | 3.829 (3.726 / 94 / 9) |
| g 0 %, cap + 50 pb | 4.885 (4.594 / 224 / 67) | 4.214 (4.078 / 123 / 13) | 3.601 (3.552 / 49 / 0) | 3.043 (3.031 / 12 / 0) | 2.567 (2.567 / 0 / 0) |

**3c · Nuevos por comuna e inmediata / futura, escenario base (g 3 %, cap de hoy):** TIR mediana, los que pasan 5 % y 6 % (inmediata / futura / sin fecha) y los que además tienen flujo ≥ 0.

| comuna | nuevos | inmediata / futura / sin fecha | cap (mediana) | TIR mediana | TIR ≥ 5 % | TIR ≥ 6 % | TIR ≥ 5 % y flujo ≥ 0 | TIR ≥ 6 % y flujo ≥ 0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 5.564 | 3727 / 1572 / 265 | 4,71 | 1,2 | 1614 (1101 / 363 / 150) | 1357 (937 / 285 / 135) | 38 | 38 |
| Santiago | 1.206 | 726 / 463 / 17 | 5,02 | -6,3 | 41 (37 / 2 / 2) | 26 (23 / 2 / 1) | 0 | 0 |
| Ñuñoa | 880 | 603 / 256 / 21 | 4,05 | 7,1 | 638 (405 / 214 / 19) | 544 (360 / 166 / 18) | 2 | 2 |
| La Florida | 582 | 493 / 69 / 20 | 4,56 | 4,0 | 259 (224 / 26 / 9) | 217 (186 / 24 / 7) | 4 | 4 |
| Macul | 521 | 390 / 125 / 6 | 4,65 | 0,3 | 63 (47 / 10 / 6) | 54 (38 / 10 / 6) | 0 | 0 |
| Providencia | 480 | 247 / 217 / 16 | 4,29 | 0,4 | 109 (64 / 41 / 4) | 85 (50 / 33 / 2) | 0 | 0 |
| Independencia | 342 | 227 / 110 / 5 | 5,16 | -8,8 | 9 (8 / 0 / 1) | 9 (8 / 0 / 1) | 0 | 0 |
| Las Condes | 217 | 126 / 79 / 12 | 4,95 | -0,7 | 45 (21 / 19 / 5) | 35 (19 / 12 / 4) | 0 | 0 |
| La Cisterna | 170 | 165 / 0 / 5 | 4,42 | 4,0 | 75 (72 / 0 / 3) | 63 (60 / 0 / 3) | 2 | 2 |
| Vitacura | 159 | 114 / 31 / 14 | 4,82 | 0,5 | 42 (27 / 11 / 4) | 35 (22 / 9 / 4) | 2 | 2 |
| Recoleta | 116 | 105 / 0 / 11 | 4,93 | -1,3 | 3 (3 / 0 / 0) | 1 (1 / 0 / 0) | 1 | 1 |
| Maipú | 116 | 108 / 7 / 1 | 5,76 | -4,7 | 14 (12 / 2 / 0) | 6 (6 / 0 / 0) | 1 | 1 |
| Pudahuel | 93 | 30 / 63 / 0 | — | — | 0 (0 / 0 / 0) | 0 (0 / 0 / 0) | 0 | 0 |
| Puente Alto | 90 | 22 / 0 / 68 | 5,85 | 8,5 | 85 (18 / 0 / 67) | 84 (18 / 0 / 66) | 16 | 16 |
| Estación Central | 84 | 54 / 19 / 11 | 5,00 | 2,2 | 26 (13 / 7 / 6) | 18 (9 / 3 / 6) | 1 | 1 |
| Lo Barnechea | 74 | 63 / 10 / 1 | 5,04 | 7,2 | 45 (44 / 0 / 1) | 42 (41 / 0 / 1) | 0 | 0 |
| Quilicura | 65 | 7 / 58 / 0 | 6,77 | 4,0 | 4 (4 / 0 / 0) | 3 (3 / 0 / 0) | 2 | 2 |
| Peñalolén | 63 | 23 / 40 / 0 | 4,32 | 6,9 | 42 (16 / 26 / 0) | 37 (15 / 22 / 0) | 1 | 1 |
| Cerrillos | 61 | 47 / 4 / 10 | 4,07 | 5,9 | 35 (25 / 4 / 6) | 28 (21 / 4 / 3) | 0 | 0 |
| Huechuraba | 58 | 48 / 5 / 5 | 4,40 | 8,2 | 53 (48 / 1 / 4) | 51 (48 / 0 / 3) | 1 | 1 |
| Conchalí | 55 | 41 / 10 / 4 | 6,86 | -21,7 | 1 (0 / 0 / 1) | 1 (0 / 0 / 1) | 1 | 1 |
| San Miguel | 53 | 46 / 0 / 7 | 4,62 | 1,6 | 8 (3 / 0 / 5) | 4 (0 / 0 / 4) | 0 | 0 |
| Quinta Normal | 22 | 18 / 2 / 2 | 5,28 | -1,3 | 2 (0 / 0 / 2) | 2 (0 / 0 / 2) | 0 | 0 |
| El Bosque | 19 | 0 / 0 / 19 | — | — | 0 (0 / 0 / 0) | 0 (0 / 0 / 0) | 0 | 0 |
| San Joaquín | 17 | 10 / 4 / 3 | 4,71 | 0,9 | 1 (1 / 0 / 0) | 1 (1 / 0 / 0) | 0 | 0 |
| Renca | 14 | 9 / 0 / 5 | 6,25 | 7,4 | 12 (9 / 0 / 3) | 10 (8 / 0 / 2) | 4 | 4 |
| La Reina | 7 | 5 / 0 / 2 | 4,62 | -9,3 | 2 (0 / 0 / 2) | 1 (0 / 0 / 1) | 0 | 0 |

**3d · El escalón implícito:** valor por ingreso de hoy (arriendo bruto de hoy ÷ cap de salida) ÷ precio pagado, mediana por comuna, nuevos y usados.

| comuna | nuevos | escalón nuevos (mediana) | p25 | p75 | usados | escalón usados (mediana) | p25 | p75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 5.564 | 75,9 % | 65,4 % | 87,3 % | 21.091 | 98,5 % | 85,5 % | 112,7 % |
| Santiago | 1.206 | 65,6 % | 60,0 % | 73,8 % | 5.833 | 98,4 % | 84,8 % | 113,0 % |
| Ñuñoa | 880 | 92,4 % | 87,0 % | 99,6 % | 1.965 | 101,3 % | 92,0 % | 112,8 % |
| Las Condes | 217 | 71,7 % | 64,4 % | 82,6 % | 2.518 | 93,4 % | 80,6 % | 106,5 % |
| Estación Central | 84 | 76,3 % | 72,2 % | 82,6 % | 1.602 | 101,0 % | 88,0 % | 117,1 % |
| Providencia | 480 | 76,7 % | 68,1 % | 84,5 % | 1.170 | 98,3 % | 85,5 % | 112,8 % |
| La Florida | 582 | 83,0 % | 75,5 % | 91,2 % | 948 | 99,0 % | 84,8 % | 115,1 % |
| San Miguel | 53 | 77,3 % | 73,4 % | 80,9 % | 1.233 | 99,2 % | 88,3 % | 111,8 % |
| Independencia | 342 | 60,2 % | 53,2 % | 67,5 % | 932 | 98,2 % | 83,1 % | 114,0 % |
| Vitacura | 159 | 74,8 % | 67,9 % | 84,2 % | 1.095 | 97,7 % | 81,5 % | 112,1 % |
| Macul | 521 | 75,4 % | 70,2 % | 79,6 % | 618 | 98,8 % | 87,8 % | 110,1 % |
| La Cisterna | 170 | 83,0 % | 79,4 % | 90,5 % | 555 | 102,0 % | 89,6 % | 113,6 % |
| Lo Barnechea | 74 | 88,1 % | 74,6 % | 94,0 % | 643 | 98,9 % | 86,3 % | 118,2 % |
| Quinta Normal | 22 | 69,5 % | 58,4 % | 73,5 % | 447 | 98,7 % | 86,3 % | 109,8 % |
| Recoleta | 116 | 70,6 % | 66,4 % | 74,6 % | 305 | 99,4 % | 85,3 % | 117,6 % |
| Maipú | 116 | 64,2 % | 62,6 % | 70,0 % | 229 | 104,7 % | 78,5 % | 145,1 % |
| San Joaquín | 17 | 76,5 % | 73,4 % | 81,1 % | 224 | 98,1 % | 85,4 % | 110,1 % |
| Huechuraba | 58 | 93,0 % | 89,2 % | 96,7 % | 172 | 102,0 % | 91,8 % | 111,6 % |
| Puente Alto | 90 | 84,7 % | 83,4 % | 89,2 % | 73 | 101,0 % | 87,5 % | 120,2 % |
| La Reina | 7 | 64,0 % | 58,0 % | 84,2 % | 147 | 96,1 % | 82,7 % | 114,2 % |
| Pudahuel | 93 | — | — | — | 34 | — | — | — |
| Cerrillos | 61 | 86,9 % | 83,5 % | 92,9 % | 53 | 97,9 % | 81,1 % | 113,6 % |
| Peñalolén | 63 | 91,1 % | 74,7 % | 100,0 % | 48 | 123,1 % | 104,9 % | 160,0 % |
| Conchalí | 55 | 52,3 % | 50,5 % | 55,2 % | 55 | 80,4 % | 61,8 % | 110,4 % |
| San Bernardo | 0 | — | — | — | 107 | 89,7 % | 72,7 % | 121,1 % |
| Quilicura | 65 | 48,1 % | 45,2 % | 49,6 % | 40 | 91,5 % | 80,4 % | 124,9 % |
| Renca | 14 | 79,4 % | 76,1 % | 84,0 % | 22 | 90,8 % | 80,7 % | 105,8 % |
| El Bosque | 19 | — | — | — | 10 | — | — | — |
| Padre Hurtado | 0 | — | — | — | 9 | — | — | — |
| Lampa | 0 | — | — | — | 3 | — | — | — |
| La Granja | 0 | — | — | — | 1 | — | — | — |

**3e · El premio de estreno por ingreso:** precio pagado − valor por ingreso de hoy, UF y % del precio, mediana por comuna (nuevos; usados como control).

| comuna | nuevos | premio UF (mediana) | premio % (mediana) | p25 | p75 | usados | usados: UF (mediana) | usados: % (mediana) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 5.564 | 964 | 24,1 % | 12,7 % | 34,6 % | 21.091 | 46 | 1,5 % |
| Santiago | 1.206 | 1.140 | 34,4 % | 26,2 % | 40,0 % | 5.833 | 36 | 1,6 % |
| Ñuñoa | 880 | 327 | 7,6 % | 0,4 % | 13,0 % | 1.965 | -64 | -1,3 % |
| Las Condes | 217 | 3.288 | 28,3 % | 17,4 % | 35,6 % | 2.518 | 611 | 6,6 % |
| Estación Central | 84 | 573 | 23,7 % | 17,4 % | 27,8 % | 1.602 | -17 | -1,0 % |
| Providencia | 480 | 2.042 | 23,3 % | 15,5 % | 31,9 % | 1.170 | 115 | 1,7 % |
| La Florida | 582 | 607 | 17,0 % | 8,8 % | 24,5 % | 948 | 29 | 1,0 % |
| San Miguel | 53 | 717 | 22,7 % | 19,1 % | 26,6 % | 1.233 | 25 | 0,8 % |
| Independencia | 342 | 1.477 | 39,8 % | 32,5 % | 46,8 % | 932 | 34 | 1,8 % |
| Vitacura | 159 | 3.130 | 25,2 % | 15,8 % | 32,1 % | 1.095 | 318 | 2,3 % |
| Macul | 521 | 983 | 24,6 % | 20,4 % | 29,8 % | 618 | 38 | 1,2 % |
| La Cisterna | 170 | 508 | 17,0 % | 9,5 % | 20,6 % | 555 | -44 | -2,0 % |
| Lo Barnechea | 74 | 1.328 | 11,9 % | 6,0 % | 25,4 % | 643 | 135 | 1,1 % |
| Quinta Normal | 22 | 802 | 30,5 % | 26,5 % | 41,6 % | 447 | 25 | 1,3 % |
| Recoleta | 116 | 1.001 | 29,4 % | 25,4 % | 33,6 % | 305 | 12 | 0,6 % |
| Maipú | 116 | 1.397 | 35,8 % | 30,0 % | 37,4 % | 229 | -101 | -4,7 % |
| San Joaquín | 17 | 798 | 23,5 % | 18,9 % | 26,6 % | 224 | 44 | 1,9 % |
| Huechuraba | 58 | 416 | 7,0 % | 3,3 % | 10,8 % | 172 | -165 | -2,0 % |
| Puente Alto | 90 | 512 | 15,3 % | 10,8 % | 16,6 % | 73 | -27 | -1,0 % |
| La Reina | 7 | 2.432 | 36,0 % | 15,8 % | 42,0 % | 147 | 243 | 3,9 % |
| Pudahuel | 93 | — | — | — | — | 34 | — | — |
| Cerrillos | 61 | 372 | 13,1 % | 7,1 % | 16,5 % | 53 | 66 | 2,1 % |
| Peñalolén | 63 | 802 | 8,9 % | -0,0 % | 25,3 % | 48 | -1.211 | -23,1 % |
| Conchalí | 55 | 1.536 | 47,7 % | 44,8 % | 49,5 % | 55 | 537 | 19,6 % |
| San Bernardo | 0 | — | — | — | — | 107 | 278 | 10,3 % |
| Quilicura | 65 | 2.200 | 51,9 % | 50,4 % | 54,8 % | 40 | 168 | 8,5 % |
| Renca | 14 | 493 | 20,6 % | 16,0 % | 23,9 % | 22 | 191 | 9,2 % |
| El Bosque | 19 | — | — | — | — | 10 | — | — |
| Padre Hurtado | 0 | — | — | — | — | 9 | — | — |
| Lampa | 0 | — | — | — | — | 3 | — | — |
| La Granja | 0 | — | — | — | — | 1 | — | — |

**3f · Los usados Comprar de hoy** (6.540): cuántos quedan con TIR ≥ 5 % y ≥ 6 % en cada escenario, y de ellos cuántos con flujo ≥ 0. Con la TIR del motor: ≥ 5 % 6.534, ≥ 6 % 6.532.

| escenario | TIR ≥ 5 % | % | de ellos flujo ≥ 0 | TIR ≥ 6 % | % | de ellos flujo ≥ 0 | sin TIR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| g 3 %, cap de hoy | 6.513 | 99,6 % | 5.804 | 6.512 | 99,6 % | 5.803 | 27 |
| g 3 %, cap + 50 pb | 6.510 | 99,5 % | 5.802 | 6.507 | 99,5 % | 5.799 | 27 |
| g 1 %, cap de hoy | 6.473 | 99,0 % | 5.775 | 6.339 | 96,9 % | 5.741 | 27 |
| g 1 %, cap + 50 pb | 5.903 | 90,3 % | 5.546 | 5.366 | 82,0 % | 5.125 | 27 |
| g 0 %, cap de hoy | 5.522 | 84,4 % | 5.246 | 4.979 | 76,1 % | 4.795 | 27 |
| g 0 %, cap + 50 pb | 4.131 | 63,2 % | 4.046 | 3.572 | 54,6 % | 3.529 | 27 |

### 4 · Las tres salidas lado a lado en la celda TIR ≥ 5 %, flujo ≥ −200.000

Regla del anexo (Buscar otra solo por CoC severo o sobreprecio comunal con flujo; Comprar con flujo ≥ −200.000 y TIR ≥ 5 %; el resto Ajustar), sobre los **26.293 avisos presentes en las tres corridas** (nuevos 5.564, usados 20.729; flujo y gates de la corrida de hoy; la TIR del motor y la del radio vienen de sus corridas, FASE 4 y anexo 1). «Se caen» y «entran» son contra los usados Comprar de hoy de esos 20.729.

| salida | nuevos Comprar | % | inmediata / futura / sin fecha | usados Comprar | % | usados Comprar de hoy que se caen | entran | TIR mediana nuevos | TIR mediana usados |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| motor, g 3 % (precio × 1,03^10 − sobreprecio) | 2.036 | 36,6 % | 1413 / 438 / 185 | 10.408 | 50,2 % | 8 | 4.020 | 7,4 | 7,5 |
| como usado del radio, g 3 % | 616 | 11,1 % | 475 / 47 / 94 | 10.240 | 49,4 % | 7 | 3.851 | -1,3 | 8,4 |
| ingreso, g 3 %, cap de hoy | 987 | 17,7 % | 706 / 151 / 130 | 10.217 | 49,3 % | 28 | 3.849 | 1,2 | 9,5 |
| ingreso, g 3 %, cap + 50 pb | 670 | 12,0 % | 480 / 83 / 107 | 9.891 | 47,7 % | 31 | 3.526 | -2,2 | 7,3 |
| motor, g 1 % | 337 | 6,1 % | 220 / 19 / 98 | 6.643 | 32,0 % | 384 | 631 | 2,0 | 2,5 |
| como usado del radio, g 1 % | 100 | 1,8 % | 74 / 8 / 18 | 7.053 | 34,0 % | 521 | 1.178 | -9,6 | 2,6 |
| ingreso, g 1 %, cap de hoy | 289 | 5,2 % | 219 / 40 / 30 | 8.313 | 40,1 % | 66 | 1.983 | -7,0 | 4,0 |
| ingreso, g 1 %, cap + 50 pb | 97 | 1,7 % | 76 / 5 / 16 | 6.438 | 31,1 % | 629 | 671 | -10,5 | 1,3 |
| motor, g 0 % | 27 | 0,5 % | 22 / 0 / 5 | 2.469 | 11,9 % | 3.930 | 3 | -2,1 | -1,1 |
| ingreso, g 0 %, cap de hoy | 81 | 1,5 % | 64 / 5 / 12 | 5.928 | 28,6 % | 1.000 | 532 | -11,0 | 0,8 |
| ingreso, g 0 %, cap + 50 pb | 24 | 0,4 % | 14 / 3 / 7 | 4.107 | 19,8 % | 2.363 | 74 | -15,0 | -2,2 |

### 5 · Los tres casos del golden

TIR con salida por ingreso en los seis escenarios (y la del motor), con su cap de hoy (celda comuna × dormitorios, usado) y su valor por ingreso de hoy; cada caso con su input guardado y la UF del día en que se creó, como en la FASE 4.5.

| análisis | veredicto · score · flujo | cap (nivel; n arr/venta) | precio UF · valor por ingreso hoy UF · salida motor UF | TIR motor | g 3 %, cap de hoy | g 3 %, cap + 50 pb | g 1 %, cap de hoy | g 1 %, cap + 50 pb | g 0 %, cap de hoy | g 0 %, cap + 50 pb |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 17b4e10d · Ñuñoa · nuevo · 2D 80 m² | COMPRAR 80 · 49.232 (6,6 % del ingreso) | 4.05 (celda; 249/1002) | 4.000 · 5.436 · 5.376 | 13,43 | 20,2 (UF 7.306) | 18,2 (UF 6.503) | 15,8 (UF 6.005) | 13,6 (UF 5.345) | 13,4 (UF 5.436) | 11,0 (UF 4.839) |
| f3522eac · Santiago · usado 15 años · 2D 50 m² | BUSCAR OTRA 59 · -110.844 (-22,9 % del ingreso) | 4.92 (celda; 724/2491) | 3.000 · 2.875 · 3.511 | 5,74 | 9,0 (UF 3.864) | 6,9 (UF 3.507) | 3,5 (UF 3.176) | 0,8 (UF 2.883) | 0,1 (UF 2.875) | -3,2 (UF 2.610) |
| 7710a017 · Providencia · usado 4 años · 2D 60 m² | AJUSTA SUPUESTOS 64 · -259.761 (-27,1 % del ingreso) | 4.29 (celda; 88/436) | 5.500 · 6.713 · 7.392 | 8,58 | 13,7 (UF 9.022) | 11,6 (UF 8.080) | 8,9 (UF 7.415) | 6,4 (UF 6.641) | 6,1 (UF 6.713) | 3,3 (UF 6.012) |

**Lectura.**
- **El método es coherente consigo mismo en los usados y le pone número al escalón de los nuevos.** Para un usado el valor por ingreso de hoy es el 98,5 % de lo que se paga (p25 85 %, p75 113 %): el mercado usado está en su cap. Para un nuevo es el 75,9 %: el comprador paga un 24 % sobre el ingreso que el depto produce al cap de su comuna, y eso es lo que la salida por ingreso le cobra al año 10. Es el escalón del anexo 1 (73 % con el radio) medido con otra regla, y lo mismo que dijo la prueba histórica.
- **La salida por ingreso es más generosa con los nuevos que la del radio y más dura que la del motor** (987 contra 616 y 2.036 en la celda central con g 3 %), porque capitaliza el arriendo del nuevo (3 % sobre el usado, y más por m² en unidades chicas) al cap del usado; con g 1 % las tres convergen (289, 100 y 337). Con los usados casi no se distingue del motor ni del radio con g 3 % (10.217, 10.408, 10.240) y le da más Comprar que los dos con g 1 % (8.313 contra 6.643 y 7.053), porque el arriendo crece con g y el valor por ingreso de un usado ya es su precio: es precio × (1+g)^10 sin descontar sobreprecio.
- **El cuello de los nuevos no es la TIR, es el flujo.** 5.480 de 5.564 tienen flujo bajo −5 % del ingreso; en la base pasan 5 % de TIR 1.614, pero solo 82 de esos tienen flujo ≥ 0 o dentro de la vara de hoy. Cualquier criterio con tolerancia de flujo en pesos (−200.000) deja pasar nuevos por la TIR; cualquier criterio con la vara de hoy (−5 % del ingreso) deja afuera a casi todos, con la salida que sea.
- **Los 50 puntos base pesan tanto como pasar de g 3 % a g 1 % en los nuevos** (de 1.614 a 896 pasan 5 %; de 987 a 670 en la celda central) y menos en los usados (de 15.373 a 12.916). Los usados Comprar de hoy aguantan la salida por ingreso con g 3 % y g 1 % (99,6 % y 99,0 % siguen sobre 5 %); con g 0 % caen al 84 % y con g 0 % y +50 pb al 63 %.
- **Cobertura y límites.** 1.231 avisos (237 nuevos) usan el cap de la comuna como respaldo (celdas con menos de 15 arriendos o ventas: Vitacura 1D, Huechuraba, La Reina, Puente Alto 1D y 2D, Conchalí, Peñalolén, Quilicura, Renca) y 169 quedan sin cap (Pudahuel, El Bosque, Padre Hurtado, Lampa, La Granja, y los 4D de Independencia, Quinta Normal y Cerrillos). El cap es de avisos publicados (pedidos, no cerrados) en los dos lados, sin factor, como el de la pasada. La celda no lleva la banda de m² del sujeto. Y el universo de hoy no es el de la FASE 4 (las activas cambian cada noche): 6.540 usados Comprar de hoy contra 6.567 del anexo 1 y 6.595 de la FASE 4.

### 6 · Por comuna, escenario base (g = 3 %, cap de hoy)

`20-anexo2-comunas-fichas.ts`, sobre los vectores de la salida por ingreso ya calculados (nada recalculado ni escrito). Nuevos y
usados por separado, en el mismo orden (por avisos nuevos). «Comprar de hoy» es el veredicto del motor en la corrida de la salida
por ingreso (UF 41.285); entre paréntesis, cuántos de ellos tienen flujo negativo. El cap de salida es la mediana de los caps de
celda de los avisos de la comuna. El flujo en % del arriendo es flujo neto ÷ ingreso mensual del motor (el arriendo más
estacionamiento y bodega, lo mismo que mide el gate 2). Las dos últimas columnas son el % de los avisos de la comuna con TIR base
≥ 5 % y flujo **dentro de la vara de hoy** (no peor que −5 % del arriendo), y con TIR base ≥ 5 % y flujo **entre −5 % del
arriendo y −$200.000**.

**Nuevos**

| comuna | avisos | Comprar de hoy (con flujo < 0) | cap de salida (mediana) | premio de estreno % (mediana) | premio UF (mediana) | flujo mensual mediano | flujo % del arriendo (mediana) | TIR por ingreso (mediana) | TIR del motor (mediana) | TIR ≥ 5 % dentro de la vara | TIR ≥ 5 % entre −5 % y −$200.000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 5.564 | 79 (39) | 4,71 | 24,1 % | 964 | $-238.238 | -47,3 % | 1,2 % | 7,4 % | 1,5 % | 16,7 % |
| Santiago | 1.206 | 0 (0) | 5,02 | 34,4 % | 1.140 | $-220.140 | -58,6 % | -6,3 % | 6,8 % | 0,0 % | 3,4 % |
| Ñuñoa | 880 | 5 (3) | 4,05 | 7,6 % | 327 | $-228.930 | -41,6 % | 7,1 % | 7,6 % | 0,6 % | 38,0 % |
| La Florida | 582 | 11 (7) | 4,56 | 17,0 % | 607 | $-189.122 | -40,3 % | 4,0 % | 7,9 % | 1,9 % | 41,1 % |
| Macul | 521 | 3 (3) | 4,65 | 24,6 % | 983 | $-247.779 | -49,9 % | 0,3 % | 7,2 % | 0,6 % | 11,3 % |
| Providencia | 480 | 0 (0) | 4,29 | 23,3 % | 2.042 | $-579.242 | -57,4 % | 0,4 % | 7,1 % | 0,0 % | 0,8 % |
| Independencia | 342 | 0 (0) | 5,16 | 39,8 % | 1.477 | $-256.476 | -67,2 % | -8,8 % | 6,6 % | 0,0 % | 2,6 % |
| Las Condes | 217 | 2 (2) | 4,95 | 28,3 % | 3.288 | $-708.206 | -47,4 % | -0,7 % | 7,3 % | 2,3 % | 3,2 % |
| La Cisterna | 170 | 4 (2) | 4,42 | 17,0 % | 508 | $-155.386 | -42,5 % | 4,0 % | 7,4 % | 2,4 % | 41,8 % |
| Vitacura | 159 | 2 (0) | 4,82 | 25,2 % | 3.130 | $-757.703 | -48,1 % | 0,5 % | 7,3 % | 1,3 % | 0,0 % |
| Recoleta | 116 | 1 (0) | 4,93 | 29,4 % | 1.001 | $-181.166 | -43,3 % | -1,3 % | 7,7 % | 0,9 % | 1,7 % |
| Maipú | 116 | 2 (1) | 5,76 | 35,8 % | 1.397 | $-203.885 | -36,0 % | -4,7 % | 8,1 % | 1,7 % | 10,3 % |
| Pudahuel | 93 | 0 (0) | — | — | — | $-261.667 | -50,5 % | — | 7,2 % | 0,0 % | 0,0 % |
| Puente Alto | 90 | 29 (13) | 5,85 | 15,3 % | 512 | $-49.269 | -8,5 % | 8,5 % | 10,7 % | 32,2 % | 62,2 % |
| Estación Central | 84 | 3 (2) | 5,00 | 23,7 % | 573 | $-118.659 | -35,6 % | 2,2 % | 8,6 % | 3,6 % | 27,4 % |
| Lo Barnechea | 74 | 0 (0) | 5,04 | 11,9 % | 1.328 | $-449.054 | -26,2 % | 7,2 % | 8,9 % | 0,0 % | 12,2 % |
| Quilicura | 65 | 4 (2) | 6,77 | 51,9 % | 2.200 | $-291.455 | -60,8 % | 4,0 % | 7,8 % | 6,2 % | 0,0 % |
| Peñalolén | 63 | 1 (0) | 4,32 | 8,9 % | 802 | $-518.725 | -36,2 % | 6,9 % | 7,8 % | 1,6 % | 3,2 % |
| Cerrillos | 61 | 3 (3) | 4,07 | 13,1 % | 372 | $-137.790 | -41,9 % | 5,9 % | 7,9 % | 4,9 % | 52,5 % |
| Huechuraba | 58 | 1 (0) | 4,40 | 7,0 % | 416 | $-231.955 | -28,4 % | 8,2 % | 8,8 % | 1,7 % | 27,6 % |
| Conchalí | 55 | 1 (0) | 6,86 | 47,7 % | 1.536 | $-174.413 | -43,1 % | -21,7 % | 7,8 % | 1,8 % | 0,0 % |
| San Miguel | 53 | 0 (0) | 4,62 | 22,7 % | 717 | $-187.615 | -45,4 % | 1,6 % | 7,4 % | 0,0 % | 9,4 % |
| Quinta Normal | 22 | 0 (0) | 5,28 | 30,5 % | 802 | $-134.785 | -39,6 % | -1,3 % | 7,2 % | 0,0 % | 9,1 % |
| El Bosque | 19 | 2 (0) | — | — | — | $-77.067 | -23,0 % | — | 9,3 % | 0,0 % | 0,0 % |
| San Joaquín | 17 | 0 (0) | 4,71 | 23,5 % | 798 | $-195.740 | -47,5 % | 0,9 % | 7,6 % | 0,0 % | 5,9 % |
| Renca | 14 | 5 (1) | 6,25 | 20,6 % | 493 | $-20.487 | -4,9 % | 7,4 % | 11,5 % | 50,0 % | 35,7 % |
| La Reina | 7 | 0 (0) | 4,62 | 36,0 % | 2.432 | $-579.897 | -79,1 % | -9,3 % | 5,8 % | 0,0 % | 14,3 % |

**Usados**

| comuna | avisos | Comprar de hoy (con flujo < 0) | cap de salida (mediana) | premio de estreno % (mediana) | premio UF (mediana) | flujo mensual mediano | flujo % del arriendo (mediana) | TIR por ingreso (mediana) | TIR del motor (mediana) | TIR ≥ 5 % dentro de la vara | TIR ≥ 5 % entre −5 % y −$200.000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gran Santiago | 21.091 | 6.540 (709) | 4,92 | 1,5 % | 46 | $-70.408 | -13,3 % | 9,5 % | 7,5 % | 36,0 % | 26,2 % |
| Santiago | 5.833 | 2.499 (304) | 5,02 | 1,6 % | 36 | $-24.524 | -6,3 % | 10,1 % | 8,2 % | 47,4 % | 27,0 % |
| Ñuñoa | 1.965 | 175 (42) | 4,05 | -1,3 % | -64 | $-198.079 | -29,6 % | 8,6 % | 6,1 % | 9,7 % | 40,0 % |
| La Florida | 948 | 271 (27) | 4,56 | 1,0 % | 29 | $-71.135 | -15,6 % | 9,3 % | 7,2 % | 32,8 % | 36,9 % |
| Macul | 618 | 150 (28) | 4,65 | 1,2 % | 38 | $-81.071 | -15,1 % | 9,2 % | 7,3 % | 28,0 % | 46,1 % |
| Providencia | 1.170 | 183 (58) | 4,35 | 1,7 % | 115 | $-297.627 | -26,9 % | 8,2 % | 6,6 % | 16,0 % | 21,5 % |
| Independencia | 932 | 411 (7) | 5,16 | 1,8 % | 34 | $-2.996 | -0,8 % | 10,7 % | 8,7 % | 57,5 % | 16,7 % |
| Las Condes | 2.518 | 517 (97) | 5,03 | 6,6 % | 611 | $-316.172 | -20,0 % | 8,1 % | 7,0 % | 24,0 % | 15,0 % |
| La Cisterna | 555 | 149 (7) | 4,42 | -2,0 % | -44 | $-44.344 | -12,6 % | 10,0 % | 7,5 % | 32,8 % | 45,6 % |
| Vitacura | 1.095 | 201 (30) | 4,82 | 2,3 % | 318 | $-501.328 | -20,8 % | 8,7 % | 7,0 % | 21,8 % | 6,3 % |
| Recoleta | 305 | 129 (2) | 5,25 | 0,6 % | 12 | $-19.350 | -3,9 % | 10,9 % | 8,5 % | 52,1 % | 24,6 % |
| Maipú | 229 | 137 (3) | 6,28 | -4,7 % | -101 | $81.495 | 14,8 % | 14,5 % | 11,5 % | 68,1 % | 5,2 % |
| Pudahuel | 34 | 16 (0) | — | — | — | $17.926 | 3,8 % | — | 7,9 % | 0,0 % | 0,0 % |
| Puente Alto | 73 | 47 (0) | 5,85 | -1,0 % | -27 | $60.773 | 10,9 % | 13,6 % | 9,6 % | 76,7 % | 5,5 % |
| Estación Central | 1.602 | 702 (18) | 4,92 | -1,0 % | -17 | $-8.972 | -2,9 % | 10,9 % | 8,7 % | 54,0 % | 28,2 % |
| Lo Barnechea | 643 | 123 (1) | 4,79 | 1,1 % | 135 | $-392.284 | -18,4 % | 9,2 % | 7,6 % | 28,3 % | 8,1 % |
| Quilicura | 40 | 28 (0) | 6,77 | 8,5 % | 168 | $45.780 | 12,0 % | 11,5 % | 10,2 % | 80,0 % | 0,0 % |
| Peñalolén | 48 | 22 (0) | 4,32 | -23,1 % | -1.211 | $-52.686 | -4,1 % | 14,7 % | 9,0 % | 50,0 % | 18,8 % |
| Cerrillos | 53 | 13 (0) | 4,87 | 2,1 % | 66 | $-74.109 | -22,4 % | 8,7 % | 7,2 % | 35,8 % | 28,3 % |
| Huechuraba | 172 | 13 (0) | 4,64 | -2,0 % | -165 | $-179.006 | -17,7 % | 9,6 % | 7,2 % | 19,2 % | 37,2 % |
| Conchalí | 55 | 29 (0) | 6,86 | 19,6 % | 537 | $9.519 | 2,0 % | 7,2 % | 8,3 % | 52,7 % | 0,0 % |
| San Miguel | 1.233 | 328 (67) | 4,62 | 0,8 % | 25 | $-64.898 | -15,1 % | 9,2 % | 7,2 % | 30,4 % | 44,5 % |
| Quinta Normal | 447 | 221 (5) | 5,28 | 1,3 % | 25 | $961 | 0,3 % | 10,8 % | 9,1 % | 62,4 % | 17,7 % |
| El Bosque | 10 | 5 (0) | — | — | — | $60.682 | 14,9 % | — | 12,3 % | 0,0 % | 0,0 % |
| San Joaquín | 224 | 73 (9) | 4,71 | 1,9 % | 44 | $-47.337 | -12,2 % | 9,5 % | 7,7 % | 37,5 % | 35,3 % |
| Renca | 22 | 12 (0) | 6,25 | 9,2 % | 191 | $31.609 | 7,9 % | 10,4 % | 9,9 % | 77,3 % | 4,5 % |
| La Reina | 147 | 29 (4) | 4,62 | 3,9 % | 243 | $-252.710 | -24,0 % | 7,8 % | 6,8 % | 24,5 % | 15,0 % |
| San Bernardo | 107 | 51 (0) | 5,89 | 10,3 % | 278 | $14.788 | 3,2 % | 9,9 % | 9,2 % | 59,8 % | 5,6 % |
| Padre Hurtado | 9 | 5 (0) | — | — | — | $73.032 | 12,8 % | — | 11,7 % | 0,0 % | 0,0 % |
| Lampa | 3 | 0 (0) | — | — | — | $-33.410 | -7,7 % | — | 9,2 % | 0,0 % | 0,0 % |
| La Granja | 1 | 1 (0) | — | — | — | $112.128 | 24,1 % | — | 13,6 % | 0,0 % | 0,0 % |

**Lectura.**
- **El nuevo mediano pone $238.000 al mes (−47 % del arriendo)**; el usado mediano, $70.000 (−13 %). Con TIR base ≥ 5 % dentro de
  la vara de hoy queda el **1,5 % de los nuevos** contra el 36 % de los usados.
- **La banda entre −5 % y −$200.000 es donde están los nuevos con TIR**: el 16,7 % de los nuevos, concentrados en Puente Alto
  (62 %), Cerrillos (52 %), La Cisterna (42 %), La Florida (41 %) y Ñuñoa (38 %). En Santiago es el 3,4 %, en Providencia el 0,8 % y
  en Vitacura 0: ahí el flujo mediano (−$580.000 a −$760.000) ya pasa los −$200.000.
- **Solo dos comunas tienen nuevos dentro de la vara con TIR**: Puente Alto (32 %) y Renca (50 %), las de cap de salida más alto
  (5,85 % y 6,25 %) y premio de estreno bajo.
- **Los Comprar de hoy con flujo negativo**: 39 de los 79 nuevos y 709 de los 6.540 usados (Santiago 304, Las Condes 97, San
  Miguel 67, Providencia 58).

### 7 · Ocho fichas de casos reales

Cada ficha es el aviso **más cercano a la mediana de su grupo** (nunca el mejor ni el peor); el grupo y la variable de la mediana
van en la primera línea. La selección y las seis TIR salen de los vectores guardados. El resto de la ficha (pie y costos, cuotas,
saldo, lo que recibes, suma de flujos, ganancia, múltiplo) no quedó guardado: para esos ocho se corrió la misma cadena de la
corrida de la salida por ingreso (misma UF 41.285, tasa 4,07 % y el mismo «hoy», congelado en el instante de esa corrida; el
golden con su input y la UF del día en que se creó) y **las seis TIR calzan con las guardadas en las ocho**. Valor de salida,
saldo, lo que recibes, suma de flujos y ganancia son del escenario base (g 3 %, cap de hoy). **Ganancia y múltiplo con la
definición del informe**: ganancia = lo que recibes al vender − todo lo que pusiste (pie, costos y los años con flujo negativo);
múltiplo = lo que recibes ÷ todo lo que pusiste. Una TIR «no calculable» es una venta que no alcanza a devolver lo puesto.

Criterios de dos grupos, declarados: **(b)** «el flujo negativo más grande» se tomó como el decil más negativo de los usados
Comprar con flujo negativo, y de ahí el más cercano a su mediana (el más negativo de todos sería el peor). **(e)** en Santiago
centro hay solo 2 nuevos de ese tipo con entrega futura y pie en cuotas, así que el grupo es de todas las comunas. **(f)** «típico
de Santiago» es la mediana de los nuevos de la comuna de Santiago, que es −6,3 %, no 1,2 %: la TIR base de 1,2 % es la mediana de los nuevos de Gran Santiago; en la comuna de Santiago queda en el percentil 80 (mediana de Santiago -6,3 %).

**(a) Usado Comprar de hoy con flujo negativo típico** — usados Comprar de hoy con flujo < 0, el más cercano a la mediana del flujo (grupo de 709; mediana del grupo flujo $-9.534). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 51f4958b · Santiago · usado, 25 años (supuestos) |
| tipología y superficie | 1D 1B · 35 m² |
| precio | UF 1.950 · $80.506.163 · UF 55,7/m² · $2.300.176/m² |
| arriendo estimado (mensual) | $337.000 · UF 8,2 |
| flujo mensual | $-9.534 · UF -0,2 · -2,8 % del arriendo |
| lo que pones hoy (pie + costos) | $21.179.304 · UF 513 (pie $16.101.233 · UF 390 + costos $5.078.071 · UF 123) |
| veredicto de hoy | COMPRAR · score 70 · por puntaje (≥ 70), sin pagarse sola |
| cap de entrada (arriendo bruto anual ÷ precio) | 5,02 % |
| cap de salida (celda, usado) | 5,02 % (comuna × dormitorios; 1318 arriendos / 2898 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $108.262.709 · UF 2.622 · el que supone el motor $106.614.999 · UF 2.582 |
| saldo del crédito al año 10 | $50.860.487 · UF 1.232 |
| lo que recibes al vender (venta − comisión − saldo) | $55.236.968 · UF 1.338 |
| suma de los flujos de los 10 años (g 3 %) | $3.604.726 · UF 87,3 |
| ganancia total y múltiplo (definición del informe) | $33.934.809 · UF 822 · múltiplo 2,59× |
| TIR del motor (salida del motor) | 9,5 % |
| TIR por ingreso, g 3 %, cap de hoy | 10,9 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 9,0 % |
| TIR por ingreso, g 1 %, cap de hoy | 5,5 % |
| TIR por ingreso, g 1 %, cap + 50 pb | 3,0 % |
| TIR por ingreso, g 0 %, cap de hoy | 2,2 % |
| TIR por ingreso, g 0 %, cap + 50 pb | -0,8 % |

*En fácil:* Pones UF 513 y unos $9.500 al mes de tu bolsillo; si los precios suben 3 % real al año, al vender recibes UF 1.338 y rinde 10,9 %; con 1 % rinde 5,5 % y si no suben nada, 2,2 %. Es Comprar por puntaje justo en el borde (70), sin pagarse solo.

**(b) Usado Comprar de hoy con el flujo negativo más grande** — usados Comprar de hoy en el decil de flujo más negativo (flujo ≤ $-46.314), el más cercano a la mediana de ese decil (grupo de 71; mediana del grupo flujo $-61.526). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 30535bd9 · Vitacura · usado, 25 años (supuestos) |
| tipología y superficie | 4D 4B · 258 m² |
| precio | UF 17.952 · $741.160.293 · UF 69,6/m² · $2.872.714/m² |
| arriendo estimado (mensual) | $3.548.000 · UF 85,9 |
| flujo mensual | $-61.526 · UF -1,5 · -1,7 % del arriendo |
| lo que pones hoy (pie + costos) | $191.708.946 · UF 4.644 (pie $148.232.059 · UF 3.590 + costos $43.476.887 · UF 1.053) |
| veredicto de hoy | COMPRAR · score 71 · por puntaje (≥ 70), sin pagarse sola |
| cap de entrada (arriendo bruto anual ÷ precio) | 5,74 % |
| cap de salida (celda, usado) | 4,87 % (comuna × dormitorios; 29 arriendos / 322 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $1.174.919.754 · UF 28.459 · el que supone el motor $996.057.457 · UF 24.126 |
| saldo del crédito al año 10 | $468.234.626 · UF 11.342 |
| lo que recibes al vender (venta − comisión − saldo) | $683.186.733 · UF 16.548 |
| suma de los flujos de los 10 años (g 3 %) | $43.936.684 · UF 1.064 |
| ganancia total y múltiplo (definición del informe) | $490.739.475 · UF 11.887 · múltiplo 3,55× |
| TIR del motor (salida del motor) | 10,1 % |
| TIR por ingreso, g 3 %, cap de hoy | 14,5 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 12,7 % |
| TIR por ingreso, g 1 %, cap de hoy | 9,7 % |
| TIR por ingreso, g 1 %, cap + 50 pb | 7,6 % |
| TIR por ingreso, g 0 %, cap de hoy | 7,0 % |
| TIR por ingreso, g 0 %, cap + 50 pb | 4,5 % |

*En fácil:* Un depto grande y caro que casi se paga solo (le pones el 1,7 % del arriendo): lo compras a 5,7 % de cap en una celda que vende a 4,9 %, y por eso rinde 14,5 % con 3 % y todavía 7,0 % sin plusvalía.

**(c) Nuevo Comprar de hoy con flujo negativo** — nuevos Comprar de hoy con flujo < 0, el más cercano a la mediana del flujo (grupo de 39; mediana del grupo flujo $-14.321). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 31273928 · Puente Alto · nuevo, entrega sin dato |
| tipología y superficie | 3D 2B · 62 m² |
| precio | UF 3.152 · $130.130.320 · UF 50,8/m² · $2.098.876/m² |
| arriendo estimado (mensual) | $569.590 · UF 13,8 |
| flujo mensual | $-14.321 · UF -0,3 · -2,5 % del arriendo |
| lo que pones hoy (pie + costos) | $28.628.670 · UF 693 (pie $26.026.064 · UF 630 + costos $2.602.606 · UF 63,0) |
| veredicto de hoy | COMPRAR · score 71 · por puntaje (≥ 70), sin pagarse sola |
| cap de entrada (arriendo bruto anual ÷ precio) | 5,25 % |
| cap de salida (celda, usado) | 5,85 % (comuna × dormitorios; 33 arriendos / 66 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $157.021.744 · UF 3.803 · el que supone el motor $174.884.268 · UF 4.236 |
| saldo del crédito al año 10 | $82.210.990 · UF 1.991 |
| lo que recibes al vender (venta − comisión − saldo) | $71.670.319 · UF 1.736 |
| suma de los flujos de los 10 años (g 3 %) | $6.273.804 · UF 152 |
| ganancia total y múltiplo (definición del informe) | $42.869.797 · UF 1.038 · múltiplo 2,49× |
| TIR del motor (salida del motor) | 11,8 % |
| TIR por ingreso, g 3 %, cap de hoy | 10,8 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 8,9 % |
| TIR por ingreso, g 1 %, cap de hoy | 4,5 % |
| TIR por ingreso, g 1 %, cap + 50 pb | 1,9 % |
| TIR por ingreso, g 0 %, cap de hoy | 0,4 % |
| TIR por ingreso, g 0 %, cap + 50 pb | -3,0 % |

*En fácil:* El nuevo que hoy da Comprar: casi se paga solo, pero el motor supone venderlo en UF 4.236 y por su arriendo valdría UF 3.803; rinde 10,8 % si los precios suben 3 % al año y 0,4 % si no suben.

**(d) Nuevo de Santiago centro, entrega inmediata, con TIR ≥ 5 % y flujo entre −5 % del arriendo y −$200.000** — nuevos de la comuna de Santiago, entrega inmediata, TIR base ≥ 5 % y flujo en esa banda, el más cercano a la mediana de la TIR base (grupo de 37; mediana del grupo TIR 6,6 %). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 00e696fb · Santiago · nuevo, entrega inmediata (Disponible) |
| tipología y superficie | 2D 2B · 53,1 m² |
| precio | UF 3.388 · $139.873.580 · UF 63,8/m² · $2.632.171/m² |
| arriendo estimado (mensual) | $494.400 · UF 12,0 |
| flujo mensual | $-125.063 · UF -3,0 · -25,3 % del arriendo |
| lo que pones hoy (pie + costos) | $30.772.188 · UF 745 (pie $27.974.716 · UF 678 + costos $2.797.472 · UF 67,8) |
| veredicto de hoy | AJUSTA SUPUESTOS · score 63 · por puntaje (45 a 69) |
| cap de entrada (arriendo bruto anual ÷ precio) | 4,24 % |
| cap de salida (celda, usado) | 4,92 % (comuna × dormitorios; 724 arriendos / 2491 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $162.056.585 · UF 3.925 · el que supone el motor $187.978.395 · UF 4.553 |
| saldo del crédito al año 10 | $88.366.382 · UF 2.140 |
| lo que recibes al vender (venta − comisión − saldo) | $70.449.071 · UF 1.706 |
| suma de los flujos de los 10 años (g 3 %) | $-8.062.187 · UF -195,3 |
| ganancia total y múltiplo (definición del informe) | $31.614.696 · UF 766 · múltiplo 1,81× |
| TIR del motor (salida del motor) | 9,1 % |
| TIR por ingreso, g 3 %, cap de hoy | 6,6 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 4,0 % |
| TIR por ingreso, g 1 %, cap de hoy | -0,5 % |
| TIR por ingreso, g 1 %, cap + 50 pb | -4,5 % |
| TIR por ingreso, g 0 %, cap de hoy | -5,5 % |
| TIR por ingreso, g 0 %, cap + 50 pb | -11,4 % |

*En fácil:* Pones UF 745 y después $125.000 al mes; pagaste UF 63,8 por m² y por su arriendo vale UF 3.925 al año 10 con 3 % de alza (el motor supone UF 4.553): rinde 6,6 % solo si el mercado sube 3 % real todos los años, y pierde plata con 1 %.

**(e) El mismo tipo con entrega futura y pie en cuotas (Gran Santiago: Santiago centro tiene 2)** — nuevos de todas las comunas, entrega futura con pie en cuotas, TIR base ≥ 5 % y flujo en la banda, el más cercano a la mediana de la TIR base (grupo de 94; mediana del grupo TIR 11,1 %). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 92529506 · Las Condes · nuevo, entrega futura (2do Semestre 2028) |
| tipología y superficie | 1D 1B · 35,5 m² |
| precio | UF 5.326 · $219.883.910 · UF 150,0/m² · $6.193.913/m² |
| arriendo estimado (mensual) | $794.130 · UF 19,2 |
| flujo mensual | $-189.201 · UF -4,6 · -23,8 % del arriendo |
| lo que pones hoy (pie + costos) | $48.374.460 · UF 1.172 (pie $43.976.782 · UF 1.065 + costos $4.397.678 · UF 107) |
| pie en cuotas (entrega futura) | al firmar $6.156.749 · UF 149 (costos + primera cuota); 25 cuotas de $1.759.071 · UF 42,6 al mes; 25 meses hasta la entrega |
| veredicto de hoy | AJUSTA SUPUESTOS · score 62 · por puntaje (45 a 69) |
| cap de entrada (arriendo bruto anual ÷ precio) | 4,33 % |
| cap de salida (celda, usado) | 4,49 % (comuna × dormitorios; 191 arriendos / 264 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $285.232.249 · UF 6.909 · el que supone el motor $295.505.588 · UF 7.158 |
| saldo del crédito al año 10 | $147.906.089 · UF 3.583 |
| lo que recibes al vender (venta − comisión − saldo) | $131.621.515 · UF 3.188 |
| suma de los flujos de los 10 años (g 3 %) | $-6.263.930 · UF -151,7 (aparte, las cuotas del pie: $43.976.782 · UF 1.065) |
| ganancia total y múltiplo (definición del informe) | $76.762.699 · UF 1.859 · múltiplo 2,40× |
| TIR del motor (salida del motor) | 10,7 % |
| TIR por ingreso, g 3 %, cap de hoy | 11,1 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 8,0 % |
| TIR por ingreso, g 1 %, cap de hoy | 3,5 % |
| TIR por ingreso, g 1 %, cap + 50 pb | -0,9 % |
| TIR por ingreso, g 0 %, cap de hoy | -1,4 % |
| TIR por ingreso, g 0 %, cap + 50 pb | -7,3 % |

*En fácil:* Firmas con UF 149, pagas $1,76 millones al mes durante 25 meses hasta la entrega y después $189.000 al mes: con 3 % de alza rinde 11,1 % porque el arriendo crece mientras esperas; con 1 % baja a 3,5 % y sin alza pierde. En Santiago centro solo hay dos casos de este tipo, por eso sale de Las Condes.

**(f) Nuevo típico de Santiago centro** — nuevos de la comuna de Santiago, el más cercano a la mediana de la TIR base de Santiago (grupo de 1.174; mediana del grupo TIR -6,3 %). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 2f395699 · Santiago · nuevo, entrega futura (2do Semestre 2028) |
| tipología y superficie | 2D 2B · 53,7 m² |
| precio | UF 3.801 · $156.924.285 · UF 70,8/m² · $2.922.240/m² |
| arriendo estimado (mensual) | $433.630 · UF 10,5 |
| flujo mensual | $-254.908 · UF -6,2 · -58,8 % del arriendo |
| lo que pones hoy (pie + costos) | $34.523.343 · UF 836 (pie $31.384.857 · UF 760 + costos $3.138.486 · UF 76,0) |
| pie en cuotas (entrega futura) | al firmar $4.393.880 · UF 106 (costos + primera cuota); 25 cuotas de $1.255.394 · UF 30,4 al mes; 25 meses hasta la entrega |
| veredicto de hoy | BUSCAR OTRA · score 48 · gate 1 (break-even imposible) |
| cap de entrada (arriendo bruto anual ÷ precio) | 3,32 % |
| cap de salida (celda, usado) | 4,92 % (comuna × dormitorios; 724 arriendos / 2491 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $142.137.317 · UF 3.443 · el que supone el motor $210.893.117 · UF 5.108 |
| saldo del crédito al año 10 | $105.555.961 · UF 2.557 |
| lo que recibes al vender (venta − comisión − saldo) | $33.738.610 · UF 817 |
| suma de los flujos de los 10 años (g 3 %) | $-17.991.955 · UF -435,8 (aparte, las cuotas del pie: $31.384.857 · UF 760) |
| ganancia total y múltiplo (definición del informe) | $-18.776.688 · UF -454,8 · múltiplo 0,64× |
| TIR del motor (salida del motor) | 8,4 % |
| TIR por ingreso, g 3 %, cap de hoy | -6,3 % |
| TIR por ingreso, g 3 %, cap + 50 pb | -13,4 % |
| TIR por ingreso, g 1 %, cap de hoy | -33,6 % |
| TIR por ingreso, g 1 %, cap + 50 pb | no calculable (la venta no devuelve lo puesto) |
| TIR por ingreso, g 0 %, cap de hoy | no calculable (la venta no devuelve lo puesto) |
| TIR por ingreso, g 0 %, cap + 50 pb | no calculable (la venta no devuelve lo puesto) |

*En fácil:* El nuevo típico de Santiago: el arriendo cubre poco más de la mitad del gasto, pones $255.000 al mes, y vendido por su arriendo al año 10 vale UF 3.443, menos de lo que costó (UF 3.801): pierdes aun con 3 % de alza al año (−6,3 %), y con menos alza la venta no te devuelve lo puesto.

**(g) Usado comprado bajo su valor por ingreso** — usados con precio bajo su valor por ingreso de hoy y TIR base sobre la mediana de los usados (9,5 %), el más cercano a la mediana de la TIR de ese grupo (grupo de 9.533; mediana del grupo TIR 14,3 %). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 56b54457 · Ñuñoa · usado, 25 años (supuestos) |
| tipología y superficie | 2D 2B · 69 m² |
| precio | UF 4.621 · $190.761.058 · UF 67,0/m² · $2.764.653/m² |
| arriendo estimado (mensual) | $794.000 · UF 19,2 |
| flujo mensual | $-77.929 · UF -1,9 · -9,8 % del arriendo |
| lo que pones hoy (pie + costos) | $49.498.304 · UF 1.199 (pie $38.152.212 · UF 924 + costos $11.346.092 · UF 275) |
| veredicto de hoy | AJUSTA SUPUESTOS · score 67 · por puntaje (45 a 69) |
| cap de entrada (arriendo bruto anual ÷ precio) | 4,99 % |
| cap de salida (celda, usado) | 4,05 % (comuna × dormitorios; 249 arriendos / 1002 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $316.168.889 · UF 7.658 · el que supone el motor $256.366.911 · UF 6.210 |
| saldo del crédito al año 10 | $120.515.000 · UF 2.919 |
| lo que recibes al vender (venta − comisión − saldo) | $189.330.511 · UF 4.586 |
| suma de los flujos de los 10 años (g 3 %) | $1.998.497 · UF 48,4 |
| ganancia total y múltiplo (definición del informe) | $137.534.092 · UF 3.331 · múltiplo 3,66× |
| TIR del motor (salida del motor) | 9,1 % |
| TIR por ingreso, g 3 %, cap de hoy | 14,3 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 12,1 % |
| TIR por ingreso, g 1 %, cap de hoy | 9,6 % |
| TIR por ingreso, g 1 %, cap + 50 pb | 7,0 % |
| TIR por ingreso, g 0 %, cap de hoy | 6,9 % |
| TIR por ingreso, g 0 %, cap + 50 pb | 3,9 % |

*En fácil:* Comprado bajo lo que vale por su arriendo (lo compras a 5,0 % de cap y la celda vende a 4,05 %): rinde 14,3 % con 3 % de alza y 6,9 % aun sin alza, aunque hoy el motor le diga Ajustar por los $78.000 al mes que le pones.

**(h) El nuevo de Ñuñoa del Golden Set** — el análisis 17b4e10d tal como se creó (su input, su mediana guardada y la UF de ese día) (grupo de 1; mediana del grupo —). Control: las seis TIR calzan con las guardadas.

| dato | valor |
| --- | --- |
| aviso | 17b4e10d · Ñuñoa · nuevo (análisis del 2026-09-03) |
| tipología y superficie | 2D 2B · 80 m² |
| precio | UF 4.000 · $163.512.000 · UF 50,0/m² · $2.043.900/m² |
| arriendo estimado (mensual) | $750.000 · UF 18,3 |
| flujo mensual | $49.232 · UF 1,2 · 6,6 % del arriendo |
| lo que pones hoy (pie + costos) | $35.972.640 · UF 880 (pie $32.702.400 · UF 800 + costos $3.270.240 · UF 80,0) |
| veredicto de hoy | COMPRAR · score 80 · por puntaje (≥ 70), y además se paga sola |
| cap de entrada (arriendo bruto anual ÷ precio) | 5,50 % |
| cap de salida (celda, usado) | 4,05 % (comuna × dormitorios; 249 arriendos / 1002 ventas) |
| valor de salida al año 10 | por ingreso (g 3 %, cap de hoy) $298.648.000 · UF 7.306 · el que supone el motor $219.746.455 · UF 5.376 |
| saldo del crédito al año 10 | $100.918.824 · UF 2.469 |
| lo que recibes al vender (venta − comisión − saldo) | $191.756.216 · UF 4.691 |
| suma de los flujos de los 10 años (g 3 %) | $16.460.646 · UF 403 |
| ganancia total y múltiplo (definición del informe) | $155.783.576 · UF 3.811 · múltiplo 5,33× |
| TIR del motor (salida del motor) | 13,4 % |
| TIR por ingreso, g 3 %, cap de hoy | 20,2 % |
| TIR por ingreso, g 3 %, cap + 50 pb | 18,2 % |
| TIR por ingreso, g 1 %, cap de hoy | 15,8 % |
| TIR por ingreso, g 1 %, cap + 50 pb | 13,6 % |
| TIR por ingreso, g 0 %, cap de hoy | 13,4 % |
| TIR por ingreso, g 0 %, cap + 50 pb | 11,0 % |

*En fácil:* Se paga solo y está comprado a 5,5 % de cap en una celda que vende a 4,05 %: por su arriendo vale UF 7.306 al año 10, contra UF 5.376 que supone el motor, y rinde 20,2 %; sin alza, 13,4 %. Es el caso de prueba más favorable del Golden Set, no un aviso del mercado.
