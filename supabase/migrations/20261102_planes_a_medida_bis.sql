-- ─────────────────────────────────────────────────────────────────────────────
-- PLANES A MEDIDA, SEGUNDA TANDA (02-nov-2026, goal «cortes por statement_timeout», Fase 1-bis). Se aplica a mano en el
-- SQL Editor.
--
-- El mismo defecto de la Fase 1 (20261102_planes_a_medida.sql) en las otras cinco funciones `language sql` con
-- `set search_path` que filtran scraped_properties × avisos_evaluados con parámetros: no se inlinean y Postgres 17
-- planifica su cuerpo SIN los valores (plan genérico). `semanal_candidatos` ya se cortó en producción por
-- statement_timeout (Sentry JAVASCRIPT-NEXTJS-18, cron semanal-armar, tres personas) y el 02-nov-2026 cortó el golden
-- QUICK (tier ESTUDIOS) mientras el build prerenderizaba. Medido el 02-nov-2026 (EXPLAIN ANALYZE BUFFERS, la función de
-- hoy contra estas mismas creadas como funciones temporales de sesión, mismos argumentos, en la misma transacción):
--   · semanal_candidatos, Santiago, estudio ..................  3.685 ms · 105.565 páginas  →  107 ms ·  5.161
--     (la misma llamada dio 234 ms un rato antes: el plan genérico depende de cómo esté la base; las páginas, no)
--   · semanal_candidatos_str, Santiago + Providencia, 1-2D ...    829 ms · 170.902 páginas  →  150 ms · 34.221
--   · guia_candidatos, 3 km, 2D, 40-75 m², UF 2.000-5.000 .....    273 ms ·  40.075 páginas  →  123 ms ·  6.218
--     (en frío, con páginas leídas de disco, la de hoy dio 1.391 ms)
--   · explorar_pines, 4 comunas, todo dormitorio ............    401 ms ·  75.905 páginas  →  130 ms · 42.878
--   · deptos_candidatos, 3 comunas, 1-2D, UF 2.000-4.500 ......    106 ms ·  26.981 páginas  →   47 ms · 27.658
-- LA SALIDA ES LA MISMA (verificado el 02-nov-2026 con diez juegos de argumentos, dos por función, comparando la salida
-- completa en orden): idéntica en nueve. En guia_candidatos con 3 km, mismas 60 distancias puesto por puesto, ordenadas,
-- pero 16 puestos con otro aviso: ese ORDER BY era solo por distancia y los avisos del mismo edificio empatan, así que el
-- orden entre empatados —y cuál entraba en el puesto 60— lo decidía el plan.
-- EL ÚNICO CAMBIO DE RESULTADO, A PROPÓSITO (decisión de Fabrizio, 02-nov-2026): guia_candidatos desempata por id después
-- de la distancia (`order by distance_meters, sp.id`). Las distancias de cada puesto siguen siendo las mismas; lo que cambia
-- es que, entre avisos a la misma distancia, el orden y el corte del puesto `max_filas` ya no dependen del plan: la misma
-- búsqueda da siempre la misma guía.
-- Quién las llama: el semanal (semanal-servidor.ts y semanal-str-servidor.ts, el cron semanal-armar y el de la renta
-- corta atrasada), la guía del pack al confirmarse el pago (guia-servidor.ts), el mapa del dashboard y su conteo
-- (explorar/servidor.ts › pinesExplorar; explorar_conteo envuelve a explorar_pines y hereda el arreglo) y /deptos
-- (deptos/servidor.ts).
--
-- EL ARREGLO, el mismo de la Fase 1: plpgsql con `set plan_cache_mode = force_custom_plan`, cada llamada se planifica con
-- sus valores. MISMAS FIRMAS, MISMO SELECT, MISMAS COLUMNAS DE SALIDA Y MISMO ORDEN: `return query` con el cuerpo de hoy,
-- sin tocar. `#variable_conflict use_variable`, como en la Fase 1: los nombres sin calificar del SELECT (comunas, desde,
-- pie, plazo, dorms, uf_min, uf_max, max_filas, por_celda, center_lat, …) siguen siendo los parámetros.
-- Fuera, a propósito: properties_within_radius (plpgsql con plan cache; su plan genérico usa el índice espacial y es más
-- rápido que el a medida, 28 ms contra 57 ms), explorar_filas_para_sonda (por id) y estandar25_filas (solo un script).
-- ANOTADAS, SIN TOCAR (decisión de Fabrizio, 02-nov-2026: ni se cambian ni se borran en este goal): las sobrecargas que el
-- código ya no llama, deptos_conteo de cinco argumentos y deptos_candidatos de siete. Siguen en language sql.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '3s';

