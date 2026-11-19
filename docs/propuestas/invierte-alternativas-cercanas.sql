-- ─────────────────────────────────────────────────────────────────────────────
-- PROPUESTA · LAS ALTERNATIVAS DE INVIERTE CON FRANCO CERCA DEL DEPTO ELEGIDO (20-nov-2026). NO APLICAR: es para que Fabrizio la
-- revise junto con la medición; la aplica Claude a pedido suyo. Vive en docs/propuestas/ y no en supabase/migrations/ a
-- propósito: una herramienta que aplique «todas las migraciones» no debe ejecutarla.
--
-- QUÉ HACE. Dado el depto elegido y la respuesta a «Dónde buscamos» del perfil, devuelve los candidatos que:
--   · son usados, activos, vistos en los últimos 7 días, dan Comprar (pie 20 %, 30 años) y cuestan hasta el tope de la persona;
--   · se parecen al elegido: m² dentro de ±20 % y dormitorios ±1 (lo mismo en las tres respuestas);
--   · pasan los TRES filtros de calidad, siempre:
--       1. al menos p_min_comp arriendos activos de su tamaño (±20 % m²) en el radio con que el motor midió su arriendo (si no,
--          el motor no puede estimar su arriendo: es el caso de los deptos grandes y atípicos);
--       2. no más de 35 % bajo el precio por m² de sus parecidos (lo que el informe muestra);
--       3. el título no dice «unidos», «piso completo», «edificio», «oficina», «local comercial», «terreno» ni «casa».
--   · y la respuesta cambia SOLO la distancia:
--       'cerca'    → hasta p_radio metros del elegido; si no hay ninguno, se amplía a su comuna (alcance = 'comuna_ampliada',
--                    para decirle a la persona «Cerca no había; buscamos en toda la comuna»);
--       'comuna'   → la comuna del elegido;
--       'convenga' → las comunas del perfil (p_comunas; si viene vacío, todas).
--
-- EL ORDEN (propuesta del punto 4): parte por el parecido y la cercanía, y lo que deja al mes desempata:
--   1. mismos dormitorios antes que ±1;
--   2. la distancia en tramos (hasta 800 m, hasta 1,5 km, hasta 3 km, más lejos): dentro de un tramo, la cercanía exacta no manda;
--   3. el parecido en m², en tramos de 5 % (|m² − m² del elegido| / m² del elegido);
--   4. lo que deja al mes (el mayor primero) — el desempate;
--   5. el puntaje y el id, para que el orden sea estable.
--
-- POR QUÉ PLPGSQL CON PLAN A MEDIDA (regla de CLAUDE.md, 02-nov-2026): recibe parámetros y cruza scraped_properties y
-- avisos_evaluados; en `language sql` Postgres la planificaría sin los valores (el radio, el tope) y elegiría mal.
--
-- MEDICIÓN (20-nov-2026, como función temporal en pg_temp con elegidos reales de la muestra):
--   · «donde más convenga», sin límite de comunas (Santiago, 37 m²): 12 candidatos en 172 ms. La primera versión, que le contaba
--     comparables a todos los candidatos, tardaba 4.554 ms y 3.036.215 páginas: por eso el filtro 1 va sobre los 60 mejores.
--   · «cerca», Ñuñoa (55 m²): 5 candidatos, el más lejano a 1.025 m, en 82 ms.
--   · «cerca», Puente Alto (39 m²): 0 cerca y 0 en la comuna (pocos avisos que pasen los filtros), en 10 ms.
-- Antes de aplicarla se mide de nuevo función contra consulta con EXPLAIN (ANALYZE, BUFFERS), como pide la regla.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.invierte_alternativas(
  p_aviso    uuid,
  p_modo     text,              -- 'cerca' | 'comuna' | 'convenga'
  p_tope     numeric,           -- hasta cuánto puede comprar (UF)
  p_comunas  text[] default null,
  p_radio    integer default 1500,
  p_max      integer default 12,
  p_min_comp integer default 6
)
returns table(aviso_id uuid, comuna text, distancia_m integer, superficie_m2 numeric, dormitorios integer, precio_uf numeric,
              flujo integer, score integer, alcance text)
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
declare
  e record;
  v_alcance text := p_modo;
  v_n integer;
