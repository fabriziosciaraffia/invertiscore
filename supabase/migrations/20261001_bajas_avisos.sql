-- La frescura de los usados (01-oct-2026). El pase completo del listado pasa de semanal a diario y lo que
-- deja de aparecer se desactiva (Fase C del backfill). Lo que estaba evaluado y se desactivó se anota
-- acá —con su veredicto, cuándo lo vimos primero y cuándo se fue— y sale de `avisos_evaluados` (y con
-- eso de la guía). Es la base para medir cuánto dura publicado un aviso que da Comprar.
-- Aplicada el 01-oct-2026 por MCP (`bajas_avisos`); este archivo es su registro.

create table if not exists public.bajas_avisos (
  aviso_id uuid primary key,
  comuna text not null,
  condicion text,
  -- scraped_properties.created_at: la primera vez que el listado lo trajo (con el pase diario, ±1 día
  -- de la publicación; los vistos en el backfill inicial del 02-sep no dicen cuándo se publicaron).
  visto_desde timestamp,
  -- scraped_properties.scraped_at: la última vez que el listado lo trajo.
  visto_hasta timestamp,
  baja_at timestamptz not null default now(),
  precio_uf numeric,
  veredicto_20 text,
  score_20 integer,
  veredicto_30 text,
  motor_version text
);
create index if not exists bajas_avisos_comuna_baja on public.bajas_avisos (comuna, baja_at);
alter table public.bajas_avisos enable row level security;
revoke all on public.bajas_avisos from anon, authenticated;

-- Anota y saca de avisos_evaluados todo lo evaluado cuya fila del listado quedó inactiva. Idempotente.
-- Devuelve cuántas salieron.
create or replace function public.cerrar_bajas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into bajas_avisos (aviso_id, comuna, condicion, visto_desde, visto_hasta, baja_at, precio_uf, veredicto_20, score_20, veredicto_30, motor_version)
  select ae.aviso_id, ae.comuna, ae.condicion, sp.created_at, sp.scraped_at, now(), ae.precio_uf, ae.veredicto_20, ae.score_20, ae.veredicto_30, ae.motor_version
  from avisos_evaluados ae
  join scraped_properties sp on sp.id = ae.aviso_id
  where sp.is_active = false
  on conflict (aviso_id) do update set
    visto_hasta = excluded.visto_hasta, baja_at = excluded.baja_at, precio_uf = excluded.precio_uf,
    veredicto_20 = excluded.veredicto_20, score_20 = excluded.score_20, veredicto_30 = excluded.veredicto_30,
    motor_version = excluded.motor_version;
  delete from avisos_evaluados ae
  using scraped_properties sp
  where sp.id = ae.aviso_id and sp.is_active = false;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cerrar_bajas() from public, anon, authenticated;
grant execute on function public.cerrar_bajas() to service_role;
