-- La guía solo muestra avisos PUBLICADOS (01-oct-2026). Aplicada el 01-oct-2026 por MCP en dos pasos
-- (`guia_publicados` y `lecturas_ficha_tipo`); este archivo es su registro.
--   · fichas_leidas: el código y el motivo de la última lectura de cada ficha.
--   · lecturas_ficha: la bitácora de cada GET a una ficha (tope por hora y panel de operación).
--   · publicacion_avisos: el último chequeo de cada aviso; un despublicado queda marcado para siempre.
--   · guia_candidatos: no devuelve despublicados, y dice cuándo se chequeó el publicado.

alter table public.fichas_leidas add column if not exists codigo integer null, add column if not exists motivo text null check (motivo in ('publicado', 'despublicado', 'bloqueo', 'error', 'tiempo'));

create table if not exists public.lecturas_ficha (
  id bigserial primary key,
  aviso_id uuid not null,
  tipo text not null check (tipo in ('guia', 'clic')),
  codigo integer null,
  motivo text not null check (motivo in ('publicado', 'despublicado', 'bloqueo', 'error', 'tiempo')),
  destino text null,
  leido_at timestamptz not null default now()
);
create index if not exists lecturas_ficha_leido_at on public.lecturas_ficha (leido_at);
alter table public.lecturas_ficha enable row level security;

create table if not exists public.publicacion_avisos (
  aviso_id uuid primary key,
  estado text not null check (estado in ('publicado', 'despublicado')),
  codigo integer null,
  destino text null,
  chequeado_at timestamptz not null default now()
);
alter table public.publicacion_avisos enable row level security;
revoke all on public.lecturas_ficha, public.publicacion_avisos from anon, authenticated;

drop function if exists public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp, integer);
create function public.guia_candidatos(
  center_lat double precision, center_lng double precision, radius_meters integer, prop_dorms integer,
  m2_min numeric, m2_max numeric, uf_min numeric, uf_max numeric, desde timestamp, max_filas integer
)
returns table (
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, distance_meters double precision,
  precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb,
  gastos_comunes integer, contribuciones integer, mediana_comuna jsonb,
  publicado_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2, sp.dormitorios, sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url,
    st_distance(sp.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography) as distance_meters,
    ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta, ae.gastos_comunes, ae.contribuciones,
    ae.mediana_comuna,
    (select pa.chequeado_at from publicacion_avisos pa where pa.aviso_id = sp.id and pa.estado = 'publicado')
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.location is not null
    and sp.scraped_at >= desde
    and sp.dormitorios = prop_dorms
    and sp.superficie_m2 between m2_min and m2_max
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
    and st_dwithin(sp.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography, radius_meters)
  order by distance_meters
  limit max_filas;
$$;
revoke all on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp, integer) from public, anon, authenticated;
grant execute on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp, integer) to service_role;
