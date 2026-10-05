-- El aviso inmediato (05-oct-2026, decisión de Fabrizio): a quien respondió «Ya» a «¿Cuándo piensas
-- comprar?», el mismo día que aparece un aviso nuevo que da Comprar con su perfil y sigue publicado.
-- Un correo por día por persona (unique user_id, dia): si hay varios deptos, van juntos. El token firma
-- los enlaces (clic, dejar de recibir los avisos) sin exponer el user id. Solo el servidor.
create table if not exists public.avisos_inmediatos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  items jsonb not null default '[]'::jsonb,
  aviso_ids uuid[] not null default '{}',
  combinacion jsonb null,
  perfil jsonb null,
  origen_analysis_id uuid null,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  creado_at timestamptz not null default now(),
  enviado_at timestamptz null,
  resend_id text null,
  unique (user_id, dia)
);
create index if not exists avisos_inmediatos_user on public.avisos_inmediatos (user_id, dia desc);
alter table public.avisos_inmediatos enable row level security;
revoke all on public.avisos_inmediatos from anon, authenticated;

-- Dejar de recibir los avisos inmediatos sin perder el semanal; y la pregunta de los 60 días
-- («¿Cuándo piensas comprar?» otra vez, con su token para responder con un clic).
alter table public.perfil_busqueda add column if not exists inmediato_baja_at timestamptz null;
alter table public.perfil_busqueda add column if not exists ya_pregunta_at timestamptz null;
alter table public.perfil_busqueda add column if not exists ya_pregunta_token text null unique;

-- Los candidatos del aviso: como los del semanal, pero solo los avisos que ENTRARON desde `nuevos_desde`.
create or replace function public.inmediato_candidatos(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, nuevos_desde timestamp, max_filas integer
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
    and sp.created_at >= nuevos_desde
    and sp.comuna = any(comunas)
    and sp.dormitorios = any(dorms)
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
  order by greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) desc, sp.id
  limit max_filas;
$$;
revoke execute on function public.inmediato_candidatos(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;
