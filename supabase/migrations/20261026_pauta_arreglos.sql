-- ─────────────────────────────────────────────────────────────────────────────
-- Cuatro arreglos antes de prender la pauta (26-oct-2026, reporte del lunes).
--
-- 1 · LAS CUENTAS INTERNAS, MARCADAS. test_accounts tenía 143 cuentas y le faltaban 15 internas: los alias
--     fabriziosciaraffia+qadeptos…5, +banner…, +19990, +semanalinmediato, +flavio y tres de @refranco.ai o «sciaraffia»
--     sin sufijo. Se agregan sin correos (recibe_correos = false). Y desde hoy NACEN MARCADAS: un trigger en auth.users
--     pone en test_accounts toda cuenta fabriziosciaraffia+…@gmail.com o …@refranco.ai antes del primer correo (el alta
--     y la bienvenida corren después del insert). Quien quiera recibir correos en una cuenta de prueba la marca a mano.
-- 2 · LA SELECCIÓN DIARIA DE RENTA CORTA. avisos_inmediatos guarda de qué modalidad es la fila (la página /semanal la
--     muestra como el bloque corto) y la RPC gemela de semanal_candidatos_str trae los avisos NUEVOS (created_at).
-- 4 · inmediato_candidatos filtraba created_at sin índice: el índice parcial de los avisos de venta activos.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · las internas que faltaban
insert into public.test_accounts (user_id, reason, recibe_correos)
select u.id, 'interna (26-oct-2026): alias de Fabrizio o @refranco.ai', false
from auth.users u
where (u.email ilike 'fabriziosciaraffia+%@gmail.com' or u.email ilike '%@refranco.ai' or u.email ilike '%sciaraffia%')
on conflict (user_id) do nothing;

-- 1 · y nacen marcadas
create or replace function public.marcar_cuenta_interna()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email ilike 'fabriziosciaraffia+%@gmail.com' or new.email ilike '%@refranco.ai' then
    insert into public.test_accounts (user_id, reason, recibe_correos)
    values (new.id, 'interna: nace marcada (26-oct-2026)', false)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.marcar_cuenta_interna() from public, anon, authenticated;

drop trigger if exists marcar_cuenta_interna on auth.users;
create trigger marcar_cuenta_interna
  after insert on auth.users
  for each row execute function public.marcar_cuenta_interna();

-- 2 · la modalidad de la selección diaria
alter table public.avisos_inmediatos add column if not exists modalidad text not null default 'ltr';
alter table public.avisos_inmediatos drop constraint if exists avisos_inmediatos_modalidad_check;
alter table public.avisos_inmediatos add constraint avisos_inmediatos_modalidad_check check (modalidad in ('ltr', 'str'));

-- 2 · los candidatos NUEVOS de renta corta: semanal_candidatos_str con created_at en vez de scraped_at
create or replace function public.inmediato_candidatos_str(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, nuevos_desde timestamp without time zone, por_celda integer
)
returns table (
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text,
  arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  select x.id, x.comuna, x.lat, x.lng, x.superficie_m2, x.dormitorios, x.banos, x.condicion, x.direccion, x.fecha_entrega,
    x.url, x.precio_uf, x.antiguedad_anios, x.antiguedad_origen, x.arriendo, x.venta, x.gastos_comunes, x.mediana_comuna,
    x.score_cron
  from (
    select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
      case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
      sp.banos, coalesce(sp.condicion, 'usado') as condicion,
      sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
      ae.gastos_comunes, ae.mediana_comuna, greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) as score_cron,
      row_number() over (
        partition by sp.comuna, case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end
        order by ae.precio_uf asc, sp.id
      ) as rn
    from scraped_properties sp
    join avisos_evaluados ae on ae.aviso_id = sp.id
    where sp.is_active = true
      and sp.type = 'venta'
      and sp.lat is not null and sp.lng is not null
      and sp.created_at >= nuevos_desde
      and sp.comuna = any(comunas)
      and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
      and ae.precio_uf between uf_min and uf_max
      and ae.arriendo is not null
      and ae.arriendo_sospechoso is not true
      and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
  ) x
  where x.rn <= por_celda
  order by x.precio_uf asc, x.id;
$$;
revoke execute on function public.inmediato_candidatos_str(text[], integer[], numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;

-- 4 · lo nuevo, por índice
create index if not exists idx_scraped_venta_activa_creado on public.scraped_properties (created_at)
  where type = 'venta' and is_active = true;
