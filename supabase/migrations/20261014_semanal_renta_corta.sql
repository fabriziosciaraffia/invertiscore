-- El semanal de renta corta (14-oct-2026, decisión de Fabrizio). Quien tiene un perfil de renta corta recibe, en el
-- mismo correo, un bloque de renta corta ESTIMADO POR ZONA: el motor de renta corta sobre los avisos de sus comunas
-- con la tarifa y la ocupación típicas de la zona que ya están en el caché de mercado, sin consultas nuevas. Las
-- consultas al proveedor quedan solo para «Analizar este», que mide fino y, si el veredicto cambia, no cobra.

-- 1 · El bloque de renta corta vive en la MISMA fila de la semana (un correo, dos bloques). `estado` sigue siendo el
-- de la fila entera (pendiente si algún bloque lo está); `estado_str` es el del bloque, null si no tiene perfil.
alter table public.semanal_selecciones
  add column if not exists items_str jsonb not null default '[]'::jsonb,
  add column if not exists estado_str text null,
  add column if not exists combinacion_str jsonb null,
  add column if not exists perfil_str jsonb null,
  add column if not exists origen_str_analysis_id uuid null;
alter table public.semanal_selecciones drop constraint if exists semanal_selecciones_estado_str_check;
alter table public.semanal_selecciones add constraint semanal_selecciones_estado_str_check
  check (estado_str is null or estado_str in ('pendiente', 'armada', 'sin_match'));

-- 2 · El candado de «Analizar este» en renta corta: un informe por persona y aviso, el cobro anotado antes de crear
-- (como guia_analisis, que es de renta larga: un mismo aviso puede analizarse en las dos modalidades).
create table if not exists public.semanal_str_analisis (
  user_id uuid not null references auth.users(id) on delete cascade,
  aviso_id uuid not null,
  origen_analysis_id uuid null,
  analysis_id uuid null,
  pie_pct numeric null,
  plazo integer null,
  reclamado_at timestamptz not null default now(),
  cobrado_at timestamptz null,
  charge_mode text null,
  creado_at timestamptz null,
  primary key (user_id, aviso_id)
);
alter table public.semanal_str_analisis enable row level security;
revoke all on public.semanal_str_analisis from anon, authenticated;

-- 3 · Cada comparación de la zona contra la medición fina, para saber cuántas veces el veredicto cambia (se revisa
-- en un mes). Una por persona y aviso: la medición fina queda en caché y repetirla no aporta otra observación.
create table if not exists public.comparaciones_zona_str (
  user_id uuid not null references auth.users(id) on delete cascade,
  aviso_id uuid not null,
  seleccion_id uuid null references public.semanal_selecciones(id) on delete set null,
  -- El veredicto que vio la persona en su selección (estimado por zona) y su puntaje.
  zona_mostrado text not null,
  zona_score integer null,
  -- La zona recalculada al momento de medir (mismo cuerpo que la medición fina: aísla lo que mide el proveedor).
  zona_veredicto text null,
  zona_adr numeric null,
  zona_ocupacion numeric null,
  fino_veredicto text not null,
  fino_score integer null,
  fino_adr numeric null,
  fino_ocupacion numeric null,
  cambio boolean not null,
  cobrado boolean not null default false,
  analysis_id uuid null,
  medido_at timestamptz not null default now(),
  primary key (user_id, aviso_id)
);
create index if not exists comparaciones_zona_str_medido on public.comparaciones_zona_str (medido_at);
alter table public.comparaciones_zona_str enable row level security;
revoke all on public.comparaciones_zona_str from anon, authenticated;

-- 4 · Los candidatos de renta corta: los mismos filtros que semanal_candidatos (estudios incluidos), pero los MÁS
-- BARATOS DE CADA CELDA comuna × dormitorios. En una celda la tarifa típica es una sola, así que el más barato es el
-- de mayor rendimiento por zona; el servidor los ordena entre celdas con la tarifa de cada una.
create or replace function public.semanal_candidatos_str(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, por_celda integer
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language sql stable
set search_path to 'public', 'pg_temp'
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
      and sp.scraped_at >= desde
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
revoke execute on function public.semanal_candidatos_str(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;
