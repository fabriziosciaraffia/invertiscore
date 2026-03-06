-- Market data table for real estate market statistics by comuna
CREATE TABLE IF NOT EXISTS market_data (
  id BIGSERIAL PRIMARY KEY,
  comuna TEXT NOT NULL,
  tipo TEXT NOT NULL, -- '1D', '2D', '3D'
  arriendo_promedio INTEGER NOT NULL, -- CLP/mes
  precio_m2_promedio NUMERIC(6,1) NOT NULL, -- UF/m² (arriendo-derived)
  precio_m2_venta_promedio NUMERIC(6,1) NOT NULL DEFAULT 0, -- UF/m² (sale price)
  gastos_comunes_m2 INTEGER NOT NULL DEFAULT 1200, -- CLP/m²
  numero_publicaciones INTEGER NOT NULL DEFAULT 0,
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comuna, tipo)
);

ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data"
  ON market_data FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage market data"
  ON market_data FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_market_data_comuna_tipo ON market_data(comuna, tipo);

-- Config table for global app settings (tasa hipotecaria, etc.)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config"
  ON config FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage config"
  ON config FOR ALL USING (true) WITH CHECK (true);

-- Seed default config
INSERT INTO config (key, value) VALUES
  ('tasa_hipotecaria', '4.72')
ON CONFLICT (key) DO NOTHING;
