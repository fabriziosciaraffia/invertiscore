# Activación por puerta (PostHog)

> 20-oct-2026. El panel «Activación por semana» (dashboard 2215824) suma una tabla: de cada registrado, por puerta, si
> analizó algo en la primera hora, el primer día y los primeros 30 días. Y el paso intermedio nuevo:
> `primera_seleccion_vista`.

## Los eventos

| Evento | Quién lo emite | Qué marca |
| --- | --- | --- |
| `cuenta_atribuida` | el servidor, al fijar la puerta (`src/lib/attribution.ts`) | el registro; lleva `puerta` (A informe · B /deptos · C referido · D orgánico) |
| `primera_seleccion_vista` | `GET /api/deptos/primeros`, una vez por cuenta (uuid determinista) | vio sus primeros deptos; lleva `puerta`, `n`, `fuente` (del_dia · noche · ninguno), `faltan`, `con_regalo`, `minutos_desde_alta` |
| `analisis_creado` | el servidor, al crear un informe con cuenta (`src/lib/medicion-activacion.ts`) | analizó algo; lleva `via` (wizard · guia · semanal · …) |
| `reanalisis_precio` | el servidor, una vez por informe (uuid determinista), desde el 21-oct-2026 (`src/lib/reanalisis-servidor.ts`): al crear con saldo el informe que pidió el botón «Ver el informe completo a UF X» del pop-up Ajustar, o al confirmarse el pago del suelto | el informe completo al precio que Franco recomendó negociar; lleva `informe_original`, `informe_nuevo`, `precio_original_uf`, `precio_recomendado_uf`, `descuento_pct`, `pie_pct`, `plazo_anios`, `modalidad` (ltr · str) y `con_pago`. El `analisis_creado` de ese informe (con saldo) lleva `via` = reanalisis |
| `invitacion_vista` | la página `/i/CÓDIGO` al pintarse en el servidor (`src/lib/invitacion-vista.ts`), desde el 20-oct-2026 | abrió un enlace de invitación; lleva `codigo`, `modo` (invitado · propio · con_cuenta), `con_nombre`, `invitador_prueba`, y lo de toda vista de entrada (abajo) |
| `landing_viewed` · `deptos_vista` | el middleware al servir `/` y `/deptos` (`src/lib/vista-entrada.ts`), desde el 20-oct-2026; antes, el navegador | llegó a la landing o a /deptos. Toda vista de entrada lleva `pagina`, los `utm_*`, `canal` (pagado · organico, la regla de `canalDeUtm`), `con_fbclid` (y el `fbclid` con «si»), `con_gclid`, `referente`, `consentimiento`, `prueba` (modo prueba de la medición), `origen` = servidor y el agente (`$raw_user_agent`: sin él PostHog marca todo evento del servidor como robot, `Automation / no_user_agent`). Con o sin consentimiento; sin «si», un id por visita y sin perfil de persona; el navegador arranca PostHog con el mismo id (`Server-Timing`) |

## El agente de los eventos del servidor

> 20-oct-2026. PostHog clasifica el tráfico por el agente (`$raw_user_agent`) y marca robot todo evento sin él
> (`$virt_is_bot`, «Automation / no_user_agent»). Todo evento del servidor sale por un solo punto
> (`src/lib/posthog-captura.ts`) con el agente del navegador de la persona, y `agente_origen` dice de dónde salió:
> `evento` (las vistas de entrada), `pedido` (el pedido venía de su navegador; queda recordado en `agentes_navegador`),
> `recordado` (delante había un webhook o un cron: el último navegador que Franco le vio) o `cola`. Ningún evento sale
> sin agente: el de una persona cuyo navegador Franco todavía no vio espera en `eventos_sin_agente`, con su hora, y sale
> cuando lo ve (un pedido suyo, o navegando con sesión por la app: el middleware). Por eso un evento `cola` puede llegar
> a PostHog hasta un día después de su hora. Lo que lleva más de 24 horas esperando sale igual (21-oct-2026), con su
> hora, el agente genérico fijo de Franco («Mozilla/5.0 (Franco) AppleWebKit/537.36 (KHTML, like Gecko) Franco/1.0»,
> que PostHog clasifica `Regular`) y `agente_origen` = `ninguno`: para separarlo en un panel, filtrar por ese origen.
> Lo vacía el resumen diario de los crons (la vigilancia de las 00:45 UTC). Antes del 20-oct-2026 los eventos del
> servidor no tienen `agente_origen` y salen todos como robot.

