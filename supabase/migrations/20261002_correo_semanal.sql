-- El correo semanal (02-oct-2026): la selección de cada persona para el lunes. El domingo se arma
-- (estado 'armada' con sus deptos publicados, 'sin_match' si no juntó tres, 'pendiente' si faltó cupo
-- para chequear fichas); el lunes sale el correo de las armadas (enviada_at). El token firma los
-- enlaces del correo (clic a un depto, dejar de recibirlo) sin exponer el user id. Solo el servidor.
create table if not exists public.semanal_selecciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semana date not null,
  estado text not null check (estado in ('pendiente', 'armada', 'sin_match', 'enviada', 'descartada')),
  items jsonb not null default '[]'::jsonb,
  combinacion jsonb null,
  perfil jsonb null,
  origen_analysis_id uuid null,
  variante text null check (variante is null or variante in ('banda', 'tarjetas')),
  con_regalo boolean not null default false,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  armada_at timestamptz not null default now(),
  enviada_at timestamptz null,
  resend_id text null,
  unique (user_id, semana)
);
create index if not exists semanal_selecciones_semana on public.semanal_selecciones (semana, estado);
alter table public.semanal_selecciones enable row level security;
revoke all on public.semanal_selecciones from anon, authenticated;

-- Los candidatos de la semana para un perfil: avisos evaluados de sus comunas y dormitorios, en su rango
-- de precio, vistos en la ventana, sin arriendo sospechoso y sin despublicados. Los de mejor puntaje del
-- cron primero (el servidor los recalcula con el pie y el plazo de la persona).
create or replace function public.semanal_candidatos(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, max_filas integer
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2, sp.dormitorios, sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna, greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0))
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and sp.dormitorios = any(dorms)
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
  order by greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) desc, sp.id
  limit max_filas;
$$;
revoke execute on function public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;
