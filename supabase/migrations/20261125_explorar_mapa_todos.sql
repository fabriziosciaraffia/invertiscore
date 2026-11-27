-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261125173642, «explorar_mapa_todos»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 99b642b89e3bbfb8614e3f4e026d4a86). No volver a aplicar.

-- El mapa nuevo: los usados con veredicto en tres clases (0 Comprar · 1 Ajustar con «Conviene desde UF X» · 2 No conviene),
-- a 30 años, pie 20 o 30. Un Ajustar sin descuento guardado (necesita más de 10 %) va como No conviene.
-- «Nuevo hoy» con la cadena de avisos_gemelos: el alta es la del primer eslabón (con guarda de ciclos).
-- Medido el 25-nov: consulta 630 ms; función 675 ms con todas las comunas, 7 días, pie 20 → 19.163 filas.
create or replace function public.explorar_mapa_todos(comunas text[], desde timestamp, pie integer)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
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
        u.id, u.comuna, u.lat, u.lng, u.m2, u.dormitorios, u.banos, u.precio, u.v, u.score, u.flujo, u.arriendo, u.alta, u.nd, u.np)
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
