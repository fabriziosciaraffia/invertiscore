# Acta de cierre · 5 de octubre de 2026

Antes de las conversaciones de negocio. Todo lo abierto, cada cosa con su estado: **hecho**, **aparcado** (con su disparador o su fecha) o **descartado**. Lo que está en curso dice cuándo termina.

## 1 · En producción esta semana (hecho)

| Qué | Commit en master | Producción |
|---|---|---|
| Arriendo sugerido llevado al tamaño del depto (1D 0,3 · 2D 0,5 · 3D 0,2 · 4D+ 0,3, el mejor del backtest de validación por tipología) | 5ba397f7 | READY 05-oct 10:42 UTC |
| La zona de la marca de «arriendo sospechoso» con la comuna del radio, y la zona sin filtro de respaldo | c7486050 | READY 05-oct 11:07 UTC |
| Correo semanal: respaldo (vecinas y Ajustar negociables), a todo informe de renta larga, presentación, prechequeo en las noches, rechequeo del domingo, /semanal viva | 68b4deda | READY 05-oct 12:49 UTC |
| Aviso inmediato a quien respondió «Ya» (un correo por día, el «Ya» vence a los 60 días, baja propia, eventos en PostHog) | 071309e1 | READY 05-oct 12:51 UTC |
| Cierre: scrape-nuevos con 300 s, Sentry sin alertas duplicadas de los crons, el reintento del semanal no alerta, el informe sin mono ni mayúsculas | 4072adde | READY 05-oct 13:50 UTC |

## 2 · En curso

- **Reevaluación de los avisos con la versión s4** (zona con comuna): a las 14:13 UTC iba en 6.000 de 24.336 pendientes, con 0 fallidos, a 1,26 avisos por segundo; termina cerca de las 18:15 UTC. Corre fuera de la sesión e ignora los Ctrl+C (dos intentos anteriores murieron por eso). Hay 3.900 avisos más ya en s4 del primer intento.
- **Obra nueva, pase de unidades**: los tercios 0, 1 y 2 corrieron. Desde mañana, un tercio por día en rotación. 

  | Tercio | Proyectos | Unidades vistas | Fuera de la ficha | Vendidas | Errores |
  |---|---|---|---|---|---|
  | 0 · 03-oct 14:08 UTC | 171/171 | 2.690 | 1.006 | 0 | 0 |
  | 1 · 04-oct 14:03 UTC | 135/135 | 1.815 | 350 | 0 | 0 |
  | 2 · 05-oct 14:04 UTC | 130/130 | 1.995 | 755 | 0 | 0 |

  El tercio 2 también rehízo la reconciliación que scrape-nuevos no alcanzó a hacer a las 06:30: 0 proyectos con unidades siguen activos.

## 3 · Aparcado

| Qué | Disparador o fecha |
|---|---|
| **Escasez** en el ticket del pack y el chip «Revisados hace N horas» en la guía (Kaplan–Meier por comuna) | **15-oct-2026** (agendado). |
| **Mediana nuevos/viejos**: «precio bajo la mediana» mezcla edificios nuevos y viejos; comparar contra deptos de antigüedad parecida | Cuando haya edificios con año. Hoy 0 de 22.582 usados evaluados tienen el año de la ficha; solo 12 lecturas de ficha lo trajeron. El año se lee solo cuando alguien usa la guía, así que el disparador real es una fuente del año por edificio. |
| **Renta corta sin correo ni guía** | Cuando haya una evaluación de renta corta por aviso: hoy todo aviso se evalúa como arriendo largo. Afecta a quien tiene el perfil en renta corta, por ejemplo 81f15e43, que dijo «Ya» a mano. |
| **Riesgo de tasa y cuotas del pie en renta corta** | Decisión de Fabrizio después de las conversaciones de negocio. En renta larga ya está el pie en cuotas de la obra nueva (r3); en renta corta no. |
| **Umbrales de TIR** (cuándo una TIR dice «conviene») | Decisión de Fabrizio después de las conversaciones de negocio. |
| **Obra nueva sin Comprar a precio de mercado** (pie en cuotas durante la construcción, precio en verde contra entrega) | Para conversar. Va con los cuatro pendientes de datos: premio de arriendo, fecha de entrega que el scraper descarta, pie en cuotas en la TIR y penalización por espera. |
| **El PDF del informe** (/documento) sigue en mono y en mayúsculas | Cuando se toque el PDF. El cierre de hoy fue el informe web. |
| **/comunas sin la obra nueva como sección propia** | Cuando se retome /comunas. |
| **Mapa de los caminos después del primer informe** (16 huecos del 01-oct; quedan, entre otros, «Entrar» con contraseña para cuentas de código y la guía sin vuelta) | Después de las conversaciones de negocio, con prioridad por embudo. |
| **Ocupación realizada de renta corta por avisos** | Cuando llegue la data de AirROI. |
| **Prender AMBAS** (y con eso el agujero del cap anónimo por ambasGroupId y el 500 de la comparativa con IA) | Si AMBAS vuelve. Hoy está apagado. |
| **Widget de Google Places** (deprecado) | Cuando Google fije la fecha de retiro. |
| **Limpieza de worktrees**: 30 en disco, más las ramas viejas de abajo | Al terminar las conversaciones, con la regla del junction de node_modules. |
| **Supabase 522 en properties_within_radius** | Vigilado: el radio reintenta los cortes de red desde el 30-sep. Se reabre si vuelve a aparecer en Sentry. |
| **`spatial_ref_sys` sin RLS** (advisor) | Descartado como arreglo: es la tabla de PostGIS, no admite RLS. Queda anotado en CLAUDE.md. |

