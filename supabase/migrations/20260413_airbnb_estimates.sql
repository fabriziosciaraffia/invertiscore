-- Tabla de cache para estimaciones de Airbnb (AirROI API)
CREATE TABLE airbnb_estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  bedrooms INTEGER NOT NULL,
  baths INTEGER NOT NULL,
  guests INTEGER NOT NULL,

  -- Response completo para debug
  raw_response JSONB,

  -- Métricas calculadas (medianas de comparables filtrados)
  comparables_count INTEGER,
  median_adr NUMERIC,
  median_occupancy NUMERIC,
  median_annual_revenue NUMERIC,

  -- Tier premium
  tier_premium_adr NUMERIC,
  tier_premium_occupancy NUMERIC,
  tier_premium_revenue NUMERIC,
  tier_premium_count INTEGER,

  -- Tier standard
  tier_standard_adr NUMERIC,
  tier_standard_occupancy NUMERIC,
  tier_standard_revenue NUMERIC,
  tier_standard_count INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX idx_airbnb_estimates_cache_key ON airbnb_estimates(cache_key);
CREATE INDEX idx_airbnb_estimates_expires ON airbnb_estimates(expires_at);