## La tabla (HogQL)

El insight «Activación por puerta · 1 h / 1 día / 30 días» del dashboard corre esta consulta (la misma base que la tabla
«Activación por semana · por puerta»: los registrados son los `cuenta_atribuida`, la puerta es la última fijada, sin
cuentas de prueba, y cada ventana se mide desde el registro):

```sql
with base as (
  select person_id,
    minIf(timestamp, event = 'cuenta_atribuida') as t_reg,
    minIf(timestamp, event = 'primera_seleccion_vista') as t_sel,
    groupArrayIf(timestamp, event = 'analisis_creado') as analisis,
    argMaxIf(toString(properties.puerta), timestamp, event in ('cuenta_atribuida', '$set') and notEmpty(coalesce(toString(properties.puerta), ''))) as puerta,
    argMaxIf(coalesce(toString(properties.puerta_detalle), ''), timestamp, event in ('cuenta_atribuida', '$set') and notEmpty(coalesce(toString(properties.puerta), ''))) as detalle
  from events
  where event in ('cuenta_atribuida', '$set', 'analisis_creado', 'primera_seleccion_vista')
    and timestamp >= now() - interval 30 week
    and coalesce(person.properties.test_account, false) = false
  group by person_id
  having t_reg > toDateTime('2000-01-02') and t_reg >= now() - interval 26 week
)
select toStartOfWeek(t_reg, 1) as semana,
  multiIf(puerta = 'A', 'A · informe', puerta = 'B', 'B · selección', puerta = 'C' and startsWith(detalle, 'invitacion:'), 'C · invitación', puerta = 'C', 'C · compartido', puerta = 'D', 'D · orgánico', 'sin puerta') as puerta,
  count() as registrados,
  countIf(t_sel > toDateTime('2000-01-02') and t_sel < t_reg + interval 1 hour) as vieron_seleccion_1h,
  countIf(arrayExists(x -> x >= t_reg and x < t_reg + interval 1 hour, analisis)) as analizaron_1h,
  countIf(arrayExists(x -> x >= t_reg and x < t_reg + interval 1 day, analisis)) as analizaron_1d,
  countIf(arrayExists(x -> x >= t_reg and x < t_reg + interval 30 day, analisis)) as analizaron_30d,
  round(analizaron_1h / registrados, 3) as activacion_1h,
  round(analizaron_1d / registrados, 3) as activacion_1d,
  round(analizaron_30d / registrados, 3) as activacion_30d
from base
group by semana, puerta
order by semana desc, puerta
```

Una cuenta registrada hace menos de 30 días todavía puede entrar en la columna de 30 días: la fila se lee como «hasta
hoy». `primera_seleccion_vista` existe desde el 20-oct-2026: las semanas anteriores lo tienen en cero.

## La cohorte de la puerta C: «Referidos por semana» (HogQL)

> 20-oct-2026. La tabla de la puerta C por invitación (insight 7aJ56Uij del mismo dashboard) empieza en la visita:
> `visitas` son las `invitacion_vista` del servidor de quien abrió un enlace ajeno (`modo` = invitado), sin los enlaces
> de cuentas de prueba; `registro_por_visita` = invitados con cuenta nueva / visitas de la misma semana. Antes del
> 20-oct-2026 la visita salía del navegador y se perdía si la persona se iba antes de que cargara PostHog: esas semanas
> tienen la columna en cero.

