-- Config table for global app settings (uf_value, tasa_hipotecaria)
--
-- NOTA (2026-08-03): este archivo creaba DOS tablas. El bloque de `market_data`
-- se retiró porque esa tabla nunca llegó a existir en la base: la migración no
-- se aplicó y sus lectores (getMarketDataForComuna, getZoneComparison) se comían
-- el PGRST205 en un try/catch y caían a un seed hardcodeado que subestimaba el
-- precio/m² entre 17% y 30%. Ese camino completo se borró.
--
-- `config` SÍ está viva en producción (la escribe el cron de UF/tasa y la lee
-- getConfig en src/lib/config-store.ts), así que el bloque queda. El nombre del
-- archivo se conserva para no alterar el orden ni el historial de migraciones.

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
