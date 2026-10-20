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
