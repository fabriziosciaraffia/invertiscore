-- Explorar con cualquier pie y plazo (24-oct-2026): la noche evalúa cuatro combinaciones (pie 20/30 × 25/30 años); el mapa
-- ofrece pie de 10 a 50 % y plazo de 15 a 30 años, y lo que la noche no tiene se calcula en el momento, solo para los
-- avisos de los filtros activos, y se guarda 24 horas EN LA MISMA TABLA (`avisos_evaluados.combos`, por «pie-plazo»).
-- La evaluación nocturna no cambia: su upsert no toca `combos`, y cada entrada guarda cuándo se calculó, así una
-- reevaluación posterior (evaluado_at más nuevo) la invalida sola. Aditiva.
alter table public.avisos_evaluados add column if not exists combos jsonb null;

-- 1 · EL UNIVERSO DE UNOS FILTROS, LIVIANO: todos los avisos (den lo que den) con lo que el pin necesita y lo guardado para
--     esa combinación, SIN los jsonb de la evaluación (medido el 24-oct-2026: con ellos, leer Santiago entero —5.935
--     avisos— costaba 5,5 s). El MISMO universo que explorar_pines sin la condición del veredicto. Devuelve UN jsonb
--     (un arreglo) y no filas: el tope de mil de PostgREST es por fila, y así Santiago entero es un solo pedido (medido:
--     de a páginas, 2,5 s; en uno, menos de la mitad).
create or replace function public.explorar_universo_liviano(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, clave text
)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'comuna', u.comuna, 'lat', u.lat, 'lng', u.lng, 'superficie_m2', u.superficie_m2, 'dormitorios', u.dormitorios,
    'banos', u.banos, 'precio_uf', u.precio_uf, 'arriendo_monto', u.arriendo_monto, 'evaluado_at', u.evaluado_at, 'combo', u.combo,
    'pub_estado', u.pub_estado, 'pub_at', u.pub_at
  ) order by u.id), '[]'::jsonb)
  from (
    select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
      case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
      sp.banos, ae.precio_uf, nullif(ae.arriendo->>'monto', '')::numeric::integer as arriendo_monto,
      ae.evaluado_at, ae.combos -> clave as combo, pa.estado as pub_estado, pa.chequeado_at as pub_at
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
  ) u;
$$;
revoke execute on function public.explorar_universo_liviano(text[], integer[], numeric, numeric, timestamp, text) from public, anon, authenticated;

-- 2 · LO QUE LA SONDA NECESITA, solo para los avisos que faltan calcular (las columnas de semanal_candidatos).
create or replace function public.explorar_filas_para_sonda(ids uuid[])
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
    ae.gastos_comunes, ae.mediana_comuna, ae.score_20
  from avisos_evaluados ae
  join scraped_properties sp on sp.id = ae.aviso_id
  where ae.aviso_id = any(ids);
$$;
revoke execute on function public.explorar_filas_para_sonda(uuid[]) from public, anon, authenticated;

-- 3 · GUARDAR LO CALCULADO: mezcla lo nuevo en `combos` sin pisar las otras combinaciones. Devuelve cuántas filas tocó.
create or replace function public.explorar_guardar_combos(filas jsonb)
returns integer
language sql
set search_path to 'public', 'pg_temp'
as $$
  with f as (
    select * from jsonb_to_recordset(filas) as x(aviso_id uuid, combo jsonb)
  ), u as (
    update avisos_evaluados ae set combos = coalesce(ae.combos, '{}'::jsonb) || f.combo
    from f where ae.aviso_id = f.aviso_id
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.explorar_guardar_combos(jsonb) from public, anon, authenticated;

-- La primera versión de esta migración (misma fecha) traía `explorar_universo` con los jsonb: retirada.
drop function if exists public.explorar_universo(text[], integer[], numeric, numeric, timestamp, text);
