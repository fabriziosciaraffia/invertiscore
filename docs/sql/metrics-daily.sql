-- ═══════════════════════════════════════════════════════════════════════════
-- metrics_daily — métricas diarias de fuentes externas
--
-- CORRER A MANO en el SQL editor de Supabase. NO es una migración: mismo
-- criterio que admin_list_users, test_accounts y las columnas ai_*.
--
-- Para qué: el panel nunca debe llamar en vivo a una API de terceros al
-- renderizar. Un timeout de Sentry no puede dejar /admin/operacion colgado, y
-- una pastilla no justifica pagar latencia de red en cada visita. El cron
-- diario escribe acá; el panel lee de acá.
--
-- La tabla es GENÉRICA a propósito (fuente + metrica + valor) y no
-- `sentry_errors`: la próxima métrica externa —Vercel, Flow, Resend— entra sin
-- crear otra tabla ni otra página de admin.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.metrics_daily (
  -- Día al que corresponde la medición (no cuándo se midió — eso es medido_at).
  fecha      date        not null,
  -- Sistema del que viene: 'sentry', y lo que venga después.
  fuente     text        not null,
  -- Qué se midió: 'errors_1d'. El sufijo declara la ventana de la medición.
  metrica    text        not null,
  -- numeric y no bigint: la próxima métrica puede ser un porcentaje o un monto.
  valor      numeric     not null,
  -- Contexto de la medición: ventana exacta, proyecto consultado, endpoint.
  -- Sirve para auditar un número raro sin volver a la API.
  meta       jsonb,
  medido_at  timestamptz not null default now(),

  -- La PK compuesta ES la idempotencia: el cron hace ON CONFLICT DO UPDATE y
  -- correrlo dos veces el mismo día actualiza la fila en vez de duplicarla.
  primary key (fecha, fuente, metrica)
);

comment on table public.metrics_daily is
  'Métricas diarias de fuentes externas. Escribe el cron; lee /admin. Una fila por (fecha, fuente, métrica).';
comment on column public.metrics_daily.metrica is
  'El sufijo declara la ventana: errors_1d = el día de `fecha`. Las ventanas largas (7d, 30d) se derivan SUMANDO filas al leer, no se guardan.';

-- Lectura del panel: "las últimas N filas de esta fuente+métrica".
create index if not exists idx_metrics_daily_lookup
  on public.metrics_daily (fuente, metrica, fecha desc);

-- RLS prendido y SIN policies: nadie llega por PostgREST con anon/authenticated.
-- El cron escribe con service_role y el panel lee con service_role (después del
-- gate de admin), y ese rol bypassea RLS.
alter table public.metrics_daily enable row level security;


-- ───────────────────────────────────────────────────────────────────────────
-- Por qué NO se guarda una fila 'errors_7d'
--
-- Sería un dato derivable guardado aparte, o sea dos fuentes de verdad para lo
-- mismo. Se desincronizan en cuanto una corrida falla: el 1d de ayer queda y el
-- 7d de hoy ya no lo incluye, o al revés. Sumando las últimas 7 filas al leer,
-- el total siempre es consistente con el detalle, y un día sin dato se ve como
-- un día faltante en vez de contaminar un acumulado.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- Comprobación
-- ───────────────────────────────────────────────────────────────────────────
-- select * from public.metrics_daily order by fecha desc limit 10;
--
-- Errores del último día y suma de los últimos 7 (lo que muestra la pastilla):
-- select
--   (select valor from public.metrics_daily
--     where fuente = 'sentry' and metrica = 'errors_1d'
--     order by fecha desc limit 1)                                as ultimo_dia,
--   (select coalesce(sum(valor), 0) from public.metrics_daily
--     where fuente = 'sentry' and metrica = 'errors_1d'
--       and fecha >= current_date - 6)                            as ultimos_7d;
--
-- Días sin medición en la última semana (huecos = el cron no corrió):
-- select d::date as dia
--   from generate_series(current_date - 6, current_date, interval '1 day') d
--  where not exists (
--    select 1 from public.metrics_daily m
--     where m.fecha = d::date and m.fuente = 'sentry' and m.metrica = 'errors_1d'
--  );
