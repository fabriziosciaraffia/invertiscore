-- ─────────────────────────────────────────────────────────────────────────────
-- LA ASESORÍA · EL PLAZO SEGÚN LA EDAD (27-nov-2026). PARA QUE LO APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- La capacidad usa el plazo según la edad (30, 25, 20 o 15 años), y flujo_20 está a 30 años. MEDIDO el 27-nov-2026 con la sonda
-- del motor (la misma de las columnas _25 y del «Cambiar» del pop-up), muestra determinista de 200 de los 4.792 Comprar usados a
-- 30 años (pie 20 %): siguen siendo Comprar 138 a 25 años (69 %; la columna veredicto_20_25 dice 139), 68 a 20 (34 %) y 23 a
-- 15 (11,5 %). Ajustar solo el flujo con la cuota del plazo corto (error mediano $820 contra la sonda) no alcanza: a 20 años la
-- mitad de los que quedarían ya no son Comprar. Por eso:
--
-- 1 · avisos_evaluados suma el mismo aviso a 20 y a 15 años con pie 20 % (veredicto, puntaje y flujo de la sonda), como las
--     columnas _25. Las escribe el cron al evaluar (fila-evaluada.ts) y el relleno de una vez rellena las de hoy
--     (scripts/rellenar-plazos-cortos.ts, con rellenar_plazos_cortos, que no pisa una fila que el cron reevaluó entretanto).
-- 2 · asesoria_candidatos se reemplaza: sin el aporte (lo filtra el servidor contra el flujo del plazo de cada persona) y con
--     el flujo y el veredicto de los cuatro plazos. Devuelve jsonb, como explorar_mapa_todos: un set de filas por PostgREST
--     se corta en 1.000 y el universo son ~4.600. Columnas: id, comuna, lat, lng, dormitorios, precio, puntaje a 30, arriendo,
--     flujo a 30 / 25 / 20 / 15, Comprar a 25 / 20 / 15 (null sin evaluar = no Comprar).
--
-- MEDIDO el 27-nov-2026, consulta equivalente (la función nueva se mide al aplicarla y la cifra se agrega acá): todas las
-- comunas, 7 días, sin tope → 4.553 filas, 89 ms, 36.161 páginas en caché.
-- plpgsql con plan a medida (regla del 02-nov-2026).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.avisos_evaluados
  add column if not exists veredicto_20_20 text,
  add column if not exists score_20_20 integer,
  add column if not exists flujo_20_20 integer,
  add column if not exists veredicto_20_15 text,
  add column if not exists score_20_15 integer,
  add column if not exists flujo_20_15 integer;

create or replace function public.rellenar_plazos_cortos(filas jsonb)
returns integer
language sql
set search_path = public, pg_temp
as $$
  with f as (
    select * from jsonb_to_recordset(filas) as x(
      aviso_id uuid, evaluado_at timestamptz,
      veredicto_20_20 text, score_20_20 integer, flujo_20_20 integer,
      veredicto_20_15 text, score_20_15 integer, flujo_20_15 integer
    )
  ), u as (
    update avisos_evaluados ae set
      veredicto_20_20 = f.veredicto_20_20, score_20_20 = f.score_20_20, flujo_20_20 = f.flujo_20_20,
      veredicto_20_15 = f.veredicto_20_15, score_20_15 = f.score_20_15, flujo_20_15 = f.flujo_20_15
    from f
    where ae.aviso_id = f.aviso_id and ae.evaluado_at = f.evaluado_at
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.rellenar_plazos_cortos(jsonb) from public, anon, authenticated;

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
