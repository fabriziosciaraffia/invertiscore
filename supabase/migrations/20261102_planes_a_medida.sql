-- ─────────────────────────────────────────────────────────────────────────────
-- PLANES A MEDIDA (02-nov-2026, goal «cortes por statement_timeout», Fase 1). Se aplica a mano en el SQL Editor.
--
-- deptos_conteo, explorar_mapa y explorar_universo_liviano eran funciones `language sql` con `set search_path`: no se
-- inlinean, y Postgres 17 planifica su cuerpo SIN los valores de los parámetros (plan genérico). Con
-- `precio_uf between $3 and $4` o `case when $4 = 30 …` estima 118 filas donde hay 23.000 y elige nested loops que leen
-- `publicacion_avisos` entera una vez por fila y buscan los avisos de a uno. Medido el 02-nov-2026 (EXPLAIN ANALYZE
-- BUFFERS, mismos parámetros que la landing, el resumen de la noche y Explorar en renta corta):
--   · deptos_conteo, 25 comunas, plazo 30 ........ 2.843 ms · 356.201 páginas  →  estas funciones: 103 ms · 13.709
--   · explorar_mapa, pie 20 y 30 años ............   732 ms · 113.603 páginas  →  191 ms · 13.792
--   · explorar_universo_liviano, Lo Barnechea ....   208 ms · 109.875 páginas  →   24 ms · 3.298
-- (las de la derecha, con estos mismos cuerpos creados como funciones temporales de sesión, tras seis llamadas seguidas:
-- el plan cache no vuelve al plan genérico).
-- Con la base ocupada (el cron de la noche, Explorar pidiendo comunas en paralelo) pasaban los 8 s del statement_timeout.
--
-- EL ARREGLO: plpgsql con `set plan_cache_mode = force_custom_plan`. La consulta de adentro va por el plan cache de SPI,
-- y con ese modo cada llamada se planifica con sus valores. Inlinear no sirve: PostgREST pasa los argumentos dentro de un
-- json `$1`. Es el mismo arreglo que inmediato_candidatos (20261026_inmediato_planes.sql, ahí con EXECUTE … USING).
--
-- MISMAS FIRMAS, MISMO SELECT, MISMAS COLUMNAS DE SALIDA: el resultado es idéntico (verificado el 02-nov-2026 comparando
-- las tres salidas contra las funciones de hoy). `#variable_conflict use_variable`: los nombres sin calificar que el
-- SELECT usa como parámetros (comunas, desde, pie, plazo, dorms, uf_min, uf_max, clave) siguen siendo los parámetros
-- aunque algún día una tabla tenga una columna con ese nombre. Solo cambia la sobrecarga de deptos_conteo con plazo
-- (la que llama todo el código desde el 30-oct-2026); la de cinco argumentos queda como está.
--
-- AL FINAL, LA SIEMBRA de `explorar_convienen_mapa` (el número de «convienen» del mapa que ahora lee la landing de config):
-- el cron lo guarda en cada evaluación, pero hasta la primera corrida después del deploy la landing no tendría número.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.deptos_conteo(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, plazo integer)
returns table(comuna text, total integer, comprar_20 integer, comprar_30 integer, sin_estandar integer)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
  select sp.comuna, count(*)::int,
    count(*) filter (where (case when plazo = 30 then ae.veredicto_20 else ae.veredicto_20_25 end) = 'COMPRAR')::int,
    count(*) filter (where (case when plazo = 30 then ae.veredicto_30 else ae.veredicto_30_25 end) = 'COMPRAR')::int,
    count(*) filter (where (case when plazo = 30 then ae.veredicto_20 else ae.veredicto_20_25 end) is null)::int
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
  group by sp.comuna;