begin
  select sp.location, sp.superficie_m2 as m2, sp.dormitorios as d, sp.comuna
    into e
  from scraped_properties sp where sp.id = p_aviso;
  if e.location is null or e.m2 is null or e.m2 <= 0 or e.d is null then
    return;
  end if;

  for i in 1..2 loop
    return query
    with base as (
      select c_sp.id, c_sp.comuna, c_sp.location, c_sp.superficie_m2 as m2, c_sp.dormitorios as d, c.precio_uf, c.flujo_20 as flujo,
             c.score_20 as score, coalesce((c.arriendo->>'radio')::int, 1000) as radio_arr,
             st_distance(c_sp.location, e.location)::int as dist
      from scraped_properties c_sp
      join avisos_evaluados c on c.aviso_id = c_sp.id
      where c_sp.is_active
        and coalesce(c_sp.condicion, 'usado') = 'usado'
        and c_sp.scraped_at >= now() - interval '7 days'
        and c_sp.id <> p_aviso
        and c.veredicto_20 = 'COMPRAR'
        and c.precio_uf <= p_tope
        and c_sp.superficie_m2 between e.m2 * 0.8 and e.m2 * 1.2
        and c_sp.dormitorios between e.d - 1 and e.d + 1
        and case v_alcance
              when 'cerca' then st_dwithin(c_sp.location, e.location, p_radio)
              when 'comuna' then c_sp.comuna = e.comuna
              when 'comuna_ampliada' then c_sp.comuna = e.comuna
              else (p_comunas is null or cardinality(p_comunas) = 0 or c_sp.comuna = any(p_comunas))
            end
        -- 2 · no más de 35 % bajo sus parecidos
        and not (coalesce((c.venta->>'precioM2UF')::numeric, 0) > 0
                 and c.precio_uf / c_sp.superficie_m2 < 0.65 * (c.venta->>'precioM2UF')::numeric)
        -- 3 · el título
        and coalesce(c_sp.titulo, '') !~* '(unidos|piso completo|edificio|oficina|local comercial|terreno|\mcasa\M)'
    ),
    -- Primero el orden, y el filtro caro (1) solo sobre los 60 mejores: contarle comparables a cada candidato de todas las comunas
    -- tardaba 4,5 s (3 millones de páginas, medido el 20-nov-2026); así, 172 ms.
    ordenados as (
      select b.*, row_number() over (
               order by (b.d = e.d) desc,
                        case when b.dist <= 800 then 0 when b.dist <= 1500 then 1 when b.dist <= 3000 then 2 else 3 end,
                        floor(abs(b.m2 - e.m2) / e.m2 / 0.05),
                        b.flujo desc nulls last,
                        b.score desc nulls last,
                        b.id) as pos
      from base b
      order by pos
      limit 60
    )
    select o.id, o.comuna, o.dist, o.m2, o.d, o.precio_uf, o.flujo, o.score, v_alcance
    from ordenados o
    -- 1 · arriendos de su tamaño en el radio del motor
    where (select count(*) from scraped_properties a
           where a.type = 'arriendo' and a.is_active
             and st_dwithin(a.location, o.location, o.radio_arr)
             and a.superficie_m2 between o.m2 * 0.8 and o.m2 * 1.2) >= p_min_comp
    order by o.pos
    limit p_max;

    get diagnostics v_n = row_count;
    exit when v_n > 0 or v_alcance <> 'cerca';
    v_alcance := 'comuna_ampliada';   -- cerca no hay ninguno: se amplía a la comuna y se le dice a la persona
  end loop;
end;
$$;

revoke execute on function public.invierte_alternativas(uuid, text, numeric, text[], integer, integer, integer) from public, anon, authenticated;
