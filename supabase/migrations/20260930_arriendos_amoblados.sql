-- Arriendos amoblados fuera de los comparables (30-sep-2026).
--
-- 1 · El título del aviso. La fila del GetProps trae el título completo en [39] (verificado el 30-sep sobre
--     583 arriendos de Las Condes/Vitacura, sin tocar la ficha); hasta hoy no se guardaba y la única señal
--     era el slug de la URL, que es el título recortado. Lo escribe propertyToRow; lo lee arriendo-tipo.ts
--     para separar amoblados, temporada, corporativos y piezas.
alter table public.scraped_properties
  add column if not exists titulo text null;

-- 2 · La RPC del radio devuelve también url y titulo, para clasificar cada comparable. Cambia el tipo de
--     retorno, así que se recrea (drop + create en la misma transacción: nunca queda sin función). Se
--     conservan search_path (20260930_search_path_funciones) y los grants que tenía (PUBLIC, anon,
--     authenticated, service_role). Compatible hacia atrás: el código viejo ignora las columnas nuevas.
begin;
drop function if exists public.properties_within_radius(double precision, double precision, integer, text, integer, text, text);
create function public.properties_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_meters integer,
  prop_type text default null,
  prop_dorms integer default null,
  prop_comuna text default null,
  prop_condicion text default null
)
returns table (
  id uuid,
  precio numeric,
  moneda text,
  superficie_m2 numeric,
  dormitorios integer,
  gastos_comunes numeric,
  lat numeric,
  lng numeric,
  distance_meters double precision,
  url text,
  titulo text
)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  select
    sp.id,
    sp.precio,
    sp.moneda,
    sp.superficie_m2,
    sp.dormitorios,
    sp.gastos_comunes,
    sp.lat,
    sp.lng,
    st_distance(
      sp.location::geography,
      st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography
    ) as distance_meters,
    sp.url,
    sp.titulo
  from scraped_properties sp
  where sp.is_active = true
    and sp.location is not null
    and st_dwithin(
      sp.location::geography,
      st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
    and (prop_type is null or sp.type = prop_type)
    and (prop_dorms is null or sp.dormitorios = prop_dorms)
    and (prop_comuna is null or sp.comuna = prop_comuna)
    and (prop_condicion is null or coalesce(sp.condicion, 'usado') = prop_condicion)
  order by distance_meters;
end;
$$;
grant execute on function public.properties_within_radius(double precision, double precision, integer, text, integer, text, text) to public, anon, authenticated, service_role;
commit;

-- 3 · La marca de arriendo sospechoso en la fila evaluada, contra la ZONA del depto (los arriendos sin
--     amoblar de la misma tipología en 2 km), no contra la mediana de la comuna: en el oriente la zona es
--     más cara que la comuna y la marca vieja confundía ubicación con contaminación.
alter table public.avisos_evaluados
  add column if not exists arriendo_zona_m2 integer null,
  add column if not exists arriendo_sospechoso boolean not null default false;