end;
$$;
revoke execute on function public.deptos_conteo(text[], integer[], numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;
grant execute on function public.deptos_conteo(text[], integer[], numeric, numeric, timestamp without time zone, integer) to service_role;

create or replace function public.explorar_mapa(comunas text[], desde timestamp without time zone, pie integer, plazo integer)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return (
  select coalesce(jsonb_agg(jsonb_build_array(u.id, u.comuna, u.lat, u.lng, u.m2, u.dormitorios, u.banos, u.precio, u.score, u.flujo, u.arriendo, u.condicion, u.alta)
    order by u.score desc nulls last, u.id), '[]'::jsonb)
  from (
    select sp.id, sp.comuna, round(sp.lat::numeric, 6) as lat, round(sp.lng::numeric, 6) as lng, round(sp.superficie_m2)::int as m2,
      case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
      sp.banos, round(ae.precio_uf)::int as precio,
      case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end)
           else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end as score,
      case when plazo = 30 then (case when pie = 30 then ae.flujo_30 else ae.flujo_20 end)
           else (case when pie = 30 then ae.flujo_30_25 else ae.flujo_20_25 end) end as flujo,
      nullif(ae.arriendo->>'monto', '')::numeric::integer as arriendo,
      sp.condicion, floor(extract(epoch from sp.created_at))::bigint as alta
    from scraped_properties sp
    join avisos_evaluados ae on ae.aviso_id = sp.id
    left join publicacion_avisos pa on pa.aviso_id = sp.id
    where sp.is_active = true
      and sp.type = 'venta'
      and sp.lat is not null and sp.lng is not null
      and sp.scraped_at >= desde
      and sp.comuna = any(comunas)
      and ae.arriendo is not null
      and ae.arriendo_sospechoso is not true
      and (pa.estado is distinct from 'despublicado')
      and (case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end)
                else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end) = 'COMPRAR'
  ) u
  );
end;
$$;
revoke execute on function public.explorar_mapa(text[], timestamp without time zone, integer, integer) from public, anon, authenticated;
grant execute on function public.explorar_mapa(text[], timestamp without time zone, integer, integer) to service_role;

create or replace function public.explorar_universo_liviano(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, clave text)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'comuna', u.comuna, 'lat', u.lat, 'lng', u.lng, 'superficie_m2', u.superficie_m2, 'dormitorios', u.dormitorios,
    'banos', u.banos, 'precio_uf', u.precio_uf, 'arriendo_monto', u.arriendo_monto, 'evaluado_at', u.evaluado_at, 'combo', u.combo,
    'pub_estado', u.pub_estado, 'pub_at', u.pub_at, 'condicion', u.condicion, 'alta', u.alta
  ) order by u.id), '[]'::jsonb)
  from (
    select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
      case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
      sp.banos, ae.precio_uf, nullif(ae.arriendo->>'monto', '')::numeric::integer as arriendo_monto,
      ae.evaluado_at, ae.combos -> clave as combo, pa.estado as pub_estado, pa.chequeado_at as pub_at,
      sp.condicion, floor(extract(epoch from sp.created_at))::bigint as alta
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
  ) u
  );
end;
$$;
revoke execute on function public.explorar_universo_liviano(text[], integer[], numeric, numeric, timestamp without time zone, text) from public, anon, authenticated;
grant execute on function public.explorar_universo_liviano(text[], integer[], numeric, numeric, timestamp without time zone, text) to service_role;

-- ── LA SIEMBRA DEL NÚMERO DEL MAPA ───────────────────────────────────────────
-- El mismo pedido que hace el cron (explorar/convienen-guardado.ts › guardarConvienenMapa → universoDeLaNoche): todo Gran
-- Santiago (las 25 comunas de COMUNAS_DISPONIBLES), la ventana de 7 días en UTC, pie 20 % y 30 años; el número es cuántas
-- filas devuelve, como `cuantosConvienen`. Sin filas no se escribe nada (la landing sale sin cifra y lo reporta).
insert into config (key, value, updated_at)
select 'explorar_convienen_mapa',
  jsonb_build_object('convienenMapa', n, 'calculadoAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,
  now() at time zone 'UTC'
from (
  select jsonb_array_length(public.explorar_mapa(
    array['Santiago','Providencia','Las Condes','Vitacura','Lo Barnechea','Ñuñoa','La Reina','Macul','Peñalolén','La Florida',
          'San Joaquín','Maipú','Pudahuel','Cerrillos','Estación Central','Quinta Normal','Independencia','Recoleta','Huechuraba',
          'Conchalí','Quilicura','Renca','San Miguel','La Cisterna','Puente Alto'],
    (now() at time zone 'UTC') - interval '7 days', 20, 30)) as n
) m
where m.n > 0
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