```sql
with vis as (
  select toStartOfWeek(timestamp, 1) as semana,
    count() as visitas,
    uniq(toString(properties.codigo)) as enlaces_abiertos
  from events
  where event = 'invitacion_vista'
    and timestamp >= now() - interval 30 week
    and toString(properties.origen) = 'servidor'
    and toString(properties.modo) = 'invitado'
    and toString(properties.invitador_prueba) != 'true'
    and toString(properties.prueba) != 'true'
  group by semana
),
v as (
  select person_id, any(distinct_id) as invitado, min(timestamp) as t, argMin(toString(properties.estado), timestamp) as estado
  from events
  where event = 'referido_vinculado' and timestamp >= now() - interval 30 week and coalesce(person.properties.test_account, false) = false
  group by person_id
),
a as (
  select person_id, groupArray(timestamp) as ts
  from events
  where event = 'analisis_creado' and timestamp >= now() - interval 30 week
  group by person_id
),
p as (
  select toString(properties.invitado) as invitado, argMax(event, timestamp) as resultado, argMax(coalesce(toString(properties.motivo), ''), timestamp) as motivo
  from events
  where event in ('referido_premiado', 'referido_sin_premio') and timestamp >= now() - interval 30 week
  group by invitado
),
reg as (
  select toStartOfWeek(v.t, 1) as semana,
    countIf(v.estado = 'pendiente') as invitados_nuevos,
    countIf(v.estado = 'pendiente' and arrayExists(x -> x >= v.t and x < v.t + interval 30 day, a.ts)) as analizaron_en_30_dias,
    countIf(p.resultado = 'referido_premiado') as premios_pagados,
    countIf(p.motivo = 'mismo_dispositivo') as mismo_dispositivo,
    countIf(p.motivo = 'tope') as sobre_el_tope,
    countIf(v.estado = 'cuenta_previa') as ya_tenian_cuenta
  from v left join a on a.person_id = v.person_id left join p on p.invitado = v.invitado
  group by semana
)
select greatest(coalesce(vis.semana, toDate('1970-01-01')), coalesce(reg.semana, toDate('1970-01-01'))) as semana,
  coalesce(vis.visitas, 0) as visitas,
  coalesce(vis.enlaces_abiertos, 0) as enlaces_abiertos,
  coalesce(reg.invitados_nuevos, 0) as invitados_nuevos,
  if(visitas = 0, null, round(invitados_nuevos / visitas, 3)) as registro_por_visita,
  coalesce(reg.analizaron_en_30_dias, 0) as analizaron_en_30_dias,
  if(invitados_nuevos = 0, null, round(analizaron_en_30_dias / invitados_nuevos, 3)) as activacion,
  coalesce(reg.premios_pagados, 0) as premios_pagados,
  coalesce(reg.mismo_dispositivo, 0) as mismo_dispositivo,
  coalesce(reg.sobre_el_tope, 0) as sobre_el_tope,
  coalesce(reg.ya_tenian_cuenta, 0) as ya_tenian_cuenta
from vis full outer join reg on vis.semana = reg.semana
order by semana desc
```

Un dispositivo anotado en `invitaciones.dispositivos` NO es una visita: lo anota también pedir el enlace desde el
dashboard («Invita a alguien») o al compartir un informe. Las visitas se cuentan solo con `invitacion_vista`.

## El embudo pagado contra orgánico (HogQL)

> 20-oct-2026. El insight «Embudo pagado contra orgánico por semana» (hTrhpWKc del mismo dashboard) arranca en la vista
> del servidor de las páginas de entrada —la landing, /deptos y /i/CÓDIGO de un invitado—, no en el primer `$pageview` del
> navegador: quien rebota antes de que cargue PostHog ahora cuenta. `llegaron` = personas con una vista del servidor (sin
> visitas de prueba ni enlaces de cuentas de prueba); `canal` = el de esa primera vista (los UTM); `cargaron_la_pagina` =
> las que además tienen un `$pageview` del navegador (el mismo id: `Server-Timing`); `rebote_antes_de_cargar` = 1 −
> cargaron / llegaron. Los pasos siguientes, por la misma persona. Las semanas anteriores al 20-oct-2026 no tienen vistas
> del servidor: salen en cero.