-- 1 · semanal_candidatos (el semanal de renta larga)
create or replace function public.semanal_candidatos(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, max_filas integer, plazo integer default 30)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna,
    case when plazo <= 27
      then greatest(coalesce(ae.score_20_25, 0), coalesce(ae.score_30_25, 0))
      else greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) end
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
  order by case when plazo <= 27
      then greatest(coalesce(ae.score_20_25, 0), coalesce(ae.score_30_25, 0))
      else greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) end desc, sp.id
  limit max_filas;
end;
$$;
revoke execute on function public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer) from public, anon, authenticated;
grant execute on function public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer) to service_role;

-- 2 · semanal_candidatos_str (el semanal de renta corta: los más baratos de cada celda)
create or replace function public.semanal_candidatos_str(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, por_celda integer)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
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
end;
$$;
revoke execute on function public.semanal_candidatos_str(text[], integer[], numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;
grant execute on function public.semanal_candidatos_str(text[], integer[], numeric, numeric, timestamp without time zone, integer) to service_role;

-- 3 · guia_candidatos (la guía del pack: los más cerca del depto)
create or replace function public.guia_candidatos(center_lat double precision, center_lng double precision, radius_meters integer, prop_dorms integer, m2_min numeric, m2_max numeric, uf_min numeric, uf_max numeric, desde timestamp without time zone, max_filas integer)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, condicion text, direccion text, fecha_entrega text, url text, distance_meters double precision, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, contribuciones integer, mediana_comuna jsonb, publicado_at timestamp with time zone)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
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
  order by distance_meters, sp.id
  limit max_filas;
end;
$$;
revoke execute on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;
grant execute on function public.guia_candidatos(double precision, double precision, integer, integer, numeric, numeric, numeric, numeric, timestamp without time zone, integer) to service_role;

-- 4 · explorar_pines (el mapa del dashboard y, por dentro, explorar_conteo)
create or replace function public.explorar_pines(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, pie integer, plazo integer)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, precio_uf numeric, veredicto text, score integer, flujo integer, arriendo integer, pub_estado text, pub_at timestamp with time zone)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, ae.precio_uf,
    case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end)
         else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end,
    case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end)
         else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end,
    case when plazo = 30 then (case when pie = 30 then ae.flujo_30 else ae.flujo_20 end)
         else (case when pie = 30 then ae.flujo_30_25 else ae.flujo_20_25 end) end,
    nullif(ae.arriendo->>'monto', '')::numeric::integer,
    pa.estado, pa.chequeado_at
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  left join publicacion_avisos pa on pa.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and (pa.estado is distinct from 'despublicado')
    and (case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end)
              else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end) = 'COMPRAR'
  order by (case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end)
                 else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end) desc nulls last, sp.id;
end;
$$;
revoke execute on function public.explorar_pines(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer) from public, anon, authenticated;
grant execute on function public.explorar_pines(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer) to service_role;

-- 5 · deptos_candidatos (los primeros de /deptos; la sobrecarga con plazo, la que llama el código)
create or replace function public.deptos_candidatos(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, pie integer, max_filas integer, plazo integer)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer, flujo integer, pub_estado text, pub_at timestamp with time zone)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna,
    case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end) else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end,
    case when plazo = 30 then (case when pie = 30 then ae.flujo_30 else ae.flujo_20 end) else (case when pie = 30 then ae.flujo_30_25 else ae.flujo_20_25 end) end,
    pa.estado, pa.chequeado_at
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  left join publicacion_avisos pa on pa.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and (pa.estado is distinct from 'despublicado')
    and (case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end) else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end) = 'COMPRAR'
  order by (case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end) else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end) desc nulls last, sp.id
  limit max_filas;
end;
$$;
revoke execute on function public.deptos_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.deptos_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer, integer) to service_role;
