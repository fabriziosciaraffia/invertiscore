-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261119170455, «invierte_v2_alternativas_cercanas»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 875f765942dc321947fcf1498ad5840c). No volver a aplicar.

alter table public.inv_perfiles
  add column if not exists donde text not null default 'cerca'
  constraint inv_perfiles_donde_check check (donde in ('cerca','comuna','convenga'));

create or replace function public.invierte_alternativas(
  p_aviso    uuid,
  p_modo     text,
  p_tope     numeric,
  p_comunas  text[] default null,
  p_excluir  uuid[] default null,
  p_max      integer default 12,
  p_min_comp integer default 6
)
returns table(aviso_id uuid, comuna text, distancia_m integer, superficie_m2 numeric, dormitorios integer, precio_uf numeric,
              flujo integer, score integer, nivel text)
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
declare
  e record;
  c record;
  v_niveles text[];
  v_nivel text;
  v_revisados integer;
  v_aceptados integer;
  a_loc geography[];
  a_d integer[];
  a_b integer[];
  a_m2 numeric[];
  a_p numeric[];
  a_pub bigint[];
  i integer;
  v_dup boolean;
  c_pub bigint;
begin
  select sp.location, sp.superficie_m2 as m2, sp.dormitorios as d, sp.banos as b, sp.comuna, ae.precio_uf as p,
         (select ap.publicador_id from avisos_publicador ap where ap.aviso_id = sp.id limit 1) as pub
    into e
  from scraped_properties sp
  left join avisos_evaluados ae on ae.aviso_id = sp.id
  where sp.id = p_aviso;
  if e.location is null or e.m2 is null or e.m2 <= 0 or e.d is null then
    aviso_id := null; comuna := null; distancia_m := null; superficie_m2 := null; dormitorios := null; precio_uf := null;
    flujo := null; score := null; nivel := 'solo_elegido';
    return next;
    return;
  end if;

  v_niveles := case p_modo
                 when 'cerca' then array['cerca', 'tres_km', 'comuna']
                 when 'comuna' then array['comuna']
                 else array['perfil']
               end;

  foreach v_nivel in array v_niveles loop
    v_revisados := 0; v_aceptados := 0;
    a_loc := array[]::geography[]; a_d := array[]::integer[]; a_b := array[]::integer[];
    a_m2 := array[]::numeric[]; a_p := array[]::numeric[]; a_pub := array[]::bigint[];

    for c in
      select c_sp.id, c_sp.comuna as com, c_sp.location as loc, c_sp.superficie_m2 as m2, c_sp.dormitorios as d, c_sp.banos as b,
             ev.precio_uf as p, ev.flujo_20 as flujo, ev.score_20 as score, coalesce((ev.arriendo->>'radio')::int, 1000) as radio_arr,
             st_distance(c_sp.location, e.location)::int as dist
      from scraped_properties c_sp
      join avisos_evaluados ev on ev.aviso_id = c_sp.id
      where c_sp.is_active
        and coalesce(c_sp.condicion, 'usado') = 'usado'
        and c_sp.scraped_at >= now() - interval '7 days'
        and c_sp.id <> p_aviso
        and not (c_sp.id = any(coalesce(p_excluir, array[]::uuid[])))
        and ev.veredicto_20 = 'COMPRAR'
        and ev.precio_uf <= p_tope
        and c_sp.superficie_m2 between e.m2 * 0.8 and e.m2 * 1.2
        and c_sp.dormitorios between e.d - 1 and e.d + 1
        and case v_nivel
              when 'cerca' then st_dwithin(c_sp.location, e.location, 1500)
              when 'tres_km' then st_dwithin(c_sp.location, e.location, 3000)
              when 'comuna' then c_sp.comuna = e.comuna
              else (p_comunas is null or cardinality(p_comunas) = 0 or c_sp.comuna = any(p_comunas))
            end
        and not (coalesce((ev.venta->>'precioM2UF')::numeric, 0) > 0
                 and ev.precio_uf / c_sp.superficie_m2 < 0.65 * (ev.venta->>'precioM2UF')::numeric)
        and not (
              coalesce(c_sp.titulo, '') ~* '(dptos?|deptos?|departamentos?)\s+unidos'
           or coalesce(c_sp.titulo, '') ~* '(edificio completo|venta,?\s+(de\s+)?edificio)'
           or (coalesce(c_sp.titulo, '') ~* '\moficina\M' and coalesce(c_sp.titulo, '') !~* '(depto|dpto|departamento)')
           or coalesce(c_sp.titulo, '') ~* 'local comercial'
           or coalesce(c_sp.titulo, '') ~* '(venta de terreno|^\W*terreno)'
           or (coalesce(c_sp.titulo, '') ~* '\mcasa\M' and coalesce(c_sp.titulo, '') !~* '(tipo casa|casa tipo)')
        )
      order by (c_sp.dormitorios = e.d) desc,
               case when v_nivel = 'perfil' then 0
                    when st_distance(c_sp.location, e.location) <= 800 then 0
                    when st_distance(c_sp.location, e.location) <= 1500 then 1
                    when st_distance(c_sp.location, e.location) <= 3000 then 2
                    else 3 end,
               floor(abs(c_sp.superficie_m2 - e.m2) / e.m2 / 0.05),
               ev.flujo_20 desc nulls last,
               ev.score_20 desc nulls last,
               c_sp.id
    loop
      v_revisados := v_revisados + 1;
      exit when v_revisados > 600;

      c_pub := null;
      select ap.publicador_id into c_pub from avisos_publicador ap where ap.aviso_id = c.id limit 1;
      v_dup := st_dwithin(c.loc, e.location, 30) and c.d = e.d and c.b is not distinct from e.b and abs(c.m2 - e.m2) <= 1
               and e.p is not null and abs(c.p / e.p - 1) <= 0.03 and (c_pub is null or e.pub is null or c_pub <> e.pub);
      if not v_dup then
        for i in 1..coalesce(array_length(a_loc, 1), 0) loop
          if st_dwithin(c.loc, a_loc[i], 30) and c.d = a_d[i] and c.b is not distinct from a_b[i] and abs(c.m2 - a_m2[i]) <= 1
             and abs(c.p / a_p[i] - 1) <= 0.03 and (c_pub is null or a_pub[i] is null or c_pub <> a_pub[i]) then
            v_dup := true;
            exit;
          end if;
        end loop;
      end if;
      continue when v_dup;

      continue when (select count(*) from scraped_properties a
                     where a.type = 'arriendo' and a.is_active
                       and st_dwithin(a.location, c.loc, c.radio_arr)
                       and a.superficie_m2 between c.m2 * 0.8 and c.m2 * 1.2) < p_min_comp;

      aviso_id := c.id; comuna := c.com; distancia_m := c.dist; superficie_m2 := c.m2; dormitorios := c.d; precio_uf := c.p;
      flujo := c.flujo; score := c.score; nivel := v_nivel;
      return next;
      v_aceptados := v_aceptados + 1;
      a_loc := a_loc || c.loc; a_d := a_d || c.d; a_b := a_b || c.b; a_m2 := a_m2 || c.m2; a_p := a_p || c.p; a_pub := a_pub || c_pub;
      exit when v_aceptados >= p_max;
    end loop;

    if v_aceptados > 0 then
      return;
    end if;
  end loop;

  aviso_id := null; comuna := null; distancia_m := null; superficie_m2 := null; dormitorios := null; precio_uf := null;
  flujo := null; score := null; nivel := 'solo_elegido';
  return next;
end;
$$;

revoke execute on function public.invierte_alternativas(uuid, text, numeric, text[], uuid[], integer, integer) from public, anon, authenticated;
