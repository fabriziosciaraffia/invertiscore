-- ─────────────────────────────────────────────────────────────────────────────
-- inmediato_candidatos se cortó por timeout el 25-oct-2026 09:40 (Sentry). Medido el 26-oct: como función SQL el plan es
-- GENÉRICO —no conoce `nuevos_desde`— y recorre los avisos por comuna (~100.000 buffers, 130 a 490 ms con la base
-- tranquila, y más de los 8 s del statement_timeout cuando está ocupada). Con los valores a la vista usa el índice de
-- created_at (idx_scraped_venta_activa_creado) y tarda 12 ms. plpgsql con EXECUTE … USING planea cada llamada con sus
-- valores. Lo mismo para la gemela de renta corta. Mismas firmas y mismas columnas.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.inmediato_candidatos(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, nuevos_desde timestamp, max_filas integer
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $$
begin
  return query execute $q$
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
      and sp.created_at >= $5
      and sp.comuna = any($1)
      and (sp.dormitorios = any($2) or (0 = any($2) and public.es_estudio(sp.dormitorios, sp.titulo)))
      and ae.precio_uf between $3 and $4
      and ae.arriendo is not null
      and ae.arriendo_sospechoso is not true
      and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
    order by greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) desc, sp.id
    limit $6
  $q$ using comunas, dorms, uf_min, uf_max, nuevos_desde, max_filas;
end;
$$;
revoke execute on function public.inmediato_candidatos(text[], integer[], numeric, numeric, timestamp, integer) from public, anon, authenticated;

create or replace function public.inmediato_candidatos_str(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, nuevos_desde timestamp without time zone, por_celda integer
)
returns table (
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text,
  arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language plpgsql stable
set search_path = public, pg_temp
as $$
begin
  return query execute $q$
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
        and sp.created_at >= $5
        and sp.comuna = any($1)
        and (sp.dormitorios = any($2) or (0 = any($2) and public.es_estudio(sp.dormitorios, sp.titulo)))
        and ae.precio_uf between $3 and $4
        and ae.arriendo is not null
        and ae.arriendo_sospechoso is not true
        and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
    ) x
    where x.rn <= $6
    order by x.precio_uf asc, x.id
  $q$ using comunas, dorms, uf_min, uf_max, nuevos_desde, por_celda;
end;
$$;
revoke execute on function public.inmediato_candidatos_str(text[], integer[], numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;
