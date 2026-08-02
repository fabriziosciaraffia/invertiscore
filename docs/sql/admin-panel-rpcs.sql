-- ═══════════════════════════════════════════════════════════════════════════
-- RPCs del panel admin — capa de tendencia y agregados del resumen
--
-- CORRER A MANO en el SQL editor de Supabase. NO es una migración: el repo no
-- versiona el esquema de estas funciones (mismo criterio que admin_list_users y
-- admin_metrics, que ya viven en la base sin migración).
--
-- Las dos funciones son SECURITY DEFINER porque leen auth.users, y quedan con
-- grant SOLO a service_role: el panel las llama con el client que devuelve
-- requireAdminPage() (src/lib/admin-auth.ts), siempre después del gate de
-- allowlist. Ningún rol de cliente puede ejecutarlas.
--
-- search_path fijado a public para que un search_path del caller no pueda
-- desviar las referencias de tabla dentro de una función definer.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1) admin_weekly_stats — serie semanal y cohortes
--
-- Devuelve una fila por semana (lunes) para las últimas p_weeks semanas,
-- SIEMPRE las p_weeks completas: las semanas sin actividad vuelven en cero en
-- vez de faltar, para que el gráfico no invente continuidad donde hubo un hueco.
--
-- Tres columnas y ojo con la diferencia, que no es sutil:
--   registros          = usuarios que se registraron EN esa semana.
--   activaciones       = usuarios cuyo PRIMER análisis cayó en esa semana
--                        (pueden haberse registrado antes: es actividad, no cohorte).
--   cohorte_activados  = usuarios registrados en esa semana que activaron ALGUNA
--                        vez (esta es la cohorte: divide por `registros`).
--
-- "Activar" acá es "generó su primer análisis", que NO es lo mismo que el
-- welcome_credit_used del funnel: hoy hay 32 usuarios con al menos un análisis y
-- 28 con el crédito de bienvenida marcado. Son dos preguntas distintas y ambas
-- valen; no unificarlas por parecer inconsistentes.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.admin_weekly_stats(
  p_weeks int default 12,
  p_include_test boolean default false
)
returns table (
  semana date,
  registros int,
  activaciones int,
  cohorte_activados int
)
language sql
stable
security definer
set search_path = public
as $$
  with grilla as (
    select generate_series(
      (date_trunc('week', now()) - make_interval(weeks => greatest(p_weeks, 1) - 1))::date,
      date_trunc('week', now())::date,
      interval '7 days'
    )::date as semana
  ),
  usuarios as (
    select
      u.id,
      date_trunc('week', u.created_at)::date as semana_alta
    from auth.users u
    where p_include_test
       or not exists (select 1 from public.test_accounts t where t.user_id = u.id)
  ),
  primer_analisis as (
    select
      a.user_id,
      date_trunc('week', min(a.created_at))::date as semana_activacion
    from public.analisis a
    where a.user_id is not null
    group by a.user_id
  )
  select
    g.semana,
    coalesce(r.n, 0)::int  as registros,
    coalesce(ac.n, 0)::int as activaciones,
    coalesce(co.n, 0)::int as cohorte_activados
  from grilla g
  left join (
    select u.semana_alta as semana, count(*) as n
    from usuarios u
    group by u.semana_alta
  ) r on r.semana = g.semana
  left join (
    select p.semana_activacion as semana, count(*) as n
    from usuarios u
    join primer_analisis p on p.user_id = u.id
    group by p.semana_activacion
  ) ac on ac.semana = g.semana
  left join (
    select u.semana_alta as semana, count(*) as n
    from usuarios u
    join primer_analisis p on p.user_id = u.id
    group by u.semana_alta
  ) co on co.semana = g.semana
  order by g.semana;
$$;

revoke all on function public.admin_weekly_stats(int, boolean) from public;
revoke all on function public.admin_weekly_stats(int, boolean) from anon;
revoke all on function public.admin_weekly_stats(int, boolean) from authenticated;
grant execute on function public.admin_weekly_stats(int, boolean) to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 2) admin_overview — funnel y KPIs en una fila
--
-- Reemplaza el TODO(admin-metrics) que quedó en src/app/admin/page.tsx: el panel
-- derivaba tres etapas del funnel trayendo hasta 1000 filas de usuarios a JS.
-- Acá son COUNT y COUNT DISTINCT: no viaja ninguna fila.
--
-- CRITERIO DE PAGO REAL (repetido acá a propósito, es el corazón del asunto):
-- payments no guarda solo transacciones. Las filas product='analysis_charge' con
-- amount=0 son el registro de consumo del análisis gratis. Un pago de verdad es
-- status='paid' AND amount > 0 AND product <> 'analysis_charge'.
--
-- `product is distinct from 'analysis_charge'` en vez de `<>`: en SQL el `<>`
-- sobre NULL da NULL, no true, y se comería las filas con product sin valor.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.admin_overview(
  p_include_test boolean default false
)
returns table (
  registrados int,
  usaron_gratis int,
  iniciaron_checkout int,
  pagaron int,
  nuevos_30d int,
  ingresos_30d bigint,
  analisis_30d int
)
language sql
stable
security definer
set search_path = public
as $$
  with usuarios as (
    select u.id, u.created_at
    from auth.users u
    where p_include_test
       or not exists (select 1 from public.test_accounts t where t.user_id = u.id)
  )
  select
    (select count(*) from usuarios)::int,

    (select count(*)
       from usuarios u
       join public.user_credits c on c.user_id = u.id
      where c.welcome_credit_used is true)::int,

    (select count(distinct p.user_id)
       from public.payments p
       join usuarios u on u.id = p.user_id
      where p.status = 'pending'
        and p.amount > 0
        and p.product is distinct from 'analysis_charge')::int,

    (select count(distinct p.user_id)
       from public.payments p
       join usuarios u on u.id = p.user_id
      where p.status = 'paid'
        and p.amount > 0
        and p.product is distinct from 'analysis_charge')::int,

    (select count(*) from usuarios u
      where u.created_at >= now() - interval '30 days')::int,

    (select coalesce(sum(p.amount), 0)
       from public.payments p
       join usuarios u on u.id = p.user_id
      where p.status = 'paid'
        and p.amount > 0
        and p.product is distinct from 'analysis_charge'
        and p.created_at >= now() - interval '30 days')::bigint,

    (select count(*)
       from public.analisis a
      where a.created_at >= now() - interval '30 days'
        and (p_include_test
             or a.user_id is null
             or not exists (select 1 from public.test_accounts t where t.user_id = a.user_id)))::int;
$$;

revoke all on function public.admin_overview(boolean) from public;
revoke all on function public.admin_overview(boolean) from anon;
revoke all on function public.admin_overview(boolean) from authenticated;
grant execute on function public.admin_overview(boolean) to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- Comprobación rápida después de correrlas (debería dar los mismos números que
-- el panel muestra hoy, al 2026-08-02: 48 / 28 / 0 / 0 y 12 filas de semanas).
-- ───────────────────────────────────────────────────────────────────────────
-- select * from public.admin_overview(false);
-- select * from public.admin_weekly_stats(12, false);
