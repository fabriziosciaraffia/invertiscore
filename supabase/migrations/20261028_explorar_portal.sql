-- Explorar como portal (28-oct-2026, docs/puerta-b-mockups/5b-explorar-portal.html). Aditiva: nada existente pierde
-- columnas ni filas; dos funciones nuevas, una reemplazada con más campos (devuelve jsonb, misma firma) y dos tablas nuevas
-- que solo lee y escribe el service role (RLS sin políticas).
--
-- 1 · EL MAPA DE TODO GRAN SANTIAGO EN UN SOLO PEDIDO: la vista global abre con todas las comunas, tipologías y precios y
--     solo los Comprar, con el pie y el plazo de la noche. Es el MISMO universo que explorar_pines y deptos_conteo (activos,
--     de venta, con coordenadas, vistos en la ventana, con arriendo, sin arriendo sospechoso, sin despublicados) —el número
--     de anoche—, pero en UN jsonb de arreglos cortos: de a páginas de mil eran cinco pedidos y 5,1 s; así, 240 ms (medido
--     el 28-oct-2026 sobre 4.800 filas). Cada fila: [id, comuna, lat, lng, m2, dormitorios, baños, precio UF, puntaje,
--     flujo, arriendo, condición, alta] —alta = cuándo apareció el aviso, en segundos (los «Nuevo hoy» y «Publicados»)—.
create or replace function public.explorar_mapa(comunas text[], desde timestamp, pie integer, plazo integer)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
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
  ) u;
$$;
revoke execute on function public.explorar_mapa(text[], timestamp, integer, integer) from public, anon, authenticated;

-- 2 · EL UNIVERSO LIVIANO, CON EL ALTA Y LA CONDICIÓN: lo que la combinación calculada (otro pie, otro plazo, renta corta)
--     necesita para los mismos «Nuevo hoy», «Publicados» y «Usado/Nuevo» que la vista global. Misma firma y mismo jsonb;
--     dos campos más.
create or replace function public.explorar_universo_liviano(comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, clave text)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
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
  ) u;
$$;
revoke execute on function public.explorar_universo_liviano(text[], integer[], numeric, numeric, timestamp, text) from public, anon, authenticated;

-- 3 · LOS GUARDADOS: el corazón de la tarjeta y de la lista. Uno por persona y aviso; el dashboard los muestra en la fila
--     plegada «Guardados», con «Comparar». Solo el service role (las rutas validan la sesión).
create table if not exists public.explorar_guardados (
  user_id uuid not null references auth.users(id) on delete cascade,
  aviso_id uuid not null references public.scraped_properties(id) on delete cascade,
  creado_at timestamptz not null default now(),
  primary key (user_id, aviso_id)
);
alter table public.explorar_guardados enable row level security;
create index if not exists explorar_guardados_por_persona on public.explorar_guardados (user_id, creado_at desc);

-- 4 · LA VISTA DE LA CALLE, EN CACHÉ: la respuesta de la metadata de Street View por aviso (gratis, pero no se repite). El
--     punto consultado va guardado: si el aviso cambia de coordenadas, se consulta de nuevo. `estado` = 'foto' solo si hay
--     un panorama de exterior, de Google, a menos de 40 m, con el rumbo de la cámara hacia el punto; si no, 'mapa' (la
--     tarjeta lleva un mapa estático chico) con el motivo. Un rechazo de Google (llave, API apagada) NO se guarda.
create table if not exists public.calle_avisos (
  aviso_id uuid primary key references public.scraped_properties(id) on delete cascade,
  lat numeric not null,
  lng numeric not null,
  estado text not null check (estado in ('foto', 'mapa')),
  motivo text null,
  pano_id text null,
  pano_lat numeric null,
  pano_lng numeric null,
  distancia_m numeric null,
  rumbo numeric null,
  fecha text null,
  copyright text null,
  consultado_at timestamptz not null default now()
);
alter table public.calle_avisos enable row level security;
