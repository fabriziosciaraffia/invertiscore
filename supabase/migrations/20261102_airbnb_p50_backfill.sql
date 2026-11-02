-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL DE adr_p50 Y occ_p50 (02-nov-2026). Va DESPUÉS de 20261102_airbnb_p50.sql. Se aplica a mano en el SQL Editor.
--
-- Llena las dos columnas de las filas que ya estaban, con la misma regla del trigger (solo si el p50 es un número). Lee la
-- respuesta entera de cada fila una vez: unos 11 s y 62.700 páginas, medido el 02-nov-2026. Bloquea filas, no la tabla:
-- las lecturas siguen. No toca raw_response, así que el trigger no se dispara. Repetirlo no cambia nada.
-- ─────────────────────────────────────────────────────────────────────────────

update public.airbnb_estimates
set adr_p50 = case when jsonb_typeof(raw_response #> '{percentiles,average_daily_rate,p50}') = 'number'
      then (raw_response #>> '{percentiles,average_daily_rate,p50}')::double precision end,
    occ_p50 = case when jsonb_typeof(raw_response #> '{percentiles,occupancy,p50}') = 'number'
      then (raw_response #>> '{percentiles,occupancy,p50}')::double precision end
where adr_p50 is null or occ_p50 is null;
