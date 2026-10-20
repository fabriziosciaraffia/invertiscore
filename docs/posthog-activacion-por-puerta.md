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

El insight «Activación por puerta · 1 h / 1 día / 30 días» del dashboard corre esta consulta (los registrados son los
`cuenta_atribuida` del rango de fechas del panel; la ventana se mide desde ese evento):

```sql
WITH reg AS (
  SELECT person_id, min(timestamp) AS t0, argMin(properties.puerta, timestamp) AS puerta
  FROM events
  WHERE event = 'cuenta_atribuida' AND {filters}
  GROUP BY person_id
),
vis AS (SELECT person_id, min(timestamp) AS tv FROM events WHERE event = 'primera_seleccion_vista' GROUP BY person_id),
ana AS (SELECT person_id, min(timestamp) AS ta FROM events WHERE event = 'analisis_creado' GROUP BY person_id)
SELECT
  coalesce(reg.puerta, 'D') AS puerta,
  count() AS registrados,
  countIf(vis.tv IS NOT NULL AND vis.tv <= reg.t0 + INTERVAL 1 HOUR) AS vieron_seleccion_1h,
  countIf(ana.ta IS NOT NULL AND ana.ta <= reg.t0 + INTERVAL 1 HOUR) AS analizaron_1h,
  countIf(ana.ta IS NOT NULL AND ana.ta <= reg.t0 + INTERVAL 1 DAY) AS analizaron_1d,
  countIf(ana.ta IS NOT NULL AND ana.ta <= reg.t0 + INTERVAL 30 DAY) AS analizaron_30d,
  round(100 * analizaron_1h / registrados, 1) AS pct_1h,
  round(100 * analizaron_1d / registrados, 1) AS pct_1d,
  round(100 * analizaron_30d / registrados, 1) AS pct_30d
FROM reg
LEFT JOIN vis ON vis.person_id = reg.person_id
LEFT JOIN ana ON ana.person_id = reg.person_id
GROUP BY puerta
ORDER BY registrados DESC
```

Las cuentas de prueba quedan fuera por el filtro de cuentas internas del proyecto (el mismo del resto del panel). Una
cuenta registrada hace menos de 30 días todavía puede entrar en la columna de 30 días: la fila se lee como «hasta hoy».
