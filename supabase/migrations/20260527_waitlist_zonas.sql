-- waitlist_zonas — captura de interés por comunas fuera de la cobertura actual.
-- Phase 2.19 · Franco analiza hoy solo el Gran Santiago. Cuando un usuario
-- ingresa una dirección fuera de zona en el wizard, ofrecemos avisarle cuando
-- Franco llegue a su comuna. Esta tabla guarda esos leads (email + comuna).
--
-- Independiente de la tabla `waitlist` general (lista de espera del producto):
-- aquí lo relevante es la DEMANDA por comuna para priorizar expansión.

CREATE TABLE IF NOT EXISTS waitlist_zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  comuna TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup por comuna para medir demanda agregada por zona.
CREATE INDEX IF NOT EXISTS idx_waitlist_zonas_comuna ON waitlist_zonas (comuna);

-- RLS on, sin policies públicas: solo el service role (API server-side) escribe.
-- Evita que el anon key lea/inserte emails de leads directamente.
ALTER TABLE waitlist_zonas ENABLE ROW LEVEL SECURITY;
