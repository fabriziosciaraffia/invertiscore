-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261125180123, «explorar_mapa_todos_tramos»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 f30b44f7e770a334d2767039c189d019). No volver a aplicar.

-- Los No conviene viajan sin cifras: solo el tramo de cada barra del panel (arriendo estimado, cap rate, te sobran o pones al mes).
-- Mismos cortes que src/lib/explorar/tramos.ts. Campos 9-11 y 13-14 nulos en la clase 2. Tramos 0-23 en todas las filas.
-- Medido el 25-nov en pg_temp: 760 ms, 19.163 filas, 0 filas de clase 2 con cifras, 0 tramos nulos.
create or replace function public.explorar_mapa_todos(comunas text[], desde timestamp, pie integer)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
declare
  v_uf numeric;
  cortes_arriendo constant numeric[] := array[250000,300000,350000,400000,450000,500000,550000,600000,700000,800000,900000,1000000,1200000,1400000,1600000,1800000,2000000,2500000,3000000,3500000,4000000,5000000,6000000];
  cortes_cap constant numeric[] := array[2.5,2.75,3,3.25,3.5,3.75,4,4.25,4.5,4.75,5,5.25,5.5,5.75,6,6.25,6.5,6.75,7,7.25,7.5,7.75,8];
  cortes_flujo constant numeric[] := array[-1500000,-1000000,-750000,-500000,-400000,-300000,-250000,-200000,-150000,-100000,-75000,-50000,-25000,0,25000,50000,75000,100000,150000,200000,300000,500000,1000000];
begin
  select value::text::numeric into v_uf from config where key = 'uf_value';
  return (
    with recursive cadena as (
      select g.nuevo_id as id, g.viejo_id as ancestro, array[g.nuevo_id, g.viejo_id] as visto
      from avisos_gemelos g
      union all
      select c.id, g.viejo_id, c.visto || g.viejo_id
      from cadena c join avisos_gemelos g on g.nuevo_id = c.ancestro
      where not (g.viejo_id = any(c.visto)) and cardinality(c.visto) < 30
    ),
    alta_cadena as (
      select c.id, min(v.created_at) as alta
      from cadena c join scraped_properties v on v.id = c.ancestro
      group by c.id
    )
    select coalesce(jsonb_agg(jsonb_build_array(
        u.id, u.comuna, u.lat, u.lng, u.m2, u.dormitorios, u.banos, u.precio, u.v,
        case when u.v = 2 then null else u.score end,
        case when u.v = 2 then null else u.flujo end,
        case when u.v = 2 then null else u.arriendo end,
        u.alta,
        case when u.v = 2 then null else u.nd end,
        case when u.v = 2 then null else u.np end,
        width_bucket(u.arriendo, cortes_arriendo),
        case when v_uf > 0 and u.precio > 0 then width_bucket(round(u.arriendo * 12 / (u.precio * v_uf) * 100, 2), cortes_cap) end,
        width_bucket(u.flujo, cortes_flujo))
      order by u.v, u.score desc nulls last, u.id), '[]'::jsonb)
    from (
      select sp.id, sp.comuna,
        round(sp.lat::numeric, 6) as lat, round(sp.lng::numeric, 6) as lng, round(sp.superficie_m2)::int as m2,
        case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end as dormitorios,
        sp.banos, round(ae.precio_uf)::int as precio,
        case
          when (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end) = 'COMPRAR' then 0
          when (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end) = 'AJUSTA SUPUESTOS'
               and (case when pie = 30 then ae.negociar_30 else ae.negociar_20 end) is not null then 1
          else 2 end as v,
        case when pie = 30 then ae.score_30 else ae.score_20 end as score,
        case when pie = 30 then ae.flujo_30 else ae.flujo_20 end as flujo,
        nullif(ae.arriendo->>'monto', '')::numeric::integer as arriendo,
        floor(extract(epoch from least(sp.created_at, coalesce(ac.alta, sp.created_at))))::bigint as alta,
        ((case when pie = 30 then ae.negociar_30 else ae.negociar_20 end)->>'d')::numeric as nd,
        ((case when pie = 30 then ae.negociar_30 else ae.negociar_20 end)->>'p')::numeric::integer as np
      from scraped_properties sp
      join avisos_evaluados ae on ae.aviso_id = sp.id
      left join publicacion_avisos pa on pa.aviso_id = sp.id
      left join alta_cadena ac on ac.id = sp.id
      where sp.is_active = true
        and sp.type = 'venta'
        and sp.condicion is distinct from 'nuevo'
        and sp.lat is not null and sp.lng is not null
        and sp.scraped_at >= desde
        and sp.comuna = any(comunas)
        and ae.arriendo is not null
        and ae.arriendo_sospechoso is not true
        and pa.estado is distinct from 'despublicado'
        and (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end) is not null
    ) u
  );
end;
$$;
revoke execute on function public.explorar_mapa_todos(text[], timestamp, integer) from public, anon, authenticated;
