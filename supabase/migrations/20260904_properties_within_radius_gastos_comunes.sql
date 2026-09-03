-- ─────────────────────────────────────────────────────────────────────────────
-- properties_within_radius: alinear la función VIVA con el repo y devolver
-- gastos_comunes.
--
-- QUÉ HABÍA EN LA BASE (leído con pg_get_functiondef el 04-sep-2026): dos
-- overloads.
--   · La vieja (5 args, lat/lng NUMERIC, sin comuna ni condición) devuelve
--     id, precio, moneda, superficie_m2, dormitorios, gastos_comunes, lat, lng,
--     distance. Nadie la llama: market-suggestions pasa siempre 7 argumentos.
--   · La viva (7 args, lat/lng DOUBLE PRECISION) es la que atiende al wizard y
--     devuelve SOLO lat, lng, precio, superficie_m2, distance. No devuelve
--     gastos_comunes, que market-suggestions lee para estimar el gasto común de
--     los comparables → ese campo llegaba siempre undefined y el gasto común por
--     radio nunca se estimó. Tampoco devuelve dormitorios ni id.
--   · La migración del repo (20260317) declara 7 args con lat/lng DECIMAL y
--     devuelve gastos_comunes, pero filtra `geocoded = TRUE` (7.022 filas tienen
--     geocoded = true con lat NULL) y no coincide con lo que hay en la base:
--     si se aplicara tal cual crearía un TERCER overload (DECIMAL ≠ DOUBLE
--     PRECISION) y PostgREST tendría dos candidatas para la misma llamada.
--
-- QUÉ HACE ESTA MIGRACIÓN:
--   1. Borra la overload vieja de 5 args (sin callers).
--   2. Reemplaza la viva conservando su firma (DOUBLE PRECISION, para que sea
--      la MISMA función y no otra overload) y ampliando el RETURNS TABLE con
--      id, moneda, dormitorios y gastos_comunes. CREATE OR REPLACE no puede
--      cambiar el tipo de retorno, por eso va DROP + CREATE.
--   3. Mantiene los filtros de la viva que son mejores que los del repo:
--      `location IS NOT NULL` (no `geocoded`) y `prop_type` opcional. Y
--      corrige el de condición con COALESCE(condicion, 'usado'): las filas sin
--      condición son usadas (default del insert) y con `sp.condicion =
--      prop_condicion` pelado se caían del universo usado (trampa del NULL,
--      CLAUDE.md).
--
-- OJO: hoy (04-sep-2026) NINGUNA fila de scraped_properties tiene
-- gastos_comunes > 0 — el GetProps no lo trae y el parser no lo escribe. Esta
-- migración deja la cañería lista; el gasto común por radio se va a estimar
-- solo cuando alguna fuente llene la columna.
--
-- Aplicar a mano en el SQL editor de Supabase (dev y prod comparten base).
-- Verificación posterior:
--   select proname, pg_get_function_arguments(oid), pg_get_function_result(oid)
--   from pg_proc where proname = 'properties_within_radius';
--   → UNA fila, 7 argumentos, resultado con gastos_comunes.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP FUNCTION IF EXISTS public.properties_within_radius(numeric, numeric, integer, text, integer);

DROP FUNCTION IF EXISTS public.properties_within_radius(double precision, double precision, integer, text, integer, text, text);

CREATE FUNCTION public.properties_within_radius(
  center_lat double precision,
  center_lng double precision,
  radius_meters integer,
  prop_type text DEFAULT NULL,
  prop_dorms integer DEFAULT NULL,
  prop_comuna text DEFAULT NULL,
  prop_condicion text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  precio numeric,
  moneda text,
  superficie_m2 numeric,
  dormitorios integer,
  gastos_comunes numeric,
  lat numeric,
  lng numeric,
  distance_meters double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.precio,
    sp.moneda,
    sp.superficie_m2,
    sp.dormitorios,
    sp.gastos_comunes,
    sp.lat,
    sp.lng,
    ST_Distance(
      sp.location::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) AS distance_meters
  FROM scraped_properties sp
  WHERE sp.is_active = true
    AND sp.location IS NOT NULL
    AND ST_DWithin(
      sp.location::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
    AND (prop_type IS NULL OR sp.type = prop_type)
    AND (prop_dorms IS NULL OR sp.dormitorios = prop_dorms)
    AND (prop_comuna IS NULL OR sp.comuna = prop_comuna)
    AND (prop_condicion IS NULL OR COALESCE(sp.condicion, 'usado') = prop_condicion)
  ORDER BY distance_meters;
END;
$$;

COMMIT;
