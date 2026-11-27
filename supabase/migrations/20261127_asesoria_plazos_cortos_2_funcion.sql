-- ─────────────────────────────────────────────────────────────────────────────
-- LA ASESORÍA · EL PLAZO SEGÚN LA EDAD · PARTE 2 DE 2: LA FUNCIÓN (27-nov-2026). PARA QUE LO APLIQUE CLAUDE DESPUÉS DEL RELLENO.
--
-- asesoria_candidatos se reemplaza: sin el aporte (lo filtra el servidor contra el flujo del plazo de cada persona) y con el flujo
-- y el veredicto de los cuatro plazos. Devuelve jsonb, como explorar_mapa_todos: un set de filas por PostgREST se corta en 1.000 y
-- el universo son ~4.600. Columnas: id, comuna, lat, lng, dormitorios, precio, puntaje a 30, arriendo, flujo a 30 / 25 / 20 / 15,
-- Comprar a 25 / 20 / 15 (null sin evaluar = no Comprar).
--
-- MEDIDO el 27-nov-2026, consulta equivalente (la función se mide al aplicarla y la cifra se agrega acá): todas las comunas,
-- 7 días, sin tope → 4.553 filas, 89 ms, 36.161 páginas en caché.
-- plpgsql con plan a medida (regla del 02-nov-2026).
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.asesoria_candidatos(text[], timestamp, integer, numeric);

create function public.asesoria_candidatos(p_comunas text[], p_desde timestamp, p_tope numeric default null)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_array(
        sp.id, sp.comuna, round(sp.lat::numeric, 6), round(sp.lng::numeric, 6),
        case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
        round(ae.precio_uf)::int, ae.score_20, nullif(ae.arriendo->>'monto', '')::numeric::integer,
        ae.flujo_20, ae.flujo_20_25, ae.flujo_20_20, ae.flujo_20_15,
        ae.veredicto_20_25 is not distinct from 'COMPRAR',
        ae.veredicto_20_20 is not distinct from 'COMPRAR',
        ae.veredicto_20_15 is not distinct from 'COMPRAR')
      order by ae.score_20 desc nulls last, sp.id), '[]'::jsonb)
    from scraped_properties sp
    join avisos_evaluados ae on ae.aviso_id = sp.id
    left join publicacion_avisos pa on pa.aviso_id = sp.id
    where sp.is_active = true
      and sp.type = 'venta'
      and sp.condicion is distinct from 'nuevo'
      and sp.lat is not null and sp.lng is not null
      and sp.scraped_at >= p_desde
      and (p_comunas is null or cardinality(p_comunas) = 0 or sp.comuna = any(p_comunas))
      and ae.arriendo is not null
      and ae.arriendo_sospechoso is not true
      and pa.estado is distinct from 'despublicado'
      and ae.veredicto_20 = 'COMPRAR'
      and (p_tope is null or ae.precio_uf <= p_tope)
  );
end;
$$;
revoke execute on function public.asesoria_candidatos(text[], timestamp, numeric) from public, anon, authenticated;
