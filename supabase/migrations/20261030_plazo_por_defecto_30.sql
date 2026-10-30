-- ─────────────────────────────────────────────────────────────────────────────
-- EL PLAZO POR DEFECTO A 30 AÑOS (30-oct-2026, decisión de Fabrizio): el financiamiento por defecto de todo el sitio pasa a
-- pie 20 %, 30 años y la tasa del motor (src/lib/deptos/estandar.ts › PLAZO_POR_DEFECTO). /deptos también: el número de
-- cada búsqueda y los primeros deptos de una cuenta dejan de leer fijo las columnas de 25 años.
--
-- deptos_conteo y deptos_candidatos reciben el PLAZO, como ya lo reciben explorar_mapa, explorar_pines y
-- semanal_candidatos: a 30 años leen la evaluación de la noche (veredicto_20 / veredicto_30, score_*, flujo_*); a 25, las
-- columnas del mismo aviso a 25 años (*_20_25 / *_30_25), que la noche sigue llenando porque 25 es una opción de Filtros.
--
-- Son VERSIONES NUEVAS (un argumento más, sin valor por defecto): las de cinco y siete argumentos siguen ahí para el código
-- desplegado mientras sale el nuevo, y PostgREST elige por los nombres de los argumentos, sin ambigüedad. Las viejas se
-- retiran en un cambio aparte, cuando ningún despliegue las llame.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.deptos_conteo(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, plazo integer)
returns table(comuna text, total integer, comprar_20 integer, comprar_30 integer, sin_estandar integer)
language sql stable
set search_path = public, pg_temp
as $$
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
$$;

create or replace function public.deptos_candidatos(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp without time zone, pie integer, max_filas integer, plazo integer)
returns table(id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer, condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer, antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer, flujo integer, pub_estado text, pub_at timestamp with time zone)
language sql stable
set search_path = public, pg_temp
as $$
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
$$;

-- Solo el servidor (service role), como las de siempre.
revoke execute on function public.deptos_conteo(text[], integer[], numeric, numeric, timestamp without time zone, integer) from public, anon, authenticated;
revoke execute on function public.deptos_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.deptos_conteo(text[], integer[], numeric, numeric, timestamp without time zone, integer) to service_role;
grant execute on function public.deptos_candidatos(text[], integer[], numeric, numeric, timestamp without time zone, integer, integer, integer) to service_role;
