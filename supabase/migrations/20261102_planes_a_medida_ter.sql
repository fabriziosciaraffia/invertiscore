-- ─────────────────────────────────────────────────────────────────────────────
-- PLANES A MEDIDA, TERCERA TANDA (02-nov-2026, goal «cortes por statement_timeout»). Se aplica a mano en el SQL Editor.
--
-- explorar_negociar (la capa «Si negocias» del mapa de /explorar, 20261102_negociar_explorar.sql) nació el mismo día con el
-- defecto de las Fases 1 y 1-bis (20261102_planes_a_medida.sql y _bis): `language sql` con `set search_path`, no se inlinea
-- y Postgres 17 planifica su cuerpo SIN los valores de comunas, desde y pie (plan genérico).
-- Medido el 02-nov-2026 con los argumentos reales del chip (las 25 comunas de COMUNAS_DISPONIBLES, desde = hace 7 días):
--   · En producción, por PostgREST (pg_stat_statements, 36 llamadas): media 529 ms, mínimo 398, MÁXIMO 1.115 ms; ~59.300
--     páginas por llamada. La primera llamada en una sesión nueva, con páginas que no estaban en memoria: 9.310 ms.
--   · Función contra la misma consulta con los valores puestos (EXPLAIN ANALYZE BUFFERS, mediana de 3, en caliente):
--       pie 20 ...  382 ms · 58.822 páginas  →  120 ms · 27.869
--       pie 30 ...  439 ms · 67.767 páginas  →  138 ms · 31.541
--   · La de hoy contra ésta creada como función temporal de sesión, mismos argumentos, en la misma transacción:
--       pie 20 ...  378 ms · 58.822 páginas  →  118 ms · 27.900
--       pie 30 ...  442 ms · 67.767 páginas  →  133 ms · 31.572
-- LA SALIDA ES LA MISMA (verificado el 02-nov-2026, comparando el jsonb completo, en orden, con la de hoy): idéntica en los
-- seis juegos de argumentos — las 25 comunas a 7 días con pie 20 (3.110 avisos) y con pie 30 (3.629), las 25 a 1 día, tres
-- comunas, Lo Barnechea sola y la lista vacía.
--
-- EL ARREGLO, el mismo de la Fase 1: plpgsql con `set plan_cache_mode = force_custom_plan`, cada llamada se planifica con sus
-- valores. MISMA FIRMA, MISMO SELECT, MISMA SALIDA Y MISMO ORDEN (`order by d, id` dentro del jsonb_agg, sin tocar).
-- `#variable_conflict use_variable`: los nombres sin calificar del SELECT (comunas, desde, pie) siguen siendo los parámetros.
-- Fuera, a propósito: negociar_filas (por id, solo el script de relleno) y rellenar_negociar (escribe por id).
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '3s';

create or replace function public.explorar_negociar(comunas text[], desde timestamp without time zone, pie integer)
returns jsonb
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
declare
  resultado jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_array(u.id, u.comuna, u.lat, u.lng, u.m2, u.dormitorios, u.banos, u.precio, u.score, u.flujo,
      u.arriendo, u.condicion, u.alta, (u.neg->>'d')::numeric, (u.neg->>'p')::numeric::integer, (u.neg->>'s')::numeric::integer,
      (u.neg->>'f')::numeric::integer)
    order by (u.neg->>'d')::numeric, u.id), '[]'::jsonb)
  into resultado
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
  return resultado;
end;
$$;
revoke execute on function public.explorar_negociar(text[], timestamp without time zone, integer) from public, anon, authenticated;
grant execute on function public.explorar_negociar(text[], timestamp without time zone, integer) to service_role;
