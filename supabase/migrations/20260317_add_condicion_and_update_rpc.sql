-- Add condicion column to scraped_properties
ALTER TABLE scraped_properties ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'usado';

-- Recreate RPC with prop_comuna and prop_condicion parameters
CREATE OR REPLACE FUNCTION properties_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_meters INTEGER,
  prop_type TEXT,
  prop_dorms INTEGER DEFAULT NULL,
  prop_comuna TEXT DEFAULT NULL,
  prop_condicion TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  precio DECIMAL,
  moneda TEXT,
  superficie_m2 DECIMAL,
  dormitorios INTEGER,
  gastos_comunes DECIMAL,
  lat DECIMAL,
  lng DECIMAL,
  distance_meters DOUBLE PRECISION
) AS $$
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
      sp.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) as distance_meters
  FROM scraped_properties sp
  WHERE sp.is_active = TRUE
    AND sp.geocoded = TRUE
    AND sp.type = prop_type
    AND (prop_dorms IS NULL OR sp.dormitorios = prop_dorms)
    AND (prop_comuna IS NULL OR sp.comuna = prop_comuna)
    AND (prop_condicion IS NULL OR COALESCE(sp.condicion, 'usado') = prop_condicion)
    AND ST_DWithin(
      sp.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;
