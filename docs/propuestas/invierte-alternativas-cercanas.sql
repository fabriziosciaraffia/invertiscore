-- ─────────────────────────────────────────────────────────────────────────────
-- PROPUESTA · LAS ALTERNATIVAS DE INVIERTE CON FRANCO (20-nov-2026, versión 3). NO APLICAR: es para que Fabrizio la revise junto
-- con la medición; la aplica Claude a pedido suyo. Vive en docs/propuestas/ y no en supabase/migrations/ a propósito: una
-- herramienta que aplique «todas las migraciones» no debe ejecutarla.
--
-- QUÉ HACE. Dado el depto elegido y la respuesta a «Dónde buscamos» del perfil, devuelve hasta p_max candidatos que:
--   · son usados, activos, vistos en los últimos 7 días, dan Comprar (pie 20 %, 30 años) y cuestan hasta el tope de la persona;
--   · se parecen al elegido: m² dentro de ±20 % y dormitorios ±1 (en todos los niveles y en las tres respuestas);
--   · NO están ya en la base de la persona: quien llama pasa en p_excluir los aviso_id de sus deptos (la función no conoce a
--     la persona); tampoco el elegido;
--   · NO son el mismo depto que el elegido ni que otro ya puesto en la lista, publicado por otro corredor (ver abajo);
--   · pasan los TRES filtros de calidad, siempre (decisión de Fabrizio, 20-nov-2026):
--       1. al menos p_min_comp (6) arriendos activos de su tamaño (±20 % m²) en el radio con que el motor midió su arriendo;
--       2. no más de 35 % bajo el precio por m² de sus parecidos (lo que el informe muestra);
--       3. el título no es de algo que no es un depto: «dptos/deptos/departamentos unidos», «edificio completo», «venta (de)
--          edificio», «oficina» sin «depto/dpto/departamento», «local comercial», «venta de terreno» o un título que empieza
--          con «terreno», y «casa» salvo «tipo casa» o «casa tipo». Revisado contra los 4.789 Comprar del 20-nov-2026: la regla
--          anterior sacaba 35 títulos, varios normales («departamento en edificio Plaza Toesca»); esta saca 9, todos atípicos.
--   · y la respuesta cambia DÓNDE se busca:
--       'cerca'    → nivel 'cerca' (hasta 1,5 km); si no hay ninguno, 'tres_km' (hasta 3 km, aunque cruce de comuna); si
--                    tampoco, 'comuna' (la del elegido); si tampoco, 'solo_elegido';
--       'comuna'   → nivel 'comuna'; si no hay ninguno, 'solo_elegido';
--       'convenga' → nivel 'perfil' (las comunas del perfil, p_comunas; vacío = todas); si no hay ninguno, 'solo_elegido'.
--   · SIEMPRE dice qué nivel usó (columna `nivel`). Con 'solo_elegido' devuelve UNA fila con aviso_id NULL.
--
-- EL MISMO DEPTO EN DOS AVISOS. La clave que ya existe (src/lib/avisos/plausible.ts › claveAviso) exige el precio exacto y junta
-- solo 59 casos. Esta regla: a 30 m o menos, mismos dormitorios y baños, m² con 1 de diferencia como máximo, precio dentro de 3 %
-- y publicados por corredores DISTINTOS (o alguno sin publicador conocido). Del mismo corredor se tratan como dos deptos: suelen
-- ser dos unidades del mismo edificio. Medido el 20-nov-2026 sobre 19.889 usados activos: 1.694 pares con la regla sin el
-- corredor; de los 370 con publicador conocido en los dos, 276 son de corredores distintos.
--
-- EL ORDEN:
--   · 'cerca' y 'comuna' (y sus ampliaciones): 1) mismos dormitorios antes que ±1; 2) la distancia en tramos (800 m, 1,5 km,
--     3 km, más); 3) el parecido en m² en tramos de 5 %; 4) lo que deja al mes, el desempate; 5) puntaje e id.
--   · 'convenga': 1) mismos dormitorios; 2) el parecido en m²; 3) lo que deja al mes; 4) puntaje e id. La distancia no ordena.
--
-- EL FILTRO CARO (contar los arriendos de su tamaño) se calcula candidato por candidato, en el orden de arriba, solo hasta juntar
-- p_max: nunca se amplía al nivel siguiente mientras queden candidatos válidos más abajo. Tope: 600 candidatos revisados por nivel.
--
-- POR QUÉ PLPGSQL CON PLAN A MEDIDA (regla de CLAUDE.md, 02-nov-2026): recibe parámetros y cruza tablas grandes.
-- QUIÉN PUBLICA (avisos_publicador) es de uso interno: la función solo compara los id para reconocer duplicados y no los
-- devuelve; el archivo que la llame tendrá que entrar en la lista del tier PUBLICADORES §5 con su acta.
--
-- MEDICIÓN: en el reporte a Fabrizio del 20-nov-2026. Antes de aplicarla se mide de nuevo función contra consulta con
-- EXPLAIN (ANALYZE, BUFFERS), como pide la regla.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.invierte_alternativas(
  p_aviso    uuid,
  p_modo     text,                 -- 'cerca' | 'comuna' | 'convenga'
  p_tope     numeric,              -- hasta cuánto puede comprar (UF)
  p_comunas  text[] default null,
  p_excluir  uuid[] default null,  -- los deptos que ya están en la base de la persona
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
  -- lo aceptado en este nivel, para no repetir el mismo depto de otro corredor
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
        -- 2 · no más de 35 % bajo sus parecidos
        and not (coalesce((ev.venta->>'precioM2UF')::numeric, 0) > 0
                 and ev.precio_uf / c_sp.superficie_m2 < 0.65 * (ev.venta->>'precioM2UF')::numeric)
        -- 3 · el título
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

      -- ¿el mismo depto que el elegido, o que uno ya aceptado, publicado por otro corredor?
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

      -- 1 · al menos p_min_comp arriendos de su tamaño en el radio del motor (lo caro: solo hasta llenar la lista)
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

  -- Ningún nivel tuvo candidatos: se muestra solo el depto elegido.
  aviso_id := null; comuna := null; distancia_m := null; superficie_m2 := null; dormitorios := null; precio_uf := null;
  flujo := null; score := null; nivel := 'solo_elegido';
  return next;
end;
$$;

revoke execute on function public.invierte_alternativas(uuid, text, numeric, text[], uuid[], integer, integer) from public, anon, authenticated;
