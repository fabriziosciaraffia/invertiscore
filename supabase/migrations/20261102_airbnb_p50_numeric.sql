-- ─────────────────────────────────────────────────────────────────────────────
-- adr_p50 Y occ_p50 COMO numeric (02-nov-2026, goal «cortes por statement_timeout», Fase 2). Corrige 20261102_airbnb_p50.sql.
-- Se aplica a mano en el SQL Editor; el backfill va aparte (20261102_airbnb_p50_numeric_backfill.sql), después de esta.
--
-- POR QUÉ: la base tiene `extra_float_digits = 0`, así que un double precision sale por PostgREST con 15 dígitos
-- («71854.36133245467» del JSON salía «71854.3613324547»). La foto de las zonas antes y después dio la misma respuesta típica,
-- la misma celda y el mismo n, pero `ingresoAnual` distinto en el decimal 15. numeric guarda el número del JSON tal cual: en
-- una muestra de 400 filas el texto salió idéntico en las 400 (con double precision, en 2).
--
-- Borrar una columna y agregar otra no reescribe la tabla (el bloqueo dura un instante). El trigger sigue siendo el mismo;
-- solo cambia la función, que ahora castea a numeric. Si el p50 no es un número, queda null; el guardado nunca falla.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '3s';

alter table public.airbnb_estimates
  drop column if exists adr_p50,
  drop column if exists occ_p50;

alter table public.airbnb_estimates
  add column adr_p50 numeric,
  add column occ_p50 numeric;

create or replace function public.airbnb_estimates_p50()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.adr_p50 := case when jsonb_typeof(new.raw_response #> '{percentiles,average_daily_rate,p50}') = 'number'
    then (new.raw_response #>> '{percentiles,average_daily_rate,p50}')::numeric end;
  new.occ_p50 := case when jsonb_typeof(new.raw_response #> '{percentiles,occupancy,p50}') = 'number'
    then (new.raw_response #>> '{percentiles,occupancy,p50}')::numeric end;
  return new;
end;
$$;
revoke execute on function public.airbnb_estimates_p50() from public, anon, authenticated;
