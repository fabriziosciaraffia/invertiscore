-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de datos de mercado (Banco Central, etc.)
CREATE TABLE IF NOT EXISTS market_data_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type TEXT NOT NULL,
  value DECIMAL NOT NULL,
  date DATE NOT NULL,
  source TEXT DEFAULT 'banco_central',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(data_type, date)
);
CREATE INDEX IF NOT EXISTS idx_market_data_v2_type_date ON market_data_v2(data_type, date DESC);

-- Tabla de propiedades scrapeadas CON GEOMETRÍA
CREATE TABLE IF NOT EXISTS scraped_properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  type TEXT NOT NULL,
  comuna TEXT NOT NULL,
  direccion TEXT,

  -- GEOREFERENCIA
  lat DECIMAL,
  lng DECIMAL,
  location GEOGRAPHY(POINT, 4326),
  geocoded BOOLEAN DEFAULT FALSE,

  -- DATOS DE LA PROPIEDAD
  precio DECIMAL NOT NULL,
  moneda TEXT DEFAULT 'CLP',
  superficie_m2 DECIMAL,
  dormitorios INTEGER,
  banos INTEGER,
  gastos_comunes DECIMAL,
  estacionamientos INTEGER,
  bodegas INTEGER,
  piso INTEGER,
  antiguedad TEXT,

  url TEXT,
  scraped_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- Índices geoespaciales y de búsqueda
CREATE INDEX IF NOT EXISTS idx_scraped_location ON scraped_properties USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_scraped_comuna_type ON scraped_properties(comuna, type, is_active);
CREATE INDEX IF NOT EXISTS idx_scraped_active ON scraped_properties(is_active) WHERE is_active = TRUE;

-- Trigger para auto-generar geography point cuando se insertan lat/lng
CREATE OR REPLACE FUNCTION update_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
    NEW.geocoded := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_location ON scraped_properties;
CREATE TRIGGER trigger_update_location
  BEFORE INSERT OR UPDATE OF lat, lng
  ON scraped_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_location();

-- Tabla de estadísticas por zona
CREATE TABLE IF NOT EXISTS market_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comuna TEXT NOT NULL,
  dormitorios INTEGER,
  type TEXT NOT NULL,

  count INTEGER DEFAULT 0,
  precio_promedio DECIMAL,
  precio_mediana DECIMAL,
  precio_p25 DECIMAL,
  precio_p75 DECIMAL,
  precio_m2_promedio DECIMAL,
  precio_m2_mediana DECIMAL,
  ggcc_promedio DECIMAL,
  superficie_promedio DECIMAL,

  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comuna, dormitorios, type)
);
CREATE INDEX IF NOT EXISTS idx_market_stats_lookup ON market_stats(comuna, type, dormitorios);

-- Función RPC para buscar propiedades por radio (PostGIS)
CREATE OR REPLACE FUNCTION properties_within_radius(
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius_meters INTEGER,
  prop_type TEXT,
  prop_dorms INTEGER DEFAULT NULL
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
    AND ST_DWithin(
      sp.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;
