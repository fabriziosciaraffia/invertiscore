-- «Por dónde seguir buscando» (FASE 2 de los avisos evaluados, 30-sep-2026).
-- Todo con RLS y sin políticas: lo leen y escriben solo las rutas del servidor con service role.

-- La ficha del aviso, leída a demanda UNA vez (resguardos de CLAUDE.md). La fila se reserva antes de
-- salir ('reservada') y se cierra con lo que trajo. Cuenta para el tope global por hora.
create table if not exists public.fichas_leidas (
  aviso_id uuid primary key,
  edificio text not null,
  estado text not null default 'reservada' check (estado in ('reservada', 'anio', 'sin_anio', 'error')),
  anio integer null,
  leido_at timestamptz not null default now()
);
create index if not exists fichas_leidas_leido_at on public.fichas_leidas (leido_at);
alter table public.fichas_leidas enable row level security;

-- El año de un edificio, compartido por todos sus avisos.
create table if not exists public.anios_edificio (
  edificio text primary key,
  anio integer not null,
  aviso_id uuid null,
  leido_at timestamptz not null default now()
);
alter table public.anios_edificio enable row level security;

-- «Analizar este»: una fila por persona y aviso. La clave primaria es lo que hace que el crédito se
-- descuente UNA sola vez: el segundo clic encuentra la fila y devuelve el informe ya creado.
create table if not exists public.guia_analisis (
  user_id uuid not null,
  aviso_id uuid not null,
  origen_analysis_id uuid null,
  analysis_id uuid null,
  pie_pct numeric null,
  plazo integer null,
  reclamado_at timestamptz not null default now(),
  -- El cobro quedó hecho: un reintento después de una falla no vuelve a cobrar.
  cobrado_at timestamptz null,
  charge_mode text null,
  creado_at timestamptz null,
  primary key (user_id, aviso_id)
);
alter table public.guia_analisis enable row level security;

-- «Quiero verlo»: el interés, uno por informe. Lo gestiona Franco a mano desde el correo a hola@.
create table if not exists public.interes_avisos (
  analysis_id uuid primary key,
  user_id uuid not null,
  aviso_id uuid not null,
  veredicto text null,
  score integer null,
  perfil jsonb null,
  created_at timestamptz not null default now(),
  correo_enviado_at timestamptz null
);
alter table public.interes_avisos enable row level security;

revoke all on public.fichas_leidas, public.anios_edificio, public.guia_analisis, public.interes_avisos from anon, authenticated;

-- Los candidatos de la guía: avisos de venta activos, vistos desde `desde`, del mismo número de
-- dormitorios, m² y precio en rango, con evaluación y arriendo no sospechoso, a lo más `radius_meters`,
-- los más cercanos primero.
create or replace function public.guia_candidatos(
  center_lat double precision, center_lng double precision, radius_meters integer, prop_dorms integer,
  m2_min numeric, m2_max numeric, uf_min numeric, uf_max numeric, desde timestamp, max_filas integer
)
returns table (
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, distance_meters double precision,
  precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb,
  gastos_comunes integer, contribuciones integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2, sp.dormitorios, sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url,
    st_distance(sp.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography) as distance_meters,
    ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta, ae.gastos_comunes, ae.contribuciones
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
    and st_dwithin(sp.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography, radius_meters)
  order by distance_meters
  limit max_filas;
$$;
revoke all on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp, integer) from public, anon, authenticated;
grant execute on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp, integer) to service_role;
