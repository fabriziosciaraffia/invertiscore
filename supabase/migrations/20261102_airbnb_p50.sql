-- ─────────────────────────────────────────────────────────────────────────────
-- LA TARIFA Y LA OCUPACIÓN P50 EN COLUMNAS (02-nov-2026, goal «cortes por statement_timeout», Fase 2). Se aplica a mano en el
-- SQL Editor; el backfill va aparte (20261102_airbnb_p50_backfill.sql), después de esta.
--
-- La zona de renta corta de una comuna (strref-zona-query.ts › direccionesDeComuna) lee de cada respuesta guardada solo dos
-- números: el p50 de la tarifa y el p50 de la ocupación. Los sacaba con `raw_response->'percentiles'`, que obliga a
-- descomprimir la respuesta entera (unos 86 kB por fila; 197 MB la tabla). `%Santiago%` calza con 323 de 2.527 filas —también
-- con direcciones de otras comunas que dicen «…, Santiago, Región Metropolitana»—: unos 28 MB por pedido. El 02-nov-2026 a las
-- 12:30 UTC esa lectura se cortó por timeout y Explorar guardó los avisos de Santiago sin veredicto. Leer la tabla entera
-- toma 10,8 s y 62.700 páginas (19.400 desde disco).
--
-- LAS COLUMNAS: double precision, nulas, sin valor por defecto. Agregarlas es instantáneo (no reescribe la tabla). Una
-- columna GENERATED STORED la reescribiría entera con un bloqueo exclusivo, y frenaría toda lectura de renta corta mientras
-- dura. double precision es el mismo número que JavaScript obtiene al leer el JSON: la zona no cambia.
-- EL TRIGGER: antes de cada insert, y de cada update que toque raw_response, las llena desde la respuesta. Cubre los dos
-- upserts de airbnb/get-estimate.ts. Si el p50 no es un número, queda null (como hoy, la dirección no cuenta para la zona);
-- nunca falla el guardado.
-- lock_timeout: si una lectura larga tiene tomada la tabla, falla rápido en vez de dejar en cola a las demás.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '3s';

alter table public.airbnb_estimates
  add column if not exists adr_p50 double precision,
  add column if not exists occ_p50 double precision;

create or replace function public.airbnb_estimates_p50()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.adr_p50 := case when jsonb_typeof(new.raw_response #> '{percentiles,average_daily_rate,p50}') = 'number'
    then (new.raw_response #>> '{percentiles,average_daily_rate,p50}')::double precision end;
  new.occ_p50 := case when jsonb_typeof(new.raw_response #> '{percentiles,occupancy,p50}') = 'number'
    then (new.raw_response #>> '{percentiles,occupancy,p50}')::double precision end;
  return new;
end;
$$;
revoke execute on function public.airbnb_estimates_p50() from public, anon, authenticated;

drop trigger if exists airbnb_estimates_p50 on public.airbnb_estimates;
create trigger airbnb_estimates_p50
  before insert or update of raw_response on public.airbnb_estimates
  for each row execute function public.airbnb_estimates_p50();
