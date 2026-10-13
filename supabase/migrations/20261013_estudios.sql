-- Quien busca estudio recibe estudios (13-oct-2026). El perfil «estudio» guarda 0 dormitorios y ningún aviso tenía
-- 0: la fuente lo manda, pero el scraper lo dejaba en NULL (se corrige en el código del mismo cambio), y los que el
-- corredor publica como 1D quedaban como 1D. `es_estudio` es el criterio (espejo de src/lib/avisos/estudio.ts; el
-- tier ESTUDIOS exige que coincidan): 0 dormitorios, o 1 dormitorio con «Studio», «Home Studio», «Estudio»,
-- «Monoambiente» o «1 ambiente» en el título, sin «más / + / y / con estudio» (eso es una pieza de estudio).
--
-- Las dos consultas de candidatos (correo semanal y aviso inmediato) cambian en DOS cosas, sin tocar la firma:
--   · a quien busca 0 dormitorios le entran los estudios;
--   · todo estudio sale con 0 dormitorios, así el motor lo evalúa como estudio y el correo lo nombra «Estudio».

create or replace function public.es_estudio(dormitorios integer, titulo text)
returns boolean
language sql immutable
set search_path to 'public', 'pg_temp'
as $$
  select dormitorios = 0
    or (dormitorios = 1
        and coalesce(titulo, '') ~* '(^|[^a-z0-9áéíóúñ])(home ?studio|studio|estudio|monoambiente|mono ?ambiente|1 ?ambiente)($|[^a-z0-9áéíóúñ])'
        and coalesce(titulo, '') !~* '(m[aá]s|\+|(^|[^a-z0-9áéíóúñ])y|con)\s*estudio');
$$;
revoke execute on function public.es_estudio(integer, text) from public, anon, authenticated;

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
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna, greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0))
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
  order by greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) desc, sp.id
  limit max_filas;
$$;
revoke execute on function public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;

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
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna, greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0))
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
  order by greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) desc, sp.id
  limit max_filas;
$$;
revoke execute on function public.inmediato_candidatos(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;
