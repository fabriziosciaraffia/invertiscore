-- Market data table for real estate market statistics by comuna
CREATE TABLE IF NOT EXISTS market_data (
  id BIGSERIAL PRIMARY KEY,
  comuna TEXT NOT NULL,
  tipo TEXT NOT NULL, -- '1D', '2D', '3D'
  arriendo_promedio INTEGER NOT NULL, -- CLP/mes
  precio_m2_promedio NUMERIC(6,1) NOT NULL, -- UF/m²
  gastos_comunes_m2 INTEGER NOT NULL DEFAULT 1200, -- CLP/m²
  numero_publicaciones INTEGER NOT NULL DEFAULT 0,
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comuna, tipo)
);

-- Enable RLS
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read market data (public info)
CREATE POLICY "Anyone can read market data"
  ON market_data FOR SELECT
  USING (true);

-- Allow authenticated users to insert/update (the scraping API runs authenticated)
CREATE POLICY "Authenticated can manage market data"
  ON market_data FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_market_data_comuna_tipo ON market_data(comuna, tipo);
