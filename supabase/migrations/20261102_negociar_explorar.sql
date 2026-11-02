-- Filtros v2 y los que convienen si negocias (02-nov-2026, docs/puerta-b-mockups/8-filtros-v2-negociar.html). Aditiva: dos
-- columnas nuevas y tres funciones nuevas; nada existente cambia de significado.
--
-- 1 · LA NOCHE: para cada aviso que da Ajustar supuestos con un pie (20 % o 30 %, a 30 años, tasa del motor), el descuento mínimo
--     sobre el precio publicado con el que llega a Comprar (src/lib/avisos/negociar.ts: la celda del mix, bisección de 0,1, hasta
--     10 %), con el precio negociado y el puntaje y el flujo a ese precio: {"d": 4.2, "p": 2950, "s": 71, "f": -11000}. null si no
--     da Ajustar o si no llega. Los Buscar otro nunca entran.
alter table public.avisos_evaluados
  add column if not exists negociar_20 jsonb,
  add column if not exists negociar_30 jsonb;

-- 2 · EL RELLENO DE UNA VEZ (scripts/rellenar-negociar.ts): las filas con algún Ajustar, con lo que la sonda necesita, de a
--     páginas por id; y la escritura, que no pisa una fila que el cron reevaluó mientras tanto (como rellenar_estandar25).
create or replace function public.negociar_filas(desde_id uuid, n integer)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer,
  evaluado_at timestamptz, veredicto_20 text, veredicto_30 text
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna, ae.score_20, ae.evaluado_at, ae.veredicto_20, ae.veredicto_30
  from avisos_evaluados ae
  join scraped_properties sp on sp.id = ae.aviso_id
  where ae.aviso_id > desde_id
    and (ae.veredicto_20 = 'AJUSTA SUPUESTOS' or ae.veredicto_30 = 'AJUSTA SUPUESTOS')
  order by ae.aviso_id
  limit n;
$$;
revoke execute on function public.negociar_filas(uuid, integer) from public, anon, authenticated;

create or replace function public.rellenar_negociar(filas jsonb)
returns integer
language sql
set search_path to 'public', 'pg_temp'
as $$
  with f as (
    select * from jsonb_to_recordset(filas) as x(aviso_id uuid, evaluado_at timestamptz, negociar_20 jsonb, negociar_30 jsonb)
  ), u as (
    update avisos_evaluados ae set negociar_20 = f.negociar_20, negociar_30 = f.negociar_30
    from f
    where ae.aviso_id = f.aviso_id and ae.evaluado_at = f.evaluado_at
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.rellenar_negociar(jsonb) from public, anon, authenticated;

-- 3 · LA CAPA DEL MAPA: los que convienen si negocias, con un pie a 30 años, todo Gran Santiago en UN jsonb de arreglos cortos
--     (como explorar_mapa). El MISMO universo que explorar_mapa (activos, de venta, con coordenadas, vistos en la ventana, con
--     arriendo, sin arriendo sospechoso, sin despublicados), con Ajustar supuestos y un descuento guardado. El tope elegido (5 %
--     o 10 %) se aplica en el navegador. Cada fila: [id, comuna, lat, lng, m2, dormitorios, baños, precio publicado, puntaje al
--     publicado, flujo al publicado, arriendo, condición, alta, descuento, precio negociado, puntaje negociado, flujo negociado].
create or replace function public.explorar_negociar(comunas text[], desde timestamp, pie integer)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_array(u.id, u.comuna, u.lat, u.lng, u.m2, u.dormitorios, u.banos, u.precio, u.score, u.flujo,
      u.arriendo, u.condicion, u.alta, (u.neg->>'d')::numeric, (u.neg->>'p')::numeric::integer, (u.neg->>'s')::numeric::integer,
      (u.neg->>'f')::numeric::integer)
    order by (u.neg->>'d')::numeric, u.id), '[]'::jsonb)
  from (
    select sp.id, sp.comuna, round(sp.lat::numeric, 6) as lat, round(sp.lng::numeric, 6) as lng, round(sp.superficie_m2)::int as m2,
      case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
      sp.banos, round(ae.precio_uf)::int as precio,
      case when pie = 30 then ae.score_30 else ae.score_20 end as score,
      case when pie = 30 then ae.flujo_30 else ae.flujo_20 end as flujo,
      nullif(ae.arriendo->>'monto', '')::numeric::integer as arriendo,
      sp.condicion, floor(extract(epoch from sp.created_at))::bigint as alta,
      case when pie = 30 then ae.negociar_30 else ae.negociar_20 end as neg
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
      and (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end) = 'AJUSTA SUPUESTOS'
      and (case when pie = 30 then ae.negociar_30 else ae.negociar_20 end) is not null
  ) u;
$$;
revoke execute on function public.explorar_negociar(text[], timestamp, integer) from public, anon, authenticated;