## 4 · Descartado

- **Las colas del prompt y de la prosa con IA** (v22, guards STR, A8, la frase estructural, LTR-CIFRA, la rúbrica del juez, «CAP rate» en la fraseCanonica, el titular STR #8b–#11, despersonalizar el motor, las familias de la apertura, los `return null` del pipeline, «el valor de tu cuadra», «la mediana de tu zona» como rótulo). La IA salió del informe por decisión del 24-sep, y el código se borró el 25-sep.
- **Las ramas de septiembre que la memoria daba «sin merge»** (benchmark por comuna, STR contra STR, ocupación STR, plusvalía, resultado a 10 años, cómo lo pagas, ⓘ y capas, cap rate neto, arco y mudanza del pop-up, retiro de la ventaja vs LTR, «Lo que haría yo»). Ninguna queda fuera de master: verificado con `git branch --no-merged` el 05-oct. Cuentan como **hecho**.
- **Ramas viejas sin merge, reemplazadas**: `landing-v14-package` (41 commits del 11-sep; la landing v14 entró por otra rama el 28-sep), los reels de agosto, los mockups de orden y la evaluación editorial de agosto (era de la IA), `regen-prosa-distancia`, `arriendo-dos-universos` (la reemplazó la referencia de arriendo de fuente única), `auditoria-editorial-str` y `sesion-funnel-cta` (junio). Se pueden borrar.
- **La deuda del `useMemo` sin `ufValue`** en results-client: el `useMemo` murió con `projData` el 2-sep. Cuenta como **hecho**.
- **«Cómo se calcula» desbordado a 390 en renta corta**: ya no pasa. Medido el 05-oct en el informe 16c7a9c3: la tabla nueva ocupa 350 de 350 y ninguna celda se desborda, en CLP ni en UF. Queda fijado en el tier INFORME-TIPOGRAFÍA. Cuenta como **hecho**.

## 5 · Lo que necesita a Fabrizio

- **`.env.local`** (sin valores): para lanzar crons a mano contra producción falta el `CRON_SECRET` **de producción**; el de `.env.local` es el de los previews. Sugerencia: agregarlo como `CRON_SECRET_PRODUCCION` y dejar `CRON_SECRET` como está. Para leer Sentry y confirmar desde ahí qué alerta: `SENTRY_AUTH_TOKEN` (solo lectura), `SENTRY_ORG` y `SENTRY_PROJECT`. Opcionales, para correr local los crons que hoy no se pueden: `PROXY_URL` (unidades), `META_ADS_TOKEN` y `META_AD_ACCOUNT_ID` (Meta Ads), `OPENFACTURA_API_KEY`, `OPENFACTURA_ENV` y `OPENFACTURA_ENABLED` (boletas).
- **Las decisiones aparcadas** de la sección 3 que dicen «decisión de Fabrizio».

## 6 · Números del cierre

**Las alertas del 4 y 5 de octubre.**
- **scrape-nuevos, 5-oct 06:30 UTC, «latió y no cerró»:** se quedó sin tiempo. Desde el 30-sep sus corridas cerraban en 54–59 s contra un techo de 60, y el 5-oct pasó (504, «Task timed out after 60 seconds»). No es el ritmo nuevo; la corrida ya venía al borde. Los 408 proyectos sí se actualizaron. Lo que quedó sin hacer fue la reconciliación con las unidades: 404 proyectos-base siguieron activos (contados dos veces en la mediana de obra nueva) de 06:30 a 14:04, cuando el pase de unidades la hizo. **Arreglo:** el techo pasó a 300 s (4072adde) y el tier CRONS lo cuida.
- **semanal-armar, 4-oct, «falla parcial»:** la selección de b934115f falló a las 11:05 UTC y se armó sola a las 12:06. **Arreglo:** una falla en una corrida intermedia del domingo cuenta como «reintentar» y no alerta; solo la de las 23 UTC es falla (tier SEMANAL §14).
- **Sentry:** ninguna ruta de cron reporta ya con `captureApiError`. La falla que el cron cuenta en su cierre (que alerta a hola@) va como `warning` con la marca `manejado: cron` (tier CRONS §4). No se pudo mirar Sentry por dentro: falta `SENTRY_AUTH_TOKEN` (sección 5).

**El arriendo con los valores que se aplicaron** (1D 0,3 · 2D 0,5 · 3D 0,2 · 4D+ 0,3):
- **Avisos:** 27.348 medidos. El «antes» reproduce el del 03-oct en 99,9%. Cambian de veredicto 1.743 (6,4%), por tipología:
  - 1D: 434 de 7.921;
  - 2D: 1.115 de 10.766;
  - 3D: 162 de 6.766;
  - 4D o más: 32 de 1.895.
- **Veredictos:**
  - Comprar pasa de 7.206 a 7.410;
  - Ajustar, de 7.936 a 7.997;
  - Buscar otro, de 12.206 a 11.941.
- **Movimientos principales:**
  - Buscar otro → Ajustar: 580;
  - Ajustar → Comprar: 526;
  - Comprar → Ajustar: 304;
  - Ajustar → Buscar otro: 297.
- **Factor sobre el arriendo:** p10 0,952 · mediana 1,011 · p90 1,086, en los 20.771 avisos con ajuste. Con 0,2/0,4/0,8 cambiaban 1.995 y Comprar subía a 7.579.
- **Informes:** 466 que aceptaron el arriendo sugerido (las cuentas de prueba, fuera). Cambian 38: 10 de usuarios registrados (10 personas) y 28 anónimos. Con 0,2/0,4/0,8 eran 43 (9 registrados). Los informes guardados no se re-resuelven: esto mide lo que darían hoy.