```sql
with llegadas as (
  select person_id,
    min(timestamp) as t0,
    argMin(toString(properties.canal), timestamp) as canal
  from events
  where event in ('landing_viewed', 'deptos_vista', 'invitacion_vista')
    and timestamp >= now() - interval 16 week
    and toString(properties.origen) = 'servidor'
    and toString(properties.prueba) != 'true'
    and (event != 'invitacion_vista' or (toString(properties.modo) = 'invitado' and toString(properties.invitador_prueba) != 'true'))
    and coalesce(person.properties.test_account, false) = false
  group by person_id
),
pasos as (
  select person_id,
    countIf(event = '$pageview') > 0 as cargo,
    countIf(event = 'wizard4_answered') > 0 as wizard,
    countIf(event = 'informe_visto' and properties.es_owner = true) > 0 as informe,
    countIf(event in ('cuenta_atribuida', 'registro_completado', 'signup_completed')) > 0 as registro,
    countIf(event = 'pago_confirmado') > 0 as compra
  from events
  where timestamp >= now() - interval 16 week
    and event in ('$pageview', 'wizard4_answered', 'informe_visto', 'cuenta_atribuida', 'registro_completado', 'signup_completed', 'pago_confirmado')
  group by person_id
)
select toStartOfWeek(l.t0, 1) as semana,
  if(l.canal = 'pagado', 'pagado', 'orgánico') as origen,
  count() as llegaron,
  countIf(p.cargo) as cargaron_la_pagina,
  round(1 - cargaron_la_pagina / llegaron, 3) as rebote_antes_de_cargar,
  countIf(p.wizard) as empezaron_wizard,
  countIf(p.informe) as vieron_su_informe,
  countIf(p.registro) as se_registraron,
  countIf(p.compra) as compraron,
  round(se_registraron / llegaron, 4) as registro_por_llegada
from llegadas as l left join pasos as p on p.person_id = l.person_id
group by semana, origen
order by semana desc, origen
```

## El re-análisis al precio recomendado (HogQL)

> 21-oct-2026. El insight «Re-análisis al precio recomendado por semana» (EkSxHqOE del mismo dashboard) cuenta los
> informes que salen del botón «Ver el informe completo a UF X» del pop-up Ajustar: `informes_reanalisis` (un
> `reanalisis_precio` por informe), cuántos con saldo y cuántos pagados (la compra del suelto), por modalidad, el descuento
> promedio y `parte_de_los_creados` = los hechos con saldo / todos los `analisis_creado` de la semana (los dos con saldo:
> un informe pagado en la compra del suelto no emite `analisis_creado`). Sin cuentas de prueba.

```sql
with re as (
  select toStartOfWeek(timestamp, 1) as semana,
    count() as informes,
    uniq(person_id) as personas,
    countIf(toString(properties.con_pago) = 'false') as con_saldo,
    countIf(toString(properties.con_pago) = 'true') as con_pago,
    countIf(toString(properties.modalidad) = 'ltr') as renta_larga,
    countIf(toString(properties.modalidad) = 'str') as renta_corta,
    round(avg(toFloat(properties.descuento_pct)), 1) as descuento_promedio_pct
  from events
  where event = 'reanalisis_precio'
    and timestamp >= now() - interval 26 week
    and coalesce(person.properties.test_account, false) = false
  group by semana
),
creados as (
  select toStartOfWeek(timestamp, 1) as semana,
    count() as informes_creados
  from events
  where event = 'analisis_creado'
    and timestamp >= now() - interval 26 week
    and coalesce(person.properties.test_account, false) = false
  group by semana
)
select greatest(coalesce(re.semana, toDate('1970-01-01')), coalesce(creados.semana, toDate('1970-01-01'))) as semana,
  coalesce(re.informes, 0) as informes_reanalisis,
  coalesce(re.personas, 0) as personas,
  coalesce(re.con_saldo, 0) as con_saldo,
  coalesce(re.con_pago, 0) as con_pago,
  coalesce(re.renta_larga, 0) as renta_larga,
  coalesce(re.renta_corta, 0) as renta_corta,
  re.descuento_promedio_pct as descuento_promedio_pct,
  coalesce(creados.informes_creados, 0) as informes_creados_con_saldo,
  if(informes_creados_con_saldo = 0, null, round(con_saldo / informes_creados_con_saldo, 3)) as parte_de_los_creados
from re full outer join creados on re.semana = creados.semana
order by semana desc
```
